/** Credential-isolated workbook parser. This is the only module allowed to import read-excel-file. */
import { readSheet } from 'read-excel-file/node';

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error('Usage: extract-historical-workbook.ts <workbook-path>');

const rows = await readSheet(workbookPath);
if (rows.length === 0) throw new Error('Workbook has no rows');
const headers = rows[0].map(value => String(value ?? '').trim());
if (headers.some(header => header === '')) throw new Error('Workbook header contains a blank column');
if (new Set(headers).size !== headers.length) throw new Error('Workbook header contains duplicates');

const extracted = rows.slice(1).map((cells, index) => Object.fromEntries([
  ['sourceRow', index + 2],
  ...headers.map((header, cellIndex) => {
    const value = cells[cellIndex];
    return [header, value instanceof Date ? value.toISOString().slice(0, 10) : value];
  }),
]));
process.stdout.write(`${JSON.stringify(extracted)}\n`);
