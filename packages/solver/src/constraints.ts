/**
 * Constraints, ported from Particulate.js.
 *
 * Source: JellyTech/public/static/medusae/libs.develop.js, lines 560-1600.
 * Licence: Artistic-2.0, Ash Weeks (milcktoast/particulate-medusae).
 *
 * The port is deliberately literal. Two properties of this code look like
 * mistakes and are not; both are called out where they occur, because the
 * emergent contraction wave that makes these creatures readable depends on
 * them, and "cleaning them up" would break it in a way that takes weeks to
 * notice.
 */

/** Indices per relation, by kind. */
export const DISTANCE_STRIDE = 2;
export const ANGLE_STRIDE = 3;

export interface Constraint {
  /** Number of relations this instance manages. */
  readonly count: number;
  /** Indices consumed per relation. */
  readonly itemSize: number;
  /**
   * Global constraints are applied once per PARTICLE rather than once per
   * relation — that is what the count/itemSize override in
   * `satisfyConstraintGroup` is for. Planes and bounding boxes are global;
   * everything a creature is made of is local.
   */
  readonly isGlobal: boolean;
  applyConstraint(index: number, p0: Float32Array, p1: Float32Array): void;
}

/**
 * Holds pairs of particles within a distance RANGE, not at a fixed distance.
 *
 * The range is the whole trick. A pair whose separation is between min and max
 * is left completely alone, so the body has genuine slack in it and moves like
 * tissue rather than like a truss. Set min === max and you get a rigid lattice
 * that looks wrong immediately.
 */
export class DistanceConstraint implements Constraint {
  readonly indices: Uint32Array;
  readonly count: number;
  readonly itemSize = DISTANCE_STRIDE;
  readonly isGlobal = false;

  private min2 = 0;
  private max2 = 0;
  /** Current bounds, in length units. The gait rewrites these every tick. */
  currentMin = 0;
  currentMax = 0;

  constructor(min: number, max: number, indices: Uint32Array) {
    this.indices = indices;
    this.count = indices.length / DISTANCE_STRIDE;
    this.setDistance(min, max);
  }

  /** Squared distances are cached because applyConstraint never takes a sqrt. */
  setDistance(min: number, max: number): void {
    this.min2 = min * min;
    this.max2 = max * max;
    this.currentMin = min;
    this.currentMax = max;
  }

  applyConstraint(index: number, p0: Float32Array, _p1: Float32Array): void {
    const ii = this.indices;
    const ai = ii[index]!;
    const bi = ii[index + 1]!;

    const ax = ai * 3;
    const ay = ax + 1;
    const az = ax + 2;
    const bx = bi * 3;
    const by = bx + 1;
    const bz = bx + 2;

    let dx = p0[bx]! - p0[ax]!;
    let dy = p0[by]! - p0[ay]!;
    let dz = p0[bz]! - p0[az]!;

    // Two particles exactly on top of each other have no direction to be
    // separated along. Nudge them diagonally and let the next iteration sort it
    // out. Without this the solve produces NaN and the creature vanishes.
    if (!(dx || dy || dz)) {
      dx = dy = dz = 0.1;
    }

    const dist2 = dx * dx + dy * dy + dz * dz;
    const min2 = this.min2;
    const max2 = this.max2;

    // Inside the slack range: nothing to do. This early-out is most of the
    // reason the solver is fast enough to run thousands of creatures.
    if (dist2 < max2 && dist2 > min2) return;

    const target2 = dist2 < min2 ? min2 : max2;

    /*
     * DO NOT "FIX" THIS.
     *
     * The correct projection is `(dist - target) / dist * 0.5` per particle,
     * which needs a square root. Upstream instead uses
     *
     *     diff = target2 / (dist2 + target2)
     *
     * which is a sqrt-free approximation: exact when dist === target, and
     * increasingly soft as the pair gets further from its target. That softness
     * is a feature here. It means a badly violated constraint relaxes over
     * several ticks instead of snapping, which is what keeps a 15,000-particle
     * body stable at only two solver iterations.
     *
     * It also splits the correction evenly regardless of the particles'
     * weights, so a heavy particle is pushed as far as a light one. Also
     * deliberate, also load-bearing: weight is honoured during integration, and
     * applying it twice makes pinned structures jitter.
     *
     * Every sentence above was verified by porting it faithfully and diffing
     * against the original over 500 ticks. See solver.parity.test.ts.
     */
    const diff = target2 / (dist2 + target2);
    const aDiff = diff - 0.5;
    const bDiff = diff - 0.5;

    p0[ax]! -= dx * aDiff;
    p0[ay]! -= dy * aDiff;
    p0[az]! -= dz * aDiff;

    p0[bx]! += dx * bDiff;
    p0[by]! += dy * bDiff;
    p0[bz]! += dz * bDiff;
  }
}

