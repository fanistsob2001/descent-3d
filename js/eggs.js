'use strict';

// Easter eggs (STORY.md, ενότητα 9): κρυμμένα και ακίνδυνα.
// Δεν είναι σκιές του παιχνιδιού: δεν είναι στη λίστα monsters, οπότε δεν
// κυνηγούν, δεν σκοτώνουν, δεν ανεβάζουν το καρδιοχτύπι. Και δεν βγάζουν ποτέ
// κύμα ήχου (Echoes.emit), οπότε δεν τραβάνε καμία σκιά.
const EGG_REVEAL_TIME = 3;

// A. Η σκιά που χτυπάει συνέχεια στον τοίχο (κεφ. II) — σαν "bug" στο pathfinding.
const STUCK_SPEED = 32;        // περπατάει προς τον τοίχο
const STUCK_RECOIL = 26;       // μετά το "μπαμ" οπισθοχωρεί τόσο
const STUCK_TALK_GAP = 10;     // το μήνυμα ξαναβγαίνει το πολύ κάθε τόσα δευτ.

// B. Ο Κέρβερος κοιμάται (κεφ. IV).
const CERB_LENGTH = 92;        // μήκος της μορφής σε μονάδες κόσμου (το δωμάτιο είναι 120)
const CERB_BARK_GAP = 0.42;    // δευτ. ανάμεσα στα τρία γαβγίσματα
const CERB_BARK_TIME = 0.28;   // πόσο μένει ανοιχτό το στόμα
const CERB_COOLDOWN = 6;       // μετά από πόσο μπορεί να ξαναγαβγίσει
const CERB_PITCH = [150, 250, 400];   // χαμηλό, μεσαίο, ψηλό — ένα για κάθε κεφάλι

const Eggs = {
  stuck: null,
  cerberus: null,

  reset() {
    const e = Level.eggs;
    this.stuck = null;
    this.cerberus = null;

    if (e.stuck) {
      // Ο τοίχος ανατολικά του: περπατάει προς τα εκεί ξανά και ξανά.
      const tx = Math.floor(e.stuck.x / TILE), ty = Math.floor(e.stuck.y / TILE);
      let wx = tx + 1;
      while (!Level.isOpaque(wx, ty)) wx++;
      this.stuck = {
        x: e.stuck.x, y: e.stuck.y, startX: e.stuck.x, wallX: wx * TILE - MONSTER_RADIUS,
        phase: 'walk', phaseUntil: 0, bumpAt: -1e6,
        revealTime: -1e6, spokeAt: -1e6,
        onHear(wave, d, los) {
          if (!los || wave.kind === 'step') return;
          this.revealTime = Echoes.now;
          if (typeof Missions !== 'undefined') Missions.secrets.add('stuck');   // μυστική αποστολή
          if (Echoes.now - this.spokeAt > STUCK_TALK_GAP) {
            this.spokeAt = Echoes.now;
            const d = Voice.say(STORY.stuckShade, 'shade', { x: this.x, y: this.y });
            Notice.show(STORY.stuckShade, Echoes.now, Math.max(6, d + 1), null, 'shade');
          }
        },
      };
    }

    if (e.cerberus) {
      this.cerberus = {
        x: e.cerberus.x, y: e.cerberus.y,
        revealTime: -1e6, barkStart: -1e6,
        onHear(wave, d, los) {
          if (!los || wave.kind === 'step') return;
          this.revealTime = Echoes.now;
          if (Echoes.now - this.barkStart < CERB_COOLDOWN) return;
          this.barkStart = Echoes.now;
          if (typeof Missions !== 'undefined') Missions.secrets.add('cerberus');   // μυστική αποστολή
          const said = Voice.say(STORY.cerberus, 'orpheus', { delay: CERB_BARK_GAP * 3 + 0.2 });
          Notice.show(STORY.cerberus, Echoes.now, Math.max(5, said + CERB_BARK_GAP * 3 + 0.6));
          // Τρία γαβγίσματα, ένα από κάθε κεφάλι: χαμηλό, μεσαίο, ψηλό.
          CERB_PITCH.forEach((f, i) => Sound.bark(this.x, this.y, f, i * CERB_BARK_GAP));
        },
      };
    }
  },

  // Για το Echoes.listeners (για να τα "βλέπουν" τα κύματα).
  listeners() {
    return [this.stuck, this.cerberus].filter(Boolean);
  },

  update(dt, now) {
    const s = this.stuck;
    if (!s) return;
    if (s.phase === 'walk') {
      s.x += STUCK_SPEED * dt;
      if (s.x >= s.wallX) {
        // Μπαμ. Και πάλι απ' την αρχή.
        s.x = s.wallX;
        s.phase = 'recoil';
        s.phaseUntil = now + 0.3;
        s.bumpAt = now;
        Sound.bonk(s.x, s.y);
      }
    } else if (s.phase === 'recoil') {
      s.x -= STUCK_RECOIL / 0.3 * dt;
      if (now >= s.phaseUntil) { s.phase = 'pause'; s.phaseUntil = now + 0.5; }
    } else if (now >= s.phaseUntil) {
      s.phase = 'walk';
    }
  },

  alpha(o, now) {
    const age = now - o.revealTime;
    return age < EGG_REVEAL_TIME ? 1 - age / EGG_REVEAL_TIME : 0;
  },

  draw(ctx, now, view) {
    const inView = (o, m) => o.x > view.x0 - m && o.x < view.x1 + m && o.y > view.y0 - m && o.y < view.y1 + m;

    const s = this.stuck;
    if (s && inView(s, TILE * 2)) {
      const a = this.alpha(s, now);
      if (a > 0.01) {
        // Φαίνεται εκεί που είναι τώρα (όχι "παγωμένη" όπως οι αληθινές σκιές),
        // για να τη δεις να χτυπάει ξανά και ξανά.
        Sprites.draw(ctx, 'shade', Math.floor(now * 4), s.x, s.y, { alpha: a * 0.9, center: true });
        // Μικρές γραμμές "μπαμ" πάνω στον τοίχο, αμέσως μετά το χτύπημα.
        const hit = 1 - (now - s.bumpAt) / 0.35;
        if (hit > 0) {
          ctx.strokeStyle = Pottery.rgba(POT.light, a * hit);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          const wx = s.wallX + MONSTER_RADIUS + 1, wy = s.y - 14;
          for (const [dx, dy] of [[4, -6], [6, 0], [4, 6]]) {
            ctx.moveTo(wx + 1, wy + dy * 0.4);
            ctx.lineTo(wx - dx, wy + dy);
          }
          ctx.stroke();
        }
      }
    }

    const c = this.cerberus;
    if (c && inView(c, CERB_LENGTH)) {
      const barkT = now - c.barkStart;
      const barking = [0, 1, 2].map((i) => barkT >= i * CERB_BARK_GAP && barkT < i * CERB_BARK_GAP + CERB_BARK_TIME);
      const a = Math.max(this.alpha(c, now), barking.some(Boolean) ? 1 : 0);
      if (a > 0.01) {
        Pottery.cerberus(ctx, c.x + 6, c.y + CERB_LENGTH * 0.22, CERB_LENGTH, a, barking,
          0.5 + 0.5 * Math.sin(now * 1.6));
      }
    }
  },
};
