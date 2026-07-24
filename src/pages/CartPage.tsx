import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useCart } from '../contexts/useCart';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { SEO } from '../components/common/SEO';
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';

export function CartPage() {
  useScrollToTop();
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, getTotalPrice } = useCart();

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(id);
    } else {
      updateQuantity(id, newQuantity);
    }
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <>
        <SEO
          title="Shopping Cart"
          description="Your shopping cart is empty."
          url="/cart"
          robots="noindex, follow"
        />
        <div className="bg-[#FAFAFA]">
          <ConversionHero
            eyebrow="Equipment Cart"
            title="Review your equipment order"
            copy="Your cart is empty. Browse configured plasma cleaner systems, compare options, or request a quote for equipment that requires engineering review."
            primaryAction={{ label: 'Continue Shopping', href: '/products' }}
            secondaryAction={{ label: 'Request Quote', href: '/request-quote' }}
            trustItems={['Secure checkout', 'Formal invoice available', 'Engineering support']}
          />
          <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-8 py-12 md:grid-cols-3">
            <ConversionCard>
              <h2 className="font-headline text-xl font-bold text-slate-950">Browse products</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Review plasma cleaners and process equipment families.</p>
              <Link to="/products" className="mt-5 inline-flex text-sm font-bold text-sky-600 hover:text-sky-700">View Products</Link>
            </ConversionCard>
            <ConversionCard>
              <h2 className="font-headline text-xl font-bold text-slate-950">Request a quote</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">For configured systems, custom requirements, or institutional purchasing.</p>
              <Link to="/request-quote" className="mt-5 inline-flex text-sm font-bold text-sky-600 hover:text-sky-700">Request Quote</Link>
            </ConversionCard>
            <ConversionCard>
              <h2 className="font-headline text-xl font-bold text-slate-950">Compare cleaners</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Match chamber size, RF power, and use case before ordering.</p>
              <Link to="/products/plasma-cleaner/compare" className="mt-5 inline-flex text-sm font-bold text-sky-600 hover:text-sky-700">Compare Models</Link>
            </ConversionCard>
          </section>
        </div>
      </>
    );
  }

  const total = getTotalPrice();

  return (
    <>
      <SEO
        title="Shopping Cart"
        description="Review your order and proceed to checkout."
        url="/cart"
        robots="noindex, follow"
      />
      <div className="bg-[#FAFAFA]">
        <ConversionHero
          eyebrow="Equipment Cart"
          title="Review your equipment order"
          copy="Confirm quantities, review pricing, and proceed to secure checkout. For institutional purchasing or custom configurations, request a quote instead."
          secondaryAction={{ label: 'Request Quote', href: '/request-quote' }}
          trustItems={['Secure Stripe checkout', 'Formal invoice available', 'Configuration support']}
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-8 py-12 lg:flex-row">
          <div className="flex-grow space-y-4">
            {items.map((item) => (
              <ConversionCard key={item.id} className="flex flex-col items-center gap-8 sm:flex-row">
                {item.image && (
                  <div className="w-24 h-24 bg-slate-200 rounded-lg shrink-0 overflow-hidden">
                    <OptimizedImage
                      src={item.image}
                      alt={item.name}
                      width={120}
                      height={120}
                    />
                  </div>
                )}
                <div className="flex-grow">
                  {item.sku && (
                    <span className="text-[10px] font-bold text-primary uppercase">SKU: {item.sku}</span>
                  )}
                  <h3 className="text-xl font-bold">{item.name}</h3>
                  <p className="text-sm text-on-surface-variant mt-1">${item.price.toLocaleString()} USD each</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-outline-variant/20 rounded-lg">
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <span className="material-symbols-outlined text-lg">remove</span>
                    </button>
                    <span className="w-10 h-10 flex items-center justify-center font-bold text-sm" aria-live="polite" aria-atomic="true">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <span className="material-symbols-outlined text-lg">add</span>
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-headline font-bold text-xl">${(item.price * item.quantity).toLocaleString()} USD</p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-on-surface-variant hover:text-red-500 mt-2 transition-colors"
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </div>
              </ConversionCard>
            ))}
          </div>
          <aside className="w-full lg:w-96">
            <ConversionCard>
              <h2 className="text-2xl font-headline font-bold mb-8">Summary</h2>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span className="font-bold">${total.toLocaleString()} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Shipping</span>
                  <span className="font-bold">Free</span>
                </div>
                <div className="border-t border-outline-variant/20 pt-4 flex justify-between text-lg">
                  <span className="font-headline font-bold">Total</span>
                  <span className="font-headline font-bold">${total.toLocaleString()} USD</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-sky-600 text-white py-4 rounded-md font-bold mt-8 hover:bg-sky-700 transition-colors"
              >
                Proceed to Checkout
              </button>
              <Link
                to="/products"
                className="block text-center mt-4 text-sm text-primary font-bold hover:underline"
              >
                Continue Shopping
              </Link>
              <div className="mt-8 border-t border-slate-200 pt-6">
                <TrustSignalList
                  items={[
                    { title: 'Secure payment', copy: 'Checkout is handled through Stripe.' },
                    { title: 'Procurement friendly', copy: 'Formal invoice available upon request.' },
                  ]}
                />
              </div>
            </ConversionCard>
          </aside>
        </div>
      </div>
    </>
  );
}
