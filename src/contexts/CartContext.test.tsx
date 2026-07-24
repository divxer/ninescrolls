import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { CartContext, CartProvider, type CartItem } from './CartContext';
import { pruneDelistedItems } from './cartPruning';

const PLUTO: CartItem = { id: 'pluto-t', name: 'PLUTO-T', price: 9999, quantity: 1, sku: 'pluto-t' };
const HY_4L: CartItem = { id: 'hy-4l-rf', name: 'HY-4L - RF', price: 7999, quantity: 1, sku: 'hy-4l-rf' };
const HY_20L: CartItem = { id: 'hy-20l-mf', name: 'HY-20L - MF', price: 11999, quantity: 1, sku: 'hy-20l-mf' };
const HY_20LRF: CartItem = { id: 'hy-20lrf', name: 'HY-20LRF', price: 14499, quantity: 1, sku: 'hy-20lrf' };

describe('pruneDelistedItems', () => {
  it('drops every delisted HY plasma cleaner SKU', () => {
    expect(pruneDelistedItems([PLUTO, HY_4L, HY_20L, HY_20LRF])).toEqual([PLUTO]);
  });

  it('matches on either id or sku, case-insensitively', () => {
    const byIdOnly: CartItem = { id: 'HY-4L', name: 'HY-4L', price: 6499, quantity: 1 };
    const bySkuOnly: CartItem = { id: 'legacy-1', name: 'HY-20L', price: 11999, quantity: 1, sku: 'HY-20L-RF' };
    expect(pruneDelistedItems([byIdOnly, bySkuOnly, PLUTO])).toEqual([PLUTO]);
  });

  it('keeps surviving products untouched', () => {
    const survivors = [PLUTO, { id: 'pluto-f', name: 'PLUTO-F', price: 15999, quantity: 1, sku: 'pluto-f' }];
    expect(pruneDelistedItems(survivors)).toEqual(survivors);
  });
});

function CartProbe() {
  const ctx = useContext(CartContext);
  return <div data-testid="items">{ctx!.items.map((i) => i.id).join(',')}</div>;
}

describe('CartProvider hydration', () => {
  beforeEach(() => localStorage.clear());

  it('prunes delisted items restored from a pre-delisting saved cart', () => {
    localStorage.setItem('cart', JSON.stringify([HY_4L, PLUTO, HY_20LRF]));
    render(
      <CartProvider>
        <CartProbe />
      </CartProvider>
    );
    expect(screen.getByTestId('items').textContent).toBe('pluto-t');
  });

  it('rewrites localStorage without the delisted items after hydration', () => {
    localStorage.setItem('cart', JSON.stringify([HY_20L, PLUTO]));
    render(
      <CartProvider>
        <CartProbe />
      </CartProvider>
    );
    // The persistence effect writes the pruned list back.
    act(() => {});
    expect(JSON.parse(localStorage.getItem('cart')!)).toEqual([PLUTO]);
  });

  it('tolerates a corrupt or non-array saved cart', () => {
    localStorage.setItem('cart', '{"not":"an-array"}');
    render(
      <CartProvider>
        <CartProbe />
      </CartProvider>
    );
    expect(screen.getByTestId('items').textContent).toBe('');
  });
});
