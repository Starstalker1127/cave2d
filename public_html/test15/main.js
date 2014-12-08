// WebGL fundamentals
var canvas, vertexShader, fragmentShader, program, gl;

// physics and behavior
var world, resolver;
var playerSpirit, raySpirit;

// map generation
var OBJ_COUNT = 64;
var RECT_CHANCE = 0.7;
var SPACING = 50;

// locations of cached GL program data:
// uniforms
var uViewTranslation, uViewScale, uModelScale, uModelTranslation, uModelColor, uPlayerPos;
// attributes
var aVertexColor, aVertexPosition;
// data buffers
var bgPosBuff, bgColorBuff, bgTriangleCount;
var rectPosBuff, rectColorBuff;

// frame rendering timing
var CLOCKS_PER_SECOND = 60 * 0.3;
var prevFrameStartMs;
var frameStartMs;

// world-to-view transformation
var ZOOM = 1/100;
var viewTranslation = [0, 0, 0];
var viewScale = [1/ZOOM, 1/ZOOM, 0];

// scene-drawing values
var playerPos = new Vec2d();
var array3 = [0, 0, 0];
var bodyPos = new Vec2d();
var ZERO_3 = [0, 0, 0];
var IDENTITY_3 = [1, 1, 1];
var PLAYER_COLOR_3 = [1, 0.5, 0.5];
var RAY_SPIRIT_COLOR_3 = [0.2, 0.7, 0.8];
var BULLET_COLOR_3 = [1, 0.5, 0.1];
var OTHER_COLOR_3 = [0.5, 1, 0.5];


function main() {
  canvas = document.querySelector('#canvas');

  gl = getWebGlContext(canvas, {
    alpha: false,
    antialias: true
  });

  loadText('vertex-shader.txt', function(text) {
    vertexShader = compileShader(gl, text, gl.VERTEX_SHADER);
    maybeCreateProgram();
  });

  loadText('fragment-shader.txt', function(text) {
    fragmentShader = compileShader(gl, text, gl.FRAGMENT_SHADER);
    maybeCreateProgram();
  });
}

function loadText(path, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  xhr.responseType = 'text';
  xhr.onload = function() {
    callback(this.response);
  };
  xhr.send();
}

function maybeCreateProgram() {
  if (!vertexShader || !fragmentShader) return;

  program = createProgram(gl, vertexShader, fragmentShader);
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(program);

  onProgramCreated();
}

function onProgramCreated() {
  // Cache all the shader uniforms.
  uViewTranslation = gl.getUniformLocation(program, 'uViewTranslation');
  uViewScale = gl.getUniformLocation(program, 'uViewScale');
  uModelTranslation = gl.getUniformLocation(program, 'uModelTranslation');
  uModelScale = gl.getUniformLocation(program, 'uModelScale');
  uModelColor = gl.getUniformLocation(program, 'uModelColor');
  uPlayerPos = gl.getUniformLocation(program, 'uPlayerPos');

  // Cache and enable the vertex color and position attributes.
  aVertexColor = gl.getAttribLocation(program, 'aVertexColor');
  gl.enableVertexAttribArray(aVertexColor);
  aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
  gl.enableVertexAttribArray(aVertexPosition);

  initWorld();
  loop();
}

function loop() {
  maybeResize(canvas, gl);
  if (!prevFrameStartMs) {
    prevFrameStartMs = Date.now() - 1000/60;
  } else {
    prevFrameStartMs = frameStartMs;
  }
  frameStartMs = Date.now();
  drawScene();
  clock();
  requestAnimationFrame(loop, canvas);
}

