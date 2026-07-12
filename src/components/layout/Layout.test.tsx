import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CartProvider } from '../../contexts/CartContext';
import { Layout } from './Layout';

function renderLayout() {
  return render(
    <MemoryRouter>
      <CartProvider>
        <Layout>
          <div>Page content</div>
        </Layout>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('Layout navigation', () => {
  it('includes all RFQ product platforms that should appear in the Products menu', () => {
    const { container } = renderLayout();

    const productsMenu = container.querySelector('.products-dropdown-wrapper');
    expect(productsMenu).not.toBeNull();
    fireEvent.mouseEnter(productsMenu as Element);

    expect(screen.getByRole('link', { name: /PVD Sputtering/i })).toHaveAttribute('href', '/products/sputter');
    expect(screen.getByRole('link', { name: /IBE\/RIBE/i })).toHaveAttribute('href', '/products/ibe-ribe');
    expect(screen.getByRole('link', { name: /DRIE \/ Bosch Process/i })).toHaveAttribute(
      'href',
      '/insights/deep-reactive-ion-etching-bosch-process',
    );
    expect(screen.getByText('Deep silicon etch process')).toBeInTheDocument();
  });

  it('includes the probe station pages in the Products menu', () => {
    const { container } = renderLayout();
    const productsMenu = container.querySelector('.products-dropdown-wrapper');
    fireEvent.mouseEnter(productsMenu as Element);

    expect(screen.getByRole('link', { name: /Wafer Probe Stations/i })).toHaveAttribute(
      'href', '/wafer-probe-stations'
    );
    expect(screen.getByRole('link', { name: /SEMISHARE Probe Stations/i })).toHaveAttribute(
      'href', '/wafer-probe-stations/semishare'
    );
  });
});
