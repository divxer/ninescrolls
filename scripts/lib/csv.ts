/** RFC 4180-subset CSV parser: quoted fields, escaped quotes ("" -> "),
 * commas and newlines inside quotes, CRLF, blank-line skipping. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== '') rows.push(row); // skip blank lines
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { pushField(); i += 1; continue; }
    if (ch === '\r' && text[i + 1] === '\n') { pushRow(); i += 2; continue; }
    if (ch === '\n') { pushRow(); i += 1; continue; }
    field += ch; i += 1;
  }
  if (inQuotes) throw new Error('CSV: unterminated quoted field');
  if (field !== '' || row.length) pushRow();
  return rows;
}

/** '72500' | '19.9' | '19.99' (yuan) -> integer fen. String math — no floats. */
export function rmbToFen(s: string): number {
  const m = s.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw new Error(`invalid RMB amount: "${s}" (expect yuan, up to 2 decimals)`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
}
