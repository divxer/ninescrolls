import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

let dataClient: ReturnType<typeof generateClient<Schema>> | null = null;

export function getAmplifyDataClient() {
  dataClient ??= generateClient<Schema>();
  return dataClient;
}
