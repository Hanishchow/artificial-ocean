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
| Bodies reaching 0.5 body-lengths/sec | ≥ 25% | 0% (best 0.019) | **FAIL** |

The bodies are sound and the physics is stable. They swim about 25× too slowly
to clear the locomotion threshold. See "Where this is stuck", below.

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

## Where this is stuck

Best creature: 0.019 body-lengths/sec against a 0.5 target.

The model discriminates correctly — `drummer`, a seed deliberately given a
time-symmetric stroke (duty 0.5), scores at the bottom exactly as Purcell's
scallop theorem says it must, and the wave-driven designs score at the top. So
there is a real gradient for selection to climb. It is just shallow.

The most likely cause is that a real medusa is a **pump**, not a paddle: it
expels a volume of water from the cavity under its bell. This model has no
cavity, no enclosed volume and no pressure — Particulate has no volume constraint
and neither does this port. A flexible sheet flapping in a drag field does
produce thrust, but far less than a jet.

Options, roughly in order of cost:

1. **Recalibrate the threshold.** 0.5 bl/s was estimated from real jellyfish
   before any of this existed. If selection only needs a gradient, 0.02 may be
   enough. Cheapest, and moves a goalpost — worth doing only deliberately.
2. **Add a cavity.** Give the bell an enclosed volume and a pressure force
   pushing outward along surface normals in proportion to how compressed it is.
   This is the missing physics, and it is what would make contraction actually
   throw water.
3. **Let evolution answer it.** Build M3 and see whether a few hundred
   generations find gaits far better than eight hand-written seeds. Hand-authored
   animals are usually poor; this is what the search is for.

Option 2 then 3 is the honest ordering.
