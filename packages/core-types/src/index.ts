/**
 * The contract every other package agrees on.
 *
 * This package contains types and nothing else — no runtime code, no imports.
 * It is deliberately the only module that more than one track may depend on,
 * which is what lets the solver, the morphogen, the renderer and the evolution
 * loop be built independently without stepping on each other.
 *
 * It is FROZEN at the end of M0. Changing a type here invalidates work in
 * progress elsewhere, so changes go through one owner as their own commit.
 */

/** Opaque handle tying a set of constraints to the actuator that drives them. */
export type ConstraintGroupId = number;

export type ConstraintKind = "distance" | "angle";

/**
 * A batch of constraints of one kind, sharing one rest length.
 *
 * `indices` is flat, not an array of tuples: stride 2 for distance (a, b),
 * stride 3 for angle (a, pivot, b). Flat typed arrays are how the solver wants
 * them, and converting at the boundary would mean allocating per creature per
 * evaluation — hundreds of times a generation.
 */
export interface ConstraintSpec {
  readonly kind: ConstraintKind;
  readonly indices: Uint32Array;
  /** Distance: shortest allowed. Angle: radians. */
  readonly min: number;
  /** Distance: longest allowed. The gap between min and max is slack. */
  readonly max: number;
  readonly group: ConstraintGroupId;
}

/**
 * One muscle.
 *
 * The reference implementation drove its bell by walking a hardcoded array of
 * ribs and rewriting three named constraints from a sine phase scaled by each
 * rib's height (`app.develop.js:1943-1968`). That works, and it is why the
 * contraction wave looks right, but it cannot be evolved: the ribs, the three
 * names and the scaling are all written into the source.
 *
 * Here that same mechanism becomes a flat table. Development emits one entry
 * per constraint group it wants actuated; a generic controller in `sim` walks
 * the table each tick and rewrites rest lengths. The travelling wave still
 * EMERGES from solver propagation delay rather than being authored — but the
 * phase lag, the amplitude and which groups actuate at all are now genes.
 */
export interface ActuatorSpec {
  readonly group: ConstraintGroupId;
  /** Rest length at phase zero, in world units. */
  readonly restLength: number;
  /** min = max * slack. Below 1; the gap is what makes the body floppy. */
  readonly slack: number;
  /**
   * Contraction depth as a FRACTION of restLength, never an absolute length.
   *
   * The reference hardcoded `radiusOffset = 15` (`app.develop.js:1944`), a
   * number that only means anything for a bell of radius 15. Encoding the
   * fraction instead makes gait scale-free, so body size and stroke depth can
   * mutate independently instead of one silently invalidating the other.
   */
  readonly amplitude: number;
  /** Radians. Offsetting this per rib is what aims the wave up or down. */
  readonly phaseOffset: number;
  /** Number of constraint pairs in the group, for M2 energy accounting. */
  readonly pairCount: number;
  /** Local radius, for M2 energy accounting (work = force x distance). */
  readonly leverArm: number;
}

/** Renderable surface. The simulation ignores this entirely. */
export interface SurfaceGroup {
  readonly name: "bulb" | "tail" | "mouth" | "tentacles";
  readonly faces: Uint32Array;
  readonly lines: Uint32Array;
  readonly uvs: Float32Array;
}

/**
 * Evaluation runs small so hundreds of creatures fit in a generation; display
 * runs large because it is seen. The same genome develops at both, which means
 * display is NOT bit-equal to evaluation. Stored fitness is the authority.
 */
export type Resolution = "eval" | "display";

/**
 * A developed body: everything the simulation needs, and nothing that knows
 * about genomes, Three.js, or how it came to exist.
 */
export interface Phenotype {
  readonly genomeId: string;
  readonly specVersion: number;
  readonly resolution: Resolution;
  readonly particleCount: number;
  /** Rest pose, particleCount * 3, xyz interleaved. */
  readonly positions: Float32Array;
  /** Inverse-mass-ish. 0 pins a particle; the reference used that for pinning. */
  readonly weights: Float32Array;
  /** Per-particle frontal area, for quadratic drag. */
  readonly dragArea: Float32Array;
  /**
   * Two neighbour indices per particle, for orienting drag. Null = isotropic.
   *
   * For a surface particle the pair spans the local surface, and the normal is
   * their cross product. For a particle on a chain the second entry equals the
   * particle's own index, which marks it as a LINE: the first entry gives the
   * tangent and drag is applied perpendicular to it.
   */
  readonly dragNeighbours: Uint32Array | null;
  /** Particles that can catch food (M2). */
  readonly captureSites: Uint32Array;
  readonly captureRadius: number;
  readonly constraints: readonly ConstraintSpec[];
  readonly actuators: readonly ActuatorSpec[];
  readonly surfaces: readonly SurfaceGroup[];
  /** Upkeep per tick before any swimming. The main brake on runaway body size. */
  readonly basalCost: number;
  readonly bounds: { readonly radius: number; readonly height: number };
  /** Null for a body with no enclosed volume; such a body cannot jet. */
  readonly cavity: CavitySpec | null;
}

/**
 * The enclosed cavity under a bell.
 *
 * A medusa does not swim by flapping. It swims by squeezing a volume of water
 * out of the space beneath its bell and riding the reaction — it is a pump, not
 * a paddle. Reproducing that needs to know which particles bound the cavity, so
 * its volume can be measured every tick and the rate of change turned into
 * thrust.
 *
 * Rings run apex-first; the last is the margin, whose opening is the aperture
 * the water leaves through.
 */
export interface CavitySpec {
  /** First particle index of each ring, apex-first. */
  readonly rings: Uint32Array;
  /** Particles per ring. Every ring has the same count. */
  readonly ringSize: number;
  /** The single particle closing the top. */
  readonly apex: number;
}

/** Why an episode was cut short. Absent means it ran to completion. */
export type AbortReason = "exploded" | "nan" | "stalled" | "starved";

export interface EpisodeMetrics {
  /** Straight-line displacement from start to finish. */
  readonly distance: number;
  /** Total distance travelled along the path. Always >= distance. */
  readonly pathLength: number;
  readonly meanSpeed: number;
  /** Body lengths per second — the M1 gate is stated in these units. */
  readonly bodyLengthsPerSecond: number;
  readonly ticksSurvived: number;
  readonly workDone: number;
  /** Energy taken in minus energy spent, over the whole episode. */
  readonly netEnergy: number;
  readonly captures: number;
  readonly energySpent: number;
  /**
   * Mean constraint violation at the end versus the start.
   *
   * A body that has quietly torn itself apart still reports a centre of mass,
   * and that centre of mass may have travelled a long way. This is how we tell
   * swimming apart from disintegrating.
   */
  readonly integrityDrift: number;
}

export interface EpisodeResult {
  readonly genomeId: string;
  readonly metrics: EpisodeMetrics;
  readonly abort?: AbortReason;
  /** Centre-of-mass position sampled per tick, xyz interleaved. */
  readonly trajectory: Float32Array;
}
