// ---------------------------------------------------------
// WebGL renderer for a real 3D d20 (icosahedron).
//
// Public API (see createD20Renderer):
//   start()  - begin drawing
//   stop()   - pause drawing
//   reset()  - neutral pose
//   roll(onResult) - tumble freely; the physics decides which face lands
//                    toward the camera, then onResult(value) is called
//   resize() - update drawing buffer to CSS size
//   isLowEnd() - low-end device heuristic
//   dispose()
// ---------------------------------------------------------

const CAMERA_DISTANCE = 3.4;
const DIE_SCALE = 0.46;

// Roll physics (world units, seconds).
// The die is launched with a random angular velocity and tumbles freely;
// drag bleeds the spin off until it slows below SETTLE_ANG_SPEED, at which
// point whichever face is toward the camera (+Z) becomes the result. Only
// then is the die eased into that face's upright pose to show the number.
const SPIN_MIN = 62;          // initial angular speed, rad/s (lower bound)
const SPIN_MAX = 105;         // initial angular speed, rad/s (upper bound)
const ANG_DRAG = 3.1;         // angular-velocity decay rate, per second
const SETTLE_ANG_SPEED = 0.7; // rad/s below which the die counts as stopped
const MIN_TUMBLE_MS = 900;    // minimum spin time before it may settle
const MAX_TUMBLE_MS = 2600;   // hard cap on the free tumble
const REORIENT_MS = 440;      // ease-to-upright after the die has stopped
const GRAVITY = 6.6;
const RESTITUTION = 0.78;
const AIR_DRAG = 0.01;
// Speed (world units/s) that maps to a full-strength collision.
const MAX_HIT_SPEED = 12;
// Below this, a wall touch is too gentle to be worth a spark.
const MIN_HIT_SPEED = 1.2;

const STATIC_MAX_DPR = 2;

const ATLAS_CELL_HIGH = 256;
const ATLAS_CELL_LOW = 128;

// tiny vec3 helpers
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

// quaternion helpers (x, y, z, w)
function qMulInto(out, a, b) {
  out[0] = a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1];
  out[1] = a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0];
  out[2] = a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3];
  out[3] = a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2];
  return out;
}
function qAxisAngleInto(out, axis, angle) {
  const a = norm3(axis);
  const s = Math.sin(angle / 2);
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  out[3] = Math.cos(angle / 2);
  return out;
}
function qAxisAngle(axis, angle) {
  return qAxisAngleInto(new Float32Array(4), axis, angle);
}
function qFromTo(from, to) {
  const f = norm3(from);
  const t = norm3(to);
  const d = dot3(f, t);
  if (d > 0.99999) return new Float32Array([0, 0, 0, 1]);
  if (d < -0.99999) {
    let axis = cross([1, 0, 0], f);
    if (Math.hypot(axis[0], axis[1], axis[2]) < 1e-4) axis = cross([0, 1, 0], f);
    return qAxisAngle(axis, Math.PI);
  }
  return qAxisAngle(cross(f, t), Math.acos(Math.max(-1, Math.min(1, d))));
}
function qToMat4Into(out, q) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  out[0] = 1 - (yy + zz);
  out[1] = xy + wz;
  out[2] = xz - wy;
  out[3] = 0;

  out[4] = xy - wz;
  out[5] = 1 - (xx + zz);
  out[6] = yz + wx;
  out[7] = 0;

  out[8] = xz + wy;
  out[9] = yz - wx;
  out[10] = 1 - (xx + yy);
  out[11] = 0;

  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}
function mat3FromMat4Into(out, m) {
  out[0] = m[0]; out[1] = m[1]; out[2] = m[2];
  out[3] = m[4]; out[4] = m[5]; out[5] = m[6];
  out[6] = m[8]; out[7] = m[9]; out[8] = m[10];
  return out;
}

// Convert a 3x3 rotation matrix (row-major args mRC) to a quaternion (x,y,z,w).
function matrixToQuat(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  return new Float32Array([x, y, z, w]);
}

