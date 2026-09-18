/**
 * Genomes: creation, decoding, mutation, crossover, distance.
 *
 * A genome is data, not an object graph — a Float64Array plus provenance. That
 * is what makes the whole system cheap: a creature travels over the wire as
 * about 200 bytes and is grown again on arrival, rather than being shipped as a
 * mesh.
 */

import {
  type Rng,
  clamp,
  gaussian,
  hashId,
  reflect,
  rngFromSeed,
} from "@ocean/mathx";
import {
  GENE_COUNT,
  GENE_SPECS,
  SPEC_VERSION,
  type GeneSpec,
  geneIndex,
} from "./spec.js";

export interface Genome {
  readonly id: string;
  readonly specVersion: number;
  /** One value per GENE_SPECS entry, each in [0, 1]. */
  readonly genes: Float64Array;
  readonly parents: readonly string[];
  readonly generation: number;
}

/** Content hash, so the same genes always produce the same id. */
function idOf(genes: Float64Array, specVersion: number): string {
  // Fixed precision: two genomes that differ only in float noise far below any
  // phenotypic effect should not count as different animals.
  let s = `v${specVersion}`;
  for (let i = 0; i < genes.length; i++) s += `:${genes[i]!.toFixed(9)}`;
  return hashId(s);
}

export function makeGenome(
  genes: Float64Array,
  opts: { parents?: readonly string[]; generation?: number } = {},
): Genome {
  if (genes.length !== GENE_COUNT) {
    throw new Error(
      `genome has ${genes.length} genes, spec v${SPEC_VERSION} expects ${GENE_COUNT}`,
    );
  }
  const clamped = new Float64Array(GENE_COUNT);
  for (let i = 0; i < GENE_COUNT; i++) clamped[i] = clamp(genes[i]!, 0, 1);

  return {
    id: idOf(clamped, SPEC_VERSION),
    specVersion: SPEC_VERSION,
    genes: clamped,
    parents: opts.parents ?? [],
    generation: opts.generation ?? 0,
  };
}

/**
 * Uniformly random genome.
 *
 * Used for tests and for measuring how much the curated seeds actually help.
 * NOT how a population is initialised: a 25-dimensional space sampled uniformly
 * is almost entirely mediocre, and starting there wastes generations climbing
 * out of noise that a handful of hand-written seeds skips for free.
 */
export function randomGenome(rng: Rng): Genome {
  const genes = new Float64Array(GENE_COUNT);
  for (let i = 0; i < GENE_COUNT; i++) genes[i] = rng();
  return makeGenome(genes);
}

// ..................................................
// Decoding
//

/** Map one normalized gene onto its phenotypic value. */
export function decodeGene(spec: GeneSpec, value: number): number {
  const t = clamp(value, 0, 1);
  switch (spec.kind) {
    case "linear":
      return spec.min + (spec.max - spec.min) * t;
    case "log": {
      // Geometric interpolation: equal gene steps are equal RATIOS. A size gene
      // spanning 4 to 22 linearly spends most of its range on large animals;
      // log-scaled it treats "half as big" as one step wherever you are.
      const lo = Math.log(spec.min);
      const hi = Math.log(spec.max);
      return Math.exp(lo + (hi - lo) * t);
    }
    case "int": {
      // Nudged inward so the two end values are not half as likely as the rest.
      const span = spec.max - spec.min + 1;
      const n = Math.floor(spec.min + t * span);
      return clamp(n, spec.min, spec.max);
    }
  }
}

export type Traits = Readonly<Record<string, number>>;

/** Decode every gene into a plain name-to-value record. */
export function decode(genome: Genome): Traits {
  const out: Record<string, number> = {};
  for (let i = 0; i < GENE_SPECS.length; i++) {
    const spec = GENE_SPECS[i]!;
    out[spec.key] = decodeGene(spec, genome.genes[i]!);
  }
  return out;
}

/** Inverse of decodeGene: phenotypic value back to a normalized gene. */
export function encodeGene(spec: GeneSpec, value: number): number {
  switch (spec.kind) {
    case "linear":
      return clamp((value - spec.min) / (spec.max - spec.min), 0, 1);
    case "log": {
      const lo = Math.log(spec.min);
      const hi = Math.log(spec.max);
      return clamp((Math.log(clamp(value, spec.min, spec.max)) - lo) / (hi - lo), 0, 1);
    }
    case "int": {
      const span = spec.max - spec.min + 1;
      // Aim at the middle of the integer's bucket, so a round-trip is stable.
      return clamp((clamp(value, spec.min, spec.max) - spec.min + 0.5) / span, 0, 1);
    }
  }
}

