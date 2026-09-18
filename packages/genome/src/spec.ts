/**
 * The gene table.
 *
 * A genome is a flat vector of numbers, every one of them in [0, 1]. This table
 * says what each slot means and what range of real values it maps onto.
 *
 * THE CENTRAL IDEA: viability is a property of the MAPPING, not of the mutation
 * operator. Because a gene can only ever hold a value in [0, 1], and because
 * each entry's [min, max] is a range hand-chosen to be survivable, there is no
 * such thing as an out-of-range genome. Mutation does not need to know about
 * biology; it just perturbs numbers. That is the whole answer to "won't random
 * genomes be garbage?" — most will be mediocre swimmers, but none will be
 * malformed, and mediocre is something selection can work with.
 *
 * APPEND ONLY. Never reorder, never renumber, never repurpose a slot. Stored
 * genomes are just vectors; the only thing that says slot 11 is bell radius is
 * this table's ordering, so changing it silently reinterprets every genome ever
 * saved. Add new genes at the end and bump SPEC_VERSION.
 *
 * Scope note: this is a deliberately smaller gene set than the full design
 * sketch (which had tail, mouth and three tentacle groups). M1 exists to answer
 * one question — do developed bodies swim — and a bell with one tentacle group
 * answers it. Extra body parts would add particles, instability and build time
 * without testing anything new. The table is append-only precisely so they can
 * arrive later without invalidating anything learned here.
 */

export const SPEC_VERSION = 1;

export type GeneModule =
  | "bell"
  | "tentacles"
  | "material"
  | "mass"
  | "gait";

export type GeneKind =
  /** Uniform over [min, max]. */
  | "linear"
  /** Geometric over [min, max]; equal gene steps are equal RATIOS. */
  | "log"
  /** Rounded to a whole number in [min, max]. */
  | "int";

export interface GeneSpec {
  readonly key: string;
  readonly module: GeneModule;
  readonly kind: GeneKind;
  readonly min: number;
  readonly max: number;
  /** Mutation step size, as a standard deviation in normalized [0,1] space. */
  readonly sigma: number;
  /**
   * Structural genes change the body's topology (how many rings, how many
   * tentacles); scalar genes only change its proportions. Mutating a structural
   * gene is a much bigger jump, so crossover and mutation treat them
   * differently, and genome distance weights them more heavily.
   */
  readonly structural: boolean;
  readonly introducedIn: number;
}

function g(
  key: string,
  module: GeneModule,
  kind: GeneKind,
  min: number,
  max: number,
  sigma: number,
  structural = false,
): GeneSpec {
  return { key, module, kind, min, max, sigma, structural, introducedIn: 1 };
}

