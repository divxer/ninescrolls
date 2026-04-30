import { cdnUrl } from '../config/imageConfig';

const BASE = '/assets/images/hero-cleanroom';
const sizes = ['sm', 'md', 'lg', 'xl'] as const;
const widths = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

const buildSrcSet = (ext: 'webp' | 'jpg') =>
  sizes.map(s => `${cdnUrl(`${BASE}-${s}.${ext}`)} ${widths[s]}w`).join(', ');

interface Props {
  alt?: string;
  priority?: boolean;
}

export function HeroCleanroomBackground({ alt = '', priority = true }: Props) {
  return (
    <picture>
      <source type="image/webp" srcSet={buildSrcSet('webp')} sizes="100vw" />
      <img
        className="w-full h-full object-cover"
        src={cdnUrl(`${BASE}-lg.jpg`)}
        srcSet={buildSrcSet('jpg')}
        sizes="100vw"
        alt={alt}
        width={1536}
        height={1024}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
      />
    </picture>
  );
}
