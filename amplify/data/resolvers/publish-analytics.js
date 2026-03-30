/**
 * Pass-through resolver for publishAnalyticsEvent mutation.
 * Uses NONE data source — no DDB interaction; the mutation exists
 * solely to trigger the onAnalyticsEvent subscription.
 */
export function request(ctx) {
  return { payload: null };
}

export function response(ctx) {
  return ctx.arguments;
}
