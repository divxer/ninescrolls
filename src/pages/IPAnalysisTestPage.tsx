import React, { useState } from 'react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { ipAnalytics, type IPInfo, type TargetCustomerAnalysis } from '../services/ipAnalytics';
import { simpleIPAnalytics, type SimpleIPInfo, type SimpleTargetCustomerAnalysis } from '../services/simpleIPAnalytics';
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';

export const IPAnalysisTestPage: React.FC = () => {
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null);
  const [analysis, setAnalysis] = useState<TargetCustomerAnalysis | null>(null);
  const [simpleIpInfo, setSimpleIpInfo] = useState<SimpleIPInfo | null>(null);
  const [simpleAnalysis, setSimpleAnalysis] = useState<SimpleTargetCustomerAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analytics = useCombinedAnalytics();

  // Scroll to top when component mounts
  useScrollToTop();

  const testIPAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Testing IP Analysis...');
      
      // Test full IP analysis
      const ipData = await ipAnalytics.getIPInfo();
      const analysisData = await ipAnalytics.analyzeTargetCustomer();
      
      setIpInfo(ipData);
      setAnalysis(analysisData);

      // Test simple IP analysis
      const simpleIpData = await simpleIPAnalytics.getIPInfo();
      const simpleAnalysisData = await simpleIPAnalytics.analyzeTargetCustomer();
      
      setSimpleIpInfo(simpleIpData);
      setSimpleAnalysis(simpleAnalysisData);

      // Send test events to Segment
      if (analysisData) {
        analytics.segment.trackWithIPAnalysis('IP Analysis Test', {
          testType: 'full_analysis',
          isTargetCustomer: analysisData.isTargetCustomer,
          organizationType: analysisData.organizationType,
          confidence: analysisData.confidence
        });
      }

      if (simpleAnalysisData) {
        analytics.segment.trackWithSimpleIPAnalysis('Simple IP Analysis Test', {
          testType: 'simple_analysis',
          isTargetCustomer: simpleAnalysisData.isTargetCustomer,
          organizationType: simpleAnalysisData.organizationType,
          confidence: simpleAnalysisData.confidence
        });
      }

      console.log('IP Analysis test completed:', {
        ipData,
        analysisData,
        simpleIpData,
        simpleAnalysisData
      });

    } catch (err) {
      console.error('IP Analysis test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    ipAnalytics.reset();
    simpleIPAnalytics.reset();
    setIpInfo(null);
    setAnalysis(null);
    setSimpleIpInfo(null);
    setSimpleAnalysis(null);
    setError(null);
    console.log('IP Analysis reset');
  };

  return (
    <div className="container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>IP Analysis & Target Customer Detection Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testIPAnalysis} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test IP Analysis'}
        </button>
        
        <button 
          onClick={resetAnalysis}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset Analysis
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Full IP Analysis Results */}
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          <h2>Full IP Analysis Results</h2>
          
          <h3>IP Information</h3>
          {ipInfo ? (
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {JSON.stringify(ipInfo, null, 2)}
            </pre>
          ) : (
            <p style={{ color: '#6c757d' }}>No IP information available</p>
          )}

          <h3>Target Customer Analysis</h3>
          {analysis ? (
            <div>
              <div style={{ 
                padding: '10px', 
                backgroundColor: analysis.isTargetCustomer ? '#d4edda' : '#f8d7da',
                color: analysis.isTargetCustomer ? '#155724' : '#721c24',
                borderRadius: '4px',
                marginBottom: '10px'
              }}>
                <strong>Target Customer:</strong> {analysis.isTargetCustomer ? 'YES' : 'NO'}
              </div>
              <pre style={{ 
                backgroundColor: '#fff', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </div>
          ) : (
            <p style={{ color: '#6c757d' }}>No analysis available</p>
          )}
        </div>

        {/* Simple IP Analysis Results */}
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          <h2>Simple IP Analysis Results</h2>
          
          <h3>IP Information</h3>
          {simpleIpInfo ? (
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {JSON.stringify(simpleIpInfo, null, 2)}
            </pre>
          ) : (
            <p style={{ color: '#6c757d' }}>No IP information available</p>
          )}

          <h3>Target Customer Analysis</h3>
          {simpleAnalysis ? (
            <div>
              <div style={{ 
                padding: '10px', 
                backgroundColor: simpleAnalysis.isTargetCustomer ? '#d4edda' : '#f8d7da',
                color: simpleAnalysis.isTargetCustomer ? '#155724' : '#721c24',
                borderRadius: '4px',
                marginBottom: '10px'
              }}>
                <strong>Target Customer:</strong> {simpleAnalysis.isTargetCustomer ? 'YES' : 'NO'}
              </div>
              <pre style={{ 
                backgroundColor: '#fff', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {JSON.stringify(simpleAnalysis, null, 2)}
              </pre>
            </div>
          ) : (
            <p style={{ color: '#6c757d' }}>No analysis available</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
        <h3>How it works:</h3>
        <ul>
          <li><strong>IP Information:</strong> Fetches your IP address and geolocation data from multiple services</li>
          <li><strong>Organization Detection:</strong> Analyzes your organization name to identify if it's a university, research institute, or enterprise</li>
          <li><strong>Geographic Analysis:</strong> Checks if you're in a target country/region</li>
          <li><strong>Target Customer Score:</strong> Calculates confidence level based on organization type and location</li>
          <li><strong>Segment Integration:</strong> Sends analysis results to Segment for tracking</li>
        </ul>
      </div>
    </div>
  );
};
