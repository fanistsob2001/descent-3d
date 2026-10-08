'use strict';

// Τα 3D μοντέλα (WebGL στάδιο 4, ξαναφτιαγμένα πιο λεπτομερή στο στάδιο 5): χαρακτήρες, τέρατα, δέντρα, έπιπλα,
// αντικείμενα — χωρίς αρχεία, χτισμένα εδώ από απλά σχήματα με ΟΜΑΛΑ κάθετα διανύσματα (σωλήνες, ελλειψοειδή,
// σώματα εκ περιστροφής με ελλειπτική διατομή, κουτιά, τρίγωνα). Χρώματα από την παλέτα των sprites (SPR_PAL).
// Κάθε μοντέλο έχει ύψος 1 (στον κόσμο: RC_REAL_H / o.h), κοιτάζει προς +y, x δεξιά, z πάνω. Τα κομμάτια έχουν
// "κόκαλο" με σημείο περιστροφής (Models.pivots): πόδια, χέρια, κεφάλι, σαγόνι, φτερά, φίδια, ουρά, καπάκι.
// Η μηχανή WebGL (js/gl3d.js) βάζει τα μοντέλα στη θέση των sprites που έχουν όνομα στο MODEL_OF, και τα
// χρησιμοποιεί και στα jump scares (GL3D.drawScare).

const MC = (k) => SPR_PAL[k].split(',').map((v) => Number(v) / 255);
const MCOL = (r, g, b) => [r / 255, g / 255, b / 255];
const MMUL = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// Σταθερός "θόρυβος" (για τις σκισμένες άκρες, τα φύλλα, τις πέτρες).
const MHASH = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

