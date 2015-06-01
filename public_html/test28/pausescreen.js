/**
 * @constructor
 * @extends {Screen}
 */
function PauseScreen(controller, canvas, renderer, glyphs, stamps, sound) {
  Screen.call(this);
  this.controller = controller;
  this.canvas = canvas;
  this.renderer = renderer;
  this.glyphs = glyphs;
  this.stamps = stamps;
  this.sfx = sound;

  this.viewMatrix = new Matrix44();
  this.mat4 = new Matrix44();
  this.multiPointer = new MultiPointer(this.canvas, this.viewMatrix);
  this.readyToDraw = false;
  this.nextButtonNum = 0;
  this.worldBoundingRect = new Rect();

  this.lastPathRefreshTime = -Infinity;
  this.visibility = 0;
}
PauseScreen.prototype = new Screen();
PauseScreen.prototype.constructor = PauseScreen;

PauseScreen.prototype.setScreenListening = function(listen) {
  if (listen) {
    this.multiPointer.startListening();
  } else {
    this.multiPointer.stopListening();
  }
};

PauseScreen.prototype.drawScreen = function(visibility) {
  this.visibility = visibility;
  if (!this.readyToDraw) {
    this.initWorld();
    this.readyToDraw = true;
  }
  this.clock();
  this.updateViewMatrix(Date.now());
  this.drawScene();
  this.multiPointer.clearEventQueue();
  this.multiPointer.setViewMatrix(this.viewMatrix);
};

PauseScreen.prototype.destroyScreen = function() {
  // Unload button models? Need a nice utility for loading, remembering, and unloading models.
};

PauseScreen.prototype.initWorld = function() {
  this.world = new World();
  this.resolver = new HitResolver();
  this.resolver.defaultElasticity = 1;
  this.labelMaker = new LabelMaker(this.glyphs);
  this.startMatrix = new Matrix44();
  this.nextCharMatrix = new Matrix44().toTranslateOpXYZ(3, 0, 0);

  var controller = this.controller;
  var sfx = this.sfx;
  this.addButton("PAUSED!", function(world, x, y) {});
  this.addButton("RESUME?", function(world, x, y) {
    var attack = 0.2;
    var sustain = 0;
    var decay = 0.01;
    sfx.sound(x, y, 0, 0.5, attack, sustain, decay, 100, 2000, 'square');
    this.lastSoundMs = Date.now();
    this.soundLength = (attack + sustain + decay) * 1000;
    controller.gotoScreen(Main28.SCREEN_PLAY);
  });
  this.addButton("QUIT?", function(world, x, y) {
    var voices = 8;
    var maxLength = 0;
    for (var i = 0; i < voices; i++) {
      var delay = (i % 2 ? 0 : 0.1) * (1 + 0.1 * Math.random());
      var attack = 0.002;
      var sustain = 0.1 * (Math.random() + 0.01);
      var decay = (Math.random() + 1) * 0.5;
      maxLength = Math.max(maxLength, delay + attack + decay);
      var freq1 = Math.random() * 30 + 30;
      var freq2 = Math.random() * 10 + 10;
      sfx.sound(x, y, 0, 0.8, attack, sustain, decay, freq1, freq2, 'square', delay);
    }
    this.lastSoundMs = Date.now();
    this.soundLength = 1000 * maxLength;
    controller.gotoScreen(Main28.SCREEN_TITLE);
  });
};

PauseScreen.prototype.addButton = function(text, func) {
  var model = this.labelMaker.createLabelModel(this.startMatrix, this.nextCharMatrix, text);
  var brect = model.getBoundingRect();
  model.transformPositions(new Matrix44().toTranslateOpXYZ(-brect.pos.x, -brect.pos.y, 0));
  var b = Body.alloc();
  b.shape = Body.Shape.RECT;
  var pos = new Vec2d(0, -5 * this.nextButtonNum);
  b.setPosAtTime(pos, this.world.now);
  this.nextButtonNum++;
  b.rectRad.set(brect.rad);
  b.group = 0;
  b.mass = Infinity;
  b.pathDurationMax = Infinity;
  var spirit = new ButtonSpirit();
  spirit.bodyId = this.world.addBody(b);
  spirit.setMultiPointer(this.multiPointer);
  spirit.setModelStamp(model.createModelStamp(this.renderer.gl));
  spirit.setOnClick(func);
  this.world.addSpirit(spirit);
  this.worldBoundingRect.coverRect(b.getBoundingRectAtTime(this.world.now));
};

PauseScreen.prototype.clock = function() {
  var endTimeMs = Date.now() + MS_PER_FRAME;
  var endClock = this.world.now + CLOCKS_PER_FRAME;

  if (this.lastPathRefreshTime + PATH_DURATION <= endClock) {
    this.lastPathRefreshTime = this.world.now;
    for (var id in this.world.bodies) {
      var b = this.world.bodies[id];
      if (b && b.shape === Body.Shape.CIRCLE) {
        b.invalidatePath();
        b.moveToTime(this.world.now);
      }
    }
  }

  var e = this.world.getNextEvent();
  // Stop if there are no more events to process, or we've moved the game clock far enough ahead
  // to match the amount of wall-time elapsed since the last frame,
  // or (worst case) we're out of time for this frame.

  while (e && e.time <= endClock && Date.now() <= endTimeMs) {
    if (e.type == WorldEvent.TYPE_HIT) {
      var b0 = this.world.getBodyByPathId(e.pathId0);
      var b1 = this.world.getBodyByPathId(e.pathId1);
      if (b0 && b1) {
        this.resolver.resolveHit(e.time, e.collisionVec, b0, b1);
      }
    }
    this.world.processNextEvent();
    e = this.world.getNextEvent();
  }
  if (!e || e.time > endClock) {
    this.world.now = endClock;
  }
};

PauseScreen.prototype.drawScene = function() {
  this.clock();
  for (var id in this.world.spirits) {
    this.world.spirits[id].onDraw(this.world, this.renderer);
  }
};

PauseScreen.prototype.updateViewMatrix = function() {
  var br = this.worldBoundingRect;

  // set view matrix
  var ratio = this.visibility * Math.min(this.canvas.height, this.canvas.width) / (1.2 * Math.max(br.rad.x, br.rad.y));
  this.viewMatrix.toIdentity();
  this.viewMatrix
      .multiply(this.mat4.toScaleOpXYZ(
              ratio / this.canvas.width,
              ratio / this.canvas.height,
          0.5));

  // Shear
  this.mat4.toIdentity();
  this.mat4.setColRowVal(2, 1, -0.5);
  this.viewMatrix.multiply(this.mat4);

  // center and sink
  this.viewMatrix.multiply(this.mat4.toTranslateOpXYZ(-br.pos.x, -br.pos.y, -4 * (this.visibility - 1)));

  // rotate
  this.viewMatrix.multiply(this.mat4.toTranslateOpXYZ(br.pos.x, br.pos.y, 0));
  this.viewMatrix.multiply(this.mat4.toRotateZOp(-Math.PI / 8 + Math.PI * (this.visibility - 1)));
  this.viewMatrix.multiply(this.mat4.toTranslateOpXYZ(-br.pos.x, -br.pos.y, 0));

  this.renderer.setViewMatrix(this.viewMatrix);
};