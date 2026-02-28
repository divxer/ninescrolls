import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

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

type LegacyHttpEvent = { httpMethod?: string };

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const requestOrigin = event.headers?.origin;
    const corsHeaders = getCorsHeaders(requestOrigin);

    const legacyEvent = event as LegacyHttpEvent;
    const method = event.requestContext?.http?.method || legacyEvent.httpMethod;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }

    try {
        const proxyPath = event.pathParameters?.proxy || '';
        const rawPath = event.rawPath || event.requestContext?.http?.path || '';

        let upstreamUrl: string;
        let isCdnRequest: boolean;

        // Route: /seg/cdn/{proxy+} -> cdn.segment.com/{proxy}
        if (rawPath.includes('/seg/cdn/') || proxyPath.startsWith('cdn/')) {
            const cdnPath = proxyPath.startsWith('cdn/') ? proxyPath.slice(4) : proxyPath;
            upstreamUrl = `${SEGMENT_CDN_HOST}/${cdnPath}`;
            isCdnRequest = true;
        }
        // Route: /seg/v1/{proxy+} -> api.segment.io/v1/{proxy}
        else if (rawPath.includes('/seg/v1/') || proxyPath.startsWith('v1/')) {
            const apiPath = proxyPath.startsWith('v1/') ? proxyPath.slice(3) : proxyPath;
            upstreamUrl = `${SEGMENT_API_HOST}/v1/${apiPath}`;
            isCdnRequest = false;
        }
        else {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Not found' }),
            };
        }

        // Build upstream request headers
        const upstreamHeaders: Record<string, string> = {
            'User-Agent': event.headers?.['user-agent'] || 'NineScrolls-Segment-Proxy/1.0',
        };

        if (!isCdnRequest && event.headers?.['content-type']) {
            upstreamHeaders['Content-Type'] = event.headers['content-type'];
        }

        // Forward request body for non-GET requests
        let body: string | undefined;
        if (!isCdnRequest && event.body) {
            body = event.isBase64Encoded
                ? Buffer.from(event.body, 'base64').toString()
                : event.body;
        }

        const upstreamResponse = await fetch(upstreamUrl, {
            method: isCdnRequest ? 'GET' : (method || 'POST'),
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
