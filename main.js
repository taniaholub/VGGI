"use strict";

let gl;
let surface;
let shProgram;
let spaceball;
let texDiffuse, texSpecular, texNormal;

// Параметри перетворення текстурних координат (РГР)
let texPointU = 0.5;        // точка масштабування в (u,v), нормована до [0;1]
let texPointV = 0.5;
let texScale = 1.0;         // коефіцієнт масштабування
const POINT_STEP = 0.02;    // крок руху точки за одне натискання

// Маркер джерела світла і точки масштабування
const LIGHT_R = 6.0;
const LIGHT_H = 3.0;
let markerProg, markerLoc = {}, markerPointBuf, markerCircleBuf;
const CIRCLE_SEGMENTS = 128;

function initMarker() {
  const vs = `
    attribute vec3 vertex;
    uniform mat4 MVP;
    uniform float pointSize;
    uniform float zBias;
    void main() {
      gl_Position = MVP * vec4(vertex, 1.0);
      gl_Position.z -= zBias * gl_Position.w;   // трохи ближче до камери
      gl_PointSize = pointSize;
    }`;
  const fs = `
    precision mediump float;
    uniform vec4 markerColor;
    uniform float isPoint;
    void main() {
      if (isPoint > 0.5) {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
      }
      gl_FragColor = markerColor;
    }`;
  markerProg = createProgram(gl, vs, fs);
  markerLoc.vertex = gl.getAttribLocation(markerProg, "vertex");
  markerLoc.MVP = gl.getUniformLocation(markerProg, "MVP");
  markerLoc.pointSize = gl.getUniformLocation(markerProg, "pointSize");
  markerLoc.zBias = gl.getUniformLocation(markerProg, "zBias");
  markerLoc.color = gl.getUniformLocation(markerProg, "markerColor");
  markerLoc.isPoint = gl.getUniformLocation(markerProg, "isPoint");

  const circle = [];
  for (let k = 0; k < CIRCLE_SEGMENTS; k++) {
    const a = (2 * Math.PI * k) / CIRCLE_SEGMENTS;
    circle.push(LIGHT_R * Math.cos(a), LIGHT_R * Math.sin(a), LIGHT_H);
  }
  markerCircleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, markerCircleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circle), gl.STATIC_DRAW);

  markerPointBuf = gl.createBuffer();
}

// Малює одну точку в координатах моделі
function drawMarkerPoint(pos, color, size, zBias) {
  gl.bindBuffer(gl.ARRAY_BUFFER, markerPointBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos.slice(0, 3)), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(markerLoc.vertex, 3, gl.FLOAT, false, 0, 0);
  gl.uniform4fv(markerLoc.color, color);
  gl.uniform1f(markerLoc.isPoint, 1.0);
  gl.uniform1f(markerLoc.pointSize, size);
  gl.uniform1f(markerLoc.zBias, zBias);
  gl.drawArrays(gl.POINTS, 0, 1);
}

function drawMarker(mvp, lightModel, texPointModel) {
  gl.useProgram(markerProg);
  gl.uniformMatrix4fv(markerLoc.MVP, false, mvp);
  gl.enableVertexAttribArray(markerLoc.vertex);

  // Траєкторія світла
  gl.bindBuffer(gl.ARRAY_BUFFER, markerCircleBuf);
  gl.vertexAttribPointer(markerLoc.vertex, 3, gl.FLOAT, false, 0, 0);
  gl.uniform4fv(markerLoc.color, [0.6, 0.6, 0.6, 1.0]);
  gl.uniform1f(markerLoc.isPoint, 0.0);
  gl.uniform1f(markerLoc.pointSize, 1.0);
  gl.uniform1f(markerLoc.zBias, 0.0);
  gl.drawArrays(gl.LINE_LOOP, 0, CIRCLE_SEGMENTS);

  // Джерело світла (жовта точка)
  drawMarkerPoint(lightModel, [1.0, 0.95, 0.3, 1.0], 16.0, 0.0);

  // Точка масштабування текстури (червона), з невеликим зсувом до камери,
  // щоб її не перекривала сама поверхня
  drawMarkerPoint(texPointModel, [1.0, 0.1, 0.1, 1.0], 12.0, 0.003);

  shProgram.Use();
}

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  this.iAttribVertex = -1;
  this.iAttribNormal = -1;
  this.iAttribTangent = -1;
  this.iAttribTexCoord = -1;
  this.iModelViewProjectionMatrix = -1;
  this.iModelViewMatrix = -1;
  this.iNormalMatrix = -1;
  this.iLightPos = -1;
  this.iTexPoint = -1;
  this.iTexScale = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

