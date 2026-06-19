import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamodb.js';
import type { LogisticsCaseItem, LogisticsCaseResponse } from './types.js';
import { toCaseResponse } from './types.js';

export async function fetchCase(caseId: string): Promise<LogisticsCaseItem | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME(),
    Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
  }));
  return (res.Item as LogisticsCaseItem) ?? null;
}

export async function buildCaseResponse(caseId: string): Promise<LogisticsCaseResponse | null> {
  const item = await fetchCase(caseId);
  return item ? toCaseResponse(item) : null;
}
