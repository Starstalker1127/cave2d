/**
 * @constructor
 * @extends {Screen}
 */
function BaseScreen(controller, canvas, renderer, glyphs, stamps, sound, adventureName, levelName) {
  Screen.call(this);

  this.adventureName = adventureName;
  this.levelName = levelName;

  this.controller = controller;
  this.canvas = canvas;
  this.renderer = renderer;
  this.glyphs = glyphs;
  this.stamps = stamps;
  this.sfx = sound;

  this.viewMatrix = new Matrix44();
  this.vec2d = new Vec2d();
  this.vec4 = new Vec4();
  this.mat44 = new Matrix44();
  this.nextButtonNum = 0;
  this.worldBoundingRect = new Rect();

  this.lastPathRefreshTime = -Infinity;
  this.visibility = 0;
  this.listening = false;
  this.paused = false;

  this.splasher = new Splasher();
  this.splash = new Splash();

  this.modelMatrix = new Matrix44();
  this.modelMatrix2 = new Matrix44();
  this.hudViewMatrix = new Matrix44();

  this.scanReq = new ScanRequest();
  this.scanResp = new ScanResponse();

  this.listeners = new ArraySet();
  this.eventDistributor = new LayeredEventDistributor(this.canvas, 3);
  this.addListener(this.eventDistributor);
  this.resizeFn = this.getResizeFn();

  this.world = null;
  this.tiles = null;

  this.playerAveragePos = new Vec2d();

  this.bitSize = 0.5;
  this.bitGridMetersPerCell = BaseScreen.BIT_SIZE * BitGrid.BITS;
  this.levelModelMatrix = new Matrix44();
  this.levelColorVector = new Vec4(1, 1, 1);

  this.levelStamps = [];

  // for sound throttling
  this.hitsThisFrame = 0;

  this.timeMultiplier = 1;

  var self = this;

  this.pauseDownFn = function(e) {
    e = e || window.event;
    self.paused = !self.paused;
    if (self.paused) {
      // pause
      self.showPauseMenu();
    } else {
      // resume
      self.hidePauseMenu();
      self.controller.requestAnimation();
      // TODO: clear the pause button's val
    }
    // Stop the flow of mouse-emulation events on touchscreens, so the
    // mouse events don't cause weird cursors teleports.
    // See http://www.html5rocks.com/en/mobile/touchandmouse/#toc-together
    e.preventDefault();
  };

  this.fullScreenFn = function(e) {
    e = e || window.event;
    self.controller.requestFullScreen();
    e.preventDefault();
  };

  this.drawScans = false;
}
BaseScreen.prototype = new Screen();
BaseScreen.prototype.constructor = BaseScreen;

BaseScreen.WIDGET_RADIUS = 30;
BaseScreen.CAMERA_VIEW_DIST = 25;

BaseScreen.MS_PER_FRAME = 1000 / 60;
BaseScreen.CLOCKS_PER_FRAME = 0.5;
BaseScreen.PATH_DURATION = 0xffff;

BaseScreen.SpiritType = {
  ANT: 3,
  PLAYER: 4,
  EXIT: 5,
  BULLET: 6,
  GRUNT: 7
};

BaseScreen.MenuItem = {
  RED_ANT: 'red_ant',
  GRUNT: 'grunt',
  PLAYER: 'player',
  EXIT: 'exit'
};

BaseScreen.Group = {
  EMPTY: 0,
  WALL: 1,
  ROCK: 2,
  CURSOR: 3
};

BaseScreen.Terrain = {
  WALL: 0,
  FLOOR: 1,
  MIXED: 2
};

BaseScreen.SplashType = {
  NOTE: 1,
  SCAN: 2,
  MUZZLE_FLASH: 3,
  WALL_DAMAGE: 4
};

BaseScreen.BIT_SIZE = 0.5;
BaseScreen.WORLD_CELL_SIZE = BaseScreen.BIT_SIZE * BitGrid.BITS;

BaseScreen.EventLayer = {
  POPUP: 0,
  HUD: 1,
  WORLD: 2
};

BaseScreen.prototype.setPaused = function(paused) {
  this.paused = paused;
  if (this.paused) {
    // pause
    this.showPauseMenu();
  } else {
    // resume
    this.hidePauseMenu();
    this.controller.requestAnimation();
  }
};