export const GENE_SPECS: readonly GeneSpec[] = [
  // ..................................................
  // Bell
  //
  /**
   * How many-fold symmetric the animal is. Real medusae are typically
   * four-fold; allowing 4-12 lets evolution find its own answer without
   * permitting the degenerate 1- and 2-fold cases, which have no interior.
   */
  g("radialSymmetry", "bell", "int", 4, 12, 0.10, true),
  /** Mesh resolution per sector. radialSegments = symmetry * this. */
  g("segmentsPerSector", "bell", "int", 2, 4, 0.10, true),
  /** Rings from apex to margin. More rings, more places for a wave to live. */
  g("ribCount", "bell", "int", 6, 18, 0.10, true),
  /** Log-scaled: a 4-unit animal and a 24-unit animal differ by a factor, not a sum. */
  g("bellRadius", "bell", "log", 4, 22, 0.08),
  g("bellHeight", "bell", "log", 6, 40, 0.08),

  /**
   * Five control points of the bell's radius profile, apex to margin.
   *
   * These replace the reference's hardcoded
   *   sin(PI - PI*0.55*t*1.8) + log(t*100+2)/3
   * (app.develop.js:1813) with five evolvable numbers.
   *
   * They are normalized: the profile is rescaled so its maximum is 1 and then
   * multiplied by bellRadius. That separation matters. If these were absolute
   * radii, a single mutation could both reshape and resize the animal, and
   * every shape gene would fight the size gene. As it is, shape and scale
   * mutate independently.
   */
  g("profile0", "bell", "linear", 0.05, 1.0, 0.10),
  g("profile1", "bell", "linear", 0.05, 1.0, 0.10),
  g("profile2", "bell", "linear", 0.05, 1.0, 0.10),
  g("profile3", "bell", "linear", 0.05, 1.0, 0.10),
  g("profile4", "bell", "linear", 0.05, 1.0, 0.10),

  // ..................................................
  // Tentacles
  //
  /**
   * Tentacles per sector — so the total is always a multiple of the symmetry
   * and the animal stays balanced. Encoding a raw count instead would let a
   * 7-fold animal grow 4 tentacles and swim in circles for reasons that have
   * nothing to do with its genes.
   */
  g("tentaclesPerSector", "tentacles", "int", 0, 3, 0.12, true),
  g("tentacleSegments", "tentacles", "int", 0, 40, 0.10, true),
  g("tentacleSegLength", "tentacles", "linear", 0.4, 3.0, 0.08),
  /** Weight falls as t^exp along the tentacle; high exp means a whippy tip. */
  g("tentacleWeightExp", "tentacles", "linear", 0.5, 4.0, 0.10),

  // ..................................................
  // Material
  //
  // Each is the ratio min/max on one constraint group. Lower is slacker. This
  // is the tissue's give, and it is what separates a jellyfish from a lampshade.
  //
  g("skinSlack", "material", "linear", 0.72, 0.99, 0.07),
  g("radialSlack", "material", "linear", 0.72, 0.99, 0.07),
  g("spineSlack", "material", "linear", 0.72, 0.99, 0.07),

  // ..................................................
  // Mass
  //
  g("weightBase", "mass", "linear", 0.4, 1.6, 0.08),
  /** Generalises the reference's hardcoded t*t*t (app.develop.js:2018). */
  g("weightExp", "mass", "linear", 0.5, 4.0, 0.10),

  // ..................................................
  // Gait
  //
  g("pulseFreq", "gait", "linear", 0.15, 1.6, 0.08),
  /**
   * Fraction of the cycle spent contracting.
   *
   * This is the single most important gene in the table. Quadratic drag means
   * force goes as velocity squared, so a stroke that contracts in 20% of the
   * cycle and relaxes over the other 80% pushes far harder than it pulls. That
   * asymmetry IS the thrust. A duty of 0.5 is a symmetric stroke and, by
   * Purcell's scallop theorem, goes nowhere.
   */
  g("pulseDuty", "gait", "linear", 0.12, 0.88, 0.09),
  /** Contraction depth as a FRACTION of local rest length. Never absolute. */
  g("pulseAmplitude", "gait", "linear", 0.0, 0.55, 0.09),
  /**
   * Phase difference between consecutive ribs, in radians.
   *
   * Zero means the whole bell contracts at once. Non-zero makes the contraction
   * sweep apex-to-margin or margin-to-apex, which is what a real medusa does.
   * The sign decides the direction, and therefore which way the animal goes.
   */
  g("phaseLagPerRib", "gait", "linear", -0.7, 0.7, 0.09),
  /**
   * How contraction depth varies from apex to margin, as t^exp.
   *
   * The reference achieved this with a per-rib `yParam` computed at build time.
   * Making it an exponent means one number controls whether the animal squeezes
   * mostly at its rim (like a real bell) or all over (like a balloon).
   */
  g("contractionProfileExp", "gait", "linear", 0.3, 3.0, 0.10),
] as const;

export const GENE_COUNT = GENE_SPECS.length;

/** Slot index by key. Built once; development looks up genes by name. */
export const GENE_INDEX: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(GENE_SPECS.map((s, i) => [s.key, i])),
);

export function geneIndex(key: string): number {
  const i = GENE_INDEX[key];
  if (i === undefined) throw new Error(`unknown gene "${key}"`);
  return i;
}
