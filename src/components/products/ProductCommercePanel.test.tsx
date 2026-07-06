import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductCommercePanel } from './ProductCommercePanel';
import type { ProductDetailCommerce } from './ProductDetailPage.types';

const addToCart = vi.fn();

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

const commerce: ProductDetailCommerce = {
  variants: [
    { sku: 'hy-4l-rf', label: 'RF (13.56 MHz)', price: 7999 },
    {
      sku: 'hy-4l-mf',
      label: 'Mid-Frequency (40 kHz)',
      price: 6499,
      cartName: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
    },
  ],
  quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
};

describe('ProductCommercePanel', () => {
  it('defaults to the first variant when defaultSku is omitted', () => {
    render(
      <MemoryRouter>
        <ProductCommercePanel
          commerce={commerce}
          productName="HY-4L Plasma Cleaner"
          productImage="/assets/images/products/ns-plasma-4r/main.jpg"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('$7,999')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RF (13.56 MHz)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mid-Frequency (40 kHz)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches variants and adds the selected SKU and price to cart', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProductCommercePanel
          commerce={commerce}
          productName="HY-4L Plasma Cleaner"
          productImage="/assets/images/products/ns-plasma-4r/main.jpg"
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Mid-Frequency/i }));
    expect(screen.getByText('$6,499')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RF (13.56 MHz)' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Mid-Frequency (40 kHz)' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith({
      id: 'hy-4l-mf',
      sku: 'hy-4l-mf',
      name: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
      price: 6499,
      image: '/assets/images/products/ns-plasma-4r/main.jpg',
    });
  });

  it('keeps the budgetary quote action available', () => {
    render(
      <MemoryRouter>
        <ProductCommercePanel
          commerce={commerce}
          productName="HY-4L Plasma Cleaner"
          productImage="/assets/images/products/ns-plasma-4r/main.jpg"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Request a Budgetary Quote' })).toHaveAttribute(
      'href',
      '/request-quote?products=hy-4l'
    );
  });
});
