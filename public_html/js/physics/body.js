/**
 * This has all the information about a physical body that the collision detector needs,
 * and enough of an API for a Spirit to manipulate a body.
 *
 * @constructor
 */
function Body() {
  this.pathStartPos = Vec2d.alloc();
  this.vel = Vec2d.alloc();
  this.reset();
}

Poolify(Body);

Body.Shape = {
  CIRCLE: 1,
  RECT: 2
};

Body.prototype.reset = function() {
  this.id = 0;
  this.spiritId = 0;
  this.pathId = 0;

  // The time at which the body was at pathStartPos
  this.pathStartTime = 0;
  this.pathStartPos.reset();
  this.vel.reset();

  // The pathStartTime is guaranteed to get updated in this amount of time,
  // so do not add events for this path beyond pathStartTime + pathDurationMax.
  // Most spirits will accelerate their bodies at a fixed frequency, so this value
  // will not usually change during a body's lifetime unless its spirit changes.
  this.pathDurationMax = Infinity;

  // The World's map of Body objects that need to have their paths validated.
  this.invalidBodies = null;

  this.shape = Body.Shape.CIRCLE;
  // circle radius, for circles
  this.rad = 1;
  // half-width, for rects
  this.radX = 1;
  // half-height, for rects
  this.radY = 1;

  // This controls which other bodies and rayscans should be tested for collisions.
  this.hitgroup = 0;

  // data for the basic "bounce" collision response
  this.mass = 1;
  this.elasticity = 1;
};

/**
 * @param {number} t
 * @param {Vec2d} out
 * @returns {Vec2d}
 */
Body.prototype.getPosAtTime = function(t, out) {
  return out.set(this.vel).scale(t - this.pathStartTime).add(this.pathStartPos);
};

/**
 * @param {number} t
 * @param {Rect} out
 * @returns {Rect}
 */
Body.prototype.getBoundingRectAtTime = function(t, out) {
  this.getPosAtTime(t, out.pos);
  if (this.shape == Body.Shape.CIRCLE) {
    out.setRadXY(this.rad, this.rad);
  } else if (this.shape == Body.Shape.RECT) {
    out.setRadXY(this.radX, this.radY);
  }
  return out;
};

Body.prototype.invalidatePath = function() {
  this.pathId = 0;
  if (this.invalidBodies && this.id) {
    this.invalidBodies[id] = this;
  }
};

/**
 * Shifts the path so it intersects the new position at the new time,
 * without changing the velocity. Teleportation, basically.
 * @param pos
 * @param t
 */
Body.prototype.setPosAtTime = function(pos, t) {
  this.invalidatePath();
  this.pathStartTime = t;
  this.pathStartPos.set(pos);
};

/**
 * Shifts the path so that it intersects the same position at time t that it used to,
 * but it arrives with a new velocity (and therefore is coming from and going to new places.)
 * @param vel
 * @param t
 */
Body.prototype.setVelAtTime = function(vel, t) {
  this.invalidatePath();
  this.moveToTime(t);
  this.vel.set(vel);
};

/**
 * Without invalidating the path, this sets the pathStartTime to t, and adjusts the pathStartPos.
 * @param {number} t
 */
Body.prototype.moveToTime = function(t) {
  if (this.pathStartTime === t) return;
  var temp = this.getPosAtTime(Vec2d.alloc());
  this.pathStartPos.set(temp);
  this.pathStartTime = t;
  Vec2d.free(temp);
};

Body.prototype.getPathEndTime = function() {
  return this.pathStartTime + this.pathDurationMax;
};
