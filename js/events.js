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
    this.chase = false;         // κυνηγάει τον παίκτη κατευθείαν (καταδίωξη)
    this.nextRepath = 0;
    this.barkAt = 0;
    this.onAsleep = null;
  }

  hears() {
    return this.asleep < 3 && !this.chase;
  }

  // Η Μελωδία: ένα κεφάλι αποκοιμιέται. Ζαλίζεται για λίγο και ξυπνάει πιο θυμωμένος.
  freeze() {
    const now = Echoes.now;
    if (this.asleep >= 3 || now - this.lastLull < 2.5 || this.chase) return;
    // Μόνο από κοντά, και όχι όσο σε κυνηγάει (πρώτα τον ξεγελάς με έναν ήχο).
    if ((this.state === 'hunt' || Math.hypot(player.x - this.x, player.y - this.y) > 170)) return;
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

// ---- Ο Κέρβερος ως boss (X), σαν τη μάχη με τον Tiny Tiger του Crash Bandicoot ----
// Δεν βλέπει, αλλά σε μυρίζει: γυρίζει προς το μέρος σου, γρυλίζει και ξύνει το χώμα (προειδοποίηση), και
// ορμάει σε ευθεία εκεί που ήσουν. Δεν μπορεί να στρίψει: αν παραμερίσεις, χτυπάει στην πέτρα και ζαλίζεται.
// Μετά από 3 ορμές ξαπλώνει λαχανιασμένος (tired): τότε, όπως στον μύθο, τον αποκοιμίζει η μουσική — παίζεις τη
// λύρα (κύμα με τη λύρα στο χέρι, ή τη Μελωδία) από κοντά → ακούει (lulled) → ένα κεφάλι κοιμάται (η μπάρα ζωής
// πέφτει κατά ένα τρίτο). Ένας μόνο τρόπος (ο χρήστης το ζήτησε): η λύρα. Κάθε φάση πιο γρήγορος. Σκοτώνει μόνο όσο ορμάει ή όταν πέσεις πάνω του ξύπνιο.
const BOSS = {
  windup: [1.25, 1.0, 0.8],       // δευτ. προειδοποίησης ανά φάση (κεφάλια που κοιμούνται: 0, 1, 2)
  charge: [235, 275, 315],        // ταχύτητα ορμής (ο παίκτης τρέχει με 115)
  tired: [7, 6, 5.5],             // πόσο μένει ξαπλωμένος
  charges: 3,                     // ορμές πριν κουραστεί
  stun: 1.1,                      // ζάλη μετά από κάθε χτύπημα σε τοίχο
  songReach: 240,                 // παίζεις λύρα τόσο κοντά του (όσο είναι κουρασμένος) = ακούει
  lull: 1.8,                      // πόσο ακούει πριν κοιμηθεί το κεφάλι
  rise: 1.8,
};

class CerberusBoss extends Cerberus {
  constructor(x, y, region) {
    super(x, y, region);
    this.boss = true;
    this.guard = true;
    this.bstate = 'idle';       // idle | windup | charge | prowl | stunned | tired | lulled | rise | asleep
    this.bUntil = 0;
    this.dirX = 0; this.dirY = 1;
    this.facing = Math.PI / 2;
    this.chargesDone = 0;
    this.fight = false;
    // Η αρένα: τα κελιά του κεφαλαίου κάτω από τον διάδρομο (εκεί που ξεκινάει ο μεγάλος χώρος).
    this.arenaTop = Math.floor(y / TILE) - 3;
    this.homeX = x; this.homeY = y;
  }

  hears() { return false; }

  inArena(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return ty >= this.arenaTop && Level.regionAt(tx, ty) === this.region && !Level.isWall(tx, ty);
  }

  // Η Μελωδία (Melody.play καλεί freeze σε όσα τέρατα είναι κοντά): κι αυτή είναι η λύρα.
  freeze() {
    this.onSong(Echoes.now);
  }

  // Ο παίκτης έπαιξε τη λύρα (main.js, emitCall / Melody): αν είναι ξαπλωμένος και κοντά, ακούει.
  onSong(now) {
    if (this.bstate !== 'tired' || Math.hypot(player.x - this.x, player.y - this.y) > BOSS.songReach) return;
    this.set('lulled', BOSS.lull, now);
  }

  isFrozen() {
    return this.asleep >= 3;
  }

  set(s, dur, now) {
    this.bstate = s;
    this.bUntil = now + dur;
  }

  headSleeps(now) {
    this.asleep++;
    if (this.asleep >= 3) {
      this.bstate = 'asleep';
      this.fight = false;
      if (this.onAsleep) this.onAsleep();
      return;
    }
    Notice.show(STORY.headSleeps, now, 2.5);
    this.set('rise', BOSS.rise, now);
    CERB_PITCH.forEach((f, i) => Sound.bark(this.x, this.y, f, 0.4 + i * 0.25));
  }

  update(dt, now) {
    if (this.asleep >= 3) return;
    const ph = Math.min(2, this.asleep);
    const pdx = player.x - this.x, pdy = player.y - this.y;
    // Η μάχη αρχίζει μόλις μπεις στην αρένα· αν βγεις πίσω στον διάδρομο, σε περιμένει.
    const inside = this.inArena(player.x, player.y);
    if (!this.fight) {
      if (!inside) {
        // Περιμένει στη μέση της αρένας, γυρισμένος προς την είσοδο.
        this.facing = Math.atan2(pdy, pdx);
        return;
      }
      this.fight = true;
      this.chargesDone = 0;
      this.set('windup', BOSS.windup[ph] + 0.6, now);
      CERB_PITCH.forEach((f, i) => Sound.bark(this.x, this.y, f, i * 0.3));
    }
    const s = this.bstate;
    if (s === 'windup') {
      // Γυρίζει προς το μέρος σου (όχι ακαριαία) και γρυλίζει· στο τέλος ορμάει.
      const want = Math.atan2(pdy, pdx);
      let da = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
      this.facing += Math.max(-dt * 8, Math.min(dt * 8, da));
      if (now >= this.barkAt) { this.barkAt = now + 0.45; Sound.bark(this.x, this.y, CERB_PITCH[Math.floor(Math.random() * 3)], 0); }
      if (now >= this.bUntil) {
        if (!inside) { this.set('windup', 0.5, now); return; }
        // Ορμάει εκεί που είσαι τη στιγμή που ξεκινάει (όχι εκεί που προλάβαινε να κοιτάξει).
        this.facing = want;
        this.dirX = Math.cos(want);
        this.dirY = Math.sin(want);
        this.set('charge', 6, now);
        this.chargeFromX = this.x; this.chargeFromY = this.y;
      }
    } else if (s === 'charge') {
      // Σε ευθεία, όσο δεν βρίσκει πέτρα (ή την άκρη της αρένας).
      const step = BOSS.charge[ph] * dt;
      const nx = this.x + this.dirX * step, ny = this.y + this.dirY * step;
      // Μόνο μπροστά του (η μουσούδα και οι δύο "ώμοι"): ένας τοίχος δίπλα του δεν τον σταματάει.
      const fx = nx + this.dirX * this.r, fy = ny + this.dirY * this.r;
      const sx = this.dirY * this.r * 0.5, sy = -this.dirX * this.r * 0.5;
      const hit = !this.inArena(fx, fy) || !this.inArena(fx + sx, fy + sy) || !this.inArena(fx - sx, fy - sy);
      Sound.rumble(true, this.x, this.y);
      if (hit && Math.hypot(this.x - this.chargeFromX, this.y - this.chargeFromY) < TILE * 1.2) {
        // Πέτρα ακριβώς μπροστά του (κρύφτηκες πίσω από κολόνα): δεν ορμάει, έρχεται γύρω της να σε βρει.
        Sound.rumble(false);
        this.path = Level.findPath(Math.floor(this.x / TILE), Math.floor(this.y / TILE), Math.floor(player.x / TILE), Math.floor(player.y / TILE));
        this.set('prowl', 1.6, now);
      } else if (hit || now >= this.bUntil) {
        Sound.rumble(false);
        this.chargesDone++;
        Level.pushOutOfWalls(this);
        // Το χτύπημα: ένας κούφιος γδούπος, και η πέτρα "φωτίζεται" (κύμα — αλλά οι σκιές εδώ δεν υπάρχουν).
        Echoes.emit(this.x + this.dirX * this.r, this.y + this.dirY * this.r, 260, 0.75, 'jar');
        Sound.thud(this.x, this.y);
        if (typeof vibrate === 'function') vibrate(60);
        if (this.chargesDone >= BOSS.charges) {
          this.chargesDone = 0;
          this.set('tired', BOSS.tired[ph], now);
          Notice.show(STORY.bossTired, now, 2.5);
        } else this.set('stunned', BOSS.stun, now);
      } else { this.x = nx; this.y = ny; }
    } else if (s === 'prowl') {
      // Περπατάει γρήγορα γύρω από το εμπόδιο, προς το μέρος σου, και μετά ξαναετοιμάζεται.
      let st = 120 * dt;
      while (st > 0 && this.path.length) {
        const [tx, ty] = this.path[0];
        const gx = (tx + 0.5) * TILE, gy = (ty + 0.5) * TILE, d = Math.hypot(gx - this.x, gy - this.y);
        if (!this.inArena(gx, gy)) { this.path = []; break; }
        if (d <= st) { this.x = gx; this.y = gy; st -= d; this.path.shift(); }
        else { this.x += ((gx - this.x) / d) * st; this.y += ((gy - this.y) / d) * st; this.facing = Math.atan2(gy - this.y, gx - this.x); st = 0; }
      }
      if (now >= this.bUntil || !this.path.length) this.set('windup', BOSS.windup[ph] * 0.8, now);
    } else if (s === 'stunned' || s === 'rise') {
      if (now >= this.bUntil) this.set('windup', BOSS.windup[ph], now);
    } else if (s === 'tired') {
      if (now >= this.bUntil) {
        this.set('windup', BOSS.windup[ph], now);
        CERB_PITCH.forEach((f, i) => Sound.bark(this.x, this.y, f, i * 0.2));
      }
    } else if (s === 'lulled') {
      if (now >= this.bUntil) this.headSleeps(now);
    }
  }

  // Η "ζωή" που φαίνεται στην μπάρα (1 = ξύπνιος, 0 = κοιμάται).
  health() {
    return 1 - this.asleep / 3;
  }

  touches(p) {
    if (this.asleep >= 3) return false;
    const s = this.bstate;
    if (s !== 'charge' && s !== 'windup' && s !== 'idle' && s !== 'prowl') return false;
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
  // Checkpoint: εκεί που άρχισε η καταδίωξη — αν πεθάνεις, ξαναρχίζεις από εκεί (όχι από το ιερό).
  // Μένει μετά από θάνατο (spawn), σβήνει όταν τελειώσει η καταδίωξη ή βγεις στο μενού.
  checkpoint: null,

  // Τρέχει τώρα κάποια καταδίωξη;
  active() {
    return !!((this.styx && this.styx.chaser) || (this.tartarus && this.tartarus.active));
  },

  // Πόσο κοντά είναι ο κυνηγός / η πέτρα (0 = μακριά, 1 = πάνω σου): για το τρέμουλο της κάμερας.
  danger() {
    let d = Infinity;
    if (this.styx && this.styx.chaser) d = Math.hypot(this.styx.chaser.x - player.x, this.styx.chaser.y - player.y);
    if (Boulder.active) d = Math.min(d, Math.hypot(Boulder.x - player.x, Boulder.y - player.y));
    return Math.max(0, 1 - d / 320);
  },

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
      this.checkpoint = { x: player.x, y: player.y, angle: player.angle, region };
      CERB_PITCH.forEach((f, i) => Sound.bark(c.x, c.y, f, i * 0.3));
      Notice.show(STORY.chaseStyx, now, 4);
    }
    if (S.chaser && region !== S.chaser.region) {
      // Έφτασες στον Φλεγέθοντα: σταματάει.
      monsters.splice(monsters.indexOf(S.chaser), 1);
      S.chaser = null;
      S.done = true;
      this.checkpoint = null;
      Notice.show(STORY.chaseStyxEnd, now, 6);
    }
    // Τάρταρος: οι Ερινύες ξυπνάνε όλες μαζί, και η πέτρα κατρακυλάει από πάνω.
    if (kind === 'furies' && !T.done && !T.active) {
      T.active = true;
      this.checkpoint = { x: player.x, y: player.y, angle: player.angle, region };
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
        this.checkpoint = null;
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
