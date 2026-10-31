/* native-promise-only skipped: native Promise available */

/* ---- ..\medusae-deps\package\dist\particulate.js ---- */
// ..................................................
// Particulate.js
//
// version : 0.3.2
// authors : Jay Weeks
// license : MIT
// particulatejs.org
// ..................................................

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('particulate', [], function () {
      return (root['Particulate'] = factory());
    });
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root['Particulate'] = factory();
  }
}(this, function () {
  'use strict';
  var lib;

/**
  @class Particulate
  @static
*/
lib = { VERSION : '0.3.2' };


/**
  @module utils
*/

/**
  Collection utilities.

  @class Collection
  @static
*/
var Collection = lib.Collection = {};

/**
  Remove all instances of an object from an array.

  @method removeAll
  @param {Array} buffer  Collection of objects
  @param {any}   item    Item to remove from collection
*/
Collection.removeAll = function (buffer, item) {
  var index = buffer.indexOf(item);
  if (index < 0) { return; }

  for (var i = buffer.length - 1; i >= index; i --) {
    if (buffer[i] === item) {
      buffer.splice(i, 1);
    }
  }
};


/**
  @module utils
  @class Particulate
*/

/**
  Functional constructor utility.

  @method ctor
  @param  {Function} Ctor         Constructor function used to instantiate class
  @return {Function} constructor
  @private
  @static
*/
lib.ctor = function ctor(Ctor) {
  return function () {
    var instance = Object.create(Ctor.prototype);
    Ctor.apply(instance, arguments);
    return instance;
  };
};


/**
  @module math
  @main math
*/

/**
  Math utilities.

  @class Math
  @static
*/
lib.Math = {};

/**
  Clamp value to `[min, max]` range.

  @method clamp
  @static
  @param  {Float} min
  @param  {Float} max
  @param  {Float} v    Value to clamp
  @return {Float} Clamped value
*/
lib.Math.clamp = function (min, max, v) {
  return Math.min(Math.max(v, min), max);
};


// ..................................................
// Vec3
// ..................................................

var Vec3 = lib.Vec3 = {};

/**
  @module math
*/

/**
  Vector utilities.

  @class Vec3
  @static
*/

/**
  @method create
  @static
  @param  {Int|Array}    positions  Number of vectors or array of initial values
  @return {Float32Array} Vec3 buffer
*/
Vec3.create = function (positions) {
  positions = positions || 1;
  var isCount = typeof positions === 'number';
  return new Float32Array(isCount ? positions * 3 : positions);
};

/**
  Set single vector in buffer

  @method set
  @static
  @param {Array}        b0  Vec3 buffer
  @param {Int}          i   Vector index
  @param {Array|Float}  x   Vector or x component value
  @param {Float}       [y]
  @param {Float}       [z]
*/
Vec3.set = function (b0, i, x, y, z) {
  var ix = i * 3, iy = ix + 1, iz = ix + 2;

  if (y == null) {
    z = x[2];
    y = x[1];
    x = x[0];
  }

  b0[ix] = x;
  b0[iy] = y;
  b0[iz] = z;
};

/**
  @method copy
  @static
  @param {Array} b0   Vec3 buffer
  @param {Int}   ai   Vector index
  @param {Array} out  Destination vector
*/
Vec3.copy = function (b0, ai, out) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;

  out[0] = b0[aix];
  out[1] = b0[aiy];
  out[2] = b0[aiz];

  return out;
};

/**
  @method lengthSq
  @static
  @param  {Array} b0   Vec3 buffer
  @param  {Int}   ai   Vector index
  @return {Float} Squared length of vector
*/
Vec3.lengthSq = function (b0, ai) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var x = b0[aix];
  var y = b0[aiy];
  var z = b0[aiz];

  return x * x + y * y + z * z;
};

/**
  @method length
  @static
  @param  {Array} b0   Vec3 buffer
  @param  {Int}   ai   Vector index
  @return {Float} Length of vector
*/
Vec3.length = function (b0, ai) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var x = b0[aix];
  var y = b0[aiy];
  var z = b0[aiz];

  return Math.sqrt(x * x + y * y + z * z);
};

/**
  @method distanceSq
  @static
  @param  {Array} b0   Vec3 buffer
  @param  {Int}   ai   Vector index a
  @param  {Int}   bi   Vector index b
  @return {Float} Squared distance from a to b
*/
Vec3.distanceSq = function (b0, ai, bi) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;

  var dx = b0[aix] - b0[bix];
  var dy = b0[aiy] - b0[biy];
  var dz = b0[aiz] - b0[biz];

  return dx * dx + dy * dy + dz * dz;
};

/**
  @method distance
  @static
  @param  {Array} b0   Vec3 buffer
  @param  {Int}   ai   Vector index a
  @param  {Int}   bi   Vector index b
  @return {Float} Distance from a to b
*/
Vec3.distance = function (b0, ai, bi) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;

  var dx = b0[aix] - b0[bix];
  var dy = b0[aiy] - b0[biy];
  var dz = b0[aiz] - b0[biz];

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
  Normalize vector in place

  @method normalize
  @static
  @param {Array} b0  Vec3 buffer
  @param {Int}   ai  Vector index a
*/
Vec3.normalize = function (b0, ai) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var x = b0[aix];
  var y = b0[aiy];
  var z = b0[aiz];
  var lenInv = 1 / Math.sqrt(x * x + y * y + z * z);

  b0[aix] *= lenInv;
  b0[aiy] *= lenInv;
  b0[aiz] *= lenInv;
};

/**
  Calculate angle between segments `ab` and `bc`

  @method angle
  @static
  @param  {Array} b0   Vec3 buffer
  @param  {Int}   ai   Vector index a
  @param  {Int}   bi   Vector index b
  @param  {Int}   ci   Vector index c
  @return {Float} Angle in radians
*/
Vec3.angle = function (b0, ai, bi, ci) {
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;
  var cix = ci * 3, ciy = cix + 1, ciz = cix + 2;

  var baLenInv = 1 / Vec3.distance(b0, bi, ai);
  var bcLenInv = 1 / Vec3.distance(b0, bi, ci);

  var baX = (b0[aix] - b0[bix]) * baLenInv;
  var baY = (b0[aiy] - b0[biy]) * baLenInv;
  var baZ = (b0[aiz] - b0[biz]) * baLenInv;

  var bcX = (b0[cix] - b0[bix]) * bcLenInv;
  var bcY = (b0[ciy] - b0[biy]) * bcLenInv;
  var bcZ = (b0[ciz] - b0[biz]) * bcLenInv;

  var dot = baX * bcX + baY * bcY + baZ * bcZ;

  return Math.acos(dot);
};


// ..................................................
// Force
// ..................................................

lib.Force = Force;

/**
  Forces are accumulated and applied to particles, affecting their
  acceleration and velocity in the system's integration step.

  @module forces
  @main forces
*/

