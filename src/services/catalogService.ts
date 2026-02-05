import { generateClient } from 'aws-amplify/api';
import type { ProductRecord, ManufacturerRecord, CategoryRecord, InsightsPost, DownloadItem, ProductVariant } from '../types';
import { seedProducts, seedManufacturers, seedCategories } from '../data/seed';
import { insightsPosts, categories as insightCategories } from '../types';

const client = generateClient();

const hasModel = (name: string) => {
  const models = (client as unknown as { models?: Record<string, unknown> }).models;
  return Boolean(models && models[name]);
};

const normalizeDownloads = (downloads: unknown): DownloadItem[] => {
  if (!downloads) return [];
  if (Array.isArray(downloads)) {
    return downloads.filter((item) => item && typeof item === 'object') as DownloadItem[];
  }
  if (typeof downloads === 'string') {
    try {
      const parsed = JSON.parse(downloads);
      return Array.isArray(parsed) ? (parsed as DownloadItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeVariants = (variants: unknown): ProductVariant[] => {
  if (!variants) return [];
  if (Array.isArray(variants)) return variants as ProductVariant[];
  if (typeof variants === 'string') {
    try {
      const parsed = JSON.parse(variants);
      return Array.isArray(parsed) ? (parsed as ProductVariant[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeObjectArray = <T extends Record<string, unknown>>(value: unknown): T[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object') as T[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapProduct = (item: Record<string, unknown>): ProductRecord => {
  return {
    id: String(item.id || ''),
    slug: String(item.slug || ''),
    name: String(item.name || ''),
    category: String(item.category || ''),
    typeTag: typeof item.typeTag === 'string' ? item.typeTag : undefined,
    shortDesc: typeof item.shortDesc === 'string' ? item.shortDesc : undefined,
    bullets: Array.isArray(item.bullets) ? (item.bullets as string[]) : undefined,
    schematicImage: typeof item.schematicImage === 'string' ? item.schematicImage : undefined,
    schematicCaption: typeof item.schematicCaption === 'string' ? item.schematicCaption : undefined,
    images: Array.isArray(item.images) ? (item.images as string[]) : undefined,
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : undefined,
    features: Array.isArray(item.features) ? (item.features as string[]) : undefined,
    specifications: Array.isArray(item.specifications) ? (item.specifications as string[]) : undefined,
    options: Array.isArray(item.options) ? (item.options as string[]) : undefined,
    deliveryAndService: typeof item.deliveryAndService === 'string' ? item.deliveryAndService : undefined,
    downloads: normalizeDownloads(item.downloads),
    partnerNote: typeof item.partnerNote === 'string' ? item.partnerNote : undefined,
    manufacturerId: typeof item.manufacturerId === 'string' ? item.manufacturerId : undefined,
    applications: Array.isArray(item.applications) ? (item.applications as string[]) : undefined,
    processResults: Array.isArray(item.processResults) ? (item.processResults as string[]) : undefined,
    useCases: Array.isArray(item.useCases) ? (item.useCases as string[]) : undefined,
    resultsHighlights: Array.isArray(item.resultsHighlights) ? (item.resultsHighlights as string[]) : undefined,
    keyCharacteristics: Array.isArray(item.keyCharacteristics) ? (item.keyCharacteristics as string[]) : undefined,
    supportIntegration: Array.isArray(item.supportIntegration) ? (item.supportIntegration as string[]) : undefined,
    whoUsesStats: normalizeObjectArray<{ label: string; value: string; detail?: string }>(item.whoUsesStats),
    positioningNote: typeof item.positioningNote === 'string' ? item.positioningNote : undefined,
    costEffectivePoints: Array.isArray(item.costEffectivePoints) ? (item.costEffectivePoints as string[]) : undefined,
    expectations: Array.isArray(item.expectations) ? (item.expectations as string[]) : undefined,
    heroSubtitle: typeof item.heroSubtitle === 'string' ? item.heroSubtitle : undefined,
    variants: normalizeVariants(item.variants),
  };
};

const mapManufacturer = (item: Record<string, unknown>): ManufacturerRecord => {
  return {
    id: String(item.id || ''),
    slug: String(item.slug || ''),
    name: String(item.name || ''),
    logo: typeof item.logo === 'string' ? item.logo : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    highlights: Array.isArray(item.highlights) ? (item.highlights as string[]) : undefined,
    supportPolicy: typeof item.supportPolicy === 'string' ? item.supportPolicy : undefined,
    caseHighlights: Array.isArray(item.caseHighlights) ? (item.caseHighlights as string[]) : undefined,
  };
};

const mapCategory = (item: Record<string, unknown>): CategoryRecord => {
  return {
    id: String(item.id || ''),
    name: String(item.name || ''),
    description: typeof item.description === 'string' ? item.description : undefined,
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    productCount: typeof item.productCount === 'number' ? item.productCount : undefined,
    manufacturerCount: typeof item.manufacturerCount === 'number' ? item.manufacturerCount : undefined,
  };
};

export async function listProducts(): Promise<ProductRecord[]> {
  if (!hasModel('Product')) {
    return seedProducts;
  }
  try {
    const { data } = await (client as any).models.Product.list();
    if (!data || data.length === 0) return seedProducts;
    return (data as Record<string, unknown>[]).map(mapProduct);
  } catch {
    return seedProducts;
  }
}

export async function getProductBySlug(slug: string): Promise<ProductRecord | null> {
  const products = await listProducts();
  const normalized = slug.trim().toLowerCase();
  const match = products.find((product) => {
    const productSlug = product.slug ? product.slug.toLowerCase() : '';
    const productId = product.id ? product.id.toLowerCase() : '';
    return productSlug === normalized || productId === normalized;
  });
  if (match) return match;
  return seedProducts.find((product) => {
    const productSlug = product.slug ? product.slug.toLowerCase() : '';
    const productId = product.id ? product.id.toLowerCase() : '';
    return productSlug === normalized || productId === normalized;
  }) || null;
}

export async function listManufacturers(): Promise<ManufacturerRecord[]> {
  if (!hasModel('Manufacturer')) {
    return seedManufacturers;
  }
  try {
    const { data } = await (client as any).models.Manufacturer.list();
    if (!data || data.length === 0) return seedManufacturers;
    return (data as Record<string, unknown>[]).map(mapManufacturer);
  } catch {
    return seedManufacturers;
  }
}

export async function listCategories(): Promise<CategoryRecord[]> {
  if (!hasModel('Category')) {
    return seedCategories;
  }
  try {
    const { data } = await (client as any).models.Category.list();
    if (!data || data.length === 0) return seedCategories;
    return (data as Record<string, unknown>[]).map(mapCategory);
  } catch {
    return seedCategories;
  }
}

export async function listInsights(): Promise<InsightsPost[]> {
  if (!hasModel('InsightPost')) {
    return insightsPosts;
  }
  try {
    const { data } = await (client as any).models.InsightPost.list();
    if (!data || data.length === 0) return insightsPosts;
    return data as InsightsPost[];
  } catch {
    return insightsPosts;
  }
}

export async function getInsightBySlug(slug: string): Promise<InsightsPost | null> {
  const posts = await listInsights();
  return posts.find((post) => post.slug === slug) || null;
}

export async function listInsightCategories(): Promise<string[]> {
  if (!hasModel('InsightPost')) {
    return insightCategories;
  }
  const posts = await listInsights();
  const categories = new Set<string>(['All']);
  posts.forEach((post) => categories.add(post.category));
  return Array.from(categories);
}
