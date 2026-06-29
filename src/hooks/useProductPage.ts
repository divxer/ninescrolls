import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/useCart';
import { analytics } from '../services/analytics';

export interface ProductCartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  sku: string;
}

/**
 * Shared scaffolding for the product detail pages. Every product page has an
 * identical quote/contact modal, and the purchasable ones share the same
 * add-to-cart (cart + GA4 + analytics + navigate) and datasheet-download logic.
 * Each page still owns its own copy, specs, and layout — only this boilerplate
 * is centralized here.
 */
export function useProductPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuoteIntent, setIsQuoteIntent] = useState(false);
  const navigate = useNavigate();
  const { addItem } = useCart();

  const openContactForm = (quote = false) => {
    setIsQuoteIntent(quote);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const addToCart = (item: ProductCartItem) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      image: item.image,
      sku: item.sku,
    });

    if (typeof window !== 'undefined') {
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: item.price,
          items: [{
            item_id: item.sku,
            item_name: item.name,
            item_category: 'Plasma Systems',
            item_category2: 'Research Equipment',
            price: item.price,
            quantity: 1,
          }],
        });
      }
      analytics.trackAddToCart(item.sku, item.name, item.price);
    }

    navigate('/cart');
  };

  const downloadBrochure = (href: string, filename: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return { isModalOpen, isQuoteIntent, openContactForm, closeContactForm, addToCart, downloadBrochure };
}