/**
  Base class for defining forces.

  @class Force
  @constructor
  @param {Array (Vec3)}  vector
  @param {Object}       [opts]       Options
  @param {Int (Enum)}   [opts.type]
*/
function Force(vector, opts) {
  opts = opts || {};
  this.vector = new Float32Array(3);

  if (opts.type) { this.type = opts.type; }
  if (vector != null) { this.set(vector); }
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
Force.create = lib.ctor(Force);

/**
  Force type enum: `Force.ATTRACTOR`, `Force.REPULSOR`, `Force.ATTRACTOR_REPULSOR`.

  @property type
  @type {Int (Enum)}
  @default Force.ATTRACTOR
*/
Force.ATTRACTOR = 0;
Force.REPULSOR = 1;
Force.ATTRACTOR_REPULSOR = 2;
Force.prototype.type = Force.ATTRACTOR;

/**
  Alias for `Vec3.set`.

  @method set
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
Force.prototype.set = function (x, y, z) {
  lib.Vec3.set(this.vector, 0, x, y, z);
};

/**
  Apply force to one particle in system.

  @method applyForce
  @param {Int}                 ix  Particle vector `x` index
  @param {Float32Array (Vec3)} f0  Reference to `ParticleSystem.accumulatedForces`
  @param {Float32Array (Vec3)} p0  Reference to `ParticleSystem.positions`
  @param {Float32Array (Vec3)} p1  Reference to `ParticleSystem.positionsPrev`
  @protected
*/
Force.prototype.applyForce = function (ix, f0, p0, p1) {};


// ..................................................
// DirectionalForce
// ..................................................

lib.DirectionalForce = DirectionalForce;

/**
  @module forces
*/

/**
  Defines a directional force that affects all particles in the system.

  ```javascript
  var gravity = DirectionalForce.create([0.0, -0.1, 0.0]);
  ```

  @class DirectionalForce
  @extends Force
  @constructor
  @param {Array (Vec3)} vector  Direction vector
*/
function DirectionalForce(vector) {
  lib.Force.call(this, vector);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
DirectionalForce.create = lib.ctor(DirectionalForce);
DirectionalForce.prototype = Object.create(lib.Force.prototype);
DirectionalForce.prototype.constructor = DirectionalForce;

DirectionalForce.prototype.applyForce = function (ix, f0, p0, p1) {
  var v0 = this.vector;
  f0[ix]     += v0[0];
  f0[ix + 1] += v0[1];
  f0[ix + 2] += v0[2];
};


// ..................................................
// PointForce
// ..................................................

lib.PointForce = PointForce;

/**
  @module forces
*/

/**
  Defines a directional force that affects all particles in the system.

  ```javascript
  var repulsor = PointForce.create([0.0, 2.0, 3.0], {
    type : Force.REPULSOR,
    radius : 15.0,
    intensity : 0.1
  });
  ```

  @class PointForce
  @extends Force
  @constructor
  @param {Array (Vec3)}  position         Force position
  @param {Object}       [opts]            Options
  @param {Int (Enum)}   [opts.type]
  @param {Float}        [opts.radius]
  @param {Float}        [opts.intensity]
*/
function PointForce(position, opts) {
  opts = opts || {};
  lib.Force.apply(this, arguments);

  /**
    Magnitude of force vector

    @property intensity
    @type Float
    @default 0.05
  */
  this.intensity = opts.intensity || 0.05;

  this.setRadius(opts.radius || 0);
}

var pf_ATTRACTOR = lib.Force.ATTRACTOR;
var pf_REPULSOR = lib.Force.REPULSOR;
var pf_ATTRACTOR_REPULSOR = lib.Force.ATTRACTOR_REPULSOR;

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
PointForce.create = lib.ctor(PointForce);
PointForce.prototype = Object.create(lib.Force.prototype);
PointForce.prototype.constructor = PointForce;

/**
  Set radius

  @method setRadius
  @param {Float} r  Radius
*/
PointForce.prototype.setRadius = function (r) {
  this._radius2 = r * r;
};

/**
  Cached value of squared influence radius

  @property _radius2
  @type Float
  @private
*/
PointForce.prototype._radius2 = null;

PointForce.prototype.applyForce = function (ix, f0, p0, p1) {
  var v0 = this.vector;
  var iy = ix + 1;
  var iz = ix + 2;

  var dx = p0[ix] - v0[0];
  var dy = p0[iy] - v0[1];
  var dz = p0[iz] - v0[2];

  var dist = dx * dx + dy * dy + dz * dz;
  var diff = dist - this._radius2;
  var isActive, scale;

  switch (this.type) {
  case pf_ATTRACTOR:
    isActive = dist > 0 && diff > 0;
    break;
  case pf_REPULSOR:
    isActive = dist > 0 && diff < 0;
    break;
  case pf_ATTRACTOR_REPULSOR:
    isActive = dx || dy || dz;
    break;
  }

  if (isActive) {
    scale = diff / dist * this.intensity;

    f0[ix] -= dx * scale;
    f0[iy] -= dy * scale;
    f0[iz] -= dz * scale;
  }
};


// ..................................................
// Constraint
// ..................................................

lib.Constraint = Constraint;

/**
  Constraints define relationships between multiple particles or
  between particles and geometric primitives.

  @module constraints
  @main constraints
*/

/**
  Base class for defining particle constraints.

  @class Constraint
  @constructor
  @param {Int} size           Number of indices to be stored
  @param {Int} itemSize       Number of particles per constraint relation
  @param {Int} [indexOffset]  Number of indices to save at beginning of index array
*/
function Constraint(size, itemSize, indexOffset) {
  indexOffset = indexOffset || 0;

  /**
    Particle indices defining constraint relations

    @property indices
    @type Uint16Array
  */
  this.indices = new Uint16Array(size + indexOffset);

  /**
    Number of constraint relations managed by this instance

    @property _count
    @type Int
    @private
  */
  this._count = size / itemSize;

  /**
    Number of particles per constraint relation

    @property _itemSize
    @type Int
    @private
  */
  this._itemSize = itemSize;

  /**
    Number of indices to save at beginning of index array

    @property _offset
    @type Int
    @private
  */
  this._offset = indexOffset;
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
Constraint.create = lib.ctor(Constraint);

/**
  Set particle indices with `Array` or list of `arguments`.

  @method setIndices
  @param {Int|Array} indices  Single or many particle indices
  @param {Int}       [...a]   Particle index
*/
Constraint.prototype.setIndices = function (indices) {
  var offset = this._offset;
  var inx = indices.length ? indices : arguments;
  var ii = this.indices;

  for (var i = 0; i < inx.length; i ++) {
    ii[i + offset] = inx[i];
  }
};

/**
  Apply constraint to one set of particles defining a constrint relation.
  Called `_count` times per relaxation loop.

  @method applyConstraint
  @param {Int}                 index  Constraint set index
  @param {Float32Array (Vec3)} p0     Reference to `ParticleSystem.positions`
  @param {Float32Array (Vec3)} p1     Reference to `ParticleSystem.positionsPrev`
  @protected
*/
Constraint.prototype.applyConstraint = function (index, p0, p1) {};


// ..................................................
// AngleConstraint
// ..................................................

lib.AngleConstraint = AngleConstraint;

/**
  @module constraints
*/

/**
  Defines one or many relationships between sets of three particles.

  ```javascript
  var a = 0, b = 1, c = 2;
  var single = AngleConstraint.create(Math.PI, a, b, c);
  var many = AngleConstraint.create(Math.PI, [a, b, c, b, c, a]);
  ```

  Particles are constrained by a fixed angle or an angle range.
  The angle is defined by segments `ab` and `bc`.

  ```javascript
  var min = Math.PI * 0.25, max = Math.PI * 0.5;
  var fixed = AngleConstraint.create(max, 0, 1, 2);
  var range = AngleConstraint.create([min, max], 0, 1, 2);
  ```

  @class AngleConstraint
  @extends Constraint
  @constructor
  @param {Float|Array}  angle  Angle or angle range `[min, max]` between particles
  @param {Int|Array}    a      Particle index or list of many constraint sets
  @param {Int}         [b]     Particle index (only used if `a` is not an array)
  @param {Int}         [c]     Particle index (only used if `a` is not an array)
*/
function AngleConstraint(angle, a, b, c) {
  var size = a.length || arguments.length - 1;
  var min = angle.length ? angle[0] : angle;
  var max = angle.length ? angle[1] : angle;

  lib.Constraint.call(this, size, 3);
  this.setAngle(min, max);
  this.setIndices(a, b, c);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
AngleConstraint.create = lib.ctor(AngleConstraint);
AngleConstraint.prototype = Object.create(lib.Constraint.prototype);
AngleConstraint.prototype.constructor = AngleConstraint;

/**
  Set angle

  @method setAngle
  @param {Float}  min
  @param {Float} [max]
*/
AngleConstraint.prototype.setAngle = function (min, max) {
  max = max != null ? max : min;
  this.setMin(min);
  this.setMax(max);
};

/**
  Set minimum angle

  @method setMin
  @param {Float} min
*/
AngleConstraint.prototype.setMin = function (min) {
  this._min = this.clampAngle(min);
};

/**
  Minimum angle

  @property _min
  @type Float
  @private
*/
AngleConstraint.prototype._min = null;

/**
  Set maximum angle

  @method setMax
  @param {Float} max
*/
AngleConstraint.prototype.setMax = function (max) {
  this._max = this.clampAngle(max);
};

/**
  Maximum angle

  @property _max
  @type Float
  @private
*/
AngleConstraint.prototype._max = null;

AngleConstraint.prototype.clampAngle = function (angle) {
  var p = 0.0000001;
  return lib.Math.clamp(p, Math.PI - p, angle);
};

/**
  Angle used to classify obtuse angles in constraint solver. For accute angles,
  only particles `a` and `c` are repositioned to satisfy the particle set's
  target angle. For obtuse angles, particle `b` is also repositioned.

  @property ANGLE_OBTUSE
  @type Float
  @default 3/4 Π
  @static
  @final
*/
AngleConstraint.ANGLE_OBTUSE = Math.PI * 0.75;

// TODO: Optimize, reduce usage of Math.sqrt
AngleConstraint.prototype.applyConstraint = function (index, p0, p1) {
  /*jshint maxcomplexity:15*/

  var ii = this.indices;
  var ai = ii[index], bi = ii[index + 1], ci = ii[index + 2];

  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;
  var cix = ci * 3, ciy = cix + 1, ciz = cix + 2;

  // AB (A -> B)
  var abX = p0[bix] - p0[aix];
  var abY = p0[biy] - p0[aiy];
  var abZ = p0[biz] - p0[aiz];

  // BC (B -> C)
  var bcX = p0[cix] - p0[bix];
  var bcY = p0[ciy] - p0[biy];
  var bcZ = p0[ciz] - p0[biz];

  // AC (A -> C)
  var acX = p0[cix] - p0[aix];
  var acY = p0[ciy] - p0[aiy];
  var acZ = p0[ciz] - p0[aiz];

  // Perturb coincident particles
  if (!(acX || acY || acZ)) {
    p0[aix] += 0.1;
    p0[biy] += 0.1;
    p0[cix] -= 0.1;
    return;
  }

  var abLenSq = abX * abX + abY * abY + abZ * abZ;
  var bcLenSq = bcX * bcX + bcY * bcY + bcZ * bcZ;
  var acLenSq = acX * acX + acY * acY + acZ * acZ;

  var abLen = Math.sqrt(abLenSq);
  var bcLen = Math.sqrt(bcLenSq);
  var acLen = Math.sqrt(acLenSq);

  var abLenInv = 1 / abLen;
  var bcLenInv = 1 / bcLen;

  var minAngle = this._min;
  var maxAngle = this._max;
  var bAngle = Math.acos(
    -abX * abLenInv * bcX * bcLenInv +
    -abY * abLenInv * bcY * bcLenInv +
    -abZ * abLenInv * bcZ * bcLenInv);

  if (bAngle > minAngle && bAngle < maxAngle) { return; }
  var bAngleTarget = bAngle < minAngle ? minAngle : maxAngle;

  // Target length for AC
  var acLenTargetSq = abLenSq + bcLenSq - 2 * abLen * bcLen * Math.cos(bAngleTarget);
  var acLenTarget = Math.sqrt(acLenTargetSq);
  var acDiff = (acLen - acLenTarget) / acLen * 0.5;

  p0[aix] += acX * acDiff;
  p0[aiy] += acY * acDiff;
  p0[aiz] += acZ * acDiff;

  p0[cix] -= acX * acDiff;
  p0[ciy] -= acY * acDiff;
  p0[ciz] -= acZ * acDiff;

  // Only manipulate particle B for obtuse targets
  if (bAngleTarget < AngleConstraint.ANGLE_OBTUSE) { return; }

  // Target angle for A
  var aAngleTarget = Math.acos((abLenSq + acLenTargetSq - bcLenSq) / (2 * abLen * acLenTarget));

  // Unit vector AC
  var acLenInv = 1 / acLen;
  var acuX = acX * acLenInv;
  var acuY = acY * acLenInv;
  var acuZ = acZ * acLenInv;

  // Project B onto AC as vector AP
  var pt = acuX * abX + acuY * abY + acuZ * abZ;
  var apX = acuX * pt;
  var apY = acuY * pt;
  var apZ = acuZ * pt;

  // BP (B -> P)
  var bpX = apX - abX;
  var bpY = apY - abY;
  var bpZ = apZ - abZ;

  // B is inline with AC
  if (!(bpX || bpY || bpZ)) {
    if (bAngleTarget < Math.PI) {
      p0[bix] += 0.1;
      p0[biy] += 0.1;
      p0[biz] += 0.1;
    }
    return;
  }

  var apLenSq = apX * apX + apY * apY + apZ * apZ;
  var bpLenSq = bpX * bpX + bpY * bpY + bpZ * bpZ;
  var apLen = Math.sqrt(apLenSq);
  var bpLen = Math.sqrt(bpLenSq);

  var bpLenTarget = apLen * Math.tan(aAngleTarget);
  var bpDiff = (bpLen - bpLenTarget) / bpLen;

  p0[bix] += bpX * bpDiff;
  p0[biy] += bpY * bpDiff;
  p0[biz] += bpZ * bpDiff;
};


// ..................................................
// AxisConstraint
// ..................................................

lib.AxisConstraint = AxisConstraint;

/**
  @module constraints
*/

/**
  Defines one or many relationships between an infinite axis and single particles.

  Orientaiton of the axis is defined by 2 points: `axisA` and `axisB`.

  ```javascript
  var axisA = 0, axisB = 1;
  var a = 2, b = 3, c = 4;
  var single = AxisConstraint.create(axisA, axisB, a);
  var many = AxisConstraint.create(axisA, axisB, [a, b, c]);
  ```

  @class AxisConstraint
  @extends Constraint
  @constructor
  @param {Int}       axisA  Particle index defining start of axis
  @param {Int}       axisB  Particle index defining end of axis
  @param {Int|Array} a      Particle index or list of many indices
*/
function AxisConstraint(axisA, axisB, a) {
  var size = a.length || 1;

  lib.Constraint.call(this, size, 1, 2);
  this.setAxis(axisA, axisB);
  this.setIndices(a);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
AxisConstraint.create = lib.ctor(AxisConstraint);
AxisConstraint.prototype = Object.create(lib.Constraint.prototype);
AxisConstraint.prototype.constructor = AxisConstraint;

/**
  Set particles defining constraint axis

  @method setAxis
  @param {Int} a  Particle index defining start of axis
  @param {Int} b  Particle index defining end of axis
*/
AxisConstraint.prototype.setAxis = function (a, b) {
  var ii = this.indices;

  ii[0] = a;
  ii[1] = b;
};

AxisConstraint.prototype.applyConstraint = function (index, p0, p1) {
  var ii = this.indices;
  var ai = ii[0], bi = ii[index + 2], ci = ii[1];

  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;
  var cix = ci * 3, ciy = cix + 1, ciz = cix + 2;

  // AB (A -> B)
  var abX = p0[bix] - p0[aix];
  var abY = p0[biy] - p0[aiy];
  var abZ = p0[biz] - p0[aiz];

  // AC (A -> C)
  var acX = p0[cix] - p0[aix];
  var acY = p0[ciy] - p0[aiy];
  var acZ = p0[ciz] - p0[aiz];

  var acLenSq = acX * acX + acY * acY + acZ * acZ;
  var acLen = Math.sqrt(acLenSq);

  // Unit vector AC
  var acLenInv = 1 / acLen;
  var acuX = acX * acLenInv;
  var acuY = acY * acLenInv;
  var acuZ = acZ * acLenInv;

  // Project B onto AC as vector AP
  var pt = acuX * abX + acuY * abY + acuZ * abZ;
  var apX = acuX * pt;
  var apY = acuY * pt;
  var apZ = acuZ * pt;

  p0[bix] = p0[aix] + apX;
  p0[biy] = p0[aiy] + apY;
  p0[biz] = p0[aiz] + apZ;
};


// ..................................................
// BoundingPlaneConstraint
// ..................................................

lib.BoundingPlaneConstraint = BoundingPlaneConstraint;

/**
  @module constraints
*/

/**
  Defines an infinite bounding plane which constrains all particles in the system.

  ```javascript
  var origin = [1.0, 2.0, 5.0];
  var normal = [0.0, 1.0, 0.0];
  var bounds = BoundingPlaneConstraint.create(origin, normal);
  var plane = BoundingPlaneConstraint.create(origin, normal, Infinity);
  ```

  @class BoundingPlaneConstraint
  @extends Constraint
  @constructor
  @param {Array (Vec3)}  origin     Plane origin
  @param {Array (Vec3)}  normal     Plane normal / orientation
  @param {Float}        [distance]  Maximum positive distance to affect particles
*/
function BoundingPlaneConstraint(origin, normal, distance) {
  /**
    Positive distance from plane within which particles will be constrained.

    A value of `Infinity` will constrain all particles to be inline with the plane, while
    the default of `0` constrains all particles to space in front of the plane
    relative to its `origin` and orientation `normal`.

    @property distance
    @type Float
    @default 0
  */
  this.distance = distance || 0;

  /**
    Damping factor to apply to particles being constrained to bounds

    @property friction
    @type Float
    @default 0.05
  */
  this.friction = 0.05;

  /**
    Vec3 buffer which stores plane origin and normal

    @property bufferVec3
    @type Float32Array (Vec3)
    @private
  */
  this.bufferVec3 = lib.Vec3.create(2);

  this.setOrigin(origin);
  this.setNormal(normal);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
BoundingPlaneConstraint.create = lib.ctor(BoundingPlaneConstraint);
BoundingPlaneConstraint.prototype = Object.create(lib.Constraint.prototype);
BoundingPlaneConstraint.prototype.constructor = BoundingPlaneConstraint;

/**
  Global constraint flag

  @property _isGlobal
  @type Bool
  @private
*/
BoundingPlaneConstraint.prototype._isGlobal = true;

/**
  Set origin

  @method setOrigin
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
BoundingPlaneConstraint.prototype.setOrigin = function (x, y, z) {
  lib.Vec3.set(this.bufferVec3, 0, x, y, z);
};

/**
  Set normal (automatically normalizes vector)

  @method setNormal
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
BoundingPlaneConstraint.prototype.setNormal = function (x, y, z) {
  lib.Vec3.set(this.bufferVec3, 1, x, y, z);
  lib.Vec3.normalize(this.bufferVec3, 1);
};

BoundingPlaneConstraint.prototype.applyConstraint = function (index, p0, p1) {
  var friction = this.friction;
  var b0 = this.bufferVec3;
  var ix = index, iy = ix + 1, iz = ix + 2;

  // OP (O -> P)
  var opX = p0[ix] - b0[0];
  var opY = p0[iy] - b0[1];
  var opZ = p0[iz] - b0[2];

  // N
  var nX = b0[3];
  var nY = b0[4];
  var nZ = b0[5];

  // Project OP onto normal vector N
  var pt = opX * nX + opY * nY + opZ * nZ;
  if (pt > this.distance) { return; }

  p0[ix] -= nX * pt;
  p0[iy] -= nY * pt;
  p0[iz] -= nZ * pt;

  p1[ix] -= (p1[ix] - p0[ix]) * friction;
  p1[iy] -= (p1[iy] - p0[iy]) * friction;
  p1[iz] -= (p1[iz] - p0[iz]) * friction;
};


// ..................................................
// BoxConstraint
// ..................................................

lib.BoxConstraint = BoxConstraint;

/**
  @module constraints
*/

/**
  Defines an axis-aligned bounding box which constrains all particles
  in the system to its bounds.

  ```javascript
  var min = [-10.0, -10.0, -10.0];
  var max = [10.0, 10.0, 10.0];
  var box = BoxConstraint.create(min, max);
  ```

  @class BoxConstraint
  @extends Constraint
  @constructor
  @param {Array (Vec3)} min  Bounds minimum
  @param {Array (Vec3)} max  Bounds maximum
*/
function BoxConstraint(min, max) {
  /**
    Damping factor to apply to particles being constrained to bounds

    @property friction
    @type Float
    @default 0.05
  */
  this.friction = 0.05;

  /**
    Vec3 buffer which stores bounds

    @property bufferVec3
    @type Float32Array (Vec3)
    @private
  */
  this.bufferVec3 = lib.Vec3.create(2);

  this.setBounds(min, max);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
BoxConstraint.create = lib.ctor(BoxConstraint);
BoxConstraint.prototype = Object.create(lib.Constraint.prototype);
BoxConstraint.prototype.constructor = BoxConstraint;

/**
  Global constraint flag

  @property _isGlobal
  @type Bool
  @private
*/
BoxConstraint.prototype._isGlobal = true;

/**
  Set bounds

  @method setBounds
  @param {Array (Vec3)} min
  @param {Array (Vec3)} max
*/
BoxConstraint.prototype.setBounds = function (min, max) {
  this.setMin(min);
  this.setMax(max);
};

/**
  Set bounds minimum; alias for `Vec3.set`.

  @method setMin
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
BoxConstraint.prototype.setMin = function (x, y, z) {
  lib.Vec3.set(this.bufferVec3, 0, x, y, z);
};

/**
  Set bounds maximum; alias for `Vec3.set`.

  @method setMin
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
BoxConstraint.prototype.setMax = function (x, y, z) {
  lib.Vec3.set(this.bufferVec3, 1, x, y, z);
};

BoxConstraint.prototype.applyConstraint = function (index, p0, p1) {
  var friction = this.friction;
  var b0 = this.bufferVec3;
  var ix = index, iy = ix + 1, iz = ix + 2;

  var px = lib.Math.clamp(b0[0], b0[3], p0[ix]);
  var py = lib.Math.clamp(b0[1], b0[4], p0[iy]);
  var pz = lib.Math.clamp(b0[2], b0[5], p0[iz]);

  var dx = p0[ix] - px;
  var dy = p0[iy] - py;
  var dz = p0[iz] - pz;

  p0[ix] = px;
  p0[iy] = py;
  p0[iz] = pz;

  if (dx || dy || dz) {
    p1[ix] -= (p1[ix] - px) * friction;
    p1[iy] -= (p1[iy] - py) * friction;
    p1[iz] -= (p1[iz] - pz) * friction;
  }
};


// ..................................................
// DistanceConstraint
// ..................................................

lib.DistanceConstraint = DistanceConstraint;

/**
  @module constraints
*/

/**
  Defines one or many relationships between sets of two particles.

  ```javascript
  var a = 0, b = 1, c = 2;
  var single = DistanceConstraint.create(10, a, b);
  var many = DistanceConstraint.create(10, [a, b, a, c]);
  ```

  Particles are constrained by a fixed distance or a distance range.

  ```javascript
  var min = 0.5, max = 2.5;
  var fixed = DistanceConstraint.create(max, 0, 1);
  var range = DistanceConstraint.create([min, max], 0, 1);
  ```

  @class DistanceConstraint
  @extends Constraint
  @constructor
  @param {Float|Array}  distance  Distance or distance range `[min, max]` between particles
  @param {Int|Array}    a         Particle index or list of many constraint sets
  @param {Int}         [b]        Particle index (only used if `a` is not an array)
*/
function DistanceConstraint(distance, a, b) {
  var size = a.length || arguments.length - 1;
  var min = distance.length ? distance[0] : distance;
  var max = distance.length ? distance[1] : distance;

  lib.Constraint.call(this, size, 2);
  this.setDistance(min, max);
  this.setIndices(a, b);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
DistanceConstraint.create = lib.ctor(DistanceConstraint);
DistanceConstraint.prototype = Object.create(lib.Constraint.prototype);
DistanceConstraint.prototype.constructor = DistanceConstraint;

/**
  Set distance

  @method setDistance
  @param {Float}  min
  @param {Float} [max]
*/
DistanceConstraint.prototype.setDistance = function (min, max) {
  this.setMin(min);
  this.setMax(max != null ? max : min);
};

/**
  Set minimum distance

  @method setMin
  @param {Float} min
*/
DistanceConstraint.prototype.setMin = function (min) {
  this._min2 = min * min;
};

/**
  Cached value of minimum distance squared

  @property _min2
  @type Float
  @private
*/
DistanceConstraint.prototype._min2 = null;

/**
  Set maximum distance

  @method setMax
  @param {Float} max
*/
DistanceConstraint.prototype.setMax = function (max) {
  this._max2 = max * max;
};

/**
  Cached value of maximum distance squared

  @property _max2
  @type Float
  @private
*/
DistanceConstraint.prototype._max2 = null;

DistanceConstraint.prototype.applyConstraint = function (index, p0, p1) {
  var ii = this.indices;
  var ai = ii[index], bi = ii[index + 1];

  var ax = ai * 3, ay = ax + 1, az = ax + 2;
  var bx = bi * 3, by = bx + 1, bz = bx + 2;

  var dx = p0[bx] - p0[ax];
  var dy = p0[by] - p0[ay];
  var dz = p0[bz] - p0[az];

  if (!(dx || dy || dz)) {
    dx = dy = dz = 0.1;
  }

  var dist2 = dx * dx + dy * dy + dz * dz;
  var min2 = this._min2;
  var max2 = this._max2;

  if (dist2 < max2 && dist2 > min2) { return; }

  var target2 = dist2 < min2 ? min2 : max2;
  var diff = target2 / (dist2 + target2);
  var aDiff = diff - 0.5;
  var bDiff = diff - 0.5;

  p0[ax] -= dx * aDiff;
  p0[ay] -= dy * aDiff;
  p0[az] -= dz * aDiff;

  p0[bx] += dx * bDiff;
  p0[by] += dy * bDiff;
  p0[bz] += dz * bDiff;
};


// ..................................................
// PlaneConstraint
// ..................................................

lib.PlaneConstraint = PlaneConstraint;

/**
  @module constraints
*/

/**
  Defines one or many relationships between an infinite plane and single particles.

  Orientaiton of the plane is defined by 3 points: `planeA`, `planeB`, and `planeC`.

  ```javascript
  var planeA = 0, planeB = 1, planeC = 2;
  var a = 3, b = 4, c = 5;
  var single = PlaneConstraint.create(planeA, planeB, planeC, a);
  var many = PlaneConstraint.create(planeA, planeB, planeC, [a, b, c]);
  ```

  @class PlaneConstraint
  @extends Constraint
  @constructor
  @param {Int}       planeA  Particle index defining point on plane
  @param {Int}       planeB  Particle index defining point on plane
  @param {Int}       planeC  Particle index defining point on plane
  @param {Int|Array} a       Particle index or list of many indices
*/
function PlaneConstraint(planeA, planeB, planeC, a) {
  var size = a.length || 1;

  lib.Constraint.call(this, size, 1, 3);

  /**
    Vec3 buffer which stores plane normal.

    @property bufferVec3
    @type Float32Array (Vec3)
    @private
  */
  this.bufferVec3 = lib.Vec3.create(1);

  this.setPlane(planeA, planeB, planeC);
  this.setIndices(a);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
PlaneConstraint.create = lib.ctor(PlaneConstraint);
PlaneConstraint.prototype = Object.create(lib.Constraint.prototype);
PlaneConstraint.prototype.constructor = PlaneConstraint;

/**
  Set particles defining constraint plane

  @method setPlane
  @param {Int} a  Particle index point on plane
  @param {Int} b  Particle index point on plane
  @param {Int} c  Particle index point on plane
*/
PlaneConstraint.prototype.setPlane = function (a, b, c) {
  var ii = this.indices;

  ii[0] = a;
  ii[1] = b;
  ii[2] = c;
};

/**
  Calculate and cache plane normal vector.
  Calculated once per relaxation loop iteration.

  @method _calculateNormal
  @param {Int}                 index  Constraint set index
  @param {Float32Array (Vec3)} p0     Reference to `ParticleSystem.positions`
  @private
*/
PlaneConstraint.prototype._calculateNormal = function (index, p0) {
  var b0 = this.bufferVec3;
  var ii = this.indices;
  var ai = ii[0], bi = ii[1], ci = ii[2];

  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;
  var cix = ci * 3, ciy = cix + 1, ciz = cix + 2;

  // AB (B -> A)
  var abX = p0[aix] - p0[bix];
  var abY = p0[aiy] - p0[biy];
  var abZ = p0[aiz] - p0[biz];

  // BC (B -> C)
  var bcX = p0[cix] - p0[bix];
  var bcY = p0[ciy] - p0[biy];
  var bcZ = p0[ciz] - p0[biz];

  // N (plane normal vector)
  var nX = abY * bcZ - abZ * bcY;
  var nY = abZ * bcX - abX * bcZ;
  var nZ = abX * bcY - abY * bcX;
  var nLenSq = nX * nX + nY * nY + nZ * nZ;

  // AB and BC are parallel
  if (!nLenSq) {
    p0[aix] += 0.1;
    p0[biy] += 0.1;
    p0[cix] -= 0.1;

    this._hasNormal = false;
    return;
  }

  var nLenInv = 1 / Math.sqrt(nLenSq);
  b0[0] = nX * nLenInv;
  b0[1] = nY * nLenInv;
  b0[2] = nZ * nLenInv;

  this._hasNormal = true;
};

/**
  State of constraint's plane normal resolution

  @property _hasNormal
  @type Bool
  @private
*/
PlaneConstraint.prototype._hasNormal = false;

PlaneConstraint.prototype.applyConstraint = function (index, p0, p1) {
  var b0 = this.bufferVec3;
  var ii = this.indices;
  var bi = ii[1], pi = ii[index + 3];

  var bix = bi * 3, biy = bix + 1, biz = bix + 2;
  var pix = pi * 3, piy = pix + 1, piz = pix + 2;

  if (index === 0) {
    this._calculateNormal(index, p0);
  }

  if (!this._hasNormal) { return; }

  // N (plane normal vector)
  var nX = b0[0];
  var nY = b0[1];
  var nZ = b0[2];

  // BP (B -> P)
  var opX = p0[pix] - p0[bix];
  var opY = p0[piy] - p0[biy];
  var opZ = p0[piz] - p0[biz];

  // Project BP onto normal vector N
  var pt = opX * nX + opY * nY + opZ * nZ;

  p0[pix] -= nX * pt;
  p0[piy] -= nY * pt;
  p0[piz] -= nZ * pt;
};


// ..................................................
// PointConstraint
// ..................................................

lib.PointConstraint = PointConstraint;

/**
  @module constraints
*/

/**
  Defines one or many relationships between a fixed point and single particles.

  ```javascript
  var point = [0.5, 10.0, 3.0];
  var a = 0, b = 1;
  var single = PointConstraint.create(point, a);
  var many = PointConstraint.create(point, [a, b]);
  ```

  @class PointConstraint
  @extends Constraint
  @constructor
  @param {Array (Vec3)} position  Point position
  @param {Int|Array}    a         Particle index or list of many indices
*/
function PointConstraint(position, a) {
  var size = a.length || 1;

  lib.Constraint.call(this, size, 1);

  /**
    Vec3 buffer which stores point position.

    @property bufferVec3
    @type Float32Array (Vec3)
    @private
  */
  this.bufferVec3 = lib.Vec3.create(1);

  this.setPosition(position);
  this.setIndices(a);
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
PointConstraint.create = lib.ctor(PointConstraint);
PointConstraint.prototype = Object.create(lib.Constraint.prototype);
PointConstraint.prototype.constructor = PointConstraint;

/**
  Set point position.

  @method setPosition
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
PointConstraint.prototype.setPosition = function (x, y, z) {
  lib.Vec3.set(this.bufferVec3, 0, x, y, z);
};

PointConstraint.prototype.applyConstraint = function (index, p0, p1) {
  var b0 = this.bufferVec3;
  var ai = this.indices[index];
  var ix = ai * 3, iy = ix + 1, iz = ix + 2;

  p0[ix] = p1[ix] = b0[0];
  p0[iy] = p1[iy] = b0[1];
  p0[iz] = p1[iz] = b0[2];
};


// ..................................................
// ParticleSystem
// ..................................................

lib.ParticleSystem = ParticleSystem;

/**
  @module systems
*/

/**
  Manages particle state as well as the forces and constraints that act on its particles.

  @class ParticleSystem
  @constructor
  @param {Int|Array} particles   Number of particles or array of initial particle positions
  @param {Int}       iterations  Number of constraint iterations per system tick
*/
function ParticleSystem(particles, iterations) {
  var isCount = typeof particles === 'number';
  var length = isCount ? particles * 3 : particles.length;
  var count = length / 3;
  var positions = isCount ? length : particles;

  /**
    Current particle positions

    @property positions
    @type Float32Array (Vec3)
  */
  this.positions = new Float32Array(positions);

  /**
    Previous particle positions

    @property positionsPrev
    @type Float32Array (Vec3)
  */
  this.positionsPrev = new Float32Array(positions);

  /**
    Accumulated forces currently acting on particles

    @property accumulatedForces
    @type Float32Array (Vec3)
  */
  this.accumulatedForces = new Float32Array(length);

  /**
    Particle mass

    @property weights
    @type Float32Array (Float)
  */
  this.weights = new Float32Array(count);
  this.setWeights(1);

  /**
    Number of constraint relaxation loop iterations

    @property _iterations
    @type Int
    @private
  */
  this._iterations = iterations || 1;

  /**
    Number of particles in system

    @property _count
    @type Int
    @private
  */
  this._count = count;

  this._globalConstraints = [];
  this._localConstraints = [];
  this._pinConstraints = [];
  this._forces = [];
}

/**
  Create instance, accepts constructor arguments.

  @method create
  @static
*/
ParticleSystem.create = lib.ctor(ParticleSystem);
ParticleSystem.prototype.constructor = ParticleSystem;

/**
  Alias for `Vec3.set`. Sets vector of `positions` and `positionsPrev`.

  @method setPosition
  @param {Int}   i  Particle index
  @param {Float} x
  @param {Float} y
  @param {Float} z
*/
ParticleSystem.prototype.setPosition = function (i, x, y, z) {
  lib.Vec3.set(this.positions, i, x, y, z);
  lib.Vec3.set(this.positionsPrev, i, x, y, z);
};

/**
  Alias for `Vec3.copy`. Copys vector from `positions`.

  @method getPosition
  @param  {Int}  i    Particle index
  @param  {Vec3} out
  @return {Vec3} out
*/
ParticleSystem.prototype.getPosition = function (i, out) {
  return lib.Vec3.copy(this.positions, i, out);
};

/**
  Alias for `Vec3.getDistance`. Calculates distance from `positions`.

  @method getDistance
  @param  {Int}   a  Particle index
  @param  {Int}   b  Particle index
  @return {Float}    Distance
*/
ParticleSystem.prototype.getDistance = function (a, b) {
  return lib.Vec3.distance(this.positions, a, b);
};

/**
  Alias for `Vec3.angle`. Calculates angle from `positions`.

  @method getAngle
  @param  {Int}   a  Particle index
  @param  {Int}   b  Particle index
  @param  {Int}   c  Particle index
  @return {Float}    Angle in radians
*/
ParticleSystem.prototype.getAngle = function (a, b, c) {
  return lib.Vec3.angle(this.positions, a, b, c);
};

/**
  Set a particle's mass

  @method setWeight
  @param {Int}   i  Particle index
  @param {Float} w  Weight
*/
ParticleSystem.prototype.setWeight = function (i, w) {
  this.weights[i] = w;
};

ParticleSystem.prototype.setWeights = function (w) {
  var weights = this.weights;
  for (var i = 0, il = weights.length; i < il; i ++) {
    weights[i] = w;
  }
};

ParticleSystem.prototype.each = function (iterator, context) {
  context = context || this;
  for (var i = 0, il = this._count; i < il; i ++) {
    iterator.call(context, i, this);
  }
};

ParticleSystem.prototype.perturb = function (scale) {
  var positions = this.positions;
  var positionsPrev = this.positionsPrev;
  var dist;

  for (var i = 0, il = positions.length; i < il; i ++) {
    dist = Math.random() * scale;
    positions[i] += dist;
    positionsPrev[i] += dist;
  }
};

// ..................................................
// Verlet Integration
//

function ps_integrateParticle(i, p0, p1, f0, weight, d2) {
  var pt = p0[i];
  p0[i] += pt - p1[i] + f0[i] * weight * d2;
  p1[i] = pt;
}

/**
  Calculate particle's next position through Verlet integration.
  Called as part of `tick`.

  @method integrate
  @param {Float} delta  Time step
  @private
*/
ParticleSystem.prototype.integrate = function (delta) {
  var d2 = delta * delta;
  var p0 = this.positions;
  var p1 = this.positionsPrev;
  var f0 = this.accumulatedForces;
  var w0 = this.weights;
  var ix, weight;

  for (var i = 0, il = this._count; i < il; i ++) {
    weight = w0[i];
    ix = i * 3;

    ps_integrateParticle(ix,     p0, p1, f0, weight, d2);
    ps_integrateParticle(ix + 1, p0, p1, f0, weight, d2);
    ps_integrateParticle(ix + 2, p0, p1, f0, weight, d2);
  }
};

// ..................................................
// Constraints
//

ParticleSystem.prototype._getConstraintBuffer = function (constraint) {
  return constraint._isGlobal ? this._globalConstraints : this._localConstraints;
};

/**
  Add a constraint

  @method addConstraint
  @param {Constraint} constraint
*/
ParticleSystem.prototype.addConstraint = function (constraint) {
  this._getConstraintBuffer(constraint).push(constraint);
};

/**
  Alias for `Collection.removeAll`. Remove all references to a constraint.

  @method removeConstraint
  @param {Constraint} constraint
*/
ParticleSystem.prototype.removeConstraint = function (constraint) {
  lib.Collection.removeAll(this._getConstraintBuffer(constraint), constraint);
};

/**
  Add a pin constraint.
  Although intended for instances of `PointConstraint`, this can be any
  type of constraint and will be resolved last in the relaxation loop.

  @method addPinConstraint
  @param {Constraint} constraint
*/
ParticleSystem.prototype.addPinConstraint = function (constraint) {
  this._pinConstraints.push(constraint);
};

/**
  Alias for `Collection.removeAll`. Remove all references to a pin constraint.

  @method removePinConstraint
  @param {Constraint} constraint
*/
ParticleSystem.prototype.removePinConstraint = function (constraint) {
  lib.Collection.removeAll(this._pinConstraints, constraint);
};

/**
  Run relaxation loop, resolving constraints per defined iterations.
  Constraints are resolved in order by type: global, local, pin.

  @method satisfyConstraints
  @private
*/
ParticleSystem.prototype.satisfyConstraints = function () {
  var iterations = this._iterations;
  var global = this._globalConstraints;
  var local = this._localConstraints;
  var pins = this._pinConstraints;
  var globalCount = this._count;
  var globalItemSize = 3;

  for (var i = 0; i < iterations; i ++) {
    this.satisfyConstraintGroup(global, globalCount, globalItemSize);
    this.satisfyConstraintGroup(local);

    if (!pins.length) { continue; }
    this.satisfyConstraintGroup(pins);
  }
};

/**
  Resolve a group of constraints.

  @method satisfyConstraintGroup
  @param {Array} group       List of constraints
  @param {Int}   [count]     Override for number of particles a constraint affects
  @param {Int}   [itemSize]  Override for particle index stride
  @private
*/
ParticleSystem.prototype.satisfyConstraintGroup = function (group, count, itemSize) {
  var p0 = this.positions;
  var p1 = this.positionsPrev;
  var hasUniqueCount = !count;
  var constraint;

  for (var i = 0, il = group.length; i < il; i ++) {
    constraint = group[i];

    if (hasUniqueCount) {
      count = constraint._count;
      itemSize = constraint._itemSize;
    }

    for (var j = 0; j < count; j ++) {
      constraint.applyConstraint(j * itemSize, p0, p1);
    }
  }
};

// ..................................................
// Forces
//

/**
  Add a force

  @method addForce
  @param {Force} force
*/
ParticleSystem.prototype.addForce = function (force) {
  this._forces.push(force);
};

/**
  Alias for `Collection.removeAll`. Remove all references to a force.

  @method removeForce
  @param {Force} force
*/
ParticleSystem.prototype.removeForce = function (force) {
  lib.Collection.removeAll(this._forces, force);
};

/**
  Accumulate forces acting on particles.

  @method accumulateForces
  @param {Float} delta  Time step
  @private
*/
ParticleSystem.prototype.accumulateForces = function (delta) {
  var forces = this._forces;
  var f0 = this.accumulatedForces;
  var p0 = this.positions;
  var p1 = this.positionsPrev;
  var ix;

  for (var i = 0, il = this._count; i < il; i ++) {
    ix = i * 3;
    f0[ix] = f0[ix + 1] = f0[ix + 2] = 0;

    for (var j = 0, jl = forces.length; j < jl; j ++) {
      forces[j].applyForce(ix, f0, p0, p1);
    }
  }
};

/**
  Step simulation forward one frame.
  Applies forces, calculates particle positions, and resolves constraints.

  @method tick
  @param {Float} delta  Time step
*/
ParticleSystem.prototype.tick = function (delta) {
  this.accumulateForces(delta);
  this.integrate(delta);
  this.satisfyConstraints();
};


  return lib;
}));


/* ---- ..\medusae-deps\perlin.js ---- */
/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

(function(global){
  var module = global.noise = {};

  function Grad(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  
  Grad.prototype.dot2 = function(x, y) {
    return this.x*x + this.y*y;
  };

  Grad.prototype.dot3 = function(x, y, z) {
    return this.x*x + this.y*y + this.z*z;
  };

  var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
               new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
               new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];

  var p = [151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  // To remove the need for index wrapping, double the permutation table length
  var perm = new Array(512);
  var gradP = new Array(512);

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  module.seed = function(seed) {
    if(seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if(seed < 256) {
      seed |= seed << 8;
    }

    for(var i = 0; i < 256; i++) {
      var v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed>>8) & 255);
      }

      perm[i] = perm[i + 256] = v;
      gradP[i] = gradP[i + 256] = grad3[v % 12];
    }
  };

  module.seed(0);

  /*
  for(var i=0; i<256; i++) {
    perm[i] = perm[i + 256] = p[i];
    gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
  }*/

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  var F2 = 0.5*(Math.sqrt(3)-1);
  var G2 = (3-Math.sqrt(3))/6;

  var F3 = 1/3;
  var G3 = 1/6;

  // 2D simplex noise
  module.simplex2 = function(xin, yin) {
    var n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin)*F2; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var t = (i+j)*G2;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1=1; j1=0;
    } else {    // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1=0; j1=1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;
    var gi0 = gradP[i+perm[j]];
    var gi1 = gradP[i+i1+perm[j+j1]];
    var gi2 = gradP[i+1+perm[j+1]];
    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    var t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  };

  // 3D simplex noise
  module.simplex3 = function(xin, yin, zin) {
    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin+zin)*F3; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var k = Math.floor(zin+s);

    var t = (i+j+k)*G3;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    var z0 = zin-k+t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if(x0 >= y0) {
      if(y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else              { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if(y0 < z0)      { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else             { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;

    var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;

    var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;
    var gi0 = gradP[i+   perm[j+   perm[k   ]]];
    var gi1 = gradP[i+i1+perm[j+j1+perm[k+k1]]];
    var gi2 = gradP[i+i2+perm[j+j2+perm[k+k2]]];
    var gi3 = gradP[i+ 1+perm[j+ 1+perm[k+ 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    var t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    var t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if(t3<0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);

  };

  // ##### Perlin noise stuff

  function fade(t) {
    return t*t*t*(t*(t*6-15)+10);
  }

  function lerp(a, b, t) {
    return (1-t)*a + t*b;
  }

  // 2D Perlin Noise
  module.perlin2 = function(x, y) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X; y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    var n00 = gradP[X+perm[Y]].dot2(x, y);
    var n01 = gradP[X+perm[Y+1]].dot2(x, y-1);
    var n10 = gradP[X+1+perm[Y]].dot2(x-1, y);
    var n11 = gradP[X+1+perm[Y+1]].dot2(x-1, y-1);

    // Compute the fade curve value for x
    var u = fade(x);

    // Interpolate the four results
    return lerp(
        lerp(n00, n10, u),
        lerp(n01, n11, u),
       fade(y));
  };

  // 3D Perlin Noise
  module.perlin3 = function(x, y, z) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X; y = y - Y; z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255; Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    var n000 = gradP[X+  perm[Y+  perm[Z  ]]].dot3(x,   y,     z);
    var n001 = gradP[X+  perm[Y+  perm[Z+1]]].dot3(x,   y,   z-1);
    var n010 = gradP[X+  perm[Y+1+perm[Z  ]]].dot3(x,   y-1,   z);
    var n011 = gradP[X+  perm[Y+1+perm[Z+1]]].dot3(x,   y-1, z-1);
    var n100 = gradP[X+1+perm[Y+  perm[Z  ]]].dot3(x-1,   y,   z);
    var n101 = gradP[X+1+perm[Y+  perm[Z+1]]].dot3(x-1,   y, z-1);
    var n110 = gradP[X+1+perm[Y+1+perm[Z  ]]].dot3(x-1, y-1,   z);
    var n111 = gradP[X+1+perm[Y+1+perm[Z+1]]].dot3(x-1, y-1, z-1);

    // Compute the fade curve value for x, y, z
    var u = fade(x);
    var v = fade(y);
    var w = fade(z);

    // Interpolate
    return lerp(
        lerp(
          lerp(n000, n100, u),
          lerp(n001, n101, u), w),
        lerp(
          lerp(n010, n110, u),
          lerp(n011, n111, u), w),
       v);
  };

})(this);


/* ---- static\lib-extras\three\controls\TrackballControls.js ---- */
/**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 */

THREE.TrackballControls = function ( object, domElement ) {

	var _this = this;
	var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM: 4, TOUCH_PAN: 5 };

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	this.rotateSpeed = 1.0;
	this.zoomSpeed = 1.2;
	this.panSpeed = 0.3;

	this.noRotate = false;
	this.noZoom = false;
	this.noPan = false;
	this.noRoll = false;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.2;

	this.minDistance = 0;
	this.maxDistance = Infinity;

	this.keys = [ 65 /*A*/, 83 /*S*/, 68 /*D*/ ];

	// internals

	this.target = new THREE.Vector3();

	var lastPosition = new THREE.Vector3();

	var _state = STATE.NONE,
	_prevState = STATE.NONE,

	_eye = new THREE.Vector3(),

	_rotateStart = new THREE.Vector3(),
	_rotateEnd = new THREE.Vector3(),

	_zoomStart = new THREE.Vector2(),
	_zoomEnd = new THREE.Vector2(),

	_touchZoomDistanceStart = 0,
	_touchZoomDistanceEnd = 0,

	_panStart = new THREE.Vector2(),
	_panEnd = new THREE.Vector2();

	// for reset

	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.up0 = this.object.up.clone();

	// events

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start'};
	var endEvent = { type: 'end'};


	// methods

	this.handleResize = function () {

		if ( this.domElement === document ) {

			this.screen.left = 0;
			this.screen.top = 0;
			this.screen.width = window.innerWidth;
			this.screen.height = window.innerHeight;

		} else {

			this.screen = this.domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = this.domElement.ownerDocument.documentElement
			this.screen.left += window.pageXOffset - d.clientLeft
			this.screen.top += window.pageYOffset - d.clientTop

		}

	};

	this.handleEvent = function ( event ) {

		if ( typeof this[ event.type ] == 'function' ) {

			this[ event.type ]( event );

		}

	};

	this.getMouseOnScreen = function ( pageX, pageY, vector ) {

		return vector.set(
			( pageX - _this.screen.left ) / _this.screen.width,
			( pageY - _this.screen.top ) / _this.screen.height
		);

	};

	this.getMouseProjectionOnBall = (function(){

		var objectUp = new THREE.Vector3(),
		    mouseOnBall = new THREE.Vector3();


		return function ( pageX, pageY, projection ) {

			mouseOnBall.set(
				( pageX - _this.screen.width * 0.5 - _this.screen.left ) / (_this.screen.width*.5),
				( _this.screen.height * 0.5 + _this.screen.top - pageY ) / (_this.screen.height*.5),
				0.0
			);

			var length = mouseOnBall.length();

			if ( _this.noRoll ) {

				if ( length < Math.SQRT1_2 ) {

					mouseOnBall.z = Math.sqrt( 1.0 - length*length );

				} else {

					mouseOnBall.z = .5 / length;
					
				}

			} else if ( length > 1.0 ) {

				mouseOnBall.normalize();

			} else {

				mouseOnBall.z = Math.sqrt( 1.0 - length * length );

			}

			_eye.copy( _this.object.position ).sub( _this.target );

			projection.copy( _this.object.up ).setLength( mouseOnBall.y )
			projection.add( objectUp.copy( _this.object.up ).cross( _eye ).setLength( mouseOnBall.x ) );
			projection.add( _eye.setLength( mouseOnBall.z ) );

			return projection;
		}

	}());

	this.rotateCamera = (function(){

		var axis = new THREE.Vector3(),
			quaternion = new THREE.Quaternion();


		return function () {

			var angle = Math.acos( _rotateStart.dot( _rotateEnd ) / _rotateStart.length() / _rotateEnd.length() );

			if ( angle ) {

				axis.crossVectors( _rotateStart, _rotateEnd ).normalize();

				angle *= _this.rotateSpeed;

				quaternion.setFromAxisAngle( axis, -angle );

				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

				_rotateEnd.applyQuaternion( quaternion );

				if ( _this.staticMoving ) {

					_rotateStart.copy( _rotateEnd );

				} else {

					quaternion.setFromAxisAngle( axis, angle * ( _this.dynamicDampingFactor - 1.0 ) );
					_rotateStart.applyQuaternion( quaternion );

				}

			}
		}

	}());

	this.zoomCamera = function () {

		if ( _state === STATE.TOUCH_ZOOM ) {

			var factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
			_touchZoomDistanceStart = _touchZoomDistanceEnd;
			_eye.multiplyScalar( factor );

		} else {

			var factor = 1.0 + ( _zoomEnd.y - _zoomStart.y ) * _this.zoomSpeed;

			if ( factor !== 1.0 && factor > 0.0 ) {

				_eye.multiplyScalar( factor );

				if ( _this.staticMoving ) {

					_zoomStart.copy( _zoomEnd );

				} else {

					_zoomStart.y += ( _zoomEnd.y - _zoomStart.y ) * this.dynamicDampingFactor;

				}

			}

		}

	};

	this.panCamera = (function(){

		var mouseChange = new THREE.Vector2(),
			objectUp = new THREE.Vector3(),
			pan = new THREE.Vector3();

		return function () {

			mouseChange.copy( _panEnd ).sub( _panStart );

			if ( mouseChange.lengthSq() ) {

				mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

				pan.copy( _eye ).cross( _this.object.up ).setLength( mouseChange.x );
				pan.add( objectUp.copy( _this.object.up ).setLength( mouseChange.y ) );

				_this.object.position.add( pan );
				_this.target.add( pan );

				if ( _this.staticMoving ) {

					_panStart.copy( _panEnd );

				} else {

					_panStart.add( mouseChange.subVectors( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

				}

			}
		}

	}());

	this.checkDistances = function () {

		if ( !_this.noZoom || !_this.noPan ) {

			if ( _eye.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.maxDistance ) );

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.minDistance ) );

			}

		}

	};

	this.update = function () {

		_eye.subVectors( _this.object.position, _this.target );

		if ( !_this.noRotate ) {

			_this.rotateCamera();

		}

		if ( !_this.noZoom ) {

			_this.zoomCamera();

		}

		if ( !_this.noPan ) {

			_this.panCamera();

		}

		_this.object.position.addVectors( _this.target, _eye );

		_this.checkDistances();

		_this.object.lookAt( _this.target );

		if ( lastPosition.distanceToSquared( _this.object.position ) > 0 ) {

			_this.dispatchEvent( changeEvent );

			lastPosition.copy( _this.object.position );

		}

	};

	this.reset = function () {

		_state = STATE.NONE;
		_prevState = STATE.NONE;

		_this.target.copy( _this.target0 );
		_this.object.position.copy( _this.position0 );
		_this.object.up.copy( _this.up0 );

		_eye.subVectors( _this.object.position, _this.target );

		_this.object.lookAt( _this.target );

		_this.dispatchEvent( changeEvent );

		lastPosition.copy( _this.object.position );

	};

	// listeners

	function keydown( event ) {

		if ( _this.enabled === false ) return;

		window.removeEventListener( 'keydown', keydown );

		_prevState = _state;

		if ( _state !== STATE.NONE ) {

			return;

		} else if ( event.keyCode === _this.keys[ STATE.ROTATE ] && !_this.noRotate ) {

			_state = STATE.ROTATE;

		} else if ( event.keyCode === _this.keys[ STATE.ZOOM ] && !_this.noZoom ) {

			_state = STATE.ZOOM;

		} else if ( event.keyCode === _this.keys[ STATE.PAN ] && !_this.noPan ) {

			_state = STATE.PAN;

		}

	}

	function keyup( event ) {

		if ( _this.enabled === false ) return;

		_state = _prevState;

		window.addEventListener( 'keydown', keydown, false );

	}

	function mousedown( event ) {

		if ( _this.enabled === false ) return;

		// event.preventDefault();
		// event.stopPropagation();

		if ( _state === STATE.NONE ) {

			_state = event.button;

		}

		if ( _state === STATE.ROTATE && !_this.noRotate ) {

			_this.getMouseProjectionOnBall( event.pageX, event.pageY, _rotateStart );
			_rotateEnd.copy(_rotateStart)

		} else if ( _state === STATE.ZOOM && !_this.noZoom ) {

			_this.getMouseOnScreen( event.pageX, event.pageY, _zoomStart );
			_zoomEnd.copy(_zoomStart);

		} else if ( _state === STATE.PAN && !_this.noPan ) {

			_this.getMouseOnScreen( event.pageX, event.pageY, _panStart );
			_panEnd.copy(_panStart)

		}

		document.addEventListener( 'mousemove', mousemove, false );
		document.addEventListener( 'mouseup', mouseup, false );
		_this.dispatchEvent( startEvent );


	}

	function mousemove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		if ( _state === STATE.ROTATE && !_this.noRotate ) {

			_this.getMouseProjectionOnBall( event.pageX, event.pageY, _rotateEnd );

		} else if ( _state === STATE.ZOOM && !_this.noZoom ) {

			_this.getMouseOnScreen( event.pageX, event.pageY, _zoomEnd );

		} else if ( _state === STATE.PAN && !_this.noPan ) {

			_this.getMouseOnScreen( event.pageX, event.pageY, _panEnd );

		}

	}

	function mouseup( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		_state = STATE.NONE;

		document.removeEventListener( 'mousemove', mousemove );
		document.removeEventListener( 'mouseup', mouseup );
		_this.dispatchEvent( endEvent );

	}

	function mousewheel( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		var delta = 0;

		if ( event.wheelDelta ) { // WebKit / Opera / Explorer 9

			delta = event.wheelDelta / 40;

		} else if ( event.detail ) { // Firefox

			delta = - event.detail / 3;

		}

		_zoomStart.y += delta * 0.01;
		_this.dispatchEvent( startEvent );
		_this.dispatchEvent( endEvent );

	}

	function touchstart( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_state = STATE.TOUCH_ROTATE;
				_rotateEnd.copy( _this.getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY, _rotateStart ));
				break;

			case 2:
				_state = STATE.TOUCH_ZOOM;
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt( dx * dx + dy * dy );
				break;

			case 3:
				_state = STATE.TOUCH_PAN;
				_panEnd.copy( _this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY, _panStart ));
				break;

			default:
				_state = STATE.NONE;

		}
		_this.dispatchEvent( startEvent );


	}

	function touchmove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1:
				_this.getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY, _rotateEnd );
				break;

			case 2:
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy )
				break;

			case 3:
				_this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY, _panEnd );
				break;

			default:
				_state = STATE.NONE;

		}

	}

	function touchend( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 1:
				_rotateStart.copy( _this.getMouseProjectionOnBall( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY, _rotateEnd ));
				break;

			case 2:
				_touchZoomDistanceStart = _touchZoomDistanceEnd = 0;
				break;

			case 3:
				_panStart.copy( _this.getMouseOnScreen( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY, _panEnd ));
				break;

		}

		_state = STATE.NONE;
		_this.dispatchEvent( endEvent );

	}

	this.domElement.addEventListener( 'contextmenu', function ( event ) { event.preventDefault(); }, false );

	this.domElement.addEventListener( 'mousedown', mousedown, false );

	this.domElement.addEventListener( 'mousewheel', mousewheel, false );
	this.domElement.addEventListener( 'DOMMouseScroll', mousewheel, false ); // firefox

	this.domElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchend, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );

	window.addEventListener( 'keydown', keydown, false );
	window.addEventListener( 'keyup', keyup, false );

	this.handleResize();

};

