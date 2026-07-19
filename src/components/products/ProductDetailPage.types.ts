export interface ProductDetailMetric {
  label: string;
  value: string;
}

export interface ProductDetailImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ProductDetailTagCard {
  title: string;
  copy: string;
  details: string[];
}

export interface ProductDetailTextCard {
  title: string;
  copy: string;
}

export interface ProductDetailResource {
  title: string;
  href: string;
  meta: string;
}

export interface ProductDetailAction {
  label: string;
  href: string;
}

export interface ProductDetailCommerceVariant {
  sku: string;
  label: string;
  price: number;
  cartName?: string;
}

export interface ProductDetailCommerce {
  variants: [ProductDetailCommerceVariant, ...ProductDetailCommerceVariant[]];
  defaultSku?: string;
  addToCartLabel?: string;
  quoteAction: ProductDetailAction;
}

export interface ProductDetailDatasheet {
  fileUrl: string;
  fileName: string;
  title: string;
  buttonLabel: string;
}

export interface ProductDetailGalleryImage extends ProductDetailImage {
  label?: string;
}

export interface ProductDetailGallerySection {
  eyebrow?: string;
  heading: string;
  copy?: string;
  images: ProductDetailGalleryImage[];
}

export interface ProductDetailConfig {
  slug: string;
  /**
   * Optional override: the product-line slug used to query published Evidence,
   * for a page whose evidence lives under a slug other than its per-SKU `slug`.
   * Defaults to `slug` when omitted. No config currently sets this — the Pluto
   * SKU pages query per-model by their own `slug`, and the plasma-cleaner overview
   * mounts `<ProductEvidence productSlug="plasma-cleaner">` directly. Kept as a
   * general escape hatch for future lines where the two slugs diverge.
   */
  evidenceProductSlug?: string;
  seo: {
    title: string;
    description: string;
    keywords: string;
  };
  schema: {
    name: string;
    description: string;
    sku: string;
    category: string;
  };
  faq: Array<{
    question: string;
    answer: string;
  }>;
  breadcrumb: {
    parentLabel: string;
    parentHref: string;
    current: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    backgroundImage?: string;
    image: ProductDetailImage;
    stats: ProductDetailMetric[];
    primaryAction: ProductDetailAction;
    secondaryAction: ProductDetailAction;
  };
  commerce?: ProductDetailCommerce;
  datasheet: ProductDetailDatasheet;
  processIntro: {
    eyebrow: string;
    title: string;
    copy: string;
    windows: ProductDetailTagCard[];
  };
  coreWindows: {
    eyebrow: string;
    title: string;
    compareAction: ProductDetailAction;
    cards: ProductDetailTextCard[];
  };
  specifications: {
    eyebrow: string;
    title: string;
    copy: string;
    testId: string;
    items: ProductDetailMetric[];
  };
  applications: {
    eyebrow: string;
    title: string;
    items: string[];
  };
  gallery?: ProductDetailGallerySection;
  resources?: {
    eyebrow: string;
    title: string;
    items: ProductDetailResource[];
  };
  finalCta: {
    eyebrow: string;
    title: string;
    copy: string;
    primaryAction: ProductDetailAction;
    secondaryAction: ProductDetailAction;
    backgroundImage: string;
  };
}
