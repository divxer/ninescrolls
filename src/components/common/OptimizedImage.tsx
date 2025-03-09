import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

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
  // Convert regular image path to WebP
  const getWebPPath = (path: string) => {
    const parts = path.split('.');
    parts.pop(); // Remove extension
    return `${parts.join('.')}.webp`;
  };

  if (!sizes) {
    // Simple image with WebP fallback
    return (
      <picture>
        <source srcSet={getWebPPath(src)} type="image/webp" />
        <LazyLoadImage
          src={src}
          alt={alt}
          className={className}
          width={width}
          height={height}
          loading={loading}
          effect="blur"
        />
      </picture>
    );
  }

  // Construct srcSet for WebP
  const webpSrcSet = Object.entries(sizes.webp || {})
    .map(([size, path]) => `${path} ${size === 'sm' ? '640w' : size === 'md' ? '768w' : size === 'lg' ? '1024w' : '1280w'}`)
    .join(', ');

  // Construct srcSet for fallback images
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
      <LazyLoadImage
        srcSet={fallbackSrcSet}
        src={src}
        alt={alt}
        sizes="(max-width: 640px) 100vw,
               (max-width: 768px) 768px,
               (max-width: 1024px) 1024px,
               1280px"
        className={className}
        width={width}
        height={height}
        loading={loading}
        effect="blur"
      />
    </picture>
  );
} 