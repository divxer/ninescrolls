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
  it('includes the PVD sputtering platform in the Products menu', () => {
    const { container } = renderLayout();

    const productsMenu = container.querySelector('.products-dropdown-wrapper');
    expect(productsMenu).not.toBeNull();
    fireEvent.mouseEnter(productsMenu as Element);

    expect(screen.getByRole('link', { name: /PVD Sputtering/i })).toHaveAttribute('href', '/products/sputter');
  });
});