const Models = {
  defs: {},
  pivots: {},

  // ---- Σχήματα. Κάθε κορυφή = [x, y, z, nx, ny, nz]. Επιστρέφουν λίστες τριγώνων· με "seg" (ποια πλευρά γύρω
  // γύρω) για τις πτυχώσεις των ρούχων. ----
  _norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; },

  // Σωλήνας από το a ως το b (ακτίνες r0 → r1), n πλευρές, με καπάκια.
  tube(a, b, r0, r1, n = 8) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...d) || 1e-6;
    const w = d.map((v) => v / L);
    const t = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = this._norm([w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]]);
    const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    const slope = (r0 - r1) / L;
    const P = (c, r, k) => {
      const ang = (k / n) * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang);
      const rad = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn];
      const nn = this._norm([rad[0] + w[0] * slope, rad[1] + w[1] * slope, rad[2] + w[2] * slope]);
      return [c[0] + rad[0] * r, c[1] + rad[1] * r, c[2] + rad[2] * r, ...nn];
    };
    const tris = [];
    const wn = [-w[0], -w[1], -w[2]];
    for (let k = 0; k < n; k++) {
      const p0 = P(a, r0, k), p1 = P(a, r0, k + 1), q0 = P(b, r1, k), q1 = P(b, r1, k + 1);
      tris.push(Object.assign([p0, p1, q1], { seg: k }), Object.assign([p0, q1, q0], { seg: k }));
      if (r0 > 0.002) tris.push([[...a, ...wn], [...p1.slice(0, 3), ...wn], [...p0.slice(0, 3), ...wn]]);
      if (r1 > 0.002) tris.push([[...b, ...w], [...q0.slice(0, 3), ...w], [...q1.slice(0, 3), ...w]]);
    }
    return tris;
  },

  // Ελλειψοειδές: κέντρο c, ακτίνες r = [rx, ry, rz]. jag = ανωμαλία στην επιφάνεια (πέτρες, φύλλα).
  ball(c, r, n = 10, m = 7, jag = 0, seed = 0) {
    const P = (i, j) => {
      const th = (i / n) * Math.PI * 2, ph = (j / m) * Math.PI - Math.PI / 2;
      const k = jag ? 1 + (MHASH(i % n + seed, j + seed * 3) - 0.5) * jag * (j === 0 || j === m ? 0 : 1) : 1;
      const d = [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
      const nn = this._norm([d[0] / r[0], d[1] / r[1], d[2] / r[2]]);
      return [c[0] + d[0] * r[0] * k, c[1] + d[1] * r[1] * k, c[2] + d[2] * r[2] * k, ...nn];
    };
    const tris = [];
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
        if (j > 0) tris.push(Object.assign([a, b, cc], { seg: i }));
        if (j < m - 1) tris.push(Object.assign([a, cc, d], { seg: i }));
      }
    }
    return tris;
  },

  // Σώμα εκ περιστροφής (κατακόρυφο): prof = [[z, rx, ry, cy?], ...] από κάτω προς τα πάνω — ελλειπτικές διατομές.
  // o = { n, jag (σκισμένη κάτω άκρη), arc: [a0, a1] (μόνο κομμάτι του κύκλου), axis: 'y' (οριζόντιο, κατά μήκος
  // του y: τότε το prof = [[y, rx, rz, cz], ...]), cap }
  lathe(prof, o = {}) {
    const n = o.n || 12, a0 = o.arc ? o.arc[0] : 0, a1 = o.arc ? o.arc[1] : Math.PI * 2;
    const ringP = (pr, k, ri) => {
      const ang = a0 + ((a1 - a0) * k) / n;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      let jg = 1;
      if (o.jag && ri === 0) jg = 1 + (MHASH(k, o.seed || 3) - 0.5) * o.jag;
      const zz = o.jag && ri === 0 ? pr[0] + (MHASH(k, 7 + (o.seed || 0)) - 0.5) * o.jag * 0.15 : pr[0];
      return { x: cs * pr[1] * jg, y: sn * pr[2] * jg + (pr[3] || 0), z: zz, cs, sn };
    };
    const rings = prof.map((pr, ri) => { const out = []; for (let k = 0; k <= n; k++) out.push(ringP(pr, k, ri)); return out; });
    const tris = [];
    const V = (q, ri, k) => {
      // Κάθετο: ακτινικό (ελλειπτικό) με την κλίση του προφίλ.
      const pr = prof[ri], prA = prof[Math.max(0, ri - 1)], prB = prof[Math.min(prof.length - 1, ri + 1)];
      const dz = prB[0] - prA[0] || 1e-6, dr = (prB[1] + prB[2] - prA[1] - prA[2]) / 2;
      const nx = q.cs / Math.max(pr[1], 1e-4), ny = q.sn / Math.max(pr[2], 1e-4);
      const nl = Math.hypot(nx, ny) || 1;
      const nz = -dr / dz;
      const nn = this._norm([nx / nl, ny / nl, nz]);
      return o.axis === 'y' ? [q.x, q.z, q.y, nn[0], nn[2], nn[1]] : [q.x, q.y, q.z, ...nn];
    };
    for (let ri = 0; ri + 1 < prof.length; ri++) {
      for (let k = 0; k < n; k++) {
        const p0 = V(rings[ri][k], ri, k), p1 = V(rings[ri][k + 1], ri, k + 1);
        const q0 = V(rings[ri + 1][k], ri + 1, k), q1 = V(rings[ri + 1][k + 1], ri + 1, k + 1);
        tris.push(Object.assign([p0, p1, q1], { seg: k, ring: ri }), Object.assign([p0, q1, q0], { seg: k, ring: ri }));
      }
    }
    if (o.cap) {
      // Καπάκι πάνω (κλείνει την κορυφή).
      const last = prof.length - 1, pr = prof[last];
      const c = o.axis === 'y' ? [0, pr[0], pr[3] || 0, 0, 1, 0] : [0, pr[3] || 0, pr[0], 0, 0, 1];
      for (let k = 0; k < n; k++) {
        const q0 = V(rings[last][k], last, k), q1 = V(rings[last][k + 1], last, k + 1);
        tris.push([c, [...q0.slice(0, 3), ...c.slice(3)], [...q1.slice(0, 3), ...c.slice(3)]]);
      }
    }
    return tris;
  },

  box(x0, y0, z0, x1, y1, z1) {
    const p = (x, y, z) => [x ? x1 : x0, y ? y1 : y0, z ? z1 : z0];
    const f = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((q) => p(...q));
    const quads = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]], [[0, 1, 5, 4], [0, -1, 0]], [[2, 3, 7, 6], [0, 1, 0]],
      [[1, 2, 6, 5], [1, 0, 0]], [[0, 4, 7, 3], [-1, 0, 0]]];
    const tris = [];
    for (const [[a, b, c, d], nn] of quads) tris.push([[...f[a], ...nn], [...f[b], ...nn], [...f[c], ...nn]], [[...f[a], ...nn], [...f[c], ...nn], [...f[d], ...nn]]);
    return tris;
  },

  // Επίπεδα τρίγωνα (φτερά, πανιά): λίστα [p0, p1, p2], και από τις δύο όψεις.
  flat(list) {
    const tris = [];
    for (const [a, b, c] of list) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nn = this._norm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
      const ni = nn.map((x) => -x);
      tris.push([[...a, ...nn], [...b, ...nn], [...c, ...nn]], [[...a, ...ni], [...c, ...ni], [...b, ...ni]]);
    }
    return tris;
  },

  // Αλυσίδα σωλήνων μέσα από σημεία (λυγισμένα πόδια, φίδια, κλαδιά), ακτίνες από r0 ως r1.
  chain(pts, r0, r1, n = 7) {
    let out = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const f0 = i / (pts.length - 1), f1 = (i + 1) / (pts.length - 1);
      out = out.concat(this.tube(pts[i], pts[i + 1], r0 + (r1 - r0) * f0, r0 + (r1 - r0) * f1, n));
    }
    return out;
  },

  // ---- Ορισμός μοντέλου ----
  // add(tris, col, bone, glow): col = [r,g,b] ή συνάρτηση (seg, ring) → [r,g,b] (πτυχώσεις).
  def(name, build, extra = {}) {
    const parts = [];
    const add = (tris, col, bone = 'body', glow = false) => parts.push({ tris, col, bone, glow });
    build(add, this);
    this.defs[name] = { parts, ...extra };
  },

  // Πτυχώσεις: εναλλάξ φωτεινές / σκούρες λωρίδες γύρω γύρω, και μια διακοσμητική λωρίδα στο κάτω τελείωμα.
  folds(c, k = 0.82, hem = null) {
    return (seg, ring) => (hem && ring === 0 ? hem : seg % 2 ? MMUL(c, k) : c);
  },

  init() {
    const T = this.tube.bind(this), B = this.ball.bind(this), X = this.box.bind(this), LA = this.lathe.bind(this);
    const F = this.flat.bind(this), CH = this.chain.bind(this), FO = this.folds.bind(this);
    const skin = MC('s'), skinD = MC('S'), white = MC('w'), whiteD = MC('W'), hairDark = MC('a'), gold = MC('y'), goldD = MC('Y');
    const black = MCOL(30, 24, 22), charcoal = MC('k'), pale = MC('p'), paleD = MC('P'), cream = MC('E'), terra = MCOL(206, 108, 56);
    const lips = MCOL(170, 84, 66), eyeW = MCOL(240, 232, 220), iris = MCOL(46, 28, 18), bone = MC('i'), boneD = MC('I');
    const wood = MC('o'), woodD = MC('O'), stone = MC('m'), stoneD = MC('M'), bronze = MCOL(170, 112, 52), iron = MC('J');
    const leaf = MCOL(118, 112, 62), leafD = MCOL(78, 76, 42), dark = MCOL(14, 10, 8);

    // ---- Το κεφάλι ενός ανθρώπου (κόκαλα 'head' και 'jaw'). o = { skin, hair, longHair, bun, beard, hood, veil, crown, old, gaunt } ----
    const head = (add, o, cz = 0.925, cy = 0) => {
      const sk = o.skin || skin, skD = MMUL(sk, 0.8);
      const hb = o.bone || 'head', jb = o.jawBone || 'jaw';
      add(T([0, cy, cz - 0.11], [0, cy + 0.006, cz - 0.05], 0.031, 0.029, 8), sk, hb);                      // λαιμός
      add(B([0, cy - 0.006, cz], [0.057 * (o.gaunt ? 0.92 : 1), 0.067, 0.072], 12, 9), sk, hb);             // κρανίο
      add(B([0, cy + 0.024, cz - 0.04], [0.043 * (o.gaunt ? 0.85 : 1), 0.044, 0.032], 10, 6), sk, jb);    // σαγόνι
      add(T([0, cy + 0.06, cz + 0.006], [0, cy + 0.077, cz - 0.022], 0.012, 0.009, 6), skD, hb);            // μύτη
      add(B([0, cy + 0.063, cz - 0.04], [0.017, 0.007, 0.005], 6, 3), lips, jb);                            // χείλη
      for (const s of [-1, 1]) {
        add(B([s * 0.022, cy + 0.054, cz + 0.008], [0.012, 0.007, 0.008], 6, 4), eyeW, hb);                 // μάτια
        add(B([s * 0.022, cy + 0.06, cz + 0.008], [0.006, 0.004, 0.006], 5, 3), o.eyeGlow || iris, hb, !!o.eyeGlow);
        add(X(s * 0.034 - 0.012, cy + 0.052, cz + 0.022, s * 0.034 + 0.012, cy + 0.062, cz + 0.027), o.brow || MMUL(o.hair || hairDark, 0.9), hb);
        add(B([s * 0.058, cy, cz - 0.002], [0.008, 0.015, 0.02], 5, 4), skD, hb);                           // αυτιά
        if (o.old) add(X(s * 0.03 - 0.01, cy + 0.058, cz + 0.032, s * 0.03 + 0.01, cy + 0.06, cz + 0.034), skD, hb);   // ρυτίδες
      }
      if (o.hood) {
        add(B([0, cy - 0.018, cz + 0.008], [0.085, 0.09, 0.096], 12, 9), o.hood, hb);
        add(LA([[cz - 0.12, 0.1, 0.1, cy - 0.02], [cz - 0.03, 0.085, 0.09, cy - 0.02]], { n: 12 }), o.hood, hb);
      } else if (o.hair) {
        add(B([0, cy - 0.016, cz + 0.016], [0.062, 0.072, 0.07], 12, 8), o.hair, hb);
        if (o.bun) add(B([0, cy - 0.075, cz + 0.02], [0.034, 0.03, 0.034], 8, 6), o.hair, hb);
        if (o.longHair) add(LA([[cz - 0.22, 0.05, 0.03, cy - 0.06], [cz - 0.1, 0.06, 0.035, cy - 0.06], [cz + 0.02, 0.06, 0.04, cy - 0.04]], { n: 10 }), o.hair, hb);
        if (o.band) add(LA([[cz + 0.03, 0.064, 0.072, cy - 0.01], [cz + 0.045, 0.062, 0.07, cy - 0.01]], { n: 12 }), o.band, hb);
      }
      if (o.veil) add(LA([[cz - 0.3, 0.12, 0.08, cy - 0.06], [cz - 0.1, 0.09, 0.07, cy - 0.04], [cz + 0.06, 0.068, 0.07, cy - 0.02]], { n: 12, arc: [Math.PI * 1.05, Math.PI * 1.95] }), o.veil, hb);
      if (o.beard) {
        add(B([0, cy + 0.038, cz - 0.055], [0.05, 0.04, 0.05], 10, 7), o.beard, jb);
        if (o.longBeard) add(T([0, cy + 0.045, cz - 0.08], [0, cy + 0.05, cz - 0.2], 0.035, 0.012, 7), o.beard, jb);
        add(B([0, cy + 0.068, cz - 0.026], [0.024, 0.008, 0.007], 6, 3), o.beard, hb);               // μουστάκι
      }
      if (o.crown) {
        add(LA([[cz + 0.045, 0.06, 0.068, cy - 0.01], [cz + 0.06, 0.062, 0.07, cy - 0.01]], { n: 12 }), o.crown, hb);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          add(T([Math.cos(a) * 0.06, cy - 0.01 + Math.sin(a) * 0.068, cz + 0.058], [Math.cos(a) * 0.062, cy - 0.01 + Math.sin(a) * 0.07, cz + 0.1], 0.012, 0.001, 4), o.crown, hb);
        }
      }
    };
    this.head = head;

    // ---- Χέρι (κόκαλο armL / armR): ώμος → αγκώνας → καρπός, παλάμη και δάχτυλα. s = −1 αριστερό, +1 δεξί. ----
    const arm = (add, s, o) => {
      const b = s < 0 ? 'armL' : 'armR', sk = o.skin || skin;
      const sh = [s * 0.12, 0, 0.79], el = [s * 0.15, 0.015, 0.635], wr = [s * 0.16, 0.045, 0.505];
      add(T(sh, [s * 0.135, 0.008, 0.72], 0.046, 0.04, 8), o.sleeve || o.top || sk, b);       // μανίκι
      add(T([s * 0.133, 0.006, 0.73], el, 0.032, 0.026, 8), sk, b);
      add(T(el, wr, 0.026, 0.019, 8), sk, b);
      add(B([s * 0.163, 0.052, 0.48], [0.017, 0.013, 0.028], 7, 5), sk, b);                 // παλάμη
      for (let f = 0; f < 4; f++) add(T([s * (0.155 + f * 0.005), 0.055 + f * 0.004, 0.46], [s * (0.152 + f * 0.006), 0.062 + f * 0.004, 0.43], 0.005, 0.004, 4), sk, b);
      add(T([s * 0.15, 0.06, 0.48], [s * 0.145, 0.075, 0.46], 0.006, 0.005, 4), sk, b);   // αντίχειρας
    };
    // ---- Πόδια (για κοντό χιτώνα): μηρός, γόνατο, γάμπα, πέλμα, σανδάλι ----
    const legs = (add, o) => {
      const sk = o.skin || skin;
      for (const s of [-1, 1]) {
        const b = s < 0 ? 'legL' : 'legR';
        add(T([s * 0.055, 0, 0.5], [s * 0.056, 0.012, 0.28], 0.045, 0.034, 8), sk, b);
        add(T([s * 0.056, 0.012, 0.28], [s * 0.056, 0, 0.05], 0.034, 0.022, 8), sk, b);
        add(B([s * 0.056, 0.035, 0.03], [0.026, 0.055, 0.022], 8, 5), sk, b);
        add(X(s * 0.056 - 0.03, -0.025, 0, s * 0.056 + 0.03, 0.095, 0.012), MC('b'), b);
        add(T([s * 0.056, 0.005, 0.07], [s * 0.056, 0.005, 0.09], 0.025, 0.025, 8), MC('b'), b);
      }
    };
    // ---- Άνθρωπος: o = { dress, top, hem, long, female, staff, ...κεφάλι } ----
    const human = (add, o) => {
      const dress = o.dress, top = o.top || dress;
      if (o.long) {
        add(LA([[0, 0.165, 0.15], [0.12, 0.15, 0.135], [0.35, 0.12, 0.1], [0.5, 0.108, 0.085], [0.62, 0.088, 0.066]], { n: 14, jag: o.tatter ? 0.5 : 0 }),
          FO(dress, 0.8, o.hem), 'body');
      } else {
        add(LA([[0.3, 0.135, 0.12], [0.45, 0.115, 0.095], [0.62, 0.09, 0.068]], { n: 14 }), FO(dress, 0.8, o.hem), 'body');
        legs(add, o);
      }
      const bust = o.female ? 0.088 : 0.074;
      add(LA([[0.6, 0.088, 0.066], [0.68, 0.096, bust], [0.74, 0.108, 0.076], [0.79, 0.118, 0.068], [0.82, 0.07, 0.05], [0.835, 0.034, 0.032]], { n: 14, cap: true }),
        FO(top, 0.86), 'body');
      add(LA([[0.595, 0.092, 0.07], [0.625, 0.094, 0.072]], { n: 14 }), o.belt || MC('b'), 'body');      // ζώνη
      if (o.cloak) add(LA([[0.05, 0.16, 0.12, -0.03], [0.5, 0.14, 0.1, -0.03], [0.8, 0.13, 0.08, -0.02]], { n: 14, arc: [Math.PI * 1.08, Math.PI * 1.92] }), o.cloak, 'body');
      arm(add, -1, o);
      arm(add, 1, o);
      head(add, o);
      if (o.staff) add(T([0.165, 0.05, 0.02], [0.165, 0.06, 1.02], 0.011, 0.009, 6), wood, 'armR');
    };
    this.human = human;
    this.HP = { skin, hairDark, white, whiteD, gold, black, terra };

    this.def('euryAlive', (add) => human(add, { dress: white, top: white, hem: terra, long: true, female: true, hair: hairDark, longHair: true, bun: true, band: terra }));
    this.def('euryLying', (add) => human(add, { dress: white, top: white, hem: terra, long: true, female: true, hair: hairDark, longHair: true, bun: true, band: terra }));
    this.def('villager', (add) => human(add, { dress: whiteD, top: whiteD, hem: MCOL(150, 90, 50), hair: MC('B'), beard: MC('B'), longBeard: true, old: true, staff: true }));
    this.def('mournerF', (add) => human(add, { dress: black, top: black, long: true, female: true, hood: MCOL(40, 32, 30), sleeve: black }));
    this.def('mournerM', (add) => human(add, { dress: black, top: black, hair: MCOL(60, 44, 36), beard: MCOL(60, 44, 36), sleeve: black, cloak: MCOL(40, 32, 30) }));
    // Η Ευρυδίκη-σκιά και οι ψυχές: χλωμές, το κάτω μέρος σβήνει σε αχνό "ουρά" (αιωρούνται).
    const ghost = (add, o) => {
      add(LA([[0.02, 0.02, 0.02], [0.2, 0.09, 0.08], [0.45, 0.11, 0.09], [0.62, 0.088, 0.066]], { n: 14, jag: 0.4 }), FO(pale, 0.86), 'body');
      add(LA([[0.6, 0.088, 0.066], [0.68, 0.096, o.female ? 0.085 : 0.074], [0.74, 0.106, 0.075], [0.79, 0.115, 0.068], [0.82, 0.07, 0.05], [0.835, 0.034, 0.032]], { n: 14, cap: true }), FO(pale, 0.9), 'body');
      arm(add, -1, { skin: paleD, sleeve: pale });
      arm(add, 1, { skin: paleD, sleeve: pale });
      head(add, { skin: paleD, hair: MC('c'), longHair: o.female, bun: o.female, beard: o.beard ? pale : null, longBeard: o.beard, old: o.old });
    };
    this.def('eurydice3d', (add) => ghost(add, { female: true }));
    this.def('soulF3d', (add) => ghost(add, { female: true }));
    this.def('soulM3d', (add) => ghost(add, {}));
    this.def('soulOld3d', (add) => ghost(add, { beard: true, old: true }));
    // Άγαλμα: ένας άντρας από πέτρα πάνω σε βάθρο (σαν τα κούρος / τα αγάλματα του παλατιού).
    const marble = MC('V');
    this.def('statue', (add) => {
      add(X(-0.16, -0.16, 0, 0.16, 0.16, 0.12), MC('D'), 'base');
      add(X(-0.18, -0.18, 0.12, 0.18, 0.18, 0.15), marble, 'base');
      const s = [];
      human((tris, col, b) => s.push([tris, b]), { dress: marble, top: marble, hair: marble, beard: marble, skin: marble, sleeve: marble, brow: MMUL(marble, 0.8) });
      for (const [tris, b] of s) add(tris.map((t) => Object.assign(t.map((v) => [v[0] * 0.85, v[1] * 0.85, v[2] * 0.85 + 0.15, v[3], v[4], v[5]]), { seg: t.seg })), marble, b === 'armR' ? 'statueArm' : 'base');
    });

    // ---- Ο Χάροντας: ψηλός, ξερακιανός γέρος με κουκούλα, μακριά γένια, κουπί ----
    this.def('charon3d', (add) => {
      human(add, { dress: MC('z'), top: MC('Z'), hem: MCOL(60, 40, 26), long: true, skin: MC('T'), hood: MCOL(66, 44, 30), beard: MC('B'), longBeard: true,
        old: true, gaunt: true, sleeve: MC('Z'), cloak: MCOL(56, 38, 26), eyeGlow: MCOL(255, 236, 190) });
      add(T([0.17, 0.08, 0.02], [0.13, -0.02, 1.08], 0.014, 0.011, 6), wood, 'armR');                 // κουπί
      add(LA([[0, 0.012, 0.045], [0.18, 0.012, 0.05], [0.22, 0.008, 0.02]], { n: 6 }).map((t) => t.map((v) => [v[0] + 0.17, v[1] + 0.08, v[2], v[3], v[4], v[5]])), woodD, 'armR');
    });
    // Η βάρκα: μακρόστενο σκαρί (μισός κύλινδρος κατά μήκος), υψωμένη πλώρη με "μάτι", πάγκοι.
    this.def('boat3d', (add) => {
      add(LA([[-1.7, 0.08, 0.1, 0.62], [-1.4, 0.24, 0.4, 0.62], [-0.6, 0.33, 0.5, 0.62], [0.6, 0.33, 0.5, 0.62], [1.4, 0.24, 0.4, 0.62], [1.75, 0.08, 0.1, 0.62]],
        { n: 10, axis: 'y', arc: [Math.PI, Math.PI * 2] }), FO(woodD, 0.85), 'body');
      add(T([-0.33, -1.4, 0.62], [-0.33, 1.4, 0.62], 0.03, 0.03, 6), wood, 'body');
      add(T([0.33, -1.4, 0.62], [0.33, 1.4, 0.62], 0.03, 0.03, 6), wood, 'body');
      add(CH([[0, 1.7, 0.6], [0, 1.95, 0.9], [0, 1.9, 1.15]], 0.07, 0.03), woodD, 'body');
      add(CH([[0, -1.7, 0.6], [0, -1.9, 0.85], [0, -1.82, 1.05]], 0.07, 0.03), woodD, 'body');
      for (const y of [-0.6, 0.5]) add(X(-0.32, y - 0.08, 0.45, 0.32, y + 0.08, 0.5), wood, 'body');
      for (const s of [-1, 1]) {
        add(B([s * 0.31, 1.25, 0.5], [0.02, 0.13, 0.07], 8, 5), cream, 'body', true);
        add(B([s * 0.33, 1.27, 0.5], [0.012, 0.04, 0.04], 6, 4), dark, 'body');
      }
    });

    // ---- Οι θρόνοι και οι καθιστοί θεοί ----
    const throne = (add) => {
      add(X(-0.26, -0.22, 0, 0.26, 0.24, 0.36), stone, 'throne');
      add(X(-0.27, -0.24, 0.34, 0.27, 0.25, 0.39), stoneD, 'throne');
      add(X(-0.27, -0.32, 0, 0.27, -0.22, 1.12), stoneD, 'throne');
      add(LA([[1.1, 0.27, 0.05, -0.27], [1.2, 0.2, 0.04, -0.27], [1.26, 0.05, 0.02, -0.27]], { n: 10, arc: [0, Math.PI] }), stone, 'throne');
      for (const s of [-1, 1]) {
        add(X(s * 0.3 - 0.035, -0.22, 0.39, s * 0.3 + 0.035, 0.22, 0.56), stone, 'throne');
        add(B([s * 0.3, 0.24, 0.6], [0.045, 0.045, 0.045], 8, 6), gold, 'throne');
        add(X(s * 0.3 - 0.04, 0.16, 0, s * 0.3 + 0.04, 0.26, 0.56), stoneD, 'throne');
      }
      add(X(-0.36, 0.22, 0, 0.36, 0.5, 0.06), stoneD, 'throne');                  // σκαλοπάτι
    };
    const seated = (add, o) => {
      const sk = o.skin || skin;
      // Μηροί (οριζόντιοι), κνήμες, πέλματα — κάτω από το ρούχο.
      for (const s of [-1, 1]) {
        add(T([s * 0.06, -0.08, 0.44], [s * 0.065, 0.2, 0.44], 0.06, 0.05, 10), FO(o.dress, 0.85), 'legs');
        add(T([s * 0.065, 0.21, 0.44], [s * 0.065, 0.24, 0.07], 0.05, 0.035, 10), FO(o.dress, 0.85, o.hem), 'legs');
        add(B([s * 0.065, 0.28, 0.04], [0.03, 0.06, 0.025], 8, 5), MC('b'), 'legs');
      }
      add(LA([[0.4, 0.13, 0.11, -0.06], [0.5, 0.118, 0.09, -0.06], [0.6, 0.098, o.female ? 0.09 : 0.078, -0.05], [0.68, 0.112, 0.08, -0.05], [0.73, 0.122, 0.072, -0.05], [0.76, 0.075, 0.052, -0.05], [0.775, 0.034, 0.032, -0.05]], { n: 14, cap: true }), FO(o.top, 0.86), 'body');
      if (o.armor) add(LA([[0.5, 0.124, 0.096, -0.05], [0.6, 0.11, 0.09, -0.05], [0.7, 0.125, 0.085, -0.05], [0.735, 0.12, 0.074, -0.05]], { n: 14 }), o.armor, 'body');
      if (o.cloak) add(LA([[0.38, 0.17, 0.1, -0.12], [0.75, 0.14, 0.08, -0.08]], { n: 14, arc: [Math.PI * 1.05, Math.PI * 1.95] }), o.cloak, 'body');
      for (const s of [-1, 1]) {
        add(T([s * 0.12, -0.05, 0.73], [s * 0.15, 0.0, 0.58], 0.044, 0.034, 8), o.sleeve || o.top, 'body');
        add(T([s * 0.15, 0.0, 0.58], [s * 0.17, 0.16, 0.56], 0.03, 0.022, 8), sk, 'body');
        add(B([s * 0.172, 0.19, 0.56], [0.018, 0.03, 0.016], 7, 5), sk, 'body');
      }
      head(add, Object.assign({}, o, { bone: 'body', jawBone: 'body' }), 0.865, -0.045);
    };
    this.def('hades3d', (add) => {
      throne(add);
      seated(add, { dress: charcoal, top: MCOL(80, 56, 36), armor: bronze, cloak: MCOL(40, 26, 24), sleeve: charcoal, hair: black, beard: black, longBeard: true, crown: MCOL(40, 34, 30), brow: black });
      // Δικράνι (το σκήπτρο του Άδη) στο δεξί χέρι.
      add(T([0.175, 0.2, 0.05], [0.175, 0.2, 1.05], 0.012, 0.012, 6), MCOL(40, 34, 30), 'body');
      add(T([0.145, 0.2, 1.0], [0.205, 0.2, 1.0], 0.01, 0.01, 6), MCOL(40, 34, 30), 'body');
      add(T([0.145, 0.2, 1.0], [0.145, 0.2, 1.12], 0.009, 0.002, 5), MCOL(40, 34, 30), 'body');
      add(T([0.205, 0.2, 1.0], [0.205, 0.2, 1.12], 0.009, 0.002, 5), MCOL(40, 34, 30), 'body');
    });
    this.def('persephone3d', (add) => {
      throne(add);
      seated(add, { dress: white, top: white, hem: terra, female: true, hair: hairDark, longHair: true, crown: gold, veil: MCOL(236, 226, 206) });
      add(B([0, -0.045, 0.98], [0.026, 0.026, 0.026], 8, 6), MC('r'), 'body');               // ρόδι στο στέμμα
      add(B([0.14, 0.2, 0.585], [0.032, 0.032, 0.03], 8, 6), MC('r'), 'body');                // ρόδι στο χέρι
      add(T([0.14, 0.2, 0.61], [0.14, 0.2, 0.63], 0.01, 0.004, 5), MC('R'), 'body');
    });
    this.defsInit2 && this.defsInit2();
  },
};

