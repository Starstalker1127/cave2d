/**
 * @constructor
 * @extends {Screen}
 */
function BaseScreen(controller, canvas, renderer, stamps, sfx) {
  if (!controller) return; // generating prototype
  Screen.call(this);

  this.exitStartTime = 0;
  this.exitEndTime = 0;

  this.controller = controller;
  this.canvas = canvas;
  this.renderer = renderer;
  this.stamps = stamps;

  this.viewMatrix = new Matrix44();
  this.vec2d = new Vec2d();
  this.vec4 = new Vec4();
  this.mat44 = new Matrix44();
  this.nextButtonNum = 0;
  this.worldBoundingRect = new Rect();

  this.sounds = new Sounds(sfx, this.viewMatrix);

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

  this.bitSize = 0.5;
  this.bitGridMetersPerCell = BaseScreen.BIT_SIZE * BitGrid.BITS;
  this.levelModelMatrix = new Matrix44();
  this.levelColorVector = new Vec4(0.4, 0.4, 0.4);

  this.timeMultiplier = 1;

  this.glyphs = new Glyphs(new GlyphMaker(0.4, 1.2));
  this.glyphs.initStamps(this.renderer.gl);

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

  var framesPerRightSample = 1;
  var samplesPerRightGraph = 2;

  var framesPerLeftSample = 10;
  var samplesPerLeftGraph = 40;

  this.canvasCuboid = new Cuboid();
  this.graphsCuboid = new Cuboid();
  this.bottomRightCuboid = new Cuboid();
  this.topRightCuboid = new Cuboid();
  this.bottomLeftCuboid = new Cuboid();
  this.topLeftCuboid = new Cuboid();
  this.cuboidRules = [];

  var graphWidthFrac = 1;
  var dotSize = 8;
  var lineWidth = 2;
  var margin = 14;
  var borderColor = new Vec4(0.6, 0.6, 0.6);
  var stripeColor = borderColor;

  this.cuboidRules.push(new CuboidRule(this.canvasCuboid, this.graphsCuboid)
      .setSizingMax(new Vec4(1/2, 1/2, 1), new Vec4(100, 100, Infinity))
      .setAspectRatio(new Vec4(1, 1, 0))
      .setSourceAnchor(new Vec4(1, 1, 0), new Vec4(-margin, -margin, 0))
      .setTargetAnchor(new Vec4(1, 1, 0), new Vec4(0, 0, 0)));

  this.cuboidRules.push(new CuboidRule(this.graphsCuboid, this.bottomRightCuboid)
      .setSizingMax(new Vec4(0, 1/4, 1), Vec4.INFINITY)
      .setSourceAnchor(new Vec4(1, 1, 0), Vec4.ZERO)
      .setTargetAnchor(new Vec4(1, 1, 0), Vec4.ZERO));
  this.cuboidRules.push(new CuboidRule(this.graphsCuboid, this.bottomLeftCuboid)
      .setSizingMax(new Vec4(graphWidthFrac, 1/4, 1), Vec4.INFINITY)
      .setSourceAnchor(new Vec4(-1, 1, 0), new Vec4(-margin, 0, 0))
      .setTargetAnchor(new Vec4(-1, 1, 0), Vec4.ZERO));

  this.cuboidRules.push(new CuboidRule(this.graphsCuboid, this.topRightCuboid)
      .setSizingMax(new Vec4(0, 3/4, 1), Vec4.INFINITY)
      .setSourceAnchor(new Vec4(1, -1, 0), new Vec4(0, -margin, 0))
      .setTargetAnchor(new Vec4(1, -1, 0), Vec4.ZERO));
  this.cuboidRules.push(new CuboidRule(this.graphsCuboid, this.topLeftCuboid)
      .setSizingMax(new Vec4(graphWidthFrac, 3/4, 1), Vec4.INFINITY)
      .setSourceAnchor(new Vec4(-1, -1, 0), new Vec4(-margin, -margin, 0))
      .setTargetAnchor(new Vec4(-1, -1, 0), Vec4.ZERO));

  this.rightStatMons = [];
  this.leftStatMons = [];
  this.rightStatMons.push(new StatMon(
      stats, STAT_NAMES.WORLD_TIME,
      framesPerRightSample, samplesPerRightGraph,
      0, BaseScreen.CLOCKS_PER_FRAME,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.bottomRightCuboid)
      .setBorderColor(stripeColor)
      .setGraphColor(new Vec4(1, 1, 1))
      .setLineWidth(dotSize));
  this.leftStatMons.push(new StatMon(
      stats, STAT_NAMES.WORLD_TIME,
      framesPerLeftSample, samplesPerLeftGraph,
      0, BaseScreen.CLOCKS_PER_FRAME,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.bottomLeftCuboid)
      .setBorderColor(borderColor)
      .setGraphColor(new Vec4(1, 1, 1))
      .setLineWidth(lineWidth));

  // BLUE: overhead to get to draw screen - mostly clearing the screen
  this.rightStatMons.push(new StatMon(
      stats, STAT_NAMES.TO_DRAWSCREEN_MS,
      framesPerRightSample, samplesPerRightGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topRightCuboid)
      .setGraphColor(new Vec4(0, 0, 1))
      .setBorderWidth(0)
      .setLineWidth(dotSize));
  this.leftStatMons.push(new StatMon(
      stats, STAT_NAMES.TO_DRAWSCREEN_MS,
      framesPerLeftSample, samplesPerLeftGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topLeftCuboid)
      .setGraphColor(new Vec4(0, 0, 1))
      .setBorderWidth(0)
      .setLineWidth(lineWidth));

  // GREEN: ..through the stat drawing itself..
  this.rightStatMons.push(new StatMon(
      stats, STAT_NAMES.STAT_DRAWING_MS,
      framesPerRightSample, samplesPerRightGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topRightCuboid)
      .setGraphColor(new Vec4(0, 1, 0))
      .setBorderWidth(0)
      .setLineWidth(dotSize));
  this.leftStatMons.push(new StatMon(
      stats, STAT_NAMES.STAT_DRAWING_MS,
      framesPerLeftSample, samplesPerLeftGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topLeftCuboid)
      .setGraphColor(new Vec4(0, 1, 0))
      .setBorderWidth(0)
      .setLineWidth(lineWidth));

  // RED: ..through the scene drawing..
  this.rightStatMons.push(new StatMon(
      stats, STAT_NAMES.SCENE_PLUS_STAT_DRAWING_MS,
      framesPerRightSample, samplesPerRightGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topRightCuboid)
      .setGraphColor(new Vec4(1, 0, 0))
      .setBorderWidth(0)
      .setLineWidth(dotSize));
  this.leftStatMons.push(new StatMon(
      stats, STAT_NAMES.SCENE_PLUS_STAT_DRAWING_MS,
      framesPerLeftSample, samplesPerLeftGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topLeftCuboid)
      .setGraphColor(new Vec4(1, 0, 0))
      .setBorderWidth(0)
      .setLineWidth(lineWidth));

  // YELLOW: ..and to the end, which is all physics
  this.rightStatMons.push(new StatMon(
      stats, STAT_NAMES.ANIMATION_MS,
      framesPerRightSample, samplesPerRightGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topRightCuboid)
      .setBorderColor(stripeColor)
      .setGraphColor(new Vec4(1, 1, 0))
      .setLineWidth(dotSize));
  this.leftStatMons.push(new StatMon(
      stats, STAT_NAMES.ANIMATION_MS,
      framesPerLeftSample, samplesPerLeftGraph,
      0, BaseScreen.MS_UNTIL_CLOCK_ABORT,
      renderer, new LineDrawer(renderer, this.stamps.lineStamp), this.topLeftCuboid)
      .setBorderColor(borderColor)
      .setGraphColor(new Vec4(1, 1, 0))
      .setLineWidth(lineWidth));
  this.drawLeftGraphs = false;
  this.drawRightGraphs = false;

  this.dirty = false;
  this.somethingMoving = false;
}
BaseScreen.prototype = new Screen();
BaseScreen.prototype.constructor = BaseScreen;

