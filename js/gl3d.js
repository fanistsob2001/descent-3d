'use strict';

// Η μηχανή WebGL (στάδιο 1 του "πραγματικού 3D"): ο κόσμος ως αληθινή γεωμετρία στην κάρτα γραφικών, χωρίς
// βιβλιοθήκες. Τοίχοι με το ύψος τους (και την ακανόνιστη κορυφή των βράχων), σκαλοπάτια ανάμεσα σε τοίχους
// διαφορετικού ύψους, καπάκια στους χαμηλούς τοίχους, δάπεδα, ταβάνια (μόνο στα στενά περάσματα), νερό, λάβα,
// καταρράκτες, η έξοδος με το φως της ημέρας.
//
// Ίδιοι κανόνες με τον raycaster (js/raycast.js), που μένει ως εφεδρεία ("Renderer: Classic"):
//   - Φως μόνο από τον ήχο: τα κομμάτια τοίχων του Echoes (υφή segTex, ένα texel ανά κομμάτι), τα κελιά του
//     δαπέδου (υφή cellTex: φως, σταθερό φως, νερό στις πύλες), και το μέτωπο κάθε κύματος υπολογίζεται στο
//     shader (ως 8 κύματα, με τις ακτίνες ορατότητάς τους στην υφή rayTex, για να μην περνάει μέσα από τοίχους).
//   - Ίδιες υφές (οι πίνακες του Raycast.buildTextures σε δύο άτλαντες), ίδια ομίχλη, ίδιες φωτεινές ακμές.
//   - Η κάμερα: ίδια με του raycaster (focal, ορίζοντας με "κούνημα"), ώστε οι μορφές (billboards), που ακόμα
//     ζωγραφίζονται από πάνω σε 2D, να κάθονται ακριβώς στη θέση τους. Το zbuf για να κρύβονται πίσω από τοίχους
//     βγαίνει από μία γρήγορη ακτίνα ανά στήλη (Raycast.castZ).
// Ζωγραφίζει σε δικό του καμβά (ίδιο μέγεθος με τον μικρό καμβά του Pixel) και μετά τον αντιγράφει εκεί
// (drawImage) — από εκεί και πέρα όλα ίδια (μορφές, χέρια, παλέτα, μεγέθυνση).

const GL_MAX_WAVES = 8;
const GL_MAX_RED = 6;
const GL_RAYS = 128;          // πλάτος της υφής των ακτίνων (τα μικρά κύματα έχουν 48)
const GL_SEG_W = 1024;        // πλάτος της υφής των κομματιών τοίχων
const GL_WALL_TILE = 64, GL_FLOOR_TILE = 40, GL_ATLAS_COLS = 8;

const GL_VS = `
attribute vec3 aPos;      // κόσμος σε κελιά: x, y (κάτοψη), z (ύψος)
attribute vec4 aA;        // kind (0 τοίχος, 1 δάπεδο, 2 ταβάνι, 3 καπάκι), άτλαντας, άτλαντας πάνω από το 1, πρώτο κομμάτι
attribute vec4 aB;        // u (κατά μήκος της πλευράς), side (0..3), ύψος της πλευράς, σημαίες
attribute vec2 aC;        // το κελί μπροστά από τον τοίχο (για το σταθερό φως) — ή το ίδιο το κελί
uniform vec3 uEye;        // θέση (κελιά), ύψος ματιών
uniform vec2 uDir;        // κατεύθυνση βλέμματος
uniform vec4 uProj;       // 2·focal/W, 2·focal/H, 1 − 2·horizon/H, (κενό)
varying vec3 vPos;
varying vec4 vA;
varying vec4 vB;
varying vec2 vC;
varying float vDepth;
void main() {
  vec2 d = aPos.xy - uEye.xy;
  float xc = dot(d, vec2(-uDir.y, uDir.x));
  float zc = dot(d, uDir);
  float yc = aPos.z - uEye.z;
  float n = 0.02, f = 60.0;
  gl_Position = vec4(uProj.x * xc, uProj.y * yc + uProj.z * zc, zc * (f + n) / (f - n) - 2.0 * f * n / (f - n), zc);
  vPos = aPos; vA = aA; vB = aB; vC = aC; vDepth = zc;
}`;

