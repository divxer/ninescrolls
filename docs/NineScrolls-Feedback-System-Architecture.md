# NineScrolls 用户反馈系统 — 架构设计

## Architecture Design: Customer Feedback System

**Version:** 2.0 (Architecture Review: complexity reduction, RFQ decoupled, QUOTE_SENT state, virus scan, phase replan)
**Date:** March 10, 2026
**Platform:** AWS Amplify + DynamoDB（与现有 Market Intelligence System 共用基础设施）

---

## 1. 系统目标

NineScrolls 销售高价值科研设备（ICP、PECVD、Sputter、ALD、RIE、IBE），客户主要是大学、国家实验室和研发企业。每一位客户的反馈都极具价值。

本系统解决三个核心问题：

1. **采购流程优化** — 客户在从询价到交付的整个 B2B 采购流程中，对技术咨询、报价响应、PO 处理、物流交付等环节有什么感受？
2. **产品与服务改进** — 设备使用一段时间后，性能、售后、培训等环节有哪些可以改进？
3. **客户关系深化** — 通过反馈互动建立长期信任，收集可展示的客户证言

> **业务流程说明：** NineScrolls 的客户采购流程不是电商模式的在线下单，而是典型的 B2B 科研设备采购流程：
>
> `技术咨询 → Request Quote → 报价单 (Quotation) → 采购单 (Purchase Order) → 生产/配置 → 交付安装`
>
> 反馈系统的设计需要贴合这一流程，评价维度应覆盖每个关键节点。

---

## 2. 系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  FeedbackPage.tsx                                           │
│  ├── Procurement Experience Form (采购流程反馈)               │
│  └── Product & Service Review Form (产品与服务评价)           │
└─────────────────────┬───────────────────────────────────────┘
                      │ POST /api/feedback
                      │
            ┌─────────▼──────────┐
            │  AWS API Gateway   │
            │  (REST Endpoint)   │
            │  /api/feedback     │
            └─────────┬──────────┘
                      │
            ┌─────────▼──────────┐
            │   AWS Lambda       │
            │  submit-feedback   │
            │  · Validate input  │
            │  · Sanitize data   │
            │  · Store to DB     │
            │  · Trigger notify  │
            └─────────┬──────────┘
                      │
        ┌─────────────┼────────────────────┐
        │             │                    │
┌───────▼────────┐    │          ┌─────────▼──────────┐
│   DynamoDB     │    │          │  Notification      │
│  FEEDBACK item │    │          │  ├── SES (Email)   │
│  in existing   │    │          │  ├── SNS (Slack)   │
│  single-table  │    │          │  └── AppSync Sub   │
└───────┬────────┘    │          └────────────────────┘
        │             │
        │      ┌──────▼──────┐
        │      │  AppSync    │
        │      │  GraphQL    │
        │      │  Queries    │
        │      └──────┬──────┘
        │             │
        └─────────────┼──────────────┐
                      │              │
             ┌────────▼────────┐  ┌──▼──────────────┐
             │  ADMIN DASHBOARD │  │  INTEGRATIONS   │
             │  Feedback Panel  │  │  ├── HubSpot    │
             │  ├── View all    │  │  │   (CRM Note) │
             │  ├── Filter      │  │  ├── Lead Score │
             │  ├── Reply       │  │  │   Boost      │
             │  └── Export      │  │  └── Testimonial│
             └─────────────────┘  │      Publishing  │
                                  └─────────────────┘
```

### 与现有系统的关系

反馈系统不是独立系统，而是 **Market Intelligence System 的扩展模块**，复用现有的 DynamoDB 单表、API Gateway、AppSync、通知管道和管理后台。这样做的好处是：

- 零额外基础设施成本
- 反馈数据可与访客行为数据交叉分析（比如：高分反馈的客户之前浏览了哪些产品）
- 反馈行为本身也是一个 Lead Scoring 正向信号

---

## 3. 数据模型设计

### 3.1 DynamoDB 实体：FEEDBACK

沿用现有的 single-table design（表名 `NineScrolls-Intelligence`），新增 FEEDBACK 实体类型。

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `FEEDBACK#<feedbackId>` |
| SK | String | `META` |
| GSI1PK | String | `FEEDBACK_TYPE#<procurement\|product>` |
| GSI1SK | String | `<timestamp>#<feedbackId>` |
| GSI2PK | String | `ORG#<orgId>` (if matched) |
| GSI2SK | String | `FEEDBACK#<timestamp>` |
| feedbackId | String | UUID, e.g. `fb-20260310-a1b2c3` |
| feedbackType | String | `procurement` \| `product` |
| status | String | `new` \| `reviewed` \| `replied` \| `archived` |
| submittedAt | String | ISO 8601 timestamp |
| customerName | String | Submitter's name |
| customerEmail | String | Submitter's email |
| quoteNumber | String | (Optional) Quote or PO number |
| procurementStage | String | (Optional) `quote` \| `po-issued` \| `delivered` \| `installed` |
| productModel | String | (Optional) Equipment model |
| deliveryDate | String | (Optional) Delivery/installation date |
| usageDuration | String | (Optional) e.g. `3-6-months` |
| ratings | Map | Key-value pairs of rating dimensions |
| textResponses | Map | Key-value pairs of open-ended responses |
| recommend | String | (Procurement only) `definitely` \| `probably` \| ... |
| testimonial | String | (Product only) Optional testimonial text |
| allowPublish | Boolean | Consent for testimonial display |
| overallScore | Number | Computed average of all ratings (1-5) |
| ipHash | String | Hashed visitor IP for cross-reference |
| matchedOrgId | String | (Auto) Matched ORG entity if IP aligns |
| GSI3PK | String | `ORDER#<orderId>` (if linked to order) |
| GSI3SK | String | `FEEDBACK#<timestamp>` |
| linkedOrderId | String | 直接关联的 ORDER ID（通过 token 或手动关联） |
| TTL | Number | No expiry for feedback (set to 0) |

### 3.2 ratings Map 结构

**Procurement Feedback (采购流程反馈):**
```json
{
  "technicalConsultation": 5,
  "quotationProcess": 4,
  "responseTimeliness": 5,
  "deliveryCoordination": 3,
  "overallSatisfaction": 4
}
```

**Product Feedback:**
```json
{
  "equipmentPerformance": 5,
  "installationExperience": 4,
  "techSupportQuality": 4,
  "trainingEffectiveness": 3,
  "overallSatisfaction": 4
}
```

### 3.3 GSI 查询模式

| 查询场景 | 使用的索引 | 条件 |
|---------|-----------|------|
| 按类型列出所有反馈 | GSI1 | GSI1PK = `FEEDBACK_TYPE#procurement` |
| 按时间倒序排列 | GSI1 | GSI1SK desc |
| 查看某客户/机构的所有反馈 | GSI2 | GSI2PK = `ORG#<orgId>` |
| 按评分筛选 | Filter | overallScore >= N |
| 按状态筛选 | Filter | status = `new` |
| 查看某订单的所有反馈 | GSI3 | GSI3PK = `ORDER#<orderId>` |

---

## 4. API 设计

### 4.1 REST API — 反馈提交（面向前端公开）

```
POST /api/feedback
Content-Type: application/json

{
  "feedbackType": "procurement" | "product",
  "name": "Dr. Jane Smith",
  "email": "jane.smith@stanford.edu",
  "institution": "Stanford University",       // optional
  "quoteNumber": "NS-Q-2026-001",            // optional
  "procurementStage": "delivered",            // procurement type only
  "productModel": "TL-ICP-300",              // product type only
  "deliveryDate": "2025-12-15",              // optional
  "usageDuration": "3-6-months",             // product type only
  "ratings": {
    "technicalConsultation": 5,
    "quotationProcess": 4,
    ...
  },
  "textResponses": {
    "comments": "Great experience...",
    "improvements": "Would like faster...",
    ...
  },
  "recommend": "definitely",                 // procurement type only
  "testimonial": "NineScrolls provided...",   // product type only
  "allowPublish": true                        // product type only
}
```

**Response (200):**
```json
{
  "success": true,
  "feedbackId": "fb-20260310-a1b2c3",
  "message": "Thank you for your feedback."
}
```

**Validation Rules:**
- name: required, 2-100 characters
- email: required, valid email format
- ratings: all required dimensions must be 1-5
- textResponses: each field max 2000 characters
- testimonial: max 500 characters
- Rate limiting: max 3 submissions per IP per hour

### 4.2 GraphQL API — 管理后台查询

```graphql
type Feedback {
  feedbackId: ID!
  feedbackType: FeedbackType!
  status: FeedbackStatus!
  submittedAt: AWSDateTime!
  customerName: String!
  customerEmail: String!
  orderNumber: String
  productModel: String
  usageDuration: String
  ratings: AWSJSON!
  textResponses: AWSJSON!
  overallScore: Float!
  recommend: String
  testimonial: String
  allowPublish: Boolean
  matchedOrgId: String
  matchedOrgName: String
  linkedOrderId: String
}

enum FeedbackType { PROCUREMENT PRODUCT }
enum FeedbackStatus { NEW REVIEWED REPLIED ARCHIVED }

type Query {
  listFeedback(
    feedbackType: FeedbackType
    status: FeedbackStatus
    limit: Int
    nextToken: String
  ): FeedbackConnection!

  getFeedback(feedbackId: ID!): Feedback

  feedbackStats(
    dateFrom: AWSDate!
    dateTo: AWSDate!
  ): FeedbackStats!
}

type FeedbackStats {
  totalCount: Int!
  averageOverallScore: Float!
  procurementCount: Int!
  productCount: Int!
  npsScore: Float!
  ratingBreakdown: AWSJSON!
  topImprovementThemes: [String!]!
}

type Mutation {
  updateFeedbackStatus(
    feedbackId: ID!
    status: FeedbackStatus!
    internalNote: String
  ): Feedback!

  replyToFeedback(
    feedbackId: ID!
    replyMessage: String!
  ): Feedback!

  publishTestimonial(
    feedbackId: ID!
    displayName: String!
    displayTitle: String
  ): Feedback!
}

type Subscription {
  onNewFeedback: Feedback
    @aws_subscribe(mutations: ["createFeedback"])
}
```

---

## 5. Lambda 函数设计

### 5.1 submit-feedback Lambda

```
触发方式: API Gateway POST /api/feedback
运行时: Node.js 20.x
超时: 10 seconds
内存: 256 MB

处理流程:
1. 验证请求体 (schema validation via Joi/Zod)
2. 清洗输入 (XSS sanitization, trim whitespace)
3. 生成 feedbackId (prefix + date + nanoid)
4. 计算 overallScore (ratings 平均值)
5. IP 哈希 + 尝试匹配现有 ORG 实体
6. 写入 DynamoDB (FEEDBACK item)
7. 更新 Lead Score: 提交反馈 = +12 分
8. 发送通知:
   - SES: 给客户发确认邮件
   - SNS → Slack: 通知销售团队 (含评分摘要)
   - 如果 overallScore < 3: 标记为 urgent
9. 返回 success response
```

### 5.2 feedback-digest Lambda（新增定时任务）

```
触发方式: EventBridge, weekly (Monday 9:00 AM PT)
功能: 生成周度反馈摘要报告

处理流程:
1. 查询过去 7 天所有 FEEDBACK items
2. 计算汇总统计:
   - 总数、各维度平均分、NPS
   - 低分项 (< 3) 自动归类为改进重点
3. 生成摘要 Markdown
4. 发送到 Slack #product-feedback 频道
5. 发送邮件给产品团队
```

---

## 6. 前端组件架构

### 6.1 公开页面: FeedbackPage

```
FeedbackPage.tsx
├── Hero Section (banner)
├── FeedbackTypeSelector
│   ├── ProcurementCard (clickable)
│   └── ProductCard (clickable)
├── ProcurementExperienceForm (conditional)
│   ├── ContactInfoFields (name, email, institution)
│   ├── ProcurementInfoFields (quote/PO number, stage, product model)
│   ├── StarRatingGroup × 5
│   │   ├── Technical Consultation (售前技术咨询)
│   │   ├── Quotation Process (报价流程)
│   │   ├── Response Timeliness (响应速度)
│   │   ├── Delivery Coordination (交付协调)
│   │   └── Overall Satisfaction (总体满意度)
│   ├── OpenEndedFields × 2
│   ├── RecommendSelect
│   └── SubmitButton
├── ProductServiceForm (conditional)
│   ├── ContactInfoFields
│   ├── EquipmentInfoFields
│   ├── StarRatingGroup × 5
│   ├── DetailedFeedbackFields × 4
│   ├── TestimonialSection
│   │   ├── TextArea
│   │   └── ConsentCheckbox
│   └── SubmitButton
├── SuccessScreen (post-submission)
└── PrivacyNote
```

**状态管理:** 使用 React useState，无需引入状态管理库（表单数据不跨页面）。

**表单提交流程:**
```
User clicks Submit
  → Client-side validation (required fields + rating completeness)
  → Show loading spinner
  → POST /api/feedback
  → On success: show SuccessScreen
  → On error: show error toast, keep form data
```

### 6.2 管理后台: Feedback Dashboard Panel

在现有 Admin Dashboard 中新增一个 Tab/模块：

