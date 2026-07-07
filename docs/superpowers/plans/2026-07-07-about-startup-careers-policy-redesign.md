# About, Startup, Careers, and Policy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/about`, `/startup-package`, `/careers`, `/privacy`, and `/return-policy` into the new NineScrolls B2B design language while preserving modal behavior, legal text meaning, recruiting contacts, and SEO/schema contracts.

**Architecture:** Reuse the existing conversion primitives (`ConversionHero`, `ConversionCard`, `TrustSignalList`) for company and conversion-style pages, with page-local data arrays for content. Policy pages use a small local shell pattern inside each page rather than a new design-system abstraction, because this is visual polish and legal text preservation, not a reusable policy framework sprint.

**Tech Stack:** React 18, React Router, React Helmet Async, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Do not redesign Insights, News, admin, product detail pages, cart, checkout, RFQ, contact, or service/support in this phase.
- Do not rename routes.
- Do not add new modals, checkout mechanics, lead-capture APIs, or form fields.
- Do not change legal meaning on `/privacy` or `/return-policy`.
- Do not disclose OEM, manufacturing partner, supplier-chain, distributor, or exclusive-representative relationships on customer-facing pages.
- Do not introduce unsupported competitive claims or unverifiable scale claims.
- Do not create a broad design-system sprint. Reuse existing `src/components/conversion/` primitives where they fit, and add only narrow page-local helpers if necessary.
- Do not invent warranty, installation, training, delivery, or customer-count claims.
- Startup Package may use `2-year standard warranty`; user previously confirmed the standard warranty is 2 years across product lines.
- About removed-copy assertions must lock absence of `6+`, `over three decades`, `three decades`, `Systems Installed Globally`, and `Installed Globally`, in addition to `30+` and `1,000+`.
- Existing dirty workspace items (`package-lock.json` modified and `tmp/` untracked at planning time) are not part of this feature. Do not include them in commits unless explicitly inspected and justified.

---

## File Structure

- Create `src/pages/AboutPage.test.tsx`
  - Locks redesigned About positioning, preserved procurement identifiers, and removed OEM/scale claims.
- Modify `src/pages/AboutPage.tsx`
  - Rewrites the visible page into the new B2B company-trust layout and updates About/Organization schema.
- Create `src/pages/StartupPackagePage.test.tsx`
  - Locks startup-package CTA modal behavior, guide path, product links, and removed unsupported claims.
- Modify `src/pages/StartupPackagePage.tsx`
  - Rewrites the visible page into a focused startup-lab conversion page while preserving `QuoteModal` and `DownloadGateModal`.
- Create `src/pages/CareersPage.test.tsx`
  - Locks role preservation, mailto CTA, and no `JobPosting` schema.
- Modify `src/pages/CareersPage.tsx`
  - Rewrites visible page into the new recruiting polish style.
- Create `src/pages/PrivacyPage.test.tsx`
  - Locks key legal headings, date, and email contact.
- Modify `src/pages/PrivacyPage.tsx`
  - Applies a modern policy shell without changing legal meaning.
- Create `src/pages/ReturnPolicyPage.test.tsx`
  - Locks key legal headings, effective date, support email, and `7 days of delivery`.
- Modify `src/pages/ReturnPolicyPage.tsx`
  - Applies the same policy-shell direction without changing legal meaning.

---

### Task 0: Branch and Baseline Safety

**Files:**
- No production files modified.

**Interfaces:**
- Consumes: current clean `main` branch after redesign merge.
- Produces: isolated branch for implementation.

- [ ] **Step 1: Inspect workspace before branching**

Run:

```bash
git status --short
git branch --show-current
```

Expected:

- Current branch is `main`.
- `package-lock.json` may be modified from prior work.
- `tmp/` may be untracked.

- [ ] **Step 2: Create an isolated branch**

Use the repository's normal branch prefix:

```bash
git switch -c codex/about-startup-careers-policy-redesign
```

Expected:

- New branch `codex/about-startup-careers-policy-redesign`.

- [ ] **Step 3: Do not stage unrelated dirty files**

Run:

```bash
git status --short
```

Expected:

