import type { APIGatewayProxyHandler } from 'aws-lambda';

// ─── Types ───────────────────────────────────────────────────────────────────

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
    privacy?: {
        vpn?: boolean;
        proxy?: boolean;
        hosting?: boolean;
        tor?: boolean;
        relay?: boolean;
    };
    company?: {
        type?: string;
        domain?: string;
        name?: string;
    };
}

interface ConfidenceBreakdown {
    orgMatch: number;
    geo: number;
    ispPenalty: number;
    whitelist: number;
    total: number;
}

interface TargetCustomerAnalysis {
    isTargetCustomer: boolean;
    organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown';
    confidence: number;
    confidenceBreakdown?: ConfidenceBreakdown;
    leadTier?: 'A' | 'B' | 'C';
    details: {
        orgName: string;
        orgType: string;
        location: string;
        keywords: string[];
    };
}

// ─── CORS ────────────────────────────────────────────────────────────────────

const allowedOrigins = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
];

const getCorsHeaders = (origin?: string) => {
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
};

// ─── IP Fetching ─────────────────────────────────────────────────────────────

async function fetchWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        return await promise;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchFromIPInfo(ip: string): Promise<Partial<IPInfo> | null> {
    try {
        const response = await fetch(`https://ipinfo.io/${ip}/json`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.ip) return null;
        return {
            ip: data.ip,
            country: data.country,
            region: data.region,
            city: data.city,
            org: data.org,
            isp: data.isp,
            timezone: data.timezone,
            latitude: data.loc ? parseFloat(data.loc.split(',')[0]) : undefined,
            longitude: data.loc ? parseFloat(data.loc.split(',')[1]) : undefined,
            privacy: data.privacy ? {
                vpn: data.privacy.vpn === true,
                proxy: data.privacy.proxy === true,
                hosting: data.privacy.hosting === true,
                tor: data.privacy.tor === true,
                relay: data.privacy.relay === true,
            } : undefined,
            company: data.company ? {
                type: data.company.type,
                domain: data.company.domain,
                name: data.company.name,
            } : undefined,
        };
    } catch {
        return null;
    }
}

async function fetchFromIPAPI(ip: string): Promise<Partial<IPInfo> | null> {
    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.ip) return null;
        return {
            ip: data.ip,
            country: data.country_name,
            region: data.region,
            city: data.city,
            org: data.org,
            isp: data.org,
            timezone: data.timezone,
            latitude: data.latitude,
            longitude: data.longitude,
        };
    } catch {
        return null;
    }
}

function mergeIPInfo(responses: Array<Partial<IPInfo>>): IPInfo {
    const merged: Partial<IPInfo> = {};
    responses.forEach((response) => {
        Object.keys(response).forEach((key) => {
            const typedKey = key as keyof IPInfo;
            const value = response[typedKey];
            if (value !== undefined && value !== null && merged[typedKey] === undefined) {
                (merged as Record<string, unknown>)[typedKey] = value;
            }
        });
    });
    return {
        ip: typeof merged.ip === 'string' ? merged.ip : '',
        country: typeof merged.country === 'string' ? merged.country : '',
        region: typeof merged.region === 'string' ? merged.region : '',
        city: typeof merged.city === 'string' ? merged.city : '',
        org: typeof merged.org === 'string' ? merged.org : '',
        isp: typeof merged.isp === 'string' ? merged.isp : '',
        timezone: typeof merged.timezone === 'string' ? merged.timezone : '',
        latitude: typeof merged.latitude === 'number' ? merged.latitude : undefined,
        longitude: typeof merged.longitude === 'number' ? merged.longitude : undefined,
        privacy: merged.privacy,
        company: merged.company,
    };
}

// ─── Target Customer Analysis ────────────────────────────────────────────────

const universityKeywords = [
    'university', 'college', 'school', 'academy', 'institute', 'campus',
];

const researchKeywords = [
    'research', 'laboratory', 'lab', 'institute', 'foundation', 'center',
];

