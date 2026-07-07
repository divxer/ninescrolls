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
    expect(screen.getByText('Policy and support terms')).toBeInTheDocument();
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
