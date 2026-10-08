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
uniform vec2 uPitch;      // cos, sin της κλίσης του βλέμματος
varying vec3 vPos;
varying vec4 vA;
varying vec4 vB;
varying vec2 vC;
varying float vDepth;
void main() {
  vec2 d = aPos.xy - uEye.xy;
  float xc = dot(d, vec2(-uDir.y, uDir.x));
  // Η κάμερα γέρνει πάνω-κάτω (uPitch = cos, sin): αληθινή προοπτική, όχι μετατόπιση του ορίζοντα.
  float zc0 = dot(d, uDir), yc0 = aPos.z - uEye.z;
  float zc = zc0 * uPitch.x + yc0 * uPitch.y;
  float yc = yc0 * uPitch.x - zc0 * uPitch.y;
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
uniform float uReflect;       // 1 = δεύτερο πέρασμα: μόνο οι αντανακλάσεις στο νερό
uniform sampler2D uScene;     // ο κόσμος όπως ζωγραφίστηκε (αντίγραφο της οθόνης)
uniform sampler2D uCols;      // ανά στήλη: πού είναι η βάση / η κορυφή του πρώτου τοίχου (Raycast.castZ)
uniform vec2 uScreen;         // W, H
float colY(vec2 hl) { return (hl.x * 255.0 * 256.0 + hl.y * 255.0) / 16.0 - 1024.0; }

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
  if (uReflect > 0.5) {
    // Μόνο νερό (όχι λάβα): ο τοίχος από πάνω, καθρεφτισμένος γύρω από τη βάση του.
    if (vA.x > 1.5 || vA.x < 0.5 || vB.y < 0.5) discard;
    vec4 inf = texture2D(uInfo, (floor(vPos.xy) + 0.5) / uWorld);
    if (mod(inf.g * 255.0, 2.0) > 0.5) discard;
    float col = floor(gl_FragCoord.x);
    float y = uScreen.y - gl_FragCoord.y;
    vec4 cw = texture2D(uCols, vec2((col + 0.5) / uScreen.x, 0.5));
    float wb = colY(cw.rg), wt = colY(cw.ba);
    if (wb >= uScreen.y || y <= wb) discard;
    float my = floor(2.0 * wb - y + 0.5);
    if (my < 0.0 || my < wt) discard;
    float mx = clamp(col + floor(sin(vPos.y * 14.0 + uTime * 2.2) * 1.2 + 0.5), 0.0, uScreen.x - 1.0);
    vec3 c = texture2D(uScene, vec2((mx + 0.5) / uScreen.x, 1.0 - (my + 0.5) / uScreen.y)).rgb;
    float k = 0.45 * max(0.0, 1.0 - (y - wb) / (wb - wt + 1.0));
    gl_FragColor = vec4(c * k, 0.0);
    return;
  }
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
      for (const n of ['uEye', 'uDir', 'uProj', 'uPitch', 'uWallAtlas', 'uFloorAtlas', 'uCell', 'uSeg', 'uRays', 'uInfo', 'uWorld', 'uSegSize',
        'uSegPer', 'uWallAtlasSize', 'uFloorAtlasSize', 'uTime', 'uFogDist', 'uFogMin', 'uFocal', 'uExitA', 'uTile', 'uWaves',
        'uWaveRays', 'uRed', 'uRing', 'uReflect', 'uScene', 'uCols', 'uScreen']) this.loc[n] = gl.getUniformLocation(p, n);
      this.vbo = gl.createBuffer();
      this.tex = {};
      for (const n of ['wall', 'floor', 'cell', 'seg', 'rays', 'info', 'scene', 'cols']) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.tex[n] = t;
      }
      this.rayData = new Uint8Array(GL_RAYS * GL_MAX_WAVES * 4);
      this.initSprites();
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
    const v = [], waterV = [];
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
          // (τα νερά και σε δική τους λίστα, για το πέρασμα των αντανακλάσεων)
          if (water && !R.lava[c]) waterV.push(...v.slice(v.length - 6 * 13));
        }
        if (R.ceilOn[c]) {
          const ci = this.floorIdx.get(R.cellCeil[c]) || 0;
          quad([[tx, ty, 1, 0], [tx + 1, ty, 1, 0], [tx + 1, ty + 1, 1, 0], [tx, ty + 1, 1, 0]], [2, ci, ci, -1], [0, 0, 0, 0], [tx, ty]);
        }
      }
    }
    if (!this.wvbo) this.wvbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wvbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(waterV), gl.STATIC_DRAW);
    this.waterCount = waterV.length / 13;
    this.hasWater = this.waterCount > 0;
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
    const pitch = Math.atan(bob / R.focal);
    const hz = H * 0.5;
    Object.assign(R, { posX, posY, dirX, dirY, planeX: -dirY * plane, planeY: dirX * plane, horizon: hz, pc: Math.cos(pitch), ps: Math.sin(pitch) });
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
    gl.uniform2f(U.uPitch, R.pc, R.ps);
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
    gl.uniform1f(U.uReflect, 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);

    // Οι αντανακλάσεις στο νερό: αντίγραφο της οθόνης, και ξανά τα νερά με προσθετικό φως (χωρίς εγγραφή βάθους).
    if (this.hasWater) {
      const cols = this.colData && this.colData.length === W * 4 ? this.colData : (this.colData = new Uint8Array(W * 4));
      for (let x = 0; x < W; x++) {
        const enc = (y) => Math.max(0, Math.min(65535, Math.round((y + 1024) * 16)));
        const b = enc(R.zbuf[x] < RC_MAX ? R.wallBot[x] : 1e4), t = enc(R.wallTop[x]);
        cols[x * 4] = b >> 8; cols[x * 4 + 1] = b & 255; cols[x * 4 + 2] = t >> 8; cols[x * 4 + 3] = t & 255;
      }
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, this.tex.cols);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, cols);
      gl.uniform1i(U.uCols, 7);
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, this.tex.scene);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, W, H, 0);
      gl.uniform1i(U.uScene, 6);
      gl.uniform2f(U.uScreen, W, H);
      gl.uniform1f(U.uReflect, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.wvbo);
      attr('aPos', 3, 0); attr('aA', 4, 3); attr('aB', 4, 7); attr('aC', 2, 11);
      gl.drawArrays(gl.TRIANGLES, 0, this.waterCount);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.uniform1f(U.uReflect, 0);
    }

    // Οι μορφές (Raycast.sprite) μπαίνουν από πάνω στο ίδιο WebGL (με το βάθος του κόσμου) στο flushSprites,
    // και μετά όλα μαζί στον μικρό καμβά (composite).
    this.pending = { outdoor: RC_OUTDOOR[L.regionAt(Math.floor(px / TILE), Math.floor(py / TILE))], hz: hz + bob, angle };
  },

  // Στον μικρό καμβά: ο ουρανός (ύπαιθρο) ή σκοτάδι, και από πάνω ο κόσμος (και οι μορφές) του WebGL.
  composite(pc) {
    const pd = this.pending, R = Raycast, W = R.W, H = R.H;
    if (!pd) return;
    this.pending = null;
    if (pd.outdoor) {
      R.buf.fill(0xff000000);
      R.fillSky(pd.outdoor, pd.hz, pd.angle);
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

  // ---- Στάδιο 2: οι μορφές (billboards) μέσα στο WebGL ----
  // Κάθε Raycast.sprite γίνεται ένα τετράγωνο που κοιτάζει την κάμερα, στη θέση του στον κόσμο, με το βάθος του
  // κόσμου: κρύβεται σωστά πίσω από χαμηλούς τοίχους, σκαλοπάτια, κάγκελα (ανά pixel, όχι ανά στήλη όπως πριν).
  // Τα "τορνευτά" αντικείμενα (αμφορείς, λήκυθοι, σταλαγμίτες, πέτρες...) γίνονται αληθινά 3D σώματα εκ
  // περιστροφής από τη ζωγραφιά τους (lathe), με φως από το πλάι — φαίνονται στρογγυλά από κάθε γωνία.
  // Οι λάμψεις (glow) και ό,τι ζωγραφίζεται πάνω στις μορφές (after: μάτια, εικονίδια) μένουν στο 2D, μετά.
  initSprites() {
    const gl = this.gl;
    const vs = `
attribute vec3 aPos;
attribute vec4 aUV;       // u, v, άλφα, φωτεινότητα (lathe: σκίαση από το πλάι)
uniform vec3 uEye;
uniform vec2 uDir;
uniform vec4 uProj;
uniform vec2 uPitch;
varying vec4 vUV;
void main() {
  vec2 d = aPos.xy - uEye.xy;
  float xc = dot(d, vec2(-uDir.y, uDir.x));
  // Η κάμερα γέρνει πάνω-κάτω (uPitch = cos, sin): αληθινή προοπτική, όχι μετατόπιση του ορίζοντα.
  float zc0 = dot(d, uDir), yc0 = aPos.z - uEye.z;
  float zc = zc0 * uPitch.x + yc0 * uPitch.y;
  float yc = yc0 * uPitch.x - zc0 * uPitch.y;
  float n = 0.02, f = 60.0;
  gl_Position = vec4(uProj.x * xc, uProj.y * yc + uProj.z * zc, zc * (f + n) / (f - n) - 2.0 * f * n / (f - n), zc);
  vUV = aUV;
}`;
    const fs = `
precision mediump float;
varying vec4 vUV;
uniform sampler2D uTex;
uniform float uCut;
void main() {
  vec4 c = texture2D(uTex, vUV.xy);
  if (c.a < uCut) discard;
  gl_FragColor = vec4(c.rgb * vUV.w * vUV.z, c.a * vUV.z);
}`;
    const sh = (type, src) => {
      const o = gl.createShader(type);
      gl.shaderSource(o, src);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.sprog = p;
    this.sloc = {};
    for (const n of ['aPos', 'aUV']) this.sloc[n] = gl.getAttribLocation(p, n);
    for (const n of ['uEye', 'uDir', 'uProj', 'uPitch', 'uTex', 'uCut']) this.sloc[n] = gl.getUniformLocation(p, n);
    this.svbo = gl.createBuffer();
    // Τα 3D μοντέλα: θέση, κάθετο διάνυσμα, χρώμα (+ "λάμπει μόνο του"). Φως από την πλευρά της κάμερας και
    // λίγο από πάνω (σαν τις μορφές), και στις δύο όψεις των τριγώνων.
    const mvs = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec4 aCol;
uniform vec3 uEye;
uniform vec2 uDir;
uniform vec4 uProj;
uniform vec2 uPitch;
varying vec3 vN;
varying vec4 vCol;
void main() {
  vec2 d = aPos.xy - uEye.xy;
  float xc = dot(d, vec2(-uDir.y, uDir.x));
  float zc0 = dot(d, uDir), yc0 = aPos.z - uEye.z;
  float zc = zc0 * uPitch.x + yc0 * uPitch.y;
  float yc = yc0 * uPitch.x - zc0 * uPitch.y;
  float n = 0.02, f = 60.0;
  gl_Position = vec4(uProj.x * xc, uProj.y * yc + uProj.z * zc, zc * (f + n) / (f - n) - 2.0 * f * n / (f - n), zc);
  vN = aNorm; vCol = aCol;
}`;
    const mfs = `
precision mediump float;
varying vec3 vN;
varying vec4 vCol;
uniform vec3 uLight;
uniform float uAlpha, uGhost, uAmb;
void main() {
  // Ομαλή σκίαση: κύριο φως από την πλευρά της κάμερας / πάνω, λίγο φως και από πίσω (ώστε να μη γίνεται μαύρο).
  float d = dot(normalize(vN), uLight);
  float l = uAmb + 0.82 * max(d, 0.0) + 0.14 * max(-d, 0.0);
  vec3 c = (vCol.a > 0.5 || uGhost > 0.5) ? vCol.rgb : vCol.rgb * l;
  gl_FragColor = vec4(c * uAlpha, uAlpha);
}`;
    const mp = gl.createProgram();
    gl.attachShader(mp, sh(gl.VERTEX_SHADER, mvs));
    gl.attachShader(mp, sh(gl.FRAGMENT_SHADER, mfs));
    gl.linkProgram(mp);
    if (!gl.getProgramParameter(mp, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(mp));
    this.mprog = mp;
    this.mloc = {};
    for (const n of ['aPos', 'aNorm', 'aCol']) this.mloc[n] = gl.getAttribLocation(mp, n);
    for (const n of ['uEye', 'uDir', 'uProj', 'uPitch', 'uLight', 'uAlpha', 'uGhost', 'uAmb']) this.mloc[n] = gl.getUniformLocation(mp, n);
    this.mvbo = gl.createBuffer();
    this.mcache = new Map();      // τα ακίνητα σκηνικά: τρίγωνα στον κόσμο, μία φορά
    this.track = new WeakMap();    // ανά χαρακτήρα: προς τα πού πηγαίνει και πόσο γρήγορα (για το γύρισμα και το βάδισμα)
    this.stex = new WeakMap();     // καμβάς → υφή WebGL
    this.lathes = {};              // όνομα sprite → πλέγμα τορνευτού σώματος
  },

  // Η υφή ενός καμβά (μία φορά· οι καμβάδες που ξαναζωγραφίζονται κάθε καρέ — με _dyn — ξανά κάθε καρέ).
  texFor(cv) {
    const gl = this.gl;
    let t = this.stex.get(cv);
    if (t && !cv._dyn) return t.tex;
    if (!t) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      t = { tex, frame: -1 };
      this.stex.set(cv, t);
    }
    if (t.frame !== this.frameNo) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      t.frame = this.frameNo;
    }
    return t.tex;
  },

  // Σώμα εκ περιστροφής από τη ζωγραφιά ενός sprite: για κάθε γραμμή, η μισή της πλάτος γίνεται ακτίνα· η υφή
  // απλώνεται γύρω γύρω (η μπροστινή όψη της ζωγραφιάς μπροστά και πίσω). Σε μονάδες "1 = ύψος", κέντρο στη βάση.
  latheFor(fr) {
    const key = fr.name;
    if (this.lathes[key] !== undefined) return this.lathes[key];
    const cv = fr.c, w = cv.width, h = cv.height;
    const data = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const rows = [];
    const step = Math.max(1, Math.round(h / 24));
    for (let y = 0; y < h; y += step) {
      let l = -1, r = -1;
      for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 100) { if (l < 0) l = x; r = x; }
      rows.push(l < 0 ? null : { y, l, r });
    }
    const N = 12, tris = [];
    const cx = w / 2;
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i], b = rows[i + 1];
      if (!a || !b) continue;
      const ra = Math.max(Math.abs(a.l - cx), Math.abs(a.r + 1 - cx)) / h, rb = Math.max(Math.abs(b.l - cx), Math.abs(b.r + 1 - cx)) / h;
      const za = 1 - a.y / h, zb = 1 - b.y / h;
      for (let k = 0; k < N; k++) {
        const t0 = (k / N) * Math.PI * 2, t1 = ((k + 1) / N) * Math.PI * 2;
        // υφή: η ζωγραφιά "τυλίγεται": u από το κέντρο προς τις άκρες όπως φαίνεται από μπροστά (|sin|)
        const u = (t, rr) => (cx + Math.sin(t) * rr * h) / w;
        const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        const P = (c, s2, rr, z, t) => [c * rr, s2 * rr, z, u(t, rr), 1 - z, c, s2];
        const p00 = P(c0, s0, ra, za, t0), p10 = P(c1, s1, ra, za, t1), p01 = P(c0, s0, rb, zb, t0), p11 = P(c1, s1, rb, zb, t1);
        tris.push(p00, p10, p11, p00, p11, p01);
      }
    }
    const res = tris.length ? { tris, aspect: w / h } : null;
    this.lathes[key] = res;
    return res;
  },

  // Τα 3D μοντέλα: προς τα πού κοιτάζουν (από την κίνησή τους, ή προς την κάμερα, ή o.yaw), η στάση τους
  // (βάδισμα, γαβγίσματα, ξαπλωμένος, κάθεται / γέρνει), και ζωγράφισμα. solid = αδιαφανή (γράφουν βάθος).
  drawModels(list, solid) {
    if (!list.length) return;
    const gl = this.gl, R = Raycast, W = R.W, H = R.H, U = this.mloc;
    gl.useProgram(this.mprog);
    gl.uniform3f(U.uEye, R.posX, R.posY, RC_EYE);
    gl.uniform2f(U.uDir, R.dirX, R.dirY);
    gl.uniform4f(U.uProj, (2 * R.focal) / W, (2 * R.focal) / H, 1 - (2 * R.horizon) / H, 0);
    gl.uniform2f(U.uPitch, R.pc, R.ps);
    const rx = -R.dirY, ry = R.dirX;
    const L = [-R.dirX * 0.6 - rx * 0.35, -R.dirY * 0.6 - ry * 0.35, 0.7], ll = Math.hypot(...L);
    gl.uniform3f(U.uLight, L[0] / ll, L[1] / ll, L[2] / ll);
    // Στο ύπαιθρο (μέρα) περισσότερο φως από παντού.
    const outd = typeof Level !== 'undefined' && RC_OUTDOOR[Level.regionAt(Math.floor(R.posX), Math.floor(R.posY))];
    gl.uniform1f(U.uAmb, outd ? 0.3 + 0.35 * outd.light : 0.3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mvbo);
    gl.enableVertexAttribArray(U.aPos);
    gl.enableVertexAttribArray(U.aNorm);
    gl.enableVertexAttribArray(U.aCol);
    gl.vertexAttribPointer(U.aPos, 3, gl.FLOAT, false, 40, 0);
    gl.vertexAttribPointer(U.aNorm, 3, gl.FLOAT, false, 40, 12);
    gl.vertexAttribPointer(U.aCol, 4, gl.FLOAT, false, 40, 24);
    gl.depthMask(solid);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const now = typeof gameTime !== 'undefined' ? gameTime : performance.now() / 1000;
    if (!solid) list.sort((a, b) => b.depth - a.depth);
    for (const m of list) {
      const o = m.o, ent = o.ent;
      // Προς τα πού κοιτάζει: η κίνησή του (ομαλά), αλλιώς o.yaw, αλλιώς προς την κάμερα.
      let yaw = o.yaw, walk = 0, tr = null;
      const toCam = Math.atan2(R.posY - m.y, R.posX - m.x);
      if (ent) {
        tr = this.track.get(ent);
        if (!tr) { tr = { x: ent.x, y: ent.y, yaw: toCam, speed: 0, phase: 0, f: this.frameNo }; this.track.set(ent, tr); }
        if (tr.f !== this.frameNo) {
          const dx = ent.x - tr.x, dy = ent.y - tr.y, d = Math.hypot(dx, dy);
          tr.speed += (Math.min(1, d / 2) - tr.speed) * 0.2;
          if (d > 0.15) {
            let da = Math.atan2(dy, dx) - tr.yaw;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            tr.yaw += da * 0.25;
          } else if (tr.speed < 0.05 && !ent.boss && ent.kind === undefined) {
            // (μορφές που στέκονται, π.χ. η Ευρυδίκη: γυρίζουν σιγά σιγά προς εσένα)
            let da = toCam - tr.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); tr.yaw += da * 0.05;
          }
          tr.phase += d * 0.16;
          tr.x = ent.x; tr.y = ent.y; tr.f = this.frameNo;
        }
        if (ent.boss) tr.yaw = ent.facing !== undefined && ['windup', 'charge', 'prowl'].includes(ent.bstate) ? ent.facing : tr.yaw;
        yaw = tr.yaw;
        walk = tr.speed;
      }
      const stat = MODEL_STATIC.has(m.name);
      if (yaw === undefined && stat) yaw = MHASH(m.x * 3.1, m.y * 1.7) * Math.PI * 2;
      if (m.name === 'obol' || m.name === 'stringCoil') yaw = now * 2.2;
      if (yaw === undefined) yaw = m.name === 'boat3d' ? toCam + Math.PI / 2 : toCam;
      if (m.name === 'euryLying') yaw = 0.6;
      const frameIdx = Math.max(0, (Sprites.hdFrames[m.frame.name] || []).indexOf(m.frame));
      // Τα ακίνητα σκηνικά: τα τρίγωνά τους φτιάχνονται μία φορά (cache) — δεν κινούνται.
      if (stat) {
        const key = m.name + '|' + frameIdx + '|' + m.x.toFixed(2) + '|' + m.y.toFixed(2) + '|' + m.z.toFixed(2) + '|' + m.h.toFixed(3) + '|' + (m.frame.dim || 1) + '|' + yaw.toFixed(2);
        let arr = this.mcache.get(key);
        if (!arr) {
          const out = [];
          Models.emit(m.name, { x: m.x, y: m.y, z: m.z }, yaw, m.h, Models.pose(m.name, { t: 0, walk: 0, phase: 0, frame: frameIdx }), out, m.frame.dim || 1);
          arr = new Float32Array(out);
          if (this.mcache.size > 3000) this.mcache.clear();
          this.mcache.set(key, arr);
        }
        gl.uniform1f(U.uAlpha, m.alpha);
        gl.uniform1f(U.uGhost, 0);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, arr.length / 10);
        continue;
      }
      const pose = Models.pose(m.name, {
        t: now + (m.x * 7.1 + m.y * 3.3) % 10, walk: m.name === 'cerberus' && ent && ent.bstate === 'charge' ? 1 : walk,
        phase: tr ? tr.phase : now * 4, frame: frameIdx, scare: m.scare || 0,
        bark: m.frame.bark ? m.frame.bark.map(Number) : null,
        lie: ent && ['tired', 'lulled', 'asleep'].includes(ent.bstate), asleep: ent && ent.asleep >= 3, sleepHeads: ent ? ent.asleep : 0,
      });
      // (το "frame" των sprites: η Περσεφόνη που γέρνει, ο Χάροντας που ζητάει τον οβολό, το φίδι που σφυρίζει)
      if (m.name === 'persephone3d' && typeof Throne !== 'undefined' && Throne.lean) pose.body = [0, 0.32];
      if (m.name === 'charon3d' && typeof Charon !== 'undefined' && !Charon.paid) pose.armL = [-1.2, 0];
      const out = [];
      Models.emit(m.name, { x: m.x, y: m.y, z: m.z }, yaw, m.h, pose, out, m.frame.dim || 1);
      gl.uniform1f(U.uAlpha, m.alpha);
      gl.uniform1f(U.uGhost, MODEL_GHOST.has(m.name) ? 1 : 0);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, out.length / 10);
    }
    gl.disableVertexAttribArray(U.aNorm);
    gl.disableVertexAttribArray(U.aCol);
    gl.depthMask(true);
  },

  // ---- Το jump scare με το 3D μοντέλο του τέρατος (js/scare.js το καλεί όταν ζωγραφίζει το WebGL) ----
  // Το τέρας ορμάει από το βάθος ως ακριβώς μπροστά στα μάτια σου, ανοίγει το στόμα / τα σαγόνια, απλώνει τα χέρια
  // (ή χτυπάει τα φτερά). Ζωγραφίζεται στον καμβά του WebGL (διάφανο φόντο)· επιστρέφει πού πέφτουν τα μάτια του.
  renderScare(kind, t, lunge, shakeX, shakeY) {
    if (!this.ok) return null;
    const gl = this.gl, R = Raycast, W = R.W, H = R.H;
    if (this.W !== W || this.H !== H) this.resize(W, H);
    if (!this.sprog) this.initSprites();
    const name = { shade: 'ghoul', erinys: 'erinys3d', cerberus: 'cerberus' }[kind] || 'ghoul';
    const spec = { ghoul: [0.72, 0.84, 0.25], erinys3d: [0.78, 0.93, 0.05], cerberus: [0.9, 0.88, 1.0] }[name];   // ύψος (κελιά), ύψος προσώπου, μπροστά
    const save = {};
    for (const k of ['posX', 'posY', 'dirX', 'dirY', 'planeX', 'planeY', 'horizon', 'pc', 'ps']) save[k] = R[k];
    const plane = (W / 2) / R.focal;
    Object.assign(R, { posX: 0, posY: 0, dirX: 1, dirY: 0, planeX: 0, planeY: plane, horizon: H / 2, pc: 1, ps: 0 });
    const h = spec[0], face = spec[1] * h;
    const d = 2.8 - 2.62 * lunge + spec[2] * h;                // η μουσούδα του σκύλου είναι πιο μπροστά από το κεφάλι
    const m = { name, x: d + shakeX * 0.004, y: shakeY * 0.004, z: RC_EYE - face, h, alpha: 1, depth: d, o: { yaw: Math.PI }, frame: { name: '' },
      scare: t < 0.13 ? 0.2 : t < 0.22 ? 0.6 : 1 };
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    this.frameNo = (this.frameNo || 0) + 1;
    this.drawModels([m], true);
    gl.disable(gl.BLEND);
    // Τα μάτια (για τη λάμψη τους): από το μοντέλο, χωρίς τη στάση.
    const eyes = [].map(([ex, ey, ez]) => {
      const wx = m.x - ey * h, wy = m.y - ex * h;              // yaw = π: μπροστά = −x, δεξιά = −y
      const p = R.project(wx * TILE, wy * TILE, (m.z + ez * h) * TILE);
      return p ? [p.sx, p.sy] : null;
    }).filter(Boolean);
    Object.assign(R, save);
    return { canvas: this.canvas, eyes };
  },

  // Αντί για το Raycast.flushSprites όταν ζωγραφίζει το WebGL.
  flushSprites(pc) {
    const gl = this.gl, R = Raycast, list = R.sprites;
    this.frameNo = (this.frameNo || 0) + 1;
    if (!this.sprog) this.initSprites();
    const W = R.W, H = R.H;
    const rx = -R.dirY, ry = R.dirX;           // το "δεξιά" της κάμερας (κελιά)
    const opaque = [], blend = [], models = [];
    const boxes = [];
    for (const it of list) {
      const { frame, o, p } = it;
      const k = R.focal / (p.depth * TILE);
      const fog = o.fog === false ? 1 : Math.max(R.fogMin + 0.05, 1 - (p.depth * TILE) / R.fogDist);
      const alpha = Math.max(0, Math.min(1, (o.alpha === undefined ? 1 : o.alpha) * fog));
      if (alpha < 0.01) continue;
      const fh = frame ? frame.h : 1, fw = frame ? frame.w : 1;
      const real = !o.h && frame && frame.name && RC_REAL_H[frame.name];
      const hu = o.h || (real ? real * (o.size || 1) : (fh / ((frame && frame.hd) || 1)) * RC_SPX * (o.scale || 1));   // ύψος σε μονάδες
      const pb = R.project(o.x, o.y, o.z || 0), pt = R.project(o.x, o.y, (o.z || 0) + hu);
      const sx = pb ? pb.sx : p.sx, bottom = pb ? pb.sy : R.horizon;
      const hpx = pt && pb ? Math.max(1, pb.sy - pt.sy) : hu * k, wpx = (hu * k * fw) / fh;
      boxes.push({ o, p, box: { left: Math.round(sx - wpx / 2), top: Math.round(bottom - hpx), w: wpx, h: hpx, k, sx, depth: p.depth, alpha } });
      if (!frame) continue;
      const mname = frame.name && MODEL_OF[frame.name];
      if (mname && Settings.models !== 'off') {
        boxes[boxes.length - 1].box.model = true;
        models.push({ name: mname, o, frame, x: o.x / TILE, y: o.y / TILE, z: (o.z || 0) / TILE, h: hu / TILE, alpha, depth: p.depth });
        continue;
      }
      const cv = o.flip ? frame.f : frame.c;
      const e = { cv, flip: false, o, x: o.x / TILE, y: o.y / TILE, z: (o.z || 0) / TILE, h: hu / TILE, w: (hu / TILE) * (fw / fh), alpha, depth: p.depth - (o.bias || 0) };
      // Τορνευτό αντικείμενο: αληθινό 3D σώμα (μόνο για τα στρογγυλά αντικείμενα, όχι μορφές / λάμψεις).
      if (!o.add && frame.name && GL_LATHE.has(frame.name)) e.lathe = this.latheFor(frame);
      if (o.add || alpha < 0.995) blend.push(e); else opaque.push(e);
    }
    blend.sort((a, b) => b.depth - a.depth);

    gl.useProgram(this.sprog);
    const U = this.sloc;
    gl.uniform3f(U.uEye, R.posX, R.posY, RC_EYE);
    gl.uniform2f(U.uDir, R.dirX, R.dirY);
    gl.uniform2f(U.uPitch, R.pc, R.ps);
    gl.uniform4f(U.uProj, (2 * R.focal) / W, (2 * R.focal) / H, 1 - (2 * R.horizon) / H, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(U.uTex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.svbo);
    gl.enableVertexAttribArray(U.aPos);
    gl.enableVertexAttribArray(U.aUV);
    gl.vertexAttribPointer(U.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(U.aUV, 4, gl.FLOAT, false, 28, 12);
    // (οι υπόλοιπες θέσεις του προγράμματος του κόσμου μένουν ανοιχτές· τις κλείνουμε για να μη διαβάζουν)
    for (const n of ['aA', 'aB', 'aC']) if (this.loc[n] >= 0 && this.loc[n] !== U.aPos && this.loc[n] !== U.aUV) gl.disableVertexAttribArray(this.loc[n]);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    const draw = (e) => {
      const v = [];
      if (e.lathe) {
        // Σκίαση: το φως έρχεται από την κάμερα και λίγο από πάνω-αριστερά (σαν τις μορφές).
        const lx = -R.dirX * 0.8 - rx * 0.4, ly = -R.dirY * 0.8 - ry * 0.4;
        for (const t of e.lathe.tris) {
          const nd = Math.max(0, t[5] * lx + t[6] * ly);
          v.push(e.x + t[0] * e.h, e.y + t[1] * e.h, e.z + t[2] * e.h, t[3], t[4], e.alpha, 0.45 + 0.65 * nd);
        }
      } else {
        const hw = e.w / 2;
        const ax = e.x - rx * hw, ay = e.y - ry * hw, bx = e.x + rx * hw, by = e.y + ry * hw;
        const z0 = e.z, z1 = e.z + e.h;
        const q = [[ax, ay, z0, 0, 1], [bx, by, z0, 1, 1], [bx, by, z1, 1, 0], [ax, ay, z1, 0, 0]];
        for (const i of [0, 1, 2, 0, 2, 3]) v.push(q[i][0], q[i][1], q[i][2], q[i][3], q[i][4], e.alpha, 1);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texFor(e.cv));
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, v.length / 7);
    };
    // Πρώτα οι αδιαφανείς (με εγγραφή βάθους, τα διάφανα pixels κόβονται), μετά οι διάφανες / φωτεινές από τις
    // πιο μακρινές προς τις πιο κοντινές (χωρίς εγγραφή βάθους).
    gl.depthMask(true);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(U.uCut, 0.5);
    for (const e of opaque) draw(e);
    // Τα 3D μοντέλα (αδιαφανή με βάθος· τα φαντάσματα / όσα σβήνουν, διάφανα, μαζί με τα υπόλοιπα διάφανα).
    const ghosts = this.drawModels(models.filter((m) => m.alpha >= 0.995 && !MODEL_GHOST.has(m.name)), true);
    gl.useProgram(this.sprog);
    gl.enableVertexAttribArray(U.aPos);
    gl.enableVertexAttribArray(U.aUV);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.svbo);
    gl.vertexAttribPointer(U.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(U.aUV, 4, gl.FLOAT, false, 28, 12);
    void ghosts;
    gl.depthMask(false);
    gl.uniform1f(U.uCut, 0.02);
    for (const e of blend) {
      gl.blendFunc(gl.ONE, e.o.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      draw(e);
    }
    this.drawModels(models.filter((m) => m.alpha < 0.995 || MODEL_GHOST.has(m.name)), false);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    this.composite(pc);

    // Από πάνω, σε 2D: οι λάμψεις και ό,τι ζωγραφίζεται πάνω στις μορφές (μάτια, εικονίδια).
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.imageSmoothingEnabled = false;
    for (const { o, p, box } of boxes) {
      if (o.glow) {
        const g = o.glow, k = box.k, fog = o.fog === false ? 1 : Math.max(R.fogMin + 0.05, 1 - (p.depth * TILE) / R.fogDist);
        const cy = box.top + box.h * (g.cy === undefined ? 0.5 : g.cy), gx = box.sx;
        if (R.visible(gx, p.depth - 0.3)) {
          const Rr = Math.max(1, g.r * k);
          const gr = pc.createRadialGradient(gx, cy, 0, gx, cy, Rr);
          gr.addColorStop(0, 'rgba(' + g.color + ',' + (g.a * fog).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(' + g.color + ',0)');
          pc.globalAlpha = 1;
          pc.globalCompositeOperation = 'lighter';
          pc.fillStyle = gr;
          pc.fillRect(gx - Rr, cy - Rr, Rr * 2, Rr * 2);
        }
      }
      if (o.after) {
        pc.globalAlpha = 1;
        pc.globalCompositeOperation = 'source-over';
        o.after(pc, box);
      }
    }
    pc.restore();
    list.length = 0;
  },
};

// Τα αντικείμενα που γίνονται αληθινά 3D σώματα εκ περιστροφής (στρογγυλά από κάθε γωνία).
const GL_LATHE = new Set(['amphora', 'lekythos', 'stalagmite', 'stalactite', 'bell', 'well', 'boulder']);
