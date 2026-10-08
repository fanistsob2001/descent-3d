'use strict';

// Η ζωγραφική των μορφών του 3D κόσμου σε 2D (μετά τα 3D μοντέλα, που ο χρήστης δεν ήθελε): κάθε μορφή είναι μια
// λεπτομερής pixel art ζωγραφιά (billboard), στο στυλ των εικόνων αναφοράς του χρήστη — σκοτεινές μορφές με
// σκίαση σε τόνους (φωτεινή ακμή πάνω-αριστερά, σκιά κάτω-δεξιά), σκούρο περίγραμμα, μάτια που λάμπουν — αλλά
// μόνο με τα χρώματα της PALETTE (js/pixel.js), όπως όλο το παιχνίδι.
//
// Πώς: κάθε μορφή "ζωγραφίζεται" με το Canvas 2D σε συντεταγμένες σχεδίου (π.χ. άνθρωπος 60×100) από σχήματα
// (Art.Painter: blob = λείο κλειστό σχήμα, limb = κωνικό "λουρί" για χέρια / πόδια / ουρές / φίδια / κλαδιά, ell,
// line, dot, speckle), μεγαλώνει στο μέγεθος που έχει στον κόσμο (ART_PX pixels ανά μονάδα κόσμου, από το
// RC_REAL_H), και στο τέλος (Art.finish) κάθε pixel γίνεται το πλησιέστερο χρώμα της παλέτας (με λίγο dithering
// μόνο στις διαβαθμίσεις), η διαφάνεια γίνεται 0 / 1 και μπαίνει περίγραμμα.
// Τα καρέ μπαίνουν στο Sprites.art (το Sprites.getHD τα προτιμάει) — οι cutscenes και η κάτοψη κρατάνε τα παλιά.

const ART_PX = 3.6;   // pixels της ζωγραφιάς ανά μονάδα κόσμου (άνθρωπος 23 μονάδες ≈ 84 pixels)

// Κλίμακες τόνων (σκούρο → φωτεινό), όλες από την PALETTE. Ένας τόνος γράφεται 'όνομα' + θέση, π.χ. 'ink3':
// βάση = ink[3], φως = ink[4], σκιά = ink[2], βαθιά σκιά = ink[1].
const ART_RAMPS = {
  ink: [[0, 0, 0], [16, 7, 5], [30, 12, 9], [38, 24, 15], [62, 40, 25], [92, 66, 42]],
  mar: [[16, 7, 5], [30, 12, 9], [48, 16, 12], [70, 20, 15], [96, 26, 19], [124, 36, 25], [158, 64, 30]],
  brn: [[16, 7, 5], [38, 24, 15], [62, 40, 25], [92, 66, 42], [128, 100, 66], [170, 142, 100], [212, 190, 146], [236, 218, 186]],
  cla: [[48, 16, 12], [96, 26, 19], [158, 64, 30], [198, 98, 40], [232, 138, 54], [248, 182, 100], [255, 246, 228]],
  skn: [[70, 20, 15], [96, 26, 19], [150, 90, 60], [206, 134, 92], [248, 182, 100], [255, 246, 228]],
  crm: [[62, 40, 25], [128, 100, 66], [170, 142, 100], [212, 190, 146], [236, 218, 186], [255, 246, 228]],
  red: [[16, 7, 5], [48, 16, 12], [96, 26, 19], [140, 18, 12], [200, 34, 22], [255, 84, 56], [248, 182, 100]],
  gld: [[38, 24, 15], [92, 66, 42], [168, 120, 40], [222, 172, 58], [248, 182, 100], [255, 246, 228]],
};
const ART_INK = [16, 7, 5];    // το περίγραμμα

