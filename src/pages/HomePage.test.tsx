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
      'Our equipment has been cited in peer-reviewed research.',
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

  it('uses the finalized brand hero and real standardized product assets', () => {
    renderHomePage();

    expect(screen.getByLabelText('Semiconductor plasma process chamber and wafer in a cleanroom')).toHaveStyle({
      backgroundImage:
        'image-set(url("/assets/images/redesign/hero-home-plasma-process.webp") type("image/webp"), url("/assets/images/redesign/hero-home-plasma-process.jpg") type("image/jpeg"))',
    });

    expect(screen.getByAltText('NineScrolls ICP-RIE plasma etching platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/icp-etcher-technical-render.jpg'
    );
    expect(screen.getByAltText('NineScrolls RIE etcher platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/rie-etcher-technical-render.jpg'
    );
  });

  it('keeps the featured product card from creating an empty two-row void', () => {
    renderHomePage();

    const featuredImage = screen.getByAltText('NineScrolls ICP-RIE plasma etching platform');
    const featuredCard = featuredImage.closest('a');

    expect(featuredCard).toHaveClass('lg:col-span-2');
    expect(featuredCard).not.toHaveClass('lg:row-span-2');
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
    expect(within(capabilityPanel).queryByText('Bosch Process')).not.toBeInTheDocument();
    expect(siliconButton).toHaveAttribute('aria-pressed', 'false');
    expect(thinFilmButton).toHaveAttribute('aria-pressed', 'true');
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
