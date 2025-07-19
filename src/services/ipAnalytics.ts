// IP Analytics Service
// 用于收集用户IP地址和地理位置信息，分析目标客户

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

  // 获取用户IP地址和地理位置信息
  async getIPInfo(): Promise<IPInfo | null> {
    if (this.ipInfo) {
      return this.ipInfo;
    }

    try {
      // 使用多个IP查询服务以提高准确性
      const responses = await Promise.allSettled([
        this.fetchFromIPAPI(),
        this.fetchFromIPInfo(),
        this.fetchFromIPGeolocation()
      ]);

      // 选择最可靠的响应
      const successfulResponses = responses
        .filter((response): response is PromiseFulfilledResult<any> => 
          response.status === 'fulfilled' && response.value
        )
        .map(response => response.value);

      if (successfulResponses.length > 0) {
        this.ipInfo = this.mergeIPInfo(successfulResponses);
        return this.ipInfo;
      }

      return null;
    } catch (error) {
      console.error('Error fetching IP info:', error);
      return null;
    }
  }

  // 从 ip-api.com 获取信息
  private async fetchFromIPAPI(): Promise<any> {
    const response = await fetch('http://ip-api.com/json/?fields=status,message,country,regionName,city,org,isp,timezone,lat,lon,query');
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        ip: data.query,
        country: data.country,
        region: data.regionName,
        city: data.city,
        org: data.org,
        isp: data.isp,
        timezone: data.timezone,
        latitude: data.lat,
        longitude: data.lon
      };
    }
    return null;
  }

  // 从 ipinfo.io 获取信息
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

  // 从 ipgeolocation.io 获取信息
  private async fetchFromIPGeolocation(): Promise<any> {
    const response = await fetch('https://api.ipgeolocation.io/ipgeo?apiKey=free');
    const data = await response.json();
    
    if (data.ip) {
      return {
        ip: data.ip,
        country: data.country_name,
        region: data.state_prov,
        city: data.city,
        org: data.organization,
        isp: data.isp,
        timezone: data.time_zone?.name,
        latitude: data.latitude,
        longitude: data.longitude
      };
    }
    return null;
  }

  // 合并多个IP信息源的数据
  private mergeIPInfo(responses: any[]): IPInfo {
    const merged: any = {};
    
    // 选择最完整的数据
    responses.forEach(response => {
      Object.keys(response).forEach(key => {
        if (response[key] && !merged[key]) {
          merged[key] = response[key];
        }
      });
    });

    return merged as IPInfo;
  }

  // 分析是否为目标客户
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

  // 执行目标客户分析
  private performAnalysis(ipInfo: IPInfo): TargetCustomerAnalysis {
    const orgName = ipInfo.org || ipInfo.isp || 'Unknown';
    const orgLower = orgName.toLowerCase();
    const location = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;

    // 定义目标客户关键词
    const universityKeywords = [
      'university', 'college', 'school', 'academy', 'institute', 'campus',
      '大学', '学院', '学校', '研究所', '研究院', '实验室'
    ];

    const researchKeywords = [
      'research', 'laboratory', 'lab', 'institute', 'foundation', 'center',
      '研究', '实验室', '研究所', '研究院', '中心', '基金会'
    ];

    const enterpriseKeywords = [
      'corporation', 'company', 'inc', 'ltd', 'llc', 'enterprise', 'business',
      '公司', '企业', '集团', '股份', '有限', '科技'
    ];

    // 分析组织类型
    let organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown' = 'unknown';
    let confidence = 0;
    let keywords: string[] = [];

    // 检查大学关键词
    const universityMatches = universityKeywords.filter(keyword => 
      orgLower.includes(keyword)
    );
    if (universityMatches.length > 0) {
      organizationType = 'university';
      confidence = Math.min(0.9, 0.3 + (universityMatches.length * 0.2));
      keywords = universityMatches;
    }

    // 检查研究机构关键词
    const researchMatches = researchKeywords.filter(keyword => 
      orgLower.includes(keyword)
    );
    if (researchMatches.length > 0 && confidence < 0.5) {
      organizationType = 'research_institute';
      confidence = Math.min(0.9, 0.4 + (researchMatches.length * 0.15));
      keywords = researchMatches;
    }

    // 检查企业关键词
    const enterpriseMatches = enterpriseKeywords.filter(keyword => 
      orgLower.includes(keyword)
    );
    if (enterpriseMatches.length > 0 && confidence < 0.3) {
      organizationType = 'enterprise';
      confidence = Math.min(0.8, 0.2 + (enterpriseMatches.length * 0.1));
      keywords = enterpriseMatches;
    }

    // 地理位置加分
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

  // 检查是否为目标地理位置
  private isTargetLocation(country: string, region: string): boolean {
    const targetCountries = [
      'United States', 'China', 'Japan', 'Germany', 'United Kingdom', 
      'France', 'Canada', 'Australia', 'South Korea', 'Netherlands',
      '美国', '中国', '日本', '德国', '英国', '法国', '加拿大', '澳大利亚', '韩国', '荷兰'
    ];

    const targetRegions = [
      'California', 'Massachusetts', 'New York', 'Texas', 'Illinois',
      'California', 'Massachusetts', 'New York', 'Texas', 'Illinois'
    ];

    return targetCountries.includes(country) || targetRegions.includes(region);
  }

  // 获取组织类型名称
  private getOrgTypeName(type: string): string {
    const typeNames = {
      university: '大学/教育机构',
      research_institute: '研究机构',
      enterprise: '企业',
      unknown: '未知'
    };
    return typeNames[type as keyof typeof typeNames] || '未知';
  }

  // 获取分析结果
  getAnalysis(): TargetCustomerAnalysis | null {
    return this.analysis;
  }

  // 重置分析结果
  reset(): void {
    this.ipInfo = null;
    this.analysis = null;
  }
}

export const ipAnalytics = IPAnalyticsService.getInstance();
export type { IPInfo, TargetCustomerAnalysis }; 