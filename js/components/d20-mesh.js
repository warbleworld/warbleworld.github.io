// ─────────────────────────────────────────────────────────
// WebGL renderer for a real 3D d20 (icosahedron).
//
// Dependency-free: hand-rolled minimal mat4/quaternion helpers, a
// flat-shaded gold material lit by one directional light, and engraved
// numbers baked into a canvas texture atlas (one cell per face).
//
// Public API (see createD20Renderer):
//   start()  — begin the render loop
//   stop()   — pause the render loop
//   reset()  — return the die to a neutral resting pose
//   roll(result, onSettle) — tumble, then settle so `result`'s face
//                            turns toward the camera; calls onSettle()
//   resize() — match the drawing buffer to the canvas' CSS size
//   dispose()
// ─────────────────────────────────────────────────────────

/** Displayed number on each of the 20 faces (a permutation of 1-20). */
const FACE_NUMBERS = [
  20, 8, 14, 2, 16, 7, 19, 5, 13, 1,
  11, 9, 17, 3, 15, 12, 6, 18, 4, 10,
];

const CAMERA_DISTANCE = 3.4;

/** Circumradius of the die in world units (also the collision radius).
    Smaller than 1 so the die looks compact and has room to bounce. */
const DIE_SCALE = 0.46;

// Roll physics (world units, seconds).
const BOUNCE_MS = 1300;   // free tumble + wall bouncing
const RETURN_MS = 520;    // ease back to the centre to present the result
const GRAVITY = 5.2;      // downward pull
const RESTITUTION = 0.78; // energy kept per wall bounce
const AIR_DRAG = 0.012;   // velocity bled off per frame

// ── tiny vec3 helpers ───────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ── quaternion helpers (x, y, z, w) ─────────────────────
function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function qAxisAngle(axis, angle) {
  const a = norm3(axis);
  const s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}
/** Shortest-arc quaternion rotating unit vector `from` onto unit `to`. */
function qFromTo(from, to) {
  const f = norm3(from);
  const t = norm3(to);
  const d = dot3(f, t);
  if (d > 0.99999) return [0, 0, 0, 1];
  if (d < -0.99999) {
    // Antiparallel: rotate 180° about any perpendicular axis.
    let axis = cross([1, 0, 0], f);
    if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-4) axis = cross([0, 1, 0], f);
    return qAxisAngle(axis, Math.PI);
  }
  return qAxisAngle(cross(f, t), Math.acos(Math.max(-1, Math.min(1, d))));
}
/** Column-major 4x4 rotation matrix from a quaternion. */
function qToMat4(q) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

// ── 4x4 matrix helpers (column-major) ───────────────────
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ];
}
function mat4Mul(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
/** mat3 (column-major) extracted from a 4x4 rotation matrix. */
function mat3FromMat4(m) {
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
}

// ── Icosahedron geometry (flat-shaded, per-face UV cell) ──
function buildGeometry() {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(norm3);
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  // Cell-local triangle (apex, bottom-left, bottom-right) the number
  // is centred within. Cols x rows = 5 x 4 cover all 20 faces.
  const localTri = [[0.5, 0.16], [0.14, 0.84], [0.86, 0.84]];
  const positions = [];
  const normals = [];
  const uvs = [];
  const faceNormals = [];

  faces.forEach((face, i) => {
    let [ia, ib, ic] = face;
    let a = v[ia], b = v[ib], c = v[ic];
    let n = norm3(cross(sub(b, a), sub(c, a)));
    const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot3(n, centroid) < 0) {
      [b, c] = [c, b]; // keep winding CCW when viewed from outside
      n = norm3(cross(sub(b, a), sub(c, a)));
    }
    faceNormals[i] = n;

    const col = i % 5;
    const row = Math.floor(i / 5);
    const tri = [a, b, c];
    tri.forEach((p, k) => {
      positions.push(p[0] * DIE_SCALE, p[1] * DIE_SCALE, p[2] * DIE_SCALE);
      normals.push(n[0], n[1], n[2]);
      const [lx, ly] = localTri[k];
      // FLIP_Y is enabled on the texture, so v counts up from the bottom.
      uvs.push((col + lx) / 5, 1 - (row + ly) / 4);
    });
  });

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    faceNormals,
    count: faces.length * 3,
  };
}

