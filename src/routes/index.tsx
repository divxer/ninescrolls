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
import { ProductDetailPage } from '../pages/ProductDetailPage';

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
      <Route path="/products/:slug" element={<ProductDetailPage />} />
      <Route path="/products/plasma-systems" element={<PlasmaSystemsPage />} />
      <Route path="/products/plasma-systems/compare" element={<PlasmaSystemsComparePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
