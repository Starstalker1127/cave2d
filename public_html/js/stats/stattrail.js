/**
 * A circular buffer of pairs of (value, time)
 * @param {Number} length
 * @constructor
 */
function StatTrail(length) {
  // interleaved pairs of time, value, time, value, etc.
  this.pairs = new CircularQueue(length * 2);
}

StatTrail.prototype.sample = function(now, value) {
  this.enqueueTimeAndValue(now, value);
};

StatTrail.prototype.enqueueTimeAndValue = function(time, value) {
  this.pairs.enqueue(time);
  this.pairs.enqueue(value);
};

StatTrail.prototype.size = function() {
  return this.pairs.size() / 2;
};

StatTrail.prototype.getHeadIndex = function() {
  return this.pairs.head;
};

StatTrail.prototype.getVal = function(i) {
  let index = i * 2;
  return index >= this.pairs.size() ? 0 : this.pairs.getFromHead(index);
};

StatTrail.prototype.getTime = function(i) {
  return this.pairs.getFromHead(i * 2 + 1);
};

/**
 * @returns {CircularQueue}
 */
StatTrail.prototype.getAllPairs = function() {
  return this.pairs;
};