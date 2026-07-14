# Commercial-Intent Long-Tail Audit (RIE + adjacent equipment)

**Source:** GSC 3-month, query regex filter `etcher|equipment|price|cost|supplier|manufacturer|vendor|for sale|system|selection|spec|quote|buy` (260 matching queries), read 2026-07-14 via Chrome MCP on the `/u/2/` account.

**Strategic basis:** the generic head term "reactive ion etching" is an unwinnable authority fight (page 1 = Wikipedia, Oxford Instruments, MKS, Stanford, UH, ScienceDirect — the pillar sits ~page 8). Commercial-intent long-tail is winnable because the authority giants don't target "etcher / price / supplier / system" buying intent. Route commercial intent to PRODUCT pages (they convert → RFQ); guides support via internal links.

---

## Tier 1 — PUSH the "etcher" money queries (already earning clicks at page 3–7; highest ROI)

| Query | Clicks (3mo) | Impr | Position | Owning page (confirm) | Action |
|---|---|---|---|---|---|
| reactive ion etcher | 56 | 224 | **74.0** | `products/rie-etcher` | Title/H1 must target "reactive ion etcher" (the machine, not the process); add specs/selection/RFQ section; strong internal links from `reactive-ion-etching-guide` down to the product page with "reactive ion etcher" anchor. |
| icp etcher | 50 | 226 | **35.7** | `products/icp-etcher` | Same treatment for "ICP etcher"; link from `icp-rie-technology-advanced-etching`. |
| rie etcher | 41 | 462 | **31.9** | `products/rie-etcher` | Same page as #1 — one product page should own both "rie etcher" + "reactive ion etcher". |

These three already convert despite page 3–7. Moving them to page 1–2 is the single highest-value play.

## Tier 2 — Near-page-1 commercial near-misses (0 clicks at pos 8–14 = title/snippet or small push)

| Query | Impr | Position | Action |
|---|---|---|---|
| plasma cleaner price | 84 | **8.2** | Plasma-cleaner page: add a pricing / "how much does a plasma cleaner cost" section + a title/meta that answers buying intent. Near page 1, buying intent, 0 clicks = pure CTR/snippet opportunity. |
| semiconductor vacuum systems | 112 | **8.5** | Identify owning page; optimize title/snippet to capture the click. |
| hdp cvd system | 66 | **13.7** | `hdp-cvd` guide: add explicit "HDP-CVD system / equipment" commercial framing + product link. |

## Tier 3 — Deposition-equipment coverage gaps (impressions at pos 30–43, weak)

| Query | Impr | Position | Action |
|---|---|---|---|
| pecvd equipment / pecvd system | 142 / 106 | 31.6 / 30.5 | PECVD page needs a commercial "equipment/system" section + product CTA. |
| ald systems / atomic layer deposition equipment / ald system | 121 / 66 / 44 | 40.3 / 39.6 / 41.0 | ALD product page: strengthen "ALD systems / ALD equipment" targeting. |
| plasma cleaner manufacturer | 41 | 42.9 | Plasma-cleaner page: add manufacturer/vendor framing. |
| ion beam etching system | 40 | 33.7 | `reactive-ion-etching-vs-ion-milling` / IBE page: add "ion beam etching system" commercial angle. |

## EXCLUDE — macro/news noise (caught by the "equipment/system" regex, NOT a commercial target)

Many high-impression rows are the gossip-news pages catching macro impressions with **0 clicks**: "semi 300mm fab equipment spending 2026 133 billion…" (375 + 172 + 77 + 73 + 55 + 45 + 43 impr, pos 3–7, 0 clicks), "intel equipment orders spike" (41 impr, pos 5.5). This is the same 0.1%-CTR news vanity — reinforces the news kill-gate. Do NOT optimize for these.

---

## Execution order
1. **Tier 1 first** (product pages for rie/icp etcher) — real clicks already, biggest lift.
2. **Tier 2** (title/snippet fixes) — cheapest wins, near page 1 already.
3. **Tier 3** (deposition equipment coverage) — content buildout.
4. Confirm exact owning page for each query before editing (some may need a page that doesn't exist yet, e.g. a dedicated PECVD equipment page).
5. Re-measure this same regex view ~mid-August to track position movement.

**Cross-check needed before editing:** verify each "owning page" above against the live site / DDB, and confirm product pages exist for plasma-cleaner, PECVD, ALD. Where no page owns a Tier-3 cluster, that's a new-page decision (deferred).
