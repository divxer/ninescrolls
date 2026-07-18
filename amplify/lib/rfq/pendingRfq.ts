// amplify/lib/rfq/pendingRfq.ts

/**
 * Whitelisted persisted submission fields. The parameter type IS the whitelist —
 * turnstileToken, submitIdempotencyKey, draft credentials, and raw attachmentKeys are
 * structurally absent. `email` is the already-normalized (lowercased/NFC) value from
 * the validated rfqSchema; it is stored verbatim.
 */
export interface PendingRfqSource {
  name: string; email: string; phone?: string; institution: string; department?: string;
  role?: string; equipmentCategory: string; specificModel?: string; applicationDescription: string;
  keySpecifications?: string; quantity: number; budgetRange?: string; timeline?: string;
  fundingStatus?: string; referralSource?: string; existingEquipment?: string; additionalComments?: string;
  needsBudgetaryQuote?: boolean; shippingAddress?: string; shippingCity?: string; shippingState?: string;
  shippingZipCode?: string; shippingCountry?: string; visitorId?: string; referrerSource?: string;
}

export interface PendingRfqMeta { rfqId: string; submittedAt: string; ipHash: string; referenceNumber: string }

export interface PendingRfqItem {
  PK: string; SK: 'META'; GSI1PK: 'RFQ_STATUS#pending'; GSI1SK: string; GSI4PK: string; GSI4SK: string;
  GSI2SK: string; rfqId: string; referenceNumber: string; status: 'pending'; submittedAt: string;
  ipHash: string; name: string; email: string; institution: string; equipmentCategory: string;
  applicationDescription: string; quantity: number; needsBudgetaryQuote: boolean; TTL: 0;
  [attr: string]: unknown;
}

function putIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) target[key] = value;
}

/**
 * Authoritative pending RFQ item from the validated submission. Both submit paths
 * write THIS to RFQ#<rfqId>/META, so parity holds by construction. Omits matchedOrgId/
 * GSI2PK (org effect backfills) and attachmentKeys (attachment effect backfills).
 */
export function buildPendingRfqItem(source: PendingRfqSource, meta: PendingRfqMeta): PendingRfqItem {
  const normalizedEmail = source.email.trim().toLowerCase();
  const item: PendingRfqItem = {
    PK: `RFQ#${meta.rfqId}`, SK: 'META',
    GSI1PK: 'RFQ_STATUS#pending', GSI1SK: `${meta.submittedAt}#${meta.rfqId}`,
    GSI4PK: `EMAIL#${normalizedEmail}`, GSI4SK: `RFQ#${meta.submittedAt}`, GSI2SK: `RFQ#${meta.submittedAt}`,
    rfqId: meta.rfqId, referenceNumber: meta.referenceNumber, status: 'pending',
    submittedAt: meta.submittedAt, ipHash: meta.ipHash,
    // Single source: item.email and GSI4PK both come from normalizedEmail, so they
    // cannot diverge even if an un-normalized value ever reaches the builder. For the
    // already-normalized rfqSchema email this is a no-op (byte-identical to the live item).
    name: source.name, email: normalizedEmail, institution: source.institution,
    equipmentCategory: source.equipmentCategory, applicationDescription: source.applicationDescription,
    quantity: source.quantity, needsBudgetaryQuote: source.needsBudgetaryQuote ?? false, TTL: 0,
  };
  putIfDefined(item, 'visitorId', source.visitorId);
  putIfDefined(item, 'phone', source.phone);
  putIfDefined(item, 'department', source.department);
  putIfDefined(item, 'role', source.role);
  putIfDefined(item, 'specificModel', source.specificModel);
  putIfDefined(item, 'keySpecifications', source.keySpecifications);
  putIfDefined(item, 'budgetRange', source.budgetRange);
  putIfDefined(item, 'timeline', source.timeline);
  putIfDefined(item, 'fundingStatus', source.fundingStatus);
  putIfDefined(item, 'referralSource', source.referralSource);
  putIfDefined(item, 'existingEquipment', source.existingEquipment);
  putIfDefined(item, 'additionalComments', source.additionalComments);
  putIfDefined(item, 'shippingAddress', source.shippingAddress);
  putIfDefined(item, 'shippingCity', source.shippingCity);
  putIfDefined(item, 'shippingState', source.shippingState);
  putIfDefined(item, 'shippingZipCode', source.shippingZipCode);
  putIfDefined(item, 'shippingCountry', source.shippingCountry);
  putIfDefined(item, 'referrerSource', source.referrerSource);
  return item;
}
