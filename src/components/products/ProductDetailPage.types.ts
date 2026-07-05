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

export interface ProductDetailResearchCard {
  eyebrow: string;
  title: string;
  meta: string;
}

export interface ProductDetailResource {
  title: string;
  href: string;
  meta: string;
}

export interface ProductDetailGalleryImage {
  src: string;
  alt: string;
  label?: string;
  width: number;
  height: number;
}

export interface ProductDetailGallerySection {
  eyebrow?: string;
  heading: string;
  copy?: string;
  images: ProductDetailGalleryImage[];
}

export interface ProductDetailAction {
  label: string;
  href: string;
}

export interface ProductDetailDatasheet {
  fileUrl: string;
  fileName: string;
  title: string;
  buttonLabel: string;
}

export interface ProductDetailConfig {
  slug: string;
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
  research?: {
    eyebrow: string;
    title: string;
    cards: ProductDetailResearchCard[];
  };
  resources?: {
    eyebrow: string;
    title: string;
    items: ProductDetailResource[];
  };
  gallery?: ProductDetailGallerySection;
  finalCta: {
    eyebrow: string;
    title: string;
    copy: string;
    primaryAction: ProductDetailAction;
    secondaryAction: ProductDetailAction;
    backgroundImage: string;
  };
}
