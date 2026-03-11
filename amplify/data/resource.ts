import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { orderApi } from '../functions/order-api/resource';

// =============================================================================
// Schema: Existing models + Order Tracker / RFQ GraphQL API
// =============================================================================

const schema = a.schema({
  // =========================================================================
  // Existing Models (unchanged)
  // =========================================================================

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

      // ─── Page time flush fields ─────────────────────────────────────────
      pageViewId: a.string(),
      sessionId: a.string(),
      tabId: a.string(),
      activeSeconds: a.integer(),
      idleSeconds: a.integer(),
      wallClockSeconds: a.integer(),
      flushReason: a.string(),
      isFinal: a.boolean(),
      flushSequence: a.integer(),

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

  // =========================================================================
  // Enums — §12.4
  // =========================================================================

  OrderStatus: a.enum([
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED',
  ]),

  ContactRole: a.enum([
    'PI', 'RESEARCHER', 'PROCUREMENT', 'FACILITIES',
    'FINANCE', 'LAB_MANAGER', 'OTHER',
  ]),

  DocumentType: a.enum([
    'QUOTATION', 'TECHNICAL_SPEC', 'REQUIREMENTS', 'PURCHASE_ORDER',
    'CONTRACT', 'VENDOR_FORM', 'DRAWING', 'TEST_REPORT', 'PROGRESS_PHOTO',
    'SHIPPING_DOC', 'INSTALLATION_DOC', 'TRAINING_RECORD', 'WARRANTY',
    'MAINTENANCE', 'CORRESPONDENCE', 'OTHER',
  ]),

  // =========================================================================
  // Custom Types — §12.4
  // =========================================================================

  OrderContact: a.customType({
    contactId: a.id().required(),
    contactName: a.string().required(),
    contactEmail: a.string().required(),
    contactPhone: a.string(),
    role: a.ref('ContactRole').required(),
    department: a.string(),
    isPrimary: a.boolean().required(),
    feedbackInvite: a.boolean().required(),
    notes: a.string(),
  }),

  OrderLog: a.customType({
    action: a.string().required(),
    fromStatus: a.ref('OrderStatus'),
    toStatus: a.ref('OrderStatus'),
    operator: a.string().required(),
    timestamp: a.datetime().required(),
    detail: a.string(),
  }),

  OrderDocument: a.customType({
    docId: a.id().required(),
    fileName: a.string().required(),
    fileSize: a.integer().required(),
    mimeType: a.string().required(),
    stage: a.ref('OrderStatus').required(),
    docType: a.ref('DocumentType').required(),
    description: a.string(),
    uploadedBy: a.string().required(),
    uploadedAt: a.datetime().required(),
    tags: a.string().array(),
    isLatestVersion: a.boolean().required(),
    downloadUrl: a.string(),
    previewUrl: a.string(),
  }),

  Order: a.customType({
    orderId: a.id().required(),
    quoteNumber: a.string(),
    poNumber: a.string(),
    status: a.ref('OrderStatus').required(),
    institution: a.string().required(),
    department: a.string(),
    productModel: a.string().required(),
    productName: a.string(),
    configuration: a.string(),
    quoteAmount: a.float(),
    notes: a.string(),
    matchedOrgId: a.string(),
    contacts: a.ref('OrderContact').array(),
    // Dates
    quoteDate: a.date(),
    poDate: a.date(),
    estimatedDelivery: a.date(),
    productionStartDate: a.date(),
    shipDate: a.date(),
    installDate: a.date(),
    closeDate: a.date(),
    warrantyEndDate: a.date(),
    // Metadata
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
    createdBy: a.string().required(),
    // Computed
    feedbackScheduleCreated: a.boolean().required(),
    feedbackCount: a.integer().required(),
    daysSinceLastUpdate: a.integer().required(),
    source: a.string().required(),
    rfqId: a.string(),
    declineReason: a.string(),
  }),

  OrderConnection: a.customType({
    items: a.ref('Order').array().required(),
    nextToken: a.string(),
  }),

  OrderStats: a.customType({
    totalActive: a.integer().required(),
    byStatus: a.json().required(),
    avgDaysToInstall: a.float(),
    upcomingDeliveries: a.integer().required(),
    overdueOrders: a.integer().required(),
  }),

  PresignedUploadUrl: a.customType({
    uploadUrl: a.string().required(),
    s3Key: a.string().required(),
    expiresAt: a.datetime().required(),
  }),

  RfqSubmission: a.customType({
    rfqId: a.id().required(),
    referenceNumber: a.string(),
    status: a.string().required(),
    submittedAt: a.datetime().required(),
    name: a.string(),
    email: a.string(),
    phone: a.string(),
    institution: a.string(),
    department: a.string(),
    role: a.string(),
    equipmentCategory: a.string(),
    specificModel: a.string(),
    applicationDescription: a.string(),
    keySpecifications: a.string(),
    quantity: a.integer(),
    budgetRange: a.string(),
    timeline: a.string(),
    fundingStatus: a.string(),
    referralSource: a.string(),
    existingEquipment: a.string(),
    additionalComments: a.string(),
    needsBudgetaryQuote: a.boolean(),
    shippingAddress: a.string(),
    shippingCity: a.string(),
    shippingState: a.string(),
    shippingZipCode: a.string(),
    shippingCountry: a.string(),
    linkedOrderId: a.string(),
    attachmentKeys: a.json(),
  }),

  RfqConnection: a.customType({
    items: a.ref('RfqSubmission').array().required(),
    nextToken: a.string(),
  }),

  // =========================================================================
  // Queries — §12.4
  // =========================================================================

  listOrders: a
    .query()
    .arguments({
      status: a.ref('OrderStatus'),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('OrderConnection').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  getOrder: a
    .query()
    .arguments({ orderId: a.id().required() })
    .returns(a.ref('Order'))
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  getOrderLogs: a
    .query()
    .arguments({ orderId: a.id().required() })
    .returns(a.ref('OrderLog').array().required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  orderStats: a
    .query()
    .returns(a.ref('OrderStats').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  listOrderDocuments: a
    .query()
    .arguments({
      orderId: a.id().required(),
      stage: a.ref('OrderStatus'),
      docType: a.ref('DocumentType'),
    })
    .returns(a.ref('OrderDocument').array().required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  getDocumentUploadUrl: a
    .query()
    .arguments({
      orderId: a.id().required(),
      fileName: a.string().required(),
      mimeType: a.string().required(),
    })
    .returns(a.ref('PresignedUploadUrl').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  listRfqs: a
    .query()
    .arguments({
      status: a.string(),
      limit: a.integer(),
      nextToken: a.string(),
    })
    .returns(a.ref('RfqConnection').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  getRfq: a
    .query()
    .arguments({ rfqId: a.id().required() })
    .returns(a.ref('RfqSubmission'))
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  // =========================================================================
  // Mutations — §12.4
  // =========================================================================

  createOrder: a
    .mutation()
    .arguments({ input: a.json().required() })
    .returns(a.ref('Order').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  updateOrderStatus: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      newStatus: a.ref('OrderStatus').required(),
      statusDate: a.date(),
      note: a.string(),
    })
    .returns(a.ref('Order').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  updateOrder: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      input: a.json().required(),
    })
    .returns(a.ref('Order').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  addContact: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      input: a.json().required(),
    })
    .returns(a.ref('OrderContact').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  updateContact: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      contactId: a.id().required(),
      input: a.json().required(),
    })
    .returns(a.ref('OrderContact').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  removeContact: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      contactId: a.id().required(),
    })
    .returns(a.boolean().required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  declineInquiry: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      reason: a.string().required(),
      note: a.string(),
    })
    .returns(a.ref('Order').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  confirmDocumentUpload: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      s3Key: a.string().required(),
      fileName: a.string().required(),
      mimeType: a.string().required(),
      fileSize: a.integer().required(),
      stage: a.string().required(),
      docType: a.string().required(),
      description: a.string(),
      tags: a.json(),
    })
    .returns(a.ref('OrderDocument').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  updateDocument: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      docId: a.id().required(),
      description: a.string(),
      docType: a.string(),
      tags: a.json(),
    })
    .returns(a.ref('OrderDocument').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  deleteDocument: a
    .mutation()
    .arguments({
      orderId: a.id().required(),
      docId: a.id().required(),
    })
    .returns(a.boolean().required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  declineRfq: a
    .mutation()
    .arguments({
      rfqId: a.id().required(),
      reason: a.string(),
    })
    .returns(a.ref('RfqSubmission').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  revertRfqToPending: a
    .mutation()
    .arguments({
      rfqId: a.id().required(),
    })
    .returns(a.ref('RfqSubmission').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  convertRfqToOrder: a
    .mutation()
    .arguments({
      rfqId: a.id().required(),
      productModel: a.string(),
      productName: a.string(),
      configuration: a.string(),
      quoteAmount: a.float(),
      notes: a.string(),
    })
    .returns(a.ref('Order').required())
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),

  // =========================================================================
  // Subscriptions — §12.4
  // =========================================================================

  onOrderStatusChange: a
    .subscription()
    .for(a.ref('updateOrderStatus'))
    .handler(a.handler.function(orderApi))
    .authorization((allow) => [allow.authenticated()]),
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
