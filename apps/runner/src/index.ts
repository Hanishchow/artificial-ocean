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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ContactSheetCell,
  type Silhouette,
  contactSheetSvg,
  linePlotSvg,
  trajectorySvg,
} from "@ocean/devtools";
import {
  SEEDS,
  type Genome,
  decode,
  deserialiseGenes,
  jitter,
  seedByName,
} from "@ocean/genome";
import {
  Archive,
  type Evaluation,
  generationRng,
  runGeneration,
  seedArchive,
} from "@ocean/evolve";
import { DISPLAY_OPTIONS, EVAL_OPTIONS, develop } from "@ocean/morphogen";
import {
  Creature,
  DEFAULT_EPISODE,
  describe,
  fitnessOf,
  runEpisode,
} from "@ocean/sim";
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
// Evolution
//

/**
 * Wire development and simulation into the shape the search expects.
 *
 * This function is the ONLY place the two halves meet. Everything above it
 * knows about creatures and nothing about search; everything in `@ocean/evolve`
 * knows about search and nothing about creatures. Keeping that seam narrow is
 * what let the search be tested against a synthetic landscape with no physics
 * at all, so that "is the search broken or are the creatures bad?" is a
 * question with an answer.
 */
function makeEvaluator(seconds: number) {
  return (genome: Genome): Evaluation => {
    const dev = develop(genome, EVAL_OPTIONS);
    if (!dev.ok) {
      return { fitness: -Infinity, behaviour: [0, 0, 0, 0], rejected: dev.reason };
    }

    const result = runEpisode(dev.phenotype, episodeConfig(genome, seconds));
    if (result.abort) {
      return { fitness: -Infinity, behaviour: [0, 0, 0, 0], rejected: result.abort };
    }

    return {
      fitness: fitnessOf(result),
      behaviour: describe(dev.phenotype, result),
    };
  };
}

function cmdEvolve(args: string[]): void {
  const generations = Number(args[0] ?? 30);
  const seconds = Number(args[1] ?? 20);
  const runSeed = args[2] ?? "run-1";

  const evaluator = makeEvaluator(seconds);
  const archive = new Archive();

  const started = Date.now();
  const filed = seedArchive(archive, SEEDS.map((s) => s.genome), evaluator, 4);
  console.log(
    `\n  seeded ${filed} creatures into ${archive.size} cells ` +
      `(${(archive.coverage * 100).toFixed(1)}% coverage)\n`,
  );

  console.log("   gen   eval  new  imp  fail   cells  coverage       best");
  console.log(`  ${"-".repeat(58)}`);

  const best: number[] = [];
  const coverage: number[] = [];
  const mean: number[] = [];

  for (let i = 0; i < generations; i++) {
    const stats = runGeneration(archive, i, evaluator, generationRng(runSeed, i));
    best.push(stats.bestFitness);
    coverage.push(stats.coverage);
    mean.push(stats.meanFitness);

    console.log(
      `  ${String(i).padStart(4)} ${String(stats.evaluated).padStart(6)}` +
        ` ${String(stats.discovered).padStart(4)} ${String(stats.improved).padStart(4)}` +
        ` ${String(stats.failed).padStart(5)} ${String(archive.size).padStart(7)}` +
        ` ${(stats.coverage * 100).toFixed(1).padStart(8)}%` +
        ` ${stats.bestFitness.toFixed(4).padStart(10)}`,
    );
  }

  const champion = archive.best();
  console.log(`\n  ${((Date.now() - started) / 1000).toFixed(0)}s for ${generations} generations`);

  if (champion) {
    const t = decode(champion.genome);
    console.log(
      `\n  champion ${champion.genome.id.slice(0, 8)}  ` +
        `${champion.fitness.toFixed(4)} energy/s  (found in generation ${champion.generation})`,
    );
    console.log(
      `    radius ${t["bellRadius"]!.toFixed(1)}  height ${t["bellHeight"]!.toFixed(1)}  ` +
        `ribs ${Math.round(t["ribCount"]!)}  symmetry ${Math.round(t["radialSymmetry"]!)}  ` +
        `tentacles ${Math.round(t["tentaclesPerSector"]!) * Math.round(t["radialSymmetry"]!)}`,
    );
    console.log(
      `    freq ${t["pulseFreq"]!.toFixed(2)}  duty ${t["pulseDuty"]!.toFixed(2)}  ` +
        `amp ${t["pulseAmplitude"]!.toFixed(2)}  lag ${t["phaseLagPerRib"]!.toFixed(2)}  ` +
        `slack ${t["skinSlack"]!.toFixed(2)}`,
    );
  }

  write(join("data", `${runSeed}-archive.json`), JSON.stringify(archive.toJSON(), null, 1));
  write(
    join("sheets", `${runSeed}-progress.svg`),
    linePlotSvg([
      { label: "best fitness (energy/s)", values: best, color: "#5ad6ff" },
      { label: "batch mean", values: mean, color: "#c77dff" },
      { label: "archive coverage", values: coverage, color: "#8fe388" },
    ]),
  );
  console.log(
    `\n  archive   data/${runSeed}-archive.json\n` +
      `  progress  sheets/${runSeed}-progress.svg\n`,
  );
}

