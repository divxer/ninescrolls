import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from '../components/admin/AdminRoute';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';

// ─── Lazy-loaded pages ──────────────────────────────────────────────────────
// Critical path (HomePage) is eagerly loaded; everything else is code-split.

const AboutPage = lazy(() => import('../pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ProductsPage = lazy(() => import('../pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CareersPage = lazy(() => import('../pages/CareersPage').then(m => ({ default: m.CareersPage })));
const ContactPage = lazy(() => import('../pages/ContactPage').then(m => ({ default: m.ContactPage })));
const ServiceSupportPage = lazy(() => import('../pages/ServiceSupportPage').then(m => ({ default: m.ServiceSupportPage })));
const InsightsPage = lazy(() => import('../pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const InsightsPostPage = lazy(() => import('../pages/InsightsPostPage').then(m => ({ default: m.InsightsPostPage })));
const NewsPage = lazy(() => import('../pages/NewsPage').then(m => ({ default: m.NewsPage })));
const NewsPostPage = lazy(() => import('../pages/NewsPostPage').then(m => ({ default: m.NewsPostPage })));
const PrivacyPage = lazy(() => import('../pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const ReturnPolicyPage = lazy(() => import('../pages/ReturnPolicyPage').then(m => ({ default: m.ReturnPolicyPage })));
const StartupPackagePage = lazy(() => import('../pages/StartupPackagePage').then(m => ({ default: m.StartupPackagePage })));
const PlasmaCleanerOverviewPage = lazy(() => import('../pages/PlasmaCleanerOverviewPage').then(m => ({ default: m.PlasmaCleanerOverviewPage })));
const PlasmaSystemsComparePage = lazy(() => import('../pages/PlasmaSystemsComparePage').then(m => ({ default: m.PlasmaSystemsComparePage })));
const CartPage = lazy(() => import('../pages/CartPage').then(m => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const CheckoutSuccessPage = lazy(() => import('../pages/CheckoutSuccessPage').then(m => ({ default: m.CheckoutSuccessPage })));
const CheckoutCancelPage = lazy(() => import('../pages/CheckoutCancelPage').then(m => ({ default: m.CheckoutCancelPage })));
const RFQPage = lazy(() => import('../pages/RFQPage').then(m => ({ default: m.RFQPage })));

// Product pages
const ICPEtcher = lazy(() => import('../components/products').then(m => ({ default: m.ICPEtcher })));
const RIEEtcher = lazy(() => import('../components/products').then(m => ({ default: m.RIEEtcher })));
const CompactRIE = lazy(() => import('../components/products').then(m => ({ default: m.CompactRIE })));
const IBERIBESystem = lazy(() => import('../components/products').then(m => ({ default: m.IBERIBESystem })));
const ALDSystem = lazy(() => import('../components/products').then(m => ({ default: m.ALDSystem })));
const StriperSystem = lazy(() => import('../components/products').then(m => ({ default: m.StriperSystem })));
const HDPCVDSystem = lazy(() => import('../components/products').then(m => ({ default: m.HDPCVDSystem })));
const SputterSystem = lazy(() => import('../components/products').then(m => ({ default: m.SputterSystem })));
const EBeamEvaporator = lazy(() => import('../components/products').then(m => ({ default: m.EBeamEvaporator })));
const CoaterDeveloper = lazy(() => import('../components/products').then(m => ({ default: m.CoaterDeveloper })));
const PECVDSystem = lazy(() => import('../components/products').then(m => ({ default: m.PECVDSystem })));
const HY4L = lazy(() => import('../components/products').then(m => ({ default: m.HY4L })));
const HY20L = lazy(() => import('../components/products').then(m => ({ default: m.HY20L })));
const HY20LRF = lazy(() => import('../components/products').then(m => ({ default: m.HY20LRF })));
const PlutoT = lazy(() => import('../components/products').then(m => ({ default: m.PlutoT })));
const PlutoM = lazy(() => import('../components/products').then(m => ({ default: m.PlutoM })));
const PlutoF = lazy(() => import('../components/products').then(m => ({ default: m.PlutoF })));

// Admin pages
const AdminInsightsListPage = lazy(() => import('../pages/admin/AdminInsightsListPage').then(m => ({ default: m.AdminInsightsListPage })));
const AdminInsightsFormPage = lazy(() => import('../pages/admin/AdminInsightsFormPage').then(m => ({ default: m.AdminInsightsFormPage })));
const AdminAnalyticsPage = lazy(() => import('../pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const OrderListPage = lazy(() => import('../pages/admin/OrderListPage').then(m => ({ default: m.OrderListPage })));
const OrderDetailPage = lazy(() => import('../pages/admin/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const CreateOrderPage = lazy(() => import('../pages/admin/CreateOrderPage').then(m => ({ default: m.CreateOrderPage })));
const RFQListPage = lazy(() => import('../pages/admin/RFQListPage').then(m => ({ default: m.RFQListPage })));
const RFQDetailPage = lazy(() => import('../pages/admin/RFQDetailPage').then(m => ({ default: m.RFQDetailPage })));
const LeadsListPage = lazy(() => import('../pages/admin/LeadsListPage').then(m => ({ default: m.LeadsListPage })));
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AdminQuestionsPage = lazy(() => import('../pages/admin/AdminQuestionsPage').then(m => ({ default: m.AdminQuestionsPage })));

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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export function AdminRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin" element={<AdminRoute />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="insights" element={<AdminInsightsListPage />} />
          <Route path="insights/new" element={<AdminInsightsFormPage />} />
          <Route path="insights/:id/edit" element={<AdminInsightsFormPage />} />
          <Route path="questions" element={<AdminQuestionsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="orders" element={<OrderListPage />} />
          <Route path="orders/new" element={<CreateOrderPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
          <Route path="rfqs" element={<RFQListPage />} />
          <Route path="rfqs/:rfqId" element={<RFQDetailPage />} />
          <Route path="leads" element={<LeadsListPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
