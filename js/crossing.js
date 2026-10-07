'use strict';

// Το πέρασμα του Αχέροντα (STORY.md, ενότητα 12): μόλις πληρώσεις τον Χάροντα, μπαίνεις στη βάρκα του
// και σε περνάει απέναντι. Πυκνή ομίχλη κλείνει, η όχθη χάνεται, ακούγονται μόνο το κουπί και το νερό.
// Όταν η ομίχλη ανοίγει, είσαι στο κεφάλαιο III (στο K του χάρτη): στον κυρίως Κάτω Κόσμο.
// Ο παίκτης δεν κινείται (μόνο κοιτάζει γύρω του)· ο Χάροντας στέκεται μπροστά του και κωπηλατεί.
const CROSS_TIME = 16;        // δευτ. όλο το πέρασμα
const CROSS_FOG_IN = 3;       // η ομίχλη κλείνει σε τόσα δευτ.
const CROSS_FOG_OUT = 3.5;    // και ανοίγει στα τελευταία τόσα

const Crossing = {
  active: false,
  t0: 0,
  from: null,
  to: null,
  nextOar: 0,

  start(now) {
    if (!Level.landing || Charon.gate < 0) return false;
    this.active = true;
    this.t0 = now;
    this.from = { x: Charon.x, y: Charon.y };
    this.to = { x: Level.landing.x, y: Level.landing.y - TILE };
    this.nextOar = now + 1.2;
    player.x = this.from.x;
    player.y = this.from.y;
    stopInput();
    return true;
  },

  // 0..1: πόσο πυκνή είναι τώρα η ομίχλη.
  fog(now) {
    if (!this.active) return 0;
    const k = now - this.t0;
    return Math.max(0, Math.min(1, k / CROSS_FOG_IN, (CROSS_TIME - k) / CROSS_FOG_OUT));
  },

  update(dt, now) {
    const k = Math.min(1, (now - this.t0) / CROSS_TIME);
    const e = k * k * (3 - 2 * k);
    player.x = this.from.x + (this.to.x - this.from.x) * e;
    player.y = this.from.y + (this.to.y - this.from.y) * e + Math.sin(now * 1.7) * 1.2;
    player.walkPhase += dt * 1.2;
    player.walkSpeed = 0.25;   // η βάρκα λικνίζεται
    if (now >= this.nextOar && k < 0.95) {
      this.nextOar = now + 2.1;
      Sound.oar();
    }
    // Ομίχλη: ο κόσμος σβήνει πολύ πιο κοντά.
    const f = this.fog(now);
    Raycast.fogDist = RC_FOG * (1 - 0.86 * f);
    Raycast.fogMin = 0.3 * (1 - f);
    if (k >= 1) this.finish();
  },

  finish() {
    this.active = false;
    Raycast.fogDist = RC_FOG;
    Raycast.fogMin = 0.3;
    player.x = Level.landing.x;
    player.y = Level.landing.y;
    Level.pushOutOfWalls(player);
    Echoes.emit(player.x, player.y, 260, 0.7, 'call');
  },

  // Ο Χάροντας μπροστά σου στη βάρκα (billboard), όσο κρατάει το πέρασμα.
  sprites(R, now) {
    if (!this.active) return;
    const dx = this.to.x - this.from.x, dy = this.to.y - this.from.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const x = player.x + ux * 58, y = player.y + uy * 58;
    const right = -Math.sin(player.angle) * ux + Math.cos(player.angle) * uy;
    R.sprite(Sprites.getHD('charon3d', 0), { x, y, z: 2 + Math.sin(now * 1.7) * 1.2, scale: 0.37, flip: right < 0, alpha: 0.95, fog: false });
  },

  // Η ομίχλη πάνω από τον κόσμο: θαμπό, ζεστό γκρι-καφέ, με "κύματα" που περνάνε αργά.
  drawOverlay(pc, W, H, now) {
    const f = this.fog(now);
    if (f <= 0.01) return;
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalAlpha = 0.55 * f;
    pc.fillStyle = 'rgb(92,66,42)';
    pc.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const y = H * (0.25 + i * 0.12), x = ((now * (6 + i * 3) + i * 97) % (W * 1.6)) - W * 0.3;
      const g = pc.createRadialGradient(x, y, 0, x, y, W * 0.4);
      g.addColorStop(0, 'rgba(128,100,66,' + (0.35 * f).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(128,100,66,0)');
      pc.globalAlpha = 1;
      pc.fillStyle = g;
      pc.fillRect(x - W * 0.4, y - W * 0.4, W * 0.8, W * 0.8);
    }
    pc.restore();
  },
};
