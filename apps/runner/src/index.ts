/**
 * The runner.
 *
 * `swim`  — run one named seed and report how it moved.
 * `sheet` — develop and run a population sampled around the seeds, write an SVG
 *           contact sheet, and print the M1 gate percentages.
 *
 * This is the only package in M1 allowed to touch the filesystem. Everything it
 * calls is pure.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ContactSheetCell,
  type Silhouette,
  contactSheetSvg,
  trajectorySvg,
} from "@ocean/devtools";
import { SEEDS, type Genome, decode, jitter, seedByName } from "@ocean/genome";
import { EVAL_OPTIONS, develop } from "@ocean/morphogen";
import { Creature, DEFAULT_EPISODE, runEpisode } from "@ocean/sim";
import type { EpisodeConfig } from "@ocean/sim";

// ..................................................
// The M1 gate, as numbers agreed before any of this was written
//

const GATE = {
  /** Fraction that must develop and survive the full episode without aborting. */
  stable: 0.6,
  /** Fraction that must achieve real locomotion. */
  locomoting: 0.25,
  /** What counts as locomotion, in body lengths per second. */
  speed: 0.5,
};

function episodeConfig(genome: Genome, seconds: number): EpisodeConfig {
  const t = decode(genome);
  return {
    ...DEFAULT_EPISODE,
    seconds,
    gait: { frequency: t["pulseFreq"]!, duty: t["pulseDuty"]! },
  };
}

interface Outcome {
  id: string;
  label: string;
  ok: boolean;
  speed: number;
  distance: number;
  abort?: string;
  reason?: string;
  trajectory: Float32Array;
  frames: Silhouette[];
  particles: number;
}

/** Develop, run, and capture a few silhouettes along the way. */
function evaluate(
  genome: Genome,
  label: string,
  seconds: number,
  captureFrames: boolean,
): Outcome {
  const dev = develop(genome, EVAL_OPTIONS);
  if (!dev.ok) {
    return {
      id: genome.id.slice(0, 8),
      label,
      ok: false,
      speed: 0,
      distance: 0,
      reason: `${dev.reason}: ${dev.detail}`,
      trajectory: new Float32Array(0),
      frames: [],
      particles: 0,
    };
  }

  const cfg = episodeConfig(genome, seconds);
  const frames: Silhouette[] = [];

  if (captureFrames) {
    // Re-run the same creature deliberately: runEpisode returns a trajectory,
    // not a movie, and snapshotting inside it would put presentation concerns
    // in the hot path that a whole generation runs through.
    const creature = new Creature(dev.phenotype, cfg);
    const dt = 1 / cfg.hz;
    const ticks = Math.round(cfg.seconds * cfg.hz);
    const at = [0.25, 0.5, 0.75].map((f) => Math.floor(ticks * f));

    for (let i = 0; i < ticks; i++) {
      creature.step(dt);
      creature.system.clampVelocity(cfg.guards.maxSpeed, dt);
      if (at.includes(i)) {
        frames.push({ positions: sample(creature.system.positions, 140) });
      }
      if (creature.system.hasNaN()) break;
    }
  }

  const result = runEpisode(dev.phenotype, cfg);
  const speed = result.metrics.bodyLengthsPerSecond;

  return {
    id: genome.id.slice(0, 8),
    label,
    ok: !result.abort,
    speed,
    distance: result.metrics.distance,
    ...(result.abort ? { abort: result.abort } : {}),
    trajectory: result.trajectory,
    frames,
    particles: dev.phenotype.particleCount,
  };
}

/**
 * Thin a position buffer down to at most `target` particles.
 *
 * A contact-sheet silhouette is about thirty pixels across. Drawing all 1,400
 * particles of a creature into it produces an identical picture and a 12 MB
 * file; taking every Nth is visually indistinguishable at that size and lands
 * under a megabyte.
 */
