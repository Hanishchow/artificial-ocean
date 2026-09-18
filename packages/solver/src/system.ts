/**
 * The particle system: position-Verlet with constraint relaxation.
 *
 * Ported from Particulate.js (libs.develop.js:1651-2009), Artistic-2.0,
 * Ash Weeks. Verified bit-for-bit against the original over 500 ticks — see
 * solver.parity.test.ts.
 */

import type { Constraint } from "./constraints.js";
import type { Force } from "./forces.js";

export class ParticleSystem {
  /** Current positions, xyz interleaved. */
  readonly positions: Float32Array;
  /**
   * Positions one tick ago.
   *
   * In Verlet this doubles as the velocity store — there is no separate
   * velocity array, and (positions - positionsPrev) is velocity * dt. It is
   * also uploaded to the GPU alongside `positions` so the vertex shader can
   * interpolate between physics steps, which is how a 30 Hz simulation renders
   * smoothly at 120 Hz.
   */
  readonly positionsPrev: Float32Array;
  readonly accumulatedForces: Float32Array;
  /**
   * Per-particle weight, behaving as inverse mass: it scales how far a given
   * force moves a particle. Zero pins a particle completely.
   */
  readonly weights: Float32Array;

  readonly count: number;
  readonly iterations: number;

  private readonly globalConstraints: Constraint[] = [];
  private readonly localConstraints: Constraint[] = [];
  private readonly pinConstraints: Constraint[] = [];
  private readonly forces: Force[] = [];

  constructor(positions: Float32Array | number, iterations = 1) {
    const isCount = typeof positions === "number";
    const length = isCount ? positions * 3 : positions.length;

    this.positions = isCount ? new Float32Array(length) : new Float32Array(positions);
    this.positionsPrev = isCount
      ? new Float32Array(length)
      : new Float32Array(positions);
    this.accumulatedForces = new Float32Array(length);

    this.count = length / 3;
    this.weights = new Float32Array(this.count).fill(1);
    this.iterations = iterations;
  }

  setPosition(i: number, x: number, y: number, z: number): void {
    const ix = i * 3;
    this.positions[ix] = x;
    this.positions[ix + 1] = y;
    this.positions[ix + 2] = z;
    this.positionsPrev[ix] = x;
    this.positionsPrev[ix + 1] = y;
    this.positionsPrev[ix + 2] = z;
  }

  setWeight(i: number, w: number): void {
    this.weights[i] = w;
  }

  addConstraint(c: Constraint): void {
    (c.isGlobal ? this.globalConstraints : this.localConstraints).push(c);
  }

  /** Resolved last, every iteration, so a pin always wins. */
  addPinConstraint(c: Constraint): void {
    this.pinConstraints.push(c);
  }

  addForce(f: Force): void {
    this.forces.push(f);
  }

  // ..................................................
  // The step
  //

  /**
   * Zero the force buffer and let every force write into it.
   *
   * Note the loop order: particle outer, force inner. That means a force object
   * is invoked once per particle rather than once per system, which looks
   * wasteful and is how the polymorphic `applyForce(ix, ...)` signature stays
   * allocation-free.
   */
  accumulateForces(dt: number): void {
    const f0 = this.accumulatedForces;
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const forces = this.forces;

    for (let i = 0, il = this.count; i < il; i++) {
      const ix = i * 3;
      f0[ix] = f0[ix + 1] = f0[ix + 2] = 0;

      for (let j = 0, jl = forces.length; j < jl; j++) {
        forces[j]!.applyForce(ix, f0, p0, p1, dt);
      }
    }
  }

  /**
   * Position Verlet: x' = x + (x - xPrev) + f * w * dt^2.
   *
   * The (x - xPrev) term carries momentum implicitly, which is why this is
   * stable without ever storing a velocity, and why a constraint that teleports
   * a particle also changes its velocity as a side effect. That coupling is
   * what lets a contraction propagate outward as a wave instead of being
   * applied everywhere at once.
   */
  integrate(dt: number): void {
    const d2 = dt * dt;
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const f0 = this.accumulatedForces;
    const w0 = this.weights;

    for (let i = 0, il = this.count; i < il; i++) {
      const weight = w0[i]!;
      const ix = i * 3;

      for (let k = 0; k < 3; k++) {
        const j = ix + k;
        const pt = p0[j]!;
        p0[j] = pt + (pt - p1[j]!) + f0[j]! * weight * d2;
        p1[j] = pt;
      }
    }
  }

