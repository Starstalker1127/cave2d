/**
 * A control stick based on touch events.
 * @constructor
 * @extends {Stick}
 */
function TouchStick(element) {
  Stick.call(this);

  this.element = element || document.body;

  this.radius = 30;
  this.startZoneFn = function(x, y) {
    return true;
  };

  var self = this;

  this.center = new Vec2d();
  this.tip = new Vec2d();

  // When this is null, we're not tracking a touch.
  this.touchId = null;

  this.touchStartListener = function(e) {
    self.onTouchStart(e);
  };
  this.touchMoveListener = function(e) {
    self.onTouchMove(e);
  };
  this.touchEndListener = function(e) {
    self.onTouchEnd(e);
  };

  this.listening = false;
}
TouchStick.prototype = new Stick();
TouchStick.prototype.constructor = TouchStick;

TouchStick.prototype.setStartZoneFunction = function(fn) {
  this.startZoneFn = fn;
  return this;
};

TouchStick.prototype.setRadius = function(r) {
  this.radius = r;
  return this;
};

TouchStick.prototype.startListening = function() {
  if (!this.listening) {
    this.element.addEventListener('touchstart', this.touchStartListener);
    this.element.addEventListener('touchmove', this.touchMoveListener);
    this.element.addEventListener('touchend', this.touchEndListener);
    this.element.addEventListener('touchcancel', this.touchEndListener);
    this.listening = true;
  }
  return this;

};

TouchStick.prototype.stopListening = function() {
  if (this.listening) {
    this.element.removeEventListener('touchstart', this.touchStartListener);
    this.element.removeEventListener('touchmove', this.touchMoveListener);
    this.element.removeEventListener('touchend', this.touchEndListener);
    this.element.removeEventListener('touchcancel', this.touchEndListener);
    this.listening = false;
    this.release();
  }
  return this;
};

TouchStick.prototype.getVal = function(out) {
  this.val.set(this.tip).subtract(this.center).scale(1 / this.radius).scaleXY(1, -1);
  this.clip();
  return out.set(this.val);
};

TouchStick.prototype.onTouchStart = function(e) {
  if (this.touchId !== null) return;
  var touches = e.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    var touch = touches[i];
    if (this.startZoneFn(touch.pageX, touch.pageY)) {
      // Start tracking this one.
      this.touchId = touch.identifier;
      this.center.setXY(touch.pageX, touch.pageY);
      this.tip.setXY(touch.pageX, touch.pageY);
      break;
    }
  }
};

TouchStick.prototype.onTouchMove = function(e) {
  if (this.touchId === null) return;
  var touches = e.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    var touch = touches[i];
    if (touch.identifier == this.touchId) {
      // Keep tracking this one.
      var xDiff = touch.pageX - this.tip.x;
      var yDiff = touch.pageY - this.tip.y;
      // The further the stick is currently displaced, the more sensitive it is to changes, from 100% to 200%.
      var distFrac = 1 + this.tip.distance(this.center) / this.radius;
      this.tip.addXY(xDiff * distFrac, yDiff * distFrac);
      var dist = this.tip.distance(this.center);
      var max = this.radius;
      if (dist > max) {
        this.center.slideByFraction(this.tip, (dist - max) / dist);
      }
      break;
    }
  }
};

TouchStick.prototype.onTouchEnd = function(e) {
  if (this.touchId === null) return;
  var touches = e.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    var touch = touches[i];
    if (touch.identifier == this.touchId) {
      this.touchId = null;
      this.center.setXY(touch.pageX, touch.pageY);
      this.tip.setXY(touch.pageX, touch.pageY);
      break;
    }
  }
};


TouchStick.prototype.release = function() {
  this.center.reset();
  this.tip.reset();
  this.touchId = null;
};