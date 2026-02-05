import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import outputs from '../amplify_outputs.json';
import { seedProducts, seedManufacturers, seedCategories } from '../src/data/seed';
import { insightsPosts } from '../src/types';
import type { ProductRecord, ManufacturerRecord, CategoryRecord, InsightsPost } from '../src/types';

Amplify.configure(outputs);
const client = generateClient();

type ModelFieldsMap = Record<string, { fields: Record<string, { isReadOnly?: boolean }> }>;

const modelFields = (outputs as any)?.data?.model_introspection?.models as ModelFieldsMap | undefined;

const getAllowedFields = (modelName: string) => {
  const fields = modelFields?.[modelName]?.fields;
  if (!fields) return null;
  return Object.keys(fields).filter((field) => !fields[field]?.isReadOnly);
};

const sanitizeRecord = <T extends Record<string, any>>(modelName: string, item: T) => {
  const allowed = getAllowedFields(modelName);
  if (!allowed) return { ...item };
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => allowed.includes(key))
  ) as T;
};

const stripUndefined = <T extends Record<string, any>>(item: T) =>
  Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) as T;

async function upsertManufacturers() {
  const { data } = await (client as any).models.Manufacturer.list();
  const existing = new Map<string, ManufacturerRecord>();
  (data || []).forEach((m: ManufacturerRecord) => existing.set(m.slug, m));

  for (const manufacturer of seedManufacturers) {
    const current = existing.get(manufacturer.slug);
    if (current) {
      const payload = stripUndefined(sanitizeRecord('Manufacturer', {
        ...manufacturer,
        id: current.id,
      }));
      await (client as any).models.Manufacturer.update(payload);
      continue;
    }
    await (client as any).models.Manufacturer.create(
      stripUndefined(sanitizeRecord('Manufacturer', manufacturer))
    );
  }
}

async function upsertCategories() {
  const { data } = await (client as any).models.Category.list();
  const existing = new Map<string, CategoryRecord>();
  (data || []).forEach((c: CategoryRecord) => existing.set(c.name, c));

  for (const category of seedCategories) {
    const current = existing.get(category.name);
    if (current) {
      const payload = stripUndefined(sanitizeRecord('Category', {
        ...category,
        id: current.id,
      }));
      await (client as any).models.Category.update(payload);
      continue;
    }
    await (client as any).models.Category.create(
      stripUndefined(sanitizeRecord('Category', category))
    );
  }
}

async function upsertProducts() {
  const { data } = await (client as any).models.Product.list();
  const existing = new Map<string, ProductRecord>();
  (data || []).forEach((p: ProductRecord) => existing.set(p.slug, p));

  for (const product of seedProducts) {
    const current = existing.get(product.slug);
    if (current) {
      const payload = stripUndefined(sanitizeRecord('Product', {
        ...product,
        id: current.id,
      }));
      await (client as any).models.Product.update(payload);
      continue;
    }
    await (client as any).models.Product.create(
      stripUndefined(sanitizeRecord('Product', product))
    );
  }
}

async function upsertInsights() {
  const { data } = await (client as any).models.InsightPost.list();
  const existing = new Map<string, InsightsPost>();
  (data || []).forEach((p: InsightsPost) => existing.set(p.slug, p));

  for (const post of insightsPosts) {
    const current = existing.get(post.slug);
    if (current) {
      const payload = stripUndefined(sanitizeRecord('InsightPost', {
        ...post,
        id: current.id,
      }));
      await (client as any).models.InsightPost.update(payload);
      continue;
    }
    await (client as any).models.InsightPost.create(
      stripUndefined(sanitizeRecord('InsightPost', post))
    );
  }
}

async function run() {
  try {
    await upsertManufacturers();
    await upsertCategories();
    await upsertProducts();
    await upsertInsights();
    console.log('Seed completed.');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

run();
