import type { Schema } from '../../../../amplify/data/resource';
import type { LifecycleStage } from '../../../services/behaviorAnalytics';

export type AnalyticsEvent = Schema['AnalyticsEvent']['type'];

export interface OrganizationRecord {
  key: string;
  orgName: string;
  displayName?: string;
  organizationType: string;
  country: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  leadTier: string | null;
  isTargetCustomer: boolean;
  totalEvents: number;
  uniquePages: number;
  productsViewed: string[];
  totalTimeOnSite: number;
  pdfDownloads: number;
  returnVisits: number;
  lastVisit: string;
  firstVisit: string;
  maxConfidence: number;
  maxBehaviorScore: number;
  isAnonymousHighIntent: boolean;
  isISPVisitor: boolean;
  companyType: string;
  lifecycleStage: LifecycleStage;
  rfqInstitution: string | null;
  contactOrganization: string | null;
  downloadGateOrganization: string | null;
  events: AnalyticsEvent[];
}

export type DateRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'all' | 'custom';
export type SortColumn = 'orgName' | 'organizationType' | 'country' | 'totalEvents' | 'uniquePages' | 'totalTimeOnSite' | 'leadTier' | 'engagement' | 'lastVisit';
export type KpiFilter = 'all' | 'target' | 'education' | 'business' | 'hotLead' | 'returning' | 'aiReferral' | 'anonymousIntent';
export type KeywordSourceFilter = 'all' | 'external' | 'internal';

export interface KeywordEntry {
  keyword: string;
  count: number;
  source: 'organic' | 'paid' | 'internal';
  searchEngine?: string;
  organizations: string[];
  lastSeen: string;
}

export type PageAnalyticsTab = 'topPages' | 'products' | 'landingPages';

export interface PageStats {
  pathname: string;
  pageTitle: string;
  views: number;
  uniqueVisitors: number;
  avgActiveSeconds: number;
  totalActiveSeconds: number;
  avgScrollDepth: number;
  organizations: string[];
  isProductPage: boolean;
}

export interface ProductPageStats extends PageStats {
  productName: string;
  pdfDownloads: number;
  contactFormSubmits: number;
  conversionRate: number;
}

export interface LandingPageStats {
  pathname: string;
  pageTitle: string;
  landings: number;
  trafficSources: Record<string, number>;
  topSource: string;
  avgSessionPages: number;
  bounceRate: number;
}

export interface PageViewFlushInfo {
  activeSeconds: number;
  isFinal: boolean;
}

export interface BotRecord {
  botName: string;
  userAgentSample: string;
  events: number;
  uniqueVisitors: number;
  uniquePages: number;
  lastSeen: string;
}
