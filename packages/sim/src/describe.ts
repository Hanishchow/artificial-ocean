/**
 * Turning an episode into a fitness number and a behaviour vector.
 *
 * Kept here, next to the simulation, rather than in `evolve`: the search must
 * not know what a bell is, and this is the one place that has to.
 */

import type { EpisodeResult, Phenotype } from "@ocean/core-types";

/**
 * Fitness, for now: how fast it swims, in body lengths per second.
 *
 * TEMPORARY, and worth being explicit about. The real objective is net energy —
 * food captured minus the metabolic cost of catching it — which arrives with
 * M2. Speed is a stand-in that answers the open question (can evolution find
 * creatures that swim properly?) without waiting for the economy to exist.
 *
 * Its known weakness is that it rewards speed at any cost, since nothing here
 * charges for the work done. Body lengths rather than absolute units at least
 * removes "evolve to be enormous" as a free strategy, and `workDone` is already
 * measured and ready to become the denominator.
 */
export function fitnessOf(result: EpisodeResult): number {
  if (result.abort) return -Infinity;
  return result.metrics.bodyLengthsPerSecond;
}

/**
 * The behaviour vector, matching evolve's DIMENSIONS in order:
 * aspect, size, speed, straightness.
 */
export function describe(
  phenotype: Phenotype,
  result: EpisodeResult,
): number[] {
  const radius = Math.max(0.001, phenotype.bounds.radius);
  const aspect = phenotype.bounds.height / (2 * radius);

  const { distance, pathLength, bodyLengthsPerSecond } = result.metrics;
  // A creature that never moved has no meaningful heading; call it straight
  // rather than leaving the ratio undefined, since 0/0 would otherwise file
  // every inert animal into the "swam in circles" corner.
  const straightness = pathLength > 1e-6 ? distance / pathLength : 1;

  return [aspect, radius, bodyLengthsPerSecond, straightness];
}
