/**
 * The renderer has the viewport state,
 * manages uniforms and attributes,
 * and can draw a ModelStamp.
 * @param canvas
 * @param gl
 * @param program
 * @constructor
 */
function Renderer(canvas, gl, program) {
  this.canvas = canvas;
  this.gl = gl;
  this.program = program;
  this.initAttributesAndUniforms();
}

Renderer.prototype.initAttributesAndUniforms = function() {
  var self = this;

  // Attributes
  function attribute(name) {
    self[name] = self.gl.getAttribLocation(self.program, name);
  }
  attribute('aVertexPosition');
  this.gl.enableVertexAttribArray(this.aVertexPosition);
  attribute('aVertexColor');
  this.gl.enableVertexAttribArray(this.aVertexColor);

  // Uniforms
  function uniform(name) {
    self[name] = self.gl.getUniformLocation(self.program, name);
  }
  uniform('uViewMatrix');
  uniform('uModelMatrix');
  uniform('uModelColor');
};

/**
 * @return {Renderer}
 */
Renderer.prototype.resize = function() {
  if (this.canvas.width != this.canvas.clientWidth ||
      this.canvas.height != this.canvas.clientHeight) {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  return this;
};

/**
 * @return {Renderer}
 */
Renderer.prototype.clear = function() {
  this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  return this;
};

/**
 * @param {Matrix44} viewMatrix
 * @return {Renderer}
 */
Renderer.prototype.setViewMatrix = function(viewMatrix) {
  this.gl.uniformMatrix4fv(this.uViewMatrix, this.gl.FALSE, viewMatrix.m);
  return this;
};

/**
 * Sets the shader's model matrix uniform.
 * @param {Matrix44} modelMatrix
 * @return {Renderer}
 */
Renderer.prototype.setModelMatrix = function(modelMatrix) {
  this.gl.uniformMatrix4fv(this.uModelMatrix, this.gl.FALSE, modelMatrix.m);
  return this;
};

/**
 * Sets the shader's color vector uniform.
 * @param {Vec4} colorVector
 * @return {Renderer}
 */
Renderer.prototype.setColorVector = function(colorVector) {
  this.gl.uniform4fv(this.uModelColor, colorVector.v);
  return this;
};

/**
 * Prepares for stamp() calls.
 * @param {ModelStamp} stamp
 * @return {Renderer}
 */
Renderer.prototype.setStamp = function(stamp) {
  if (this.modelStamp !== stamp) {
    this.modelStamp = stamp;
    stamp.prepareToDraw(this.gl, this.aVertexPosition, this.aVertexColor);
  }
  return this;
};

/**
 * Draws the ModelStamp set by setStamp(), with the current
 * modelMatrix, colorVector, and view uniforms.
 * @return {Renderer}
 */
Renderer.prototype.drawStamp = function() {
  this.modelStamp.draw(this.gl);
  return this;
};