```
FeedbackDashboard
├── StatsBar
│   ├── TotalFeedback (count)
│   ├── AverageScore (gauge)
│   ├── NPS Score (number)
│   └── PendingReview (count + badge)
├── FeedbackTable
│   ├── Filters: type, status, date range, score range
│   ├── Columns: Date, Customer, Type, Product, Score, Status, Actions
│   ├── Row click → Detail drawer
│   └── Bulk export CSV
├── FeedbackDetail (drawer/modal)
│   ├── Customer info
│   ├── All ratings (visual bars)
│   ├── Text responses (full)
│   ├── Linked ORG profile (if matched)
│   ├── Status update controls
│   ├── Internal notes
│   └── Reply action (triggers SES email)
└── TestimonialManager
    ├── List of approved testimonials
    ├── Preview card
    ├── Publish/Unpublish toggle
    └── Edit display name/title
```

---

## 7. 与 Market Intelligence System 的集成

### 7.1 Lead Score 加分

反馈提交是一个强信号，应纳入 Lead Scoring Engine：

| Signal | Points | Rationale |
|--------|--------|-----------|
| Submitted procurement feedback | +12 | Active engagement post-delivery |
| Submitted product feedback | +15 | Long-term relationship indicator |
| Gave overall score >= 4 | +5 | Happy customer, referral potential |
| Gave overall score <= 2 | +8 | At-risk customer, needs immediate attention |
| Provided testimonial | +10 | Strong brand advocate |
| Allowed testimonial publication | +5 | Maximum trust signal |

### 7.2 ORG 实体增强

当反馈提交时，Lambda 通过 IP 哈希匹配 ORG 实体，给 ORG 记录新增字段：

```json
{
  "feedbackCount": 2,
  "latestFeedbackDate": "2026-03-10",
  "averageSatisfaction": 4.2,
  "hasTestimonial": true,
  "customerStatus": "active"  // "active" | "at-risk" | "churned"
}
```

### 7.3 Alert Rules（新增）

| Alert | Condition | Channel | Priority |
|-------|-----------|---------|----------|
| Low satisfaction | overallScore <= 2 | Slack + Email | HIGH |
| New testimonial | allowPublish = true | Slack | NORMAL |
| Product issue reported | issuesEncountered is not empty | Slack | NORMAL |
| Weekly digest | Every Monday 9 AM | Email | LOW |

---

## 8. 安全与隐私

### 8.1 数据保护

- **传输加密:** HTTPS (TLS 1.3) via API Gateway
- **存储加密:** DynamoDB encryption at rest (AWS managed keys)
- **Email 地址:** 不在前端日志中记录，Lambda 中仅在 DynamoDB write 后丢弃
- **IP 处理:** 仅存储 SHA-256 哈希，不存储原始 IP
- **访问控制:** 反馈数据通过 Cognito auth 保护，仅管理员可查看

### 8.2 防滥用

- **Rate Limiting:** API Gateway 配置 3 requests/IP/hour
- **CAPTCHA:** 在表单中集成 Cloudflare Turnstile（invisible mode）
- **Input Sanitization:** Lambda 层面做 XSS/SQL 注入过滤
- **Bot Detection:** 隐藏的 honeypot field + submission time check (< 3s = bot)

### 8.3 合规

- 隐私声明明确告知数据用途
- 证言发布需客户明确 opt-in（checkbox）
- 提供数据删除通道（客户可发邮件请求删除反馈）
- 不收集非必要的个人信息

---

## 9. 客户证言展示系统

### 9.1 公开展示组件

在网站首页或 About 页面添加 Testimonial Section：

```
TestimonialCarousel
├── TestimonialCard × N
│   ├── Quote text (truncated to 120 chars)
│   ├── Customer name + institution
│   ├── Product model
│   ├── Star rating display
│   └── Read more link
├── Navigation dots
└── Auto-rotate (8s interval)
```

**数据来源:** AppSync query，仅返回 `allowPublish = true` 且管理员已审核通过的证言。

### 9.2 结构化数据（SEO）

每条展示的证言自动生成 JSON-LD：

```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "author": {
    "@type": "Person",
    "name": "Dr. Jane Smith"
  },
  "itemReviewed": {
    "@type": "Product",
    "name": "TL-ICP-300",
    "brand": "Nine Scrolls Technology"
  },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": 5,
    "bestRating": 5
  },
  "reviewBody": "..."
}
```

---

## 10. 分阶段反馈邀请机制

科研设备的使用反馈不能一次性收集，需要分阶段主动邀请：

### 10.1 邮件触发时间线

```
设备交付安装完成 (Delivery & Installation Complete)
  │
  ├── T+3 days:  "Thank you" 邮件 + 采购流程反馈链接
  │              (评价：技术咨询、报价、PO 处理、交付安装体验)
  │
  ├── T+30 days: "First Month Check-in" + 初始使用反馈链接
  │              (评价：设备初始性能、培训效果、操作便利性)
  │
  ├── T+90 days: "Quarterly Review" + 详细产品反馈链接
  │              (评价：长期稳定性、技术支持响应、耗材/配件供应)
  │
  ├── T+180 days: "6-Month Assessment" + 综合评价 + 证言邀请
  │              (评价：设备 ROI、售后服务整体、改进建议)
  │
  └── T+365 days: "Anniversary Review" + 续保/升级提醒
                  (评价：年度综合满意度、AMC 续签意向、新需求)
```

> **触发起点说明：** 采购流程中 T=0 不是 PO 签发时间，而是 **设备交付安装验收完成** 的时间。因为科研设备从 PO 到交付通常需要数周甚至数月的生产和配置周期，在设备到位之前发送反馈邀请没有意义。

### 10.2 实现方式

- 使用 DynamoDB TTL + EventBridge 实现延迟触发
- 每笔订单在 DynamoDB 中创建 `FEEDBACK_SCHEDULE` 实体
- EventBridge 每日扫描到期的 schedule items
- Lambda 发送对应阶段的个性化邮件（SES template）
- 邮件中包含带 token 的反馈链接，自动填充客户信息

```
DynamoDB Item:
PK: SCHEDULE#<quoteNumber>
SK: FEEDBACK_INVITE#<stage>
triggerDate: "2026-04-10"
stage: "30-day"
customerName: "Dr. Jane Smith"
customerEmail: "jane@stanford.edu"
institution: "Stanford University"
productModel: "TL-ICP-300"
quoteNumber: "NS-Q-2026-001"
poNumber: "PO-STF-2026-1234"
installationDate: "2026-03-10"
TTL: <triggerDate epoch + 7 days>
```

---

## 11. 数据分析与报表

### 11.1 仪表盘指标

| 指标 | 计算方式 | 用途 |
|------|---------|------|
| NPS (Net Promoter Score) | (推荐者% - 贬损者%) × 100 | 客户忠诚度总指标 |
| CSAT (Customer Satisfaction) | overallScore 平均值 | 满意度趋势 |
| 各维度平均分 | 按 rating key 聚合 | 识别薄弱环节 |
| 响应率 | 反馈数 / 邀请邮件数 | 评估邀请效果 |
| 改进主题词云 | text responses 关键词提取 | 产品迭代方向 |

### 11.2 交叉分析（与 Market Intelligence 联动）

- 高满意度客户的浏览行为模式 → 优化网站内容
- 低满意度客户的产品线分布 → 定向产品改进
- 反馈与续购/复购的关联 → 预测客户留存
- 地区维度的满意度差异 → 优化区域服务

---

## 12. Order Tracker 模块（轻量订单管理）

### 12.1 模块定位

Order Tracker 不是 ERP 系统，而是一个**轻量的订单生命周期记录工具**，核心目的有四个：

1. **承接网站 RFQ** — 客户在网站提交 RFQ 后独立存储，管理员审核后手动转化为 ORDER 记录
2. 为反馈邀请系统提供 **T=0 触发源**（设备安装完成时自动创建反馈 schedule）
3. 让团队随时掌握所有订单的当前状态，不依赖记忆和邮件翻找
4. 记录每笔订单涉及的**多个联系人及其角色**，为反馈邀请提供精准的收件人列表

> **设计原则：** 够用就好。科研设备订单量不大（预估每月个位数），不需要复杂的审批流、库存管理或财务对接。重点是信息集中、状态清晰、操作简单。

---

### 12.2 业务流程与状态机

```
                                        正常推进 (Happy Path)
                                        ─────────────────────

┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ INQUIRY │──▶│ QUOTING │──▶│ QUOTE   │──▶│ PO      │──▶│ IN      │──▶│ SHIPPED │
│         │   │         │   │ SENT    │   │RECEIVED │   │PRODUCT° │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │                                                               │
     │ 不跟进                                                         ▼
     ▼                                      ┌──────────┐      ┌──────────┐
┌──────────┐                                │ CLOSED   │◀─────│INSTALLED │
│ DECLINED │                                │          │      │          │
│ (终态)    │                                └──────────┘      └──────────┘
└──────────┘                                                     │
                                                                 ▼
                                                          ┌─────────────┐
                                                          │ AUTO-CREATE  │
                                                          │ 5× FEEDBACK  │
                                                          │ SCHEDULE     │
                                                          └─────────────┘
```

**状态定义：**

| 状态 | 含义 | 关键日期字段 | 自动触发 |
|------|------|-------------|---------|
| `INQUIRY` | 收到客户询价（网站 RFQ 自动创建或手动录入） | `inquiryDate` | 通知 Slack; Lead Score +8 |
| `QUOTING` | 正在与客户沟通需求、配置方案、准备报价 | `quoteDate` | — |
| `QUOTE_SENT` | 报价单已发送给客户，等待客户回复 | `quoteSentDate` | — |
| `PO_RECEIVED` | 客户已签发 Purchase Order | `poDate` | — |
| `IN_PRODUCTION` | 设备在制造/配置中 | `productionStartDate` | — |
| `SHIPPED` | 设备已发运 | `shipDate` | — |
| `INSTALLED` | 设备已到场、安装调试验收完成 | `installDate` | 创建 5 条 FEEDBACK_SCHEDULE |
| `CLOSED` | 订单完结（保修期开始计算） | `closeDate` | — |
| `DECLINED` | 询价不跟进（终态，原因记录在 notes） | `declinedDate` | — |

**关键规则：**
- 正常路径：INQUIRY → QUOTING → QUOTE_SENT → PO_RECEIVED → IN_PRODUCTION → SHIPPED → INSTALLED → CLOSED
- INQUIRY 可以直接跳转到 DECLINED（不跟进），DECLINED 是终态，不可变更
- 除 INQUIRY → DECLINED 外，状态只能向前推进，不能回退
- 状态变更时自动记录时间戳和操作人，形成 audit log
- 进入 `INSTALLED` 状态时，系统自动创建 5 条反馈邀请 schedule，T=0 = `installDate`
- 如果一笔订单包含多台设备分批交付，建议拆成多条 Order 记录
- 网站 RFQ 提交自动创建 INQUIRY 状态记录（见 §12.10）

---

### 12.3 DynamoDB 数据模型

#### ORDER 实体（主记录）

沿用现有 single-table design（表名 `NineScrolls-Intelligence`）。

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `ORDER#<orderId>` |
| SK | String | `META` |
| GSI1PK | String | `ORDER_STATUS#<status>` |
| GSI1SK | String | `<quoteDate>#<orderId>` |
| GSI2PK | String | `ORG#<orgId>` (if matched) |
| GSI2SK | String | `ORDER#<quoteDate>` |
| orderId | String | e.g. `ord-20260310-x7k9` |
| quoteNumber | String | NineScrolls 报价单号，e.g. `NS-Q-2026-003` |
| poNumber | String | 客户 PO 号，e.g. `PO-STF-2026-1234` |
| status | String | 当前状态（见状态机） |
| institution | String | 客户机构名称 |
| department | String | 主要对接部门 |
| productModel | String | 设备型号，e.g. `TL-ICP-300` |
| productName | String | 设备名称，e.g. `ICP Etching System` |
| configuration | String | 配置摘要（可选） |
| quoteAmount | Number | 报价金额 USD（可选） |
| notes | String | 内部备注 |
| matchedOrgId | String | 关联的 ORG 实体 ID |
| createdAt | String | ISO 8601 |
| updatedAt | String | ISO 8601 |
| createdBy | String | 操作人 |
| source | String | 来源：`RFQ_WEBSITE` \| `MANUAL` \| `IMPORTED` |
| rfqId | String | 关联的 RFQ 提交 ID（如来自网站） |
| declineReason | String | DECLINED 状态时的不跟进原因（可选） |

**日期字段（随状态推进逐步填充）：**

| Attribute | Type | Description |
|-----------|------|-------------|
| inquiryDate | String | 询价日期（RFQ 提交时间或手动录入） |
| quoteDate | String | 报价日期 |
| quoteSentDate | String | 报价单发送给客户的日期 |
| poDate | String | 收到 PO 的日期 |
| estimatedDelivery | String | 预计交付日期 |
| productionStartDate | String | 开始生产/配置日期 |
| shipDate | String | 发运日期 |
| installDate | String | 安装验收完成日期 |
| closeDate | String | 订单关闭日期 |
| warrantyEndDate | String | 保修截止日期（installDate + 保修期） |
| declinedDate | String | 标记为 DECLINED 的日期 |

#### ORDER_CONTACT 实体（多联系人）

