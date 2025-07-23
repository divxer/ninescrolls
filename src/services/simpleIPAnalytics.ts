// 简化的IP分析服务
// 使用更可靠的IP查询方法

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

  // 获取IP信息 - 使用最可靠的方法
  async getIPInfo(): Promise<SimpleIPInfo | null> {
    if (this.ipInfo) {
      return this.ipInfo;
    }

    try {
      // 首先尝试获取IP地址
      const ip = await this.getIPAddress();
      if (!ip) {
        console.warn('无法获取IP地址');
        return null;
      }

      // 然后获取地理位置信息
      const geoInfo = await this.getGeoInfo(ip);
      
      this.ipInfo = {
        ip,
        ...geoInfo
      };

      console.log('IP信息获取成功:', this.ipInfo);
      return this.ipInfo;

    } catch (error) {
      console.error('获取IP信息失败:', error);
      return null;
    }
  }

  // 获取IP地址
  private async getIPAddress(): Promise<string | null> {
    try {
      // 尝试多个IP查询服务
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
              console.log(`IP地址获取成功 (${service}):`, ip);
              return ip;
            }
          }
        } catch (error) {
          console.warn(`IP服务 ${service} 失败:`, error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('获取IP地址失败:', error);
      return null;
    }
  }

  // 获取地理位置信息
  private async getGeoInfo(ip: string): Promise<Partial<SimpleIPInfo>> {
    try {
      // 使用ip-api.com (免费且可靠)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,org,isp,query`);
      
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

      // 备用方案：使用ipinfo.io
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
      console.warn('获取地理位置信息失败:', error);
      return {};
    }
  }

  // 验证IP地址格式
  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  // 分析目标客户
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

  // 执行分析
  private performAnalysis(ipInfo: SimpleIPInfo): SimpleTargetCustomerAnalysis {
    const orgName = ipInfo.org || ipInfo.isp || 'Unknown';
    const orgLower = orgName.toLowerCase();
    const location = [ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(', ') || 'Unknown';

    // 定义关键词
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
  private isTargetLocation(country?: string, region?: string): boolean {
    if (!country) return false;

    const targetCountries = [
      'United States', 'China', 'Japan', 'Germany', 'United Kingdom', 
      'France', 'Canada', 'Australia', 'South Korea', 'Netherlands',
      '美国', '中国', '日本', '德国', '英国', '法国', '加拿大', '澳大利亚', '韩国', '荷兰'
    ];

    const targetRegions = [
      'California', 'Massachusetts', 'New York', 'Texas', 'Illinois'
    ];

    return targetCountries.includes(country) || (region ? targetRegions.includes(region) : false);
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

  // 创建默认分析结果
  private createDefaultAnalysis(): SimpleTargetCustomerAnalysis {
    return {
      isTargetCustomer: false,
      organizationType: 'unknown',
      confidence: 0,
      details: {
        orgName: 'Unknown',
        orgType: '未知',
        location: 'Unknown',
        keywords: []
      }
    };
  }

  // 重置
  reset(): void {
    this.ipInfo = null;
    this.analysis = null;
  }
}

export const simpleIPAnalytics = SimpleIPAnalyticsService.getInstance();
export type { SimpleIPInfo, SimpleTargetCustomerAnalysis }; 