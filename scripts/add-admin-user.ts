/**
 * Add a Cognito user to the 'admin' group (price-api trust boundary).
 *
 * Usage:
 *   npx tsx scripts/add-admin-user.ts <email> [--pool <userPoolId>]
 *
 * Pool defaults to amplify_outputs.json auth.user_pool_id (i.e. whatever
 * backend the local outputs point at). Pass --pool us-east-2_3AE21gHBg to
 * target prod explicitly. Requires AWS credentials with
 * cognito-idp:AdminAddUserToGroup.
 *
 * P1 deployment prerequisite (spec): run against BOTH sandbox and prod pools;
 * the owner's account must be a member before the feature is usable.
 */
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { readFileSync } from 'node:fs';

const USAGE = 'Usage: npx tsx scripts/add-admin-user.ts <email> [--pool <userPoolId>]';

// CLI arg parsing (same pattern as scripts/create-insight.ts): walk argv,
// consume the value token after flags that take one, collect positionals.
let poolArg: string | undefined;
let poolFlagSeen = false;
const positionalArgs: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  const token = process.argv[i];
  if (token === '--pool') {
    poolFlagSeen = true;
    const next = process.argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      poolArg = next;
      i++;
    }
  } else if (!token.startsWith('--')) {
    positionalArgs.push(token);
  }
}

const email = positionalArgs[0];
if (!email || !email.includes('@')) {
  console.error(USAGE);
  process.exit(1);
}
if (poolFlagSeen && !poolArg) {
  console.error('--pool requires a value.');
  console.error(USAGE);
  process.exit(1);
}

async function main(): Promise<void> {
  // Only touch amplify_outputs.json when --pool is absent — with an explicit
  // pool the script must work in worktrees/CI where local outputs don't exist.
  const userPoolId: string = poolArg
    ?? JSON.parse(readFileSync(new URL('../amplify_outputs.json', import.meta.url), 'utf8')).auth.user_pool_id;
  const region = userPoolId.split('_')[0];

  const client = new CognitoIdentityProviderClient({ region });
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: email,
    GroupName: 'admin',
  }));
  console.log(`Added ${email} to 'admin' group in pool ${userPoolId}`);
}

main().catch((err) => {
  console.error('add-admin-user failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
