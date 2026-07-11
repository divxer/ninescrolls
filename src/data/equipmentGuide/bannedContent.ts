// Single source of truth for banned content — consumed by the generator's validatePdf AND the data tests.
// Spec §7-approved policy strengthening (union of the previous scattered lists). If a current guide
// string trips a pattern, fix the copy — never weaken the pattern.
export const BANNED_CONTENT_PATTERNS: RegExp[] = [
  // Generator's original list (scripts/generate-equipment-guide.ts `banned`) — carried over verbatim.
  /tyloong/i,
  /zhongke|tailong|中科泰隆/i,
  /chuangshi|创世威纳/i,
  /trusted manufacturer partner/i,
  /global installations/i,
  /research institutions served/i,
  /30\+\s*years/i,
  /1000\+/i,
  /300\+/i,
  /1×8|1x8|5×4|5x4/i,
  /3-5%/i,
  /8×10⁻⁴|8x10\^-4/i,
  // OEM names previously only checked in the data tests.
  /peiyuan|沛沅/i,
  /advanstech|埃德万斯/i,
  /promiso/i,
  /plutovac/i,
  // Generalized experience/scale claims.
  /\d+\+\s*years/i,
  /years of experience/i,
  // Superlatives.
  /research-grade/i,
  /industry-leading/i,
  /world-class/i,
  /state-of-the-art/i,
  /best-in-class/i,
  /unmatched/i,
];