// ---- Μέρος 2: τέρατα, ζώα, δέντρα, έπιπλα, αντικείμενα (τρέχει στο τέλος του Models.init) ----
Models.defsInit2 = function () {
  const M = this;
  const T = M.tube.bind(M), B = M.ball.bind(M), X = M.box.bind(M), LA = M.lathe.bind(M), F = M.flat.bind(M), CH = M.chain.bind(M), FO = M.folds.bind(M);
  const head = M.head;
  const white = MC('w'), cream = MC('E'), charcoal = MC('k'), terra = MCOL(206, 108, 56);
  const bone = MC('i'), boneD = MC('I'), wood = MC('o'), woodD = MC('O'), stone = MC('m'), stoneD = MC('M');
  const bronze = MCOL(170, 112, 52), iron = MC('J'), ironL = MC('j'), dark = MCOL(14, 10, 8);
  const leaf = MCOL(176, 160, 92), leafD = MCOL(138, 126, 70), rock = MC('l'), rockD = MC('L');

  // ---- Η σκιά: σκυφτή, με κουκούλα και σκισμένο σάβανο· κρανίο με σαγόνι που ανοίγει, κοκαλιάρικα χέρια με νύχια ----
  M.def('ghoul', (add) => {
    const robe = charcoal, robeD = MC('K');
    add(LA([[0, 0.21, 0.19], [0.18, 0.18, 0.16], [0.4, 0.14, 0.12], [0.58, 0.12, 0.1]], { n: 16, jag: 0.6, seed: 5 }), FO(robe, 0.7), 'body');
    add(LA([[0.56, 0.12, 0.1, 0.02], [0.66, 0.13, 0.11, 0.07], [0.74, 0.13, 0.1, 0.12], [0.79, 0.09, 0.07, 0.16]], { n: 14, cap: true }), FO(robe, 0.75), 'body');
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, x = Math.cos(a) * 0.17, y = Math.sin(a) * 0.15;
      add(F([[[x, y, 0.3], [x * 1.1 + 0.03, y * 1.1, 0.3], [x * 1.15, y * 1.15, 0.05 + MHASH(k, 2) * 0.1]]]), robeD, 'body');
    }
    add(B([0, 0.19, 0.85], [0.1, 0.11, 0.11], 12, 9), robeD, 'head');
    add(LA([[0.75, 0.11, 0.1, 0.17], [0.86, 0.105, 0.105, 0.2]], { n: 12, arc: [Math.PI * 0.15, Math.PI * 0.85] }), robe, 'head');
    add(B([0, 0.245, 0.835], [0.058, 0.062, 0.068], 12, 9), bone, 'head');
    for (const s of [-1, 1]) {
      add(B([s * 0.023, 0.293, 0.85], [0.017, 0.012, 0.016], 8, 6), dark, 'head');
      add(B([s * 0.023, 0.302, 0.85], [0.006, 0.004, 0.006], 6, 4), cream, 'head', true);
      add(B([s * 0.05, 0.27, 0.8], [0.015, 0.02, 0.022], 6, 5), boneD, 'head');
    }
    add(T([0, 0.3, 0.83], [0, 0.31, 0.815], 0.008, 0.004, 4), dark, 'head');
    for (let k = 0; k < 6; k++) add(X(-0.026 + k * 0.009, 0.292, 0.795, -0.019 + k * 0.009, 0.3, 0.808), cream, 'head');
    add(B([0, 0.27, 0.79], [0.044, 0.04, 0.024], 10, 6), bone, 'jaw');
    for (let k = 0; k < 6; k++) add(X(-0.026 + k * 0.009, 0.29, 0.78, -0.019 + k * 0.009, 0.298, 0.792), cream, 'jaw');
    for (const s of [-1, 1]) {
      const b = s < 0 ? 'armL' : 'armR';
      add(T([s * 0.11, 0.12, 0.75], [s * 0.17, 0.28, 0.68], 0.04, 0.03, 8), robe, b);
      add(F([[[s * 0.17, 0.28, 0.68], [s * 0.2, 0.26, 0.6], [s * 0.15, 0.3, 0.58]]]), robeD, b);
      add(T([s * 0.17, 0.28, 0.68], [s * 0.15, 0.44, 0.62], 0.016, 0.012, 6), bone, b);
      add(B([s * 0.15, 0.46, 0.615], [0.02, 0.025, 0.012], 7, 5), bone, b);
      for (let f = 0; f < 4; f++) {
        const fx = s * (0.135 + f * 0.01);
        add(CH([[fx, 0.475, 0.615], [fx + s * 0.003, 0.52, 0.6], [fx + s * 0.002, 0.555, 0.57]], 0.005, 0.0015, 4), f % 2 ? boneD : bone, b);
      }
    }
  });
  M.pivots.jawGhoul = [0, 0.25, 0.8];

  // ---- Ερινύα: γυναίκα με φτερά νυχτερίδας, φίδια για μαλλιά, κόκκινα σκισμένα ρούχα, νύχια ----
  M.def('erinys3d', (add) => {
    const robe = MCOL(110, 30, 26), robeD = MCOL(70, 20, 18), sk = MCOL(168, 126, 104), wingC = MCOL(76, 24, 22), wingB = MCOL(46, 16, 14);
    add(LA([[0.02, 0.02, 0.02], [0.2, 0.08, 0.07], [0.45, 0.115, 0.1], [0.62, 0.09, 0.07]], { n: 14, jag: 0.6, seed: 9 }), FO(robe, 0.7), 'body');
    add(LA([[0.6, 0.088, 0.066], [0.68, 0.095, 0.086], [0.74, 0.105, 0.075], [0.79, 0.112, 0.066], [0.82, 0.07, 0.05], [0.835, 0.034, 0.032]], { n: 14, cap: true }), sk, 'body');
    add(LA([[0.66, 0.098, 0.088], [0.72, 0.104, 0.08]], { n: 14 }), robeD, 'body');
    for (const s of [-1, 1]) {
      const b = s < 0 ? 'armL' : 'armR';
      add(T([s * 0.12, 0, 0.79], [s * 0.17, 0.08, 0.66], 0.03, 0.024, 8), sk, b);
      add(T([s * 0.17, 0.08, 0.66], [s * 0.19, 0.2, 0.6], 0.022, 0.016, 8), sk, b);
      for (let f = 0; f < 4; f++) add(CH([[s * (0.18 + f * 0.008), 0.21, 0.6], [s * (0.185 + f * 0.01), 0.25, 0.59], [s * (0.18 + f * 0.01), 0.27, 0.56]], 0.005, 0.001, 4), MCOL(60, 30, 24), b);
    }
    head(add, { skin: sk, gaunt: true, eyeGlow: MCOL(255, 210, 90), brow: MCOL(60, 24, 20) });
    for (const s of [-1, 1]) add(T([s * 0.012, 0.062, 0.888], [s * 0.012, 0.064, 0.872], 0.004, 0.0005, 4), cream, 'jaw');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3, cx = Math.cos(a) * 0.045, cy = Math.sin(a) * 0.05 - 0.01;
      const tip = [Math.cos(a) * 0.15, Math.sin(a) * 0.15 - 0.02, 0.92 + MHASH(k, 1) * 0.08];
      const b = 'snake' + k;
      add(CH([[cx, cy, 0.96], [cx * 2.2, cy * 2.2, 0.99], tip], 0.013, 0.008, 6), k % 2 ? MC('g') : MC('G'), b);
      add(B([tip[0] * 1.08, tip[1] * 1.08, tip[2] + 0.005], [0.016, 0.016, 0.012], 7, 5), MC('G'), b);
      add(B([tip[0] * 1.14, tip[1] * 1.14, tip[2] + 0.012], [0.004, 0.004, 0.004], 4, 3), MCOL(255, 210, 90), b, true);
      M.pivots[b] = [cx, cy, 0.96];
    }
    for (const s of [-1, 1]) {
      const b = s < 0 ? 'wingL' : 'wingR';
      const root = [s * 0.05, -0.07, 0.78], elbow = [s * 0.3, -0.12, 0.92], wrist = [s * 0.48, -0.1, 0.98];
      const f1 = [s * 0.78, -0.12, 1.02], f2 = [s * 0.74, -0.12, 0.72], f3 = [s * 0.55, -0.11, 0.48], body = [s * 0.08, -0.07, 0.5];
      add(CH([root, elbow, wrist], 0.016, 0.01, 6), wingB, b);
      for (const f of [f1, f2, f3]) add(T(wrist, f, 0.008, 0.003, 5), wingB, b);
      add(F([[root, elbow, body], [elbow, wrist, body], [wrist, f3, body], [wrist, f2, f3], [wrist, f1, f2]]), wingC, b);
      add(F([[f2, [s * 0.66, -0.12, 0.62], f3]]), MMUL(wingC, 0.7), b);
    }
  });

  // ---- Ο Κέρβερος: τεράστιο σκούρο σκυλί, τρία κεφάλια με σαγόνια που ανοίγουν, χαίτη, ουρά-φίδι ----
  M.def('cerberus', (add) => {
    const fur = MCOL(66, 42, 30), furD = MCOL(40, 26, 20), furL = MCOL(96, 62, 42), red = MCOL(255, 70, 40), mouth = MCOL(120, 30, 26);
    add(LA([[-0.48, 0.07, 0.08, 0.54], [-0.42, 0.14, 0.15, 0.53], [-0.28, 0.17, 0.17, 0.53], [-0.05, 0.16, 0.15, 0.56], [0.15, 0.19, 0.19, 0.58], [0.32, 0.2, 0.21, 0.62], [0.42, 0.14, 0.15, 0.66]],
      { n: 14, axis: 'y', cap: true }), FO(fur, 0.85), 'body');
    for (let k = 0; k < 9; k++) {
      const y = -0.25 + k * 0.08, z = 0.7 + (k > 5 ? 0.08 : 0.02);
      add(T([0, y, z], [0, y - 0.05, z + 0.08 + MHASH(k, 3) * 0.04], 0.04, 0.002, 5), furD, 'body');
    }
    const leg = (s, front) => {
      const b = (front ? 'legF' : 'legB') + (s < 0 ? 'L' : 'R');
      const pts = front ? [[s * 0.13, 0.28, 0.58], [s * 0.14, 0.32, 0.32], [s * 0.14, 0.3, 0.06]] : [[s * 0.13, -0.32, 0.58], [s * 0.14, -0.22, 0.34], [s * 0.14, -0.38, 0.16], [s * 0.14, -0.33, 0.05]];
      add(CH(pts, front ? 0.075 : 0.085, 0.04, 8), fur, b);
      const p = pts[pts.length - 1];
      add(B([p[0], p[1] + 0.04, 0.035], [0.05, 0.075, 0.035], 8, 5), furD, b);
      for (let c = -1; c <= 1; c++) add(T([p[0] + c * 0.022, p[1] + 0.1, 0.03], [p[0] + c * 0.024, p[1] + 0.14, 0.005], 0.009, 0.001, 4), cream, b);
    };
    for (const s of [-1, 1]) { leg(s, true); leg(s, false); }
    for (const [hx, n] of [[-0.21, 'L'], [0, 'M'], [0.21, 'R']]) {
      const b = 'head' + n, jb = 'jaw' + n;
      add(T([hx * 0.5, 0.34, 0.66], [hx, 0.54, 0.84], 0.1, 0.075, 10), fur, b);
      add(B([hx, 0.6, 0.88], [0.08, 0.095, 0.08], 12, 9), fur, b);
      add(T([hx, 0.65, 0.875], [hx, 0.77, 0.852], 0.052, 0.026, 10), furL, b);
      add(B([hx, 0.75, 0.86], [0.03, 0.04, 0.026], 8, 6), furL, b);
      add(B([hx, 0.785, 0.862], [0.016, 0.012, 0.012], 7, 5), dark, b);
      for (let t = -2; t <= 2; t++) add(T([hx + t * 0.01, 0.73 - Math.abs(t) * 0.012, 0.835], [hx + t * 0.01, 0.73 - Math.abs(t) * 0.012, 0.812], 0.005, 0.001, 4), cream, b);
      add(T([hx, 0.65, 0.83], [hx, 0.76, 0.818], 0.034, 0.02, 10), furD, jb);
      add(B([hx, 0.71, 0.83], [0.022, 0.05, 0.007], 8, 4), mouth, jb);
      for (let t = -1; t <= 1; t += 2) add(T([hx + t * 0.016, 0.76, 0.83], [hx + t * 0.016, 0.76, 0.848], 0.005, 0.001, 4), cream, jb);
      for (const s of [-1, 1]) {
        add(T([hx + s * 0.05, 0.57, 0.94], [hx + s * 0.07, 0.54, 1.04], 0.03, 0.002, 6), furD, b);
        add(B([hx + s * 0.035, 0.67, 0.91], [0.016, 0.01, 0.012], 6, 4), red, b, true);
        add(X(hx + s * 0.035 - 0.022, 0.66, 0.925, hx + s * 0.035 + 0.022, 0.68, 0.932), furD, b);
      }
      M.pivots[b] = [hx * 0.5, 0.34, 0.66];
      M.pivots[jb] = [hx, 0.66, 0.84];
    }
    add(CH([[0, -0.46, 0.56], [0, -0.62, 0.68], [0, -0.78, 0.62], [0, -0.88, 0.7]], 0.045, 0.02, 7), FO(MC('g'), 0.7), 'tail');
    add(B([0, -0.92, 0.72], [0.035, 0.05, 0.03], 8, 5), MC('G'), 'tail');
  });

  // ---- Κατσίκα ----
  M.def('goat', (add) => {
    const fur = MCOL(214, 196, 162), furD = MCOL(160, 140, 108), dk = MCOL(80, 62, 46);
    add(LA([[-0.42, 0.06, 0.07, 0.62], [-0.35, 0.13, 0.14, 0.62], [0, 0.16, 0.16, 0.62], [0.28, 0.14, 0.15, 0.65], [0.36, 0.08, 0.1, 0.68]], { n: 12, axis: 'y', cap: true }), FO(fur, 0.9), 'body');
    for (const [s, front] of [[-1, true], [1, true], [-1, false], [1, false]]) {
      const b = (front ? 'legF' : 'legB') + (s < 0 ? 'L' : 'R'), y = front ? 0.25 : -0.28;
      add(CH(front ? [[s * 0.09, y, 0.6], [s * 0.09, y + 0.02, 0.3], [s * 0.09, y, 0.03]] : [[s * 0.09, y, 0.6], [s * 0.09, y + 0.06, 0.34], [s * 0.09, y - 0.04, 0.16], [s * 0.09, y, 0.03]], 0.04, 0.022, 7), furD, b);
      add(B([s * 0.09, y + 0.01, 0.02], [0.022, 0.03, 0.02], 6, 4), dk, b);
    }
    add(T([0, 0.3, 0.72], [0, 0.42, 0.9], 0.065, 0.05, 8), fur, 'headM');
    add(B([0, 0.47, 0.9], [0.055, 0.075, 0.06], 10, 7), fur, 'headM');
    add(T([0, 0.5, 0.88], [0, 0.6, 0.85], 0.035, 0.022, 8), furD, 'headM');
    for (const s of [-1, 1]) {
      add(CH([[s * 0.03, 0.44, 0.95], [s * 0.05, 0.38, 1.04], [s * 0.07, 0.3, 1.03], [s * 0.08, 0.27, 0.97]], 0.015, 0.004, 6), dk, 'headM');
      add(T([s * 0.05, 0.45, 0.91], [s * 0.11, 0.43, 0.88], 0.02, 0.005, 5), furD, 'headM');
      add(B([s * 0.035, 0.52, 0.92], [0.008, 0.006, 0.008], 5, 4), dark, 'headM');
    }
    add(T([0, 0.56, 0.84], [0, 0.57, 0.74], 0.016, 0.004, 5), MCOL(240, 236, 220), 'headM');
    add(T([0, -0.4, 0.68], [0, -0.46, 0.78], 0.025, 0.006, 5), fur, 'tail');
  });

  // ---- Το φίδι: σώμα σε σχήμα S, που λεπταίνει προς την ουρά, σηκωμένο κεφάλι με γλώσσα ----
  M.def('snake3d', (add) => {
    const pts = [];
    for (let k = 0; k <= 14; k++) pts.push([Math.sin(k * 0.7) * 0.45, -1.6 + k * 0.17, 0.07]);
    for (let k = 0; k < pts.length - 1; k++) {
      const r = 0.025 + 0.06 * (k / (pts.length - 1));
      add(T(pts[k], pts[k + 1], r, r + 0.004, 8), k % 3 === 0 ? MC('d') : k % 2 ? MC('G') : MC('g'), 'body');
    }
    const n = pts[pts.length - 1];
    add(CH([n, [n[0], n[1] + 0.12, 0.3], [n[0], n[1] + 0.18, 0.62]], 0.085, 0.07, 8), MC('g'), 'headM');
    add(B([n[0], n[1] + 0.26, 0.7], [0.11, 0.15, 0.07], 10, 7), MC('G'), 'headM');
    for (const s of [-1, 1]) add(B([n[0] + s * 0.07, n[1] + 0.32, 0.74], [0.018, 0.018, 0.016], 6, 4), MCOL(255, 210, 90), 'headM', true);
    add(F([[[n[0], n[1] + 0.4, 0.68], [n[0] - 0.02, n[1] + 0.52, 0.68], [n[0] + 0.02, n[1] + 0.52, 0.68]]]), MC('t'), 'headM');
    M.snakeHead = [n[0], n[1], 0.07];
  });

  // ---- Δέντρα ----
  M.def('olive', (add) => {
    const bark = MCOL(96, 76, 58), barkD = MCOL(64, 50, 38);
    add(CH([[0, 0, 0], [0.04, 0.02, 0.15], [-0.03, 0.05, 0.3], [0.02, 0.0, 0.42]], 0.07, 0.04, 9), FO(bark, 0.8), 'body');
    add(CH([[0, 0, 0.0], [-0.05, -0.03, 0.12], [-0.06, 0.02, 0.28]], 0.05, 0.03, 7), barkD, 'body');
    const tips = [[0.25, 0.1, 0.62], [-0.22, 0.12, 0.6], [0.05, -0.26, 0.66], [0.02, 0.24, 0.72], [-0.1, -0.1, 0.8]];
    tips.forEach((tp) => add(CH([[0.02, 0.0, 0.4], [tp[0] * 0.5, tp[1] * 0.5, 0.52], tp], 0.03, 0.012, 6), bark, 'body'));
    const cl = [[0.25, 0.1, 0.72, 0.2], [-0.24, 0.12, 0.68, 0.19], [0.06, -0.28, 0.74, 0.18], [0.03, 0.26, 0.8, 0.18], [-0.1, -0.1, 0.9, 0.2], [0.12, 0.05, 0.92, 0.17], [-0.2, -0.15, 0.78, 0.15]];
    cl.forEach(([x, y, z, r], k) => add(B([x, y, z], [r, r, r * 0.75], 9, 6, 0.45, k * 7), k % 2 ? leaf : leafD, 'body'));
  });
  M.def('cypress', (add) => {
    add(T([0, 0, 0], [0, 0, 0.1], 0.03, 0.025, 7), MCOL(80, 60, 44), 'body');
    add(LA([[0.05, 0.06, 0.06], [0.12, 0.11, 0.11], [0.3, 0.13, 0.13], [0.55, 0.11, 0.11], [0.8, 0.06, 0.06], [1.0, 0.004, 0.004]], { n: 12 }), FO(MCOL(70, 72, 38), 0.8), 'body');
    for (let k = 0; k < 10; k++) {
      const a = k * 2.4, z = 0.15 + k * 0.075, r = 0.11 * (1 - z * 0.8) + 0.02;
      add(B([Math.cos(a) * r, Math.sin(a) * r, z], [0.05, 0.05, 0.07], 7, 5, 0.4, k), MCOL(56, 60, 32), 'body');
    }
  });

  // ---- Το σπίτι και η αυλή ----
  M.def('bed', (add) => {
    add(X(-0.5, -1.0, 0.25, 0.5, 1.0, 0.4), woodD, 'body');
    for (const [x, y] of [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]]) add(X(x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, 0.42), wood, 'body');
    add(X(-0.52, 0.92, 0.25, 0.52, 1.02, 0.85), wood, 'body');
    add(X(-0.46, -0.96, 0.4, 0.46, 0.94, 0.55), MCOL(232, 220, 196), 'body');
    add(B([0, 0.72, 0.6], [0.3, 0.14, 0.07], 10, 6), white, 'body');
    add(X(-0.48, -0.98, 0.5, 0.48, 0.4, 0.6), terra, 'body');
    for (const y of [-0.8, -0.5, -0.2, 0.1]) add(X(-0.485, y, 0.5, 0.485, y + 0.05, 0.605), MCOL(150, 70, 40), 'body');
  });
  M.def('table', (add) => {
    add(X(-0.55, -0.35, 0.86, 0.55, 0.35, 0.95), wood, 'body');
    for (const [x, y] of [[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]]) add(T([x, y, 0], [x, y, 0.86], 0.04, 0.035, 7), woodD, 'body');
    add(B([-0.2, 0.0, 1.0], [0.15, 0.1, 0.06], 10, 6), MCOL(186, 130, 70), 'body');
    add(LA([[0.95, 0.05, 0.05], [1.0, 0.13, 0.13], [1.05, 0.15, 0.15]], { n: 12 }), terra, 'body');
    add(B([0.28, 0.12, 0.98], [0.04, 0.04, 0.035], 8, 5), MCOL(110, 40, 50), 'body');
    add(B([0.24, 0.16, 0.98], [0.035, 0.035, 0.03], 8, 5), MCOL(110, 40, 50), 'body');
    add(T([0.35, -0.15, 0.95], [0.35, -0.15, 1.12], 0.04, 0.055, 9), MC('A'), 'body');
  });
  M.def('loom', (add) => {
    for (const s of [-1, 1]) add(X(s * 0.45 - 0.04, -0.04, 0, s * 0.45 + 0.04, 0.04, 1.0), woodD, 'body');
    add(T([-0.5, 0, 0.95], [0.5, 0, 0.95], 0.035, 0.035, 8), wood, 'body');
    add(T([-0.45, 0, 0.3], [0.45, 0, 0.3], 0.02, 0.02, 6), wood, 'body');
    const stripes = [MCOL(236, 224, 200), terra, MCOL(236, 224, 200), MCOL(120, 40, 30), MCOL(236, 224, 200)];
    stripes.forEach((c, k) => add(X(-0.4, -0.01, 0.92 - (k + 1) * 0.07, 0.4, 0.01, 0.92 - k * 0.07), c, 'body'));
    for (let k = 0; k < 13; k++) {
      const x = -0.38 + k * 0.063;
      add(X(x - 0.004, -0.005, 0.15, x + 0.004, 0.005, 0.57), MCOL(220, 206, 176), 'body');
      add(B([x, 0, 0.12], [0.018, 0.018, 0.03], 6, 4), MC('A'), 'body');
    }
  });
  M.def('hearth', (add) => {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      add(B([Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.1], [0.12, 0.1, 0.1], 7, 5, 0.3, k), k % 2 ? stone : stoneD, 'body');
    }
    add(T([-0.25, -0.1, 0.12], [0.25, 0.1, 0.18], 0.06, 0.05, 7), woodD, 'body');
    add(T([-0.2, 0.15, 0.14], [0.22, -0.12, 0.2], 0.055, 0.05, 7), woodD, 'body');
    for (let k = 0; k < 6; k++) add(B([(MHASH(k, 1) - 0.5) * 0.4, (MHASH(k, 2) - 0.5) * 0.4, 0.06], [0.05, 0.05, 0.025], 6, 4), k % 2 ? MCOL(255, 120, 40) : MCOL(200, 60, 20), 'body', true);
  });
  M.def('laundry', (add) => {
    for (const s of [-1, 1]) add(T([s * 0.9, 0, 0], [s * 0.9, 0, 1.0], 0.025, 0.02, 7), woodD, 'body');
    add(CH([[-0.9, 0, 0.95], [-0.3, 0, 0.9], [0.3, 0, 0.9], [0.9, 0, 0.95]], 0.006, 0.006, 4), MCOL(200, 180, 140), 'body');
    const cloths = [[-0.6, 0.22, MCOL(240, 232, 214)], [-0.15, 0.3, terra], [0.35, 0.25, MCOL(230, 210, 170)], [0.68, 0.16, MCOL(150, 70, 40)]];
    for (const [x, w, c] of cloths) add(F([[[x - w / 2, 0, 0.9], [x + w / 2, 0, 0.9], [x + w / 2, 0.01, 0.45]], [[x - w / 2, 0, 0.9], [x + w / 2, 0.01, 0.45], [x - w / 2, 0.02, 0.48]]]), c, 'cloth');
  });
  M.def('stele', (add) => {
    add(X(-0.3, -0.18, 0, 0.3, 0.18, 0.12), stoneD, 'body');
    add(X(-0.22, -0.07, 0.12, 0.22, 0.07, 0.82), stone, 'body');
    add(T([0, -0.07, 0.82], [0, 0.07, 0.82], 0.22, 0.22, 14), stone, 'body');
    add(X(-0.15, 0.07, 0.35, 0.15, 0.08, 0.7), MMUL(stone, 0.8), 'body');
    add(B([0, 0.085, 0.6], [0.05, 0.01, 0.06], 8, 5), MMUL(stone, 0.7), 'body');
  });
  M.def('amphoraBroken', (add) => {
    add(LA([[0, 0.05, 0.05], [0.15, 0.28, 0.28], [0.4, 0.36, 0.36], [0.62, 0.3, 0.3]], { n: 14, arc: [0.5, Math.PI * 2 - 0.3], jag: 0.3 }), FO(MC('A'), 0.85), 'body');
    for (let k = 0; k < 4; k++) add(X(0.3 + k * 0.1, -0.35 + k * 0.08, 0, 0.42 + k * 0.1, -0.25 + k * 0.08, 0.04), MC('C'), 'body');
  });

  // ---- Ο Κάτω Κόσμος ----
  const skull = (add, c, s, yaw = 0) => {
    const p = (x, y, z) => [c[0] + (x * Math.cos(yaw) - y * Math.sin(yaw)) * s, c[1] + (x * Math.sin(yaw) + y * Math.cos(yaw)) * s, c[2] + z * s];
    add(B(p(0, 0, 0.55), [0.42 * s, 0.5 * s, 0.45 * s], 10, 7), bone, 'body');
    add(B(p(0, 0.3, 0.28), [0.3 * s, 0.25 * s, 0.22 * s], 8, 5), boneD, 'body');
    for (const k of [-1, 1]) add(B(p(k * 0.17, 0.42, 0.52), [0.11 * s, 0.06 * s, 0.1 * s], 6, 5), dark, 'body');
    add(B(p(0, 0.48, 0.36), [0.05 * s, 0.03 * s, 0.07 * s], 5, 4), dark, 'body');
  };
  M.def('skull', (add) => skull(add, [0, 0, 0], 1));
  M.def('skullpile', (add) => {
    const pos = [[-0.4, 0, 0, 0.5], [0.05, 0.05, 0, 0.55], [0.45, -0.05, 0, 0.5], [-0.2, 0.0, 0.42, 0.48], [0.25, 0.0, 0.42, 0.5], [0.02, 0.02, 0.8, 0.45]];
    pos.forEach(([x, y, z, s], k) => skull(add, [x, y, z], s, (MHASH(k, 4) - 0.5) * 1.2));
  });
  M.def('bones', (add) => {
    const bn = (a, b) => { add(T(a, b, 0.09, 0.09, 6), bone); add(B(a, [0.14, 0.14, 0.12], 6, 4), boneD); add(B(b, [0.14, 0.14, 0.12], 6, 4), boneD); };
    bn([-1.5, -0.3, 0.12], [1.4, 0.4, 0.12]);
    bn([-1.0, 0.6, 0.12], [1.1, -0.7, 0.2]);
  });
  M.def('rocks', (add) => {
    add(B([0, 0, 0.35], [0.7, 0.55, 0.38], 9, 6, 0.5, 1), rock, 'body');
    add(B([0.85, 0.3, 0.2], [0.35, 0.3, 0.22], 7, 5, 0.5, 2), rockD, 'body');
    add(B([-0.7, -0.35, 0.15], [0.3, 0.25, 0.17], 7, 5, 0.5, 3), MMUL(rock, 0.85), 'body');
  });
  M.def('reeds', (add) => {
    for (let k = 0; k < 9; k++) {
      const x = (MHASH(k, 1) - 0.5) * 0.4, y = (MHASH(k, 2) - 0.5) * 0.4, h = 0.65 + MHASH(k, 3) * 0.35, lean = (MHASH(k, 4) - 0.5) * 0.15;
      add(CH([[x, y, 0], [x + lean * 0.5, y, h * 0.6], [x + lean, y + lean * 0.4, h]], 0.012, 0.004, 5), k % 2 ? MC('x') : MC('X'), 'body');
      if (k % 3 === 0) add(B([x + lean * 0.8, y + lean * 0.3, h * 0.85], [0.02, 0.02, 0.06], 6, 4), MCOL(100, 64, 34), 'body');
    }
  });
  M.def('roots', (add) => {
    for (let k = 0; k < 6; k++) {
      const x = (MHASH(k, 1) - 0.5) * 0.5, y = (MHASH(k, 2) - 0.5) * 0.5, len = 0.5 + MHASH(k, 3) * 0.5;
      add(CH([[x, y, 1], [x + (MHASH(k, 5) - 0.5) * 0.2, y, 1 - len * 0.4], [x + (MHASH(k, 6) - 0.5) * 0.3, y + 0.05, 1 - len * 0.75], [x + (MHASH(k, 7) - 0.5) * 0.25, y, 1 - len]], 0.035, 0.004, 5), k % 2 ? MCOL(110, 80, 56) : MCOL(84, 60, 42), 'body');
    }
  });
  M.def('chain', (add) => {
    for (let k = 0; k < 14; k++) {
      const z = 1 - k * 0.07, rot = k % 2;
      const pts = rot ? [[0, -0.025, z], [0, 0.025, z], [0, 0.025, z - 0.07], [0, -0.025, z - 0.07]] : [[-0.025, 0, z], [0.025, 0, z], [0.025, 0, z - 0.07], [-0.025, 0, z - 0.07]];
      for (let i = 0; i < 4; i++) add(T(pts[i], pts[(i + 1) % 4], 0.008, 0.008, 5), k % 2 ? iron : ironL, 'body');
    }
  });
  M.def('bars', (add) => {
    for (let k = 0; k < 7; k++) {
      const x = -0.45 + k * 0.15;
      add(T([x, 0, 0], [x, 0, 0.98], 0.022, 0.022, 7), iron, 'body');
      add(T([x, 0, 0.98], [x, 0, 1.03], 0.022, 0.0, 6), ironL, 'body');
    }
    for (const z of [0.2, 0.75]) add(X(-0.5, -0.025, z, 0.5, 0.025, z + 0.04), ironL, 'body');
  });
  M.def('tripod', (add) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      add(CH([[Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0], [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.4], [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.72]], 0.035, 0.025, 6), bronze, 'body');
      add(B([Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.03], [0.05, 0.05, 0.03], 6, 4), MMUL(bronze, 0.7), 'body');
    }
    add(LA([[0.62, 0.08, 0.08], [0.72, 0.3, 0.3], [0.86, 0.42, 0.42], [0.9, 0.44, 0.44]], { n: 16 }), FO(bronze, 0.8), 'body');
    add(LA([[0.86, 0.38, 0.38], [0.87, 0.02, 0.02]], { n: 16 }), MCOL(40, 20, 12), 'body');
  });
  M.def('niche', (add) => {
    for (const s of [-1, 1]) add(X(s * 0.36 - 0.08, -0.1, 0, s * 0.36 + 0.08, 0.06, 0.82), stone, 'body');
    add(X(-0.46, -0.1, 0.82, 0.46, 0.08, 0.92), stoneD, 'body');
    add(F([[[-0.46, 0.08, 0.92], [0.46, 0.08, 0.92], [0, 0.08, 1.02]]]), stone, 'body');
    add(X(-0.28, -0.12, 0.0, 0.28, -0.1, 0.82), dark, 'body');
    add(X(-0.44, -0.1, 0, 0.44, 0.12, 0.05), stoneD, 'body');
  });
  M.def('chest', (add) => {
    add(X(-0.5, -0.32, 0, 0.5, 0.32, 0.55), wood, 'body');
    for (const x of [-0.35, 0.35]) add(X(x - 0.04, -0.335, 0, x + 0.04, 0.335, 0.56), iron, 'body');
    add(X(-0.06, 0.32, 0.38, 0.06, 0.345, 0.5), MCOL(200, 160, 70), 'body');
    add(X(-0.52, -0.34, 0.55, 0.52, 0.34, 0.7), woodD, 'lid');
    add(T([-0.52, 0, 0.7], [0.52, 0, 0.7], 0.34, 0.34, 10).filter((t) => t.every((v) => v[2] >= 0.699)), woodD, 'lid');
    for (const x of [-0.35, 0.35]) add(X(x - 0.04, -0.35, 0.55, x + 0.04, 0.35, 0.72), iron, 'lid');
  });
  M.def('tablet', (add) => {
    add(X(-0.38, -0.06, 0.05, 0.38, 0.06, 0.95), MCOL(176, 110, 70), 'tab');
    for (let k = 0; k < 6; k++) add(X(-0.3, 0.06, 0.8 - k * 0.12, 0.2 + MHASH(k, 1) * 0.1, 0.07, 0.83 - k * 0.12), MCOL(110, 60, 36), 'tab');
    add(B([0, 0.1, 0.04], [0.3, 0.2, 0.08], 8, 5, 0.4, 2), stoneD, 'body');
  });
  M.def('asphodel', (add) => {
    for (let k = 0; k < 5; k++) add(F([[[0, 0, 0], [(MHASH(k, 1) - 0.5) * 0.5, (MHASH(k, 2) - 0.5) * 0.5, 0.35], [(MHASH(k, 1) - 0.5) * 0.45 + 0.04, (MHASH(k, 2) - 0.5) * 0.45, 0.32]]]), MC('F'), 'body');
    add(T([0, 0, 0], [0.02, 0, 0.95], 0.02, 0.012, 5), MC('F'), 'body');
    for (let k = 0; k < 7; k++) {
      const z = 0.6 + k * 0.055, a = k * 2.2;
      const c = [Math.cos(a) * 0.06, Math.sin(a) * 0.06, z];
      add(B(c, [0.05, 0.05, 0.02], 6, 3), MC('f'), 'body');
      add(B([c[0], c[1], c[2] + 0.01], [0.012, 0.012, 0.01], 4, 3), MCOL(200, 120, 60), 'body');
    }
  });
  M.def('obol', (add) => {
    add(T([0, -0.06, 0.5], [0, 0.06, 0.5], 0.48, 0.48, 16), MC('y'), 'body');
    add(B([0, 0.065, 0.5], [0.2, 0.01, 0.25], 8, 4), MC('Y'), 'body');
  });
  M.def('stringCoil', (add) => {
    const pts = [];
    for (let k = 0; k <= 30; k++) { const a = (k / 30) * Math.PI * 4; pts.push([Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.3 + k * 0.012]); }
    add(CH(pts, 0.04, 0.04, 5), cream, 'body', true);
  });
};

