/**
 * @constructor
 * @extends {BaseSpirit}
 */
function MachineGunSpirit(screen) {
  BaseSpirit.call(this, screen);
  this.type = Game4BaseScreen.SpiritType.MACHINE_GUN;
  this.color = new Vec4().setRGBA(1, 1, 1, 1);

  this.vec2d = new Vec2d();
  this.vec2d2 = new Vec2d();
  this.vec4 = new Vec4();
  this.mat44 = new Matrix44();
  this.modelMatrix = new Matrix44();

  this.lastFireTime = 0;
  this.waitingForFireTimeout = false;
}
MachineGunSpirit.prototype = new BaseSpirit();
MachineGunSpirit.prototype.constructor = MachineGunSpirit;

MachineGunSpirit.FIRE_TIMEOUT_ID = 2;

MachineGunSpirit.FIRE_DISTANCE = 30;
MachineGunSpirit.FIRE_TIMEOUT = 5;
MachineGunSpirit.FIRE_SPEED = 3.5;

MachineGunSpirit.SCHEMA = {
  0: "type",
  1: "id",
  2: "bodyId",
  3: "lastFireTime",
  4: "waitingForFireTimeout"
};

/**
 * @override
 * @returns {boolean}
 */
MachineGunSpirit.prototype.isActivatable = function() {
  return true;
};

MachineGunSpirit.factory = function(screen, pos, dir) {
  let world = screen.world;

  let spirit = new MachineGunSpirit(screen);
  spirit.setColorRGB(1, 1, 1);
  let density = 1;

  let b = Body.alloc();
  b.shape = Body.Shape.CIRCLE;
  b.turnable = true;
  b.grip = 0.25;
  b.setAngPosAtTime(dir, screen.now());
  b.setPosAtTime(pos, screen.now());
  b.rad = 0.7;
  b.hitGroup = screen.getHitGroups().NEUTRAL;
  b.mass = (Math.PI * 4/3) * b.rad * b.rad * b.rad * density;
  b.moi = b.mass * b.rad * b.rad / 2;
  spirit.bodyId = world.addBody(b);

  let spiritId = world.addSpirit(spirit);
  b.spiritId = spiritId;
  return spiritId;
};

MachineGunSpirit.prototype.setColorRGB = function(r, g, b) {
  this.color.setXYZ(r, g, b);
};

MachineGunSpirit.prototype.onTimeout = function(world, timeoutVal) {
  BaseSpirit.prototype.onTimeout.call(this, world, timeoutVal);

  if (timeoutVal === MachineGunSpirit.FIRE_TIMEOUT_ID) {
    if (this.sumOfInputs() > 0) {
      this.fire();
      this.screen.world.addTimeout(this.lastFireTime + MachineGunSpirit.FIRE_TIMEOUT, this.id, MachineGunSpirit.FIRE_TIMEOUT_ID);
      this.waitingForFireTimeout = true; // no-op since it must already be true
    } else {
      this.waitingForFireTimeout = false;
    }
  }
};

MachineGunSpirit.prototype.getModelId = function() {
  return ModelId.MACHINE_GUN;
};

MachineGunSpirit.prototype.getColor = function() {
  let lit = this.sumOfInputs() > 0;
  this.vec4.set(this.color);
  if (lit) {
    this.vec4.scale1(1.2);
  }
  return this.vec4;
};

MachineGunSpirit.prototype.onInputSumUpdate = function() {
  if (this.sumOfInputs() > 0) {
    let now = this.now();
    if (this.lastFireTime + MachineGunSpirit.FIRE_TIMEOUT <= now) {
      this.fire();
    }
    if (!this.waitingForFireTimeout) {
      this.screen.world.addTimeout(this.lastFireTime + MachineGunSpirit.FIRE_TIMEOUT, this.id, MachineGunSpirit.FIRE_TIMEOUT_ID);
      this.waitingForFireTimeout = true;
    }
  }
};

MachineGunSpirit.prototype.fire = function() {
  let pos = this.getBodyPos();
  if (!pos) return;
  let angPos = this.getBodyAngPos();
  let speed = MachineGunSpirit.FIRE_SPEED;
  let dist = MachineGunSpirit.FIRE_DISTANCE * (1 + Math.random() * 0.2);
  let vel = this.vec2d.setXY(0, 1).rot(angPos + 0.05 * (Math.random() - 0.5)).scaleToLength(speed);
  let rad = 0.5;
  let bullet = this.screen.getSpiritById(this.addBullet(pos, angPos, vel, rad, dist / speed));

  // For now, only players can fire weapons.
  bullet.team = Team.PLAYER;

  this.lastFireTime = this.now();
  this.screen.sounds.bew(pos, this.lastFireTime);
  this.screen.splashes.addDotSplash(this.now(),
      this.vec2d2.set(vel).scaleToLength(this.getBody().rad * 1.5).add(pos),
      rad * 2.5, 0.7,
      1, 0.9, 0.9);

  this.addBodyVel(vel.scale(-1 * 0.25 * bullet.getBody().mass / this.getBody().mass));
};

MachineGunSpirit.prototype.addBullet = function(pos, angPos, vel, rad, duration) {
  let now = this.now();
  let spirit = BulletSpirit.alloc(this.screen);
  spirit.setColorRGB(1, 1, 0.5);
  spirit.damage = 1;
  spirit.toughness = 0.5;
  let density = 1;

  let b = Body.alloc();
  b.shape = Body.Shape.CIRCLE;
  b.setPosAtTime(pos, now);
  b.setAngPosAtTime(angPos, now);
  b.setVelAtTime(vel, now);
  b.rad = rad;
  b.hitGroup = this.screen.getHitGroups().PLAYER_FIRE;
  b.mass = (Math.PI * 4/3) * b.rad * b.rad * b.rad * density;
  b.pathDurationMax = duration * 1.01;
  spirit.bodyId = this.screen.world.addBody(b);

  let spiritId = this.screen.world.addSpirit(spirit);
  b.spiritId = spiritId;
  spirit.addTrailSegment();

  // bullet self-destruct timeout
  this.screen.world.addTimeout(now + duration, spiritId, BulletSpirit.SELF_DESTRUCT_TIMEOUT_VAL);

  return spiritId;
};

