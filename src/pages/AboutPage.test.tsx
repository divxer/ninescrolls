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
