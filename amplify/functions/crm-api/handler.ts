type AppSyncEvent = {
  info?: { fieldName?: string; parentTypeName?: string };
  fieldName?: string;
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; claims?: { email?: string } };
};

const resolvers: Record<string, (e: AppSyncEvent) => Promise<unknown>> = {};

export const handler = async (event: AppSyncEvent): Promise<unknown> => {
  const fieldName = event.info?.fieldName ?? event.fieldName;
  if (!fieldName || !resolvers[fieldName]) {
    throw new Error(`crm-api: unknown fieldName "${fieldName}"`);
  }
  return resolvers[fieldName](event);
};
