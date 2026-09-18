/**
 * THE M0 EXIT GATE.
 *
 * Loads the original Particulate.js out of the vendored medusae bundle, builds
 * the same rig in it and in the TypeScript port, ticks both 500 times, and
 * asserts every float matches exactly.
 *
 * Why bother, when the port is only a few hundred lines and reads correctly?
 *
 * Because the parts most likely to be got wrong are the parts that look wrong.
 * The distance solve is a sqrt-free approximation that ignores particle
 * weights; the relaxation runs its groups in a specific order at only two
 * iterations. A reasonable engineer "improves" both, the creatures still swim,
 * and the emergent contraction wave is quietly gone. That failure would surface
 * weeks later as "the animals look stiff" with no obvious cause and no way to
 * bisect, because the regression is in physics rather than in code.
 *
 * Exact equality is the right assertion, not a tolerance. Both sides store into
 * Float32Array, so identical operations in identical order give identical bits.
 * A tolerance would hide precisely the reordering bugs this exists to catch.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DirectionalForce, DistanceConstraint, ParticleSystem } from "@ocean/solver";

const BUNDLE =
  "C:/Users/yakka/Downloads/@2026/JellyTech/public/static/medusae/libs.develop.js";

/**
 * The bundle is a concatenation of several libraries, each delimited by a path
 * comment. Slice out just the Particulate UMD and evaluate it with a CommonJS
 * shim so it takes the `typeof exports === 'object'` branch.
 *
 * Sliced by marker rather than by line number so that re-vendoring the bundle
 * does not silently shift the window and load half of Perlin.
 */
function loadOriginal(): any {
  const source = readFileSync(BUNDLE, "utf8");

  const start = source.indexOf("(function (root, factory) {");
  const endMarker = "/* ---- ..\\medusae-deps\\perlin.js ---- */";
  const end = source.indexOf(endMarker);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("could not locate the Particulate UMD in the bundle");
  }

  const umd = source.slice(start, end);
  const module = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  const run = new Function("module", "exports", umd);
  run(module, module.exports);

  const lib = module.exports;
  if (!lib || typeof lib.ParticleSystem !== "function") {
    throw new Error("Particulate did not export a ParticleSystem");
  }
  return lib;
}

/**
 * A ring of 36 particles, each linked to the next, closed, under a constant
 * downward force.
 *
 * 36 because that is the reference's own segment count (4 * 3 * 3). The ring is
 * given a deliberately slack constraint range, since the slack early-out is the
 * branch most likely to diverge if min/max get swapped or squared twice.
 */
const SEGMENTS = 36;
const RADIUS = 15;
const REST_MIN = 2.2;
const REST_MAX = 2.7;
const GRAVITY: [number, number, number] = [0, -2, 0];
const ITERATIONS = 2;
const TICKS = 500;
const DT = 1 / 30;

function ringPositions(): number[] {
  const out: number[] = [];
  // Math.cos/sin here rather than the deterministic table, because both sides
  // must start from identical positions and the original had no table.
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (Math.PI * 2 * i) / SEGMENTS;
    out.push(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS);
  }
  return out;
}

function ringPairs(): number[] {
  const out: number[] = [];
  for (let i = 0; i < SEGMENTS - 1; i++) out.push(i, i + 1);
  out.push(0, SEGMENTS - 1);
  return out;
}

describe("solver parity with Particulate.js", () => {
  it("matches the original bit-for-bit over 500 ticks", () => {
    const lib = loadOriginal();
    const verts = ringPositions();
    const pairs = ringPairs();

    // Original
    const sysA = lib.ParticleSystem.create(verts.slice(), ITERATIONS);
    sysA.addConstraint(
      lib.DistanceConstraint.create([REST_MIN, REST_MAX], pairs.slice()),
    );
    sysA.addForce(lib.DirectionalForce.create(GRAVITY.slice()));

    // Port
    const sysB = new ParticleSystem(Float32Array.from(verts), ITERATIONS);
    sysB.addConstraint(
      new DistanceConstraint(REST_MIN, REST_MAX, Uint32Array.from(pairs)),
    );
    sysB.addForce(new DirectionalForce(GRAVITY[0], GRAVITY[1], GRAVITY[2]));

    // Identical starting state is a precondition, not a result. If this fails
    // the rest of the comparison is meaningless.
    expect(Array.from(sysB.positions)).toEqual(Array.from(sysA.positions));

    for (let t = 0; t < TICKS; t++) {
      sysA.tick(DT);
      sysB.tick(DT);

      if (t % 100 === 0 || t === TICKS - 1) {
        expect(
          Array.from(sysB.positions),
          `positions diverged at tick ${t}`,
        ).toEqual(Array.from(sysA.positions));
        expect(
          Array.from(sysB.positionsPrev),
          `positionsPrev diverged at tick ${t}`,
        ).toEqual(Array.from(sysA.positionsPrev));
      }
    }

    // The rig must actually do something, or this test passes by proving that
    // two implementations agree about a ring that never moved.
    const moved = Array.from(sysB.positions as Float32Array).some(
      (v, i) => v !== verts[i],
    );
    expect(moved).toBe(true);
    expect(sysB.hasNaN()).toBe(false);
  });

  it("agrees when the constraint is driven, as an actuator would drive it", () => {
    // The gait rewrites rest lengths every tick. That path is what the
    // creatures actually exercise, and it is not covered by a static rig.
    const lib = loadOriginal();
    const verts = ringPositions();
    const pairs = ringPairs();

    const sysA = lib.ParticleSystem.create(verts.slice(), ITERATIONS);
    const conA = lib.DistanceConstraint.create([REST_MIN, REST_MAX], pairs.slice());
    sysA.addConstraint(conA);

    const sysB = new ParticleSystem(Float32Array.from(verts), ITERATIONS);
    const conB = new DistanceConstraint(REST_MIN, REST_MAX, Uint32Array.from(pairs));
    sysB.addConstraint(conB);

    for (let t = 0; t < 200; t++) {
      // Math.sin on both sides: this is testing the solver, not the gait.
      const phase = (Math.sin(t * 0.1) + 1) * 0.5;
      const max = REST_MAX * (1 - 0.4 * phase);
      const min = max * 0.85;

      conA.setDistance(min, max);
      conB.setDistance(min, max);

      sysA.tick(DT);
      sysB.tick(DT);
    }

    expect(Array.from(sysB.positions)).toEqual(Array.from(sysA.positions));
  });
});
