// IP Analytics Service
// Used to collect user IP address and geolocation information, analyze target customers

interface IPInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  org: string;
  isp: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
}

interface TargetCustomerAnalysis {
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

class IPAnalyticsService {
  private static instance: IPAnalyticsService;
  private ipInfo: IPInfo | null = null;
  private analysis: TargetCustomerAnalysis | null = null;

  private constructor() {}

  static getInstance(): IPAnalyticsService {
    if (!IPAnalyticsService.instance) {
      IPAnalyticsService.instance = new IPAnalyticsService();
    }
    return IPAnalyticsService.instance;
  }

  // Get user IP address and geolocation information
  async getIPInfo(): Promise<IPInfo | null> {
    if (this.ipInfo) {
      return this.ipInfo;
    }

    try {
          // Use multiple IP query services for better accuracy, add timeout control
    const timeout = 5000; // 5 second timeout
      
      const responses = await Promise.allSettled([
        this.fetchWithTimeout(this.fetchFromIPAPI(), timeout),
        this.fetchWithTimeout(this.fetchFromIPInfo(), timeout),
        this.fetchWithTimeout(this.fetchFromIPGeolocation(), timeout),
        this.fetchWithTimeout(this.fetchFromIPify(), timeout),
        this.fetchWithTimeout(this.fetchFromIPAPI2(), timeout)
      ]);

      // Select the most reliable response
      const successfulResponses = responses
        .filter((response): response is PromiseFulfilledResult<any> => 
          response.status === 'fulfilled' && response.value
        )
        .map(response => response.value);

      console.log(`IP query result: ${successfulResponses.length}/${responses.length} services successful`);

      if (successfulResponses.length > 0) {
        this.ipInfo = this.mergeIPInfo(successfulResponses);
        return this.ipInfo;
      }

      console.warn('All IP query services failed');
      return null;
    } catch (error) {
      console.error('Error fetching IP info:', error);
      return null;
    }
  }

  // Add timeout-controlled fetch wrapper
  private async fetchWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  // Get information from ip-api.com
  private async fetchFromIPAPI(): Promise<any> {
          const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
          if (data.ip) {
        return {
          ip: data.ip,
          country: data.country_name,
          region: data.region,
          city: data.city,
          org: data.org,
          isp: data.org,
          timezone: data.timezone,
          latitude: data.latitude,
          longitude: data.longitude
        };
      }
    return null;
  }

  // Get information from ipinfo.io
  private async fetchFromIPInfo(): Promise<any> {
    const response = await fetch('https://ipinfo.io/json');
    const data = await response.json();
    
    if (data.ip) {
      return {
        ip: data.ip,
        country: data.country,
        region: data.region,
        city: data.city,
        org: data.org,
        isp: data.isp,
        timezone: data.timezone,
        latitude: data.loc ? parseFloat(data.loc.split(',')[0]) : undefined,
        longitude: data.loc ? parseFloat(data.loc.split(',')[1]) : undefined
      };
    }
    return null;
  }

  // Get information from ipapi.co (free alternative to ipgeolocation.io)
  private async fetchFromIPGeolocation(): Promise<any> {
    try {
      // Use ipapi.co as a free alternative to ipgeolocation.io
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) {
        console.warn('ipapi.co request failed:', response.status);
        return null;
      }
      const data = await response.json();
      
      if (data.ip) {
        return {
          ip: data.ip,
          country: data.country_name,
          region: data.region,
          city: data.city,
          org: data.org,
          isp: data.org,
          timezone: data.timezone,
          latitude: data.latitude,
          longitude: data.longitude
        };
      }
      return null;
    } catch (error) {
      console.warn('ipapi.co fetch error:', error);
      return null;
    }
  }

  // Get information from ipify.org
  private async fetchFromIPify(): Promise<any> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) {
        console.warn('ipify.org request failed:', response.status);
        return null;
      }
      const data = await response.json();
      
      if (data.ip) {
        // ipify only provides IP, need to get geolocation information separately
        const geoResponse = await fetch(`https://ipapi.co/${data.ip}/json/`);
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          return {
            ip: data.ip,
            country: geoData.country_name,
            region: geoData.region,
            city: geoData.city,
            org: geoData.org,
            isp: geoData.org,
            timezone: geoData.timezone,
            latitude: geoData.latitude,
            longitude: geoData.longitude
          };
        }
      }
      return null;
    } catch (error) {
      console.warn('ipify.org fetch error:', error);
      return null;
    }
  }

  // Get information from ip-api.com backup endpoint
  private async fetchFromIPAPI2(): Promise<any> {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) {
        console.warn('ipapi.co backup request failed:', response.status);
        return null;
      }
      const data = await response.json();
      
      if (data.ip) {
        return {
          ip: data.ip,
          country: data.country_name,
          region: data.region,
          city: data.city,
          org: data.org,
          isp: data.org,
          timezone: data.timezone,
          latitude: data.latitude,
          longitude: data.longitude
        };
      }
      return null;
    } catch (error) {
      console.warn('ipapi.co backup fetch error:', error);
      return null;
    }
  }

  // Merge data from multiple IP information sources
  private mergeIPInfo(responses: any[]): IPInfo {
    const merged: any = {};
    
    // Select the most complete data
    responses.forEach(response => {
      Object.keys(response).forEach(key => {
        if (response[key] && !merged[key]) {
          merged[key] = response[key];
        }
      });
    });

    return merged as IPInfo;
  }

  // Analyze if it's a target customer
  async analyzeTargetCustomer(): Promise<TargetCustomerAnalysis> {
    if (this.analysis) {
      return this.analysis;
    }

    const ipInfo = await this.getIPInfo();
    if (!ipInfo) {
      this.analysis = {
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
      return this.analysis;
    }

    const analysis = this.performAnalysis(ipInfo);
    this.analysis = analysis;
    return analysis;
  }

  // Perform target customer analysis
  private performAnalysis(ipInfo: IPInfo): TargetCustomerAnalysis {
    const orgName = ipInfo.org || ipInfo.isp || 'Unknown';
    const orgLower = orgName.toLowerCase();
    const location = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;

    // Define target customer keywords
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
  private isTargetLocation(country: string, region: string): boolean {
    const targetCountries = [
      'United States', 'China', 'Japan', 'Germany', 'United Kingdom', 
      'France', 'Canada', 'Australia', 'South Korea', 'Netherlands',
      // Chinese: '美国', '中国', '日本', '德国', '英国', '法国', '加拿大', '澳大利亚', '韩国', '荷兰'
    ];

    const targetRegions = [
      'California', 'Massachusetts', 'New York', 'Texas', 'Illinois',
      'California', 'Massachusetts', 'New York', 'Texas', 'Illinois'
    ];

    return targetCountries.includes(country) || targetRegions.includes(region);
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

  // Get analysis result
  getAnalysis(): TargetCustomerAnalysis | null {
    return this.analysis;
  }

  // Reset analysis result
  reset(): void {
    this.ipInfo = null;
    this.analysis = null;
  }
}

export const ipAnalytics = IPAnalyticsService.getInstance();
export type { IPInfo, TargetCustomerAnalysis }; 