THREE.TrackballControls.prototype = Object.create( THREE.EventDispatcher.prototype );


/* ---- static\lib-extras\three\geometries\PlaneBufferGeometry.js ---- */
/**
 * @author mrdoob / http://mrdoob.com/
 * based on http://papervision3d.googlecode.com/svn/trunk/as3/trunk/src/org/papervision3d/objects/primitives/Plane.as
 */

THREE.PlaneBufferGeometry = function ( width, height, widthSegments, heightSegments ) {

	THREE.BufferGeometry.call( this );

	this.type = 'PlaneBufferGeometry';

	this.parameters = {
		width: width,
		height: height,
		widthSegments: widthSegments,
		heightSegments: heightSegments
	};

	var width_half = width / 2;
	var height_half = height / 2;

	var gridX = Math.floor( widthSegments ) || 1;
	var gridY = Math.floor( heightSegments ) || 1;

	var gridX1 = gridX + 1;
	var gridY1 = gridY + 1;

	var segment_width = width / gridX;
	var segment_height = height / gridY;

	var vertices = new Float32Array( gridX1 * gridY1 * 3 );
	var normals = new Float32Array( gridX1 * gridY1 * 3 );
	var uvs = new Float32Array( gridX1 * gridY1 * 2 );

	var offset = 0;
	var offset2 = 0;

	for ( var iy = 0; iy < gridY1; iy ++ ) {

		var y = iy * segment_height - height_half;

		for ( var ix = 0; ix < gridX1; ix ++ ) {

			var x = ix * segment_width - width_half;

			vertices[ offset ] = x;
			vertices[ offset + 1 ] = - y;

			normals[ offset + 2 ] = 1;

			uvs[ offset2 ] = ix / gridX;
			uvs[ offset2 + 1 ] = 1 - ( iy / gridY );

			offset += 3;
			offset2 += 2;

		}

	}

	offset = 0;

	var indices = new ( ( vertices.length / 3 ) > 65535 ? Uint32Array : Uint16Array )( gridX * gridY * 6 );

	for ( var iy = 0; iy < gridY; iy ++ ) {

		for ( var ix = 0; ix < gridX; ix ++ ) {

			var a = ix + gridX1 * iy;
			var b = ix + gridX1 * ( iy + 1 );
			var c = ( ix + 1 ) + gridX1 * ( iy + 1 );
			var d = ( ix + 1 ) + gridX1 * iy;

			indices[ offset ] = a;
			indices[ offset + 1 ] = b;
			indices[ offset + 2 ] = d;

			indices[ offset + 3 ] = b;
			indices[ offset + 4 ] = c;
			indices[ offset + 5 ] = d;

			offset += 6;

		}

	}

	this.setIndex( new THREE.BufferAttribute( indices, 1 ) );
	this.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
	this.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
	this.addAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );

};