同一笔订单可能涉及客户方的多个部门和联系人，每个联系人作为独立的 item 存储。

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `ORDER#<orderId>` |
| SK | String | `CONTACT#<contactId>` |
| contactId | String | e.g. `ct-a1b2c3` |
| contactName | String | 联系人姓名 |
| contactEmail | String | 邮箱 |
| contactPhone | String | 电话（可选） |
| role | String | 角色（见下方角色定义） |
| department | String | 所在部门 |
| isPrimary | Boolean | 是否为主要联系人 |
| feedbackInvite | Boolean | 是否发送反馈邀请，默认 `true` |
| notes | String | 备注，e.g. "Preferred contact method: email" |

**角色定义：**

| Role | 典型场景 | 反馈侧重点 |
|------|---------|-----------|
| `PI` | Principal Investigator / 实验室负责人 | 技术需求匹配、设备性能 |
| `RESEARCHER` | 日常使用设备的研究人员 | 操作体验、培训效果、日常维护 |
| `PROCUREMENT` | 采购部门负责人 | 报价清晰度、PO 流程、交付准时性 |
| `FACILITIES` | 设施管理 / 实验室管理员 | 安装协调、场地适配、安全合规 |
| `FINANCE` | 财务部门 | 付款流程、发票准确性 |
| `LAB_MANAGER` | 实验室经理 | 综合管理视角、设备 ROI |
| `OTHER` | 其他角色 | 通用反馈 |

> **实际操作说明：** 大多数订单你只会有 1-2 个联系人（通常是 PI 和/或采购）。多联系人的设计是为了未来扩展，不要求每笔订单必须填满所有角色。录入时有一个联系人就够了，后续随时可以补充。

#### ORDER_LOG 实体（状态变更日志）

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `ORDER#<orderId>` |
| SK | String | `LOG#<timestamp>` |
| action | String | e.g. `STATUS_CHANGE`, `CONTACT_ADDED`, `NOTE_UPDATED` |
| fromStatus | String | 变更前状态（status change only） |
| toStatus | String | 变更后状态 |
| operator | String | 操作人 |
| timestamp | String | ISO 8601 |
| detail | String | 补充说明 |

#### GSI 查询模式

| 查询场景 | 索引 | 条件 |
|---------|------|------|
| 按状态列出订单 | GSI1 | GSI1PK = `ORDER_STATUS#QUOTING` |
| 所有活跃订单（非 CLOSED） | GSI1 | GSI1PK != `ORDER_STATUS#CLOSED` (多次查询合并) |
| 某机构的所有订单 | GSI2 | GSI2PK = `ORG#<orgId>` |
| 某订单的所有联系人 | Main | PK = `ORDER#<orderId>`, SK begins_with `CONTACT#` |
| 某订单的状态日志 | Main | PK = `ORDER#<orderId>`, SK begins_with `LOG#` |

---

### 12.4 GraphQL API

```graphql
# ---- Types ----

type Order {
  orderId: ID!
  quoteNumber: String
  poNumber: String
  status: OrderStatus!
  institution: String!
  department: String
  productModel: String!
  productName: String
  configuration: String
  quoteAmount: Float
  notes: String
  matchedOrgId: String
  contacts: [OrderContact!]!
  # Dates
  quoteDate: AWSDate
  poDate: AWSDate
  estimatedDelivery: AWSDate
  productionStartDate: AWSDate
  shipDate: AWSDate
  installDate: AWSDate
  closeDate: AWSDate
  warrantyEndDate: AWSDate
  # Metadata
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  createdBy: String!
  # Computed
  feedbackScheduleCreated: Boolean!
  feedbackCount: Int!
  daysSinceLastUpdate: Int!
  source: String!                  # RFQ_WEBSITE | MANUAL | IMPORTED
  rfqId: String
  declineReason: String
}

type OrderContact {
  contactId: ID!
  contactName: String!
  contactEmail: String!
  contactPhone: String
  role: ContactRole!
  department: String
  isPrimary: Boolean!
  feedbackInvite: Boolean!
  notes: String
}

type OrderLog {
  action: String!
  fromStatus: OrderStatus
  toStatus: OrderStatus
  operator: String!
  timestamp: AWSDateTime!
  detail: String
}

enum OrderStatus {
  INQUIRY
  QUOTING
  QUOTE_SENT
  PO_RECEIVED
  IN_PRODUCTION
  SHIPPED
  INSTALLED
  CLOSED
  DECLINED
}

enum ContactRole {
  PI
  RESEARCHER
  PROCUREMENT
  FACILITIES
  FINANCE
  LAB_MANAGER
  OTHER
}

# ---- Queries ----

type Query {
  listOrders(
    status: OrderStatus
    limit: Int
    nextToken: String
  ): OrderConnection!

  getOrder(orderId: ID!): Order

  getOrderLogs(orderId: ID!): [OrderLog!]!

  orderStats: OrderStats!
}

type OrderStats {
  totalActive: Int!
  byStatus: AWSJSON!          # {"QUOTING": 3, "PO_RECEIVED": 2, ...}
  avgDaysToInstall: Float     # Quote → Install 平均天数
  upcomingDeliveries: Int!    # estimatedDelivery 在未来 30 天内
  overdueOrders: Int!         # 超过 estimatedDelivery 但未 SHIPPED
}

# ---- Mutations ----

type Mutation {
  createOrder(input: CreateOrderInput!): Order!

  updateOrderStatus(
    orderId: ID!
    newStatus: OrderStatus!
    statusDate: AWSDate        # 该状态对应的日期
    note: String               # 可选备注
  ): Order!

  updateOrder(
    orderId: ID!
    input: UpdateOrderInput!
  ): Order!

  addContact(
    orderId: ID!
    input: AddContactInput!
  ): OrderContact!

  updateContact(
    orderId: ID!
    contactId: ID!
    input: UpdateContactInput!
  ): OrderContact!

  removeContact(
    orderId: ID!
    contactId: ID!
  ): Boolean!

  declineInquiry(
    orderId: ID!
    reason: String!               # 不跟进原因
    note: String                  # 可选备注
  ): Order!
}

# ---- Input Types ----

input CreateOrderInput {
  quoteNumber: String
  institution: String!
  department: String
  productModel: String!
  productName: String
  configuration: String
  quoteAmount: Float
  quoteDate: AWSDate
  estimatedDelivery: AWSDate
  notes: String
  # 至少一个联系人
  primaryContact: AddContactInput!
}

input AddContactInput {
  contactName: String!
  contactEmail: String!
  contactPhone: String
  role: ContactRole!
  department: String
  isPrimary: Boolean
  feedbackInvite: Boolean     # 默认 true
  notes: String
}

input UpdateOrderInput {
  quoteNumber: String
  poNumber: String
  institution: String
  department: String
  productModel: String
  productName: String
  configuration: String
  quoteAmount: Float
  estimatedDelivery: AWSDate
  notes: String
}

input UpdateContactInput {
  contactName: String
  contactEmail: String
  contactPhone: String
  role: ContactRole
  department: String
  isPrimary: Boolean
  feedbackInvite: Boolean
  notes: String
}

# ---- Subscriptions ----

type Subscription {
  onOrderStatusChange: Order
    @aws_subscribe(mutations: ["updateOrderStatus"])
}
```

---

### 12.5 Lambda: update-order-status

这是 Order Tracker 最关键的 Lambda，处理状态变更及其副作用。

```
触发方式: AppSync Mutation resolver (updateOrderStatus)
运行时: Node.js 20.x
超时: 15 seconds
内存: 256 MB

处理流程:

1. 验证状态转换合法性
   - 正常路径只允许向前推进: INQUIRY → QUOTING → QUOTE_SENT → PO_RECEIVED → IN_PRODUCTION → SHIPPED → INSTALLED → CLOSED
   - 特殊路径: INQUIRY → DECLINED（需提供 declineReason）
   - 拒绝回退操作，返回错误

2. 更新 ORDER 实体
   - 设置新 status
   - 填写对应日期字段 (e.g. newStatus=SHIPPED → shipDate=statusDate)
   - 更新 GSI1PK 为新的 ORDER_STATUS#<newStatus>
   - 更新 updatedAt

3. 写入 ORDER_LOG
   - 记录 fromStatus, toStatus, operator, timestamp

4. 如果 newStatus === 'INSTALLED':
   a. 读取所有 ORDER_CONTACT (feedbackInvite=true)
   b. 为每个 contact × 每个阶段 创建 FEEDBACK_SCHEDULE 记录:
      - T+3 天: 采购流程反馈（所有角色）
      - T+30 天: 首月使用反馈（PI, RESEARCHER, LAB_MANAGER）
      - T+90 天: 季度回顾（PI, RESEARCHER, LAB_MANAGER）
      - T+180 天: 半年评估 + 证言邀请（PI, LAB_MANAGER）
      - T+365 天: 年度回顾（PI, LAB_MANAGER, PROCUREMENT）
   c. 更新 ORDER.feedbackScheduleCreated = true
   d. 计算 warrantyEndDate = installDate + 保修期（默认 12 个月）

5. 发送通知:
   - Slack: "#orders: [TL-ICP-300] Stanford University → INSTALLED"
   - 如果有 estimatedDelivery 且实际 installDate 超出 → 标记延期

6. 返回更新后的 Order 对象
```

**反馈邀请与联系人角色的匹配逻辑：**

```
┌──────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Role         │ T+3 天  │ T+30 天 │ T+90 天 │ T+180天 │ T+365天 │
│              │ 采购流程 │ 首月    │ 季度    │ 半年    │ 年度    │
├──────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ PI           │   ✓     │   ✓     │   ✓     │   ✓     │   ✓     │
│ RESEARCHER   │   ✓     │   ✓     │   ✓     │         │         │
│ PROCUREMENT  │   ✓     │         │         │         │   ✓     │
│ FACILITIES   │   ✓     │         │         │         │         │
│ FINANCE      │   ✓     │         │         │         │         │
│ LAB_MANAGER  │   ✓     │   ✓     │   ✓     │   ✓     │   ✓     │
│ OTHER        │   ✓     │         │         │         │         │
└──────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

说明:
- T+3 天（采购流程反馈）: 所有参与者都应评价，但邮件内容根据角色微调
- T+30/90 天（使用反馈）: 只邀请实际使用设备的人
- T+180 天（半年评估 + 证言邀请）: 邀请决策层
- T+365 天（年度回顾）: 决策层 + 采购（涉及 AMC 续签）
- 每个联系人的 feedbackInvite=false 时跳过该联系人
```

---

### 12.6 管理后台 UI

#### 12.6.1 Order List 页面

```
OrderListPage
├── StatsBar (顶部统计卡片)
│   ├── Active Orders (总活跃订单数)
│   ├── Quoting (报价中)
│   ├── In Production (生产中)
│   ├── Awaiting Delivery (已发运待到货)
│   └── Overdue (超过预计交付日期)
│
├── Toolbar
│   ├── [+ New Order] button
│   ├── Status filter dropdown
│   ├── Search (by institution, quote#, PO#, product)
│   └── Sort: by date, status, institution
│
├── OrderTable
│   ├── Columns:
│   │   ├── Status (color-coded badge)
│   │   ├── Quote # / PO #
│   │   ├── Institution
│   │   ├── Equipment
│   │   ├── Primary Contact
│   │   ├── Est. Delivery
│   │   ├── Days in Status (自动计算)
│   │   └── Actions (→ detail)
│   │
│   ├── Row color hints:
│   │   ├── 🔴 Red: overdue (past estimatedDelivery, not yet SHIPPED)
│   │   ├── 🟡 Yellow: approaching delivery (within 7 days)
│   │   └── 🟢 Green: on track
│   │
│   └── Click row → OrderDetail
│
└── Pagination
```

#### 12.6.2 Order Detail 页面（抽屉或独立页面）

```
OrderDetail
├── Header
│   ├── Status badge (large, color-coded)
│   ├── Institution name
│   ├── Equipment model + name
│   └── [Advance Status] button (primary action)
│
├── InfoPanel (两栏布局)
│   ├── Left: Order Info
│   │   ├── Quote #: NS-Q-2026-003
│   │   ├── PO #: PO-STF-2026-1234
│   │   ├── Product: TL-ICP-300 (ICP Etching System)
│   │   ├── Configuration: 8" chamber, load-lock, RF + ICP source
│   │   ├── Quote Amount: $185,000
│   │   └── Notes: (editable)
│   │
│   └── Right: Timeline
│       ├── Quote Date: 2026-01-15
│       ├── PO Received: 2026-02-01
│       ├── Production Start: 2026-02-10
│       ├── Estimated Delivery: 2026-04-15
│       ├── Shipped: — (pending)
│       ├── Installed: — (pending)
│       └── Warranty Until: — (auto-calculated)
│
├── ContactsPanel
│   ├── Contact cards (one per contact)
│   │   ├── Name + Role badge (e.g. "Dr. Jane Smith · PI")
│   │   ├── Email + Phone
│   │   ├── Department
│   │   ├── Feedback invite toggle (on/off)
│   │   └── [Edit] [Remove] actions
│   │
│   └── [+ Add Contact] button
│
├── DocumentsPanel (见 12.9.6 详细设计)
│   ├── Stage tabs (按阶段分类)
│   ├── Document list (预览/下载/版本管理)
│   └── [Upload Document] button
│
├── FeedbackPanel (只在 INSTALLED 后显示)
│   ├── Schedule timeline (5 个节点，已发送的标绿，待发送的标灰)
│   │   ├── T+3d: Procurement feedback — ✅ Sent (2 responses)
│   │   ├── T+30d: First month check-in — 📅 Scheduled Mar 25
│   │   ├── T+90d: Quarterly review — 📅 Scheduled May 24
│   │   ├── T+180d: 6-month assessment — 📅 Scheduled Aug 22
│   │   └── T+365d: Anniversary review — 📅 Scheduled Feb 22, 2027
│   │
│   └── Linked feedback responses (if any)
│
├── ActivityLog (可折叠)
│   ├── 2026-02-01 10:30 — Harvey: Status → PO_RECEIVED
│   ├── 2026-02-01 10:31 — Harvey: Added contact "Lisa Wang (Procurement)"
│   ├── 2026-02-10 09:15 — Harvey: Status → IN_PRODUCTION
│   └── ...
│
└── LinkedIntelligence (与 Market Intelligence 联动)
    ├── Matched ORG profile link
    ├── Lead score at time of quote
    └── Pages visited before quote request
```

