# ICP-RIE Product Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the ICP-RIE product page toward equipment-selection intent while preserving Learn/Compare ownership for ICP-RIE insight pages and keeping RIE/Compact RIE sibling intent locked.

**Architecture:** This is a config-and-test-only SEO polish. The shared `ProductDetailPage` template does not change; `icpEtcherConfig` remains the only production file edited. Tests lock rendered title, meta, visible FAQ, resource anchors, diamond deep link, and sibling meta boundaries.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, `react-helmet-async`, existing `ProductDetailPage` config contract.

## Global Constraints

- Do not change H1 or visible page structure beyond adding the one ICP FAQ item already supported by the template.
- Do not edit DDB insight articles.
- Do not change Product/Offer schema, product specs, images, CTAs, or quote flow.
- FAQPage schema content may change only as the direct result of the visible ICP FAQ addition.
- Preserve the diamond deep link: `/insights/diamond-semiconductor-processing-icp-etching-deposition`.
- Product page Select/Buy owner: `/products/icp-etcher` owns `icp etcher`, `icp-rie system`, `icp-rie equipment`, `icp-rie etching system`, and `research plasma etcher`.
- Learn owner: `/insights/icp-rie-technology-advanced-etching` owns naked `icp rie` and `icp rie etching`.
- Compare owner: `/insights/understanding-differences-pe-rie-icp-rie-plasma-etching` owns `ICP-RIE vs RIE`.
- ICP meta description must be: `Select a NineScrolls ICP-RIE etching system for silicon, MEMS, diamond, and compound semiconductor etching. Review specs, applications, and request a quote.`
- Sibling-page lock assertions must be copied from the current config text, not invented from design prose.

---

## File Structure

- Modify `src/components/products/ICPEtcher.test.tsx`: add red tests for ICP title/meta/FAQ/resources.
- Modify `src/components/products/RIEEtcher.test.tsx`: add a meta regression lock using current RIE config copy.
- Modify `src/components/products/CompactRIE.test.tsx`: add a meta regression lock using current Compact RIE config copy.
- Modify `src/components/products/productDetailConfigs/icpEtcherConfig.ts`: update ICP SEO title/meta, add FAQ item, and change resources to four role-specific anchors.

---

### Task 1: Add Intent-Boundary Regression Tests

**Files:**
- Modify: `src/components/products/ICPEtcher.test.tsx`
- Modify: `src/components/products/RIEEtcher.test.tsx`
- Modify: `src/components/products/CompactRIE.test.tsx`

**Interfaces:**
- Consumes: `ICPEtcher`, `RIEEtcher`, `CompactRIE` wrappers rendered inside `HelmetProvider` and `MemoryRouter`.
- Produces: failing ICP tests for the planned copy change; sibling meta tests that lock current intent text.

- [ ] **Step 1: Add ICP failing test for title and meta**

In `src/components/products/ICPEtcher.test.tsx`, replace the current title-only SEO test:

```ts
  it('does not duplicate the brand in the SEO title', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('ICP-RIE Plasma Etching Platform | NineScrolls LLC');
    });
  });
```

with:

```ts
  it('positions the ICP-RIE product page for equipment-selection intent', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('ICP-RIE Etching System for Research Labs | NineScrolls LLC');
    });

    const metaDescription = document.head.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('ICP-RIE etching system'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('request a quote'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('silicon'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('diamond'));
  });
```

- [ ] **Step 2: Add ICP failing test for system-vs-technology FAQ**

In `src/components/products/ICPEtcher.test.tsx`, add this test after the SEO intent test:

```ts
  it('separates ICP-RIE system selection from ICP-RIE technology learning intent', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Should I use this ICP-RIE system page or the ICP-RIE technology guide?',
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Use this product page when you are selecting an ICP-RIE etching system/i)).toBeInTheDocument();
    expect(screen.getByText(/Use the ICP-RIE Technology guide when you want to learn the principles/i)).toBeInTheDocument();
  });
```

- [ ] **Step 3: Replace ICP resource test with four role-specific anchors**

In `src/components/products/ICPEtcher.test.tsx`, replace:

