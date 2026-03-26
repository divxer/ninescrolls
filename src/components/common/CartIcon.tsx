import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/useCart';

export function CartIcon() {
  const { getTotalItems } = useCart();
  const itemCount = getTotalItems();

  return (
    <Link
      to="/cart"
      className="relative inline-flex items-center justify-center w-10 h-10 text-on-surface no-underline transition-colors duration-200 hover:text-primary"
      aria-label="Shopping cart"
    >
      <span className="material-symbols-outlined text-2xl">shopping_cart</span>
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary text-on-primary text-[11px] font-bold leading-none">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
