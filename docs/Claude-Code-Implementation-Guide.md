# Claude Code 实施操作指南

## 针对 NineScrolls Feedback System Architecture v2.0

---

## 前置准备

### 1. 确认项目结构

在开始之前，确保 Claude Code 能访问到你的项目目录和架构文档：

```bash
# 在项目根目录启动 Claude Code
cd /path/to/ninescrolls-website
claude
```

### 2. 让 Claude Code 先读架构文档

每次开新会话时，先让它熟悉上下文：

```
读一下 NineScrolls-Feedback-System-Architecture.md，这是我们的系统架构设计文档 v2.0。
接下来我会按 Phase 给你分配实施任务。先不要写代码，确认你理解了整体架构。
```

### 3. 确定管理后台技术选型

在开始 Phase 1 之前，需要先确定：

- 管理后台 UI 框架（建议：React + Ant Design 或 shadcn/ui）
- 是否和现有网站共用一个 React 项目，还是独立项目
- CDK 还是 SAM 还是 Serverless Framework 管理 AWS 资源

可以直接问 Claude Code：

```
我的网站是 React + TypeScript，部署在 AWS Amplify。
管理后台我想用 [你选的框架]。
AWS 基础设施用 [CDK / SAM / Amplify CLI]。
基于架构文档，帮我规划一下项目目录结构。
```

---

## Phase 1: RFQ + Order Tracker + 文档存储

按依赖关系，从底层往上，分 7 步执行。

### Step 1: DynamoDB 表 + GSI

```
按照架构文档 §12.3 的 DynamoDB 数据模型，创建 CDK/SAM 定义：

- 复用现有 NineScrolls-Intelligence 单表
- 新增实体：ORDER, ORDER_CONTACT, ORDER_LOG, ORDER_DOCUMENT, RFQ_SUBMISSION
- GSI1 (type/status 查询), GSI2 (org 查询), GSI3 (order→feedback 关联)
- 启用 PITR
- 参考文档 §3.1 的 FEEDBACK 实体和 §12.10.4 的 RFQ_SUBMISSION 实体

先只生成 infrastructure 代码，不写 Lambda。
```

**验证：** 部署后在 AWS Console 检查表和 GSI 是否正确创建。

### Step 2: S3 Bucket

```
按照架构文档 §12.9.3，创建 S3 bucket：

- Bucket name: ninescrolls-order-documents
- 私有，SSE-S3 加密
- 启用 Versioning
- Lifecycle: temp/ 目录 24h 自动清理
- CORS: 允许管理后台域名直传
- 目录结构: orders/<orderId>/<stage>/ 和 rfqs/<rfqId>/ 和 temp/

生成 CDK/SAM 定义。
```

### Step 3: Lambda 函数 — submit-rfq

```
按照架构文档 §12.10.5 实现 submit-rfq Lambda：

- 触发: API Gateway POST /api/rfq
- Node.js 20.x, 256MB, 15s timeout
- 处理流程: 验证 Turnstile → schema validation → 生成 rfqId → 匹配 ORG →
  存 RFQ_SUBMISSION → 处理附件 → Lead Score 更新 → 发通知 → 返回
- RFQ 不自动创建 ORDER（这是 v2.0 的关键设计决策）
- 用 Zod 做 schema validation
- 参考文档 §12.10.3 的 API 格式

同时创建 API Gateway endpoint。包含单元测试。
```

### Step 4: Lambda 函数 — convert-rfq-to-order + update-order-status

```
按照架构文档实现两个 Lambda：

1. convert-rfq-to-order (§12.10.6):
   - 从 RFQ 创建 ORDER (INQUIRY 状态) + ORDER_CONTACT
   - 迁移附件 S3 copy
   - 更新 RFQ status → converted

2. update-order-status (§12.5):
   - 状态机校验: INQUIRY → QUOTING → QUOTE_SENT → PO_RECEIVED → IN_PRODUCTION → SHIPPED → INSTALLED → CLOSED
   - 特殊路径: INQUIRY → DECLINED
   - ConditionExpression 并发控制 (§20.3)
   - INSTALLED 时创建 5 条 FEEDBACK_SCHEDULE
   - 写 ORDER_LOG
   - Slack 通知

3. presigned URL Lambda for document upload (§12.9.5 的 getDocumentUploadUrl + confirmDocumentUpload)

包含单元测试。
```

### Step 5: GraphQL API (AppSync)

```
按照架构文档 §12.4 的 GraphQL schema，配置 AppSync：

- Order, OrderContact, OrderLog, OrderDocument types
- OrderStatus enum (含 INQUIRY, QUOTE_SENT, DECLINED)
- Queries: listOrders, getOrder, getOrderLogs, orderStats
- Mutations: createOrder, updateOrderStatus, updateOrder, addContact,
  updateContact, removeContact, declineInquiry
- Subscription: onOrderStatusChange
- 加上 RFQ 相关的 queries/mutations

Resolver 连接到对应的 Lambda 函数。
Cognito auth 保护。
```

