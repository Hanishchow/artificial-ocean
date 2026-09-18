/**
 * The gait controller.
 *
 * This is the generalisation of the reference's `updateRibs`
 * (app.develop.js:1943-1968), which walked a hardcoded array of ribs and
 * rewrote three constraints named `outer`, `inner` and `spine` from a sine
 * phase. That works and looks right; it just cannot be varied, because the
 * ribs, the names and the scaling are all written into the source.
 *
 * Here the controller knows nothing about bells. It walks a table of
 * ActuatorSpecs and rewrites each group's rest length. Whether that produces a
 * pulse, a peristaltic wave or an unhelpful twitch is decided by the genome.
 */

import type { ActuatorSpec } from "@ocean/core-types";
import type { DistanceConstraint } from "@ocean/solver";
import { PI, TAU, cos } from "@ocean/mathx";

export interface GaitConfig {
  /** Contractions per second. */
  readonly frequency: number;
  /** Fraction of each cycle spent contracting. */
  readonly duty: number;
  /**
   * Seconds spent easing the stroke in from zero.
   *
   * Not cosmetic. Each rib is driven at its own phase offset, so at t=0 a rib
   * partway along the wave is already most of the way through a contraction —
   * one measured at 84%. The body is built in its RELAXED pose, so without a
   * ramp the first tick asks a hoop to shorten by a third instantaneously. In a
   * Verlet system an instantaneous position change IS an impulse: peak particle
   * speed hit 40 units/sec on tick one, the mesh tore, and the creature spent
   * the episode as a twitching knot. Easing the amplitude in over a second or
   * so lets the wave establish itself without the shock.
   */
  readonly warmupSeconds: number;
}

export const DEFAULT_WARMUP = 1.5;

/**
 * Contraction amount in [0, 1] at cycle position u, for a given duty cycle.
 *
 * THE ASYMMETRY IS THE POINT. With duty 0.2 the animal contracts in a fifth of
 * the cycle and takes the other four fifths to relax. Because drag goes as
 * velocity SQUARED, the fast stroke pushes roughly sixteen times harder than
 * the slow one resists, and the difference is thrust.
 *
 * Set duty to 0.5 and the stroke is time-symmetric: the animal squeezes and
 * unsqueezes at the same speed, the two impulses cancel, and it stays exactly
 * where it started no matter how vigorously it flaps. That is Purcell's scallop
 * theorem, and it is the most likely reason for a population that pulses
 * beautifully and goes nowhere.
 *
 * Both halves are raised cosines so that velocity is continuous at the turning
 * points. A triangular ramp would have a discontinuous velocity, and in a
 * Verlet system a discontinuous velocity is an impulse — which the solver
 * happily converts into free energy.
 */
export function contractionAt(u: number, duty: number): number {
  const d = duty <= 0 ? 0.001 : duty >= 1 ? 0.999 : duty;
  let t = u % 1;
  if (t < 0) t += 1;

  if (t < d) {
    // Contracting: 0 -> 1
    return 0.5 - 0.5 * cos(PI * (t / d));
  }
  // Relaxing: 1 -> 0
  return 0.5 + 0.5 * cos(PI * ((t - d) / (1 - d)));
}

export class Gait {
  private readonly specs: readonly ActuatorSpec[];
  private readonly constraints: readonly DistanceConstraint[];
  private readonly config: GaitConfig;

  /** Contraction of each actuator on the previous tick, for the M2 work term. */
  private readonly previous: Float64Array;

  /** Total shortening performed so far, in length units summed over pairs. */
  work = 0;

  constructor(
    specs: readonly ActuatorSpec[],
    constraints: readonly DistanceConstraint[],
    config: GaitConfig,
  ) {
    if (specs.length !== constraints.length) {
      throw new Error("every actuator needs exactly one constraint");
    }
    this.specs = specs;
    this.constraints = constraints;
    this.config = config;
    this.previous = new Float64Array(specs.length);
  }

  /** Rewrite every actuated group's rest length for absolute time `time`. */
  update(time: number): void {
    const { frequency, duty, warmupSeconds } = this.config;

    // Smoothstep rather than a linear ramp, so the ramp's own derivative is
    // continuous too and switching it off at the end is not itself a kick.
    const w =
      warmupSeconds > 0 ? Math.min(1, time / warmupSeconds) : 1;
    const ease = w * w * (3 - 2 * w);

    for (let i = 0; i < this.specs.length; i++) {
      const spec = this.specs[i]!;
      // phaseOffset is in radians; the cycle position is a turn fraction.
      const u = time * frequency + spec.phaseOffset / TAU;
      const a = contractionAt(u, duty) * ease;

      const max = spec.restLength * (1 - spec.amplitude * a);
      this.constraints[i]!.setDistance(max * spec.slack, max);

      // Only shortening costs energy. Relaxation is elastic recoil and is free,
      // which is both physically honest and gives the duty-cycle gene a real
      // gradient to climb.
      const delta = a - this.previous[i]!;
      if (delta > 0) {
        this.work += delta * spec.amplitude * spec.restLength * spec.pairCount;
      }
      this.previous[i] = a;
    }
  }
}
