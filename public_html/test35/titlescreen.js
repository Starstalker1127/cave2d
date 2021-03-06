/**
 * @constructor
 * @extends {BaseScreen}
 */
function TitleScreen(controller, canvas, renderer, glyphs, stamps, sound) {
  BaseScreen.call(this, controller, canvas, renderer, glyphs, stamps, sound);
}
TitleScreen.prototype = new BaseScreen();
TitleScreen.prototype.constructor = TitleScreen;

TitleScreen.prototype.lazyInit = function() {
  if (!this.world) {
    this.initWorld();
  }
};

TitleScreen.prototype.initWorld = function() {
  this.world = new World(World.DEFAULT_CELL_SIZE, 2, [[0, 0], [1, 1]]);
  this.resolver = new HitResolver();
  this.resolver.defaultElasticity = 0.9;
  var labelMaker = new LabelMaker(this.glyphs);
  var controller = this.controller;
  var sfx = this.sfx;
  var world = this.world;

  var spiritId;

  var buttonMaker = new ButtonMaker(labelMaker, this.world, null, this.renderer);
  buttonMaker
      .setNextCharMatrix(new Matrix44().toTranslateOpXYZ(3, 0, 0))
      .setPaddingXY(1.5, 0.5);

  // TITLE
  buttonMaker.setLetterColor([0.75*0.7, 0.25 * 0.7, 1*0.7]).setBlockColor(null).setScale(1);
  buttonMaker.addButton(0, 12, "TEST 35", null);
  buttonMaker.addButton(0, 5, "OBJECT", null);
  buttonMaker.addButton(0, 0, "DRAGGING", null);
  buttonMaker.setScale(1);

  // PLAY
  buttonMaker.setLetterColor([0.75, 0.25, 1]).setBlockColor([0.75*0.5, 0.25*0.5, 1*0.5]);
  spiritId = buttonMaker.addButton(0, -8, "START", function(e) {
    var freq0 = 100;
    var freq1 = 5000;
    var delay = 0;
    var attack = 0.01;
    var sustain = 0.1;
    var decay = 0.04;
    sfx.sound(0, 0, 0, 0.5, attack, sustain, decay, freq0, freq1, 'square', delay);
    this.lastSoundMs = Date.now();
    this.soundLength = (attack + sustain + decay + delay) * 1000;
    controller.gotoScreen(Test35.SCREEN_PLAY);
    controller.requestPointerLock();
  });
  this.playSpirit = this.world.spirits[spiritId];

  // FULL SCREEN
  buttonMaker.setScale(0.75);
  spiritId = buttonMaker.addButton(0, -8 -6, "FULL SCREEN", function(e) {
    var freq0 = 200;
    var freq1 = 2200;
    var delay = 0;
    var attack = 0.05;
    var sustain = 0.1;
    var decay = 0.2;
    sfx.sound(0, 0, 0, 0.5, attack, sustain, decay, freq0, freq1, 'square', delay);
    this.lastSoundMs = Date.now();
    this.soundLength = (attack + sustain + decay + delay) * 1000;
    controller.requestFullScreen();
  });
  this.fullScreenSpirit = world.spirits[spiritId];

  for (spiritId in this.world.spirits) {
    var s = this.world.spirits[spiritId];
    var b = this.world.bodies[s.bodyId];
    this.worldBoundingRect.coverRect(b.getBoundingRectAtTime(this.world.now));
  }
  this.worldBoundingRect.pad(1);
};

TitleScreen.prototype.onSpaceDown = function() {
  this.playSpirit.onClick();
};

TitleScreen.prototype.onPointerDown = function(pageX, pageY) {
  this.vec2d.setXY(pageX, pageY);
  this.transformCanvasToWorld(this.vec2d);
  if (this.playSpirit.isOverlapping(this.world, this.vec2d)) {
    this.playSpirit.onClick();
  }
  if (this.fullScreenSpirit.isOverlapping(this.world, this.vec2d)) {
    this.fullScreenSpirit.onClick();
  }
};

TitleScreen.prototype.updateViewMatrix = function() {
  var br = this.worldBoundingRect;
  this.viewMatrix.toIdentity();
  var ratio = Math.min(this.canvas.height, this.canvas.width) / Math.max(br.rad.x, br.rad.y);
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
