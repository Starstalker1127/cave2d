/**
 * @constructor
 * @extends {BaseScreen}
 */
function TestScreen(controller, canvas, renderer, glyphs, stamps, sfx, adventureName, levelName) {
  BaseScreen.call(this, controller, canvas, renderer, glyphs, stamps, sfx, adventureName, levelName);

  this.camera = new Camera(0.1, 1, 35);
  this.updateViewMatrix();
  this.renderer.setViewMatrix(this.viewMatrix);

  this.playerAveragePos = new Vec2d();
  this.players = [];

  var self = this;

  this.keyTipRevealer = function() {
    var ms = Date.now() + Editor.KEYBOARD_TIP_TIMEOUT_MS;
    self.testTriggerWidget.setKeyboardTipTimeoutMs(ms);
    for (var i = 0; i < self.players.length; i++) {
      self.players[i].setKeyboardTipTimeoutMs(ms);
    }
  };

  this.testTriggerWidget = new TriggerWidget(this.getHudEventTarget())
      .setCanvasScaleXY(EditScreen.WIDGET_RADIUS, EditScreen.WIDGET_RADIUS)
      .setReleasedColorVec4(new Vec4(1, 1, 1, 0.5))
      .setPressedColorVec4(new Vec4(1, 1, 1, 1))
      .listenToTouch()
      .listenToMousePointer()
      .addTriggerKeyByName('t')
      .startListening();

  this.testDownFn = function(e) {
    e = e || window.event;
    var query = {};
    query[EditorApp.PARAM_ADVENTURE_NAME] = self.adventureName;
    query[EditorApp.PARAM_LEVEL_NAME] = self.levelName;
    query[EditorApp.PARAM_MODE] = EditorApp.MODE_EDIT;
    Url.setFragment(Url.encodeQuery(query));
    e.preventDefault();
  };

  this.pauseTriggerWidget = new TriggerWidget(this.getHudEventTarget())
      .setCanvasScaleXY(EditScreen.WIDGET_RADIUS, EditScreen.WIDGET_RADIUS)
      .setReleasedColorVec4(new Vec4(1, 1, 1, 0.5))
      .setPressedColorVec4(new Vec4(1, 1, 1, 1))
      .listenToTouch()
      .listenToMousePointer()
      .addTriggerKeyByName(Key.Name.SPACE)
      .startListening();

  this.pauseDownFn = function(e) {
    e = e || window.event;
    self.paused = !self.paused;
    if (self.paused) {
      // pause
      self.showPausedOverlay();
    } else {
      // resume
      self.hidePausedOverlay();
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
}
TestScreen.prototype = new BaseScreen();
TestScreen.prototype.constructor = TestScreen;

TestScreen.prototype.createTrackball = function() {
  var trackball = new MultiTrackball()
      .addTrackball(new TouchTrackball(this.getWorldEventTarget())
          .setStartZoneFunction(function(x, y) { return true; }))
      .addTrackball(new KeyTrackball(new KeyStick().setUpRightDownLeftByName(
          Key.Name.DOWN, Key.Name.RIGHT, Key.Name.UP, Key.Name.LEFT))
          .setAccel(1.0)
          .setTraction(0.2)
  );
  trackball.setFriction(0.05);
  trackball.startListening();
  return trackball;
};

TestScreen.prototype.createButtonWidgets = function() {
  return [
    new TriggerWidget(this.getHudEventTarget())
        .setReleasedColorVec4(new Vec4(1, 1, 1, 0.25))
        .setPressedColorVec4(new Vec4(1, 1, 1, 0.5))
        .setStamp(this.circleStamp)// TODO real stamp
        .listenToTouch()
        .addTriggerKeyByName('z')
        .setKeyboardTipStamp(this.glyphs.stamps['Z'])
        .startListening(),
    new TriggerWidget(this.getHudEventTarget())
        .setReleasedColorVec4(new Vec4(1, 1, 1, 0.25))
        .setPressedColorVec4(new Vec4(1, 1, 1, 0.5))
        .setStamp(this.circleStamp)// TODO real stamp
        .listenToTouch()
        .addTriggerKeyByName('x')
        .setKeyboardTipStamp(this.glyphs.stamps['X'])
        .startListening()];
};

TestScreen.prototype.updateHudLayout = function() {
  this.pauseTriggerWidget.setCanvasPositionXY(this.canvas.width - EditScreen.WIDGET_RADIUS, EditScreen.WIDGET_RADIUS);
  this.testTriggerWidget.setCanvasPositionXY(this.canvas.width - EditScreen.WIDGET_RADIUS, EditScreen.WIDGET_RADIUS * 3);
};


TestScreen.prototype.setScreenListening = function(listen) {
  if (listen == this.listening) return;
  var fsb, rb, i;
  BaseScreen.prototype.setScreenListening.call(this, listen);
  if (listen) {
    for (i = 0; i < this.listeners.vals.length; i++) {
      this.listeners.vals[i].startListening();
    }
    this.pauseTriggerWidget.addTriggerDownListener(this.pauseDownFn);
    this.testTriggerWidget.addTriggerDownListener(this.testDownFn);

    fsb = document.querySelector('#fullScreenButton');
    fsb.addEventListener('click', this.fullScreenFn);
    fsb.addEventListener('touchend', this.fullScreenFn);

    rb = document.querySelector('#resumeButton');
    rb.addEventListener('click', this.pauseDownFn);
    rb.addEventListener('touchend', this.pauseDownFn);

    this.canvas.addEventListener('mousemove', this.keyTipRevealer);
    window.addEventListener('keydown', this.keyTipRevealer);

  } else {
    for (i = 0; i < this.listeners.vals.length; i++) {
      this.listeners.vals[i].stopListening();
    }
    this.pauseTriggerWidget.removeTriggerDownListener(this.pauseDownFn);
    this.testTriggerWidget.removeTriggerDownListener(this.testDownFn);

    fsb = document.querySelector('#fullScreenButton');
    fsb.removeEventListener('click', this.fullScreenFn);
    fsb.removeEventListener('touchend', this.fullScreenFn);

    rb = document.querySelector('#resumeButton');
    rb.removeEventListener('click', this.pauseDownFn);
    rb.removeEventListener('touchend', this.pauseDownFn);

    this.canvas.removeEventListener('mousemove', this.keyTipRevealer);
    window.removeEventListener('keydown', this.keyTipRevealer);
  }
  this.listening = listen;
};

TestScreen.prototype.lazyInit = function() {
  if (!this.initialized) {
    this.initSpiritConfigs();
    this.updateHudLayout();
    this.initPermStamps();
    this.initWorld();
    this.initialized = true;
  }
};

TestScreen.prototype.initSpiritConfigs = function() {
  this.spiritConfigs = {};

  var self = this;
  function addConfig(type, ctor) {
    var model = ctor.createModel();
    var stamp = model.createModelStamp(self.renderer.gl);
    self.spiritConfigs[type] = new SpiritConfig(type, ctor, stamp);
  }

  addConfig(BaseScreen.SpiritType.ANT, AntSpirit);

  addConfig(BaseScreen.SpiritType.PLAYER, PlayerSpirit);
};

TestScreen.prototype.initPermStamps = function() {
  this.cubeStamp = RigidModel.createCube().createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.cubeStamp);

  this.circleStamp = RigidModel.createCircleMesh(5).createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.circleStamp);

  var pauseModel = new RigidModel();
  pauseModel.addRigidModel(RigidModel.createRingMesh(4, 0.5)
      .transformPositions(new Matrix44().toScaleOpXYZ(0.5, 0.5, 0.5)));
  var teeth = 8;
  for (var r = 0; r < teeth; r++) {
    pauseModel.addRigidModel(
        RigidModel.createSquare()
            .transformPositions(new Matrix44().toScaleOpXYZ(0.09, 0.1, 1))
            .transformPositions(new Matrix44().toTranslateOpXYZ(0, -0.6, 0))
            .transformPositions(new Matrix44().toRotateZOp(2 * Math.PI * r / teeth)));
  }
  this.pauseStamp = pauseModel.createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.pauseStamp);
  this.pauseTriggerWidget.setStamp(this.pauseStamp);

  var testModel = RigidModel.createTriangle()
      .transformPositions(new Matrix44().toScaleOpXYZ(0.4, 0.3, 1))
      .transformPositions(new Matrix44().toRotateZOp(Math.PI/2));
  this.testStamp = testModel.createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.testStamp);
  this.testTriggerWidget
      .setStamp(this.testStamp)
      .setKeyboardTipStamp(this.glyphs.stamps['T'])
      .setKeyboardTipScaleXY(4, -4)
      .setKeyboardTipOffsetXY(EditScreen.WIDGET_RADIUS * 0.6, EditScreen.WIDGET_RADIUS * 0.7);

  var model = RigidModel.createDoubleRing(64);
  this.soundStamp = model.createModelStamp(this.renderer.gl);
  this.levelStamps.push(this.soundStamp);
};