THREE.PlaneBufferGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
THREE.PlaneBufferGeometry.prototype.constructor = THREE.PlaneBufferGeometry;

THREE.PlaneBufferGeometry.prototype.clone = function () {

	var geometry = new THREE.PlaneBufferGeometry(
		this.parameters.width,
		this.parameters.height,
		this.parameters.widthSegments,
		this.parameters.heightSegments
	);

	geometry.copy( this );

	return geometry;

};


/* ---- static\lib-extras\three\geometries\SphereBufferGeometry.js ---- */
/**
 * @author benaadams / https://twitter.com/ben_a_adams
 * based on THREE.SphereGeometry
 */

THREE.SphereBufferGeometry = function ( radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength ) {

	THREE.BufferGeometry.call( this );

	this.type = 'SphereBufferGeometry';

	this.parameters = {
		radius: radius,
		widthSegments: widthSegments,
		heightSegments: heightSegments,
		phiStart: phiStart,
		phiLength: phiLength,
		thetaStart: thetaStart,
		thetaLength: thetaLength
	};

	radius = radius || 50;

	widthSegments = Math.max( 3, Math.floor( widthSegments ) || 8 );
	heightSegments = Math.max( 2, Math.floor( heightSegments ) || 6 );

	phiStart = phiStart !== undefined ? phiStart : 0;
	phiLength = phiLength !== undefined ? phiLength : Math.PI * 2;

	thetaStart = thetaStart !== undefined ? thetaStart : 0;
	thetaLength = thetaLength !== undefined ? thetaLength : Math.PI;

	var thetaEnd = thetaStart + thetaLength;

	var vertexCount = ( ( widthSegments + 1 ) * ( heightSegments + 1 ) );

	var positions = new THREE.BufferAttribute( new Float32Array( vertexCount * 3 ), 3 );
	var normals = new THREE.BufferAttribute( new Float32Array( vertexCount * 3 ), 3 );
	var uvs = new THREE.BufferAttribute( new Float32Array( vertexCount * 2 ), 2 );

	var index = 0, vertices = [], normal = new THREE.Vector3();

	for ( var y = 0; y <= heightSegments; y ++ ) {

		var verticesRow = [];

		var v = y / heightSegments;

		for ( var x = 0; x <= widthSegments; x ++ ) {

			var u = x / widthSegments;

			var px = - radius * Math.cos( phiStart + u * phiLength ) * Math.sin( thetaStart + v * thetaLength );
			var py = radius * Math.cos( thetaStart + v * thetaLength );
			var pz = radius * Math.sin( phiStart + u * phiLength ) * Math.sin( thetaStart + v * thetaLength );

			normal.set( px, py, pz ).normalize();

			positions.setXYZ( index, px, py, pz );
			normals.setXYZ( index, normal.x, normal.y, normal.z );
			uvs.setXY( index, u, 1 - v );

			verticesRow.push( index );

			index ++;

		}

		vertices.push( verticesRow );

	}

	var indices = [];

	for ( var y = 0; y < heightSegments; y ++ ) {

		for ( var x = 0; x < widthSegments; x ++ ) {

			var v1 = vertices[ y ][ x + 1 ];
			var v2 = vertices[ y ][ x ];
			var v3 = vertices[ y + 1 ][ x ];
			var v4 = vertices[ y + 1 ][ x + 1 ];

			if ( y !== 0 || thetaStart > 0 ) indices.push( v1, v2, v4 );
			if ( y !== heightSegments - 1 || thetaEnd < Math.PI ) indices.push( v2, v3, v4 );

		}

	}

	this.setIndex( new THREE.BufferAttribute( new Uint16Array( indices ), 1 ) );
	this.addAttribute( 'position', positions );
	this.addAttribute( 'normal', normals );
	this.addAttribute( 'uv', uvs );

	this.boundingSphere = new THREE.Sphere( new THREE.Vector3(), radius );

};

