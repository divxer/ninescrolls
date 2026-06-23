# NineScrolls UTM 命名规范

> 内部营销运营文档。所有带追踪的链接（二维码、邮件、合作伙伴链接、社媒帖子等）都按此表填写 UTM 参数，保证 GA4（`G-DPS75RLM8D`）和 Segment 里的报表口径一致、可对账。

## 铁律（先记这几条）

1. **全部小写**，单词间用下划线 `_`，不要空格、不要大写、不要中文。
   - ✅ `webinar_sponsor`  ❌ `Webinar Sponsor` / `webinarSponsor`
2. **`utm_medium` 必须从下面的固定清单里选**——它决定 GA4 的默认渠道分组（Channel Grouping）。乱填会让流量掉进 "Unassigned"。
3. **`utm_source` / `utm_campaign` 可以自定义**，但要前后一致（同一个合作方永远用同一个 source 写法）。
4. `utm_campaign` 一律带月份：`主题_yyyymm`，方便排序和复盘。
5. 改完链接，**先用手机自测扫一次**，确认 GA4 实时报告里出现，再批量印刷。

---

## 1. `utm_medium`（渠道类型）— 固定清单，只能选这些

| 值 | 用于 | GA4 归类到 |
|---|---|---|
| `qr` | 所有二维码（视频、宣传册、名片、展台海报） | Referral / 自定义 |
| `email` | 邮件正文、邮件签名里的链接 | Email |
| `webinar_sponsor` | 赞助的网络研讨会 / 线上活动 | Referral |
| `social` | 自然社媒帖子（LinkedIn、X 等，非投放） | Organic Social |
| `paid_social` | 付费社媒广告 | Paid Social |
| `cpc` | 付费搜索广告（Google/Bing Ads，手动标） | Paid Search |
| `referral` | 合作伙伴网站、行业目录、外链 | Referral |
| `print` | 纸质材料里印的网址（非二维码，手输场景） | Referral |
| `partner` | 经销商 / 渠道伙伴分发的链接 | Referral |

> 想新增一类渠道，先在这张表里登记一个值，全员用同一个，别临时造词。

## 2. `utm_source`（具体来源 / 平台 / 合作方）

写**谁**把流量带来的——具体到平台名或合作方名。

| 场景 | source 写法 |
|---|---|
| MRS 赞助活动 | `mrs` |
| LinkedIn | `linkedin` |
| Google Ads | `google` |
| Bing Ads | `bing` |
| 微信 / 公众号 | `wechat` |
| 自家邮件列表 | `newsletter` |
| 某经销商（举例） | `distributor_xyz` |
| 展会（举例 MRS Fall 展台） | `mrs_fall_booth` |

## 3. `utm_campaign`（活动标签）— 格式 `主题_yyyymm`

| 例子 | 含义 |
|---|---|
| `mxenes_oct2026` | MXenes 主题，2026年10月 |
| `mxenes_202610` | 同上（数字月份写法，二选一，全公司统一） |
| `pluto_launch_202603` | Pluto 产品发布活动 |

> **二选一并固定**：`oct2026` 还是 `202610`。建议用 `202610`（纯数字便于排序）。本文档示例统一用数字写法。

## 4. `utm_content`（同一活动内的不同物料 / 变体）

区分"同一个 campaign 下，从哪个具体物料来的"。

| 值 | 用于 |
|---|---|
| `qr_video` | 视频里的二维码 |
| `qr_brochure` | 宣传册二维码 |
| `qr_card` | 名片二维码 |
| `qr_poster` | 展台海报二维码 |
| `cta_top` / `cta_footer` | 邮件里顶部 / 底部按钮 |

## 5. `utm_term`（仅付费搜索关键词，可留空）

只在 `cpc` 投放时填投放关键词，如 `utm_term=mxene_supplier`。二维码 / 邮件场景**留空**。

---

## 拼装示例

**MRS 赞助 — 视频二维码：**
```
https://ninescrolls.com/?utm_source=mrs&utm_medium=webinar_sponsor&utm_campaign=mxenes_202610&utm_content=qr_video
```

**MRS 赞助 — 宣传册二维码：**
```
https://ninescrolls.com/?utm_source=mrs&utm_medium=webinar_sponsor&utm_campaign=mxenes_202610&utm_content=qr_brochure
```

**自家月度邮件 — 底部按钮：**
```
https://ninescrolls.com/?utm_source=newsletter&utm_medium=email&utm_campaign=mxenes_202610&utm_content=cta_footer
```

---

## 报表去哪看（重要）

| 想看 | 去哪 | 字段名 |
|---|---|---|
| 完整 source/medium/campaign/content | **GA4（G-DPS75RLM8D）** → 报告 → 获取 → 流量获取 | 会话来源/媒介、广告系列 |
| 同样数据（服务端） | Segment 目的地 | `context.campaign.{source, medium, name, content, term}`（注意 campaign → `name`） |
| 自研管理后台（AdminAnalyticsPage） | ✅ 访客时间线每个事件显示来源徽章 `source · campaign · content`（悬停看完整 5 个 UTM） | `utmSource/utmMedium/utmCampaign/utmContent/utmTerm` |

> 自研后台的完整 UTM 支持已上线（PR #199）：`AnalyticsEvent` 落库 `utmSource/utmMedium/utmCampaign/utmContent`，Lambda 从 `context.campaign` 抽取，管理页时间线渲染徽章。**仅对部署后的新流量生效，历史记录不回填。**

## 命名速查（一句话）

```
source  = 谁带来的（平台/合作方）         小写
medium  = 什么渠道类型（固定清单里选）     小写
campaign= 主题_yyyymm                     小写+数字月份
content = 哪个具体物料/变体               小写
term    = 付费关键词（非付费留空）
```