BaseScreen.prototype.initSpiritConfigs = function() {
  this.spiritConfigs = {};

  var self = this;
  function addConfig(type, ctor, itemName, group, rank, factory) {
    var model = ctor.createModel();
    var stamp = model.createModelStamp(self.renderer.gl);
    var menuItemConfig = null;
    if (itemName) {
      menuItemConfig = new MenuItemConfig(itemName, group, rank, model, factory);
    }
    self.spiritConfigs[type] = new SpiritConfig(type, ctor, stamp, menuItemConfig);
  }

  // first column
  addConfig(BaseScreen.SpiritType.ANT, AntSpirit,
      BaseScreen.MenuItem.RED_ANT, 0, 0, AntSpirit.factory);

  addConfig(BaseScreen.SpiritType.GRUNT, GruntSpirit,
      BaseScreen.MenuItem.GRUNT, 0, 1, GruntSpirit.factory);

  // second column
  addConfig(BaseScreen.SpiritType.PLAYER, PlayerSpirit,
      BaseScreen.MenuItem.PLAYER, 1, 0, PlayerSpirit.factory);

  addConfig(BaseScreen.SpiritType.EXIT, ExitSpirit,
      BaseScreen.MenuItem.EXIT, 1, 1, ExitSpirit.factory);

  addConfig(BaseScreen.SpiritType.BULLET, BulletSpirit,
      null, -1, -1, BulletSpirit.factory);
};

BaseScreen.prototype.initWorld = function() {
  this.bitGrid = new BitGrid(this.bitSize);
  this.tiles = {};

  this.lastPathRefreshTime = -Infinity;

  var groupCount = Object.keys(BaseScreen.Group).length;
  this.world = new World(BaseScreen.WORLD_CELL_SIZE, groupCount, [
    [BaseScreen.Group.EMPTY, BaseScreen.Group.EMPTY],
    [BaseScreen.Group.ROCK, BaseScreen.Group.WALL],
    [BaseScreen.Group.ROCK, BaseScreen.Group.ROCK],
    [BaseScreen.Group.CURSOR, BaseScreen.Group.WALL],
    [BaseScreen.Group.CURSOR, BaseScreen.Group.ROCK]
  ]);
  this.resolver = new HitResolver();
  this.resolver.defaultElasticity = 0.95;
};

/**
 * @param {Object} json
 */
BaseScreen.prototype.loadWorldFromJson = function (json) {
  this.lazyInit();
  this.world.now = json.now;
  // bodies
  for (var i = 0; i < json.bodies.length; i++) {
    var bodyJson = json.bodies[i];
    var body = new Body();
    body.setFromJSON(bodyJson);
    this.world.loadBody(body);
  }
  // spirits
  for (var i = 0; i < json.spirits.length; i++) {
    var spiritJson = json.spirits[i];
    var spiritType = spiritJson[0];
    var spiritConfig = this.spiritConfigs[spiritType];
    if (spiritConfig) {
      var spirit = new spiritConfig.ctor(this);
      spirit.setModelStamp(spiritConfig.stamp);
      spirit.setFromJSON(spiritJson);
      this.world.loadSpirit(spirit);
    } else {
      console.error("Unknown spiritType " + spiritType + " in spirit JSON: " + spiritJson);
    }
  }
  // timeouts
  var e = new WorldEvent();
  for (var i = 0; i < json.timeouts.length; i++) {
    e.setFromJSON(json.timeouts[i]);
    this.world.loadTimeout(e);
  }

  // terrain
  this.bitGrid = BitGrid.fromJSON(json.terrain);
  this.tiles = {};
  this.flushTerrainChanges();

  // cursor and camera
  if (this.editor) this.editor.cursorPos.set(Vec2d.fromJSON(json.cursorPos));
  this.camera.cameraPos.set(Vec2d.fromJSON(json.cameraPos));

//  // splashes
//  var splash = new Splash();
//  for (var i = 0; i < json.splashes.length; i++) {
//    var splashJson = json.splashes[i];
//    var splashType = splashJson[0];
//    // TODO: splashConfig plugin, like spiritConfig
//    if (splashType == BaseScreen.SplashType.NOTE) {
//      splash.setFromJSON(splashJson);
//      splash.stamp = this.soundStamp;
//      this.splasher.addCopy(splash);
//    } else {
//      console.error("Unknown splashType " + splashType + " in spirit JSON: " + splashJson);
//    }
//  }

};