#### 12.6.3 New Order 创建表单

```
CreateOrderForm
├── Section 1: Equipment
│   ├── Product Model * (dropdown: ICP, PECVD, Sputter, ALD, RIE, IBE, HDP-CVD, Other)
│   ├── Product Name (auto-fill based on model, editable)
│   ├── Configuration (textarea, optional)
│   └── Quote Amount (number, optional)
│
├── Section 2: Customer
│   ├── Institution * (text, with autocomplete from existing ORG entities)
│   ├── Department (text, optional)
│   └── Match to existing organization? (auto-suggest if institution name matches ORG)
│
├── Section 3: Primary Contact *
│   ├── Name *
│   ├── Email *
│   ├── Phone (optional)
│   ├── Role * (dropdown: PI, Researcher, Procurement, Facilities, Finance, Lab Manager, Other)
│   └── Department (optional)
│
├── Section 4: Dates
│   ├── Quote Date (default: today)
│   └── Estimated Delivery (optional)
│
├── Section 5: Reference
│   ├── Quote Number (text, e.g. NS-Q-2026-003)
│   └── Internal Notes (textarea)
│
└── [Create Order] button
```

---

### 12.7 通知与提醒

| 事件 | 通知渠道 | 内容 |
|------|---------|------|
| 网站 RFQ 提交 | Slack + Email | "📩 New RFQ: [ICP] from Stanford University (Dr. Smith, PI)" |
| 订单创建（手动） | Slack | "New order: TL-ICP-300 for Stanford University" |
| 状态变更 | Slack | "[NS-Q-2026-003] Stanford: QUOTING → PO_RECEIVED" |
| 即将到达预计交付日 | Slack + Email | "Order NS-Q-2026-003 estimated delivery in 7 days" |
| 超过预计交付日 | Slack + Email | "⚠️ Order NS-Q-2026-003 is 5 days past estimated delivery" |
| 订单进入 INSTALLED | Slack | "✅ TL-ICP-300 installed at Stanford — feedback schedule created" |
| 订单在某状态停留过久 | Slack | "Order NS-Q-2026-003 has been IN_PRODUCTION for 60 days" |

**停留时间告警阈值：**

| 状态 | 预期停留时间 | 告警阈值 |
|------|------------|---------|
| INQUIRY | 1-3 days | > 5 days (需尽快响应 RFQ) |
| QUOTING | 1-2 weeks | > 14 days |
| QUOTE_SENT | 1-4 weeks | > 30 days (客户未回复) |
| PO_RECEIVED | 1-2 weeks | > 21 days |
| IN_PRODUCTION | 4-12 weeks | > 90 days |
| SHIPPED | 1-4 weeks | > 30 days |
| INSTALLED | N/A（终态前一步） | — |

---

### 12.8 与现有系统的集成

**与 Market Intelligence System：**
- 创建订单时自动尝试匹配 ORG 实体（通过 institution 名称或联系人 email domain）
- 匹配成功后，ORG 实体增加字段：`hasActiveOrder: true`, `orderCount: N`, `latestOrderDate`
- 在 Organization Intelligence Table 中显示订单状态列
- Lead Score 加分：有活跃订单的 ORG +20 分

**与反馈系统：**
- INSTALLED 状态触发 FEEDBACK_SCHEDULE 创建（见 12.5）
- 反馈邀请邮件中包含订单信息（设备型号、Quote #）用于上下文
- 反馈提交后自动关联回 ORDER 实体（通过 quoteNumber 或 email 匹配）
- Order Detail 页面直接显示关联的反馈响应

**与 HubSpot CRM（未来）：**
- 订单状态变更同步到 HubSpot Deal Pipeline
- HubSpot Deal 状态变更反向同步到 Order Tracker
- 联系人信息双向同步

---

### 12.9 订单文档管理

#### 12.9.1 模块定位

科研设备的采购过程会产生大量文档：报价单、技术规格书、PO、装箱单、安装报告、验收签字单、保修证书等。这些文档目前大概率散落在邮件附件、本地文件夹、甚至即时通讯的聊天记录里。时间一长，要找到某笔订单的某份文档就变得很费劲。

文档管理模块的定位是：**把每笔订单的所有相关文档集中存储、按阶段分类、随时可查。** 不做文档编辑或版本协作（那是 Google Docs / SharePoint 的事），只做存储、归类和检索。

> **设计原则：** 与 Order Tracker 深度绑定，文档始终依附于某笔订单。不做独立的文档库，避免维护两套组织逻辑。

---

#### 12.9.2 文档分类体系

每份文档归属于一个订单的某个采购阶段，形成自然的时间线归档结构：

```
ORDER: NS-Q-2026-003 (Stanford University · TL-ICP-300)
│
├── QUOTING 报价阶段
│   ├── 📄 NS-Q-2026-003_Quotation_v1.pdf
│   ├── 📄 NS-Q-2026-003_Quotation_v2_revised.pdf
│   ├── 📄 TL-ICP-300_Technical_Spec.pdf
│   └── 📄 Stanford_Requirements_Summary.docx
│
├── PO_RECEIVED 采购单阶段
│   ├── 📄 PO-STF-2026-1234.pdf
│   ├── 📄 Stanford_Vendor_Registration_Form.pdf
│   └── 📄 Payment_Terms_Agreement.pdf
│
├── IN_PRODUCTION 生产阶段
│   ├── 📄 Chamber_Configuration_Drawing.pdf
│   ├── 📄 Production_Progress_Photo_Week4.jpg
│   └── 📄 Factory_Acceptance_Test_Report.pdf
│
├── SHIPPED 发运阶段
│   ├── 📄 Packing_List.pdf
│   ├── 📄 Bill_of_Lading.pdf
│   ├── 📄 Shipping_Insurance_Certificate.pdf
│   └── 📄 Customs_Declaration.pdf
│
├── INSTALLED 安装阶段
│   ├── 📄 Installation_Checklist.pdf
│   ├── 📄 Site_Acceptance_Test_Report.pdf
│   ├── 📄 Customer_Signoff.pdf
│   └── 📄 Training_Completion_Record.pdf
│
└── WARRANTY 保修/售后
    ├── 📄 Warranty_Certificate.pdf
    ├── 📄 AMC_Proposal_Year1.pdf
    └── 📄 Maintenance_Log.xlsx
```

**文档类型定义：**

| 类型 (docType) | 说明 | 典型阶段 | 常见格式 |
|---------------|------|---------|---------|
| `QUOTATION` | 报价单 | QUOTING | PDF |
| `TECHNICAL_SPEC` | 技术规格书 / Datasheet | QUOTING | PDF |
| `REQUIREMENTS` | 客户需求文档 | QUOTING | PDF, DOCX |
| `PURCHASE_ORDER` | 客户采购单 | PO_RECEIVED | PDF |
| `CONTRACT` | 合同 / 协议 | PO_RECEIVED | PDF |
| `VENDOR_FORM` | 供应商注册表 | PO_RECEIVED | PDF |
| `DRAWING` | 工程图纸 / 配置图 | IN_PRODUCTION | PDF, DWG |
| `TEST_REPORT` | 测试报告（FAT/SAT） | IN_PRODUCTION, INSTALLED | PDF |
| `PROGRESS_PHOTO` | 生产进度照片 | IN_PRODUCTION | JPG, PNG |
| `SHIPPING_DOC` | 运输文件（装箱单、提单等） | SHIPPED | PDF |
| `INSTALLATION_DOC` | 安装文件（checklist、签字单） | INSTALLED | PDF |
| `TRAINING_RECORD` | 培训记录 | INSTALLED | PDF |
| `WARRANTY` | 保修证书 | INSTALLED | PDF |
| `MAINTENANCE` | 维护记录 / AMC 文件 | WARRANTY | PDF, XLSX |
| `CORRESPONDENCE` | 重要往来邮件或沟通记录 | 任意 | PDF, EML |
| `OTHER` | 其他 | 任意 | 任意 |

---

#### 12.9.3 S3 存储架构

```
s3://ninescrolls-order-documents/
│
├── orders/
│   ├── ord-20260310-x7k9/                    # orderId
│   │   ├── QUOTING/
│   │   │   ├── doc-a1b2c3_Quotation_v1.pdf
│   │   │   └── doc-d4e5f6_Technical_Spec.pdf
│   │   ├── PO_RECEIVED/
│   │   │   └── doc-g7h8i9_PO-STF-2026-1234.pdf
│   │   ├── IN_PRODUCTION/
│   │   ├── SHIPPED/
│   │   ├── INSTALLED/
│   │   └── WARRANTY/
│   │
│   └── ord-20260415-m2n3/
│       └── ...
│
└── temp/                                      # 上传暂存区（Lambda 处理后移入正式目录）
```

**S3 配置：**
- **Bucket policy:** 私有，仅通过 presigned URL 访问
- **Encryption:** SSE-S3（服务端加密）
- **Lifecycle rules:** temp/ 目录 24 小时后自动删除未处理文件
- **Versioning:** 启用，防止误覆盖（同一文件可上传多个版本）
- **Storage class:** S3 Standard（文档体积小、访问频率中等）
- **CORS:** 允许管理后台域名直传

---

#### 12.9.4 DynamoDB 数据模型：ORDER_DOCUMENT

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `ORDER#<orderId>` |
| SK | String | `DOC#<stage>#<docId>` |
| docId | String | e.g. `doc-a1b2c3` |
| fileName | String | 原始文件名，e.g. `NS-Q-2026-003_Quotation_v2.pdf` |
| fileSize | Number | 文件大小（bytes） |
| mimeType | String | e.g. `application/pdf`, `image/jpeg` |
| stage | String | 所属采购阶段 |
| docType | String | 文档类型（见上表） |
| description | String | 文档说明（可选） |
| s3Key | String | S3 对象路径 |
| s3VersionId | String | S3 版本号（用于版本管理） |
| uploadedBy | String | 上传操作人 |
| uploadedAt | String | ISO 8601 |
| tags | List | 自定义标签，e.g. `["final", "signed"]` |
| isLatestVersion | Boolean | 是否为同名文件的最新版本 |
| previousVersionDocId | String | 前一版本的 docId（如有） |
| extractedData | Map | AI 提取的结构化数据（未来功能） |

**GSI 查询模式：**

| 查询场景 | 索引 | 条件 |
|---------|------|------|
| 某订单的所有文档 | Main | PK = `ORDER#<orderId>`, SK begins_with `DOC#` |
| 某订单某阶段的文档 | Main | PK = `ORDER#<orderId>`, SK begins_with `DOC#QUOTING#` |
| 按文档类型查找 | Filter | docType = `QUOTATION` |

---

#### 12.9.5 GraphQL API

```graphql
type OrderDocument {
  docId: ID!
  fileName: String!
  fileSize: Int!
  mimeType: String!
  stage: OrderStatus!
  docType: DocumentType!
  description: String
  uploadedBy: String!
  uploadedAt: AWSDateTime!
  tags: [String!]
  isLatestVersion: Boolean!
  downloadUrl: String              # Presigned URL, 15 min expiry
  previewUrl: String               # Presigned URL for inline preview (PDF/images)
}

enum DocumentType {
  QUOTATION
  TECHNICAL_SPEC
  REQUIREMENTS
  PURCHASE_ORDER
  CONTRACT
  VENDOR_FORM
  DRAWING
  TEST_REPORT
  PROGRESS_PHOTO
  SHIPPING_DOC
  INSTALLATION_DOC
  TRAINING_RECORD
  WARRANTY
  MAINTENANCE
  CORRESPONDENCE
  OTHER
}

type Query {
  listOrderDocuments(
    orderId: ID!
    stage: OrderStatus             # 可选：只看某个阶段的文档
    docType: DocumentType          # 可选：只看某种类型
  ): [OrderDocument!]!

  getDocumentUploadUrl(
    orderId: ID!
    fileName: String!
    mimeType: String!
  ): PresignedUploadUrl!

  searchDocuments(
    query: String!                 # 搜索文件名、描述、标签
    orderId: ID                    # 可选：限定某订单
  ): [OrderDocument!]!
}

type PresignedUploadUrl {
  uploadUrl: String!               # S3 presigned PUT URL
  s3Key: String!                   # 用于后续确认上传
  expiresAt: AWSDateTime!
}

type Mutation {
  confirmDocumentUpload(
    orderId: ID!
    s3Key: String!
    fileName: String!
    mimeType: String!
    fileSize: Int!
    stage: OrderStatus!
    docType: DocumentType!
    description: String
    tags: [String!]
  ): OrderDocument!

  updateDocument(
    orderId: ID!
    docId: ID!
    description: String
    docType: DocumentType
    tags: [String!]
  ): OrderDocument!

  deleteDocument(
    orderId: ID!
    docId: ID!
  ): Boolean!

  uploadNewVersion(
    orderId: ID!
    existingDocId: ID!             # 原文档 ID
    s3Key: String!
    fileName: String!
    fileSize: Int!
  ): OrderDocument!
}
```

