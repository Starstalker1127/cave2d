/**
 * A control trigger that combines other trigger inputs into one.
 * @constructor
 * @extends {Trigger}
 */
function MultiTrigger() {
  Trigger.call(this);
  this.triggers = [];
  this.oldVal = false;

  var self = this;
  this.downListener = function() {
    if (!self.oldVal && self.getVal()) {
      self.publishTriggerDown();
      self.oldVal = true;
    }
  };
  this.upListener = function() {
    if (self.oldVal && !self.getVal()) {
      self.publishTriggerUp();
      self.oldVal = false;
    }
  };
}
MultiTrigger.prototype = new Trigger();
MultiTrigger.prototype.constructor = MultiTrigger;

MultiTrigger.prototype.addTrigger = function(t) {
  this.triggers.push(t);
  t.addTriggerDownListener(this.downListener);
  t.addTriggerUpListener(this.upListener);
  return this;
};

MultiTrigger.prototype.startListening = function() {
  for (var i = 0; i < this.triggers.length; i++) {
    this.triggers[i].startListening();
  }
};

MultiTrigger.prototype.stopListening = function() {
  for (var i = 0; i < this.triggers.length; i++) {
    this.triggers[i].stopListening();
  }
};

MultiTrigger.prototype.getVal = function() {
  for (var i = 0; i < this.triggers.length; i++) {
    if (this.triggers[i].getVal()) return true;
  }
  return false;
};

MultiTrigger.prototype.addTriggerDownListener = function(fn) {
  this.downPubSub.subscribe(fn);
};

MultiTrigger.prototype.removeTriggerDownListener = function(fn) {
  this.downPubSub.unsubscribe(fn);
};


MultiTrigger.prototype.addTriggerUpListener = function(fn) {
  this.upPubSub.subscribe(fn);
};
MultiTrigger.prototype.removeTriggerUpListener = function(fn) {
  this.upPubSub.unsubscribe(fn);
};


MultiTrigger.prototype.publishTriggerDown = function() {
  this.downPubSub.publish();
};

MultiTrigger.prototype.publishTriggerUp = function() {
  this.upPubSub.publish();
};
