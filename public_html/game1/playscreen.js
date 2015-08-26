/**
 * @constructor
 * @extends {BaseScreen}
 */
function PlayScreen(controller, canvas, renderer, glyphs, stamps, sound) {
  BaseScreen.call(this, controller, canvas, renderer, glyphs, stamps, sound);
  this.requestPointerLockFn = this.getRequestPointerLockFn();

  this.trackball = new MultiTrackball()
      .addTrackball(new MouseTrackball())
      .addTrackball(new TouchTrackball());
  this.trackball.setFriction(0.02);
  this.movement = new Vec2d();

  // for sound throtling
  this.hitsThisFrame = 0;

  this.visibility = 0;
  this.glBuffers = [];
  this.world = null;
}
PlayScreen.prototype = new BaseScreen();
PlayScreen.prototype.constructor = PlayScreen;

PlayScreen.prototype.getRequestPointerLockFn = function() {
  var controller = this.controller;
  return function() {
    controller.requestPointerLock();
  };
};

PlayScreen.prototype.setScreenListening = function(listen) {
  if (!this.listening && listen) {
    document.body.addEventListener('click', this.requestPointerLockFn);
    this.trackball.startListening();
  }
  if (this.listening && !listen) {
    this.controller.exitPointerLock();
    document.body.removeEventListener('click', this.requestPointerLockFn);
    this.trackball.stopListening();
  }
  BaseScreen.prototype.setScreenListening.call(this, listen);
};

/**
 * Called from BaseScreen the first time this is rendered.
 */
PlayScreen.prototype.initWorld = function() {
  this.world = new World(World.DEFAULT_CELL_SIZE, 2, [[0, 0], [1, 1]]);
  this.resolver = new HitResolver();
  this.resolver.defaultElasticity = 0.8;
  var labelMaker = new LabelMaker(this.glyphs);

  var controller = this.controller;
  var sfx = this.sfx;

  var buttonMaker = new ButtonMaker(labelMaker, this.world, null, this.renderer);
  buttonMaker
      .setNextCharMatrix(new Matrix44().toTranslateOpXYZ(3, 0, 0))
      .setPaddingXY(1.5, 0.5);

  // PAUSE
  buttonMaker.setLetterColor([0, 0.7, 2]).setBlockColor([0, 0.35, 1]).setScale(2).setPaddingXY(3, 2);
  var spiritId = buttonMaker.addButton(115, 79, "PAUSE", function(e) {
    var freq0 = 3000;
    var freq1 = 30;
    var delay = 0;
    var attack = 0.05;
    var sustain = 0.15;
    var decay = 0.01;
    sfx.sound(0, 0, 0, 0.5, attack, sustain, decay, freq0, freq1, 'square', delay);
    this.lastSoundMs = Date.now();
    this.soundLength = (attack + sustain + decay + delay) * 1000;
    controller.gotoScreen(Main30.SCREEN_PAUSE);
  });
  this.pauseButtonSpirit = this.world.spirits[spiritId];
  this.setSpaceButtonSpirit(this.pauseButtonSpirit);

  this.cubeStamp = RigidModel.createCube().createModelStamp(this.renderer.gl);

  var sphereModel = RigidModel.createOctahedron()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .sphereize(Vec4.ZERO, 1);
  var wut = Math.random() * 300;
  for (var i = 0; i < sphereModel.vertexes.length; i++) {
    var vertex = sphereModel.vertexes[i];
    var c = Math.ceil(Math.round((Math.sin(vertex.position.v[0] * vertex.position.v[1] * vertex.position.v[2] * wut)) + 2) / 2);
    vertex.color.setXYZ(c, c, c);
  }
  this.sphereStamp = sphereModel.createModelStamp(this.renderer.gl);

  var rainbowModel = RigidModel.createOctahedron()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .sphereize(Vec4.ZERO, 1);
  var rainbow = [
    [Math.random(), Math.random(), Math.random()],
    [Math.random(), Math.random(), Math.random()],
    [Math.random(), Math.random(), Math.random()],
    [Math.random(), Math.random(), Math.random()]
  ];
  var aa = Math.random();
  var bb = Math.random();
  for (var i = 0; i < rainbowModel.vertexes.length; i++) {
    var vertex = rainbowModel.vertexes[i];
    var val = ((vertex.position.v[2]
        + aa * Math.sin(Math.PI * vertex.position.v[1])
        + bb * Math.sin(Math.PI * vertex.position.v[0])) * 0.7 + 1) / 2;
    var n = Math.floor(val * rainbow.length);
    n = Math.min(rainbow.length - 1, Math.max(0, n));
    var c = rainbow[n];
    vertex.color.setXYZ(c[0]*2, c[1]*2, c[2]*2);
  }
  this.rainbowStamp = rainbowModel.createModelStamp(this.renderer.gl);

  this.initBalls();
  this.initWalls();

  for (var spiritId in this.world.spirits) {
    var s = this.world.spirits[spiritId];
    var b = this.world.bodies[s.bodyId];
    this.worldBoundingRect.coverRect(b.getBoundingRectAtTime(this.world.now));
  }
};


