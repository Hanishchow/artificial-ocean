/**
 * The mesh-topology kit: rings, loops, radial fans, and the buffers they fill.
 *
 * Generalised from App.Geometry / App.Links / App.Faces
 * (app.develop.js:66-128, 225-247, 275-331), Artistic-2.0, Ash Weeks.
 *
 * The originals are four tiny namespaces of push-into-an-array helpers, and
 * they are the one part of the reference creature worth keeping verbatim: they
 * know nothing about jellyfish, only about how to wire a ring of particles to
 * the ring above it. Everything a radially symmetric body needs is here.
 *
 * What is new is the BodyBuilder around them. The reference scattered its
 * buffers across a dozen instance fields and tracked particle offsets by hand
 * in every build function, which is exactly the kind of bookkeeping that makes
 * a body plan impossible to parameterise. Here a ring hands back its own index
 * and the builder owns the counters.
 */

import { TAU, cos, sin } from "@ocean/mathx";

/** Where a run of particles lives in the buffers. */
export interface Span {
  readonly index: number;
  readonly count: number;
}

// ..................................................
// Free functions — the literal port
//

/** A closed ring of `segments` points at height y, in the XZ plane. */
export function circle(
  segments: number,
  radius: number,
  y: number,
  out: number[],
): number[] {
  const step = TAU / segments;
  let angle = 0;
  for (let i = 0; i < segments; i++) {
    out.push(cos(angle) * radius, y, sin(angle) * radius);
    angle += step;
  }
  return out;
}

/** Chain consecutive particles: a-b, b-c, c-d. Open. */
export function linkLine(index: number, howMany: number, out: number[]): number[] {
  for (let i = 0; i < howMany - 1; i++) {
    out.push(index + i, index + i + 1);
  }
  return out;
}

/** Chain consecutive particles and close the ring. */
export function linkLoop(index: number, howMany: number, out: number[]): number[] {
  for (let i = 0; i < howMany - 1; i++) {
    out.push(index + i, index + i + 1);
  }
  if (howMany > 1) out.push(index, index + howMany - 1);
  return out;
}

/** Join two rings of equal size, particle i to particle i. */
export function linkRings(
  index0: number,
  index1: number,
  howMany: number,
  out: number[],
): number[] {
  for (let i = 0; i < howMany; i++) {
    out.push(index0 + i, index1 + i);
  }
  return out;
}

/** Spoke every particle of a ring back to one central particle. */
export function linkRadial(
  indexCentre: number,
  index: number,
  howMany: number,
  out: number[],
): number[] {
  for (let i = 0; i < howMany; i++) {
    out.push(indexCentre, index + i);
  }
  return out;
}

/** Two triangles spanning a quad. */
export function faceQuad(
  a: number,
  b: number,
  c: number,
  d: number,
  out: number[],
): number[] {
  out.push(a, b, c, c, d, a);
  return out;
}

/** As faceQuad, wound both ways — for surfaces seen from inside and out. */
export function faceQuadDoubleSide(
  a: number,
  b: number,
  c: number,
  d: number,
  out: number[],
): number[] {
  out.push(a, b, c, c, d, a, d, c, b, b, a, d);
  return out;
}

/** A triangle fan from a centre particle to a closed ring. */
export function faceRadial(
  indexCentre: number,
  index: number,
  howMany: number,
  out: number[],
): number[] {
  for (let i = 0; i < howMany - 1; i++) {
    out.push(indexCentre, index + i + 1, index + i);
  }
  out.push(indexCentre, index, index + howMany - 1);
  return out;
}

/** A closed band of quads between two equal rings. */
export function faceRings(
  index0: number,
  index1: number,
  howMany: number,
  out: number[],
): number[] {
  for (let i = 0; i < howMany - 1; i++) {
    faceQuad(index0 + i, index0 + i + 1, index1 + i + 1, index1 + i, out);
  }
  faceQuad(
    index0 + howMany - 1,
    index0,
    index1,
    index1 + howMany - 1,
    out,
  );
  return out;
}

// ..................................................
// The builder
//

