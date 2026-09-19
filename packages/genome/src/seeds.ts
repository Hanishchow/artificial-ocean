/**
 * Curated starting animals.
 *
 * A population is NOT initialised by sampling the gene space uniformly. Twenty
 * five dimensions sampled at random is almost entirely mediocre, and an
 * evolutionary run that starts there spends its first many generations climbing
 * out of noise rather than exploring anything. Starting from a handful of
 * hand-written animals and perturbing outward reaches interesting territory
 * far sooner, and it means the first contact sheet shows creatures rather than
 * rubble.
 *
 * These are written as traits in real units, so each reads as a description of
 * an animal rather than as a row of numbers. They are deliberately spread
 * across the space — tall and narrow, wide and flat, many small ribs, few large
 * ones — because seeds that resemble each other illuminate only one corner.
 */

import { type Genome, fromTraits } from "./genome.js";

export interface Seed {
  readonly name: string;
  readonly note: string;
  readonly genome: Genome;
}

export const SEEDS: readonly Seed[] = [
  {
    name: "reference",
    note:
      "The original medusa's proportions: 36 segments, 20 ribs, radius 15, " +
      "size 40. Taken from Medusae.js's constructor (app.develop.js:1659-1693) " +
      "so there is one animal in the population whose shape is known to look " +
      "right. Its gait is new — the original never swam.",
    genome: fromTraits({
      radialSymmetry: 12,
      segmentsPerSector: 3,
      ribCount: 18,
      bellRadius: 15,
      bellHeight: 40,
      // Approximates sin(PI - PI*0.55*t*1.8) + log(t*100+2)/3, the reference's
      // bell profile (app.develop.js:1813): narrow apex, widest near the rim.
      profile0: 0.18,
      profile1: 0.55,
      profile2: 0.82,
      profile3: 0.97,
      profile4: 0.9,
      tentaclesPerSector: 2,
      tentacleSegments: 30,
      tentacleSegLength: 1.5,
      tentacleWeightExp: 3.0,
      skinSlack: 0.9,
      radialSlack: 0.88,
      spineSlack: 0.92,
      weightBase: 1.0,
      weightExp: 1.25,
      pulseFreq: 0.8,
      pulseDuty: 0.3,
      pulseAmplitude: 0.3,
      phaseLagPerRib: 0.18,
      contractionProfileExp: 1.4,
    }),
  },
  {
    name: "bullet",
    note:
      "Tall, narrow, fast and shallow-stroked. The hydromedusa body plan: a " +
      "deep bell trades acceleration for efficiency.",
    genome: fromTraits({
      radialSymmetry: 8,
      segmentsPerSector: 3,
      ribCount: 16,
      bellRadius: 7,
      bellHeight: 30,
      profile0: 0.25,
      profile1: 0.7,
      profile2: 0.95,
      profile3: 1.0,
      profile4: 0.85,
      tentaclesPerSector: 1,
      tentacleSegments: 24,
      tentacleSegLength: 1.2,
      tentacleWeightExp: 2.5,
      skinSlack: 0.93,
      radialSlack: 0.9,
      spineSlack: 0.95,
      weightBase: 0.8,
      weightExp: 1.6,
      pulseFreq: 1.3,
      pulseDuty: 0.22,
      pulseAmplitude: 0.36,
      phaseLagPerRib: 0.22,
      contractionProfileExp: 1.8,
    }),
  },
  {
    name: "saucer",
    note:
      "Wide and flat, like Aurelia. Large rim area, slow deep stroke. Should " +
      "be efficient and unhurried; the opposite pole from bullet.",
    genome: fromTraits({
      radialSymmetry: 8,
      segmentsPerSector: 4,
      ribCount: 10,
      bellRadius: 20,
      bellHeight: 10,
      profile0: 0.3,
      profile1: 0.75,
      profile2: 0.95,
      profile3: 1.0,
      profile4: 0.98,
      tentaclesPerSector: 3,
      tentacleSegments: 14,
      tentacleSegLength: 1.0,
      tentacleWeightExp: 2.0,
      skinSlack: 0.86,
      radialSlack: 0.85,
      spineSlack: 0.9,
      weightBase: 1.2,
      weightExp: 1.0,
      pulseFreq: 0.45,
      pulseDuty: 0.28,
      pulseAmplitude: 0.45,
      phaseLagPerRib: 0.3,
      contractionProfileExp: 1.0,
    }),
  },
  {
    name: "bare",
    note:
      "No tentacles at all. The control: if this swims and the others do not, " +
      "the tentacles are the problem rather than the bell.",
    genome: fromTraits({
      radialSymmetry: 6,
      segmentsPerSector: 3,
      ribCount: 14,
      bellRadius: 11,
      bellHeight: 20,
      profile0: 0.2,
      profile1: 0.6,
      profile2: 0.9,
      profile3: 1.0,
      profile4: 0.92,
      tentaclesPerSector: 0,
      tentacleSegments: 0,
      tentacleSegLength: 1.0,
      tentacleWeightExp: 2.0,
      skinSlack: 0.9,
      radialSlack: 0.88,
      spineSlack: 0.93,
      weightBase: 1.0,
      weightExp: 1.3,
      pulseFreq: 1.0,
      pulseDuty: 0.25,
      pulseAmplitude: 0.4,
      phaseLagPerRib: 0.2,
      contractionProfileExp: 1.5,
    }),
  },
  {
    name: "trailing",
    note:
      "Modest bell, very long tentacles. Tests whether appendage drag drowns " +
      "the thrust — the cheapest way to find out if basal cost and drag are " +
      "already enough to keep tentacle length honest.",
    genome: fromTraits({
      radialSymmetry: 4,
      segmentsPerSector: 4,
      ribCount: 12,
      bellRadius: 9,
      bellHeight: 16,
      profile0: 0.22,
      profile1: 0.65,
      profile2: 0.92,
      profile3: 1.0,
      profile4: 0.88,
      tentaclesPerSector: 3,
      tentacleSegments: 40,
      tentacleSegLength: 2.4,
      tentacleWeightExp: 3.5,
      skinSlack: 0.91,
      radialSlack: 0.89,
      spineSlack: 0.94,
      weightBase: 0.9,
      weightExp: 1.4,
      pulseFreq: 0.9,
      pulseDuty: 0.24,
      pulseAmplitude: 0.38,
      phaseLagPerRib: 0.25,
      contractionProfileExp: 1.6,
    }),
  },
  {
    name: "inert",
    note:
      "THE CONTROL. Amplitude zero: it does not pulse at all, and it must " +
      "therefore not move. Measured at exactly 0.000 units/sec with a 0% " +
      "cavity swing, which is the evidence that thrust comes from the gait " +
      "rather than from a numerical artefact leaking momentum into the body.",
    genome: fromTraits({
      radialSymmetry: 8,
      segmentsPerSector: 3,
      ribCount: 14,
      bellRadius: 12,
      bellHeight: 22,
      profile0: 0.2,
      profile1: 0.62,
      profile2: 0.9,
      profile3: 1.0,
      profile4: 0.9,
      tentaclesPerSector: 1,
      tentacleSegments: 18,
      tentacleSegLength: 1.3,
      tentacleWeightExp: 2.5,
      skinSlack: 0.9,
      radialSlack: 0.88,
      spineSlack: 0.93,
      weightBase: 1.0,
      weightExp: 1.3,
      pulseFreq: 1.0,
      pulseDuty: 0.25,
      pulseAmplitude: 0,
      phaseLagPerRib: 0.2,
      contractionProfileExp: 1.5,
    }),
  },
  {
    name: "drummer",
    note:
      "A time-symmetric stroke, duty 0.5. Written as a control on the " +
      "assumption that Purcell's scallop theorem would forbid it from moving. " +
      "THAT ASSUMPTION WAS WRONG and it is worth keeping the seed to remember " +
      "why: the theorem holds at Reynolds numbers far below one, where inertia " +
      "is irrelevant and a reciprocal motion retraces itself exactly. A bell " +
      "this size moving at these speeds is nowhere near that regime, and a " +
      "scallop — the animal Purcell named — swims perfectly well by clapping. " +
      "Here it swims about as well as anything else, and the real control is " +
      "`inert` above.",
    genome: fromTraits({
      radialSymmetry: 8,
      segmentsPerSector: 3,
      ribCount: 14,
      bellRadius: 12,
      bellHeight: 22,
      profile0: 0.2,
      profile1: 0.62,
      profile2: 0.9,
      profile3: 1.0,
      profile4: 0.9,
      tentaclesPerSector: 1,
      tentacleSegments: 18,
      tentacleSegLength: 1.3,
      tentacleWeightExp: 2.5,
      skinSlack: 0.9,
      radialSlack: 0.88,
      spineSlack: 0.93,
      weightBase: 1.0,
      weightExp: 1.3,
      pulseFreq: 1.0,
      pulseDuty: 0.5,
      pulseAmplitude: 0.42,
      phaseLagPerRib: 0.2,
      contractionProfileExp: 1.5,
    }),
  },
  {
    name: "ripple",
    note:
      "Many ribs and a large phase lag, so the contraction is a slow wave " +
      "running down the bell rather than a single squeeze. Peristalsis rather " +
      "than jetting.",
    genome: fromTraits({
      radialSymmetry: 10,
      segmentsPerSector: 3,
      ribCount: 18,
      bellRadius: 10,
      bellHeight: 34,
      profile0: 0.35,
      profile1: 0.7,
      profile2: 0.85,
      profile3: 0.95,
      profile4: 1.0,
      tentaclesPerSector: 1,
      tentacleSegments: 20,
      tentacleSegLength: 1.1,
      tentacleWeightExp: 2.2,
      skinSlack: 0.88,
      radialSlack: 0.87,
      spineSlack: 0.9,
      weightBase: 0.9,
      weightExp: 1.1,
      pulseFreq: 0.7,
      pulseDuty: 0.3,
      pulseAmplitude: 0.34,
      phaseLagPerRib: 0.55,
      contractionProfileExp: 0.6,
    }),
  },
  {
    name: "inverted",
    note:
      "Negative phase lag: the contraction runs margin to apex instead of " +
      "apex to margin. Should swim the other way, or not at all. Included " +
      "because the sign of that gene is exactly the sort of thing to get " +
      "backwards and never notice.",
    genome: fromTraits({
      radialSymmetry: 8,
      segmentsPerSector: 3,
      ribCount: 15,
      bellRadius: 13,
      bellHeight: 24,
      profile0: 0.2,
      profile1: 0.62,
      profile2: 0.9,
      profile3: 1.0,
      profile4: 0.9,
      tentaclesPerSector: 2,
      tentacleSegments: 22,
      tentacleSegLength: 1.4,
      tentacleWeightExp: 2.8,
      skinSlack: 0.9,
      radialSlack: 0.88,
      spineSlack: 0.93,
      weightBase: 1.0,
      weightExp: 1.3,
      pulseFreq: 0.95,
      pulseDuty: 0.26,
      pulseAmplitude: 0.4,
      phaseLagPerRib: -0.28,
      contractionProfileExp: 1.5,
    }),
  },
];

export function seedByName(name: string): Genome {
  const seed = SEEDS.find((s) => s.name === name);
  if (!seed) {
    throw new Error(
      `no seed "${name}". Known: ${SEEDS.map((s) => s.name).join(", ")}`,
    );
  }
  return seed.genome;
}
