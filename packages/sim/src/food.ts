/**
 * Drifting food, and catching it.
 *
 * The design problem this file exists to solve is the sit-still optimum. If
 * food simply arrives, the best animal is a motionless bag with the largest
 * possible surface, and the ocean becomes a tank of inert sacks that score
 * beautifully. Penalising stillness by hand would work and would be arbitrary.
 *
 * Instead: FOOD DRIFTS ON THE SAME CURRENT THE CREATURE DOES. A passive animal
 * is carried along with its dinner at the same speed, its velocity relative to
 * the food is nearly zero, and it catches nothing. Energy becomes obtainable
 * only by moving relative to the water — which is true of real filter feeders,
 * and removes the degenerate strategy by construction rather than by penalty.
 */

import { type Rng, rngFromSeed } from "@ocean/mathx";
import type { FlowFieldForce } from "@ocean/solver";

export interface FoodConfig {
  readonly count: number;
  /** Side length of the box around the creature that holds the food. */
  readonly boxSize: number;
  /** Energy gained per item. */
  readonly value: number;
  /**
   * Seconds a capture site is occupied after catching something.
   *
   * This is Holling's handling time, and it is what stops the tentacle rake.
   * Without it, capture rate grows linearly with capture sites forever, so the
   * winning strategy is to grow as many tentacle segments as the particle
   * budget allows and drag them through the water. With it, N sites can catch
   * at most N/handlingTime items per second however much water they sweep, so
   * the five hundredth tentacle adds almost nothing while still costing upkeep
   * every tick of the animal's life.
   */
  readonly handlingTime: number;
}

export const DEFAULT_FOOD: FoodConfig = {
  /*
   * DENSITY is what matters here, not count; the box only has to stay
   * comfortably larger than the animals so none of them is sweeping the whole
   * world at once.
   *
   * Set by measurement, over two attempts. At 900 items in a 260-unit box the
   * seeds caught between 0 and 4 things in thirty seconds and all of them
   * starved, which measures starting reserves rather than foraging; tripling
   * the density got that to 15. These numbers are about eight times denser
   * again, which puts a competent swimmer near break-even -- the point where
   * the gradient is steepest and small improvements in foraging actually show
   * up in fitness.
   */
  count: 3000,
  boxSize: 120,
  value: 1,
  handlingTime: 0.5,
};

/**
 * A cloud of food that follows the creature.
 *
 * The box is periodic and re-centres on the creature every tick, which models
 * an ocean of uniform food density without simulating an ocean. An item that
 * falls out of one face reappears at the opposite one, so the count and the
 * density are both exactly constant and two creatures are always compared
 * against the same abundance.
 */
export class FoodField {
  readonly positions: Float32Array;
  readonly count: number;

  private readonly cfg: FoodConfig;
  private readonly rng: Rng;

  /** Uniform grid, rebuilt each tick. Cells hold food indices. */
  private readonly cellSize: number;
  private readonly grid = new Map<number, number[]>();

  /** Seconds remaining before each capture site can catch again. */
  private readonly cooldown: Float32Array;

  private centreX = 0;
  private centreY = 0;
  private centreZ = 0;

  captured = 0;

  constructor(cfg: FoodConfig, seed: string, siteCount: number, captureRadius: number) {
    this.cfg = cfg;
    this.count = cfg.count;
    this.rng = rngFromSeed(`food:${seed}`);
    this.positions = new Float32Array(cfg.count * 3);
    this.cooldown = new Float32Array(siteCount);

    // A cell the size of the capture radius means a site only ever has to look
    // at the 27 cells around it. Smaller cells mean more cells to visit; larger
    // ones mean more candidates per cell.
    this.cellSize = Math.max(0.5, captureRadius);

    const half = cfg.boxSize * 0.5;
    for (let i = 0; i < cfg.count; i++) {
      this.positions[i * 3] = (this.rng() - 0.5) * 2 * half;
      this.positions[i * 3 + 1] = (this.rng() - 0.5) * 2 * half;
      this.positions[i * 3 + 2] = (this.rng() - 0.5) * 2 * half;
    }
  }

