var canvas, renderer;

var vec4 = new Vec4();
var mat4 = new Matrix44();
var viewMatrix = new Matrix44();

var modelMatrix = new Matrix44();
var modelColor = new Vec4();

var glyphs, printer, stamps = {};
var startMatrix = new Matrix44()
    .multiply(mat4.toTranslateOp(vec4.setXYZ(-2.6, -2, -2)))
    .multiply(mat4.toScaleOp(vec4.setXYZ(0.2, 0.2, 0.2)))
    .multiply(mat4.toRotateZOp(Math.PI / 5))
    .multiply(mat4.toRotateXOp(0.1));
var nextCharMatrix = new Matrix44()
    .multiply(mat4.toTranslateOp(vec4.setXYZ(3.1, 0, 0)));
var ZOOM = 4;

function main() {
  canvas = document.querySelector('#canvas');
  new RendererLoader(canvas, 'vertex-shader.txt', 'fragment-shader.txt').load(onRendererLoaded);
}

function onRendererLoaded(r) {
  renderer = r;
  initStamps();
  loop();
}

function initStamps() {
  glyphs = new Glyphs(new GlyphMaker(0.7, 5));
  glyphs.initStamps(renderer.gl);
  printer = new Printer(renderer, glyphs.stamps);

  var model = RigidModel.createOctahedron()
      .createQuadrupleTriangleModel()
      .createQuadrupleTriangleModel()
      .sphereize(vec4.setXYZ(0, 0, 0), 0.8);
  for (var i = 0; i < model.vertexes.length; i++) {
    var v = model.vertexes[i];
    var r = Math.random();
    v.setColorRGB(r * 0.1 + 0.7, r * 0.1 + 0.7, r * 0.1 + 0.7);
    v.position.scaleToLength(0.4 + Math.random() * 0.8);
    console.log(v.color);
  }
  stamps.asteroid = model.createModelStamp(renderer.gl);

  model = RigidModel.createCube().sphereize(vec4.setXYZ(0, 0, 0), 0.7);
  stamps.cube = model.createModelStamp(renderer.gl);
}

function loop() {
  drawScene();
  requestAnimationFrame(loop, canvas);
}

function drawScene() {
  renderer.resize().clear();
  var t = Date.now();

  // set view matrix
  var edge = Math.min(canvas.width, canvas.height);
  vec4.setXYZ(edge / (ZOOM * canvas.width), edge / (ZOOM * canvas.height), 0.3);
  viewMatrix.toScaleOp(vec4);
  viewMatrix.multiply(mat4.toRotateXOp(Math.sin(t / 720) * 0.1));
  viewMatrix.multiply(mat4.toRotateYOp(Math.sin(t / 650) * 0.1));

  // print text
  renderer.setViewMatrix(viewMatrix);
  renderer.setColorVector(modelColor.setXYZ(Math.random(), Math.random()*0.4 + 0.5, Math.random()*0.2 + 0.8));
  printer.printLine(startMatrix, nextCharMatrix, "CAVE2D.COM!!");

  // draw yellow city
  var size = 1.0;
  renderer
      .setStamp(stamps.cube)
      .setColorVector(modelColor.setXYZ(1, 1, 0.5));
  for (var y = -2; y <= 2; y++) {
    for (var x = -2; x <= 2; x++) {
      modelMatrix.toIdentity();

      mat4.toTranslateOp(vec4.setXYZ(x, y, 0));
      modelMatrix.multiply(mat4);

      mat4.toScaleOp(vec4.setXYZ(size, size, size));
      modelMatrix.multiply(mat4);

      mat4.toScaleOp(vec4.setXYZ(1, 1, Math.sin((x+3) * (y-3) * t/9000)*4 + 1));
      modelMatrix.multiply(mat4);

      renderer.setModelMatrix(modelMatrix);
      renderer.drawStamp();
    }
  }

  // draw asteroids
  var size = 0.3;
  renderer
      .setStamp(stamps.asteroid)
      .setColorVector(modelColor.setXYZ(0, 0.8, 1));
  for (var y = -7; y <= 7; y++) {
    for (var x = -7; x <= 7; x++) {
      modelMatrix.toIdentity();

      mat4.toTranslateOp(vec4.setXYZ(
              x + Math.sin(y/2 + t / 2000),
              y + Math.cos(x/2 + t / 2000),
              -1.5));
      modelMatrix.multiply(mat4);

      modelMatrix.multiply(mat4.toRotateZOp(Math.sin((x - y)) * t / 900));
      modelMatrix.multiply(mat4.toScaleOp(vec4.setXYZ(size, size, size)));

      renderer.setModelMatrix(modelMatrix);
      renderer.drawStamp();
    }
  }
}
