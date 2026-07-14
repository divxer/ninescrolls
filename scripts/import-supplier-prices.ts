/**
 * Import supplier framework prices from CSV into the Price Book.
 *
 * Usage:
 *   ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD \
 *     npx tsx scripts/import-supplier-prices.ts prices.csv
 *
 * CSV columns (header row required):
 *   sku,supplierName,unitCostRmb,effectiveFrom,effectiveTo
 *   RIE-300,Probe OEM,72500.00,2026-08-01,2027-02-01
 *
 * - sku matches CatalogItem.sku (case-sensitive); supplierName matches Supplier.name.
 * - unitCostRmb is in yuan with optional decimals — converted to integer fen.
 * - Overlapping-interval and concurrent-append errors (VALIDATION/CONFLICT) are
 *   reported per row; the import continues with the remaining rows.
 * - Requires amplify_outputs.json to be CURRENT (include the pb* operations):
 *     npx ampx generate outputs --app-id d244ebmxcttcdz --branch main
 * - Caller must be in the Cognito 'admin' group (scripts/add-admin-user.ts).
 */
import { readFileSync } from 'node:fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import { parseCsv, rmbToFen } from './lib/csv';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as never);
const client = generateClient<Schema>({ authMode: 'userPool' });

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx scripts/import-supplier-prices.ts <file.csv>');
  process.exit(1);
}

const unwrap = <T,>(data: unknown): T =>
  (typeof data === 'string' ? JSON.parse(data) : data) as T;

async function main() {
  await authenticate();

  const catalogRes = await client.queries.pbListCatalogItems({ authMode: 'userPool' });
  const supplierRes = await client.queries.pbListSuppliers({ authMode: 'userPool' });
  const catalog = unwrap<{ items: Array<{ itemId: string; sku: string }> }>(catalogRes.data).items;
  const suppliers = unwrap<{ items: Array<{ supplierId: string; name: string }> }>(supplierRes.data).items;
  const bySku = new Map(catalog.map((c) => [c.sku, c.itemId]));
  const byName = new Map(suppliers.map((s) => [s.name, s.supplierId]));

  const rows = parseCsv(readFileSync(file, 'utf8')).map((r) => r.map((c) => c.trim()));
  const header = rows.shift();
  const EXPECTED = ['sku', 'supplierName', 'unitCostRmb', 'effectiveFrom', 'effectiveTo'];
  if (!header || header.join(',') !== EXPECTED.join(',')) {
    throw new Error(`Unexpected header: ${header?.join(',')} (expected ${EXPECTED.join(',')})`);
  }

  let ok = 0, failed = 0;
  for (const [i, row] of rows.entries()) {
    const [sku, supplierName, unitCostRmb, effectiveFrom, effectiveTo] = row;
    const label = `row ${i + 2} (${sku} @ ${supplierName})`;
    const itemId = bySku.get(sku);
    const supplierId = byName.get(supplierName);
    if (row.length !== EXPECTED.length) { console.error(`✗ ${label}: expected ${EXPECTED.length} columns, got ${row.length}`); failed++; continue; }
    if (!itemId) { console.error(`✗ ${label}: unknown sku`); failed++; continue; }
    if (!supplierId) { console.error(`✗ ${label}: unknown supplier`); failed++; continue; }
    try {
      const res = await client.mutations.pbAppendCostVersion({
        input: JSON.stringify({
          itemId, supplierId,
          unitCostFen: rmbToFen(unitCostRmb), // string-based — no float money math
          effectiveFrom, effectiveTo,
          priceSource: 'SUPPLIER_EXCEL',
        }),
      }, { authMode: 'userPool' });
      if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join(', '));
      console.log(`✓ ${label}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${label}: ${(e as Error).message}`);
      failed++;
    }
  }
  console.log(`\nDone: ${ok} imported, ${failed} failed.`);
  if (failed) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
