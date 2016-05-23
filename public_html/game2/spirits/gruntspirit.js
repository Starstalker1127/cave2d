/**
 * @constructor
 * @extends {Spirit}
 */
function GruntSpirit(screen) {
  Spirit.call(this);
  this.screen = screen;
  this.bodyId = -1;
  this.id = -1;
  this.modelStamp = null;

  this.type = BaseScreen.SpiritType.GRUNT;
  this.color = new Vec4().setRGBA(1, 1, 1, 1);
  // 0 is up, PI/2 is right
  this.dir = 0;//Math.random() * Math.PI * 2;
  this.angVel = 0;

  this.tempBodyPos = new Vec2d();
  this.vec2d = new Vec2d();
  this.scanVec = new Vec2d();
  this.scanResp = new ScanResponse();
  this.vec4 = new Vec4();
  this.mat44 = new Matrix44();
  this.modelMatrix = new Matrix44();
  this.accel = new Vec2d();
  this.stress = 0;

  this.lastControlTime = this.screen.now();
  this.viewportsFromCamera = 0;
}
GruntSpirit.prototype = new Spirit();
GruntSpirit.prototype.constructor = GruntSpirit;

GruntSpirit.MEASURE_TIMEOUT = 0.1;
GruntSpirit.THRUST = 2;
GruntSpirit.MAX_TIMEOUT = 10;
GruntSpirit.LOW_POWER_VIEWPORTS_AWAY = 2;
GruntSpirit.STOPPING_SPEED_SQUARED = 0.01 * 0.01;
GruntSpirit.OPTIMIZE = true;

GruntSpirit.SCHEMA = {
  0: "type",
  1: "id",
  2: "bodyId",
  3: "color",
  4: "dir",
  5: "angVel",
  6: "stress"
};

GruntSpirit.getJsoner = function() {
  if (!GruntSpirit.jsoner) {
    GruntSpirit.jsoner = new Jsoner(GruntSpirit.SCHEMA);
  }
  return GruntSpirit.jsoner;
};

GruntSpirit.prototype.toJSON = function() {
  return GruntSpirit.getJsoner().toJSON(this);
};

GruntSpirit.prototype.setFromJSON = function(json) {
  GruntSpirit.getJsoner().setFromJSON(json, this);
};

GruntSpirit.prototype.setModelStamp = function(modelStamp) {
  this.modelStamp = modelStamp;
};

GruntSpirit.createModel = function() {
  return RigidModel.createCircleMesh(4)
      .setColorRGB(0.2, 0.7, 0)
      .addRigidModel(RigidModel.createSquare()
          .transformPositions(new Matrix44().toScaleOpXYZ(0.1, 0.5, 1))
          .transformPositions(new Matrix44().toTranslateOpXYZ(0, 1, 0))
          .transformPositions(new Matrix44().toRotateZOp(Math.PI / 8)))
      .addRigidModel(RigidModel.createSquare()
          .transformPositions(new Matrix44().toScaleOpXYZ(0.1, 0.5, 1))
          .transformPositions(new Matrix44().toTranslateOpXYZ(0, 1, 0))
          .transformPositions(new Matrix44().toRotateZOp(-Math.PI / 8)));
};

GruntSpirit.factory = function(playScreen, stamp, pos, dir) {
  var world = playScreen.world;

  var spirit = new GruntSpirit(playScreen);
  spirit.setModelStamp(stamp);
  spirit.setColorRGB(1, 1, 1);
  var density = 1;

  var b = Body.alloc();
  b.shape = Body.Shape.CIRCLE;
  b.setPosAtTime(pos, world.now);
  b.rad = 0.8;
  b.hitGroup = BaseScreen.Group.ROCK;
  b.mass = (Math.PI * 4/3) * b.rad * b.rad * b.rad * density;
  b.pathDurationMax = GruntSpirit.MEASURE_TIMEOUT * 1.1;
  spirit.bodyId = world.addBody(b);

  var spiritId = world.addSpirit(spirit);
  b.spiritId = spiritId;
  world.addTimeout(world.now, spiritId, -1);
  return spiritId;
};

GruntSpirit.prototype.setColorRGB = function(r, g, b) {
  this.color.setXYZ(r, g, b);
};

GruntSpirit.prototype.scan = function(pos, rot, dist, rad) {
  return this.screen.scan(
      BaseScreen.Group.ROCK,
      pos,
      this.scanVec.setXY(
          Math.sin(this.dir + rot) * dist,
          Math.cos(this.dir + rot) * dist),
      rad,
      this.scanResp);
};

