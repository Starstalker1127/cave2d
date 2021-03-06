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

  this.lastThumpSoundTime = 0;

  // These represent the futuremost times for each timeout.
  this.nextActiveTime = -1;
  this.nextPassiveTime = -1;

  BaseSpirit.prototype.reset.call(this, screen);
}
BaseSpirit.prototype = new Spirit();
BaseSpirit.prototype.constructor = BaseSpirit;

BaseSpirit.MIN_WALL_THUMP_SILENCE_TIME = 1;

BaseSpirit.STOPPING_SPEED_SQUARED = 0.01 * 0.01;
BaseSpirit.STOPPING_ANGVEL = 0.01;

BaseSpirit.ACTIVE_TIMEOUT_VAL = 1000;
BaseSpirit.PASSIVE_TIMEOUT_VAL = 1001;

BaseSpirit.PASSIVE_TIMEOUT = 1000;

/**
 * Returned by the default getActiveTimeout(), which van be overridden.
 * @type {number}
 */
BaseSpirit.ACTIVE_TIMEOUT = 1.5;

BaseSpirit.prototype.reset = function(screen) {
  this.screen = screen;

  // Violate Law of Demeter here :-/
  if (this.screen) {
    this.stamps = this.screen.stamps;
    this.sounds = this.screen.sounds;
  }

  this.bodyId = -1;
  this.id = -1;
  this.tempBodyPos.reset();

  // energy
  this.energyCapacity = 0;
  this.energy = 0;

  // combat
  this.team = Team.NEUTRAL;
  this.health = 1;

  // harmless and invulnerable
  this.toughness = Infinity;
  this.damage = 0;
};

BaseSpirit.prototype.setColorRGB = function(r, g, b) {
  this.color.setXYZ(r, g, b);
};

/**
 * @returns {boolean} true if the spirit's body exists and is completely stopped after the call.
 */
BaseSpirit.prototype.maybeStop = function() {
  let body = this.getBody();
  let angStopped = false;
  let linStopped = false;
  if (!body) {
    return false;
  } else {
    let oldAngVelMag = Math.abs(this.getBodyAngVel());
    if (!oldAngVelMag) {
      angStopped = true;
    } else if (oldAngVelMag < BaseSpirit.STOPPING_ANGVEL) {
      this.setBodyAngVel(0);
      angStopped = true;
    }
    let oldVelMagSq = body.vel.magnitudeSquared();
    if (!oldVelMagSq) {
      linStopped = true;
    } else if (oldVelMagSq < BaseSpirit.STOPPING_SPEED_SQUARED) {
      this.setBodyVel(Vec2d.ZERO);
      linStopped = true;
    }
  }
  return angStopped && linStopped;
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
  let body = this.screen.world.getBodyByPathId(this.scanResp.pathId);
  return this.screen.getSpiritForBody(body);
};

BaseSpirit.prototype.getBody = function() {
  return this.screen.world.bodies[this.bodyId];
};

BaseSpirit.prototype.getBodyPos = function() {
  let body = this.getBody();
  return body ? body.getPosAtTime(this.now(), this.tempBodyPos) : null;
};

BaseSpirit.prototype.setBodyVel = function(v) {
  let body = this.getBody();
  return body ? body.setVelAtTime(v, this.now()) : null;
};

BaseSpirit.prototype.addBodyVel = function(v) {
  let body = this.getBody();
  return body ? body.addVelAtTime(v, this.now()) : null;
};

BaseSpirit.prototype.getBodyAngPos = function() {
  let body = this.getBody();
  return body ? body.getAngPosAtTime(this.now()) : null;
};

BaseSpirit.prototype.setBodyAngPos = function(ap) {
  let body = this.getBody();
  if (body) {
    body.setAngPosAtTime(ap, this.now());
  }
};

BaseSpirit.prototype.getBodyAngVel = function() {
  let body = this.getBody();
  return body ? body.angVel : null;
};

BaseSpirit.prototype.setBodyAngVel = function(av) {
  let body = this.getBody();
  if (body) {
    return body.setAngVelAtTime(av, this.now());
  }
};

BaseSpirit.prototype.addBodyAngVel = function(av) {
  let body = this.getBody();
  if (body) {
    return body.addAngVelAtTime(av, this.now());
  }
};

BaseSpirit.prototype.now = function() {
  return this.screen.now();
};

BaseSpirit.prototype.addTimeout = function(time, spiritId, timeoutVal) {
  this.screen.world.addTimeout(time, spiritId, timeoutVal);
};

BaseSpirit.prototype.getFriction = function() {
  return this.screen.isPlaying() ? Game4PlayScreen.FRICTION : 0.3;
};

BaseSpirit.prototype.getAngleToBody = function(body) {
  let thisPos = this.getBodyPos();
  let thatPos = body.getPosAtTime(this.now(), Vec2d.alloc());
  let p = thatPos.subtract(thisPos);
  let angle = p.angle();
  thatPos.free();
  return angle;
};

