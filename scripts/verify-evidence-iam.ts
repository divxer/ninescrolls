// scripts/verify-evidence-iam.ts
// Executable least-privilege acceptance. Proves — across BOTH inline and
// attached managed policies (paginated) — that the evidence-api Lambda role's
// DynamoDB Allow set is non-empty, its action set is EXACTLY {dynamodb:Scan},
// and its only resource is EXACTLY the deployed Evidence base-table ARN
// (rejecting Query, '*', index ARNs, and any other table).
// Usage: AWS creds for the sandbox account in env, then:
//   npx tsx scripts/verify-evidence-iam.ts
import { LambdaClient, ListFunctionsCommand, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import {
  IAMClient, ListRolePoliciesCommand, GetRolePolicyCommand,
  ListAttachedRolePoliciesCommand, GetPolicyCommand, GetPolicyVersionCommand,
} from '@aws-sdk/client-iam';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const lambda = new LambdaClient({});
const iam = new IAMClient({});
const ddb = new DynamoDBClient({});

const EXPECTED_ACTIONS = new Set(['dynamodb:Scan']);
const toArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

interface Stmt { Effect: string; Action?: string | string[]; NotAction?: string | string[]; Resource?: string | string[]; NotResource?: string | string[]; }

// Resolve the exact Lambda. Never "first substring match" — multiple sandboxes
// or stale stacks can each contain an evidence-api function. Prefer an explicit
// EVIDENCE_FN_NAME env var; otherwise require EXACTLY ONE candidate and fail
// (listing them) on zero or multiple.
async function findEvidenceFunctionName(): Promise<string> {
  // An explicit name is authoritative — use it directly. main() then calls
  // GetFunctionConfiguration on it, which throws ResourceNotFound if it is wrong.
  // Do NOT gate it behind the fuzzy substring enumeration.
  const explicit = process.env.EVIDENCE_FN_NAME;
  if (explicit) return explicit;

  const candidates: string[] = [];
  let Marker: string | undefined;
  do {
    const res = await lambda.send(new ListFunctionsCommand({ Marker }));
    for (const f of res.Functions ?? []) if (f.FunctionName?.includes('evidence-api')) candidates.push(f.FunctionName);
    Marker = res.NextMarker;
  } while (Marker);

  if (candidates.length === 0) throw new Error('No evidence-api Lambda found — is this sandbox deployed?');
  if (candidates.length > 1) {
    throw new Error(`Ambiguous: ${candidates.length} evidence-api candidates found — set EVIDENCE_FN_NAME to disambiguate:\n- ${candidates.join('\n- ')}`);
  }
  return candidates[0];
}

async function collectStatements(roleName: string): Promise<Stmt[]> {
  const out: Stmt[] = [];
  // Inline policies (paginated)
  let inlineMarker: string | undefined;
  do {
    const res = await iam.send(new ListRolePoliciesCommand({ RoleName: roleName, Marker: inlineMarker }));
    for (const name of res.PolicyNames ?? []) {
      const { PolicyDocument } = await iam.send(new GetRolePolicyCommand({ RoleName: roleName, PolicyName: name }));
      out.push(...toArray<Stmt>(JSON.parse(decodeURIComponent(PolicyDocument!)).Statement));
    }
    inlineMarker = res.Marker;
  } while (inlineMarker);
  // Attached managed policies (paginated) -> default version doc
  let attachedMarker: string | undefined;
  do {
    const res = await iam.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName, Marker: attachedMarker }));
    for (const p of res.AttachedPolicies ?? []) {
      const pol = await iam.send(new GetPolicyCommand({ PolicyArn: p.PolicyArn }));
      const ver = await iam.send(new GetPolicyVersionCommand({ PolicyArn: p.PolicyArn, VersionId: pol.Policy!.DefaultVersionId }));
      out.push(...toArray<Stmt>(JSON.parse(decodeURIComponent(ver.PolicyVersion!.Document!)).Statement));
    }
    attachedMarker = res.Marker;
  } while (attachedMarker);
  return out;
}

async function main() {
  const fnName = await findEvidenceFunctionName();
  const cfg = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: fnName }));
  const roleName = cfg.Role!.split('/').pop()!;
  const tableName = cfg.Environment?.Variables?.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var missing on the Lambda');
  const described = await ddb.send(new DescribeTableCommand({ TableName: tableName }));
  const tableArn = described.Table!.TableArn!;

  const statements = await collectStatements(roleName);
  const violations: string[] = [];
  const ddbActions = new Set<string>();
  const ddbResources = new Set<string>();
  let ddbAllowCount = 0;

  for (const st of statements) {
    if (st.Effect !== 'Allow') continue;
    if (st.NotAction || st.NotResource) { violations.push('Allow statement uses NotAction/NotResource (unbounded)'); continue; }
    const actions = toArray(st.Action);
    const resources = toArray(st.Resource);
    const touchesDdb = actions.some((a) => a === '*' || a.toLowerCase().startsWith('dynamodb:'));
    if (!touchesDdb) continue;
    ddbAllowCount++;
    // A DynamoDB Allow with no Resource is unbounded — reject it explicitly
    // (otherwise the resource loop below is skipped and it slips through).
    if (resources.length === 0) violations.push('DynamoDB Allow statement has no Resource (unbounded)');
    for (const a of actions) {
      if (a === '*' || a.toLowerCase() === 'dynamodb:*') { violations.push(`wildcard DynamoDB action: ${a}`); continue; }
      if (a.toLowerCase().startsWith('dynamodb:')) ddbActions.add(a);
    }
    for (const r of resources) {
      ddbResources.add(r);
      if (r === '*') violations.push('wildcard resource "*" on a DynamoDB Allow');
      else if (r.includes('/index/')) violations.push(`index ARN granted (base-table only expected): ${r}`);
      else if (r !== tableArn) violations.push(`unexpected resource (want exactly ${tableArn}): ${r}`);
    }
  }

  if (ddbAllowCount === 0) violations.push('no DynamoDB Allow statement found (empty permission set)');

  const actionList = [...ddbActions].sort();
  const expectedActions = [...EXPECTED_ACTIONS].sort();
  if (JSON.stringify(actionList) !== JSON.stringify(expectedActions)) {
    violations.push(`DynamoDB action set is ${JSON.stringify(actionList)}, expected exactly ${JSON.stringify(expectedActions)}`);
  }

  // Aggregate closure: the set of ALL granted DynamoDB resources must be exactly
  // {tableArn} — non-empty, no wildcard, no index, no other table.
  const resourceList = [...ddbResources].sort();
  if (JSON.stringify(resourceList) !== JSON.stringify([tableArn])) {
    violations.push(`DynamoDB resource set is ${JSON.stringify(resourceList)}, expected exactly ${JSON.stringify([tableArn])}`);
  }

  if (violations.length) throw new Error('IAM FAIL:\n- ' + violations.join('\n- '));
  console.log(`OK: evidence-api DynamoDB permission is exactly {dynamodb:Scan} on ${tableArn} (inline + managed policies checked).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
