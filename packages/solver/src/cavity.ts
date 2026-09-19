/**
 * The bell as a pump.
 *
 * This is the physics that was missing, and its absence was measured rather
 * than guessed: with drag alone — even anisotropic drag — the best creature
 * managed 0.019 body-lengths per second against a 0.5 target, while the
 * deliberately-broken control scored bottom exactly as theory predicts. The
 * model was discriminating correctly and producing almost no thrust, which is
 * the signature of a missing mechanism rather than a broken one.
 *
 * The mechanism is this. A medusa does not row. It encloses a volume of water
 * under its bell, squeezes it out through the margin, and rides the reaction.
 * Thrust comes from the momentum of the ejected jet, not from the bell surface
 * pushing on the water. Particulate has no volume or pressure constraint and
 * nothing in the original jellyfish needed one, because the original never
 * moved.
 *
 * Momentum flux through an aperture of area A, with fluid leaving at speed u:
 *
 *     u = (dV/dt) / A          the exit speed the volume change implies
 *     F = rho * A * u^2        the reaction on the animal
 *       = rho * (dV/dt)^2 / A
 *
 * The square is what keeps the duty-cycle gene meaningful: a fast squeeze and a
 * slow refill move the same volume, but the fast one carries far more momentum.
 */

import type { Force } from "./forces.js";

export interface CavityGeometry {
  /** First particle index of each ring, apex-first. */
  readonly rings: Uint32Array;
  readonly ringSize: number;
  readonly apex: number;
}

export class CavityJetForce implements Force {
  private readonly rings: Uint32Array;
  private readonly ringSize: number;
  private readonly apex: number;
  private readonly density: number;
  private readonly refillEfficiency: number;

  /** Particles the reaction is shared across, and their total mass. */
  private readonly bodyCount: number;
  private readonly weights: Float32Array;
  private readonly totalMass: number;

  private previousVolume = -1;
  /** Acceleration to apply to every particle this tick. */
  private ax = 0;
  private ay = 0;
  private az = 0;

  /** Last measured cavity volume, for diagnostics. */
  volume = 0;
  /** Last thrust magnitude, for diagnostics. */
  thrust = 0;

