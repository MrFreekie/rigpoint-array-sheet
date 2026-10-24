// The rigging plot page as SVG. The print view draws it turned onto the portrait sheet, the on-screen preview draws it
// as it reads. Plain shapes and text only.

import { PT_PER_MM } from './pdf-layout';
import { PLOT_H_MM, PLOT_W_MM, type PlotPage, type PlotPalette } from './plot-layout';

interface Props {
  page: PlotPage;
  palette: PlotPalette;
  /** Turn the page a quarter turn anticlockwise, onto a portrait sheet of the printable area. */
  rotated?: boolean;
  testId?: string;
  label?: string;
}

export function PlotSvg({ page, palette, rotated = false, testId, label = 'Rigging plot' }: Props) {
  const body = page.ops.map((o, i) => {
    if (o.op === 'line') {
      return (
        <line
          key={i}
          x1={o.x1}
          y1={o.y1}
          x2={o.x2}
          y2={o.y2}
          stroke={palette[o.color]}
          strokeWidth={o.width}
          strokeDasharray={o.dash?.join(' ')}
        />
      );
    }
    if (o.op === 'segs') {
      let d = '';
      for (let k = 0; k + 3 < o.pts.length; k += 4) d += `M${o.pts[k]} ${o.pts[k + 1]}L${o.pts[k + 2]} ${o.pts[k + 3]}`;
      return <path key={i} d={d} fill="none" stroke={palette[o.color]} strokeWidth={o.width} />;
    }
    if (o.op === 'circle') {
      return (
        <circle
          key={i}
          cx={o.cx}
          cy={o.cy}
          r={o.r}
          fill={o.fill ? palette[o.color] : 'none'}
          stroke={palette[o.color]}
          strokeWidth={o.width}
        />
      );
    }
    const size = o.size / PT_PER_MM;
    return (
      <text
        key={i}
        x={o.x}
        y={o.y + size * 0.8}
        fontSize={size}
        fontWeight={o.bold ? 700 : 400}
        textAnchor={o.align === 'left' ? 'start' : o.align === 'right' ? 'end' : 'middle'}
        fill={palette[o.color]}
        fontFamily="Arial, Helvetica, 'Liberation Sans', sans-serif"
      >
        {o.text}
      </text>
    );
  });
  if (rotated) {
    return (
      <svg
        viewBox={`0 0 ${PLOT_H_MM} ${PLOT_W_MM}`}
        width={`${PLOT_H_MM}mm`}
        height={`${PLOT_W_MM}mm`}
        role="img"
        aria-label={label}
        data-testid={testId}
        style={{ display: 'block' }}
      >
        <g transform={`matrix(0 -1 1 0 0 ${PLOT_W_MM})`}>{body}</g>
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${PLOT_W_MM} ${PLOT_H_MM}`} role="img" aria-label={label} data-testid={testId} style={{ display: 'block', width: '100%', height: 'auto', background: '#fff' }}>
      <rect width={PLOT_W_MM} height={PLOT_H_MM} fill="#fff" />
      {body}
    </svg>
  );
}
