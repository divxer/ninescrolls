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
      thumbnail: a.string(),
      images: a.string().array(),
      features: a.string().array(),
      specifications: a.string().array(),
      options: a.string().array(),
      deliveryAndService: a.string(),
      downloads: a.json(), // Store as JSON array: [{name: string, url: string}]
      partnerNote: a.string(),
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