/**
 * Holds triples (a, pivot, c) within an angle range.
 *
 * Upstream implements this and then never uses it — the jellyfish has no
 * bending stiffness anywhere, which is why its tentacles are pure noodles. It
 * is kept here because tentacle stiffness is exactly the kind of trait worth
 * evolving.
 *
 * NOTE ON DETERMINISM: this is the one place in the simulation that calls
 * Math.acos / Math.cos / Math.tan, which are implementation-approximated. A
 * body that uses angle constraints is therefore reproducible on one engine but
 * not guaranteed identical across engine versions. The M1 body plan does not
 * use them; if that changes, these three calls need deterministic replacements.
 */
export class AngleConstraint implements Constraint {
  readonly indices: Uint32Array;
  readonly count: number;
  readonly itemSize = ANGLE_STRIDE;
  readonly isGlobal = false;

  /** Angles are clamped off 0 and PI; both are degenerate for this solve. */
  private static readonly EPS = 0.0000001;
  static readonly ANGLE_OBTUSE = Math.PI * 0.75;

  private min: number;
  private max: number;

  constructor(min: number, max: number, indices: Uint32Array) {
    this.indices = indices;
    this.count = indices.length / ANGLE_STRIDE;
    this.min = AngleConstraint.clampAngle(min);
    this.max = AngleConstraint.clampAngle(max);
  }

  private static clampAngle(a: number): number {
    const p = AngleConstraint.EPS;
    return a < p ? p : a > Math.PI - p ? Math.PI - p : a;
  }

  setAngle(min: number, max: number): void {
    this.min = AngleConstraint.clampAngle(min);
    this.max = AngleConstraint.clampAngle(max);
  }