### Step 6: 管理后台 UI

```
按照架构文档实现管理后台，分三块：

1. RFQ 管理 (§12.10.8):
   - RFQListPage: StatsBar + RFQTable + Filters
   - RFQDetail: Contact/Equipment/Project 信息 + [Convert to Order] + [Decline]
   - ConvertToOrderDialog
   - DeclineDialog

2. Order Tracker (§12.6):
   - OrderListPage: StatsBar + OrderTable (含 INQUIRY/QUOTE_SENT 状态)
   - OrderDetail: InfoPanel + Timeline + ContactsPanel + DocumentsPanel + ActivityLog
   - CreateOrderForm

3. DocumentsPanel (§12.9.6):
   - Stage tabs + DocumentRow + Upload Dialog + Preview Modal
   - Presigned URL direct upload to S3

先做功能，样式后面统一调整。
```

### Step 7: 前端 RFQ 页面

```
按照架构文档 §12.10.2 实现 RFQPage.tsx：

- 路由: /request-quote
- 表单: Contact Info + Equipment Requirements + Project Context + File Upload + Privacy Consent
- Cloudflare Turnstile 集成
- 提交到 POST /api/rfq
- Success screen 显示 reference number
- 响应式设计，参考现有 FeedbackPage.tsx 的样式风格
- 加到导航栏

包含表单验证 (参考文档的 validation rules)。
```

**Phase 1 完成标志：** 你可以在网站上提交 RFQ → 在管理后台看到这条 RFQ → 点 Convert to Order 创建订单 → 推进状态 → 上传文档。

---

## Phase 2: 反馈收集 + 管理

### Step 8: submit-feedback Lambda

```
按照架构文档 §5.1 实现 submit-feedback Lambda：

- POST /api/feedback
- 验证 + 清洗 + 存 DynamoDB (FEEDBACK 实体, 含 GSI3 orderId 关联)
- 计算 overallScore
- IP 哈希 + ORG 匹配
- Lead Score 更新
- SES 确认邮件 + Slack 通知
- 注意 §3.1 的 GSI3PK/GSI3SK 字段设计

FeedbackPage.tsx 已经写好了，只需要接通 API endpoint 和加到路由。
```

### Step 9: Feedback Dashboard

```
按照架构文档 §6.2 实现 Feedback Dashboard：

- FeedbackTable + Filters (type, status, date, score)
- FeedbackDetail drawer (ratings visual bars + text responses + reply)
- Status 管理 + Internal notes
- Reply 功能 (触发 SES)
- CSV 导出
- 在 Order Detail 中显示关联反馈 (通过 GSI3 查询)
```

---

## Phase 3: 自动反馈邀请

### Step 10: Token 系统 + 邀请调度

```
按照架构文档 §16 实现 Token 系统：

- Token 生成: HMAC-SHA256, payload 只含 oid+cid+stage+exp (不含 role, §16.2)
- validate-token Lambda (§16.6): 验证签名 → 检查过期 → 检查已使用 → 从 DB 读 role → 返回 prefill
- FEEDBACK_TOKEN_USED 实体
- FeedbackPage.tsx 增加 token 解析 + 信息预填逻辑 (§16.4)
- EventBridge daily scan → send-feedback-invite Lambda → SES 模板邮件 (§19)
- 退订机制: unsubscribe Lambda + 前端确认页 (§18)
- List-Unsubscribe header (§18.5)
```

---

## Phase 4-6: 后续阶段

Phase 4-6 等前三个 Phase 跑通后再逐步推进，按文档 §13 的路线图执行。

---

## 实用技巧

### Claude Code 会话管理

Claude Code 有上下文长度限制。建议：

- 每个 Step 开一个新会话（或在上下文快满时开新会话）
- 新会话开头先让它读架构文档的相关章节
- 完成一个 Step 后，commit 代码再进入下一个 Step

### 让 Claude Code 写测试

每个 Lambda 完成后，追加一句：

```
为这个 Lambda 写单元测试，覆盖正常路径和边界情况：
- 正常提交
- 缺少必填字段
- 无效数据格式
- 状态机非法转换
- 并发冲突 (ConditionExpression 失败)
```

### 遇到问题时

如果 Claude Code 的实现和架构文档有冲突，优先以架构文档为准。可以这样说：

```
这里和架构文档 §12.5 的设计不一致。
文档要求 [xxx]，但你实现的是 [yyy]。
请按文档修改。
```

### 部署验证

每个 Step 部署后，建议手动测试一遍核心流程，确认再进入下一步。
不要攒到最后一起部署——Serverless 架构的 debug 比本地应用复杂得多。
