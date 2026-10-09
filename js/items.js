'use strict';

// Αντικείμενα που μαζεύεις περπατώντας πάνω τους: οβολός, χορδές, αγγεία σπονδής.
// Είναι κρυμμένα στο σκοτάδι: φαίνονται (λάμπουν) μόνο όταν τα ακουμπήσει κύμα.
// Το id κάθε αντικειμένου είναι η θέση του στο Level.items (σταθερό, για το save).
const ITEM_REACH = TILE * 0.5;
const ITEM_REVEAL_TIME = 2.5;

const Items = {
  list: [],   // { id, kind, x, y, taken, revealTime, revealStrength, onHear }

  // taken: τα id που έχουν ήδη μαζευτεί (από το save).
  reset(taken) {
    const gone = new Set(taken);
    this.list = Level.items.map((it, id) => ({
      id, kind: it.kind, x: it.x, y: it.y, n: it.n, taken: gone.has(id),
      revealTime: -1e6, revealStrength: 0,
      onHear(wave, d, los) {
        if (!los || this.taken) return;
        const s = Echoes.strengthAt(wave, d);
        const left = this.revealStrength * Math.max(0, 1 - (Echoes.now - this.revealTime) / ITEM_REVEAL_TIME);
        if (s < left) return;
        this.revealTime = Echoes.now;
        this.revealStrength = s;
      },
    }));
  },

  takenIds() {
    return this.list.filter((it) => it.taken).map((it) => it.id);
  },

  // Επιστρέφει το αντικείμενο που μόλις μάζεψε ο παίκτης, ή null.
  check(p) {
    for (const it of this.list) {
      if (it.taken || it.kind === 'tablet') continue;   // (οι πινακίδες: με E — nearTablet)
      if (Math.hypot(p.x - it.x, p.y - it.y) < ITEM_REACH) {
        it.taken = true;
        return it;
      }
    }
    return null;
  },

  // Μια πήλινη πινακίδα (γράμμα) δίπλα σου: τη μαζεύεις με E ("Take").
  nearTablet(p) {
    return this.list.find((it) => it.kind === 'tablet' && !it.taken && Math.hypot(p.x - it.x, p.y - it.y) < TILE * 0.8) || null;
  },

  draw(ctx, now, view) {
    for (const it of this.list) {
      if (it.taken) continue;
      if (it.x < view.x0 - TILE || it.x > view.x1 + TILE ||
          it.y < view.y0 - TILE || it.y > view.y1 + TILE) continue;
      const age = now - it.revealTime;
      if (age >= ITEM_REVEAL_TIME) continue;
      const a = Math.min(1, 0.35 + it.revealStrength) * (1 - age / ITEM_REVEAL_TIME);
      const twinkle = 0.75 + 0.25 * Math.sin(now * 6 + it.id);

      // Λάμψη γύρω του, στο χρώμα του αντικειμένου.
      const color = { obol: POT.light, string: POT.cream, jar: POT.terra, tablet: POT.light }[it.kind];
      const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, 16);
      g.addColorStop(0, `rgba(${color},${(a * 0.35 * twinkle).toFixed(3)})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(it.x, it.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(${color},${a.toFixed(3)})`;
      ctx.fillStyle = `rgba(${color},${(a * 0.8).toFixed(3)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (it.kind === 'obol') {
        // Νόμισμα: κύκλος με μια κουκκίδα στη μέση.
        ctx.arc(it.x, it.y, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(it.x, it.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === 'string') {
        // Χορδή: μια λεπτή καμπύλη γραμμή που "πάλλεται".
        const wob = Math.sin(now * 20) * 1.5 * a;
        ctx.moveTo(it.x - 7, it.y + 4);
        ctx.quadraticCurveTo(it.x, it.y + wob, it.x + 7, it.y - 4);
        ctx.stroke();
      } else {
        // Αγγείο (λήκυθος): γεμάτο σώμα από πηλό, λαιμός, χείλος και μια
        // μαύρη ζώνη γύρω από την κοιλιά, όπως στα αληθινά.
        ctx.moveTo(it.x - 2.5, it.y - 7);
        ctx.lineTo(it.x + 2.5, it.y - 7);
        ctx.lineTo(it.x + 1.5, it.y - 6);
        ctx.lineTo(it.x + 1.5, it.y - 4);
        ctx.quadraticCurveTo(it.x + 6.5, it.y - 1, it.x + 2.5, it.y + 6);
        ctx.lineTo(it.x - 2.5, it.y + 6);
        ctx.quadraticCurveTo(it.x - 6.5, it.y - 1, it.x - 1.5, it.y - 4);
        ctx.lineTo(it.x - 1.5, it.y - 6);
        ctx.closePath();
        ctx.fill();
        Pottery.incise(ctx, [it.x - 4.4, it.y, it.x + 4.4, it.y], 40);
      }
    }
  },
};
