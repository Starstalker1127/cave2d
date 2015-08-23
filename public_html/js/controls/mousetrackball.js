/**
 * A control trackball for a mouse or trackpad.
 * This is intended for use with pointerlock, but it does not handle pointer lock itself.
 * @constructor
 * @extends {Trackball}
 */
function MouseTrackball() {
  Trackball.call(this);
  var self = this;
  this.listening = false;
  this.mouseMotion = new Vec2d();
  this.touched = false;
  this.speed = 0.05;
  this.mouseMoveListener = function(e) {
    self.onMouseMove(e);
  };
  this.mouseDownListener = function(e) {
    self.onMouseDown(e);
  };
}

MouseTrackball.prototype = new Trackball();
MouseTrackball.prototype.constructor = MouseTrackball;

MouseTrackball.prototype.startListening = function() {
  document.body.addEventListener('mousemove', this.mouseMoveListener);
  document.body.addEventListener('mousedown', this.mouseDownListener);
  this.listening = true;
  return this;
};

MouseTrackball.prototype.stopListening = function() {
  document.body.removeEventListener('mousemove', this.mouseMoveListener);
  document.body.removeEventListener('mousedown', this.mouseDownListener);
  this.listening = false;
  return this;
};

MouseTrackball.prototype.reset = function() {
  if (!this.touched) {
    this.val.scale(1 - this.friction);
  }
  this.mouseMotion.reset();
  this.touched = false;
};

MouseTrackball.prototype.onMouseMove = function(e) {
  var dx = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
  var dy = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
  this.mouseMotion.addXY(dx * this.speed, dy * this.speed);
  this.val.set(this.mouseMotion);
  this.touched = true;
};

MouseTrackball.prototype.onMouseDown = function(e) {
  this.val.reset();
  this.touched = true;
};