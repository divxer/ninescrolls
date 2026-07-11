// Pure parsing/validation for pdffonts output — unit-testable; the generator wires in execFileSync.
export interface PdfFontRow { name: string; emb: string; sub: string; }

export function parsePdfFonts(output: string): PdfFontRow[] {
  const lines = output.split('\n');
  const headerIdx = lines.findIndex(l => /^name\s+.*\bemb\b\s+\bsub\b/.test(l));
  if (headerIdx < 0) throw new Error('parsePdfFonts: unrecognized pdffonts output (no header row)');
  // Parse the trailing fixed tokens (emb sub uni object ID) RIGHT-anchored, so a
  // long font name overflowing the fixed-width name column can't shift the read.
  // The font name is the first whitespace-delimited token (pdffonts names have no spaces).
  return lines.slice(headerIdx + 2).filter(l => l.trim()).map(l => {
    const m = l.match(/\b(yes|no)\s+(yes|no)\s+(yes|no)\s+-?\d+\s+\d+\s*$/);
    if (!m) throw new Error(`parsePdfFonts: unparseable row: ${l}`);
    return { name: l.trim().split(/\s+/)[0], emb: m[1], sub: m[2] };
  });
}

const normalize = (name: string): string =>
  name.replace(/^[A-Z]{6}\+/, '').replace(/[-_ ].*$/, '').toLowerCase();

// Substring match (not anchored) so suffixed PostScript names — ArialMT, Arimo,
// TimesNewRomanPSMT, LiberationSans-* — are still caught after normalize().
const FALLBACK = /helvetica|arial|arimo|times|liberation|dejavu|noto/;

export function assertEmbeddedFontsOutput(rows: PdfFontRow[]): void {
  const embedded = rows.filter(r => r.emb === 'yes' && r.sub === 'yes').map(r => normalize(r.name));
  if (!embedded.includes('spacegrotesk')) throw new Error('Space Grotesk not embedded+subset in PDF (fallback?)');
  if (!embedded.includes('inter')) throw new Error('Inter not embedded+subset in PDF (fallback?)');
  for (const r of rows) {
    if (FALLBACK.test(normalize(r.name))) throw new Error(`Fallback font detected in PDF: ${r.name}`);
  }
}
