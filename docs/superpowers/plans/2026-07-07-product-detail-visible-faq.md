# Product Detail Visible FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render product-detail FAQ content visibly from the same source array used for `FAQPage` JSON-LD, then review all migrated product FAQ copy for customer-facing use.

**Architecture:** First land a pure template-mechanism commit: no FAQ copy changes, only visible rendering, guarded JSON-LD, and template-level tests. Then land separate copy-review batches with per-page smoke assertions so reviewers can separate rendering mechanics from content changes.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, `react-helmet-async`, existing `ProductDetailPage` config contract.

## Global Constraints

- Do not add a `faqVisible`, `showFaq`, or similar per-page display flag.
- FAQ section renders immediately before `finalCta`; do not anchor placement relative to optional `resources`.
- Render visible FAQ and emit `FAQPage` JSON-LD only when `config.faq.length > 0`.
- Visible FAQ cards and JSON-LD must both map from `config.faq`.
- Do not change `Product/Offer` schema, pricing schema, product specs, commerce behavior, quote flow, images, or CTAs.
- Do not change `PlasmaCleanerOverviewPage`.
- Do not add the deferred ICP-RIE "system vs technology guide" FAQ in this implementation.
- This is post-freeze template change #3: pure increment, full regression, explicit checkpoint after Commit 1.
- Record that JSON-LD emission becomes conditional. No live page output changes because all 17 migrated product configs currently have at least one FAQ; the empty-array template test asserts the new future-facing behavior.

---

## File Structure

- Modify `src/components/products/ProductDetailPage.tsx`: add guarded FAQ schema emission and visible FAQ section before final CTA.
- Modify `src/components/products/ProductDetailPage.test.tsx`: add template-level FAQ/schema parity tests and empty-array guard test.
- Modify 17 product page tests for first-FAQ smoke coverage:
  - `src/components/products/ICPEtcher.test.tsx`
  - `src/components/products/RIEEtcher.test.tsx`
  - `src/components/products/CompactRIE.test.tsx`
  - `src/components/products/PECVDSystem.test.tsx`
  - `src/components/products/ALDSystem.test.tsx`
  - `src/components/products/HDPCVDSystem.test.tsx`
  - `src/components/products/SputterSystem.test.tsx`
  - `src/components/products/IBERIBESystem.test.tsx`
  - `src/components/products/EBeamEvaporator.test.tsx`
  - `src/components/products/CoaterDeveloper.test.tsx`
  - `src/components/products/StriperSystem.test.tsx`
  - `src/components/products/HY4L.test.tsx`
  - `src/components/products/HY20L.test.tsx`
  - `src/components/products/HY20LRF.test.tsx`
  - `src/components/products/PlutoT.test.tsx`
  - `src/components/products/PlutoM.test.tsx`
  - `src/components/products/PlutoF.test.tsx`
- Review and, where needed, modify FAQ copy in 17 configs:
  - RFQ/process equipment batch: `icpEtcherConfig.ts`, `rieEtcherConfig.ts`, `compactRieConfig.ts`, `pecvdSystemConfig.ts`, `aldSystemConfig.ts`, `hdpCvdSystemConfig.ts`, `sputterSystemConfig.ts`, `ibeRibeSystemConfig.ts`, `eBeamEvaporatorConfig.ts`, `coaterDeveloperConfig.ts`, `striperSystemConfig.ts`
  - Commerce cleaner batch: `hy4lConfig.ts`, `hy20lConfig.ts`, `hy20lrfConfig.ts`, `plutoTConfig.ts`, `plutoMConfig.ts`, `plutoFConfig.ts`

---

### Task 1: Template Mechanism Commit

**Files:**
- Modify: `src/components/products/ProductDetailPage.test.tsx`
- Modify: `src/components/products/ProductDetailPage.tsx`

**Interfaces:**
- Consumes: existing required `config.faq: Array<{ question: string; answer: string }>`
- Produces: visible FAQ section and guarded `FAQPage` JSON-LD derived from `config.faq`

- [ ] **Step 1: Add a FAQ JSON-LD helper in the template test**

