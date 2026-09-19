# Artificial Ocean

Soft-bodied creatures grown from genome strings, selected by how well they swim.

Nobody designs the animals. A genome is a vector of numbers; `develop()` turns it
into particles and constraints; a solver makes it move; how far it gets is the
only thing that decides whether its genes survive.

## Status: M0 passed, M1 partially passed

| Gate | Target | Measured | |
|---|---|---|---|
| Solver parity with the original | bit-for-bit over 500 ticks | exact | **PASS** |
| Genomes that develop | — | 100 / 100 | **PASS** |
| Bodies stable for 30s | ≥ 60% | 100% | **PASS** |
| Bodies reaching 0.5 body-lengths/sec | ≥ 25% | 0% (best **0.414**) | **FAIL** |

The bodies are sound, the physics is stable, and the fastest creature is within
20% of the threshold — but nothing clears it, so the gate is failed. See
"Where this stands", below.

Nothing downstream — renderer, evolution loop, backend, exhibit — is built yet,
which is the point: the gate exists to find this before any of that is paid for.

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

### Next

1. **Build M3 and let evolution search.** The evidence above says a few hundred
   generations will beat hand-authoring comfortably, and 0.414 is already within
   20% of the threshold.
2. **Then decide the threshold on evidence.** 0.5 bl/s was estimated from real
   jellyfish before any of this existed. Once there is a distribution from a real
   run, it can be set to something the model demonstrably supports rather than
   something guessed in advance.
