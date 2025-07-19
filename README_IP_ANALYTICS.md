# IP地址分析与目标客户识别

本文档介绍如何使用IP地址分析功能来识别目标客户。

## 功能概述

通过收集访问者的IP地址和地理位置信息，系统可以自动分析并识别是否为目标客户。目标客户包括：

- **大学/教育机构**: 大学、学院、学校等教育机构
- **研究机构**: 研究所、实验室、研究中心等科研机构  
- **大型企业**: 企业实验室、研发部门等

## 技术实现

### IP信息收集

系统使用多个IP查询服务来提高准确性：

1. **ip-api.com**: 免费服务，提供基本的地理位置信息
2. **ipinfo.io**: 提供详细的组织和ISP信息
3. **ipgeolocation.io**: 提供精确的坐标信息

### 目标客户识别规则

#### 关键词匹配

**大学/教育机构关键词:**
- university, college, school, academy, institute, campus
- 大学, 学院, 学校, 研究所, 研究院, 实验室

**研究机构关键词:**
- research, laboratory, lab, institute, foundation, center
- 研究, 实验室, 研究所, 研究院, 中心, 基金会

**企业关键词:**
- corporation, company, inc, ltd, llc, enterprise, business
- 公司, 企业, 集团, 股份, 有限, 科技

#### 地理位置加分

目标国家和地区：
- 美国、中国、日本、德国、英国、法国、加拿大、澳大利亚、韩国、荷兰

#### 置信度计算

- 基础置信度：根据关键词匹配数量计算
- 地理位置加分：来自目标国家/地区 +10%
- 最终置信度：超过30%即被认为是目标客户

## 使用方法

### 基本用法

```tsx
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';

const analytics = useCombinedAnalytics();

// 发送带IP分析的事件
await analytics.segment.trackWithIPAnalysis('Product Viewed', {
  productId: 'ald-system',
  productName: 'ALD System'
});
```

### 获取IP信息

```tsx
import { ipAnalytics } from '../services/ipAnalytics';

// 获取IP信息
const ipInfo = await ipAnalytics.getIPInfo();
console.log('IP Info:', ipInfo);

// 获取目标客户分析
const analysis = await ipAnalytics.analyzeTargetCustomer();
console.log('Target Customer Analysis:', analysis);
```

### 专用方法

```tsx
// 产品浏览时进行IP分析
await analytics.segment.trackProductViewWithAnalysis('ald-system', 'ALD System');

// 联系表单提交时进行IP分析
await analytics.segment.trackContactFormSubmitWithAnalysis('ald-system', 'ALD System');

// 页面浏览时进行IP分析
await analytics.segment.trackPageViewWithAnalysis('Product Detail', {
  productId: 'ald-system'
});
```

## 数据结构

### IP信息 (IPInfo)

```typescript
interface IPInfo {
  ip: string;           // IP地址
  country: string;      // 国家
  region: string;       // 地区/省份
  city: string;         // 城市
  org: string;          // 组织名称
  isp: string;          // ISP提供商
  timezone: string;     // 时区
  latitude?: number;    // 纬度
  longitude?: number;   // 经度
}
```

### 目标客户分析 (TargetCustomerAnalysis)

```typescript
interface TargetCustomerAnalysis {
  isTargetCustomer: boolean;                    // 是否为目标客户
  organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown';
  confidence: number;                           // 置信度 (0-1)
  details: {
    orgName: string;                            // 组织名称
    orgType: string;                            // 组织类型中文名
    location: string;                           // 位置信息
    keywords: string[];                         // 匹配的关键词
  };
}
```

## Segment事件数据

发送到Segment的事件包含以下额外信息：

```json
{
  "event": "Product Viewed",
  "properties": {
    "productId": "ald-system",
    "productName": "ALD System",
    "ipInfo": {
      "ip": "192.168.1.1",
      "country": "United States",
      "region": "California",
      "city": "San Francisco",
      "org": "Stanford University",
      "isp": "Stanford University",
      "timezone": "America/Los_Angeles",
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "targetCustomerAnalysis": {
      "isTargetCustomer": true,
      "organizationType": "university",
      "confidence": 0.85,
      "orgName": "Stanford University",
      "orgType": "大学/教育机构",
      "location": "San Francisco, California, United States",
      "keywords": ["university"]
    }
  }
}
```

## 目标客户检测事件

当检测到目标客户时，系统会自动发送特殊事件：

```json
{
  "event": "Target Customer Detected",
  "properties": {
    "originalEvent": "Product Viewed",
    "organizationType": "university",
    "confidence": 0.85,
    "orgName": "Stanford University",
    "location": "San Francisco, California, United States"
  }
}
```

## 测试页面

访问 `/ip-analysis` 页面可以：

1. 查看当前IP信息
2. 查看目标客户分析结果
3. 测试IP分析功能
4. 发送测试事件到Segment

## 配置选项

### 自定义目标客户关键词

可以在 `src/services/ipAnalytics.ts` 中修改关键词列表：

```typescript
const universityKeywords = [
  'university', 'college', 'school', 'academy', 'institute', 'campus',
  '大学', '学院', '学校', '研究所', '研究院', '实验室',
  // 添加更多关键词
];
```

### 自定义目标地理位置

```typescript
const targetCountries = [
  'United States', 'China', 'Japan', 'Germany', 'United Kingdom', 
  'France', 'Canada', 'Australia', 'South Korea', 'Netherlands',
  // 添加更多国家
];
```

### 调整置信度阈值

```typescript
// 在 performAnalysis 方法中修改
return {
  isTargetCustomer: confidence > 0.3, // 修改这个阈值
  // ...
};
```

## 隐私考虑

1. **IP地址收集**: 仅用于分析目标客户，不会存储个人身份信息
2. **地理位置**: 仅精确到城市级别，不会收集精确地址
3. **组织信息**: 仅用于识别组织类型，不会收集具体部门或个人信息
4. **数据保留**: IP信息仅在会话期间临时使用，不会长期存储

## 故障排除

### 常见问题

1. **IP信息获取失败**
   - 检查网络连接
   - 确认IP查询服务可用性
   - 查看浏览器控制台错误信息

2. **目标客户识别不准确**
   - 检查组织名称是否包含关键词
   - 确认地理位置是否在目标范围内
   - 调整关键词列表或置信度阈值

3. **Segment事件未发送**
   - 检查Segment配置
   - 确认网络连接
   - 查看浏览器控制台日志

### 调试方法

1. 打开浏览器开发者工具
2. 查看控制台日志
3. 检查Network标签中的API请求
4. 使用 `/ip-analysis` 页面进行测试

## 最佳实践

1. **渐进式实施**: 先在测试环境验证功能
2. **监控数据质量**: 定期检查IP信息的准确性
3. **优化关键词**: 根据实际数据调整关键词列表
4. **保护隐私**: 确保符合数据保护法规
5. **性能优化**: 缓存IP信息避免重复查询 