const enterpriseKeywords = [
    'corporation', 'company', 'inc', 'ltd', 'llc', 'enterprise', 'business',
];

const noiseOrgs = [
    // ISPs and Telecom
    'comcast', 'verizon', 'at&t', 't-mobile', 'tmobile', 'sprint',
    'crown castle', 'crowncastle', 'fiber', 'telecom', 'telecommunications',
    'infrastructure', 'tower', 'wireless', 'broadband', 'cable',
    // Cloud providers and Hosting
    'cloudflare', 'amazon', 'aws', 'google', 'microsoft', 'oracle',
    'azure', 'gcp', 'digitalocean', 'linode', 'vultr', 'ovh',
    'akamai', 'fastly', 'cloudfront', 'cdn', 'proxy', 'vpn',
    // Data centers and Colocation
    'colo', 'colocation', 'datacenter', 'data center', 'whitelabel',
    'whitelabelcolo', 'server', 'hosting', 'host', 'dedicated',
    // Other non-target industries
    'real estate', 'construction', 'logistics', 'shipping', 'transportation',
];

const highPriorityNoise = [
    'colo', 'colocation', 'datacenter', 'data center', 'whitelabel',
    'hosting', 'host', 'server', 'dedicated',
    'cloudflare', 'amazon', 'aws', 'azure', 'gcp',
    'comcast', 'verizon', 'at&t', 't-mobile', 'isp',
];

const whitelist = [
    // US Universities
    'stanford', 'mit', 'massachusetts institute', 'harvard', 'ucsd', 'uc san diego',
    'ucla', 'uc berkeley', 'caltech', 'california institute', 'princeton',
    'yale', 'columbia', 'cornell', 'pennsylvania', 'upenn', 'chicago',
    'northwestern', 'duke', 'johns hopkins', 'carnegie mellon', 'cmu',
    'university of maryland', 'university of california, los angeles',
    // Research Institutes
    'nano3', 'nano', 'national lab', 'argonne', 'oak ridge', 'lawrence',
    'sandia', 'los alamos', 'brookhaven', 'fermilab',
    // Chinese Universities
    'tsinghua', 'peking', 'beijing university', 'fudan', 'shanghai jiao tong',
    'zhejiang', 'nankai', 'nanjing', 'wuhan', 'huazhong',
    // Chinese Research Institutes
    'chinese academy', 'cas', 'academia sinica',
    // European
    'eth zurich', 'epfl', 'max planck', 'fraunhofer', 'cnrs',
    'cambridge', 'oxford', 'imperial college',
];

const targetCountries = [
    'United States', 'China', 'Japan', 'Germany', 'United Kingdom',
    'France', 'Canada', 'Australia', 'South Korea', 'Netherlands',
    'US', 'CN', 'JP', 'DE', 'GB', 'FR', 'CA', 'AU', 'KR', 'NL',
];

const targetRegions = [
    'California', 'Massachusetts', 'New York', 'Texas', 'Illinois',
];

function isTargetLocation(country: string, region: string): boolean {
    return targetCountries.includes(country) || targetRegions.includes(region);
}

function checkWhitelist(orgName: string): { matched: boolean } {
    const orgLower = orgName.toLowerCase();
    return { matched: whitelist.some(keyword => orgLower.includes(keyword)) };
}

function getOrgTypeName(type: string): string {
    const typeNames: Record<string, string> = {
        university: 'University/Educational Institution',
        research_institute: 'Research Institution',
        enterprise: 'Enterprise',
        unknown: 'Unknown',
    };
    return typeNames[type] || 'Unknown';
}