In `src/components/products/ProductDetailPage.test.tsx`, add this helper after `getProductJsonLd()`:

```ts
function getFaqJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'FAQPage');
}
```

- [ ] **Step 2: Write the failing template parity test**

In `src/components/products/ProductDetailPage.test.tsx`, add this test after `uses product-specific resource destinations from config`:

```ts
  it('renders visible FAQ content from the same source as FAQPage schema', () => {
    renderTemplate();

    expect(screen.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' })).toBeInTheDocument();

    const faqSchema = getFaqJsonLd();
    expect(faqSchema).toBeTruthy();
    expect(faqSchema.mainEntity).toHaveLength(icpEtcherConfig.faq.length);

    for (const item of icpEtcherConfig.faq) {
      expect(screen.getByRole('heading', { level: 3, name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }

    expect(faqSchema.mainEntity.map((entry: { name: string }) => entry.name)).toEqual(
      icpEtcherConfig.faq.map(item => item.question)
    );
    expect(
      faqSchema.mainEntity.map((entry: { acceptedAnswer: { text: string } }) => entry.acceptedAnswer.text)
    ).toEqual(icpEtcherConfig.faq.map(item => item.answer));
  });
```

- [ ] **Step 3: Write the failing empty-array guard test**

In `src/components/products/ProductDetailPage.test.tsx`, add this test after `allows product configs to omit research and resource sections`:

```ts
  it('omits visible FAQ and FAQPage schema when a future config has no FAQ items', () => {
    const configWithoutFaq: ProductDetailConfig = {
      ...icpEtcherConfig,
      slug: 'no-faq-platform',
      faq: [],
      hero: {
        ...icpEtcherConfig.hero,
        title: 'No FAQ Platform',
      },
    };

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={configWithoutFaq} />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'No FAQ Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Frequently Asked Questions' })).not.toBeInTheDocument();
    expect(getFaqJsonLd()).toBeUndefined();
    expect(getProductJsonLd()).toBeTruthy();
  });
```

- [ ] **Step 4: Run the template test and verify RED**

Run:

```bash
npm test -- src/components/products/ProductDetailPage.test.tsx --run
```

Expected:

- FAIL because `Frequently Asked Questions` is not rendered.
- FAIL because the empty-array config still emits `FAQPage` schema.
- Existing product schema tests still execute.

- [ ] **Step 5: Guard FAQ schema emission in `ProductDetailPage.tsx`**

In `src/components/products/ProductDetailPage.tsx`, replace:

```ts
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
```

with:

```ts
  const faqData = config.faq.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: config.faq.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }
    : null;
```

Then replace:

```tsx
        <script type="application/ld+json">{JSON.stringify(faqData)}</script>
```

with:

```tsx
        {faqData && <script type="application/ld+json">{JSON.stringify(faqData)}</script>}
```

- [ ] **Step 6: Render visible FAQ before final CTA**

In `src/components/products/ProductDetailPage.tsx`, immediately before the final CTA section:

```tsx
        <section className="relative isolate overflow-hidden bg-[#070A0F] px-6 py-20 text-white md:px-10 lg:px-16">
```

insert:

```tsx
        {config.faq.length > 0 && (
          <section className="border-t border-slate-200 bg-[#FAFAFA] px-6 py-20 md:px-10 lg:px-16">
            <div className="mx-auto max-w-screen-2xl">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">FAQ</p>
                <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
                  Frequently Asked Questions
                </h2>
              </div>
              <div className="mt-10 grid gap-4 lg:grid-cols-2">
                {config.faq.map(item => (
                  <article key={item.question} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h3 className="text-xl font-semibold tracking-normal text-slate-950">{item.question}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
```

- [ ] **Step 7: Run the template test and verify GREEN**

Run:

```bash
npm test -- src/components/products/ProductDetailPage.test.tsx --run
```

Expected: PASS.

- [ ] **Step 8: Run a scoped product regression**

Run:

```bash
npm test -- src/components/products/ICPEtcher.test.tsx src/components/products/HY4L.test.tsx src/components/products/ProductDetailPage.test.tsx --run
```

Expected: PASS. This checks one RFQ product, one commerce product, and the template fixture.

