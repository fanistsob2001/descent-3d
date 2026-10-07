'use strict';

const MONSTER_RADIUS = 10;
// Ταχύτητες ανά κατάσταση. Το κυνήγι είναι λίγο πιο αργό από το τρέξιμο του παίκτη.
const MONSTER_SPEED = { wander: 40, hunt: 95, search: 55 };
// Πόσο ψάχνει γύρω από τον τελευταίο ήχο πριν ξαναρχίσει να περιφέρεται (δευτ.).
const MONSTER_SEARCH_TIME = 5;
// Ήχος πίσω από τοίχο ακούγεται πιο πνιχτά: μόνο έως αυτό το ποσοστό της ακτίνας.
const MONSTER_MUFFLED_RANGE = 0.6;
// Πόσο φαίνεται η κόκκινη λάμψη όταν το ακουμπήσει κύμα (δευτ.).
const MONSTER_REVEAL_TIME = 1.5;
// Ο φρουρός περιφέρεται μόνο τόσα κελιά γύρω από τη θέση του.
const GUARD_RANGE = 4;

class Monster {
  // guard = true: όταν δεν κυνηγάει, γυρίζει και φυλάει κοντά στο σημείο εκκίνησης.
  // region = το κεφάλαιο της σκιάς: δεν βγαίνει ποτέ από αυτό.
  constructor(x, y, guard, region) {
    this.x = x;
    this.y = y;
    this.r = MONSTER_RADIUS;
    this.guard = guard;
    this.region = region;
    this.homeTx = Math.floor(x / TILE);
    this.homeTy = Math.floor(y / TILE);
    this.state = 'wander';     // 'wander' | 'hunt' | 'search'
    this.path = [];            // λίστα από [tx, ty] προς επίσκεψη
    this.soundX = 0;           // πού άκουσε τον τελευταίο ήχο
    this.soundY = 0;
    this.searchUntil = 0;

    // Η λάμψη δείχνει πού ήταν το τέρας τη στιγμή που το βρήκε το κύμα,
    // όχι πού είναι τώρα.
    this.revealX = 0;
    this.revealY = 0;
    this.revealTime = -1e6;
    this.revealStrength = 0;
    this.revealSeed = 0;
    this.revealState = 'wander';   // τι έκανε όταν φάνηκε (για το εικονίδιο πάνω από το κεφάλι)

    // Η Μελωδία την παγώνει: δεν κινείται, δεν ακούει, δεν σκοτώνει.
    this.frozenUntil = -1e6;

    // Είδος τέρατος: οι Ερινύες (παρακάτω) αλλάζουν αυτά.
    this.kind = 'shade';      // και το sprite του / το jump scare του
    this.fly = false;         // πετάει πάνω από νερό και χάσματα
    this.speeds = MONSTER_SPEED;
  }

  // Ακούει αυτό το κύμα; (οι σκιές ακούνε τα πάντα· οι Ερινύες μόνο τους δυνατούς ήχους)
  hears(wave) {
    return true;
  }

  freeze(until) {
    this.frozenUntil = Math.max(this.frozenUntil, until);
  }

  isFrozen() {
    return Echoes.now < this.frozenUntil;
  }

  // Καλείται από το Echoes όταν ένα κύμα φτάσει το τέρας.
  onHear(wave, d, los) {
    const now = Echoes.now;
    if (this.isFrozen()) return;
    const revealed = this.hear(wave, d, los, now);
    // Το εικονίδιο δείχνει τι κάνει ΑΦΟΥ άκουσε (π.χ. μόλις ξεκίνησε να κυνηγάει).
    if (revealed) this.revealState = this.state;
  }