**上传流程（Browser → S3 直传）：**

```
1. 管理后台调用 getDocumentUploadUrl(orderId, fileName, mimeType)
   → Lambda 生成 S3 presigned PUT URL（temp/ 目录，15 min 有效期）

2. 前端用 presigned URL 直传文件到 S3
   → 不经过 Lambda/API Gateway，避免 10MB payload 限制

3. 上传完成后，前端调用 confirmDocumentUpload(...)
   → Lambda 将文件从 temp/ 移到 orders/<orderId>/<stage>/
   → 创建 ORDER_DOCUMENT DynamoDB 记录
   → 写入 ORDER_LOG（action: DOCUMENT_UPLOADED）
   → 返回完整的 OrderDocument 对象
```

---

#### 12.9.6 管理后台 UI：文档面板

文档面板嵌入 Order Detail 页面，位于 ContactsPanel 和 FeedbackPanel 之间。

```
DocumentsPanel
├── Header
│   ├── "Documents" 标题 + 文档总数 badge
│   └── [Upload Document] button
│
├── Stage Tabs (按采购阶段分 tab，只显示有文档的阶段)
│   ├── Quoting (3)
│   ├── PO Received (2)
│   ├── In Production (1)
│   └── ...
│
├── Document List (当前 tab 下的文档)
│   ├── DocumentRow × N
│   │   ├── 📄 File icon (根据 mimeType: PDF 红色, DOCX 蓝色, Image 绿色...)
│   │   ├── File name + description (单行，超长截断)
│   │   ├── Type badge (e.g. "Quotation", "Technical Spec")
│   │   ├── Tags (small pills, e.g. "final", "signed")
│   │   ├── File size + upload date + uploader
│   │   ├── [Preview] button (PDF/image 内嵌预览)
│   │   ├── [Download] button
│   │   ├── [Upload New Version] button (如有历史版本显示版本数)
│   │   └── [...] menu → Edit details, Delete
│   │
│   └── Empty state: "No documents in this stage. Upload the first one."
│
├── Upload Dialog (modal)
│   ├── Drag & drop zone + file picker
│   ├── File name (auto-filled, editable)
│   ├── Stage (auto-select current order status, changeable)
│   ├── Document type (dropdown)
│   ├── Description (optional textarea)
│   ├── Tags (tag input, comma separated)
│   ├── Upload progress bar
│   └── [Upload] / [Cancel] buttons
│
└── Preview Modal
    ├── PDF: inline iframe viewer
    ├── Images: zoomable image viewer
    └── Other: download prompt
```

**批量上传：** 支持一次拖入多个文件，每个文件独立配置 stage 和 docType，然后一键提交。常用于从邮件中一次性整理多份附件。

**Quick Upload（快捷上传）：** 在 Order Detail 的 Timeline 视图中，每个已完成的状态节点旁边有一个小的 📎 按钮，点击后直接弹出上传对话框，stage 自动设为该节点对应的阶段。减少操作步骤。

---

#### 12.9.7 文件安全：病毒扫描

上传的文件需要经过病毒扫描，防止恶意文件进入系统。

**实现方案：S3 Event → Lambda → ClamAV**

```
文件上传到 S3 temp/
  → S3 Event Notification 触发 scan-document Lambda
  → Lambda 下载文件到 /tmp
  → 调用 ClamAV (Lambda Layer) 扫描
  → 如果干净: 允许 confirmDocumentUpload 继续
  → 如果检测到病毒:
     - 删除 S3 temp/ 中的文件
     - 标记上传为 REJECTED
     - Slack 告警: "⚠️ Malicious file detected: {fileName} from {uploader}"
     - 返回错误给前端
```

**技术细节：**
- 使用 `clamav-lambda-layer` 开源 Lambda Layer（~120MB）
- Lambda 内存: 1024 MB（ClamAV 需要较大内存加载病毒库）
- Lambda 超时: 60 seconds
- 病毒库更新: EventBridge 每日触发 Lambda 更新 ClamAV 定义文件（存 S3）
- 成本: ~$0.50/月（基于每月 20-30 次扫描）

> **降级方案：** 如果 ClamAV Lambda Layer 配置复杂度过高，初期可先做**文件格式白名单 + 文件大小限制**（已在下节配置），病毒扫描作为 Phase 2 增强。

---

#### 12.9.8 文件大小与格式限制

| 限制项 | 值 | 原因 |
|-------|---|------|
| 单文件最大 | 50 MB | 覆盖大部分 PDF/图片；工程图纸偶尔较大 |
| 单订单最大 | 500 MB | 防止异常占用 |
| 允许格式 | PDF, DOCX, XLSX, JPG, PNG, DWG, EML, ZIP | 覆盖主要业务文档类型 |
| 禁止格式 | EXE, BAT, SH, JS, etc. | 安全考虑 |

---

#### 12.9.9 版本管理

同一份文档可能有多个版本（比如报价单从 v1 修改到 v2）。版本管理策略：

- 上传新版本时，旧版本的 `isLatestVersion` 设为 `false`，新版本指向旧版本的 `previousVersionDocId`
- 文档列表默认只显示最新版本，但可以展开查看历史版本
- S3 versioning 作为底层保障，即使 DynamoDB 记录出问题也能从 S3 恢复
- 删除操作为软删除（DynamoDB 标记 `deleted: true`），S3 对象保留

---

#### 12.9.10 未来增强：AI 文档分析

> **注意：** 以下功能为**未来 Phase**，不在初始实施范围内。先把基础的存储和检索做好，再考虑 AI 增强。

**阶段一：自动信息提取**

上传文档后，Lambda 调用 AI 模型（Claude API）从文档中提取结构化数据，存入 `extractedData` 字段：

```
Quote PDF 上传
  → AI 提取:
    {
      "quoteAmount": 185000,
      "currency": "USD",
      "productModel": "TL-ICP-300",
      "configuration": "8\" chamber, load-lock, dual RF source",
      "validUntil": "2026-04-15",
      "paymentTerms": "50% advance, 50% before shipping",
      "deliveryLeadTime": "10-12 weeks"
    }
  → 自动填充/验证 Order 字段（需人工确认）

PO PDF 上传
  → AI 提取:
    {
      "poNumber": "PO-STF-2026-1234",
      "poDate": "2026-02-01",
      "totalAmount": 185000,
      "shipToAddress": "450 Jane Stanford Way, Stanford, CA 94305",
      "billingContact": "Lisa Wang, Procurement Department",
      "specialInstructions": "Deliver to Loading Dock B, notify Dr. Smith"
    }
  → 自动填充 PO Number、联系人等信息
```

**阶段二：文档对比**

- 比较同一类型文档的不同版本，高亮差异（如报价单 v1 vs v2 的金额、配置变化）
- 比较不同订单的同类文档，发现模式（如"所有大学客户的 PO 都要求 net-60 付款条件"）

**阶段三：智能问答**

在 Order Detail 页面提供 AI 助手入口，可以直接用自然语言查询订单文档：

```
用户: "这笔订单的付款条件是什么？"
AI: "根据报价单 NS-Q-2026-003_v2.pdf 第 3 页，付款条件为：
     50% advance payment upon PO confirmation,
     50% balance before shipping (T/T).
     来源: NS-Q-2026-003_Quotation_v2.pdf [查看原文]"

用户: "Stanford 的 PO 对交付有什么特殊要求？"
AI: "PO-STF-2026-1234 中注明：
     1. 交付至 Loading Dock B
     2. 到货前 48 小时通知 Dr. Jane Smith
     3. 需要 COO (Certificate of Origin)
     来源: PO-STF-2026-1234.pdf [查看原文]"
```

**技术实现路径：**
- 文档上传时，Lambda 调用 Claude API（with tool use）提取结构化数据
- 提取结果存入 DynamoDB `extractedData` 字段
- 智能问答使用 RAG 架构：文档文本向量化 → 存入向量数据库（如 Amazon OpenSearch Serverless）→ 查询时检索相关段落 → Claude 生成回答并引用来源
- 初始阶段可以直接把文档全文传给 Claude（订单文档体量不大），跳过向量数据库

**成本估算（AI 功能）：**
- Claude API 调用：每份文档提取约 $0.01-0.05（取决于文档长度）
- 每月 10-20 份文档 ≈ $0.10-1.00/月
- OpenSearch Serverless（如果需要）：~$25/月起步，可延后引入

---

### 12.10 RFQ 集成（网站询价 → Order Tracker）

#### 12.10.1 模块定位

客户在网站提交 Request for Quote (RFQ) 后，系统将其作为**独立的 RFQ 实体**存储，**不自动创建 ORDER**。管理员在后台审核后，手动点击 "Convert to Order" 才创建 ORDER 记录。

**为什么不自动创建 ORDER？**
- 很多 RFQ 是无效询价（学生课程作业、竞争对手探价、没预算的随便问问）
- 自动创建会污染 Order 表，让真正的订单淹没在垃圾询价中
- 手动转化的过程本身就是一次快速筛选，帮你判断是否值得跟进

**RFQ 的生命周期：**

```
网站提交 → RFQ (PENDING) → 管理员审核
                                ├── [Convert to Order] → ORDER (INQUIRY) ← 建立关联
                                └── [Decline RFQ] → RFQ (DECLINED)
```

**核心价值：**

1. **无遗漏** — 每个 RFQ 都有记录，不会因为邮件太多而忘记跟进
2. **质量过滤** — 只有值得跟进的 RFQ 才进入 Order 管道，保持 Order 表干净
3. **转化漏斗** — 可统计 RFQ → Order 转化率，评估询价质量和响应效率
4. **数据一致** — RFQ 提交触发 Lead Scoring 加分和 ORG 匹配

> **不在网站上做报价生成。** 报价仍然在线下完成（Claude 桌面端或其他方式），生成后上传到 Order Tracker 的文档管理中归档。

---

#### 12.10.2 RFQ 表单设计（前端公开页面）

```
RFQPage.tsx (/request-quote)
├── Hero Section
│   ├── Title: "Request a Quote"
│   └── Subtitle: "Tell us about your equipment needs and we'll prepare a customized proposal."
│
├── RFQForm
│   ├── Section 1: Contact Information
│   │   ├── Full Name * (text)
│   │   ├── Email * (email)
│   │   ├── Phone (text, optional)
│   │   ├── Institution / Organization * (text)
│   │   ├── Department (text, optional)
│   │   └── Role * (dropdown: PI, Researcher, Procurement, Lab Manager, Other)
│   │
│   ├── Section 2: Equipment Requirements
│   │   ├── Equipment Category * (dropdown with descriptions)
│   │   │   ├── ICP Etching System
│   │   │   ├── PECVD System
│   │   │   ├── Sputter Deposition System
│   │   │   ├── ALD System
│   │   │   ├── RIE System
│   │   │   ├── IBE System
│   │   │   ├── HDP-CVD System
│   │   │   └── Other / Not Sure
│   │   │
│   │   ├── Specific Model (text, optional, e.g. "TL-ICP-300")
│   │   │   └── hint: "If you have a specific model in mind"
│   │   │
│   │   ├── Application / Process Description * (textarea)
│   │   │   └── placeholder: "Please describe your intended application, 
│   │   │       materials, substrate size, and any specific process requirements..."
│   │   │
│   │   ├── Key Specifications (optional, textarea)
│   │   │   └── placeholder: "Chamber size, power requirements, gas system needs,
│   │   │       throughput expectations, etc."
│   │   │
│   │   └── Quantity (number, default 1)
│   │
│   ├── Section 3: Project Context (all optional)
│   │   ├── Budget Range (dropdown)
│   │   │   ├── Prefer not to say
│   │   │   ├── Under $100,000
│   │   │   ├── $100,000 - $200,000
│   │   │   ├── $200,000 - $500,000
│   │   │   └── Over $500,000
│   │   │
│   │   ├── Timeline (dropdown)
│   │   │   ├── Exploring options (no rush)
│   │   │   ├── Within 3 months
│   │   │   ├── Within 6 months
│   │   │   ├── Within 12 months
│   │   │   └── Urgent (ASAP)
│   │   │
│   │   ├── Funding Status (dropdown)
│   │   │   ├── Funded / Budget approved
│   │   │   ├── Pending approval
│   │   │   ├── Grant application in progress
│   │   │   └── Early research / planning
│   │   │
│   │   └── How did you hear about us? (dropdown)
│   │       ├── Web search
│   │       ├── Referral from colleague
│   │       ├── Conference / Exhibition
│   │       ├── Publication / Journal
│   │       └── Other
│   │
│   ├── Section 4: Additional Information
│   │   ├── Existing Equipment (textarea, optional)
│   │   │   └── placeholder: "List any related equipment currently in your lab..."
│   │   │
│   │   ├── File Upload (optional, max 3 files, 10MB each)
│   │   │   └── hint: "Process specs, drawings, requirements documents"
│   │   │
│   │   └── Additional Comments (textarea, optional)
│   │
│   ├── Privacy Consent
│   │   └── checkbox: "I agree that NineScrolls may use this information to
│   │       prepare a quotation and contact me regarding this inquiry."
│   │
│   └── [Submit Request] button
│
├── SuccessScreen (post-submission)
│   ├── "Thank you for your inquiry!"
│   ├── "We've received your request and will respond within 1-2 business days."
│   ├── Reference number: RFQ-20260310-xxxx
│   └── "A confirmation email has been sent to your email address."
│
└── PrivacyNote
```

