import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Product: a
    .model({
      id: a.id().required(),
      slug: a.string().required(),
      name: a.string().required(),
      category: a.string().required(),
      typeTag: a.string(),
      shortDesc: a.string(),
      bullets: a.string().array(),
      heroSubtitle: a.string(),
      schematicImage: a.string(),
      schematicCaption: a.string(),
      applications: a.string().array(),
      thumbnail: a.string(),
      images: a.string().array(),
      features: a.string().array(),
      specifications: a.string().array(),
      options: a.string().array(),
      deliveryAndService: a.string(),
      downloads: a.json(), // Store as JSON array: [{name: string, url: string}]
      variants: a.json(), // Store as JSON array: [{id, name, price, label, description}]
      partnerNote: a.string(),
      processResults: a.string().array(),
      useCases: a.string().array(),
      resultsHighlights: a.string().array(),
      keyCharacteristics: a.string().array(),
      supportIntegration: a.string().array(),
      whoUsesStats: a.json(),
      positioningNote: a.string(),
      costEffectivePoints: a.string().array(),
      expectations: a.string().array(),
      manufacturerId: a.id(),
      manufacturer: a.belongsTo('Manufacturer', 'manufacturerId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Manufacturer: a
    .model({
      id: a.id().required(),
      slug: a.string().required(),
      name: a.string().required(),
      logo: a.string(),
      description: a.string(),
      highlights: a.string().array(),
      supportPolicy: a.string(),
      caseHighlights: a.string().array(),
      products: a.hasMany('Product', 'manufacturerId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Category: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      icon: a.string(),
      productCount: a.integer(),
      manufacturerCount: a.integer(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  InsightPost: a
    .model({
      id: a.id().required(),
      title: a.string().required(),
      content: a.string(),
      excerpt: a.string(),
      author: a.string().required(),
      publishDate: a.string().required(),
      category: a.string().required(),
      readTime: a.integer().required(),
      imageUrl: a.string().required(),
      slug: a.string().required(),
      tags: a.string().array(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
