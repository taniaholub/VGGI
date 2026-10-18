"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// Constructor
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  this.iAttribVertex = -1;
  this.iAttribNormal = -1;
  this.iColor = -1;
  this.iModelViewProjectionMatrix = -1;
  this.iModelViewMatrix = -1;
  this.iNormalMatrix = -1;
  this.iLightPos = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

// mat4 (column-major) * vec4
function mulMat4Vec4(m, v) {
  const r = [0, 0, 0, 0];
  for (let row = 0; row < 4; row++) {
    r[row] =
      m[row] * v[0] + m[4 + row] * v[1] + m[8 + row] * v[2] + m[12 + row] * v[3];
  }
  return r;
}

// Верхня 3x3 частина ModelView (в ній лише обертання + зсув, без масштабу,
// тому вона збігається з матрицею нормалей)
function normalMatrixFrom(m) {
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
}

/* Draws the scene */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  let projection = m4.perspective(Math.PI / 5, 1, 1, 50);
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrixFrom(matAccum1));

  // Джерело світла обертається по колу навколо поверхні (в системі координат моделі),
  // потім множиться на ModelView перед передачею в шейдер
  const t = performance.now() * 0.001;
  const R = 6.0;
  const lightModel = [R * Math.cos(t), R * Math.sin(t), 3.0, 1.0];
  const lightEye = mulMat4Vec4(matAccum1, lightModel);
  gl.uniform3fv(shProgram.iLightPos, lightEye.slice(0, 3));

  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

  surface.Draw();
}

// Постійна анімація (обертання світла)
function animate() {
  draw();
  requestAnimationFrame(animate);
}

// Перебудова поверхні за значеннями слайдерів
function updateSurface() {
  const nU = parseInt(document.getElementById("sliderU").value);
  const nV = parseInt(document.getElementById("sliderV").value);
  document.getElementById("valU").textContent = nU;
  document.getElementById("valV").textContent = nV;
  surface.BufferData(nU, nV);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Phong", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
  shProgram.iLightPos = gl.getUniformLocation(prog, "lightPos");
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  surface = new Model("Surface");
  updateSurface();

  gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL();
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  document.getElementById("sliderU").addEventListener("input", updateSurface);
  document.getElementById("sliderV").addEventListener("input", updateSurface);

  animate();
}