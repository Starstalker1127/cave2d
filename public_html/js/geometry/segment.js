/**
 * A line segment.
 * @param {Vec2d} p1
 * @param {Vec2d} p2
 * @constructor
 */
function Segment(p1, p2) {
  this.p1 = p1;
  this.p2 = p2;
  this.lengthSquared = -1;
}

/**
 * @param {Vec2d} p1
 * @param {Vec2d} p2
 * @returns {Segment}
 */
Segment.prototype.setP1P2 = function(p1, p2) {
  this.p1.set(p1);
  this.p2.set(p2);
  this.lengthSquared = -1;
  return this;
};

/**
 * @param {Vec2d} p3
 * @returns {number}
 */
Segment.prototype.distanceToPointSquared = function(p3) {
  var lsq = this.getLengthSquared();
  if (lsq == 0) return this.p1.distanceSquared(p3);
  var x1 = this.p1.x;
  var y1 = this.p1.y;
  var x2 = this.p2.x;
  var y2 = this.p2.y;

  // u is 0 at p1 and 1 at p2.
  // Find the value of u where p3 is closest to the segment
  var u = ((p3.x - x1)*(x2 - x1) + (p3.y - y1)*(y2 - y1)) / lsq;
  var retval;
  if (u < 0) {
    retval = p3.distanceSquared(this.p1);
  } else if (u > 1) {
    retval = p3.distanceSquared(this.p2);
  } else {
    var p = Vec2d.alloc();
    p.set(this.p2).subtract(this.p1).scale(u).add(this.p1);
    retval = p3.distanceSquared(p);
    p.free();
  }
  return retval;
};

/**
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
Segment.prototype.distanceToPointSquaredXY = function(x, y) {
  var v = Vec2d.alloc(x, y);
  var dist = this.distanceToPointSquared(v);
  v.free();
  return dist;
};

/**
 * @param {Rect} rectOut
 * @return {Rect} rectOut
 */
Segment.prototype.getBoundingRect = function(rectOut) {
  if (!rectOut) rectOut = new Rect();
  return rectOut.setToCorners(this.p1, this.p2);
};

/**
 * @returns {number}
 */
Segment.prototype.getLengthSquared = function() {
  if (this.lengthSquared < 0) {
    this.lengthSquared = this.p1.distanceSquared(this.p2);
  }
  return this.lengthSquared;
};