function qNormInto(out, q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  out[0] = q[0] / l;
  out[1] = q[1] / l;
  out[2] = q[2] / l;
  out[3] = q[3] / l;
  return out;
}
// Spherical-linear interpolation between two unit quaternions.
function qSlerpInto(out, a, b, t) {
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; cos = -cos; }
  let s0, s1;
  if (cos > 0.9995) {
    s0 = 1 - t;
    s1 = t;
  } else {
    const theta = Math.acos(cos);
    const sin = Math.sin(theta);
    s0 = Math.sin((1 - t) * theta) / sin;
    s1 = Math.sin(t * theta) / sin;
  }
  out[0] = s0 * a[0] + s1 * bx;
  out[1] = s0 * a[1] + s1 * by;
  out[2] = s0 * a[2] + s1 * bz;
  out[3] = s0 * a[3] + s1 * bw;
  return qNormInto(out, out);
}
// Rotate vector v by unit quaternion q (out = q · v · q⁻¹).
function rotateVecByQuat(out, q, v) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  out[0] = v[0] + w * tx + (y * tz - z * ty);
  out[1] = v[1] + w * ty + (z * tx - x * tz);
  out[2] = v[2] + w * tz + (x * ty - y * tx);
  return out;
}

// Orientation that turns a face squarely toward the camera (+Z) with its
// number upright (the face's `up` mapped to screen up, +Y), so the digits
// are clearly readable.
function quatUprightFace(normal, up) {
  const fz = norm3(normal);
  let fy = norm3(up);
  const d = dot3(fy, fz);
  fy = norm3([fy[0] - fz[0] * d, fy[1] - fz[1] * d, fy[2] - fz[2] * d]);
  const fx = cross(fy, fz);
  return matrixToQuat(
    fx[0], fx[1], fx[2],
    fy[0], fy[1], fy[2],
    fz[0], fz[1], fz[2]
  );
}

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

  const localTri = [[0.5, 0.16], [0.14, 0.84], [0.86, 0.84]];
  const positions = [];
  const normals = [];
  const uvs = [];
  const faceNormals = [];
  const faceUps = [];

  faces.forEach((face, i) => {
    const ia = face[0];
    const ib = face[1];
    const ic = face[2];
    let a = v[ia], b = v[ib], c = v[ic];
    let n = norm3(cross(sub(b, a), sub(c, a)));
    const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot3(n, centroid) < 0) {
      const swap = b;
      b = c;
      c = swap;
      n = norm3(cross(sub(b, a), sub(c, a)));
    }
    faceNormals[i] = n;
    // The number's "up" on this face points from the base edge midpoint to
    // the apex vertex `a` (which maps to the top of the glyph in the atlas).
    const midBC = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2];
    faceUps[i] = norm3(sub(a, midBC));

    const col = i % 5;
    const row = Math.floor(i / 5);
    const tri = [a, b, c];
    tri.forEach((p, k) => {
      positions.push(p[0] * DIE_SCALE, p[1] * DIE_SCALE, p[2] * DIE_SCALE);
      normals.push(n[0], n[1], n[2]);
      const lx = localTri[k][0];
      const ly = localTri[k][1];
      uvs.push((col + lx) / 5, 1 - (row + ly) / 4);
    });
  });

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    faceNormals,
    faceUps,
    count: faces.length * 3,
    faceCount: faces.length,
  };
}

// Face-number assignment derived by solving the graph isomorphism between
// the icosahedron's face adjacency graph and the standard d20 layout where
// every face borders exactly the three neighbours listed below:
//   1: 7,13,19  2: 12,18,20  3: 16,17,19  4: 11,14,18  5: 13,15,18
//   6: 9,14,16  7: 1,15,17   8: 10,16,20  9: 6,11,19  10: 8,12,17
//  11: 4,9,13  12: 2,10,15  13: 1,5,11   14: 4,6,20   15: 5,7,12
//  16: 3,6,8   17: 3,7,10   18: 2,4,5    19: 1,3,9    20: 2,8,14
// Opposite faces always sum to 21.
// Index in the array = geometry face index 0-19 (face-list order in buildGeometry).
const FACE_NUMBERS = [20, 2, 12, 10, 8, 18, 14, 16, 17, 15, 11, 9, 19, 1, 13, 4, 6, 3, 7, 5];

function buildAtlasCanvas(faceNumbers, cell) {
  const canvas = document.createElement("canvas");
  canvas.width = cell * 5;
  canvas.height = cell * 4;
  const ctx = canvas.getContext("2d");
  const serifFont = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-serif")
    .trim() || "serif";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontSize = Math.round(cell * 0.25);
  const underlineW = Math.round(cell * 0.18);
  const underlineH = Math.max(2, Math.round(cell * 0.027));
  const underlineY = Math.round(cell * 0.137);

  faceNumbers.forEach((num, i) => {
    const cx = (i % 5) * cell + cell * 0.5;
    const cy = Math.floor(i / 5) * cell + cell * 0.62;
    ctx.font = "700 " + fontSize + "px " + serifFont;
    ctx.fillText(String(num), cx, cy);
    if (num === 6 || num === 9) {
      ctx.fillRect(cx - underlineW / 2, cy + underlineY, underlineW, underlineH);
    }
  });

  return canvas;
}

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