- If `package-lock.json` and `tmp/` still appear, leave them unstaged.
- All later `git add` commands must name specific files.

---

### Task 1: About and Startup Package Redesign

**Files:**
- Create: `src/pages/AboutPage.test.tsx`
- Modify: `src/pages/AboutPage.tsx`
- Create: `src/pages/StartupPackagePage.test.tsx`
- Modify: `src/pages/StartupPackagePage.tsx`

**Interfaces:**
- Consumes:
  - `ConversionHero`, `ConversionCard`, `TrustSignalList` from `src/components/conversion`.
  - `QuoteModal` and `DownloadGateModal` APIs in `StartupPackagePage`.
- Produces:
  - `/about` without customer-facing OEM/supplier-chain disclosure.
  - `/startup-package` with preserved modal behavior and guide download path.

- [ ] **Step 1: Write failing About tests**

Create `src/pages/AboutPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AboutPage } from './AboutPage';

function renderAbout() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function jsonLdScripts() {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => script.textContent ?? '')
    .join('\n');
}

describe('AboutPage redesign', () => {
  it('presents the redesigned company-trust story without OEM-chain disclosure or unverifiable scale claims', async () => {
    renderAbout();

    expect(
      screen.getByRole('heading', { name: /U\.S\.-based support for advanced semiconductor process equipment/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/D-U-N-S/i)).toBeInTheDocument();
    expect(screen.getByText('13-477-6662')).toBeInTheDocument();
    expect(screen.getByText(/UEI/i)).toBeInTheDocument();
    expect(screen.getByText('C4BFCTH5L5D1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore Equipment/i })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: /Talk to an Engineer/i })).toHaveAttribute('href', '/contact?topic=expert');

    const body = document.body;
    expect(body).not.toHaveTextContent(/Tyloong/i);
    expect(body).not.toHaveTextContent(/exclusive U\.S\. representative/i);
    expect(body).not.toHaveTextContent(/manufacturing partner/i);
    expect(body).not.toHaveTextContent(/supplier-provided/i);
    expect(body).not.toHaveTextContent(/distributor/i);
    expect(body).not.toHaveTextContent(/1,000\+/);
    expect(body).not.toHaveTextContent(/30\+/);
    expect(body).not.toHaveTextContent(/6\+/);
    expect(body).not.toHaveTextContent(/over three decades/i);
    expect(body).not.toHaveTextContent(/three decades/i);
    expect(body).not.toHaveTextContent(/Systems Installed Globally/i);
    expect(body).not.toHaveTextContent(/Installed Globally/i);

    await waitFor(() => {
      const schema = jsonLdScripts();
      expect(schema).toContain('"@type":"AboutPage"');
      expect(schema).toContain('NineScrolls LLC');
      expect(schema).not.toMatch(/Tyloong|exclusive U\.S\. representative|manufacturing partner|distributor/i);
    });
  });
});
```

- [ ] **Step 2: Run About tests and verify RED**

Run:

```bash
npm test -- src/pages/AboutPage.test.tsx --run
```

Expected:

- FAIL because `src/pages/AboutPage.test.tsx` is new and current page still renders the old H1 and old OEM/scale copy.

- [ ] **Step 3: Write failing Startup Package tests**

