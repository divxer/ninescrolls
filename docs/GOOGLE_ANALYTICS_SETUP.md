# Google Analytics 4 设置指南

## 概述

本项目已集成 Google Analytics 4 (GA4) 用于网站访问统计。GA4 提供了强大的分析功能，包括用户行为跟踪、转化分析、实时数据等。

## 设置步骤

### 1. 创建 Google Analytics 4 账户

1. 访问 [Google Analytics](https://analytics.google.com/)
2. 点击"开始衡量"
3. 创建账户和媒体资源
4. 选择"网站"作为平台
5. 填写网站信息

### 2. 获取测量 ID

1. 在 GA4 中，进入"管理" > "数据流"
2. 选择你的网站数据流
3. 复制测量 ID（格式：G-XXXXXXXXXX）

### 3. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# Google Analytics 4 Configuration
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**重要：** 将 `G-XXXXXXXXXX` 替换为你的实际测量 ID。

### 4. 验证安装

1. 启动开发服务器：`npm run dev`
2. 打开浏览器开发者工具
3. 在控制台中应该看到 "Google Analytics 4 initialized"
4. 在 Network 标签中应该看到对 `googletagmanager.com` 的请求

## 功能特性

### 自动跟踪

- **页面浏览**：自动跟踪所有页面访问
- **用户会话**：自动跟踪用户会话和停留时间

### 手动跟踪

#### 产品相关事件

```typescript
import { useAnalytics } from './components/analytics/GoogleAnalytics';

const analytics = useAnalytics();

// 跟踪产品查看
analytics.trackProductView('product-123', 'Product Name');

// 跟踪产品下载
analytics.trackProductDownload('product-123', 'Product Name');

// 跟踪数据表下载
analytics.trackDatasheetDownload('product-123', 'Product Name');
```

#### 表单和交互事件

```typescript
// 跟踪联系表单提交
analytics.trackContactFormSubmit('product-123', 'Product Name');

// 跟踪搜索
analytics.trackSearch('search term');

// 跟踪自定义事件
analytics.trackCustomEvent('button_click', {
  button_name: 'download_button',
  page_location: 'product_page'
});
```

#### 用户识别

```typescript
// 识别用户（登录后调用）
analytics.identifyUser('user-123', {
  email: 'user@example.com',
  name: 'John Doe'
});
```

## 在组件中使用

### 使用 Hook

```typescript
import React from 'react';
import { useAnalytics } from './components/analytics/GoogleAnalytics';

const ProductComponent: React.FC = () => {
  const analytics = useAnalytics();

  const handleDownload = () => {
    analytics.trackProductDownload('product-123', 'Sample Product');
    // 执行下载逻辑
  };

  return (
    <button onClick={handleDownload}>
      Download Product
    </button>
  );
};
```

### 直接使用服务

```typescript
import { analytics } from './services/analytics';

// 在任何地方直接调用
analytics.trackEvent({
  category: 'Product',
  action: 'View',
  label: 'Product Name',
  productId: 'product-123'
});
```

## GA4 事件类型

### 标准事件

- `page_view` - 页面浏览
- `view_item` - 产品查看
- `file_download` - 文件下载
- `form_submit` - 表单提交
- `search` - 搜索
- `add_to_cart` - 添加到购物车

### 自定义事件

你可以创建任何自定义事件：

```typescript
analytics.trackCustomEvent('video_play', {
  video_title: 'Product Demo',
  video_duration: 120
});
```

## 数据查看

### 实时数据

1. 登录 Google Analytics
2. 进入"报告" > "实时"
3. 查看当前活跃用户和事件

### 标准报告

1. **概览**：总体访问量和关键指标
2. **流量获取**：用户来源分析
3. **参与度**：页面浏览和用户行为
4. **转化**：目标完成情况

### 自定义报告

1. 进入"探索"
2. 创建自定义报告
3. 选择维度和指标
4. 设置过滤器和细分

## 隐私和合规

### GDPR 合规

- GA4 默认启用 IP 匿名化
- 提供用户数据删除功能
- 支持 Cookie 同意管理

### Cookie 设置

GA4 使用以下 Cookie：
- `_ga` - 用户识别（2年）
- `_ga_XXXXXXXXXX` - 会话识别（2年）

## 故障排除

### 常见问题

1. **数据不显示**
   - 检查测量 ID 是否正确
   - 确认环境变量已设置
   - 等待 24-48 小时数据更新

2. **事件不跟踪**
   - 检查浏览器控制台错误
   - 确认 GA4 已正确初始化
   - 验证事件参数格式

3. **开发环境问题**
   - 使用 GA4 DebugView 实时查看事件
   - 检查网络请求是否成功

### 调试工具

1. **GA4 DebugView**
   - 在 GA4 中启用调试模式
   - 实时查看事件数据

2. **Google Tag Assistant**
   - 安装浏览器扩展
   - 验证跟踪代码

3. **浏览器开发者工具**
   - 检查 Network 标签中的请求
   - 查看控制台日志

## 最佳实践

1. **事件命名**：使用一致的命名约定
2. **参数标准化**：统一参数名称和格式
3. **测试**：在开发环境充分测试
4. **文档**：记录所有自定义事件
5. **监控**：定期检查数据质量

## 支持

如有问题，请参考：
- [Google Analytics 4 官方文档](https://developers.google.com/analytics/devguides/collection/ga4)
- [GA4 事件参考](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [GA4 参数参考](https://developers.google.com/analytics/devguides/collection/ga4/parameters) 