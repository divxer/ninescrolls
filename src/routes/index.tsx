import { Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { AboutPage } from '../pages/AboutPage';
import { ProductsPage } from '../pages/ProductsPage';
import { ContactPage } from '../pages/ContactPage';
import { ServiceSupportPage } from '../pages/ServiceSupportPage';
import { AnalyticsTestPage } from '../pages/AnalyticsTestPage';
import { IPAnalysisPage } from '../pages/IPAnalysisPage';
import { IPAnalysisTestPage } from '../pages/IPAnalysisTestPage';
import { InsightsPage } from '../pages/InsightsPage';
import { InsightsPostPage } from '../pages/InsightsPostPage';
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
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/service-support" element={<ServiceSupportPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/insights/:slug" element={<InsightsPostPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/return-policy" element={<ReturnPolicyPage />} />
      <Route path="/startup-package" element={<StartupPackagePage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
      <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
      {import.meta.env.MODE !== 'production' && (
        <>
          <Route path="/analytics-test" element={<AnalyticsTestPage />} />
          <Route path="/ip-analysis" element={<IPAnalysisPage />} />
          <Route path="/ip-analysis-test" element={<IPAnalysisTestPage />} />
        </>
      )}
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