- [ ] **Step 9: Inspect mechanism diff**

Run:

```bash
git diff -- src/components/products/ProductDetailPage.tsx src/components/products/ProductDetailPage.test.tsx
```

Expected:

- Only visible FAQ rendering and guarded FAQ schema logic.
- No product FAQ copy changes.
- Product/Offer schema construction untouched except for FAQ script guard.

- [ ] **Step 10: Commit template mechanism**

Run:

```bash
git add src/components/products/ProductDetailPage.tsx src/components/products/ProductDetailPage.test.tsx
git commit -m "feat: render product detail FAQs visibly"
```

- [ ] **Step 11: Checkpoint**

Stop and send this checkpoint for review before starting copy batches. Reviewer should verify:

- No FAQ copy changed.
- FAQ schema now guards on `config.faq.length > 0`.
- No live page loses FAQ schema because all 17 migrated configs have at least one FAQ.
- Visible FAQ and schema map from one array.
- Product/Offer schema remains unchanged.

---

### Task 2: RFQ and Process Equipment FAQ Copy Batch

**Files:**
- Review/modify configs:
  - `src/components/products/productDetailConfigs/icpEtcherConfig.ts`
  - `src/components/products/productDetailConfigs/rieEtcherConfig.ts`
  - `src/components/products/productDetailConfigs/compactRieConfig.ts`
  - `src/components/products/productDetailConfigs/pecvdSystemConfig.ts`
  - `src/components/products/productDetailConfigs/aldSystemConfig.ts`
  - `src/components/products/productDetailConfigs/hdpCvdSystemConfig.ts`
  - `src/components/products/productDetailConfigs/sputterSystemConfig.ts`
  - `src/components/products/productDetailConfigs/ibeRibeSystemConfig.ts`
  - `src/components/products/productDetailConfigs/eBeamEvaporatorConfig.ts`
  - `src/components/products/productDetailConfigs/coaterDeveloperConfig.ts`
  - `src/components/products/productDetailConfigs/striperSystemConfig.ts`
- Modify tests:
  - `src/components/products/ICPEtcher.test.tsx`
  - `src/components/products/RIEEtcher.test.tsx`
  - `src/components/products/CompactRIE.test.tsx`
  - `src/components/products/PECVDSystem.test.tsx`
  - `src/components/products/ALDSystem.test.tsx`
  - `src/components/products/HDPCVDSystem.test.tsx`
  - `src/components/products/SputterSystem.test.tsx`
  - `src/components/products/IBERIBESystem.test.tsx`
  - `src/components/products/EBeamEvaporator.test.tsx`
  - `src/components/products/CoaterDeveloper.test.tsx`
  - `src/components/products/StriperSystem.test.tsx`

**Interfaces:**
- Consumes: visible FAQ section from Task 1.
- Produces: customer-facing FAQ copy for RFQ/process equipment pages plus first-question smoke tests.

- [ ] **Step 1: Add first-FAQ smoke assertions to RFQ/process tests**

Add one visible FAQ assertion to each listed test file. Use the exact first question from each product config:

```ts
expect(screen.getByRole('heading', { level: 3, name: '<FIRST FAQ QUESTION>' })).toBeInTheDocument();
```

Use these exact question strings:

- `ICPEtcher.test.tsx`: `What applications is the ICP-RIE platform best suited for?`
- `RIEEtcher.test.tsx`: `What materials can the RIE platform process?`
- `CompactRIE.test.tsx`: `What makes the Compact RIE different from a standard RIE system?`
- `PECVDSystem.test.tsx`: `What films can the PECVD platform deposit?`
- `ALDSystem.test.tsx`: `What is atomic layer deposition and how does it work?`
- `HDPCVDSystem.test.tsx`: `What is HDP-CVD used for?`
- `SputterSystem.test.tsx`: `What materials can the Sputter platform deposit?`
- `IBERIBESystem.test.tsx`: `When should I choose IBE/RIBE instead of RIE?`
- `EBeamEvaporator.test.tsx`: `When should I choose e-beam evaporation instead of sputtering?`
- `CoaterDeveloper.test.tsx`: `When should I choose a coater/developer track instead of a manual spin coater?`
- `StriperSystem.test.tsx`: `When should I choose a dedicated plasma striper instead of a plasma cleaner?`