function analyzeTargetCustomer(ipInfo: IPInfo): TargetCustomerAnalysis {
    // L0_REJECT: Early rejection for VPN, proxy, hosting, and ISP types
    if (ipInfo.privacy?.vpn || ipInfo.privacy?.proxy || ipInfo.privacy?.hosting) {
        return {
            isTargetCustomer: false,
            organizationType: 'unknown',
            confidence: 0,
            confidenceBreakdown: { orgMatch: 0, geo: 0, ispPenalty: -1.0, whitelist: 0, total: 0 },
            leadTier: undefined,
            details: {
                orgName: ipInfo.org || ipInfo.isp || 'Unknown',
                orgType: 'VPN/Proxy/Hosting',
                location: `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`,
                keywords: [],
            },
        };
    }

    // L0_REJECT: Reject ISP type companies
    if (ipInfo.company?.type === 'isp' || ipInfo.company?.type === 'hosting') {
        return {
            isTargetCustomer: false,
            organizationType: 'unknown',
            confidence: 0,
            confidenceBreakdown: { orgMatch: 0, geo: 0, ispPenalty: -1.0, whitelist: 0, total: 0 },
            leadTier: undefined,
            details: {
                orgName: ipInfo.org || ipInfo.isp || 'Unknown',
                orgType: 'ISP/Hosting Provider',
                location: `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`,
                keywords: [],
            },
        };
    }

    const orgName = ipInfo.org || ipInfo.isp || 'Unknown';
    const orgLower = orgName.toLowerCase();
    const location = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;

    const breakdown: ConfidenceBreakdown = {
        orgMatch: 0, geo: 0, ispPenalty: 0, whitelist: 0, total: 0,
    };

    // Check for noise/ISP organizations (negative signal)
    const isNoiseOrg = noiseOrgs.some(noise => orgLower.includes(noise));
    if (isNoiseOrg) {
        breakdown.ispPenalty = -0.5;
        if (highPriorityNoise.some(noise => orgLower.includes(noise))) {
            return {
                isTargetCustomer: false,
                organizationType: 'unknown',
                confidence: 0,
                confidenceBreakdown: breakdown,
                leadTier: undefined,
                details: { orgName, orgType: 'Data Center/Hosting/ISP', location, keywords: [] },
            };
        }
    }

    // Check whitelist (only if not a noise org)
    if (!isNoiseOrg) {
        const whitelistMatch = checkWhitelist(orgName);
        if (whitelistMatch.matched) {
            breakdown.whitelist = Math.max(0.85, breakdown.whitelist);
        }
    }

    // Analyze organization type
    let organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown' = 'unknown';
    let keywords: string[] = [];

    // Check university keywords
    const universityMatches = universityKeywords.filter(kw => orgLower.includes(kw));
    if (universityMatches.length > 0) {
        organizationType = 'university';
        breakdown.orgMatch = Math.min(0.9, 0.3 + (universityMatches.length * 0.2));
        keywords = universityMatches;
    }

    // Check research institution keywords (word boundary for short keywords)
    const researchMatches = researchKeywords.filter(kw => {
        if (kw.length <= 3) {
            return new RegExp(`\\b${kw}\\b`, 'i').test(orgLower);
        }
        return orgLower.includes(kw);
    });
    if (researchMatches.length > 0 && breakdown.orgMatch < 0.5) {
        organizationType = 'research_institute';
        breakdown.orgMatch = Math.min(0.9, 0.4 + (researchMatches.length * 0.15));
        keywords = researchMatches;
    }

    // Check enterprise keywords (stricter - need research/tech context)
    const enterpriseMatches = enterpriseKeywords.filter(kw => orgLower.includes(kw));
    if (enterpriseMatches.length > 0 && breakdown.orgMatch < 0.3 && !isNoiseOrg) {
        const isWhitelisted = checkWhitelist(orgName).matched;
        const hasResearchTechContext =
            orgLower.includes('semiconductor') || orgLower.includes('technology') ||
            orgLower.includes('research') || orgLower.includes('scientific') ||
            orgLower.includes('engineering') || orgLower.includes('manufacturing') ||
            orgLower.includes('materials') || orgLower.includes('nano') ||
            orgLower.includes('microelectronics') || orgLower.includes('photonics') ||
            orgLower.includes('optics') || orgLower.includes('biotech') ||
            orgLower.includes('medical device') || orgLower.includes('computer') ||
            orgLower.includes('systems') || orgLower.includes('software') ||
            orgLower.includes('tech');

        if (hasResearchTechContext || isWhitelisted) {
            organizationType = 'enterprise';
            breakdown.orgMatch = Math.min(0.8, 0.2 + (enterpriseMatches.length * 0.1));
            keywords = enterpriseMatches;
        } else {
            organizationType = 'unknown';
            breakdown.orgMatch = 0;
        }
    }

    // Apply ISP penalty to orgMatch if it's a noise org
    if (isNoiseOrg && breakdown.orgMatch > 0) {
        breakdown.orgMatch = breakdown.orgMatch * 0.3;
    }

    // Geographic location scoring
    const isTargetGeo = isTargetLocation(ipInfo.country, ipInfo.region);
    if (isTargetGeo) {
        breakdown.geo = 0.1;
    }

    // Calculate total confidence
    breakdown.total = Math.max(0, Math.min(0.95,
        breakdown.orgMatch + breakdown.geo + breakdown.ispPenalty + breakdown.whitelist
    ));

    // Dynamic threshold based on geography
    const threshold = isTargetGeo ? 0.3 : 0.5;

    // Determine lead tier
    let leadTier: 'A' | 'B' | 'C' | undefined;
    if (breakdown.total >= 0.7 && (organizationType === 'university' || organizationType === 'research_institute')) {
        leadTier = 'A';
    } else if (breakdown.total >= 0.5 && organizationType !== 'unknown') {
        leadTier = 'B';
    } else if (breakdown.total >= threshold) {
        leadTier = 'C';
    }

    return {
        isTargetCustomer: breakdown.total > threshold,
        organizationType,
        confidence: breakdown.total,
        confidenceBreakdown: breakdown,
        leadTier,
        details: { orgName, orgType: getOrgTypeName(organizationType), location, keywords },
    };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler: APIGatewayProxyHandler = async (event) => {
    const requestOrigin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(requestOrigin);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        // Extract visitor IP from request headers
        // API Gateway sets X-Forwarded-For: <client>, <cloudfront>, ...
        const xForwardedFor = event.headers?.['X-Forwarded-For'] || event.headers?.['x-forwarded-for'];
        const sourceIp = event.requestContext?.identity?.sourceIp;

        let visitorIp: string | undefined;
        if (xForwardedFor) {
            // First IP in X-Forwarded-For is the original client IP
            visitorIp = xForwardedFor.split(',')[0].trim();
        } else if (sourceIp) {
            visitorIp = sourceIp;
        }

        if (!visitorIp) {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Could not determine visitor IP' }),
            };
        }

        // Query IP services in parallel (server-side: no CORS restrictions)
        const timeout = 7000;
        const responses = await Promise.allSettled([
            fetchWithTimeout(fetchFromIPInfo(visitorIp), timeout),
            fetchWithTimeout(fetchFromIPAPI(visitorIp), timeout),
        ]);

        const successfulResponses = responses
            .filter((r): r is PromiseFulfilledResult<Partial<IPInfo> | null> =>
                r.status === 'fulfilled' && r.value !== null
            )
            .map(r => r.value)
            .filter((r): r is Partial<IPInfo> => r !== null);

        if (successfulResponses.length === 0) {
            return {
                statusCode: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'All IP lookup services failed' }),
            };
        }

        const ipInfo = mergeIPInfo(successfulResponses);
        const analysis = analyzeTargetCustomer(ipInfo);

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                // Short cache: IP info shouldn't be cached long (user might change network)
                'Cache-Control': 'private, max-age=300',
            },
            body: JSON.stringify({ ipInfo, analysis }),
        };

    } catch (error) {
        console.error('IP lookup error:', error);
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal error' }),
        };
    }
};
