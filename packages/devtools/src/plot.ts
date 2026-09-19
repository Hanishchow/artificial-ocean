/**
 * Progress plots, for watching a run's health.
 */

import { escapeXml } from "./index.js";

function fmt(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

export interface Series {
  label: string;
  values: number[];
  color: string;
}

/**
 * A multi-series line chart.
 *
 * Each series is normalised to its OWN range rather than to a shared one,
 * because the two numbers that matter most here — best fitness and archive
 * coverage — live on completely different scales, and a shared axis flattens
 * one of them onto the floor. Each series carries its own range in the legend,
 * so the shapes stay readable even though the heights are not comparable.
 */
export function linePlotSvg(
  series: Series[],
  width = 900,
  height = 420,
): string {
  const padL = 56;
  const padR = 150;
  const padT = 28;
  const padB = 36;
  const w = width - padL - padR;
  const h = height - padT - padB;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#0a0a12"/>`;

  for (let i = 0; i <= 4; i++) {
    const y = padT + (h * i) / 4;
    svg += `<line x1="${padL}" y1="${fmt(y)}" x2="${padL + w}" y2="${fmt(y)}" stroke="#20202e" stroke-width="1"/>`;
  }

  series.forEach((s, si) => {
    const n = s.values.length;
    if (n === 0) return;

    const finite = s.values.filter((v) => Number.isFinite(v));
    const lo = finite.length ? Math.min(...finite) : 0;
    const hi = finite.length ? Math.max(...finite) : 1;
    const span = hi - lo || 1;

    let d = "";
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = s.values[i]!;
      if (!Number.isFinite(v)) continue;
      const x = padL + (n === 1 ? w / 2 : (w * i) / (n - 1));
      const y = padT + h - ((v - lo) / span) * h;
      d += (started ? "L" : "M") + `${fmt(x)},${fmt(y)}`;
      started = true;
    }
    svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"/>`;

    const ly = padT + 16 + si * 34;
    svg += `<line x1="${padL + w + 12}" y1="${fmt(ly)}" x2="${padL + w + 32}" y2="${fmt(ly)}" stroke="${s.color}" stroke-width="2"/>`;
    svg += `<text x="${padL + w + 38}" y="${fmt(ly + 4)}" fill="#ccccdd" font-size="11" font-family="sans-serif">${escapeXml(s.label)}</text>`;
    svg += `<text x="${padL + w + 38}" y="${fmt(ly + 18)}" fill="#7a7a92" font-size="9" font-family="sans-serif">${escapeXml(`${lo.toFixed(3)} to ${hi.toFixed(3)}`)}</text>`;
  });

  svg += `<text x="${padL}" y="${height - 12}" fill="#7a7a92" font-size="10" font-family="sans-serif">generation</text>`;
  svg += "</svg>";
  return svg;
}
