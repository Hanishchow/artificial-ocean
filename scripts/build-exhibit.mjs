/**
 * Assemble the exhibit into apps/exhibit/dist.
 *
 * Three files go out: the page, the 32 KB engine bundle, and the archive as a
 * plain script that assigns a global.
 *
 * The archive ships as GENOMES, never as meshes. Each creature is 25 numbers,
 * about 200 bytes, and the page grows the body itself when you click it. A
 * hundred and fifty animals therefore cost about 30 KB in total, against the
 * five megabytes that three recorded animations cost before the engine could
 * run in a browser. That ratio is the reason every simulation package was kept
 * free of DOM and Node types from the first commit.
 *
 * It is a script rather than JSON fetched at runtime because a sandboxed page
 * can always load a same-origin script, while fetch is the first thing a strict
 * content policy takes away.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = process.argv[2] ?? "ocean";

let archivePath = join(root, "data", `${run}-archive.json`);

// Fall back to whatever archive exists rather than failing the deploy. A
// scheduled build should publish the population it has, not go dark because a
// run was renamed.
if (!existsSync(archivePath)) {
  const { readdirSync, statSync } = await import("node:fs");
  const dir = join(root, "data");
  const found = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith("-archive.json"))
        .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
    : [];
  if (!found.length) {
    console.error("no archive in data/ — run `pnpm runner evolve` first");
    process.exit(1);
  }
  archivePath = join(dir, found[0].f);
  console.log(`  no ${run}-archive.json; using ${found[0].f}`);
}

const snapshot = JSON.parse(readFileSync(archivePath, "utf8"));

// Round hard. Genes are stored to six places and the sixth is far below
// anything a body can express; three keeps every phenotype identical and
// halves the payload.
const cells = snapshot.cells
  .filter((c) => Number.isFinite(c.fitness))
  .map((c) => ({
    key: c.key,
    genes: c.genes.map((g) => Number(g.toFixed(4))),
    fitness: Number(c.fitness.toFixed(3)),
    behaviour: c.behaviour.map((b) => Number(b.toFixed(3))),
    generation: c.generation,
  }))
  .sort((a, b) => b.fitness - a.fitness);

const payload = { dimensions: snapshot.dimensions, cells };

const dist = join(root, "apps", "exhibit", "dist");
mkdirSync(dist, { recursive: true });

writeFileSync(
  join(dist, "archive.js"),
  `window.ARCHIVE=${JSON.stringify(payload)};`,
  "utf8",
);
// Everything the page loads with a <script src>, plus the page. Listed rather
// than globbed: a stray file in src/ should not silently become part of a
// deploy, and a file the page needs that is missing here should fail the build
// loudly instead of producing a dead page in production.
const STATIC = ["index.html", "palettes.js", "bloom.js", "render.js"];
for (const f of STATIC) {
  const from = join(root, "apps", "exhibit", "src", f);
  if (!existsSync(from)) {
    console.error(`missing apps/exhibit/src/${f} — the page loads it and will break without it`);
    process.exit(1);
  }
  copyFileSync(from, join(dist, f));
}

// Stamp every <script src> with a hash of that file's contents.
//
// None of these filenames change when their contents do, and neither a plain
// static host nor GitHub Pages sends Cache-Control, so a browser is free to
// apply heuristic freshness and skip revalidation entirely. That is not
// theoretical: a preview here served a four-day-old archive.js -- 122
// creatures on a behaviour grid whose fourth axis had since been replaced --
// against a freshly built page, and the page had no way to know.
//
// A returning visitor is the case that matters. The archive is republished
// hourly by the evolve cron, so without this an old engine.js can be handed
// genomes it does not understand.
{
  const stamp = (f) =>
    createHash("sha256").update(readFileSync(join(dist, f))).digest("hex").slice(0, 8);
  const page = join(dist, "index.html");
  let html = readFileSync(page, "utf8");
  for (const f of ["engine.js", "archive.js", "palettes.js", "bloom.js", "render.js"]) {
    const before = html;
    html = html.replace(`src="${f}"`, `src="${f}?v=${stamp(f)}"`);
    if (html === before) {
      console.error(`index.html has no <script src="${f}"> to stamp`);
      process.exit(1);
    }
  }
  writeFileSync(page, html, "utf8");
}

const size = (p) => (readFileSync(p).length / 1024).toFixed(1) + " KB";
console.log(`  exhibit/dist`);
for (const f of STATIC) console.log(`    ${f.padEnd(12)} ${size(join(dist, f))}`);
console.log(`    engine.js    ${size(join(dist, "engine.js"))}`);
console.log(`    archive.js   ${size(join(dist, "archive.js"))}  (${cells.length} creatures)`);
