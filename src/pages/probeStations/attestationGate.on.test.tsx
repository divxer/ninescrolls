// src/pages/probeStations/attestationGate.on.test.tsx
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

// Non-empty badge fixture (production list is empty, pinned by
// semishare.test.ts) — proves the ON flag actually renders configured badges.
const TEST_BADGE = vi.hoisted(() => ({ src: '/test-partner-badge.svg', alt: 'Test partner badge' }));

vi.mock('../../data/probeStations/semishare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/probeStations/semishare')>();
  return { ...actual, ATTESTATION_CONFIRMED: true, PARTNER_BADGE_ASSETS: [TEST_BADGE] };
});

// NOTE: everything imported from the mocked module except ATTESTATION_CONFIRMED
// and PARTNER_BADGE_ASSETS is the actual implementation (the mock spreads the
// original), so the getters and pattern list used as expected values below are
// real. The getters' literal outputs are pinned in semishare.test.ts — using
// them here is not circular.

const NON_BRAND_PAGES = [
  ['/wafer-probe-stations', WaferProbeStationsPage],
  ['/applications/cryogenic-probing', CryogenicProbingPage],
  ['/applications/silicon-photonics-probing', SiliconPhotonicsProbingPage],
] as const;

function collectSurfaces(container: HTMLElement): Array<[string, string]> {
  const jsonLdText = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  const imgAttrs = Array.from(container.querySelectorAll('img'))
    .map((img) => `${img.getAttribute('alt') ?? ''} ${img.getAttribute('src') ?? ''}`)
    .join('\n');
  return [
    ['body', container.textContent ?? ''],
    ['title', document.title],
    ['json-ld', jsonLdText],
    ['images', imgAttrs],
  ];
}

function cleanupHead() {
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
}

describe('attestation gate ON (mocked written confirmation)', () => {
  it('brand page renders each gated output from the registry: banner, title, JSON-LD, badges', async () => {
    const { unmount } = render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/wafer-probe-stations/semishare']}>
          <SemishareBrandPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    // Banner — expected value resolved by the registry getter for ON
    expect(screen.getByText(getPartnerBannerText(true))).toBeInTheDocument();

    // Title (gated variant + SEO suffix)
    await waitFor(() => {
      expect(document.title).toBe(`${getBrandPageSeoTitle(true)} | NineScrolls LLC`);
    });

    // Organization JSON-LD claim
    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => JSON.parse(s.textContent || '{}'));
    const org = jsonLd.find((s) => s['@type'] === 'Organization');
    expect(org?.description).toBe(getPartnerJsonLdDescription(true));

    // Badge gate: the mocked fixture MUST render with its exact src and alt —
    // proves ON actually flows registry assets to the DOM.
    expect(screen.getByAltText(TEST_BADGE.alt)).toHaveAttribute('src', TEST_BADGE.src);
    // And nothing badge-shaped outside the registry list may render.
    const strayBadgeImgs = Array.from(document.images).filter(
      (img) =>
        /badge|partner-?logo/i.test(`${img.src} ${img.alt}`) &&
        img.getAttribute('src') !== TEST_BADGE.src
    );
    expect(strayBadgeImgs).toEqual([]);
    unmount();
    cleanupHead();
  });

  it.each(NON_BRAND_PAGES)(
    '%s still emits NO gated wording or badge assets even when ON',
    async (path, Page) => {
      // Test-side fix (helmet-timing/jsdom artifact): react-helmet-async does
      // not revert document.title on unmount. The preceding test in this file
      // sets a title containing "Channel Partner"; without resetting first,
      // the generic contains check below would trivially pass on that stale
      // title instead of waiting for this page's actual commit.
      document.title = '';
      const { container, unmount } = render(
        <HelmetProvider>
          <MemoryRouter initialEntries={[path]}>
            <Page />
          </MemoryRouter>
        </HelmetProvider>
      );
      await waitFor(() => expect(document.title).toContain('NineScrolls LLC'));

      for (const [surface, text] of collectSurfaces(container)) {
        for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
          expect(text, `${path} ${surface} vs ${pattern}`).not.toMatch(pattern);
        }
      }
      // The badge fixture's src/alt do not match FORBIDDEN patterns, so its
      // absence must be asserted explicitly: only the brand page may render
      // registry badges, even with the flag ON.
      expect(container.querySelector(`img[src="${TEST_BADGE.src}"]`), `${path} badge src`).toBeNull();
      expect(screen.queryByAltText(TEST_BADGE.alt), `${path} badge alt`).toBeNull();
      unmount();
      cleanupHead();
    }
  );
});
