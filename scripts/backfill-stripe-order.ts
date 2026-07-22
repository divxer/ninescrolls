/**
 * Backfill a paid Stripe checkout order into the admin order system (Customer 360).
 *
 * Why: before the stripe-webhook → order-api bridge existed, paid orders lived
 * only in the standalone `StripeOrders` DDB table, which the admin order list
 * never reads. This script bridges one historical order through the SAME
 * canonical path the webhook now uses: a direct Lambda invoke of order-api's
 * internal `createStripeOrder` resolver. That yields identical semantics —
 * order created at PO_RECEIVED with `source: 'STRIPE'`, Stripe ids on META,
 * and the `STRIPE_SESSION#<id>` idempotency marker (so a later webhook replay
 * can never duplicate it). Re-running the script is a no-op for the same session.
 *
 * Requires the createStripeOrder resolver to be DEPLOYED (PR #339); on older
 * deployments the invoke fails with "No resolver for field: createStripeOrder".
 *
 * Usage:
 *   STRIPE_SECRET_KEY=rk_live_… npx tsx scripts/backfill-stripe-order.ts <stripe_checkout_session_id> [--institution "Name"]
 *
 * The Stripe session id is the full `cs_live_…` id (the StripeOrders partition key).
 * STRIPE_SECRET_KEY is required for independent payment verification — a
 * restricted key with only Checkout Sessions read access is sufficient.
 * Also requires local AWS credentials that can read the StripeOrders table and
 * invoke the order-api Lambda.
 */
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand, ListFunctionsCommand } from '@aws-sdk/client-lambda';

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

/** Find a main-branch Lambda by name fragment (same naming convention the IAM grants rely on). */
async function findFunction(lambda: LambdaClient, fragment: RegExp, label: string): Promise<string> {
  const matches: string[] = [];
  let marker: string | undefined;
  do {
    const res = await lambda.send(new ListFunctionsCommand({ Marker: marker }));
    for (const fn of res.Functions ?? []) {
      const name = fn.FunctionName ?? '';
      if (fragment.test(name) && /main-branch/.test(name)) matches.push(name);
    }
    marker = res.NextMarker;
  } while (marker);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one main-branch ${label} Lambda, found: ${JSON.stringify(matches)}`);
  }
  return matches[0];
}

/**
 * Independently verify with Stripe that the session is actually PAID.
 * The legacy webhook persisted every checkout.session.completed row with a
 * hard-coded status 'paid' — including potentially unsettled delayed-payment
 * sessions — so the StripeOrders row alone cannot be trusted.
 *
 * The key must be provided explicitly via STRIPE_SECRET_KEY (a restricted key
 * with only Checkout Sessions read access is sufficient — create one in the
 * Stripe Dashboard). The script deliberately does NOT read it from the
 * deployed Lambda's configuration or any AWS secret store: that would expose
 * the webhook's entire environment (webhook + SendGrid secrets) and require
 * broader operator permissions than this script needs.
 */
async function verifyPaidWithStripe(sessionId: string): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is required to verify the payment with Stripe.\n'
      + 'Use a restricted key (Checkout Sessions: read) from the Stripe Dashboard:\n'
      + '  STRIPE_SECRET_KEY=rk_live_… npx tsx scripts/backfill-stripe-order.ts <cs_live_…>',
    );
  }

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const session = await res.json() as { payment_status?: string; status?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(`Stripe session lookup failed: ${session.error?.message ?? res.statusText}`);
  }
  if (session.payment_status !== 'paid') {
    throw new Error(
      `Refusing to backfill: Stripe reports payment_status '${session.payment_status}' (status '${session.status}') for ${sessionId} — only 'paid' sessions become admin orders`,
    );
  }
  console.log('Stripe verification: payment_status = paid ✓');
}

function formatShipping(raw: StripeOrderRecord['shippingAddress']): string {
  if (!raw) return '';
  const addr = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, string>) : raw;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ');
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
  const line = rec.lineItems?.[0];
  const productName = line?.description ?? 'Unknown product';
  console.log(`Order: ${productName} — $${(rec.amountTotal / 100).toFixed(2)} ${rec.currency.toUpperCase()} — ${rec.customerName} <${rec.customerEmail}> — paid ${rec.createdAt.slice(0, 10)}`);

  // 2. Independently confirm the payment actually settled before creating an order
  await verifyPaidWithStripe(sessionId);

  // 3. Invoke the canonical internal resolver (idempotent per session — safe to re-run)
  const lambda = new LambdaClient({});
  const fnName = await findFunction(lambda, /orderapi/i, 'order-api');
  console.log(`order-api Lambda: ${fnName}`);

  const payload = {
    fieldName: 'createStripeOrder',
    arguments: {
      input: {
        stripeSessionId: sessionId,
        paymentIntentId: rec.paymentIntentId,
        amountTotalCents: rec.amountTotal,
        currency: rec.currency,
        customerEmail: rec.customerEmail,
        customerName: rec.customerName,
        contactFirstName: rec.contactFirstName,
        contactLastName: rec.contactLastName,
        contactPhone: rec.contactPhone,
        contactOrganization: institutionOverride || rec.contactOrganization || undefined,
        productName,
        quantity: line?.quantity ?? 1,
        shippingAddress: formatShipping(rec.shippingAddress),
        notes: rec.notes,
        paidAt: rec.createdAt,
      },
    },
  };

  const res = await lambda.send(new InvokeCommand({
    FunctionName: fnName,
    InvocationType: 'RequestResponse',
    Payload: new TextEncoder().encode(JSON.stringify(payload)),
  }));
  const text = res.Payload ? new TextDecoder().decode(res.Payload) : '';
  const parsed = text ? JSON.parse(text) : null;
  if (res.FunctionError) {
    console.error(`createStripeOrder failed: ${parsed?.errorMessage ?? res.FunctionError}`);
    if (String(parsed?.errorMessage ?? '').includes('No resolver')) {
      console.error('The createStripeOrder resolver is not deployed yet (merge + deploy PR #339 first).');
    }
    process.exit(1);
  }

  console.log(`\nDone. Admin order ${parsed?.orderId} (${parsed?.status}, source ${parsed?.source}) is visible in the admin order list.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
