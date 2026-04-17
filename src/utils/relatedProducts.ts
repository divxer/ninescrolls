import type { RelatedProduct } from '../types';

interface ProductMatcher {
  href: string;
  label: string;
  subtitle: string;
  patterns: RegExp[];
}

const PRODUCT_MATCHERS: ProductMatcher[] = [
  {
    href: '/products/rie-etcher',
    label: 'RIE Etcher Series',
    subtitle: 'Reactive Ion Etching System',
    patterns: [/\bRIE\b/, /reactive ion etch/i, /plasma etch(?:ing|er)?\b/i],
  },
  {
    href: '/products/icp-etcher',
    label: 'ICP Etcher Series',
    subtitle: 'Inductively Coupled Plasma Etching',
    patterns: [/\bICP[\s-]?RIE\b/i, /\bICP\b.*etch/i, /inductively coupled plasma/i, /\bDRIE\b/, /Bosch process/i],
  },
  {
    href: '/products/compact-rie',
    label: 'Compact RIE (SV-RIE)',
    subtitle: 'Ultra-Compact Reactive Ion Etching',
    patterns: [/compact RIE/i, /SV-RIE/i, /small.*footprint.*RIE/i],
  },
  {
    href: '/products/ald',
    label: 'ALD System Series',
    subtitle: 'Atomic Layer Deposition',
    patterns: [/\bALD\b/, /atomic layer deposition/i, /\bAl[₂2]O[₃3]\b/, /\bHfO[₂2]\b/],
  },
  {
    href: '/products/hdp-cvd',
    label: 'HDP-CVD System Series',
    subtitle: 'High-Density Plasma CVD',
    patterns: [/\bHDP[\s-]?CVD\b/i, /high[\s-]?density plasma.*CVD/i, /gap[\s-]?fill/i],
  },
  {
    href: '/products/pecvd',
    label: 'PECVD System Series',
    subtitle: 'Plasma-Enhanced CVD',
    patterns: [/\bPECVD\b/, /plasma[\s-]?enhanced.*CVD/i],
  },
  {
    href: '/products/sputter',
    label: 'Sputter System Series',
    subtitle: 'PVD Magnetron Sputtering',
    patterns: [/\bsputter/i, /\bPVD\b/, /magnetron/i, /physical vapor deposition/i],
  },
  {
    href: '/products/ibe-ribe',
    label: 'IBE/RIBE System Series',
    subtitle: 'Ion Beam Etching',
    patterns: [/\bIBE\b/, /\bRIBE\b/, /ion beam etch/i, /ion milling/i],
  },
  {
    href: '/products/striper',
    label: 'Plasma Striper Series',
    subtitle: 'Photoresist Stripping & Ashing',
    patterns: [/photoresist strip/i, /plasma strip/i, /resist ash/i, /plasma ash/i],
  },
  {
    href: '/products/coater-developer',
    label: 'Coater/Developer System',
    subtitle: 'Photoresist Coating Equipment',
    patterns: [/spin coat/i, /photoresist coat/i, /coater.*developer/i, /lithography.*coat/i],
  },
  {
    href: '/products/plasma-cleaner',
    label: 'Plasma Cleaner Systems',
    subtitle: 'Surface Treatment & Cleaning',
    patterns: [/plasma clean/i, /surface treatment/i, /plasma treat/i],
  },
];

export function detectRelatedProducts(content: string, limit = 5): RelatedProduct[] {
  const text = content.replace(/<[^>]+>/g, ' ');

  const scored = PRODUCT_MATCHERS.map(matcher => {
    let score = 0;
    for (const pattern of matcher.patterns) {
      const matches = text.match(new RegExp(pattern.source, pattern.flags + 'g'));
      if (matches) score += matches.length;
    }
    return { ...matcher, score };
  })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ href, label, subtitle }) => ({ href, label, subtitle }));
}
