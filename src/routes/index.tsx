import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { lazyWithReload } from '../utils/lazyWithReload';

// ─── Lazy-loaded pages ──────────────────────────────────────────────────────
// Critical path (HomePage) is eagerly loaded; everything else is code-split.

const AboutPage = lazyWithReload(() => import('../pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ProductsPage = lazyWithReload(() => import('../pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CareersPage = lazyWithReload(() => import('../pages/CareersPage').then(m => ({ default: m.CareersPage })));
const ContactPage = lazyWithReload(() => import('../pages/ContactPage').then(m => ({ default: m.ContactPage })));
const ServiceSupportPage = lazyWithReload(() => import('../pages/ServiceSupportPage').then(m => ({ default: m.ServiceSupportPage })));
const InsightsPage = lazyWithReload(() => import('../pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const InsightsPostPage = lazyWithReload(() => import('../pages/InsightsPostPage').then(m => ({ default: m.InsightsPostPage })));
const NewsPage = lazyWithReload(() => import('../pages/NewsPage').then(m => ({ default: m.NewsPage })));
const NewsPostPage = lazyWithReload(() => import('../pages/NewsPostPage').then(m => ({ default: m.NewsPostPage })));
const PrivacyPage = lazyWithReload(() => import('../pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const ReturnPolicyPage = lazyWithReload(() => import('../pages/ReturnPolicyPage').then(m => ({ default: m.ReturnPolicyPage })));
const StartupPackagePage = lazyWithReload(() => import('../pages/StartupPackagePage').then(m => ({ default: m.StartupPackagePage })));
const PlasmaCleanerOverviewPage = lazyWithReload(() => import('../pages/PlasmaCleanerOverviewPage').then(m => ({ default: m.PlasmaCleanerOverviewPage })));
const PlasmaSystemsComparePage = lazyWithReload(() => import('../pages/PlasmaSystemsComparePage').then(m => ({ default: m.PlasmaSystemsComparePage })));
const CartPage = lazyWithReload(() => import('../pages/CartPage').then(m => ({ default: m.CartPage })));
const CheckoutPage = lazyWithReload(() => import('../pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const CheckoutSuccessPage = lazyWithReload(() => import('../pages/CheckoutSuccessPage').then(m => ({ default: m.CheckoutSuccessPage })));
const CheckoutCancelPage = lazyWithReload(() => import('../pages/CheckoutCancelPage').then(m => ({ default: m.CheckoutCancelPage })));
const RFQPage = lazyWithReload(() => import('../pages/RFQPage').then(m => ({ default: m.RFQPage })));

// Product pages
const ICPEtcher = lazyWithReload(() => import('../components/products').then(m => ({ default: m.ICPEtcher })));
const RIEEtcher = lazyWithReload(() => import('../components/products').then(m => ({ default: m.RIEEtcher })));
const CompactRIE = lazyWithReload(() => import('../components/products').then(m => ({ default: m.CompactRIE })));
const IBERIBESystem = lazyWithReload(() => import('../components/products').then(m => ({ default: m.IBERIBESystem })));
const ALDSystem = lazyWithReload(() => import('../components/products').then(m => ({ default: m.ALDSystem })));
const StriperSystem = lazyWithReload(() => import('../components/products').then(m => ({ default: m.StriperSystem })));
const HDPCVDSystem = lazyWithReload(() => import('../components/products').then(m => ({ default: m.HDPCVDSystem })));
const SputterSystem = lazyWithReload(() => import('../components/products').then(m => ({ default: m.SputterSystem })));
const EBeamEvaporator = lazyWithReload(() => import('../components/products').then(m => ({ default: m.EBeamEvaporator })));
const CoaterDeveloper = lazyWithReload(() => import('../components/products').then(m => ({ default: m.CoaterDeveloper })));
const PECVDSystem = lazyWithReload(() => import('../components/products').then(m => ({ default: m.PECVDSystem })));
const HY4L = lazyWithReload(() => import('../components/products').then(m => ({ default: m.HY4L })));
const HY20L = lazyWithReload(() => import('../components/products').then(m => ({ default: m.HY20L })));
const HY20LRF = lazyWithReload(() => import('../components/products').then(m => ({ default: m.HY20LRF })));
const PlutoT = lazyWithReload(() => import('../components/products').then(m => ({ default: m.PlutoT })));
const PlutoM = lazyWithReload(() => import('../components/products').then(m => ({ default: m.PlutoM })));
const PlutoF = lazyWithReload(() => import('../components/products').then(m => ({ default: m.PlutoF })));
const Pluto30 = lazyWithReload(() => import('../components/products').then(m => ({ default: m.Pluto30 })));

// ─── Loading fallback ───────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <div className="text-center py-16 px-5 text-lg text-on-surface-variant">Loading...</div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/request-quote" element={<RFQPage />} />
        <Route path="/service-support" element={<ServiceSupportPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/insights/:slug" element={<InsightsPostPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsPostPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/return-policy" element={<ReturnPolicyPage />} />
        <Route path="/startup-package" element={<StartupPackagePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
        <Route path="/products/rie-etcher" element={<RIEEtcher />} />
        <Route path="/products/compact-rie" element={<CompactRIE />} />
        <Route path="/products/icp-etcher" element={<ICPEtcher />} />
        <Route path="/products/ibe-ribe" element={<IBERIBESystem />} />
        <Route path="/products/ald" element={<ALDSystem />} />
        <Route path="/products/striper" element={<StriperSystem />} />
        <Route path="/products/hdp-cvd" element={<HDPCVDSystem />} />
        <Route path="/products/sputter" element={<SputterSystem />} />
        <Route path="/products/e-beam-evaporator" element={<EBeamEvaporator />} />
        <Route path="/products/coater-developer" element={<CoaterDeveloper />} />
        <Route path="/products/pecvd" element={<PECVDSystem />} />
        <Route path="/products/plasma-cleaner" element={<PlasmaCleanerOverviewPage />} />
        <Route path="/products/plasma-cleaner/compare" element={<PlasmaSystemsComparePage />} />
        <Route path="/products/hy-4l" element={<HY4L />} />
        <Route path="/products/hy-4l-rf" element={<HY4L />} />
        <Route path="/products/hy-4l-mf" element={<HY4L />} />
        <Route path="/products/hy-20l" element={<HY20L />} />
        <Route path="/products/hy-20lrf" element={<HY20LRF />} />
        <Route path="/products/pluto-t" element={<PlutoT />} />
        <Route path="/products/pluto-m" element={<PlutoM />} />
        <Route path="/products/pluto-f" element={<PlutoF />} />
        <Route path="/products/pluto-30" element={<Pluto30 />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