BaseScreen.WIDGET_RADIUS = 30;
BaseScreen.CAMERA_VIEW_DIST = 40;

BaseScreen.MS_PER_FRAME = 1000 / 60;
BaseScreen.MS_UNTIL_CLOCK_ABORT = BaseScreen.MS_PER_FRAME - 1;
BaseScreen.CLOCKS_PER_FRAME = 0.5;
BaseScreen.PATH_DURATION = 0xffff;

BaseScreen.SpiritType = {
  ANT: 3
};

BaseScreen.MenuItem = {
  ANT: 'ant'
};

BaseScreen.Terrain = {
  WALL: 0,
  FLOOR: 1,
  MIXED: 2
};

BaseScreen.SplashType = {
  NOTE: 1,
  SCAN: 2,
  WALL_DAMAGE: 3,
  ERROR: 4
};

BaseScreen.BIT_SIZE = 0.5;
BaseScreen.WORLD_CELL_SIZE = BaseScreen.BIT_SIZE * BitGrid.BITS;

BaseScreen.EventLayer = {
  POPUP: 0,
  HUD: 1,
  WORLD: 2
};

/**
 * Whether the world has been changed since the last time the bit was set to true
 * @returns {boolean}
 */
BaseScreen.prototype.isDirty = function() {
  return this.dirty;
};

