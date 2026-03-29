import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from '../components/admin/AdminRoute';
import { AdminInsightsListPage } from '../pages/admin/AdminInsightsListPage';
import { AdminInsightsFormPage } from '../pages/admin/AdminInsightsFormPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { OrderListPage } from '../pages/admin/OrderListPage';
import { OrderDetailPage } from '../pages/admin/OrderDetailPage';
import { CreateOrderPage } from '../pages/admin/CreateOrderPage';
import { RFQListPage } from '../pages/admin/RFQListPage';
import { RFQDetailPage } from '../pages/admin/RFQDetailPage';
import { LeadsListPage } from '../pages/admin/LeadsListPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { AdminQuestionsPage } from '../pages/admin/AdminQuestionsPage';
import { HomePage } from '../pages/HomePage';
import { AboutPage } from '../pages/AboutPage';
import { ProductsPage } from '../pages/ProductsPage';
import { CareersPage } from '../pages/CareersPage';
import { ContactPage } from '../pages/ContactPage';
import { ServiceSupportPage } from '../pages/ServiceSupportPage';
import { InsightsPage } from '../pages/InsightsPage';
import { InsightsPostPage } from '../pages/InsightsPostPage';
import { NewsPage } from '../pages/NewsPage';
import { NewsPostPage } from '../pages/NewsPostPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { ReturnPolicyPage } from '../pages/ReturnPolicyPage';
import { StartupPackagePage } from '../pages/StartupPackagePage';
import { PlasmaCleanerOverviewPage } from '../pages/PlasmaCleanerOverviewPage';
import { PlasmaSystemsComparePage } from '../pages/PlasmaSystemsComparePage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { CheckoutSuccessPage } from '../pages/CheckoutSuccessPage';
import { CheckoutCancelPage } from '../pages/CheckoutCancelPage';
import { RFQPage } from '../pages/RFQPage';
import {
  ICPEtcher,
  RIEEtcher,
  CompactRIE,
  IBERIBESystem,
  ALDSystem,
  StriperSystem,
  HDPCVDSystem,
  SputterSystem,
  CoaterDeveloper,
  PECVDSystem,
  HY4L,
  HY20L,
  HY20LRF,
  PlutoT,
  PlutoM,
  PlutoF
} from '../components/products';

export function AppRoutes() {
  return (
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
  );
}

export function AdminRoutes() {
  return (
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
  );
} 