/**
 * @constructor
 * @extends {Game3BaseScreen}
 */
function Game3TestScreen(controller, canvas, renderer, glyphs, stamps, sfx, adventureName, levelName) {
  Game3BaseScreen.call(this, controller, canvas, renderer, glyphs, stamps, sfx, adventureName, levelName);

  this.camera = new Camera(Game3BaseScreen.CAMERA_MIN_DIST_FRAC, Game3BaseScreen.CAMERA_MAX_DIST_FRAC, Game3BaseScreen.CAMERA_VIEW_DIST);
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
}
Game3TestScreen.prototype = new Game3BaseScreen();
Game3TestScreen.prototype.constructor = Game3TestScreen;

Game3TestScreen.prototype.updateHudLayout = function() {
  this.testTriggerWidget.getWidgetCuboid()
      .setPosXYZ(this.canvas.width - Game3BaseScreen.WIDGET_RADIUS, Game3BaseScreen.WIDGET_RADIUS * 3, 0)
      .setRadXYZ(Game3BaseScreen.WIDGET_RADIUS, Game3BaseScreen.WIDGET_RADIUS, 0);
};

Game3TestScreen.prototype.setScreenListening = function(listen) {
  if (listen == this.listening) return;
  var fsb, rb, i;
  Game3BaseScreen.prototype.setScreenListening.call(this, listen);
  if (listen) {
    for (i = 0; i < this.listeners.vals.length; i++) {
      this.listeners.vals[i].startListening();
    }
    this.testTriggerWidget.startListening();

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
    this.testTriggerWidget.stopListening();

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

Game3TestScreen.prototype.initWidgets = function() {
  var self = this;
  this.testDownFn = function(e) {
    e = e || window.event;
    var query = {};
    query[EditorApp.PARAM_ADVENTURE_NAME] = self.adventureName;
    query[EditorApp.PARAM_LEVEL_NAME] = self.levelName;
    query[EditorApp.PARAM_MODE] = EditorApp.MODE_EDIT;
    Url.setFragment(Url.encodeQuery(query));
    e.preventDefault();
  };

  this.testTriggerWidget = new TriggerWidget(this.getHudEventTarget())
      .addTriggerDownListener(this.testDownFn)
      .setReleasedColorVec4(new Vec4(1, 1, 1, 0.5))
      .setPressedColorVec4(new Vec4(1, 1, 1, 1))
      .listenToTouch()
      .listenToMousePointer()
      .addTriggerKeyByName('t')
      .setStamp(this.stamps.untestStamp)
      .setKeyboardTipStamp(this.glyphs.initStamps(this.renderer.gl)['T']);
};

Game3TestScreen.prototype.startExit = function() {
  // ignore in test screen
};

Game3TestScreen.prototype.drawScene = function() {
  if (!this.players.length) {
    this.addPlayer();
  }
  this.renderer.setViewMatrix(this.viewMatrix);

  var averagePlayerPos = this.getAveragePlayerPos();
  if (averagePlayerPos) {
    this.camera.follow(this.playerAveragePos);
  }

  this.drawSpirits();
  this.drawTiles();
  this.splasher.draw(this.renderer, this.world.now);
  this.drawHud();

  // Animate whenever this thing draws.
  if (!this.paused) {
    this.controller.requestAnimation();
  }
};

Game3TestScreen.prototype.drawHud = function() {
  this.hudViewMatrix.toIdentity()
      .multiply(this.mat44.toScaleOpXYZ(
              2 / this.canvas.width,
              -2 / this.canvas.height,
          1))
      .multiply(this.mat44.toTranslateOpXYZ(-this.canvas.width/2, -this.canvas.height/2, 0));
  this.renderer.setViewMatrix(this.hudViewMatrix);

  this.updateHudLayout();
  this.renderer.setBlendingEnabled(true);
  this.testTriggerWidget.draw(this.renderer);
  for (var i = 0; i < this.players.length; i++) {
    this.players[i].drawHud(this.renderer);
  }
  this.renderer.setBlendingEnabled(false);
};

/////////////////
// Spirit APIs //
/////////////////

Game3TestScreen.prototype.isPlaying = function() {
  return true;
};
