(function () {
  "use strict";

  const canvas = document.getElementById("glcanvas");
  const fallback = document.getElementById("fallback");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  if (!gl) {
    fallback.hidden = false;
    canvas.hidden = true;
    return;
  }

  const VS_SOURCE = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uMVP;
    varying vec3 vColor;
    void main() {
      gl_Position = uMVP * vec4(aPosition, 1.0);
      vColor = aColor;
    }
  `;

  const FS_SOURCE = `
    precision mediump float;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VS_SOURCE));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS_SOURCE));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // 6 faces x 2 triangles x 3 vertices, with per-vertex color
  const vertices = new Float32Array([
    // position        // color
    // front (red)
    -1, -1, 1,   0.9, 0.3, 0.3,    1, -1, 1,   0.9, 0.3, 0.3,    1, 1, 1,   0.9, 0.3, 0.3,
    -1, -1, 1,   0.9, 0.3, 0.3,    1, 1, 1,   0.9, 0.3, 0.3,   -1, 1, 1,   0.9, 0.3, 0.3,
    // back (green)
     1, -1, -1,   0.3, 0.8, 0.4,   -1, -1, -1,   0.3, 0.8, 0.4,  -1, 1, -1,   0.3, 0.8, 0.4,
     1, -1, -1,   0.3, 0.8, 0.4,   -1, 1, -1,   0.3, 0.8, 0.4,   1, 1, -1,   0.3, 0.8, 0.4,
    // top (blue)
    -1, 1, 1,   0.3, 0.5, 0.95,    1, 1, 1,   0.3, 0.5, 0.95,    1, 1, -1,   0.3, 0.5, 0.95,
    -1, 1, 1,   0.3, 0.5, 0.95,    1, 1, -1,   0.3, 0.5, 0.95,  -1, 1, -1,   0.3, 0.5, 0.95,
    // bottom (yellow)
    -1, -1, -1,   0.95, 0.85, 0.3,  1, -1, -1,   0.95, 0.85, 0.3,  1, -1, 1,   0.95, 0.85, 0.3,
    -1, -1, -1,   0.95, 0.85, 0.3,  1, -1, 1,   0.95, 0.85, 0.3, -1, -1, 1,   0.95, 0.85, 0.3,
    // right (magenta)
     1, -1, 1,   0.8, 0.4, 0.85,    1, -1, -1,   0.8, 0.4, 0.85,   1, 1, -1,   0.8, 0.4, 0.85,
     1, -1, 1,   0.8, 0.4, 0.85,    1, 1, -1,   0.8, 0.4, 0.85,   1, 1, 1,   0.8, 0.4, 0.85,
    // left (cyan)
    -1, -1, -1,   0.3, 0.8, 0.8,   -1, -1, 1,   0.3, 0.8, 0.8,   -1, 1, 1,   0.3, 0.8, 0.8,
    -1, -1, -1,   0.3, 0.8, 0.8,   -1, 1, 1,   0.3, 0.8, 0.8,   -1, 1, -1,   0.3, 0.8, 0.8,
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const stride = 6 * 4;
  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aColor = gl.getAttribLocation(program, "aColor");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 3 * 4);

  const uMVP = gl.getUniformLocation(program, "uMVP");

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.05, 0.07, 0.1, 1.0);

  // --- matrix helpers (column-major, WebGL style) ---
  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  function translate(z) {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    m[14] = z;
    return m;
  }

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        out[col * 4 + row] = sum;
      }
    }
    return out;
  }

  function rotationX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
  }

  function rotationY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  }

  // --- interaction state ---
  let rotX = -0.5;
  let rotY = 0.6;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.01;
    rotX += (e.clientY - lastY) * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });

  const spinToggle = document.getElementById("spin");
  const speedInput = document.getElementById("speed");

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (spinToggle.checked && !dragging) {
      const speed = Number(speedInput.value) / 60;
      rotY += dt * 0.9 * speed;
      rotX += dt * 0.4 * speed;
    }

    resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;
    let mvp = perspective(Math.PI / 4, aspect, 0.1, 100);
    mvp = multiply(mvp, translate(-5));
    mvp = multiply(mvp, rotationX(rotX));
    mvp = multiply(mvp, rotationY(rotY));

    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.drawArrays(gl.TRIANGLES, 0, 36);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