THREE.SphereBufferGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
THREE.SphereBufferGeometry.prototype.constructor = THREE.SphereBufferGeometry;

THREE.SphereBufferGeometry.prototype.clone = function () {

	var geometry = new THREE.SphereBufferGeometry(
		this.parameters.radius,
		this.parameters.widthSegments,
		this.parameters.heightSegments,
		this.parameters.phiStart,
		this.parameters.phiLength,
		this.parameters.thetaStart,
		this.parameters.thetaLength
	);

	geometry.copy( this );

	return geometry;

};


/* ---- static\lib-extras\three\shaders\BasicShader.js ---- */
/**
 * @author mrdoob / http://www.mrdoob.com
 *
 * Simple test shader
 */

THREE.BasicShader = {

	uniforms: {},

	vertexShader: [

		"void main() {",

			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"void main() {",

			"gl_FragColor = vec4( 1.0, 0.0, 0.0, 0.5 );",

		"}"

	].join("\n")

};


/* ---- static\lib-extras\three\shaders\CopyShader.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.CopyShader = {

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"opacity":  { type: "f", value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform float opacity;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = texture2D( tDiffuse, vUv );",
			"gl_FragColor = opacity * texel;",

		"}"

	].join("\n")

};


/* ---- static\lib-extras\three\shaders\ConvolutionShader.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Convolution shader
 * ported from o3d sample to WebGL / GLSL
 * http://o3d.googlecode.com/svn/trunk/samples/convolution.html
 */