  // Επιστρέφει true αν το κύμα την έκανε να φανεί.
  hear(wave, d, los, now) {
    let revealed = false;
    if (los) {
      const s = Math.min(1, 0.3 + Echoes.strengthAt(wave, d) * 1.2);
      if (s > this.revealAlpha(now)) {
        this.revealX = this.x;
        this.revealY = this.y;
        this.revealTime = now;
        this.revealStrength = s;
        this.revealSeed = Math.random() * 1000;
        revealed = true;
      }
    }

    if (!this.hears(wave)) return revealed;
    // Στον Κωκυτό / Φλεγέθοντα ο θόρυβος σκεπάζει τους ήχους: ακούει μόνο από πιο κοντά.
    const mask = (CHAPTERS[this.region] && CHAPTERS[this.region].mask) || 1;
    const range = (los ? wave.radius : wave.radius * MONSTER_MUFFLED_RANGE) * mask;
    if (d > range) return revealed;
    // Ήχοι από άλλο κεφάλαιο δεν την τραβάνε έξω από το δικό της.
    if (Level.regionAt(Math.floor(wave.x / TILE), Math.floor(wave.y / TILE)) !== this.region) return revealed;

    if (this.state !== 'hunt' && this.onSense) this.onSense(this);
    this.state = 'hunt';
    this.soundX = wave.x;
    this.soundY = wave.y;
    this.goTo(Math.floor(wave.x / TILE), Math.floor(wave.y / TILE));
    return revealed;
  }

  revealAlpha(now) {
    const age = now - this.revealTime;
    if (age >= MONSTER_REVEAL_TIME) return 0;
    return this.revealStrength * (1 - age / MONSTER_REVEAL_TIME);
  }

  goTo(tx, ty) {
    const cx = Math.floor(this.x / TILE), cy = Math.floor(this.y / TILE);
    // Πρώτα στο κέντρο του τωρινού κελιού, ώστε να μην κόβει γωνίες τοίχων.
    this.path = [[cx, cy], ...Level.findPath(cx, cy, tx, ty, this.fly)];
  }

  pickNextGoal(now) {
    const cx = Math.floor(this.x / TILE), cy = Math.floor(this.y / TILE);

    if (this.state === 'hunt') {
      // Έφτασε εκεί που άκουσε τον ήχο: ψάχνει γύρω γύρω.
      this.state = 'search';
      this.searchUntil = now + MONSTER_SEARCH_TIME;
    }

    if (this.state === 'search') {
      if (now >= this.searchUntil) {
        this.state = 'wander';
      } else {
        const sx = Math.floor(this.soundX / TILE), sy = Math.floor(this.soundY / TILE);
        const [tx, ty] = Level.randomFloorNear(sx, sy, 1, 3, this.region, this.fly);
        this.goTo(tx, ty);
        return;
      }
    }

    const [tx, ty] = this.guard
      ? Level.randomFloorNear(this.homeTx, this.homeTy, 0, GUARD_RANGE, this.region, this.fly)
      : Level.randomFloorNear(cx, cy, 4, 12, this.region, this.fly);
    this.goTo(tx, ty);
  }