const FRAG_SRC_HIGH = `
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

    vec2 off = uTexel * 2.0;
    float ink = texture2D(uTex, vUV).a;
    float inkUp = texture2D(uTex, vUV + vec2(-off.x, off.y)).a;
    float inkDn = texture2D(uTex, vUV + vec2(off.x, -off.y)).a;
    float lit = max(inkUp - ink, 0.0);
    float shadow = max(inkDn - ink, 0.0);

    vec3 color = base;
    color *= 1.0 - ink * 0.62;
    color += vec3(1.0, 0.95, 0.78) * lit * 0.9;
    color -= base * shadow * 0.9;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const FRAG_SRC_LOW = `
  precision mediump float;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUV;
  uniform vec3 uLightDir;
  uniform vec3 uCamPos;
  uniform vec3 uColor;
  uniform sampler2D uTex;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(uCamPos - vWorld);
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 20.0);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    vec3 base = uColor * (0.35 + 0.75 * diff) + vec3(1.0, 0.93, 0.7) * spec * 0.45;
    base += uColor * rim * 0.18;

    float ink = texture2D(uTex, vUV).a;
    vec3 color = base * (1.0 - ink * 0.56);
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

function createProgram(gl, vertSrc, fragSrc) {
  const program = gl.createProgram();
  const ATTR_POS = 0;
  const ATTR_NORMAL = 1;
  const ATTR_UV = 2;
  gl.bindAttribLocation(program, ATTR_POS, "aPos");
  gl.bindAttribLocation(program, ATTR_NORMAL, "aNormal");
  gl.bindAttribLocation(program, ATTR_UV, "aUV");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "program link failed");
  }
  return program;
}

function makeTexture(gl, faceNumbers, cell) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildAtlasCanvas(faceNumbers, cell));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

function readUniforms(gl, program) {
  const uni = (name) => gl.getUniformLocation(program, name);
  return {
    uProj: uni("uProj"),
    uView: uni("uView"),
    uModel: uni("uModel"),
    uNormalMat: uni("uNormalMat"),
    uLightDir: uni("uLightDir"),
    uCamPos: uni("uCamPos"),
    uColor: uni("uColor"),
    uTex: uni("uTex"),
    uTexel: uni("uTexel"),
  };
}

