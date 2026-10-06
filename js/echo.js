'use strict';

// Πόσο κρατάει το φως ενός τοίχου: ανά κομμάτι, στο Level.segFade (1.5 δευτ., 0.5 στη Λήθη).
// Ταχύτητα διάδοσης του κύματος (μονάδες κόσμου / δευτ.).
const WAVE_SPEED = 430;
// Επίπεδα διαφάνειας για ομαδοποιημένη σχεδίαση (λιγότερα stroke = πιο γρήγορα).
const ALPHA_BUCKETS = 14;

const Echoes = {
  waves: [],
  now: 0,             // η ώρα του παιχνιδιού στο τελευταίο update
  litTime: null,      // πότε φωτίστηκε τελευταία φορά κάθε κομμάτι τοίχου
  litStrength: null,  // πόσο δυνατά φωτίστηκε
  // Αντικείμενα που "ακούνε": { x, y, onHear(wave, dist, los) }.
  // Το onHear καλείται μία φορά ανά κύμα, τη στιγμή που το δαχτυλίδι τα φτάνει
  // (αν είναι εντός ακτίνας). los = αν υπάρχει οπτική επαφή με την πηγή του ήχου.
  listeners: [],
  markSeen: true,     // false = τα κύματα δεν γράφουν στον χάρτη του παίκτη (π.χ. στη σκηνή του μενού)
  _buckets: null,

  init() {
    const n = Level.segCount;
    this.waves = [];
    this.litTime = new Float32Array(n).fill(-1e6);
    this.litStrength = new Float32Array(n);
    // Το ίδιο για τα κελιά του δαπέδου (και του νερού): φωτίζονται όταν τα βρει το δαχτυλίδι.
    const cells = Level.cols * Level.rows;
    this.cellTime = new Float32Array(cells).fill(-1e6);
    this.cellStr = new Float32Array(cells);
    this._buckets = [];
    for (let b = 0; b < ALPHA_BUCKETS; b++) this._buckets.push([]);
  },

  // Νέος ήχος στο (x, y). radius = πόσο μακριά φτάνει, strength = 0..1.
  // kind: 'step' | 'call'.
  emit(x, y, radius, strength, kind) {
    const L = Level;
    const r2 = radius * radius;
    const hits = [];
    for (let i = 0; i < L.segCount; i++) {
      const dx = L.testX[i] - x, dy = L.testY[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (!L.lineOfSight(x, y, L.testX[i], L.testY[i])) continue;
      hits.push({ i, d: Math.sqrt(d2) });
    }
    hits.sort((a, b) => a.d - b.d);

    // Κελιά δαπέδου/νερού μέσα στην ακτίνα, που ο ήχος τα φτάνει χωρίς τοίχο στη μέση.
    const cellHits = [];
    const tx0 = Math.max(0, Math.floor((x - radius) / TILE)), tx1 = Math.min(L.cols - 1, Math.floor((x + radius) / TILE));
    const ty0 = Math.max(0, Math.floor((y - radius) / TILE)), ty1 = Math.min(L.rows - 1, Math.floor((y + radius) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = L.terrain[ty * L.cols + tx];
        if (t === T_WALL || t === T_CHASM) continue;
        const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
        const d = Math.hypot(cx - x, cy - y);
        if (d > radius) continue;
        if (!L.lineOfSight(x, y, cx, cy)) continue;
        cellHits.push({ c: ty * L.cols + tx, d });
      }
    }
    cellHits.sort((a, b) => a.d - b.d);

    // Ακτίνες ορατότητας: μέχρι πού φτάνει ο ήχος προς κάθε κατεύθυνση πριν βρει τοίχο.
    // Το δαχτυλίδι και η λάμψη του ακολουθούν τους διαδρόμους αντί να περνάνε μέσα από τοίχους.
    const n = radius > 200 ? 128 : 48;
    const rays = new Float32Array(n);
    for (let k = 0; k < n; k++) rays[k] = L.castRay(x, y, (k / n) * Math.PI * 2, radius);

    const wave = { x, y, radius, strength, kind, r: 0, hits, ptr: 0, reached: new Set(), rays, cells: cellHits, cptr: 0 };
    this.waves.push(wave);
    return wave;
  },

  // Πόσο δυνατό είναι το κύμα σε απόσταση d από την πηγή του (0..1).
  strengthAt(wave, d) {
    return wave.strength * Math.pow(Math.max(0, 1 - d / wave.radius), 0.7);
  },

  update(dt, now) {
    this.now = now;
    for (let w = this.waves.length - 1; w >= 0; w--) {
      const wave = this.waves[w];
      wave.r += WAVE_SPEED * dt;

      while (wave.ptr < wave.hits.length && wave.hits[wave.ptr].d <= wave.r) {
        const h = wave.hits[wave.ptr++];
        const s = this.strengthAt(wave, h.d);
        // Ανανεώνουμε μόνο αν το νέο φως είναι πιο δυνατό από όσο έχει μείνει.
        const age = now - this.litTime[h.i];
        const fade = Level.segFade[h.i];
        const current = age < fade ? this.litStrength[h.i] * (1 - age / fade) : 0;
        if (s > current) {
          this.litTime[h.i] = now;
          this.litStrength[h.i] = s;
        }
      }

      while (wave.cptr < wave.cells.length && wave.cells[wave.cptr].d <= wave.r) {
        const h = wave.cells[wave.cptr++];
        if (this.markSeen) Level.seen[h.c] = 1;   // για τον χάρτη: αυτό το κομμάτι το "είδε" ο ήχος
        const s = this.strengthAt(wave, h.d);
        const fade = Level.regionFade[Level.region[h.c]] || 1.5;
        const age = now - this.cellTime[h.c];
        const current = age < fade ? this.cellStr[h.c] * (1 - age / fade) : 0;
        if (s > current) {
          this.cellTime[h.c] = now;
          this.cellStr[h.c] = s;
        }
      }

      for (const l of this.listeners) {
        if (wave.reached.has(l)) continue;
        const d = Math.hypot(l.x - wave.x, l.y - wave.y);
        if (d > wave.radius) { wave.reached.add(l); continue; }
        if (d > wave.r) continue;
        wave.reached.add(l);
        l.onHear(wave, d, Level.lineOfSight(wave.x, wave.y, l.x, l.y));
      }

      if (wave.r >= wave.radius) this.waves.splice(w, 1);
    }
  },

  // Πόσο φως ήχου υπάρχει τώρα στο σημείο (x, y) (0..1): το άθροισμα της λάμψης
  // των κυμάτων που το φτάνουν χωρίς τοίχο στη μέση. Το χρησιμοποιούν π.χ. τα σωματίδια σκόνης.
  lightAt(x, y) {
    let sum = 0;
    for (const w of this.waves) {
      const dx = x - w.x, dy = y - w.y;
      const d = Math.hypot(dx, dy);
      if (d > w.r || d > w.radius) continue;
      const n = w.rays.length;
      let k = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * n);
      if (k < 0) k += n;
      if (w.rays[k % n] < d - 3) continue;
      const t = w.r / w.radius;
      sum += w.strength * (1 - d / w.radius) * (1 - t) * (w.kind === 'step' ? 0.4 : 1);
    }
    return Math.min(1, sum);
  },

  // Μικρός "θόρυβος" που αλλάζει αργά κατά μήκος του τοίχου: οι γραμμές δεν είναι
  // τέλειες ευθείες αλλά σαν ζωγραφισμένες με το χέρι. Συνεχής, ώστε να ενώνονται
  // τα γειτονικά κομμάτια χωρίς κενά.
  _wobble(v, seed) {
    return Math.sin(v * 0.083 + seed) * 0.55 + Math.sin(v * 0.21 + seed * 1.7 + 1.7) * 0.35;
  },

  // Τα άκρα ενός κομματιού τοίχου, μετατοπισμένα κατά off (θετικό = προς τον διάδρομο,
  // αρνητικό = μέσα στον τοίχο) και με το "ζωγραφιστό" τρέμουλο. Γράφει στο this._p.
  _segPoints(i, off) {
    const L = Level, p = this._p;
    let x1 = L.segX1[i], y1 = L.segY1[i], x2 = L.segX2[i], y2 = L.segY2[i];
    if (y1 === y2) {
      // Οριζόντιο: η κάθετη κατεύθυνση είναι το y.
      const dir = L.testY[i] > y1 ? 1 : -1;
      p[1] = y1 + dir * off + this._wobble(x1 + y1 * 0.37, 0.4);
      p[3] = y2 + dir * off + this._wobble(x2 + y2 * 0.37, 0.4);
      p[0] = x1; p[2] = x2;
    } else {
      const dir = L.testX[i] > x1 ? 1 : -1;
      p[0] = x1 + dir * off + this._wobble(y1 + x1 * 0.37, 2.1);
      p[2] = x2 + dir * off + this._wobble(y2 + x2 * 0.37, 2.1);
      p[1] = y1; p[3] = y2;
    }
  },
  _p: [0, 0, 0, 0],

  // view = ορατό ορθογώνιο σε συντεταγμένες κόσμου, scale = CSS pixels ανά μονάδα κόσμου.
  draw(ctx, now, view, scale) {
    const L = Level;
    const buckets = this._buckets;
    for (const b of buckets) b.length = 0;

    for (let i = 0; i < L.segCount; i++) {
      const age = now - this.litTime[i];
      const fade = L.segFade[i];
      if (age >= fade) continue;
      const x1 = L.segX1[i], y1 = L.segY1[i];
      if (x1 < view.x0 - TILE || x1 > view.x1 + TILE ||
          y1 < view.y0 - TILE || y1 > view.y1 + TILE) continue;
      const f = 1 - age / fade;
      const a = this.litStrength[i] * f * Math.sqrt(f);
      if (a < 0.015) continue;
      const b = Math.min(ALPHA_BUCKETS - 1, Math.floor(a * ALPHA_BUCKETS));
      buckets[b].push(i);
    }

    this._drawFloor(ctx, now, view);

    // 1) Λάμψη των κυμάτων στο δάπεδο (πίσω από όλα): ο διάδρομος φωτίζεται για
    // λίγο μέσα στην ορατότητα του ήχου και σβήνει καθώς φεύγει το δαχτυλίδι.
    ctx.globalCompositeOperation = 'lighter';
    for (const w of this.waves) this._drawBloom(ctx, w);

    ctx.lineCap = 'butt';
    // Περάσματα από πίσω προς τα μπροστά: μάζα του τοίχου (μέσα στην πέτρα), απαλό
    // φως που χύνεται στο δάπεδο, λεπτή φωτεινή γραμμή στην ακμή.
    const passes = [
      { width: 7, off: -3.5, color: POT.terra, mul: 0.16, add: false },
      { width: 11, off: 3.5, color: POT.terra, mul: 0.14, add: true },
      { width: 3.4, off: 0.5, color: POT.terra, mul: 0.4, add: true },
      { width: 1.7 / scale, off: 0, color: POT.light, mul: 1, add: true },
    ];
    for (const p of passes) {
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      ctx.lineWidth = p.width;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = buckets[b];
        if (list.length === 0) continue;
        const alpha = ((b + 0.5) / ALPHA_BUCKETS) * p.mul;
        ctx.strokeStyle = `rgba(${p.color},${alpha.toFixed(3)})`;
        ctx.beginPath();
        for (const i of list) {
          this._segPoints(i, p.off);
          ctx.moveTo(this._p[0], this._p[1]);
          ctx.lineTo(this._p[2], this._p[3]);
        }
        ctx.stroke();
      }
    }

    // 2) Αρμοί ανάμεσα στους λίθους: μικρές γραμμές μέσα στον τοίχο, σε τυχαία
    // (αλλά σταθερά) σημεία, και μερικές ρωγμές.
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      const list = buckets[b];
      if (list.length === 0) continue;
      ctx.strokeStyle = `rgba(${POT.terra},${(((b + 0.5) / ALPHA_BUCKETS) * 0.45).toFixed(3)})`;
      ctx.beginPath();
      for (const i of list) {
        const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        if (h > 0.2) continue;
        this._segPoints(i, 0);
        const mx = (this._p[0] + this._p[2]) / 2, my = (this._p[1] + this._p[3]) / 2;
        const horizontal = L.segY1[i] === L.segY2[i];
        const dir = horizontal ? (L.testY[i] > L.segY1[i] ? 1 : -1) : (L.testX[i] > L.segX1[i] ? 1 : -1);
        const depth = 4 + h * 20;               // 4..8 μονάδες μέσα στον τοίχο
        const skew = (h - 0.1) * 6;
        if (horizontal) {
          ctx.moveTo(mx, my);
          ctx.lineTo(mx + skew, my - dir * depth);
        } else {
          ctx.moveTo(mx, my);
          ctx.lineTo(mx - dir * depth, my + skew);
        }
      }
      ctx.stroke();
    }

    // 3) Τα δαχτυλίδια των ήχων.
    ctx.globalCompositeOperation = 'lighter';
    for (const w of this.waves) this._drawRing(ctx, w, scale);
    ctx.globalCompositeOperation = 'source-over';
  },

  // Το δάπεδο που φώτισε ο ήχος: σκούρα πήλινα πλακάκια (2×2 σε κάθε κελί, με αρμούς
  // ανάμεσα και λίγες ρωγμές), και νερό με κυματάκια που κινούνται. Σβήνουν όπως οι τοίχοι.
  _drawFloor(ctx, now, view) {
    const L = Level;
    const tx0 = Math.max(0, Math.floor(view.x0 / TILE) - 1), tx1 = Math.min(L.cols - 1, Math.floor(view.x1 / TILE) + 1);
    const ty0 = Math.max(0, Math.floor(view.y0 / TILE) - 1), ty1 = Math.min(L.rows - 1, Math.floor(view.y1 / TILE) + 1);
    const half = TILE / 2, gap = 4.5;   // αρμός ~2 art pixels
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = ty * L.cols + tx;
        const age = now - this.cellTime[c];
        const fade = L.regionFade[L.region[c]] || 1.5;
        if (age >= fade) continue;
        const f = 1 - age / fade;
        const a = this.cellStr[c] * f * Math.sqrt(f);
        if (a < 0.02) continue;
        const x = tx * TILE, y = ty * TILE;
        if (L.terrain[c] === T_WATER) {
          ctx.fillStyle = `rgba(20,12,10,${(a * 0.85).toFixed(3)})`;
          ctx.fillRect(x, y, TILE, TILE);
          // Κυματάκια: δύο γραμμές που κυλάνε αργά (σκούρο νερό του Κάτω Κόσμου).
          ctx.strokeStyle = `rgba(${POT.terra},${(a * 0.45).toFixed(3)})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (const k of [0.3, 0.75]) {
            const yy = y + TILE * k;
            const ph = now * 1.3 + tx * 1.7 + k * 5;
            ctx.moveTo(x + 4, yy + Math.sin(ph) * 2.5);
            ctx.lineTo(x + TILE * 0.5, yy + Math.sin(ph + 1.6) * 2.5);
            ctx.lineTo(x + TILE - 4, yy + Math.sin(ph + 3.2) * 2.5);
          }
          ctx.stroke();
          continue;
        }
        // Πήλινα πλακάκια με μικρές διαφορές χρώματος (σταθερές ανά πλακάκι).
        for (let k = 0; k < 4; k++) {
          const sx = x + (k & 1) * half, sy = y + (k >> 1) * half;
          const h = Math.abs(Math.sin((tx * 2 + (k & 1)) * 12.9898 + (ty * 2 + (k >> 1)) * 78.233) * 43758.5453) % 1;
          const r = 62 + Math.round(h * 22), g = 30 + Math.round(h * 10), b = 18 + Math.round(h * 6);
          ctx.fillStyle = `rgba(${r},${g},${b},${(a * 0.55).toFixed(3)})`;
          ctx.fillRect(sx + gap / 2, sy + gap / 2, half - gap, half - gap);
          if (h > 0.86) {
            // Ρωγμή σε λίγα πλακάκια.
            ctx.strokeStyle = `rgba(12,6,4,${(a * 0.8).toFixed(3)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx + 4, sy + 5);
            ctx.lineTo(sx + half * 0.5, sy + half * 0.45);
            ctx.lineTo(sx + half - 5, sy + half - 6);
            ctx.stroke();
          }
        }
        // Γκρεμός: αν από κάτω είναι χάσμα, μια σκούρα ακμή δείχνει το βάθος.
        if (L.terrainAt(tx, ty + 1) === T_CHASM) {
          ctx.fillStyle = `rgba(${POT.terra},${(a * 0.5).toFixed(3)})`;
          ctx.fillRect(x, y + TILE - 3, TILE, 3);
        }
      }
    }
  },

  // Η "λάμψη" ενός κύματος: το πολύγωνο ορατότητας, γεμάτο με απαλή ακτινική διαβάθμιση.
  _drawBloom(ctx, w) {
    const t = w.r / w.radius;
    const fade = 1 - t;
    const a = w.strength * (w.kind === 'step' ? 0.05 : 0.12) * fade * fade;
    if (a < 0.004) return;
    const n = w.rays.length;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2;
      const d = Math.min(w.rays[k], w.r);
      const px = w.x + Math.cos(ang) * d, py = w.y + Math.sin(ang) * d;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, Math.max(1, w.r));
    g.addColorStop(0, `rgba(${POT.terra},${a.toFixed(3)})`);
    g.addColorStop(1, `rgba(${POT.terra},${(a * 0.15).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fill();
  },

  // Το ίδιο το δαχτυλίδι: σπάει εκεί που ο ήχος βρήκε τοίχο και συνεχίζει στους διαδρόμους.
  _drawRing(ctx, w, scale) {
    const t = w.r / w.radius;
    const a = w.strength * (w.kind === 'step' ? 0.16 : 0.5) * (1 - t);
    if (a < 0.008) return;
    const n = w.rays.length;
    for (const [width, mul] of [[10, 0.18], [1.6 / scale, 1]]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(${width > 5 ? POT.terra : POT.light},${(a * mul).toFixed(3)})`;
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k <= n; k++) {
        const j = k % n;
        if (w.rays[j] >= w.r - 1.5) {
          const ang = (j / n) * Math.PI * 2;
          const px = w.x + Math.cos(ang) * w.r, py = w.y + Math.sin(ang) * w.r;
          if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
        } else {
          pen = false;
        }
      }
      ctx.stroke();
    }
  },
};