const Art = {
  frames: {},   // όνομα → [καρέ]· καρέ = { c, f (καθρεφτισμένο), w, h, hd, name, eyes? }

  // ---- Χρώματα ----
  css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; },
  // 'ink3' → { base, light, dark, dark2 } (css). Ή ένα χρώμα [r, g, b] (επίπεδο), ή string css.
  tone(t) {
    if (Array.isArray(t)) { const c = this.css(t); return { base: c, light: c, dark: c, dark2: c, flat: true }; }
    if (typeof t !== 'string') return { base: t, light: t, dark: t, dark2: t, flat: true };   // CanvasGradient
    // 'ink2/ink4' = βάση ink2 με φως ink4 (πιο έντονη φωτεινή ακμή)· τρίτο = σκιά.
    if (t.includes('/')) {
      const [b, l, d] = t.split('/').map((x) => this.tone(x));
      return { base: b.base, light: l.base, dark: d ? d.base : b.dark, dark2: d ? d.dark : b.dark2 };
    }
    const m = /^([a-z]+)(\d)$/.exec(t);
    if (!m || !ART_RAMPS[m[1]]) return { base: t, light: t, dark: t, dark2: t, flat: true };
    const r = ART_RAMPS[m[1]], i = Number(m[2]);
    const at = (k) => this.css(r[Math.max(0, Math.min(r.length - 1, k))]);
    return { base: at(i), light: at(i + 1), dark: at(i - 1), dark2: at(i - 2) };
  },
  col(t) {   // ένα χρώμα από τόνο ('ink3' = η βάση του)
    return this.tone(t).base;
  },

  // ---- Μια ζωγραφιά ----
  // dw × dh = μέγεθος σε μονάδες σχεδίου· ph = ύψος σε pixels (χωρίς το περίγραμμα). draw(g, frame).
  // opts: { outline: [r,g,b] | null, dither: 0..1, frames: n, eyes(frame, s) → [[x, y], ...] (μονάδες σχεδίου) }
  paint(name, dw, dh, ph, draw, opts = {}) {
    const n = opts.frames || 1;
    const list = [];
    for (let f = 0; f < n; f++) {
      const s = ph / dh;
      const pad = opts.pad === undefined ? 2 : opts.pad;
      const W = Math.ceil(dw * s) + pad * 2, H = Math.ceil(dh * s) + pad * 2;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.translate(pad, pad);
      ctx.scale(s, s);
      const g = new ArtPainter(ctx, dw, dh, s);
      draw(g, f);
      this.finish(cv, opts);
      const fl = document.createElement('canvas');
      fl.width = W; fl.height = H;
      const fc = fl.getContext('2d');
      fc.translate(W, 0); fc.scale(-1, 1); fc.drawImage(cv, 0, 0);
      const fr = { c: cv, f: fl, w: W, h: H, hd: (RC_SPX * ART_PX * H) / ph, name, art: true };
      if (g.eyes.length) fr.eyes = g.eyes;
      list.push(fr);
    }
    this.frames[name] = list;
    return list;
  },

  // Κβάντιση στην παλέτα, διαφάνεια 0 / 1, περίγραμμα.
  _near: new Map(),
  nearest(r, g, b) {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = this._near.get(key);
    if (v !== undefined) return v;
    let best = 0, bd = Infinity;
    for (let k = 0; k < PALETTE.length; k++) {
      const p = PALETTE[k];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 + Math.abs((r + g + b) - (p[0] + p[1] + p[2])) * 0.0;
      if (d < bd) { bd = d; best = k; }
    }
    v = best;
    this._near.set(key, v);
    return v;
  },
  finish(cv, opts = {}) {
    const W = cv.width, H = cv.height;
    const ctx = cv.getContext('2d');
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const dither = opts.dither === undefined ? 0.6 : opts.dither;
    const exact = new Set(PALETTE.map((p) => (p[0] << 16) | (p[1] << 8) | p[2]));
    const solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 3] < (opts.cut || 110)) { d[i + 3] = 0; continue; }
        // (το χρώμα με premultiplied ακμές: ξαναφτιάχνεται η αληθινή τιμή)
        const a = d[i + 3] / 255;
        let r = d[i] / a, g = d[i + 1] / a, b = d[i + 2] / a;
        if (a > 0.99 && exact.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) { d[i + 3] = 255; solid[y * W + x] = 1; continue; }
        if (dither) {
          const o = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 34 * dither;
          r += o; g += o; b += o;
        }
        const p = PALETTE[this.nearest(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)))];
        d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
        solid[y * W + x] = 1;
      }
    }
    const ol = opts.outline === undefined ? ART_INK : opts.outline;
    if (ol) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (solid[y * W + x]) continue;
          const s = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && solid[yy * W + xx];
          if (s(x - 1, y) || s(x + 1, y) || s(x, y - 1) || s(x, y + 1)) {
            const i = (y * W + x) * 4;
            d[i] = ol[0]; d[i + 1] = ol[1]; d[i + 2] = ol[2]; d[i + 3] = 255;
          }
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
  },

  get(name, i = 0) {
    const l = this.frames[name];
    if (!l) return null;
    return l[((i % l.length) + l.length) % l.length];
  },

  // Όλες οι ζωγραφιές (μετά το Pixel.init και το Sprites.init). Οι μορφές: js/art-*.js.
  init() {
    for (const fn of ART_BUILDERS) fn(this);
    Sprites.art = this.frames;
  },
};

