import type { APIGatewayProxyHandler } from 'aws-lambda';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if an IP is private/reserved (RFC 1918, loopback, link-local, CGNAT). */
function isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return false;
    const [a, b] = parts;
    return (
        a === 10 ||                          // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) ||          // 192.168.0.0/16
        a === 127 ||                          // 127.0.0.0/8  loopback
        (a === 169 && b === 254) ||          // 169.254.0.0/16 link-local
        (a === 100 && b >= 64 && b <= 127)   // 100.64.0.0/10 CGNAT
    );
}

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
// Classification strategy:
//   1. IPinfo company.type is the primary IP-level signal (professionally maintained database)
//   2. AI classification (Claude via /classify-org) handles refinement and edge cases
//      (e.g., university vs research_institute, business with research context → upgrade)
//   3. No keyword matching — company.type is more reliable for non-English names,
//      abbreviations, and unlisted companies

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
    const orgNameRaw = ipInfo.org || ipInfo.isp || 'Unknown';
    // Strip ASN prefix (e.g. "AS12093 University of Waterloo" → "University of Waterloo")
    const orgName = orgNameRaw.replace(/^AS\d+\s+/i, '').trim() || orgNameRaw;
    const location = `${ipInfo.city}, ${ipInfo.region}, ${ipInfo.country}`;
    const breakdown: ConfidenceBreakdown = {
        orgMatch: 0, geo: 0, ispPenalty: 0, whitelist: 0, total: 0,
    };

    // Classify by IPinfo company.type
    // No L0_REJECT — all traffic (VPN, ISP, hosting, etc.) goes through classification.
    // Potential customers may browse via VPN, home ISP, or corporate proxies.
    // AI classification and behavioral analysis handle refinement downstream.
    const companyType = ipInfo.company?.type;
    // When companyType is unavailable, AI classification serves as fallback
    let organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown' = 'unknown';

    if (companyType === 'education') {
        organizationType = 'university';
        breakdown.orgMatch = 0.5;
    } else if (companyType === 'business') {
        organizationType = 'enterprise';
        breakdown.orgMatch = 0.3;
    } else if (companyType === 'government') {
        organizationType = 'enterprise';  // government labs use similar equipment
        breakdown.orgMatch = 0.3;
    }
    // companyType undefined / other → stays 'unknown', orgMatch = 0 → AI fallback

    // Geographic location scoring
    const isTargetGeo = isTargetLocation(ipInfo.country, ipInfo.region);
    if (isTargetGeo) {
        breakdown.geo = 0.1;
    }

    // Calculate total confidence
    breakdown.total = Math.max(0, Math.min(0.95, breakdown.orgMatch + breakdown.geo));

    // Dynamic threshold based on geography
    const threshold = isTargetGeo ? 0.3 : 0.5;

    // Determine lead tier (only for target customers)
    const isTargetCustomer = breakdown.total > threshold;
    let leadTier: 'A' | 'B' | 'C' | undefined;
    if (isTargetCustomer) {
        if (breakdown.total >= 0.7 && organizationType === 'university') {
            leadTier = 'A';
        } else if (breakdown.total >= 0.5 && organizationType !== 'unknown') {
            leadTier = 'B';
        } else {
            leadTier = 'C';
        }
    }

    return {
        isTargetCustomer,
        organizationType,
        confidence: breakdown.total,
        confidenceBreakdown: breakdown,
        leadTier,
        details: { orgName, orgType: getOrgTypeName(organizationType), location, keywords: [] },
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
        // Priority: CloudFront-Viewer-Address (unforgeable, set by CloudFront from TCP connection)
        //         > X-Forwarded-For (first public IP in the chain)
        //         > API Gateway sourceIp (fallback)
        const cfViewerAddr = event.headers?.['CloudFront-Viewer-Address'] || event.headers?.['cloudfront-viewer-address'];
        const xForwardedFor = event.headers?.['X-Forwarded-For'] || event.headers?.['x-forwarded-for'];
        const sourceIp = event.requestContext?.identity?.sourceIp;

        let visitorIp: string | undefined;
        if (cfViewerAddr) {
            // Format is "ip:port" — strip the port
            visitorIp = cfViewerAddr.split(':').slice(0, -1).join(':') || cfViewerAddr;
        } else if (xForwardedFor) {
            const ips = xForwardedFor.split(',').map((s: string) => s.trim());
            visitorIp = ips.find((ip: string) => !isPrivateIP(ip)) || ips[0];
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
