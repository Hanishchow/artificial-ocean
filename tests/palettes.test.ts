/**
 * The colour schemes, checked against the way they are actually drawn.
 *
 * A palette here is not a mood board. The creature is drawn as translucent gel
 * with additive wireframe, additive points and additive strands over it, and
 * additive layers SUM — which breaks most of the intuitions a palette is
 * normally picked under. The first version of this file's data was written by
 * eye and judged by a reviewer who did the arithmetic, and every rule below is
 * one of the failures that review found:
 *
 *   - a two-stop bell sweeping mint to gold interpolates through a
 *     35%-saturation olive across its whole midband, which is the largest area
 *     on screen;
 *   - four swatches sitting at ceiling green clipped on the first overlapping
 *     layer, and a clipped channel means the R:G:B ratio — the hue itself — is
 *     gone;
 *   - a gel nearly five times darker than the apex contributed almost nothing
 *     at 0.34 opacity, leaving a hollow ring instead of a body;
 *   - motes two degrees off the bell's hue read as shed bell fragments rather
 *     than as suspended matter in the water.
 *
 * None of that is visible in a swatch grid, and all of it is arithmetic. So it
 * is pinned here: adding a seventh scheme by eye cannot silently reintroduce a
 * failure the sixth already paid for.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Palette {
  name: string;
  organism: string;
  note: string;
  bellTop: string;
  bellMid: string;
  bellMargin: string;
  gel: string;
  tentacleNear: string;
  tentacleTip: string;
  glow: string;
  water: string;
  motes: string;
  keyLight: string;
  fillLight: string;
}

/**
 * The palettes ship as a browser script that assigns a global, because the
 * page loads them with a <script src> and has no module system. Load them the
 * same way the page does rather than duplicating the data here — a copy would
 * drift, and a drifted copy tests nothing.
 */
function loadPalettes(): Palette[] {
  const src = readFileSync("apps/exhibit/src/palettes.js", "utf8");
  const globalObj: { PALETTES?: Palette[] } = {};
  new Function("window", src)(globalObj);
  if (!globalObj.PALETTES) throw new Error("palettes.js did not assign window.PALETTES");
  return globalObj.PALETTES;
}

const SLOTS = [
  "bellTop",
  "bellMid",
  "bellMargin",
  "gel",
  "tentacleNear",
  "tentacleTip",
  "glow",
  "water",
  "motes",
  "keyLight",
  "fillLight",
] as const;

/** Slots that end up in an additively blended layer, so can clip. */
const ADDITIVE = [
  "bellTop",
  "bellMid",
  "bellMargin",
  "tentacleNear",
  "tentacleTip",
  "glow",
  "motes",
] as const;

// Aequorin Frost is a crystal jelly: no pigment at all, and its one chromatic
// event is the light it makes itself. Its bell is near-achromatic on purpose,
// so the saturation rule does not apply to it. Named explicitly rather than
// detected, so that "my palette is grey" can never become a way out.
const ACHROMATIC_BY_DESIGN = new Set(["Aequorin Frost"]);

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}

function mix(a: string, b: string, t: number): [number, number, number] {
  const A = rgb(a);
  const B = rgb(b);
  return [
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
  ];
}

describe("palettes", () => {
  const palettes = loadPalettes();

  it("ships more than one option, each named after a real animal", () => {
    expect(palettes.length).toBeGreaterThanOrEqual(2);
    for (const p of palettes) {
      expect(p.name, "every palette is named").toBeTruthy();
      // The organism is what makes these choices defensible rather than
      // arbitrary, and the note is what the page prints under the name.
      expect(p.organism, `${p.name} names its animal`).toBeTruthy();
      expect(p.note.length, `${p.name} says something about its animal`).toBeGreaterThan(20);
    }
    const names = palettes.map((p) => p.name);
    expect(new Set(names).size, "names are unique").toBe(names.length);
  });

  it("fills every slot the renderer reads", () => {
    for (const p of palettes) {
      for (const slot of SLOTS) {
        expect(p[slot], `${p.name}.${slot}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("leaves additive headroom, so no channel clips when layers overlap", () => {
    for (const p of palettes) {
      for (const slot of ADDITIVE) {
        const peak = Math.max(...rgb(p[slot]));
        // 235 of 255. Above this the gel, the wireframe and the dots stacking
        // on one another saturate the channel, and with the channel goes the
        // hue: the whole palette collapses toward white or toward a primary.
        expect(peak, `${p.name}.${slot} (${p[slot]}) has no headroom`).toBeLessThanOrEqual(235);
      }
    }
  });

  it("routes the bell sweep through a saturated midpoint, not through mud", () => {
    for (const p of palettes) {
      if (ACHROMATIC_BY_DESIGN.has(p.name)) continue;
      for (const [from, to, leg] of [
        [p.bellTop, p.bellMid, "apex→mid"],
        [p.bellMid, p.bellMargin, "mid→margin"],
      ] as const) {
        for (const t of [0.25, 0.5, 0.75]) {
          const s = saturation(mix(from, to, t));
          expect(
            s,
            `${p.name} ${leg} desaturates to ${(s * 100).toFixed(0)}% at t=${t}; ` +
              `the midband is the largest area on the creature and reads as mud`,
          ).toBeGreaterThanOrEqual(0.3);
        }
      }
    }
  });

  it("keeps the gel bright enough to read as a body", () => {
    for (const p of palettes) {
      const ratio = luminance(p.gel) / luminance(p.bellTop);
      // Drawn at 0.34 opacity. Much below this and the gel contributes almost
      // nothing over near-black water, and the animal reads as a hollow ring.
      expect(
        ratio,
        `${p.name}: gel is ${(1 / ratio).toFixed(1)}x darker than the apex and will vanish`,
      ).toBeGreaterThanOrEqual(0.4);
    }
  });

  it("separates the motes from the bell, so they read as water", () => {
    for (const p of palettes) {
      expect(
        hueGap(p.motes, p.bellTop),
        `${p.name}: motes sit ${hueGap(p.motes, p.bellTop).toFixed(0)}° from the bell ` +
          `and will read as shed fragments of the creature rather than suspended matter`,
      ).toBeGreaterThanOrEqual(25);
    }
  });

  it("keeps the water dark enough for additive layers to register", () => {
    for (const p of palettes) {
      expect(luminance(p.water), `${p.name}.water is too bright`).toBeLessThanOrEqual(0.05);
    }
  });
});