THREE.ConvolutionShader = {

	defines: {

		"KERNEL_SIZE_FLOAT": "25.0",
		"KERNEL_SIZE_INT": "25",

	},

	uniforms: {

		"tDiffuse":        { type: "t", value: null },
		"uImageIncrement": { type: "v2", value: new THREE.Vector2( 0.001953125, 0.0 ) },
		"cKernel":         { type: "fv1", value: [] }

	},

	vertexShader: [

		"uniform vec2 uImageIncrement;",

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv - ( ( KERNEL_SIZE_FLOAT - 1.0 ) / 2.0 ) * uImageIncrement;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform float cKernel[ KERNEL_SIZE_INT ];",

		"uniform sampler2D tDiffuse;",
		"uniform vec2 uImageIncrement;",

		"varying vec2 vUv;",

		"void main() {",

			"vec2 imageCoord = vUv;",
			"vec4 sum = vec4( 0.0, 0.0, 0.0, 0.0 );",

			"for( int i = 0; i < KERNEL_SIZE_INT; i ++ ) {",

				"sum += texture2D( tDiffuse, imageCoord ) * cKernel[ i ];",
				"imageCoord += uImageIncrement;",

			"}",

			"gl_FragColor = sum;",

		"}"


	].join("\n"),

	buildKernel: function ( sigma ) {

		// We lop off the sqrt(2 * pi) * sigma term, since we're going to normalize anyway.

		function gauss( x, sigma ) {

			return Math.exp( - ( x * x ) / ( 2.0 * sigma * sigma ) );

		}

		var i, values, sum, halfWidth, kMaxKernelSize = 25, kernelSize = 2 * Math.ceil( sigma * 3.0 ) + 1;

		if ( kernelSize > kMaxKernelSize ) kernelSize = kMaxKernelSize;
		halfWidth = ( kernelSize - 1 ) * 0.5;

		values = new Array( kernelSize );
		sum = 0.0;
		for ( i = 0; i < kernelSize; ++i ) {

			values[ i ] = gauss( i - halfWidth, sigma );
			sum += values[ i ];

		}

		// normalize the kernel

		for ( i = 0; i < kernelSize; ++i ) values[ i ] /= sum;

		return values;

	}

};


