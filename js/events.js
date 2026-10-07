'use strict';

// Στάδιο 5 της επέκτασης (STORY.md, ενότητα 12): οι μεγάλες σκηνές του Κάτω Κόσμου.
//   Cerberus — ο τρικέφαλος σκύλος: boss στην Πύλη του Άδη (X) και κυνηγός στη Στύγα (VII).
//   Boulder  — η πέτρα του Σίσυφου που κατρακυλάει πίσω σου στον Τάρταρο (IX).
//   Chases   — οι δύο καταδιώξεις (σημάδι 'c' στον χάρτη).
//   Throne   — η αίθουσα του θρόνου (XI): παίζεις για τον Άδη και την Περσεφόνη, και η Ευρυδίκη σε ακολουθεί.
// Τα κείμενα: STORY.chaseStyx κ.λπ. (χωρίς φωνή).

const CERB_SPEED = { wander: 55, hunt: 135, search: 75 };
const CERB_CHASE_SPEED = 104;       // στη Στύγα: λίγο πιο αργός από το τρέξιμό σου (115)
const BOULDER_SPEED = 92;

class Cerberus extends Monster {
  constructor(x, y, region) {
    super(x, y, false, region);
    this.kind = 'cerberus';
    this.r = 15;
    this.speeds = { ...CERB_SPEED };
    this.earMul = 1.3;          // ακούει από πιο μακριά από μια σκιά
    this.asleep = 0;            // πόσα κεφάλια κοιμούνται (3 = τέλος)
    this.lastLull = -1e6;
    this.eatUntil = 0;
    this.chase = false;         // κυνηγάει τον παίκτη κατευθείαν (καταδίωξη)
    this.nextRepath = 0;
    this.barkAt = 0;
    this.onAsleep = null;
  }

  hears() {
    return this.asleep < 3 && !this.chase;
  }

  // Η Μελωδία (ή η μελόπιτα): ένα κεφάλι αποκοιμιέται. Ζαλίζεται για λίγο και ξυπνάει πιο θυμωμένος.
  freeze() {
    const now = Echoes.now;
    if (this.asleep >= 3 || now - this.lastLull < 2.5 || this.chase) return;
    // Μόνο από κοντά, και όχι όσο σε κυνηγάει (πρώτα τον ξεγελάς με έναν ήχο ή μια μελόπιτα).
    if (this.eatUntil <= now && (this.state === 'hunt' || Math.hypot(player.x - this.x, player.y - this.y) > 170)) return;
    this.lull(now);
  }

  lull(now) {
    this.asleep++;
    this.lastLull = now;
    this.state = 'search';
    this.path = [];
    if (this.asleep >= 3) {
      this.frozenUntil = 1e12;
      if (this.onAsleep) this.onAsleep();
      return;
    }
    this.frozenUntil = now + 4.5;
    this.speeds = { wander: 55 + this.asleep * 10, hunt: 135 + this.asleep * 18, search: 75 + this.asleep * 10 };
    this.earMul = 1.3 + this.asleep * 0.25;
    Notice.show(STORY.headSleeps, now, 2.5);
  }