// Οι συναρτήσεις που φτιάχνουν τις ζωγραφιές (τις προσθέτουν τα js/art-*.js).
const ART_BUILDERS = [];

// ---- Ο "ζωγράφος": σχήματα σε συντεταγμένες σχεδίου ----
class ArtPainter {
  constructor(ctx, w, h, s) {
    this.ctx = ctx; this.w = w; this.h = h; this.s = s;
    this.lx = -1; this.ly = -1;   // από πού έρχεται το φως (πάνω-αριστερά)
    this.eyes = [];
  }

  // Λείο κλειστό σχήμα από σημεία (Catmull-Rom). Ένα σημείο [x, y, 1] = γωνία (όχι καμπύλη).
  path(pts, closed = true) {
    const p = new Path2D();
    const n = pts.length;
    if (n < 2) return p;
    p.moveTo(pts[0][0], pts[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const a = !closed && i === 0 ? p1 : p0, b = !closed && i + 2 >= n ? p2 : p3;
      const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - a[0]) / 6, p1[1] + (p2[1] - a[1]) / 6];
      const c2 = p2[2] ? p2 : [p2[0] - (b[0] - p1[0]) / 6, p2[1] - (b[1] - p1[1]) / 6];
      p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
    }
    if (closed) p.closePath();
    return p;
  }

  // Γεμίζει ένα σχήμα (Path2D) με σκίαση: βάση, φωτεινή ακμή προς το φως, σκιά (και βαθιά σκιά) από την άλλη.
  // o: { rim: πάχος σκιάς (μονάδες), hi: πάχος φωτός, deep: πάχος βαθιάς σκιάς, line: χρώμα γραμμής περιγράμματος }
  shade(path, t, o = {}) {
    const c = this.ctx, T = Art.tone(t);
    const sz = o.size || 6;
    const rim = o.rim === undefined ? Math.max(0.9 / this.s, sz * 0.22) : o.rim;
    const hi = o.hi === undefined ? Math.max(0.8 / this.s, sz * 0.12) : o.hi;
    const deep = o.deep === undefined ? (sz > 10 ? rim * 0.35 : 0) : o.deep;
    c.save();
    if (T.flat || o.flat) {
      c.fillStyle = T.base;
      c.fill(path);
    } else {
      // Σε στρώσεις (μόνο nonzero γεμίσματα, ώστε σχήματα από πολλά κομμάτια να μη "τρυπάνε"): ένα σημείο p είναι
      // σκιά αν το p + rim (προς τη σκιά) βγαίνει έξω από το σχήμα, φως αν το p − hi (προς το φως) βγαίνει έξω.
      const lx = o.lx === undefined ? this.lx : o.lx, ly = o.ly === undefined ? this.ly : o.ly;
      const ln = Math.hypot(lx, ly) || 1;
      const ux = -lx / ln, uy = -ly / ln;   // προς τη σκιά
      const moved = (d) => { const q = new Path2D(); q.addPath(path, new DOMMatrix().translateSelf(-ux * d, -uy * d)); return q; };
      c.clip(path);
      c.fillStyle = deep > 0 ? T.dark2 : T.dark;
      c.fill(path);
      if (deep > 0) { c.fillStyle = T.dark; c.fill(moved(deep)); }
      const inner = moved(rim);
      c.fillStyle = T.light;
      c.fill(inner);
      c.save();
      c.clip(moved(-hi));
      c.fillStyle = T.base;
      c.fill(inner);
      c.restore();
    }
    c.restore();
    if (o.line) {
      c.save();
      c.strokeStyle = Array.isArray(o.line) ? Art.css(o.line) : Art.col(o.line);
      c.lineWidth = (o.lw || 1) / this.s;
      c.stroke(path);
      c.restore();
    }
    return path;
  }

  // Ένα λείο σχήμα με σκίαση. size = περίπου πόσο μεγάλο είναι (για το πάχος των ακμών).
  blob(pts, t, o = {}) {
    if (o.size === undefined) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      o = { ...o, size: Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) };
    }
    return this.shade(this.path(pts, true), t, o);
  }
  poly(pts, t, o = {}) {
    return this.blob(pts.map((p) => [p[0], p[1], 1]), t, o);
  }
  ell(cx, cy, rx, ry, t, o = {}) {
    const p = new Path2D();
    p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), o.rot || 0, 0, Math.PI * 2);
    return this.shade(p, t, { size: Math.min(Math.abs(rx), Math.abs(ry)) * 2, ...o });
  }

  // Κωνικό "λουρί" κατά μήκος μιας καμπύλης (χέρια, πόδια, ουρές, φίδια, κλαδιά, τρίχες): πλάτος w0 → w1.
  // Επιστρέφει το σχήμα (Path2D). o.cap: στρογγυλές άκρες.
  // w0 μπορεί να είναι πίνακας: πάχος σε κάθε σημείο ελέγχου (τότε το w1 αγνοείται).
  limbPath(pts, w0, w1, o = {}) {
    const n = Math.max(6, Math.round(this.len(pts) * 1.5 * this.s / 2));
    const P = this.sample(pts, n);
    const L = [], R = [];
    const prof = Array.isArray(w0) ? w0 : null;
    if (prof) { w1 = prof[prof.length - 1]; w0 = prof[0]; }
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const t = i / (P.length - 1);
      let ww;
      if (prof) {
        const u = t * (prof.length - 1), k = Math.min(prof.length - 2, Math.floor(u)), f = u - k;
        const e = f * f * (3 - 2 * f);
        ww = prof[k] + (prof[k + 1] - prof[k]) * e;
      } else ww = w0 + (w1 - w0) * (o.ease ? t * t : t);
      const w = ww / 2 * (o.bulge ? 1 + o.bulge * Math.sin(t * Math.PI) : 1);
      L.push([P[i][0] + nx * w, P[i][1] + ny * w]);
      R.push([P[i][0] - nx * w, P[i][1] - ny * w]);
    }
    // Ένα κλειστό σχήμα: η μία πλευρά, μισός κύκλος στην άκρη, η άλλη πλευρά ανάποδα, μισός κύκλος στην αρχή.
    const cap = (c, from, to) => {
      const out = [];
      if (o.cap === false) return out;
      const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]), r = Math.hypot(from[0] - c[0], from[1] - c[1]);
      let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
      // (ο μισός κύκλος προς τα έξω: από το from στο to γυρνώντας από την πλευρά της κατεύθυνσης)
      let da = a1 - a0;
      while (da > 0) da -= Math.PI * 2;
      for (let k = 1; k < 6; k++) out.push([c[0] + Math.cos(a0 + (da * k) / 6) * r, c[1] + Math.sin(a0 + (da * k) / 6) * r]);
      return out;
    };
    const ring = [...L, ...cap(P[P.length - 1], L[L.length - 1], R[R.length - 1]), ...R.slice().reverse(), ...cap(P[0], R[0], L[0])];
    const path = new Path2D();
    path.moveTo(ring[0][0], ring[0][1]);
    for (const q of ring) path.lineTo(q[0], q[1]);
    path.closePath();
    return path;
  }
  limb(pts, w0, w1, t, o = {}) {
    return this.shade(this.limbPath(pts, w0, w1, o), t, { size: Array.isArray(w0) ? Math.max(...w0) : Math.max(w0, w1), ...o });
  }

  // Σημεία πάνω σε μια ανοιχτή λεία καμπύλη (Catmull-Rom).
  sample(pts, n) {
    if (pts.length === 2) {
      const out = [];
      for (let i = 0; i <= n; i++) out.push([pts[0][0] + (pts[1][0] - pts[0][0]) * (i / n), pts[0][1] + (pts[1][1] - pts[0][1]) * (i / n)]);
      return out;
    }
    const segs = pts.length - 1, out = [];
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * segs, k = Math.min(segs - 1, Math.floor(u)), t = u - k;
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(segs, k + 2)];
      const t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
    return out;
  }
  len(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return l;
  }

  // Λεπτή γραμμή ενός χρώματος (λεπτομέρειες: πτυχώσεις, ρωγμές, χορδές). w σε pixels αν o.px, αλλιώς μονάδες.
  line(pts, w, t, o = {}) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = Art.col(t);
    c.lineWidth = o.px ? w / this.s : w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke(this.path(pts, false));
    c.restore();
  }
  dot(x, y, r, t) {
    const c = this.ctx;
    c.save();
    c.fillStyle = Art.col(t);
    c.beginPath();
    c.arc(x, y, Math.max(r, 0.55 / this.s), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // Ένα pixel (για μάτια, σπίθες) στη θέση (x, y) σε μονάδες σχεδίου.
  px(x, y, t, n = 1) {
    const c = this.ctx;
    c.save();
    c.fillStyle = Art.col(t);
    c.fillRect(x - n / (2 * this.s), y - n / (2 * this.s), n / this.s, n / this.s);
    c.restore();
  }
  // Μάτι που λάμπει: φωτεινό pixel (και σημειώνεται για τη λάμψη του κόσμου).
  eye(x, y, t, n = 1) {
    this.px(x, y, t, n);
    this.mark(x, y);
  }
  // Σημειώνει ένα μάτι (σε pixels του καρέ, με τον τωρινό μετασχηματισμό) για τη λάμψη του κόσμου.
  mark(x, y) {
    const m = this.ctx.getTransform();
    this.eyes.push([m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  }
  // Κόκκοι / κηλίδες μέσα σε ένα σχήμα (υφή: πέτρα, γούνα, χώμα). seed = σταθερό "τυχαίο".
  speckle(path, t, count, r = 0.5, seed = 1) {
    const c = this.ctx;
    const rnd = ArtPainter.rng(seed);
    c.save();
    c.clip(path);
    c.fillStyle = Art.col(t);
    for (let i = 0; i < count; i++) {
      const x = rnd() * this.w, y = rnd() * this.h;
      c.fillRect(x, y, Math.max(r, 1 / this.s), Math.max(r, 1 / this.s));
    }
    c.restore();
  }
  // Γραμμές μέσα σε ένα σχήμα (πτυχώσεις, τρίχες): κάθε γραμμή από fn(i, rnd) → σημεία.
  hatch(path, t, n, fn, w = 1, seed = 3) {
    const c = this.ctx, rnd = ArtPainter.rng(seed);
    c.save();
    c.clip(path);
    for (let i = 0; i < n; i++) {
      const pts = fn(i, rnd);
      if (pts) this.line(pts, w, t, { px: true });
    }
    c.restore();
  }
  // Κάτι ζωγραφισμένο μόνο μέσα σε ένα σχήμα.
  inside(path, fn) {
    this.ctx.save();
    this.ctx.clip(path);
    fn();
    this.ctx.restore();
  }
  // Λάμψη (απαλό φως) — μετά την κβάντιση γίνεται δαχτυλίδια χρωμάτων.
  glow(x, y, r, t, a = 1) {
    const c = this.ctx, col = Array.isArray(t) ? t : ART_RAMPS[t.replace(/\d/, '')][Number(t.slice(-1))];
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col.join(',') + ',' + a + ')');
    g.addColorStop(1, 'rgba(' + col.join(',') + ',0)');
    c.save();
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  // Καθρέφτισμα (μορφές από μπροστά): fn(m, sx) μία φορά όπως είναι (m(x) = x, sx = 1) και μία καθρεφτισμένη γύρω από cx.
  sym(cx, fn) {
    fn((x) => x, 1);
    fn((x) => 2 * cx - x, -1);
  }
  static rng(seed) {
    let s = (seed * 9301 + 49297) % 233280;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
}
