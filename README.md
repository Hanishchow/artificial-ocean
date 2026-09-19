# Artificial Ocean

**[hanishchow.github.io/artificial-ocean](https://hanishchow.github.io/artificial-ocean/)**

Soft-bodied creatures grown from genome strings and bred by how well they feed
themselves. Nobody designs the animals: a genome is 25 numbers, `develop()`
turns it into particles and constraints, a solver makes it move, and how much
energy it nets decides whether its genes survive.

## Status

| Milestone | |
|---|---|
| M0 · Solver ported from Particulate.js | **done** — matches the original bit-for-bit |
| M1 · Genome → body, viability harness | **done** |
| M2 · Energy economy | **done** |
| M3 · MAP-Elites search | **done** |
| M4 · Renderer | **done** — the engine bundles to 32 KB and runs in the browser |
| M5 · The exhibit | **done** — live tank, archive browser, per-creature readout |
| M6 · Persistence and schedule | **done** — resumable runner, hourly cron, Pages deploy, SQL schema |
| M7 · Polish | partial — post-processing and a mobile budget are still open |
| M8 · Steering | not started — creatures swim straight and cannot turn |

18 tests. No creature in 3,840 consecutive evaluations was malformed or
unstable.

The published page is not a recording. It carries the 32 KB engine and the
archive as genomes, and grows and simulates each creature in the browser when
you click it — 88 KB for a hundred and twenty live animals, against 5.7 MB for
three recorded ones.

## Running it

```bash
pnpm install
pnpm test                      # solver parity, economy loopholes, search, bundle
pnpm typecheck                 # includes the purity lockdown, below

pnpm runner evolve 30 22 ocean # 30 generations; resumes if an archive exists
pnpm runner sheet 100 30       # SVG contact sheet of a sampled population
pnpm runner swim reference 30  # one animal, with a trajectory plot
pnpm runner record archive:ocean  # one gait cycle, for the standalone viewer

pnpm build:exhibit ocean       # engine + archive + page into apps/exhibit/dist
```

## Layout

```
packages/
  mathx/        seeded PRNG, deterministic sin/cos, splines. No Math.random anywhere.
  core-types/   Phenotype, ConstraintSpec, ActuatorSpec, CavitySpec. Types only.
  solver/       Particulate.js ported to TS, plus drag, buoyancy, flow, cavity jet.
  topology/     rings, loops, radial fans, faces — the mesh vocabulary.
  genome/       the gene table, mutation, crossover, curated seed animals.
  morphogen/    develop(): Genome -> Phenotype. Pure, takes no RNG.
  sim/          gait, food field, economy, episode runner. Headless.
  evolve/       MAP-Elites archive and generation loop. Never imports sim.
  devtools/     SVG contact sheets and plots — how creatures were looked at
                for the first three milestones, before a renderer existed.
apps/
  runner/       CLI: evolve, sheet, swim, record, gallery
  exhibit/      the browser engine bundle and the exhibit page
insforge/       SQL schema for the full evolution history
.github/        hourly evolve cron, Pages deploy
```

**Every package above is pure.** Its tsconfig has neither `DOM` nor `node`
types, so `window`, `document`, `fetch`, `process` and `fs` fail to *compile*
rather than failing later. Only `apps/runner` may touch the filesystem. That
discipline is not tidiness — it is why the same code that evaluates creatures on
a CI runner bundles to 32 KB and runs unchanged in a web page, and why a
creature travels to the browser as a 200-byte genome instead of a mesh.

## Things that will surprise you

**The solver is ported, not written.** `libs.develop.js` in the JellyTech repo
contains Particulate.js, and it is completely creature-agnostic — grep it for
"jelly" and you get nothing. Two things in it look like bugs and are not: the
distance solve is deliberately sqrt-free and ignores particle weights, and
`satisfyConstraints` runs its groups global→local→pin at only two iterations.
Both are load-bearing for the emergent contraction wave.
`tests/solver.parity.test.ts` loads the original and diffs against the port over
500 ticks so nobody can "improve" them.

**The reference jellyfish has never swum.** It is pinned to the world at five
points with weight 0 (`app.develop.js:2346-2355`). Every force that makes a
creature move is new work.

**Viability lives in the mapping, not the mutation operator.** Genes are always
in [0,1] and each one's range is hand-chosen to be survivable, so no mutation
can produce a malformed animal. Mutation reflects off the ends rather than
clamping, because clamping makes 0 and 1 into attractors that no selection
pressure put there.

**One constraint group per rib band.** Pooling every meridian into one group
gives them all one mean rest length, and a bell's rings vary from 2 units at the
apex to 11 at the margin. The body is then born violating itself and the solver
detonates on tick one.

**Isotropic drag cannot swim.** Measured, not assumed: a bell pulsing hard
netted 0.006 units per cycle, slightly backwards. Drag has to resist motion
*through* a surface far more than *along* it before a bell behaves like a paddle
instead of a bag of beads. Worth 20×.

**The bell is a pump, not a paddle.** Thrust comes from squeezing water out of
the cavity under the bell and riding the reaction, not from the surface pushing
on water. Worth another 22×, and it is the difference between 0.019 and 1.58
body-lengths per second.

**Drag has to be capped or it explodes.** Explicit integration evaluates drag at
the start of the step, so a quadratic force stiff enough to remove more than all
of a particle's velocity throws it backwards harder than it arrived. Stable at
10 units/sec, firework at 120.

**One fluid, one density.** Drag density and jet density were briefly two knobs.
Making them one — the only coherent choice — revealed that the density *cancels*
out of steady-state swimming speed, since thrust and drag both scale with it.
Speed is set by the ratio of drag area to aperture area. Two knobs made it look
tunable; one knob showed it is not, and ended a parameter sweep that was heading
somewhere unphysical.

**A behaviour dimension has to measure something the animals can differ in.**
The grid's fourth axis was straightness, and 113 of 122 creatures sat in its top
bin: nothing in the body plan can steer, so every creature swims in a straight
line. It multiplied the grid by four and the variety by about 1.07, hiding the
real coverage behind three empty bins. It is now energy earned per unit spent.

**Purcell's scallop theorem does not apply here.** A seed was written with a
time-symmetric stroke on the assumption it could not move. It moves fine — the
theorem holds at Reynolds numbers far below one, and a real scallop swims by
clapping. The valid control is `inert`, amplitude zero, which measures exactly
0.000 units/sec.

## The economy

Fitness is net energy per second: food caught, minus muscle work and upkeep.
Two mechanisms remove degenerate strategies by construction rather than by
penalty.

**Food drifts on the same current the creature does.** A passive animal is
carried along beside its dinner, meets almost none of it, and starves. Energy is
only obtainable by moving relative to the water. Nothing forbids sitting still;
sitting still simply does not eat.

**Capture sites have a Holling handling time.** A site that has just caught
something is busy for half a second, so N sites can never exceed N/handlingTime
catches per second however much water they sweep. Without it the winning animal
is a rake.

Calibration took three attempts and the first two are recorded in the source.
With sparse food every seed caught 0–4 items and starved, so the objective was
measuring starting reserves. With upkeep ten times cheaper, the only survivor
was `inert`, a creature that physically cannot move.

Seven tests pin the loopholes shut, one per degenerate strategy. An economy is
only as good as its worst one, and a hole reintroduced by a later tweak is
invisible until a run has spent a thousand generations exploiting it.

## The finding

Two runs of the same search, from the same seeds, under the same physics. The
only difference was what fitness meant.

| after 60–80 generations | bred for speed | bred for food |
|---|---|---|
| top-20 elites with tentacles | **2 / 20** | **20 / 20** |
| mean tentacles across top-20 | 1.1 | **24.8** |
| champion | radius 5.5, 0 tentacles | radius 20.1, 24 tentacles |

Under speed a tentacle is drag and nothing else, so the search deletes it and
builds a narrow dart. Give the world food and the animal a metabolism, and the
same search builds something four times wider that keeps every tentacle it can
afford to feed.

The fastest creature in every run is one nobody wrote. Hand-tuning made things
worse about as often as better — maximum contraction amplitude is *slower* than
moderate, which is not something you would reason your way to.

## Still open

- **Steering.** Creatures swim in straight lines. A tropism controller — three
  scalars biasing contraction per symmetry sector by the local food gradient —
  would let them turn toward food, and would make a straightness axis mean
  something again.
- **Compute.** 60 generations under the energy objective took 2,135 seconds,
  five times slower than before food existed, because 3,000 food particles are
  advected and re-indexed every tick. That number decides how much the hourly
  cron can actually do.
- **Post-processing.** The original's bloom and lens-dirt chain is a rewrite
  rather than a port, and is off the critical path.
- **Cross-engine determinism** is claimed for the runner only, not for browser
  playback. `mathx` ships its own sin/cos and PRNG because `Math.sin` is
  implementation-defined; `AngleConstraint` still calls `Math.acos` and is
  excluded, which is safe only while no body plan uses it.
