/**
 * @param minDistFraction
 * @param maxDistFraction
 * @param viewDist
 * @constructor
 */
function Camera(minDistFraction, maxDistFraction, viewDist) {
  this.cameraPos = new Vec2d();
  this.minDistFraction = minDistFraction;
  this.maxDistFraction = maxDistFraction;
  this.viewDist = viewDist;
  this.followFraction = 0.12;
}

Camera.prototype.follow = function(followPos) {
  var cameraDist = followPos.distance(this.cameraPos);
  var minCameraDist = this.viewDist * this.minDistFraction;
  var maxCameraDist = this.viewDist * this.maxDistFraction;

  // Move towards min dist
  if (cameraDist > minCameraDist) {
    var temp = Vec2d.alloc();
    temp.set(followPos)
        .subtract(this.cameraPos)
        .scaleToLength((cameraDist-minCameraDist) * this.followFraction)
        .add(this.cameraPos);
    this.cameraPos.set(temp);
    cameraDist = followPos.distance(this.cameraPos);

    // Clip to max dist
    if (cameraDist > maxCameraDist) {
      temp.set(followPos)
          .subtract(this.cameraPos)
          .scaleToLength(cameraDist - maxCameraDist)
          .add(this.cameraPos);
      this.cameraPos.set(temp);
    }
    temp.free();
  }
};

Camera.prototype.add = function(vec) {
  this.cameraPos.add(vec);
};

Camera.prototype.set = function(vec) {
  this.cameraPos.set(vec);
};

Camera.prototype.setXY = function(x, y) {
  this.cameraPos.setXY(x, y);
};

Camera.prototype.getX = function() {
  return this.cameraPos.x;
};

Camera.prototype.getY = function() {
  return this.cameraPos.y;
};

Camera.prototype.getViewDist = function() {
  return this.viewDist;
};

Camera.prototype.setViewDist = function(d) {
  this.viewDist = d;
  return this;
};

