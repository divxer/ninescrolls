/**
 * Smoke test for the Logistics Cases backend (Phase 1) against the deployed sandbox.
 * Exercises create → list → get → advanceStage → addLeg, then CANCELs the test case
 * so it does not linger in active lists (Phase 1 has no delete resolver).
 *
 * Usage: ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD npx tsx scripts/smoke-logistics.ts
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';

import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);

const client = generateClient<Schema>({ authMode: 'userPool' });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`❌ ASSERT FAILED: ${msg}`);
    process.exit(1);
  }
}

function unwrap<T>(label: string, res: { data: T; errors?: { message: string }[] | null }): T {
  if (res.errors?.length) {
    console.error(`❌ ${label} errors:`, res.errors.map((e) => e.message).join(', '));
    process.exit(1);
  }
  return res.data;
}

async function main() {
  await authenticate();
  console.log('✓ authenticated\n');

  // 1. CREATE
  const created = unwrap('createLogisticsCase', await client.mutations.createLogisticsCase({
    input: JSON.stringify({
      caseType: 'EQUIPMENT',
      customerName: 'SMOKE TEST — HORIBA',
      contactName: 'Smoke Bot',
      customsRequired: true,
      notes: 'automated smoke test; safe to ignore/delete',
    }),
  } as any)) as any;
  assert(created?.caseId, 'create returned a caseId');
  assert(created.currentStage === 'DRAFT', `new case opens at DRAFT (got ${created.currentStage})`);
  assert(/^NS-LOG-\d{4}-\d{4}$/.test(created.caseNumber), `caseNumber format (got ${created.caseNumber})`);
  assert(Array.isArray(created.enabledStages) && created.enabledStages.includes('FAT_PASSED'),
    'EQUIPMENT enabledStages includes FAT_PASSED');
  const caseId = created.caseId as string;
  console.log(`✓ created ${created.caseNumber} (${caseId}) @ DRAFT`);

  // 2. LIST — the new case must appear
  const list = unwrap('listLogisticsCases', await client.queries.listLogisticsCases({} as any)) as any;
  assert(Array.isArray(list?.items), 'list returns an items array');
  assert(list.items.some((c: any) => c.caseId === caseId), 'new case appears in default list');
  console.log(`✓ list returned ${list.items.length} case(s); new case present`);

  // 3. GET
  const got = unwrap('getLogisticsCase', await client.queries.getLogisticsCase({ caseId } as any)) as any;
  assert(got?.caseId === caseId, 'get returns the case');
  console.log(`✓ get ${got.caseNumber} → stage ${got.currentStage}`);

  // 4. ADVANCE STAGE → PRODUCTION (enabled for EQUIPMENT)
  const advanced = unwrap('advanceLogisticsStage', await client.mutations.advanceLogisticsStage({
    caseId, targetStage: 'PRODUCTION', detail: 'smoke: kickoff',
  } as any)) as any;
  assert(advanced?.currentStage === 'PRODUCTION', `advanced to PRODUCTION (got ${advanced?.currentStage})`);
  assert((advanced.milestoneLog?.length ?? 0) >= 2, 'milestoneLog has create + advance entries');
  console.log(`✓ advanced → PRODUCTION (${advanced.milestoneLog.length} log entries)`);

  // 4b. Reject a non-enabled stage (TESTING is not in EQUIPMENT subset)
  const bad = await client.mutations.advanceLogisticsStage({ caseId, targetStage: 'TESTING' } as any);
  assert(bad.errors?.length, 'advancing to a non-enabled stage is rejected');
  console.log('✓ non-enabled stage (TESTING) correctly rejected');

  // 5. ADD LEG
  const withLeg = unwrap('addLeg', await client.mutations.addLeg({
    caseId,
    input: JSON.stringify({
      direction: 'OUTBOUND', carrier: 'DHL', trackingNumber: 'SMOKE123',
      customsRequired: true, customsStatus: 'DOCS_READY',
    }),
  } as any)) as any;
  assert(withLeg?.legs?.length === 1, 'leg added');
  assert(withLeg.legs[0].customsStatus === 'DOCS_READY', 'leg customsStatus persisted');
  console.log(`✓ addLeg → ${withLeg.legs[0].carrier} ${withLeg.legs[0].trackingNumber}`);

  // 6. CLEANUP — cancel the test case (terminal, excluded from active lists)
  const cancelled = unwrap('advanceLogisticsStage(CANCELLED)', await client.mutations.advanceLogisticsStage({
    caseId, targetStage: 'CANCELLED', detail: 'smoke cleanup',
  } as any)) as any;
  assert(cancelled?.currentStage === 'CANCELLED', 'test case cancelled');
  console.log(`✓ cleanup: ${cancelled.caseNumber} → CANCELLED\n`);

  console.log('🟢 ALL SMOKE CHECKS PASSED');
}

main().catch((e) => { console.error('💥 smoke test threw:', e); process.exit(1); });
