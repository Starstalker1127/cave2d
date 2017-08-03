/**
 * @constructor
 * @extends {Spirit}
 */
function BaseSpirit(screen) {
  Spirit.call(this);

  this.tempBodyPos = new Vec2d();
  this.scanVec = new Vec2d();
  this.scanResp = new ScanResponse();

  // activation input/output...

  // Source maintains map from target spirit IDs to output values to those targets, in case source gets polled.
  this.outputIdsToVals = {};
  // Target maintains set of source spirit IDs, for polling.
  this.inputIds = {};
  // Target also maintains map from pulse input end time to pulse input value.
  this.pulseEndToVal = {};

  BaseSpirit.prototype.reset.call(this, screen);
}
BaseSpirit.prototype = new Spirit();
BaseSpirit.prototype.constructor = BaseSpirit;

BaseSpirit.prototype.reset = function(screen) {
  this.screen = screen;

  // Violate Law of Demeter here :-/
  if (this.screen) {
    this.stamps = this.screen.stamps;
    this.sounds = this.screen.sounds;
  }

  this.bodyId = -1;
  this.id = -1;
  this.modelStamp = null;
  this.tempBodyPos.reset();
};

BaseSpirit.prototype.setModelStamp = function(modelStamp) {
  this.modelStamp = modelStamp;
};

BaseSpirit.prototype.setColorRGB = function(r, g, b) {
  this.color.setXYZ(r, g, b);
};

/**
 * @param group
 * @param pos
 * @param dir
 * @param dist
 * @param rad
 * @returns {number} a fraction (0 to 1) of the total scan distance , or -1 if there was no hit
 */
BaseSpirit.prototype.scan = function(group, pos, dir, dist, rad) {
  return this.screen.scan(
      group,
      pos,
      this.scanVec.setXY(
          Math.sin(dir) * dist,
          Math.cos(dir) * dist),
      rad,
      this.scanResp);
};

/**
 * @param group
 * @param pos
 * @param vel
 * @param rad
 * @returns {number} a fraction (0 to 1) of the total scan distance , or -1 if there was no hit
 */
BaseSpirit.prototype.scanWithVel = function(group, pos, vel, rad) {
  return this.screen.scan(
      group,
      pos,
      vel,
      rad,
      this.scanResp);
};

BaseSpirit.prototype.getScanHitBody = function() {
  return this.screen.world.getBodyByPathId(this.scanResp.pathId);
};

BaseSpirit.prototype.getScanHitSpirit = function() {
  var body = this.screen.world.getBodyByPathId(this.scanResp.pathId);
  return this.screen.getSpiritForBody(body);
};

BaseSpirit.prototype.getBody = function() {
  return this.screen.world.bodies[this.bodyId];
};

BaseSpirit.prototype.getBodyPos = function() {
  var body = this.getBody();
  return body ? body.getPosAtTime(this.now(), this.tempBodyPos) : null;
};

BaseSpirit.prototype.setBodyVel = function(v) {
  var body = this.getBody();
  return body ? body.setVelAtTime(v, this.now()) : null;
};

BaseSpirit.prototype.addBodyVel = function(v) {
  var body = this.getBody();
  return body ? body.setVelAtTime(v, this.now()) : null;
};

BaseSpirit.prototype.getBodyAngPos = function() {
  var body = this.getBody();
  return body ? body.getAngPosAtTime(this.now()) : null;
};

BaseSpirit.prototype.setBodyAngPos = function(ap) {
  var body = this.getBody();
  if (body) {
    body.setAngPosAtTime(ap, this.now());
  }
};

BaseSpirit.prototype.getBodyAngVel = function() {
  var body = this.getBody();
  return body ? body.angVel : null;
};

BaseSpirit.prototype.setBodyAngVel = function(av) {
  var body = this.getBody();
  if (body) {
    return body.setAngVelAtTime(av, this.now());
  }
};

BaseSpirit.prototype.addBodyAngVel = function(av) {
  var body = this.getBody();
  if (body) {
    return body.addAngVelAtTime(av, this.now());
  }
};

BaseSpirit.prototype.now = function() {
  return this.screen.now();
};


//////////////////////////
// Input/Output
//////////////////////////

BaseSpirit.prototype.isActivatable = function() {
  return false;
};

/**
 * Adds an output source spirit to this target spirit, so this target can poll it.
 * @param sourceSpiritId
 */
BaseSpirit.prototype.addInputSource = function(sourceSpiritId) {
  this.inputIds[sourceSpiritId] = true;
};

/**
 * @param sourceSpiritId
 */
BaseSpirit.prototype.isInputSource = function(sourceSpiritId) {
  return !!this.inputIds[sourceSpiritId];
};

/**
 * Removes an output source spirit from this target spirit.
 * @param sourceSpiritId
 */
BaseSpirit.prototype.removeInputSource = function(sourceSpiritId) {
  delete this.inputIds[sourceSpiritId];
};

/**
 * Tells this target spirit that a source's input value has changed.
 * Override this to do something useful.
 * @param sourceSpiritId
 * @param val
 */
BaseSpirit.prototype.onInputChanged = function(sourceSpiritId, val) {
  // Usually the impl will re-evaluate all inputs to decide what to do,
  // but I'm including the actual new val too in case.
};

/**
 * @param targetId
 * @returns {*|number} this spirit's output to the target
 */
BaseSpirit.prototype.getOutputToTarget = function(targetId) {
  return this.outputIdsToVals[targetId];
};

BaseSpirit.prototype.addInputPulse = function(endTime, val) {
  if (this.pulseEndToVal[endTime]) {
    this.pulseEndToVal[endTime] += val;
  } else {
    this.pulseEndToVal[endTime] = val;
  }
};

BaseSpirit.prototype.sumOfInputs = function() {
  var sum = 0;
  for (var sourceId in this.inputIds) {
    var sourceSpirit = this.screen.getSpiritById(sourceId);
    if (sourceSpirit) {
      sum += sourceSpirit.getOutputToTarget(this.id) || 0;
    } else {
      delete this.inputIds[sourceId];
    }
  }
  var now = this.now();
  for (var endTime in this.pulseEndToVal) {
    if (endTime >= now) {
      sum += this.pulseEndToVal[endTime];
    } else {
      delete this.pulseEndToVal[endTime];
    }
  }
  return sum;
};