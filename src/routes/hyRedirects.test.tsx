import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './index';

// The delisted HY plasma cleaners must not 404 for visitors arriving from
// still-indexed URLs or old bookmarks; every legacy path redirects to the
// PLUTOVAC overview that replaced the line.
const HY_PATHS = [
  '/products/hy-4l',
  '/products/hy-4l-rf',
  '/products/hy-4l-mf',
  '/products/hy-20l',
  '/products/hy-20lrf',
];

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

describe('legacy HY plasma cleaner redirects', () => {
  it.each(HY_PATHS)('redirects %s to the plasma cleaner overview', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('pathname').textContent).toBe('/products/plasma-cleaner');
  });
});