TestScreen.prototype.initWorld = function() {
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
  this.resolver.defaultElasticity = 0.5;
};

TestScreen.prototype.addNoteSplash = function(x, y, dx, dy, r, g, b, bodyRad) {
  var fullRad = bodyRad * 2;// * (1+Math.random()/2);
  var s = this.splash;
  s.reset(TestScreen.SplashType.NOTE, this.soundStamp);

  s.startTime = this.world.now;
  s.duration = 10;

  s.startPose.pos.setXYZ(x, y, 0);
  s.endPose.pos.setXYZ(x + dx * s.duration, y + dy * s.duration, 1);
  s.startPose.scale.setXYZ(fullRad, fullRad, 1);
  s.endPose.scale.setXYZ(fullRad*2, fullRad*2, 1);

  s.startPose2.pos.setXYZ(x, y, 0);
  s.endPose2.pos.setXYZ(x + dx * s.duration, y + dy * s.duration, 1);
  s.startPose2.scale.setXYZ(fullRad*0.5, fullRad*0.5, 1);
  s.endPose2.scale.setXYZ(fullRad*1.9, fullRad*1.9, 1);

  s.startPose.rotZ = s.startPose2.rotZ = Math.PI * 2 * Math.random();
  s.endPose.rotZ = s.endPose2.rotZ = s.startPose.rotZ + 0.3 * Math.PI * (Math.random() - 0.5);

  s.startColor.setXYZ(r, g, b);
  s.endColor.setXYZ(r, g, b);

  s.duration = 8;
  s.endPose.rotZ = s.endPose2.rotZ =s.startPose2.rotZ;
  this.splasher.addCopy(s);
};

