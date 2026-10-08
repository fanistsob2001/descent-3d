'use strict';

// Οι ζωγραφιές των cutscenes (STORY.md, ενότητα 7): μία κινούμενη εικόνα για κάθε γραμμή, στο ίδιο
// στυλ με τον 3D κόσμο — pixel art 256×144 με τις λεπτομερείς μορφές (js/creatures.js) και στο
// τέλος όλη η εικόνα μπαίνει στην παλέτα του κόσμου (PALETTE, επίπεδα χρώματα, χωρίς dithering).
// Κάθε σκηνή έχει ένα σταθερό φόντο (bg, ζωγραφίζεται μία φορά) και ό,τι κινείται (fg, κάθε καρέ).

const CA_W = 256, CA_H = 144;

// Ποια σκηνή δείχνει κάθε γραμμή (η σειρά των γραμμών του STORY.md).
const CUT_PANELS = {
  intro: ['snake', 'fallen', 'grave', 'resolve', 'taenarum', 'slip', 'strings', 'dark', 'echo'],
  middle: ['play', 'weep', 'lean', 'hades', 'hades', 'forever'],
  good: ['light', 'open', 'hand', 'behind', 'myth', 'together'],
  bad: ['turned', 'saw', 'taken', 'alone', 'myth'],
};

