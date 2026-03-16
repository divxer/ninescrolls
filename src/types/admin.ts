// =============================================================================
// Admin Types — Order Tracker, RFQ Management, Document Management
// =============================================================================

export const ORDER_STATUSES = [
  'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
  'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED', 'DECLINED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CONTACT_ROLES = [
  'PI', 'RESEARCHER', 'PROCUREMENT', 'FACILITIES',
  'FINANCE', 'LAB_MANAGER', 'OTHER',
] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number];

export const DOCUMENT_TYPES = [
  'QUOTATION', 'TECHNICAL_SPEC', 'REQUIREMENTS', 'PURCHASE_ORDER',
  'CONTRACT', 'VENDOR_FORM', 'DRAWING', 'TEST_REPORT', 'PROGRESS_PHOTO',
  'SHIPPING_DOC', 'INSTALLATION_DOC', 'TRAINING_RECORD', 'WARRANTY',
  'MAINTENANCE', 'CORRESPONDENCE', 'OTHER',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// --- Core Entities ---

export interface Order {
  orderId: string;
  quoteNumber?: string | null;
  poNumber?: string | null;
  status: OrderStatus;
  institution: string;
  department?: string | null;
  productModel: string;
  productName?: string | null;
  configuration?: string | null;
  quoteAmount?: number | null;
  notes?: string | null;
  matchedOrgId?: string | null;
  contacts?: OrderContact[] | null;
  quoteDate?: string | null;
  poDate?: string | null;
  estimatedDelivery?: string | null;
  productionStartDate?: string | null;
  shipDate?: string | null;
  installDate?: string | null;
  closeDate?: string | null;
  warrantyEndDate?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByEmail?: string | null;
  feedbackScheduleCreated: boolean;
  feedbackCount: number;
  daysSinceLastUpdate: number;
  source: string;
  rfqId?: string | null;
  declineReason?: string | null;
}

export interface OrderContact {
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  role: ContactRole;
  department?: string | null;
  isPrimary: boolean;
  feedbackInvite: boolean;
  notes?: string | null;
}

export interface OrderLog {
  action: string;
  fromStatus?: OrderStatus | null;
  toStatus?: OrderStatus | null;
  operator: string;
  timestamp: string;
  detail?: string | null;
}

export interface OrderDocument {
  docId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  stage: OrderStatus;
  docType: DocumentType;
  description?: string | null;
  uploadedBy: string;
  uploadedAt: string;
  tags?: string[] | null;
  isLatestVersion: boolean;
  downloadUrl?: string | null;
  previewUrl?: string | null;
}

export interface OrderStats {
  totalActive: number;
  byStatus: Record<string, number>;
  avgDaysToInstall?: number | null;
  upcomingDeliveries: number;
  overdueOrders: number;
}

export interface RfqSubmission {
  rfqId: string;
  referenceNumber?: string | null;
  status: string;
  submittedAt: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  institution?: string | null;
  department?: string | null;
  role?: string | null;
  equipmentCategory?: string | null;
  specificModel?: string | null;
  applicationDescription?: string | null;
  keySpecifications?: string | null;
  quantity?: number | null;
  budgetRange?: string | null;
  timeline?: string | null;
  fundingStatus?: string | null;
  referralSource?: string | null;
  existingEquipment?: string | null;
  additionalComments?: string | null;
  needsBudgetaryQuote?: boolean | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZipCode?: string | null;
  shippingCountry?: string | null;
  linkedOrderId?: string | null;
  attachmentKeys?: unknown;
}

// --- Display Helpers ---

export const STATUS_LABELS: Record<OrderStatus, string> = {
  INQUIRY: 'Inquiry',
  QUOTING: 'Quoting',
  QUOTE_SENT: 'Quote Sent',
  PO_RECEIVED: 'PO Received',
  IN_PRODUCTION: 'In Production',
  SHIPPED: 'Shipped',
  INSTALLED: 'Installed',
  CLOSED: 'Closed',
  DECLINED: 'Declined',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  INQUIRY: '#7c3aed',
  QUOTING: '#2563eb',
  QUOTE_SENT: '#0891b2',
  PO_RECEIVED: '#059669',
  IN_PRODUCTION: '#d97706',
  SHIPPED: '#ea580c',
  INSTALLED: '#16a34a',
  CLOSED: '#6b7280',
  DECLINED: '#dc2626',
};

export const ROLE_LABELS: Record<ContactRole, string> = {
  PI: 'PI',
  RESEARCHER: 'Researcher',
  PROCUREMENT: 'Procurement',
  FACILITIES: 'Facilities',
  FINANCE: 'Finance',
  LAB_MANAGER: 'Lab Manager',
  OTHER: 'Other',
};

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  QUOTATION: 'Quotation',
  TECHNICAL_SPEC: 'Technical Spec',
  REQUIREMENTS: 'Requirements',
  PURCHASE_ORDER: 'Purchase Order',
  CONTRACT: 'Contract',
  VENDOR_FORM: 'Vendor Form',
  DRAWING: 'Drawing',
  TEST_REPORT: 'Test Report',
  PROGRESS_PHOTO: 'Progress Photo',
  SHIPPING_DOC: 'Shipping Doc',
  INSTALLATION_DOC: 'Installation Doc',
  TRAINING_RECORD: 'Training Record',
  WARRANTY: 'Warranty',
  MAINTENANCE: 'Maintenance',
  CORRESPONDENCE: 'Correspondence',
  OTHER: 'Other',
};

export const RFQ_STATUS_COLORS: Record<string, string> = {
  pending: '#7c3aed',
  converted: '#16a34a',
  declined: '#6b7280',
};

export const DECLINE_REASONS = [
  'Equipment not in our product line',
  'Geographic limitation',
  'Customer not responding',
  'Budget mismatch',
  'Duplicate inquiry',
  'Other',
];

export const PRODUCT_MODELS = [
  'ICP', 'PECVD', 'Sputter', 'ALD', 'RIE', 'IBE', 'HDP-CVD', 'Other',
];

// Forward path for status transitions
export const FORWARD_PATH: OrderStatus[] = [
  'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
  'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED',
];

export function getNextStatus(current: OrderStatus): OrderStatus | null {
  const idx = FORWARD_PATH.indexOf(current);
  if (idx === -1 || idx >= FORWARD_PATH.length - 1) return null;
  return FORWARD_PATH[idx + 1];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