GruntSpirit.prototype.onTimeout = function(world, timeoutVal) {
  var body = this.getBody(world);
  var pos = body.getPosAtTime(world.now, this.tempBodyPos);
  this.stress = this.stress || 0;

  var friction = 0.05;
  var traction = 0.5;

  var now = this.screen.now();
  var time = Math.min(GruntSpirit.MEASURE_TIMEOUT, now - this.lastControlTime);
  this.lastControlTime = now;

  var newVel = this.vec2d.set(body.vel);

  // friction
  this.accel.set(newVel).scale(-friction * time);
  newVel.add(this.accel);
  if (GruntSpirit.OPTIMIZE && newVel.magnitudeSquared() < GruntSpirit.STOPPING_SPEED_SQUARED) {
    newVel.reset();
  }

  if (this.screen.isPlaying()) {
    if (!GruntSpirit.OPTIMIZE || this.viewportsFromCamera < GruntSpirit.LOW_POWER_VIEWPORTS_AWAY) {
      this.accel.set(body.vel).scale(-traction * time);
      newVel.add(this.accel);
      var antennaRotMag = Math.max(Math.PI * 0.13, Math.PI * this.stress);
      var scanDist = body.rad * (3 + (1 - this.stress));
      var scanRot = 2 * antennaRotMag * (Math.random() - 0.5);
      var dist = this.scan(pos, scanRot, scanDist, body.rad, this.scanResp);
      var angAccel, thrust;
      if (dist >= 0) {
        // rayscan hit
        var otherSpirit = this.getScanHitSpirit();
        if (otherSpirit && otherSpirit.type == BaseScreen.SpiritType.PLAYER) {
          // attack player!
          this.stress = 0;
          angAccel = 0;
          this.angVel = 0;
          this.dir += scanRot;
          thrust = GruntSpirit.THRUST * 10;
        } else {
          // avoid obstruction
          angAccel = -scanRot * (this.stress * 0.8 + 0.2);
          this.stress += 0.03;
          thrust = GruntSpirit.THRUST * (dist - 0.05 * this.stress);
        }
      } else {
        // clear path
        if (this.stress > 0.5) {
          // escape!
          angAccel = 0;
          this.angVel = 0;
          this.dir += scanRot;
        } else {
          angAccel = scanRot * (this.stress * 0.8 + 0.2);
        }
        this.stress = 0;
        thrust = GruntSpirit.THRUST;
      }
      this.stress = Math.min(1, Math.max(0, this.stress));

      this.angVel *= 0.5;
      this.angVel += angAccel;
      this.dir += this.angVel;

      this.accel.setXY(Math.sin(this.dir), Math.cos(this.dir))
          .scale(thrust * traction * time);
      newVel.add(this.accel);
    }
  }
  // Reset the body's pathDurationMax because it gets changed at compile-time,
  // but it is serialized at level-save-time, so old saved values might not
  // match the new compiled-in values. Hm.
  var timeoutDuration;
  if (GruntSpirit.OPTIMIZE) {
    timeoutDuration = Math.min(
        GruntSpirit.MAX_TIMEOUT,
            GruntSpirit.MEASURE_TIMEOUT * Math.max(1, this.viewportsFromCamera));
  } else {
    timeoutDuration = GruntSpirit.MEASURE_TIMEOUT * (1 - Math.random() * 0.05);
  }
  body.pathDurationMax = timeoutDuration * 1.1;
  body.setVelAtTime(newVel, world.now);
  world.addTimeout(world.now + timeoutDuration, this.id, -1);
};

GruntSpirit.prototype.getScanHitSpirit = function() {
  var body = this.screen.world.getBodyByPathId(this.scanResp.pathId);
  return this.screen.getSpiritForBody(body);
};



GruntSpirit.prototype.onDraw = function(world, renderer) {
  var body = this.getBody(world);
  body.getPosAtTime(world.now, this.tempBodyPos);
  this.viewportsFromCamera = this.screen.approxViewportsFromCamera(this.tempBodyPos);
  if (!GruntSpirit.OPTIMIZE || this.viewportsFromCamera < 1.1) {
    renderer
        .setStamp(this.modelStamp)
        .setColorVector(this.vec4.set(this.color));
    this.modelMatrix.toIdentity()
        .multiply(this.mat44.toTranslateOpXYZ(this.tempBodyPos.x, this.tempBodyPos.y, 0))
        .multiply(this.mat44.toScaleOpXYZ(body.rad, body.rad, 1))
        .multiply(this.mat44.toRotateZOp(-this.dir));
    renderer.setModelMatrix(this.modelMatrix);
    renderer.drawStamp();
  }
};

GruntSpirit.prototype.getBody = function(world) {
  return world.bodies[this.bodyId];
};

GruntSpirit.prototype.explode = function() {
  var body = this.getBody(this.screen.world);
  body.getPosAtTime(this.screen.now(), this.tempBodyPos);
  this.screen.soundKaboom(this.tempBodyPos);
  this.screen.world.removeBodyId(this.bodyId);
  this.screen.world.removeSpiritId(this.id);
};
