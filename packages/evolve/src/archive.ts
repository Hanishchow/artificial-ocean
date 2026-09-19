/**
 * MAP-Elites: an archive of the best creature found for each KIND of creature.
 *
 * The usual thing is a tournament: keep the fittest N, breed them, repeat. It
 * converges, and for this project converging is failure. A tank containing
 * forty copies of the same optimal animal is a worse exhibit than a tank of
 * mediocre variety, however healthy the fitness curve looks.
 *
 * MAP-Elites instead carves behaviour space into a grid and keeps the best
 * genome found in each cell. A fast wide creature does not compete with a slow
 * narrow one; they occupy different cells and both survive. Three properties
 * follow, and all three matter here:
 *
 *   - The archive IS the exhibit. There is no separate step that picks a
 *     varied-looking subset; variety is what the algorithm maintains.
 *   - It is resumable from stored state, which is what an hourly cron needs.
 *   - Every evaluation is independent, so it parallelises without coordination.
 *
 * Two of the four dimensions are MEASURED OUTCOMES rather than genes. That is
 * what makes this search rather than a parameter sweep: a creature is filed by
 * how it actually behaved, not by what its genome asked for.
 */

import type { Genome } from "@ocean/genome";

export interface BehaviourDimension {
  readonly key: string;
  readonly min: number;
  readonly max: number;
  readonly bins: number;
}

/**
 * The grid.
 *
 * Chosen partly for VISUAL variety, not only for functional variety. Shape and
 * size are what a viewer notices about a creature standing still; speed and
 * efficiency are what they notice about how it lives. A grid over, say, rib
 * count and slack ratio would be just as valid evolutionarily and would produce
 * a gallery of animals that all look the same.
 */
export const DIMENSIONS: readonly BehaviourDimension[] = [
  /**
   * Tall and narrow through to wide and flat.
   *
   * The range was 0.15 to 4 and creatures reached 6.2, so the top bin was a
   * dumping ground rather than a class. Ranges here have to cover what the
   * search actually produces, or clamping quietly merges distinct animals.
   */
  { key: "aspect", min: 0.15, max: 6.5, bins: 8 },
  /** Bell radius, so a grid cell is a size class as well as a shape. */
  { key: "size", min: 4, max: 23, bins: 6 },
  /** Measured, not asked for: body lengths per second actually achieved. */
  { key: "speed", min: 0, max: 1.5, bins: 6 },
  /*
   * Energy earned per unit spent.
   *
   * This replaces a straightness dimension -- net displacement over path
   * length -- that measured almost nothing. 113 of 122 archived creatures sat
   * in its top bin, so it multiplied the grid by four and the variety by about
   * 1.07, and the real coverage was hidden behind three empty bins.
   *
   * In hindsight it could not have worked: nothing in the body plan can steer,
   * so every creature swims in a straight line and straightness is very nearly
   * a constant. A dimension has to measure something the animals can actually
   * differ in.
   *
   * Efficiency can. It separates a big showy swimmer that eats a lot and burns
   * a lot from a frugal one that barely moves and barely needs to, and both
   * are worth having in the tank.
   */
  { key: "efficiency", min: 0, max: 3, bins: 4 },
];

export const CELL_COUNT = DIMENSIONS.reduce((n, d) => n * d.bins, 1);

/** Behaviour vector to a stable cell key, e.g. "3.2.5.1". */
export function cellKey(behaviour: ArrayLike<number>): string {
  const parts: number[] = [];
  for (let i = 0; i < DIMENSIONS.length; i++) {
    const d = DIMENSIONS[i]!;
    const v = behaviour[i] ?? d.min;
    const t = (v - d.min) / (d.max - d.min);
    // Clamp rather than reject: a creature slightly outside the expected range
    // is still a creature, and it belongs in the nearest cell.
    const bin = Math.min(d.bins - 1, Math.max(0, Math.floor(t * d.bins)));
    parts.push(bin);
  }
  return parts.join(".");
}

export interface Elite {
  readonly genome: Genome;
  readonly fitness: number;
  readonly behaviour: readonly number[];
  readonly generation: number;
}

export class Archive {
  private readonly cells = new Map<string, Elite>();

  get size(): number {
    return this.cells.size;
  }

  /** Fraction of the grid that has been reached at all. */
  get coverage(): number {
    return this.cells.size / CELL_COUNT;
  }

  get(key: string): Elite | undefined {
    return this.cells.get(key);
  }

  entries(): Array<[string, Elite]> {
    return [...this.cells.entries()];
  }

  elites(): Elite[] {
    return [...this.cells.values()];
  }

  /**
   * File a creature. Returns how it fared, for the generation log.
   *
   * "discovered" and "improved" are counted separately because they mean very
   * different things about a run's health: discoveries mean the search is still
   * finding new kinds of animal, improvements mean it is refining the ones it
   * has. A run producing only improvements has stopped exploring.
   */
  insert(elite: Elite): "discovered" | "improved" | "rejected" {
    const key = cellKey(elite.behaviour);
    const existing = this.cells.get(key);

    if (!existing) {
      this.cells.set(key, elite);
      return "discovered";
    }
    if (elite.fitness > existing.fitness) {
      this.cells.set(key, elite);
      return "improved";
    }
    return "rejected";
  }

  best(): Elite | undefined {
    let best: Elite | undefined;
    for (const e of this.cells.values()) {
      if (!best || e.fitness > best.fitness) best = e;
    }
    return best;
  }

  /**
   * Pick a parent uniformly at random over OCCUPIED CELLS, not over fitness.
   *
   * This is the part people change first and should not. Weighting selection by
   * fitness turns MAP-Elites back into a tournament wearing a grid: the search
   * crowds around whatever currently scores best and the sparse regions never
   * get explored. Uniform selection over cells means a lonely elite in an
   * unpromising corner gets just as many children as the champion, which is the
   * entire mechanism by which the archive fills out.
   */
  sample(u: number): Elite | undefined {
    const all = [...this.cells.values()];
    if (all.length === 0) return undefined;
    const i = Math.min(all.length - 1, Math.floor(u * all.length));
    return all[i];
  }

  // ..................................................
  // Persistence
  //

  toJSON(): ArchiveSnapshot {
    return {
      dimensions: DIMENSIONS.map((d) => ({ ...d })),
      cells: this.entries().map(([key, e]) => ({
        key,
        genes: Array.from(e.genome.genes, (v) => Number(v.toFixed(6))),
        genomeId: e.genome.id,
        parents: [...e.genome.parents],
        fitness: e.fitness,
        behaviour: [...e.behaviour],
        generation: e.generation,
      })),
    };
  }

  static fromJSON(
    snapshot: ArchiveSnapshot,
    rebuild: (genes: number[], parents: string[], generation: number) => Genome,
  ): Archive {
    const archive = new Archive();
    for (const c of snapshot.cells) {
      archive.cells.set(c.key, {
        genome: rebuild(c.genes, c.parents, c.generation),
        fitness: c.fitness,
        behaviour: c.behaviour,
        generation: c.generation,
      });
    }
    return archive;
  }
}

export interface ArchiveCellRecord {
  key: string;
  genes: number[];
  genomeId: string;
  parents: string[];
  fitness: number;
  behaviour: number[];
  generation: number;
}

export interface ArchiveSnapshot {
  dimensions: BehaviourDimension[];
  cells: ArchiveCellRecord[];
}
