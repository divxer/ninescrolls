export const ORDER_STATUSES = [
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export const CONTACT_ROLES = [
    'PI', 'RESEARCHER', 'PROCUREMENT', 'FACILITIES',
    'FINANCE', 'LAB_MANAGER', 'OTHER',
] as const;

export type ContactRole = typeof CONTACT_ROLES[number];

export const DOCUMENT_TYPES = [
    'QUOTATION', 'TECHNICAL_SPEC', 'REQUIREMENTS', 'PURCHASE_ORDER',
    'CONTRACT', 'VENDOR_FORM', 'DRAWING', 'TEST_REPORT', 'PROGRESS_PHOTO',
    'SHIPPING_DOC', 'INSTALLATION_DOC', 'TRAINING_RECORD', 'WARRANTY',
    'MAINTENANCE', 'CORRESPONDENCE', 'OTHER',
] as const;

export type DocumentType = typeof DOCUMENT_TYPES[number];

export const VALID_STAGES = [
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'WARRANTY',
] as const;

export const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/zip',
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes

export interface AppSyncEvent {
    info: { fieldName: string; parentTypeName: string };
    arguments: Record<string, unknown>;
    identity?: { sub: string; claims: Record<string, unknown> };
}

export interface OrderItem {
    PK: string;
    SK: string;
    orderId: string;
    status: OrderStatus;
    institution: string;
    department?: string;
    productModel: string;
    productName?: string;
    configuration?: string;
    quoteNumber?: string;
    poNumber?: string;
    quoteAmount?: number;
    notes?: string;
    matchedOrgId?: string;
    source: string;
    rfqId?: string;
    declineReason?: string;
    quoteDate?: string;
    poDate?: string;
    estimatedDelivery?: string;
    productionStartDate?: string;
    shipDate?: string;
    installDate?: string;
    closeDate?: string;
    warrantyEndDate?: string;
    inquiryDate?: string;
    quoteSentDate?: string;
    declinedDate?: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    feedbackScheduleCreated: boolean;
    [key: string]: unknown;
}

export interface ContactItem {
    PK: string;
    SK: string;
    contactId: string;
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    role: ContactRole;
    department?: string;
    isPrimary: boolean;
    feedbackInvite: boolean;
    notes?: string;
}

export interface LogItem {
    PK: string;
    SK: string;
    action: string;
    fromStatus?: OrderStatus;
    toStatus?: OrderStatus;
    operator: string;
    timestamp: string;
    detail?: string;
}

export interface DocumentItem {
    PK: string;
    SK: string;
    docId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    stage: string;
    docType: string;
    description?: string;
    s3Key: string;
    uploadedBy: string;
    uploadedAt: string;
    tags?: string[];
    isLatestVersion: boolean;
}