/** Render an archive's elites as a contact sheet. */
function cmdGallery(args: string[]): void {
  const runSeed = args[0] ?? "run-1";
  const seconds = Number(args[1] ?? 20);

  const raw = readFileSync(join("data", `${runSeed}-archive.json`), "utf8");
  const snapshot = JSON.parse(raw) as {
    cells: Array<{ key: string; genes: number[]; fitness: number }>;
  };

  const top = [...snapshot.cells].sort((a, b) => b.fitness - a.fitness).slice(0, 100);
  const cells: ContactSheetCell[] = [];

  for (const c of top) {
    const genome = deserialiseGenes(c.genes.join(","));
    const out = evaluate(genome, c.key, seconds, true);
    cells.push({
      id: out.id,
      trajectory: out.trajectory,
      frames: out.frames,
      caption: `${out.speed.toFixed(3)}bl/s`,
      ok: out.ok && out.speed > 0,
    });
  }

  const path = join("sheets", `${runSeed}-gallery.svg`);
  write(path, contactSheetSvg(cells, 10));
  console.log(`\n  ${top.length} elites rendered to ${path}\n`);
}

// ..................................................
// Recording, for the viewer
//

/**
 * Capture one gait cycle of a creature, in its own frame of reference.
 *
 * Recording the whole episode would be the obvious thing and produces a file
 * tens of megabytes wide. A gait is periodic, so one period is all the motion
 * there is; everything after it is the same shapes again, plus translation.
 *
 * So: subtract the centre of mass from every frame, store exactly one period,
 * and let the viewer carry the creature forward at the measured speed. The
 * swimming loops, the travel does not, and the file is a few hundred kilobytes
 * instead of thirty megabytes.
 *
 * The loop is not perfectly seamless. Drift, the ambient current and the
 * solver's own residual mean the body does not return to precisely the pose it
 * started in, so there is a small discontinuity at the wrap. It is visible if
 * you look for it and invisible if you do not.
 */
