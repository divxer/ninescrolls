# RFQ Turnstile Recovery Design

## Problem

On `/request-quote`, the Step 2 submit button is disabled until Cloudflare Turnstile returns a token. If the widget is still loading, fails, expires, or is blocked by a browser or network policy, the page gives no explanation or recovery action. Customers experience this as an unclickable form.

## Scope

Improve only the RFQ page's Turnstile interaction. Keep the existing API, payload, form fields, analytics, and mandatory server-side CAPTCHA validation unchanged.

## Design

The RFQ page will model the verification UI with four states:

- `loading`: the site key exists but the widget has not reported success or failure.
- `ready`: Turnstile returned a token; submission is enabled.
- `error`: the widget reported an error or did not initialize within a bounded timeout.
- `expired`: a previously valid token expired.

Step 2 will show concise status text beside the widget. While verification is incomplete, the submit button remains disabled for security, but the page explains why. Error and expired states expose a **Retry verification** button. Retry clears the token, resets an existing widget when possible, and otherwise recreates it.

Initialization will be idempotent across step changes. Script load failures and initialization timeout will transition to `error` instead of leaving the form silently locked. Successful callbacks clear errors and transition to `ready`.

## Error Handling

- Script `error` event: show that verification could not load and offer retry.
- Widget `error-callback`: show the same recoverable state.
- Widget `expired-callback`: explain that verification expired and offer retry.
- Initialization timeout: show the recoverable state.
- Submission response errors: preserve the existing API error behavior and reset verification for another attempt.
- Include `sales@ninescrolls.com` as a fallback contact; do not bypass CAPTCHA.

## Testing

Add RFQ page tests that verify:

1. With a configured site key and no token, Step 2 explains that verification is required and submission is disabled.
2. A Turnstile error exposes the recovery message and retry control.
3. Retrying calls widget reset/re-initialization and returns to a loading state.
4. A successful Turnstile callback enables submission.
5. Existing no-site-key tests and RFQ payload tests remain unchanged and pass.

## Acceptance Criteria

- No customer sees a silently disabled RFQ submit button.
- Verification failures are visible and recoverable without re-entering the form.
- CAPTCHA remains mandatory whenever `VITE_TURNSTILE_SITE_KEY` is configured.
- No backend or API contract changes are introduced.
