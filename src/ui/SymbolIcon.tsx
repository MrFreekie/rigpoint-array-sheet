// A plot symbol drawn small, for the Settings box. It uses the same strokes as the plot, so the shape matches.

import { markerPrims, type Shape } from '../engine/markers';

export function SymbolIcon({ shape, size = 22 }: { shape: Shape; size?: number }) {
  const w = 20;
  const prims = markerPrims(shape, w * 0.8);
  return (
    <svg className="symbol-icon" width={size} height={size} viewBox={`${-w / 2} ${-w / 2} ${w} ${w}`} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        {prims.map((m, i) =>
          m.kind === 'circle' ? <circle key={i} cx={m.cx} cy={-m.cy} r={m.r} /> : <line key={i} x1={m.x1} y1={-m.y1} x2={m.x2} y2={-m.y2} />,
        )}
      </g>
    </svg>
  );
}
