import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProductPage } from '../../hooks/useProductPage';
import type { ProductDetailCommerce } from './ProductDetailPage.types';

interface ProductCommercePanelProps {
  commerce: ProductDetailCommerce;
  productName: string;
  productImage: string;
}

const formatUsd = (price: number) => `$${price.toLocaleString('en-US')}`;

export function ProductCommercePanel({ commerce, productName, productImage }: ProductCommercePanelProps) {
  const defaultVariant = commerce.variants.find(variant => variant.sku === commerce.defaultSku) ?? commerce.variants[0];
  const [selectedSku, setSelectedSku] = useState(defaultVariant.sku);
  const { addToCart } = useProductPage();

  const selectedVariant = useMemo(
    () => commerce.variants.find(variant => variant.sku === selectedSku) ?? defaultVariant,
    [commerce.variants, defaultVariant, selectedSku]
  );

  const handleAddToCart = () => {
    addToCart({
      id: selectedVariant.sku,
      sku: selectedVariant.sku,
      name: selectedVariant.cartName ?? `${productName} - ${selectedVariant.label}`,
      price: selectedVariant.price,
      image: productImage,
    });
  };

  return (
    <div data-testid="product-commerce-panel" className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Configuration</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {commerce.variants.map(variant => (
          <button
            key={variant.sku}
            type="button"
            aria-pressed={selectedVariant.sku === variant.sku}
            onClick={() => setSelectedSku(variant.sku)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              selectedVariant.sku === variant.sku
                ? 'border-sky-300 bg-sky-400 text-slate-950'
                : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
            }`}
          >
            {variant.label}
          </button>
        ))}
      </div>
      <p className="mt-5 font-mono text-3xl font-semibold tracking-normal text-white">{formatUsd(selectedVariant.price)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAddToCart}
          className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
        >
          {commerce.addToCartLabel ?? 'Add to Cart'}
        </button>
        <Link
          to={commerce.quoteAction.href}
          className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
        >
          {commerce.quoteAction.label}
        </Link>
      </div>
    </div>
  );
}