  private key(x: number, y: number, z: number): number {
    // Cantor-ish mix of three cell coordinates into one integer key. Collisions
    // only cost a few extra distance checks, so a cheap hash beats a perfect one.
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return (cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791);
  }

  /** Advect on the current, re-centre on the creature, rebuild the index. */
  update(
    flow: FlowFieldForce,
    dt: number,
    comX: number,
    comY: number,
    comZ: number,
    scratch: Float32Array,
  ): void {
    this.centreX = comX;
    this.centreY = comY;
    this.centreZ = comZ;

    const half = this.cfg.boxSize * 0.5;
    const p = this.positions;

    this.grid.clear();

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3;

      // The same field the creature swims in. This is the whole mechanism.
      flow.sample(p[ix]!, p[ix + 1]!, p[ix + 2]!, scratch);
      p[ix]! += scratch[0]! * dt;
      p[ix + 1]! += scratch[1]! * dt;
      p[ix + 2]! += scratch[2]! * dt;

      // Wrap into the box around the creature.
      let dx = p[ix]! - comX;
      let dy = p[ix + 1]! - comY;
      let dz = p[ix + 2]! - comZ;
      if (dx > half) dx -= 2 * half;
      else if (dx < -half) dx += 2 * half;
      if (dy > half) dy -= 2 * half;
      else if (dy < -half) dy += 2 * half;
      if (dz > half) dz -= 2 * half;
      else if (dz < -half) dz += 2 * half;
      p[ix] = comX + dx;
      p[ix + 1] = comY + dy;
      p[ix + 2] = comZ + dz;

      const k = this.key(p[ix]!, p[ix + 1]!, p[ix + 2]!);
      const bucket = this.grid.get(k);
      if (bucket) bucket.push(i);
      else this.grid.set(k, [i]);
    }
  }

  /**
   * Let every ready capture site eat whatever is within reach.
   * Returns the energy gained this tick.
   */
  harvest(
    sites: Uint32Array,
    positions: Float32Array,
    radius: number,
    dt: number,
  ): number {
    const r2 = radius * radius;
    const p = this.positions;
    const half = this.cfg.boxSize * 0.5;
    let gained = 0;

    for (let s = 0; s < sites.length; s++) {
      if (this.cooldown[s]! > 0) {
        this.cooldown[s]! -= dt;
        continue;
      }

      const px = positions[sites[s]! * 3]!;
      const py = positions[sites[s]! * 3 + 1]!;
      const pz = positions[sites[s]! * 3 + 2]!;

      let eaten = -1;

      // The 27 cells around this site.
      outer: for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const bucket = this.grid.get(
              this.key(
                px + ox * this.cellSize,
                py + oy * this.cellSize,
                pz + oz * this.cellSize,
              ),
            );
            if (!bucket) continue;

            for (let b = 0; b < bucket.length; b++) {
              const f = bucket[b]!;
              const fx = p[f * 3]! - px;
              const fy = p[f * 3 + 1]! - py;
              const fz = p[f * 3 + 2]! - pz;
              if (fx * fx + fy * fy + fz * fz <= r2) {
                eaten = f;
                break outer;
              }
            }
          }
        }
      }

      if (eaten >= 0) {
        // Respawn on the far side rather than deleting, so density stays
        // constant and a long episode is not easier than a short one.
        const ix = eaten * 3;
        p[ix] = this.centreX + (this.rng() - 0.5) * 2 * half;
        p[ix + 1] = this.centreY + (this.rng() - 0.5) * 2 * half;
        p[ix + 2] = this.centreZ + (this.rng() - 0.5) * 2 * half;

        this.cooldown[s] = this.cfg.handlingTime;
        this.captured++;
        gained += this.cfg.value;
      }
    }

    return gained;
  }
}
