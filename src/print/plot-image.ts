// The rigging plot as one PNG: the plot pages drawn on screen, serialised and painted on a canvas, one under the other.

import { PLOT_H_MM, PLOT_W_MM } from './plot-layout';

/** Pixels to the millimetre: 8 makes the 284 mm plot about 2270 pixels wide, sharp enough to zoom. */
const PX_PER_MM = 8;

function load(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(PLOT_W_MM * PX_PER_MM));
  copy.setAttribute('height', String(PLOT_H_MM * PX_PER_MM));
  // The on-screen page is sized by CSS to its frame; the picture has its own size.
  copy.removeAttribute('style');
  const text = new XMLSerializer().serializeToString(copy);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The rigging plot image could not be made.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  });
}

/** The plot pages, in order, as one PNG on white. */
export async function plotImageBlob(svgs: readonly SVGSVGElement[]): Promise<Blob> {
  if (svgs.length === 0) throw new Error('There is no rigging plot to save.');
  const images = await Promise.all(svgs.map(load));
  const w = PLOT_W_MM * PX_PER_MM;
  const h = PLOT_H_MM * PX_PER_MM;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h * images.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The rigging plot image could not be made.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((img, i) => ctx.drawImage(img, 0, i * h, w, h));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The rigging plot image could not be made.'))), 'image/png'));
}