Create `src/pages/StartupPackagePage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StartupPackagePage } from './StartupPackagePage';

vi.mock('../components/common/QuoteModal', () => ({
  QuoteModal: ({
    isOpen,
    onClose,
    onDownloadBrochure,
    downloadLabel,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onDownloadBrochure: () => void;
    downloadLabel: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="quote modal">
        <button type="button" onClick={onDownloadBrochure}>{downloadLabel}</button>
        <button type="button" onClick={onClose}>Close Quote</button>
      </div>
    ) : null,
}));

vi.mock('../components/common/DownloadGateModal', () => ({
  DownloadGateModal: ({
    isOpen,
    onClose,
    fileUrl,
    fileName,
  }: {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="download gate" data-file-url={fileUrl} data-file-name={fileName}>
        <button type="button" onClick={onClose}>Close Download</button>
      </div>
    ) : null,
}));

function renderStartupPackage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <StartupPackagePage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function jsonLdScripts() {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => script.textContent ?? '')
    .join('\n');
}

describe('StartupPackagePage redesign', () => {
  it('presents a verified startup-lab offer and preserves modal conversion paths', async () => {
    const user = userEvent.setup();
    renderStartupPackage();

    expect(
      screen.getByRole('heading', { name: /Startup lab equipment packages for new research programs/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/2-year standard warranty/i).length).toBeGreaterThanOrEqual(1);

    const body = document.body;
    expect(body).not.toHaveTextContent(/2–3 years warranty/i);
    expect(body).not.toHaveTextContent(/free installation and training/i);
    expect(body).not.toHaveTextContent(/300 research institutions/i);
    expect(body).not.toHaveTextContent(/STARTUP PACKAGE 2025/i);

    expect(screen.getByRole('link', { name: /ICP-RIE \/ RIE/i })).toHaveAttribute('href', '/products/icp-etcher');
    expect(screen.getByRole('link', { name: /PECVD \/ ALD/i })).toHaveAttribute('href', '/products/pecvd');
    expect(screen.getByRole('link', { name: /Coater \/ Developer/i })).toHaveAttribute('href', '/products/coater-developer');

    await user.click(screen.getByRole('button', { name: /Request Startup Package Quote/i }));
    expect(screen.getByRole('dialog', { name: /quote modal/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close Quote/i }));
    await user.click(screen.getByRole('button', { name: /Download Equipment Guide/i }));

    const gate = screen.getByRole('dialog', { name: /download gate/i });
    expect(gate).toHaveAttribute('data-file-url', '/NineScrolls-Equipment-Guide.pdf');
    expect(gate).toHaveAttribute('data-file-name', 'NineScrolls-Equipment-Guide.pdf');

    await waitFor(() => {
      const schema = jsonLdScripts();
      expect(schema).toContain('Startup Package');
      expect(schema).not.toMatch(/2–3 years warranty|free installation and training|300 research institutions|extended warranty/i);
    });
  });
});
```

- [ ] **Step 4: Run Startup Package tests and verify RED**

Run:

```bash
npm test -- src/pages/StartupPackagePage.test.tsx --run
```

Expected:

- FAIL because current page has the old H1 and old unsupported claims.

- [ ] **Step 5: Implement About redesign**

Modify `src/pages/AboutPage.tsx`:

- Import conversion primitives:

```tsx
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';
```

- Replace the legacy hero, manufacturing partner, long story, values, trust, and CTA sections with:
  - `ConversionHero`
  - operating model cards
  - compact brand story
  - procurement credibility cards
  - dark CTA section
- Keep `useScrollToTop`, `SEO`, `Helmet`, and schema.
- Use this customer-facing content model:

```tsx
const supportResponsibilities = [
  {
    title: 'Application-first equipment selection',
    copy: 'We help research teams map materials, process goals, wafer formats, and facility constraints to the right equipment platform before quotation.',
  },
  {
    title: 'Configuration and quotation support',
    copy: 'NineScrolls prepares configuration guidance, budgetary quotes, and procurement-ready documentation for universities, national laboratories, and R&D teams.',
  },
  {
    title: 'Delivery and installation coordination',
    copy: 'We coordinate shipment, startup planning, documentation, and handoff details so equipment projects fit the realities of research facilities.',
  },
  {
    title: 'Post-sale service and warranty support',
    copy: 'Our team supports technical questions, service coordination, spare-parts planning, and warranty workflows after installation.',
  },
];
```

- Preserve D-U-N-S `13-477-6662` and UEI `C4BFCTH5L5D1`.
- Ensure the page contains no banned OEM/scale strings listed in Global Constraints.
- Update schema descriptions to match the new positioning and omit OEM-chain wording.

- [ ] **Step 6: Implement Startup Package redesign**

Modify `src/pages/StartupPackagePage.tsx`:

- Keep `useState`, `QuoteModal`, `DownloadGateModal`, `quoteOpen`, `gateOpen`, and both modal handlers.
- Import conversion primitives:

```tsx
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';
```

- Replace `benefitCards` with verified benefits:

