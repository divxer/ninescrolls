import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from '../components/admin/AdminRoute';
import { lazyWithReload } from '../utils/lazyWithReload';

// Admin routes are split into their own lazy chunk (loaded by App only on
// /admin) so the public bundle never ships the admin auth UI. AdminRoute pulls
// in @aws-amplify/ui-react's Authenticator + its ~125KB CSS theme — none of
// which a public visitor should download.

const AdminInsightsListPage = lazyWithReload(() => import('../pages/admin/AdminInsightsListPage').then(m => ({ default: m.AdminInsightsListPage })));
const AdminInsightsFormPage = lazyWithReload(() => import('../pages/admin/AdminInsightsFormPage').then(m => ({ default: m.AdminInsightsFormPage })));
const AdminAnalyticsPage = lazyWithReload(() => import('../pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const OrderListPage = lazyWithReload(() => import('../pages/admin/OrderListPage').then(m => ({ default: m.OrderListPage })));
const OrderDetailPage = lazyWithReload(() => import('../pages/admin/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const CreateOrderPage = lazyWithReload(() => import('../pages/admin/CreateOrderPage').then(m => ({ default: m.CreateOrderPage })));
const LogisticsCaseListPage = lazyWithReload(() => import('../pages/admin/LogisticsCaseListPage').then(m => ({ default: m.LogisticsCaseListPage })));
const LogisticsCaseDetailPage = lazyWithReload(() => import('../pages/admin/LogisticsCaseDetailPage').then(m => ({ default: m.LogisticsCaseDetailPage })));
const CreateLogisticsCasePage = lazyWithReload(() => import('../pages/admin/CreateLogisticsCasePage').then(m => ({ default: m.CreateLogisticsCasePage })));
const RFQListPage = lazyWithReload(() => import('../pages/admin/RFQListPage').then(m => ({ default: m.RFQListPage })));
const RFQDetailPage = lazyWithReload(() => import('../pages/admin/RFQDetailPage').then(m => ({ default: m.RFQDetailPage })));
const LeadsListPage = lazyWithReload(() => import('../pages/admin/LeadsListPage').then(m => ({ default: m.LeadsListPage })));
const OrganizationListPage = lazyWithReload(() => import('../pages/admin/OrganizationListPage').then(m => ({ default: m.OrganizationListPage })));
const OrganizationDetailPage = lazyWithReload(() => import('../pages/admin/OrganizationDetailPage').then(m => ({ default: m.OrganizationDetailPage })));
const NeedsLinkingPage = lazyWithReload(() => import('../pages/admin/NeedsLinkingPage').then(m => ({ default: m.NeedsLinkingPage })));
const DashboardPage = lazyWithReload(() => import('../pages/admin/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AdminQuestionsPage = lazyWithReload(() => import('../pages/admin/AdminQuestionsPage').then(m => ({ default: m.AdminQuestionsPage })));
const TenderListPage = lazyWithReload(() => import('../pages/admin/TenderListPage').then(m => ({ default: m.TenderListPage })));
const TenderDetailPage = lazyWithReload(() => import('../pages/admin/TenderDetailPage').then(m => ({ default: m.TenderDetailPage })));
const TenderKeywordConfigPage = lazyWithReload(() => import('../pages/admin/TenderKeywordConfigPage').then(m => ({ default: m.TenderKeywordConfigPage })));
const TenderPipelineRunsPage = lazyWithReload(() => import('../pages/admin/TenderPipelineRunsPage').then(m => ({ default: m.TenderPipelineRunsPage })));
const TenderPipelineRunDetailPage = lazyWithReload(() => import('../pages/admin/TenderPipelineRunDetailPage').then(m => ({ default: m.TenderPipelineRunDetailPage })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <div className="text-center py-16 px-5 text-lg text-on-surface-variant">Loading...</div>
    </div>
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
          <Route path="logistics" element={<LogisticsCaseListPage />} />
          <Route path="logistics/new" element={<CreateLogisticsCasePage />} />
          <Route path="logistics/:caseId" element={<LogisticsCaseDetailPage />} />
          <Route path="rfqs" element={<RFQListPage />} />
          <Route path="rfqs/:rfqId" element={<RFQDetailPage />} />
          <Route path="leads" element={<LeadsListPage />} />
          <Route path="organizations" element={<OrganizationListPage />} />
          <Route path="organizations/:orgId" element={<OrganizationDetailPage />} />
          <Route path="needs-linking" element={<NeedsLinkingPage />} />
          <Route path="tenders" element={<TenderListPage />} />
          <Route path="tenders/keywords" element={<TenderKeywordConfigPage />} />
          <Route path="tenders/runs" element={<TenderPipelineRunsPage />} />
          <Route path="tenders/runs/:executionId" element={<TenderPipelineRunDetailPage />} />
          <Route path="tenders/:tenderId" element={<TenderDetailPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AdminRoutes;