/** Bake the face numbers into a texture atlas (one cell per face). */
function buildAtlasCanvas() {
  const cell = 256;
  const canvas = document.createElement("canvas");
  canvas.width = cell * 5;
  canvas.height = cell * 4;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  FACE_NUMBERS.forEach((num, i) => {
    // Centre on the face triangle's centroid so the digits sit
    // comfortably within the equilateral face with margin on all sides.
    const cx = (i % 5) * cell + cell * 0.5;
    const cy = Math.floor(i / 5) * cell + cell * 0.62;
    ctx.font = "700 64px 'Cinzel', serif";
    ctx.fillText(String(num), cx, cy);
    // Underline 6 and 9 so they can't be confused.
    if (num === 6 || num === 9) {
      ctx.fillRect(cx - 23, cy + 35, 46, 7);
    }
  });

  return canvas;
}

// ── GL program ──────────────────────────────────────────
const VERT_SRC = `
  attribute vec3 aPos;
  attribute vec3 aNormal;
  attribute vec2 aUV;
  uniform mat4 uProj;
  uniform mat4 uView;
  uniform mat4 uModel;
  uniform mat3 uNormalMat;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUV;
  void main() {
    vec4 world = uModel * vec4(aPos, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(uNormalMat * aNormal);
    vUV = aUV;
    gl_Position = uProj * uView * world;
  }
`;