- [ ] **Step 2: Run RFQ/process smoke tests and verify current copy is visible**

Run:

```bash
npm test -- src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx src/components/products/PECVDSystem.test.tsx src/components/products/ALDSystem.test.tsx src/components/products/HDPCVDSystem.test.tsx src/components/products/SputterSystem.test.tsx src/components/products/IBERIBESystem.test.tsx src/components/products/EBeamEvaporator.test.tsx src/components/products/CoaterDeveloper.test.tsx src/components/products/StriperSystem.test.tsx --run
```

Expected: PASS after Task 1. If any test fails, fix the smoke selector to match the config's first question exactly; do not change copy just to satisfy a mistaken selector.

- [ ] **Step 3: Review RFQ/process FAQ copy using the checklist**

For each RFQ/process config, read every `faq` question and answer. Apply this exact checklist:

- Answer is visible-page quality, not schema filler.
- Answer is direct and useful for product selection.
- Answer is 1-3 sentences unless a verified technical nuance requires more.
- No OEM, supplier-provided, distributor, or internal sourcing language.
- No unverified citation counts, "trusted by" claims, or hidden marketing filler.
- Intent boundary is preserved:
  - ICP-RIE product FAQ stays Select/Buy, not a broad Learn article.
  - RIE and Compact RIE stay distinct from ICP-RIE.
  - Striper stays stripping/ashing and does not collapse into generic plasma cleaning.
  - Coater/Developer stays lithography track, not plasma/vacuum processing.

If a config already passes all checks, leave the copy unchanged. If a config fails a check, edit only the affected question or answer.

- [ ] **Step 4: Scan RFQ/process config copy for banned customer-facing terms**

Run:

```bash
rg -n "supplier-provided|distributor|OEM|trusted by|60\\+|2800\\+|internal" src/components/products/productDetailConfigs/icpEtcherConfig.ts src/components/products/productDetailConfigs/rieEtcherConfig.ts src/components/products/productDetailConfigs/compactRieConfig.ts src/components/products/productDetailConfigs/pecvdSystemConfig.ts src/components/products/productDetailConfigs/aldSystemConfig.ts src/components/products/productDetailConfigs/hdpCvdSystemConfig.ts src/components/products/productDetailConfigs/sputterSystemConfig.ts src/components/products/productDetailConfigs/ibeRibeSystemConfig.ts src/components/products/productDetailConfigs/eBeamEvaporatorConfig.ts src/components/products/productDetailConfigs/coaterDeveloperConfig.ts src/components/products/productDetailConfigs/striperSystemConfig.ts
```

Expected:

- No matches in FAQ copy.
- If a match appears outside FAQ copy, inspect it and confirm it is not customer-facing FAQ text before proceeding.

- [ ] **Step 5: Run RFQ/process tests after copy review**

Run:

```bash
npm test -- src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx src/components/products/PECVDSystem.test.tsx src/components/products/ALDSystem.test.tsx src/components/products/HDPCVDSystem.test.tsx src/components/products/SputterSystem.test.tsx src/components/products/IBERIBESystem.test.tsx src/components/products/EBeamEvaporator.test.tsx src/components/products/CoaterDeveloper.test.tsx src/components/products/StriperSystem.test.tsx --run
```

Expected: PASS.

- [ ] **Step 6: Commit RFQ/process FAQ batch**

Run:

```bash
git add src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx src/components/products/PECVDSystem.test.tsx src/components/products/ALDSystem.test.tsx src/components/products/HDPCVDSystem.test.tsx src/components/products/SputterSystem.test.tsx src/components/products/IBERIBESystem.test.tsx src/components/products/EBeamEvaporator.test.tsx src/components/products/CoaterDeveloper.test.tsx src/components/products/StriperSystem.test.tsx src/components/products/productDetailConfigs/icpEtcherConfig.ts src/components/products/productDetailConfigs/rieEtcherConfig.ts src/components/products/productDetailConfigs/compactRieConfig.ts src/components/products/productDetailConfigs/pecvdSystemConfig.ts src/components/products/productDetailConfigs/aldSystemConfig.ts src/components/products/productDetailConfigs/hdpCvdSystemConfig.ts src/components/products/productDetailConfigs/sputterSystemConfig.ts src/components/products/productDetailConfigs/ibeRibeSystemConfig.ts src/components/products/productDetailConfigs/eBeamEvaporatorConfig.ts src/components/products/productDetailConfigs/coaterDeveloperConfig.ts src/components/products/productDetailConfigs/striperSystemConfig.ts
git commit -m "docs: polish RFQ product FAQ copy"
```

