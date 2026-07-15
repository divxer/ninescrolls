# RFQ Turnstile Recovery Design

## Problem

On `/request-quote`, the Step 2 submit button is disabled until Cloudflare Turnstile returns a token. If the widget is still loading, fails, expires, or is blocked by a browser or network policy, the page gives no explanation or recovery action. Customers experience this as an unclickable form.

## Scope

Improve only the RFQ page's Turnstile interaction. Keep the existing API, payload, form fields, analytics, and mandatory server-side CAPTCHA validation unchanged.

## Design

When a Turnstile site key is configured, the RFQ page will model the verification UI with four states. With no configured key, verification is inactive and the existing no-CAPTCHA development/test behavior remains unchanged.

- `loading`: the site key exists but the widget has not reported success or failure.
- `ready`: Turnstile returned a token; submission is enabled.
- `error`: the widget reported an error or did not initialize within a bounded timeout.
- `expired`: a previously valid token expired.

Step 2 will show concise status text beside the widget. While verification is incomplete, the submit button remains disabled for security, but the page explains why. The asynchronous status is exposed through an associated `role="status"`/`aria-live` region; terminal loading failures use an alert where appropriate. The submit button references its explanation through `aria-describedby`. Error and expired states expose a **Retry verification** button. A visible `mailto:sales@ninescrolls.com` link is available as a fallback without implying that email submits the form.

Initialization is attempt-scoped and begins only while Step 2 and its widget container are mounted. Each attempt has a monotonically increasing generation identifier; callbacks from older generations are ignored. Every timer, interval, and script listener is cancelled on retry, step exit, success, and unmount. Widget removal invalidates the active generation before invoking Turnstile cleanup so a removed widget cannot mutate current state.

Script loading is separate from widget lifecycle. The loader recognizes an already available Turnstile API, a still-loading script, and a failed or stalled script. It bounds all waiting, removes listeners it owns, and replaces only a failed script element created and marked by this RFQ loader; it does not remove a shared script owned by another component. Calls to `render`, `reset`, and `remove` are wrapped as recoverable operations. Retry invalidates the previous attempt, clears its token, transitions to `loading`, resets a live widget when safe, and otherwise creates a new attempt and widget.

The initialization timeout is 10 seconds, begins when Step 2 starts waiting for the Turnstile API, and ends once `turnstile.render` successfully returns a widget ID. It does not time how long a customer takes to complete the rendered challenge. Script load failures and initialization timeout transition to `error` instead of leaving the form silently locked. A successful token callback for the active generation transitions to `ready`.

## Error Handling

- Script `error` event: show that verification could not load and offer retry.
- Widget `error-callback`: show the same recoverable state.
- Widget `expired-callback`: explain that verification expired and offer retry.
- Initialization timeout: show the recoverable state.
- Submission response errors: preserve the existing API error behavior, invalidate the prior token and callbacks, and start a new verification attempt in `loading`. Reset the live widget when possible; recreate it otherwise; transition to `error` if recovery fails.
- Include `sales@ninescrolls.com` as a fallback contact; do not bypass CAPTCHA.

## Testing

Add RFQ page tests that verify:

1. With a configured site key and no token, Step 2 explains that verification is required, associates that explanation with the button, and disables submission.
2. Script `error` and the 10-second initialization timeout expose the recovery message and retry control.
3. Widget error and expiration callbacks invalidate the token and expose a recoverable state.
4. Retrying calls widget reset/re-initialization and returns to a loading state; reset/render exceptions transition to `error`.
5. A successful active-generation callback enables submission; a stale callback does not.
6. A failed submission invalidates the previous attempt and starts verification recovery.
7. Step exit/re-entry and component unmount cancel timers/listeners and prevent stale updates.
8. Existing no-site-key tests and RFQ payload tests remain unchanged and pass.

Use fake timers and a controlled `window.turnstile` implementation to test timeout, callback, and cleanup behavior deterministically.

## Acceptance Criteria

- In `loading`, `error`, and `expired`, the disabled submit button has a visible and programmatically associated explanation.
- In `error` and `expired`, a visible retry action is available and preserves entered form data.
- Only an active-attempt success callback enables submission.
- Verification failures are visible and recoverable without re-entering the form.
- CAPTCHA remains mandatory whenever `VITE_TURNSTILE_SITE_KEY` is configured.
- No backend or API contract changes are introduced.
