/**
 * A control trackball using up/down/left/right keys.
 * @constructor
 * @extends {Trackball}
 */
function KeyTrackball(keyStick) {
  Trackball.call(this);
  this.keyStick = keyStick;
  this.needsValChange = true;
  this.accel = 0.3;
  this.wasTouched = false;
}
KeyTrackball.prototype = new Trackball();
KeyTrackball.prototype.constructor = KeyTrackball;


KeyTrackball.prototype.setAccel = function(a) {
  this.accel = a;
  return this;
};

/**
 * @param {Vec2d} out
 * @return {Vec2d} out
 */
KeyTrackball.prototype.getVal = function(out) {
  if (!this.wasTouched) {
    this.val.reset();
  } else if (this.needsValChange) {
    this.needsValChange = false;
    this.keyStick.getVal(out);
    if (out.isZero() && this.isTouched()) {
      // Opposite keys are touched. Slam the brakes.
      this.val.scale(0.5);
    } else {
      this.val.scale(0.95).add(out.scale(this.accel));
    }
  }
  this.wasTouched = this.isTouched();
  return out.set(this.val);
};

KeyTrackball.prototype.reset = function() {
  if (!this.isTouched()) {
    this.val.scale(1 - this.friction);
  }
  this.needsValChange = true;
};

KeyTrackball.prototype.isTouched = function() {
  var touched = this.keyStick.isAnyKeyPressed();
  if (!touched) this.wasTouched = false;
  return touched;
};

KeyTrackball.prototype.startListening = function() {
  this.keyStick.startListening();
};

KeyTrackball.prototype.stopListening = function() {
  this.keyStick.stopListening();
};