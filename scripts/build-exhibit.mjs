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
copyFileSync(join(root, "apps", "exhibit", "src", "index.html"), join(dist, "index.html"));

const size = (p) => (readFileSync(p).length / 1024).toFixed(1) + " KB";
console.log(`  exhibit/dist`);
console.log(`    index.html   ${size(join(dist, "index.html"))}`);
console.log(`    engine.js    ${size(join(dist, "engine.js"))}`);
console.log(`    archive.js   ${size(join(dist, "archive.js"))}  (${cells.length} creatures)`);
