/**
 * @constructor
 * @extends {BaseSpirit}
 */
function ActivatorGunSpirit(screen) {
  BaseSpirit.call(this, screen);
  this.type = Game4BaseScreen.SpiritType.ACTIVATOR_GUN;
  this.color = new Vec4().setRGBA(1, 1, 1, 1);

  this.vec2d = new Vec2d();
  this.vec2d2 = new Vec2d();
  this.vec4 = new Vec4();
  this.mat44 = new Matrix44();
  this.modelMatrix = new Matrix44();
  this.viewportsFromCamera = 0;

  this.lastFireTime = 0;
}
ActivatorGunSpirit.prototype = new BaseSpirit();
ActivatorGunSpirit.prototype.constructor = ActivatorGunSpirit;

ActivatorGunSpirit.MEASURE_TIMEOUT = 1.2;
ActivatorGunSpirit.MAX_TIMEOUT = 10;

ActivatorGunSpirit.FIRE_TIMEOUT = 1.2;

ActivatorGunSpirit.SCHEMA = {
  0: "type",
  1: "id",
  2: "bodyId",
  3: "lastFireTime"
};

/**
 * @override
 * @returns {boolean}
 */
ActivatorGunSpirit.prototype.isActivatable = function() {
  return true;
};

ActivatorGunSpirit.getJsoner = function() {
  if (!ActivatorGunSpirit.jsoner) {
    ActivatorGunSpirit.jsoner = new Jsoner(ActivatorGunSpirit.SCHEMA);
  }
  return ActivatorGunSpirit.jsoner;
};

ActivatorGunSpirit.prototype.toJSON = function() {
  return ActivatorGunSpirit.getJsoner().toJSON(this);
};

ActivatorGunSpirit.prototype.setFromJSON = function(json) {
  ActivatorGunSpirit.getJsoner().setFromJSON(json, this);
};

ActivatorGunSpirit.prototype.setModelStamp = function(modelStamp) {
  this.modelStamp = modelStamp;
};

ActivatorGunSpirit.createModel = function() {
  var model = new RigidModel();
  var body = RigidModel.createCircle(17).setColorRGB(0.5, 0.5, 0.5);
  var thick = 0.3;
  var barrel = RigidModel.createSquare()
      .transformPositions(new Matrix44().toTranslateOpXYZ(0, 1, -0.1))
      .transformPositions(new Matrix44().toScaleOpXYZ(thick, 0.6, 1))
      .addRigidModel(RigidModel.createCircle(9)
          .transformPositions(new Matrix44().toTranslateOpXYZ(0, 0, -0.1))
          .transformPositions(new Matrix44().toScaleOpXYZ(thick, thick, 1)))
      .setColorRGB(0, 0.9, 1);
  return model.addRigidModel(body).addRigidModel(barrel);
};

ActivatorGunSpirit.factory = function(screen, stamp, pos, dir) {
  var world = screen.world;

  var spirit = new ActivatorGunSpirit(screen);
  spirit.setModelStamp(stamp);
  spirit.setColorRGB(1, 1, 1);
  var density = 1;

  var b = Body.alloc();
  b.shape = Body.Shape.CIRCLE;
  b.turnable = true;
  b.grip = 0.9;
  b.setAngPosAtTime(dir, screen.now());
  b.setPosAtTime(pos, screen.now());
  b.rad = 0.6;
  b.hitGroup = screen.getHitGroups().NEUTRAL;
  b.mass = (Math.PI * 4/3) * b.rad * b.rad * b.rad * density;
  b.moi = b.mass * b.rad * b.rad / 2;
  spirit.bodyId = world.addBody(b);

  var spiritId = world.addSpirit(spirit);
  b.spiritId = spiritId;
  world.addTimeout(screen.now(), spiritId, -1);
  return spiritId;
};

ActivatorGunSpirit.prototype.setColorRGB = function(r, g, b) {
  this.color.setXYZ(r, g, b);
};

