# Artificial Ocean

Soft-bodied creatures grown from genome strings, selected by how well they swim.

Nobody designs the animals. A genome is a vector of numbers; `develop()` turns it
into particles and constraints; a solver makes it move; how far it gets is the
only thing that decides whether its genes survive.

## Status: M0, M1, M2 and M3 done

| Gate | Target | Measured | |
|---|---|---|---|
| Solver parity with the original | bit-for-bit over 500 ticks | exact | **PASS** |
| Genomes that develop | — | 3,840 / 3,840 | **PASS** |
| Bodies stable for a full episode | ≥ 60% | 100% | **PASS** |
| Reaching 0.5 body-lengths/sec | ≥ 25% | best **1.58** | **PASS** |

Hand-written animals topped out at 0.134 bl/s. Eighty generations of MAP-Elites
reached **1.58**, more than three times the threshold and twelve times anything
authored by hand. Not one of 3,840 evaluations produced a malformed or unstable
body.

There is a viewer: `pnpm runner record <seed|archive:run>` captures one gait
cycle from the solver, and `viewer/` plays it back in WebGL. It is recorded
playback, not a live browser simulation — that is still M4 proper, along with
the exhibit (M5) and persistence and the cron (M6).

### The objective decides the animal

Two runs of the same search, differing only in what fitness means:

| | speed objective | energy objective |
|---|---|---|
| top-20 elites with tentacles | **2 / 20** | **20 / 20** |
| mean tentacles across top-20 | 1.1 | **24.8** |
| champion | radius 5.5, height 28, 0 tentacles | radius 20.1, height 39, 24 tentacles |

Under speed, a tentacle is drag and nothing else, so evolution throws it away
and builds a narrow dart. Add food and a metabolism and the same search, from
the same seeds, builds something four times wider that keeps every tentacle it
can afford. Neither animal was designed.

### M2: the economy, and why tentacles came back

Fitness is no longer speed. It is **net energy per second**: food caught, minus
the muscle work and upkeep of catching it. Creatures spend energy to contract
(shortening only — relaxation is elastic recoil and is free), pay upkeep in
proportion to particle count, and die when they run out.

Two design choices carry the weight, and both remove a degenerate strategy by
construction rather than by penalty:

**Food drifts on the same current the creature does.** A passive animal is
carried along with its dinner at the same speed, meets almost none of it, and
starves. Energy is only obtainable by moving *relative to the water*. Nothing
has to penalise stillness; stillness simply does not eat.

**Capture sites have a handling time.** A site that has just caught something is
occupied for half a second. N sites can therefore never exceed N/handlingTime
catches per second however much water they sweep, so the five hundredth tentacle
segment adds almost nothing while still costing upkeep every tick of the
animal's life. Without this, the winning strategy is a rake.

The numbers were calibrated by measurement over three attempts, and the first
two were wrong in instructive ways. Both are recorded in the source: with sparse
food every seed starved and the objective was measuring starting reserves; with
cheap upkeep the only survivor was `inert`, a creature with amplitude zero that
physically cannot move.

Where it landed, across the eight seeds:

| seed | capture sites | captures | net energy | |
|---|---|---|---|---|
| reference | 756 | 156 | **+91.7** | best |
| trailing | 496 | 75 | +42.3 | |
| inert | 168 | 6 | −8.4 | sitting still loses |
| bare | 18 | 12 | — | **starves** |

The two seeds with the most capture apparatus are the two profitable ones, and
the one without any starves. That is the exact inversion of the M3 result, where
18 of the top 20 elites had dropped their tentacles.

## Running it

```bash
pnpm install
pnpm test                       # includes the solver parity gate
pnpm runner sheet 100 30        # the M1 gate + sheets/contact-sheet.svg
pnpm runner swim reference 30   # one animal, with a trajectory plot
```

## Layout

```
packages/
  mathx/        seeded PRNG, deterministic sin/cos, splines. No Math.random anywhere.
  core-types/   Phenotype, ConstraintSpec, ActuatorSpec. Types only.
  solver/       Particulate.js ported to TS, plus drag / buoyancy / flow.
  topology/     rings, loops, radial fans — the mesh vocabulary.
  genome/       the gene table, mutation, crossover, curated seed animals.
  morphogen/    develop(): Genome -> Phenotype. Pure, no RNG parameter.
  sim/          gait controller, episode runner. Headless.
  devtools/     SVG contact sheets. How you look at creatures without a renderer.
apps/runner/    CLI
```

Every package above is **pure**: its tsconfig has neither `DOM` nor `node` types,
so `window`, `document`, `fetch`, `process` and `fs` fail to *compile* rather
than failing later. That is what lets fitness evaluation run anywhere. Only
`apps/runner` may touch the filesystem.

## Things that will surprise you

