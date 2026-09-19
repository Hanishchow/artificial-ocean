/**
 * Running one creature for one episode, headlessly.
 *
 * No Three.js, no DOM, no canvas — this package's tsconfig has neither the DOM
 * nor Node type libraries, so any accidental dependency on either fails to
 * compile rather than failing in CI six weeks later. That is what lets fitness
 * evaluation run on a GitHub runner at whatever scale the schedule allows.
 */

import type {
  AbortReason,
  EpisodeResult,
  Phenotype,
} from "@ocean/core-types";
import {
  BuoyancyForce,
  CavityJetForce,
  DirectionalForce,
  DistanceConstraint,
  FlowFieldForce,
  ParticleSystem,
  QuadraticDragForce,
} from "@ocean/solver";
import { DEFAULT_FOOD, FoodField, type FoodConfig } from "./food.js";
import { DEFAULT_WARMUP, Gait } from "./gait.js";

export interface EpisodeConfig {
  readonly seconds: number;
  readonly hz: number;
  readonly iterations: number;
  readonly gravity: readonly [number, number, number];
  readonly buoyancyRatio: number;
  /**
   * Density of the surrounding water, used by BOTH drag and the cavity jet.
   *
   * Deliberately one number. They were briefly two, which is physically
   * incoherent — there is one fluid — and the incoherence was hiding something
   * important: when both scale together the density CANCELS out of the
   * steady-state swimming speed, because thrust and drag both scale with it.
   * Speed is fixed by the ratio of drag area to aperture area and by the
   * kinematics, and by nothing a coefficient can reach. Two knobs made it look
   * tunable; one knob makes it obvious that it is not.
   */
  readonly waterDensity: number;
  /** Reverse thrust from the refill stroke, as a fraction of expulsion. */
  readonly refillEfficiency: number;
  readonly flowAmplitude: number;
  readonly gait: { readonly frequency: number; readonly duty: number; readonly warmupSeconds?: number };
  readonly guards: GuardConfig;
  readonly food: FoodConfig;
  readonly energy: EnergyConfig;
}

/**
 * What swimming costs and what eating is worth.
 *
 * The three numbers have to be the same order of magnitude as each other or the
 * objective degenerates into one of its terms: make food too valuable and the
 * cheapest strategy is to thrash indiscriminately, make upkeep too expensive
 * and the best animal is the smallest one that can still exist.
 */
export interface EnergyConfig {
  /** Energy per unit of muscle shortening. */
  readonly actuationCost: number;
  /** Multiplier on the phenotype's own basalCost, which scales with size. */
  readonly basalRate: number;
  /**
   * Energy in hand at birth.
   *
   * Has to be enough to survive the warm-up and find the first mouthful, or
   * every creature starves before its gait establishes and fitness measures
   * nothing but starting reserves.
   */
  readonly starting: number;
}

export interface GuardConfig {
  /** Hard cap on any particle's speed, in world units per second. */
  readonly maxSpeed: number;
  /** Abort if the centre of mass leaves a sphere of this radius. */
  readonly worldRadius: number;
  /** Abort if mean constraint violation exceeds this fraction of rest length. */
  readonly maxIntegrityDrift: number;
}

export const DEFAULT_GUARDS: GuardConfig = {
  /*
   * Verlet with slack constraints at two iterations can enter states that
   * inject energy instead of dissipating it, and a creature that finds one will
   * rocket away and report spectacular fitness. This is more likely, in
   * practice, than any biological failure: evolution is an excellent bug
   * finder and it is searching for exactly this.
   */
  maxSpeed: 120,
  worldRadius: 4000,
  maxIntegrityDrift: 0.6,
};

export const DEFAULT_EPISODE: Omit<EpisodeConfig, "gait"> = {
  seconds: 30,
  // 30 Hz, matching the reference's own step. Physics rate is independent of
  // any render rate; the renderer interpolates.
  hz: 30,
  iterations: 2,
  gravity: [0, -2, 0],
  buoyancyRatio: 1,
  // Matches the body's own density (total mass over cavity volume), i.e. a
  // neutrally buoyant animal in the water it displaces.
  waterDensity: 0.15,
  refillEfficiency: 0.2,
  flowAmplitude: 0.02,
  guards: DEFAULT_GUARDS,
  food: DEFAULT_FOOD,
  energy: {
    /*
     * Calibrated by measurement, and the first attempt was wrong in a way worth
     * recording. With upkeep at a tenth of this and forty energy in hand, the
     * `inert` seed -- a creature with amplitude zero, which cannot move at all
     * -- was the ONLY seed to survive thirty seconds, because doing nothing
     * cost it 1.4 energy and it started with 40. Every swimmer starved. The
     * objective was measuring starting reserves, not foraging.
     *
     * Upkeep now has to be paid continuously and the reserve is small, so an
     * animal that does not eat dies inside half a minute however still it lies.
     */
    actuationCost: 0.005,
    basalRate: 10,
    starting: 10,
  },
};