  applyConstraint(index: number, p0: Float32Array, _p1: Float32Array): void {
    const ii = this.indices;
    const ai = ii[index]!;
    const bi = ii[index + 1]!;
    const ci = ii[index + 2]!;

    const aix = ai * 3;
    const aiy = aix + 1;
    const aiz = aix + 2;
    const bix = bi * 3;
    const biy = bix + 1;
    const biz = bix + 2;
    const cix = ci * 3;
    const ciy = cix + 1;
    const ciz = cix + 2;

    const abX = p0[bix]! - p0[aix]!;
    const abY = p0[biy]! - p0[aiy]!;
    const abZ = p0[biz]! - p0[aiz]!;

    const bcX = p0[cix]! - p0[bix]!;
    const bcY = p0[ciy]! - p0[biy]!;
    const bcZ = p0[ciz]! - p0[biz]!;

    const acX = p0[cix]! - p0[aix]!;
    const acY = p0[ciy]! - p0[aiy]!;
    const acZ = p0[ciz]! - p0[aiz]!;

    // A and C coincident: no triangle, so perturb and bail.
    if (!(acX || acY || acZ)) {
      p0[aix]! += 0.1;
      p0[biy]! += 0.1;
      p0[cix]! -= 0.1;
      return;
    }

    const abLenSq = abX * abX + abY * abY + abZ * abZ;
    const bcLenSq = bcX * bcX + bcY * bcY + bcZ * bcZ;
    const acLenSq = acX * acX + acY * acY + acZ * acZ;

    const abLen = Math.sqrt(abLenSq);
    const bcLen = Math.sqrt(bcLenSq);
    const acLen = Math.sqrt(acLenSq);

    const abLenInv = 1 / abLen;
    const bcLenInv = 1 / bcLen;

    const bAngle = Math.acos(
      -abX * abLenInv * bcX * bcLenInv +
        -abY * abLenInv * bcY * bcLenInv +
        -abZ * abLenInv * bcZ * bcLenInv,
    );

    if (bAngle > this.min && bAngle < this.max) return;
    const bAngleTarget = bAngle < this.min ? this.min : this.max;

    // Law of cosines: what should |AC| be for the target angle at B?
    const acLenTargetSq =
      abLenSq + bcLenSq - 2 * abLen * bcLen * Math.cos(bAngleTarget);
    const acLenTarget = Math.sqrt(acLenTargetSq);
    const acDiff = ((acLen - acLenTarget) / acLen) * 0.5;

    p0[aix]! += acX * acDiff;
    p0[aiy]! += acY * acDiff;
    p0[aiz]! += acZ * acDiff;

    p0[cix]! -= acX * acDiff;
    p0[ciy]! -= acY * acDiff;
    p0[ciz]! -= acZ * acDiff;

    // For acute targets, moving A and C is enough. For obtuse ones the pivot
    // has to move too or the triangle cannot close.
    if (bAngleTarget < AngleConstraint.ANGLE_OBTUSE) return;

    const aAngleTarget = Math.acos(
      (abLenSq + acLenTargetSq - bcLenSq) / (2 * abLen * acLenTarget),
    );

    const acLenInv = 1 / acLen;
    const acuX = acX * acLenInv;
    const acuY = acY * acLenInv;
    const acuZ = acZ * acLenInv;

    // Project B onto AC.
    const pt = acuX * abX + acuY * abY + acuZ * abZ;
    const apX = acuX * pt;
    const apY = acuY * pt;
    const apZ = acuZ * pt;

    const bpX = apX - abX;
    const bpY = apY - abY;
    const bpZ = apZ - abZ;

    // B sits exactly on AC — the triangle is flat and has no height to scale.
    if (!(bpX || bpY || bpZ)) {
      if (bAngleTarget < Math.PI) {
        p0[bix]! += 0.1;
        p0[biy]! += 0.1;
        p0[biz]! += 0.1;
      }
      return;
    }

    const apLen = Math.sqrt(apX * apX + apY * apY + apZ * apZ);
    const bpLen = Math.sqrt(bpX * bpX + bpY * bpY + bpZ * bpZ);

    const bpLenTarget = apLen * Math.tan(aAngleTarget);
    const bpDiff = (bpLen - bpLenTarget) / bpLen;

    p0[bix]! += bpX * bpDiff;
    p0[biy]! += bpY * bpDiff;
    p0[biz]! += bpZ * bpDiff;
  }
}

/**
 * Pins particles to a fixed world position.
 *
 * The reference creature used five of these, with the pinned particles' weights
 * set to 0, which is precisely why it has never swum: it pulses in place
 * because it is nailed to the origin (app.develop.js:2346-2355). Creatures here
 * must be free-floating, so nothing in the default path uses this. It is kept
 * for anchored test rigs, where holding one end still makes a gait legible.
 */
export class PointConstraint implements Constraint {
  readonly indices: Uint32Array;
  readonly count: number;
  readonly itemSize = 1;
  readonly isGlobal = false;

  private readonly position: Float32Array;

  constructor(position: readonly [number, number, number], indices: Uint32Array) {
    this.position = Float32Array.from(position);
    this.indices = indices;
    this.count = indices.length;
  }

  setPosition(x: number, y: number, z: number): void {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
  }

  applyConstraint(index: number, p0: Float32Array, _p1: Float32Array): void {
    const i = this.indices[index]! * 3;
    p0[i] = this.position[0]!;
    p0[i + 1] = this.position[1]!;
    p0[i + 2] = this.position[2]!;
  }
}
