// src/config/evidence.ts
// Re-exports the shared status/type constants (single source of truth in
// amplify/lib/evidence/status.ts) and adds frontend-only display + validation
// helpers. Mirrors the existing src -> amplify type import in amplifyClient.ts;
// the imported file is pure constants, so Vite bundles only those values.
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  type EvidenceStatus,
  type EvidenceType,
} from '../../amplify/lib/evidence/status';

export { EVIDENCE_STATUS, EVIDENCE_TYPE };
export type { EvidenceStatus, EvidenceType };

export const EVIDENCE_TYPE_ORDER: EvidenceType[] = [
  EVIDENCE_TYPE.APPLICATION_NOTE,
  EVIDENCE_TYPE.PROCESS_NOTE,
  EVIDENCE_TYPE.TECHNICAL_NOTE,
  EVIDENCE_TYPE.PUBLICATION,
  EVIDENCE_TYPE.CASE_STUDY,
  EVIDENCE_TYPE.VALIDATION,
];

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  [EVIDENCE_TYPE.APPLICATION_NOTE]: 'Application Note',
  [EVIDENCE_TYPE.PROCESS_NOTE]: 'Process Note',
  [EVIDENCE_TYPE.TECHNICAL_NOTE]: 'Technical Note',
  [EVIDENCE_TYPE.PUBLICATION]: 'Published Research',
  [EVIDENCE_TYPE.CASE_STUDY]: 'Case Study',
  [EVIDENCE_TYPE.VALIDATION]: 'Process Validation',
};
export function evidenceTypeLabel(type: string): string {
  return EVIDENCE_TYPE_LABELS[type as EvidenceType] ?? type;
}

export const EVIDENCE_TYPE_HELP: Partial<Record<EvidenceType, string>> = {
  [EVIDENCE_TYPE.PROCESS_NOTE]: 'Process recipe / process-specific explanation',
  [EVIDENCE_TYPE.TECHNICAL_NOTE]: 'Equipment / design / operation explanation',
};

type PayloadInput = {
  articleSlug?: string | null;
  pdfUrl?: string | null;
  sourceUrl?: string | null;
  images?: string[] | null;
};
export function hasPayload(input: PayloadInput): boolean {
  const nonBlank = (s?: string | null) => typeof s === 'string' && s.trim().length > 0;
  const hasImages = Array.isArray(input.images) && input.images.length > 0;
  return nonBlank(input.articleSlug) || nonBlank(input.pdfUrl) || nonBlank(input.sourceUrl) || hasImages;
}

// --- Phase 2 product-page rendering helpers ---

// Curated short badges for well-known journals. Unmapped journals show their
// full name (no badge). Never fabricate an abbreviation — add entries explicitly.
const JOURNAL_BADGE_RAW: Record<string, string> = {
  'Light: Science & Applications': 'LSA',
  'Laser & Photonics Reviews': 'LPR',
  'Nature Communications': 'Nat. Commun.',
  'Science Advances': 'Sci. Adv.',
  'Nano Letters': 'Nano Lett.',
  'Advanced Materials': 'Adv. Mater.',
  'Advanced Functional Materials': 'Adv. Funct. Mater.',
  'Advanced Optical Materials': 'Adv. Opt. Mater.',
  'Advanced Electronic Materials': 'Adv. Electron. Mater.',
  'Advanced Photonics Research': 'Adv. Photonics Res.',
  'ACS Applied Nano Materials': 'ACS ANM',
  'ACS Applied Materials & Interfaces': 'ACS AMI',
  'Applied Surface Science': 'Appl. Surf. Sci.',
  'Applied Optics': 'Appl. Opt.',
  'Optics Express': 'Opt. Express',
  'IEEE Photonics Technology Letters': 'IEEE PTL',
  'Journal of Lightwave Technology': 'J. Lightwave Technol.',
  'Journal of Infrared and Millimeter Waves': 'J. Infrared Millim. Waves',
  'Materials Research Express': 'Mater. Res. Express',
  'Nanoscale Advances': 'Nanoscale Adv.',
  'Scientific Reports': 'Sci. Rep.',
  'Biomedical Optics Express': 'Biomed. Opt. Express',
};
// Normalize keys once so lookups tolerate case/whitespace drift in stored
// journal names (defensive — the seeded values are exact today).
const norm = (s: string) => s.toLowerCase().trim();
const JOURNAL_BADGE = new Map(
  Object.entries(JOURNAL_BADGE_RAW).map(([name, abbr]) => [norm(name), abbr]),
);
export function journalBadge(journal?: string | null): string | null {
  if (!journal) return null;
  return JOURNAL_BADGE.get(norm(journal)) ?? null;
}

