import type { APIGatewayProxyHandler } from 'aws-lambda';

const SEGMENT_CDN_HOST = 'https://cdn.segment.com';
const SEGMENT_API_HOST = 'https://api.segment.io';

const allowedOrigins = [
    'https://ninescrolls.com',
    'https://www.ninescrolls.com',
];

const getCorsHeaders = (origin?: string) => {
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
};

/**
 * Rewrite the Segment settings response to replace api.segment.io with our proxy host.
 * analytics.js fetches settings from /v1/projects/{writeKey}/settings during initialization
 * and uses the apiHost from the response to send tracking data. By rewriting this, we ensure
 * all tracking calls go through our proxy without relying on client-side load options.
 */
function rewriteSettingsApiHost(settingsJson: string, proxyApiHost: string): string {
    try {
        const settings = JSON.parse(settingsJson);
        if (settings?.integrations?.['Segment.io']) {
            settings.integrations['Segment.io'].apiHost = proxyApiHost;
        }
        return JSON.stringify(settings);
    } catch {
        // If parsing fails, return original response
        return settingsJson;
    }
}

export const handler: APIGatewayProxyHandler = async (event) => {
    const requestOrigin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(requestOrigin);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }

    try {
        // REST API v1: event.path = full path, event.resource = route pattern
        // event.pathParameters.proxy = captured wildcard portion
        const fullPath = event.path || '';
        const proxyPath = event.pathParameters?.proxy || '';

        let upstreamUrl: string;
        let isCdnRequest: boolean;

        // Route: /seg/cdn/{proxy+} -> cdn.segment.com/{proxy}
        if (fullPath.includes('/seg/cdn/')) {
            upstreamUrl = `${SEGMENT_CDN_HOST}/${proxyPath}`;
            isCdnRequest = true;
        }
        // Route: /seg/v1/{proxy+} -> api.segment.io/v1/{proxy}
        else if (fullPath.includes('/seg/v1/')) {
            upstreamUrl = `${SEGMENT_API_HOST}/v1/${proxyPath}`;
            isCdnRequest = false;
        }
        else {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Not found', path: fullPath }),
            };
        }

        // Build upstream request headers
        const upstreamHeaders: Record<string, string> = {
            'User-Agent': event.headers?.['user-agent'] || event.headers?.['User-Agent'] || 'NineScrolls-Segment-Proxy/1.0',
        };

        if (!isCdnRequest && (event.headers?.['content-type'] || event.headers?.['Content-Type'])) {
            upstreamHeaders['Content-Type'] = event.headers['content-type'] || event.headers['Content-Type'] || 'application/json';
        }

        // Forward request body for non-GET requests
        let body: string | undefined;
        if (!isCdnRequest && event.body) {
            body = event.isBase64Encoded
                ? Buffer.from(event.body, 'base64').toString()
                : event.body;
        }

        const upstreamResponse = await fetch(upstreamUrl, {
            method: isCdnRequest ? 'GET' : event.httpMethod,
            headers: upstreamHeaders,
            body,
        });

        let responseBody = await upstreamResponse.text();

        const responseHeaders: Record<string, string> = {
            ...corsHeaders,
        };

        const contentType = upstreamResponse.headers.get('content-type');
        if (contentType) {
            responseHeaders['Content-Type'] = contentType;
        }

        // For CDN settings requests, rewrite apiHost so tracking data goes through our proxy
        // analytics.js fetches: /v1/projects/{writeKey}/settings
        if (isCdnRequest && /^v1\/projects\/[^/]+\/settings/.test(proxyPath)) {
            const host = event.headers?.Host || event.headers?.host || '';
            const stage = event.requestContext?.stage || 'prod';
            const proxyApiHost = `${host}/${stage}/seg/v1`;
            responseBody = rewriteSettingsApiHost(responseBody, proxyApiHost);
            responseHeaders['Content-Type'] = 'application/json';
            // Short cache for settings so apiHost changes propagate quickly
            responseHeaders['Cache-Control'] = 'public, max-age=300, s-maxage=3600';
        } else if (isCdnRequest) {
            // Cache other CDN responses (analytics.js script) longer
            responseHeaders['Cache-Control'] = 'public, max-age=3600, s-maxage=86400';
        }

        return {
            statusCode: upstreamResponse.status,
            headers: responseHeaders,
            body: responseBody,
        };

    } catch (error) {
        console.error('Segment proxy error:', error);
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Bad Gateway' }),
        };
    }
};
