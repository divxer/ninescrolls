import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient);
export const s3Client = new S3Client({});

export const TABLE_NAME = () => process.env.INTELLIGENCE_TABLE!;
export const BUCKET_NAME = () => process.env.DOCUMENTS_BUCKET!;
export const SLACK_WEBHOOK_URL = () => process.env.SLACK_WEBHOOK_URL;
