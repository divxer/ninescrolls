# Market Intelligence 使用指南

> NineScrolls Admin Analytics Dashboard — 完整操作手册

---

## 目录

1. [概述](#1-概述)
2. [访问与导航](#2-访问与导航)
3. [日期范围筛选](#3-日期范围筛选)
4. [控制开关](#4-控制开关)
5. [KPI 指标卡片](#5-kpi-指标卡片)
6. [访客地图](#6-访客地图)
7. [趋势图表](#7-趋势图表)
8. [搜索关键词](#8-搜索关键词)
9. [页面分析](#9-页面分析)
10. [增强筛选栏](#10-增强筛选栏)
11. [组织列表](#11-组织列表)
12. [组织详情（Intelligence Dossier）](#12-组织详情intelligence-dossier)
13. [行为评分系统](#13-行为评分系统)
14. [客户分级系统](#14-客户分级系统)
15. [生命周期阶段](#15-生命周期阶段)
16. [流量渠道识别](#16-流量渠道识别)
17. [匿名高意向检测](#17-匿名高意向检测)
18. [数据导出](#18-数据导出)
19. [技术架构概览](#19-技术架构概览)

---

## 1. 概述

Market Intelligence 是 NineScrolls 的核心分析仪表板，面向销售与市场团队，用于实时识别和追踪高价值访客组织。系统自动完成以下工作：

- **IP 识别**：通过 IP 地址识别访客所属组织（大学、研究机构、企业）
- **AI 分类**：结合 AI 模型对组织类型进行二次验证和升级
- **行为评分**：基于浏览深度、停留时间、PDF 下载、表单互动等计算意向分
- **自动分级**：将目标客户分为 A / B / C 三个等级
- **生命周期跟踪**：自动判定访客处于 awareness → interest → consideration → intent 哪个阶段

---

## 2. 访问与导航

- **URL**: `/admin/analytics`
- **导航栏**: NineScrolls Admin → Analytics
- **权限**: 需要管理员身份登录

顶部导航还包含 Articles、New Article、Orders、RFQs 等其他管理功能入口。

---

## 3. 日期范围筛选

页面顶部提供 6 种日期范围选项：

| 选项 | 说明 |
|------|------|
| **Today** | 今天 0:00 至现在 |
| **Yesterday** | 昨天 0:00 至今天 0:00 |
| **Last 7 Days** | 过去 7 天（默认） |
| **Last 30 Days** | 过去 30 天 |
| **All Time** | 全部历史数据 |
| **Custom** | 自定义起止日期（出现日期选择器） |

选择日期范围后，页面所有数据（KPI、地图、图表、组织列表）同步刷新。

---

## 4. 控制开关

日期范围下方有三个控制开关：

### 4.1 Bots 开关
- 格式：`Bots (N)` — N 为被识别为机器人的事件数
- **关闭**（默认）：过滤掉所有机器人流量（Google Bot、Bing Bot、Ahrefs、Semrush 等）
- **开启**：显示包含机器人在内的全部流量

### 4.2 Hide Me 开关
- 格式：`Hide Me (N)` — N 为被排除的自身事件数
- **开启**（默认）：排除管理员自身的全部访问记录
- 排除范围包括管理员的 visitorId 所属的整个组织，避免同一公司网络下的重复计数
- 基于浏览器 `localStorage` 中的 `ns_visitor_id` 识别

### 4.3 Auto 30s 开关
- **开启**：每 30 秒自动在后台刷新数据
- 刷新过程不阻塞界面，适合实时监控场景
- 旁边的 ↻ 按钮可手动触发即时刷新

---

## 5. KPI 指标卡片

页面展示一组可点击的统计卡片，点击任意卡片可筛选下方组织列表：

| 卡片 | 含义 | 筛选逻辑 |
|------|------|----------|
| **Unique Visitors** | 唯一访客组织数 | 取消筛选（显示全部） |
| **Target Customers** | 被识别为目标客户的组织数 | 仅显示目标客户 |
| **Universities / Labs** | 大学和研究机构数量 | 仅显示 university / research_institute |
| **Companies** | 企业客户数量 | 仅显示 enterprise 类型 |
| **Hot Leads (A)** | A 级热门线索数量 | 仅显示 Tier A |
| **Returning Visitors** | 有回访记录的组织数 | 仅显示有回访的组织 |
| **Anonymous Intent** | 未识别但行为意向强的访客 | 仅显示匿名高意向（条件见第 17 节） |

**交互说明**：
- 点击卡片高亮选中，组织列表自动过滤
- 再次点击同一卡片取消筛选
- Unique Visitors 卡片还显示与上一时段的增长趋势（如 "+13% vs prev"）
- Anonymous Intent 卡片仅在数量 > 0 时显示

---

## 6. 访客地图

KPI 卡片下方是交互式世界地图（基于 react-simple-maps）。

**标记点说明**：
- 每个圆点代表一个有地理坐标的访客组织
- **大小**：与事件数量成正比（最小 4px，最大 12px）
- **颜色**：按分级着色
  - 绿色：Tier A
  - 橙色：Tier B
  - 灰色：Tier C
  - 浅蓝色：未分级

**交互**：
- **悬停**：显示工具提示（组织名、位置、分级、事件数、是否目标客户）
- **点击**：打开该组织的详细情报面板

---

## 7. 趋势图表

地图下方的可折叠 **Trends** 区域包含 4 个图表标签页：

### 7.1 Daily Visitors（折线图）
- 展示每日唯一访客数的时间趋势
- X 轴：日期（MM/DD 格式）
- Y 轴：访客数量

### 7.2 Target Customers（面积图）
- 对比每日全部访客数与目标客户数
- 浅蓝色面积：全部访客
- 绿色面积：目标客户
- 用于观察目标客户在总流量中的占比趋势

### 7.3 Score Distribution（柱状图）
- 展示所有组织的行为评分分布
- X 轴：评分区间（0.0, 0.1, 0.2, ... 0.9）
- Y 轴：组织数量
- **支持 Drill-Down**：点击任意柱体，自动将该评分区间设为筛选条件，并展开筛选栏

### 7.4 Traffic Channels（堆叠面积图）
- 展示各流量渠道随时间的访客分布
- 渠道颜色：
  - 红色：Paid Search
  - 绿色：Organic Search
  - 橙色：Paid Social
  - 蓝色：Organic Social
  - 紫色：Email
  - 青色：Referral
  - 灰色：Direct
- **支持 Drill-Down**：点击任意渠道区域，自动设为渠道筛选条件
- 激活筛选时，被选中渠道高亮（opacity 0.9），其余渠道淡化（opacity 0.15）

---

## 8. 搜索关键词

可折叠的 **Search Keywords** 区域，标题右侧显示关键词总数。

### 8.1 来源分类标签
- **All**：全部关键词
- **External**：来自搜索引擎的关键词（Organic + Paid）
- **Internal**：站内搜索关键词

### 8.2 Top 10 柱状图
- 水平柱状图展示出现频率最高的 10 个关键词
- 柱体颜色区分来源：绿色=Organic，红色=Paid，紫色=Internal

### 8.3 关键词明细表
| 列 | 说明 |
|----|------|
| **Keyword** | 搜索词 |
| **Count** | 出现次数 |
| **Source** | 来源标签（Organic / Paid / Internal） |
| **Engine / Page** | 搜索引擎名称或 "Site Search" |
| **Organizations** | 使用该关键词的组织（可点击跳转详情） |
| **Last Seen** | 最后搜索时间 |

**关键词来源**：
- **Organic/Paid**：从 referrer URL 或 UTM 参数中提取
- **Internal**：来自站内搜索事件（`eventType='search'`）
- 支持 Google、Bing、Yahoo、Baidu、Yandex、DuckDuckGo 等 10+ 搜索引擎

---

## 9. 页面分析

可折叠的 **Page Analytics** 区域包含三个标签页：

### 9.1 Top Pages
热门页面访问排行。

| 列 | 说明 |
|----|------|
| **Page** | 页面路径 |
| **Title** | 页面标题 |
| **Views** | 页面浏览量 |
| **Visitors** | 唯一访客数 |
| **Avg Time** | 平均活跃停留时间 |
| **Organizations** | 访问组织（可点击） |

产品页面以蓝色高亮标注，最多展示前 50 个页面。

### 9.2 Products
产品页面专项分析，以卡片网格形式展示。

每张卡片包含：
- 产品名称和路径
- Views / Visitors / PDF Downloads / RFQs 指标
- **转化率**：(PDF 下载 + 表单提交) / 唯一访客
  - 绿色柱：≥ 10%
  - 橙色柱：≥ 5%
  - 灰色柱：< 5%
- 平均停留时间

### 9.3 Landing Pages
着陆页分析。

| 列 | 说明 |
|----|------|
| **Landing Page** | 着陆路径（会话首页） |
| **Landings** | 会话数 |
| **Top Source** | 主要流量渠道（色标标签） |
| **Avg Depth** | 平均页面深度（页/会话） |
| **Bounce Rate** | 跳出率（仅 1 页的会话占比），带颜色指示 |

跳出率颜色：绿色 < 40%，橙色 < 60%，红色 ≥ 60%。

---

## 10. 增强筛选栏

位于搜索框下方，支持折叠/展开，用于精细化筛选组织列表。

### 10.1 筛选维度

| 筛选器 | 选项 |
|--------|------|
| **Channel** | All / Paid Search / Organic Search / Paid Social / Organic Social / Email / Referral / Direct |
| **Region** | All / 动态列出所有出现过的国家 |
| **Score** | Min – Max（数值输入，范围 0-1） |
| **Lifecycle** | All / Awareness / Interest / Consideration / Intent |

### 10.2 折叠行为
- 点击 **▼ Filters** 标题可折叠/展开筛选栏
- **折叠时**显示：
  - 蓝色数字 badge：当前激活的筛选器数量
  - 文字摘要：如 "Paid Search · US" 或 "Score 0.1–0.2"（桌面端显示，移动端隐藏）
- **Clear all** 按钮：一键重置所有筛选器（有激活筛选时才出现）

### 10.3 图表联动（Drill-Down）
- 在 Traffic Channels 图表点击某渠道 → Channel 筛选器自动设置，筛选栏自动展开
- 在 Score Distribution 图表点击某柱体 → Score Min/Max 自动设置，筛选栏自动展开

---

## 11. 组织列表

**Visitor Organizations** 表格展示所有匹配当前筛选条件的访客组织。

### 11.1 列说明（全部支持排序）

| 列 | 说明 | 默认排序 |
|----|------|----------|
| **Organization** | 组织名称（ISP 访客显示 "ISP · ID: xxxx"） | — |
| **Type** | 类型标签：university / enterprise / research_institute / unknown | — |
| **Location** | 城市, 地区, 国家 | — |
| **Products** | 访问过的产品名称 | — |
| **Pages** | 唯一页面浏览数 | — |
| **Active Time** | 活跃停留时间（如 "2h 34m"），0 时显示 "Pending" | — |
| **Events** | 总事件数 | — |
| **Tier** | 分级 A / B / C / Intent / N/A | — |
| **Confidence** | 识别置信度（百分比） | — |
| **Last Visit** | 最后访问（相对时间，如 "2h ago"） | ✓（降序） |

### 11.2 排序与交互
- 点击列标题排序，再次点击切换升序/降序
- 排序指示：▼（降序）/ ▲（升序）
- 表格行左侧边框按 Tier 着色（A=绿, B=橙, C=灰, Intent=紫）
- 目标客户行有特殊高亮背景
- **点击任意行**打开组织详情面板

### 11.3 搜索
- 输入框支持实时搜索，匹配范围：组织名、类型、城市、国家、产品名
- 不区分大小写

---

## 12. 组织详情（Intelligence Dossier）

点击组织行或地图标记，展开完整情报面板。

### 12.1 标题栏
- 组织名称（大标题）
- 类型标签、地理位置
- **Tier 标签**：A / B / C
- **Lifecycle 标签**：awareness / interest / consideration / intent
- IP 地址（默认脱敏 `X.X.***.Y`，点击显示完整 IP）
- ISP 名称、Visitor ID

右侧显示 **Confidence** 置信度百分比。

### 12.2 概览卡片（6 项）
| 卡片 | 说明 |
|------|------|
| First Seen | 首次出现日期 |
| Last Seen | 最后活跃（相对时间） |
| Total Events | 总事件数 |
| Pages Viewed | 唯一页面数 |
| Active Time | 活跃停留总时长 |
| Return Visits | 回访天数 |

### 12.3 行为分析
- **行为评分进度条**：0-100%，紫色高亮 ≥ 30%
- **行为信号标签**（彩色 pill 标签）：
  - 🔴 "Target Customer Identified"
  - 🔴 "Downloaded PDF / Spec Sheet"
  - 🔴 "Visited Contact Page"
  - 🔴 "Submitted Contact Form"
  - 🟠 "Viewed N product pages — comparing solutions"（≥ 3 产品页）
  - 🟠 "Returning visitor (N return visits)"（≥ 3 次回访）
  - 🔵 "Products of interest: [名称]"
  - 🔵 "N PDF download(s)"
  - 🟣 "Unknown company with high purchase intent..."（匿名高意向）

### 12.4 检测详情
- **分类来源标签**：Manual Override / AI Classified / Keyword Match / Behavior-based / Unclassified
- **IP vs AI 对比**（双列布局）：
  - 左列：IP Lookup 置信度与类型
  - 中间：升级指示（↑ Upgraded / ✓ Confirmed）
  - 右列：AI Classification 置信度与类型
- **AI 理由**：AI 分类的详细推理文本
- **最终结果**：综合置信度、类型、是否目标客户

### 12.5 分类覆写
手动调整组织的目标客户状态：
- **Mark as Target** / **Mark as Not Target** 按钮
- **Undo Override** 按钮（撤销手动覆写，恢复自动分类）
- 覆写冲突提示：当手动与 AI 分类不一致时显示警告

### 12.6 访问页面列表
- 展示该组织访问过的所有页面及访问次数
- 按频率降序排列

### 12.7 流量来源
- 彩色渠道标签 + 来源域名 + 访问次数
- 按访问次数降序排列

### 12.8 访问时间线
- 按日期分组，每个事件显示：
  - 时间戳（HH:MM:SS）
  - 事件类型标签（page_view / product_view / pdf_download 等）
  - 页面路径或产品名
  - 页面停留详情（active / idle / hidden 时长，final/partial 标签）
  - 流量来源标签（仅入口事件显示）
  - 搜索关键词标签（如有）
- 多访客组织会分别列出每个 Visitor 的时间线

---

## 13. 行为评分系统

系统自动追踪访客行为信号，计算 0-1 之间的行为评分。

### 13.1 评分维度与权重

| 信号 | 最高贡献 | 条件 |
|------|----------|------|
| **产品页浏览** | +0.15 | ≥2 个产品页 +0.15；1 个 +0.05 |
| **高价值页面** | +0.20 | 浏览高价值产品（HY-20L / HY-20LRF / Compact-RIE） |
| **停留时间** | +0.10 | >90s +0.10；>30s +0.05 |
| **PDF 下载** | +0.20 | 每次 +0.10，上限 +0.20 |
| **回访** | +0.25 | 每个回访日 +0.10，上限 +0.25 |
| **流量意向** | +0.10 | 来自 Paid Search / Paid Social / Organic Search |
| **表单互动** | +0.20 | RFQ 表单权重 0.20，Contact 表单权重 0.15，按填充率加权 |
| **内容深度** | +0.10 | 滚动深度 × 页面权重（产品页 0.06，其他 0.04） |
| **综合参与奖励** | +0.05 | 滚动深度 ≥ 50% 且 停留时间 ≥ 60s |

**总分上限**：1.0

### 13.2 信号衰减机制

所有信号按时间自动衰减，防止过时行为主导评分：

| 信号年龄 | 衰减系数 |
|----------|----------|
| 0-3 天 | 1.0（全权重） |
| 3-7 天 | 0.5（半权重） |
| 7-14 天 | 0.25（四分之一） |
| >14 天 | 0（过期丢弃） |

**例外**：回访天数和流量渠道不受衰减影响（它们本身就是持久信号）。

### 13.3 表单生命周期追踪

系统追踪两种表单（Contact Form 和 RFQ Form）的完整生命周期：

| 阶段 | 触发时机 | 说明 |
|------|----------|------|
| **form_started** | 用户首次填写任意字段 | 每种表单在信号窗口内去重一次 |
| **form_interaction** | 字段填充进度变化 | 记录 fieldsEngaged / totalFields |
| **form_completed** | 表单成功提交 | 用于 lifecycle intent 判定 |
| **form_abandoned** | 组件卸载（离开页面） | 仅在 started 但未 completed 时记录，包含 fieldsEngaged/totalFields |

表单放弃数据帮助产品团队分析用户在哪个步骤流失。

---

## 14. 客户分级系统

### 14.1 置信度计算

系统综合 IP 查询和行为评分计算最终置信度：

| 场景 | 权重策略 |
|------|----------|
| 首次访问的高置信目标组织（IP ≥ 0.5, 已知类型） | 直接使用 IP 置信度 |
| ISP/未知组织但有行为数据 | 直接使用行为评分 |
| 回访者有行为数据 | IP × 0.4 + 行为 × 0.6 |
| 无 IP 分析 | 仅使用行为评分 |

**AI 增强**：当 AI 置信度 > 后端置信度且方向一致时，可升级最终置信度。

### 14.2 目标客户判定

- **标准阈值**：finalConfidence > 0.3
- **宽松阈值**：finalConfidence > 0.25（针对高置信度的 university/research/enterprise 类型）
- **否决条件**：IP 查询明确拒绝（confidence = 0）时永不标记为目标

### 14.3 Tier 分级

仅目标客户会被分配 Tier：

| 等级 | 条件 |
|------|------|
| **Tier A** | 研究/大学且置信度 ≥ 0.7，或任意类型置信度 ≥ 0.9 |
| **Tier B** | 置信度 ≥ 0.5 且类型非 unknown |
| **Tier C** | 默认（置信度 ≥ 0.3 的目标客户） |

### 14.4 行为 Tier 升级（Boost）

在初始 Tier 基础上，系统检查 5 个行为交叉验证信号：

1. 有表单互动（formInteractions > 0）
2. 下载 ≥ 2 个 PDF
3. ≥ 2 次回访
4. 处于 consideration 或 intent 阶段
5. 浏览 ≥ 3 个产品页

**升级规则**：
- **C → B**：满足 2+ 个信号
- **B → A**：满足 3+ 个信号 **且** 置信度 ≥ 0.6

---

## 15. 生命周期阶段

系统自动将访客行为映射到 4 个生命周期阶段：

| 阶段 | 英文 | 触发条件 | 含义 |
|------|------|----------|------|
| 1 | **Awareness** | 默认 | 初次接触，仅浏览 |
| 2 | **Interest** | 回访 或 浏览产品页 | 表现出兴趣 |
| 3 | **Consideration** | 下载 PDF 或 有表单互动 | 正在评估 |
| 4 | **Intent** | RFQ 填充率 ≥ 70% 或 任意表单已提交 | 有明确采购意向 |

阶段判定从高到低优先匹配（先检查 intent，最后 fallback 到 awareness）。

在组织详情页和组织列表中，lifecycle 以彩色 badge 展示：
- awareness：灰色
- interest：蓝色
- consideration：橙色
- intent：绿色

---

## 16. 流量渠道识别

系统自动对每个访客的流量来源进行分类：

| 渠道 | 识别条件 |
|------|----------|
| **Paid Search** | URL 含 gclid / msclkid / gadSource，或 utm_medium=cpc/ppc |
| **Organic Search** | Referrer 来自 Google/Bing/Yahoo/Baidu/DuckDuckGo 等（无付费标记） |
| **Paid Social** | 付费 medium + 社交平台 referrer |
| **Organic Social** | Referrer 来自 Facebook/Instagram/Twitter/LinkedIn/YouTube/TikTok 等 |
| **Email** | utm_medium=email 或 utm_source=email |
| **Referral** | 有 referrer 或 utm_source 但不属于以上类别 |
| **Direct** | 无 referrer 且无 utm_source |

支持的搜索引擎：Google、Bing、Yahoo、Baidu、Yandex、DuckDuckGo、Ecosia、Ask、Naver、Sogou。

---

## 17. 匿名高意向检测

当访客组织未被识别为目标客户，但展现出强烈购买意向时，系统会将其标记为 **Anonymous Intent**。

**触发条件**（必须同时满足）：

1. **未被识别**：
   - 不是自动检测的目标客户
   - 未被 AI 识别为真实组织
   - 无 Tier 分配

2. **强行为信号**（满足任一）：
   - 行为评分 ≥ 0.3 且（有回访 或 浏览 ≥ 2 个页面）
   - 行为评分 ≥ 0.1 且浏览过产品页

**在仪表板中的展示**：
- KPI 卡片区出现 **Anonymous Intent** 卡片（紫色，仅数量 > 0 时显示）
- 组织列表 Tier 列显示 "Intent"（紫色标签）
- 可通过手动 Override 将匿名高意向访客标记为目标客户

---

## 18. 数据导出

### 18.1 CSV 导出
- 点击 **Export CSV** 按钮
- 导出当前筛选和排序后的全部组织数据
- 文件名格式：`analytics-[dateRange]-[YYYY-MM-DD].csv`
- 包含列：Organization, Type, Location, Products, Pages, Active Time (s), Events, Tier, Confidence, Last Visit

### 18.2 手动分类覆写
通过组织详情面板中的 "Mark as Target" / "Mark as Not Target" 按钮，可手动覆写系统的自动分类。覆写记录持久化存储，支持 "Undo Override" 撤销。

---

## 19. 技术架构概览

### 19.1 数据采集层
- **客户端**：浏览器中的 Segment Analytics.js + 自定义行为追踪
- **服务端降级**：当 Segment 被广告拦截器阻止时（4s 超时），自动降级到 `/d` 端点
- **去重**：通过 anonymousId + 时间戳邻近度去重

### 19.2 事件类型
| 事件 | 说明 |
|------|------|
| `page_view` | 页面浏览 |
| `page_time_flush` | 页面卸载时的精确停留时间（active/idle/hidden） |
| `product_view` | 产品页浏览 |
| `pdf_download` | PDF 下载 |
| `contact_form` | 联系表单提交 |
| `search` | 站内搜索 |
| `target_customer` | 目标客户检测事件 |
| `add_to_cart` | 加入购物车 |
| `rfq_step` | RFQ 表单步骤 |

### 19.3 数据存储
- **DynamoDB** 通过 AWS Amplify Data（GraphQL API）
- **索引**：按事件类型+时间戳、sessionId+时间戳、visitorId+时间戳
- **客户端缓存**：行为信号存储在 `localStorage`（key: `ninescrolls_behavior_signals`），14 天窗口

### 19.4 数据处理流水线
```
访客浏览 → IP 查询 → AI 分类（异步） → 行为评分计算
    → 置信度综合 → 目标客户判定 → Tier 分级 → Tier Boost
    → 事件写入 DynamoDB
```

### 19.5 停留时间计算
采用 **"Final-preferred, MAX fallback"** 策略：
1. 优先使用标记为 `final=true` 的 `page_time_flush` 事件
2. 同等 finality 下取最大 activeSeconds
3. 防止延迟的 partial flush 覆盖正确的 final flush
4. 无 flush 事件时回退到 legacy timeOnSite 快照

### 19.6 ISP 访客处理
- ISP 组织（如 Comcast、AT&T）按个体 IP/visitorId 拆分，避免将无关住宅用户混合
- 显示名格式：`"ISP 名 · 城市, 地区"`
- 同名 ISP 访客用 #2, #3 后缀区分

---

## 附录：常用操作速查

| 场景 | 操作 |
|------|------|
| 查看今日热门线索 | Today → Hot Leads (A) 卡片 |
| 找到某大学的访问记录 | 搜索框输入大学名 → 点击行 |
| 分析 Paid Search 效果 | Trends → Traffic Channels → 点击 Paid Search 区域 |
| 导出目标客户列表 | Target Customers 卡片 → Export CSV |
| 手动标记匿名访客为目标 | 点击组织行 → Mark as Target |
| 查看某产品的转化率 | Page Analytics → Products 标签 |
| 监控实时流量 | 开启 Auto 30s |
| 筛选高评分组织 | Filters → Score: 0.5 – 1.0 |
| 查看表单放弃情况 | 组织详情 → 时间线中查找 form_abandoned 事件 |
| 按地区筛选 | Filters → Region 下拉选择国家 |
