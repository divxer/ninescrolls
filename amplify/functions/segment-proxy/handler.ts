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

        const responseBody = await upstreamResponse.text();

        const responseHeaders: Record<string, string> = {
            ...corsHeaders,
        };

        const contentType = upstreamResponse.headers.get('content-type');
        if (contentType) {
            responseHeaders['Content-Type'] = contentType;
        }

        // Cache CDN responses (analytics.js script)
        if (isCdnRequest) {
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