/**
 * Build a genome by naming the traits you want.
 *
 * This is how the curated seed animals are written — in real units, readable as
 * a description of a creature, rather than as 25 opaque numbers. Unspecified
 * traits take the midpoint of their range.
 */
export function fromTraits(traits: Traits): Genome {
  const genes = new Float64Array(GENE_COUNT);
  for (let i = 0; i < GENE_SPECS.length; i++) {
    const spec = GENE_SPECS[i]!;
    const v = traits[spec.key];
    genes[i] = v === undefined ? 0.5 : encodeGene(spec, v);
  }
  return makeGenome(genes);
}

// ..................................................
// Variation
//

export interface MutationConfig {
  /** Probability each gene is touched at all. */
  readonly rate: number;
  /** Multiplier on every gene's own sigma. */
  readonly scale: number;
  /** Probability a structural gene may be touched. Usually lower. */
  readonly structuralRate: number;
}

export const DEFAULT_MUTATION: MutationConfig = {
  rate: 0.25,
  scale: 1,
  // Structural changes reshape the animal rather than adjust it. Letting them
  // fire as often as scalar mutations means offspring rarely resemble their
  // parents, and selection cannot accumulate anything.
  structuralRate: 0.08,
};

export function mutate(
  genome: Genome,
  rng: Rng,
  cfg: MutationConfig = DEFAULT_MUTATION,
): Genome {
  const genes = new Float64Array(genome.genes);

  for (let i = 0; i < GENE_SPECS.length; i++) {
    const spec = GENE_SPECS[i]!;
    const rate = spec.structural ? cfg.structuralRate : cfg.rate;
    if (rng() >= rate) continue;

    const step = gaussian(rng) * spec.sigma * cfg.scale;
    // Reflect, do not clamp. Clamping piles probability mass exactly on 0 and
    // 1, turning both ends of every range into attractors that no selection
    // pressure put there. See mathx.reflect.
    genes[i] = reflect(genes[i]! + step, 0, 1);
  }

  return makeGenome(genes, {
    parents: [genome.id],
    generation: genome.generation + 1,
  });
}

/**
 * Uniform crossover, but whole modules at a time.
 *
 * Per-gene crossover would routinely take bell radius from one parent and the
 * bell profile from the other, producing an animal neither parent's selection
 * history says anything about. Swapping at module boundaries keeps
 * co-adapted groups — a body shape, a gait — intact, which is the same reason
 * real genomes are organised into linkage groups.
 */
export function crossover(a: Genome, b: Genome, rng: Rng): Genome {
  const genes = new Float64Array(GENE_COUNT);
  const pick = new Map<string, boolean>();

  for (let i = 0; i < GENE_SPECS.length; i++) {
    const spec = GENE_SPECS[i]!;
    let fromA = pick.get(spec.module);
    if (fromA === undefined) {
      fromA = rng() < 0.5;
      pick.set(spec.module, fromA);
    }
    genes[i] = fromA ? a.genes[i]! : b.genes[i]!;
  }

  return makeGenome(genes, {
    parents: [a.id, b.id],
    generation: Math.max(a.generation, b.generation) + 1,
  });
}

/**
 * Weighted L2 distance in normalized gene space.
 *
 * Structural genes count for more because they change what the animal IS, not
 * just its proportions. Used for speciation and for measuring whether a
 * population has collapsed onto one design.
 */
export function distance(a: Genome, b: Genome): number {
  let sum = 0;
  for (let i = 0; i < GENE_SPECS.length; i++) {
    const w = GENE_SPECS[i]!.structural ? 3 : 1;
    const d = a.genes[i]! - b.genes[i]!;
    sum += w * d * d;
  }
  return Math.sqrt(sum);
}

// ..................................................
// Serialisation
//

/** Genes as a compact, exactly round-tripping string. */
export function serialiseGenes(genome: Genome): string {
  return Array.from(genome.genes, (v) => v.toFixed(6)).join(",");
}

export function deserialiseGenes(
  s: string,
  opts: { parents?: readonly string[]; generation?: number } = {},
): Genome {
  const parts = s.split(",");
  const genes = new Float64Array(GENE_COUNT);
  for (let i = 0; i < GENE_COUNT; i++) genes[i] = Number(parts[i] ?? 0.5);
  return makeGenome(genes, opts);
}

/**
 * A genome derived deterministically from a seed string.
 * Same string, same animal, forever — on any machine.
 */
export function genomeFromSeed(seed: string): Genome {
  return randomGenome(rngFromSeed(seed));
}

/** Perturb a genome deterministically. Used to sample around curated seeds. */
export function jitter(genome: Genome, seed: string, scale = 1): Genome {
  const rng = rngFromSeed(seed);
  return mutate(genome, rng, {
    rate: 0.6,
    scale,
    structuralRate: 0.25,
  });
}

export { geneIndex };
