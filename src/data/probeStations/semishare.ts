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
  specs: readonly SpecEntry[];
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
export const FORBIDDEN_ATTESTATION_PATTERNS: readonly RegExp[] = [
  /authori[sz]ed\s+(channel\s+)?(partner|distributor|dealer|reseller)/i,
  /official\s+(partner|distributor|dealer|reseller)/i,
  /channel\s+partner/i,
  /semishare[-_](badge|partner[-_]?logo)/i,
];

/**
 * Peer-reviewed publications that use SEMISHARE probe stations.
 *
 * Field names align with the approved (unbuilt) Evidence Framework `type:
 * publication` model — `docs/superpowers/specs/2026-07-04-evidence-framework-design.md`
 * (`meta:{journal, year, doi, authors}`). We do NOT implement that framework here;
 * this is a small static list, the same interim pattern the redesign spec
 * (`2026-07-09-research-validation-claim-reframe-design.md`) sanctions.
 *
 * VERIFICATION DISCIPLINE (fabrication is the worst outcome):
 *   - Every entry was LIVE-VERIFIED to actually USE SEMISHARE equipment — the
 *     SEMISHARE mention was seen in the paper's methods (open-access full text)
 *     or in a Google Scholar snippet quoting the methods, recorded per-entry in
 *     `verification`.
 *   - Every `doi` was confirmed to resolve via https://doi.org/<doi> to the
 *     publisher page (accessed 2026-07-12).
 *   - NO citation counts and NO aggregate counts anywhere (standing project rule
 *     — counts go stale). Do not add a numeric field other than `year`.
 *   - Journal names are accurate: no upgrading (Nature Communications ≠ "Nature").
 */
export interface SemisharePublication {
  title: string;
  /** "First Author et al." */
  authors: string;
  /** Journal / conference, accurately named — no upgrading. */
  venue: string;
  year: number;
  /** Bare DOI like "10.1038/..." (no URL prefix). */
  doi: string;
  /** One-phrase application area, e.g. "2D material transport". */
  application: string;
  /** Where the SEMISHARE usage was confirmed + access date. */
  verification: string;
}

export const SEMISHARE_PUBLICATIONS: readonly SemisharePublication[] = [
  {
    title:
      'Stable mid-infrared polarization imaging based on quasi-2D tellurium at room temperature',
    authors: 'Tong et al.',
    venue: 'Nature Communications',
    year: 2020,
    doi: '10.1038/s41467-020-16125-8',
    application: '2D tellurium mid-infrared polarization imaging',
    verification:
      'Open-access Methods (PMC7210936), "Electronic and optoelectronic measurements": "The unpolarized current data are measured by using a probe station system (SEMISHARE SE-6)". DOI resolves to nature.com. Accessed 2026-07-12.',
  },
  {
    title:
      'Sub-2-nm-droplet-driven growth of amorphous metal chalcogenides approaching the single-layer limit',
    authors: 'Shi et al.',
    venue: 'Nature Materials',
    year: 2025,
    doi: '10.1038/s41563-025-02273-z',
    application: 'Low-temperature transport of amorphous 2D chalcogenide films',
    verification:
      'Google Scholar snippet quoting the Methods: "The electrical characterizations of the devices were performed in a SEMISHARE CG-O-4 cryogenic probe station". DOI resolves to nature.com. Accessed 2026-07-12.',
  },
  {
    title:
      'Methodology for Improving Temperature Sensing Performance and Thermal Stability of 4H-SiC JBS Diodes',
    authors: 'Huang et al.',
    venue: 'Small',
    year: 2026,
    doi: '10.1002/smll.202509679',
    application: 'Wide-bandgap 4H-SiC power / temperature-sensing diodes',
    verification:
      'Google Scholar snippet quoting the Methods: "a high-precision KEYSIGHT B1505 semiconductor parameter analyzer and a SEMISHARE X8 semi-automatic probe station". DOI resolves to Wiley Online Library. Accessed 2026-07-12.',
  },
  {
    title:
      'Freestanding Relaxor Ferroelectric Single-Crystalline Thin Films Enable Flexible Piezoelectric Energy Harvester With Giant Power Density',
    authors: 'Ren et al.',
    venue: 'Advanced Functional Materials',
    year: 2026,
    doi: '10.1002/adfm.202600016',
    application: 'Freestanding ferroelectric piezoelectric energy harvesters',
    verification:
      'Google Scholar snippet quoting the Methods: "ferroelectric and dielectric properties measurements were performed using a Semishare high-precision probe station (Semishare E4)". DOI resolves to Wiley Online Library. Accessed 2026-07-12.',
  },
  {
    title:
      'Infrared Photodetector Based on van der Waals MoS2/MoTe2 Hetero-Bilayer Modulated by Photogating',
    authors: 'Sheng et al.',
    venue: 'Advanced Electronic Materials',
    year: 2024,
    doi: '10.1002/aelm.202400190',
    application: '2D van der Waals infrared photodetectors',
    verification:
      'Google Scholar snippet quoting the Methods (device fabrication with a Semishare probe station): "transferred onto the 1L MoS2 by using a commercial probe station (Semishare, E-4)". DOI resolves to Wiley Online Library. Accessed 2026-07-12.',
  },
];

/**
 * Product lines. `specs` starts EMPTY and is filled ONLY from live captures of
 * semishareprober.com public pages (Task 5). Do not add a number here from
 * memory, from third-party sites, or from internal documents.
 */
