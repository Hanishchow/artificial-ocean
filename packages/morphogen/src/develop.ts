/**
 * Development: a genome becomes a body.
 *
 * This is the file the reference implementation could not have. Its equivalent,
 * Medusae.js, is 1,094 lines of imperative construction with roughly forty
 * hardcoded numbers, a constructor that ignores its own options argument, and
 * four bare trigonometric formulas for its shape curves. It builds exactly one
 * animal, beautifully. Nothing about it can be varied.
 *
 * Everything here is driven by decoded traits. The vocabulary is the same —
 * rings, loops, radial fans, distance links with slack — because that
 * vocabulary is good and creature-agnostic. What changed is that every count,
 * radius, weight and phase now comes from a number that can mutate.
 *
 * PURITY: this function takes no RNG. Where the body needs asymmetry it derives
 * it from a hash of the genome id, so the same genome is the same animal on
 * every machine, forever. `Math.random` is banned across this package and CI
 * greps for it.
 */

import type {
  ActuatorSpec,
  ConstraintSpec,
  Phenotype,
  Resolution,
} from "@ocean/core-types";
import { type Genome, decode } from "@ocean/genome";
import { BodyBuilder, linkLoop, linkRings } from "@ocean/topology";
import { TAU, clamp, rngFromSeed, splineAt } from "@ocean/mathx";

export interface DevelopOptions {
  readonly resolution: Resolution;
  readonly maxParticles: number;
}

export const EVAL_OPTIONS: DevelopOptions = {
  resolution: "eval",
  // Small enough that hundreds of creatures fit in a generation on a CI runner.
  // The reference ran 14,828 particles for a single animal.
  maxParticles: 2000,
};

export const DISPLAY_OPTIONS: DevelopOptions = {
  resolution: "display",
  maxParticles: 16000,
};

export type DevelopFailure =
  | "particle-budget"
  | "degenerate-geometry"
  | "no-actuators";

export type DevelopResult =
  | { ok: true; phenotype: Phenotype; repairs: readonly string[] }
  | { ok: false; reason: DevelopFailure; detail: string };

/**
 * Display runs the same genome at higher mesh resolution. The animal is the
 * same animal; it just has more particles describing it. This means display is
 * NOT bit-equal to evaluation, which is a real cost and is stated openly rather
 * than hidden: stored fitness is the authority, and the tank is an illustration
 * of it.
 */
const RESOLUTION_MULTIPLIER: Record<Resolution, number> = {
  eval: 1,
  display: 2,
};