function cmdRecord(args: string[]): void {
  const name = args[0] ?? "reference";
  const settleSeconds = Number(args[1] ?? 8);
  const fps = Number(args[2] ?? 60);

  const genome = name.startsWith("archive:")
    ? championOf(name.slice("archive:".length))
    : seedByName(name);

  // Display resolution, capped: the eval body is deliberately coarse, and a
  // full-fat display body is more mesh than a web page needs.
  const dev = develop(genome, { ...DISPLAY_OPTIONS, maxParticles: 3200 });
  if (!dev.ok) {
    console.log(`  cannot develop ${name}: ${dev.reason} ${dev.detail}`);
    return;
  }

  const ph = dev.phenotype;
  const t = decode(genome);
  const cfg = episodeConfig(genome, settleSeconds + 4);
  const creature = new Creature(ph, cfg);
  const dt = 1 / cfg.hz;

  // Let the warm-up finish and the gait establish before recording.
  for (let i = 0; i < Math.round(settleSeconds * cfg.hz); i++) {
    creature.step(dt);
    creature.system.clampVelocity(cfg.guards.maxSpeed, dt);
  }

  const period = 1 / Math.max(0.05, t["pulseFreq"]!);
  const frameCount = Math.max(8, Math.round(period * fps));
  const stepsPerFrame = Math.max(1, Math.round(cfg.hz / fps));

  const com = new Float32Array(3);
  const frames: number[][] = [];
  const travel: number[][] = [];

  for (let f = 0; f < frameCount; f++) {
    for (let k = 0; k < stepsPerFrame; k++) {
      creature.step(dt / stepsPerFrame);
      creature.system.clampVelocity(cfg.guards.maxSpeed, dt / stepsPerFrame);
    }

    creature.system.centreOfMass(com);
    const p = creature.system.positions;
    const frame = new Array<number>(ph.particleCount * 3);
    for (let i = 0; i < ph.particleCount; i++) {
      // Two decimals: the bodies are tens of units across, so hundredths are
      // far below anything a screen can show, and it halves the file.
      frame[i * 3] = Math.round((p[i * 3]! - com[0]!) * 100) / 100;
      frame[i * 3 + 1] = Math.round((p[i * 3 + 1]! - com[1]!) * 100) / 100;
      frame[i * 3 + 2] = Math.round((p[i * 3 + 2]! - com[2]!) * 100) / 100;
    }
    frames.push(frame);
    travel.push([com[0]!, com[1]!, com[2]!]);
  }

  const bulb = ph.surfaces.find((s) => s.name === "bulb");
  const tent = ph.surfaces.find((s) => s.name === "tentacles");

  const payload = {
    meta: {
      name,
      genomeId: ph.genomeId,
      particles: ph.particleCount,
      fps: Math.round(fps / stepsPerFrame),
      frames: frameCount,
      bounds: ph.bounds,
      traits: {
        bellRadius: t["bellRadius"]!,
        bellHeight: t["bellHeight"]!,
        ribs: Math.round(t["ribCount"]!),
        symmetry: Math.round(t["radialSymmetry"]!),
        tentacles:
          Math.round(t["tentaclesPerSector"]!) * Math.round(t["radialSymmetry"]!),
        pulseFreq: t["pulseFreq"]!,
        pulseDuty: t["pulseDuty"]!,
      },
      // How far the body actually moved over the recorded period, so the viewer
      // can carry it forward at the speed it really swims.
      drift: [
        travel[travel.length - 1]![0]! - travel[0]![0]!,
        travel[travel.length - 1]![1]! - travel[0]![1]!,
        travel[travel.length - 1]![2]! - travel[0]![2]!,
      ],
    },
    faces: Array.from(bulb?.faces ?? []),
    lines: Array.from(tent?.lines ?? []),
    frames,
  };

  const path = join("data", `${name.replace(/[^a-z0-9]/gi, "-")}-anim.json`);
  write(path, JSON.stringify(payload));
  console.log(
    `\n  ${name}: ${ph.particleCount} particles, ${frameCount} frames` +
      ` (${period.toFixed(2)}s loop), ${(bulb?.faces.length ?? 0) / 3} triangles`,
  );
  console.log(`  ${path}\n`);
}

/** The fittest genome in a stored archive. */
function championOf(runSeed: string): Genome {
  const raw = readFileSync(join("data", `${runSeed}-archive.json`), "utf8");
  const snapshot = JSON.parse(raw) as {
    cells: Array<{ genes: number[]; fitness: number }>;
  };
  const best = snapshot.cells.reduce((a, b) => (b.fitness > a.fitness ? b : a));
  return deserialiseGenes(best.genes.join(","));
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
  case "evolve":
    cmdEvolve(rest);
    break;
  case "gallery":
    cmdGallery(rest);
    break;
  case "record":
    cmdRecord(rest);
    break;
  default:
    console.log(`
  usage:
    pnpm runner swim  [seed] [seconds]     one animal, with a trajectory plot
    pnpm runner sheet [count] [seconds]    the M1 gate, with a contact sheet
    pnpm runner evolve [gens] [secs] [run] MAP-Elites search
    pnpm runner gallery [run] [seconds]    an archive's elites as a sheet
    pnpm runner record [seed|archive:run]  one gait cycle, for the viewer

  seeds: ${SEEDS.map((s) => s.name).join(", ")}
`);
}