PlayScreen.prototype.clearBalls = function() {
  for (var spiritId in this.world.spirits) {
    var s = this.world.spirits[spiritId];
    var b = this.world.bodies[s.bodyId];
    if (b.shape == Body.Shape.CIRCLE) {
      this.world.removeSpiritId(spiritId);
      this.world.removeBodyId(b.id);
    }
  }
  this.ballsCreated = false;
};

PlayScreen.prototype.initBalls = function() {
  this.ballSpiritId = this.initBall(0, 30, 6, 1, 2, 2, 2, this.rainbowStamp);
  var r = 20;
  this.initBall(
          0, -30,
          r, 1,
          1.5, 1.5, 1.5,
          this.rainbowStamp);
  var maxBalls = 6;
  for (var i = 0; i < maxBalls; i++) {
    r = 10 * i/maxBalls + 4;
    this.initBall(
            Math.sin(Math.PI * 2 * i/maxBalls) * (90-r),
            Math.cos(Math.PI * 2 * i/maxBalls) * (90-r),
            r, 1,
            Math.random() * 0.5 + 1, Math.random() * 0.5 + 1, Math.random() * 0.5 + 1,
            this.sphereStamp);
  }
  this.ballsCreated = true;
};

PlayScreen.prototype.initBall = function(x, y, rad, density, red, green, blue, stamp) {
  var b = Body.alloc();
  b.shape = Body.Shape.CIRCLE;
  b.setPosXYAtTime(x, y, this.world.now);
  b.rad = rad;
  b.hitGroup = 0;
  b.mass = (Math.PI * 4/3) * b.rad * b.rad * b.rad * density;
  b.pathDurationMax = PATH_DURATION * 3;
  var spirit = new BallSpirit();
  spirit.bodyId = this.world.addBody(b);
  spirit.setModelStamp(stamp);
  var spiritId = this.world.addSpirit(spirit);
  this.world.spirits[spiritId].setColorRGB(red, green, blue);
  return spiritId;
};

PlayScreen.prototype.initWalls = function() {
  var rad = 100;
  this.initWall(rad * 1.5, 0, 1, rad);
  this.initWall(-rad * 1.5, 0, 1, rad);
  this.initWall(0, rad, rad * 1.5, 1);
  this.initWall(0, -rad, rad * 1.5, 1);
};

PlayScreen.prototype.initWall = function(x, y, h, v) {
  var b = Body.alloc();
  b.shape = Body.Shape.RECT;
  b.setPosXYAtTime(x, y, this.world.now);
  b.rectRad.setXY(h, v);
  b.hitGroup = 0;
  b.mass = Infinity;
  b.pathDurationMax = Infinity;
  var spirit = new WallSpirit();
  spirit.bodyId = this.world.addBody(b);
  spirit.setModelStamp(this.cubeStamp);
  return this.world.addSpirit(spirit);
};