**表单验证规则：**
- name: required, 2-100 characters
- email: required, valid email format
- institution: required, 2-200 characters
- equipmentCategory: required
- applicationDescription: required, 20-3000 characters
- phone: optional, valid phone format if provided
- quantity: positive integer, default 1
- file uploads: max 3 files, max 10MB each, allowed formats: PDF, DOCX, XLSX, JPG, PNG
- Rate limiting: max 3 RFQ submissions per IP per 24 hours
- CAPTCHA: Cloudflare Turnstile (与反馈表单共用)

---

#### 12.10.3 REST API — RFQ 提交

```
POST /api/rfq
Content-Type: multipart/form-data (if files attached) or application/json

{
  "name": "Dr. Jane Smith",
  "email": "jane.smith@stanford.edu",
  "phone": "+1-650-xxx-xxxx",
  "institution": "Stanford University",
  "department": "Materials Science & Engineering",
  "role": "PI",
  "equipmentCategory": "ICP",
  "specificModel": "TL-ICP-300",
  "applicationDescription": "We need an ICP etching system for...",
  "keySpecifications": "8-inch chamber, load-lock required...",
  "quantity": 1,
  "budgetRange": "$100,000 - $200,000",
  "timeline": "within-6-months",
  "fundingStatus": "funded",
  "referralSource": "web-search",
  "existingEquipment": "Currently using a RIE system from...",
  "additionalComments": "We'd like to schedule a site visit...",
  "turnstileToken": "xxx"
}

Response (200):
{
  "success": true,
  "rfqId": "rfq-20260310-a1b2c3",
  "message": "Thank you. We'll respond within 1-2 business days.",
  "referenceNumber": "RFQ-20260310-A1B2"
}
```

---

#### 12.10.4 DynamoDB 实体：RFQ_SUBMISSION

RFQ 提交的原始数据作为独立实体保存（不丢失任何表单字段）。管理员手动 "Convert to Order" 后才建立 ORDER 关联。

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | `RFQ#<rfqId>` |
| SK | String | `META` |
| GSI1PK | String | `RFQ_STATUS#<pending\|converted\|declined>` |
| GSI1SK | String | `<submittedAt>#<rfqId>` |
| GSI2PK | String | `ORG#<orgId>` (if matched) |
| GSI2SK | String | `RFQ#<submittedAt>` |
| rfqId | String | e.g. `rfq-20260310-a1b2c3` |
| referenceNumber | String | 客户可见编号，e.g. `RFQ-20260310-A1B2` |
| status | String | `pending` \| `converted` \| `declined` \| `archived` |
| linkedOrderId | String | 转化后关联的 ORDER 实体 ID（Convert to Order 时填入） |
| submittedAt | String | ISO 8601 |
| ipHash | String | SHA-256 hashed IP |
| matchedOrgId | String | 匹配的 ORG 实体 ID |
| — all form fields — | | 完整保留提交的每个字段 |

> **为什么不直接复用 ORDER 实体？** 因为 RFQ 表单包含的信息（应用描述、规格需求、预算范围、时间线、资金状态等）比 ORDER 实体丰富得多。这些细节对于准备报价非常有价值，但不适合全部塞进 ORDER 表。分开存储，通过 `rfqId` ↔ `linkedOrderId` 双向关联。

---

#### 12.10.5 Lambda: submit-rfq

```
触发方式: API Gateway POST /api/rfq
运行时: Node.js 20.x
超时: 15 seconds
内存: 256 MB

处理流程:

1. 验证 Turnstile CAPTCHA token
2. 验证请求体 (schema validation)
3. 清洗输入 (XSS sanitization)
4. 生成 rfqId 和客户可见的 referenceNumber

5. 尝试匹配 ORG 实体
   - 通过 email domain 查找: stanford.edu → ORG#Stanford
   - 通过 institution 名称模糊匹配
   - 匹配成功则关联 orgId

6. 创建 RFQ_SUBMISSION 实体 (DynamoDB)
   - 保存所有表单字段
   - status = 'pending'

7. 处理附件（如有）
   - 将上传的文件存入 S3: rfqs/<rfqId>/
   - 记录 S3 keys 到 RFQ_SUBMISSION.attachmentKeys

8. Lead Score 更新
    - RFQ 提交 = +8 分
    - 如果 fundingStatus = 'funded' → 额外 +5 分
    - 如果 timeline = 'urgent' → 额外 +3 分

9. 发送通知
    a. 给客户: SES 确认邮件
       - 包含 referenceNumber
       - 预计响应时间: 1-2 business days
    b. 给团队: Slack #inquiries
       - "📩 New RFQ: [ICP Etching System] from Stanford University (Dr. Jane Smith, PI)"
       - Budget: $100k-200k | Timeline: 6 months | Funding: Approved
       - [View in Order Tracker] link
    c. 给团队: Email (可选)
       - 完整 RFQ 详情

10. 返回 success response
```

---

#### 12.10.6 Convert to Order（手动转化）

管理员在后台审核 RFQ 后，点击 "Convert to Order" 按钮将其转化为正式订单。

**转化流程：**

```
管理员在 RFQ Detail 页面点击 [Convert to Order]
  → 弹出 ConvertToOrderDialog:
     - 设备型号 (预填 from RFQ, 可修改)
     - 设备名称 (auto-fill based on model)
     - 配置摘要 (预填 from RFQ keySpecifications)
     - 报价金额 (可选)
     - 内部备注
     - [Confirm] / [Cancel]
  → Lambda: convert-rfq-to-order
     1. 创建 ORDER 实体 (status: INQUIRY)
        - source: RFQ_WEBSITE
        - rfqId: <rfqId>
        - institution, productModel: from RFQ
        - inquiryDate: RFQ submittedAt
     2. 创建 ORDER_CONTACT (from RFQ contact info)
        - isPrimary: true, feedbackInvite: true
     3. 迁移附件: S3 copy rfqs/<rfqId>/* → orders/<orderId>/INQUIRY/
        - 创建 ORDER_DOCUMENT 记录
     4. 更新 RFQ_SUBMISSION:
        - status: 'converted'
        - linkedOrderId: <orderId>
     5. 写入 ORDER_LOG (action: CREATED_FROM_RFQ)
     6. Slack 通知: "RFQ converted to Order: [ICP] Stanford University"
```

**转化后：** RFQ Detail 页面顶部显示 "Converted → Order #ord-xxx" 的链接，可直接跳转到 Order Detail。

---

#### 12.10.7 RFQ 附件处理

RFQ 表单支持上传最多 3 个附件（技术需求文档、工程图纸等）。

**上传流程（与文档管理共用 presigned URL 机制）：**

```
1. 用户选择文件后，前端调用 getDocumentUploadUrl
   → 返回 S3 presigned PUT URL (temp/ 目录)

2. 前端直传文件到 S3 (避开 API Gateway payload 限制)

3. 前端提交 RFQ 表单时，附带 S3 keys 列表

4. submit-rfq Lambda 中:
   a. 将文件从 temp/ 移到 orders/<orderId>/INQUIRY/
   b. 创建 ORDER_DOCUMENT 记录:
      - stage: INQUIRY
      - docType: REQUIREMENTS
      - description: "Uploaded with RFQ submission"
```

---

#### 12.10.8 管理后台 UI 更新

**Order List 页面变更：**

```
新增 StatsBar 卡片:
├── New Inquiries (INQUIRY 状态数量, 醒目显示)
│   └── badge: 未读数量 (过去 24h)

新增 Status filter 选项:
├── INQUIRY (新增)
├── DECLINED (新增)

OrderTable 新增:
├── Source 列 (icon: 🌐 RFQ_WEBSITE | ✏️ MANUAL | 📥 IMPORTED)
├── INQUIRY 行高亮: 💜 Purple background (新询价, 需关注)
├── DECLINED 行: 灰色, 默认折叠/隐藏 (可展开查看)
```

**RFQ List 页面（管理后台新增独立模块）：**

```
RFQListPage
├── StatsBar
│   ├── Pending (待审核, 醒目显示)
│   ├── Converted (已转化为订单)
│   ├── Declined (已拒绝)
│   └── Conversion Rate (转化率 %)
│
├── RFQTable
│   ├── Columns: Date, Name, Institution, Equipment, Budget, Timeline, Status, Actions
│   ├── Row colors:
│   │   ├── 💜 Purple: PENDING (新询价, 需关注)
│   │   ├── 🟢 Green: CONVERTED
│   │   └── ⚪ Gray: DECLINED
│   └── Click row → RFQ Detail
│
└── Filters: status, equipmentCategory, date range
```

**RFQ Detail 页面：**

```
RFQDetail
├── Header
│   ├── Status badge: "PENDING" / "CONVERTED" / "DECLINED"
│   ├── Reference: RFQ-20260310-A1B2
│   └── Action buttons:
│       ├── [Convert to Order] → ConvertToOrderDialog (见 §12.10.6)
│       └── [Decline] → DeclineDialog (需填原因)
│
├── Contact Info
│   ├── Name, Email, Phone
│   ├── Institution, Department
│   └── Role
│
├── Equipment Requirements
│   ├── Category + Specific Model
│   ├── Application Description (完整文本)
│   ├── Key Specifications
│   └── Quantity
│
├── Project Context
│   ├── Budget Range
│   ├── Timeline
│   ├── Funding Status
│   ├── Referral Source
│   └── Existing Equipment
│
├── Attached Files (RFQ 提交时上传的文件)
│
├── Internal Notes (管理员备注)
│
├── Linked Order (仅 CONVERTED 状态)
│   └── "Converted → Order #ord-xxx [View Order]"
│
└── ORG Match
    └── 自动匹配的机构信息 + Lead Score
```

**Order Detail 页面变更 (来自 RFQ 的订单)：**

```
OrderDetail (source=RFQ_WEBSITE 时额外显示)
├── Source badge: "From RFQ-20260310-A1B2 [View RFQ]"
│
└── RFQ Summary Panel (折叠式, 显示原始 RFQ 的关键信息)
    ├── Application Description
    ├── Key Specifications
    ├── Budget Range / Timeline / Funding Status
    └── [View Full RFQ] link
```

**Decline Dialog:**

```
DeclineInquiryDialog
├── "Are you sure you want to decline this inquiry?"
├── Reason * (dropdown)
│   ├── Equipment not in our product line
│   ├── Geographic limitation
│   ├── Customer not responding
│   ├── Budget mismatch
│   ├── Duplicate inquiry
│   └── Other
├── Additional notes (textarea, optional)
├── [Decline] button (red)
└── [Cancel] button
```

---

#### 12.10.9 确认邮件模板

```
模板 ID: rfq-confirmation
发件人: noreply@ninescrolls.com
主题: "We've received your quote request — Reference {{referenceNumber}}"

────────────────────────────────────

Dear {{name}},

Thank you for your interest in NineScrolls {{equipmentCategory}} systems.

We've received your quote request and assigned it reference number 
{{referenceNumber}}. Our engineering team will review your requirements 
and respond within 1-2 business days.

Your Request Summary:
• Equipment: {{equipmentCategory}} {{specificModel}}
• Institution: {{institution}}

If you have any questions in the meantime, please reply to this email 
or contact us at sales@ninescrolls.com.

Best regards,
NineScrolls Technology LLC

────────────────────────────────────
```

---

#### 12.10.10 与 Market Intelligence System 的深度集成

RFQ 提交是最强的购买意向信号，与 Market Intelligence 的集成点：

| 集成点 | 说明 |
|--------|------|
| Lead Score | RFQ 提交 = +8 基础分; funded = +5; urgent = +3; 最高 +16 |
| ORG 实体 | 匹配成功 → `hasActiveInquiry: true`, `latestRFQDate`, `rfqCount` |
| 访客行为关联 | 如果 RFQ 提交者的 IP/email domain 匹配已有访客记录，可回溯其浏览历史 |
| Organization Table | 新增 "Inquiry" 状态列，显示有活跃询价的机构 |
| 转化漏斗 | Website Visit → RFQ → Quote → PO → Delivery 全链路可追踪 |

**转化率指标（在 Analytics Dashboard 中新增）：**

| 指标 | 计算 | 用途 |
|------|------|------|
| RFQ 转化率 | QUOTING+ / (INQUIRY + DECLINED) | 询价质量评估 |
| 平均响应时间 | avg(quoteDate - inquiryDate) | 服务效率监控 |
| RFQ → PO 转化率 | PO_RECEIVED+ / QUOTING+ | 报价竞争力评估 |
| 来源分析 | by referralSource | 营销渠道效果 |
| 设备热度 | by equipmentCategory | 产品需求趋势 |

