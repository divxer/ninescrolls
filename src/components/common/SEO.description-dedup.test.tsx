import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, describe, expect, it } from 'vitest';
import { SEO } from './SEO';

/**
 * Regression guard for the duplicate meta-description bug.
 *
 * index.html ships a static `<meta name="description">` as a non-JS fallback.
 * react-helmet-async only reconciles tags carrying `data-rh` (it commits via
 * `head.querySelectorAll('meta[data-rh]')`). If the static tag lacks that
 * attribute, Helmet cannot see it, so every route that renders <SEO> ends up
 * with TWO descriptions — the homepage fallback first — and search engines can
 * pick the wrong snippet. The fix marks the static tag `data-rh="true"`.
 */

const HOMEPAGE_FALLBACK =
  'Research‑grade plasma etching systems (RIE/ICP), ALD and CVD equipment for semiconductor manufacturing and advanced materials research.';

function readStaticFallback() {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const descriptionTags = html.match(/<meta[^>]*name=["']description["'][^>]*>/gi) ?? [];

  expect(descriptionTags, 'index.html must contain exactly one static description fallback').toHaveLength(1);

  const tag = descriptionTags[0];
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];

  expect(tag, 'static description must be Helmet-managed via data-rh').toMatch(/data-rh=["']true["']/i);
  expect(content, 'static description fallback content must remain the homepage copy').toBe(HOMEPAGE_FALLBACK);

  return content!;
}

function seedStaticFallback(content: string) {
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'description');
  meta.setAttribute('data-rh', 'true'); // mirrors the fixed index.html
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

afterEach(() => {
  document.head.querySelectorAll('meta[name="description"]').forEach((el) => el.remove());
});

describe('per-route meta description output pipeline', () => {
  it('leaves exactly one description — the route-specific one — after Helmet reconciles the static fallback', async () => {
    seedStaticFallback(readStaticFallback());
    const routeDescription = 'Reactive ion etcher (RIE) system for university and R&D labs.';

    render(
      <HelmetProvider>
        <SEO title="Reactive Ion Etcher (RIE)" description={routeDescription} url="/products/rie-etcher" />
      </HelmetProvider>
    );

    await waitFor(() => {
      const metas = document.head.querySelectorAll('meta[name="description"]');
      expect(metas).toHaveLength(1);
      expect(metas[0].getAttribute('content')).toBe(routeDescription);
    });
    // The stale homepage fallback must not survive on a product route.
    expect(document.head.innerHTML).not.toContain(HOMEPAGE_FALLBACK);
  });
});

describe('index.html static description', () => {
  it('keeps exactly one Helmet-managed fallback with the expected homepage copy', () => {
    readStaticFallback();
  });
});