  update(dt, now) {
    if (this.asleep >= 3) return;
    // Η μελόπιτα: αν είναι δίπλα του, την τρώει (4 δευτ.) — και η παπαρούνα αποκοιμίζει ένα κεφάλι.
    if (!this.chase && now >= this.eatUntil) {
      for (const it of Jars.items) {
        if (it.kind !== 'cake' || it.brokenAt < 0 || it.eaten) continue;
        if (Math.hypot(it.x - this.x, it.y - this.y) > 34) continue;
        it.eaten = true;
        it.brokenAt = now - 11;      // σβήνει σε λίγο
        this.eatUntil = now + 4;
        this.frozenUntil = now + 4;
        setTimeout(() => this.freeze(), 4000);
        break;
      }
    }
    if (this.chase && now >= this.nextRepath && !this.isFrozen()) {
      // Καταδίωξη: πάει κατευθείαν προς τον παίκτη (όχι προς τους ήχους).
      this.nextRepath = now + 0.5;
      this.state = 'hunt';
      // (χωρίς το "πρώτα στο κέντρο του κελιού" του goTo: αλλιώς κάθε νέα διαδρομή τον γυρίζει πίσω)
      this.path = Level.findPath(Math.floor(this.x / TILE), Math.floor(this.y / TILE), Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    }
    if (this.state === 'hunt' && now >= this.barkAt && !this.isFrozen()) {
      this.barkAt = now + 1.6 + Math.random() * 1.4;
      Sound.bark(this.x, this.y, CERB_PITCH[Math.floor(Math.random() * 3)], 0);
    }
    super.update(dt, now);
  }

  touches(p) {
    if (this.asleep >= 3 || this.isFrozen()) return false;
    return Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r;
  }
}

// Η πέτρα του Σίσυφου: κατρακυλάει πάνω σε μια διαδρομή, φωτίζει τον δρόμο της με τον θόρυβό της
// (κύμα κάθε μισό δευτερόλεπτο) και σε συνθλίβει αν σε φτάσει.
const Boulder = {
  active: false,
  x: 0, y: 0, path: [], roll: 0, r: 17, kind: 'boulder', nextWave: 0,

  start(fromX, fromY, toTx, toTy) {
    this.active = true;
    this.x = fromX;
    this.y = fromY;
    this.path = Level.findPath(Math.floor(fromX / TILE), Math.floor(fromY / TILE), toTx, toTy);
    this.roll = 0;
    this.nextWave = 0;
  },

  stop() {
    this.active = false;
    Sound.rumble(false);
  },

  update(dt, now) {
    if (!this.active) return;
    let step = BOULDER_SPEED * dt;
    while (step > 0 && this.path.length) {
      const [tx, ty] = this.path[0];
      const gx = (tx + 0.5) * TILE, gy = (ty + 0.5) * TILE, d = Math.hypot(gx - this.x, gy - this.y);
      if (d <= step) { this.x = gx; this.y = gy; step -= d; this.path.shift(); }
      else { this.x += ((gx - this.x) / d) * step; this.y += ((gy - this.y) / d) * step; step = 0; }
    }
    this.roll += dt * 6;
    if (!this.path.length) { this.stop(); return; }
    if (now >= this.nextWave) {
      this.nextWave = now + 0.5;
      Echoes.emit(this.x, this.y, 240, 0.7, 'jar');
    }
    Sound.rumble(true, this.x, this.y);
  },

  touches(p) {
    return this.active && Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r;
  },
};

const Chases = {
  styx: null,       // { done, chaser }
  tartarus: null,

  reset() {
    this.styx = { done: false, chaser: null };
    this.tartarus = { done: false, active: false };
    Boulder.stop();
  },

  // Κάθε καρέ όσο παίζεις. region = το κεφάλαιο του παίκτη.
  update(dt, now, region) {
    const trig = Level.chases.find((c) => c.region === region && Math.hypot(c.x - player.x, c.y - player.y) < TILE * 1.6);
    const S = this.styx, T = this.tartarus;
    // Στύγα: ο Κέρβερος σπάει την αλυσίδα του και σε κυνηγάει ως το ποτάμι της φωτιάς.
    const kind = trig && CHAPTERS[region] ? CHAPTERS[region].chase : null;
    if (kind === 'cerberus' && !S.done && !S.chaser) {
      const back = this.behind(region, 12);
      const c = new Cerberus(back.x, back.y, region);
      c.chase = true;
      c.speeds = { wander: CERB_CHASE_SPEED, hunt: CERB_CHASE_SPEED, search: CERB_CHASE_SPEED };
      c.voice = 'shade';
      monsters.push(c);
      Echoes.listeners.push(c);
      S.chaser = c;
      CERB_PITCH.forEach((f, i) => Sound.bark(c.x, c.y, f, i * 0.3));
      Notice.show(STORY.chaseStyx, now, 4);
    }
    if (S.chaser && region !== S.chaser.region) {
      // Έφτασες στον Φλεγέθοντα: σταματάει.
      monsters.splice(monsters.indexOf(S.chaser), 1);
      S.chaser = null;
      S.done = true;
      Notice.show(STORY.chaseStyxEnd, now, 6);
    }
    // Τάρταρος: οι Ερινύες ξυπνάνε όλες μαζί, και η πέτρα κατρακυλάει από πάνω.
    if (kind === 'furies' && !T.done && !T.active) {
      T.active = true;
      const back = this.behind(region, 16);
      const exit = this.exitCell(region);
      if (exit) Boulder.start(back.x, back.y, exit[0], exit[1]);
      for (const m of monsters) {
        if (m.region !== region || m.kind !== 'erinys') continue;
        m.huntPlayer = true;
        m.speeds = { ...m.speeds, hunt: 110 };
      }
      Sound.scream(player.x, player.y - TILE * 6);
      Notice.show(STORY.chaseTartarus, now, 4);
    }
    if (T.active) {
      for (const m of monsters) {
        if (!m.huntPlayer || m.isFrozen() || now < (m.nextRepath || 0)) continue;
        m.nextRepath = now + 0.5;
        m.state = 'hunt';
        m.soundX = player.x; m.soundY = player.y;
        m.path = Level.findPath(Math.floor(m.x / TILE), Math.floor(m.y / TILE), Math.floor(player.x / TILE), Math.floor(player.y / TILE), true);
      }
      if (!CHAPTERS[region] || CHAPTERS[region].chase !== 'furies') {
        T.active = false;
        T.done = true;
        Boulder.stop();
        for (const m of monsters) if (m.huntPlayer) { m.huntPlayer = false; m.speeds = ERINYS_SPEED; m.state = 'search'; }
      }
    }
    Boulder.update(dt, now);
  },

  // Ένα κελί περίπου n βήματα πίσω σου, πάνω στη διαδρομή από τον βωμό του κεφαλαίου ως εσένα.
  behind(region, n) {
    const a = Level.altars[region];
    const path = Level.findPath(Math.floor(player.x / TILE), Math.floor(player.y / TILE), a.tx, a.ty);
    // (ο βωμός είναι σε ιερό: η διαδρομή σταματάει στο όριό του — παίρνουμε όσο πάει)
    const via = path.length ? path : Level.findPath(Math.floor(player.x / TILE), Math.floor(player.y / TILE), a.tx, a.ty + 4);
    const k = Math.min(n, Math.max(0, via.length - 1));
    const cell = via[k] || [Math.floor(player.x / TILE), Math.floor(player.y / TILE) - 6];
    return { x: (cell[0] + 0.5) * TILE, y: (cell[1] + 0.5) * TILE };
  },

  // Η έξοδος του κεφαλαίου (το κάτω άκρο του μπλοκ).
  exitCell(region) {
    for (let ty = Level.rows - 1; ty >= 0; ty--) {
      for (let tx = 0; tx < Level.cols; tx++) {
        const c = ty * Level.cols + tx;
        if (Level.region[c] === region && !Level.grid[c]) return [tx, ty];
      }
    }
    return null;
  },
};

// Η αίθουσα του θρόνου: πλησιάζεις τον Άδη, παίζεις, και οι γραμμές της ιστορίας εμφανίζονται μία-μία.
const Throne = {
  active: false,
  done: false,
  lean: false,
  playedAt: 0,
  timers: [],

  reset(done) {
    this.active = false;
    this.done = done;
    this.lean = done;
    this.timers = [];
  },

  update(dt, now, region) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (now >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    }
    if (this.done || this.active) return;
    const h = Level.decor.find((d) => d.kind === 'hades');
    if (!h || Level.regionAt(Math.floor(h.x / TILE), Math.floor(h.y / TILE)) !== region) return;
    if (Math.hypot(h.x - player.x, h.y - player.y) > TILE * 5.5 || Eurydice.state !== 'none') return;
    // Στέκεσαι μπροστά στους θρόνους: οι σκιές της αίθουσας ακούνε, ακίνητες.
    this.active = true;
    this.playedAt = 0;
    this.hades = h;
    for (const m of monsters) if (m.region === region) m.frozenUntil = now + 1e6;
  },

  // Κοιτάζεις τον Άδη, δεν κινείσαι (μόνο το βλέμμα).
  locked() {
    return this.active;
  },

  prompt() {
    return this.active && !this.playedAt ? STORY.prompts.play : '';
  },

  // Έπαιξες λύρα μπροστά στους θρόνους.
  onCall(now) {
    if (!this.active || this.playedAt) return;
    this.playedAt = now;
    Sound.melody();
    const L = STORY.middle;
    L.forEach((line, i) => this.timers.push({ at: now + 1 + i * 4.6, fn: () => {
      showNarration(line);
      if (i === 2) this.lean = true;
    } }));
    this.timers.push({ at: now + 1 + L.length * 4.6, fn: () => {
      // Η Ευρυδίκη εμφανίζεται δίπλα σου και σε ακολουθεί.
      this.active = false;
      this.done = true;
      Eurydice.reset('following', player);
      for (const m of monsters) if (m.region === playerRegion() && m.frozenUntil > now + 100) m.frozenUntil = gameTime + 8;
      updateHud();
    } });
  },
};
