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
import { PlasmaSystemsPage } from '../pages/PlasmaSystemsPage';
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
  PlasmaCleaner,
  NSPlasma20R,
  NSPlasma4R
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
          <Route path="/products/plasma-cleaner" element={<PlasmaCleaner />} />
          <Route path="/products/ns-plasma-20r" element={<NSPlasma20R />} />
          <Route path="/products/ns-plasma-4r" element={<NSPlasma4R />} />
          <Route path="/products/plasma-systems" element={<PlasmaSystemsPage />} />
          <Route path="/products/plasma-systems/compare" element={<PlasmaSystemsComparePage />} />
          <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
} 