PlayScreen.prototype.handleInput = function() {
  if (!this.ballsCreated) return;
  var spirit = this.world.spirits[this.ballSpiritId];
  var body = this.world.bodies[spirit.bodyId];
  var newVel = Vec2d.alloc();
  if (this.trackball.isTouched()) {
    this.trackball.getVal(this.movement);
    newVel.setXY(this.movement.x, -this.movement.y);
    var accel = Vec2d.alloc().set(newVel).subtract(body.vel);
    var maxAccelSquared = 2 * 2;
    var sensitivity = 2;
    accel.scale(sensitivity).clipToMaxLength(maxAccelSquared);
    // If it's over 1, then use a square root to lower it.
    // (If it's less than 1, then sqrt will make it bigger, so don't bother.)
    var mag = accel.magnitude();
    if (mag > 1) {
      accel.scaleToLength(Math.sqrt(mag));
    }
    newVel.set(body.vel).add(accel);
    body.setVelAtTime(newVel, this.world.now);
    accel.free();
  }
  newVel.free();
  this.trackball.reset();
};

PlayScreen.prototype.onHitEvent = function(e) {
  var b0 = this.world.getBodyByPathId(e.pathId0);
  var b1 = this.world.getBodyByPathId(e.pathId1);
  if (b0 && b1) {
    this.resolver.resolveHit(e.time, e.collisionVec, b0, b1);
    var strikeVec = Vec2d.alloc().set(b1.vel).subtract(b0.vel).projectOnto(e.collisionVec);
    var mag = strikeVec.magnitude();
    this.hitsThisFrame++;
    if (this.hitsThisFrame < 4) {
      this.bonk(b0, mag);
      this.bonk(b1, mag);
    }
    strikeVec.free();
  }
};

PlayScreen.prototype.bonk = function(body, mag) {
  var mass, vol, dur, freq, freq2;
  var bodyPos = Vec2d.alloc();
  body.getPosAtTime(this.world.now, bodyPos);
  this.vec4.setXYZ(bodyPos.x, bodyPos.y, 0);
  this.vec4.transform(this.viewMatrix);
  if (body.shape == Body.Shape.RECT) {
    vol = Math.min(1, mag / 10);
    dur = Math.max(0.05, Math.min(0.1, mag / 10));
    freq = 200 + 5 * Math.random();
    freq2 = freq + 5 * (Math.random() - 0.5);
    this.sfx.sound(this.vec4.v[0], this.vec4.v[1], 0, vol, 0, 0, dur, freq, freq2, 'square');
  } else {
    mass = body.mass;
    var massSqrt = Math.sqrt(mass);
    freq = 200 + 10000 / massSqrt;
    vol = 2 * Math.min(1, mag/5 + (2 / freq));
    if (vol > 0.01) {
      freq2 = freq * (1 + (Math.random() - 0.5) * 0.01);
      dur = Math.min(0.2, Math.max(Math.sqrt(mass) / 600, 0.05));
      this.sfx.sound(this.vec4.v[0], this.vec4.v[1], 0, vol, 0, 0, dur, freq, freq2, 'sine');
    }
  }
  bodyPos.free();
};

PlayScreen.prototype.updateViewMatrix = function() {
  var br = this.worldBoundingRect;
  this.viewMatrix.toIdentity();
  var ratio = Math.min(this.canvas.height / br.rad.y, this.canvas.width / br.rad.x);
  this.viewMatrix
      .multiply(this.mat4.toScaleOpXYZ(
              ratio / this.canvas.width,
              ratio / this.canvas.height,
          0.2));

  // scale
  var v = this.visibility;
  this.viewMatrix.multiply(this.mat4.toScaleOpXYZ(3 - v*2, v * v, 1));

  // center
  this.viewMatrix.multiply(this.mat4.toTranslateOpXYZ(
      -br.pos.x,
      -br.pos.y,
      0));

  this.renderer.setViewMatrix(this.viewMatrix);
};

PlayScreen.prototype.drawScene = function() {
  this.hitsThisFrame = 0;
  if (!this.ballsCreated) {
    this.initBalls();
  }
  for (var id in this.world.spirits) {
    this.world.spirits[id].onDraw(this.world, this.renderer);
  }
  // Animate whenever this thing draws.
  this.controller.requestAnimation();
};

PlayScreen.prototype.unloadLevel = function() {
  this.world = null;
  while (this.glBuffers.length) {
    this.renderer.gl.deleteBuffer(this.glBuffers.pop());
  }
  this.levelLoaded = false;
};