const GL_FS = `
precision highp float;
varying vec3 vPos;
varying vec4 vA;
varying vec4 vB;
varying vec2 vC;
varying float vDepth;
uniform sampler2D uWallAtlas, uFloorAtlas, uCell, uSeg, uRays, uInfo;
uniform vec2 uWorld;          // cols, rows
uniform vec2 uSegSize;        // πλάτος, ύψος της υφής των κομματιών
uniform float uSegPer;        // κομμάτια ανά πλευρά
uniform vec2 uWallAtlasSize, uFloorAtlasSize;
uniform float uTime, uFogDist, uFogMin, uFocal, uExitA, uTile;
uniform vec4 uWaves[${GL_MAX_WAVES}];     // x, y (μονάδες), r, ένταση
uniform float uWaveRays[${GL_MAX_WAVES}];  // πόσες ακτίνες (0 = κανένα κύμα)
uniform vec3 uRed[${GL_MAX_RED}];         // x, y (κελιά), ένταση
uniform float uRing;

float bit(float m, float k) { return mod(floor(m / pow(2.0, k)), 2.0); }

vec3 atlasW(float idx, vec2 uv) {
  vec2 t = vec2(mod(idx, ${GL_ATLAS_COLS}.0), floor(idx / ${GL_ATLAS_COLS}.0));
  vec2 p = (t * ${GL_WALL_TILE}.0 + floor(fract(uv) * ${GL_WALL_TILE}.0) + 0.5) / uWallAtlasSize;
  return texture2D(uWallAtlas, p).rgb;
}
vec3 atlasF(float idx, vec2 uv) {
  vec2 t = vec2(mod(idx, ${GL_ATLAS_COLS}.0), floor(idx / ${GL_ATLAS_COLS}.0));
  vec2 p = (t * ${GL_FLOOR_TILE}.0 + floor(fract(uv) * ${GL_FLOOR_TILE}.0) + 0.5) / uFloorAtlasSize;
  return texture2D(uFloorAtlas, p).rgb;
}
vec4 cellAt(vec2 c) { return texture2D(uCell, (floor(c) + 0.5) / uWorld); }

// Τα κύματα: απαλό φως πίσω από το μέτωπο (sum) και η πορτοκαλί λάμψη του ίδιου του μετώπου (glow),
// μόνο όπου ο ήχος έφτασε χωρίς τοίχο στη μέση (οι ακτίνες του κάθε κύματος).
vec2 rings(vec2 p, float floorK) {
  float sum = 0.0, glow = 0.0;
  for (int i = 0; i < ${GL_MAX_WAVES}; i++) {
    float n = uWaveRays[i];
    if (n < 0.5) continue;
    vec4 w = uWaves[i];
    vec2 dd = p - w.xy;
    float d = length(dd);
    if (d > w.z) continue;
    float t = (w.z - d) / uRing;
    float front = t < 3.0 ? exp(-t * t) * w.w : 0.0;
    float a = (front + floorK) * w.w;
    if (a < 0.01 && front < 0.01) continue;
    float k = floor(mod(atan(dd.y, dd.x) / 6.2831853 * n + n + 0.5, n));
    vec4 r = texture2D(uRays, vec2((k + 0.5) / ${GL_RAYS}.0, (float(i) + 0.5) / ${GL_MAX_WAVES}.0));
    float rd = (r.r * 255.0 * 256.0 + r.g * 255.0);
    if (rd < d - 6.0) continue;
    sum += a;
    glow += front;
  }
  return vec2(sum, glow);
}

void main() {
  float kind = vA.x;
  float fog = max(uFogMin, 1.0 - vDepth * uTile / uFogDist);
  vec2 wp = vPos.xy * uTile;
  vec3 col;
  if (kind < 0.5 || kind > 2.5) {
    // ---- Τοίχος (ή καπάκι χαμηλού τοίχου) ----
    float u = vB.x, side = vB.y, h = vB.z, flags = vB.w;
    float z = vPos.z;
    float seg = vA.w >= 0.0 ? vA.w + min(uSegPer - 1.0, floor(u * uSegPer)) : -1.0;
    float light = 0.0;
    if (seg >= 0.0) {
      vec2 sp = vec2(mod(seg, uSegSize.x) + 0.5, floor(seg / uSegSize.x) + 0.5) / uSegSize;
      light = texture2D(uSeg, sp).r * 1.5;
    }
    vec4 front = cellAt(vC);
    light = max(light, front.b * 1.5);
    vec2 rg = rings(wp, 0.0);
    light += rg.x * 0.8;
    float glow = rg.y;
    light = min(light * fog, 1.4);
    glow *= fog;
    float tu = side > 2.5 || (side < 0.5) ? 1.0 - u : u;
    float zf = fract(z);
    vec3 tex = z >= 1.0 ? atlasW(vA.z, vec2(tu, 1.0 - zf)) : atlasW(vA.y, vec2(tu, 1.0 - zf));
    if (kind > 2.5) tex = atlasW(vA.y, vPos.xy);
    float shade = (side > 1.5 && side < 3.5) ? 0.8 : 1.0;
    float up = z > 0.9 ? max(0.28, 1.0 - (z - 0.9) * 0.32) : 1.0;
    // Φωτεινές ακμές: κορυφή, βάση, κάθετες γωνίες (πάχος ~1 pixel της οθόνης).
    float px = 1.2 * vDepth / uFocal;
    bool corner = (bit(flags, 0.0) > 0.5 && u < px) || (bit(flags, 1.0) > 0.5 && u > 1.0 - px);
    bool edge = kind < 0.5 && (corner || h - z < px || z < px * 0.8);
    float wet = mod(floor(flags / 4.0), 4.0);
    float lit = light * shade;
    if (bit(flags, 4.0) > 0.5 && uExitA > 0.01 && z < 1.2) {
      // Το άνοιγμα της εξόδου: φως της ημέρας, με πλαίσιο από πηλό και ακτίνες που τρεμοπαίζουν.
      float v = 1.0 - z / 1.2;
      float ray = 0.85 + 0.15 * sin(u * 23.0 + uTime * 1.7) * sin(u * 7.0 - uTime * 0.9);
      if (u < 0.08 || u > 0.92 || v < 0.06) col = vec3(206.0, 108.0, 56.0) / 255.0 * uExitA;
      else col = vec3(255.0, 236.0, 190.0) / 255.0 * uExitA * ray * (0.75 + 0.25 * v);
      gl_FragColor = vec4(col, 1.0);
      return;
    }
    if (light < 0.01 && glow < 0.01) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec3 g3 = vec3(210.0, 110.0, 56.0) / 255.0 * glow;
    float hsh = fract(sin(floor(u * 5.0) * 12.9898 + vC.x * 78.233 + vC.y * 37.719) * 43758.5453);
    if (wet > 1.5) {
      // Καταρράκτης: φωτεινά ρυάκια που κατεβαίνουν, αφρός στη βάση.
      float fl = fract((1.0 - z / h) * h * (1.1 + hsh * 0.8) - uTime * (0.9 + hsh * 0.8) + hsh * 7.0);
      float sf = fract(u * 5.0);
      float wk = (fl < 0.55 ? 0.95 : fl < 0.75 ? 0.6 : 0.3) * (sf < 0.12 || sf > 0.88 ? 0.45 : 1.0);
      if (z < 0.14) wk = max(wk, 0.75 + 0.25 * sin(uTime * 9.0 + floor(u * 5.0) * 2.3 + z * 40.0));
      float kk = lit * up;
      col = tex * kk * 0.4 + vec3(196.0, 168.0, 140.0) / 255.0 * wk * kk + g3;
    } else if (edge) {
      col = vec3(206.0, 98.0, 54.0) / 255.0 * min(1.25, (light + glow) * 1.05) * up;
    } else if (wet > 0.5) {
      float k = lit * up * (z < 0.38 ? 0.62 : 0.85);
      if (hsh > 0.78 && fract((1.0 - z / h) * 1.6 * h - uTime * (0.25 + hsh * 0.3) + hsh * 5.0) < 0.12) k *= 1.6;
      col = tex * k + g3;
    } else {
      float ao = z < 0.16 ? 1.0 - (0.16 - z) * 3.0 : (h - z < 0.06 ? 0.8 : 1.0);
      col = tex * lit * ao * up + g3;
    }
    gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
    return;
  }

  // ---- Δάπεδο / ταβάνι ----
  bool below = kind < 1.5;
  vec2 cxy = floor(vPos.xy);
  vec4 cell = cellAt(vPos.xy);
  vec4 info = texture2D(uInfo, (cxy + 0.5) / uWorld);
  float terrain = vB.y;                                  // 0 δάπεδο, 1 νερό
  if (below && cell.a > 0.5) terrain = 1.0;              // πύλη κλειστή: νερό
  float lava = info.g * 255.0 > 0.5 && mod(info.g * 255.0, 2.0) > 0.5 ? 1.0 : 0.0;
  float foam = bit(info.g * 255.0, 1.0);
  float light = cell.r * 1.5;
  float glow = 0.0;
  vec2 rg = rings(wp, 0.1);
  light += rg.x;
  float fk = fog * (below ? 1.0 : 0.45);
  glow = rg.y * fk;
  light *= fk;
  // Ambient occlusion: πιο σκοτεινά δίπλα στους τοίχους και στις γωνίες.
  float am = info.r * 255.0;
  vec2 f = vPos.xy - cxy;
  if (am > 0.5 && light > 0.012) {
    float d = 1.0;
    if (bit(am, 0.0) > 0.5) d = min(d, f.y);
    if (bit(am, 1.0) > 0.5) d = min(d, 1.0 - f.y);
    if (bit(am, 2.0) > 0.5) d = min(d, f.x);
    if (bit(am, 3.0) > 0.5) d = min(d, 1.0 - f.x);
    if (bit(am, 4.0) > 0.5) d = min(d, length(f));
    if (bit(am, 5.0) > 0.5) d = min(d, length(vec2(1.0 - f.x, f.y)));
    if (bit(am, 6.0) > 0.5) d = min(d, length(vec2(f.x, 1.0 - f.y)));
    if (bit(am, 7.0) > 0.5) d = min(d, length(1.0 - f));
    if (d < 0.3) light *= 0.4 + 0.6 * (d / 0.3);
  }
  // Κόκκινη λάμψη κάτω από μια σκιά που φάνηκε.
  float rl = 0.0;
  if (below) {
    for (int i = 0; i < ${GL_MAX_RED}; i++) {
      vec3 r = uRed[i];
      if (r.z < 0.01) continue;
      float d = length(vPos.xy - r.xy);
      if (d < 1.8) rl = max(rl, r.z * pow(1.0 - d / 1.8, 1.5));
    }
    rl *= fog;
  }
  if (light < 0.012 && glow < 0.01 && rl < 0.01 && lava < 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  light = min(light, 1.4);
  vec3 tex;
  if (below && terrain > 0.5 && lava > 0.5) {
    // Λάβα: κινούμενα κύματα φωτιάς, φωτίζει μόνη της.
    vec2 X = wp;
    float q = sin(X.x * 0.11 + uTime * 1.3 + sin(X.y * 0.07)) * sin(X.y * 0.09 - uTime * 0.9) * 0.5 + 0.5;
    bool crust = abs(sin(X.x * 0.05 - X.y * 0.04 + uTime * 0.25)) < 0.12;
    tex = crust ? vec3(70.0, 20.0, 15.0) : q > 0.78 ? vec3(255.0, 214.0, 130.0) : q > 0.45 ? vec3(232.0, 120.0, 40.0) : vec3(170.0, 34.0, 18.0);
    tex /= 255.0;
    light = 1.0;
  } else if (below && terrain > 0.5) {
    // Σκούρο νερό με κυματάκια που κυλάνε αργά (και αφρός μπροστά στον καταρράκτη).
    vec2 X = wp;
    float m = mod(X.y + sin(X.x * 0.12 + uTime * 1.3 + cxy.x * 1.7) * 3.0, 13.0);
    tex = abs(m - 6.5) < 0.6 ? vec3(112.0, 58.0, 30.0) / 255.0 : vec3(30.0, 18.0, 13.0) / 255.0;
    if (foam > 0.5) {
      float n = fract(sin(floor(X.x * 0.5) * 12.98 + floor(X.y * 0.5) * 78.23 + floor(uTime * 7.0) * 3.1) * 43758.5);
      if (n < 0.75 - f.x * 0.8) tex = vec3(200.0, 172.0, 140.0) / 255.0;
    }
  } else {
    tex = atlasF(vA.y, vPos.xy);
  }
  col = tex * light + vec3(210.0, 110.0, 56.0) / 255.0 * glow + vec3(190.0, 22.0, 14.0) / 255.0 * rl;
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

const GL3D = {
  ok: false,          // υπάρχει WebGL
  canvas: null,
  gl: null,
  prog: null,
  loc: {},
  builtFor: -1,       // για ποιον κόσμο (Raycast._world) φτιάχτηκε η γεωμετρία
  vbo: null,
  count: 0,
  W: 0, H: 0,

  init() {
    try {
      this.canvas = document.createElement('canvas');
      const gl = this.canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, depth: true });
      if (!gl) return;
      this.gl = gl;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, GL_VS));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, GL_FS));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.prog = p;
      for (const n of ['aPos', 'aA', 'aB', 'aC']) this.loc[n] = gl.getAttribLocation(p, n);
      for (const n of ['uEye', 'uDir', 'uProj', 'uWallAtlas', 'uFloorAtlas', 'uCell', 'uSeg', 'uRays', 'uInfo', 'uWorld', 'uSegSize',
        'uSegPer', 'uWallAtlasSize', 'uFloorAtlasSize', 'uTime', 'uFogDist', 'uFogMin', 'uFocal', 'uExitA', 'uTile', 'uWaves',
        'uWaveRays', 'uRed', 'uRing']) this.loc[n] = gl.getUniformLocation(p, n);
      this.vbo = gl.createBuffer();
      this.tex = {};
      for (const n of ['wall', 'floor', 'cell', 'seg', 'rays', 'info']) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.tex[n] = t;
      }
      this.rayData = new Uint8Array(GL_RAYS * GL_MAX_WAVES * 4);
      this.ok = true;
    } catch (e) {
      console.warn('WebGL: ' + (e && e.message));
      this.ok = false;
    }
  },

  // Χρησιμοποιείται η μηχανή WebGL; (ρύθμιση "Renderer")
  use() {
    return this.ok && Settings.renderer !== 'classic';
  },

  // ---- Οι άτλαντες των υφών: όλες οι υφές τοίχων (64×64) και δαπέδων (40×40) του Raycast σε δύο εικόνες ----
  buildAtlases() {
    const gl = this.gl, R = Raycast;
    const wallList = [], floorList = [];
    this.wallIdx = new Map();
    this.floorIdx = new Map();
    const addW = (t) => { if (!this.wallIdx.has(t)) { this.wallIdx.set(t, wallList.length); wallList.push(t); } };
    const addF = (t) => { if (t && !this.floorIdx.has(t)) { this.floorIdx.set(t, floorList.length); floorList.push(t); } };
    for (const k in R.walls) R.walls[k].forEach(addW);
    for (const k in R.tex) { const v = R.tex[k]; if (Array.isArray(v)) v.forEach(addF); else addF(v); }
    const pack = (list, T) => {
      const cols = GL_ATLAS_COLS, rows = Math.ceil(list.length / cols);
      const W = cols * T, H = rows * T;
      const data = new Uint8Array(W * H * 4);
      list.forEach((t, i) => {
        const ox = (i % cols) * T, oy = Math.floor(i / cols) * T;
        for (let v = 0; v < T; v++) {
          for (let u = 0; u < T; u++) {
            const s = (v * T + u) * 3, d = ((oy + v) * W + ox + u) * 4;
            data[d] = t[s]; data[d + 1] = t[s + 1]; data[d + 2] = t[s + 2]; data[d + 3] = 255;
          }
        }
      });
      return { W, H, data };
    };
    const w = pack(wallList, GL_WALL_TILE), f = pack(floorList, GL_FLOOR_TILE);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.wall);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w.W, w.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, w.data);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.floor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.W, f.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.data);
    this.wallAtlasSize = [w.W, w.H];
    this.floorAtlasSize = [f.W, f.H];
    this.atlasesFor = R.walls;
  },

  // ---- Η γεωμετρία του κόσμου (μία φορά για κάθε κόσμο που φορτώνεται) ----
  build() {
    const gl = this.gl, L = Level, R = Raycast, cols = L.cols, rows = L.rows;
    if (this.atlasesFor !== R.walls) this.buildAtlases();
    const v = [];
    // Μία κορυφή: θέση (3), aA (4), aB (4), aC (2) = 13 floats.
    const vert = (x, y, z, a0, a1, a2, a3, b0, b1, b2, b3, c0, c1) => v.push(x, y, z, a0, a1, a2, a3, b0, b1, b2, b3, c0, c1);
    const quad = (p, A, B, C) => {
      // p = 4 γωνίες [x, y, z, u]· δύο τρίγωνα.
      for (const k of [0, 1, 2, 0, 2, 3]) vert(p[k][0], p[k][1], p[k][2], A[0], A[1], A[2], A[3], p[k][3], B[1], B[2], B[3], C[0], C[1]);
    };
    const isWall = (tx, ty) => tx < 0 || ty < 0 || tx >= cols || ty >= rows || (L.opaque[ty * cols + tx] === 1 && R.gateAt[ty * cols + tx] < 0);
    const hAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= cols || ty >= rows ? 3 : R.wallH[ty * cols + tx]);
    const themeAt = (tx, ty, c) => (c >= 0 && RC_THEMES[L.region[c]]) || R.regionThemeNear(tx, ty);
    // Οι 4 πλευρές: 0 πάνω (−y), 1 κάτω (+y), 2 αριστερά (−x), 3 δεξιά (+x) — όπως στον raycaster.
    const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const JAGN = 4;
    for (let ty = -1; ty <= rows; ty++) {
      for (let tx = -1; tx <= cols; tx++) {
        if (!isWall(tx, ty)) continue;
        const inside = tx >= 0 && ty >= 0 && tx < cols && ty < rows;
        const c = inside ? ty * cols + tx : -1;
        const theme = themeAt(tx, ty, c);
        const kind = inside ? L.wallKind[c] : 0;
        const h = hAt(tx, ty);
        const variants = kind === 1 ? R.walls.drystone : kind === 2 ? R.walls.plaster : R.walls[theme] || R.walls.rock;
        for (let side = 0; side < 4; side++) {
          const [fdx, fdy] = SIDES[side];
          const nx = tx + fdx, ny = ty + fdy;
          const nIn = nx >= 0 && ny >= 0 && nx < cols && ny < rows;
          if (!nIn) continue;
          const neighborWall = isWall(nx, ny);
          let z0 = 0;
          if (neighborWall) {
            // Σκαλοπάτι: μόνο το κομμάτι πάνω από τον χαμηλότερο γείτονα (ένας ψηλός βράχος πίσω από έναν χαμηλό).
            const hn = hAt(nx, ny);
            if (hn >= h - 0.01) continue;
            z0 = hn;
          }
          const tex0 = variants[(((tx * 73856093) ^ (ty * 19349663) ^ (side * 83492791)) >>> 0) % variants.length];
          const texUp = !kind && (theme === 'palace' || theme === 'blocks') ? R.walls.blocks[0] : tex0;
          const segBase = inside && !neighborWall ? R.segBase[c * 4 + side] : -1;
          // Οι δύο άκρες της πλευράς στον κόσμο (u = 0 → 1 όπως το frac του raycaster: κατά x ή κατά y).
          let ax, ay, bx, by;
          if (side === 0) { ax = tx; ay = ty; bx = tx + 1; by = ty; }
          else if (side === 1) { ax = tx; ay = ty + 1; bx = tx + 1; by = ty + 1; }
          else if (side === 2) { ax = tx; ay = ty; bx = tx; by = ty + 1; }
          else { ax = tx + 1; ay = ty; bx = tx + 1; by = ty + 1; }
          // Γωνίες (για τη φωτεινή κάθετη ακμή): όπως στον raycaster.
          const adx = fdy !== 0 ? 1 : 0, ady = fdx !== 0 ? 1 : 0;
          const op = (x, y) => L.isOpaque(x, y);
          const c0 = !(op(tx - adx, ty - ady) && !op(tx - adx + fdx, ty - ady + fdy));
          const c1 = !(op(tx + adx, ty + ady) && !op(tx + adx + fdx, ty + ady + fdy));
          let flags = (c0 ? 1 : 0) + (c1 ? 2 : 0);
          const wf = inside && !neighborWall ? R.waterFace[c * 4 + side] : 0;
          flags += wf * 4;
          if (inside && c * 4 + side === R.exitKey) flags += 16;
          const A = [0, this.wallIdx.get(tex0), this.wallIdx.get(texUp), segBase];
          const B = [0, side, h, flags];
          const C = [nx, ny];
          // Βράχος: ακανόνιστη κορυφή (ο ίδιος θόρυβος με τον raycaster, συνεχής ανάμεσα στα κελιά).
          const jagged = !neighborWall && theme !== 'palace' && theme !== 'blocks' && !kind && h > 1.15;
          const n = jagged ? JAGN : 1;
          for (let k = 0; k < n; k++) {
            const u0 = k / n, u1 = (k + 1) / n;
            const top = (u) => {
              if (!jagged) return h;
              const along = side < 2 ? tx + u : ty + u;
              return h * (1 + RC_JAG * Math.min(1, h - 1) * (R.jag(along * 1.7 + side * 31.7) - 0.5) * 2);
            };
            const p0x = ax + (bx - ax) * u0, p0y = ay + (by - ay) * u0, p1x = ax + (bx - ax) * u1, p1y = ay + (by - ay) * u1;
            B[2] = Math.max(top(u0), top(u1));
            quad([[p0x, p0y, z0, u0], [p1x, p1y, z0, u1], [p1x, p1y, top(u1), u1], [p0x, p0y, top(u0), u0]], A, B, C);
          }
        }
        // Καπάκι στους χαμηλούς τοίχους (ξερολιθιά): τους βλέπεις από πάνω.
        if (inside && h < RC_EYE) {
          const t = this.wallIdx.get(variants[0]);
          quad([[tx, ty, h, 0], [tx + 1, ty, h, 1], [tx + 1, ty + 1, h, 1], [tx, ty + 1, h, 0]], [3, t, t, -1], [0, 1, h, 0], [tx, ty]);
        }
      }
    }
    // Δάπεδα, νερό, λάβα (το χάσμα μένει μαύρο, χωρίς πάτο), και ταβάνια στα στενά περάσματα.
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const c = ty * cols + tx;
        if (isWall(tx, ty)) continue;
        const t = L.terrain[c];
        if (t !== T_CHASM || R.gateAt[c] >= 0) {
          const water = t === T_WATER || R.gateAt[c] >= 0 ? 1 : 0;
          const fi = this.floorIdx.get(R.cellFloor[c]) || 0;
          quad([[tx, ty, 0, 0], [tx, ty + 1, 0, 0], [tx + 1, ty + 1, 0, 0], [tx + 1, ty, 0, 0]], [1, fi, fi, -1], [0, water, 0, 0], [tx, ty]);
        }
        if (R.ceilOn[c]) {
          const ci = this.floorIdx.get(R.cellCeil[c]) || 0;
          quad([[tx, ty, 1, 0], [tx + 1, ty, 1, 0], [tx + 1, ty + 1, 1, 0], [tx, ty + 1, 1, 0]], [2, ci, ci, -1], [0, 0, 0, 0], [tx, ty]);
        }
      }
    }
    const data = new Float32Array(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.count = data.length / 13;

    // Στο ύπαιθρο και οι ίδιοι οι βράχοι έχουν το φως της ημέρας (για τα σκαλοπάτια και τα καπάκια, που δεν
    // έχουν ελεύθερο κελί μπροστά τους).
    this.ambWall = new Float32Array(cols * rows);
    for (let c = 0; c < cols * rows; c++) {
      const o = L.opaque[c] ? RC_OUTDOOR[L.region[c]] || RC_OUTDOOR[L.regionAt(c % cols, Math.floor(c / cols) + 1)] : null;
      if (o) this.ambWall[c] = o.light;
    }
    // Σταθερά ανά κελί: ambient occlusion (R) και σημαίες (G: 1 λάβα, 2 αφρός).
    const info = new Uint8Array(cols * rows * 4);
    for (let c = 0; c < cols * rows; c++) {
      info[c * 4] = R.aoMask[c];
      info[c * 4 + 1] = (R.lava[c] ? 1 : 0) | (R.foam[c] ? 2 : 0);
      info[c * 4 + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex.info);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, info);
    this.cellData = new Uint8Array(cols * rows * 4);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.cell);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.cellData);
    const segH = Math.max(1, Math.ceil(L.segCount / GL_SEG_W));
    this.segData = new Uint8Array(GL_SEG_W * segH * 4);
    this.segSize = [GL_SEG_W, segH];
    gl.bindTexture(gl.TEXTURE_2D, this.tex.seg);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GL_SEG_W, segH, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.segData);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.rays);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GL_RAYS, GL_MAX_WAVES, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.rayData);
    this.builtFor = R._world;
  },

  resize(W, H) {
    if (!this.ok) return;
    this.W = W; this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
  },

  // Ένα καρέ: ίδια ορίσματα με το Raycast.render.
  render(pc, px, py, angle, now, bob) {
    const gl = this.gl, R = Raycast, L = Level, W = R.W, H = R.H;
    if (this.builtFor !== R._world) this.build();
    if (this.W !== W || this.H !== H) this.resize(W, H);

    // Η κάμερα (ίδια με του raycaster, για τις μορφές), το φως του καρέ, και το zbuf για τις μορφές.
    const posX = px / TILE, posY = py / TILE;
    const dirX = Math.cos(angle), dirY = Math.sin(angle);
    const plane = (W / 2) / R.focal;
    const hz = H * 0.5 + bob;
    Object.assign(R, { posX, posY, dirX, dirY, planeX: -dirY * plane, planeY: dirX * plane, horizon: hz });
    R.prepareLight(now);
    R.castZ();

    // Ανά καρέ: το φως κάθε κελιού (R), το σταθερό φως (B), οι πύλες κλειστές = νερό (A).
    const cols = L.cols, n = cols * L.rows, cd = this.cellData, cl = R.cellLight, amb = R.ambient;
    for (let c = 0; c < n; c++) {
      const i = c * 4;
      cd[i] = Math.min(255, (cl[c] / 1.5) * 255);
      cd[i + 2] = Math.min(255, (Math.max(amb[c], this.ambWall[c]) / 1.5) * 255);
      const g = R.gateAt[c];
      cd[i + 3] = g >= 0 && !L.gates[g].open ? 255 : 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex.cell);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, L.rows, gl.RGBA, gl.UNSIGNED_BYTE, cd);
    // Τα κομμάτια τοίχων: φως από τον ήχο + από τους βωμούς.
    const sd = this.segData;
    for (let i = 0; i < L.segCount; i++) {
      const v = R.segLight(i, now) + R.segExtra[i];
      sd[i * 4] = v > 0 ? Math.min(255, (v / 1.5) * 255) : 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex.seg);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.segSize[0], this.segSize[1], gl.RGBA, gl.UNSIGNED_BYTE, sd);
    // Τα κύματα και οι ακτίνες τους.
    const waves = new Float32Array(GL_MAX_WAVES * 4), wrays = new Float32Array(GL_MAX_WAVES);
    const rd = this.rayData;
    const list = Echoes.waves.slice(-GL_MAX_WAVES);
    list.forEach((w, i) => {
      waves.set([w.x, w.y, w.r, w._amp || 0], i * 4);
      wrays[i] = w.rays.length;
      for (let k = 0; k < w.rays.length; k++) {
        const d = Math.min(65535, Math.max(0, Math.round(w.rays[k])));
        const o = (i * GL_RAYS + k) * 4;
        rd[o] = d >> 8; rd[o + 1] = d & 255;
      }
    });
    gl.bindTexture(gl.TEXTURE_2D, this.tex.rays);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GL_RAYS, GL_MAX_WAVES, gl.RGBA, gl.UNSIGNED_BYTE, rd);
    const red = new Float32Array(GL_MAX_RED * 3);
    for (let k = 0, j = 0; k < R._redSrc.length && j < GL_MAX_RED; k += 3, j++) red.set([R._redSrc[k], R._redSrc[k + 1], R._redSrc[k + 2]], j * 3);

    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    const U = this.loc;
    gl.uniform3f(U.uEye, posX, posY, RC_EYE);
    gl.uniform2f(U.uDir, dirX, dirY);
    gl.uniform4f(U.uProj, (2 * R.focal) / W, (2 * R.focal) / H, 1 - (2 * hz) / H, 0);
    gl.uniform2f(U.uWorld, cols, L.rows);
    gl.uniform2f(U.uSegSize, this.segSize[0], this.segSize[1]);
    gl.uniform1f(U.uSegPer, R.segPer);
    gl.uniform2f(U.uWallAtlasSize, this.wallAtlasSize[0], this.wallAtlasSize[1]);
    gl.uniform2f(U.uFloorAtlasSize, this.floorAtlasSize[0], this.floorAtlasSize[1]);
    gl.uniform1f(U.uTime, now);
    gl.uniform1f(U.uFogDist, R.fogDist);
    gl.uniform1f(U.uFogMin, R.fogMin);
    gl.uniform1f(U.uFocal, R.focal);
    gl.uniform1f(U.uExitA, R.exitA);
    gl.uniform1f(U.uTile, TILE);
    gl.uniform1f(U.uRing, RC_RING);
    gl.uniform4fv(U.uWaves, waves);
    gl.uniform1fv(U.uWaveRays, wrays);
    gl.uniform3fv(U.uRed, red);
    const units = [['uWallAtlas', 'wall'], ['uFloorAtlas', 'floor'], ['uCell', 'cell'], ['uSeg', 'seg'], ['uRays', 'rays'], ['uInfo', 'info']];
    units.forEach(([u, t], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[t]);
      gl.uniform1i(U[u], i);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const stride = 13 * 4;
    const attr = (name, size, off) => {
      gl.enableVertexAttribArray(U[name]);
      gl.vertexAttribPointer(U[name], size, gl.FLOAT, false, stride, off * 4);
    };
    attr('aPos', 3, 0); attr('aA', 4, 3); attr('aB', 4, 7); attr('aC', 2, 11);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);

    // Στον μικρό καμβά: ο ουρανός (ύπαιθρο) ή σκοτάδι, και από πάνω ο κόσμος.
    const outdoor = RC_OUTDOOR[L.regionAt(Math.floor(px / TILE), Math.floor(py / TILE))];
    if (outdoor) {
      R.buf.fill(0xff000000);
      R.fillSky(outdoor, hz, angle);
      pc.putImageData(R.img, 0, 0);
    } else {
      pc.save();
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.fillStyle = '#000';
      pc.fillRect(0, 0, W, H);
      pc.restore();
    }
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalCompositeOperation = 'source-over';
    pc.globalAlpha = 1;
    pc.drawImage(this.canvas, 0, 0);
    pc.restore();
  },
};