/**
 * Accumulates a body: particles, their physical properties, the constraint
 * groups that hold them together, and the surfaces that draw them.
 *
 * Constraint links are collected per GROUP rather than into one pile, because
 * a group is the unit an actuator drives. Development says "these are the outer
 * rim links of rib 7" and gets back a group id it can later hand to an
 * ActuatorSpec; the alternative is the reference's approach of keeping named
 * references to individual constraint objects on each rib, which works exactly
 * as long as the number of named parts never changes.
 */
export class BodyBuilder {
  private readonly verts: number[] = [];
  private readonly weights: number[] = [];
  private readonly areas: number[] = [];
  private readonly groups = new Map<number, number[]>();
  private nextGroup = 0;

  get particleCount(): number {
    return this.verts.length / 3;
  }

  /** Add one particle, returning its index. */
  addPoint(x: number, y: number, z: number, weight = 1, area = 1): number {
    const index = this.particleCount;
    this.verts.push(x, y, z);
    this.weights.push(weight);
    this.areas.push(area);
    return index;
  }

  /**
   * Add a ring of `segments` particles at height y, returning its span.
   *
   * `phase` rotates the ring. Successive rings are offset slightly in the
   * reference body, and the same trick is needed here for a subtler reason:
   * a perfectly aligned stack of rings is a symmetric equilibrium, and a
   * symmetric equilibrium is one the solver has no reason to leave. A body
   * built with zero phase offset will pulse without ever tipping, drifting or
   * turning — technically alive, visibly inert.
   */
  addRing(
    segments: number,
    radius: number,
    y: number,
    weight = 1,
    area = 1,
    phase = 0,
  ): Span {
    const index = this.particleCount;
    const step = TAU / segments;
    let angle = phase;
    for (let i = 0; i < segments; i++) {
      this.verts.push(cos(angle) * radius, y, sin(angle) * radius);
      this.weights.push(weight);
      this.areas.push(area);
      angle += step;
    }
    return { index, count: segments };
  }

  /** Reserve a new constraint group and return its id. */
  createGroup(): number {
    const id = this.nextGroup++;
    this.groups.set(id, []);
    return id;
  }

  /** Append index pairs (or triples) to a group. */
  addToGroup(group: number, indices: readonly number[]): void {
    const buf = this.groups.get(group);
    if (!buf) throw new Error(`unknown constraint group ${group}`);
    for (let i = 0; i < indices.length; i++) buf.push(indices[i]!);
  }

  /** Collect into a scratch array, then commit it to a group. */
  collect(group: number, fill: (out: number[]) => void): void {
    const scratch: number[] = [];
    fill(scratch);
    this.addToGroup(group, scratch);
  }

  groupIndices(group: number): Uint32Array {
    const buf = this.groups.get(group);
    if (!buf) throw new Error(`unknown constraint group ${group}`);
    return Uint32Array.from(buf);
  }

  groupIds(): number[] {
    return [...this.groups.keys()];
  }

  /** Mean length of the pairs in a distance group, in the rest pose. */
  meanPairLength(group: number): number {
    const idx = this.groupIndices(group);
    const v = this.verts;
    if (idx.length < 2) return 0;

    let total = 0;
    let pairs = 0;
    for (let i = 0; i + 1 < idx.length; i += 2) {
      const a = idx[i]! * 3;
      const b = idx[i + 1]! * 3;
      const dx = v[b]! - v[a]!;
      const dy = v[b + 1]! - v[a + 1]!;
      const dz = v[b + 2]! - v[a + 2]!;
      total += Math.sqrt(dx * dx + dy * dy + dz * dz);
      pairs++;
    }
    return pairs > 0 ? total / pairs : 0;
  }

  positions(): Float32Array {
    return Float32Array.from(this.verts);
  }

  weightArray(): Float32Array {
    return Float32Array.from(this.weights);
  }

  areaArray(): Float32Array {
    return Float32Array.from(this.areas);
  }

  /** Axis-aligned extent of the rest pose: [radius in XZ, height in Y]. */
  bounds(): { radius: number; height: number } {
    const v = this.verts;
    if (v.length === 0) return { radius: 0, height: 0 };

    let maxR2 = 0;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < v.length; i += 3) {
      const x = v[i]!;
      const y = v[i + 1]!;
      const z = v[i + 2]!;
      const r2 = x * x + z * z;
      if (r2 > maxR2) maxR2 = r2;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return { radius: Math.sqrt(maxR2), height: maxY - minY };
  }
}
