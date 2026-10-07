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
    this.buildScenery();
    this.cerb = canvas(64, 32);
  },

  // Καλείται σε κάθε spawn.
  reset() {
    this.sparks = [];
    this.drips = [];
    this.ripples = [];
    this.decor = Level.decor.map((d) => ({
      ...d, revealTime: -1e6, revealStrength: 0,
      onHear(wave, dist, los) {
        if (!los) return;
        // Το φίδι σφυρίζει όταν το βρει ο ήχος (το πολύ κάθε 3 δευτ.).
        if (this.kind === 'snake' && Echoes.now - this.revealTime > 3) Sound.hiss(this.x, this.y);
        // Ο Άδης και η Περσεφόνη μιλάνε από τους θρόνους τους (STORY.md, ενότητα 8).
        if ((this.kind === 'hades' || this.kind === 'persephone') && typeof state !== 'undefined' && state === 'play' &&
            Echoes.now - (this.spokeAt || -1e6) > 25) {
          this.spokeAt = Echoes.now;
          const hades = this.kind === 'hades';
          const line = hades ? STORY.hadesHall : STORY.persephoneHall;
          const delay = hades ? 0.4 : 4.2;
          const d = Voice.say(line, hades ? 'hades' : 'persephone', { x: this.x, y: this.y, delay });
          setTimeout(() => { if (typeof state !== 'undefined' && state === 'play') Notice.show(line, gameTime, d + 1, null, hades ? 'charon' : 'whisper'); }, delay * 1000);
        }
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
    // Όλες οι μορφές σε διπλή ανάλυση με σκίαση (Sprites.getHD).
    const S = (name, i) => Sprites.getHD(name, i);
    const R = Raycast;
    const halfW = R.W / 2;

    // ---- Βωμοί: ο τρίποδας (φαίνεται με κύμα, πάντα όταν καίει) και η φλόγα ----
    let flameDrawn = false;
    for (const a of Altars.list) {
      let stone = 0;
      const age = now - a.revealTime;
      if (age < ALTAR_REVEAL_TIME) stone = Math.min(1, 0.3 + a.revealStrength) * (1 - age / ALTAR_REVEAL_TIME);
      if (a.lit) stone = Math.max(stone, 0.9);
      if (stone > 0.01) R.sprite(S('tripod'), { x: a.x, y: a.y, alpha: stone, scale: 0.6 });
      if (!a.lit) continue;
      if (!flameDrawn) { this.drawFlame(now); flameDrawn = true; }
      const flick = 0.82 + 0.1 * Math.sin(now * 13 + a.x) + 0.08 * Math.sin(now * 5.3 + a.y * 0.3);
      const burst = Math.max(0, 1 - (now - a.litAt) / 1.4);
      R.sprite(this.flame, {
        x: a.x, y: a.y, z: 12, h: 22, add: true, fog: false,
        glow: { r: 26 + burst * 40, color: '255,160,70', a: 0.3 * flick + 0.4 * burst, cy: 0.85 },
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
      const color = { obol: POT.light, string: POT.cream, jar: POT.terra, tablet: POT.light }[it.kind];
      const frame = { obol: 'obol', string: 'stringCoil', jar: 'lekythos', tablet: 'tablet' }[it.kind];
      R.sprite(S(frame), {
        x: it.x, y: it.y, z: it.kind === 'jar' || it.kind === 'tablet' ? 0 : 5 + bob, alpha: a, scale: it.kind === 'jar' ? 0.9 : it.kind === 'tablet' ? 0.55 : 0.8,
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
        const look = { jar: ['lekythos', 0.45], pebble: ['rocks', 0.18], cake: ['cake', 0.5], bell: ['bell', 0.5] }[it.kind || 'jar'];
        R.sprite(S(look[0]), { x: it.x, y: it.y, z, scale: look[1] });
        continue;
      }
      // Η μελόπιτα / το κουδούνι μένουν στο έδαφος (το κουδούνι λάμπει όταν χτυπάει).
      if (it.kind === 'cake' || it.kind === 'bell') {
        const ring = it.rangAt ? Math.max(0, 1 - (now - it.rangAt) / 1.5) : 0;
        R.sprite(S(it.kind), { x: it.x, y: it.y, z: ring * 3 * Math.sin(now * 40), scale: 0.5, alpha: Math.min(1, 0.35 + Raycast.cellLight[Math.floor(it.y / TILE) * Level.cols + Math.floor(it.x / TILE)] + ring),
          glow: ring ? { r: 30, color: '255,200,120', a: ring * 0.6 } : undefined });
        continue;
      }
      if (it.kind === 'pebble') continue;
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

    // ---- Η πέτρα του Σίσυφου (πάντα λίγο ορατή: τη φωτίζει ο θόρυβός της) και τα κάγκελα της Πύλης ----
    if (Boulder.active) R.sprite(S('boulder', Math.floor(Boulder.roll) % 2), { x: Boulder.x, y: Boulder.y, scale: 0.85, fog: false });
    if (!Level.barsOpen) {
      for (const b of Level.bars) {
        const a = Math.max(0.25, Math.min(1, (Raycast.cellLight[b.ty * Level.cols + b.tx] || 0) * 1.5));
        R.sprite(S('bars'), { x: b.x, y: b.y - TILE * 0.45, alpha: a, scale: 0.55 });
      }
    }

    // ---- Κιβώτια και κρυψώνες: φαίνονται όσο τα φωτίζει ο ήχος (ή το φως του κελιού) ----
    const cellLit = (x, y) => Raycast.cellLight[Math.floor(y / TILE) * Level.cols + Math.floor(x / TILE)] || 0;
    for (const c of Chests.list) {
      const age = now - c.revealTime;
      const a = Math.max(age < 3 ? Math.min(1, 0.3 + c.revealStrength) * (1 - age / 3) : 0, Math.min(1, cellLit(c.x, c.y) * 1.4));
      if (a > 0.02) R.sprite(S('chest', c.opened ? 1 : 0), { x: c.x, y: c.y, alpha: a, scale: 0.55,
        glow: c.map && !c.opened ? { r: 16, color: '236,218,186', a: a * 0.35 } : undefined });
    }
    for (const h of Hides.list) {
      const age = now - h.revealTime;
      const a = Math.max(age < 3 ? Math.min(1, 0.3 + h.revealStrength) * (1 - age / 3) : 0, Math.min(1, cellLit(h.x, h.y) * 1.4));
      if (a > 0.02 && Hides.active !== h) R.sprite(S('niche'), { x: h.x + h.wx * TILE * 0.38, y: h.y + h.wy * TILE * 0.38, alpha: a, scale: 0.75 });
    }

    // ---- Σκιές και Ερινύες ----
    for (const m of monsters) {
      if (m === killer && deathAlpha !== undefined) {
        this.monster(m, now, m.x, m.y, deathAlpha, Math.floor(now * 5), false);
      } else if (m.isFrozen() && m.kind !== 'cerberus') {
        // Παγωμένη από τη Μελωδία: χλωμή, ήρεμη ψυχή στη θέση της.
        const left = m.frozenUntil - now;
        const a = Math.min(1, left / 1.2) * (0.55 + 0.1 * Math.sin(now * 3));
        R.sprite(S('soulM3d', Math.floor(now * 2)), {
          x: m.x, y: m.y, z: 6, alpha: a, scale: 0.53,
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
        R.sprite(S('eurydice3d', e.moving ? Math.floor(e.walked / 12) : 0), {
          x: e.x, y: e.y, z: rise, alpha: a, fog: false, scale: 0.39,
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
        R.sprite(S('boat3d'), { x: Charon.x, y, alpha: a, flip, scale: 0.35 });
        R.sprite(S('charon3d', Charon.paid ? 0 : 1), { x: Charon.x, y, z: 4, alpha: a, flip, scale: 0.37, bias: 0.01 });
      }
    }

    // ---- Χαμένες ψυχές: μικρά φωτεινά πνεύματα (τα λόγια τους: overlay, σε πλήρη ανάλυση) ----
    for (const s of Souls.list) {
      s._scr = null;
      const a = Souls.alpha(s, now);
      if (a < 0.01) continue;
      const bob = Math.sin(now * 2 + s.n) * 2;
      const look = { soulM: 'soulM3d', soulF: 'soulF3d', soulOld: 'soulOld3d' }[SOUL_VOICES[s.n - 1]] || 'soulM3d';
      R.sprite(S(look, Math.floor(now * 2 + s.n)), {
        x: s.x, y: s.y, z: 8 + bob, alpha: a * 0.9, fog: false, scale: 0.43,
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
        R.sprite(S('ghoul', Math.floor(now * 4)), { x: st.x, y: st.y, alpha: a * 0.9, flip: p ? p.sx > halfW : false, scale: 0.5 });
      }
    }
    const cb = Eggs.cerberus;
    if (cb) {
      const barkT = now - cb.barkStart;
      const barking = [0, 1, 2].map((i) => barkT >= i * CERB_BARK_GAP && barkT < i * CERB_BARK_GAP + CERB_BARK_TIME);
      const a = Math.max(Eggs.alpha(cb, now), barking.some(Boolean) ? 1 : 0);
      if (a > 0.01) {
        // Pixel sprite (διπλή ανάλυση): γαβγίζει όποιο κεφάλι γαβγίζει, αλλιώς αναπνέει στον ύπνο.
        const fr = Sprites.cerberusHD(barking, Math.sin(now * 1.6) > 0 ? 1 : 0);
        R.sprite(fr, { x: cb.x, y: cb.y, alpha: a, scale: 0.85 });
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
        R.sprite(S('snake3d', hiss), { x: d.x, y: d.y, alpha: a, flip: true, bias: 0.01, scale: 0.36 });
      } else if (d.kind === 'hades') {
        R.sprite(S('hades3d'), { x: d.x, y: d.y, alpha: a, scale: 0.44 });
        R.sprite(Sprites.cerberusHD([false, false, false], Math.sin(now * 1.6) > 0 ? 1 : 0), { x: d.x - 8, y: d.y - 26, alpha: a, scale: 0.3 });   // δίπλα στον θρόνο, από την άλλη μεριά της Περσεφόνης
      } else {
        R.sprite(S('persephone3d', typeof Throne !== 'undefined' && Throne.lean ? 1 : 0), { x: d.x, y: d.y, alpha: a, scale: 0.44 });
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

    // ---- Διακοσμητικά: φαίνονται όσο φωτίζεται το κελί τους (κύμα, βωμός, φως της ημέρας) ----
    const cl = R.cellLight;
    for (const d of this.scenery) {
      const dx = d.x - R.posX * TILE, dy = d.y - R.posY * TILE;
      if (dx * dx + dy * dy > 520 * 520) continue;
      const a = Math.min(1, cl[d.c] * 1.7);
      if (a < 0.03) continue;
      // Πολύ κοντά στην κάμερα (π.χ. στο κελί που στέκεσαι) δεν ζωγραφίζεται: θα γέμιζε την οθόνη.
      const pd = (dx * R.dirX + dy * R.dirY) / TILE;
      if (pd < 0.55) continue;
      R.sprite(S(d.name), { x: d.x, y: d.y, z: d.z, scale: d.scale, alpha: a, flip: d.flip });
    }

    // Πού είναι στην οθόνη οι πηγές φωτός (για τις ακτίνες φωτός του bloom): οι φλόγες των βωμών
    // και το φως της εξόδου, όσες φαίνονται (όχι πίσω από τοίχο).
    this.lights.length = 0;
    for (const a of Altars.list) {
      if (!a.lit) continue;
      const p = R.project(a.x, a.y);
      if (!p || p.depth > 9 || !R.visible(p.sx, p.depth - 0.2)) continue;
      const y = R.horizon + (R.focal * (RC_EYE - 34 / TILE)) / p.depth;
      this.lights.push({ x: p.sx, y, a: Math.min(1, 1.4 / p.depth) });
    }
    if (R.exitA > 0.2 && R.exitDir) {
      const [ix, iy] = R.exitDir;
      const p = R.project(Level.exit.x - ix * TILE * 0.45, Level.exit.y - iy * TILE * 0.45);
      if (p && R.visible(p.sx, p.depth - 0.3)) this.lights.push({ x: p.sx, y: R.horizon, a: R.exitA * 0.9 });
    }

    if (typeof Prologue !== 'undefined' && Prologue.active) Prologue.sprites(R, now);
    if (typeof Crossing !== 'undefined') Crossing.sprites(R, now);
    R.flushSprites(pc);
    this.drawSparks(pc, now);
    this.drawDrips(pc, now);
    this.drawMotes(pc, now);

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
    if (m.kind === 'cerberus') {
      // Ο Κέρβερος: τα κεφάλια που κοιμούνται δεν γαβγίζουν· όταν κυνηγάει, γαβγίζουν με τη σειρά.
      const hunting = m.state === 'hunt' && !m.isFrozen();
      const k = Math.floor(now * 3) % 3;
      const barking = [0, 1, 2].map((i) => hunting && i >= m.asleep && i === k);
      R.sprite(Sprites.cerberusHD(barking, Math.sin(now * 1.6) > 0 ? 1 : 0), { x, y, alpha: m.asleep >= 3 ? Math.max(a, 0.5) : a, flip: p.sx > R.W / 2, fog: false, scale: 0.62,
        glow: { r: 40, color: POT.red, a: a * 0.45 } });
      return;
    }
    const flip = p.sx > R.W / 2;   // κοιτάζει προς τα εσένα
    const erinys = m.kind === 'erinys';
    // Στο 3D η σκιά είναι η λεπτομερής μορφή "ghoul" (μισό μέγεθος στον κόσμο: είναι 2× πιο λεπτομερής).
    const ghoul = m.kind === 'shade';
    const fr = Sprites.getHD(ghoul ? 'ghoul' : erinys ? 'erinys3d' : m.kind, frame);
    const hover = m.fly ? 10 + Math.sin(now * 4 + m.homeTx) * 3 : 0;
    // Θέση των ματιών σε pixels του (HD) καρέ.
    const [eyeX, eyeY, eyeColor] = erinys ? [fr.w / 2, 18, '255,210,90'] : [45, 15, '255,250,235'];
    R.sprite(fr, {
      x, y, z: hover, alpha: a, flip, fog: false, scale: ghoul ? 0.5 : erinys ? 0.48 : 1,
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

  // ---- Διακοσμητικά (σταθερά, μία φορά στο init) ----
  // Ανά περιοχή: σπηλιές = σταλαγμίτες/σταλακτίτες, πέτρες, λίγα κόκαλα (Στύγα/Αχέροντας: καλάμια
  // στην όχθη· Ταίναρο/Άνοδος: ρίζες από τον κόσμο των ζωντανών)· Ασφόδελος = ασφόδελοι, σπασμένοι
  // αμφορείς, κόκαλα· Τάρταρος = αλυσίδες, σωροί κρανίων, κόκαλα· παλάτι = αγάλματα, αμφορείς.
  // Ποτέ εκεί που υπάρχει κάτι του παιχνιδιού (βωμοί, αντικείμενα, ψυχές, πύλες, έξοδος, easter eggs).
  scenery: [],
  buildScenery() {
    // Ο πρόλογος έχει τα δικά του (js/prologue.js).
    if (typeof Prologue !== 'undefined' && Prologue.active) { this.scenery = []; return; }
    const L = Level, cols = L.cols;
    const hash = (a, b, k) => { const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
    const busy = new Uint8Array(cols * L.rows);
    const mark = (x, y, r) => {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      for (let yy = ty - r; yy <= ty + r; yy++) for (let xx = tx - r; xx <= tx + r; xx++) {
        if (xx >= 0 && yy >= 0 && xx < cols && yy < L.rows) busy[yy * cols + xx] = 1;
      }
    };
    L.altars.forEach((a) => mark(a.x, a.y, 1));
    L.items.forEach((it) => mark(it.x, it.y, 0));
    L.souls.forEach((s) => mark(s.x, s.y, 0));
    L.decor.forEach((d) => mark(d.x, d.y, 1));
    L.gates.forEach((g) => mark(g.x, g.y, 1));
    mark(L.exit.x, L.exit.y, 2);
    mark(L.start.x, L.start.y, 1);
    if (L.eggs.stuck) mark(L.eggs.stuck.x, L.eggs.stuck.y, 2);
    if (L.eggs.cerberus) mark(L.eggs.cerberus.x, L.eggs.cerberus.y, 2);

    const out = [];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const SPX = RC_SPX;
    const put = (name, tx, ty, ox, oy, scale, hang, c) => {
      // Κρεμαστά (σταλακτίτες, ρίζες, αλυσίδες): από το ταβάνι στα στενά περάσματα· αλλού κρέμονται
      // από το σκοτάδι, πιο ψηλά και πιο μεγάλα (το ταβάνι δεν φαίνεται).
      const open = hang && !Raycast.ceilOn[c];
      if (open) scale *= 1.35;
      const fr = Sprites.frames[name][0];
      const h = fr.h * SPX * scale;
      out.push({
        name, c, scale, flip: hash(tx, ty, 9) > 0.5,
        x: (tx + 0.5 + ox) * TILE, y: (ty + 0.5 + oy) * TILE,
        z: hang ? (open ? Math.max(TILE * 1.5, TILE * (2.6 + hash(tx, ty, 11) * 0.9) - h) : Math.max(0, TILE - h)) : 0,
      });
    };
    for (let ty = 0; ty < L.rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const c = ty * cols + tx;
        if (busy[c] || L.terrain[c] !== T_FLOOR || L.grid[c] !== 0) continue;
        const r = L.region[c];
        if (r < 0) continue;
        const wall = dirs.filter(([dx, dy]) => L.isOpaque(tx + dx, ty + dy));
        const water = dirs.filter(([dx, dy]) => L.terrainAt(tx + dx, ty + dy) === T_WATER);
        const h1 = hash(tx, ty, 1), h2 = hash(tx, ty, 2), h3 = hash(tx, ty, 3);
        const jx = (hash(tx, ty, 4) - 0.5) * 0.5, jy = (hash(tx, ty, 5) - 0.5) * 0.5;
        const sc = 0.85 + hash(tx, ty, 6) * 0.45;
        const toWall = wall.length ? wall[Math.floor(h3 * wall.length)] : null;
        const wx = toWall ? toWall[0] * 0.3 : jx, wy = toWall ? toWall[1] * 0.3 : jy;
        const ch = CHAPTERS[r] || {};
        const fire = RC_THEMES[r] === 'fire';
        if (ch.decor === 'cave') {
          if (!fire && water.length && ch.reeds && h1 < 0.4) {
            const w = water[0];
            put('reeds', tx, ty, w[0] * 0.3, w[1] * 0.3, sc, false, c);
          } else if (toWall && h1 < 0.17) put('stalagmite', tx, ty, wx, wy, sc, false, c);
          else if (h1 < 0.23) put('rocks', tx, ty, jx, jy, sc * 0.9, false, c);
          else if (r !== 0 && h1 < 0.255) put('bones', tx, ty, jx, jy, 0.9, false, c);
          else if (r !== 0 && h1 < 0.27) put('skull', tx, ty, jx, jy, 0.55, false, c);
          // Από πάνω: ρίζες κοντά στην επιφάνεια (Ταίναρο, Άνοδος), αλλού σταλακτίτες (όχι πάνω από τη φωτιά).
          if (ch.roots && h2 < 0.13) put('roots', tx, ty, jx, jy, sc, true, c);
          else if (!fire && h2 < 0.15) put('stalactite', tx, ty, (hash(tx, ty, 7) - 0.5) * 0.6, (hash(tx, ty, 8) - 0.5) * 0.6, sc, true, c);
        } else if (ch.decor === 'mourning') {
          // Οι Αγροί του Πένθους: ασφόδελοι, σπασμένα αγγεία, αγάλματα στους τοίχους — ήσυχα.
          if (h1 < 0.2) put('asphodel', tx, ty, jx, jy, sc * 0.75, false, c);
          else if (toWall && h1 < 0.25) put('statue', tx, ty, wx * 1.1, wy * 1.1, 1, false, c);
          else if (toWall && h1 < 0.3) put('amphoraBroken', tx, ty, wx, wy, 0.85, false, c);
        } else if (ch.decor === 'asphodel') {
          if (h1 < 0.33) put('asphodel', tx, ty, jx, jy, sc * 0.8, false, c);
          else if (toWall && h1 < 0.39) put('amphoraBroken', tx, ty, wx, wy, 0.9, false, c);
          else if (h1 < 0.43) put('bones', tx, ty, jx, jy, 0.9, false, c);
          else if (h1 < 0.45) put('skull', tx, ty, jx, jy, 0.55, false, c);
        } else if (ch.decor === 'tartarus') {
          if (toWall && h1 < 0.06) put('skullpile', tx, ty, wx, wy, 0.9, false, c);
          else if (h1 < 0.14) put('bones', tx, ty, jx, jy, 0.9, false, c);
          else if (h1 < 0.19) put('skull', tx, ty, jx, jy, 0.55, false, c);
          else if (h1 < 0.23) put('rocks', tx, ty, jx, jy, sc * 0.9, false, c);
          if (h2 < 0.12) put('chain', tx, ty, jx, jy, 0.5 + hash(tx, ty, 10) * 0.12, true, c);
        } else if (ch.decor === 'palace') {
          if (toWall && h1 < 0.07) put('statue', tx, ty, wx * 1.1, wy * 1.1, 1.05, false, c);
          else if (toWall && h1 < 0.15) put('amphora', tx, ty, wx, wy, 0.85, false, c);
          else if (toWall && h1 < 0.17) put('amphoraBroken', tx, ty, wx, wy, 0.85, false, c);
        }
      }
    }
    this.scenery = out;
  },

  // ---- Σταγόνες: πέφτουν από το ταβάνι των σπηλιών κοντά σου· "πλιπ" στο νερό, με κυματάκι ----
  drips: [],
  ripples: [],
  _dripAt: 0,
  updateDrips(dt, now, p) {
    const L = Level;
    const region = L.regionAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (region >= 0 && RC_THEMES[region] === 'rock' && now >= this._dripAt) {
      this._dripAt = now + 0.9 + Math.random() * 2.4;
      for (let k = 0; k < 6; k++) {
        const tx = Math.floor(p.x / TILE) + Math.round((Math.random() - 0.5) * 12);
        const ty = Math.floor(p.y / TILE) + Math.round((Math.random() - 0.5) * 12);
        const t = L.terrainAt(tx, ty);
        if (L.isOpaque(tx, ty) || t === T_CHASM) continue;
        this.drips.push({ x: (tx + 0.2 + Math.random() * 0.6) * TILE, y: (ty + 0.2 + Math.random() * 0.6) * TILE, z: (Raycast.ceilOn[ty * L.cols + tx] ? TILE : TILE * 2.4) - 2, vz: 0, c: ty * L.cols + tx, water: t === T_WATER });
        break;
      }
    }
    for (let k = this.drips.length - 1; k >= 0; k--) {
      const d = this.drips[k];
      d.vz -= 420 * dt;
      d.z += d.vz * dt;
      if (d.z > 0) continue;
      this.drips.splice(k, 1);
      Sound.drip(d.x, d.y, d.water);
      if (d.water) this.ripples.push({ x: d.x, y: d.y, t: now, c: d.c });
    }
    for (let k = this.ripples.length - 1; k >= 0; k--) if (now - this.ripples[k].t > 1.1) this.ripples.splice(k, 1);
  },

  drawDrips(pc, now) {
    const R = Raycast, cl = R.cellLight;
    if (this.drips.length === 0 && this.ripples.length === 0) return;
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalCompositeOperation = 'lighter';
    for (const d of this.drips) {
      const a = Math.min(1, cl[d.c] * 2);
      if (a < 0.05) continue;
      const p = R.project(d.x, d.y);
      if (!p || !R.visible(p.sx, p.depth)) continue;
      const y = R.horizon + (R.focal * (RC_EYE - d.z / TILE)) / p.depth;
      pc.fillStyle = 'rgba(236,218,186,' + (a * 0.9).toFixed(3) + ')';
      pc.fillRect(Math.round(p.sx), Math.round(y), 1, p.depth < 2 ? 3 : 2);
    }
    // Κυματάκι στο νερό: ένας κύκλος στο επίπεδο του δαπέδου που ανοίγει και σβήνει.
    pc.lineWidth = 1;
    for (const r of this.ripples) {
      const t = (now - r.t) / 1.1;
      const a = Math.min(1, cl[r.c] * 2 + 0.05) * (1 - t);
      if (a < 0.04) continue;
      const rad = 2 + t * 12;
      pc.strokeStyle = 'rgba(236,218,186,' + (a * 0.8).toFixed(3) + ')';
      pc.beginPath();
      let pen = false;
      for (let k = 0; k <= 14; k++) {
        const ang = (k / 14) * Math.PI * 2;
        const p = R.project(r.x + Math.cos(ang) * rad, r.y + Math.sin(ang) * rad);
        if (!p) { pen = false; continue; }
        const y = R.horizon + (R.focal * RC_EYE) / p.depth;
        if (!pen) { pc.moveTo(p.sx, y); pen = true; } else pc.lineTo(p.sx, y);
      }
      pc.stroke();
    }
    pc.restore();
  },

  // Σπίθες: όπου το μέτωπο ενός κύματος χτυπάει τοίχο, πετάγονται μερικές μικρές πορτοκαλί
  // σπίθες από την πέτρα και πέφτουν (μόνο οπτικό — δεν είναι ήχος). Ανά κύμα θυμόμαστε ως ποιο
  // κομμάτι τοίχου έχουμε ήδη "δει" (w._spark), και διαλέγουμε λίγα από τα καινούργια.
  sparks: [],
  lights: [],
  updateSparks(dt) {
    const L = Level;
    for (const w of Echoes.waves) {
      if (w.kind === 'step') continue;
      if (w._spark === undefined) w._spark = 0;
      let budget = Math.round(5 * w.strength);
      for (; w._spark < w.ptr; w._spark++) {
        if (budget <= 0 || Math.random() > 0.16) continue;
        const i = w.hits[w._spark].i;
        if (this.sparks.length > 140) break;
        budget--;
        // Από το σημείο του τοίχου, προς τον διάδρομο (η κάθετος του κομματιού).
        const mx = (L.segX1[i] + L.segX2[i]) / 2, my = (L.segY1[i] + L.segY2[i]) / 2;
        const nx = L.testX[i] - mx, ny = L.testY[i] - my;
        const sp = 25 + Math.random() * 45, side = (Math.random() - 0.5) * 30;
        this.sparks.push({
          x: mx + nx * 1.5, y: my + ny * 1.5, z: 4 + Math.random() * 32,
          vx: nx * sp - ny * side, vy: ny * sp + nx * side, vz: 10 + Math.random() * 35,
          life: 0.5 + Math.random() * 0.5, age: 0,
        });
      }
    }
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const s = this.sparks[k];
      s.age += dt;
      if (s.age >= s.life) { this.sparks.splice(k, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.vz -= 160 * dt;                               // βαρύτητα
      s.vx *= 1 - 2.5 * dt; s.vy *= 1 - 2.5 * dt;     // αντίσταση του αέρα
      if (s.z < 0) { s.z = 0; s.vz *= -0.3; }         // αναπηδούν λίγο στο δάπεδο
    }
  },

  drawSparks(pc) {
    const R = Raycast;
    if (this.sparks.length === 0) return;
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      const p = R.project(s.x, s.y);
      if (!p || p.depth > 14 || !R.visible(p.sx, p.depth)) continue;
      const y = R.horizon + (R.focal * (RC_EYE - s.z / TILE)) / p.depth;
      const t = 1 - s.age / s.life;
      const size = p.depth < 1.2 ? 2 : 1;
      // Από λευκοκίτρινο (καυτό) σε πηλό καθώς σβήνει.
      const c = t > 0.6 ? '255,214,150' : POT.light;
      pc.fillStyle = `rgba(${c},${(t * 0.95).toFixed(3)})`;
      pc.fillRect(Math.round(p.sx), Math.round(y), size, size);
    }
    pc.restore();
  },

  // Σκόνη στον αέρα (τα σωματίδια του Fx, γύρω από τον παίκτη): φαίνεται μόνο όπου φτάνει
  // φως — κύμα ή αναμμένος βωμός. Κάθε κόκκος αιωρείται σε δικό του ύψος.
  drawMotes(pc, now) {
    const R = Raycast;
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalCompositeOperation = 'lighter';
    for (const m of Fx.motes) {
      if (m.z === undefined) m.z = 4 + Math.random() * 32;
      const p = R.project(m.x, m.y);
      if (!p || p.depth > 10 || !R.visible(p.sx, p.depth)) continue;
      const l = Fx.light(m.x, m.y);
      if (l < 0.03) continue;
      const z = m.z + Math.sin(now * 0.7 + m.ph) * 2;
      const y = R.horizon + (R.focal * (RC_EYE - z / TILE)) / p.depth;
      const s = p.depth < 1.5 ? 2 : 1;
      const tw = 0.6 + 0.4 * Math.sin(now * 3 + m.ph * 4);
      pc.fillStyle = `rgba(${POT.light},${Math.min(0.85, l * 0.9 * tw).toFixed(3)})`;
      pc.fillRect(Math.round(p.sx), Math.round(y), s, s);
    }
    pc.restore();
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