/* ---- static\lib-extras\three\shaders\VignetteShader.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Vignette shader
 * based on PaintEffect postprocess from ro.me
 * http://code.google.com/p/3-dreams-of-black/source/browse/deploy/js/effects/PaintEffect.js
 */

THREE.VignetteShader = {

	uniforms: {

		"tDiffuse": { type: "t", value: null },
		"offset":   { type: "f", value: 1.0 },
		"darkness": { type: "f", value: 1.0 },
		"color":    { type: "c", value: null }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform float offset;",
		"uniform float darkness;",
		"uniform vec3 color;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

			// Eskil's vignette

			"vec4 texel = texture2D( tDiffuse, vUv );",
			"vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );",
			"gl_FragColor = vec4( mix( texel.rgb, vec3( 1.0 - darkness ) * color, dot( uv, uv ) ), texel.a );",

			/*
			// alternative version from glfx.js
			// this one makes more "dusty" look (as opposed to "burned")

			"vec4 color = texture2D( tDiffuse, vUv );",
			"float dist = distance( vUv, vec2( 0.5 ) );",
			"color.rgb *= smoothstep( 0.8, offset * 0.799, dist *( darkness + offset ) );",
			"gl_FragColor = color;",
			*/

		"}"

	].join("\n")

};


/* ---- static\lib-extras\three\postprocessing\EffectComposer.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.EffectComposer = function ( renderer, renderTarget ) {

	this.renderer = renderer;

	if ( renderTarget === undefined ) {

		var width = window.innerWidth || 1;
		var height = window.innerHeight || 1;
		var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };

		renderTarget = new THREE.WebGLRenderTarget( width, height, parameters );

	}

	this.renderTarget1 = renderTarget;
	this.renderTarget2 = renderTarget.clone();

	this.writeBuffer = this.renderTarget1;
	this.readBuffer = this.renderTarget2;

	this.passes = [];

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.EffectComposer relies on THREE.CopyShader" );

	this.copyPass = new THREE.ShaderPass( THREE.CopyShader );

};

THREE.EffectComposer.prototype = {

	swapBuffers: function() {

		var tmp = this.readBuffer;
		this.readBuffer = this.writeBuffer;
		this.writeBuffer = tmp;

	},

	addPass: function ( pass ) {

		this.passes.push( pass );

	},

	insertPass: function ( pass, index ) {

		this.passes.splice( index, 0, pass );

	},

	render: function ( delta ) {

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;

		var maskActive = false;

		var pass, i, il = this.passes.length;

		for ( i = 0; i < il; i ++ ) {

			pass = this.passes[ i ];

			if ( !pass.enabled ) continue;

			pass.render( this.renderer, this.writeBuffer, this.readBuffer, delta, maskActive );

			if ( pass.needsSwap ) {

				if ( maskActive ) {

					var context = this.renderer.context;

					context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

					this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, delta );

					context.stencilFunc( context.EQUAL, 1, 0xffffffff );

				}

				this.swapBuffers();

			}

			if ( pass instanceof THREE.MaskPass ) {

				maskActive = true;

			} else if ( pass instanceof THREE.ClearMaskPass ) {

				maskActive = false;

			}

		}

	},

	reset: function ( renderTarget ) {

		if ( renderTarget === undefined ) {

			renderTarget = this.renderTarget1.clone();

			renderTarget.width = window.innerWidth;
			renderTarget.height = window.innerHeight;

		}

		this.renderTarget1 = renderTarget;
		this.renderTarget2 = renderTarget.clone();

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;

	},

	setSize: function ( width, height ) {

		var renderTarget = this.renderTarget1.clone();

		renderTarget.width = width;
		renderTarget.height = height;

		this.reset( renderTarget );

	}

};


/* ---- static\lib-extras\three\postprocessing\RenderPass.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

	this.scene = scene;
	this.camera = camera;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 1;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.enabled = true;
	this.clear = true;
	this.needsSwap = false;

};

THREE.RenderPass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

		this.scene.overrideMaterial = this.overrideMaterial;

		if ( this.clearColor ) {

			this.oldClearColor.copy( renderer.getClearColor() );
			this.oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor( this.clearColor, this.clearAlpha );

		}

		renderer.render( this.scene, this.camera, readBuffer, this.clear );

		if ( this.clearColor ) {

			renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );

		}

		this.scene.overrideMaterial = null;

	}

};


/* ---- static\lib-extras\three\postprocessing\SavePass.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.SavePass = function ( renderTarget ) {

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.SavePass relies on THREE.CopyShader" );

	var shader = THREE.CopyShader;

	this.textureID = "tDiffuse";

	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	this.material = new THREE.ShaderMaterial( {

		uniforms: this.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	this.renderTarget = renderTarget;

	if ( this.renderTarget === undefined ) {

		this.renderTargetParameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false };
		this.renderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, this.renderTargetParameters );

	}

	this.enabled = true;
	this.needsSwap = false;
	this.clear = false;


	this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

};

THREE.SavePass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

		if ( this.uniforms[ this.textureID ] ) {

			this.uniforms[ this.textureID ].value = readBuffer;

		}

		this.quad.material = this.material;

		renderer.render( this.scene, this.camera, this.renderTarget, this.clear );

	}

};


/* ---- static\lib-extras\three\postprocessing\ShaderPass.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.ShaderPass = function ( shader, textureID ) {

	this.textureID = ( textureID !== undefined ) ? textureID : "tDiffuse";

	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	this.material = new THREE.ShaderMaterial( {

		uniforms: this.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	this.renderToScreen = false;

	this.enabled = true;
	this.needsSwap = true;
	this.clear = false;


	this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

};

THREE.ShaderPass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

		if ( this.uniforms[ this.textureID ] ) {

			this.uniforms[ this.textureID ].value = readBuffer;

		}

		this.quad.material = this.material;

		if ( this.renderToScreen ) {

			renderer.render( this.scene, this.camera );

		} else {

			renderer.render( this.scene, this.camera, writeBuffer, this.clear );

		}

	}

};


/* ---- static\lib-extras\three\postprocessing\TexturePass.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.TexturePass = function ( texture, opacity ) {

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.TexturePass relies on THREE.CopyShader" );

	var shader = THREE.CopyShader;

	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	this.uniforms[ "opacity" ].value = ( opacity !== undefined ) ? opacity : 1.0;
	this.uniforms[ "tDiffuse" ].value = texture;

	this.material = new THREE.ShaderMaterial( {

		uniforms: this.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );

	this.enabled = true;
	this.needsSwap = false;


	this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

};

THREE.TexturePass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

		this.quad.material = this.material;

		renderer.render( this.scene, this.camera, readBuffer );

	}

};


/* ---- static\lib-extras\three\postprocessing\MaskPass.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.MaskPass = function ( scene, camera ) {

	this.scene = scene;
	this.camera = camera;

	this.enabled = true;
	this.clear = true;
	this.needsSwap = false;

	this.inverse = false;

};

THREE.MaskPass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

		var context = renderer.context;

		// don't update color or depth

		context.colorMask( false, false, false, false );
		context.depthMask( false );

		// set up stencil

		var writeValue, clearValue;

		if ( this.inverse ) {

			writeValue = 0;
			clearValue = 1;

		} else {

			writeValue = 1;
			clearValue = 0;

		}

		context.enable( context.STENCIL_TEST );
		context.stencilOp( context.REPLACE, context.REPLACE, context.REPLACE );
		context.stencilFunc( context.ALWAYS, writeValue, 0xffffffff );
		context.clearStencil( clearValue );

		// draw into the stencil buffer

		renderer.render( this.scene, this.camera, readBuffer, this.clear );
		renderer.render( this.scene, this.camera, writeBuffer, this.clear );

		// re-enable update of color and depth

		context.colorMask( true, true, true, true );
		context.depthMask( true );

		// only render where stencil is set to 1

		context.stencilFunc( context.EQUAL, 1, 0xffffffff );  // draw if == 1
		context.stencilOp( context.KEEP, context.KEEP, context.KEEP );

	}

};


THREE.ClearMaskPass = function () {

	this.enabled = true;

};

THREE.ClearMaskPass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

		var context = renderer.context;

		context.disable( context.STENCIL_TEST );

	}

};


/* ---- static\lib-extras\three\postprocessing\BloomPass.js ---- */
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.BloomPass = function ( strength, kernelSize, sigma, resolution ) {

	strength = ( strength !== undefined ) ? strength : 1;
	kernelSize = ( kernelSize !== undefined ) ? kernelSize : 25;
	sigma = ( sigma !== undefined ) ? sigma : 4.0;
	resolution = ( resolution !== undefined ) ? resolution : 256;

	// render targets

	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat };

	this.renderTargetX = new THREE.WebGLRenderTarget( resolution, resolution, pars );
	this.renderTargetY = new THREE.WebGLRenderTarget( resolution, resolution, pars );

	// copy material

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );

	this.copyUniforms[ "opacity" ].value = strength;

	this.materialCopy = new THREE.ShaderMaterial( {

		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.AdditiveBlending,
		transparent: true

	} );

	// convolution material

	if ( THREE.ConvolutionShader === undefined )
		console.error( "THREE.BloomPass relies on THREE.ConvolutionShader" );

	var convolutionShader = THREE.ConvolutionShader;

	this.convolutionUniforms = THREE.UniformsUtils.clone( convolutionShader.uniforms );

	this.convolutionUniforms[ "uImageIncrement" ].value = THREE.BloomPass.blurx;
	this.convolutionUniforms[ "cKernel" ].value = THREE.ConvolutionShader.buildKernel( sigma );

	this.materialConvolution = new THREE.ShaderMaterial( {

		uniforms: this.convolutionUniforms,
		vertexShader:  convolutionShader.vertexShader,
		fragmentShader: convolutionShader.fragmentShader,
		defines: {
			"KERNEL_SIZE_FLOAT": kernelSize.toFixed( 1 ),
			"KERNEL_SIZE_INT": kernelSize.toFixed( 0 )
		}

	} );

	this.enabled = true;
	this.needsSwap = false;
	this.clear = false;


	this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
	this.scene  = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.scene.add( this.quad );

};

THREE.BloomPass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// Render quad with blured scene into texture (convolution pass 1)

		this.quad.material = this.materialConvolution;

		this.convolutionUniforms[ "tDiffuse" ].value = readBuffer;
		this.convolutionUniforms[ "uImageIncrement" ].value = THREE.BloomPass.blurX;

		renderer.render( this.scene, this.camera, this.renderTargetX, true );


		// Render quad with blured scene into texture (convolution pass 2)

		this.convolutionUniforms[ "tDiffuse" ].value = this.renderTargetX;
		this.convolutionUniforms[ "uImageIncrement" ].value = THREE.BloomPass.blurY;

		renderer.render( this.scene, this.camera, this.renderTargetY, true );

		// Render original scene with superimposed blur to texture

		this.quad.material = this.materialCopy;

		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetY;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

		renderer.render( this.scene, this.camera, readBuffer, this.clear );

	}

};

THREE.BloomPass.blurX = new THREE.Vector2( 0.001953125, 0.0 );
THREE.BloomPass.blurY = new THREE.Vector2( 0.0, 0.001953125 );

