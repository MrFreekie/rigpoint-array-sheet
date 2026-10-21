// Builds a tiny PDF with plain text at known positions, one entry per page, for testing the PDF reader.

export interface PdfText {
  x: number;
  y: number;
  text: string;
}

export function makePdf(pages: PdfText[][]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  add(''); // 1: catalogue
  add(''); // 2: page tree
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3: font
  const pageIds: number[] = [];
  for (const texts of pages) {
    const stream = texts
      .map((t) => `BT /F1 10 Tf ${t.x} ${t.y} Td (${t.text.replace(/[\\()]/g, '\\$&')}) Tj ET`)
      .join('\n');
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
