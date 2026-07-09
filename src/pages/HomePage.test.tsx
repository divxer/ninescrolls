import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

vi.mock('../hooks/useInsightsPosts', () => ({
  useInsightsPosts: () => ({
    loading: false,
    posts: [],
  }),
}));

function renderHomePage(initialEntry = '/') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HomePage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('HomePage redesign', () => {
  it('presents the process-led homepage story in the intended order', () => {
    renderHomePage();

    expect(screen.getByText('Trusted by universities, national laboratories, and semiconductor innovators.')).toBeInTheDocument();

    const expectedStory = [
      'Engineering Plasma Process Solutions',
      'Start with the process, then choose the platform.',
      'Built around the work researchers actually need to do.',
      'Choose the platform that matches the process window.',
      'Peer-reviewed validation for the platforms we represent.',
      'Process notes for engineers who need a faster first decision.',
      'Let’s Build Your Next Process Together',
    ];

    let previousIndex = -1;
    const pageText = document.body.textContent ?? '';

    expectedStory.forEach(copy => {
      const currentIndex = pageText.indexOf(copy);
      expect(currentIndex, `${copy} should be present`).toBeGreaterThan(-1);
      expect(currentIndex, `${copy} should appear after the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    });
  });

  it('keeps primary conversion paths visible from the hero and final CTA', () => {
    renderHomePage();

    const quoteLinks = screen.getAllByRole('link', { name: 'Request Quote' });
    expect(quoteLinks.length).toBeGreaterThanOrEqual(2);
    quoteLinks.forEach(link => expect(link).toHaveAttribute('href', '/request-quote'));

    expect(screen.getByRole('link', { name: 'Explore Products' })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert');
  });

  it('signals the products section is a curated subset via a full-catalog CTA strip', () => {
    renderHomePage();

    // The 6 featured platforms are a curated entry point; a CTA strip (heading +
    // "View All Products" button) makes clear the lineup is larger
    // (avoids "NineScrolls only has 6 platforms").
    expect(screen.getByText('Featured platforms shown above')).toBeInTheDocument();
    expect(screen.getByText(/E-Beam Evaporation, HDP-CVD, Coater\/Developer, stripping, and plasma cleaner systems/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View All Products/i })).toHaveAttribute('href', '/products');
  });

  it('reframes research validation as represented-platform validation without misattribution', () => {
    renderHomePage();

    const pageText = document.body.textContent ?? '';

    // New represented-platform framing is present.
    expect(pageText).toContain('Peer-reviewed validation for the platforms we represent.');
    expect(pageText).toContain('Nature Portfolio');

    // Real, verified papers render (journal + title).
    expect(pageText).toContain('Nature Communications');
    expect(pageText).toContain('Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions');
    expect(pageText).toContain('Light: Science & Applications');
    expect(pageText).toContain('Advanced Materials');
    expect(pageText).toContain('Materials Today');

    // Mis-attribution and unverifiable aggregate are gone.
    expect(pageText).not.toContain('Our equipment has been cited');
    expect(pageText).not.toMatch(/NineScrolls[^.]*\bcited\b/i);
    expect(pageText).not.toContain('500+');

    // Flagship *Nature* is never claimed as a journal, but Nature Portfolio
    // titles (Nature Communications / Light: Science & Applications) are allowed.
    expect(screen.queryByText('Nature', { exact: true })).not.toBeInTheDocument();
  });

  it('uses the finalized brand hero and real standardized product assets', () => {
    renderHomePage();

    expect(screen.getByLabelText('Semiconductor plasma process chamber and wafer in a cleanroom')).toHaveStyle({
      backgroundImage:
        'image-set(url("/assets/images/redesign/hero-home-plasma-process.webp") type("image/webp"), url("/assets/images/redesign/hero-home-plasma-process.jpg") type("image/jpeg"))',
    });

    const expectedProductAssets = [
      ['NineScrolls ICP-RIE plasma etching platform', '/assets/images/redesign/products/icp-rie-standardized.webp'],
      ['NineScrolls RIE etcher platform', '/assets/images/redesign/products/rie-standardized.webp'],
      ['NineScrolls PECVD thin film deposition system', '/assets/images/redesign/products/pecvd-standardized.webp'],
      ['NineScrolls ALD system', '/assets/images/redesign/products/ald-standardized.webp'],
      ['NineScrolls sputtering system', '/assets/images/redesign/products/sputter-standardized.webp'],
      ['NineScrolls ion beam etching system', '/assets/images/redesign/products/ibe-ribe-standardized.webp'],
    ];

    expectedProductAssets.forEach(([alt, src]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', src);
    });
  });

  it('keeps the featured product card from creating an empty two-row void', () => {
    renderHomePage();

    const featuredImage = screen.getByAltText('NineScrolls ICP-RIE plasma etching platform');
    const featuredCard = featuredImage.closest('a');
    const featuredImageWell = featuredImage.closest('div');

    expect(featuredCard).toHaveClass('lg:col-span-2');
    expect(featuredCard).not.toHaveClass('lg:row-span-2');
    expect(featuredImageWell).toHaveClass('bg-[#F4F5F7]');
    expect(featuredImage).toHaveClass('scale-[1.32]');
    expect(within(featuredCard as HTMLElement).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('4-12 in')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('Gas System')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('5 lines std.')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('Stage Temp')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('-70 to 200 C')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('RF Power')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('1000-3000 W')).toBeInTheDocument();
    expect(within(featuredCard as HTMLElement).getByText('Learn More')).toBeInTheDocument();
  });

  it('keeps secondary product cards lightweight and naturally sized', () => {
    renderHomePage();

    const rieImage = screen.getByAltText('NineScrolls RIE etcher platform');
    const rieCard = rieImage.closest('a');

    expect(rieCard).toHaveClass('self-start');
    expect(rieImage).toHaveClass('object-contain');
    expect(rieImage).toHaveClass('scale-[1.12]');
    expect(rieImage).not.toHaveClass('p-4');
    expect(within(rieCard as HTMLElement).getByText('View Platform')).toBeInTheDocument();
    expect(within(rieCard as HTMLElement).queryByText('Key Specifications')).not.toBeInTheDocument();
  });

  it('gives the final CTA a recognizable viewport-focused process texture and trust signals', () => {
    renderHomePage();

    const finalCta = screen.getByTestId('final-cta');

    const viewportTexture = within(finalCta).getByTestId('cta-viewport-texture');
    expect(viewportTexture).toHaveStyle({
      backgroundImage:
        'image-set(url("/assets/images/redesign/hero-home-plasma-process.webp") type("image/webp"), url("/assets/images/redesign/hero-home-plasma-process.jpg") type("image/jpeg"))',
    });
    expect(viewportTexture).toHaveClass('w-[46%]');
    expect(viewportTexture).toHaveClass('right-[-3%]');
    expect(viewportTexture).toHaveClass('bg-[length:175%_auto]');
    expect(viewportTexture).toHaveAttribute('aria-hidden', 'true');
    expect(within(finalCta).getByTestId('cta-edge-highlight')).toBeInTheDocument();
    expect(within(finalCta).getByTestId('cta-wafer-rim')).toBeInTheDocument();
    expect(within(finalCta).getByText('2-Year Warranty')).toBeInTheDocument();
    expect(within(finalCta).getByText('Global Support')).toBeInTheDocument();
    expect(within(finalCta).getByText('Custom Configuration')).toBeInTheDocument();
    expect(within(finalCta).getByText('Research Labs Worldwide')).toBeInTheDocument();
  });

  it('updates related equipment, applications, and resources when a process is selected', async () => {
    const user = userEvent.setup();
    renderHomePage();

    const siliconButton = screen.getByRole('button', { name: 'Silicon Etching' });
    const thinFilmButton = screen.getByRole('button', { name: 'Thin Film Deposition' });

    expect(siliconButton).toHaveAttribute('aria-pressed', 'true');
    expect(thinFilmButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Thin Film Deposition' }));

    const capabilityPanel = screen.getByTestId('active-process-panel');
    expect(within(capabilityPanel).getByText('PECVD')).toBeInTheDocument();
    expect(within(capabilityPanel).getByText('ALD')).toBeInTheDocument();
    expect(within(capabilityPanel).getByText('Advanced Packaging')).toBeInTheDocument();
    expect(within(capabilityPanel).getByText('ALD Basics')).toBeInTheDocument();
    expect(within(capabilityPanel).queryByText('Deep Silicon Bosch Process')).not.toBeInTheDocument();
    expect(siliconButton).toHaveAttribute('aria-pressed', 'false');
    expect(thinFilmButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('deep-links knowledge center cards with intent-specific resource anchors', () => {
    renderHomePage();

    expect(screen.getByRole('link', { name: /Compare ICP-RIE vs RIE/i })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
    expect(screen.getByRole('link', { name: /Deep Silicon Bosch Process/i })).toHaveAttribute(
      'href',
      '/insights/deep-reactive-ion-etching-bosch-process'
    );
    expect(screen.getByRole('link', { name: /Wafer Bonding for 3D Integration/i })).toHaveAttribute(
      'href',
      '/insights/wafer-bonding-technologies-for-3d-integration'
    );
    expect(screen.getByRole('link', { name: /Through-Silicon Vias \(TSV\)/i })).toHaveAttribute(
      'href',
      '/insights/through-silicon-vias-tsv-guide'
    );
    expect(screen.getByRole('link', { name: /ALD Basics/i })).toHaveAttribute(
      'href',
      '/insights/atomic-layer-deposition-ald-comprehensive-guide'
    );
  });

  it('does not declare unsupported bilingual availability in homepage structured data', async () => {
    renderHomePage();

    await waitFor(() => {
      const jsonLdText = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(script => script.textContent ?? '')
        .join('\n');

      expect(jsonLdText).toContain('"availableLanguage":["English"]');
      expect(jsonLdText).not.toContain('Chinese');
    });
  });

  it('honors section hash links when landing on the homepage', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');

    renderHomePage('/#processes');

    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.instances[0]).toHaveAttribute('id', 'processes');
  });
});
