export interface SpecRow {
  label: string;
  value: string;
  value2?: string; // second column for two-column spec tables
}

export interface SubTable {
  title: string;        // e.g. 'Hotplate Specifications'
  specs: SpecRow[];     // single-column rows
}

export interface SpecParityCheck {
  guideLabel: string;      // spec row label in THIS guide product
  websiteLabel: string;    // matching label in the website config specifications.items
  guideExpected: string;   // normalized substring expected in the guide value
  websiteExpected: string; // normalized substring expected in the website value
}

export interface GuideProductContent {
  lead: string;
  applications: string[];
  applicationCount: 3 | 4;
  href: string; // site-relative, e.g. '/products/rie-etcher'
}

export interface GuideProduct {
  id: string;
  series: string;
  order: number;
  image: string;      // repo-relative path under public/
  imageAlt: string;
  footprint?: string;
  bullets: { heading: string; body: string }[];
  specHeaders?: [string, string]; // two-column table headers
  specs: SpecRow[];
  subTable?: SubTable;            // e.g. Coater/Developer hotplate section
  familyOptions?: string[];      // plasma-cleaner family SKUs
  websiteSpecParity?: {
    productSlug: string; // canonical config slug, e.g. 'icp-etcher' / 'ald'
    checks: SpecParityCheck[];
  };
  content: GuideProductContent;
}

export interface EvidenceStudy {
  journal: string;
  year: number;
  title: string;
  platform: string;       // 'RIE' | 'ICP' | 'PECVD' | ...
  citations?: number;
  citationsAsOf?: string; // e.g. 'Jul 2026'
  doi?: string;
}

export interface EquipmentGuideData {
  about: {
    title: string;
    subtitle: string;
    paragraphs: string[];
    pillars: { heading: string; body: string }[];
  };
  evidence: {
    title: string;
    subtitle: string;
    intro: string;
    studies: EvidenceStudy[];
    disclaimer: string;
  };
  products: GuideProduct[];
  contact: {
    office: string[];
    hours: string[];
    contacts: { label: string; value: string }[];
    support: { label: string; value: string }[];
  };
}
