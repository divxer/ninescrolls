interface ImageSizes {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  webp?: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  };
}

interface OptimizedImageProps {
  src: string;
  alt: string;
  sizes?: ImageSizes;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

export function OptimizedImage({
  src,
  alt,
  sizes,
  className,
  width,
  height,
  loading = 'lazy'
}: OptimizedImageProps) {
  // Fallback src: ensure it has an extension so S3 can serve it
  const getFallbackSrc = (path: string) => {
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(path)) return path;
    return `${path}.png`;
  };

  // No responsive variants provided: render a plain <img>. Do NOT speculate a
  // sibling .webp — a <source srcSet=missing.webp> inside <picture> hides the
  // <img> fallback when the .webp 404s, producing a broken image.
  if (!sizes) {
    return (
      <img
        src={getFallbackSrc(src)}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading={loading}
      />
    );
  }

  const webpSrcSet = Object.entries(sizes.webp || {})
    .map(([size, path]) => `${path} ${size === 'sm' ? '640w' : size === 'md' ? '768w' : size === 'lg' ? '1024w' : '1280w'}`)
    .join(', ');

  const fallbackSrcSet = Object.entries(sizes)
    .filter(([key]) => key !== 'webp')
    .map(([size, path]) => `${path} ${size === 'sm' ? '640w' : size === 'md' ? '768w' : size === 'lg' ? '1024w' : '1280w'}`)
    .join(', ');

  return (
    <picture>
      {webpSrcSet && <source
        srcSet={webpSrcSet}
        sizes="(max-width: 640px) 100vw,
               (max-width: 768px) 768px,
               (max-width: 1024px) 1024px,
               1280px"
        type="image/webp"
      />}
      <img
        srcSet={fallbackSrcSet}
        src={getFallbackSrc(src)}
        alt={alt}
        sizes="(max-width: 640px) 100vw,
               (max-width: 768px) 768px,
               (max-width: 1024px) 1024px,
               1280px"
        className={className}
        width={width}
        height={height}
        loading={loading}
      />
    </picture>
  );
} 