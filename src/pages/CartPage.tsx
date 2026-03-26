import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useCart } from '../contexts/useCart';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { SEO } from '../components/common/SEO';

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
          title="Shopping Cart | NineScrolls"
          description="Your shopping cart is empty."
          url="/cart"
        />
        <main className="py-24 px-8 max-w-7xl mx-auto">
          <h1 className="text-5xl font-headline font-bold mb-16">Review Your Order</h1>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/40 mb-6">shopping_cart</span>
            <p className="text-xl text-on-surface-variant mb-8">Your cart is empty.</p>
            <Link
              to="/products"
              className="bg-primary text-white py-4 px-8 rounded-sm font-bold uppercase hover:bg-primary-container transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </main>
      </>
    );
  }

  const total = getTotalPrice();

  return (
    <>
      <SEO
        title="Shopping Cart | NineScrolls"
        description="Review your order and proceed to checkout."
        url="/cart"
      />
      <main className="py-24 px-8 max-w-7xl mx-auto">
        <h1 className="text-5xl font-headline font-bold mb-16">Review Your Order</h1>
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="flex-grow space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white p-8 rounded-xl flex flex-col sm:flex-row gap-8 items-center border border-outline-variant/10">
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
                      aria-label="Decrease quantity"
                    >
                      <span className="material-symbols-outlined text-lg">remove</span>
                    </button>
                    <span className="w-10 h-10 flex items-center justify-center font-bold text-sm">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                      aria-label="Increase quantity"
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
                    aria-label="Remove item"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <aside className="w-full lg:w-96">
            <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/10">
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
                className="w-full bg-primary text-white py-4 rounded-sm font-bold uppercase mt-8 hover:bg-primary-container transition-colors"
              >
                Proceed to Checkout
              </button>
              <Link
                to="/products"
                className="block text-center mt-4 text-sm text-primary font-bold hover:underline"
              >
                Continue Shopping
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
