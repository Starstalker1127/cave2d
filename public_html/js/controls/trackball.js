/**
 * Control trackball base class
 * @constructor
 */
function Trackball() {
  this.val = new Vec2d();
  this.friction = 0.05;
  this.touched = false;
}

Trackball.prototype.setFriction = function(f) {
  this.friction = f;
  return this;
};

/**
 * @param {Vec2d} out
 * @return {Vec2d} out
 */
Trackball.prototype.getVal = function(out) {
  return out.set(this.val);
};

/**
 * Resets the delta between the old position and the new. Use in the event loop
 * after everyone's had a chance to read the trackball val, to prepare
 * to accumulate delta events before the next iteration.
 */
Trackball.prototype.reset = function() {console.log("reset unimplimented")};

Trackball.prototype.isTouched = function() {
  return this.touched;
};