ActivatorGunSpirit.prototype.onTimeout = function(world, timeoutVal) {
  if (this.changeListener) {
    this.changeListener.onBeforeSpiritChange(this);
  }
  var body = this.getBody();
  var pos = this.getBodyPos();
  this.stress = this.stress || 0;

  var friction = this.screen.isPlaying() ? 0.05 : 0.3;

  var now = this.now();
  var time = ActivatorGunSpirit.MEASURE_TIMEOUT;

  // friction
  body.applyLinearFrictionAtTime(friction * time, now);
  body.applyAngularFrictionAtTime(friction * time, now);

  var newVel = this.vec2d.set(body.vel);

  var oldAngVelMag = Math.abs(this.getBodyAngVel());
  if (oldAngVelMag && oldAngVelMag < ActivatorGunSpirit.STOPPING_ANGVEL) {
    this.setBodyAngVel(0);
  }
  var oldVelMagSq = newVel.magnitudeSquared();
  if (oldVelMagSq && oldVelMagSq < ActivatorGunSpirit.STOPPING_SPEED_SQUARED) {
    newVel.reset();
  }

  // Reset the body's pathDurationMax because it gets changed at compile-time,
  // but it is serialized at level-save-time, so old saved values might not
  // match the new compiled-in values. Hm.
  var timeoutDuration = Math.min(
      ActivatorGunSpirit.MAX_TIMEOUT,
      ActivatorGunSpirit.MEASURE_TIMEOUT * Math.max(1, this.viewportsFromCamera) * (0.2 * Math.random() + 0.9));
  body.pathDurationMax = timeoutDuration * 1.1;
  body.setVelAtTime(newVel, now);
  body.invalidatePath();
  world.addTimeout(now + timeoutDuration, this.id, -1);

  if (this.sumOfInputs() > 0) {
    this.fire();
  }
};

ActivatorGunSpirit.prototype.onDraw = function(world, renderer) {
  var body = this.getBody();
  var pos = this.getBodyPos();
  this.viewportsFromCamera = this.screen.approxViewportsFromCamera(pos);
  if (!ActivatorGunSpirit.OPTIMIZE || this.viewportsFromCamera < 1.1) {
    var lit = this.sumOfInputs() > 0;
    this.vec4.set(this.color);
    if (lit) {
      this.vec4.scale1(1.2);
    }
    renderer
        .setStamp(this.modelStamp)
        .setColorVector(this.vec4);
    this.modelMatrix.toIdentity()
        .multiply(this.mat44.toTranslateOpXYZ(pos.x, pos.y, 0))
        .multiply(this.mat44.toScaleOpXYZ(body.rad, body.rad, 1))
        .multiply(this.mat44.toRotateZOp(-this.getBodyAngPos()));
    renderer.setModelMatrix(this.modelMatrix);
    renderer.drawStamp();
  }
};

ActivatorGunSpirit.prototype.fire = function() {
  var pos = this.getBodyPos();
  if (!pos) return;
  var angPos = this.getBodyAngPos();
  this.addBullet(
      pos,
      this.vec2d.setXY(0, 1).rot(angPos).scaleToLength(4),
      0.3,
      6 + Math.random() * 2);
  // var now = this.now();
  // this.screen.world.addTimeout(now + this.firePeriod, this.spirit.id, this.fireTimeoutId);
  // this.timeoutRunning = true;
  // this.screen.sounds.pew(pos, now);
};

ActivatorGunSpirit.prototype.addBullet = function(pos, vel, rad, duration) {
  var now = this.now();
  var spirit = ActivatorBulletSpirit.alloc(this.screen);
  spirit.setColorRGB(1, 1, 1);
  var density = 0;

  var b = Body.alloc();
  b.shape = Body.Shape.CIRCLE;
  b.setPosAtTime(pos, now);
  b.setVelAtTime(vel, now);
  b.rad = rad;
  b.hitGroup = this.screen.getHitGroups().BEAM;
  b.mass = (Math.PI * 4/3) * b.rad * b.rad * b.rad * density;
  b.pathDurationMax = duration * 1.01;
  spirit.bodyId = this.screen.world.addBody(b);

  var spiritId = this.screen.world.addSpirit(spirit);
  b.spiritId = spiritId;
  spirit.addTrailSegment();

  // bullet self-destruct timeout
  this.screen.world.addTimeout(now + duration, spiritId, 0);

  return spiritId;
};

