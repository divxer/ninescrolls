// Simplified IP analytics service
// Uses more reliable IP query methods

interface SimpleIPInfo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  org?: string;
  isp?: string;
}

interface SimpleTargetCustomerAnalysis {
  isTargetCustomer: boolean;
  organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown';
  confidence: number;
  details: {
    orgName: string;
    orgType: string;
    location: string;
    keywords: string[];
  };
}

class SimpleIPAnalyticsService {
  private static instance: SimpleIPAnalyticsService;
  private ipInfo: SimpleIPInfo | null = null;
  private analysis: SimpleTargetCustomerAnalysis | null = null;

  private constructor() {}

  static getInstance(): SimpleIPAnalyticsService {
    if (!SimpleIPAnalyticsService.instance) {
      SimpleIPAnalyticsService.instance = new SimpleIPAnalyticsService();
    }
    return SimpleIPAnalyticsService.instance;
  }

  // Get IP information - using the most reliable method
  async getIPInfo(): Promise<SimpleIPInfo | null> {
    if (this.ipInfo) {
      return this.ipInfo;
    }

    try {
      // First try to get IP address
      const ip = await this.getIPAddress();
      if (!ip) {
        console.warn('Unable to get IP address');
        return null;
      }

      // Then get geolocation information
      const geoInfo = await this.getGeoInfo(ip);
      
      this.ipInfo = {
        ip,
        ...geoInfo
      };

      console.log('IP information retrieved successfully');
      return this.ipInfo;

    } catch (error) {
      console.error('Failed to get IP information:', error);
      return null;
    }
  }

  // Get IP address
  private async getIPAddress(): Promise<string | null> {
    try {
      // Try multiple IP query services
      const services = [
        'https://api.ipify.org?format=json',
        'https://api.myip.com',
        'https://httpbin.org/ip'
      ];

      for (const service of services) {
        try {
          const response = await fetch(service, { 
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            const ip = data.ip || data.origin;
            if (ip && this.isValidIP(ip)) {
              console.log(`IP address retrieved successfully from ${service.split('/')[2]}`);
              return ip;
            }
          }
        } catch (error) {
          console.warn(`IP service ${service} failed:`, error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get IP address:', error);
      return null;
    }
  }

  // Get geolocation information
  private async getGeoInfo(ip: string): Promise<Partial<SimpleIPInfo>> {
    try {
      // Use ip-api.com (free and reliable) - use HTTPS to avoid mixed content errors
      const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,org,isp,query`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'success') {
          return {
            country: data.country,
            region: data.regionName,
            city: data.city,
            org: data.org,
            isp: data.isp
          };
        }
      }

      // Fallback: use ipinfo.io
      const backupResponse = await fetch(`https://ipinfo.io/${ip}/json`);
      if (backupResponse.ok) {
        const data = await backupResponse.json();
        return {
          country: data.country,
          region: data.region,
          city: data.city,
          org: data.org,
          isp: data.isp
        };
      }

      return {};
    } catch (error) {
      console.warn('Failed to get geolocation information:', error);
      return {};
    }
  }

  // Validate IP address format
  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  // Analyze target customers
  async analyzeTargetCustomer(): Promise<SimpleTargetCustomerAnalysis> {
    if (this.analysis) {
      return this.analysis;
    }

    const ipInfo = await this.getIPInfo();
    if (!ipInfo) {
      this.analysis = this.createDefaultAnalysis();
      return this.analysis;
    }

    const analysis = this.performAnalysis(ipInfo);
    this.analysis = analysis;
    return analysis;
  }

      // Perform analysis
  private performAnalysis(ipInfo: SimpleIPInfo): SimpleTargetCustomerAnalysis {
    const orgName = ipInfo.org || ipInfo.isp || 'Unknown';
    const orgLower = orgName.toLowerCase();
    const location = [ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(', ') || 'Unknown';

    // Define keywords
    const universityKeywords = [
      'university', 'college', 'school', 'academy', 'institute', 'campus',
      // Chinese: '大学', '学院', '学校', '研究所', '研究院', '实验室'
    ];

    const researchKeywords = [
      'research', 'laboratory', 'lab', 'institute', 'foundation', 'center',
      // Chinese: '研究', '实验室', '研究所', '研究院', '中心', '基金会'
    ];

    const enterpriseKeywords = [
      'corporation', 'company', 'inc', 'ltd', 'llc', 'enterprise', 'business',
      // Chinese: '公司', '企业', '集团', '股份', '有限', '科技'
    ];

    // Analyze organization type
    let organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown' = 'unknown';
    let confidence = 0;
    let keywords: string[] = [];

    // Check university keywords
    const universityMatches = universityKeywords.filter(keyword => 
      orgLower.includes(keyword)
    );
    if (universityMatches.length > 0) {
      organizationType = 'university';
      confidence = Math.min(0.9, 0.3 + (universityMatches.length * 0.2));
      keywords = universityMatches;
    }

    // Check research institution keywords
    const researchMatches = researchKeywords.filter(keyword => 
      orgLower.includes(keyword)
    );
    if (researchMatches.length > 0 && confidence < 0.5) {
      organizationType = 'research_institute';
      confidence = Math.min(0.9, 0.4 + (researchMatches.length * 0.15));
      keywords = researchMatches;
    }

    // Check enterprise keywords
    const enterpriseMatches = enterpriseKeywords.filter(keyword => 
      orgLower.includes(keyword)
    );
    if (enterpriseMatches.length > 0 && confidence < 0.3) {
      organizationType = 'enterprise';
      confidence = Math.min(0.8, 0.2 + (enterpriseMatches.length * 0.1));
      keywords = enterpriseMatches;
    }

    // Geographic location bonus
    if (this.isTargetLocation(ipInfo.country, ipInfo.region)) {
      confidence = Math.min(0.95, confidence + 0.1);
    }

    return {
      isTargetCustomer: confidence > 0.3,
      organizationType,
      confidence,
      details: {
        orgName,
        orgType: this.getOrgTypeName(organizationType),
        location,
        keywords
      }
    };
  }

  // Check if it's a target geographic location
  private isTargetLocation(country?: string, region?: string): boolean {
    if (!country) return false;

    const targetCountries = [
      'United States', 'China', 'Japan', 'Germany', 'United Kingdom', 
      'France', 'Canada', 'Australia', 'South Korea', 'Netherlands',
      // Chinese: '美国', '中国', '日本', '德国', '英国', '法国', '加拿大', '澳大利亚', '韩国', '荷兰'
    ];

    const targetRegions = [
      'California', 'Massachusetts', 'New York', 'Texas', 'Illinois'
    ];

    return targetCountries.includes(country) || (region ? targetRegions.includes(region) : false);
  }

  // Get organization type name
  private getOrgTypeName(type: string): string {
    const typeNames = {
      university: 'University/Educational Institution',
      research_institute: 'Research Institution',
      enterprise: 'Enterprise',
      unknown: 'Unknown'
    };
    return typeNames[type as keyof typeof typeNames] || 'Unknown';
  }

  // Create default analysis result
  private createDefaultAnalysis(): SimpleTargetCustomerAnalysis {
    return {
      isTargetCustomer: false,
      organizationType: 'unknown',
      confidence: 0,
      details: {
        orgName: 'Unknown',
        orgType: 'Unknown',
        location: 'Unknown',
        keywords: []
      }
    };
  }

  // Reset
  reset(): void {
    this.ipInfo = null;
    this.analysis = null;
  }
}

export const simpleIPAnalytics = SimpleIPAnalyticsService.getInstance();
export type { SimpleIPInfo, SimpleTargetCustomerAnalysis }; 