If no FAQ copy changed and only smoke tests were added, use:

```bash
git commit -m "test: cover RFQ product visible FAQs"
```

---

### Task 3: Commerce Cleaner FAQ Copy Batch

**Files:**
- Review/modify configs:
  - `src/components/products/productDetailConfigs/hy4lConfig.ts`
  - `src/components/products/productDetailConfigs/hy20lConfig.ts`
  - `src/components/products/productDetailConfigs/hy20lrfConfig.ts`
  - `src/components/products/productDetailConfigs/plutoTConfig.ts`
  - `src/components/products/productDetailConfigs/plutoMConfig.ts`
  - `src/components/products/productDetailConfigs/plutoFConfig.ts`
- Modify tests:
  - `src/components/products/HY4L.test.tsx`
  - `src/components/products/HY20L.test.tsx`
  - `src/components/products/HY20LRF.test.tsx`
  - `src/components/products/PlutoT.test.tsx`
  - `src/components/products/PlutoM.test.tsx`
  - `src/components/products/PlutoF.test.tsx`

**Interfaces:**
- Consumes: visible FAQ section from Task 1.
- Produces: customer-facing FAQ copy for commerce cleaner pages plus first-question smoke tests.

- [ ] **Step 1: Add first-FAQ smoke assertions to commerce cleaner tests**

Add one visible FAQ assertion to each listed test file. Use the exact first question from each product config:

```ts
expect(screen.getByRole('heading', { level: 3, name: '<FIRST FAQ QUESTION>' })).toBeInTheDocument();
```

Use these exact question strings:

- `HY4L.test.tsx`: `Which HY-4L frequency should I choose?`
- `HY20L.test.tsx`: `Which HY-20L frequency should I choose?`
- `HY20LRF.test.tsx`: `How is HY-20LRF different from HY-20L?`
- `PlutoT.test.tsx`: `How is PLUTO-T different from HY-4L?`
- `PlutoM.test.tsx`: `How is PLUTO-M different from PLUTO-T?`
- `PlutoF.test.tsx`: `How is PLUTO-F different from PLUTO-M?`

- [ ] **Step 2: Run commerce cleaner smoke tests and verify current copy is visible**

Run:

```bash
npm test -- src/components/products/HY4L.test.tsx src/components/products/HY20L.test.tsx src/components/products/HY20LRF.test.tsx src/components/products/PlutoT.test.tsx src/components/products/PlutoM.test.tsx src/components/products/PlutoF.test.tsx --run
```

Expected: PASS after Task 1. If any test fails, fix the smoke selector to match the config's first question exactly; do not change copy just to satisfy a mistaken selector.

- [ ] **Step 3: Review commerce cleaner FAQ copy using the checklist**

For each commerce cleaner config, read every `faq` question and answer. Apply this exact checklist:

- Answer is visible-page quality, not schema filler.
- Answer supports direct purchase or institutional quote decision-making.
- Public prices and direct-order claims match the product's commerce config and checkout catalog.
- Answer is 1-3 sentences.
- No OEM, supplier-provided, distributor, or internal sourcing language.
- Intent boundary is preserved:
  - Cleaner pages stay cleaning/surface activation/bonding prep/sample prep.
  - Cleaner pages do not drift into photoresist stripping/ashing; that intent belongs to Striper.
  - HY family and PLUTO family distinction remains clear.

If a config already passes all checks, leave the copy unchanged. If a config fails a check, edit only the affected question or answer.

- [ ] **Step 4: Scan commerce cleaner config copy for banned customer-facing terms**

