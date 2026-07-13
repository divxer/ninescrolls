import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByRole('link', { name: /SEMISHARE Systems/i })).toHaveAttribute(
      'href', '/wafer-probe-stations/semishare'
    );
  });

  it('no longer renders the removed Solutions/Resources links in the menu', () => {
    const { container } = renderLayout();
    fireEvent.mouseEnter(container.querySelector('.products-dropdown-wrapper') as Element);

    // "Knowledge Center" was unique to the removed column; it is gone entirely.
    expect(screen.queryByRole('link', { name: /Knowledge Center/i })).toBeNull();
    // "Startup Package" still exists in the footer, so scope to the mega menu.
    const menu = document.getElementById('products-mega-menu') as HTMLElement;
    expect(within(menu).queryByRole('link', { name: /Startup Package/i })).toBeNull();
    expect(within(menu).queryByRole('link', { name: /Research & Citations/i })).toBeNull();
  });

  it('renders the probe-station application subheader and preserves sub-item hrefs', () => {
    const { container } = renderLayout();
    fireEvent.mouseEnter(container.querySelector('.products-dropdown-wrapper') as Element);

    const menu = document.getElementById('products-mega-menu') as HTMLElement;
    expect(within(menu).getByText('Applications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cryogenic probing/i })).toHaveAttribute(
      'href', '/applications/cryogenic-probing'
    );
  });

  it('exposes disclosure ARIA state on the Products trigger', () => {
    const { container } = renderLayout();
    const trigger = screen.getByRole('link', { name: /Products/i });

    expect(trigger).toHaveAttribute('aria-controls', 'products-mega-menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.mouseEnter(container.querySelector('.products-dropdown-wrapper') as Element);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the mega menu when Escape is pressed', () => {
    const { container } = renderLayout();
    const wrapper = container.querySelector('.products-dropdown-wrapper') as Element;
    const trigger = screen.getByRole('link', { name: /Products/i });

    fireEvent.mouseEnter(wrapper);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('products-mega-menu')).toBeNull();
  });

  it('closes the mega menu when focus leaves the wrapper entirely', () => {
    const { container } = renderLayout();
    const wrapper = container.querySelector('.products-dropdown-wrapper') as Element;
    const trigger = screen.getByRole('link', { name: /Products/i });

    fireEvent.mouseEnter(wrapper);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Tab past the last focusable link in the menu → focus lands on an element
    // outside the wrapper; the disclosure must close.
    const menu = document.getElementById('products-mega-menu') as HTMLElement;
    const menuLinks = within(menu).getAllByRole('link');
    const lastLink = menuLinks[menuLinks.length - 1];
    fireEvent.blur(lastLink, { relatedTarget: document.body });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('products-mega-menu')).toBeNull();
  });

  it('keeps the mega menu open when focus moves between elements inside the wrapper', () => {
    const { container } = renderLayout();
    const wrapper = container.querySelector('.products-dropdown-wrapper') as Element;
    const trigger = screen.getByRole('link', { name: /Products/i });

    fireEvent.mouseEnter(wrapper);
    const menu = document.getElementById('products-mega-menu') as HTMLElement;
    const menuLinks = within(menu).getAllByRole('link');
    // Focus moving to another link still inside the wrapper must NOT close it.
    fireEvent.blur(menuLinks[0], { relatedTarget: menuLinks[1] });

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('products-mega-menu')).not.toBeNull();
  });

  it('toggles hamburger aria-expanded and exposes aria-controls on the mobile menu', () => {
    renderLayout();
    const hamburger = screen.getByRole('button', { name: /Toggle navigation menu/i });

    expect(hamburger).toHaveAttribute('aria-controls', 'mobile-nav-menu');
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-nav-menu')).toBeNull();

    fireEvent.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-nav-menu')).not.toBeNull();

    fireEvent.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-nav-menu')).toBeNull();
  });

  it('renders the redesigned bottom CTA row', () => {
    const { container } = renderLayout();
    fireEvent.mouseEnter(container.querySelector('.products-dropdown-wrapper') as Element);

    expect(screen.getByRole('link', { name: /Browse All Products/i })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: /Request a Quote/i })).toHaveAttribute('href', '/request-quote');
  });
});