// Χρώματα (από την PALETTE του js/pixel.js).
const CA = {
  black: [0, 0, 0], night: [16, 7, 5], deep: [30, 12, 9], wine: [48, 16, 12], maroon: [70, 20, 15],
  brick: [96, 26, 19], rust: [124, 36, 25], umber: [38, 24, 15], brown: [62, 40, 25], khaki: [92, 66, 42],
  sand: [128, 100, 66], tan: [170, 142, 100], bone: [212, 190, 146], clay: [158, 64, 30], terra: [198, 98, 40],
  orange: [232, 138, 54], peach: [248, 182, 100], cream: [236, 218, 186], white: [255, 246, 228],
  blood: [140, 18, 12], red: [200, 34, 22], hot: [255, 84, 56], gold: [222, 172, 58], ochre: [168, 120, 40],
};
const caCol = (k, a = 1) => { const c = CA[k] || k; return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

function caHash(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function caNoise(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return caHash(i * 131 + seed * 7919) * (1 - u) + caHash((i + 1) * 131 + seed * 7919) * u;
}

// ---- Βοηθητικά ζωγραφικής ----
function caSky(c, stops, h = CA_H) {
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [o, k] of stops) g.addColorStop(o, caCol(k));
  c.fillStyle = g;
  c.fillRect(0, 0, CA_W, h);
}
// Κορυφογραμμή (λόφοι, βουνά): γεμάτη από τη γραμμή ως το κάτω μέρος.
function caRidge(c, base, amp, scale, seed, col) {
  c.fillStyle = caCol(col);
  c.beginPath();
  c.moveTo(0, CA_H);
  for (let x = 0; x <= CA_W; x += 2) c.lineTo(x, base - amp * (caNoise(x / scale, seed) * 0.7 + caNoise((x / scale) * 3, seed + 1) * 0.3));
  c.lineTo(CA_W, CA_H);
  c.fill();
}
function caGlow(c, x, y, r, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, caCol(col, a));
  g.addColorStop(1, caCol(col, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function caSun(c, x, y, r, col = 'white', glow = 'peach') {
  caGlow(c, x, y, r * 4, glow, 0.6);
  c.fillStyle = caCol(col);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
function caStars(c, n, seed, hMax) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = caCol(caHash(i + seed) > 0.8 ? 'cream' : 'tan', 0.5 + caHash(i * 3 + seed) * 0.5);
    c.fillRect(Math.floor(caHash(i * 7 + seed) * CA_W), Math.floor(caHash(i * 11 + seed) * hMax), 1, 1);
  }
}
// Χορτάρι: λεπίδες ενός pixel που λυγίζουν στον αέρα.
function caGrass(c, y0, t, n, seed, cols, hMax, spread = 6) {
  for (let i = 0; i < n; i++) {
    const x = caHash(i * 7 + seed) * CA_W, y = y0 + caHash(i * 3 + seed) * spread;
    const h = Math.max(2, hMax * (0.4 + 0.6 * caHash(i * 13 + seed)));
    const sway = Math.sin(t * 1.4 + x * 0.06) * h * 0.18 + h * 0.08;
    c.fillStyle = caCol(cols[i % cols.length]);
    for (let k = 0; k < h; k++) c.fillRect(Math.round(x + (sway * k * k) / (h * h)), Math.round(y - k), 1, 1);
  }
}
function caFlowers(c, y0, n, seed, spread = 10) {
  for (let i = 0; i < n; i++) {
    const x = Math.round(caHash(i * 5 + seed) * CA_W), y = Math.round(y0 + caHash(i * 9 + seed) * spread);
    c.fillStyle = caCol('ochre');
    c.fillRect(x, y, 1, 3);
    c.fillStyle = caCol('cream');
    c.fillRect(x - 1, y - 1, 3, 1);
    c.fillRect(x, y - 2, 1, 3);
  }
}
function caCypress(c, x, base, h, col) {
  c.fillStyle = caCol(col);
  c.beginPath();
  c.ellipse(x, base - h / 2, h * 0.13, h / 2, 0, 0, Math.PI * 2);
  c.fill();
}
// Φλόγα (βωμοί, μαγκάλια): τρεις γλώσσες που τρεμοπαίζουν και λάμψη γύρω.
function caFire(c, x, y, s, t) {
  caGlow(c, x, y - s * 3, s * 14, 'orange', 0.35 + 0.08 * Math.sin(t * 13));
  const layers = [['red', 1], ['orange', 0.7], ['peach', 0.45], ['white', 0.22]];
  for (const [k, m] of layers) {
    for (let j = -1; j <= 1; j++) {
      const fl = 1 + 0.25 * Math.sin(t * (9 + j * 3) + j * 2 + m * 5);
      c.fillStyle = caCol(k);
      c.beginPath();
      c.ellipse(x + j * s * 1.2 * m, y - s * 2.2 * m * fl, s * 1.3 * m, s * 3.2 * m * fl, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
}
function caBrazier(c, x, y, s) {
  c.strokeStyle = caCol('ochre');
  c.lineWidth = Math.max(1, s * 0.4);
  c.beginPath();
  c.moveTo(x - s * 3, y); c.lineTo(x, y - s * 6);
  c.moveTo(x + s * 3, y); c.lineTo(x, y - s * 6);
  c.moveTo(x, y); c.lineTo(x, y - s * 6);
  c.stroke();
  c.fillStyle = caCol('gold');
  c.beginPath();
  c.ellipse(x, y - s * 6.5, s * 3.4, s * 1.4, 0, 0, Math.PI);
  c.fill();
}
// Κολόνα με ραβδώσεις, κιονόκρανο και βάση.
function caColumn(c, x, top, bottom, w, light = 1) {
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, caCol('umber'));
  g.addColorStop(0.35, caCol(light > 0.6 ? 'sand' : 'khaki'));
  g.addColorStop(1, caCol('night'));
  c.fillStyle = g;
  c.fillRect(Math.round(x - w / 2), top, Math.round(w), bottom - top);
  c.fillStyle = caCol('night', 0.6);
  for (let k = -1; k <= 1; k++) c.fillRect(Math.round(x + (k * w) / 4), top + 3, 1, bottom - top - 6);
  c.fillStyle = caCol('khaki');
  c.fillRect(Math.round(x - w * 0.75), top - 4, Math.round(w * 1.5), 4);
  c.fillRect(Math.round(x - w * 0.7), bottom - 3, Math.round(w * 1.4), 3);
}
// Μαίανδρος σε pixels (μοτίβο 6 × 6).
function caMeander(c, x0, y, w, col) {
  c.fillStyle = caCol(col);
  const pat = ['######', '#....#', '#.##.#', '#..#.#', '####.#', '.....#'];
  for (let x = 0; x < w; x++) for (let r = 0; r < 6; r++) if (pat[r][x % 6] === '#') c.fillRect(x0 + x, y + r, 1, 1);
}
// Δαχτυλίδια ήχου που απλώνονται από ένα σημείο.
function caRings(c, x, y, t, period, maxR, col, n = 3, squash = 1) {
  for (let k = 0; k < n; k++) {
    const r = (((t / period + k / n) % 1) + 1) % 1 * maxR;
    const a = (1 - r / maxR) * 0.9;
    c.strokeStyle = caCol(col, a);
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(x, y, r, r * squash, 0, 0, Math.PI * 2);
    c.stroke();
  }
}
// Σκόνη / σωματίδια που αιωρούνται.
function caMotes(c, t, n, seed, col, box = [0, 0, CA_W, CA_H], vx = 2, vy = -3) {
  const [x0, y0, w, h] = box;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((((caHash(i + seed) * w + t * vx * (0.5 + caHash(i * 3 + seed))) % w) + w) % w);
    const y = y0 + ((((caHash(i * 7 + seed) * h + t * vy * (0.5 + caHash(i * 5 + seed))) % h) + h) % h);
    c.fillStyle = caCol(col, 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
    c.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}
function caVignette(c, a = 0.85, r0 = 0.45) {
  const g = c.createRadialGradient(CA_W / 2, CA_H / 2, CA_W * r0 * 0.5, CA_W / 2, CA_H / 2, CA_W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  c.fillStyle = g;
  c.fillRect(0, 0, CA_W, CA_H);
}
// Φως από μια πλευρά: ό,τι είναι μακριά από το φως σκοτεινιάζει (multiply).
function caSideLight(c, fromRight, dark = 'night') {
  c.save();
  c.globalCompositeOperation = 'multiply';
  const g = c.createLinearGradient(fromRight ? 0 : CA_W, 0, fromRight ? CA_W : 0, 0);
  g.addColorStop(0, caCol(dark));
  g.addColorStop(0.5, caCol('tan'));
  g.addColorStop(1, 'rgb(255,255,255)');
  c.fillStyle = g;
  c.fillRect(0, 0, CA_W, CA_H);
  c.restore();
}
// Σπηλιά γύρω γύρω: σκοτεινή, οδοντωτή πέτρα στις άκρες της εικόνας.
function caCaveFrame(c, seed, col = 'night', inset = 26) {
  c.fillStyle = caCol(col);
  c.beginPath();
  c.rect(0, 0, CA_W, CA_H);
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 - (inset / CA_H) * (0.6 + 0.8 * caNoise(i * 0.7, seed));
    const x = CA_W / 2 + Math.cos(a) * CA_W * 0.62 * r, y = CA_H / 2 + Math.sin(a) * CA_H * 0.66 * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.fill('evenodd');
}

const CutArt = {
  canvas: null,   // ο καμβάς της οθόνης (#cut-art)
  work: null,     // ο καμβάς όπου ζωγραφίζεται κάθε καρέ (πριν από την παλέτα)
  wctx: null,
  bgCache: {},
  panel: null,
  panelStart: 0,
  fadeFrom: 0,
  _raf: 0,
  _tint: new Map(),

  init() {
    this.canvas = document.getElementById('cut-art');
    this.canvas.width = CA_W;
    this.canvas.height = CA_H;
    this.work = document.createElement('canvas');
    this.work.width = CA_W;
    this.work.height = CA_H;
    this.wctx = this.work.getContext('2d', { willReadFrequently: true });
    // Τα χέρια με τα νύχια των σκιών (ίδια με το jump scare).
    Sprites.frames.claw = [Sprites.build(scareHand(false), '20,10,6')];
  },

  // Μια μορφή σε διπλή ανάλυση (Sprites.getHD). scale: 1 = ένα pixel του αρχικού πλέγματος σε ένα
  // pixel της εικόνας. (x, y) = κάτω-κέντρο. o: { flip, alpha, tint (σιλουέτα), rot (ακτίνια) }.
  // Επιστρέφει το πλαίσιο, και pt(gx, gy) = πού πέφτει ένα pixel του πλέγματος.
  fig(c, name, i, x, y, scale, o = {}) {
    const fr = typeof name === 'string' ? Sprites.getOld(name, i) : name;
    const w = (fr.w * scale) / 2, h = (fr.h * scale) / 2;
    let src = o.flip ? fr.f : fr.c;
    if (o.tint) src = this.tinted(src, o.tint);
    c.save();
    c.imageSmoothingEnabled = false;
    if (o.alpha !== undefined) c.globalAlpha *= Math.max(0, Math.min(1, o.alpha));
    const bx = Math.round(x - w / 2), by = Math.round(y - h);
    if (o.rot) {
      c.translate(x, y - h / 2);
      c.rotate(o.rot);
      c.drawImage(src, -w / 2, -h / 2, w, h);
    } else c.drawImage(src, bx, by, w, h);
    c.restore();
    const gw = fr.w / 2;
    return { x: bx, y: by, w, h, pt: (gx, gy) => [bx + ((o.flip ? gw - 1 - (gx + 1) : gx + 1) + 0.5) * scale, by + (gy + 1.5) * scale] };
  },

  // Η μορφή σε ένα χρώμα (σιλουέτα: μελανόμορφο αγγείο, κόντρα στο φως).
  tinted(src, col) {
    const key = col;
    let m = this._tint.get(src);
    if (!m) this._tint.set(src, (m = {}));
    if (!m[key]) {
      const cv = document.createElement('canvas');
      cv.width = src.width;
      cv.height = src.height;
      const x = cv.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = caCol(col);
      x.fillRect(0, 0, cv.width, cv.height);
      m[key] = cv;
    }
    return m[key];
  },

  // Αλλάζει σκηνή (αν είναι ίδια με την τωρινή, συνεχίζει χωρίς σβήσιμο).
  show(panel) {
    if (panel === this.panel) return;
    this.panel = panel;
    this.panelStart = performance.now() / 1000;
    if (!this._raf) this.loop();
  },

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.panel = null;
  },

  loop() {
    this.render(performance.now() / 1000);
    this._raf = requestAnimationFrame(() => this.loop());
  },

  render(now) {
    const P = CUT_SCENES[this.panel];
    if (!P) return;
    const t = now - this.panelStart;
    const c = this.wctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.imageSmoothingEnabled = false;
    // Το σταθερό φόντο: μία φορά, μετά από την προσωρινή μνήμη.
    let bg = this.bgCache[this.panel];
    if (!bg && P.bg) {
      bg = document.createElement('canvas');
      bg.width = CA_W;
      bg.height = CA_H;
      const bc = bg.getContext('2d');
      bc.imageSmoothingEnabled = false;
      P.bg.call(this, bc);
      this.bgCache[this.panel] = bg;
    }
    c.fillStyle = '#000';
    c.fillRect(0, 0, CA_W, CA_H);
    if (bg) c.drawImage(bg, 0, 0);
    if (P.fg) {
      c.save();
      P.fg.call(this, c, t);
      c.restore();
    }
    // Σβήσιμο από το μαύρο στην αρχή κάθε σκηνής.
    const fade = Math.min(1, t / 0.7);
    if (fade < 1) {
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(0,0,0,${1 - fade})`;
      c.fillRect(0, 0, CA_W, CA_H);
    }
    // Η παλέτα του κόσμου (επίπεδα χρώματα).
    const img = c.getImageData(0, 0, CA_W, CA_H);
    const d = new Uint32Array(img.data.buffer), pal = Pixel._pal;
    if (pal) {
      for (let i = 0; i < d.length; i++) {
        const p = d[i];
        if ((p & 0xffffff) === 0) { d[i] = 0xff000000; continue; }
        d[i] = pal[((p & 0xf8) << 7) | ((p >> 6) & 0x3e0) | ((p >> 19) & 31)];
      }
    }
    this.canvas.getContext('2d').putImageData(img, 0, 0);
  },
};

// ---- Οι σκηνές ----
// Το λιβάδι το σούρουπο (intro): mood 0 = ο ήλιος δύει, 1 = έχει σκοτεινιάσει.
function caMeadow(c, mood) {
  if (mood === 0) caSky(c, [[0, 'deep'], [0.3, 'maroon'], [0.5, 'clay'], [0.62, 'orange'], [0.7, 'peach']]);
  else caSky(c, [[0, 'night'], [0.4, 'wine'], [0.62, 'rust'], [0.72, 'clay']]);
  if (mood === 0) caSun(c, 196, 84, 12, 'cream', 'peach');
  else caStars(c, 30, 5, 50);
  caRidge(c, 90, 22, 46, 1, mood ? 'maroon' : 'brick');
  for (const [x, h] of [[30, 26], [42, 20], [222, 30], [234, 22]]) caCypress(c, x, 92 - caNoise(x / 46, 1) * 14, h, mood ? 'wine' : 'maroon');
  caRidge(c, 100, 10, 30, 2, mood ? 'wine' : 'maroon');
  const g = c.createLinearGradient(0, 98, 0, CA_H);
  g.addColorStop(0, caCol(mood ? 'umber' : 'brown'));
  g.addColorStop(1, caCol('night'));
  c.fillStyle = g;
  c.fillRect(0, 104, CA_W, CA_H - 104);
  caFlowers(c, 104, 26, 3, 14);
}

const CUT_SCENES = {
  // 1. "A snake in the grass. A single bite."
  snake: {
    bg(c) { caMeadow(c, 0); },
    fg(c, t) {
      caGrass(c, 108, t, 160, 1, ['khaki', 'sand', 'ochre'], 9, 10);
      const x = Math.min(96, 64 + t * 6);
      this.fig(c, 'euryAlive', Math.floor(t * 3) % 3, x, 120, 1.15);
      this.fig(c, 'snake3d', t > 1.6 ? 1 : 0, 168, 124, 1.25, { flip: true });
      caGrass(c, 132, t, 140, 2, ['brown', 'umber', 'khaki'], 15, 14);
      caMotes(c, t, 14, 3, 'peach', [0, 60, CA_W, 70], 3, -2);
      caVignette(c, 0.7);
    },
  },
  // 2. "Eurydice never woke again."
  fallen: {
    bg(c) { caMeadow(c, 1); },
    fg(c, t) {
      caGrass(c, 108, t * 0.5, 160, 1, ['brown', 'khaki', 'umber'], 9, 10);
      this.fig(c, 'euryLying', 0, 140, 124, 1.25);
      this.fig(c, 'orpheusKneel', 0, 90, 126, 1.25);
      this.fig(c, 'lyre', 0, 190, 126, 1.0, { rot: 1.2 });
      caGrass(c, 134, t * 0.5, 120, 2, ['umber', 'night', 'brown'], 12, 10);
      caMotes(c, t, 10, 9, 'cream', [40, 40, 180, 80], 1, 2);
      caVignette(c, 0.85);
    },
  },
  // 3. "Everyone said the dead do not return."
  grave: {
    bg(c) {
      caSky(c, [[0, 'night'], [0.7, 'deep'], [1, 'wine']]);
      caStars(c, 50, 11, 70);
      caSun(c, 56, 28, 8, 'cream', 'brick');
      caRidge(c, 96, 16, 50, 4, 'wine');
      c.fillStyle = caCol('umber');
      c.fillRect(0, 108, CA_W, CA_H - 108);
      caCypress(c, 176, 112, 70, 'night');
      caCypress(c, 198, 112, 56, 'night');
      // Η στήλη του τάφου: αέτωμα, ακρωτήρια, ανάγλυφο της Ευρυδίκης.
      c.fillStyle = caCol('khaki');
      c.fillRect(110, 56, 32, 56);
      c.beginPath(); c.moveTo(106, 58); c.lineTo(126, 44); c.lineTo(146, 58); c.fill();
      c.fillStyle = caCol('sand');
      c.fillRect(110, 56, 2, 56);
      c.fillRect(106, 58, 40, 2);
      c.fillStyle = caCol('brown');
      c.fillRect(114, 64, 24, 36);
      this.fig(c, 'euryAlive', 0, 126, 99, 0.72, { tint: 'sand' });
      c.fillStyle = caCol('umber');
      for (let k = 0; k < 3; k++) c.fillRect(114, 103 + k * 3, 24, 1);
      this.fig(c, 'amphora', 0, 152, 113, 1);
      this.fig(c, 'asphodel', 0, 104, 113, 1);
      this.fig(c, 'asphodel', 0, 98, 114, 0.8);
    },
    fg(c, t) {
      this.fig(c, 'orpheusStand', 0, 70, 120, 0.95, { flip: true, tint: 'night' });
      caGlow(c, 56, 28, 40, 'cream', 0.05 + 0.03 * Math.sin(t * 0.8));
      caMotes(c, t, 12, 4, 'tan', [0, 70, CA_W, 50], 2, -1);
      caVignette(c, 0.8);
    },
  },
  // 4. "Orpheus did not listen."
  resolve: {
    bg(c) {
      caSky(c, [[0, 'night'], [0.55, 'wine'], [0.85, 'brick']]);
      caStars(c, 30, 21, 50);
      // Ο Ταίναρος στο βάθος, κόκκινη λάμψη στη βάση του.
      c.fillStyle = caCol('deep');
      c.beginPath(); c.moveTo(130, 120); c.lineTo(196, 50); c.lineTo(214, 62); c.lineTo(256, 40); c.lineTo(256, 120); c.fill();
      caGlow(c, 206, 108, 30, 'blood', 0.5);
      caRidge(c, 116, 8, 30, 6, 'night');
    },
    fg(c, t) {
      const b = this.fig(c, 'orpheusStand', 0, 84, 158, 2.7);
      const [lx, ly] = b.pt(21, 18);
      if ((t % 2.4) < 0.5) caGlow(c, lx, ly, 6, 'cream', 0.8 * Math.sin(((t % 2.4) / 0.5) * Math.PI));
      caMotes(c, t, 24, 7, 'tan', [0, 0, CA_W, CA_H], 14, 3);
      caSideLight(c, true, 'deep');
      caVignette(c, 0.8);
    },
  },
  // 5. "At Taenarum, the earth opens downward. He went down."
  taenarum: {
    bg(c) {
      caSky(c, [[0, 'deep'], [0.45, 'rust'], [0.75, 'orange'], [0.8, 'peach']]);
      caSun(c, 228, 92, 10, 'cream', 'orange');
      c.fillStyle = caCol('deep');
      c.fillRect(150, 100, CA_W - 150, CA_H - 100);       // θάλασσα
      // Το βουνό με τα στρώματα της πέτρας.
      const g = c.createLinearGradient(0, 20, 0, CA_H);
      g.addColorStop(0, caCol('khaki'));
      g.addColorStop(1, caCol('umber'));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, CA_H); c.lineTo(0, 40); c.lineTo(50, 30); c.lineTo(88, 16); c.lineTo(130, 36); c.lineTo(170, 70);
      c.lineTo(200, 104); c.lineTo(210, CA_H);
      c.fill();
      c.fillStyle = caCol('brown');
      for (let k = 0; k < 9; k++) {
        const y = 40 + k * 11;
        for (let x = 0; x < 200; x++) if (caNoise(x / 9, k + 30) > 0.55) c.fillRect(x, Math.round(y + caNoise(x / 20, k) * 6), 1, 1);
      }
      // Το στόμιο: μαύρο, με αχνή κόκκινη λάμψη από μέσα.
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(112, 98, 15, 19, 0, Math.PI, 0); c.lineTo(127, 112); c.lineTo(97, 112); c.fill();
      caGlow(c, 112, 106, 14, 'blood', 0.45);
      c.fillStyle = caCol('sand');
      for (let k = 0; k < 14; k++) c.fillRect(Math.round(40 + k * 4.4), Math.round(132 - k * 1.4), 2, 1);   // μονοπάτι
    },
    fg(c, t) {
      for (let k = 0; k < 18; k++) {
        const x = 156 + ((caHash(k) * 100 + t * 6 * (k % 2 ? 1 : -1)) % 100 + 100) % 100;
        c.fillStyle = caCol('orange', 0.5 + 0.5 * Math.sin(t * 2 + k));
        c.fillRect(Math.round(x), 104 + (k * 7) % 38, 3, 1);
      }
      const x = Math.min(104, 76 + t * 6);
      this.fig(c, 'orpheusWalk', Math.floor(t * 4) % 2, x, 116, 0.55);
      caVignette(c, 0.6);
    },
  },
  // 6. "On the first step he slipped. His lyre shattered on the rocks."
  slip: {
    bg(c) {
      caSky(c, [[0, 'brown'], [0.5, 'umber'], [1, 'night']]);
      // Φως από την είσοδο (πάνω αριστερά).
      const g = c.createLinearGradient(0, 0, 160, 140);
      g.addColorStop(0, caCol('peach', 0.55));
      g.addColorStop(1, caCol('peach', 0));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(70, 0); c.lineTo(200, 144); c.lineTo(60, 144); c.fill();
      // Σκαλιά προς τα κάτω.
      for (let k = 0; k < 9; k++) {
        const x = k * 30 - 10, y = 58 + k * 11;
        c.fillStyle = caCol('khaki');
        c.fillRect(x, y, 40, 3);
        c.fillStyle = caCol('brown');
        c.fillRect(x, y + 3, 40, CA_H);
        c.fillStyle = caCol('sand');
        c.fillRect(x, y, 40, 1);
      }
      caCaveFrame(c, 3, 'night', 22);
    },
    fg(c, t) {
      const k = Math.min(1, t / 1.1), e = 1 - (1 - k) * (1 - k);
      this.fig(c, 'orpheusFall', 0, 96 + e * 34, 64 + e * 30, 1.5, { rot: -0.4 - e * 1.0 });
      if (t < 1.0) {
        this.fig(c, 'lyre', 0, 132 + e * 40, 52 + e * 50, 1.3, { rot: t * 7 });
      } else {
        // Η λύρα έσπασε: κομμάτια πάνω στα βράχια και σκόνη.
        const s = t - 1.0;
        for (let j = 0; j < 12; j++) {
          const a = caHash(j + 40) * Math.PI - Math.PI, v = 20 + caHash(j + 7) * 40;
          const x = 172 + Math.cos(a) * v * Math.min(s, 0.6), y = 102 + Math.sin(a) * v * Math.min(s, 0.6) + 30 * Math.min(s, 0.6) ** 2;
          c.fillStyle = caCol(j % 3 ? 'gold' : 'clay');
          c.fillRect(Math.round(x), Math.round(y), 2, 1);
        }
        caGlow(c, 172, 104, 20 * Math.min(1, s * 3), 'tan', Math.max(0, 0.5 - s * 0.4));
        for (let j = 0; j < 3; j++) {
          c.fillStyle = caCol('cream', Math.max(0, 1 - s * 0.6));
          const a = -0.5 - j * 0.9;
          for (let q = 0; q < 14; q++) c.fillRect(Math.round(172 + Math.cos(a) * q * Math.min(1, s * 2) * 1.6), Math.round(102 + Math.sin(a) * q * Math.min(1, s * 2) * 1.6 + Math.sin(q * 0.8 + t * 6) * 1.5), 1, 1);
        }
      }
      caVignette(c, 0.7);
    },
  },
  // 7. "Its strings scattered into the dark."
  strings: {
    fg(c, t) {
      this.fig(c, 'lyre', 0, 128, 138, 1.6, { rot: 1.9, alpha: 0.35 });
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const dir = (k - 1) * 0.9;
        for (let s = 0; s < 46; s++) {
          const d = s * 1.6 + t * 9;
          const x = 128 + Math.sin(dir) * d + Math.sin(s * 0.35 + t * 2 + k * 2) * 4;
          const y = 110 - Math.cos(dir) * d * 0.9 + t * 4;
          const a = Math.max(0, 1 - d / 120) * (0.6 + 0.4 * Math.sin(s * 0.5 - t * 5));
          c.fillStyle = caCol(k === 1 ? 'peach' : 'cream', a);
          c.fillRect(Math.round(x), Math.round(y), 1, 1);
          if (s % 9 === 0) caGlow(c, x, y, 4, 'gold', a * 0.5);
        }
      }
      c.globalCompositeOperation = 'source-over';
    },
  },
  // 8. "There is no light down here."
  dark: {
    fg(c, t) {
      this.fig(c, 'orpheusStand', 0, 120, 162, 2.6, { tint: 'deep', alpha: 0.7 + 0.1 * Math.sin(t * 1.3) });
      // Κάπου στο βάθος, δύο μάτια ανοίγουν.
      if (t > 1.6) {
        const a = Math.min(1, (t - 1.6) * 0.8) * (Math.sin(t * 0.9) > -0.85 ? 1 : 0);
        c.fillStyle = caCol('cream', a);
        c.fillRect(214, 64, 1, 1);
        c.fillRect(218, 64, 1, 1);
        caGlow(c, 216, 64, 6, 'blood', a * 0.4);
      }
    },
  },
  // 9. "Only what can be heard." — ο μηχανισμός του παιχνιδιού: τα κύματα δείχνουν τη σπηλιά.
  echo: {
    fg(c, t) {
      const b = this.fig(c, 'orpheusPlay', Math.floor(t * 4) % 2, 128, 140, 1.6, {});
      const [ox, oy] = b.pt(21, 20);
      const period = 2.6, maxR = 170;
      const rs = [0, 1].map((k) => ((t / period + k / 2) % 1) * maxR);
      // Οι πέτρες της σπηλιάς φωτίζονται όταν τις φτάσει το κύμα.
      if (!this._rocks) {
        this._rocks = [];
        for (let i = 0; i < 70; i++) {
          const a = caHash(i + 300) * Math.PI * 2, rr = 0.75 + caHash(i + 500) * 0.35;
          const x = 128 + Math.cos(a) * 150 * rr, y = 80 + Math.sin(a) * 95 * rr;
          this._rocks.push({ x, y, r: 10 + caHash(i + 700) * 16, seed: i });
        }
      }
      for (const R of this._rocks) {
        const d = Math.hypot(R.x - ox, R.y - oy);
        let L = 0;
        for (const r of rs) L = Math.max(L, Math.exp(-Math.abs(d - r) / 10) * (1 - r / maxR) + (r > d ? 0.18 * (1 - r / maxR) : 0));
        if (L < 0.04) continue;
        const col = L > 0.7 ? 'peach' : L > 0.45 ? 'orange' : L > 0.25 ? 'clay' : L > 0.12 ? 'rust' : 'maroon';
        c.fillStyle = caCol(col);
        c.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2, rr = R.r * (0.7 + 0.5 * caHash(R.seed * 13 + k));
          if (k === 0) c.moveTo(R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr);
          else c.lineTo(R.x + Math.cos(a) * rr, R.y + Math.sin(a) * rr);
        }
        c.fill();
      }
      // Μια σκιά στο βάθος, μόνο όσο τη φωτίζει το κύμα.
      const sd = Math.hypot(206 - ox, 96 - oy);
      let sl = 0;
      for (const r of rs) if (r > sd) sl = Math.max(sl, 1 - (r - sd) / 40);
      if (sl > 0) {
        this.fig(c, 'ghoul', 0, 206, 112, 0.7, { flip: true, tint: 'rust', alpha: sl });
        c.fillStyle = caCol('white', sl);
        c.fillRect(197, 92, 1, 1);
      }
      caRings(c, ox, oy, t, period, maxR, 'peach', 2);
      // Ο Ορφέας φωτίζεται από τη λύρα του.
      caGlow(c, ox, oy, 26, 'orange', 0.25);
    },
  },

  // ---- Middle ----
  // "Orpheus played."
  play: {
    bg(c) {
      caSky(c, [[0, 'night'], [0.6, 'wine'], [0.7, 'maroon']]);
      caMeander(c, 0, 18, CA_W, 'brick');
      // Δάπεδο-σκακιέρα σε προοπτική.
      for (let y = 100; y < CA_H; y++) {
        const z = 400 / (y - 92);
        for (let x = 0; x < CA_W; x++) {
          const u = Math.floor(((x - 128) * z) / 40 + 100), v = Math.floor(z / 2);
          c.fillStyle = caCol((u + v) % 2 ? 'night' : 'brick');
          c.fillRect(x, y, 1, 1);
        }
      }
      for (const x of [16, 56, 200, 240]) caColumn(c, x, 28, 104, 12, 0.5);
      this.fig(c, 'hades3d', 0, 112, 100, 0.95);
      this.fig(c, 'persephone3d', 0, 148, 100, 0.95);
      this.fig(c, Sprites.cerberusOld([false, false, false], 0), 0, 86, 101, 0.42);
      for (const x of [80, 180]) caBrazier(c, x, 102, 1.6);
    },
    fg(c, t) {
      for (const x of [80, 180]) caFire(c, x, 92, 1.6, t + x);
      const b = this.fig(c, 'orpheusPlay', Math.floor(t * 4) % 2, 54, 166, 2.4);
      const [ox, oy] = b.pt(21, 20);
      caRings(c, ox, oy, t, 2.2, 140, 'gold', 3, 0.6);
      caMotes(c, t, 20, 13, 'peach', [0, 20, CA_W, 90], 1, -4);
      caVignette(c, 0.7);
    },
  },
  // "For the first time, something wept in the Underworld."
  weep: {
    bg(c) {
      caSky(c, [[0, 'black'], [0.6, 'deep'], [1, 'maroon']]);
      for (const x of [30, 226]) caColumn(c, x, 0, 120, 14, 0.3);
    },
    fg(c, t) {
      caRings(c, -20, 110, t, 3, 300, 'gold', 3, 0.5);
      const tear = (x, y, i) => {
        for (let k = 0; k < 2; k++) {
          const p = ((t * 0.8 + i * 0.37 + k * 0.5) % 1);
          c.fillStyle = caCol('cream', 1 - p);
          c.fillRect(Math.round(x), Math.round(y + p * 16), 1, 2);
        }
      };
      for (const [x, y, s, fl, i] of [[218, 70, 1.15, true, 0], [44, 64, 1.0, false, 1]]) {
        const by = y + Math.sin(t * 2 + i) * 2;
        const fr = Sprites.getHD('erinys3d', Math.floor(t * 3 + i) % 2);
        const b = this.fig(c, fr, 0, x, by, s, { flip: fl });
        tear(...b.pt(16, 8), i);
        tear(...b.pt(19, 8), i + 0.5);
      }
      for (const [x, y, s, fl, i] of [[64, 132, 1.6, false, 2], [112, 140, 2.0, true, 3], [170, 136, 1.8, true, 4], [214, 128, 1.4, true, 5]]) {
        const b = this.fig(c, 'ghoul', 0, x, y, s, { flip: fl });
        tear(...b.pt(21, 6), i);
      }
      caVignette(c, 0.75);
    },
  },
  // "Persephone leaned toward Hades. He was silent for a long time."
  lean: {
    bg(c) {
      caSky(c, [[0, 'night'], [0.7, 'wine'], [1, 'maroon']]);
      caMeander(c, 0, 8, CA_W, 'rust');
      for (const x of [60, 196]) caColumn(c, x, 18, 150, 16, 0.5);
      for (const x of [22, 234]) caBrazier(c, x, 144, 2.4);
    },
    fg(c, t) {
      for (const x of [22, 234]) caFire(c, x, 129, 2.4, t + x);
      this.fig(c, 'hades3d', 0, 104, 148, 2.05);
      this.fig(c, 'persephone3d', t > 0.8 ? 1 : 0, 164, 148, 2.05);
      this.fig(c, Sprites.cerberusOld([false, false, false], Math.sin(t * 1.6) > 0 ? 1 : 0), 0, 52, 146, 0.9);
      caVignette(c, 0.65);
    },
  },
  // Ο Άδης μιλάει (κοντινό).
  hades: {
    bg(c) {
      caSky(c, [[0, 'night'], [1, 'wine']]);
      caGlow(c, 128, 60, 120, 'blood', 0.35);
    },
    fg(c, t) {
      const s = 4 + Math.min(t, 6) * 0.04;
      const b = this.fig(c, 'hades3d', 0, 128, 56 - 9.5 * s + 50 * s, s);
      for (const gx of [17, 20]) {
        const [x, y] = b.pt(gx, 8);
        caGlow(c, x, y, 7, 'hot', 0.35 + 0.25 * Math.sin(t * 3));
      }
      c.globalCompositeOperation = 'lighter';
      caGlow(c, 0, 120, 90, 'orange', 0.14 + 0.05 * Math.sin(t * 11));
      caGlow(c, CA_W, 120, 90, 'orange', 0.14 + 0.05 * Math.sin(t * 9 + 2));
      c.globalCompositeOperation = 'source-over';
      caVignette(c, 0.8);
    },
  },
  // "she stays here. Forever."
  forever: {
    fg(c, t) {
      const g = c.createLinearGradient(0, 80, 0, CA_H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, caCol('maroon', 0.9));
      c.fillStyle = g;
      c.fillRect(0, 0, CA_W, CA_H);
      for (let i = 0; i < 9; i++) {
        const x = 20 + caHash(i + 90) * 216, y = 30 + caHash(i + 91) * 70;
        if (Math.abs(x - 128) < 30) continue;
        const open = Math.sin(t * 0.7 + i * 1.7) > -0.6;
        if (!open) continue;
        c.fillStyle = caCol(i % 3 ? 'cream' : 'hot');
        c.fillRect(Math.round(x), Math.round(y), 1, 1);
        c.fillRect(Math.round(x) + 3, Math.round(y), 1, 1);
      }
      caGlow(c, 128, 90, 40, 'cream', 0.12);
      this.fig(c, 'eurydice3d', Math.floor(t * 1.5) % 3, 128, 136, 1.8, { alpha: 0.75 + 0.15 * Math.sin(t * 1.2) });
      for (const [x, fl, d] of [[86, false, 0], [170, true, 0.4], [110, false, 0.8]]) {
        const k = Math.min(1, Math.max(0, (t - d) / 2));
        this.fig(c, 'claw', 0, x, CA_H + 40 - k * 34, 1.3, { flip: fl });
      }
      caVignette(c, 0.8);
    },
  },

  // ---- Good ending ----
  // "Light."
  light: {
    bg(c) {
      c.fillStyle = caCol('night');
      c.fillRect(0, 0, CA_W, CA_H);
      const g = c.createRadialGradient(150, 70, 4, 150, 70, 50);
      g.addColorStop(0, caCol('white'));
      g.addColorStop(0.6, caCol('cream'));
      g.addColorStop(1, caCol('peach'));
      c.fillStyle = g;
      c.beginPath();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 2, r = 1 + 0.18 * (caNoise(k * 0.9, 77) - 0.5);
        const x = 150 + Math.cos(a) * 40 * r, y = 70 + Math.sin(a) * 48 * r;
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.fill();
      // Το χείλος του βράχου γύρω από το άνοιγμα πιάνει φως.
      c.strokeStyle = caCol('orange');
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = caCol('brown');
      c.fillRect(0, 124, CA_W, CA_H - 124);
    },
    fg(c, t) {
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const a = 0.06 + 0.04 * Math.sin(t * 0.8 + k);
        c.fillStyle = caCol('peach', a);
        c.beginPath();
        c.moveTo(130 + k * 6, 40 + k * 8);
        c.lineTo(150 + k * 6, 46 + k * 8);
        c.lineTo(20 + k * 30, CA_H);
        c.lineTo(-20 + k * 30, CA_H);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      caMotes(c, t, 40, 17, 'cream', [40, 40, 160, 104], 2, -1);
      this.fig(c, 'orpheusWalk', Math.floor(t * 3) % 2, Math.min(126, 96 + t * 5), 132, 1.1, { tint: 'night' });
      caVignette(c, 0.6);
    },
  },
  // "Orpheus stepped into the open air and did not turn. He waited."
  open: {
    bg(c) { caDay(c, 220, 40, false); },
    fg(c, t) {
      caGrass(c, 116, t, 140, 4, ['ochre', 'sand', 'tan'], 8, 12);
      this.fig(c, 'orpheusStand', 0, 132, 130, 1.8);
      caBirds(c, t);
      caGrass(c, 136, t, 100, 5, ['khaki', 'ochre'], 12, 8);
    },
  },
  // "A hand touched his shoulder."
  hand: {
    bg(c) {
      caSky(c, [[0, 'peach'], [1, 'orange']]);
      for (let i = 0; i < 14; i++) caGlow(c, caHash(i + 60) * CA_W, caHash(i + 61) * CA_H, 8 + caHash(i + 62) * 14, 'white', 0.35);
    },
    fg(c, t) {
      this.fig(c, 'handShoulder', 0, 128, 150 + Math.sin(t * 1.2), 2.6);
      caMotes(c, t, 16, 33, 'white', [0, 0, CA_W, CA_H], 3, -2);
    },
  },
  // "You didn't look..." — εκείνη πίσω του, το χέρι στον ώμο του.
  behind: {
    bg(c) { caDay(c, 236, 30, false); },
    fg(c, t) {
      caGrass(c, 118, t, 120, 4, ['ochre', 'sand', 'tan'], 8, 12);
      this.fig(c, 'euryAlive', 0, 112, 156, 2.4);
      this.fig(c, 'orpheusStand', 0, 158, 158, 2.5);
      caMotes(c, t, 18, 41, 'white', [0, 0, CA_W, CA_H], 3, -2);
    },
  },
  // "In the myth, he looked." / "Just like in the myth." — μελανόμορφο αγγείο.
  myth: {
    bg(c) {
      c.fillStyle = caCol('night');
      c.fillRect(0, 0, CA_W, CA_H);
      // Το σώμα του αμφορέα, ο λαιμός, οι λαβές.
      c.fillStyle = caCol('terra');
      c.beginPath(); c.ellipse(128, 96, 112, 64, 0, 0, Math.PI * 2); c.fill();
      c.fillRect(98, 6, 60, 34);
      c.fillRect(92, 2, 72, 6);
      c.strokeStyle = caCol('black');
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(98, 14); c.quadraticCurveTo(54, 10, 46, 46); c.stroke();
      c.beginPath(); c.moveTo(158, 14); c.quadraticCurveTo(202, 10, 210, 46); c.stroke();
      c.fillStyle = caCol('black');
      c.fillRect(98, 30, 60, 3);
      caMeander(c, 30, 46, 196, 'black');
      caMeander(c, 30, 124, 196, 'black');
      for (let x = 34; x < 222; x += 10) {
        c.beginPath(); c.moveTo(x, 144); c.lineTo(x + 5, 132); c.lineTo(x + 10, 144); c.fill();
      }
      // Η σκηνή: ο Ορφέας γυρίζει να την κοιτάξει (μαύρη μορφή), εκείνη (με πρόσθετο λευκό,
      // όπως οι γυναίκες στα μελανόμορφα) απλώνει το χέρι καθώς χάνεται.
      this.fig(c, 'orpheusWalk', 0, 156, 120, 1.25, { flip: true, tint: 'black' });
      this.fig(c, 'euryAlive', 0, 100, 120, 1.2, { tint: 'cream' });
      c.fillStyle = caCol('terra');
      c.fillRect(103, 64, 1, 1);
      c.fillRect(151, 63, 1, 1);
      c.fillStyle = caCol('black');
      c.fillRect(104, 66, 1, 1);
      // Λάμψη στην καμπύλη του αγγείου.
      c.globalCompositeOperation = 'multiply';
      const g = c.createRadialGradient(100, 80, 10, 128, 96, 120);
      g.addColorStop(0, 'rgb(255,255,255)');
      g.addColorStop(1, caCol('rust'));
      c.fillStyle = g;
      c.fillRect(0, 0, CA_W, CA_H);
      c.globalCompositeOperation = 'source-over';
    },
    fg(c, t) {
      const x = 40 + ((t * 22) % 220);
      c.globalCompositeOperation = 'lighter';
      caGlow(c, x, 80, 20, 'orange', 0.12);
      c.globalCompositeOperation = 'source-over';
    },
  },
  // "You didn't." — φεύγουν μαζί προς τον ήλιο.
  together: {
    bg(c) { caDay(c, 206, 84, true); },
    fg(c, t) {
      caGrass(c, 116, t, 140, 4, ['ochre', 'sand', 'tan'], 8, 12);
      const x = 118 + Math.min(t, 8) * 3;
      c.fillStyle = caCol('khaki', 0.8);
      for (const sx of [x - 30, x]) { c.beginPath(); c.ellipse(sx - 18, 127, 18, 2, 0, 0, Math.PI * 2); c.fill(); }
      this.fig(c, 'euryAlive', Math.floor(t * 3) % 3, x - 30, 128, 1.2);
      this.fig(c, 'orpheusWalk', Math.floor(t * 3) % 2, x, 128, 1.25);
      caBirds(c, t);
      caGrass(c, 138, t, 90, 5, ['khaki', 'ochre'], 10, 6);
    },
  },

  // ---- Bad ending ----
  // "Orpheus turned."
  turned: {
    bg(c) {
      caSky(c, [[0, 'umber'], [1, 'night']]);
      const g = c.createLinearGradient(200, 0, CA_W, 0);
      g.addColorStop(0, caCol('peach', 0));
      g.addColorStop(1, caCol('white'));
      c.fillStyle = g;
      c.fillRect(200, 0, 56, CA_H);
      caCaveFrame(c, 8, 'night', 18);
    },
    fg(c, t) {
      this.fig(c, 'orpheusStand', 0, 140, 162, 2.7, { flip: true });
      caSideLight(c, true, 'deep');
      caVignette(c, 0.6);
    },
  },
  // "For a moment he saw her, just as he remembered."
  saw: {
    bg(c) {
      caSky(c, [[0, 'night'], [1, 'deep']]);
      caGlow(c, 128, 70, 70, 'cream', 0.18);
    },
    fg(c, t) {
      this.fig(c, 'euryAlive', 0, 124, 196, 3.4);
      caSideLight(c, true, 'night');
      caMotes(c, t, 14, 51, 'cream', [40, 0, 176, CA_H], 1, -2);
      caVignette(c, 0.7);
    },
  },
  // "Then the dark took her back, without a sound."
  taken: {
    fg(c, t) {
      const a = Math.max(0, 1 - t / 3.2);
      caGlow(c, 128, 80, 60, 'cream', 0.15 * a);
      this.fig(c, 'eurydice3d', 1, 128, 150 - Math.min(t, 3) * 4, 2.4, { alpha: a });
      for (const [x, fl, d] of [[78, false, 0], [178, true, 0.3], [104, false, 0.7], [152, true, 1.0]]) {
        const k = Math.min(1, Math.max(0, (t - d) / 1.6));
        this.fig(c, 'claw', 0, x, CA_H + 44 - k * 46, 1.4, { flip: fl });
      }
      const g = c.createRadialGradient(128, 80, Math.max(1, 100 - t * 28), 128, 80, Math.max(2, 140 - t * 28));
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = g;
      c.fillRect(0, 0, CA_W, CA_H);
    },
  },
  // "He stepped into the light alone."
  alone: {
    bg(c) {
      caSky(c, [[0, 'wine'], [0.55, 'rust'], [0.75, 'clay']]);
      caSun(c, 200, 98, 12, 'peach', 'clay');
      caRidge(c, 100, 14, 40, 9, 'maroon');
      c.fillStyle = caCol('brown');
      c.fillRect(0, 108, CA_W, CA_H - 108);
      c.fillStyle = caCol('umber');
      c.beginPath(); c.moveTo(0, 30); c.lineTo(46, 40); c.lineTo(70, 108); c.lineTo(0, 120); c.fill();
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(34, 96, 12, 18, 0, Math.PI, 0); c.lineTo(46, 112); c.lineTo(22, 112); c.fill();
    },
    fg(c, t) {
      caGrass(c, 112, t, 120, 6, ['khaki', 'brown', 'umber'], 7, 12);
      c.fillStyle = caCol('umber', 0.9);
      c.beginPath(); c.ellipse(118, 125, 28, 2, 0, 0, Math.PI * 2); c.fill();
      this.fig(c, 'orpheusWalk', t < 2 ? Math.floor(t * 3) % 2 : 1, Math.min(140, 120 + t * 7), 126, 1.2);
      caVignette(c, 0.7);
    },
  },
};

// Ημέρα έξω από τη σπηλιά (καλό τέλος): ουρανός, ήλιος, λόφοι, το στόμιο της σπηλιάς αριστερά.
function caDay(c, sx, sy, low) {
  caSky(c, low ? [[0, 'clay'], [0.5, 'orange'], [0.75, 'peach'], [0.85, 'cream']] : [[0, 'orange'], [0.45, 'peach'], [0.8, 'cream']]);
  caSun(c, sx, sy, low ? 18 : 14, 'white', 'peach');
  caRidge(c, 100, 18, 50, 12, 'tan');
  caRidge(c, 110, 10, 34, 13, 'sand');
  c.fillStyle = caCol('khaki');
  c.fillRect(0, 114, CA_W, CA_H - 114);
  c.fillStyle = caCol('brown');
  c.beginPath(); c.moveTo(0, 40); c.lineTo(30, 52); c.lineTo(58, 116); c.lineTo(0, 124); c.fill();
  c.fillStyle = caCol('night');
  c.beginPath(); c.ellipse(26, 100, 11, 17, 0, Math.PI, 0); c.lineTo(37, 116); c.lineTo(15, 116); c.fill();
}
function caBirds(c, t) {
  c.fillStyle = caCol('brown');
  for (let i = 0; i < 3; i++) {
    const x = ((40 + i * 30 + t * (6 + i)) % 300) - 20, y = 30 + i * 9 + Math.sin(t * 2 + i) * 2;
    const w = Math.sin(t * 8 + i * 2) > 0 ? 1 : 0;
    c.fillRect(Math.round(x - 2), Math.round(y - w), 2, 1);
    c.fillRect(Math.round(x + 1), Math.round(y - w), 2, 1);
    c.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}