  constructor(
    geometry: CavityGeometry,
    weights: Float32Array,
    density = 1,
    /**
     * How much reverse thrust the refill stroke produces, as a fraction of what
     * the same volume rate would produce on the way out.
     *
     * NOT a fudge factor, though it is the one number here most likely to be
     * mistaken for one. Expulsion is a coherent jet: the water leaves through
     * the aperture in one direction and carries real momentum. Refilling draws
     * water in from every direction at once, so the inflow momentum largely
     * cancels itself and very little of it reaches the animal. It is the same
     * asymmetry that lets a vacuum cleaner blow across a room but only suck
     * from an inch away, and it is a large part of why jet propulsion works at
     * all.
     *
     * It is deliberately not zero. Setting it to zero would hand every creature
     * free thrust with no recovery cost, and evolution would immediately find
     * that and optimise a gait that is physically impossible.
     */
    refillEfficiency = 0.2,
  ) {
    this.rings = geometry.rings;
    this.ringSize = geometry.ringSize;
    this.apex = geometry.apex;
    this.density = density;
    this.refillEfficiency = refillEfficiency;
    this.weights = weights;
    this.bodyCount = weights.length;

    let m = 0;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i]!;
      if (w > 0) m += 1 / w;
    }
    this.totalMass = m;
  }

  /**
   * Volume of the cavity, as a stack of truncated cones.
   *
   * Each band between consecutive rings contributes a frustum of height h and
   * end radii r1, r2. Exact for a body of revolution, and these bodies are
   * bodies of revolution to within the twist applied for symmetry breaking.
   * The alternative — a divergence-theorem sum over every surface triangle — is
   * more general and costs an order of magnitude more per tick, for a number
   * that only feeds a squared difference.
   */
  private measure(
    p0: Float32Array,
    centre: Float32Array,
    axis: Float32Array,
  ): { volume: number; aperture: number } {
    const rings = this.rings;
    const n = rings.length;
    const size = this.ringSize;

    let volume = 0;
    let prevR = 0;
    let prevY = 0;
    let marginR = 0;

    // Apex first: the cap above the topmost ring.
    const apexIx = this.apex * 3;
    let apexX = p0[apexIx]!;
    let apexY = p0[apexIx + 1]!;
    let apexZ = p0[apexIx + 2]!;

    let marginX = 0;
    let marginY = 0;
    let marginZ = 0;

    for (let r = 0; r < n; r++) {
      const start = rings[r]!;
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let j = 0; j < size; j++) {
        const ix = (start + j) * 3;
        cx += p0[ix]!;
        cy += p0[ix + 1]!;
        cz += p0[ix + 2]!;
      }
      cx /= size;
      cy /= size;
      cz /= size;

      let radius = 0;
      for (let j = 0; j < size; j++) {
        const ix = (start + j) * 3;
        const dx = p0[ix]! - cx;
        const dy = p0[ix + 1]! - cy;
        const dz = p0[ix + 2]! - cz;
        radius += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      radius /= size;

      // Height along the bell's own axis, not the world's: a tilted animal
      // still has the same cavity.
      const h = Math.abs(cy - prevY);
      if (r === 0) {
        // Apex cap: cone from the apex point down to the first ring.
        const capH = Math.abs(apexY - cy);
        volume += (Math.PI / 3) * radius * radius * capH;
      } else {
        volume +=
          (Math.PI / 3) * h * (prevR * prevR + prevR * radius + radius * radius);
      }

      prevR = radius;
      prevY = cy;

      if (r === n - 1) {
        marginR = radius;
        marginX = cx;
        marginY = cy;
        marginZ = cz;
      }
    }

    // The bell's axis: margin toward apex. Expelled water goes the other way,
    // so this is the thrust direction.
    let axX = apexX - marginX;
    let axY = apexY - marginY;
    let axZ = apexZ - marginZ;
    const len = Math.sqrt(axX * axX + axY * axY + axZ * axZ);
    if (len > 1e-9) {
      axX /= len;
      axY /= len;
      axZ /= len;
    } else {
      axX = 0;
      axY = 1;
      axZ = 0;
    }
    axis[0] = axX;
    axis[1] = axY;
    axis[2] = axZ;

    centre[0] = marginX;
    centre[1] = marginY;
    centre[2] = marginZ;

    void apexX;
    void apexZ;
    void marginZ;

    return { volume, aperture: Math.PI * marginR * marginR };
  }

  private readonly centre = new Float32Array(3);
  private readonly axis = new Float32Array(3);

  prepare(p0: Float32Array, _p1: Float32Array, dt: number): void {
    const { volume, aperture } = this.measure(p0, this.centre, this.axis);
    this.volume = volume;

    if (this.previousVolume < 0 || dt <= 0 || aperture <= 1e-6) {
      this.previousVolume = volume;
      this.ax = this.ay = this.az = 0;
      this.thrust = 0;
      return;
    }

    const dVdt = (volume - this.previousVolume) / dt;
    this.previousVolume = volume;

    // Shrinking cavity: water leaves, animal is pushed along +axis.
    // Growing cavity: water enters, weakly pulling it the other way.
    const expelling = dVdt < 0;
    const efficiency = expelling ? 1 : this.refillEfficiency;
    const magnitude = (this.density * dVdt * dVdt * efficiency) / aperture;
    const sign = expelling ? 1 : -1;

    this.thrust = magnitude * sign;

    // Distribute as a uniform acceleration rather than a uniform force. A
    // uniform force would push light particles further than heavy ones and
    // tear the animal apart; the jet acts on the body as a whole.
    const a = this.totalMass > 0 ? (magnitude * sign) / this.totalMass : 0;
    this.ax = this.axis[0]! * a;
    this.ay = this.axis[1]! * a;
    this.az = this.axis[2]! * a;
  }

  applyForce(ix: number, f0: Float32Array): void {
    const i = ix / 3;
    if (i >= this.bodyCount) return;
    const w = this.weights[i]!;
    if (w <= 0) return;

    // f = a / w, so that a_i = f * w is the same for every particle.
    const inv = 1 / w;
    f0[ix]! += this.ax * inv;
    f0[ix + 1]! += this.ay * inv;
    f0[ix + 2]! += this.az * inv;
  }
}