TestScreen.prototype.onHitEvent = function(e) {
  var b0 = this.world.getBodyByPathId(e.pathId0);
  var b1 = this.world.getBodyByPathId(e.pathId1);
  if (b0 && b1) {
    this.resolver.resolveHit(e.time, e.collisionVec, b0, b1);
  }
};

TestScreen.prototype.handleInput = function() {
  for (var i = 0; i < this.players.length; i++) {
    this.players[i].handleInput();
  }
};

TestScreen.prototype.addPlayer = function() {
  var p = new Player();
  var trackball = this.createTrackball();
  var buttons = this.createButtonWidgets();
  p.setControls(trackball, buttons[0], buttons[1]);
  for (var id in this.world.spirits) {
    var spirit = this.world.spirits[id];
    if (spirit.type == BaseScreen.SpiritType.PLAYER) {
      p.addSpirit(spirit);
    }
  }
  this.players.push(p);
};

TestScreen.prototype.drawScene = function() {
  if (!this.players.length) {
    this.addPlayer();
  }
  this.renderer.setViewMatrix(this.viewMatrix);
  this.hitsThisFrame = 0;

  // Position the camera to be at the average of all player sprite body postions
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
    this.camera.follow(this.playerAveragePos);
  }

  this.sfx.setListenerXYZ(this.camera.getX(), this.camera.getY(), 5);

  if (this.tiles) {
    this.renderer
        .setColorVector(this.levelColorVector)
        .setModelMatrix(this.levelModelMatrix);
    var cx = Math.round((this.camera.getX() - this.bitGrid.cellWorldSize/2) / (this.bitGrid.cellWorldSize));
    var cy = Math.round((this.camera.getY() - this.bitGrid.cellWorldSize/2) / (this.bitGrid.cellWorldSize));
    var pixelsPerMeter = 0.5 * (this.canvas.height + this.canvas.width) / this.camera.getViewDist();
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
  }
  this.splasher.draw(this.renderer, this.world.now);
  this.drawHud();
  this.configMousePointer();

  if (this.restarting) {
    this.controller.restart();
    this.restarting = false;
  } else {
    // Animate whenever this thing draws.
    if (!this.paused) {
      this.controller.requestAnimation();
    }
  }
};

TestScreen.prototype.drawHud = function() {
  this.hudViewMatrix.toIdentity()
      .multiply(this.mat44.toScaleOpXYZ(
              2 / this.canvas.width,
              -2 / this.canvas.height,
          1))
      .multiply(this.mat44.toTranslateOpXYZ(-this.canvas.width/2, -this.canvas.height/2, 0));
  this.renderer.setViewMatrix(this.hudViewMatrix);

  this.updateHudLayout();
  this.renderer.setBlendingEnabled(true);
  this.pauseTriggerWidget.draw(this.renderer);
  this.testTriggerWidget.draw(this.renderer);
  for (var i = 0; i < this.players.length; i++) {
    this.players[i].drawHud(this.renderer);
  }
  this.renderer.setBlendingEnabled(false);
};

TestScreen.prototype.configMousePointer = function() {
  if (this.pauseTriggerWidget.isMouseHovered() ||
      this.testTriggerWidget.isMouseHovered()) {
    this.canvas.style.cursor = "auto"
  } else if (this.paused) {
    this.canvas.style.cursor = "";
  } else {
    this.canvas.style.cursor = "crosshair";
  }
};

TestScreen.prototype.getPauseTriggerColorVector = function() {
  this.colorVector.setRGBA(1, 1, 1, this.paused ? 0 : 0.1);
  return this.colorVector;
};

TestScreen.prototype.unloadLevel = function() {
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
};

TestScreen.prototype.showPausedOverlay = function() {
  document.querySelector('#pausedOverlay').style.display = 'block';
  this.canvas.style.cursor = "auto";
};

TestScreen.prototype.hidePausedOverlay = function() {
  document.querySelector('#pausedOverlay').style.display = 'none';
  this.canvas.style.cursor = "";
};

/////////////////
// Spirit APIs //
/////////////////

TestScreen.prototype.isPlaying = function() {
  return true;
};