BaseSpirit.prototype.getAngleDiff = function(toAngle) {
  let angleDiff = toAngle - this.getBodyAngPos();
  while (angleDiff > Math.PI) {
    angleDiff -= 2 * Math.PI;
  }
  while (angleDiff < -Math.PI) {
    angleDiff += 2 * Math.PI;
  }
  return angleDiff;
};

BaseSpirit.prototype.getColor = function() {
  return this.color;
};

BaseSpirit.prototype.getModelId = function() {
  return -1;
};

BaseSpirit.prototype.drawBody = function() {
  let body = this.getBody();
  let pos = this.getBodyPos();
  this.distOutsideViewCircles = this.screen.distOutsideViewCircles(pos);
  if (this.distOutsideViewCircles < 2 * body.rad) {
    this.modelMatrix.toIdentity()
        .multiply(this.mat44.toTranslateOpXYZ(pos.x, pos.y, 0))
        .multiply(this.mat44.toScaleOpXYZ(body.rad, body.rad, 1))
        .multiply(this.mat44.toRotateZOp(-this.getBodyAngPos()));
    this.screen.drawModel(this.getModelId(), this.getColor(), this.modelMatrix);
  }
};

BaseSpirit.prototype.onDraw = function(world, renderer) {
  this.drawBody();
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
  this.onInputSumUpdate();
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
  this.onInputSumUpdate();
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
  this.onInputSumUpdate();
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
  this.onInputSumUpdate();
};

BaseSpirit.prototype.onInputSumUpdate = function() {
  // maybe something changed?
};

BaseSpirit.prototype.sumOfInputs = function() {
  let sum = 0;
  for (let sourceId in this.inputIds) {
    let sourceSpirit = this.screen.getSpiritById(sourceId);
    if (sourceSpirit) {
      sum += sourceSpirit.getOutputToTarget(this.id) || 0;
    } else {
      delete this.inputIds[sourceId];
    }
  }
  let now = this.now();
  for (let endTime in this.pulseEndToVal) {
    if (endTime >= now) {
      sum += this.pulseEndToVal[endTime];
    } else {
      delete this.pulseEndToVal[endTime];
    }
  }
  return sum;
};


///////////
// ENERGY
///////////

/**
 * This might cause the amount of energy in the spirit to decrease, if it's higher
 * than the new capacity.
 * @param {number} newCapacity
 * @returns {number} The amount of energy lost due to overflow.
 */
BaseSpirit.prototype.setEnergyCapacity = function(newCapacity) {
  this.energyCapacity = newCapacity;
  return this.setEnergy(this.energy);
};

BaseSpirit.prototype.getEnergyCapacity = function() {
  return this.energyCapacity;
};

/**
 * @param {number} e
 * @returns {number} the amount of requested energy that was *not* added.
 * If the energy added would have caused the spirit to go over capacity,
 * then this will be positive. If it was cause energy to go below zero, this will
 * be negative. Otherwise this will be zero.
 */
BaseSpirit.prototype.setEnergy = function(e) {
  let newEnergy = Math.max(0, Math.min(this.energyCapacity, e));
  let overflow = e - newEnergy;
  this.energy = newEnergy;
  return overflow;
};

BaseSpirit.prototype.getEnergy = function() {
  return this.energy;
};

/**
 * @param {number} e
 * @returns {number} the amount of requested energy that was *not* added.
 * If the energy added would have caused the spirit to go over capacity,
 * then this will be positive. If it was cause energy to go below zero, this will
 * be negative. Otherwise this will be zero.
 */
BaseSpirit.prototype.addEnergy = function(e) {
  return this.setEnergy(this.energy + e);
};

//////////////////
// Collision Biz
//////////////////

BaseSpirit.prototype.damagesTeam = function(otherTeam) {
  if (!this.damage) return false;
  return (this.team === Team.PLAYER && otherTeam === Team.ENEMY) ||
      (this.team === Team.ENEMY && otherTeam === Team.PLAYER) ||
      (this.team === Team.NEUTRAL);
};

BaseSpirit.prototype.applyDamage = function(damage) {
  this.health -= damage / this.toughness;
  if (this.health <= 0) {
    this.die();
  }
};

/**
 * Called after bouncing and damage exchange are done.
 * @param {Vec2d} collisionVec
 * @param {Number} mag the magnitude of the collision, kinda?
 * @param {Body} otherBody
 * @param {Spirit} otherSpirit
 */
BaseSpirit.prototype.onHitOther = function(collisionVec, mag, otherBody, otherSpirit) {
  // Override me!
  let body = this.getBody();
  if (!body) return;
  let now = this.now();
  if (this.lastThumpSoundTime + BaseSpirit.MIN_WALL_THUMP_SILENCE_TIME < this.now()) {
    this.screen.sounds.wallThump(this.getBodyPos(), mag);
  }
  this.lastThumpSoundTime = now;

  this.maybeWake();
};

