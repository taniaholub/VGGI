function Model() {
  this.iBuffer = gl.createBuffer();
  this.vBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function () {
    const vertices = [];
    const indices = [];

    // Кількість розбиттів сітки
    const numU = 60;
    const numV = 60;

    // Константа та межі параметрів u і v
    const C = 2.0;
    // Берємо трохи менше ніж (-pi/2, pi/2) та (0, pi), щоб уникнути ділення на 0 та ln(0)
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

    // Завантаження даних у WebGL-буфери
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    );
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuffer);
    gl.drawElements(gl.LINES, this.count, gl.UNSIGNED_SHORT, 0);
  };
}
