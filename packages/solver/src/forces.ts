/**
 * Forces.
 *
 * `DirectionalForce` is a faithful port. The other three are new, and they are
 * the reason this project needs a solver at all.
 *
 * The reference creature is nailed to the world by five pin constraints, floats
 * in nothing, and has no drag model — it pulses in place and has never moved a
 * millimetre. Everything here exists to give a body a medium to push against,
 * so that "swims well" becomes a measurable property instead of an aesthetic
 * one.
 */

import { cos, sin } from "@ocean/mathx";

export interface Force {
  /**
   * Optional per-tick setup, called once before any particle is visited.
   *
   * Most forces are pointwise and need nothing. A force that depends on a
   * whole-body property — the volume of a cavity, say — cannot compute it
   * inside a per-particle callback without either recomputing it thousands of
   * times or depending on visit order. This is the hook for those.
   */
  prepare?(p0: Float32Array, p1: Float32Array, dt: number): void;

  /**
   * Accumulate into f0 for the particle whose x component is at index ix.
   *
   * `dt` is not in upstream's signature. It has to be here because velocity in
   * a Verlet system is implicit — (p0 - p1) is velocity times dt — and drag
   * needs actual velocity. Forces that don't care simply ignore it, which is
   * why adding it costs nothing in the parity test.
   */
  applyForce(
    ix: number,
    f0: Float32Array,
    p0: Float32Array,
    p1: Float32Array,
    dt: number,
  ): void;
}

/** A constant push on every particle. Gravity, mostly. */
export class DirectionalForce implements Force {
  readonly vector: Float32Array;

  constructor(x: number, y: number, z: number) {
    this.vector = Float32Array.from([x, y, z]);
  }

  set(x: number, y: number, z: number): void {
    this.vector[0] = x;
    this.vector[1] = y;
    this.vector[2] = z;
  }

  applyForce(ix: number, f0: Float32Array): void {
    const v = this.vector;
    f0[ix]! += v[0]!;
    f0[ix + 1]! += v[1]!;
    f0[ix + 2]! += v[2]!;
  }
}

/**
 * Drag against the surrounding water: F = -rho * A * |v| * v.
 *
 * QUADRATIC, and that is the entire point. With linear drag (F proportional to
 * v, not to v squared) the equations are time-reversible, so any stroke that
 * returns the body to its starting shape returns it to its starting position
 * too — Purcell's scallop theorem. A creature could flap forever and go
 * nowhere, and no amount of evolution would fix it, because the failure is in
 * the physics rather than in the animal.
 *
 * Squaring the velocity breaks that symmetry: a fast contraction pushes much
 * harder than a slow relaxation resists. That asymmetry IS the thrust, and it
 * is what makes the gait's duty cycle worth evolving.
 *
 * `area` is per-particle so that a broad bell margin can catch more water than
 * a thin tentacle without either being special-cased.
 */
export class QuadraticDragForce implements Force {
  private readonly area: Float32Array;
  private readonly weights: Float32Array;
  private readonly density: number;

  /**
   * `weights` is needed only for the stability cap below. Drag is the one force
   * whose magnitude depends on the state it is about to change, so it is the
   * one force that can destabilise the integrator.
   */
  private readonly neighbours: Uint32Array | null;
  /** Drag along the surface, as a fraction of drag through it. */
  private readonly tangentRatio: number;

  constructor(
    area: Float32Array,
    weights: Float32Array,
    density = 1,
    neighbours: Uint32Array | null = null,
    tangentRatio = 0.06,
  ) {
    this.area = area;
    this.weights = weights;
    this.density = density;
    this.neighbours = neighbours;
    this.tangentRatio = tangentRatio;
  }

