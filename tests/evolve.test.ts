/**
 * The search, tested WITHOUT any physics.
 *
 * This is the payoff for making `evolve` take an Evaluator instead of importing
 * the simulator. Against a landscape whose right answers are known in advance,
 * a failure here means the search is broken; a failure in a real run with this
 * passing means the creatures are bad. Without the separation those two look
 * identical from the outside, and telling them apart is most of the work.
 */

import { describe, expect, it } from "vitest";
import { rngFromSeed } from "@ocean/mathx";
import { GENE_COUNT, makeGenome, randomGenome } from "@ocean/genome";
import type { Genome } from "@ocean/genome";
import {
  Archive,
  CELL_COUNT,
  cellKey,
  generationRng,
  runGeneration,
  seedArchive,
} from "@ocean/evolve";

/**
 * A landscape with a known optimum: fitness peaks when every gene is 0.5.
 * Behaviour is read off four unrelated genes, so the grid is fillable and the
 * optimum is reachable from anywhere.
 */
function syntheticEvaluator(genome: Genome) {
  const g = genome.genes;
  let sq = 0;
  for (let i = 0; i < g.length; i++) {
    const d = g[i]! - 0.5;
    sq += d * d;
  }
  const fitness = 1 / (1 + sq);

  return {
    fitness,
    behaviour: [
      0.15 + g[0]! * 3.85, // aspect
      4 + g[1]! * 18, // size
      g[2]! * 0.9, // speed
      g[3]!, // straightness
    ],
  };
}

function seedGenomes(n: number): Genome[] {
  const rng = rngFromSeed("test:seeds");
  return Array.from({ length: n }, () => randomGenome(rng));
}

describe("MAP-Elites", () => {
  it("fills cells and improves the best over generations", () => {
    const archive = new Archive();
    seedArchive(archive, seedGenomes(6), syntheticEvaluator, 3);

    const startCoverage = archive.coverage;
    const startBest = archive.best()!.fitness;
    expect(startCoverage).toBeGreaterThan(0);

    for (let i = 0; i < 40; i++) {
      runGeneration(archive, i, syntheticEvaluator, generationRng("test", i));
    }

    expect(archive.coverage).toBeGreaterThan(startCoverage);
    expect(archive.best()!.fitness).toBeGreaterThan(startBest);
    expect(archive.size).toBeLessThanOrEqual(CELL_COUNT);
  });

  it("is reproducible from its seed", () => {
    const run = () => {
      const a = new Archive();
      seedArchive(a, seedGenomes(4), syntheticEvaluator, 2);
      for (let i = 0; i < 12; i++) {
        runGeneration(a, i, syntheticEvaluator, generationRng("fixed", i));
      }
      return a;
    };

    const a = run();
    const b = run();
    expect(b.size).toBe(a.size);
    expect(b.best()!.genome.id).toBe(a.best()!.genome.id);
    expect(b.best()!.fitness).toBeCloseTo(a.best()!.fitness, 12);
  });

  it("never lets a worse creature displace a better one in the same cell", () => {
    const archive = new Archive();
    const behaviour = [1, 10, 0.4, 0.8];

    const good = makeGenome(new Float64Array(GENE_COUNT).fill(0.5));
    const bad = makeGenome(new Float64Array(GENE_COUNT).fill(0.2));

    expect(
      archive.insert({ genome: good, fitness: 10, behaviour, generation: 0 }),
    ).toBe("discovered");
    expect(
      archive.insert({ genome: bad, fitness: 1, behaviour, generation: 1 }),
    ).toBe("rejected");
    expect(archive.get(cellKey(behaviour))!.genome.id).toBe(good.id);
  });

  it("keeps creatures that differ only in behaviour, not in quality", () => {
    // The whole reason for the grid: a slow creature is not competing with a
    // fast one if they are different KINDS of creature.
    const archive = new Archive();
    const slow = makeGenome(new Float64Array(GENE_COUNT).fill(0.4));
    const fast = makeGenome(new Float64Array(GENE_COUNT).fill(0.6));

    archive.insert({
      genome: slow,
      fitness: 0.1,
      behaviour: [1, 10, 0.05, 0.9],
      generation: 0,
    });
    archive.insert({
      genome: fast,
      fitness: 5,
      behaviour: [1, 10, 0.8, 0.9],
      generation: 0,
    });

    expect(archive.size).toBe(2);
  });

  it("rejects failed evaluations instead of filing them", () => {
    const archive = new Archive();
    const failing = () => ({ fitness: 0, behaviour: [0, 0, 0, 0], rejected: "boom" });
    seedArchive(archive, seedGenomes(3), failing, 2);
    expect(archive.size).toBe(0);
  });
});
