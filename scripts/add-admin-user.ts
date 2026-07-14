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

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const poolFlag = args.indexOf('--pool');
if (!email) {
  console.error('Usage: npx tsx scripts/add-admin-user.ts <email> [--pool <userPoolId>]');
  process.exit(1);
}

// Only touch amplify_outputs.json when --pool is absent — with an explicit pool
// the script must work in worktrees/CI where local outputs don't exist.
const userPoolId: string = poolFlag >= 0
  ? args[poolFlag + 1]
  : JSON.parse(readFileSync(new URL('../amplify_outputs.json', import.meta.url), 'utf8')).auth.user_pool_id;
const region = userPoolId.split('_')[0];

const client = new CognitoIdentityProviderClient({ region });
await client.send(new AdminAddUserToGroupCommand({
  UserPoolId: userPoolId,
  Username: email,
  GroupName: 'admin',
}));
console.log(`Added ${email} to 'admin' group in pool ${userPoolId}`);