  /**
   * Split velocity into the component through the local surface and the
   * component along it, and charge them very differently.
   *
   * ISOTROPIC DRAG CANNOT SWIM, and this was measured rather than assumed. With
   * one drag coefficient in every direction, a bell pulsing vigorously — rim
   * radius swinging 6.4 to 7.8 units, thirty strokes in thirty seconds — netted
   * 0.006 units of displacement per cycle, slightly downward. The stroke's
   * asymmetry was real in the DRIVE (duty 0.25) but the body's own mechanical
   * response time smoothed it away: measured contraction took 0.4s against 0.6s
   * of relaxation, nowhere near the 1:3 the gait was asking for. Two nearly
   * equal impulses in opposite directions cancel, and the animal hovers.
   *
   * What a bell actually is, hydrodynamically, is a sheet: enormously resistant
   * to moving broadside-on, nearly free to slide edge-on. That anisotropy is
   * the whole mechanism. It means the rim's radial travel — the part that is
   * symmetric — costs almost nothing, while its axial travel — the part that is
   * asymmetric — does the work. The net force stops cancelling.
   *
   * A particle's local surface is spanned by its two neighbours: one around the
   * ring, one down the meridian. Their cross product is the normal.
   */
  private orientedDrag(
    i: number,
    vx: number,
    vy: number,
    vz: number,
    p0: Float32Array,
    out: Float32Array,
  ): boolean {
    const nb = this.neighbours;
    if (!nb) return false;

    const j = nb[i * 2]!;
    const k = nb[i * 2 + 1]!;
    const ix = i * 3;

    let nxa: number;
    let nya: number;
    let nza: number;

    if (k === i) {
      // A chain particle: the tangent is the segment to its neighbour, and drag
      // resists everything perpendicular to it. This is what stops a tentacle
      // behaving like a string of independent beads.
      const tx = p0[j * 3]! - p0[ix]!;
      const ty = p0[j * 3 + 1]! - p0[ix + 1]!;
      const tz = p0[j * 3 + 2]! - p0[ix + 2]!;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      if (tl === 0) return false;

      const ux = tx / tl;
      const uy = ty / tl;
      const uz = tz / tl;
      const along = vx * ux + vy * uy + vz * uz;

      // Perpendicular component gets full drag, along-axis gets the reduced one.
      const px = vx - along * ux;
      const py = vy - along * uy;
      const pz = vz - along * uz;
      const pm = Math.sqrt(px * px + py * py + pz * pz);
      const r = this.tangentRatio;

      out[0] = px * pm + r * along * Math.abs(along) * ux;
      out[1] = py * pm + r * along * Math.abs(along) * uy;
      out[2] = pz * pm + r * along * Math.abs(along) * uz;
      return true;
    }

    const ax = p0[j * 3]! - p0[ix]!;
    const ay = p0[j * 3 + 1]! - p0[ix + 1]!;
    const az = p0[j * 3 + 2]! - p0[ix + 2]!;
    const bx = p0[k * 3]! - p0[ix]!;
    const by = p0[k * 3 + 1]! - p0[ix + 1]!;
    const bz = p0[k * 3 + 2]! - p0[ix + 2]!;

    nxa = ay * bz - az * by;
    nya = az * bx - ax * bz;
    nza = ax * by - ay * bx;

    const nl = Math.sqrt(nxa * nxa + nya * nya + nza * nza);
    // Degenerate patch (collapsed or collinear): fall back to isotropic rather
    // than divide by zero.
    if (nl < 1e-9) return false;

    const ux = nxa / nl;
    const uy = nya / nl;
    const uz = nza / nl;
    const through = vx * ux + vy * uy + vz * uz;

    const tx2 = vx - through * ux;
    const ty2 = vy - through * uy;
    const tz2 = vz - through * uz;
    const tm = Math.sqrt(tx2 * tx2 + ty2 * ty2 + tz2 * tz2);
    const r = this.tangentRatio;

    // |component| * component, per axis: quadratic but signed.
    out[0] = through * Math.abs(through) * ux + r * tx2 * tm;
    out[1] = through * Math.abs(through) * uy + r * ty2 * tm;
    out[2] = through * Math.abs(through) * uz + r * tz2 * tm;
    return true;
  }

  private readonly scratch = new Float32Array(3);

  applyForce(
    ix: number,
    f0: Float32Array,
    p0: Float32Array,
    p1: Float32Array,
    dt: number,
  ): void {
    if (dt <= 0) return;
    const inv = 1 / dt;

    const vx = (p0[ix]! - p1[ix]!) * inv;
    const vy = (p0[ix + 1]! - p1[ix + 1]!) * inv;
    const vz = (p0[ix + 2]! - p1[ix + 2]!) * inv;

    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed === 0) return;

    const i = ix / 3;
    const rhoA = this.density * this.area[i]!;
    const w = this.weights[i]!;

