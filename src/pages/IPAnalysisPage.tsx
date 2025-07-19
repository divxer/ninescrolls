import React, { useState, useEffect } from 'react';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';
import { ipAnalytics, type IPInfo, type TargetCustomerAnalysis } from '../services/ipAnalytics';

export const IPAnalysisPage: React.FC = () => {
  const analytics = useCombinedAnalytics();
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null);
  const [analysis, setAnalysis] = useState<TargetCustomerAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIPAnalysis();
  }, []);

  const loadIPAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取IP信息和目标客户分析
      const [ipData, analysisData] = await Promise.all([
        ipAnalytics.getIPInfo(),
        ipAnalytics.analyzeTargetCustomer()
      ]);

      setIpInfo(ipData);
      setAnalysis(analysisData);

      // 发送分析事件到Segment
      if (analysisData) {
        analytics.segment.trackWithIPAnalysis('IP Analysis Completed', {
          isTargetCustomer: analysisData.isTargetCustomer,
          organizationType: analysisData.organizationType,
          confidence: analysisData.confidence
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IP analysis');
      console.error('Error loading IP analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const testTargetCustomerEvent = async () => {
    if (analysis) {
      await analytics.segment.trackWithIPAnalysis('Target Customer Test Event', {
        testType: 'manual',
        isTargetCustomer: analysis.isTargetCustomer,
        organizationType: analysis.organizationType
      });
      alert('Target customer test event sent to Segment!');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return '#28a745';
    if (confidence >= 0.4) return '#ffc107';
    return '#dc3545';
  };

  const getTargetCustomerStatus = (analysis: TargetCustomerAnalysis) => {
    if (analysis.isTargetCustomer) {
      return (
        <div style={{ color: '#28a745', fontWeight: 'bold' }}>
          ✓ 目标客户
        </div>
      );
    }
    return (
      <div style={{ color: '#dc3545', fontWeight: 'bold' }}>
        ✗ 非目标客户
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>正在分析IP地址...</h2>
        <p>正在获取您的位置信息和组织类型分析</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>分析失败</h2>
        <p style={{ color: '#dc3545' }}>{error}</p>
        <button onClick={loadIPAnalysis} style={buttonStyle}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>IP地址分析与目标客户识别</h1>
      
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: '1px solid #dee2e6'
      }}>
        <h3>目标客户分析结果</h3>
        {analysis && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>客户状态:</span>
              {getTargetCustomerStatus(analysis)}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <strong>组织类型:</strong> {analysis.details.orgType}
              </div>
              <div>
                <strong>组织名称:</strong> {analysis.details.orgName}
              </div>
              <div>
                <strong>位置:</strong> {analysis.details.location}
              </div>
              <div>
                <strong>置信度:</strong> 
                <span style={{ 
                  color: getConfidenceColor(analysis.confidence),
                  fontWeight: 'bold',
                  marginLeft: '0.5rem'
                }}>
                  {(analysis.confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {analysis.details.keywords.length > 0 && (
              <div>
                <strong>匹配关键词:</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  {analysis.details.keywords.map((keyword, index) => (
                    <span 
                      key={index}
                      style={{
                        background: '#007bff',
                        color: 'white',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        marginRight: '0.5rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {ipInfo && (
        <div style={{ 
          background: '#e7f3ff', 
          padding: '1.5rem', 
          borderRadius: '8px',
          border: '1px solid #b3d9ff',
          marginBottom: '2rem'
        }}>
          <h3>IP地址详细信息</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div><strong>IP地址:</strong> {ipInfo.ip}</div>
            <div><strong>国家:</strong> {ipInfo.country}</div>
            <div><strong>地区:</strong> {ipInfo.region}</div>
            <div><strong>城市:</strong> {ipInfo.city}</div>
            <div><strong>组织:</strong> {ipInfo.org}</div>
            <div><strong>ISP:</strong> {ipInfo.isp}</div>
            <div><strong>时区:</strong> {ipInfo.timezone}</div>
            {ipInfo.latitude && ipInfo.longitude && (
              <div>
                <strong>坐标:</strong> {ipInfo.latitude.toFixed(4)}, {ipInfo.longitude.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ 
        background: '#fff3cd', 
        padding: '1.5rem', 
        borderRadius: '8px',
        border: '1px solid #ffeaa7',
        marginBottom: '2rem'
      }}>
        <h3>测试功能</h3>
        <p>点击下面的按钮来测试目标客户识别功能：</p>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={testTargetCustomerEvent} style={buttonStyle}>
            发送目标客户测试事件
          </button>
          
          <button onClick={loadIPAnalysis} style={buttonStyle}>
            重新分析
          </button>
        </div>
      </div>

      <div style={{ 
        background: '#d1ecf1', 
        padding: '1.5rem', 
        borderRadius: '8px',
        border: '1px solid #bee5eb'
      }}>
        <h3>目标客户识别规则</h3>
        <p>系统会根据以下规则识别目标客户：</p>
        <ul>
          <li><strong>大学/教育机构:</strong> 包含 university, college, school, academy, institute, campus 等关键词</li>
          <li><strong>研究机构:</strong> 包含 research, laboratory, lab, institute, foundation, center 等关键词</li>
          <li><strong>企业:</strong> 包含 corporation, company, inc, ltd, llc, enterprise, business 等关键词</li>
          <li><strong>地理位置加分:</strong> 来自美国、中国、日本、德国、英国、法国、加拿大、澳大利亚、韩国、荷兰等目标国家</li>
        </ul>
        <p><strong>置信度阈值:</strong> 超过30%的置信度即被认为是目标客户</p>
      </div>
    </div>
  );
};

const buttonStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px'
}; 