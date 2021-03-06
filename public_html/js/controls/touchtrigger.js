/**
 * A control Trigger using a touchscreen.
 * @constructor
 * @extends {Trigger}
 */
function TouchTrigger(opt_elem) {
  Trigger.call(this);
  this.listening = false;
  this.elem = opt_elem || document.body;

  this.startZoneFn = function(x, y) {
    return true;
  };
  this.touchId = null;

  var self = this;
  this.touchStartListener = function(e) {
    return self.onTouchStart(e);
  };
  this.touchEndListener = function(e) {
    return self.onTouchEnd(e);
  };
}

TouchTrigger.prototype = new Trigger();
TouchTrigger.prototype.constructor = TouchTrigger;

/**
 * @param {function} fn  A function that takes screen coords (x, y) and returns true if the coords are
 * within the touch trigger start zone.
 * @returns {TouchTrigger}
 */
TouchTrigger.prototype.setStartZoneFunction = function(fn) {
  this.startZoneFn = fn;
  return this;
};

TouchTrigger.prototype.startListening = function() {
  this.elem.addEventListener('touchstart', this.touchStartListener);
  this.elem.addEventListener('touchend', this.touchEndListener);
  this.elem.addEventListener('touchcancel', this.touchEndListener);
  this.listening = true;
  return this;
};

TouchTrigger.prototype.stopListening = function() {
  this.elem.removeEventListener('touchstart', this.touchStartListener);
  this.elem.removeEventListener('touchend', this.touchEndListener);
  this.elem.removeEventListener('touchcancel', this.touchEndListener);
  this.release();
  this.listening = false;
  return this;
};

TouchTrigger.prototype.release = function() {
  this.touchId = null;
  this.val = false;
};

TouchTrigger.prototype.onTouchStart = function(e) {
  if (this.touchId !== null) return;
  e = e || window.event;
  var touches = e.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    var touch = touches[i];
    if (this.startZoneFn(touch.pageX, touch.pageY)) {
      // Start tracking this one.
      this.touchId = touch.identifier;
      this.val = true;
      this.publishTriggerDown(e);

      // For LayeredEventDistributor
      return false;
    }
  }
};

TouchTrigger.prototype.onTouchEnd = function(e) {
  if (this.touchId === null) return;
  e = e || window.event;
  var touches = e.changedTouches;
  for (var i = 0; i < touches.length; i++) {
    var touch = touches[i];
    if (touch.identifier == this.touchId) {
      this.touchId = null;
      this.val = false;
      this.publishTriggerUp(e);

      // Never claim to have handled a touchEnd, because touch events contain multiple
      // touches, and if a trigger touch and a world touch end at the same time, then
      // the LayeredEventDistributor will refuse to tell the world touch about the end.
      return true;
    }
  }
};