/**
 * True to indicate that the world has changed in an undoable way, false to indicate that the world has been restored
 * from the undo stack and nothing has happened since.
 * @param {boolean} d
 */
BaseScreen.prototype.setDirty = function(d) {
  if (this.dirty != d) {
    this.dirty = d;
  }
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
      BaseScreen.MenuItem.ANT, 0, 0, AntSpirit.factory);

  this.spiritFactory = new SpiritFactory(this, this.spiritConfigs);
};

BaseScreen.Group = {
  EMPTY: 0,
  WALL: 1,
  NEUTRAL: 2,
  CURSOR: 3,
  ENEMY: 4,
  ENEMY_SCAN: 5
};

BaseScreen.prototype.initWorld = function() {
  var groupCount = Object.keys(BaseScreen.Group).length;
  var g = BaseScreen.Group;
  var hitPairs = [
    [g.EMPTY, g.EMPTY],

    [g.NEUTRAL, g.WALL],
    [g.NEUTRAL, g.NEUTRAL],

    [g.CURSOR, g.WALL],
    [g.CURSOR, g.NEUTRAL],

    [g.ENEMY, g.NEUTRAL],
    [g.ENEMY, g.WALL],
    [g.ENEMY, g.CURSOR],
    [g.ENEMY, g.ENEMY],

    [g.ENEMY_SCAN, g.WALL],
    [g.ENEMY_SCAN, g.NEUTRAL],
    [g.ENEMY_SCAN, g.ENEMY]
  ];
  this.world = new World(BaseScreen.WORLD_CELL_SIZE, groupCount, hitPairs, this.spiritFactory);
  this.resolver = new HitResolver();
  this.bitGrid = new BitGrid(this.bitSize);
  this.tileGrid = new TileGrid(this.bitGrid, this.renderer, this.world, this.getWallHitGroup());
};

