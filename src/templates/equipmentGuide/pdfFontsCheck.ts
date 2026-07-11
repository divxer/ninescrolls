// Pure parsing/validation for pdffonts output — unit-testable; the generator wires in execFileSync.
export interface PdfFontRow { name: string; emb: string; sub: string; }

export function parsePdfFonts(output: string): PdfFontRow[] {
  const lines = output.split('\n');
  const headerIdx = lines.findIndex(l => /^name\s+.*\bemb\b\s+\bsub\b/.test(l));
  if (headerIdx < 0) throw new Error('parsePdfFonts: unrecognized pdffonts output (no header row)');
  const header = lines[headerIdx];
  const embCol = header.indexOf('emb');
  const subCol = header.indexOf('sub');
  return lines.slice(headerIdx + 2).filter(l => l.trim()).map(l => ({
    name: l.slice(0, header.indexOf('type')).trim(),
    emb: l.slice(embCol, embCol + 3).trim(),
    sub: l.slice(subCol, subCol + 3).trim(),
  }));
}

const normalize = (name: string): string =>
  name.replace(/^[A-Z]{6}\+/, '').replace(/[-_ ].*$/, '').toLowerCase();

const FALLBACK = /^(helvetica|arial|times|timesnewroman|liberationsans|liberationserif|dejavu\w*|noto\w*)$/;

export function assertEmbeddedFontsOutput(rows: PdfFontRow[]): void {
  const embedded = rows.filter(r => r.emb === 'yes' && r.sub === 'yes').map(r => normalize(r.name));
  if (!embedded.includes('spacegrotesk')) throw new Error('Space Grotesk not embedded+subset in PDF (fallback?)');
  if (!embedded.includes('inter')) throw new Error('Inter not embedded+subset in PDF (fallback?)');
  for (const r of rows) {
    if (FALLBACK.test(normalize(r.name))) throw new Error(`Fallback font detected in PDF: ${r.name}`);
  }
}