// ---- Τα σημεία περιστροφής των κοκάλων ----
Object.assign(Models.pivots, {
  legL: [0, 0, 0.52], legR: [0, 0, 0.52], armL: [-0.12, 0, 0.79], armR: [0.12, 0, 0.79], head: [0, 0, 0.84], jaw: [0, 0.005, 0.9],
  body: [0, 0, 0], legs: [0, 0, 0], throne: [0, 0, 0], wingL: [-0.05, -0.07, 0.78], wingR: [0.05, -0.07, 0.78],
  legFL: [0, 0.28, 0.58], legFR: [0, 0.28, 0.58], legBL: [0, -0.32, 0.58], legBR: [0, -0.32, 0.58], tail: [0, -0.45, 0.56],
  lid: [0, -0.34, 0.55], cloth: [0, 0, 0.9], statueArm: [0, 0, 0], base: [0, 0, 0], tab: [0, 0, 0], headM: [0, 0.34, 0.66],
});

// Η στάση ενός μοντέλου τώρα: γωνίες ανά κόκαλο [γύρω από x (μπρος-πίσω), γύρω από y (πλάγια)]· για όλο το σώμα
// lie (ξαπλωμένο), lower (ζώο ξαπλωμένο), bob. a = { t, walk (0..1), phase, frame, bark, lie, asleep, sleepHeads, scare (0..1) }
Models.pose = function (name, a) {
  const p = {}, t = a.t, sw = Math.sin(a.phase) * 0.55 * a.walk;
  if (name === 'cerberus' || name === 'goat') {
    const g = a.walk, ph = a.phase;
    p.legFL = [Math.sin(ph) * 0.7 * g, 0]; p.legBR = [Math.sin(ph) * 0.6 * g, 0];
    p.legFR = [-Math.sin(ph) * 0.7 * g, 0]; p.legBL = [-Math.sin(ph) * 0.6 * g, 0];
    p.tail = [Math.sin(t * 2) * 0.1, Math.sin(t * 5) * 0.45];
    p.bob = Math.abs(Math.sin(ph)) * 0.03 * g;
    if (name === 'goat') { p.headM = [0.25 + Math.sin(t * 0.7) * 0.25, 0]; this.pivots.headM = [0, 0.3, 0.72]; }
    if (name === 'cerberus') {
      const bark = a.bark || [0, 0, 0];
      ['L', 'M', 'R'].forEach((n, i) => {
        p['head' + n] = [Math.sin(t * (1.1 + i * 0.13) + i * 2) * 0.06 - 0.12 * bark[i], (i - 1) * 0.12 + Math.sin(t * 0.8 + i) * 0.06];
        p['jaw' + n] = [0.05 + 0.25 * bark[i] + Math.sin(t * 3 + i) * 0.03, 0];
      });
      if (a.scare) for (const n of ['L', 'M', 'R']) { p['jaw' + n] = [0.15 + a.scare * 0.55, 0]; p['head' + n][0] -= a.scare * 0.25; }
      if (a.lie) {
        p.legFL = p.legFR = [-1.35, 0]; p.legBL = p.legBR = [1.35, 0];
        p.lower = 0.36;
        for (const n of ['L', 'M', 'R']) { p['jaw' + n] = [0.12, 0]; p['head' + n][0] += 0.25; }
      }
      for (let i = 0; i < (a.asleep ? 3 : a.sleepHeads || 0); i++) { const n = ['L', 'M', 'R'][i]; p['head' + n][0] += 0.55; p['jaw' + n] = [0, 0]; }
    }
    return p;
  }
  p.legL = [sw, 0]; p.legR = [-sw, 0];
  p.armL = [-sw * 0.8 + Math.sin(t * 1.6) * 0.03, -0.04]; p.armR = [sw * 0.8 - Math.sin(t * 1.6) * 0.03, 0.04];
  p.head = [Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.6) * 0.07];
  if (name === 'ghoul') {
    p.armL = [-0.25 + Math.sin(t * 2.1) * 0.18, 0]; p.armR = [-0.25 + Math.sin(t * 2.1 + 1.6) * 0.18, 0];
    p.bob = Math.sin(t * 3) * 0.012;
    p.jaw = [0.08 + Math.sin(t * 4) * 0.06, 0];
    this.pivots.jaw = [0, 0.25, 0.8];
    if (a.scare) { p.jaw = [0.15 + a.scare * 0.6, 0]; p.armL = p.armR = [-1.0 - a.scare * 0.3, 0]; p.head = [-0.15, 0]; }
  } else this.pivots.jaw = [0, 0.005, 0.9];
  if (name === 'erinys3d') {
    const f = Math.sin(t * (a.scare ? 16 : 9)) * 0.55;
    p.wingL = [0, f]; p.wingR = [0, -f];
    for (let k = 0; k < 8; k++) p['snake' + k] = [Math.sin(t * 6 + k * 1.3) * 0.35, Math.cos(t * 5 + k) * 0.35];
    p.bob = Math.sin(t * 2.5) * 0.02;
    if (a.scare) { p.jaw = [0.1 + a.scare * 0.5, 0]; p.armL = p.armR = [-1.3, 0]; }
  }
  if (name === 'charon3d' && a.frame === 1) p.armL = [-1.25, -0.2];
  if (name === 'villager') p.armR = [-0.25, 0];
  if (name === 'persephone3d' && a.frame === 1) p.body = [0, 0.3];
  if (name === 'snake3d') { this.pivots.headM = this.snakeHead || [0, 0, 0]; p.headM = [a.frame === 1 ? -0.3 : Math.sin(t * 1.5) * 0.05, Math.sin(t * 0.9) * 0.15]; }
  if (name === 'euryLying') { p.lie = true; p.head = [0, 0.3]; }
  if (name === 'chest' && a.frame === 1) p.lid = [-1.7, 0];
  if (name === 'laundry') p.cloth = [Math.sin(t * 1.3) * 0.12, 0];
  if (MODEL_GHOST.has(name)) p.bob = 0.04 + Math.sin(t * 1.8) * 0.02;
  return p;
};