function sample(positions: Float32Array, target: number): Float32Array {
  const n = positions.length / 3;
  if (n <= target) return Float32Array.from(positions);
  const stride = Math.ceil(n / target);
  const out = new Float32Array(Math.ceil(n / stride) * 3);
  let w = 0;
  for (let i = 0; i < n; i += stride) {
    out[w++] = positions[i * 3]!;
    out[w++] = positions[i * 3 + 1]!;
    out[w++] = positions[i * 3 + 2]!;
  }
  return out.subarray(0, w);
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

// ..................................................
// Commands
//

function cmdSwim(args: string[]): void {
  const name = args[0] ?? "reference";
  const seconds = Number(args[1] ?? 30);
  const genome = seedByName(name);
  const out = evaluate(genome, name, seconds, true);

  console.log(`\n  ${name}  (${out.id})`);
  if (out.reason) {
    console.log(`  FAILED TO DEVELOP: ${out.reason}\n`);
    return;
  }
  console.log(`  particles      ${out.particles}`);
  console.log(`  distance       ${out.distance.toFixed(2)}`);
  console.log(`  body lengths/s ${out.speed.toFixed(3)}`);
  console.log(`  abort          ${out.abort ?? "none"}`);

  const path = join("sheets", `swim-${name}.svg`);
  write(path, trajectorySvg(out.trajectory, { title: `${name} (${out.id})` }));
  console.log(`  trajectory     ${path}\n`);
}

function cmdSheet(args: string[]): void {
  const count = Number(args[0] ?? 100);
  const seconds = Number(args[1] ?? 30);

  const cells: ContactSheetCell[] = [];
  const outcomes: Outcome[] = [];

  // The seeds themselves first, then jittered offspring sampled around them.
  // Sampling around curated animals rather than uniformly is the whole reason
  // the first sheet is worth looking at.
  const population: Array<{ genome: Genome; label: string }> = SEEDS.map((s) => ({
    genome: s.genome,
    label: s.name,
  }));

  let i = 0;
  while (population.length < count) {
    const parent = SEEDS[i % SEEDS.length]!;
    population.push({
      genome: jitter(parent.genome, `sheet:${parent.name}:${i}`),
      label: `${parent.name}+${i}`,
    });
    i++;
  }

  for (const { genome, label } of population) {
    const out = evaluate(genome, label, seconds, true);
    outcomes.push(out);
    cells.push({
      id: out.id,
      trajectory: out.trajectory,
      frames: out.frames,
      caption: `${label} ${out.speed.toFixed(2)}bl/s${out.abort ? ` !${out.abort}` : ""}`,
      ok: out.ok && out.speed > 0,
    });
  }

  const developed = outcomes.filter((o) => !o.reason);
  const stable = developed.filter((o) => o.ok);
  const locomoting = stable.filter((o) => o.speed > GATE.speed);

  const pctStable = stable.length / outcomes.length;
  const pctLocomoting = locomoting.length / outcomes.length;

  const path = join("sheets", "contact-sheet.svg");
  write(path, contactSheetSvg(cells, 10));

  console.log(`\n  M1 VIABILITY GATE   (n=${outcomes.length}, ${seconds}s each)`);
  console.log(`  ${"-".repeat(52)}`);
  console.log(
    `  developed        ${developed.length}/${outcomes.length}` +
      `  (${outcomes.length - developed.length} failed to build)`,
  );
  console.log(
    `  stable           ${(pctStable * 100).toFixed(1)}%` +
      `   gate >= ${(GATE.stable * 100).toFixed(0)}%   ` +
      (pctStable >= GATE.stable ? "PASS" : "FAIL"),
  );
  console.log(
    `  locomoting       ${(pctLocomoting * 100).toFixed(1)}%` +
      `   gate >= ${(GATE.locomoting * 100).toFixed(0)}%   ` +
      (pctLocomoting >= GATE.locomoting ? "PASS" : "FAIL"),
  );

  const best = [...developed].sort((a, b) => b.speed - a.speed).slice(0, 8);
  console.log(`\n  fastest:`);
  for (const o of best) {
    console.log(
      `    ${o.label.padEnd(16)} ${o.speed.toFixed(3).padStart(8)} bl/s` +
        `  ${o.particles.toString().padStart(5)}p${o.abort ? `  !${o.abort}` : ""}`,
    );
  }

  const aborted = developed.filter((o) => o.abort);
  if (aborted.length > 0) {
    const byReason = new Map<string, number>();
    for (const o of aborted) {
      byReason.set(o.abort!, (byReason.get(o.abort!) ?? 0) + 1);
    }
    console.log(`\n  aborts: ${[...byReason].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  }

  console.log(`\n  sheet            ${path}\n`);
}

// ..................................................

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "swim":
    cmdSwim(rest);
    break;
  case "sheet":
    cmdSheet(rest);
    break;
  default:
    console.log(`
  usage:
    pnpm runner swim  [seed] [seconds]     one animal, with a trajectory plot
    pnpm runner sheet [count] [seconds]    the M1 gate, with a contact sheet

  seeds: ${SEEDS.map((s) => s.name).join(", ")}
`);
}