/////////////
// Timeouts
/////////////

BaseSpirit.prototype.scheduleActiveTimeout = function(time) {
  if (this.nextActiveTime < time) {
    if (this.changeListener) {
      this.changeListener.onBeforeSpiritChange(this);
    }
    this.screen.world.addTimeout(time, this.id, BaseSpirit.ACTIVE_TIMEOUT_VAL);
    this.nextActiveTime = time;
  }
};

BaseSpirit.prototype.schedulePassiveTimeout = function(time) {
  if (this.nextPassiveTime < time) {
    if (this.changeListener) {
      this.changeListener.onBeforeSpiritChange(this);
    }
    this.screen.world.addTimeout(time, this.id, BaseSpirit.PASSIVE_TIMEOUT_VAL);
    this.nextPassiveTime = time;
  }
};

BaseSpirit.prototype.doPassiveTimeout = function(world) {
  let timeoutDuration = BaseSpirit.PASSIVE_TIMEOUT * (0.9 + 0.1 * Math.random());
  if (this.nextActiveTime < this.now()) {
    // There is no scheduled active time,
    // so the passive timeout loop is in charge of invalidating paths.
    let body = this.getBody();
    body.pathDurationMax = timeoutDuration * 1.01;
    body.invalidatePath();
  }
  this.schedulePassiveTimeout(this.now() + timeoutDuration);
};

BaseSpirit.prototype.onTimeout = function(world, timeoutVal) {
  if (this.changeListener) {
    this.changeListener.onBeforeSpiritChange(this);
  }
  // Allow -1 timeouts because that's the initial value.
  // But after those fire, no dupes can be created.
  if (timeoutVal === BaseSpirit.ACTIVE_TIMEOUT_VAL) {
    if (this.now() === this.nextActiveTime || this.nextActiveTime === -1) {
      this.doActiveTimeout();
    // } else {
    //   console.log('dropping active timeout because now != nextActiveTime', this.now(), this.nextActiveTime);
    }
  } else if (timeoutVal === BaseSpirit.PASSIVE_TIMEOUT_VAL) {
    if (this.now() === this.nextPassiveTime || this.nextPassiveTime === -1) {
      this.doPassiveTimeout();
    // } else {
    //   console.log('dropping passive timeout because now != nextPassiveTime', this.now(), this.nextPassiveTime);
    }
  } else if (timeoutVal === -1) {
    // console.log('legacy timeout - schedule new active and passive timeouts');
    // This is an old timeout from  before the passive/active biz.
    // Ignore it, but start the new-style timeouts.
    this.scheduleActiveTimeout(this.now() + this.getActiveTimeout() * Math.random());
    this.schedulePassiveTimeout(this.now() + BaseSpirit.PASSIVE_TIMEOUT * Math.random());
  }
};

BaseSpirit.prototype.doActiveTimeout = function(world) {
  if (!this.screen.isPlaying()) {
    this.doEditorActiveTimeout();
  } else {
    this.doPlayingActiveTimeout();
  }
};

BaseSpirit.prototype.doEditorActiveTimeout = function() {
  let now = this.now();
  this.lastControlTime = this.lastControlTime || (this.now() - this.getActiveTimeout());
  let time = Math.max(0, Math.min(this.getActiveTimeout(), now - this.lastControlTime));
  let body = this.getBody();
  let friction = this.getFriction();
  body.applyLinearFrictionAtTime(friction * time, now);
  body.applyAngularFrictionAtTime(friction * time, now);
  let stopped = this.maybeStop();
  if (stopped) {
    // Assume the next timeout will be the passive one.
    let timeoutDuration = BaseSpirit.PASSIVE_TIMEOUT;
    body.pathDurationMax = timeoutDuration * 1.01;
    body.invalidatePath();
    // Do not schedule another active timeout.
  } else {
    // keep braking
    let timeoutDuration = this.getActiveTimeout() * (0.9 + 0.1 * Math.random());
    body.pathDurationMax = timeoutDuration * 1.01;
    body.invalidatePath();
    this.scheduleActiveTimeout(now + timeoutDuration);
  }
};

/**
 * override me to make something neat happen
 */
BaseSpirit.prototype.doPlayingActiveTimeout = function() {
  this.doEditorActiveTimeout();
};

/**
 * override me to change the active timeout
 * @returns {number}
 */
BaseSpirit.prototype.getActiveTimeout = function() {
  return BaseSpirit.ACTIVE_TIMEOUT;
};

BaseSpirit.prototype.maybeWake = function() {
  this.scheduleActiveTimeout(this.now());
};

BaseSpirit.prototype.startTimeouts = function() {
  this.scheduleActiveTimeout(this.now());
  this.schedulePassiveTimeout(this.now() + BaseSpirit.PASSIVE_TIMEOUT * Math.random());
};