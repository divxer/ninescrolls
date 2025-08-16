import { Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { AboutPage } from '../pages/AboutPage';
import { ProductsPage } from '../pages/ProductsPage';
import { ContactPage } from '../pages/ContactPage';
import { AnalyticsTestPage } from '../pages/AnalyticsTestPage';
import { IPAnalysisPage } from '../pages/IPAnalysisPage';
import { IPAnalysisTestPage } from '../pages/IPAnalysisTestPage';
import { InsightsPage } from '../pages/InsightsPage';
import { InsightsPostPage } from '../pages/InsightsPostPage';
import { 
  ICPEtcher,
  RIEEtcher,
  IBERIBESystem,
  ALDSystem,
  StriperSystem,
  HDPCVDSystem,
  SputterSystem,
  CoaterDeveloper,
  PECVDSystem
} from '../components/products';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/insights" element={<InsightsPage />} />
      <Route path="/insights/:slug" element={<InsightsPostPage />} />
      {import.meta.env.MODE !== 'production' && (
        <>
          <Route path="/analytics-test" element={<AnalyticsTestPage />} />
          <Route path="/ip-analysis" element={<IPAnalysisPage />} />
          <Route path="/ip-analysis-test" element={<IPAnalysisTestPage />} />
        </>
      )}
      <Route path="/products/rie-etcher" element={<RIEEtcher />} />
      <Route path="/products/icp-etcher" element={<ICPEtcher />} />
      <Route path="/products/ibe-ribe" element={<IBERIBESystem />} />
      <Route path="/products/ald" element={<ALDSystem />} />
      <Route path="/products/striper" element={<StriperSystem />} />
      <Route path="/products/hdp-cvd" element={<HDPCVDSystem />} />
      <Route path="/products/sputter" element={<SputterSystem />} />
      <Route path="/products/coater-developer" element={<CoaterDeveloper />} />
      <Route path="/products/pecvd" element={<PECVDSystem />} />
    </Routes>
  );
} 