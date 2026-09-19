/**
 * The simulation, compiled for the browser.
 *
 * This is the whole payoff of keeping every package free of DOM and Node types.
 * Because `morphogen`, `solver` and `sim` are pure TypeScript that touches
 * nothing but numbers, the exact code that evaluated a creature on the runner
 * bundles and runs unchanged in a web page.
 *
 * What that buys is not tidiness, it is bandwidth. A creature travels to the
 * browser as its genome — about 200 bytes — and is GROWN on arrival. Shipping
 * meshes instead would mean megabytes per animal, and a page showing forty of
 * them would be impossible. This file exists so the page can hold a whole
 * archive and simulate any of it on demand.
 *
 * Bundled to an IIFE exposing `window.Ocean`; see `pnpm build:engine`.
 */

import {
  type Genome,
  SEEDS,
  decode,
  deserialiseGenes,
  fromTraits,
} from "@ocean/genome";
import {
  DISPLAY_OPTIONS,
  EVAL_OPTIONS,
  develop,
  type DevelopResult,
} from "@ocean/morphogen";
import {
  Creature,
  DEFAULT_EPISODE,
  describe,
  fitnessOf,
  runEpisode,
} from "@ocean/sim";
import type { EpisodeConfig } from "@ocean/sim";
import type { Phenotype } from "@ocean/core-types";

export interface LiveOptions {
  /** Particle ceiling. The page picks this from the screen it is running on. */
  readonly maxParticles?: number;
  /** Ambient current. Zero holds a specimen still for inspection. */
  readonly flowAmplitude?: number;
}

/**
 * A creature the page can drive: developed, assembled, and ready to tick.
 *
 * The position buffer is handed out directly rather than copied. Three.js can
 * wrap it as a BufferAttribute, so the solver writes into the same memory the
 * GPU reads — the trick the original simulation used, and the reason a
 * thousand-particle body costs nothing per frame beyond the solve itself.
 */
export class LiveCreature {
  readonly creature: Creature;
  readonly phenotype: Phenotype;
  readonly genome: Genome;
  readonly config: EpisodeConfig;

  constructor(genome: Genome, opts: LiveOptions = {}) {
    const traits = decode(genome);
    const budget = opts.maxParticles ?? DISPLAY_OPTIONS.maxParticles;

    /*
     * Try the fine mesh, fall back to the coarse one.
     *
     * Display resolution doubles mesh density, so a creature whose bell alone
     * needs 1,500 particles at display resolution cannot be built inside a
     * small budget AT ALL -- development is right to refuse, because silently
     * shrinking the bell would mean showing an animal the genome does not
     * describe. Retrying at evaluation resolution changes the MESH and not the
     * creature, which is exactly the distinction the resolution parameter
     * exists to draw.
     *
     * This mattered immediately: a phone-sized budget made every creature in
     * the archive unbuildable, and the tank rendered empty.
     */
    let dev = develop(genome, { ...DISPLAY_OPTIONS, maxParticles: budget });
    if (!dev.ok && dev.reason === "particle-budget") {
      dev = develop(genome, { ...EVAL_OPTIONS, maxParticles: budget });
    }
    if (!dev.ok) {
      throw new Error(`cannot develop ${genome.id}: ${dev.reason} ${dev.detail}`);
    }

    this.genome = genome;
    this.phenotype = dev.phenotype;
    this.config = {
      ...DEFAULT_EPISODE,
      flowAmplitude: opts.flowAmplitude ?? DEFAULT_EPISODE.flowAmplitude,
      gait: { frequency: traits["pulseFreq"]!, duty: traits["pulseDuty"]! },
    };
    this.creature = new Creature(this.phenotype, this.config);
  }

  get positions(): Float32Array {
    return this.creature.system.positions;
  }

  get particleCount(): number {
    return this.phenotype.particleCount;
  }

  /**
   * Advance by `seconds` of simulated time.
   *
   * The physics step is fixed at the config's rate regardless of the display's
   * frame rate, and leftover time is carried rather than dropped. A variable
   * step would make the same creature behave differently on a 60 Hz screen and
   * a 144 Hz one, which is both wrong and very hard to notice.
   */
  private carry = 0;

  advance(seconds: number): void {
    const dt = 1 / this.config.hz;
    this.carry += Math.min(0.25, seconds);
    let guard = 0;
    while (this.carry >= dt && guard++ < 8) {
      this.carry -= dt;
      this.creature.step(dt);
      this.creature.system.clampVelocity(this.config.guards.maxSpeed, dt);
    }
  }

  /** Where the animal is, for the camera to follow. */
  centre(out: Float32Array): Float32Array {
    return this.creature.system.centreOfMass(out);
  }

  get energy(): number {
    return this.creature.energy;
  }
}

/** Grow a creature from a stored gene vector. */
export function creatureFromGenes(
  genes: number[] | string,
  opts: LiveOptions = {},
): LiveCreature {
  const genome =
    typeof genes === "string"
      ? deserialiseGenes(genes)
      : deserialiseGenes(genes.join(","));
  return new LiveCreature(genome, opts);
}

/** Score a stored genome exactly as the runner would. Used for the detail panel. */
export function evaluateGenes(genes: number[]): {
  fitness: number;
  behaviour: number[];
  captures: number;
  netEnergy: number;
  speed: number;
  abort?: string;
} | null {
  const genome = deserialiseGenes(genes.join(","));
  const traits = decode(genome);
  const dev: DevelopResult = develop(genome, EVAL_OPTIONS);
  if (!dev.ok) return null;

  const result = runEpisode(dev.phenotype, {
    ...DEFAULT_EPISODE,
    seconds: 20,
    gait: { frequency: traits["pulseFreq"]!, duty: traits["pulseDuty"]! },
  });

  return {
    fitness: fitnessOf(result),
    behaviour: describe(dev.phenotype, result),
    captures: result.metrics.captures,
    netEnergy: result.metrics.netEnergy,
    speed: result.metrics.bodyLengthsPerSecond,
    ...(result.abort ? { abort: result.abort } : {}),
  };
}

export {
  SEEDS,
  decode,
  deserialiseGenes,
  fromTraits,
  develop,
  EVAL_OPTIONS,
  DISPLAY_OPTIONS,
};
export type { Genome, Phenotype };
