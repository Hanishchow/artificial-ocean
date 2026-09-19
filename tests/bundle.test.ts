/**
 * The browser bundle, exercised the way the page exercises it.
 *
 * Everything else in this repo is tested as TypeScript modules in a workspace
 * that resolves `@ocean/*` by path. The exhibit gets none of that: it gets one
 * minified IIFE and whatever globals a page happens to have. The gap between
 * those two worlds is exactly where a bundle breaks — a package that quietly
 * depended on a Node built-in, a global that never got assigned, a circular
 * import that resolved in vitest and not in esbuild's output.
 *
 * So this loads the built file, drives it as the page does, and checks that
 * real creatures come out the other side.
 *
 * Skipped when nothing has been built, so `pnpm test` works on a fresh clone.
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ENGINE = "apps/exhibit/dist/engine.js";
const ARCHIVE = "apps/exhibit/dist/archive.js";
const built = existsSync(ENGINE) && existsSync(ARCHIVE);

function loadEngine(): any {
  const src = readFileSync(ENGINE, "utf8");
  const win: any = {};
  win.window = win;
  // esbuild's --global-name emits a top-level `var`, which becomes a window
  // property in a classic script but not inside a Function body, so the value
  // is returned rather than read off the fake window.
  return new Function("window", src + "; return Ocean;")(win);
}

function loadArchive(): any {
  return JSON.parse(
    readFileSync(ARCHIVE, "utf8").replace(/^window\.ARCHIVE=/, "").replace(/;$/, ""),
  );
}

describe.skipIf(!built)("browser bundle", () => {
  it("exposes what the page calls", () => {
    const Ocean = loadEngine();
    for (const name of ["creatureFromGenes", "decode", "develop", "LiveCreature"]) {
      expect(typeof Ocean[name]).not.toBe("undefined");
    }
  });

  it("grows creatures from stored genomes and swims them without falling apart", () => {
    const Ocean = loadEngine();
    const archive = loadArchive();
    expect(archive.cells.length).toBeGreaterThan(0);

    const sample = archive.cells.slice(0, 8);
    for (const cell of sample) {
      const live = Ocean.creatureFromGenes(cell.genes, { maxParticles: 2600 });

      // Drive it exactly as the render loop does: real seconds, fixed physics
      // step inside.
      for (let i = 0; i < 90; i++) live.advance(1 / 60);

      expect(live.particleCount).toBeGreaterThan(100);
      expect(Array.from(live.positions).every(Number.isFinite)).toBe(true);

      // It has to have a surface, or the page renders an invisible animal.
      const bulb = live.phenotype.surfaces.find((s: any) => s.name === "bulb");
      expect(bulb.faces.length).toBeGreaterThan(0);
    }
  });

  it("ships genomes, not meshes", () => {
    // The structural claim the whole architecture rests on. If the archive ever
    // starts carrying geometry, a hundred and fifty creatures stop fitting in a
    // web page and the exhibit quietly becomes a video.
    const bytes = readFileSync(ARCHIVE).length;
    const archive = loadArchive();
    const perCreature = bytes / archive.cells.length;
    expect(perCreature).toBeLessThan(600);
  });
});