/** Assembled, tickable creature. Shared by the runner and (later) the renderer. */
export class Creature {
  readonly system: ParticleSystem;
  readonly gait: Gait;
  readonly phenotype: Phenotype;
  readonly flow: FlowFieldForce;
  private readonly distanceConstraints: DistanceConstraint[] = [];

  time = 0;

  /** Energy in hand. The episode ends when it runs out. */
  energy: number;
  energySpent = 0;
  energyGained = 0;
  private previousWork = 0;

  constructor(phenotype: Phenotype, cfg: EpisodeConfig) {
    this.energy = cfg.energy.starting;
    this.config = cfg;
    this.phenotype = phenotype;

    const system = new ParticleSystem(phenotype.positions, cfg.iterations);
    for (let i = 0; i < phenotype.particleCount; i++) {
      system.setWeight(i, phenotype.weights[i]!);
    }

    // One DistanceConstraint per group, indexed so the gait can find the ones
    // it drives without the constraint list knowing anything about gaits.
    const byGroup = new Map<number, DistanceConstraint>();
    for (const spec of phenotype.constraints) {
      if (spec.kind !== "distance") continue;
      const c = new DistanceConstraint(spec.min, spec.max, spec.indices);
      system.addConstraint(c);
      byGroup.set(spec.group, c);
      this.distanceConstraints.push(c);
    }

    const driven: DistanceConstraint[] = [];
    const specs = phenotype.actuators.filter((a) => {
      const c = byGroup.get(a.group);
      if (!c) return false;
      driven.push(c);
      return true;
    });

    system.addForce(
      new DirectionalForce(cfg.gravity[0], cfg.gravity[1], cfg.gravity[2]),
    );
    system.addForce(new BuoyancyForce(cfg.gravity, cfg.buoyancyRatio));
    system.addForce(
      new QuadraticDragForce(
        phenotype.dragArea,
        phenotype.weights,
        cfg.waterDensity,
        phenotype.dragNeighbours,
      ),
    );

    if (phenotype.cavity) {
      system.addForce(
        new CavityJetForce(
          phenotype.cavity,
          phenotype.weights,
          cfg.waterDensity,
          cfg.refillEfficiency,
        ),
      );
    }

    this.flow = new FlowFieldForce(cfg.flowAmplitude);
    system.addForce(this.flow);

    this.system = system;
    this.gait = new Gait(specs, driven, {
      frequency: cfg.gait.frequency,
      duty: cfg.gait.duty,
      warmupSeconds: cfg.gait.warmupSeconds ?? DEFAULT_WARMUP,
    });
  }

  private readonly config!: EpisodeConfig;

  step(dt: number): void {
    this.time += dt;
    this.flow.time = this.time;
    this.gait.update(this.time);
    this.system.tick(dt);
    this.spend(dt);
  }

  /**
   * Charge for the tick.
   *
   * Only muscle SHORTENING is charged; relaxation is elastic recoil and is
   * free. That is physically honest — a contracted bell springs back on stored
   * strain energy, which is exactly how a real medusa recovers — and it is what
   * gives the duty-cycle gene a real gradient instead of a flat one.
   *
   * Upkeep scales with particle count, which is the main brake on runaway body
   * size: every extra tentacle segment costs energy for the whole of the
   * animal's life, so length has to earn itself back.
   */
  private spend(dt: number): void {
    const work = this.gait.work;
    const delta = Math.max(0, work - this.previousWork);
    this.previousWork = work;

    const cost =
      delta * this.config.energy.actuationCost +
      this.phenotype.basalCost * this.config.energy.basalRate * dt;

    this.energySpent += cost;
    this.energy -= cost;
  }

  eat(amount: number): void {
    this.energy += amount;
    this.energyGained += amount;
  }