// Represented-platform wording per product line. NEVER names the OEM. Falls back
// to a generic phrase for lines without bespoke wording.
const PLATFORM_LABEL: Record<string, string> = {
  'icp-etcher': 'the ICP etching platform we represent',
  'rie-etcher': 'the RIE etching platform we represent',
  'compact-rie': 'the RIE etching platform we represent',
  'pecvd': 'the PECVD platform we represent',
  'hdp-cvd': 'the CVD platform we represent',
  'sputter': 'the magnetron sputtering platform we represent',
  'ibe-ribe': 'the ion-beam etching platform we represent',
  'striper': 'the plasma-strip platform we represent',
  // MEB-600 is NineScrolls's own product model (not an OEM platform), so it is
  // named directly rather than using the "…we represent" discretion wording.
  'e-beam-evaporator': 'the MEB-600 e-beam evaporation platform',
  'plasma-cleaner': 'the plasma cleaner platform we represent',
  // Per-model plasma-cleaner SKU pages query by their own slug; same platform-level
  // wording (never the OEM).
  'pluto-t': 'the plasma cleaner platform we represent',
  'pluto-f': 'the plasma cleaner platform we represent',
  'pluto-m': 'the plasma cleaner platform we represent',
  'pluto-30': 'the plasma cleaner platform we represent',
  // SEMISHARE is a publicly-named partner brand (attestation gate OFF → no
  // "partner" claim in the wording; the brand name itself is fine and is used
  // throughout the SEMISHARE brand page).
  'probe-station': 'SEMISHARE wafer probe stations',
};
export function productPlatformLabel(slug: string): string {
  return PLATFORM_LABEL[slug] ?? 'the platform we represent';
}

// --- Homepage "Research Validation" showcase selection ---

// Prestige order for the homepage showcase. Publications in these journals float
// to the top; one card per journal (for variety), highest-prestige first.
// Extend as new marquee journals appear in the published set.
// NOTE: intentionally NO bare 'Nature'/'Science' — those flagship names are NOT
// journals we hold (we have Nature Communications / Science Advances), and a
// record carrying a bare "Nature" journal would be a misattribution. See
// BARE_FLAGSHIP below, which drops such a record outright.
const MARQUEE_JOURNAL_ORDER = [
  'Nature Communications',
  'Science Advances',
  'Light: Science & Applications',
  'Advanced Materials',
  'Materials Today',
  'Physical Review E',
  'Advanced Functional Materials',
  'Lab on a Chip',
  'Small',
  'Nano Letters',
].map(norm);

// Bare flagship names we must NEVER render as a journal card (claiming a paper
// is in "Nature"/"Science" itself when it's really Nature Communications etc.).
// A record whose journal is exactly one of these is a data error → dropped.
const BARE_FLAGSHIP = new Set(['nature', 'science']);

interface ShowcaseInput {
  title?: string | null;
  journal?: string | null;
  year?: number | null;
}

/**
 * Pick the homepage showcase publications: dedupe to one card per journal (the
 * newest in that journal), then order by journal prestige (marquee first, then
 * unranked by recency), and take `limit`. Deterministic — no citation counts,
 * no OEM data. Pure so it can be unit-tested.
 */
export function selectShowcasePublications<T extends ShowcaseInput>(pubs: T[], limit = 4): T[] {
  const rank = (journal?: string | null) => {
    const i = MARQUEE_JOURNAL_ORDER.indexOf(norm(journal ?? ''));
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const newestPerJournal = new Map<string, T>();
  for (const p of pubs) {
    if (!p.journal || !p.title) continue; // need both to render a card
    const key = norm(p.journal);
    if (BARE_FLAGSHIP.has(key)) continue; // never surface a bare "Nature"/"Science" card
    const cur = newestPerJournal.get(key);
    if (!cur || (p.year ?? 0) > (cur.year ?? 0)) newestPerJournal.set(key, p);
  }
  return [...newestPerJournal.values()]
    .sort((a, b) => rank(a.journal) - rank(b.journal) || (b.year ?? 0) - (a.year ?? 0))
    .slice(0, limit);
}
