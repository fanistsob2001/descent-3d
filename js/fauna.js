'use strict';

// Ζωή στον κόσμο (χωρίς να επηρεάζει το παιχνίδι): στον πρόλογο χωρικοί που περπατάνε, παιδιά που παίζουν, ένας
// βοσκός με πρόβατα, ο σκύλος του χωριού, κότες, σπουργίτια που πετάνε όταν πλησιάζεις, σμήνη πουλιών στον ουρανό·
// στις σπηλιές του Κάτω Κόσμου νυχτερίδες που κρέμονται από το ταβάνι και αρουραίοι — φεύγουν όταν τους βρει ο ήχος.
// Όπως τα easter eggs: δεν είναι στη λίστα monsters, δεν καλούν ποτέ Echoes.emit (οι σκιές δεν τα ακούνε).

const FAUNA_BIRD_SPEED = 85;      // μονάδες / δευτ. (σμήνη στον ουρανό)
const FAUNA_SCARE_R = 70;         // τόσο κοντά = τα σπουργίτια πετάνε

const Fauna = {
  list: [],       // { kind, x, y, z, state, ... }
  flocks: [],     // πουλιά που περνάνε στον ουρανό: { x, y, z, vx, vy, ph, life }
  _flockAt: 0,

  rnd: ArtPainter.rng(17),
  hash(a, b, k) { const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); },

  // ---- Ο Κάτω Κόσμος (σε κάθε spawn): νυχτερίδες και αρουραίοι στις σπηλιές ----
  reset() {
    this.list = [];
    this.flocks = [];
    const L = Level, cols = L.cols;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let bats = 0, rats = 0;
    for (let ty = 0; ty < L.rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const c = ty * cols + tx, r = L.region[c];
        if (r < 1 || L.terrain[c] !== T_FLOOR || L.grid[c] !== 0 || L.safe[c]) continue;
        const ch = CHAPTERS[r] || {};
        if (ch.decor !== 'cave' && ch.decor !== 'tartarus') continue;
        if (RC_THEMES[r] === 'fire') continue;
        const h = this.hash(tx, ty, 21);
        const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
        if (ch.decor === 'cave' && h < 0.03 && bats < 90) {
          // Μικρή αποικία: 2-4 νυχτερίδες κρεμασμένες κοντά η μία στην άλλη.
          const n = 2 + Math.floor(this.hash(tx, ty, 22) * 3);
          const top = Raycast.ceilOn[c] ? TILE - 3 : TILE * 1.6;
          for (let k = 0; k < n; k++) {
            this.list.push(this.listener({ kind: 'bat', c, x: x + (this.hash(tx, ty, 30 + k) - 0.5) * 22, y: y + (this.hash(tx, ty, 40 + k) - 0.5) * 22,
              z: top - 2.6 - this.hash(tx, ty, 50 + k) * 4, state: 'hang', ph: k }));
          }
          bats += n;
        } else if (h > 0.985 && rats < 40 && dirs.some(([dx, dy]) => L.isOpaque(tx + dx, ty + dy))) {
          this.list.push(this.listener({ kind: 'rat', c, x, y, z: 0, state: 'idle', ph: h * 10, dir: Math.floor(h * 1000) % 4 }));
          rats++;
        }
      }
    }
  },

  // Ακούνε τα κύματα (όχι τα βήματα): οι νυχτερίδες πετάνε, οι αρουραίοι τρέχουν, τα σπουργίτια φεύγουν.
  listener(o) {
    o.onHear = (wave, d, los) => {
      if (wave.kind === 'step' || o.state === 'gone' || o.state === 'fly' || o.state === 'run') return;
      if (!los && d > wave.radius * 0.5) return;
      this.startle(o, wave.x, wave.y, gameTime);
    };
    return o;
  },
  listeners() {
    return this.list.filter((o) => o.onHear);
  },

  startle(o, fx, fy, now) {
    const a = Math.atan2(o.y - fy, o.x - fx) + (Math.random() - 0.5) * 1.2;
    if (o.kind === 'bat' || o.kind === 'sparrow') {
      o.state = 'fly';
      o.t0 = now;
      o.vx = Math.cos(a) * (o.kind === 'bat' ? 110 : 90);
      o.vy = Math.sin(a) * (o.kind === 'bat' ? 110 : 90);
      o.vz = o.kind === 'bat' ? -10 : 55;
      if (!o.group || o.lead) Sound.flutter(o.x, o.y, o.group ? o.group.length : 1);
    } else if (o.kind === 'rat') {
      o.state = 'run';
      o.t0 = now;
      o.va = a;
      Sound.squeak(o.x, o.y);
    }
  },

  // ---- Ο πρόλογος (και τα τέλη): ο πάνω κόσμος ----
  resetPrologue(mode) {
    this.list = [];
    this.flocks = [];
    this._flockAt = 0;
    const L = Level, cols = L.cols;
    const cells = (block, chs) => {
      const out = [];
      PROLOGUE_MAPS[block].map.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          if (!chs.includes(line[x])) continue;
          const tx = L.blockX[block] + x, ty = L.blockY[block] + y;
          if (L.grid[ty * cols + tx] === 0) out.push([tx, ty]);
        }
      });
      return out;
    };
    const R = this.rnd;
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const at = ([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
    // Κάποιος που περπατάει πέρα-δώθε ανάμεσα σε δύο σημεία (κελί-κελί, Level.findPath).
    const walker = (kind, from, to, speed) => {
      const path = L.findPath(from[0], from[1], to[0], to[1]);
      if (!path || path.length < 3) return;
      this.list.push({ kind, ...at(from), z: 0, path: [from, ...path], i: 0, dir: 1, speed, wait: 0, state: 'walk', dist: 0 });
    };
    const dirt0 = cells(0, ','), grass0 = cells(0, '.'), grass1 = cells(1, '.'), grass2 = cells(2, '.'), grass3 = cells(3, '.');
    const night = mode === 'bad';
    if (dirt0.length > 10) {
      // Το χωριό: δύο γυναίκες με κανάτια, ένας γέρος που περπατάει αργά, παιδιά που κυνηγιούνται, ο σκύλος.
      walker('villagerF', pick(dirt0), pick(dirt0), 26);
      walker('villagerF', pick(dirt0), pick(dirt0), 24);
      if (!night) {
        const c = pick(grass0.filter(([tx, ty]) => dirt0.some(([dx, dy]) => Math.abs(dx - tx) + Math.abs(dy - ty) < 3)) || grass0);
        if (c) for (let k = 0; k < 2; k++) this.list.push({ kind: 'child', ...at(c), cx: at(c).x, cy: at(c).y, z: 0, state: 'play', ph: k * Math.PI, r: 30 + k * 8 });
        walker('dog', pick(dirt0), pick(dirt0), 40);
      }
      // Κότες κοντά στα σπίτια.
      for (let k = 0; k < 6; k++) { const c = pick(grass0); if (c) this.list.push({ kind: 'hen', ...at(c), hx: at(c).x, hy: at(c).y, z: 0, state: 'peck', ph: R() * 10 }); }
    }
    // Ο δρόμος: ένας βοσκός με πρόβατα στο χορτάρι.
    if (grass1.length) {
      const c = pick(grass1.filter(([tx]) => tx > L.blockX[1] + 24) || grass1);
      if (c) {
        const p = at(c);
        this.list.push({ kind: 'shepherd', x: p.x, y: p.y, z: 0, state: 'stand' });
        for (let k = 0; k < 7; k++) {
          const a = R() * Math.PI * 2, d = 40 + R() * 70;
          const sx = p.x + Math.cos(a) * d, sy = p.y + Math.sin(a) * d;
          if (L.isWall(Math.floor(sx / TILE), Math.floor(sy / TILE))) continue;
          this.list.push({ kind: 'sheep', x: sx, y: sy, hx: sx, hy: sy, z: 0, state: 'graze', ph: R() * 10, bleat: 5 + R() * 20 });
        }
      }
    }
    // Η αυλή του σπιτιού: κότες.
    for (let k = 0; k < 4; k++) { const c = pick(grass2.slice(0, Math.floor(grass2.length / 2))); if (c) this.list.push({ kind: 'hen', ...at(c), hx: at(c).x, hy: at(c).y, z: 0, state: 'peck', ph: R() * 10 }); }
    // Σπουργίτια σε μικρές ομάδες στο χορτάρι (χωριό, δρόμος, αυλή, λιβάδι).
    if (!night) {
      for (const [list, n] of [[grass0, 3], [grass1, 4], [grass2, 3], [grass3, 4]]) {
        for (let k = 0; k < n; k++) {
          const c = pick(list);
          if (!c) continue;
          const p = at(c), group = [];
          for (let j = 0; j < 3 + Math.floor(R() * 3); j++) {
            const o = this.listener({ kind: 'sparrow', x: p.x + (R() - 0.5) * 30, y: p.y + (R() - 0.5) * 30, z: 0, state: 'peck', ph: R() * 10, group, home: [p.x, p.y] });
            group.push(o);
            this.list.push(o);
          }
          group[0].lead = true;
        }
      }
    }
  },

  // ---- Κάθε καρέ ----
  update(dt, now, p) {
    const prologue = typeof Prologue !== 'undefined' && Prologue.active;
    for (const o of this.list) {
      if (o.state === 'gone') {
        // Τα σπουργίτια ξαναγυρίζουν στη θέση τους (αν δεν είσαι κοντά).
        if (o.kind === 'sparrow' && now - o.t0 > 30 && Math.hypot(o.home[0] - p.x, o.home[1] - p.y) > TILE * 6) {
          o.state = 'peck'; o.x = o.home[0] + (Math.random() - 0.5) * 30; o.y = o.home[1] + (Math.random() - 0.5) * 30; o.z = 0;
        }
        continue;
      }
      if (o.state === 'walk') {
        if (o.wait > 0) { o.wait -= dt; continue; }
        const nxt = o.path[o.i + o.dir];
        if (!nxt) { o.dir = -o.dir; o.wait = 2 + Math.random() * 4; continue; }
        const tx = (nxt[0] + 0.5) * TILE, ty = (nxt[1] + 0.5) * TILE;
        const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
        const s = Math.min(d, o.speed * dt);
        o.x += (dx / d) * s; o.y += (dy / d) * s; o.dist += s;
        o.dirX = dx / d; o.dirY = dy / d;
        if (d < 2) o.i += o.dir;
      } else if (o.state === 'play') {
        // Παιδιά που τρέχουν σε κύκλους το ένα πίσω από το άλλο.
        o.ph += dt * 1.6;
        const nx = o.cx + Math.cos(o.ph) * o.r, ny = o.cy + Math.sin(o.ph) * o.r * 0.7;
        o.dirX = nx - o.x; o.dirY = ny - o.y;
        o.dist = (o.dist || 0) + Math.hypot(o.dirX, o.dirY);
        o.x = nx; o.y = ny;
      } else if (o.state === 'peck' || o.state === 'graze') {
        o.ph += dt;
        if (o.hx !== undefined) {
          // Λίγα βήματα γύρω από τη θέση τους.
          const w = o.kind === 'sheep' ? 0.12 : 0.35;
          const nx = o.hx + Math.sin(o.ph * w) * (o.kind === 'sheep' ? 26 : 14), ny = o.hy + Math.sin(o.ph * w * 0.7 + 1) * 8;
          o.dirX = nx - o.x; o.dirY = ny - o.y;
          o.x = nx; o.y = ny;
        }
        if (o.kind === 'sparrow' && Math.hypot(o.x - p.x, o.y - p.y) < FAUNA_SCARE_R) for (const q of o.group) if (q.state === 'peck') this.startle(q, p.x, p.y, now);
        if (o.kind === 'hen' && Math.random() < dt * 0.04 && Math.hypot(o.x - p.x, o.y - p.y) < 260) Sound.animal(o.x, o.y, 'hen');
        if (o.kind === 'sheep' && now > o.bleat) { o.bleat = now + 12 + Math.random() * 25; if (Math.hypot(o.x - p.x, o.y - p.y) < 380) Sound.animal(o.x, o.y, 'sheep'); }
      } else if (o.state === 'fly') {
        const k = now - o.t0;
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.kind === 'bat') {
          // Ζιγκ-ζαγκ μέσα στο σκοτάδι, λίγο πιο χαμηλά από το ταβάνι.
          o.x += Math.sin(now * 9 + o.ph) * 40 * dt; o.y += Math.cos(now * 7 + o.ph) * 40 * dt;
          o.z += o.vz * dt + Math.sin(now * 5 + o.ph) * 10 * dt;
          if (k > 3.5) o.state = 'gone';
        } else {
          o.vz += 25 * dt;
          o.z += o.vz * dt;
          if (k > 4) o.state = 'gone';
        }
      } else if (o.state === 'run') {
        const k = now - o.t0;
        const sp = 140 * dt;
        let nx = o.x + Math.cos(o.va) * sp, ny = o.y + Math.sin(o.va) * sp;
        if (Level.isWall(Math.floor(nx / TILE), Math.floor(ny / TILE))) { o.va += Math.PI / 2; nx = o.x; ny = o.y; }
        o.dirX = nx - o.x; o.dirY = ny - o.y;
        o.x = nx; o.y = ny;
        o.ph += dt * 12;
        if (k > 1.6) o.state = 'gone';
      }
    }
    // Σμήνη στον ουρανό (μόνο στο φως της ημέρας, στον πρόλογο).
    if (prologue) {
      const reg = Level.regionAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      const day = reg >= 0 && reg <= 3 && Prologue.mode !== 'bad';
      if (day && now > this._flockAt) {
        this._flockAt = now + 9 + Math.random() * 14;
        const a = Math.random() * Math.PI * 2, n = 3 + Math.floor(Math.random() * 6);
        const sx = p.x - Math.cos(a) * TILE * 18 + (Math.random() - 0.5) * TILE * 8, sy = p.y - Math.sin(a) * TILE * 18 + (Math.random() - 0.5) * TILE * 8;
        const z = 70 + Math.random() * 50;
        for (let k = 0; k < n; k++) {
          this.flocks.push({ x: sx + (Math.random() - 0.5) * 50, y: sy + (Math.random() - 0.5) * 50, z: z + (Math.random() - 0.5) * 20,
            vx: Math.cos(a) * FAUNA_BIRD_SPEED, vy: Math.sin(a) * FAUNA_BIRD_SPEED, ph: Math.random() * 6, life: 0 });
        }
      }
    }
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const b = this.flocks[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += Math.sin(now * 1.3 + b.ph) * 6 * dt;
      b.life += dt;
      if (b.life > 9) this.flocks.splice(i, 1);
    }
  },

  // ---- Μορφές (billboards), από το World3D.draw ----
  sprites(R, now) {
    const S = (name, i) => Sprites.getHD(name, i);
    const prologue = typeof Prologue !== 'undefined' && Prologue.active;
    let D = (fr) => fr;
    if (prologue) {
      const reg = Level.regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      const k = PROLOGUE_DIM[Math.max(0, reg)] || 1;
      D = (fr) => Prologue.dim(fr, k);
    }
    const cl = R.cellLight;
    const camR = -Math.sin(player.angle), camF = Math.cos(player.angle);
    const flipOf = (o) => (o.dirX === undefined ? false : camR * o.dirX + camF * o.dirY < 0);
    for (const o of this.list) {
      if (o.state === 'gone') continue;
      const dx = o.x - player.x, dy = o.y - player.y;
      if (dx * dx + dy * dy > (TILE * 26) ** 2) continue;
      let a = 1;
      if (!prologue) {
        // Στο σκοτάδι: φαίνονται μόνο όσο τα φωτίζει ο ήχος (οι νυχτερίδες που πετάνε, αχνά και από κοντά).
        const c = Math.floor(o.y / TILE) * Level.cols + Math.floor(o.x / TILE);
        a = Math.min(1, (cl[c] || 0) * 1.7);
        if (o.state === 'fly' && Math.hypot(dx, dy) < TILE * 3) a = Math.max(a, 0.3);
        if (a < 0.03) continue;
      }
      let name = o.kind, fr = 0;
      if (o.kind === 'bat') fr = o.state === 'hang' ? 0 : 1 + (Math.floor(now * 14 + o.ph) % 2);
      else if (o.kind === 'sparrow') { if (o.state === 'fly') { name = 'bird'; fr = Math.floor(now * 12 + o.ph) % 2; } else fr = Math.sin(o.ph * 3) > 0.4 ? 1 : 0; }
      else if (o.kind === 'rat') fr = o.state === 'run' ? Math.floor(o.ph) % 2 : 0;
      else if (o.kind === 'hen') fr = Math.sin(o.ph * 2.3) > 0.3 ? 1 : 0;
      else if (o.kind === 'sheep') fr = Math.sin(o.ph * 0.5) > 0.6 ? 1 : 0;
      else if (o.kind === 'dog') fr = Math.floor(now * 5) % 2;
      else if (o.state === 'walk' || o.state === 'play') fr = o.wait > 0 ? 0 : 1 + (Math.floor((o.dist || 0) / 14) % 2);
      R.sprite(D(S(name, fr)), { x: o.x, y: o.y, z: o.z, alpha: a, flip: flipOf(o), fog: !prologue, ent: o });
    }
    for (const b of this.flocks) R.sprite(D(S('bird', Math.floor(now * 10 + b.ph) % 2)), { x: b.x, y: b.y, z: b.z, fog: false });
  },
};