function isLowEndDevice() {
  // eslint-disable-next-line compat/compat
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  // eslint-disable-next-line compat/compat
  const deviceMemoryGb = navigator.deviceMemory || 2;
  return hardwareConcurrency <= 2 || deviceMemoryGb <= 2;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function createD20Renderer(canvas) {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
  if (!gl) return null;

  const lowEnd = isLowEndDevice();
  const geo = buildGeometry();
  const faceNumbers = FACE_NUMBERS;

  const programHigh = createProgram(gl, VERT_SRC, FRAG_SRC_HIGH);
  const programLow = createProgram(gl, VERT_SRC, FRAG_SRC_LOW);
  const uniformsHigh = readUniforms(gl, programHigh);
  const uniformsLow = readUniforms(gl, programLow);

  const bufPos = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
  gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const bufNorm = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufNorm);
  gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  const bufUv = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufUv);
  gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

  const textureHigh = makeTexture(gl, faceNumbers, ATLAS_CELL_HIGH);
  const textureLow = makeTexture(gl, faceNumbers, ATLAS_CELL_LOW);

  gl.enable(gl.DEPTH_TEST);

  const view = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -CAMERA_DISTANCE, 1,
  ]);

  const baseLight = norm3([0.45, 0.8, 0.65]);
  const baseCam = [0, 0, CAMERA_DISTANCE];
  const baseColor = [0.79, 0.66, 0.29];

  const restPose = quatUprightFace(geo.faceNormals[0], geo.faceUps[0]);
  let current = new Float32Array(restPose);
  let anim = null;
  let running = false;
  let rafId = 0;

  const tmpSpin = new Float32Array(4);
  const tmpQ = new Float32Array(4);
  const settleQ = new Float32Array(4);
  const tmpVec = new Float32Array(3);
  const modelMat = new Float32Array(16);
  const normalMat = new Float32Array(9);

  let boundX = 0;
  let boundY = 0;
  let halfW = 1;
  let halfH = 1;
  let collideCb = null;

  // Rendering quality derived from the device class. Low-end devices use a
  // cheaper shader and smaller number atlas, and drop to 1x DPR while a roll
  // is animating; capable devices always render at full quality.
  const useLowShader = lowEnd;
  const useLowAtlas = lowEnd;

  function applySharedUniforms(program, uniforms, atlasCell) {
    gl.useProgram(program);
    gl.uniform3fv(uniforms.uLightDir, baseLight);
    gl.uniform3fv(uniforms.uCamPos, baseCam);
    gl.uniform3fv(uniforms.uColor, baseColor);
    gl.uniform1i(uniforms.uTex, 0);
    if (uniforms.uTexel) {
      gl.uniform2f(uniforms.uTexel, 1 / (atlasCell * 5), 1 / (atlasCell * 4));
    }
    gl.uniformMatrix4fv(uniforms.uView, false, view);
  }

  applySharedUniforms(programHigh, uniformsHigh, ATLAS_CELL_HIGH);
  applySharedUniforms(programLow, uniformsLow, ATLAS_CELL_LOW);

  function chooseCurrentDpr() {
    const native = window.devicePixelRatio || 1;
    const cap = lowEnd && anim ? 1 : STATIC_MAX_DPR;
    return Math.min(native, cap);
  }

  function updateBounds() {
    const aspect = canvas.width / canvas.height || 1;
    halfH = Math.tan(Math.PI / 10) * CAMERA_DISTANCE;
    halfW = halfH * aspect;
    boundX = Math.max(0, halfW - DIE_SCALE);
    boundY = Math.max(0, halfH - DIE_SCALE);
  }

  // Report a wall hit to the effects layer in CSS-fraction coordinates
  // (0..1 across the canvas), tagged with which wall and how hard.
  function emitCollision(edge, worldX, worldY, speed) {
    if (!collideCb || speed < MIN_HIT_SPEED) return;
    collideCb({
      edge,
      fracX: (worldX / halfW + 1) / 2,
      fracY: (1 - worldY / halfH) / 2,
      strength: Math.min(1, speed / MAX_HIT_SPEED),
    });
  }

  function resize() {
    const dpr = chooseCurrentDpr();
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = canvas.width / canvas.height || 1;
    const proj = mat4Perspective(Math.PI / 5, aspect, 0.1, 100);

    gl.useProgram(programHigh);
    gl.uniformMatrix4fv(uniformsHigh.uProj, false, proj);
    gl.useProgram(programLow);
    gl.uniformMatrix4fv(uniformsLow.uProj, false, proj);

    updateBounds();
  }

  function pickProgram() {
    if (useLowShader) return { program: programLow, uniforms: uniformsLow };
    return { program: programHigh, uniforms: uniformsHigh };
  }

  function bindTextureForProfile() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, useLowAtlas ? textureLow : textureHigh);
  }

  function draw(q, pos) {
    const selected = pickProgram();
    qToMat4Into(modelMat, q);
    modelMat[12] = pos ? pos[0] : 0;
    modelMat[13] = pos ? pos[1] : 0;
    mat3FromMat4Into(normalMat, modelMat);

    gl.useProgram(selected.program);
    bindTextureForProfile();
    gl.uniformMatrix4fv(selected.uniforms.uModel, false, modelMat);
    gl.uniformMatrix3fv(selected.uniforms.uNormalMat, false, normalMat);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, geo.count);
  }

  function frame() {
    if (!running || !anim) return;

    const now = performance.now();
    const dtMs = Math.min(33, now - anim.last);
    const dt = dtMs / 1000;
    anim.last = now;
    const elapsed = now - anim.start;

    if (anim.phase === "tumble") {
      // Integrate the orientation from the current angular velocity, then
      // bleed that velocity off with drag so the die naturally slows to a stop.
      const speed = Math.hypot(anim.angVel[0], anim.angVel[1], anim.angVel[2]);
      if (speed > 1e-5) {
        qAxisAngleInto(tmpSpin, anim.angVel, speed * dt);
        qMulInto(tmpQ, tmpSpin, anim.q);
        qNormInto(anim.q, tmpQ);
      }
      const decay = Math.exp(-ANG_DRAG * dt);
      anim.angVel[0] *= decay;
      anim.angVel[1] *= decay;
      anim.angVel[2] *= decay;

      // Position physics: gravity pulls the die down and it bounces off walls.
      anim.vel[1] -= GRAVITY * dt;
      anim.vel[0] *= 1 - AIR_DRAG;
      anim.vel[1] *= 1 - AIR_DRAG;
      anim.pos[0] += anim.vel[0] * dt;
      anim.pos[1] += anim.vel[1] * dt;

      if (anim.pos[0] > boundX) { anim.pos[0] = boundX; emitCollision("right", halfW, anim.pos[1], Math.abs(anim.vel[0])); anim.vel[0] = -anim.vel[0] * RESTITUTION; }
      else if (anim.pos[0] < -boundX) { anim.pos[0] = -boundX; emitCollision("left", -halfW, anim.pos[1], Math.abs(anim.vel[0])); anim.vel[0] = -anim.vel[0] * RESTITUTION; }
      if (anim.pos[1] > boundY) { anim.pos[1] = boundY; emitCollision("top", anim.pos[0], halfH, Math.abs(anim.vel[1])); anim.vel[1] = -anim.vel[1] * RESTITUTION; }
      else if (anim.pos[1] < -boundY) { anim.pos[1] = -boundY; emitCollision("bottom", anim.pos[0], -halfH, Math.abs(anim.vel[1])); anim.vel[1] = -anim.vel[1] * RESTITUTION; }

      current = anim.q;

      // Once the tumble has slowed below the stop threshold (after a minimum
      // spin time), or the hard cap is reached, read the result and reorient.
      if ((elapsed > MIN_TUMBLE_MS && speed < SETTLE_ANG_SPEED) || elapsed > MAX_TUMBLE_MS) {
        beginReorient(now);
      }
    } else {
      // Reorient: ease the settled die into the perfectly-upright pose of the
      // face it landed on, and glide back to centre.
      const rt = Math.min(1, (now - anim.reorientStart) / REORIENT_MS);
      const k = easeOut(rt);
      qSlerpInto(settleQ, anim.reorientFrom, anim.target, k);
      current = settleQ;
      anim.pos[0] = anim.returnFrom[0] * (1 - k);
      anim.pos[1] = anim.returnFrom[1] * (1 - k);

      if (rt >= 1) {
        current = new Float32Array(anim.target);
        const done = anim.onResult;
        const result = anim.result;
        anim = null;

        resize();
        draw(current, [0, 0]);
        if (done) done(result);
        return;
      }
    }

    resize();
    draw(current, anim.pos);

    rafId = requestAnimationFrame(frame);
  }

  // Read the result from the settled orientation: the face whose world-space
  // normal points most toward the camera (+Z) is the one showing. Lock in that
  // value and set up the ease toward its upright pose.
  function beginReorient(now) {
    let bestIdx = 0;
    let bestZ = -Infinity;
    for (let i = 0; i < geo.faceCount; i++) {
      rotateVecByQuat(tmpVec, anim.q, geo.faceNormals[i]);
      if (tmpVec[2] > bestZ) {
        bestZ = tmpVec[2];
        bestIdx = i;
      }
    }
    anim.result = faceNumbers[bestIdx];
    anim.target = quatUprightFace(geo.faceNormals[bestIdx], geo.faceUps[bestIdx]);
    anim.reorientFrom = anim.q.slice();
    anim.returnFrom = anim.pos.slice();
    anim.reorientStart = now;
    anim.phase = "reorient";
  }

  function startRoll(onResult) {
    const now = performance.now();
    // Random initial angular velocity (rad/s) about a random axis. This, plus
    // drag and any wall bounces, is what decides which face ends up toward the
    // camera — the result is read from the final orientation, not chosen here.
    const axis = norm3([
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ]);
    const spinRate = SPIN_MIN + Math.random() * (SPIN_MAX - SPIN_MIN);
    anim = {
      phase: "tumble",
      start: now,
      last: now,
      q: new Float32Array(current),
      angVel: [axis[0] * spinRate, axis[1] * spinRate, axis[2] * spinRate],
      pos: [0, 0],
      vel: [(Math.random() < 0.5 ? -1 : 1) * (11 + Math.random() * 5), 7 + Math.random() * 3],
      onResult,
      // Filled in once the die settles:
      reorientStart: 0,
      reorientFrom: null,
      returnFrom: null,
      target: null,
      result: 0,
    };
    running = true;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  return {
    resize() {
      resize();
      draw(current);
    },
    start() {
      running = true;
      resize();
      draw(current);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    reset() {
      anim = null;
      current = new Float32Array(restPose);
      if (running) {
        resize();
        draw(current);
      }
    },
    roll(onResult) {
      startRoll(onResult);
    },
    setOnCollide(fn) {
      collideCb = fn;
    },
    isLowEnd() {
      return lowEnd;
    },
    dispose() {
      this.stop();
      gl.deleteTexture(textureHigh);
      gl.deleteTexture(textureLow);
      gl.deleteBuffer(bufPos);
      gl.deleteBuffer(bufNorm);
      gl.deleteBuffer(bufUv);
      gl.deleteProgram(programHigh);
      gl.deleteProgram(programLow);
    },
  };
}
