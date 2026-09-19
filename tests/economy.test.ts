/**
 * The energy economy, and the degenerate strategies it exists to forbid.
 *
 * Each of these is a specific way the objective could be gamed. They are tests
 * rather than comments because an economy is only as good as its worst
 * loophole, and a loophole reintroduced by a later tweak is invisible until a
 * run has spent a thousand generations exploiting it.
 */

import { describe, expect, it } from "vitest";
import { decode, seedByName } from "@ocean/genome";
import { EVAL_OPTIONS, develop } from "@ocean/morphogen";
import { DEFAULT_EPISODE, fitnessOf, runEpisode } from "@ocean/sim";
import type { EpisodeConfig } from "@ocean/sim";

function run(name: string, seconds = 30) {
  const genome = seedByName(name);
  const t = decode(genome);
  const dev = develop(genome, EVAL_OPTIONS);
  if (!dev.ok) throw new Error(`${name} failed to develop: ${dev.reason}`);

  const cfg: EpisodeConfig = {
    ...DEFAULT_EPISODE,
    seconds,
    gait: { frequency: t["pulseFreq"]!, duty: t["pulseDuty"]! },
  };
  const result = runEpisode(dev.phenotype, cfg);
  return { result, phenotype: dev.phenotype, fitness: fitnessOf(result) };
}

describe("energy economy", () => {
  it("does not reward sitting still", () => {
    // THE degenerate strategy. Food drifts on the same current the creature
    // does, so a passive animal travels alongside its dinner at the same speed
    // and almost never meets any. If this ever passes by accident, the ocean
    // fills with motionless sacks that score well.
    const inert = run("inert");
    expect(inert.result.metrics.netEnergy).toBeLessThan(0);
    expect(inert.fitness).toBeLessThan(0);
  });

  it("starves a creature with no apparatus for catching anything", () => {
    // `bare` has no tentacles, so 18 capture sites against `reference`'s 756.
    const bare = run("bare");
    expect(bare.phenotype.captureSites.length).toBeLessThan(50);
    expect(bare.result.abort).toBe("starved");
  });

  it("rewards the creature that can actually feed itself", () => {
    // The whole point of M2. Under the speed objective this ordering was
    // reversed: tentacles were pure drag, and 18 of the top 20 elites had
    // dropped them entirely.
    const reference = run("reference");
    const bare = run("bare");

    expect(reference.phenotype.captureSites.length).toBeGreaterThan(
      bare.phenotype.captureSites.length * 10,
    );
    expect(reference.result.metrics.netEnergy).toBeGreaterThan(0);
    expect(reference.fitness).toBeGreaterThan(bare.fitness);
  });

  it("charges for muscle work, so thrashing is not free", () => {
    const reference = run("reference");
    const inert = run("inert");

    // inert has amplitude zero: it pays upkeep but does no muscle work at all.
    expect(inert.result.metrics.workDone).toBe(0);
    expect(reference.result.metrics.workDone).toBeGreaterThan(0);
    expect(reference.result.metrics.energySpent).toBeGreaterThan(
      inert.result.metrics.energySpent,
    );
  });

  it("caps capture rate per site, so a rake cannot win on size alone", () => {
    // Holling handling time: a site that has just caught something is occupied.
    // N sites can therefore never exceed N/handlingTime catches per second,
    // however much water they sweep.
    const { result, phenotype } = run("trailing");
    const seconds = result.metrics.ticksSurvived / DEFAULT_EPISODE.hz;
    const ceiling =
      (phenotype.captureSites.length / DEFAULT_EPISODE.food.handlingTime) *
      seconds;

    expect(result.metrics.captures).toBeLessThan(ceiling);
  });

  it("scores a starved creature by what it managed, not as invalid", () => {
    // "Died at 25 seconds having nearly broken even" must rank above "died at
    // 4 seconds", or the search gets no gradient out of the starvation region
    // and every failing lineage looks identical to it.
    const bare = run("bare");
    expect(bare.result.abort).toBe("starved");
    expect(Number.isFinite(bare.fitness)).toBe(true);
  });

  it("is reproducible: the same genome twice gives the same numbers", () => {
    const a = run("reference");
    const b = run("reference");
    expect(b.result.metrics.captures).toBe(a.result.metrics.captures);
    expect(b.result.metrics.netEnergy).toBeCloseTo(a.result.metrics.netEnergy, 9);
  });
});