  /**
   * Relax constraints, in groups, in order: global, then local, then pin.
   *
   * DO NOT REORDER, and do not hoist the pin pass out of the iteration loop.
   * Ordering inside a Gauss-Seidel relaxation is not cosmetic — each group sees
   * the positions the previous group just wrote. Pins last, every iteration,
   * means an anchored particle is authoritative and the body resolves around
   * it. Run the groups in a different order and the same creature moves
   * differently.
   *
   * Two iterations is what the reference used for ~15,000 particles. It is not
   * enough to satisfy every constraint, and that is deliberate: the residual
   * error is the softness.
   */
  satisfyConstraints(): void {
    const global = this.globalConstraints;
    const local = this.localConstraints;
    const pins = this.pinConstraints;

    for (let i = 0; i < this.iterations; i++) {
      // Global constraints are applied per particle, not per relation.
      this.satisfyConstraintGroup(global, this.count, 3);
      this.satisfyConstraintGroup(local);
      if (pins.length) this.satisfyConstraintGroup(pins);
    }
  }

  private satisfyConstraintGroup(
    group: readonly Constraint[],
    count?: number,
    itemSize?: number,
  ): void {
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const perConstraint = count === undefined;

    for (let i = 0, il = group.length; i < il; i++) {
      const constraint = group[i]!;
      const n = perConstraint ? constraint.count : count;
      const stride = perConstraint ? constraint.itemSize : itemSize!;

      for (let j = 0; j < n; j++) {
        constraint.applyConstraint(j * stride, p0, p1);
      }
    }
  }

  /** One simulation step. */
  tick(dt: number): void {
    this.accumulateForces(dt);
    this.integrate(dt);
    this.satisfyConstraints();
  }

  // ..................................................
  // Measurement
  //

  /**
   * Weight-averaged centre of mass.
   *
   * Displacement must always be measured on this, never on a single particle.
   * A creature that tears a tentacle off will happily report that the tentacle
   * tip travelled a very long way.
   */
  centreOfMass(out: Float32Array): Float32Array {
    const p = this.positions;
    const w = this.weights;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let sw = 0;

    for (let i = 0, il = this.count; i < il; i++) {
      const wi = w[i]!;
      const ix = i * 3;
      sx += p[ix]! * wi;
      sy += p[ix + 1]! * wi;
      sz += p[ix + 2]! * wi;
      sw += wi;
    }

    const inv = sw > 0 ? 1 / sw : 0;
    out[0] = sx * inv;
    out[1] = sy * inv;
    out[2] = sz * inv;
    return out;
  }

  /** Largest per-particle speed this tick. Used to catch solver explosions. */
  maxSpeed(dt: number): number {
    if (dt <= 0) return 0;
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const inv = 1 / dt;
    let max = 0;

    for (let i = 0, il = this.count; i < il; i++) {
      const ix = i * 3;
      const dx = (p0[ix]! - p1[ix]!) * inv;
      const dy = (p0[ix + 1]! - p1[ix + 1]!) * inv;
      const dz = (p0[ix + 2]! - p1[ix + 2]!) * inv;
      const s2 = dx * dx + dy * dy + dz * dz;
      if (s2 > max) max = s2;
    }
    return Math.sqrt(max);
  }

  /**
   * Clamp every particle's implicit velocity.
   *
   * Verlet with slack constraints at two iterations can enter states that
   * inject energy rather than dissipate it, and a creature that has found one
   * will rocket away and report enormous fitness. Capping velocity by pulling
   * positionsPrev back toward positions is the cheapest way to make that
   * strategy unavailable.
   */
  clampVelocity(maxSpeed: number, dt: number): void {
    if (dt <= 0) return;
    const p0 = this.positions;
    const p1 = this.positionsPrev;
    const maxStep = maxSpeed * dt;
    const maxStep2 = maxStep * maxStep;

    for (let i = 0, il = this.count; i < il; i++) {
      const ix = i * 3;
      const dx = p0[ix]! - p1[ix]!;
      const dy = p0[ix + 1]! - p1[ix + 1]!;
      const dz = p0[ix + 2]! - p1[ix + 2]!;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= maxStep2) continue;

      const scale = maxStep / Math.sqrt(d2);
      p1[ix] = p0[ix]! - dx * scale;
      p1[ix + 1] = p0[ix + 1]! - dy * scale;
      p1[ix + 2] = p0[ix + 2]! - dz * scale;
    }
  }

  /** True if any coordinate has gone non-finite. */
  hasNaN(): boolean {
    const p = this.positions;
    for (let i = 0, il = p.length; i < il; i++) {
      if (!Number.isFinite(p[i]!)) return true;
    }
    return false;
  }
}
