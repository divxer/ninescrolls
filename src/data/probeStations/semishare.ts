export interface SpecSource {
  /** Public page the value was captured from (https, semishareprober.com only). */
  url: string;
  /** Capture date, YYYY-MM-DD. */
  capturedOn: string;
}

export interface SpecEntry {
  label: string;
  value: string;
  source: SpecSource;
}

export interface ProductLine {
  key: string;
  name: string;
  /** Qualitative positioning — no numbers attributed to a SEMISHARE model. */
  positioning: string;
  /** Public-verifiable performance specs. Empty ⇒ page renders the
   *  qualitative fallback + "detailed specifications on request" CTA. */
  specs: SpecEntry[];
}

/**
 * Attestation gate (spec Constraint 6). Ships OFF.
 * Flip to true ONLY upon explicit written L2 confirmation from SEMISHARE.
 * Components must pass this flag explicitly to the wording functions below —
 * never rely on a default argument (keeps vi.mock overrides effective).
 */
export const ATTESTATION_CONFIRMED = false;

/** Every gated output lives in this registry. Nothing outside this module may
 *  hardcode partner-relationship phrasing (enforced by attestationScan.test.ts). */
const WORDING = {
  bannerOff:
    'NineScrolls provides US & Canada procurement, import, and support for SEMISHARE wafer probe stations.',
  bannerOn:
    'Authorized channel partner for SEMISHARE wafer probe stations (US & Canada, non-exclusive).',
  seoTitleOff: 'SEMISHARE Wafer Probe Stations | US & Canada Sales & Support',
  seoTitleOn: 'SEMISHARE Wafer Probe Stations | US & Canada Channel Partner',
  jsonLdOff:
    'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.',
  jsonLdOn:
    'NineScrolls LLC is an authorized, non-exclusive channel partner for SEMISHARE wafer probe stations in the United States and Canada.',
} as const;

export function getPartnerBannerText(confirmed: boolean): string {
  return confirmed ? WORDING.bannerOn : WORDING.bannerOff;
}

export function getBrandPageSeoTitle(confirmed: boolean): string {
  return confirmed ? WORDING.seoTitleOn : WORDING.seoTitleOff;
}

export function getPartnerJsonLdDescription(confirmed: boolean): string {
  return confirmed ? WORDING.jsonLdOn : WORDING.jsonLdOff;
}

/** Gated visual assets (badges / partner logos). None until SEMISHARE provides
 *  an authorized asset AND written confirmation lands. When populated, the
 *  PartnerAttestationBanner renders every entry — but only while the flag is
 *  ON (enforced by the gate tests, which iterate this list in both states). */
export const PARTNER_BADGE_ASSETS: ReadonlyArray<{ src: string; alt: string }> = [];

/**
 * Static-scan list (spec Constraint 6): phrase-level patterns on purpose —
 * NOT the bare word "authorized", which would false-positive on auth code
 * ("Unauthorized"). attestationScan.test.ts applies these to src/** source
 * text outside this module and test files.
 */
export const FORBIDDEN_ATTESTATION_PATTERNS: RegExp[] = [
  /authori[sz]ed\s+(channel\s+)?(partner|distributor|dealer|reseller)/i,
  /official\s+(partner|distributor|dealer|reseller)/i,
  /channel\s+partner/i,
  /semishare[-_](badge|partner[-_]?logo)/i,
];

/**
 * Product lines. `specs` starts EMPTY and is filled ONLY from live captures of
 * semishareprober.com public pages (Task 5). Do not add a number here from
 * memory, from third-party sites, or from internal documents.
 */
export const productLines: ProductLine[] = [
  {
    key: 'a-series',
    name: 'A Series — Fully Automatic Probe Stations',
    positioning:
      'Production-style fully automatic wafer probing designed to run with ATE for wafer acceptance testing and chip probing at volume.',
    specs: [],
  },
  {
    key: 'x-series',
    name: 'X Series — Semi-Automatic Probe Stations',
    positioning:
      'Recipe-assisted, motorized probing for multi-site device characterization across a wafer — the step up from manual stations when repeatability and throughput start to matter.',
    specs: [],
  },
  {
    key: 'cgx-series',
    name: 'CGX Series — Cryogenic Vacuum Probe Stations',
    positioning:
      'Closed vacuum enclosure with cryogenic cooling for low-temperature device physics, superconducting electronics, and quantum transport measurements.',
    specs: [],
  },
  {
    key: 'manual-series',
    name: 'SM / SE / SH Series — Manual Analytical Probe Stations',
    positioning:
      'Hand-driven analytical stations for university teaching labs, materials research, and single-device characterization where flexibility beats throughput.',
    specs: [],
  },
  {
    key: 'silicon-photonics',
    name: 'Wafer-Level Silicon Photonics Probing',
    positioning:
      'Fiber-alignment stages combined with electrical probing on semi-automatic and fully automatic platforms for wafer-level photonic device testing.',
    specs: [],
  },
  {
    key: 'mask-laser-repair',
    name: 'Mask Laser Repair',
    positioning:
      'Laser-based photomask defect repair systems — a specialty line alongside the probe station families.',
    specs: [],
  },
];
