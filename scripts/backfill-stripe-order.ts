/**
 * Backfill a paid Stripe checkout order into the admin order system (Customer 360).
 *
 * Why: the stripe-webhook Lambda persists paid orders into a standalone
 * `StripeOrders` DDB table that nothing reads, so paid orders never appear in
 * the admin order list. Until the webhook→order-api bridge ships, this script
 * bridges one order by hand: it reads the StripeOrders record, creates an
 * admin order via the createOrder mutation, and walks the status machine
 * forward to PO_RECEIVED (paid, awaiting production).
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD \
 *     npx tsx scripts/backfill-stripe-order.ts <stripe_checkout_session_id> [--institution "Name"]
 *
 * The Stripe session id is the full `cs_live_…` id (the StripeOrders partition key).
 * Requires local AWS credentials that can read the StripeOrders table.
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });

interface StripeOrderRecord {
  orderId: string;
  createdAt: string;
  status: string;
  amountTotal: number; // cents
  currency: string;
  customerEmail: string;
  customerName: string;
  paymentIntentId?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactPhone?: string;
  contactOrganization?: string;
  shippingAddress?: string | Record<string, string>;
  notes?: string;
  lineItems?: Array<{ description: string; quantity: number; unitAmount: number; currency: string }>;
}

async function findStripeOrdersTable(ddb: DynamoDBClient): Promise<string> {
  let start: string | undefined;
  do {
    const res = await ddb.send(new ListTablesCommand({ ExclusiveStartTableName: start }));
    const match = (res.TableNames ?? []).find((t) => t.includes('StripeOrders'));
    if (match) return match;
    start = res.LastEvaluatedTableName;
  } while (start);
  throw new Error('StripeOrders table not found — check AWS credentials/region');
}

function formatShipping(raw: StripeOrderRecord['shippingAddress']): string {
  if (!raw) return '';
  const addr = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, string>) : raw;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
}

/** Derive a product model from the line item description, e.g. "HY-4L - RF …" → "HY-4L" */
function deriveModel(description: string): string {
  return description.split(/\s+-\s+|\s+–\s+/)[0].trim() || description;
}

async function main() {
  const args = process.argv.slice(2);
  const sessionId = args.find((a) => !a.startsWith('--'));
  const instFlag = args.indexOf('--institution');
  const institutionOverride = instFlag !== -1 ? args[instFlag + 1] : undefined;

  if (!sessionId || !sessionId.startsWith('cs_')) {
    console.error('Usage: npx tsx scripts/backfill-stripe-order.ts <cs_live_…> [--institution "Name"]');
    process.exit(1);
  }

  // 1. Read the Stripe order record
  const ddbBase = new DynamoDBClient({});
  const ddb = DynamoDBDocumentClient.from(ddbBase);
  const tableName = await findStripeOrdersTable(ddbBase);
  console.log(`StripeOrders table: ${tableName}`);

  const { Item } = await ddb.send(new GetCommand({ TableName: tableName, Key: { orderId: sessionId } }));
  if (!Item) {
    console.error(`No StripeOrders record for session ${sessionId}`);
    process.exit(1);
  }
  const rec = Item as StripeOrderRecord;
  const amountUsd = rec.amountTotal / 100;
  const line = rec.lineItems?.[0];
  const productName = line?.description ?? 'Unknown product';
  const email = rec.customerEmail.trim().toLowerCase();
  const paidDate = rec.createdAt.slice(0, 10);

  console.log(`Order: ${productName} — $${amountUsd.toFixed(2)} ${rec.currency.toUpperCase()} — ${rec.customerName} <${email}> — paid ${paidDate}`);

  // 2. Authenticate as admin
  await authenticate();

  // 3. Duplicate guard: does this customer already have an admin order referencing this payment?
  const existing = await client.queries.listByEmail({ email, limit: 50 } as any);
  const priorOrders: any[] = (existing.data as any)?.items ?? [];
  const dup = priorOrders.find((o) => typeof o?.notes === 'string' && o.notes.includes(sessionId));
  if (dup) {
    console.log(`Already backfilled as order ${dup.orderId} — nothing to do.`);
    return;
  }

  // 4. Create the admin order (starts at INQUIRY per the status machine)
  const domain = email.split('@')[1] ?? '';
  const institution = institutionOverride
    || rec.contactOrganization
    || `${domain} (inferred from email domain)`;
  const contactName = [rec.contactFirstName, rec.contactLastName].filter(Boolean).join(' ') || rec.customerName;
  const shipping = formatShipping(rec.shippingAddress);

  const notes = [
    `Stripe checkout order (backfilled from StripeOrders table).`,
    `Stripe session: ${sessionId}`,
    rec.paymentIntentId ? `Payment intent: ${rec.paymentIntentId}` : '',
    `Paid in full: $${amountUsd.toFixed(2)} ${rec.currency.toUpperCase()} on ${paidDate}`,
    shipping ? `Shipping address: ${shipping}` : '',
    rec.notes ? `Customer notes: ${rec.notes}` : '',
  ].filter(Boolean).join('\n');

  const input = {
    institution,
    productModel: deriveModel(productName),
    productName,
    quoteAmount: amountUsd,
    quoteDate: paidDate,
    notes,
    primaryContact: {
      contactName,
      contactEmail: email,
      contactPhone: rec.contactPhone || '',
      role: 'OTHER',
      isPrimary: true,
      notes: 'Contact from Stripe checkout form',
    },
  };

  const { data: created, errors } = await client.mutations.createOrder({ input: JSON.stringify(input) } as any);
  if (errors?.length) {
    console.error('createOrder failed:', JSON.stringify(errors, null, 2));
    process.exit(1);
  }
  const orderId = (created as any).orderId as string;
  console.log(`Created admin order ${orderId} (INQUIRY)`);

  // 5. Walk the status machine forward to PO_RECEIVED (strictly one step at a time)
  const steps: Array<{ status: 'QUOTING' | 'QUOTE_SENT' | 'PO_RECEIVED'; note: string }> = [
    { status: 'QUOTING', note: 'Backfill: online checkout — no separate quote stage' },
    { status: 'QUOTE_SENT', note: 'Backfill: online checkout — list price accepted at checkout' },
    { status: 'PO_RECEIVED', note: `Paid in full via Stripe checkout ($${amountUsd.toFixed(2)} ${rec.currency.toUpperCase()}, ${rec.paymentIntentId ?? sessionId})` },
  ];
  for (const step of steps) {
    const { errors: stepErrors } = await client.mutations.updateOrderStatus({
      orderId,
      newStatus: step.status,
      statusDate: paidDate,
      note: step.note,
    } as any);
    if (stepErrors?.length) {
      console.error(`updateOrderStatus → ${step.status} failed:`, JSON.stringify(stepErrors, null, 2));
      process.exit(1);
    }
    console.log(`  → ${step.status}`);
  }

  console.log(`\nDone. Order ${orderId} is now PO_RECEIVED and visible in the admin order list.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
