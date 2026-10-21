// The strongest check on a QR code is to scan it. jsQR (a test-only dependency) decodes the pixels
// we would print and must give back the address.

import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { APP_URL } from '../app-info';
import { qrMatrix, qrPath, qrSize, QUIET } from './qr';

/** Paints the matrix as black squares on white, `px` pixels per square, quiet zone included. */
function render(matrix: boolean[][], px: number) {
  const size = qrSize(matrix) * px;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (!dark) return;
      for (let y = 0; y < px; y++) {
        for (let x = 0; x < px; x++) {
          const i = (((r + QUIET) * px + y) * size + (c + QUIET) * px + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }),
  );
  return { data, size };
}

describe('qrMatrix', () => {
  it('scans back to the app address', () => {
    const { data, size } = render(qrMatrix(APP_URL), 6);
    expect(jsQR(data, size, size)?.data).toBe(APP_URL);
  });

  it('scans back for other text, including a long address', () => {
    for (const text of ['https://example.com/', 'x'.repeat(120), `${APP_URL}?a=1&b=two`]) {
      const { data, size } = render(qrMatrix(text), 5);
      expect(jsQR(data, size, size)?.data).toBe(text);
    }
  });

  it('is square, and the same every time', () => {
    const m = qrMatrix(APP_URL);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(qrMatrix(APP_URL)).toEqual(m);
  });

  it('has the three finder squares in the corners', () => {
    const m = qrMatrix(APP_URL);
    const n = m.length;
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      expect(m[r]![c]).toBe(true);
      expect(m[r + 3]![c + 3]).toBe(true);
      expect(m[r + 1]![c + 1]).toBe(false);
    }
  });
});

describe('qrPath', () => {
  it('draws exactly the dark squares', () => {
    const m = qrMatrix(APP_URL);
    const dark = m.flat().filter(Boolean).length;
    const squares = [...qrPath(m).matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)].reduce((sum, p) => sum + Number(p[3]), 0);
    expect(squares).toBe(dark);
  });

  it('stays inside the quiet zone', () => {
    const m = qrMatrix(APP_URL);
    const size = qrSize(m);
    for (const p of qrPath(m).matchAll(/M(\d+) (\d+)h(\d+)v1h/g)) {
      expect(Number(p[1])).toBeGreaterThanOrEqual(QUIET);
      expect(Number(p[2])).toBeGreaterThanOrEqual(QUIET);
      expect(Number(p[1]) + Number(p[3])).toBeLessThanOrEqual(size - QUIET);
      expect(Number(p[2])).toBeLessThan(size - QUIET);
    }
  });
});
