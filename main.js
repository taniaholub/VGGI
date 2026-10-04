"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = null;
  this.iIndexBuffer = null;
  this.count = 0;

  this.BufferData = function () {
    const vertices = [];
    const indices = [];

    // Кількість розбиттів сітки
    const numU = 60;
    const numV = 60;

    // Константа та межі параметрів u і v (Варіант 3: Sievert's Surface)
    const C = 2.0;
    const uMin = -0.49 * Math.PI;
    const uMax = 0.49 * Math.PI;
    const vMin = 0.02 * Math.PI;
    const vMax = 0.98 * Math.PI;

    // 1. Обчислюємо 2D-матрицю точок поверхні S(u, v)
    const grid = [];
    for (let i = 0; i <= numU; i++) {
      const u = uMin + (i / numU) * (uMax - uMin);
      const row = [];

      const sqrtC = Math.sqrt(C);
      const sqrtC1 = Math.sqrt(C + 1);
      const phi = -u / sqrtC1 + Math.atan(sqrtC1 * Math.tan(u));

      for (let j = 0; j <= numV; j++) {
        const v = vMin + (j / numV) * (vMax - vMin);

        const sinV = Math.sin(v);
        const cosV = Math.cos(v);
        const sinU = Math.sin(u);
        const cosU = Math.cos(u);

        const denom = C + 1 - C * (sinV * sinV) * (cosU * cosU);
        const a = 2.0 / denom;
        const r =
          (a / sqrtC) * Math.sqrt((C + 1) * (1 + C * sinU * sinU)) * sinV;

        const x = r * Math.cos(phi);
        const y = r * Math.sin(phi);
        const z = (Math.log(Math.tan(v / 2.0)) + a * (C + 1.0) * cosV) / sqrtC;

        row.push([x, y, z]);
      }
      grid.push(row);
    }

    // 2. Формуємо вершини та індекси для U-кривих та V-кривих
    let indexCounter = 0;

    // (А) Набір U-ізоліній (фіксуємо v, рухаємося по u)
    for (let j = 0; j <= numV; j++) {
      for (let i = 0; i <= numU; i++) {
        vertices.push(...grid[i][j]);
        if (i > 0) {
          indices.push(indexCounter - 1, indexCounter);
        }
        indexCounter++;
      }
    }

    // (Б) Набір V-ізоліній (фіксуємо u, рухаємося по v)
    for (let i = 0; i <= numU; i++) {
      for (let j = 0; j <= numV; j++) {
        vertices.push(...grid[i][j]);
        if (j > 0) {
          indices.push(indexCounter - 1, indexCounter);
        }
        indexCounter++;
      }
    }

    this.count = indices.length;

    // Створення та заповнення буферів у контексті WebGL
    this.iVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    this.iIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    );
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.drawElements(gl.LINES, this.count, gl.UNSIGNED_SHORT, 0);
  };
}

// Constructor
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  this.iAttribVertex = -1;
  this.iColor = -1;
  this.iModelViewProjectionMatrix = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws the scene */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 5, 1, 1, 50);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    modelViewProjection,
  );

  /* Колір сітки поверхні (жовтий) */
  gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);

  // ОСЬ ТУТ МАЛЮЄТЬСЯ ПОВЕРХНЯ (у функції draw)
  surface.Draw();
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Basic", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(
    prog,
    "ModelViewProjectionMatrix",
  );
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  // Ініціалізація моделі поверхні
  surface = new Model("Surface");
  surface.BufferData();

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

/**
 * initialization function that will be called when the page has loaded
 */
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
    initGL(); // initialize the WebGL graphics context
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " +
      e +
      "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  // Отрисовка кадру
  draw();
}
