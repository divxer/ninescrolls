// ---------------------------------------------------------------------------
// CDN Image URL Configuration
// ---------------------------------------------------------------------------
// Maps local /assets/images/ paths to CloudFront CDN URLs.
// Set VITE_CDN_BASE_URL in .env.local for production/staging.
// When empty or unset, falls back to local paths (dev mode).
// ---------------------------------------------------------------------------

const CDN_BASE_URL = (import.meta.env.VITE_CDN_BASE_URL || '').replace(
    /\/$/,
    '',
);

/**
 * Convert a local image path to a CDN URL.
 *
 * @example
 *   cdnUrl('/assets/images/insights/cover.png')
 *   // → 'https://d3iespior9hyxf.cloudfront.net/insights/cover.png'
 *
 *   cdnUrl('/assets/images/products/striper/main.jpg')
 *   // → 'https://d3iespior9hyxf.cloudfront.net/products/striper/main.jpg'
 *
 * If CDN_BASE_URL is not configured, the original path is returned as-is.
 * Already-absolute URLs (http/https) are returned unchanged.
 */
export function cdnUrl(path: string): string {
    // Already a full URL — return unchanged
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    // No CDN configured — return local path
    if (!CDN_BASE_URL) {
        return path;
    }

    // Strip the /assets/images/ prefix to get the S3 key
    const cleanPath = path.replace(/^\/assets\/images\//, '');

    return `${CDN_BASE_URL}/${cleanPath}`;
}

/**
 * Whether CDN is currently active (env var is set).
 */
export const isCdnEnabled = !!CDN_BASE_URL;

/**
 * The raw CDN base URL (without trailing slash), or empty string.
 */
export { CDN_BASE_URL };
