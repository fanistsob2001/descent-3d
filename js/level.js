'use strict';

// Μέγεθος ενός κελιού του λαβυρίνθου σε μονάδες κόσμου.
const TILE = 40;

// Βήμα δειγματοληψίας των τοίχων: κάθε πλευρά τοίχου σπάει σε μικρά κομμάτια
// που φωτίζονται ανεξάρτητα όταν τα ακουμπάει το κύμα.
const WALL_SAMPLE_STEP = 5;

// Οι χάρτες των κεφαλαίων βρίσκονται στο js/levels.js.

// Είδη εδάφους (Level.terrain). Το νερό και το χάσμα δεν περπατιούνται, αλλά ο ήχος
// περνάει από πάνω τους (οι τοίχοι της απέναντι όχθης φωτίζονται, οι σκιές ακούνε).
const T_FLOOR = 0, T_WALL = 1, T_WATER = 2, T_CHASM = 3;

const Level = {
  cols: 0,
  rows: 0,
  grid: null,          // Uint8Array, 1 = δεν περπατιέται (τοίχος, νερό, χάσμα, κλειστή πύλη)
  opaque: null,        // Uint8Array, 1 = σταματάει τον ήχο (μόνο τοίχοι και κλειστή πύλη)
  terrain: null,       // Uint8Array, T_FLOOR | T_WALL | T_WATER | T_CHASM
  region: null,        // Int8Array: σε ποιο κεφάλαιο ανήκει κάθε κελί (-1 = γέμισμα)
  wallKind: null,      // Uint8Array ανά κελί τοίχου: 0 = βράχος / λίθοι ('#'), 1 = χαμηλή ξερολιθιά ('%'), 2 = τοίχος σπιτιού ('=')
  start: { x: 0, y: 0 },
  monsters: [],        // { x, y, guard, region, kind: 'shade' | 'erinys' } — θέσεις εκκίνησης των τεράτων
  altars: [],          // { x, y, tx, ty } — ένας βωμός ανά κεφάλαιο, με τη σειρά
  items: [],           // { kind: 'obol' | 'string' | 'jar', x, y, region } — ο δείκτης είναι το id
  gates: [],           // { tx, ty, x, y, open } — η βάρκα του Χάροντα
  souls: [],           // { n, x, y } — μηνύματα χαμένων ψυχών (1..6)
  eggs: {},            // easter eggs: { stuck: { x, y }, cerberus: { x, y } }
  decor: [],           // ακίνητες μορφές του 3D κόσμου: { kind: 'snake' | 'hades' | 'persephone', x, y }
  quiet: null,         // Uint8Array: κελιά όπου οι σκιές δεν πάνε ποτέ να περιπλανηθούν
  seen: null,          // Uint8Array: κελιά που έχει ήδη "δει" ο παίκτης (φωτίστηκαν από κύμα ή πέρασε από εκεί) — για τον χάρτη
  exit: { tx: 0, ty: 0, x: 0, y: 0 },

  // Κομμάτια τοίχων (segments) που μπορούν να φωτιστούν.
  segCount: 0,
  segX1: null, segY1: null, segX2: null, segY2: null,
  // Σημείο ελέγχου κάθε κομματιού: λίγο έξω από τον τοίχο, μέσα στον διάδρομο,
  // ώστε ο έλεγχος οπτικής επαφής να μην "χτυπάει" τον ίδιο τον τοίχο.
  testX: null, testY: null,
  segFade: null,       // σε πόσα δευτ. σβήνει κάθε κομμάτι (Λήθη = πιο γρήγορα), 0 = ανενεργό
  segBaseFade: null,
  segGate: null,       // Int16Array: σε ποια πύλη ανήκει το κομμάτι (-1 = σε καμία)
  regionFade: [],      // σε πόσα δευτ. σβήνει το φως σε κάθε κεφάλαιο (για το δάπεδο)

  // Ενώνει τα κεφάλαια σε έναν χάρτη: το ένα κάτω από το άλλο, μετατοπισμένα
  // οριζόντια ώστε το v κάθε κεφαλαίου να πέφτει ακριβώς πάνω από το ^ του επόμενου.
  loadWorld(chapters) {
    const col = (map, row, chars) => [...map[row]].findIndex((c) => chars.includes(c));
    const offsets = [0];
    for (let i = 1; i < chapters.length; i++) {
      const prev = chapters[i - 1].map;
      offsets.push(offsets[i - 1] + col(prev, prev.length - 1, 'vw') - col(chapters[i].map, 0, '^'));
    }
    const minOff = Math.min(...offsets);
    for (let i = 0; i < offsets.length; i++) offsets[i] -= minOff;

    this.cols = Math.max(...chapters.map((c, i) => offsets[i] + c.map[0].length));
    this.rows = chapters.reduce((sum, c) => sum + c.map.length, 0);
    this.grid = new Uint8Array(this.cols * this.rows).fill(1);
    this.opaque = new Uint8Array(this.cols * this.rows).fill(1);
    this.terrain = new Uint8Array(this.cols * this.rows).fill(T_WALL);
    this.region = new Int8Array(this.cols * this.rows).fill(-1);
    this.wallKind = new Uint8Array(this.cols * this.rows);
    this.seen = new Uint8Array(this.cols * this.rows);
    // Κάθε κόσμος (ο πρόλογος, ο κάτω κόσμος) ξεκινάει χωρίς αφετηρία / έξοδο από τον προηγούμενο.
    this.start = { x: 0, y: 0 };
    this.exit = { tx: -10, ty: -10, x: -1e6, y: -1e6 };
    this.landing = null;   // εκεί που αράζει η βάρκα του Χάροντα (K)
    this.boss = null;      // ο Κέρβερος (B)
    let tablets = 0;
    this.monsters = [];
    this.altars = [];
    this.items = [];
    this.gates = [];
    this.souls = [];
    this.eggs = {};
    this.decor = [];

    let top = 0;
    // Πού μπήκε κάθε μπλοκ στον κόσμο (σε κελιά): για όποιον διαβάζει δικούς του χαρακτήρες (ο πρόλογος).
    this.blockX = offsets.slice();
    this.blockY = [];
    chapters.forEach((ch, r) => {
      this.blockY.push(top);
      ch.map.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          const wx = offsets[r] + x, wy = top + y;
          const i = wy * this.cols + wx;
          const c = line[x];
          const t = c === '#' || c === '%' || c === '=' ? T_WALL : c === '~' ? T_WATER : c === ':' ? T_CHASM : T_FLOOR;
          if (c === '%') this.wallKind[i] = 1;
          if (c === '=') this.wallKind[i] = 2;
          this.terrain[i] = t;
          this.grid[i] = t === T_FLOOR ? 0 : 1;
          this.opaque[i] = t === T_WALL ? 1 : 0;
          this.region[i] = r;
          const cx = (wx + 0.5) * TILE, cy = (wy + 0.5) * TILE;
          if (c === 'S') { this.start.x = cx; this.start.y = cy; }
          if (c === 'C') this.altars[r] = { x: cx, y: cy, tx: wx, ty: wy };
          if (c === 'M' || c === 'G') this.monsters.push({ x: cx, y: cy, guard: c === 'G', region: r, kind: 'shade' });
          if (c === 'F') this.monsters.push({ x: cx, y: cy, guard: true, region: r, kind: 'erinys' });
          if (c === 'E') { this.exit.tx = wx; this.exit.ty = wy; this.exit.x = cx; this.exit.y = cy; }
          if (c === 'w') this.gates.push({ tx: wx, ty: wy, x: cx, y: cy, open: true });
          const kind = { o: 'obol', s: 'string', j: 'jar', L: 'tablet' }[c];
          if (kind) this.items.push({ kind, x: cx, y: cy, region: r, n: kind === 'tablet' ? tablets++ : -1 });
          if (c === 'K') this.landing = { x: cx, y: cy };
          if (c === 'B') this.boss = { x: cx, y: cy, region: r };
          if (c >= '1' && c <= '9') this.souls.push({ n: Number(c), x: cx, y: cy });
          if (c === 'X') this.eggs.stuck = { x: cx, y: cy };
          if (c === 'D') this.eggs.cerberus = { x: cx, y: cy };
          // Φίδι / θρόνοι: δεν περπατιούνται (ούτε οι σκιές), αλλά ο ήχος περνάει.
          const deco = { Z: 'snake', H: 'hades', P: 'persephone' }[c];
          if (deco) { this.decor.push({ kind: deco, x: cx, y: cy }); this.grid[i] = 1; }
        }
      });
      top += ch.map.length;
    });

    // Τα κομμάτια χτίζονται με τις πύλες ανοιχτές (ώστε να υπάρχουν οι πλευρές
    // των γειτονικών τοίχων) — οι ίδιες οι πύλες παίρνουν δικά τους κομμάτια.
    // Το δωμάτιο του Κέρβερου μένει ήσυχο: καμία σκιά δεν το διαλέγει για περιπλάνηση.
    this.quiet = new Uint8Array(this.cols * this.rows);
    if (this.eggs.cerberus) {
      const ctx = Math.floor(this.eggs.cerberus.x / TILE), cty = Math.floor(this.eggs.cerberus.y / TILE);
      for (let y = cty - 2; y <= cty + 2; y++) {
        for (let x = ctx - 3; x <= ctx + 2; x++) {
          if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.quiet[y * this.cols + x] = 1;
        }
      }
    }

    this.buildSegments();
    this.segBaseFade = new Float32Array(this.segCount);
    for (let i = 0; i < this.segCount; i++) {
      // Το κομμάτι ανήκει στο κεφάλαιο του διαδρόμου μπροστά του.
      const r = this.regionAt(Math.floor(this.testX[i] / TILE), Math.floor(this.testY[i] / TILE));
      this.segBaseFade[i] = r >= 0 ? chapters[r].fade : 1.5;
    }
    this.segFade = this.segBaseFade.slice();
    this.regionFade = chapters.map((c) => c.fade);
    this.gates.forEach((g, i) => this.setGate(i, false));
  },

  // Ανοίγει / κλείνει μια πύλη: αλλάζει το πλέγμα και (απ)ενεργοποιεί τα κομμάτια της.
  setGate(i, open) {
    const g = this.gates[i];
    g.open = open;
    this.grid[g.ty * this.cols + g.tx] = open ? 0 : 1;
    this.opaque[g.ty * this.cols + g.tx] = open ? 0 : 1;
    for (let k = 0; k < this.segCount; k++) {
      if (this.segGate[k] === i) this.segFade[k] = open ? 0 : this.segBaseFade[k];
    }
  },

  // Τα κελιά που έχει δει ο παίκτης, για το save: bitset σε δεκαεξαδική μορφή.
  seenString() {
    let out = '';
    for (let i = 0; i < this.seen.length; i += 4) {
      out += ((this.seen[i] ? 1 : 0) | (this.seen[i + 1] ? 2 : 0) |
        (this.seen[i + 2] ? 4 : 0) | (this.seen[i + 3] ? 8 : 0)).toString(16);
    }
    return out;
  },

  // Προσθέτει (δεν σβήνει) όσα κελιά λέει ένα seenString.
  mergeSeen(str) {
    if (typeof str !== 'string') return;
    for (let k = 0; k < str.length && k * 4 < this.seen.length; k++) {
      const v = parseInt(str[k], 16) || 0;
      for (let b = 0; b < 4; b++) if (v & (1 << b)) this.seen[k * 4 + b] = 1;
    }
  },

  isWall(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.grid[ty * this.cols + tx] === 1;
  },

  // Σταματάει τον ήχο (και την οπτική επαφή) αυτό το κελί;
  isOpaque(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.opaque[ty * this.cols + tx] === 1;
  },

  terrainAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return T_WALL;
    return this.terrain[ty * this.cols + tx];
  },

  regionAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return -1;
    return this.region[ty * this.cols + tx];
  },

  // Σπρώχνει έναν κύκλο { x, y, r } έξω από τους τοίχους.
  // Επιστρέφει true αν ακούμπησε τοίχο.
  pushOutOfWalls(p) {
    const r = p.r;
    let hit = false;
    const minTx = Math.floor((p.x - r) / TILE), maxTx = Math.floor((p.x + r) / TILE);
    const minTy = Math.floor((p.y - r) / TILE), maxTy = Math.floor((p.y + r) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isWall(tx, ty)) continue;
        const cx = Math.max(tx * TILE, Math.min(p.x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(p.y, ty * TILE + TILE));
        const dx = p.x - cx, dy = p.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.y += (dy / d) * (r - d);
        } else {
          // Το κέντρο μπήκε μέσα στον τοίχο: βγάλ' το από την κοντινότερη πλευρά.
          const left = p.x - tx * TILE, right = tx * TILE + TILE - p.x;
          const top = p.y - ty * TILE, bottom = ty * TILE + TILE - p.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) p.x = tx * TILE - r;
          else if (m === right) p.x = tx * TILE + TILE + r;
          else if (m === top) p.y = ty * TILE - r;
          else p.y = ty * TILE + TILE + r;
        }
      }
    }
    return hit;
  },

  // Αναζήτηση κατά πλάτος στο πλέγμα. Επιστρέφει Int32Array με την απόσταση
  // (σε κελιά) κάθε κελιού από το (sx, sy), -1 = απρόσιτο, και τον "γονέα" του.
  // fly = true: για όσους πετάνε (Ερινύες) — περνάνε πάνω από νερό και χάσματα, όχι από τοίχους.
  bfs(sx, sy, maxSteps = Infinity, fly = false) {
    const n = this.cols * this.rows;
    const dist = new Int32Array(n).fill(-1);
    const parent = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    let head = 0, tail = 0;
    const start = sy * this.cols + sx;
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++];
      if (dist[cur] >= maxSteps) continue;
      const cx = cur % this.cols, cy = (cur / this.cols) | 0;
      const next = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of next) {
        if (fly ? this.isOpaque(nx, ny) : this.isWall(nx, ny)) continue;
        const ni = ny * this.cols + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1;
        parent[ni] = cur;
        queue[tail++] = ni;
      }
    }
    return { dist, parent };
  },

  // Διαδρομή από κελί σε κελί: λίστα από [tx, ty], χωρίς το αρχικό κελί.
  findPath(sx, sy, tx, ty, fly = false) {
    if (fly ? this.isOpaque(tx, ty) : this.isWall(tx, ty)) return [];
    const { parent, dist } = this.bfs(sx, sy, Infinity, fly);
    let cur = ty * this.cols + tx;
    if (dist[cur] === -1) return [];
    const path = [];
    while (dist[cur] > 0) {
      path.push([cur % this.cols, (cur / this.cols) | 0]);
      cur = parent[cur];
    }
    return path.reverse();
  },

  // Τυχαίο κελί διαδρόμου σε απόσταση minSteps..maxSteps (σε κελιά) από το (sx, sy).
  // Αν δοθεί region, μόνο κελιά αυτού του κεφαλαίου (οι σκιές δεν αλλάζουν κεφάλαιο).
  randomFloorNear(sx, sy, minSteps, maxSteps, region, fly = false) {
    const { dist } = this.bfs(sx, sy, maxSteps, fly);
    const options = [];
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] < minSteps || dist[i] > maxSteps) continue;
      if (region !== undefined && this.region[i] !== region) continue;
      if (this.quiet[i]) continue;
      const tx = i % this.cols, ty = (i / this.cols) | 0;
      if (tx === this.exit.tx && ty === this.exit.ty) continue;
      // Ούτε στις ενώσεις ανάμεσα στα κεφάλαια (τα κελιά ^ / v πάνω στα τείχη).
      if (this.isWall(tx - 1, ty) && this.isWall(tx + 1, ty) &&
          this.regionAt(tx, ty - 1) !== this.regionAt(tx, ty + 1)) continue;
      options.push([tx, ty]);
    }
    if (options.length === 0) return [sx, sy];
    return options[Math.floor(Math.random() * options.length)];
  },

  // Φτιάχνει κομμάτια μόνο στις πλευρές τοίχων που βλέπουν σε διάδρομο.
  buildSegments() {
    const segs = [];
    const per = Math.round(TILE / WALL_SAMPLE_STEP);
    const len = TILE / per;
    const nudge = 1;

    // [dx, dy γείτονα], αρχή και κατεύθυνση της πλευράς, κάθετη προς τα έξω
    const sides = [
      { nx: 0, ny: -1, ox: 0, oy: 0, ax: 1, ay: 0 },       // πάνω
      { nx: 0, ny: 1, ox: 0, oy: TILE, ax: 1, ay: 0 },     // κάτω
      { nx: -1, ny: 0, ox: 0, oy: 0, ax: 0, ay: 1 },       // αριστερά
      { nx: 1, ny: 0, ox: TILE, oy: 0, ax: 0, ay: 1 },     // δεξιά
    ];

    const gateAt = (tx, ty) => this.gates.findIndex((g) => g.tx === tx && g.ty === ty);
    const owners = [];
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const gate = gateAt(tx, ty);
        if (!this.isOpaque(tx, ty) && gate < 0) continue;
        for (const s of sides) {
          const ntx = tx + s.nx, nty = ty + s.ny;
          if (ntx < 0 || nty < 0 || ntx >= this.cols || nty >= this.rows) continue;
          if (this.isOpaque(ntx, nty)) continue;
          const bx = tx * TILE + s.ox, by = ty * TILE + s.oy;
          for (let k = 0; k < per; k++) {
            const x1 = bx + s.ax * len * k, y1 = by + s.ay * len * k;
            const x2 = x1 + s.ax * len, y2 = y1 + s.ay * len;
            segs.push(x1, y1, x2, y2,
              (x1 + x2) / 2 + s.nx * nudge, (y1 + y2) / 2 + s.ny * nudge);
            owners.push(gate);
          }
        }
      }
    }

    const n = segs.length / 6;
    this.segCount = n;
    this.segX1 = new Float32Array(n); this.segY1 = new Float32Array(n);
    this.segX2 = new Float32Array(n); this.segY2 = new Float32Array(n);
    this.testX = new Float32Array(n); this.testY = new Float32Array(n);
    this.segGate = Int16Array.from(owners);
    for (let i = 0; i < n; i++) {
      this.segX1[i] = segs[i * 6];     this.segY1[i] = segs[i * 6 + 1];
      this.segX2[i] = segs[i * 6 + 2]; this.segY2[i] = segs[i * 6 + 3];
      this.testX[i] = segs[i * 6 + 4]; this.testY[i] = segs[i * 6 + 5];
    }
  },

  // Απόσταση από το (x, y) προς τη γωνία ang ως τον πρώτο τοίχο (το πολύ maxDist).
  // Την ίδια διάσχιση πλέγματος χρησιμοποιεί και το lineOfSight.
  castRay(x, y, ang, maxDist) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const tDeltaX = adx > 1e-9 ? TILE / adx : Infinity;
    const tDeltaY = ady > 1e-9 ? TILE / ady : Infinity;
    let tMaxX = adx > 1e-9 ? (stepX > 0 ? (tx + 1) * TILE - x : x - tx * TILE) / adx : Infinity;
    let tMaxY = ady > 1e-9 ? (stepY > 0 ? (ty + 1) * TILE - y : y - ty * TILE) / ady : Infinity;
    let t = 0;
    while (t < maxDist) {
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; }
      else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; }
      if (this.isOpaque(tx, ty)) return Math.min(t, maxDist);
    }
    return maxDist;
  },

  // Οπτική επαφή ανάμεσα σε δύο σημεία (διάσχιση πλέγματος, Amanatides–Woo).
  lineOfSight(x0, y0, x1, y1) {
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const ex = Math.floor(x1 / TILE), ey = Math.floor(y1 / TILE);
    const dx = x1 - x0, dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx !== 0
      ? (stepX > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)
      : Infinity;
    let tMaxY = dy !== 0
      ? (stepY > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy)
      : Infinity;

    let guard = 0;
    while (tx !== ex || ty !== ey) {
      if (tMaxX < tMaxY) { tMaxX += tDeltaX; tx += stepX; }
      else { tMaxY += tDeltaY; ty += stepY; }
      if (this.isOpaque(tx, ty)) return false;
      if (++guard > 256) return false;
    }
    return true;
  },
};