export const productLines: readonly ProductLine[] = [
  {
    key: 'a-series',
    name: 'A Series — Fully Automatic Probe Stations',
    positioning:
      'Production-style fully automatic wafer probing designed to run with ATE for wafer acceptance testing and chip probing at volume.',
    specs: [
      {
        label: 'Temperature control range',
        value: '-50°C to 200°C (optionally -60°C to 300°C)',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/a-series-full-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Temperature control accuracy',
        value: '0.1°C',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/a-series-full-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Probing accuracy',
        value: '±2μm (with screw structure) / ±1.5μm (with linear motor)',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/a-series-full-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Chuck movement speed',
        value: 'exceeding 300mm/s',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/a-series-full-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Leakage current',
        value: 'fA level',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/a-series-full-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
    ],
  },
  {
    key: 'x-series',
    name: 'X Series — Semi-Automatic Probe Stations',
    positioning:
      'Recipe-assisted, motorized probing for multi-site device characterization across a wafer — the step up from manual stations when repeatability and throughput start to matter.',
    specs: [
      {
        label: 'Chuck running speed (X12)',
        value: '>70mm/s',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/x12-semi-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Translocation time (X12)',
        value: '500ms',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/x12-semi-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Needle seat capacity (X12)',
        value: 'up to 12 needle seats',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/x12-semi-automatic-probe-station.html',
          capturedOn: '2026-07-12',
        },
      },
    ],
  },
  {
    key: 'cgx-series',
    name: 'CGX Series — Cryogenic Vacuum Probe Stations',
    positioning:
      'Closed vacuum enclosure with cryogenic cooling for low-temperature device physics, superconducting electronics, and quantum transport measurements.',
    specs: [
      {
        label: 'Chuck size (CGX8)',
        value: '8"',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/cgx-high-low-temperature-vacuum.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Temperature range (CGX8)',
        value: '77K-450K (liquid nitrogen), 10K-450K (liquid helium)',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/cgx-high-low-temperature-vacuum.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Chuck stage repeated positioning accuracy (CGX8)',
        value: '±1μm',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/cgx-high-low-temperature-vacuum.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Probe arm positioning accuracy (CGX8)',
        value: '2μm',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/cgx-high-low-temperature-vacuum.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Temperature controller resolution (CGX8)',
        value: '0.001°C',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/cgx-high-low-temperature-vacuum.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'System ultimate pressure (CGX8)',
        value: '< 5.0×10⁻⁴ Pa',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/cgx-high-low-temperature-vacuum.html',
          capturedOn: '2026-07-12',
        },
      },
    ],
  },
  {
    key: 'manual-series',
    name: 'M Series — Manual Analytical Probe Stations',
    positioning:
      'Hand-driven analytical stations for university teaching labs, materials research, and single-device characterization where flexibility beats throughput.',
    specs: [
      {
        label: 'Chuck size',
        value: 'M4: 4" / M6: 6" / M8: 8"',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/m4-basics-manual-probe.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Stage travel (X-Y)',
        value: 'M4: 100*100mm / M6: 150*150mm / M8: 200*200mm',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/m4-basics-manual-probe.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Movement accuracy',
        value: '10μm',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/m4-basics-manual-probe.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Theta rotation',
        value: '±45° rotation (coarse adjustment); fine adjustment range ±8°, fine adjustment accuracy 0.01°',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/m4-basics-manual-probe.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Probe travel (X-Y-Z)',
        value: '12mm-12mm-12mm',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/m4-basics-manual-probe.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Probe mechanical precision',
        value: '10μm/2μm/0.7μm',
        source: {
          url: 'https://www.semishareprober.com/products/probe-station-system/m4-basics-manual-probe.html',
          capturedOn: '2026-07-12',
        },
      },
    ],
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
    name: 'Mask Laser Repair (L14 Series)',
    positioning:
      'Laser-based photomask defect repair systems — a specialty line alongside the probe station families.',
    specs: [
      {
        label: 'Laser wavelength',
        value: 'optional wavelength: 1064/532/355/266nm band',
        source: {
          url: 'https://www.semishareprober.com/products/laser-repair-system/mask-cut-repair-l14-series.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Laser output power',
        value: '2.2mJ/pulse',
        source: {
          url: 'https://www.semishareprober.com/products/laser-repair-system/mask-cut-repair-l14-series.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Stage X-Y travel',
        value: '8*8 inches',
        source: {
          url: 'https://www.semishareprober.com/products/laser-repair-system/mask-cut-repair-l14-series.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Stage Z-axis travel',
        value: '50mm',
        source: {
          url: 'https://www.semishareprober.com/products/laser-repair-system/mask-cut-repair-l14-series.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Minimum process accuracy',
        value: '1*1μm (when equipped with 100X lens)',
        source: {
          url: 'https://www.semishareprober.com/products/laser-repair-system/mask-cut-repair-l14-series.html',
          capturedOn: '2026-07-12',
        },
      },
      {
        label: 'Objective lens',
        value: '5X, 10X, 20X, 50X (optional), 100X (optional)',
        source: {
          url: 'https://www.semishareprober.com/products/laser-repair-system/mask-cut-repair-l14-series.html',
          capturedOn: '2026-07-12',
        },
      },
    ],
  },
];
