function Model() {
  this.iBuffer = gl.createBuffer();   // індекси
  this.vBuffer = gl.createBuffer();   // вершини
  this.nBuffer = gl.createBuffer();   // нормалі
  this.tBuffer = gl.createBuffer();   // тангенси (нове)
  this.tcBuffer = gl.createBuffer();  // текстурні координати (нове)
  this.count = 0;

  const C = 2.0;
  const uMin = -0.49 * Math.PI;
  const uMax =  0.49 * Math.PI;
  const vMin =  0.02 * Math.PI;
  const vMax =  0.98 * Math.PI;

  function surfacePoint(u, v) {
    const sqrtC = Math.sqrt(C);
    const sqrtC1 = Math.sqrt(C + 1);
    const phi = -u / sqrtC1 + Math.atan(sqrtC1 * Math.tan(u));

    const sinV = Math.sin(v), cosV = Math.cos(v);
    const sinU = Math.sin(u), cosU = Math.cos(u);

    const denom = C + 1 - C * sinV * sinV * cosU * cosU;
    const a = 2.0 / denom;
    const r = (a / sqrtC) * Math.sqrt((C + 1) * (1 + C * sinU * sinU)) * sinV;

    return [
      r * Math.cos(phi),
      r * Math.sin(phi),
      (Math.log(Math.tan(v / 2.0)) + a * (C + 1.0) * cosV) / sqrtC,
    ];
  }

  // Тангенс = dS/du, чисельна похідна центральною різницею (нове)
  function surfaceTangent(u, v) {
    const h = 1e-4;
    const p1 = surfacePoint(u + h, v);
    const p0 = surfacePoint(u - h, v);
    const t = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const l = Math.hypot(t[0], t[1], t[2]) || 1;
    return [t[0] / l, t[1] / l, t[2] / l];
  }

  // Нормалі, зважені за кутом (без змін з PA2)
  function angleWeightedNormals(pos, ind) {
    const n = new Array(pos.length).fill(0);
    const P = (i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const len = (a) => Math.hypot(a[0], a[1], a[2]);

    for (let t = 0; t < ind.length; t += 3) {
      const tri = [ind[t], ind[t + 1], ind[t + 2]];
      const p = tri.map(P);
      const fn = cross(sub(p[1], p[0]), sub(p[2], p[0]));
      const fl = len(fn);
      if (fl < 1e-12) continue;
      const fnn = [fn[0] / fl, fn[1] / fl, fn[2] / fl];
      for (let k = 0; k < 3; k++) {
        const e1 = sub(p[(k + 1) % 3], p[k]);
        const e2 = sub(p[(k + 2) % 3], p[k]);
        const l = len(e1) * len(e2);
        if (l < 1e-12) continue;
        const angle = Math.acos(Math.min(1, Math.max(-1, dot(e1, e2) / l)));
        for (let c = 0; c < 3; c++) n[3 * tri[k] + c] += fnn[c] * angle;
      }
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
    return n;
  }

  this.BufferData = function (numU, numV) {
    const vertices = [];
    const tangents = [];   // нове
    const texCoords = [];  // нове
    const indices = [];

    for (let i = 0; i <= numU; i++) {
      const u = uMin + (i / numU) * (uMax - uMin);
      for (let j = 0; j <= numV; j++) {
        const v = vMin + (j / numV) * (vMax - vMin);
        vertices.push(...surfacePoint(u, v));
        tangents.push(...surfaceTangent(u, v));
        texCoords.push(i / numU, j / numV);   // текстура розтягується на всю поверхню
      }
    }

    const idx = (i, j) => i * (numV + 1) + j;
    for (let i = 0; i < numU; i++) {
      for (let j = 0; j < numV; j++) {
        indices.push(idx(i, j), idx(i + 1, j), idx(i, j + 1));
        indices.push(idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
      }
    }

    const normals = angleWeightedNormals(vertices, indices);
    this.count = indices.length;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tcBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer);
    gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribNormal);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTangent);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tcBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuffer);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  };
}