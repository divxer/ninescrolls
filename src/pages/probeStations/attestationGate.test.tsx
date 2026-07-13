// src/pages/probeStations/attestationGate.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  FORBIDDEN_ATTESTATION_PATTERNS,
  getBrandPageSeoTitle,
  getPartnerBannerText,
  getPartnerJsonLdDescription,
} from '../../data/probeStations/semishare';
import { WaferProbeStationsPage } from './WaferProbeStationsPage';
import { SemishareBrandPage } from './SemishareBrandPage';
import { CryogenicProbingPage } from './CryogenicProbingPage';
import { SiliconPhotonicsProbingPage } from './SiliconPhotonicsProbingPage';

// The production badge list is EMPTY (pinned by semishare.test.ts). To prove
// the gate actually controls badge rendering — not just that nothing renders
// because nothing is configured — these tests mock a non-empty fixture list.
// Flag stays at its real value (OFF) here.
const TEST_BADGE = vi.hoisted(() => ({ src: '/test-partner-badge.svg', alt: 'Test partner badge' }));

vi.mock('../../data/probeStations/semishare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/probeStations/semishare')>();
  return { ...actual, PARTNER_BADGE_ASSETS: [TEST_BADGE] };
});

// Expected values below come from the registry getters (getPartnerBannerText
// etc.) — real implementations, since the mock spreads the actual module.
// This is NOT circular: the getters' literal outputs are pinned in
// src/data/probeStations/semishare.test.ts; these tests verify the pages
// actually render what the registry resolves for each flag state.

const PAGES = [
  ['/wafer-probe-stations', WaferProbeStationsPage],
  ['/wafer-probe-stations/semishare', SemishareBrandPage],
  ['/applications/cryogenic-probing', CryogenicProbingPage],
  ['/applications/silicon-photonics-probing', SiliconPhotonicsProbingPage],
] as const;

function renderPage(path: string, Page: (typeof PAGES)[number][1]) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Page />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function cleanupHead() {
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
}

describe('attestation gate OFF (default)', () => {
  it.each(PAGES)('%s emits no gated wording in body, title, JSON-LD, or image attrs', async (path, Page) => {
    // Test-side fix (helmet-timing/jsdom artifact): react-helmet-async does
    // not revert document.title on unmount, and every page's title ends in
    // "| NineScrolls LLC" — so without resetting first, the generic contains
    // check below would trivially pass on a PRIOR test's stale title instead
    // of waiting for this page's actual commit.
    document.title = '';
    const { container, unmount } = renderPage(path, Page);

    // Flush react-helmet-async head commits before reading document.title/head
    await waitFor(() => expect(document.title).toContain('NineScrolls LLC'));

    const jsonLdText = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    const imgAttrs = Array.from(container.querySelectorAll('img'))
      .map((img) => `${img.getAttribute('alt') ?? ''} ${img.getAttribute('src') ?? ''}`)
      .join('\n');
    const surfaces: Array<[string, string]> = [
      ['body', container.textContent ?? ''],
      ['title', document.title],
      ['json-ld', jsonLdText],
      ['images', imgAttrs],
    ];

    for (const [surface, text] of surfaces) {
      for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
        expect(text, `${path} ${surface} vs ${pattern}`).not.toMatch(pattern);
      }
    }
    // Badge gate: the mocked fixture list is non-empty, so this actually
    // proves the OFF flag suppresses configured badges (not merely that no
    // badge is configured).
    expect(imgAttrs, `${path} badge src`).not.toContain(TEST_BADGE.src);
    expect(screen.queryByAltText(TEST_BADGE.alt), `${path} badge alt`).toBeNull();
    unmount();
    cleanupHead();
  });

  it('brand page renders exactly the neutral registry outputs: banner, title, Organization JSON-LD', async () => {
    const { unmount } = renderPage('/wafer-probe-stations/semishare', SemishareBrandPage);

    expect(screen.getByText(getPartnerBannerText(false))).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe(`${getBrandPageSeoTitle(false)} | NineScrolls LLC`);
    });
    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => JSON.parse(s.textContent || '{}'));
    const org = jsonLd.find((s) => s['@type'] === 'Organization');
    expect(org?.description).toBe(getPartnerJsonLdDescription(false));
    unmount();
    cleanupHead();
  });
});
