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