const FRAG_SRC = `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUV;
  uniform vec3 uLightDir;
  uniform vec3 uCamPos;
  uniform vec3 uColor;
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCamPos - vWorld);
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 28.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 base = uColor * (0.32 + 0.78 * diff) + vec3(1.0, 0.93, 0.7) * spec * 0.6;
    base += uColor * rim * 0.25;

    // Engraved numbers: the glyph mask is treated as a groove cut into
    // the metal. Sampling the mask gradient gives the groove walls a lit
    // edge (toward the light) and a shadowed edge (away from it), so the
    // digits read as carved rather than printed.
    vec2 off = uTexel * 2.0;
    float ink   = texture2D(uTex, vUV).a;
    float inkUp = texture2D(uTex, vUV + vec2(-off.x,  off.y)).a; // toward light
    float inkDn = texture2D(uTex, vUV + vec2( off.x, -off.y)).a; // away from light
    float lit    = max(inkUp - ink, 0.0);
    float shadow = max(inkDn - ink, 0.0);

    vec3 color = base;
    color *= 1.0 - ink * 0.62;                 // darken the carved interior
    color += vec3(1.0, 0.95, 0.78) * lit * 0.9; // bright groove wall
    color -= base * shadow * 0.9;               // shadowed groove wall
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
  }
  return sh;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Create a WebGL d20 renderer bound to `canvas`.
 * Returns null if WebGL is unavailable.
 * @param {HTMLCanvasElement} canvas
 */
export function createD20Renderer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) return null;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "program link failed");
  }
  gl.useProgram(program);

  const geo = buildGeometry();

  const makeBuffer = (data, attrib, size) => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, attrib);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  makeBuffer(geo.positions, "aPos", 3);
  makeBuffer(geo.normals, "aNormal", 3);
  makeBuffer(geo.uvs, "aUV", 2);

  // Number atlas texture.
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlasCanvas());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uni = (name) => gl.getUniformLocation(program, name);
  const uProj = uni("uProj");
  const uView = uni("uView");
  const uModel = uni("uModel");
  const uNormalMat = uni("uNormalMat");
  const uLightDir = uni("uLightDir");
  const uCamPos = uni("uCamPos");
  const uColor = uni("uColor");
  const uTex = uni("uTex");
  const uTexel = uni("uTexel");

  gl.enable(gl.DEPTH_TEST);
  gl.uniform3fv(uLightDir, norm3([0.45, 0.8, 0.65]));
  gl.uniform3fv(uCamPos, [0, 0, CAMERA_DISTANCE]);
  gl.uniform3fv(uColor, [0.79, 0.66, 0.29]);
  gl.uniform1i(uTex, 0);
  gl.uniform2f(uTexel, 1 / (256 * 5), 1 / (256 * 4));

  const view = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -CAMERA_DISTANCE, 1,
  ];
  gl.uniformMatrix4fv(uView, false, view);

  // Orientation state.
  const restPose = qFromTo(geo.faceNormals[0], [0.15, 0.25, 1]);
  let current = restPose.slice();
  let anim = null; // active roll animation, or null
  let running = false;
  let rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = canvas.width / canvas.height || 1;
    gl.uniformMatrix4fv(uProj, false, mat4Perspective(Math.PI / 5, aspect, 0.1, 100));
  }

  function draw(q, pos) {
    const model = qToMat4(q);
    // Inject the 2D bounce offset into the model's translation column.
    model[12] = pos ? pos[0] : 0;
    model[13] = pos ? pos[1] : 0;
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniformMatrix3fv(uNormalMat, false, mat3FromMat4(model));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, geo.count);
  }

  /** Visible half-extents (world units) at the die's depth, minus the
      die radius — i.e. how far the centre can travel before a wall hit. */
  function playBounds() {
    const aspect = canvas.width / canvas.height || 1;
    const halfH = Math.tan(Math.PI / 10) * CAMERA_DISTANCE;
    const halfW = halfH * aspect;
    return [
      Math.max(0, halfW - DIE_SCALE),
      Math.max(0, halfH - DIE_SCALE),
    ];
  }

  function frame() {
    if (!running || !anim) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - anim.last) / 1000);
    anim.last = now;
    const elapsed = now - anim.start;

    // ── Orientation: tumble fast, decaying onto the result face. ──
    const p = Math.min(1, elapsed / anim.duration);
    const spin = qAxisAngle(anim.axis, anim.totalSpin * (1 - easeOut(p)));
    current = qMul(anim.target, spin);

    // ── Translation: bounce around the walls, then ease to centre. ──
    const [bx, by] = playBounds();
    if (elapsed < BOUNCE_MS) {
      anim.vel[1] -= GRAVITY * dt;
      anim.vel[0] *= 1 - AIR_DRAG;
      anim.vel[1] *= 1 - AIR_DRAG;
      anim.pos[0] += anim.vel[0] * dt;
      anim.pos[1] += anim.vel[1] * dt;
      // Reflect off each wall, clamping back inside and losing energy.
      if (anim.pos[0] > bx) { anim.pos[0] = bx; anim.vel[0] = -anim.vel[0] * RESTITUTION; }
      else if (anim.pos[0] < -bx) { anim.pos[0] = -bx; anim.vel[0] = -anim.vel[0] * RESTITUTION; }
      if (anim.pos[1] > by) { anim.pos[1] = by; anim.vel[1] = -anim.vel[1] * RESTITUTION; }
      else if (anim.pos[1] < -by) { anim.pos[1] = -by; anim.vel[1] = -anim.vel[1] * RESTITUTION; }
    } else {
      if (!anim.returnFrom) anim.returnFrom = anim.pos.slice();
      const rt = Math.min(1, (elapsed - BOUNCE_MS) / RETURN_MS);
      const k = easeOut(rt);
      anim.pos[0] = anim.returnFrom[0] * (1 - k);
      anim.pos[1] = anim.returnFrom[1] * (1 - k);
    }

    draw(current, anim.pos);

    if (elapsed >= BOUNCE_MS + RETURN_MS && p >= 1) {
      current = anim.target.slice();
      const done = anim.onSettle;
      anim = null;
      draw(current, [0, 0]);
      if (done) done();
      return; // settled — stop the loop until the next roll
    }
    rafId = requestAnimationFrame(frame);
  }

  return {
    resize() {
      resize();
      draw(current); // keep the static frame sharp after a resize
    },
    start() {
      running = true;
      resize();
      draw(current); // the die rests still until rolled
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    reset() {
      anim = null;
      current = restPose.slice();
      if (running) draw(current);
    },
    /**
     * Tumble and settle so the face showing `result` faces the camera.
     * @param {number} result 1-20
     * @param {() => void} [onSettle]
     */
    roll(result, onSettle) {
      const faceIndex = Math.max(0, FACE_NUMBERS.indexOf(result));
      const target = qFromTo(geo.faceNormals[faceIndex], [0, 0, 1]);
      const axis = norm3([
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ]);
      const now = performance.now();
      anim = {
        start: now,
        last: now,
        duration: BOUNCE_MS + RETURN_MS,
        axis,
        totalSpin: Math.PI * (8 + Math.random() * 6),
        target,
        onSettle,
        // Launch from centre with a forceful sideways throw and an upward kick.
        pos: [0, 0],
        vel: [(Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 3), 3.5 + Math.random() * 2.5],
        returnFrom: null,
      };
      running = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    },
    dispose() {
      this.stop();
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}