// Τα τρίγωνα του μοντέλου στον κόσμο (κελιά): [x, y, z, nx, ny, nz, r, g, b, glow] ανά κορυφή.
// pos = { x, y, z } · yaw (προς τα πού κοιτάζει) · h (ύψος σε κελιά) · pose · dim (σκοτείνιασμα του προλόγου).
Models.emit = function (name, pos, yaw, h, pose, out, dim = 1) {
  const def = this.defs[name];
  if (!def) return;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const lie = pose.lie, lower = pose.lower || 0, bob = pose.bob || 0;
  const rot = (v, piv, ax, ay, isN) => {
    let x = v[0] - (isN ? 0 : piv[0]), y = v[1] - (isN ? 0 : piv[1]), z = v[2] - (isN ? 0 : piv[2]);
    if (ax) { const c = Math.cos(ax), s = Math.sin(ax); const y2 = y * c - z * s, z2 = y * s + z * c; y = y2; z = z2; }
    if (ay) { const c = Math.cos(ay), s = Math.sin(ay); const x2 = x * c + z * s, z2 = -x * s + z * c; x = x2; z = z2; }
    return isN ? [x, y, z] : [x + piv[0], y + piv[1], z + piv[2]];
  };
  for (const part of def.parts) {
    const piv = this.pivots[part.bone] || [0, 0, 0];
    // (τα σαγόνια ανοίγουν προς τα κάτω: θετική γωνία στη στάση = ανοιχτό στόμα)
    const ang0 = pose[part.bone];
    const ang = ang0 && part.bone.startsWith('jaw') ? [-ang0[0], ang0[1]] : ang0;
    const glow = part.glow ? 1 : 0;
    for (const tri of part.tris) {
      const col = typeof part.col === 'function' ? part.col(tri.seg || 0, tri.ring === undefined ? -1 : tri.ring) : part.col;
      for (const v0 of tri) {
        let v = ang ? rot(v0, piv, ang[0], ang[1], false) : [v0[0], v0[1], v0[2]];
        let n = ang ? rot([v0[3], v0[4], v0[5]], piv, ang[0], ang[1], true) : [v0[3], v0[4], v0[5]];
        if (lie) { v = [v[0], v[2] - 0.5, v[1] + 0.12]; n = [n[0], n[2], n[1]]; }
        else if (lower) v = [v[0], v[1], v[2] < 0.55 ? v[2] * (1 - lower) : v[2] - 0.55 * lower];
        const lx = v[0] * h, ly = v[1] * h, lz = (v[2] + bob) * h;
        out.push(pos.x + cy * ly - sy * lx, pos.y + sy * ly + cy * lx, pos.z + lz,
          cy * n[1] - sy * n[0], sy * n[1] + cy * n[0], n[2], col[0] * dim, col[1] * dim, col[2] * dim, glow);
      }
    }
  }
};

