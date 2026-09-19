/**
 * Turning a developed body into something worth looking at.
 *
 * The first version of this drew one opaque teal mesh with a faint wireframe,
 * and it looked like a lampshade. What the original medusae simulation had and
 * this did not was layering: a very transparent gel, additive glow over it,
 * fine additive strands, and colour that CHANGES along the body. None of that
 * is expensive; all of it is the difference between a shape and an animal.
 *
 * Four layers, drawn over one another, all sharing a single position buffer
 * that the solver writes into directly:
 *
 *   1. gel      translucent, depth-write off, the body's mass
 *   2. rim      additive wireframe, the structure showing through
 *   3. dots     additive points, the particles themselves
 *   4. strands  additive lines, the tentacles
 *
 * Per-particle colour is what carries the gradient. It costs one Float32Array
 * built once per creature, and it is the single largest visual improvement
 * available — a bell shading from one colour at the apex to another at the
 * margin reads as a living thing lit from inside, where a flat one never does.
 */

(function (global) {
  "use strict";

  function hex(c) {
    return new THREE.Color(c);
  }

  /**
   * Per-particle colours, from the palette and the body's own structure.
   *
   * The bell is coloured by rib index — apex to margin — which the cavity
   * description already carries, since the jet needs to know the same rings.
   * Tentacles are coloured along their length, which needs the strand count,
   * and that comes from the genome rather than the mesh.
   */
  function buildColors(phenotype, traits, palette) {
    var n = phenotype.particleCount;
    var colors = new Float32Array(n * 3);

    var top = hex(palette.bellTop);
    var mid = hex(palette.bellMid || palette.bellTop);
    var margin = hex(palette.bellMargin);
    var near = hex(palette.tentacleNear);
    var tip = hex(palette.tentacleTip);
    var scratch = new THREE.Color();

    // Apex to margin in TWO segments, through a named midpoint.
    //
    // A single lerp between two distant hues walks straight through the
    // washed-out middle of the colour cube: mint to gold passes through a
    // 35%-saturation olive, and that olive is not a sliver, it is the whole
    // midband of the bell and the largest area on screen. The middle stop
    // chooses the route the sweep takes instead of letting RGB choose it.
    function bellAt(t) {
      if (t < 0.5) return scratch.copy(top).lerp(mid, t * 2);
      return scratch.copy(mid).lerp(margin, (t - 0.5) * 2);
    }

    var cavity = phenotype.cavity;
    var rings = cavity ? cavity.rings : null;
    var ringSize = cavity ? cavity.ringSize : 0;
    var bellParticles = rings ? 1 + rings.length * ringSize : n;

    // Apex.
    colors[0] = top.r;
    colors[1] = top.g;
    colors[2] = top.b;

    if (rings) {
      for (var r = 0; r < rings.length; r++) {
        var t = rings.length > 1 ? r / (rings.length - 1) : 0;
        bellAt(t);
        for (var j = 0; j < ringSize; j++) {
          var idx = (rings[r] + j) * 3;
          colors[idx] = scratch.r;
          colors[idx + 1] = scratch.g;
          colors[idx + 2] = scratch.b;
        }
      }
    }

    var tentacleParticles = n - bellParticles;
    if (tentacleParticles > 0) {
      var strands =
        Math.round(traits.tentaclesPerSector) * Math.round(traits.radialSymmetry);
      var segs = strands > 0 ? Math.max(1, Math.round(tentacleParticles / strands)) : 1;

      for (var i = 0; i < tentacleParticles; i++) {
        var s = (i % segs) / Math.max(1, segs - 1);
        scratch.copy(near).lerp(tip, Math.min(1, s));
        var k = (bellParticles + i) * 3;
        colors[k] = scratch.r;
        colors[k + 1] = scratch.g;
        colors[k + 2] = scratch.b;
      }
    }

    return colors;
  }

  /**
   * Assemble the four layers for one creature.
   *
   * Everything shares `geometry`'s position attribute, so a single
   * `needsUpdate` per frame moves all four. The separate line geometry borrows
   * the very same attribute object rather than copying it.
   */
  function build(live, traits, palette) {
    var ph = live.phenotype;
    var group = new THREE.Group();

    var bulb = null;
    var tent = null;
    for (var s = 0; s < ph.surfaces.length; s++) {
      if (ph.surfaces[s].name === "bulb") bulb = ph.surfaces[s];
      if (ph.surfaces[s].name === "tentacles") tent = ph.surfaces[s];
    }

    var geometry = new THREE.BufferGeometry();
    var positionAttr = new THREE.BufferAttribute(live.positions, 3);
    geometry.setAttribute("position", positionAttr);
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(buildColors(ph, traits, palette), 3),
    );

    if (bulb && bulb.faces.length) {
      geometry.setIndex(new THREE.BufferAttribute(bulb.faces, 1));
      geometry.computeVertexNormals();

      // The gel. Very transparent, and depthWrite off so the far side of the
      // bell shows through the near side — which is most of what makes a
      // jellyfish look like one.
      group.add(new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
        vertexColors: true,
        emissive: hex(palette.gel),
        emissiveIntensity: 0.72,
        specular: hex(palette.glow),
        shininess: 70,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.NormalBlending,
      })));

      // The rim: the mesh's own structure, additively. Faint on its own, and
      // the main thing the bloom pass picks up.
      group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        vertexColors: true,
        wireframe: true,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })));
    }

    // The particles themselves. The original drew its bulb as dots and it is
    // why that simulation reads as something suspended in water rather than a
    // surface: you can see the sampling.
    var dots = new THREE.Points(geometry, new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.55,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    dots.name = "dots";
    group.add(dots);

    if (tent && tent.lines.length) {
      var lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute("position", positionAttr);
      lineGeom.setAttribute("color", geometry.getAttribute("color"));
      lineGeom.setIndex(new THREE.BufferAttribute(tent.lines, 1));
      group.add(new THREE.LineSegments(lineGeom, new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })));
    }

    return { group: group, geometry: geometry };
  }

  global.CreatureRender = { build: build, buildColors: buildColors };
})(window);
