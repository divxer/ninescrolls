/**
 * Security-proxy / browser-isolation vendors whose egress IPs mask the real
 * visitor's organization (secure web gateways, remote browser isolation,
 * Zero-Trust network access). A visit attributed to one of these org names
 * tells us NOTHING about the visitor — classifying the vendor itself is the
 * misattribution this module prevents (e.g. a Taiwan semiconductor reader
 * surfacing as "Menlo Security, Inc. — cybersecurity company, does not
 * conduct R&D").
 *
 * Shared by the server-track (/d) Lambda, the classify-org Lambda, and the
 * admin analytics frontend (same amplify/lib sharing precedent as
 * amplify/lib/rfq and amplify/lib/evidence).
 *
 * Name-based on purpose: vendor org names are stable across every egress
 * city; IP ranges churn. Matching plain "Cloudflare" covers WARP/Gateway
 * egress (how the first live Stripe buyer surfaced, PR #341) at the cost of
 * treating actual Cloudflare employees as proxy visitors — the same
 * trade-off ISP handling already makes for residential ISPs.
 */
const SECURITY_PROXY_PATTERNS: RegExp[] = [
  /menlo[\s-]*security/i,
  /zscaler/i,
  /\biboss\b/i,
  /cloudflare/i,
  /netskope/i,
  /forcepoint/i,
];

/**
 * True when any provided name (org, orgName, isp — pass whichever you have)
 * matches a known security-proxy vendor.
 */
export function isSecurityProxyOrg(...names: Array<string | null | undefined>): boolean {
  for (const name of names) {
    if (!name) continue;
    for (const pattern of SECURITY_PROXY_PATTERNS) {
      if (pattern.test(name)) return true;
    }
  }
  return false;
}
