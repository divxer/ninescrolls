import { Link, useNavigate } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { useCart } from '../contexts/CartContext';
import { OptimizedImage } from '../components/common/OptimizedImage';
import { SEO } from '../components/common/SEO';
import '../styles/CartPage.css';

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
        <section className="cart-page">
          <div className="container">
            <h1>Shopping Cart</h1>
            <div className="cart-empty">
              <p>Your cart is empty.</p>
              <Link to="/products" className="btn btn-primary">
                Continue Shopping
              </Link>
            </div>
          </div>
        </section>
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
      <section className="cart-page">
        <div className="container">
          <h1>Shopping Cart</h1>
          <div className="cart-content">
            <div className="cart-items">
              {items.map((item) => (
                <div key={item.id} className="cart-item">
                  {item.image && (
                    <div className="cart-item-image">
                      <OptimizedImage
                        src={item.image}
                        alt={item.name}
                        width={120}
                        height={120}
                      />
                    </div>
                  )}
                  <div className="cart-item-details">
                    <h3>{item.name}</h3>
                    {item.sku && <p className="cart-item-sku">SKU: {item.sku}</p>}
                    <p className="cart-item-price">${item.price.toLocaleString()} USD</p>
                  </div>
                  <div className="cart-item-controls">
                    <div className="quantity-control">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        className="quantity-btn"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="quantity-btn"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="remove-btn"
                      aria-label="Remove item"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="cart-item-total">
                    ${(item.price * item.quantity).toLocaleString()} USD
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <h2>Order Summary</h2>
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>${total.toLocaleString()} USD</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span>Free</span>
              </div>
              <div className="summary-row summary-total">
                <span>Total:</span>
                <span>${total.toLocaleString()} USD</span>
              </div>
              <button onClick={handleCheckout} className="btn btn-primary btn-large checkout-btn">
                Proceed to Checkout
              </button>
              <Link to="/products" className="continue-shopping">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
