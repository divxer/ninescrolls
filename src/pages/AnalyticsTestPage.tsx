import React, { useEffect } from 'react';
import { useAnalytics } from '../components/analytics/GoogleAnalytics';
import { analytics } from '../services/analytics';

export const AnalyticsTestPage: React.FC = () => {
  const analyticsHook = useAnalytics();

  useEffect(() => {
    // 测试页面加载时的事件
    console.log('Analytics Test Page loaded');
    analyticsHook.trackCustomEvent('page_view', {
      page_name: 'analytics_test',
      page_title: 'Analytics Test Page'
    });
  }, [analyticsHook]);

  const testEvents = () => {
    // 测试各种事件
    analyticsHook.trackProductView('test-product-123', 'Test Product');
    analyticsHook.trackProductDownload('test-product-123', 'Test Product');
    analyticsHook.trackContactFormSubmit('test-product-123', 'Test Product');
    analyticsHook.trackSearch('test search term');
    
    console.log('Test events sent to GA4');
  };

  const testCustomEvent = () => {
    analyticsHook.trackCustomEvent('button_click', {
      button_name: 'test_button',
      page_location: 'analytics_test_page',
      timestamp: new Date().toISOString()
    });
    
    console.log('Custom event sent to GA4');
  };

  const testUserIdentification = () => {
    analyticsHook.identifyUser('test-user-123', {
      email: 'test@example.com',
      name: 'Test User',
      user_type: 'tester'
    });
    
    console.log('User identification sent to GA4');
  };

  return (
    <div className="container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Google Analytics 4 测试页面</h1>
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '2rem' 
      }}>
        <h3>配置信息</h3>
        <p><strong>GA4 测量 ID:</strong> {import.meta.env.VITE_GA_MEASUREMENT_ID || '未配置'}</p>
        <p><strong>环境:</strong> {import.meta.env.MODE}</p>
        <p><strong>页面 URL:</strong> {window.location.href}</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>测试事件</h3>
        <p>点击下面的按钮来测试各种 GA4 事件。打开浏览器开发者工具查看控制台输出。</p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button 
            onClick={testEvents}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            测试所有事件
          </button>
          
          <button 
            onClick={testCustomEvent}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            测试自定义事件
          </button>
          
          <button 
            onClick={testUserIdentification}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffc107',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            测试用户识别
          </button>
        </div>
      </div>

      <div style={{ 
        background: '#e7f3ff', 
        padding: '1rem', 
        borderRadius: '8px',
        border: '1px solid #b3d9ff'
      }}>
        <h3>验证步骤</h3>
        <ol>
          <li>打开浏览器开发者工具 (F12)</li>
          <li>查看控制台是否显示 "Google Analytics 4 initialized"</li>
          <li>在 Network 标签中搜索 "googletagmanager.com" 的请求</li>
          <li>点击上面的测试按钮</li>
          <li>在 GA4 的 DebugView 中查看实时事件</li>
        </ol>
      </div>

      <div style={{ 
        background: '#fff3cd', 
        padding: '1rem', 
        borderRadius: '8px',
        border: '1px solid #ffeaa7',
        marginTop: '2rem'
      }}>
        <h3>GA4 DebugView 设置</h3>
        <p>要在 GA4 中实时查看事件：</p>
        <ol>
          <li>登录 <a href="https://analytics.google.com/" target="_blank" rel="noopener">Google Analytics</a></li>
          <li>进入你的媒体资源</li>
          <li>点击左下角的齿轮图标 (管理)</li>
          <li>在"数据流"中选择你的网站</li>
          <li>点击"调试视图"</li>
          <li>在调试模式下刷新此页面</li>
        </ol>
      </div>
    </div>
  );
}; 