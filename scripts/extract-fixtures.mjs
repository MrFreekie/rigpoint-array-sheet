// Turns the Soundvision PDFs in reference/ into anonymised text fixtures in fixtures/.
// Run with: npm run extract:fixtures
// The PDFs carry real venue and author names, so they are not committed. The fixtures replace them.

import { readFileSync, writeFileSync } from 'node:fs';
import { readPdfItems } from '../src/files/pdf-items.ts';

const SAMPLES = [
  { pdf: 'reference/soundvision_report_A.pdf', out: 'fixtures/soundvision-a.items.json', venue: 'Example Arena' },
  { pdf: 'reference/soundvision_report_B.pdf', out: 'fixtures/soundvision-b.items.json', venue: 'Example Theatre' },
  { pdf: 'reference/soundvision_report_C.pdf', out: 'fixtures/soundvision-c.items.json', venue: 'Example Festival' },
  { pdf: 'reference/soundvision_report_D.pdf', out: 'fixtures/soundvision-d.items.json', venue: 'Example Theatre Two' },
  { pdf: 'reference/soundvision_report_E.pdf', out: 'fixtures/soundvision-e.items.json', venue: 'Example Arena Two' },
];

for (const { pdf, out, venue } of SAMPLES) {
  const items = await readPdfItems(new Uint8Array(readFileSync(pdf)));
  const anonymous = items.map((item) => {
    if (item.text.startsWith('Author:')) return { ...item, text: 'Author: Example Author' };
    if (item.text.startsWith('File name:')) return { ...item, text: `File name: ${venue} - Example Show.xmlp` };
    return item;
  });
  writeFileSync(out, JSON.stringify(anonymous) + '\n');
  console.log(`${out}: ${anonymous.length} text items from ${pdf}`);
}