function maybeResize(canvas, gl) {
  if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

function clock() {
  var frameLength = frameStartMs - prevFrameStartMs;
  if (frameLength > 1000/30) {
    // Don't go below 30fps
    frameLength = 1000/30;
  }
  var endTimeMs = frameStartMs + frameLength;
  var secondsElapsed = frameLength / 1000;
  var endClock = world.now + CLOCKS_PER_SECOND * secondsElapsed;
  var e = world.getNextEvent();
  // Stop if there are no more events to process, or we've moved the game clock far enough ahead
  // to match the amount of wall-time elapsed since the last frame,
  // or (worst case) we're out of time for this frame.
  while (e && e.time <= endClock && Date.now() <= endTimeMs) {
    if (e.type == WorldEvent.TYPE_HIT) {
      var b0 = world.getBodyByPathId(e.pathId0);
      var b1 = world.getBodyByPathId(e.pathId1);
      if (b0 && b1) {
        resolver.resolveHit(e.time, e.collisionVec, b0, b1);
        var s0 = world.spirits[b0.spiritId];
        if (s0) s0.onHit(world, b0, b1, e);
        var s1 = world.spirits[b1.spiritId];
        if (s1) s1.onHit(world, b1, b0, e);
      }
    }
    world.processNextEvent();
    e = world.getNextEvent();
  }
  if (!e || e.time > endClock) {
    world.now = endClock;
  }
}

function readPlayerPos() {
  world.bodies[playerSpirit.bodyId].getPosAtTime(world.now, playerPos);
}

function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Center the view on the player.
  readPlayerPos();
  viewTranslation[0] = -playerPos.x;
  viewTranslation[1] = -playerPos.y;
  gl.uniform3fv(uViewTranslation, viewTranslation);

  // Remember the player's position, for tweaking the colors.
  array3[0] = playerPos.x;
  array3[1] = playerPos.y;
  array3[2] = 0;
  gl.uniform3fv(uPlayerPos, array3);

  // Scale the view to encompass a fixed-size square around the player's position.
  var edgeLength = Math.min(canvas.width, canvas.height);
  viewScale[0] = ZOOM * edgeLength / canvas.width;
  viewScale[1] = ZOOM * edgeLength / canvas.height;
  gl.uniform3fv(uViewScale, viewScale);
  gl.uniform3fv(uPlayerPos, [playerPos.x, playerPos.y, 0]);

  // Draw the whole background.
  // All the vertex data is already in the program, in bgColorBuff and bgPosBuff.
  // Since the map is already in world-coordinates and world-colors,
  // set all the model-to-world uniforms to do nothing.
  gl.uniform3fv(uModelScale, IDENTITY_3);
  gl.uniform3fv(uModelTranslation, ZERO_3);
  gl.uniform3fv(uModelColor, IDENTITY_3);
  drawTriangles(gl, bgColorBuff, bgPosBuff, bgTriangleCount);

  // foreground
  for (var id in world.bodies) {
    var b = world.bodies[id];
    if (b && b.mass != Infinity) {
      drawBody(b);
    }
  }
}

function drawBody(b) {
  b.getPosAtTime(world.now, bodyPos);

  if (b.id == playerSpirit.bodyId) {
    gl.uniform3fv(uModelColor, PLAYER_COLOR_3);
  } else if (b.id == raySpirit.bodyId) {
    gl.uniform3fv(uModelColor, RAY_SPIRIT_COLOR_3);
  } else if (world.spirits[world.bodies[b.id].spiritId] instanceof BulletSpirit) {
    gl.uniform3fv(uModelColor, BULLET_COLOR_3);
  } else {
    gl.uniform3fv(uModelColor, OTHER_COLOR_3);
  }

  array3[0] = b.rad;
  array3[1] = b.rad;
  array3[2] = 1;
  gl.uniform3fv(uModelScale, array3);

  array3[0] = bodyPos.x;
  array3[1] = bodyPos.y;
  array3[2] = 0;
  gl.uniform3fv(uModelTranslation, array3);

  drawTriangles(gl, rectColorBuff, rectPosBuff, 2);
}


function drawTriangles(gl, colorBuff, positionBuff, triangleCount) {
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuff);
  gl.vertexAttribPointer(aVertexColor, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuff);
  gl.vertexAttribPointer(aVertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, triangleCount * 3);
}

function createStaticGlBuff(values) {
  var buff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
  return buff;
}

function initWorld() {
  world = new World();
  resolver = new HitResolver();

  initMapAndBackgroundVertexes();
  initModelVertexes();

  initPlayer();
  initRaySpirit();
}

/**
 * Adds wall bodies and TestSpirit bodies to the world,
 * and sends the wall rect vertexes to the GL program,
 * caching the buffer locations in bgPosBuff and bgColorBuff.
 */