```ts
  it('uses distinct resource destinations for related resource cards', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /ICP vs RIE/i })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
    expect(screen.getByRole('link', { name: /Bosch Process/i })).toHaveAttribute(
      'href',
      '/insights/deep-reactive-ion-etching-bosch-process'
    );
    expect(screen.getByRole('link', { name: /Diamond Processing/i })).toHaveAttribute(
      'href',
      '/insights/diamond-semiconductor-processing-icp-etching-deposition'
    );
  });
```

with:

```ts
  it('uses intent-specific resource anchors without dropping the diamond deep link', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Learn ICP-RIE Technology' })).toHaveAttribute(
      'href',
      '/insights/icp-rie-technology-advanced-etching'
    );
    expect(screen.getByRole('link', { name: 'Compare ICP-RIE vs RIE' })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
    expect(screen.getByRole('link', { name: 'Deep Silicon Bosch Process' })).toHaveAttribute(
      'href',
      '/insights/deep-reactive-ion-etching-bosch-process'
    );
    expect(screen.getByRole('link', { name: 'Diamond Semiconductor Processing' })).toHaveAttribute(
      'href',
      '/insights/diamond-semiconductor-processing-icp-etching-deposition'
    );
  });
```

- [ ] **Step 4: Add RIE sibling meta lock**

In `src/components/products/RIEEtcher.test.tsx`, add this test after the title test:

```ts
  it('keeps the RIE meta description scoped to RIE selection intent', async () => {
    renderPage();

    await waitFor(() => {
      const metaDescription = document.head.querySelector('meta[name="description"]');
      expect(metaDescription).toHaveAttribute('content', expect.stringContaining('Reactive ion etching platform'));
      expect(metaDescription?.getAttribute('content')).not.toContain('ICP-RIE etching system');
    });
  });
```

- [ ] **Step 5: Add Compact RIE sibling meta lock**

In `src/components/products/CompactRIE.test.tsx`, add this test after the title/canonical/schema test or after the first render test:

```ts
  it('keeps the Compact RIE meta description scoped to space-efficient SV-RIE intent', async () => {
    renderPage();

    await waitFor(() => {
      const metaDescription = document.head.querySelector('meta[name="description"]');
      expect(metaDescription).toHaveAttribute('content', expect.stringContaining('Space-efficient SV-RIE'));
      expect(metaDescription).toHaveAttribute('content', expect.stringContaining('footprint'));
      expect(metaDescription?.getAttribute('content')).not.toContain('ICP-RIE etching system');
    });
  });
```

- [ ] **Step 6: Run tests to verify the ICP tests fail for the intended reason**

Run:

```bash
npm test -- src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx --run
```

Expected:

- FAIL in `ICPEtcher.test.tsx` for the old title `ICP-RIE Plasma Etching Platform | NineScrolls LLC`.
- FAIL in `ICPEtcher.test.tsx` because the new FAQ question is absent.
- FAIL in `ICPEtcher.test.tsx` because `Learn ICP-RIE Technology` and `Compare ICP-RIE vs RIE` anchors are absent.
- PASS sibling RIE and Compact RIE meta tests.

- [ ] **Step 7: Commit red tests**

Do not commit failing tests alone. Keep these changes staged only after Task 2 makes them green.

---

### Task 2: Update ICP-RIE Product Config

**Files:**
- Modify: `src/components/products/productDetailConfigs/icpEtcherConfig.ts`
- Modify: `src/components/products/ICPEtcher.test.tsx`
- Modify: `src/components/products/RIEEtcher.test.tsx`
- Modify: `src/components/products/CompactRIE.test.tsx`

**Interfaces:**
- Consumes: tests from Task 1.
- Produces: ICP product page with equipment-selection title/meta, visible FAQ boundary copy, four resources, and preserved diamond deep link.

- [ ] **Step 1: Update ICP SEO title and meta**

In `src/components/products/productDetailConfigs/icpEtcherConfig.ts`, change:

```ts
  seo: {
    title: 'ICP-RIE Plasma Etching Platform',
    description:
      'ICP-RIE plasma etching platform for research and advanced manufacturing. Supports 4-12 inch wafers, 1000-3000 W ICP power, 5 gas lines standard, and -70 to 200 C stage temperature options.',
    keywords:
      'ICP-RIE, ICP etcher, plasma etching platform, silicon etching, diamond processing, MEMS fabrication, semiconductor etching equipment',
  },
```