  update(dt, now) {
    if (this.path.length === 0) this.pickNextGoal(now);

    if (now < this.frozenUntil) return;
    let step = this.speeds[this.state] * dt;
    while (step > 0 && this.path.length > 0) {
      const [tx, ty] = this.path[0];
      const gx = (tx + 0.5) * TILE, gy = (ty + 0.5) * TILE;
      const dx = gx - this.x, dy = gy - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step) {
        this.x = gx;
        this.y = gy;
        step -= dist;
        this.path.shift();
      } else {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        step = 0;
      }
    }
  }

  touches(p) {
    if (this.isFrozen()) return false;
    return Math.hypot(p.x - this.x, p.y - this.y) < p.r + this.r;
  }

  // Η σκιά ως pixel sprite: σκυφτή μορφή από κάρβουνο με λευκά μάτια που λάμπουν,
  // "φωτισμένη" από το κύμα (περίγραμμα πηλού). Αν δοθεί forceAlpha, σχεδιάζεται στην
  // πραγματική θέση (π.χ. εκεί που σε έπιασε).
  draw(ctx, now, forceAlpha) {
    if (forceAlpha === undefined && now < this.frozenUntil) {
      this.drawRemembering(ctx, now);
      return;
    }
    let a, x, y, frame;
    if (forceAlpha !== undefined) {
      a = forceAlpha; x = this.x; y = this.y; frame = Math.floor(now * 5);
    } else {
      a = this.revealAlpha(now);
      if (a < 0.01) return;
      x = this.revealX; y = this.revealY; frame = Math.floor(this.revealSeed);
    }

    // Αχνή κόκκινη λάμψη γύρω της: κίνδυνος.
    const glow = ctx.createRadialGradient(x, y, 0, x, y, this.r * 2.8);
    glow.addColorStop(0, `rgba(${POT.red},${(a * 0.4).toFixed(3)})`);
    glow.addColorStop(1, `rgba(${POT.red},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, this.r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Κοιτάζει προς τον παίκτη, όπως ήταν τη στιγμή που φάνηκε.
    const flip = typeof player !== 'undefined' && player.x < x;
    // Οι Ερινύες πετάνε: ανεβοκατεβαίνουν λίγο στον αέρα.
    const hover = this.fly ? Math.sin(now * 4 + this.homeTx) * 3 : 0;
    const r = Sprites.draw(ctx, this.kind, frame, x, y + hover, { flip, alpha: a, center: true });

    // Τα μάτια λάμπουν (λευκή λάμψη πάνω στα δύο pixels των ματιών).
    const [eyeX, eyeY, eyeColor] = this.kind === 'erinys' ? [r.w / 2, 5.5, '255,210,90'] : [9.5, 3.5, '255,250,235'];
    const ex = r.x + (flip ? r.w - eyeX : eyeX), ey = r.y + eyeY;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 4);
    eg.addColorStop(0, `rgba(${eyeColor},${(a * 0.45).toFixed(3)})`);
    eg.addColorStop(1, `rgba(${eyeColor},0)`);
    ctx.fillStyle = eg;
    ctx.fillRect(ex - 4, ey - 4, 8, 8);
    ctx.restore();

    // Πάνω από το κεφάλι: τι κάνει. ((•)) = κυνηγάει έναν ήχο, ? = ψάχνει.
    if (forceAlpha === undefined && this.revealState !== 'wander') {
      const icon = this.revealState === 'hunt' ? 'iconHear' : 'iconSearch';
      const blink = 0.65 + 0.35 * Math.sin(now * 10);
      Sprites.blit(ctx, icon, 0, r.x + r.w / 2, r.y - 2, { alpha: a * blink });
    }
  }

  // Παγωμένη από τη Μελωδία: φαίνεται ως χλωμό, ήρεμο πνεύμα ("θυμάται ότι κάποτε
  // ζούσε"), που σβήνει καθώς τελειώνει το πάγωμα.
  drawRemembering(ctx, now) {
    const left = this.frozenUntil - now;
    const a = Math.min(1, left / 1.2) * (0.55 + 0.1 * Math.sin(now * 3));
    const x = this.x, y = this.y;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, this.r * 3);
    glow.addColorStop(0, `rgba(${POT.cream},${(a * 0.3).toFixed(3)})`);
    glow.addColorStop(1, `rgba(${POT.cream},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, this.r * 3, 0, Math.PI * 2);
    ctx.fill();
    Sprites.draw(ctx, 'soul', Math.floor(now * 2), x, y, { alpha: a, center: true });
  }
}

// Ερινύες (κεφ. VI, F στον χάρτη): φτερωτές γυναίκες με φίδια στα μαλλιά, φύλακες του
// Τάρταρου. Πετάνε (περνάνε πάνω από νερό και χάσματα), ακούνε ΜΟΝΟ τους δυνατούς ήχους
// (μεγάλο κύμα, αγγείο — όχι βήματα ή μικρά κύματα), αλλά όταν ακούσουν ορμάνε πιο
// γρήγορα κι από τον παίκτη που τρέχει. Όταν δεν κυνηγάνε, φυλάνε κοντά στη θέση τους.
const ERINYS_SPEED = { wander: 32, hunt: 150, search: 60 };
const ERINYS_LOUD = 0.78;   // ελάχιστη δύναμη κύματος που ακούνε (το αγγείο είναι 1)

class Erinys extends Monster {
  constructor(x, y, region) {
    super(x, y, true, region);
    this.kind = 'erinys';
    this.fly = true;
    this.speeds = ERINYS_SPEED;
  }

  hears(wave) {
    return wave.kind !== 'step' && wave.strength >= ERINYS_LOUD;
  }
}
