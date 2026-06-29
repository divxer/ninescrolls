import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { navigate, addItem, trackAddToCart } = vi.hoisted(() => ({
  navigate: vi.fn(),
  addItem: vi.fn(),
  trackAddToCart: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../contexts/useCart', () => ({ useCart: () => ({ addItem }) }));
vi.mock('../services/analytics', () => ({ analytics: { trackAddToCart } }));

import { useProductPage } from './useProductPage';

describe('useProductPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('openContactForm opens the modal, records quote intent, and locks scroll', () => {
    const { result } = renderHook(() => useProductPage());
    act(() => result.current.openContactForm(true));
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.isQuoteIntent).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closeContactForm closes the modal and restores scroll', () => {
    const { result } = renderHook(() => useProductPage());
    act(() => result.current.openContactForm());
    act(() => result.current.closeContactForm());
    expect(result.current.isModalOpen).toBe(false);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('addToCart adds the item (quantity 1), fires GA4 + analytics, and navigates to /cart', () => {
    const gtag = vi.fn();
    vi.stubGlobal('gtag', gtag);

    const { result } = renderHook(() => useProductPage());
    act(() => result.current.addToCart({
      id: 'pluto-f', name: 'PLUTO-F', price: 15999, image: '/img/pluto-f.jpg', sku: 'pluto-f',
    }));

    expect(addItem).toHaveBeenCalledWith({
      id: 'pluto-f', name: 'PLUTO-F', price: 15999, quantity: 1, image: '/img/pluto-f.jpg', sku: 'pluto-f',
    });
    expect(gtag).toHaveBeenCalledWith('event', 'add_to_cart', expect.objectContaining({
      currency: 'USD',
      value: 15999,
      items: [expect.objectContaining({
        item_id: 'pluto-f', item_name: 'PLUTO-F', item_category: 'Plasma Systems',
        item_category2: 'Research Equipment', price: 15999, quantity: 1,
      })],
    }));
    expect(trackAddToCart).toHaveBeenCalledWith('pluto-f', 'PLUTO-F', 15999);
    expect(navigate).toHaveBeenCalledWith('/cart');
  });

  it('addToCart still adds + navigates when window.gtag is absent', () => {
    const { result } = renderHook(() => useProductPage());
    act(() => result.current.addToCart({
      id: 'pluto-t', name: 'PLUTO-T', price: 9999, image: '/img/pluto-t.jpg', sku: 'pluto-t',
    }));
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(trackAddToCart).toHaveBeenCalledWith('pluto-t', 'PLUTO-T', 9999);
    expect(navigate).toHaveBeenCalledWith('/cart');
  });

  it('downloadBrochure triggers an anchor download with the given href/filename', () => {
    const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string) => (tag === 'a' ? anchor : origCreate(tag)),
    );
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    const { result } = renderHook(() => useProductPage());
    act(() => result.current.downloadBrochure('/docs/pluto-f-datasheet.pdf', 'NineScrolls-PLUTO-F-Datasheet.pdf'));

    expect(anchor.href).toBe('/docs/pluto-f-datasheet.pdf');
    expect(anchor.download).toBe('NineScrolls-PLUTO-F-Datasheet.pdf');
    expect(anchor.click).toHaveBeenCalledTimes(1);
  });
});
