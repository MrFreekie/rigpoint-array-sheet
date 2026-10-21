// A QR code for the app address, made on this device (no network, no image files). The code is
// returned as a grid of dark and light squares, and as one SVG path so it prints crisply at any size.

import qrcode from 'qrcode-generator';

/** Squares of quiet space around the code. The QR standard asks for four. */
export const QUIET = 4;

/** Rows of squares, true where the square is dark. Error correction M repairs about 15% damage. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Side length in squares, quiet zone included. */
export function qrSize(matrix: boolean[][]): number {
  return matrix.length + 2 * QUIET;
}

/** One SVG path drawing every dark square, merged into horizontal runs. */
export function qrPath(matrix: boolean[][]): string {
  const parts: string[] = [];
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < row.length && row[end]) end++;
      parts.push(`M${c + QUIET} ${r + QUIET}h${end - c}v1h-${end - c}z`);
      c = end;
    }
  });
  return parts.join('');
}
