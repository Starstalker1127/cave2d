/**
 * The renderer owns the shaders and the sparks.
 * It has read-access to the world's bodies.
 * @param canvas
 * @param gl
 * @param program
 * @constructor
 */
function Renderer(canvas, gl, program) {
  this.canvas = canvas;
  this.gl = gl;
  this.program = program;

  this.viewScale = [1, 1, 1];
  this.viewTranslation = [0, 0, 0];
  this.zoom = 1/13;
  this.array3 = [0, 0, 0];
  this.circlePosBuffs = [];
  this.circleColorBuffs = [];

  this.initAttributesAndUniforms();
  this.initModelVertexes();
}

var ZERO_3 = [0, 0, 0];
var IDENTITY_3 = [1, 1, 1];
var PLAYER_COLOR_3 = [1.0, 0.3, 0.5];
var BULLET_COLOR_3 = [1, 0.6, 0.2];
var GNOME_COLOR_3 = [0.0, 0.9, 0.2];
var GOLD_COLOR_3 = [1, 1, 0];
var BRICK_COLOR_3 = [0, 0, 0.6];
var GENERATOR_COLOR_3 = [0.3, 0.6, 0.3];
var EXIT_COLOR_3 = [1.0, 0.0, 1.0];
var OTHER_COLOR_3 = [0.5, 0.5, 0.5];

Renderer.CIRCLE_CORNERS = 13;

Renderer.prototype.initAttributesAndUniforms = function() {
  var gl = this.gl;
  var program = this.program;
  var self = this;

  // Attributes
  function attribute(name) {
    self[name] = gl.getAttribLocation(program, name);
  }
  attribute('aVertexPosition');
  gl.enableVertexAttribArray(this.aVertexPosition);
  attribute('aVertexColor');
  gl.enableVertexAttribArray(this.aVertexColor);

  // Uniforms
  function uniform(name) {
    self[name] = gl.getUniformLocation(program, name);
  }
  uniform('uViewTranslation');
  uniform('uViewScale');
  uniform('uModelTranslation');
  uniform('uModelScale');
  uniform('uModelColor');
  uniform('uType');
  uniform('uTime');
};

Renderer.prototype.initModelVertexes = function() {
  // template for rectangles
  var triBuilder = new TriangleBufferBuilder(this.gl);
  triBuilder.addRect(
      Vec2d.ZERO, -1, // {x, y} z
      new Vec2d(1, 1), // rx ry
      1, 1, 1, 1); // r g b a
  this.rectPosBuff = triBuilder.createPositionBuff();
  this.rectColorBuff = triBuilder.createColorBuff();

  // template for circles
  var fanBuilder = new FanBufferBuilder(this.gl);
  fanBuilder.addCircle(
      Vec2d.ZERO, -1, // {x, y} z
      1, // radius
      Renderer.CIRCLE_CORNERS,
      1, 1, 1, 1); // r g b a
  this.circlePosBuffs[Renderer.CIRCLE_CORNERS] = fanBuilder.createPositionBuff();
  this.circleColorBuffs[Renderer.CIRCLE_CORNERS] = fanBuilder.createColorBuff();
};