to:

```ts
  seo: {
    title: 'ICP-RIE Etching System for Research Labs',
    description:
      'Select a NineScrolls ICP-RIE etching system for silicon, MEMS, diamond, and compound semiconductor etching. Review specs, applications, and request a quote.',
    keywords:
      'ICP-RIE etching system, ICP etcher, ICP-RIE equipment, research plasma etcher, silicon etching, diamond processing, MEMS fabrication',
  },
```

- [ ] **Step 2: Add the system-vs-technology FAQ**

In the `faq` array of `src/components/products/productDetailConfigs/icpEtcherConfig.ts`, insert this object after the existing "What is the difference between ICP-RIE and RIE?" item:

```ts
    {
      question: 'Should I use this ICP-RIE system page or the ICP-RIE technology guide?',
      answer:
        'Use this product page when you are selecting an ICP-RIE etching system, checking wafer size, ICP power, bias control, gas lines, temperature range, applications, or quote requirements. Use the ICP-RIE Technology guide when you want to learn the principles of inductively coupled plasma generation, source power, bias power, and high-density plasma etching.',
    },
```

- [ ] **Step 3: Replace ICP resources with four role-specific links**

In the `resources.items` array of `src/components/products/productDetailConfigs/icpEtcherConfig.ts`, replace the three current items:

```ts
      {
        title: 'ICP vs RIE',
        href: '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching',
        meta: 'Process selection note',
      },
      {
        title: 'Bosch Process',
        href: '/insights/deep-reactive-ion-etching-bosch-process',
        meta: 'Deep silicon etch primer',
      },
      {
        title: 'Diamond Processing',
        href: '/insights/diamond-semiconductor-processing-icp-etching-deposition',
        meta: 'Wide-bandgap etch guide',
      },
```

with:

```ts
      {
        title: 'Learn ICP-RIE Technology',
        href: '/insights/icp-rie-technology-advanced-etching',
        meta: 'Technology guide for ICP-RIE principles',
      },
      {
        title: 'Compare ICP-RIE vs RIE',
        href: '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching',
        meta: 'Process selection comparison',
      },
      {
        title: 'Deep Silicon Bosch Process',
        href: '/insights/deep-reactive-ion-etching-bosch-process',
        meta: 'DRIE and deep silicon etch primer',
      },
      {
        title: 'Diamond Semiconductor Processing',
        href: '/insights/diamond-semiconductor-processing-icp-etching-deposition',
        meta: 'Wide-bandgap diamond etch guide',
      },
```

- [ ] **Step 4: Run targeted tests and verify green**

Run:

```bash
npm test -- src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx --run
```

Expected: PASS for all three files.

- [ ] **Step 5: Run typecheck and build**

Run:

```bash
npx tsc --noEmit --pretty false
npm run build
```

Expected:

- `tsc` exits 0.
- `npm run build` exits 0. Existing lint warnings and chunk-size warnings are acceptable if there are no errors.

- [ ] **Step 6: Inspect diff**

Run:

```bash
git diff -- src/components/products/productDetailConfigs/icpEtcherConfig.ts src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx
```

Expected:

- Only the ICP config changed in production code.
- No `ProductDetailPage` template changes.
- No RIE or Compact RIE config changes.
- Diamond link remains present.

- [ ] **Step 7: Commit implementation**

Run:

```bash
git add src/components/products/productDetailConfigs/icpEtcherConfig.ts src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx
git commit -m "feat: clarify ICP-RIE product SEO boundary"
```

Expected: commit succeeds with only the four listed files.

---

## Final Verification

- [ ] Run:

```bash
git status --short --branch
```

Expected: branch is ahead by the spec/plan/implementation commits; only pre-existing untracked `tmp/` may remain.

- [ ] Push when ready:

```bash
git push origin codex/product-detail-commerce-gallery
```

Expected: existing PR branch updates.

---

## Self-Review

- Spec coverage: Task 1 covers tests for title, meta, FAQ, resources, diamond, and sibling locks. Task 2 covers the only production config change.
- Placeholder scan: no implementation placeholders; every code block contains exact copy.
- Type consistency: no new types or interfaces; all changes use existing `ProductDetailConfig` fields.