**The solver is ported, not written.** `libs.develop.js` in the JellyTech repo
contains Particulate.js, and it is completely creature-agnostic — grep it for
"jelly" and you get nothing. Two things in it look like bugs and are not: the
distance solve is deliberately sqrt-free and ignores particle weights, and
`satisfyConstraints` runs its groups global→local→pin at only two iterations.
Both are load-bearing for the emergent contraction wave. `tests/solver.parity.test.ts`
loads the original and diffs against the port so nobody can "improve" them.

**The reference jellyfish has never swum.** It is pinned to the world at five
points with weight 0 (`app.develop.js:2346-2355`). It pulses in place. Every
force that makes a creature move is new work, not a port.

**Viability lives in the mapping, not the mutation operator.** Genes are always
in [0,1] and each one's range is hand-chosen to be survivable, so no mutation can
produce a malformed animal. 100/100 developed on the first run. Mutation reflects
off the ends rather than clamping, because clamping makes 0 and 1 into attractors.

**One constraint group per rib band.** Pooling every meridian into one group
gives them all one mean rest length, and a bell's rings vary from 2 units at the
apex to 11 at the margin. The body is then born violating itself and the solver
detonates on tick one. This cost an afternoon.

**Isotropic drag cannot swim.** Measured, not assumed: a bell pulsing hard
(rim radius swinging 6.4→7.8) netted 0.006 units per cycle, slightly backwards.
The body's mechanical response smooths out the stroke asymmetry the gait asks
for. Drag has to be anisotropic — resisting motion *through* the surface far more
than *along* it — before a bell behaves like a paddle instead of a bag of beads.
That change alone was worth 20×.

**Drag has to be capped or it explodes.** Explicit integration evaluates drag at
the start of the step, so a quadratic force stiff enough to remove more than all
of a particle's velocity throws it backwards harder than it arrived. Stable at 10
units/sec, marginal at 40, firework at 120.

## Where this stands

Best creature: **0.414** body-lengths/sec against a 0.5 target, up from 0.019.

Three fixes got it there, in order of what they were worth:

**The bell is a pump, not a paddle (22×).** A medusa encloses water under its
bell, squeezes it out through the margin and rides the reaction. `CavityJetForce`
measures the cavity volume each tick and turns its rate of change into thrust,
`rho * (dV/dt)^2 / A`. Nothing in the original needed this, because the original
never moved.

**Drag area is the frontal projection, not the total surface (4×).** Summing
every surface patch counts both faces of a closed body and overstates drag about
fivefold. The patches are now relative weights, rescaled so their sum is the
body's silhouette.

**One fluid, one density.** Drag density and jet density were briefly separate
knobs. Making them one — which is the only coherent choice — revealed that the
density CANCELS out of the steady-state swimming speed, since thrust and drag
both scale with it. Speed is set by the ratio of drag area to aperture area and
by the kinematics. Two knobs made it look tunable; one knob makes it clear it is
not, and stopped an afternoon of sweeping parameters toward a number.

### Two things worth knowing before continuing

**The fastest creature is a mutant, not a seed.** `bullet+73`, one random jitter
away from a hand-written animal, is three times faster than the best thing I
wrote by hand (`ripple`, 0.134). Hand-tuning made things worse about as often as
better — maximum contraction amplitude is *slower* than moderate, which is not
something you would reason your way to. That is the signature of a landscape
that needs search rather than judgement, and it is the strongest available
argument for building M3 next.

**The scallop-theorem control was wrong.** `drummer` was written with a
time-symmetric stroke on the assumption it could not move. It moves fine.
Purcell's theorem holds at Reynolds numbers far below one; a bell this size at
these speeds is nowhere near that regime, and a real scallop swims by clapping.
The valid control is `inert`, amplitude zero, which measures exactly 0.000
units/sec — that is the evidence thrust comes from the gait and not from a
numerical leak.

### What the search found

```
pnpm runner evolve 80 20 run-1
```

80 generations, 3,840 evaluations, 382 seconds. Best fitness 0.28 to 1.58 bl/s;
archive 16 to 161 cells.

The champion is not a design anyone would have drawn: radius 5.5 against a
height of 28 — far narrower than any real medusa — beating at 1.32 Hz with a
phase lag of 0.37 running down the bell, and a contraction amplitude of 0.47.
I had been hand-tuning toward *maximum* amplitude, which the data had already
said was wrong.

**It has no tentacles, and that is a finding, not a detail.** Only 2 of the top
20 elites keep any, against 66 of all 161. With fitness defined as speed and no
food in the world, a tentacle is pure drag and nothing else — so evolution
correctly deletes it. The behaviour grid keeps tentacled creatures alive in
their own cells, which is MAP-Elites doing exactly its job, but they never win.

That is the clearest possible argument for building M2 next: tentacles need a
reason to exist, and catching food is the reason.

### Next

1. **M2, the energy economy.** Net energy replaces speed as the objective.
   `workDone` is already measured and ready to become the denominator, and
   `captureSites` are already emitted by development and unused.
2. **M4, the renderer.** There is now a population worth looking at properly,
   and everything downstream of it is presentation rather than research.
