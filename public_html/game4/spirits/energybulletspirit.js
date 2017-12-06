/**
 * @constructor
 * @extends {BaseSpirit}
 */
function EnergyBulletSpirit(screen) {
  BaseSpirit.call(this, screen);
  this.type = Game4BaseScreen.SpiritType.ENERGY_BULLET;

  this.color = new Vec4();

  this.energy = 1;

  // temps
  this.mat44 = new Matrix44();
  this.modelMatrix = new Matrix44();
  this.vec4 = new Vec4();

  // trail stuff
  this.trail = new Trail(2);
  this.segStartVec = new Vec2d();
  this.segEndVec = new Vec2d();

  this.reset(screen);
}
EnergyBulletSpirit.prototype = new BaseSpirit();
EnergyBulletSpirit.prototype.constructor = EnergyBulletSpirit;

EnergyBulletSpirit.prototype.reset = function(screen) {
  BaseSpirit.prototype.reset.call(this, screen);

  this.color.reset();

  // temps
  this.mat44.reset();
  this.modelMatrix.reset();
  this.vec4.reset();

  // trail stuff
  this.trail.reset();
  this.segStartVec.reset();
  this.segEndVec.reset();

  return this;
};

EnergyBulletSpirit.pool = [];

EnergyBulletSpirit.alloc = function(screen) {
  if (EnergyBulletSpirit.pool.length) {
    return EnergyBulletSpirit.pool.pop().reset(screen);
  }
  return new EnergyBulletSpirit(screen);
};

EnergyBulletSpirit.prototype.free = function() {
  EnergyBulletSpirit.pool.push(this);
};

EnergyBulletSpirit.SCHEMA = {
  0: "type",
  1: "id",
  2: "bodyId",
  3: "color",
  4: "energy"
};

EnergyBulletSpirit.getJsoner = function() {
  if (!EnergyBulletSpirit.jsoner) {
    EnergyBulletSpirit.jsoner = new Jsoner(EnergyBulletSpirit.SCHEMA);
  }
  return EnergyBulletSpirit.jsoner;
};

EnergyBulletSpirit.prototype.setModelStamp = function(modelStamp) {
  this.modelStamp = modelStamp;
};

EnergyBulletSpirit.createModel = function() {
  return RigidModel.createCircle(13)
      .setColorRGB(1, 1, 1);
};

EnergyBulletSpirit.prototype.setColorRGB = function(r, g, b) {
  this.color.setXYZ(r, g, b);
};

EnergyBulletSpirit.prototype.onHitEnergizable = function(otherSpirit, pos) {
  otherSpirit.addEnergy(this.energy);
  this.destroyBody();
};

EnergyBulletSpirit.prototype.onHitOther = function(pos) {
  this.destroyBody();
};

EnergyBulletSpirit.prototype.onDraw = function(world, renderer) {
  this.drawTrail();
};

EnergyBulletSpirit.prototype.addTrailSegment = function() {
  var body = this.getBody();
  this.headRad = body.rad;
  this.tailRad = 0;
  this.trail.append(this.now(), this.getBodyPos(), body.vel);
};

EnergyBulletSpirit.prototype.drawTrail = function() {
  var maxTime = this.now();
  var duration = 3;
  var minTime = maxTime - duration;
  var trailWarm = false;
  this.screen.renderer
      .setStamp(this.stamps.cylinderStamp)
      .setColorVector(this.color);
  for (var i = 0; i < this.trail.size(); i++) {
    var segStartTime = this.trail.getSegmentStartTime(i);
    var segEndTime = this.trail.getSegmentEndTime(i);
    var drawStartTime = Math.max(segStartTime, minTime);
    var drawEndTime = Math.min(segEndTime, maxTime);
    if (drawStartTime <= drawEndTime) {
      trailWarm = true;
      // something to draw
      this.trail.getSegmentPosAtTime(i, drawStartTime, this.segStartVec);
      this.trail.getSegmentPosAtTime(i, drawEndTime, this.segEndVec);

      var startRad = this.tailRad + (this.headRad - this.tailRad) * (drawStartTime - minTime) / duration;
      this.modelMatrix.toIdentity()
          .multiply(this.mat44.toTranslateOpXYZ(this.segStartVec.x, this.segStartVec.y, 0))
          .multiply(this.mat44.toScaleOpXYZ(startRad, startRad, 1));
      this.screen.renderer.setModelMatrix(this.modelMatrix);

      var endRad = this.tailRad + (this.headRad - this.tailRad) * (drawEndTime - minTime) / duration;
      this.modelMatrix.toIdentity()
          .multiply(this.mat44.toTranslateOpXYZ(this.segEndVec.x, this.segEndVec.y, 0))
          .multiply(this.mat44.toScaleOpXYZ(endRad, endRad, 1));
      this.screen.renderer.setModelMatrix2(this.modelMatrix);
      this.screen.renderer.drawStamp();
    }
  }
  if (!trailWarm) {
    // The trail has ended and the last spark has faded.
    this.destroy();
  }
};

EnergyBulletSpirit.prototype.destroy = function() {
  // removeSpiritId also frees any spirit that can be freed,
  // so don't double-free or terrible things happen!
  this.screen.world.removeSpiritId(this.id);
  if (this.bodyId) {
    console.error("The trail is cold but the body is unburied. bodyId: " + this.bodyId);
  }
};

EnergyBulletSpirit.prototype.onTimeout = function(world, timeoutVal) {
  this.destroyBody();
};

EnergyBulletSpirit.prototype.destroyBody = function() {
  if (this.bodyId) {
    this.trail.endTime = this.now();
    this.screen.world.removeBodyId(this.bodyId);
    this.bodyId = null;
  }
};

EnergyBulletSpirit.prototype.toJSON = function() {
  return EnergyBulletSpirit.getJsoner().toJSON(this);
};

EnergyBulletSpirit.prototype.setFromJSON = function(json) {
  EnergyBulletSpirit.getJsoner().setFromJSON(json, this);
};
