'use strict';

// Ο κόσμος σε πρώτο πρόσωπο, πέρα από τοίχους και δάπεδο: όλες οι μορφές και τα αντικείμενα
// ως billboards (Raycast.sprite) — pixel sprites που κοιτάνε πάντα την κάμερα, μεγαλώνουν με
// την απόσταση και κρύβονται πίσω από τους τοίχους. Ίδιοι κανόνες με την κάτοψη: ό,τι δεν
// φωτίζεται από μόνο του (βωμός, έξοδος) φαίνεται μόνο όταν το βρει κύμα.

// Μικρά pixel sprites για ό,τι στην κάτοψη ήταν διανυσματικό (παλέτα SPR_PAL).
const OBOL = [
  '..yyy..',
  '.yYYYy.',
  'yYyyyYy',
  'yYyYyYy',
  'yYyyyYy',
  '.yYYYy.',
  '..yyy..',
];
const STRING_COIL = [
  '..111..',
  '.1...1.',
  '1..1..1',
  '1.1.1.1',
  '1..1..1',
  '.1...1.',
  '..111..',
];
// Λήκυθος: χείλος, λαιμός με λαβή, πήλινο σώμα με μαύρη ζώνη.
const LEKYTHOS = [
  '.bbbbb.',
  '..SSS..',
  '..SsSb.',
  '.SSSSb.',
  'SsSSSSS',
  'SSSSSSS',
  'eeeeeee',
  'SSSSSSS',
  'SSSSSSS',
  '.SSSSS.',
  '..SSS..',
  '..bbb..',
];
// Χάλκινος τρίποδας με λεκάνη (ο βωμός), με μαύρα τετράγωνα μαιάνδρου στη ζώνη.
const TRIPOD = [
  'yyyyyyyyyyyyyyy',
  '.YYeYYeYYeYYeY.',
  '..YYYYYYYYYYY..',
  '...YYYYYYYYY...',
  '.....YYYYY.....',
  '......YYY......',
  '.....Y.Y.Y.....',
  '....Y..Y..Y....',
  '...Y...Y...Y...',
  '..Y....Y....Y..',
  '.YY....Y....YY.',
];
const SHARD = ['SS', 'S.'];

const W3D_REVEAL = 2.5;      // πόσο φαίνονται οι ακίνητες μορφές (φίδι, θρόνοι) μετά το κύμα