BaseScreen.prototype.createTrackball = function() {
  var trackball = new MultiTrackball()
      .addTrackball(new TouchTrackball(this.getWorldEventTarget())
          .setStartZoneFunction(function(x, y) { return true; }))
      .addTrackball(new KeyTrackball(new KeyStick().setUpRightDownLeftByName(
          Key.Name.DOWN, Key.Name.RIGHT, Key.Name.UP, Key.Name.LEFT))
          .setAccel(0.8)
          .setTraction(0.8)
  );
  trackball.setFriction(0.05);
  trackball.startListening();
  return trackball;
};

BaseScreen.prototype.initPauseStamp = function() {
  var pauseModel = new RigidModel();
  for (var x = -1; x <= 1; x += 2) {
    var bar = RigidModel.createSquare().transformPositions(
        new Matrix44()
            .multiply(new Matrix44().toScaleOpXYZ(0.2, 0.5, 1)
                .multiply(new Matrix44().toTranslateOpXYZ(x * 1.5, 0, 0.9)
            )));
    pauseModel.addRigidModel(bar);
  }
  pauseModel.addRigidModel(RigidModel.createCircleMesh(5));
  this.pauseStamp = pauseModel.createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.pauseStamp);
};

BaseScreen.prototype.initPauseStampNoOutline = function() {
  var pauseModel = new RigidModel();
  for (var x = -1; x <= 1; x += 2) {
    var bar = RigidModel.createSquare().transformPositions(
        new Matrix44()
            .multiply(new Matrix44().toScaleOpXYZ(0.2, 0.5, 1)
                .multiply(new Matrix44().toTranslateOpXYZ(x * 1.5, 0, 0.9)
            )));
    pauseModel.addRigidModel(bar);
  }
  this.pauseStamp = pauseModel.createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.pauseStamp);
};

BaseScreen.prototype.createButtonWidgets = function() {
  return [
    new TriggerWidget(this.getHudEventTarget())
        .setReleasedColorVec4(new Vec4(1, 1, 1, 0.25))
        .setPressedColorVec4(new Vec4(1, 1, 1, 0.5))
        .setStamp(this.circleStamp)
        .listenToTouch()
        .addTriggerKeyByName('z')
        .setKeyboardTipStamp(this.glyphs.stamps['Z'])
        .startListening(),
    new TriggerWidget(this.getHudEventTarget())
        .setReleasedColorVec4(new Vec4(1, 1, 1, 0.25))
        .setPressedColorVec4(new Vec4(1, 1, 1, 0.5))
        .setStamp(this.circleStamp)
        .listenToTouch()
        .addTriggerKeyByName('x')
        .setKeyboardTipStamp(this.glyphs.stamps['X'])
        .startListening(),
    new TriggerWidget(this.getHudEventTarget())
        .setReleasedColorVec4(new Vec4(1, 1, 1, 0.25))
        .setPressedColorVec4(new Vec4(1, 1, 1, 0.5))
        .setStamp(this.pauseStamp)
        .addTriggerDownListener(this.pauseDownFn)
        .listenToTouch()
        .listenToMousePointer()
        .addTriggerKeyByName(Key.Name.SPACE)
        .startListening()];
};

BaseScreen.prototype.getResizeFn = function() {
  var self = this;
  return function() {
    self.controller.requestAnimation();
  }
};

BaseScreen.prototype.setScreenListening = function(listen) {
  if (listen == this.listening) return;
  if (listen) {
    window.addEventListener('resize', this.resizeFn);
  } else {
    window.removeEventListener('resize', this.resizeFn);
  }
  this.listening = listen;
};

var msPerFrame = 0;
BaseScreen.prototype.drawScreen = function(visibility) {
  var startMs = performance.now();
  this.visibility = visibility;
  this.lazyInit();
  this.updateViewMatrix();
  this.drawScene();
  if (this.visibility == 1) {
    this.clock();
  }
  var totalMs = performance.now() - startMs;
  msPerFrame = 0.95 * msPerFrame + 0.05 * totalMs;
};

BaseScreen.prototype.drawScene = function() {};

BaseScreen.prototype.destroyScreen = function() {
  // Unload button models? Need a nice utility for loading, remembering, and unloading models.
};

BaseScreen.prototype.showPauseMenu = function() {
  document.querySelector('#pauseMenu').style.display = 'block';
  this.canvas.style.cursor = "auto";
};

