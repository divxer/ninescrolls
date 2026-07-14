export interface PriceApiIdentity {
  sub?: string;
  username?: string;
  groups?: string[] | null;
  claims?: Record<string, unknown>;
}

export interface PriceApiEvent {
  info: { fieldName: string; parentTypeName: string };
  arguments: Record<string, unknown>;
  identity?: PriceApiIdentity;
}

function claimGroups(claims: Record<string, unknown> | undefined): string[] {
  const raw = claims?.['cognito:groups'];
  if (Array.isArray(raw)) return raw.map(String);
  // Lambda-authorizer / some invoke paths serialize the claim as a single
  // space- or comma-separated string.
  if (typeof raw === 'string') return raw.split(/[\s,]+/).filter(Boolean);
  return [];
}

/**
 * Server-side trust boundary (spec: "Scope boundaries"). allow.authenticated()
 * only proves login; cost & supplier data require the Cognito 'admin' group.
 * Throws UNAUTHORIZED on any caller whose verified JWT lacks the group.
 */
export function requireAdmin(event: PriceApiEvent): void {
  const id = event.identity;
  const groups = [...(id?.groups ?? []), ...claimGroups(id?.claims)];
  if (!id || !groups.includes('admin')) {
    throw new Error('UNAUTHORIZED: admin group required for price-api operations');
  }
}