BaseScreen.prototype.createTrackball = function() {
  var trackball = new MultiTrackball()
      .addTrackball(new TouchTrackball(this.getWorldEventTarget())
          .setStartZoneFunction(function(x, y) { return true; }))
      .addTrackball(
          new KeyTrackball(
              new KeyStick().setUpRightDownLeftByName(Key.Name.DOWN, Key.Name.RIGHT, Key.Name.UP, Key.Name.LEFT),
              new KeyTrigger().addTriggerKeyByName(Key.Name.SHIFT))
          .setAccel(0.8)
          .setTraction(0.25)
  );
  trackball.setFriction(0.05);
  this.addListener(trackball);
  return trackball;
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

BaseScreen.prototype.drawScreen = function(visibility, startTimeMs) {
  stats.add(STAT_NAMES.TO_DRAWSCREEN_MS, performance.now() - startTimeMs);
  if (this.destroyed) {
    console.warn('drawing destroyed screen - ignoring');
    return;
  }
  this.drawStats();
  stats.add(STAT_NAMES.STAT_DRAWING_MS, performance.now() - startTimeMs);

  this.visibility = visibility;
  this.updateViewMatrix();
  this.drawScene();
  stats.add(STAT_NAMES.SCENE_PLUS_STAT_DRAWING_MS, performance.now() - startTimeMs);

  if (this.visibility == 1) {
    this.clock(startTimeMs);
  }
};

BaseScreen.prototype.sampleStats = function() {
  for (var i = 0; i < this.rightStatMons.length; i++) {
    this.rightStatMons[i].sample();
  }
  for (var i = 0; i < this.leftStatMons.length; i++) {
    this.leftStatMons[i].sample();
  }
};

BaseScreen.prototype.drawScene = function() {};

BaseScreen.prototype.destroyScreen = function() {
  this.setScreenListening(false);
  this.unloadLevel();
  this.destroyed = true;
};

BaseScreen.prototype.showPauseMenu = function() {
  document.querySelector('#pauseMenu').style.display = 'block';
  this.canvas.style.cursor = "auto";
};

BaseScreen.prototype.hidePauseMenu = function() {
  document.querySelector('#pauseMenu').style.display = 'none';
  this.canvas.style.cursor = "";
};

BaseScreen.prototype.clock = function(startTimeMs) {
  if (this.paused) return;
  var endTimeMs = startTimeMs + BaseScreen.MS_UNTIL_CLOCK_ABORT;
  var startClock = this.world.now;
  var endClock = this.world.now + BaseScreen.CLOCKS_PER_FRAME * this.timeMultiplier;

  if (this.handleInput) {
    this.handleInput();
  }

  this.somethingMoving = false;
  for (var id in this.world.bodies) {
    if (this.world.bodies[id].isMoving()) {
      this.somethingMoving = true;
      break;
    }
  }

  if (this.somethingMoving) {
    this.setDirty(true);
    var e = this.world.getNextEvent();
    // Stop if there are no more events to process, or we've moved the game clock far enough ahead
    // to match the amount of wall-time elapsed since the last frame,
    // or (worst case) we're out of time for this frame.

    while (e && e.time <= endClock && performance.now() <= endTimeMs) {
      this.world.processNextEventWthoutFreeing();
      if (e.type == WorldEvent.TYPE_HIT) {
        this.onHitEvent(e);
      }
      e.free();
      // Some events can destroy the screen.
      if (this.destroyed) return;
      e = this.world.getNextEvent();

      // recompute endClock in case an event changed the timeMultiplier
      endClock = Math.max(this.world.now, startClock + BaseScreen.CLOCKS_PER_FRAME * this.timeMultiplier);
    }
    if (!e || e.time > endClock) {
      this.world.now = endClock;
    }
  }
  if (this.exitEndTime && this.world.now >= this.exitEndTime) {
    this.exitLevel();
  }
  stats.set(STAT_NAMES.WORLD_TIME, this.world.now);
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
  var b0 = this.world.getBodyByPathId(e.pathId0);
  var b1 = this.world.getBodyByPathId(e.pathId1);

  if (b0 && b1) {
    this.resolver.resolveHit(e.time, e.collisionVec, b0, b1);
  }
};

BaseScreen.prototype.startExit = function() {};

BaseScreen.prototype.exitLevel = function() {};

BaseScreen.prototype.handleInput = function() {
};

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

BaseScreen.prototype.drawStats = function() {
  this.canvasCuboid.pos.setXYZ(this.canvas.width / 2, this.canvas.height / 2, 0);
  this.canvasCuboid.rad.setXYZ(this.canvas.width / 2, this.canvas.height / 2, 0.99);
  for (var i = 0; i < this.cuboidRules.length; i++) {
    this.cuboidRules[i].apply();
  }
  if (this.drawLeftGraphs) {
    for (var i = 0; i < this.leftStatMons.length; i++) {
      this.leftStatMons[i].draw(this.canvas.width, this.canvas.height);
    }
  }
  if (this.drawRightGraphs) {
    for (var i = 0; i < this.rightStatMons.length; i++) {
      this.rightStatMons[i].draw(this.canvas.width, this.canvas.height);
    }
  }
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

BaseScreen.prototype.removeByBodyId = function(bodyId) {
  var body = this.world.getBody(bodyId);
  if (body) {
    if (body.spiritId) {
      this.world.removeSpiritId(body.spiritId);
    }
    this.world.removeBodyId(bodyId);
    this.setDirty(true);
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
  s.reset(BaseScreen.SplashType.SCAN, this.stamps.cylinderStamp);

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
    s.startColor.setXYZ(0.2, 0.5, 0.2);
    s.endColor.setXYZ(0.02, 0.05, 0.02);
  } else {
    s.startColor.setXYZ(0.8, 0.2, 0.2);
    s.endColor.setXYZ(0.08, 0.02, 0.02);
  }

  this.splasher.addCopy(s);
};

BaseScreen.prototype.now = function() {
  return this.world.now;
};

BaseScreen.prototype.drawSpirits = function() {
  for (var id in this.world.spirits) {
    var spirit = this.world.spirits[id];
    spirit.onDraw(this.world, this.renderer);
  }
};

///////////////////////////
// Wall manipulation stuff
///////////////////////////

BaseScreen.prototype.drawTerrainPill = function(pos0, pos1, rad, color) {
  var changedCellIds = this.tileGrid.drawTerrainPill(pos0, pos1, rad, color);
  if (changedCellIds.length) {
    this.setDirty(true);
  }
};

BaseScreen.prototype.drawTiles = function() {
  if (!this.tileGrid) {
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
      var stamp = this.tileGrid.getStampAtCellXY(cx + dx, cy + dy);
      if (stamp) {
        this.renderer
            .setStamp(stamp)
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