Run:

```bash
rg -n "supplier-provided|distributor|OEM|trusted by|60\\+|2800\\+|internal|photoresist stripping|ashing" src/components/products/productDetailConfigs/hy4lConfig.ts src/components/products/productDetailConfigs/hy20lConfig.ts src/components/products/productDetailConfigs/hy20lrfConfig.ts src/components/products/productDetailConfigs/plutoTConfig.ts src/components/products/productDetailConfigs/plutoMConfig.ts src/components/products/productDetailConfigs/plutoFConfig.ts
```

Expected:

- No matches in FAQ copy.
- The terms `photoresist stripping` and `ashing` should not appear in cleaner FAQ copy. If they appear in a compare/resource slug outside FAQ copy, inspect manually before proceeding.

- [ ] **Step 5: Run commerce cleaner tests after copy review**

Run:

```bash
npm test -- src/components/products/HY4L.test.tsx src/components/products/HY20L.test.tsx src/components/products/HY20LRF.test.tsx src/components/products/PlutoT.test.tsx src/components/products/PlutoM.test.tsx src/components/products/PlutoF.test.tsx --run
```

Expected: PASS.

- [ ] **Step 6: Commit commerce cleaner FAQ batch**

Run:

```bash
git add src/components/products/HY4L.test.tsx src/components/products/HY20L.test.tsx src/components/products/HY20LRF.test.tsx src/components/products/PlutoT.test.tsx src/components/products/PlutoM.test.tsx src/components/products/PlutoF.test.tsx src/components/products/productDetailConfigs/hy4lConfig.ts src/components/products/productDetailConfigs/hy20lConfig.ts src/components/products/productDetailConfigs/hy20lrfConfig.ts src/components/products/productDetailConfigs/plutoTConfig.ts src/components/products/productDetailConfigs/plutoMConfig.ts src/components/products/productDetailConfigs/plutoFConfig.ts
git commit -m "docs: polish cleaner product FAQ copy"
```

If no FAQ copy changed and only smoke tests were added, use:

```bash
git commit -m "test: cover cleaner product visible FAQs"
```

---

### Task 4: Full Verification and Push

**Files:**
- No new code files expected.
- Verifies all changes from Tasks 1-3.

**Interfaces:**
- Consumes: visible FAQ template and all smoke tests.
- Produces: verified branch state ready for final review.

- [ ] **Step 1: Run full scoped regression**

Run:

```bash
npm test -- src/components/products src/pages/HomePage.test.tsx src/pages/PlasmaCleanerOverviewPage.test.tsx --run
```

Expected:

- PASS.
- Product tests include visible FAQ smoke coverage.
- `PlasmaCleanerOverviewPage` still passes unchanged.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected:

- exit 0.
- Existing lint warnings and chunk-size warnings are acceptable.
- No new errors.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git diff --stat HEAD~3..HEAD
git status --short
```

Expected:

- Three implementation commits after this plan: template mechanism, RFQ/process FAQ batch, commerce cleaner FAQ batch.
- No uncommitted tracked changes.
- Untracked `tmp/` may remain; do not stage it.

- [ ] **Step 5: Push branch**

Run:

```bash
git push origin codex/product-detail-commerce-gallery
```

- [ ] **Step 6: Send final review checkpoint**

Report:

- Commit hashes for Task 1, Task 2, and Task 3.
- Verification commands and pass counts.
- Whether any FAQ copy changed; if so, list changed config files.
- Confirm `Product/Offer` schema unchanged.
- Confirm `FAQPage` JSON-LD is now conditional and no live page is affected because all 17 migrated configs have FAQ items.

## Self-Review

- Spec coverage: Task 1 covers visible FAQ/schema parity and empty-array guard; Tasks 2-3 cover all 17 product configs and page smoke tests; Task 4 covers regression commands.
- Placeholder scan: no TBD/TODO placeholders; every step has concrete files, commands, and expected outcomes.
- Type consistency: plan uses existing `config.faq` shape and does not introduce new interfaces or flags.
- Commit discipline: template mechanism commit lands before any copy changes; content batches are separated by product family.