BaseScreen.prototype.hidePauseMenu = function() {
  document.querySelector('#pauseMenu').style.display = 'none';
  this.canvas.style.cursor = "";
};



BaseScreen.prototype.clock = function() {
  if (this.paused) return;
  var endTimeMs = Date.now() + BaseScreen.MS_PER_FRAME;
  var startClock = this.world.now;
  var endClock = this.world.now + BaseScreen.CLOCKS_PER_FRAME * this.timeMultiplier;

  if (this.handleInput) {
    this.handleInput();
  }

  if (this.lastPathRefreshTime + BaseScreen.PATH_DURATION <= endClock) {
    this.lastPathRefreshTime = this.world.now;
    for (var id in this.world.bodies) {
      var b = this.world.bodies[id];
      if (b && b.pathDurationMax > BaseScreen.PATH_DURATION && b.pathDurationMax != Infinity) {
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
    this.world.processNextEvent();
    if (e.type == WorldEvent.TYPE_HIT) {
      this.onHitEvent(e);
    }
    e = this.world.getNextEvent();
  }
  if (!e || e.time > endClock) {
    this.world.now = endClock;
  }
  var unwarp = 0.15 * (endClock - startClock) / BaseScreen.CLOCKS_PER_FRAME;
  var timeWarp = Math.log(this.timeMultiplier);
  if (Math.abs(timeWarp) < unwarp) {
    timeWarp = 0;
  } else {
    timeWarp -= Math.sign(timeWarp) * unwarp;
  }
  this.timeMultiplier = Math.exp(timeWarp);
};

BaseScreen.prototype.bodyIfInGroup = function(group, b0, b1) {
  if (b0 && b0.hitGroup == group) return b0;
  if (b1 && b1.hitGroup == group) return b1;
  return null;
};

BaseScreen.prototype.otherBody = function(thisBody, b0, b1) {
  if (thisBody != b0) return b0;
  if (thisBody != b1) return b1;
  return null;
};

BaseScreen.prototype.getSpiritForBody = function(b) {
  return b ? this.world.spirits[b.spiritId] : null;
};

BaseScreen.prototype.bodyIfSpiritType = function(type, b0, opt_b1) {
  var s0 = this.getSpiritForBody(b0);
  if (s0 && s0.type == type) return b0;
  if (opt_b1) {
    var s1 = this.getSpiritForBody(opt_b1);
    if (s1 && s1.type == type) return opt_b1;
  }
  return null;
};

BaseScreen.prototype.onHitEvent = function(e) {
  if (!this.isPlaying()) return;

  var b0 = this.world.getBodyByPathId(e.pathId0);
  var b1 = this.world.getBodyByPathId(e.pathId1);

  if (b0 && b1) {
    this.resolver.resolveHit(e.time, e.collisionVec, b0, b1);
    var strikeVec = Vec2d.alloc().set(b1.vel).subtract(b0.vel).projectOnto(e.collisionVec);
    var mag = strikeVec.magnitude();
    this.hitsThisFrame++;
//    if (this.hitsThisFrame < 4) {
//      this.bonk(b0, mag);
//      this.bonk(b1, mag);
//    }
    strikeVec.free();

    var playerBody = this.bodyIfSpiritType(BaseScreen.SpiritType.PLAYER, b0, b1);
    if (playerBody) {
      var playerSpirit = this.getSpiritForBody(playerBody);
      playerSpirit.onBang(mag / playerBody.mass, this.now()); // TODO hm not sure that's right
      var exitBody = this.bodyIfSpiritType(BaseScreen.SpiritType.EXIT, b0, b1);
      if (exitBody) {
        this.exitLevel();
      }
      var antBody = this.bodyIfSpiritType(BaseScreen.SpiritType.ANT, b0, b1);
      if (antBody) {
        playerSpirit.addHealth(-1);
      }
    }

    var bulletBody = this.bodyIfSpiritType(BaseScreen.SpiritType.BULLET, b0, b1);
    if (bulletBody) {
      var bulletSpirit = this.getSpiritForBody(bulletBody);
      var otherBody = this.otherBody(bulletBody, b0, b1);
      var otherSpirit = this.getSpiritForBody(otherBody);
      if (!otherSpirit) {
        // wall?
        bulletSpirit.onHitWall(mag);
      } else if (otherSpirit.type == BaseScreen.SpiritType.ANT) {
        bulletSpirit.onHitEnemy(mag);
        otherSpirit.onPlayerBulletHit()
      } else if (otherSpirit.type == BaseScreen.SpiritType.BULLET) {
        bulletSpirit.onHitOther(mag);
        otherSpirit.onHitOther(mag);
      } else {
        bulletSpirit.onHitOther(mag);
      }
    }
  }
};

BaseScreen.prototype.exitLevel = function() {};

BaseScreen.prototype.getPixelsPerMeter = function() {
  return 0.5 * (this.canvas.height + this.canvas.width) / this.camera.getViewDist();
};
BaseScreen.prototype.updateViewMatrix = function() {
  // scale
  this.viewMatrix.toIdentity();
  var pixelsPerMeter = this.getPixelsPerMeter();
  this.viewMatrix
      .multiply(this.mat44.toScaleOpXYZ(
              pixelsPerMeter / this.canvas.width,
              pixelsPerMeter / this.canvas.height,
          0.2));

  // center
  this.viewMatrix.multiply(this.mat44.toTranslateOpXYZ(
      -this.camera.getX(),
      -this.camera.getY(),
      0));
};


//////////////////////
// Editor API stuff
//////////////////////

BaseScreen.prototype.getBodyPos = function(body, outVec2d) {
  return body.getPosAtTime(this.world.now, outVec2d);
};

BaseScreen.prototype.getCanvas = function() {
  return this.canvas;
};

BaseScreen.prototype.addListener = function(listener) {
  this.listeners.put(listener);
  if (this.listening) {
    listener.startListening();
  }
};

BaseScreen.prototype.getBodyOverlaps = function(body) {
  return this.world.getOverlaps(body);
};

BaseScreen.prototype.getBodyById = function(id) {
  return this.world.bodies[id];
};

BaseScreen.prototype.drawTerrainPill = function(pos0, pos1, rad, color) {
  this.bitGrid.drawPill(new Segment(pos0, pos1), rad, color);
  this.flushTerrainChanges();
};

BaseScreen.prototype.removeByBodyId = function(bodyId) {
  var body = this.world.getBody(bodyId);
  if (body) {
    if (body.spiritId) {
      this.world.removeSpiritId(body.spiritId);
    }
    this.world.removeBodyId(bodyId);
  }
};

BaseScreen.prototype.getCursorHitGroup = function() {
  return BaseScreen.Group.CURSOR;
};

BaseScreen.prototype.getWallHitGroup = function() {
  return BaseScreen.Group.WALL;
};

BaseScreen.prototype.getWorldTime = function() {
  return this.world.now;
};

BaseScreen.prototype.getViewDist = function() {
  return this.camera.getViewDist();
};

BaseScreen.prototype.getViewMatrix = function() {
  return this.viewMatrix;
};

BaseScreen.prototype.getPopupEventTarget = function() {
  return this.eventDistributor.getFakeLayerElement(BaseScreen.EventLayer.POPUP);
};

BaseScreen.prototype.getHudEventTarget = function() {
  return this.eventDistributor.getFakeLayerElement(BaseScreen.EventLayer.HUD);
};

BaseScreen.prototype.getWorldEventTarget = function() {
  return this.eventDistributor.getFakeLayerElement(BaseScreen.EventLayer.WORLD);
};


/////////////////
// Spirit APIs //
/////////////////

/**
 * @param {number} hitGroup
 * @param {Vec2d} pos
 * @param {Vec2d} vel
 * @param {number} rad
 * @param {=ScanResponse} opt_resp
 * @returns {number} fraction (0-1) of vel where the hit happened, or -1 if there was no hit.
 */
BaseScreen.prototype.scan = function(hitGroup, pos, vel, rad, opt_resp) {
  var resp = opt_resp || this.scanResp;
  this.scanReq.hitGroup = hitGroup;
  // write the body's position into the req's position slot.
  this.scanReq.pos.set(pos);
  this.scanReq.vel.set(vel);
  this.scanReq.shape = Body.Shape.CIRCLE;
  this.scanReq.rad = rad;
  var retval = -1;
  var hit = this.world.rayscan(this.scanReq, resp);
  if (hit) {
    retval = resp.timeOffset;
  }
  if (this.drawScans) {
    this.addScanSplash(pos, vel, rad, retval);
  }
  return retval;
};

BaseScreen.prototype.setTimeWarp = function(multiplier) {
  this.timeMultiplier = multiplier;
};

BaseScreen.prototype.addScanSplash = function (pos, vel, rad, dist) {
  var s = this.splash;
  s.reset(BaseScreen.SplashType.SCAN, this.soundStamp);

  s.startTime = this.world.now;
  s.duration = 20;

  var x = pos.x;
  var y = pos.y;
  var hit = dist >= 0;
  var d = hit ? dist : 1;
  var dx = vel.x * d;
  var dy = vel.y * d;

  s.startPose.pos.setXYZ(x, y, 0);
  s.endPose.pos.setXYZ(x, y, 1);
  s.startPose.scale.setXYZ(rad, rad, 1);
  s.endPose.scale.setXYZ(rad, rad, 1);

  s.startPose2.pos.setXYZ(x + dx, y + dy, 0);
  s.endPose2.pos.setXYZ(x + dx, y + dy, 1);
  s.startPose2.scale.setXYZ(rad, rad, 1);
  s.endPose2.scale.setXYZ(rad, rad, 1);

  s.startPose.rotZ = 0;
  s.endPose.rotZ = 0;

  if (dist < 0) {
    s.startColor.setXYZ(0, 1, 0.5);
    s.endColor.setXYZ(0, 0.1, 0.05);
  } else {
    s.startColor.setXYZ(1, 0.25, 0.25);
    s.endColor.setXYZ(0.1, 0.025, 0.025);
  }

  this.splasher.addCopy(s);
};

BaseScreen.prototype.now = function() {
  return this.world.now;
};

BaseScreen.prototype.getAveragePlayerPos = function() {
  this.playerAveragePos.reset();
  var playerCount = 0;
  for (var id in this.world.spirits) {
    var spirit = this.world.spirits[id];
    spirit.onDraw(this.world, this.renderer);
    if (spirit.type == BaseScreen.SpiritType.PLAYER) {
      var body = spirit.getBody(this.world);
      if (body) {
        this.playerAveragePos.add(this.getBodyPos(body, this.vec2d));
        playerCount++;
      }
    }
  }
  if (playerCount != 0) {
    this.playerAveragePos.scale(1 / playerCount);
    return this.playerAveragePos;
  } else {
    return null;
  }
};



BaseScreen.prototype.soundPew = function(pos) {
  this.vec4.setXYZ(pos.x, pos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];

  var freq = 800 + 200 * Math.random();
  var attack = 1/60;
  var sustain = (2 + Math.random()) / 60;
  var decay = (2 + Math.random()) / 60;
  this.sfx.sound(x, y, 0, 0.2, attack, sustain, decay, freq, freq * Math.random()*0.1 + 1, 'square');
};

BaseScreen.prototype.soundWallThump = function(worldPos, mag) {
  this.vec4.setXYZ(worldPos.x, worldPos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];

  var vol = Math.min(1, mag * 0.05);
  if (vol > 0.01) {
    var dur = Math.min(0.1, 0.01 * mag*mag);
    var freq = mag + 200 + 5 * Math.random();
    var freq2 = 1;
    this.sfx.sound(x, y, 0, vol, 0, 0, dur, freq, freq2, 'square');
  }
};

BaseScreen.prototype.soundBing = function(pos) {
  this.vec4.setXYZ(pos.x, pos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];
  var voices = 3;
  var sustain = 0.02 * (Math.random() + 0.5);
  var baseFreq = 2000 + 10 * (Math.random() + 0.5);
  for (var i = 0; i < voices; i++) {
    var decay = 0;
    var attack = sustain * 2;
    var freq1 = baseFreq * (1 + i/3);
    var freq2 = 100 + i;
    this.sfx.sound(x, y, 0, 2/voices * 0.4, attack, sustain, decay, freq1, freq2, 'square');
  }
};

BaseScreen.prototype.soundKaboom = function(pos) {
  this.vec4.setXYZ(pos.x, pos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];

  var voices = 8;
  for (var i = 0; i < voices; i++) {
    var delay = (i % 2 ? 0 : 0.1) * (1 + 0.1 * Math.random());
    var attack = 0.002;
    var sustain = 0.1 * (Math.random() + 0.01);
    var decay = (Math.random() + 1) * 0.5;
    var freq1 = Math.random() * 30 + 30;
    var freq2 = Math.random() * 10 + 10;
    this.sfx.sound(x, y, 0, 0.7, attack, sustain, decay, freq1, freq2, 'square', delay);
  }
};

BaseScreen.prototype.soundPlayerExplode = function(pos) {
  this.vec4.setXYZ(pos.x, pos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];

  var voices = 5;
  var attack = 0.1;
  var sustain = 0.2 * (Math.random() + 0.01);
  var decay = (Math.random()*0.2 + 1) * 1.5;
  for (var i = 0; i < voices; i++) {
    var delay = Math.random() * 0.02 + i * 0.02;
    var freq1 = Math.random() * 30 + 30;
    var freq2 = Math.random() * 10 + 10;
    this.sfx.sound(x, y, 0, 0.8, attack, 0, decay*0.3, freq1*3, 1, 'square', delay);
    this.sfx.sound(x, y, 0, 0.8, 0, sustain, decay, freq1, freq2, 'sine', delay);
    this.sfx.sound(x, y, 0, 0.8, 0, sustain, decay, freq1, freq2, 'triangle', delay);
  }
  this.sfx.sound(x, y, 0, 0.5, decay/6, 0, decay/4, 61, 60, 'square');
  this.sfx.sound(x, y, 0, 0.5, decay/6, 0, decay/4, 34, 30, 'square');
};

BaseScreen.prototype.soundPlayerSpawn = function(pos) {
  this.vec4.setXYZ(pos.x, pos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];

  var freq = 100;
  for (var i = 0; i < 5; i++) {
    freq *= 2;
    this.sfx.sound(x, y, 0, 0.2, 0.01, 0.1, 0.15, freq, freq, 'sine', i * 0.05);
    this.sfx.sound(x, y, 0, 0.1, 0.01, 0.1, 0.15, freq+2, freq, 'square', i * 0.05);
  }
};

BaseScreen.prototype.soundPlayerWarp = function(pos) {
  this.vec4.setXYZ(pos.x, pos.y, 0).transform(this.viewMatrix);
  var x = this.vec4.v[0];
  var y = this.vec4.v[1];

  var freq = 2000;
  for (var i = 0; i < 20; i++) {
    freq *= 0.5;
    this.sfx.sound(x, y, 0, 0.2, 0.01, 0.1, 0.15, freq, freq, 'sine', i * 0.1);
    this.sfx.sound(x, y, 0, 0.1, 0.01, 0.1, 0.15, freq+2, freq, 'square', i * 0.1);
  }
};

////////////////////////////
// Wall manipulation stuff
///////////////////////////

BaseScreen.prototype.flushTerrainChanges = function() {
  var changedCellIds = this.bitGrid.flushChangedCellIds();
  for (var i = 0; i < changedCellIds.length; i++) {
    this.changeTerrain(changedCellIds[i]);
  }
};

/**
 * The cell at the cellId definitely changes, so unload it and reload it.
 * Make sure the four cardinal neighbors are also loaded.
 * @param cellId
 */
BaseScreen.prototype.changeTerrain = function(cellId) {
  var center = Vec2d.alloc();
  this.bitGrid.cellIdToIndexVec(cellId, center);
  this.loadCellXY(center.x - 1, center.y);
  this.loadCellXY(center.x + 1, center.y);
  this.loadCellXY(center.x, center.y - 1);
  this.loadCellXY(center.x, center.y + 1);
  this.unloadCellXY(center.x, center.y);
  this.loadCellXY(center.x, center.y);
  center.free();
};

BaseScreen.prototype.loadCellXY = function(cx, cy) {
  var cellId = this.bitGrid.getCellIdAtIndexXY(cx, cy);
  var tile = this.tiles[cellId];
  if (!tile) {
    this.tiles[cellId] = tile = {
      cellId: cellId,
      stamp: null,
      bodyIds: null
    };
  }
  if (!tile.bodyIds) {
    tile.bodyIds = [];
    // Create wall bodies and remember their IDs.
    var rects = this.bitGrid.getRectsOfColorForCellId(0, cellId);
    for (var r = 0; r < rects.length; r++) {
      var rect = rects[r];
      var body = this.createWallBody(rect);
      tile.bodyIds.push(this.world.addBody(body));
    }
  }
  // TODO don't repeat stamp for solid walls
  if (!tile.stamp) {
    if (!rects) rects = this.bitGrid.getRectsOfColorForCellId(0, cellId);
    tile.stamp = this.createTileStamp(rects);
  }
};

BaseScreen.prototype.unloadCellXY = function(cx, cy) {
  this.unloadCellId(this.bitGrid.getCellIdAtIndexXY(cx, cy));
};

BaseScreen.prototype.unloadCellId = function(cellId) {
  var tile = this.tiles[cellId];
  if (!tile) return;
  if (tile.stamp) {
    tile.stamp.dispose(this.renderer.gl);
    tile.stamp = null;
  }
  if (tile.bodyIds) {
    for (var i = 0; i < tile.bodyIds.length; i++) {
      var id = tile.bodyIds[i];
      this.world.removeBodyId(id);
    }
    tile.bodyIds = null;
  }
};

/**
 * Creates a body, but does not add it to the world.
 */
BaseScreen.prototype.createWallBody = function(rect) {
  var b = Body.alloc();
  b.shape = Body.Shape.RECT;
  b.setPosAtTime(rect.pos, this.world.now);
  b.rectRad.set(rect.rad);
  b.hitGroup = BaseScreen.Group.WALL;
  b.mass = Infinity;
  b.pathDurationMax = Infinity;
  return b;
};

BaseScreen.prototype.createTileStamp = function(rects) {
  var model = new RigidModel();
  for (var i = 0; i < rects.length; i++) {
    model.addRigidModel(this.createWallModel(rects[i]));
  }
  return model.createModelStamp(this.renderer.gl);
};

BaseScreen.prototype.createWallModel = function(rect) {
  var transformation, wallModel;
  transformation = new Matrix44()
      .toTranslateOpXYZ(rect.pos.x, rect.pos.y, 0)
      .multiply(new Matrix44().toScaleOpXYZ(rect.rad.x, rect.rad.y, 1));
  wallModel = RigidModel.createSquare().transformPositions(transformation);
  wallModel.setColorRGB(0.2, 0.3, 0.6);
  return wallModel;
};

BaseScreen.prototype.drawTiles = function() {
  if (!this.tiles) {
    return;
  }
  this.renderer
      .setColorVector(this.levelColorVector)
      .setModelMatrix(this.levelModelMatrix);
  var cx = Math.round((this.camera.getX() - 0.5 * this.bitGrid.cellWorldSize) / this.bitGrid.cellWorldSize);
  var cy = Math.round((this.camera.getY() - 0.5 * this.bitGrid.cellWorldSize) / this.bitGrid.cellWorldSize);
  var pixelsPerMeter = this.getPixelsPerMeter();
  var pixelsPerCell = this.bitGridMetersPerCell * pixelsPerMeter;
  var cellsPerScreenX = this.canvas.width / pixelsPerCell;
  var cellsPerScreenY = this.canvas.height / pixelsPerCell;
  var rx = Math.ceil(cellsPerScreenX);
  var ry = Math.ceil(cellsPerScreenY);
  for (var dy = -ry; dy <= ry; dy++) {
    for (var dx = -rx; dx <= rx; dx++) {
      this.loadCellXY(cx + dx, cy + dy);
      var cellId = this.bitGrid.getCellIdAtIndexXY(cx + dx, cy + dy);
      var tile = this.tiles[cellId];
      if (tile && tile.stamp) {
        this.renderer
            .setStamp(tile.stamp)
            .drawStamp();
      }
    }
  }
};

BaseScreen.prototype.approxViewportsFromCamera = function(v) {
  var ppm = this.getPixelsPerMeter();
  return Math.max(
      Math.abs(this.camera.getX() - v.x) * ppm / this.canvas.width,
      Math.abs(this.camera.getY() - v.y) * ppm / this.canvas.height);
};

BaseScreen.prototype.unloadLevel = function() {
  // TODO: delete this or start using it.
  if (this.tiles) {
    for (var cellId in this.tiles) {
      this.unloadCellId(cellId);
    }
    this.tiles = null;
  }
  if (this.world) {
    for (var spiritId in this.world.spirits) {
      var s = this.world.spirits[spiritId];
      var b = this.world.bodies[s.bodyId];
      this.world.removeBodyId(b.id);
      this.world.removeSpiritId(spiritId);
    }
    this.world = null;
  }
  this.camera.setXY(0, 0);
  if (this.editor) {
    this.editor.cursorPos.reset();
    this.editor.cursorVel.reset();
  }
};

