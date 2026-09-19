/**
 * A small bloom pass, hand-rolled.
 *
 * Three's own EffectComposer ships as an addon, and the UMD build the CSP
 * allows does not include addons — so this is written out rather than
 * imported. It is not a hardship: bloom is four shaders and a pair of render
 * targets, and the original medusae simulation used exactly this chain.
 *
 * Bloom is not decoration here. The creatures are drawn as translucent gel with
 * additive wireframe and additive strands over it, and additive geometry on
 * near-black looks thin and electric without a glow to bind it to the water.
 * The original's look — luminous, layered, faintly wet — is mostly this pass.
 *
 *   scene -> [bright pass] -> [blur H] -> [blur V] -> composite(scene + blur)
 *
 * Half-resolution targets throughout. The blur is the whole point of the
 * effect, so resolution buys nothing and costs a lot.
 */

(function (global) {
  "use strict";

  var QUAD_VERT = [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = vec4(position.xy, 0.0, 1.0);",
    "}",
  ].join("\n");

  // Keep only what is already bright, with a soft knee so the threshold does
  // not carve a hard edge through a gradient.
  var BRIGHT_FRAG = [
    "uniform sampler2D tDiffuse;",
    "uniform float threshold;",
    "uniform float knee;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 c = texture2D(tDiffuse, vUv);",
    "  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));",
    "  float w = smoothstep(threshold, threshold + knee, lum);",
    "  gl_FragColor = vec4(c.rgb * w, 1.0);",
    "}",
  ].join("\n");

  // Nine-tap gaussian, separable. `direction` is (1,0) or (0,1) in texels.
  var BLUR_FRAG = [
    "uniform sampler2D tDiffuse;",
    "uniform vec2 direction;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;",
    "  sum += texture2D(tDiffuse, vUv + direction * 1.3846153846) * 0.3162162162;",
    "  sum += texture2D(tDiffuse, vUv - direction * 1.3846153846) * 0.3162162162;",
    "  sum += texture2D(tDiffuse, vUv + direction * 3.2307692308) * 0.0702702703;",
    "  sum += texture2D(tDiffuse, vUv - direction * 3.2307692308) * 0.0702702703;",
    "  gl_FragColor = sum;",
    "}",
  ].join("\n");

  // Scene plus glow, then a vignette so the eye is pulled to the middle of the
  // tank rather than to its corners.
  var COMPOSITE_FRAG = [
    "uniform sampler2D tScene;",
    "uniform sampler2D tGlow;",
    "uniform float strength;",
    "uniform float vignette;",
    "varying vec2 vUv;",
    "void main() {",
    "  vec3 base = texture2D(tScene, vUv).rgb;",
    "  vec3 glow = texture2D(tGlow, vUv).rgb;",
    "  vec3 col = base + glow * strength;",
    "  vec2 d = vUv - 0.5;",
    "  float v = 1.0 - dot(d, d) * vignette;",
    "  gl_FragColor = vec4(col * clamp(v, 0.0, 1.0), 1.0);",
    "}",
  ].join("\n");

  function Bloom(renderer, options) {
    options = options || {};
    this.renderer = renderer;
    this.strength = options.strength !== undefined ? options.strength : 1.15;
    this.threshold = options.threshold !== undefined ? options.threshold : 0.22;
    this.knee = options.knee !== undefined ? options.knee : 0.28;
    this.vignette = options.vignette !== undefined ? options.vignette : 0.55;
    this.enabled = true;

    // A single triangle-pair in clip space; the vertex shader ignores the
    // camera entirely.
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeom = new THREE.PlaneBufferGeometry(2, 2);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: this.threshold },
        knee: { value: this.knee },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        direction: { value: new THREE.Vector2() },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tGlow: { value: null },
        strength: { value: this.strength },
        vignette: { value: this.vignette },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(this.quadGeom, this.brightMat);
    this.quadScene.add(this.quad);

    this.sceneTarget = null;
    this.targetA = null;
    this.targetB = null;
    this.width = 0;
    this.height = 0;
  }

  Bloom.prototype.setSize = function (width, height) {
    // Clamp before anything else. The page calls resize() from the same frame
    // it creates the canvas, and a canvas that has not been laid out yet
    // reports a zero bounding rect -- which produced a zero-size colour
    // attachment and an incomplete framebuffer, so every draw for the first
    // frames was dropped with GL_INVALID_FRAMEBUFFER_OPERATION.
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;

    var opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    };

    if (this.sceneTarget) this.sceneTarget.dispose();
    if (this.targetA) this.targetA.dispose();
    if (this.targetB) this.targetB.dispose();

    // The scene target is full resolution because it is what you actually
    // look at; the blur targets are half, because a blur has no detail to lose.
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, opts);
    var hw = Math.max(1, Math.floor(width / 2));
    var hh = Math.max(1, Math.floor(height / 2));
    this.targetA = new THREE.WebGLRenderTarget(hw, hh, opts);
    this.targetB = new THREE.WebGLRenderTarget(hw, hh, opts);
  };

  Bloom.prototype._pass = function (material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  };

  Bloom.prototype.render = function (scene, camera) {
    if (!this.enabled || !this.sceneTarget) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }

    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.brightMat.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.brightMat.uniforms.threshold.value = this.threshold;
    this.brightMat.uniforms.knee.value = this.knee;
    this._pass(this.brightMat, this.targetA);

    var hw = this.targetA.width;
    var hh = this.targetA.height;

    this.blurMat.uniforms.tDiffuse.value = this.targetA.texture;
    this.blurMat.uniforms.direction.value.set(1 / hw, 0);
    this._pass(this.blurMat, this.targetB);

    this.blurMat.uniforms.tDiffuse.value = this.targetB.texture;
    this.blurMat.uniforms.direction.value.set(0, 1 / hh);
    this._pass(this.blurMat, this.targetA);

    // A second, wider pass. One blur at half resolution gives a tight halo
    // that reads as a rendering artefact; two give the soft falloff that reads
    // as light in water.
    this.blurMat.uniforms.tDiffuse.value = this.targetA.texture;
    this.blurMat.uniforms.direction.value.set(2.5 / hw, 0);
    this._pass(this.blurMat, this.targetB);

    this.blurMat.uniforms.tDiffuse.value = this.targetB.texture;
    this.blurMat.uniforms.direction.value.set(0, 2.5 / hh);
    this._pass(this.blurMat, this.targetA);

    this.compositeMat.uniforms.tScene.value = this.sceneTarget.texture;
    this.compositeMat.uniforms.tGlow.value = this.targetA.texture;
    this.compositeMat.uniforms.strength.value = this.strength;
    this.compositeMat.uniforms.vignette.value = this.vignette;
    this._pass(this.compositeMat, null);
  };

  global.Bloom = Bloom;
})(window);
