/**
 * Deterministic arithmetic.
 *
 * Everything in the simulation that needs randomness or trigonometry goes
 * through this module, for one reason: a run must be reproducible from its
 * seed. `Math.random` is obviously out. Less obviously, so is `Math.sin` —
 * ECMA-262 does not specify the results of sin, cos, tan, exp, log or pow, only
 * that they be "implementation-approximated". V8 has changed its implementation
 * before and will again, and a fitness landscape that shifts under a Node
 * upgrade is not a fitness landscape.
 *
 * `Math.sqrt` IS specified (IEEE-754 exact) and is used freely.
 *
 * What we claim: two runs of the runner from the same seed produce identical
 * numbers, on any engine, forever. What we do NOT claim: that the browser's
 * playback of a creature matches the runner bit for bit. Browser playback is
 * visual only; stored fitness is the authority.
 */

// ..................................................
// Seeded randomness
//

/**
 * sfc32 — "Small Fast Counter", 32-bit.
 *
 * Chosen over the more familiar mulberry32 because it has a far larger state
 * (128 bits vs 32) and passes PractRand well beyond the point where mulberry32
 * fails. With only 32 bits of state you get a guaranteed cycle of 2^32, which
 * sounds like plenty until you realise a single long evolution run draws more
 * numbers than that.
 *
 * All arithmetic is forced back to uint32 with `>>> 0` after every step. This
 * is not decoration: JS numbers are doubles, and without it the additions
 * silently exceed 2^53 and stop being the algorithm.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  (): number;
}

export function sfc32(a: number, b: number, c: number, d: number): Rng {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;

  return function next(): number {
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    let t = (s0 + s1) >>> 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) >>> 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s3 = (s3 + 1) >>> 0;
    t = (t + s3) >>> 0;
    s2 = (s2 + t) >>> 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Build an RNG from a string seed.
 *
 * The first few outputs of sfc32 are poorly mixed when the state starts from
 * something structured, so we discard 12. This is the standard warm-up and
 * skipping it produces visibly correlated first draws across nearby seeds —
 * which matters here, because nearby seeds is exactly what mutation produces.
 */
export function rngFromSeed(seed: string): Rng {
  const h = hash128(seed);
  const rng = sfc32(h[0]!, h[1]!, h[2]!, h[3]!);
  for (let i = 0; i < 12; i++) rng();
  return rng;
}

/** Box-Muller, for mutation steps. Returns one standard normal sample. */
export function gaussian(rng: Rng): number {
  // u must not be 0 or log(0) is -Infinity.
  let u = rng();
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * cos(TAU * v);
}

// ..................................................
// Hashing
//

/** FNV-1a, 32-bit. Small, fast, good enough for seeding and content ids. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // h *= 16777619, done in 16-bit halves because a plain multiply overflows
    // the double's integer range and loses the low bits.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Four independent 32-bit words, for seeding sfc32's 128-bit state. */
export function hash128(s: string): [number, number, number, number] {
  const a = hash32(s);
  const b = hash32(`${s}${a}`);
  const c = hash32(`${s}${b}`);
  const d = hash32(`${s}${c}`);
  return [a, b, c, d];
}

/** Stable hex id from content. Used for genome ids. */
export function hashId(s: string): string {
  const [a, b, c, d] = hash128(s);
  return (
    a.toString(16).padStart(8, "0") +
    b.toString(16).padStart(8, "0") +
    c.toString(16).padStart(8, "0") +
    d.toString(16).padStart(8, "0")
  );
}

// ..................................................
// Trigonometry
//

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

/**
 * A quarter-wave sine table with linear interpolation between entries.
 *
 * Only a quarter is stored; the other three are reflections. 4096 entries over
 * a quarter turn puts samples about 0.00038 rad apart, and linear interpolation
 * across a gap that small carries a worst-case error near 1.8e-8 — far below
 * the noise the Verlet solver generates on its own, and utterly irrelevant next
 * to a creature's body being 20 units across.
 *
 * The table is built once at module load using Math.sin. That is not a
 * contradiction: the table is built from the SAME 4096 inputs every time, so
 * even if an engine's Math.sin differs in its last bit the table differs in its
 * last bit identically on every run of that engine — and we compare runs, not
 * engines. (If that ever stops being enough, the fix is to ship the table as
 * data rather than compute it.)
 */