    /*
     * DRAG MUST NOT BE ABLE TO REVERSE THE MOTION IT IS RESISTING.
     *
     * Explicit integration evaluates drag at the START of the step, so a force
     * stiff enough to remove more than all of a particle's velocity in one tick
     * does not merely stop it — it throws it backwards harder than it came in,
     * and the next tick is worse. Because this drag is QUADRATIC the threshold
     * arrives suddenly: the integrator was comfortably stable at 10 units/sec,
     * marginal at 40, and explosively unstable at 120, at which point bodies
     * tore themselves apart and every creature aborted.
     *
     * Verlet turns a force into `f * weight * dt^2` of displacement, while the
     * velocity is worth `speed * dt`. Capping the first at the second lets drag
     * bring a particle to a dead stop in one tick and never do more than that.
     * Below the threshold this changes nothing; above it, it is the difference
     * between a simulation and a firework.
     */
    const maxForce = w > 0 ? speed / (w * dt) : Infinity;

    // Oriented drag writes a full quadratic force vector; isotropic drag only
    // needs a scalar times the velocity.
    if (this.orientedDrag(i, vx, vy, vz, p0, this.scratch)) {
      const s = this.scratch;
      const mag = Math.sqrt(s[0]! * s[0]! + s[1]! * s[1]! + s[2]! * s[2]!);
      if (mag === 0) return;
      const force = rhoA * mag;
      const scale = (force > maxForce ? maxForce / force : 1) * rhoA;

      f0[ix]! -= s[0]! * scale;
      f0[ix + 1]! -= s[1]! * scale;
      f0[ix + 2]! -= s[2]! * scale;
      return;
    }

    let k = rhoA * speed;

    // Same cap, expressed for the isotropic path: k * speed is the magnitude.
    const maxK = speed > 0 ? maxForce / speed : Infinity;
    if (k > maxK) k = maxK;

    f0[ix]! -= k * vx;
    f0[ix + 1]! -= k * vy;
    f0[ix + 2]! -= k * vz;
  }
}

/**
 * Cancels gravity, in proportion.
 *
 * `ratio` of 1 means exactly neutral. This exists as its own force rather than
 * "just don't add gravity" so that the creature still hangs in a gravity field
 * — giving future genes something to be slightly-heavy or slightly-light
 * against — while denying the degenerate strategy where a creature evolves to
 * be dense, sinks quickly, and reports that as speed.
 */
export class BuoyancyForce implements Force {
  private readonly vector: Float32Array;

  constructor(gravity: readonly [number, number, number], ratio = 1) {
    this.vector = Float32Array.from([
      -gravity[0] * ratio,
      -gravity[1] * ratio,
      -gravity[2] * ratio,
    ]);
  }

  applyForce(ix: number, f0: Float32Array): void {
    const v = this.vector;
    f0[ix]! += v[0]!;
    f0[ix + 1]! += v[1]!;
    f0[ix + 2]! += v[2]!;
  }
}

/**
 * A slow ambient current, as a sum of sinusoids in space and time.
 *
 * Deliberately not noise: a Perlin field would need a permutation table and a
 * seed, and this needs to be identical on every run and cheap enough to
 * evaluate per particle per tick. Three incommensurable frequencies are enough
 * to look unstructured over the length of an episode.
 *
 * In M2 the food drifts on this same field. That is what removes the "sit
 * perfectly still and let dinner arrive" strategy: a passive creature moves
 * with the water, so its velocity relative to the food is zero and it catches
 * nothing. Energy becomes obtainable only by moving relative to the medium,
 * which is true of real swimmers and is a much better answer than penalising
 * stillness by hand.
 */
export class FlowFieldForce implements Force {
  /** Advanced by the simulation each tick. */
  time = 0;

  constructor(
    private readonly amplitude = 0.02,
    private readonly scale = 0.015,
    private readonly speed = 0.12,
  ) {}

  sample(x: number, y: number, z: number, out: Float32Array): void {
    const s = this.scale;
    const t = this.time * this.speed;
    const a = this.amplitude;

    out[0] = a * sin(y * s + t) * cos(z * s * 0.7 - t * 0.6);
    out[1] = a * 0.5 * sin(x * s * 1.3 - t * 0.8);
    out[2] = a * cos(x * s * 0.9 + t * 0.4) * sin(y * s * 1.1 + t);
  }

  applyForce(ix: number, f0: Float32Array, p0: Float32Array): void {
    const x = p0[ix]!;
    const y = p0[ix + 1]!;
    const z = p0[ix + 2]!;

    const s = this.scale;
    const t = this.time * this.speed;
    const a = this.amplitude;

    f0[ix]! += a * sin(y * s + t) * cos(z * s * 0.7 - t * 0.6);
    f0[ix + 1]! += a * 0.5 * sin(x * s * 1.3 - t * 0.8);
    f0[ix + 2]! += a * cos(x * s * 0.9 + t * 0.4) * sin(y * s * 1.1 + t);
  }
}
