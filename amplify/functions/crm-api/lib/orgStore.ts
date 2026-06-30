import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb';

export async function getOrgIdByDomain(domain: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORGDOMAIN#${domain}`, SK: 'A' } }));
  return (res.Item?.orgId as string | undefined) ?? null;
}

export async function getOrgIdByName(normName: string): Promise<string | null> {
  const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME(), Key: { PK: `ORGNAME#${normName}`, SK: 'A' } }));
  return (res.Item?.orgId as string | undefined) ?? null;
}