// Ποιο μοντέλο αντικαθιστά ποιο sprite (όνομα καρέ → μοντέλο).
const MODEL_OF = {
  euryAlive: 'euryAlive', euryLying: 'euryLying', eurydice3d: 'eurydice3d', villager: 'villager', mournerF: 'mournerF',
  mournerM: 'mournerM', charon3d: 'charon3d', boat3d: 'boat3d', hades3d: 'hades3d', persephone3d: 'persephone3d',
  soulM3d: 'soulM3d', soulF3d: 'soulF3d', soulOld3d: 'soulOld3d', ghoul: 'ghoul', erinys3d: 'erinys3d', cerberus: 'cerberus',
  goat: 'goat', snake3d: 'snake3d',
  olive: 'olive', cypress: 'cypress', bed: 'bed', table: 'table', loom: 'loom', hearth: 'hearth', laundry: 'laundry', stele: 'stele',
  amphoraBroken: 'amphoraBroken', skull: 'skull', skullpile: 'skullpile', bones: 'bones', rocks: 'rocks', reeds: 'reeds',
  roots: 'roots', chain: 'chain', bars: 'bars', tripod: 'tripod', niche: 'niche', chest: 'chest', tablet: 'tablet',
  asphodel: 'asphodel', obol: 'obol', stringCoil: 'stringCoil', statue: 'statue',
};
// Τα χλωμά (ψυχές, η Ευρυδίκη-σκιά): λάμπουν μόνα τους, σαν φαντάσματα.
const MODEL_GHOST = new Set(['eurydice3d', 'soulM3d', 'soulF3d', 'soulOld3d']);
// Τα ακίνητα σκηνικά: κοιτάζουν σε σταθερή (τυχαία) κατεύθυνση, και τα τρίγωνά τους κρατιούνται (cache).
const MODEL_STATIC = new Set(['olive', 'cypress', 'bed', 'table', 'loom', 'hearth', 'stele', 'amphoraBroken', 'skull', 'skullpile',
  'bones', 'rocks', 'reeds', 'roots', 'chain', 'bars', 'tripod', 'niche', 'tablet', 'asphodel', 'statue']);
// Τα μάτια (για τη λάμψη τους στο jump scare): σημεία στο μοντέλο (κανονικά, χωρίς στάση).
const MODEL_EYES = { ghoul: [[-0.023, 0.302, 0.85], [0.023, 0.302, 0.85]], erinys3d: [[-0.022, 0.06, 0.933], [0.022, 0.06, 0.933]],
  cerberus: [[-0.035, 0.67, 0.91], [0.035, 0.67, 0.91]] };