  /**
   * How badly the body is violating its own constraints, right now.
   *
   * Measured against each constraint's CURRENT bounds, not against the rest
   * length it was built with. That distinction is the difference between a
   * useful signal and a meaningless one: the gait rewrites actuated groups'
   * rest lengths every tick, so comparing against the original length reports
   * a contracting muscle as a tearing one. The first version of this did
   * exactly that and failed every creature it measured.
   *
   * Zero means every pair is inside its allowed band. A body that has quietly
   * torn itself apart still reports a centre of mass, and that centre of mass
   * may have travelled a long way, so this is how swimming is told apart from
   * disintegrating.
   */
  integrity(): number {
    const p = this.system.positions;
    let total = 0;
    let n = 0;

    for (const con of this.distanceConstraints) {
      const lo = con.currentMin;
      const hi = con.currentMax;
      if (hi <= 0) continue;
      const idx = con.indices;

      for (let i = 0; i + 1 < idx.length; i += 2) {
        const a = idx[i]! * 3;
        const b = idx[i + 1]! * 3;
        const dx = p[b]! - p[a]!;
        const dy = p[b + 1]! - p[a + 1]!;
        const dz = p[b + 2]! - p[a + 2]!;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Distance outside the band, in units of the band's upper bound.
        const excess = d > hi ? d - hi : d < lo ? lo - d : 0;
        total += excess / hi;
        n++;
      }
    }
    return n > 0 ? total / n : 0;
  }
}

/**
 * Run one creature alone, in its own box, and report how it moved.
 *
 * Alone is deliberate. A shared tank makes fitness depend on who else is in it,
 * which destroys reproducibility, makes the landscape non-stationary, and makes
 * parallel evaluation impossible. The exhibit can show a crowd; the crowd is
 * not what anything is scored on.
 */
export function runEpisode(
  phenotype: Phenotype,
  cfg: EpisodeConfig,
): EpisodeResult {
  const dt = 1 / cfg.hz;
  const ticks = Math.max(1, Math.round(cfg.seconds * cfg.hz));

  const creature = new Creature(phenotype, cfg);
  const startIntegrity = creature.integrity();

  const food = new FoodField(
    cfg.food,
    phenotype.genomeId,
    phenotype.captureSites.length,
    phenotype.captureRadius,
  );
  const flowScratch = new Float32Array(3);

  const trajectory = new Float32Array(ticks * 3);
  const com = new Float32Array(3);
  const start = new Float32Array(3);
  creature.system.centreOfMass(start);

  let abort: AbortReason | undefined;
  let survived = 0;
  let pathLength = 0;
  let prevX = start[0]!;
  let prevY = start[1]!;
  let prevZ = start[2]!;

  for (let t = 0; t < ticks; t++) {
    creature.step(dt);
    creature.system.clampVelocity(cfg.guards.maxSpeed, dt);

    if (creature.system.hasNaN()) {
      abort = "nan";
      break;
    }

    creature.system.centreOfMass(com);

    food.update(creature.flow, dt, com[0]!, com[1]!, com[2]!, flowScratch);
    creature.eat(
      food.harvest(
        phenotype.captureSites,
        creature.system.positions,
        phenotype.captureRadius,
        dt,
      ),
    );

    // Starvation is not only a rule, it is a large speedup: a hopeless animal
    // dies in the first few seconds instead of being simulated for thirty.
    if (creature.energy <= 0) {
      abort = "starved";
      survived = t + 1;
      break;
    }
    const x = com[0]!;
    const y = com[1]!;
    const z = com[2]!;

    trajectory[t * 3] = x;
    trajectory[t * 3 + 1] = y;
    trajectory[t * 3 + 2] = z;
    survived = t + 1;

    if (x * x + y * y + z * z > cfg.guards.worldRadius ** 2) {
      abort = "exploded";
      break;
    }

    const dx = x - prevX;
    const dy = y - prevY;
    const dz = z - prevZ;
    pathLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
    prevX = x;
    prevY = y;
    prevZ = z;
  }

  const endIntegrity = creature.integrity();
  const integrityDrift = Math.max(0, endIntegrity - startIntegrity);
  if (!abort && integrityDrift > cfg.guards.maxIntegrityDrift) {
    abort = "stalled";
  }

  const elapsed = survived * dt;
  // Net displacement, not path length: a creature going in circles has covered
  // ground but got nowhere, and "got somewhere" is what is being selected.
  const dx = prevX - start[0]!;
  const dy = prevY - start[1]!;
  const dz = prevZ - start[2]!;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Body lengths per second, so a small animal and a large one are comparable
  // and "evolve to be enormous" is not a strategy.
  const bodyLength = Math.max(0.001, phenotype.bounds.height);

  return {
    genomeId: phenotype.genomeId,
    metrics: {
      distance,
      pathLength,
      meanSpeed: elapsed > 0 ? pathLength / elapsed : 0,
      bodyLengthsPerSecond: elapsed > 0 ? distance / bodyLength / elapsed : 0,
      ticksSurvived: survived,
      workDone: creature.gait.work,
      netEnergy: creature.energyGained - creature.energySpent,
      captures: food.captured,
      energySpent: creature.energySpent,
      integrityDrift,
    },
    ...(abort ? { abort } : {}),
    trajectory: trajectory.subarray(0, survived * 3),
  };
}