```tsx
const benefitCards = [
  {
    title: 'Startup-aware configuration',
    copy: 'Match the first equipment purchase to the process capabilities, facility constraints, and funding timeline of a new research group.',
  },
  {
    title: 'Budgetary quote support',
    copy: 'Prepare procurement-ready estimates and configuration notes for proposal planning, departmental review, or institutional purchasing.',
  },
  {
    title: '2-year standard warranty',
    copy: 'Build the first toolset around NineScrolls equipment with a standard warranty path and technical support after delivery.',
  },
  {
    title: 'Workflow-based bundles',
    copy: 'Discuss etching, deposition, coating, and surface-preparation combinations that fit the lab’s first process roadmap.',
  },
];
```

- Keep product cards for:
  - `ICP-RIE / RIE` → `/products/icp-etcher`
  - `PECVD / ALD` → `/products/pecvd`
  - `Coater / Developer` → `/products/coater-developer`
- Hero H1 must be `Startup lab equipment packages for new research programs`.
- Primary CTA button label must be `Request Startup Package Quote` and open `QuoteModal`.
- Secondary CTA button label must include `Download Equipment Guide` and open `DownloadGateModal`.
- Preserve the guide path and file name exactly:

```tsx
fileUrl="/NineScrolls-Equipment-Guide.pdf"
fileName="NineScrolls-Equipment-Guide.pdf"
```

- Update JSON-LD descriptions to remove old unsupported copy. Do not include `extended warranty` unless the phrase is replaced by `2-year standard warranty`.

- [ ] **Step 7: Run Task 1 tests and verify GREEN**

Run:

```bash
npm test -- src/pages/AboutPage.test.tsx src/pages/StartupPackagePage.test.tsx --run
```

Expected:

- PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add src/pages/AboutPage.tsx src/pages/AboutPage.test.tsx src/pages/StartupPackagePage.tsx src/pages/StartupPackagePage.test.tsx
git commit -m "feat: redesign about and startup package pages"
```

Expected:

- Commit includes only Task 1 files.

---

### Task 2: Careers Redesign

**Files:**
- Create: `src/pages/CareersPage.test.tsx`
- Modify: `src/pages/CareersPage.tsx`

**Interfaces:**
- Consumes:
  - Existing `roles` content in `CareersPage`.
  - `ConversionHero` and `ConversionCard`.
- Produces:
  - `/careers` with modern recruiting layout, preserved roles, and preserved mailto CTA.

- [ ] **Step 1: Write failing Careers tests**

Create `src/pages/CareersPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CareersPage } from './CareersPage';

function renderCareers() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CareersPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function jsonLdScripts() {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => script.textContent ?? '')
    .join('\n');
}