const TABLE_BITS = 12;
const TABLE_SIZE = 1 << TABLE_BITS; // 4096
const TABLE: Float64Array = (() => {
  const t = new Float64Array(TABLE_SIZE + 1);
  for (let i = 0; i <= TABLE_SIZE; i++) {
    t[i] = Math.sin((i / TABLE_SIZE) * HALF_PI);
  }
  return t;
})();

/** Sine of the first quadrant only: x in [0, PI/2]. */
function quarterSin(x: number): number {
  const f = (x / HALF_PI) * TABLE_SIZE;
  const i = f | 0;
  if (i >= TABLE_SIZE) return TABLE[TABLE_SIZE]!;
  const frac = f - i;
  const a = TABLE[i]!;
  return a + (TABLE[i + 1]! - a) * frac;
}

/** Deterministic sine. Accurate to ~2e-8, identical across engines-to-itself. */
export function sin(x: number): number {
  // Reduce to [0, TAU). The `% TAU` on a negative gives a negative, hence the
  // second add.
  let t = x % TAU;
  if (t < 0) t += TAU;

  if (t <= HALF_PI) return quarterSin(t);
  if (t <= PI) return quarterSin(PI - t);
  if (t <= PI + HALF_PI) return -quarterSin(t - PI);
  return -quarterSin(TAU - t);
}

/** Deterministic cosine. */
export function cos(x: number): number {
  return sin(x + HALF_PI);
}

// ..................................................
// Scalars
//

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map x from [inLo, inHi] onto [outLo, outHi]. No clamping. */
export function mapLinear(
  x: number,
  inLo: number,
  inHi: number,
  outLo: number,
  outHi: number,
): number {
  return outLo + ((x - inLo) * (outHi - outLo)) / (inHi - inLo);
}

/**
 * Fold a value back into [lo, hi] by reflecting off the ends.
 *
 * This is how gene mutation stays in range, and the choice matters more than it
 * looks. Clamping would pile probability mass exactly on 0 and 1 — a mutation
 * that overshoots lands *on* the boundary rather than near it — and over
 * hundreds of generations those two points become attractors that the selection
 * pressure never put there. Reflection preserves the density.
 *
 * Loops rather than reflecting once, because a large sigma can overshoot the
 * far side too.
 */
export function reflect(x: number, lo: number, hi: number): number {
  if (hi <= lo) return lo;
  let v = x;
  let guard = 0;
  while ((v < lo || v > hi) && guard++ < 64) {
    if (v < lo) v = lo + (lo - v);
    if (v > hi) v = hi - (v - hi);
  }
  return clamp(v, lo, hi);
}

/**
 * Catmull-Rom through four control points, evaluated at t in [0, 1] between
 * p1 and p2. This is how a handful of genes become a smooth body profile
 * without any one mutation producing a zigzag.
 */
export function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Sample a closed-ended Catmull-Rom spline through `points` at u in [0, 1].
 * Endpoints are duplicated so the curve starts and ends exactly on them.
 */
export function splineAt(points: readonly number[], u: number): number {
  const n = points.length;
  if (n === 0) return 0;
  if (n === 1) return points[0]!;
  const x = clamp(u, 0, 1) * (n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const t = x - i;
  const p0 = points[Math.max(i - 1, 0)]!;
  const p1 = points[i]!;
  const p2 = points[i + 1]!;
  const p3 = points[Math.min(i + 2, n - 1)]!;
  return catmullRom(p0, p1, p2, p3, t);
}

// ..................................................
// Vec3 over flat arrays
//
// Every position buffer in the system is a flat xyz-interleaved Float32Array,
// so these take an array plus a particle index rather than a vector object.
// No allocation anywhere in the hot path.
//

export function vset(
  a: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
): void {
  const ix = i * 3;
  a[ix] = x;
  a[ix + 1] = y;
  a[ix + 2] = z;
}

export function vdistance(a: Float32Array, i: number, j: number): number {
  const ix = i * 3;
  const jx = j * 3;
  const dx = a[jx]! - a[ix]!;
  const dy = a[jx + 1]! - a[ix + 1]!;
  const dz = a[jx + 2]! - a[ix + 2]!;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
