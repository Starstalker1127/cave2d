/**
 * A visible on-screen trigger that can handle touch, mouse buttons, and keyboard keys.
 * @constructor
 */
function TriggerWidget(elem) {
  this.elem = elem;

  this.modelMatrix = new Matrix44();
  this.mat44 = new Matrix44();

  this.trigger = new MultiTrigger();
  this.touchTrigger = null;
  this.mousePointerTrigger = null;
  this.stamp = null;

  this.pressedColorVec4 = new Vec4().setXYZ(0.8, 0.8, 0.8);
  this.releasedColorVec4 = new Vec4().setXYZ(0.5, 0.5, 0.5);

  this.canvasPos = new Vec2d(0, 0);
  this.canvasScale = new Vec2d(1, 1);

  this.keyboardTipModelMatrix = new Matrix44();
  this.keyboardTipOffset = new Vec2d(0, 0);
  this.keyboardTipScale = new Vec2d(1, 1);
  this.keyboardTipStamp = null;
  this.keyboardTipColorVec4 = new Vec4().setRGBA(0.5, 0.5, 0.5, 0.5);

  // Time at which the keyboard tip will stop being rendered
  this.keyboardTipUntilTimeMs = -Infinity;

  this.updateModelMatrix();
}

TriggerWidget.prototype.addTriggerKeyByName = function(keyName) {
  this.trigger.addTrigger((new KeyTrigger()).addTriggerKeyByName(keyName));
  return this;
};

TriggerWidget.prototype.listenToMouseButton = function() {
  this.trigger.addTrigger(new MouseButtonTrigger(this.elem));
  return this;
};

TriggerWidget.prototype.listenToTouch = function() {
  if (!this.touchTrigger) {
    this.touchTrigger = new TouchTrigger(this.elem).startListening();
    this.trigger.addTrigger(this.touchTrigger);
    this.updateStartZone();
  }
  return this;
};

TriggerWidget.prototype.listenToMousePointer = function() {
  if (!this.mousePointerTrigger) {
    this.mousePointerTrigger = new MousePointerTrigger(this.elem).startListening();
    this.trigger.addTrigger(this.mousePointerTrigger);
    this.updateStartZone();
  }
  return this;
};

TriggerWidget.prototype.setStamp = function(stamp) {
  this.stamp = stamp;
  return this;
};

TriggerWidget.prototype.setKeyboardTipStamp = function(stamp) {
  this.keyboardTipStamp = stamp;
  return this;
};

TriggerWidget.prototype.setPressedColorVec4 = function(vec4) {
  this.pressedColorVec4.set(vec4);
  return this;
};

TriggerWidget.prototype.setReleasedColorVec4 = function(vec4) {
  this.releasedColorVec4.set(vec4);
  return this;
};

TriggerWidget.prototype.setCanvasPositionXY = function(x, y) {
  this.canvasPos.setXY(x, y);
  this.updateStartZone();
  this.updateModelMatrix();
  return this;
};

TriggerWidget.prototype.setCanvasScaleXY = function(x, y) {
  this.canvasScale.setXY(x, y);
  this.updateStartZone();
  this.updateModelMatrix();
  return this;
};

TriggerWidget.prototype.setKeyboardTipOffsetXY = function(x, y) {
  this.keyboardTipOffset.setXY(x, y);
  this.updateModelMatrix();
  return this;
};

TriggerWidget.prototype.setKeyboardTipScaleXY = function(x, y) {
  this.keyboardTipScale.setXY(x, y);
  this.updateModelMatrix();
  return this;
};

TriggerWidget.prototype.setKeyboardTipColorVec4 = function(vec4) {
  this.keyboardTipColorVec4.set(vec4);
  return this;
};

/**
 * Sets the absolute time, in ms, at which the keyboard tip will stop being rendered.
 * @param {Number} timeMs
 */
TriggerWidget.prototype.setKeyboardTipTimeoutMs = function(timeMs) {
  this.keyboardTipUntilTimeMs = timeMs;
  return this;
};

TriggerWidget.prototype.startListening = function() {
  this.trigger.startListening();
  return this;
};

TriggerWidget.prototype.stopListening = function() {
  this.trigger.stopListening();
  return this;
};

TriggerWidget.prototype.getVal = function() {
  return this.trigger.getVal();
};

TriggerWidget.prototype.addTriggerDownListener = function(fn) {
  this.trigger.addTriggerDownListener(fn);
  return this;
};

TriggerWidget.prototype.removeTriggerDownListener = function(fn) {
  this.trigger.removeTriggerDownListener(fn);
  return this;
};

TriggerWidget.prototype.addTriggerUpListener = function(fn) {
  this.trigger.addTriggerUpListener(fn);
  return this;
};

TriggerWidget.prototype.removeTriggerUpListener = function(fn) {
  this.trigger.removeTriggerUpListener(fn);
  return this;
};

TriggerWidget.prototype.draw = function(renderer) {
  if (this.stamp) {
    renderer
        .setColorVector(this.getVal() ? this.pressedColorVec4 : this.releasedColorVec4)
        .setStamp(this.stamp)
        .setModelMatrix(this.modelMatrix)
        .drawStamp();
  }
  if (this.keyboardTipStamp && Date.now() < this.keyboardTipUntilTimeMs) {
    renderer
        .setColorVector(this.keyboardTipColorVec4)
        .setStamp(this.keyboardTipStamp)
        .setModelMatrix(this.keyboardTipModelMatrix)
        .drawStamp();
  }
  return this;
};

TriggerWidget.prototype.isMouseHovered = function() {
  return this.mousePointerTrigger && this.mousePointerTrigger.hovered;
};

TriggerWidget.prototype.updateStartZone = function() {
  var self = this;
  if (this.touchTrigger) {
    this.touchTrigger.setStartZoneFunction(function (x, y) {
      return Math.abs(x - self.canvasPos.x) <= Math.abs(self.canvasScale.x) &&
          Math.abs(y - self.canvasPos.y) <= Math.abs(self.canvasScale.y);
    });
  }
  if (this.mousePointerTrigger) {
    this.mousePointerTrigger.setStartZoneFunction(function (x, y) {
      return Math.abs(x - self.canvasPos.x) <= Math.abs(self.canvasScale.x) &&
          Math.abs(y - self.canvasPos.y) <= Math.abs(self.canvasScale.y);
    });
  }
  return this;
};

TriggerWidget.prototype.updateModelMatrix = function() {
  this.modelMatrix.toTranslateOpXYZ(this.canvasPos.x, this.canvasPos.y, -0.99)
      .multiply(this.mat44.toScaleOpXYZ(this.canvasScale.x, this.canvasScale.y, 1));
  this.keyboardTipModelMatrix.toTranslateOpXYZ(
      this.canvasPos.x + this.keyboardTipOffset.x,
      this.canvasPos.y + this.keyboardTipOffset.y,
      -0.99)
      .multiply(this.mat44.toScaleOpXYZ(this.keyboardTipScale.x, this.keyboardTipScale.y, 0.01));
  return this;
};