describe('CareersPage redesign', () => {
  it('keeps anticipated roles and careers contact in the redesigned recruiting page', async () => {
    renderCareers();

    expect(
      screen.getByRole('heading', { name: /Build the next generation of scientific equipment support/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Sales Representative')).toBeInTheDocument();
    expect(screen.getByText('Applications / Pre-Sales Engineer')).toBeInTheDocument();
    expect(screen.getByText('Field Service / After-Sales Engineer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /careers@ninescrolls\.com/i })).toHaveAttribute(
      'href',
      'mailto:careers@ninescrolls.com'
    );
    expect(screen.getByRole('link', { name: /About NineScrolls/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Our Equipment/i })).toHaveAttribute('href', '/products');

    await waitFor(() => {
      expect(jsonLdScripts()).not.toContain('JobPosting');
    });
  });
});
```

- [ ] **Step 2: Run Careers tests and verify RED**

Run:

```bash
npm test -- src/pages/CareersPage.test.tsx --run
```

Expected:

- FAIL because current H1 is `Join the Vanguard.`.

- [ ] **Step 3: Implement Careers redesign**

Modify `src/pages/CareersPage.tsx`:

- Import conversion primitives:

```tsx
import { ConversionCard, ConversionHero } from '../components/conversion';
```

- Keep `roles`, `whyValues`, `SEO`, `Helmet`, and Organization schema.
- Replace the page body with:
  - `ConversionHero` using H1 `Build the next generation of scientific equipment support`.
  - Three value cards.
  - `Anticipated Roles` section with restrained cards.
  - Dark or slate CTA section with `mailto:careers@ninescrolls.com`.
- Preserve role titles and role details.
- Do not add `JobPosting` JSON-LD.

- [ ] **Step 4: Run Careers tests and verify GREEN**

Run:

```bash
npm test -- src/pages/CareersPage.test.tsx --run
```

Expected:

- PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/pages/CareersPage.tsx src/pages/CareersPage.test.tsx
git commit -m "feat: redesign careers page"
```

Expected:

- Commit includes only Careers files.

---

### Task 3: Privacy and Return Policy Polish

**Files:**
- Create: `src/pages/PrivacyPage.test.tsx`
- Modify: `src/pages/PrivacyPage.tsx`
- Create: `src/pages/ReturnPolicyPage.test.tsx`
- Modify: `src/pages/ReturnPolicyPage.tsx`

**Interfaces:**
- Consumes:
  - Existing policy text and dates.
- Produces:
  - Redesigned policy shells with preserved legal meaning and locked key policy facts.

- [ ] **Step 1: Write failing Privacy tests**

Create `src/pages/PrivacyPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from './PrivacyPage';

function renderPrivacy() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('PrivacyPage policy polish', () => {
  it('preserves privacy policy facts and contact paths inside the redesigned shell', () => {
    renderPrivacy();

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Last updated: September 14, 2025')).toBeInTheDocument();
    screen.getAllByRole('link', { name: /privacy@ninescrolls\.com/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', 'mailto:privacy@ninescrolls.com');
    });
    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Information We Collect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How We Use Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Rights' })).toBeInTheDocument();
    expect(screen.getByText(/1-2 emails per month/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Privacy tests and verify RED**

Run:

```bash
npm test -- src/pages/PrivacyPage.test.tsx --run
```

Expected:

- PASS may occur because this is a preservation test for existing policy content. If it passes immediately, add a design-shell assertion before implementation:

```tsx
expect(screen.getByText(/Legal and privacy information/i)).toBeInTheDocument();
```

Then rerun and verify RED.

- [ ] **Step 3: Write failing Return Policy tests**

Create `src/pages/ReturnPolicyPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ReturnPolicyPage } from './ReturnPolicyPage';

function renderReturnPolicy() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ReturnPolicyPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ReturnPolicyPage policy polish', () => {
  it('preserves return policy facts and support paths inside the redesigned shell', () => {
    renderReturnPolicy();

    expect(screen.getByRole('heading', { name: 'Return Policy' })).toBeInTheDocument();
    expect(screen.getByText('Effective Date: January 14, 2025')).toBeInTheDocument();
    screen.getAllByRole('link', { name: /support@ninescrolls\.com/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', 'mailto:support@ninescrolls.com');
    });
    expect(screen.getByRole('heading', { name: '1. Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Eligible Returns and Exchanges' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Return Authorization Process' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '7. Technical Support First' })).toBeInTheDocument();
    expect(screen.getByText(/All issues must be reported within 7 days of delivery/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run Return Policy tests and verify RED**

Run:

```bash
npm test -- src/pages/ReturnPolicyPage.test.tsx --run
```

Expected:

- PASS may occur because this is a preservation test for existing policy content. If it passes immediately, add a design-shell assertion before implementation:

```tsx
expect(screen.getByText(/Policy and support terms/i)).toBeInTheDocument();
```

Then rerun and verify RED.

- [ ] **Step 5: Implement Privacy policy shell**

Modify `src/pages/PrivacyPage.tsx`:

- Keep all policy section text semantically equivalent.
- Add a quiet page hero:
  - H1 `Privacy Policy`
  - subcopy `Legal and privacy information`
  - date `Last updated: September 14, 2025`
- Use restrained layout:
  - `bg-[#FAFAFA]`
  - max-width content
  - white cards or bordered sections
  - readable line height
- Preserve all `privacy@ninescrolls.com` mailto links.
- Do not add marketing CTA.

- [ ] **Step 6: Implement Return Policy shell**

Modify `src/pages/ReturnPolicyPage.tsx`:

- Keep the `effectiveDate = 'January 14, 2025'`.
- Keep legal text and section numbering.
- Add a quiet page hero:
  - H1 `Return Policy`
  - subcopy `Policy and support terms`
  - date `Effective Date: January 14, 2025`
- Use the same visual rhythm as Privacy.
- Preserve `support@ninescrolls.com`.
- Preserve `All issues must be reported within 7 days of delivery.`
- Do not add marketing CTA.

- [ ] **Step 7: Run policy tests and verify GREEN**

Run:

```bash
npm test -- src/pages/PrivacyPage.test.tsx src/pages/ReturnPolicyPage.test.tsx --run
```

Expected:

- PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add src/pages/PrivacyPage.tsx src/pages/PrivacyPage.test.tsx src/pages/ReturnPolicyPage.tsx src/pages/ReturnPolicyPage.test.tsx
git commit -m "feat: polish policy pages"
```

Expected:

- Commit includes only policy files.

---

### Task 4: Full Verification and Visual QA

**Files:**
- No new production files expected.
- May modify page files only if verification reveals a defect.

**Interfaces:**
- Consumes:
  - Tasks 1-3 completed.
- Produces:
  - Verified branch ready for review/PR.

- [ ] **Step 1: Run focused page tests**

Run:

```bash
npm test -- src/pages/AboutPage.test.tsx src/pages/StartupPackagePage.test.tsx src/pages/CareersPage.test.tsx src/pages/PrivacyPage.test.tsx src/pages/ReturnPolicyPage.test.tsx --run
```

Expected:

- PASS.

- [ ] **Step 2: Run nearby regression tests**

Run:

```bash
npm test -- src/pages/ContactPage.test.tsx src/pages/ServiceSupportPage.test.tsx src/pages/HomePage.test.tsx src/components/conversion/ConversionLayout.test.tsx --run
```

Expected:

- PASS.

- [ ] **Step 3: Run TypeScript**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected:

- Exit 0.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected:

- Exit 0.
- Existing chunk-size warnings are acceptable.

- [ ] **Step 5: Inspect changed files and unrelated dirty state**

Run:

```bash
git status --short
git diff --stat
git diff -- src/pages/AboutPage.tsx src/pages/StartupPackagePage.tsx src/pages/CareersPage.tsx src/pages/PrivacyPage.tsx src/pages/ReturnPolicyPage.tsx
```

Expected:

- Feature diff contains only intended page/test files.
- `package-lock.json` and `tmp/` remain unstaged unless separately justified.

- [ ] **Step 6: Browser visual QA**

Start dev server if not already running:

```bash
npm run dev -- --host 127.0.0.1
```

Open and inspect:

- `http://127.0.0.1:5173/about`
- `http://127.0.0.1:5173/startup-package`
- `http://127.0.0.1:5173/careers`
- `http://127.0.0.1:5173/privacy`
- `http://127.0.0.1:5173/return-policy`

Expected:

- No overlapping text.
- No card-in-card clutter.
- Buttons and modal triggers work.
- Policy pages are readable and not over-marketed.
- Mobile width remains usable.

- [ ] **Step 7: Push branch**

Run:

```bash
git push -u origin codex/about-startup-careers-policy-redesign
```

Expected:

- Branch pushed.

---

## Self-Review

Spec coverage:

- About OEM removal and procurement identifiers: Task 1.
- Startup modal preservation and unsupported-copy removal: Task 1.
- Careers role/mailto preservation and no `JobPosting`: Task 2.
- Privacy/Return legal content preservation: Task 3.
- Full regression and build: Task 4.

Placeholder scan:

- No `TBD`, `TODO`, or unbound placeholders remain.
- Policy tests may pass before visual implementation because they preserve existing legal text; Task 3 explicitly adds design-shell assertions if needed to satisfy TDD red phase.

Type consistency:

- `ConversionHero`, `ConversionCard`, and `TrustSignalList` names match `src/components/conversion/ConversionLayout.tsx`.
- Modal prop names match `StartupPackagePage.tsx` current usage.

