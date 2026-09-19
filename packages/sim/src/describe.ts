/**
 * Turning an episode into a fitness number and a behaviour vector.
 *
 * Kept here, next to the simulation, rather than in `evolve`: the search must
 * not know what a bell is, and this is the one place that has to.
 */

import type { EpisodeResult, Phenotype } from "@ocean/core-types";

/**
 * Fitness: net energy per second.
 *
 * This replaces the speed stand-in used through M3, and the reason to replace
 * it is visible in that run's archive. With speed as the objective, 18 of the
 * top 20 creatures had shed their tentacles entirely — correctly, since a
 * tentacle with nothing to catch is drag and nothing else. Swimming was the
 * only thing being rewarded, so swimming was the only thing that evolved.
 *
 * Net energy makes both halves of the animal matter at once. Speed is still
 * worth having, because moving relative to the current is the only way to meet
 * food; but it now has to pay for itself in muscle work and upkeep, and an
 * apparatus for catching things finally has something to catch.
 *
 * A starved creature is not scored at -Infinity but by what it managed before
 * dying, so that "died at 25 seconds having nearly broken even" ranks above
 * "died at 4 seconds". Only physically invalid runs are rejected outright.
 */
export function fitnessOf(result: EpisodeResult): number {
  if (result.abort && result.abort !== "starved") return -Infinity;

  const seconds = Math.max(0.001, result.metrics.ticksSurvived / 30);
  return result.metrics.netEnergy / seconds;
}

/**
 * The behaviour vector, matching evolve's DIMENSIONS in order:
 * aspect, size, speed, efficiency.
 *
 * Two of the four are measured outcomes rather than genes, which is what makes
 * the archive a record of what creatures DID rather than of what their genomes
 * asked for.
 */
export function describe(
  phenotype: Phenotype,
  result: EpisodeResult,
): number[] {
  const radius = Math.max(0.001, phenotype.bounds.radius);
  const aspect = phenotype.bounds.height / (2 * radius);

  const { bodyLengthsPerSecond, netEnergy, energySpent } = result.metrics;

  // Energy earned per unit spent. A creature that spent nothing because it
  // never moved has no meaningful ratio; call it zero rather than dividing by
  // an epsilon and filing it as infinitely efficient.
  const gained = netEnergy + energySpent;
  const efficiency = energySpent > 1e-6 ? gained / energySpent : 0;

  return [aspect, radius, bodyLengthsPerSecond, efficiency];
}