---

## 13. 实施路线图（v2.0 — 复杂度控制版）

> **开发模式：** 使用 Claude Code 辅助开发。Phase 时间估算已考虑 AI 辅助编码效率。
>
> **核心原则：** 每个 Phase 交付一个可独立运行的最小可用模块。不做半成品。

### Phase 1: RFQ + Order Tracker + 文档存储（2 周）

**目标：** 把网站询价 → 订单跟踪 → 文档归档的核心链路跑通。

- [ ] RFQPage.tsx 前端组件 (`/request-quote`)
- [ ] submit-rfq Lambda (RFQ 独立存储 + 通知)
- [ ] RFQ 确认邮件 (SES template)
- [ ] DynamoDB: RFQ_SUBMISSION / ORDER / ORDER_CONTACT / ORDER_LOG / ORDER_DOCUMENT 实体 + GSI
- [ ] S3 bucket + presigned URL 机制
- [ ] Order Tracker 管理后台 (List + Detail + Create)
- [ ] RFQ 管理后台 (List + Detail + Convert to Order + Decline)
- [ ] convert-rfq-to-order Lambda
- [ ] update-order-status Lambda (含 QUOTE_SENT + 完整状态机)
- [ ] 文档上传/下载/预览 (DocumentsPanel)
- [ ] Slack 通知 (RFQ 提交、订单状态变更)
- [ ] SES 域名验证 (DKIM + SPF + DMARC)
- [ ] DynamoDB PITR 启用
- [ ] CloudWatch 基础告警

### Phase 2: 反馈收集 + 管理（1-2 周）

**目标：** 客户可以在网站提交反馈，管理员可以查看和回复。

- [x] FeedbackPage.tsx 前端组件（已完成）
- [x] FeedbackPage.css 样式（已完成）
- [ ] submit-feedback Lambda
- [ ] DynamoDB: FEEDBACK 实体 + GSI (含 GSI3 orderId 关联)
- [ ] API Gateway endpoint (`POST /api/feedback`)
- [ ] 路由集成 (`/feedback`) + 导航栏入口
- [ ] Feedback Dashboard (管理后台)
- [ ] FeedbackTable (筛选/排序/分页)
- [ ] FeedbackDetail drawer
- [ ] Status 管理 + Internal notes
- [ ] Reply 功能 (SES)
- [ ] 反馈与 ORDER 的自动关联 (通过 GSI3)
- [ ] CSV 导出

### Phase 3: 自动反馈邀请 + Token 系统（1-2 周）

**目标：** 设备安装完成后自动触发分阶段反馈邀请。

- [ ] INSTALLED 状态触发 FEEDBACK_SCHEDULE 创建
- [ ] Token 生成 (HMAC-SHA256, 不含 role)
- [ ] validate-token Lambda
- [ ] FEEDBACK_TOKEN_USED 实体
- [ ] FeedbackPage.tsx token 解析 + 信息预填
- [ ] EventBridge 定时扫描到期 schedule
- [ ] SES 邮件模板 (5 阶段)
- [ ] 退订机制 (unsubscribe Lambda + 前端页面)
- [ ] List-Unsubscribe header
- [ ] update-order-status Lambda ConditionExpression 并发控制

### Phase 4: 智能集成 + 证言系统（1 周）

**目标：** 打通 Market Intelligence，上线证言展示。

- [ ] Lead Score 加分规则 (RFQ, feedback, testimonial)
- [ ] ORG 实体增强 (订单数据 + 反馈数据)
- [ ] Alert rules (低分反馈、订单超期)
- [ ] TestimonialManager 管理界面
- [ ] TestimonialCarousel 前端组件
- [ ] JSON-LD 结构化数据 (SEO)
- [ ] 转化漏斗 Dashboard (RFQ → Quote → PO → Install)

### Phase 5: 运维增强（1 周）

**目标：** 系统稳定性和安全性加固。

- [ ] 文档病毒扫描 (ClamAV Lambda Layer)
- [ ] 交付日提前 7 天提醒
- [ ] 超期告警 + 状态停留过久告警
- [ ] 周度订单摘要报告
- [ ] 邮件打开/点击追踪
- [ ] （可选）已有订单 Import Mode

### Phase 6: AI + 高级功能（Future）

**目标：** 等核心系统稳定运行 3-6 个月后再考虑。

- [ ] AI 文档信息提取 (Claude API)
- [ ] 文档版本对比
- [ ] AI 问答 (订单文档 Q&A)
- [ ] 角色感知反馈表单 (§17)
- [ ] HubSpot CRM 双向同步
- [ ] （可选）向量数据库 + RAG

**总工期估算：Phase 1-5 约 6-8 周（Claude Code 辅助）**

---

## 14. 成本估算

| 组件 | 月成本 | 说明 |
|------|-------|------|
| DynamoDB (增量) | ~$0.50 | 反馈 + 订单 + 文档元数据 |
| Lambda (增量) | ~$0.15 | submit-feedback + order status + doc upload |
| SES 邮件 | ~$1.00 | 确认邮件 + 邀请邮件 |
| API Gateway (增量) | ~$0.05 | 反馈提交 endpoint |
| S3 文档存储 | ~$0.50 | 预估 5-10 GB/年，按月 ~500 MB |
| Cloudflare Turnstile | Free | 免费 CAPTCHA |
| **Total (Phase 1-5)** | **~$2.20/月** | 基于现有基础设施 |
| Claude API (Phase 6) | ~$0.50 | 文档提取，预估 10-20 份/月 |
| **Total (含 AI)** | **~$2.70/月** | Phase 6 上线后 |

由于复用现有 AWS 基础设施，整个系统（反馈 + 订单管理 + 文档存储）的增量成本不到 $3/月。

---

## 15. 技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 垃圾反馈 | 数据污染 | Turnstile + honeypot + rate limit |
| 恶意内容 | 展示风险 | 管理员审核 + 内容过滤 |
| 低响应率 | 数据不足 | 分阶段邀请 + 简洁表单 |
| 邮件退信 | 邀请失败 | SES bounce handling + 邮箱验证 |
| 与 ORG 匹配失败 | 数据孤岛 | 允许手动关联 + email domain 匹配 |
| Token 伪造/滥用 | 虚假反馈 | HMAC 签名 + 过期机制 + 一次提交限制 |
| 邮件退订合规 | CAN-SPAM / GDPR 违规 | 每封邮件含 unsubscribe 链接 |
| 并发状态变更 | 数据不一致 | DynamoDB ConditionExpression 原子校验 |
| Lambda 故障无感知 | 邀请/通知静默失败 | CloudWatch Alarms + 错误率告警 |

---

## 16. 反馈邀请链接安全设计（Token 机制）

### 16.1 问题

反馈邀请邮件中包含预填客户信息的链接。如果链接没有安全机制，任何人都可以伪造链接提交虚假反馈，或者猜测链接参数批量提交垃圾数据。

### 16.2 Token 生成

使用 HMAC-SHA256 签名，将客户信息和时效编码到 token 中：

```
Token 组成:
  payload = base64url({
    "oid": "ord-20260310-x7k9",    // orderId
    "cid": "ct-a1b2c3",            // contactId
    "stg": "30-day",               // feedback stage
    "exp": 1714521600              // 过期时间 (Unix timestamp)
  })

  注意: role 不放入 token，而是从数据库实时读取。
  原因: 如果 token 被转发给同事，role 可能与实际使用者不符。
  validate-token Lambda 通过 contactId 查询 ORDER_CONTACT 获取真实 role。

  signature = HMAC-SHA256(payload, FEEDBACK_TOKEN_SECRET)

  token = payload + "." + base64url(signature)
```

**FEEDBACK_TOKEN_SECRET:** 存储在 AWS Secrets Manager 或 Lambda 环境变量（加密），长度 >= 32 字节。

### 16.3 Token 有效期

| 邀请阶段 | 有效期 | 说明 |
|---------|-------|------|
| T+3 天（采购流程反馈） | 30 天 | 交付后记忆尚新 |
| T+30 天（首月反馈） | 30 天 | |
| T+90 天（季度回顾） | 45 天 | 给更多时间响应 |
| T+180 天（半年评估） | 45 天 | |
| T+365 天（年度回顾） | 60 天 | |

### 16.4 反馈链接 URL 结构

```
https://www.ninescrolls.com/feedback?token=<token>
```

前端 FeedbackPage 加载时：

```
1. 从 URL 读取 token 参数
2. 调用 GET /api/feedback/validate-token?token=xxx
   → Lambda 验证签名、检查过期、检查是否已提交
   → 返回: { valid: true, prefill: { name, email, institution, productModel, role, stage } }
3. 如果 valid:
   - 自动选择对应的 feedbackType (procurement / product)
   - 预填客户信息字段（不可编辑）
   - 根据 role + stage 显示对应的评价维度（见 16.5）
4. 如果 invalid:
   - 显示友好提示："This feedback link has expired or already been used."
   - 提供通用反馈入口链接
```

### 16.5 提交限制

- **每个 token 只能成功提交一次。** 提交后 Lambda 在 DynamoDB 中记录 `FEEDBACK_TOKEN_USED#<tokenHash>`，再次提交时返回 "已提交" 提示。
- 即使没有 token，公开表单仍然可用（走通用入口），但不享受预填和角色感知能力。
- Token 不防止客户将链接转发给同事——这是可以接受的，因为反馈内容本身有价值。

### 16.6 validate-token Lambda

```
触发方式: API Gateway GET /api/feedback/validate-token
运行时: Node.js 20.x
超时: 5 seconds
内存: 128 MB

处理流程:
1. 解析 token: 分割 payload 和 signature
2. 验证签名: HMAC-SHA256(payload, SECRET) === signature
3. 解析 payload: base64url decode → JSON
4. 检查过期: payload.exp > now
5. 检查已使用: 查询 DynamoDB PK=FEEDBACK_TOKEN_USED#<sha256(token)>
6. 如果全部通过:
   - 查询 ORDER_CONTACT 获取联系人完整信息（包括 role，从 DB 实时读取）
   - 查询 ORDER 获取订单/设备信息
   - 返回 prefill 数据 + role (from DB) + stage
7. 如果任一失败: 返回 { valid: false, reason: "expired" | "used" | "invalid" }
```

---

## 17. 角色感知反馈表单（Future — 初期不实施）

> **⚠️ 本章内容标记为 Future，初期不实施。** 初期只做 Procurement 和 Product 两种通用反馈表单（即 FeedbackPage.tsx 当前设计），不按角色细分评价维度。等反馈数据量积累到一定程度、确认角色细分确实有价值后再实施本章设计。

### 17.1 问题

当前 FeedbackPage.tsx 的评价维度是固定的，所有角色看到相同的打分项。但 PROCUREMENT 角色关心的是报价流程和付款体验，RESEARCHER 关心的是操作体验和培训效果，FACILITIES 关心的是安装协调和场地适配。用统一维度收集反馈会让客户觉得不相关，降低响应率和数据质量。

### 17.2 角色 × 阶段 评价维度映射

**T+3 天 — 采购流程反馈（Procurement Experience）:**

| 评价维度 | PI | RESEARCHER | PROCUREMENT | FACILITIES | FINANCE | LAB_MANAGER |
|---------|:--:|:----------:|:-----------:|:----------:|:-------:|:-----------:|
| 技术咨询质量 | ✓ | ✓ | | | | ✓ |
| 需求理解准确性 | ✓ | ✓ | | | | ✓ |
| 报价清晰度 | ✓ | | ✓ | | ✓ | ✓ |
| 报价响应速度 | | | ✓ | | | |
| PO 处理效率 | | | ✓ | | ✓ | |
| 交付协调沟通 | | | | ✓ | | ✓ |
| 安装场地适配 | | | | ✓ | | |
| 总体满意度 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**T+30 天 — 首月使用反馈:**

| 评价维度 | PI | RESEARCHER | LAB_MANAGER |
|---------|:--:|:----------:|:-----------:|
| 设备初始性能 | ✓ | ✓ | ✓ |
| 安装调试体验 | ✓ | | ✓ |
| 操作便利性 | | ✓ | |
| 培训效果 | | ✓ | ✓ |
| 用户文档质量 | | ✓ | |
| 总体满意度 | ✓ | ✓ | ✓ |

**T+90 天 — 季度回顾:**

| 评价维度 | PI | RESEARCHER | LAB_MANAGER |
|---------|:--:|:----------:|:-----------:|
| 设备长期稳定性 | ✓ | ✓ | ✓ |
| 技术支持响应 | ✓ | ✓ | ✓ |
| 耗材/配件供应 | | ✓ | ✓ |
| 日常维护便利性 | | ✓ | |
| 总体满意度 | ✓ | ✓ | ✓ |

**T+180 天 — 半年评估 + 证言邀请:**

| 评价维度 | PI | LAB_MANAGER |
|---------|:--:|:-----------:|
| 设备 ROI | ✓ | ✓ |
| 售后服务整体 | ✓ | ✓ |
| 是否推荐 | ✓ | ✓ |
| 改进建议（open-ended） | ✓ | ✓ |
| 证言邀请 | ✓ | ✓ |

**T+365 天 — 年度回顾:**

