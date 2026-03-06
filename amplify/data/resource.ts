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

  InsightsPost: a
    .model({
      id: a.id().required(),
      slug: a.string().required(),
      title: a.string().required(),
      content: a.string(),
      excerpt: a.string(),
      author: a.string().required(),
      publishDate: a.string().required(),
      category: a.string().required(),
      readTime: a.integer().required(),
      imageUrl: a.string().required(),
      tags: a.string().array(),
      relatedProducts: a.json(),
      heroImages: a.json(),
      isStandaloneComponent: a.boolean(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['read']),
      allow.authenticated(),
    ])
    .secondaryIndexes((index) => [index('slug')]),

  AnalyticsEvent: a
    .model({
      id: a.id().required(),
      eventName: a.string().required(),
      eventType: a.string().required(),
      timestamp: a.datetime().required(),

      ip: a.string(),
      country: a.string(),
      region: a.string(),
      city: a.string(),
      org: a.string(),
      isp: a.string(),

      isTargetCustomer: a.boolean(),
      organizationType: a.string(),
      orgName: a.string(),
      confidence: a.float(),
      finalConfidence: a.float(),
      leadTier: a.string(),

      behaviorScore: a.float(),
      productPagesViewed: a.integer(),
      timeOnSite: a.integer(),
      pdfDownloads: a.integer(),
      returnVisits: a.integer(),
      isPaidTraffic: a.boolean(),
      trafficChannel: a.string(),
      utmTerm: a.string(),

      pathname: a.string(),
      pageTitle: a.string(),
      productId: a.string(),
      productName: a.string(),
      referrer: a.string(),

      visitorId: a.string(),

      userAgent: a.string(),
      isBot: a.boolean(),
      latitude: a.float(),
      longitude: a.float(),

      aiOrganizationType: a.string(),
      aiConfidence: a.float(),
      aiReason: a.string(),

      properties: a.json(),
    })
    .authorization((allow) => [
      allow.publicApiKey().to(['create']),
      allow.authenticated(),
    ])
    .secondaryIndexes((index) => [
      index('eventType').sortKeys(['timestamp']),
      index('leadTier').sortKeys(['timestamp']),
    ]),
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