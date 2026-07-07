import { Link } from 'react-router-dom';
import { useScrollToTop } from '../hooks/useScrollToTop';
import { SEO } from '../components/common/SEO';
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';

export function CheckoutCancelPage() {
  useScrollToTop();

  return (
    <>
      <SEO
        title="Payment Cancelled"
        description="Your payment was cancelled."
        url="/checkout/cancel"
        robots="noindex, nofollow"
      />
      <div className="bg-[#FAFAFA]">
        <ConversionHero
          eyebrow="Checkout Cancelled"
          title="Checkout cancelled"
          copy="No charges were made. You can return to the cart to retry checkout, or request a quote if your institution needs a formal purchasing path."
          primaryAction={{ label: 'Return to Cart', href: '/cart' }}
          secondaryAction={{ label: 'Request Quote', href: '/request-quote' }}
          trustItems={['No charge captured', 'Cart can be reviewed', 'Quote path available']}
        />

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-8 py-12 md:grid-cols-2">
          <ConversionCard>
            <h2 className="font-headline text-2xl font-bold text-slate-950">Continue checkout</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Return to your cart to review quantities, confirm the order summary, and restart secure checkout.
            </p>
            <Link to="/cart" className="mt-6 inline-flex rounded-md bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700">
              Return to Cart
            </Link>
          </ConversionCard>
          <ConversionCard>
            <h2 className="font-headline text-2xl font-bold text-slate-950">Use procurement instead</h2>
            <div className="mt-4">
              <TrustSignalList
                items={[
                  { title: 'Formal quote', copy: 'Use RFQ for purchase orders, institutional review, or custom requirements.' },
                  { title: 'Engineering support', copy: 'Share configuration questions before completing an order.' },
                ]}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/request-quote" className="inline-flex rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-50">
                Request Quote
              </Link>
              <Link to="/contact?topic=support" className="inline-flex rounded-md px-5 py-3 text-sm font-bold text-sky-700 hover:text-sky-800 hover:underline">
                Talk to Sales
              </Link>
            </div>
          </ConversionCard>
        </section>
      </div>
    </>
  );
}