Renderer.prototype.maybeResize = function() {
  if (this.canvas.width != this.canvas.clientWidth ||
      this.canvas.height != this.canvas.clientHeight) {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
};

Renderer.prototype.drawScene = function(world, cameraPos, zoomFactor) {
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

  // Center the view on the player.
  this.viewTranslation[0] = -cameraPos.x;
  this.viewTranslation[1] = -cameraPos.y;
  this.viewTranslation[2] = 0;
  this.gl.uniform3fv(this.uViewTranslation, this.viewTranslation);

  // Scale the view to using the average of the two edge lengths,
  // to avoid extreme zooming for narrow/tall canvases.
  var avgLength = (this.canvas.width + this.canvas.height) / 2;
  this.viewScale[0] = this.zoom * avgLength * zoomFactor/ this.canvas.width;
  this.viewScale[1] = this.zoom * avgLength * zoomFactor/ this.canvas.height;
  this.viewScale[2] = 1;
  this.gl.uniform3fv(this.uViewScale, this.viewScale);

  this.drawBackground();

  // foreground
  for (var id in world.bodies) {
    var b = world.bodies[id];
    if (b && !(world.spirits[b.spiritId] instanceof WallSpirit)) {
      this.drawBody(world, b);
    }
  }
};

Renderer.prototype.drawBackground = function() {
  // Draw the whole background.
  // All the vertex data is already in the program, in bgColorBuff and bgPosBuff.
  // Since the map is already in world-coordinates and world-colors,
  // set all the model-to-world uniforms to do nothing.
  this.gl.uniform3fv(this.uModelScale, IDENTITY_3);
  this.gl.uniform3fv(this.uModelTranslation, ZERO_3);
  this.gl.uniform3fv(this.uModelColor, IDENTITY_3);
  this.gl.uniform1i(this.uType, 0);
  this.drawTriangles(this.bgPosBuff, this.bgColorBuff, this.bgTriangleCount);
};

Renderer.prototype.drawBody = function(world, b) {
  var bodyPos = Vec2d.alloc();
  b.getPosAtTime(world.now, bodyPos);
  this.array3[0] = bodyPos.x;
  this.array3[1] = bodyPos.y;
  this.array3[2] = 0;
  this.gl.uniform3fv(this.uModelTranslation, this.array3);

  var spirit = world.spirits[b.spiritId];
  if (spirit instanceof GnomeSpirit) {
    this.gl.uniform3fv(this.uModelColor, GNOME_COLOR_3);
  } else if (spirit instanceof GeneratorSpirit) {
    this.gl.uniform3fv(this.uModelColor, GENERATOR_COLOR_3);
  } else if (spirit instanceof BrickSpirit) {
    this.gl.uniform3fv(this.uModelColor, BRICK_COLOR_3);
  } else if (spirit instanceof GoldSpirit) {
    this.gl.uniform3fv(this.uModelColor, GOLD_COLOR_3);
  } else if (spirit instanceof BulletSpirit) {
    this.gl.uniform3fv(this.uModelColor, BULLET_COLOR_3);
  } else if (spirit instanceof PlayerSpirit) {
    this.gl.uniform3fv(this.uModelColor, PLAYER_COLOR_3);
  } else if (spirit instanceof ExitSpirit) {
    this.gl.uniform3fv(this.uModelColor, EXIT_COLOR_3);
  } else {
    this.gl.uniform3fv(this.uModelColor, OTHER_COLOR_3);
  }

  if (b.shape === Body.Shape.RECT) {
    this.array3[0] = b.rectRad.x;
    this.array3[1] = b.rectRad.y;
    this.array3[2] = 1;
    this.gl.uniform3fv(this.uModelScale, this.array3);

    // gl, aVertexPosition, aVertexColor, positionBuff, colorBuff, triangleCount
    this.drawTriangles(this.rectPosBuff, this.rectColorBuff, 2);

  } else if (b.shape === Body.Shape.CIRCLE) {
    this.array3[0] = b.rad;
    this.array3[1] = b.rad;
    this.array3[2] = 1;
    this.gl.uniform3fv(this.uModelScale, this.array3);

    this.drawTriangleFan(
        this.circlePosBuffs[Renderer.CIRCLE_CORNERS],
        this.circleColorBuffs[Renderer.CIRCLE_CORNERS],
        Renderer.CIRCLE_CORNERS);
  }
  bodyPos.free();
};

Renderer.prototype.setBackgroundTriangleVertexes = function(positionBuff, colorBuff, triangleCount) {
  this.bgPosBuff = positionBuff;
  this.bgColorBuff = colorBuff;
  this.bgTriangleCount = triangleCount;
};

/**
 * @param {!WebGLBuffer} positionBuff  buffer with three numbers per vertex: x, y, z.
 * @param {!WebGLBuffer} colorBuff  buffer with four numbers per vertex: r, g, b, a.
 * @param {!number} triangleCount
 */
Renderer.prototype.drawTriangles = function(positionBuff, colorBuff, triangleCount) {
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuff);
  this.gl.vertexAttribPointer(this.aVertexPosition, 3, this.gl.FLOAT, false, 0, 0);

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuff);
  this.gl.vertexAttribPointer(this.aVertexColor, 4, this.gl.FLOAT, false, 0, 0);

  this.gl.drawArrays(this.gl.TRIANGLES, 0, triangleCount * 3);
};

/**
 * @param {!WebGLBuffer} positionBuff  buffer with three numbers per vertex: x, y, z.
 * @param {!WebGLBuffer} colorBuff  buffer with four numbers per vertex: r, g, b, a.
 * @param {!number} cornerCount
 */
Renderer.prototype.drawTriangleFan = function(positionBuff, colorBuff, cornerCount) {
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuff);
  this.gl.vertexAttribPointer(this.aVertexPosition, 3, this.gl.FLOAT, false, 0, 0);

  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuff);
  this.gl.vertexAttribPointer(this.aVertexColor, 4, this.gl.FLOAT, false, 0, 0);

  this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, cornerCount + 2);
};