| 评价维度 | PI | LAB_MANAGER | PROCUREMENT |
|---------|:--:|:-----------:|:-----------:|
| 年度综合满意度 | ✓ | ✓ | ✓ |
| AMC 续签意向 | | ✓ | ✓ |
| 新设备需求 | ✓ | ✓ | |
| 售后服务年度评价 | ✓ | ✓ | |
| 付款/发票流程 | | | ✓ |

### 17.3 前端实现方案

在 FeedbackPage.tsx 中增加角色感知逻辑：

```
// 评价维度配置表（从配置文件或 API 加载）
const RATING_DIMENSIONS_MAP = {
  "procurement": {
    "3-day": {
      "PI": ["technicalConsultation", "requirementsAccuracy", "quotationClarity", "overallSatisfaction"],
      "PROCUREMENT": ["quotationClarity", "quotationSpeed", "poProcessing", "overallSatisfaction"],
      "FACILITIES": ["deliveryCoordination", "siteAdaptation", "overallSatisfaction"],
      ...
    },
    ...
  },
  "product": {
    "30-day": {
      "PI": ["initialPerformance", "installationExperience", "overallSatisfaction"],
      "RESEARCHER": ["initialPerformance", "operationEase", "trainingEffectiveness", "documentationQuality", "overallSatisfaction"],
      ...
    },
    ...
  }
};

// FeedbackPage 组件中:
function FeedbackPage() {
  const { token } = useSearchParams();
  const [tokenData, setTokenData] = useState(null);

  useEffect(() => {
    if (token) {
      validateToken(token).then(data => {
        if (data.valid) {
          setTokenData(data.prefill);
          // 自动设置 feedbackType, 预填信息, 加载对应维度
        }
      });
    }
  }, [token]);

  const ratingDimensions = tokenData
    ? RATING_DIMENSIONS_MAP[feedbackType][tokenData.stage][tokenData.role]
    : DEFAULT_RATING_DIMENSIONS;  // 无 token 时用通用维度

  return (
    // 渲染 ratingDimensions 对应的 StarRating 组件
  );
}
```

> **降级策略：** 当用户通过公开入口（无 token）访问时，显示完整的通用评价维度（即当前 FeedbackPage.tsx 的默认行为），不做角色过滤。

---

## 18. 退订机制

### 18.1 合规要求

CAN-SPAM Act 和 GDPR 都要求商业邮件包含退订机制。虽然反馈邀请不是营销邮件，但频繁发送（5 封/年）仍应提供退出选项。

### 18.2 退订链接

每封反馈邀请邮件底部包含退订链接：

```
https://www.ninescrolls.com/feedback/unsubscribe?token=<unsubscribe_token>
```

`unsubscribe_token` 使用与反馈链接相同的 HMAC 签名机制，payload 包含 `orderId` + `contactId`。

### 18.3 退订处理流程

```
1. 用户点击退订链接
2. 跳转到简洁的退订确认页面:
   "You will no longer receive feedback invitation emails for this order.
    If you change your mind, please contact us at support@ninescrolls.com."
   [Confirm Unsubscribe] button
3. 用户点击确认 → POST /api/feedback/unsubscribe
4. Lambda 处理:
   a. 验证 unsubscribe_token
   b. 更新 ORDER_CONTACT: feedbackInvite = false
   c. 取消该 contact 所有未发送的 FEEDBACK_SCHEDULE 记录
   d. 写入 ORDER_LOG (action: CONTACT_UNSUBSCRIBED)
5. 显示: "You've been unsubscribed. Thank you."
```

### 18.4 管理后台可见性

- Order Detail 的 ContactsPanel 中，已退订的联系人显示 `Unsubscribed` 标签
- 管理员可以手动将 `feedbackInvite` 重新设为 `true`（比如客户主动要求重新订阅）
- 退订操作记录在 ORDER_LOG 中，可审计

### 18.5 SES 层面

- 启用 SES 的 List-Unsubscribe header，支持邮件客户端原生退订按钮
- 格式: `List-Unsubscribe: <https://www.ninescrolls.com/feedback/unsubscribe?token=xxx>`
- 同时启用 `List-Unsubscribe-Post: List-Unsubscribe=One-Click`（RFC 8058 one-click unsubscribe）

---

## 19. SES 邮件模板设计

### 19.1 前提：域名验证

在发送任何邮件之前，需要在 SES 中完成域名验证：

- 验证域名: `ninescrolls.com`
- 设置自定义 MAIL FROM: `mail.ninescrolls.com`
- 配置 DKIM（DomainKeys Identified Mail）
- 配置 SPF 和 DMARC
- 发件地址: `feedback@ninescrolls.com`（反馈邀请）和 `noreply@ninescrolls.com`（确认邮件）

> **建议在 Phase 1 就完成域名验证**，避免后续阶段被 SES 沙盒模式阻塞。

### 19.2 邮件模板概览

| 模板 ID | 触发场景 | 发件人 | 主题行 |
|---------|---------|--------|-------|
| `feedback-confirm` | 用户提交反馈后 | noreply@ | "Thank you for your feedback, {{name}}" |
| `invite-3day` | T+3 天 | feedback@ | "How was your procurement experience with NineScrolls?" |
| `invite-30day` | T+30 天 | feedback@ | "{{name}}, how is your {{productModel}} performing?" |
| `invite-90day` | T+90 天 | feedback@ | "Quarterly check-in: Your {{productModel}} at 3 months" |
| `invite-180day` | T+180 天 | feedback@ | "6-month review: Share your experience with {{productModel}}" |
| `invite-365day` | T+365 天 | feedback@ | "One year with {{productModel}} — We'd love your thoughts" |
| `feedback-reply` | 管理员回复反馈 | feedback@ | "Re: Your feedback to NineScrolls" |

### 19.3 邮件内容结构（通用框架）

```
┌─────────────────────────────────────────────┐
│  NineScrolls Logo (居中)                      │
├─────────────────────────────────────────────┤
│                                             │
│  Dear {{contactName}},                      │
│                                             │
│  {{opening_paragraph}}                      │
│  (根据阶段和角色定制的开场白)                   │
│                                             │
│  {{context_paragraph}}                      │
│  (订单信息: {{productModel}}, {{institution}}) │
│                                             │
│  ┌─────────────────────────────┐            │
│  │  [Share Your Feedback]      │            │
│  │  (CTA button, 链接到反馈表单)  │           │
│  └─────────────────────────────┘            │
│                                             │
│  This short survey takes about 3-5 minutes. │
│  Your feedback directly helps us improve.   │
│                                             │
├─────────────────────────────────────────────┤
│  Nine Scrolls Technology LLC                │
│  feedback@ninescrolls.com                   │
│                                             │
│  You're receiving this because your         │
│  organization {{institution}} has a         │
│  recent equipment order with us.            │
│  [Unsubscribe from future invitations]      │
├─────────────────────────────────────────────┤
```

### 19.4 各阶段定制要点

**T+3 天 (invite-3day):**
- 感谢客户完成采购
- 聚焦采购流程体验
- CTA: "Rate Your Procurement Experience"
- 语气: warm, appreciative

**T+30 天 (invite-30day):**
- 询问设备初始使用情况
- 提醒可以联系技术支持
- CTA: "Share Your First Month Experience"
- 语气: caring, supportive

**T+90 天 (invite-90day):**
- 关注长期稳定性和支持满意度
- CTA: "Complete Your Quarterly Review"
- 语气: professional, check-in

**T+180 天 (invite-180day):**
- 综合评价 + 证言邀请
- 提到"your feedback may be featured on our website (with your permission)"
- CTA: "Share Your 6-Month Assessment"
- 语气: partnership, trust

**T+365 天 (invite-365day):**
- 年度回顾 + AMC 续签提醒
- 询问新设备需求
- CTA: "Complete Your Annual Review"
- 语气: long-term partnership

---

## 20. 运维与可靠性

### 20.1 数据备份

| 组件 | 备份策略 | 恢复能力 |
|------|---------|---------|
| DynamoDB | 启用 PITR (Point-in-Time Recovery) | 恢复到过去 35 天内任意秒级时间点 |
| S3 文档 | 启用 Versioning（已在 12.9.3 配置） | 误删可恢复，误覆盖可回滚 |
| S3 跨区域 | （可选）Cross-Region Replication 到 us-west-2 | 区域级灾难恢复 |
| 定期导出 | 每周 EventBridge 触发 DynamoDB Export to S3 | 冷备份，长期保留 |

### 20.2 监控与告警

**CloudWatch Alarms:**

| 告警名称 | 指标 | 阈值 | 通知 |
|---------|------|------|------|
| Lambda 错误率 | Errors / Invocations | > 5% (5 min) | Slack + Email |
| API Gateway 5xx | 5xxError | > 0 (1 min) | Slack |
| SES 退信率 | Bounce Rate | > 5% | Email |
| SES 投诉率 | Complaint Rate | > 0.1% | Email (urgent) |
| DynamoDB 节流 | ThrottledRequests | > 0 (5 min) | Slack |
| Lambda 超时 | Duration > Timeout×0.8 | 连续 3 次 | Slack |

**CloudWatch Logs:**
- 所有 Lambda 函数启用结构化 JSON 日志
- Log retention: 90 天
- 关键操作日志字段: `{ action, orderId, contactId, feedbackId, operator, result, errorCode }`

**CloudWatch Dashboard（可选）:**
- 反馈提交趋势（日/周）
- 邮件发送成功率
- Token 验证失败率（可能暗示安全问题）
- Order Tracker 操作频率

### 20.3 并发控制

**问题：** 两个管理员同时对同一笔订单执行状态变更，可能导致状态不一致或重复创建 FEEDBACK_SCHEDULE。

**解决方案：** 在 `update-order-status` Lambda 中使用 DynamoDB ConditionExpression：

```javascript
// update-order-status Lambda 中的状态变更操作
await dynamodb.update({
  TableName: 'NineScrolls-Intelligence',
  Key: { PK: `ORDER#${orderId}`, SK: 'META' },
  UpdateExpression: 'SET #status = :newStatus, updatedAt = :now, ...',
  ConditionExpression: '#status = :expectedCurrentStatus',
  ExpressionAttributeNames: { '#status': 'status' },
  ExpressionAttributeValues: {
    ':newStatus': newStatus,
    ':expectedCurrentStatus': currentStatus,  // 前端传入的当前状态
    ':now': new Date().toISOString()
  }
}).promise();

// 如果 ConditionExpression 不满足（另一人已先变更），
// DynamoDB 抛出 ConditionalCheckFailedException
// → Lambda 返回 409 Conflict: "Order status has been updated by another user. Please refresh."
```

**FEEDBACK_SCHEDULE 创建的幂等性：**
- 在创建 schedule 前检查 `ORDER.feedbackScheduleCreated === true`
- 如果已创建，跳过不重复创建
- 整个 INSTALLED 状态变更 + schedule 创建不在同一个事务中（DynamoDB 单表事务最多 100 items），但通过 `feedbackScheduleCreated` flag 保证幂等

### 20.4 已有订单数据迁移

上线时可能已有正在进行或已完成的历史订单。迁移方案：

**方式一：管理后台手动创建（推荐，适合 < 20 笔）**
- 在 Create Order 表单中增加"Import Mode"开关（仅限上线初期）
- Import Mode 下允许：
  - 直接设置任意状态（不受"只能向前推进"限制）
  - 手动输入所有历史日期
  - 选择是否补发反馈邀请
- 系统在 ORDER_LOG 中记录 `action: IMPORTED`

**方式二：CSV 批量导入（适合 > 20 笔）**
- 提供 CSV 模板下载
- 管理后台上传 CSV → Lambda 逐行解析并创建 ORDER 实体
- 导入结果报告：成功 N 条，失败 M 条（含失败原因）
- 导入的订单默认不触发反馈邀请，除非手动开启

> **注意：** 迁移功能仅在上线初期使用，后续可隐藏或移除 Import Mode 入口。

---

## 21. 架构评审记录

### v2.0 评审变更摘要 (Architecture Review)

基于系统级架构评审，v2.0 做了以下关键调整：

| # | 评审意见 | 变更 |
|---|---------|------|
| 1 | RFQ 不应自动创建 ORDER，会污染订单表 | RFQ 改为独立实体，手动 "Convert to Order" 转化 |
| 2 | QUOTING 和已发送报价是不同状态 | 新增 `QUOTE_SENT` 状态，统计报价转化率 |
| 3 | FEEDBACK 通过 email/quoteNumber 软匹配 ORDER 不可靠 | 新增 GSI3 (`ORDER#<orderId>`)，直接硬关联 |
| 4 | Token payload 不应包含 role | role 从 DB 实时读取，token 只含 oid+cid+stage+exp |
| 5 | 角色感知表单复杂度过高 | §17 标记为 Future，初期只做两种通用表单 |
| 6 | 文档上传缺少安全扫描 | 新增 §12.9.7 ClamAV 病毒扫描 |
| 7 | 实施计划复杂度过高 | Phase 重新规划，Phase 1 聚焦 RFQ + Order Tracker |
| 8 | 系统总体复杂度超出团队规模 | 使用 Claude Code 辅助开发，严格控制每 Phase 范围 |

**评审评分：** 架构 9/10, 业务流程 9/10, 技术选型 9/10, 数据模型 8→9/10, 可维护性 7→8/10, 复杂度控制 6→8/10
