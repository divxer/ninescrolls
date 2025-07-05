# Google Analytics 4 配置说明

## 🎯 你的 GA4 测量 ID

**G-DPS75RLM8D**

## 📝 配置步骤

### 1. 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# Google Analytics 4 Configuration
VITE_GA_MEASUREMENT_ID=G-DPS75RLM8D

# Tawk.to Configuration (existing)
VITE_TAWK_PROPERTY_ID=your_tawk_property_id
VITE_TAWK_WIDGET_ID=your_tawk_widget_id
```

### 2. 重启开发服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
npm run dev
```

### 3. 测试配置

访问测试页面：http://localhost:5173/analytics-test

## ✅ 验证步骤

1. **检查控制台**
   - 打开浏览器开发者工具 (F12)
   - 查看控制台是否显示 "Google Analytics 4 initialized"

2. **检查网络请求**
   - 在 Network 标签中搜索 "googletagmanager.com"
   - 应该看到对 GA4 的请求

3. **测试事件**
   - 在测试页面点击各种按钮
   - 查看控制台输出

4. **GA4 DebugView**
   - 登录 [Google Analytics](https://analytics.google.com/)
   - 进入你的媒体资源
   - 点击"调试视图"
   - 实时查看事件数据

## 🚀 功能特性

- ✅ 自动页面跟踪
- ✅ 产品事件跟踪
- ✅ 表单提交跟踪
- ✅ 自定义事件支持
- ✅ 用户识别
- ✅ 搜索跟踪

## 📊 查看数据

1. **实时数据**: GA4 > 报告 > 实时
2. **标准报告**: GA4 > 报告 > 概览
3. **自定义报告**: GA4 > 探索

## 🔧 故障排除

如果遇到问题：

1. 确认 `.env.local` 文件已创建
2. 确认测量 ID 正确：`G-DPS75RLM8D`
3. 重启开发服务器
4. 清除浏览器缓存
5. 检查浏览器控制台错误

---

**配置完成后，你的网站将开始收集访问数据！** 🎉 