function initMapAndBackgroundVertexes() {
  var bgVerts = [];
  var bgColors = [];
  bgTriangleCount = 0;
  var red, green, blue;
  var v = new Vec2d();
  var sqrt = Math.sqrt(OBJ_COUNT);
  for (var x = -sqrt/2; x < sqrt/2; x++) {
    for (var y = -sqrt/2; y < sqrt/2; y++) {
      var b = Body.alloc();
      v.setXY(x * SPACING + Math.random(), y * SPACING + Math.random());
      b.setPosAtTime(v, 1);
      if (Math.random() < RECT_CHANCE) {
        // Stationary wall
        b.shape = Body.Shape.RECT;
        b.rectRad.setXY(
                (0.3 + Math.random()) * SPACING * 0.3,
                (0.3 + Math.random()) * SPACING * 0.3);
        b.mass = Infinity;
        b.pathDurationMax = Infinity;
        world.addBody(b);

        // Cache background vertex info
        red = Math.random() / 3;
        green = Math.random() / 3;
        blue = 1 - Math.random() / 3;
        addRect(bgVerts, bgColors, v.x, v.y, 0, b.rectRad.x, b.rectRad.y, red, green, blue);
        bgTriangleCount += 2;

      } else {
        // TestSpirit sprite.
        // (It's silly to create these during map-initialization, but oh well.)
        v.setXY(Math.random() - 0.5, Math.random() - 0.5);
        b.setVelAtTime(v, 1);
        b.shape = Body.Shape.CIRCLE;
        b.rad = 2 + Math.random() * 3;
        b.mass = Math.PI * b.rad * b.rad;
        b.pathDurationMax = TestSpirit.TIMEOUT;// * 2;
        var bodyId = world.addBody(b);

        var spirit = new TestSpirit();
        var spiritId = world.addSpirit(spirit);
        spirit.bodyId = bodyId;
        b.spiritId = spiritId;
        world.addTimeout(TestSpirit.TIMEOUT, spiritId, null);
      }
    }
  }

  // Send the arrays to the GL program, and cache the locations of those buffers for later.
  bgPosBuff = createStaticGlBuff(bgVerts);
  bgColorBuff = createStaticGlBuff(bgColors);
}

function initModelVertexes() {
  // template for individually-drawn rectangles
  var rectVerts = [];
  var vertColors = [];
  addRect(rectVerts, vertColors,
      0, 0, -1, // x y z
      1, 1, // rx ry
      1, 1, 1); // r g b
  rectPosBuff = createStaticGlBuff(rectVerts);
  rectColorBuff = createStaticGlBuff(vertColors);

  // TODO: circles and other models
}

function addRect(verts, colors, px, py, pz, rx, ry, r, g, b) {
  // Two triangles form a square.
  verts.push(
          px-rx, py-ry, pz,
          px-rx, py+ry, pz,
          px+rx, py+ry, pz,

          px+rx, py+ry, pz,
          px+rx, py-ry, pz,
          px-rx, py-ry, pz);
  for (var i = 0; i < 6; i++) {
    colors.push(r, g, b, 1);
  }
}

function initPlayer() {
  var v = new Vec2d();
  var b = Body.alloc();
  v.setXY(-Math.sqrt(OBJ_COUNT)/2 * SPACING - 50, 0);
  b.setPosAtTime(v, 1);
  b.shape = Body.Shape.CIRCLE;
  b.rad = 3.5;
  b.mass = Math.PI * b.rad * b.rad;
  b.pathDurationMax = PlayerSpirit.TIMEOUT;
  var bodyId = world.addBody(b);
  var spirit = new PlayerSpirit();
  var spiritId = world.addSpirit(spirit);
  spirit.bodyId = bodyId;
  playerSpirit = spirit;
  b.spiritId = spiritId;
  world.addTimeout(PlayerSpirit.TIMEOUT, spiritId, null);

  var aimStick = (new MultiStick())
      .addStick((new KeyStick())
          .setUpRightDownLeftByName(Key.Name.UP, Key.Name.RIGHT, Key.Name.DOWN, Key.Name.LEFT)
          .startListening())
      .addStick((new KeyStick())
          .setUpRightDownLeftByName('i', 'l', 'k', 'j')
          .startListening())
      .addStick((new TouchStick())
          .setStartZoneFunction(function(x, y) {
            return x > canvas.width / 2;
          })
          .setRadius(10)
          .startListening())
      .addStick((new PointerLockStick())
          .setRadius(20)
          .setCanvas(canvas)
          .startListening());

  var moveStick = (new MultiStick())
      .addStick((new KeyStick())
          .setUpRightDownLeftByName('w', 'd', 's', 'a')
          .startListening())
      .addStick((new TouchStick())
          .setStartZoneFunction(function(x, y) {
            return x <= canvas.width / 2;
          })
          .setRadius(20)
          .startListening());

  playerSpirit.setAimStick(aimStick);
  playerSpirit.setMoveStick(moveStick);
}

function initRaySpirit() {
  var v = new Vec2d();
  var b = Body.alloc();
  v.setXY(Math.sqrt(OBJ_COUNT)/2 * SPACING + 50, 0);
  b.setPosAtTime(v, 1);
  b.shape = Body.Shape.CIRCLE;
  b.rad = 7;
  b.mass = Math.PI * b.rad * b.rad;
  b.pathDurationMax = RaySpirit.TIMEOUT;
  var bodyId = world.addBody(b);
  var spirit = new RaySpirit();
  var spiritId = world.addSpirit(spirit);
  spirit.bodyId = bodyId;
  raySpirit = spirit;
  b.spiritId = spiritId;
  world.addTimeout(RaySpirit.TIMEOUT, spiritId, null);
}
