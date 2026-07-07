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
    expect(screen.getByText('Legal and privacy information')).toBeInTheDocument();
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