function mulMat4Vec4(m, v) {
  const r = [0, 0, 0, 0];
  for (let row = 0; row < 4; row++) {
    r[row] = m[row] * v[0] + m[4 + row] * v[1] + m[8 + row] * v[2] + m[12 + row] * v[3];
  }
  return r;
}

function normalMatrixFrom(m) {
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
}

function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = gl.canvas.width / gl.canvas.height;
  let projection = m4.perspective(Math.PI / 5, aspect, 1, 50);
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrixFrom(matAccum1));

  // Параметри масштабування текстури
  gl.uniform2f(shProgram.iTexPoint, texPointU, texPointV);
  gl.uniform1f(shProgram.iTexScale, texScale);

  const t = performance.now() * 0.001;
  const lightModel = [LIGHT_R * Math.cos(t), LIGHT_R * Math.sin(t), LIGHT_H, 1.0];
  const lightEye = mulMat4Vec4(matAccum1, lightModel);
  gl.uniform3fv(shProgram.iLightPos, lightEye.slice(0, 3));

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texDiffuse);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texSpecular);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texNormal);

  surface.Draw();

  const texPointModel = surface.PointAt(texPointU, texPointV);
  drawMarker(modelViewProjection, lightModel, texPointModel);
}

function animate() {
  draw();
  requestAnimationFrame(animate);
}

function updateSurface() {
  const nU = parseInt(document.getElementById("sliderU").value);
  const nV = parseInt(document.getElementById("sliderV").value);
  document.getElementById("valU").textContent = nU;
  document.getElementById("valV").textContent = nV;
  surface.BufferData(nU, nV);
}

function updateScale() {
  texScale = parseFloat(document.getElementById("sliderScale").value);
  document.getElementById("valScale").textContent = texScale.toFixed(2);
}

function updatePointLabel() {
  document.getElementById("valPoint").textContent =
    texPointU.toFixed(2) + ", " + texPointV.toFixed(2);
}

// Керування точкою масштабування з клавіатури: A/D по u, W/S по v
// (e.code не залежить від розкладки, тож працює і з українською)
function onKeyDown(e) {
  switch (e.code) {
    case "KeyA": texPointU -= POINT_STEP; break;
    case "KeyD": texPointU += POINT_STEP; break;
    case "KeyW": texPointV += POINT_STEP; break;
    case "KeyS": texPointV -= POINT_STEP; break;
    default: return;
  }
  texPointU = Math.min(1, Math.max(0, texPointU));
  texPointV = Math.min(1, Math.max(0, texPointV));
  updatePointLabel();
}

function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Textured", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
  shProgram.iAttribTangent = gl.getAttribLocation(prog, "tangent");
  shProgram.iAttribTexCoord = gl.getAttribLocation(prog, "texCoord");
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
  shProgram.iLightPos = gl.getUniformLocation(prog, "lightPos");
  shProgram.iTexPoint = gl.getUniformLocation(prog, "texPoint");
  shProgram.iTexScale = gl.getUniformLocation(prog, "texScale");

  gl.uniform1i(gl.getUniformLocation(prog, "diffuseMap"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "specularMap"), 1);
  gl.uniform1i(gl.getUniformLocation(prog, "normalMap"), 2);

  texDiffuse  = loadTexture("./textures/diffuse.jpg",  [255, 255, 255, 255]);
  texSpecular = loadTexture("./textures/specular.jpg", [255, 255, 255, 255]);
  texNormal   = loadTexture("./textures/normal.jpg",   [128, 128, 255, 255]);

  surface = new Model("Surface");
  updateSurface();

  initMarker();
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

function resizeCanvas() {
  const c = document.getElementById("webglcanvas");
  const w = Math.max(400, window.innerWidth - 20);
  const h = Math.max(400, window.innerHeight - 240);
  c.width = w;
  c.height = h;
  if (gl) gl.viewport(0, 0, w, h);
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

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  spaceball = new TrackballRotator(canvas, draw, 0);

  document.getElementById("sliderU").addEventListener("input", updateSurface);
  document.getElementById("sliderV").addEventListener("input", updateSurface);
  document.getElementById("sliderScale").addEventListener("input", updateScale);
  window.addEventListener("keydown", onKeyDown);
  updateScale();
  updatePointLabel();

  animate();
}