export function develop(genome: Genome, opts: DevelopOptions): DevelopResult {
  const t = decode(genome);
  const repairs: string[] = [];
  const mult = RESOLUTION_MULTIPLIER[opts.resolution];

  // ..................................................
  // Decode structure
  //

  const symmetry = Math.round(t["radialSymmetry"]!);
  const segments = symmetry * Math.round(t["segmentsPerSector"]!) * mult;
  const ribCount = Math.max(3, Math.round(t["ribCount"]!) * mult);

  const bellRadius = t["bellRadius"]!;
  const bellHeight = t["bellHeight"]!;

  if (!(bellRadius > 0) || !(bellHeight > 0) || segments < 6) {
    return {
      ok: false,
      reason: "degenerate-geometry",
      detail: `radius=${bellRadius} height=${bellHeight} segments=${segments}`,
    };
  }

  /**
   * The radius profile, normalized so its peak is exactly 1.
   *
   * Rescaling is what keeps shape and size independent. Without it, five
   * profile genes drifting upward would enlarge the animal as a side effect,
   * and bellRadius would be fighting them.
   */
  const controls = [
    t["profile0"]!,
    t["profile1"]!,
    t["profile2"]!,
    t["profile3"]!,
    t["profile4"]!,
  ];
  const peak = Math.max(...controls);
  if (!(peak > 0)) {
    return { ok: false, reason: "degenerate-geometry", detail: "flat profile" };
  }

  let tentaclesPerSector = Math.round(t["tentaclesPerSector"]!);
  let tentacleSegments = Math.round(t["tentacleSegments"]!) * mult;
  const tentacleSegLength = t["tentacleSegLength"]! / mult;
  const tentacleCount = tentaclesPerSector * symmetry;

  // ..................................................
  // Particle budget, repaired deterministically
  //

  const bellParticles = 1 + ribCount * segments;
  let total = bellParticles + tentacleCount * tentacleSegments;

  if (total > opts.maxParticles) {
    const spare = Math.max(0, opts.maxParticles - bellParticles);
    if (tentacleCount > 0 && spare > tentacleCount) {
      const allowed = Math.floor(spare / tentacleCount);
      repairs.push(
        `tentacle segments ${tentacleSegments} -> ${allowed} (particle budget)`,
      );
      tentacleSegments = allowed;
    } else {
      repairs.push(`tentacles dropped (particle budget)`);
      tentacleSegments = 0;
      tentaclesPerSector = 0;
    }
    total = bellParticles + tentaclesPerSector * symmetry * tentacleSegments;
  }

  // A bell alone can exceed the budget if symmetry, resolution and rib count
  // all land high. Failing is correct here: silently shrinking the bell would
  // mean the animal evaluated is not the animal the genome describes.
  if (total > opts.maxParticles) {
    return {
      ok: false,
      reason: "particle-budget",
      detail: `${total} particles exceeds ${opts.maxParticles} from the bell alone`,
    };
  }

  // ..................................................
  // Build
  //

  const body = new BodyBuilder();
  const weightBase = t["weightBase"]!;
  const weightExp = t["weightExp"]!;
  const halfHeight = bellHeight * 0.5;

  /**
   * A tiny deterministic rotation per ring.
   *
   * A perfectly aligned stack of rings is a symmetric equilibrium, and a
   * symmetric equilibrium is one the solver has no reason to leave: the animal
   * will pulse forever without ever tipping, turning or drifting sideways.
   * Technically alive, visibly inert. Breaking the symmetry by a fraction of a
   * segment gives the solve something to fall off.
   */
  const rng = rngFromSeed(genome.id);
  const twist = (rng() - 0.5) * (TAU / segments) * 0.25;

  const apex = body.addPoint(0, halfHeight, 0, weightBase, 1);

  interface Rib {
    index: number;
    radius: number;
    y: number;
    /** 0 at the apex, 1 at the margin. */
    t: number;
    ringGroup: number;
  }
  const ribs: Rib[] = [];

  for (let i = 0; i < ribCount; i++) {
    const ti = ribCount === 1 ? 1 : i / (ribCount - 1);
    const radius = Math.max(
      0.15,
      (splineAt(controls, ti) / peak) * bellRadius,
    );
    const y = halfHeight - ti * bellHeight;

    /**
     * Drag area for one particle of this ring: the patch of bell surface it
     * represents. Circumference over segments gives its width; the vertical
     * gap to the next rib gives its height. Without this a wide bell and a
     * narrow one would catch identical amounts of water, and bell radius would
     * be under no selection pressure at all.
     */
    const ringSpacing = bellHeight / Math.max(1, ribCount - 1);
    const area = ((TAU * radius) / segments) * ringSpacing;

    // Heavier toward the margin: the rim is the part that does the work, and a
    // rim with no inertia cannot throw water.
    const weight = weightBase * (0.35 + Math.pow(ti, weightExp));

    const span = body.addRing(segments, radius, y, weight, area, twist * i);
    ribs.push({
      index: span.index,
      radius,
      y,
      t: ti,
      ringGroup: body.createGroup(),
    });
  }

  // Ring hoops — the muscles. One group per rib so each can be driven at its
  // own phase, which is what makes the contraction a travelling wave rather
  // than a simultaneous squeeze.
  for (const rib of ribs) {
    body.collect(rib.ringGroup, (out) => linkLoop(rib.index, segments, out));
  }

  /*
   * Meridians and diagonal bracing, ONE GROUP PER BAND.
   *
   * The obvious thing is to pool every meridian into a single group and every
   * diagonal into another. It does not work, and the way it fails is worth
   * recording: a constraint group carries ONE rest length, taken from the mean
   * of its pairs, but a bell's rings vary in radius from about 2 units at the
   * apex to 11 at the margin, so their diagonals vary just as much. Pooling
   * them hands every pair the average. Apex diagonals are then stretched to
   * three times their length and margin ones crushed to a third, the body is
   * born violating its own constraints by 5%, and the solver's response is to
   * detonate: peak particle speed hit the clamp within a single tick, the mesh
   * tore, and every creature aborted.
   *
   * A group per band gives each its own rest length, and the rest pose is then
   * exactly satisfied. The cost is a few dozen more constraint objects, which
   * is nothing.
   */
  const spineGroups: number[] = [];
  const shearGroups: number[] = [];
  for (let i = 0; i < ribs.length - 1; i++) {
    const g = body.createGroup();
    body.collect(g, (out) =>
      linkRings(ribs[i]!.index, ribs[i + 1]!.index, segments, out),
    );
    spineGroups.push(g);
  }

  /**
   * Diagonal bracing between consecutive ribs.
   *
   * Hoops plus meridians make a quadrilateral mesh, and a quadrilateral mesh
   * has no shear resistance: it folds flat along its diagonals under the first
   * asymmetric load and the bell collapses into a ribbon. The reference has a
   * commented-out block at app.develop.js:1921-1934 attempting the same thing
   * and an accompanying FIXME. It matters more here, because a collapsed bell
   * still reports a centre of mass and can score a respectable fitness.
   */
  for (let i = 0; i < ribs.length - 1; i++) {
    const a = ribs[i]!.index;
    const b = ribs[i + 1]!.index;
    const g = body.createGroup();
    body.collect(g, (out) => {
      for (let j = 0; j < segments; j++) {
        out.push(a + j, b + ((j + 1) % segments));
      }
    });
    shearGroups.push(g);
  }

  // Apex spokes, closing the top of the bell.
  const radialGroup = body.createGroup();
  body.collect(radialGroup, (out) => {
    const first = ribs[0]!;
    for (let j = 0; j < segments; j++) out.push(apex, first.index + j);
  });

  // ..................................................
  // Tentacles
  //

  const tentacleGroup = body.createGroup();
  const margin = ribs[ribs.length - 1]!;
  let tentacleParticles = 0;

  if (tentaclesPerSector > 0 && tentacleSegments > 0) {
    const count = tentaclesPerSector * symmetry;
    const stride = segments / count;
    const tentacleWeightExp = t["tentacleWeightExp"]!;

    for (let k = 0; k < count; k++) {
      // Attach on a real ring particle, so the tentacle pulls on the rim
      // rather than on a floating point in space.
      const attachOffset = Math.round(k * stride) % segments;
      const attach = margin.index + attachOffset;

      const angle = twist * (ribCount - 1) + (TAU * attachOffset) / segments;
      const ax = Math.cos(angle) * margin.radius;
      const az = Math.sin(angle) * margin.radius;

      let prev = attach;
      for (let s = 0; s < tentacleSegments; s++) {
        const ts = (s + 1) / tentacleSegments;
        // Lighter toward the tip, so it trails and whips instead of swinging
        // as a rigid rod.
        const w = weightBase * (1 + 1.5 * Math.pow(ts, tentacleWeightExp));
        const idx = body.addPoint(
          ax,
          margin.y - (s + 1) * tentacleSegLength,
          az,
          w,
          tentacleSegLength * 0.35,
        );
        body.addToGroup(tentacleGroup, [prev, idx]);
        prev = idx;
        tentacleParticles++;
      }
    }
  }

  // ..................................................
  // Constraints
  //

  const skinSlack = t["skinSlack"]!;
  const radialSlack = t["radialSlack"]!;
  const spineSlack = t["spineSlack"]!;

  const constraints: ConstraintSpec[] = [];

  const addDistance = (group: number, slack: number): number => {
    const rest = body.meanPairLength(group);
    if (rest <= 0) return 0;
    constraints.push({
      kind: "distance",
      indices: body.groupIndices(group),
      min: rest * slack,
      max: rest,
      group,
    });
    return rest;
  };

  const actuators: ActuatorSpec[] = [];
  const pulseAmplitude = t["pulseAmplitude"]!;
  const phaseLagPerRib = t["phaseLagPerRib"]!;
  const contractionExp = t["contractionProfileExp"]!;

  for (let i = 0; i < ribs.length; i++) {
    const rib = ribs[i]!;
    const rest = addDistance(rib.ringGroup, skinSlack);
    if (rest <= 0) continue;

    // Contraction depth grows toward the margin as t^exp. The reference
    // achieved the same thing with a per-rib yParam fixed at build time
    // (app.develop.js:1943-1968); as an exponent it is one evolvable number.
    const depth = pulseAmplitude * Math.pow(rib.t, contractionExp);

    actuators.push({
      group: rib.ringGroup,
      restLength: rest,
      slack: skinSlack,
      amplitude: clamp(depth, 0, 0.9),
      phaseOffset: i * phaseLagPerRib,
      pairCount: segments,
      leverArm: rib.radius,
    });
  }

  for (const g of spineGroups) addDistance(g, spineSlack);
  for (const g of shearGroups) addDistance(g, skinSlack);
  addDistance(radialGroup, radialSlack);
  if (tentacleParticles > 0) addDistance(tentacleGroup, spineSlack);

  if (actuators.length === 0) {
    return {
      ok: false,
      reason: "no-actuators",
      detail: "no rib produced a drivable constraint group",
    };
  }

  // ..................................................
  // Assemble
  //

  const positions = body.positions();
  const bounds = body.bounds();

  /*
   * NORMALISE DRAG AREA TO THE BODY'S FRONTAL PROJECTION.
   *
   * Each bell particle was given the area of the surface patch it represents,
   * which is the obvious thing and is wrong by a large factor. Summed over a
   * closed body those patches total the whole SURFACE area — every facet, front
   * and back, inside and out. What actually resists a body moving through
   * water is its FRONTAL projection, which for this bell is about a fifth of
   * that.
   *
   * The error does not merely slow creatures down, it changes what the
   * simulation is about. Steady swimming speed is set by thrust balancing drag,
   * and both scale with the fluid density, so the density cancels out entirely:
   * speed is fixed by the ratio of drag area to aperture area and by nothing
   * else. Get that ratio wrong by five and no amount of coefficient tuning can
   * recover it — which is exactly what a two-parameter sweep showed, right up
   * until the parameters stopped being physical.
   *
   * So the patches are kept as RELATIVE weights — a wide rim still catches more
   * than a narrow apex — and rescaled so their total is the frontal area.
   * Tentacles are normalised separately against their own profile, since a
   * trailing filament is not part of the bell's silhouette.
   */
  const areas = body.areaArray();
  let bellArea = 0;
  for (let i = 0; i < bellParticles; i++) bellArea += areas[i]!;
  if (bellArea > 0) {
    const frontal = Math.PI * bounds.radius * bounds.radius;
    const scale = frontal / bellArea;
    for (let i = 0; i < bellParticles; i++) areas[i]! *= scale;
  }

  let tentacleArea = 0;
  for (let i = bellParticles; i < body.particleCount; i++) tentacleArea += areas[i]!;
  if (tentacleArea > 0 && tentacleParticles > 0) {
    // A tentacle's silhouette is its length times its width, and it is thin.
    const profile =
      tentacleParticles * tentacleSegLength * (tentacleSegLength * 0.15);
    const scale = profile / tentacleArea;
    for (let i = bellParticles; i < body.particleCount; i++) areas[i]! *= scale;
  }

  /*
   * Drag orientation pairs.
   *
   * A bell particle's local surface is spanned by its neighbour around the ring
   * and its neighbour down the meridian; the cross product of those two is the
   * surface normal, and drag acts mostly through it. A tentacle particle has
   * only a chain neighbour, so its second entry points back at itself, marking
   * it as a line whose drag acts mostly perpendicular to the segment.
   *
   * Without this the animal cannot swim at all — measured, not assumed. See the
   * note in QuadraticDragForce.
   */
  const neighbours = new Uint32Array(body.particleCount * 2);
  // The apex has no ring of its own; borrow the first rib's plane.
  neighbours[0] = ribs[0]!.index;
  neighbours[1] = ribs[0]!.index + 1;

  for (let i = 0; i < ribs.length; i++) {
    const rib = ribs[i]!;
    // Meridian neighbour: the rib below, or the one above for the last rib.
    const other = i < ribs.length - 1 ? ribs[i + 1]! : ribs[i - 1] ?? rib;
    for (let j = 0; j < segments; j++) {
      const p = rib.index + j;
      neighbours[p * 2] = rib.index + ((j + 1) % segments);
      neighbours[p * 2 + 1] = other.index + j;
    }
  }

  for (let p = bellParticles; p < body.particleCount; p++) {
    // Chain neighbour is the previous particle; self in slot two means "line".
    neighbours[p * 2] = p - 1;
    neighbours[p * 2 + 1] = p;
  }

  /**
   * Capture sites: the margin ring and every tentacle particle. Unused until
   * M2, but emitted now so the contract does not change under the renderer
   * later.
   */
  const captureSites: number[] = [];
  for (let j = 0; j < segments; j++) captureSites.push(margin.index + j);
  for (let i = bellParticles; i < body.particleCount; i++) captureSites.push(i);

  const phenotype: Phenotype = {
    genomeId: genome.id,
    specVersion: genome.specVersion,
    resolution: opts.resolution,
    particleCount: body.particleCount,
    positions,
    weights: body.weightArray(),
    dragArea: areas,
    dragNeighbours: neighbours,
    captureSites: Uint32Array.from(captureSites),
    captureRadius: Math.max(0.8, tentacleSegLength),
    constraints,
    actuators,
    surfaces: [],
    // Upkeep scales with particle count. This is the main brake on bloat: an
    // extra tentacle segment costs energy every tick for the animal's whole
    // life, so length has to earn itself.
    basalCost: body.particleCount * 1e-4,
    bounds,
    cavity: {
      rings: Uint32Array.from(ribs.map((r) => r.index)),
      ringSize: segments,
      apex,
    },
  };

  return { ok: true, phenotype, repairs };
}
