/**
 * The generation loop.
 *
 * Note what this file does NOT import: nothing from `@ocean/sim`, and therefore
 * nothing about bells, cavities or drag. Evaluation arrives as an interface.
 *
 * That inversion is worth the small awkwardness. It means the search can be
 * tested against a synthetic landscape with no physics at all — a sphere
 * function where the right answer is known — so that when a real run behaves
 * oddly, "is the search broken or are the creatures bad?" is already answered.
 * It also means the whole of this package could be written before the simulator
 * existed.
 */

import { type Rng, rngFromSeed } from "@ocean/mathx";
import {
  type Genome,
  crossover,
  jitter,
  mutate,
  DEFAULT_MUTATION,
} from "@ocean/genome";
import { Archive, type Elite } from "./archive.js";

/** What a creature scored and how it behaved. */
export interface Evaluation {
  readonly fitness: number;
  readonly behaviour: readonly number[];
  /** Set when the creature failed; it is not filed in the archive. */
  readonly rejected?: string;
}

export type Evaluator = (genome: Genome) => Evaluation;

export interface EvolveConfig {
  /** Genomes evaluated per generation. */
  readonly batch: number;
  /** Probability an offspring is made from two parents rather than one. */
  readonly crossoverRate: number;
  readonly mutationScale: number;
}

export const DEFAULT_EVOLVE: EvolveConfig = {
  batch: 48,
  crossoverRate: 0.25,
  mutationScale: 1,
};

export interface GenerationStats {
  readonly index: number;
  readonly evaluated: number;
  readonly discovered: number;
  readonly improved: number;
  readonly rejected: number;
  readonly failed: number;
  readonly coverage: number;
  readonly bestFitness: number;
  readonly meanFitness: number;
}

/**
 * Seed an empty archive from curated genomes.
 *
 * Uniform random sampling of a 25-dimensional space is almost all rubbish, and
 * MAP-Elites illuminates outward from what it already holds — so the first
 * thing it holds decides how long the run spends in the dark. Each seed is also
 * jittered a few times, because a single point gives the search no local
 * gradient to follow.
 */
export function seedArchive(
  archive: Archive,
  seeds: readonly Genome[],
  evaluate: Evaluator,
  perSeed = 4,
): number {
  let filed = 0;
  for (let s = 0; s < seeds.length; s++) {
    const base = seeds[s]!;
    const candidates = [base];
    for (let k = 0; k < perSeed; k++) {
      candidates.push(jitter(base, `seed:${s}:${k}`, 0.6));
    }
    for (const g of candidates) {
      const e = evaluate(g);
      if (e.rejected) continue;
      archive.insert({
        genome: g,
        fitness: e.fitness,
        behaviour: e.behaviour,
        generation: 0,
      });
      filed++;
    }
  }
  return filed;
}

/** One generation: sample parents from the archive, vary, evaluate, file. */
export function runGeneration(
  archive: Archive,
  index: number,
  evaluate: Evaluator,
  rng: Rng,
  cfg: EvolveConfig = DEFAULT_EVOLVE,
): GenerationStats {
  let discovered = 0;
  let improved = 0;
  let rejected = 0;
  let failed = 0;
  let total = 0;
  let sum = 0;

  for (let i = 0; i < cfg.batch; i++) {
    const a: Elite | undefined = archive.sample(rng());
    if (!a) break;

    let child: Genome;
    if (rng() < cfg.crossoverRate) {
      const b = archive.sample(rng());
      // Crossing a genome with itself is just a copy; mutate instead so the
      // batch never contains a wasted evaluation.
      child =
        b && b.genome.id !== a.genome.id
          ? mutate(crossover(a.genome, b.genome, rng), rng, {
              ...DEFAULT_MUTATION,
              scale: cfg.mutationScale,
            })
          : mutate(a.genome, rng, {
              ...DEFAULT_MUTATION,
              scale: cfg.mutationScale,
            });
    } else {
      child = mutate(a.genome, rng, {
        ...DEFAULT_MUTATION,
        scale: cfg.mutationScale,
      });
    }

    const e = evaluate(child);
    if (e.rejected) {
      failed++;
      continue;
    }

    total++;
    sum += e.fitness;

    const outcome = archive.insert({
      genome: child,
      fitness: e.fitness,
      behaviour: e.behaviour,
      generation: index,
    });
    if (outcome === "discovered") discovered++;
    else if (outcome === "improved") improved++;
    else rejected++;
  }

  return {
    index,
    evaluated: total + failed,
    discovered,
    improved,
    rejected,
    failed,
    coverage: archive.coverage,
    bestFitness: archive.best()?.fitness ?? 0,
    meanFitness: total > 0 ? sum / total : 0,
  };
}

/**
 * Seeds are derived from the run seed, never rolled.
 *
 * The whole run must be a pure function of one number plus the code, or a
 * result cannot be reproduced and a regression cannot be bisected. Deriving
 * each generation's RNG from (runSeed, index) also means generations can be
 * re-run individually without replaying everything before them.
 */
export function generationRng(runSeed: string, index: number): Rng {
  return rngFromSeed(`${runSeed}:gen:${index}`);
}
