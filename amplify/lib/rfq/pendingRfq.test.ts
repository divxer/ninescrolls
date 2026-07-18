// amplify/lib/rfq/pendingRfq.test.ts
import { describe, it, expect } from 'vitest';
import { buildPendingRfqItem, type PendingRfqSource, type PendingRfqMeta } from './pendingRfq';

const META: PendingRfqMeta = {
  rfqId: 'rfq-20260718-abc123', submittedAt: '2026-07-18T09:30:00.000Z',
  ipHash: 'a'.repeat(64), referenceNumber: 'RFQ-20260718-ABC1',
};

// email arrives ALREADY normalized (lowercased/NFC) by the rfqSchema transform.
const FULL: PendingRfqSource = {
  name: 'Ada Lovelace', email: 'ada@example.edu', phone: '+1-555-0100',
  institution: 'Analytical Engine Lab', department: 'Computing', role: 'professor',
  equipmentCategory: 'RIE', specificModel: 'RIE-500',
  applicationDescription: 'Etching test structures for a research programme.',
  keySpecifications: '4-inch wafers', quantity: 2, budgetRange: '100k-250k',
  timeline: 'within-3-months', fundingStatus: 'funded', referralSource: 'referral',
  existingEquipment: 'Old mill', additionalComments: 'None', needsBudgetaryQuote: true,
  shippingAddress: '1 Engine Way', shippingCity: 'London', shippingState: 'LDN',
  shippingZipCode: 'EC1', shippingCountry: 'UK', visitorId: 'visitor-xyz',
  referrerSource: 'insights/rie-guide',
};

describe('buildPendingRfqItem', () => {
  it('builds the full authoritative pending projection', () => {
    expect(buildPendingRfqItem(FULL, META)).toEqual({
      PK: 'RFQ#rfq-20260718-abc123', SK: 'META',
      GSI1PK: 'RFQ_STATUS#pending', GSI1SK: '2026-07-18T09:30:00.000Z#rfq-20260718-abc123',
      GSI4PK: 'EMAIL#ada@example.edu', GSI4SK: 'RFQ#2026-07-18T09:30:00.000Z',
      GSI2SK: 'RFQ#2026-07-18T09:30:00.000Z',
      rfqId: 'rfq-20260718-abc123', referenceNumber: 'RFQ-20260718-ABC1', status: 'pending',
      submittedAt: '2026-07-18T09:30:00.000Z', ipHash: 'a'.repeat(64), visitorId: 'visitor-xyz',
      name: 'Ada Lovelace', email: 'ada@example.edu', phone: '+1-555-0100',
      institution: 'Analytical Engine Lab', department: 'Computing', role: 'professor',
      equipmentCategory: 'RIE', specificModel: 'RIE-500',
      applicationDescription: 'Etching test structures for a research programme.',
      keySpecifications: '4-inch wafers', quantity: 2, budgetRange: '100k-250k',
      timeline: 'within-3-months', fundingStatus: 'funded', referralSource: 'referral',
      existingEquipment: 'Old mill', additionalComments: 'None', needsBudgetaryQuote: true,
      shippingAddress: '1 Engine Way', shippingCity: 'London', shippingState: 'LDN',
      shippingZipCode: 'EC1', shippingCountry: 'UK', referrerSource: 'insights/rie-guide', TTL: 0,
    });
  });

  it('omits effect-backfilled attributes', () => {
    const item = buildPendingRfqItem(FULL, META) as Record<string, unknown>;
    for (const k of ['matchedOrgId', 'GSI2PK', 'attachmentKeys']) expect(k in item).toBe(false);
  });

  it('omits absent optional fields (no undefined attributes)', () => {
    const minimal: PendingRfqSource = {
      name: 'Bo', email: 'bo@lab.gov', institution: 'Gov Lab', equipmentCategory: 'ICP',
      applicationDescription: 'A minimal but valid application description.', quantity: 1,
    };
    const item = buildPendingRfqItem(minimal, META) as Record<string, unknown>;
    for (const k of ['phone', 'department', 'role', 'specificModel', 'keySpecifications',
      'budgetRange', 'timeline', 'fundingStatus', 'referralSource', 'existingEquipment',
      'additionalComments', 'shippingAddress', 'shippingCity', 'shippingState',
      'shippingZipCode', 'shippingCountry', 'visitorId', 'referrerSource']) expect(k in item).toBe(false);
    expect(item.needsBudgetaryQuote).toBe(false);
    expect(Object.values(item).every((v) => v !== undefined)).toBe(true);
  });

  it('normalizes email from a single source (item.email and GSI4PK never diverge)', () => {
    const item = buildPendingRfqItem({
      name: 'Bo', email: 'MiXeD@Example.EDU', institution: 'Gov Lab', equipmentCategory: 'ICP',
      applicationDescription: 'A minimal but valid application description.', quantity: 1,
    }, META);
    expect(item.email).toBe('mixed@example.edu');
    expect(item.GSI4PK).toBe('EMAIL#mixed@example.edu');
  });

  it('cannot read turnstileToken or attachmentKeys (structural whitelist)', () => {
    const withExtras = { ...FULL, turnstileToken: 'secret', attachmentKeys: ['temp/rfq/x/f'] };
    const item = buildPendingRfqItem(withExtras as PendingRfqSource, META) as Record<string, unknown>;
    expect('turnstileToken' in item).toBe(false);
    expect('attachmentKeys' in item).toBe(false);
  });
});
