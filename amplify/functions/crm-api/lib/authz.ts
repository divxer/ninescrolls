// Handler-level authorization (spec R6/blocker-1): allow.authenticated() admits ANY pool user, so
// admin resolvers must verify the `admin` Cognito group BEFORE any DynamoDB access. Both shapes
// appear in the wild: claims['cognito:groups'] (array OR comma-string) and identity.groups.
type IdentityShape = { identity?: { groups?: string[]; claims?: Record<string, unknown> } };

export function isAdmin(event: IdentityShape): boolean {
  const id = event.identity;
  if (!id) return false;
  if (Array.isArray(id.groups) && id.groups.includes('admin')) return true;
  const raw = id.claims?.['cognito:groups'];
  if (Array.isArray(raw)) return raw.includes('admin');
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).includes('admin');
  return false;
}

export function requireAdmin(event: IdentityShape): void {
  if (!isAdmin(event)) throw new Error('forbidden: admin group required');
}