const World3D = {
  decor: [],          // { kind, x, y, revealTime, revealStrength, onHear }
  flame: null,        // καμβάς με τη φλόγα του βωμού (ξαναζωγραφίζεται κάθε καρέ)
  cerb: null,         // καμβάς με τον Κέρβερο (ξαναζωγραφίζεται όταν φαίνεται)

  init() {
    const F = Sprites.frames;
    F.obol = [Sprites.build(OBOL, '26,12,6')];
    F.stringCoil = [Sprites.build(STRING_COIL, null)];
    F.lekythos = [Sprites.build(LEKYTHOS, '26,12,6')];
    F.tripod = [Sprites.build(TRIPOD, '26,12,6')];
    F.shard = [Sprites.build(SHARD, null)];
    const canvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return { c, f: c, w, h, ctx: c.getContext('2d') };
    };
    this.flame = canvas(28, 50);
    this.cerb = canvas(64, 32);
  },

  // Καλείται σε κάθε spawn.
  reset() {
    this.decor = Level.decor.map((d) => ({
      ...d, revealTime: -1e6, revealStrength: 0,
      onHear(wave, dist, los) {
        if (!los) return;
        this.revealTime = Echoes.now;
        this.revealStrength = Math.max(0.5, Echoes.strengthAt(wave, dist));
      },
    }));
  },

  listeners() {
    return this.decor;
  },

  revealAlpha(o, now, time) {
    const age = now - o.revealTime;
    return age < time ? Math.min(1, 0.35 + o.revealStrength) * (1 - age / time) : 0;
  },

  // Πόσο φαίνεται η έξοδος: πλήρως όταν τη βρει κύμα· μέσα στο τελευταίο κεφάλαιο και λίγο
  // από μόνη της, σαν φάρος στο βάθος, όλο και πιο δυνατά όσο πλησιάζεις.
  exitAlpha(now, p) {
    const revealed = ExitDoor.alpha(now) / EXIT_MAX_ALPHA;
    const ex = Level.exit;
    if (Level.regionAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) !== Level.regionAt(ex.tx, ex.ty)) return revealed;
    const near = Math.max(0, 1 - Math.hypot(p.x - ex.x, p.y - ex.y) / (TILE * 6));
    return Math.max(revealed, 0.3 + near * 0.5);
  },

  // Βάζει όλες τις μορφές στην ουρά του Raycast και τις ζωγραφίζει.
  draw(pc, now, killer, deathAlpha) {
    const S = (name, i) => Sprites.get(name, i);
    const R = Raycast;
    const halfW = R.W / 2;

    // ---- Βωμοί: ο τρίποδας (φαίνεται με κύμα, πάντα όταν καίει) και η φλόγα ----
    let flameDrawn = false;
    for (const a of Altars.list) {
      let stone = 0;
      const age = now - a.revealTime;
      if (age < ALTAR_REVEAL_TIME) stone = Math.min(1, 0.3 + a.revealStrength) * (1 - age / ALTAR_REVEAL_TIME);
      if (a.lit) stone = Math.max(stone, 0.9);
      if (stone > 0.01) R.sprite(S('tripod'), { x: a.x, y: a.y, alpha: stone, scale: 1.2 });
      if (!a.lit) continue;
      if (!flameDrawn) { this.drawFlame(now); flameDrawn = true; }
      const flick = 0.82 + 0.1 * Math.sin(now * 13 + a.x) + 0.08 * Math.sin(now * 5.3 + a.y * 0.3);
      const burst = Math.max(0, 1 - (now - a.litAt) / 1.4);
      R.sprite(this.flame, {
        x: a.x, y: a.y, z: 25, h: 50, add: true, fog: false,
        glow: { r: 46 + burst * 60, color: '255,160,70', a: 0.3 * flick + 0.4 * burst, cy: 0.85 },
      });
    }

    // ---- Αντικείμενα στο έδαφος ----
    for (const it of Items.list) {
      if (it.taken) continue;
      const age = now - it.revealTime;
      if (age >= ITEM_REVEAL_TIME) continue;
      const a = Math.min(1, 0.35 + it.revealStrength) * (1 - age / ITEM_REVEAL_TIME);
      const tw = 0.75 + 0.25 * Math.sin(now * 6 + it.id);
      const bob = Math.sin(now * 2.5 + it.id) * 1.5;
      const color = { obol: POT.light, string: POT.cream, jar: POT.terra }[it.kind];
      const frame = { obol: 'obol', string: 'stringCoil', jar: 'lekythos' }[it.kind];
      R.sprite(S(frame), {
        x: it.x, y: it.y, z: it.kind === 'jar' ? 0 : 5 + bob, alpha: a, scale: it.kind === 'jar' ? 0.9 : 0.8,
        glow: { r: 14, color, a: a * 0.4 * tw },
      });
    }

    // ---- Αγγεία στον αέρα και θραύσματα ----
    for (const it of Jars.items) {
      if (it.brokenAt < 0) {
        // Τα πρώτα εκατοστά της πτήσης δεν φαίνεται (θα γέμιζε την οθόνη, μέσα στο χέρι σου).
        const p = R.project(it.x, it.y);
        if (!p || p.depth < 0.7) continue;
        const z = 2 + 12 * Math.min(1, Math.hypot(it.vx, it.vy) / JAR_SPEED);
        R.sprite(S('lekythos'), { x: it.x, y: it.y, z, scale: 0.45 });
        continue;
      }
      const t = (now - it.brokenAt) / JAR_SHARDS_TIME;
      const spread = 1 - Math.pow(1 - Math.min(1, t * 2.5), 3);
      for (const s of it.shards) {
        R.sprite(S('shard'), {
          x: it.x + Math.cos(s.ang) * s.sp * spread * 0.4,
          y: it.y + Math.sin(s.ang) * s.sp * spread * 0.4,
          z: Math.max(0, 10 * (1 - t * 3)) + Math.sin(s.rot) * 1.5, alpha: 1 - t, scale: 0.8,
        });
      }
    }

    // ---- Σκιές και Ερινύες ----
    for (const m of monsters) {
      if (m === killer && deathAlpha !== undefined) {
        this.monster(m, now, m.x, m.y, deathAlpha, Math.floor(now * 5), false);
      } else if (m.isFrozen()) {
        // Παγωμένη από τη Μελωδία: χλωμή, ήρεμη ψυχή στη θέση της.
        const left = m.frozenUntil - now;
        const a = Math.min(1, left / 1.2) * (0.55 + 0.1 * Math.sin(now * 3));
        R.sprite(S('soul', Math.floor(now * 2)), {
          x: m.x, y: m.y, z: 6, alpha: a, scale: 1.4,
          glow: { r: 30, color: POT.cream, a: a * 0.3 },
        });
      } else {
        const a = m.revealAlpha(now);
        if (a > 0.01) this.monster(m, now, m.revealX, m.revealY, a, Math.floor(m.revealSeed), true);
      }
    }

    // ---- Η Ευρυδίκη (VIII): χλωμό φάσμα πάνω στη διαδρομή σου ----
    const e = Eurydice;
    if (e.state === 'following' || e.state === 'lost') {
      let a = 0, rise = 0;
      if (e.state === 'following') a = 0.74 + 0.08 * Math.sin(now * 2.3);
      else {
        const t = (now - e.lostAt) / EURY_VANISH;
        if (t >= 0 && t < 1) { a = 0.78 * (1 - t); rise = t * 14; }
      }
      if (a > 0.01) {
        R.sprite(S('eurydice', e.moving ? Math.floor(e.walked / 12) : 1), {
          x: e.x, y: e.y, z: rise, alpha: a, fog: false,
          glow: { r: 30, color: POT.cream, a: a * 0.3 },
        });
      }
    }

    // ---- Ο Χάροντας στη βάρκα του ----
    if (Charon.gate >= 0) {
      const age = now - Charon.revealTime;
      let a = age < CHARON_REVEAL_TIME ? Math.min(1, 0.35 + Charon.revealStrength) * (1 - age / CHARON_REVEAL_TIME) : 0;
      const leave = Charon.paid ? Math.min(1, (now - Charon.paidAt) / 2.5) : 0;
      if (Charon.paid) a = Math.max(a * (1 - leave), (1 - leave) * 0.6);
      if (a > 0.01) {
        const p = R.project(Charon.x, Charon.y);
        const flip = p ? p.sx > halfW : false;
        // Μετά την πληρωμή, η βάρκα απομακρύνεται στο ποτάμι.
        const y = Charon.y + leave * TILE * 0.8;
        R.sprite(S('boat'), { x: Charon.x, y, alpha: a, flip, scale: 0.65 });
        R.sprite(S('charon', Charon.paid ? 0 : 1), { x: Charon.x, y, z: 4, alpha: a, flip, scale: 0.85, bias: 0.01 });
      }
    }

    // ---- Χαμένες ψυχές: μικρά φωτεινά πνεύματα (τα λόγια τους: overlay, σε πλήρη ανάλυση) ----
    for (const s of Souls.list) {
      s._scr = null;
      const a = Souls.alpha(s, now);
      if (a < 0.01) continue;
      const bob = Math.sin(now * 2 + s.n) * 2;
      R.sprite(S('soul', Math.floor(now * 2 + s.n)), {
        x: s.x, y: s.y, z: 12 + bob, alpha: a * 0.9, fog: false,
        glow: { r: 24, color: POT.cream, a: a * 0.3 },
        after: (pc, b) => { s._scr = R.visible(b.sx, b.depth) ? { x: b.sx, y: b.top, a } : null; },
      });
    }

    // ---- Easter eggs ----
    const st = Eggs.stuck;
    if (st) {
      const a = Eggs.alpha(st, now);
      if (a > 0.01) {
        const p = R.project(st.x, st.y);
        R.sprite(S('shade', Math.floor(now * 4)), { x: st.x, y: st.y, alpha: a * 0.9, flip: p ? p.sx > halfW : false });
      }
    }
    const cb = Eggs.cerberus;
    if (cb) {
      const barkT = now - cb.barkStart;
      const barking = [0, 1, 2].map((i) => barkT >= i * CERB_BARK_GAP && barkT < i * CERB_BARK_GAP + CERB_BARK_TIME);
      const a = Math.max(Eggs.alpha(cb, now), barking.some(Boolean) ? 1 : 0);
      if (a > 0.01) {
        const c = this.cerb;
        c.ctx.setTransform(1, 0, 0, 1, 0, 0);
        c.ctx.clearRect(0, 0, c.w, c.h);
        Pottery.cerberus(c.ctx, c.w / 2 + 3, c.h - 1, 46, 1, barking, 0.5 + 0.5 * Math.sin(now * 1.6));
        R.sprite(c, { x: cb.x, y: cb.y, h: 44, alpha: a });
      }
    }

    // ---- Ακίνητες μορφές: το φίδι (I), ο Άδης και η Περσεφόνη στους θρόνους (VII) ----
    for (const d of this.decor) {
      const a = this.revealAlpha(d, now, W3D_REVEAL);
      if (a < 0.01) continue;
      if (d.kind === 'snake') {
        // Σηκώνει το κεφάλι και σφυρίζει όταν το βρει ο ήχος.
        const hiss = now - d.revealTime < 1.4 ? 1 : 0;
        R.sprite(S('grass'), { x: d.x, y: d.y - 2, alpha: a * 0.8 });
        R.sprite(S('snake', hiss), { x: d.x, y: d.y, alpha: a, flip: true, bias: 0.01 });
      } else if (d.kind === 'hades') {
        R.sprite(S('hades'), { x: d.x, y: d.y, alpha: a, scale: 1.25 });
        R.sprite(S('hound'), { x: d.x - 8, y: d.y - 26, alpha: a });   // δίπλα στον θρόνο, από την άλλη μεριά της Περσεφόνης
      } else {
        R.sprite(S('persephone', 1), { x: d.x, y: d.y, alpha: a, scale: 1.25 });
      }
    }

    // ---- Η έξοδος: λάμψη ημέρας μπροστά στο άνοιγμα ----
    if (R.exitA > 0.01 && R.exitDir) {
      const [ix, iy] = R.exitDir;
      R.sprite(null, {
        x: Level.exit.x - ix * TILE * 0.35, y: Level.exit.y - iy * TILE * 0.35, h: 30, z: 4, fog: false,
        glow: { r: 46, color: '255,226,170', a: 0.3 * R.exitA },
      });
    }

    R.flushSprites(pc);

    // ---- Η Μελωδία: χρυσή λάμψη σε όλη την οθόνη (δεν είναι κύμα ήχου) ----
    for (const r of Melody.rings) {
      const t = (now - r.t) / MELODY_RING_TIME;
      if (t < 0 || t >= 1) continue;
      pc.save();
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalCompositeOperation = 'lighter';
      const W = R.W, H = R.H, rr = Math.max(W, H) * (0.2 + t);
      const g = pc.createRadialGradient(W / 2, H * 0.6, rr * 0.6, W / 2, H * 0.6, rr);
      g.addColorStop(0, `rgba(${POT.light},0)`);
      g.addColorStop(0.8, `rgba(${POT.light},${(0.25 * (1 - t)).toFixed(3)})`);
      g.addColorStop(1, `rgba(${POT.light},0)`);
      pc.fillStyle = g;
      pc.fillRect(0, 0, W, H);
      pc.restore();
    }
  },

  // Μια σκιά/Ερινύα: κόκκινη λάμψη, λευκά (ή κίτρινα) μάτια που λάμπουν, και πάνω από το
  // κεφάλι τι κάνει ((•) = κυνηγάει, ? = ψάχνει).
  monster(m, now, x, y, a, frame, icon) {
    const R = Raycast;
    const p = R.project(x, y);
    if (!p) return;
    const flip = p.sx > R.W / 2;   // κοιτάζει προς τα εσένα
    const erinys = m.kind === 'erinys';
    const fr = Sprites.get(m.kind, frame);
    const hover = m.fly ? 10 + Math.sin(now * 4 + m.homeTx) * 3 : 0;
    const [eyeX, eyeY, eyeColor] = erinys ? [fr.w / 2, 5.5, '255,210,90'] : [9.5, 3.5, '255,250,235'];
    R.sprite(fr, {
      x, y, z: hover, alpha: a, flip, fog: false,
      glow: { r: 30, color: POT.red, a: a * 0.5 },
      after: (pc, b) => {
        const s = b.h / fr.h;   // art px ανά pixel του sprite
        const ex = b.left + (flip ? fr.w - eyeX : eyeX) * s, ey = b.top + eyeY * s;
        if (!R.visible(ex, b.depth)) return;
        pc.globalCompositeOperation = 'lighter';
        const r = Math.max(2, s * 2.2);
        const g = pc.createRadialGradient(ex, ey, 0, ex, ey, r);
        g.addColorStop(0, `rgba(${eyeColor},${(a * 0.55).toFixed(3)})`);
        g.addColorStop(1, `rgba(${eyeColor},0)`);
        pc.fillStyle = g;
        pc.fillRect(ex - r, ey - r, r * 2, r * 2);
        pc.globalCompositeOperation = 'source-over';
        if (icon && m.revealState !== 'wander') {
          const name = m.revealState === 'hunt' ? 'iconHear' : 'iconSearch';
          const blink = 0.65 + 0.35 * Math.sin(now * 10);
          Sprites.blit(pc, name, 0, b.sx, b.top - 2, { alpha: a * blink, scale: Math.max(1, Math.min(3, Math.round(s * 0.6))) });
        }
      },
    });
  },

  // Η φλόγα του βωμού στον δικό της μικρό καμβά (ίδια με της κάτοψης).
  drawFlame(now) {
    const f = this.flame;
    const c = f.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, f.w, f.h);
    const flick = 0.82 + 0.1 * Math.sin(now * 13) + 0.08 * Math.sin(now * 5.3);
    Altars.drawFlame(c, f.w / 2, f.h - 4, now, flick, 0);
  },

  // Από πάνω, σε πλήρη ανάλυση (για να διαβάζονται): τα λόγια των ψυχών, πάνω από το πνεύμα.
  // ctx σε CSS pixels· k = CSS px ανά art pixel.
  overlay(ctx, now, k) {
    const font = 13;
    ctx.font = `italic ${font}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = Math.min(250, cssW - 32);
    for (const s of Souls.list) {
      if (!s._scr) continue;
      if (!s.lines3d || s.linesW !== maxW) {
        // Σπάει σε γραμμές που χωράνε στην οθόνη.
        const words = STORY.souls[s.n - 1].split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = w; } else line = test;
        }
        if (line) lines.push(line);
        s.lines3d = lines;
        s.linesW = maxW;
      }
      const lh = font * 1.35, a = s._scr.a;
      const x = Math.max(maxW / 2 + 12, Math.min(cssW - maxW / 2 - 12, s._scr.x * k));
      const bottom = Math.max(70 + s.lines3d.length * lh, s._scr.y * k - 10);
      const top = bottom - (s.lines3d.length - 1) * lh;
      ctx.fillStyle = `rgba(0,0,0,${(a * 0.7).toFixed(3)})`;
      ctx.fillRect(x - maxW / 2 - 6, top - lh / 2 - 4, maxW + 12, s.lines3d.length * lh + 8);
      ctx.fillStyle = `rgba(${POT.cream},${(a * 0.88).toFixed(3)})`;
      s.lines3d.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
    }
  },
};
