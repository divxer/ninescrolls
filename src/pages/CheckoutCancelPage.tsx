import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';

export function CheckoutCancelPage() {
  useScrollToTop();

  return (
    <>
      <SEO
        title="Payment Cancelled | NineScrolls"
        description="Your payment was cancelled."
        url="/checkout/cancel"
      />
      <main className="min-h-[819px] flex flex-col items-center justify-center text-center px-8">
        <span
          className="material-symbols-outlined text-8xl text-amber-500 mb-8"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          cancel
        </span>
        <h1 className="text-5xl font-headline font-bold mb-4">Payment Cancelled</h1>
        <p className="text-xl text-on-surface-variant max-w-xl mb-4">
          Your payment was cancelled. No charges were made.
        </p>
        <p className="text-base text-on-surface-variant max-w-md mb-10">
          If you have any questions or need assistance, please contact our sales team.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link
            to="/cart"
            className="bg-primary text-white py-4 px-8 rounded-sm font-bold uppercase hover:bg-primary-container transition-colors"
          >
            Return to Cart
          </Link>
          <Link
            to="/contact"
            className="border border-outline-variant py-4 px-8 rounded-sm font-bold uppercase text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Contact Sales
          </Link>
        </div>

        <Link to="/" className="mt-12 text-primary font-bold hover:underline">
          Return to Main Repository
        </Link>
      </main>
    </>
  );
}
