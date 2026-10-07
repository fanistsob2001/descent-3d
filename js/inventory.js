'use strict';

// Στάδιο 4 της επέκτασης (STORY.md, ενότητα 12): υλικά και αντικείμενα που φτιάχνεις στα ιερά του Ερμή
// (Inventory), κιβώτια που τρίζουν όταν τα ανοίγεις (Chests), κρυψώνες όπου κρατάς την ανάσα σου (Hides).
// Τα ονόματα / μηνύματα: STORY.materials, STORY.tools κ.λπ.

const MATERIALS = ['clay', 'wine', 'honey', 'poppy', 'bronze', 'thread', 'resin', 'wax'];
// Τι φτιάχνεται από τι (δύο υλικά το καθένα).
const RECIPES = [
  { id: 'jar', needs: ['clay', 'wine'] },
  { id: 'cake', needs: ['honey', 'poppy'] },
  { id: 'bell', needs: ['bronze', 'thread'] },
  { id: 'lyreResin', needs: ['resin', 'wax'] },
];
// Τα αντικείμενα που "κρατάς" και χρησιμοποιείς με το E (με τη σειρά των πλήκτρων 1-4).
const TOOL_ORDER = ['jar', 'pebble', 'cake', 'bell'];

const CHEST_REACH = 34;       // τόσο κοντά = "Open"
const HIDE_REACH = 30;
const BREATH_TIME = 6;        // δευτ. που κρατάς την ανάσα σου όταν μια σκιά είναι κοντά
const BREATH_NEAR = 240;      // τόσο κοντά = η σκιά σε "ψάχνει" (η ανάσα αδειάζει)

const Inventory = {
  mats: {},
  pebbles: 0,
  cakes: 0,
  bells: 0,
  sel: 'jar',
  opened: new Set(),    // id των κιβωτίων που άνοιξες
  maps: new Set(),      // κεφάλαια των οποίων βρήκες τον χάρτη
  tablets: new Set(),   // οι πινακίδες που διάβασες (STORY.tablets[n]) — ξαναδιαβάζονται στο Inventory

  reset(saved) {
    const inv = saved.inv || {};
    this.mats = {};
    for (const m of MATERIALS) this.mats[m] = Number.isInteger(inv.mats && inv.mats[m]) ? inv.mats[m] : 0;
    this.pebbles = inv.pebbles | 0;
    this.cakes = inv.cakes | 0;
    this.bells = inv.bells | 0;
    this.sel = TOOL_ORDER.includes(inv.sel) ? inv.sel : 'jar';
    this.opened = new Set(Array.isArray(inv.opened) ? inv.opened : []);
    this.maps = new Set(Array.isArray(inv.maps) ? inv.maps : []);
    this.tablets = new Set(Array.isArray(inv.tablets) ? inv.tablets : []);
  },

  saveData() {
    return { inv: { mats: { ...this.mats }, pebbles: this.pebbles, cakes: this.cakes, bells: this.bells, sel: this.sel, opened: [...this.opened], maps: [...this.maps], tablets: [...this.tablets] } };
  },

  count(t) {
    return t === 'jar' ? Jars.left : t === 'pebble' ? this.pebbles : t === 'cake' ? this.cakes : t === 'bell' ? this.bells : 0;
  },

  // Επόμενο / προηγούμενο αντικείμενο (μόνο όσα έχεις· αν δεν έχεις κανένα, μένει όπως είναι).
  cycle(dir) {
    const have = TOOL_ORDER.filter((t) => this.count(t) > 0);
    if (!have.length) return;
    const i = have.indexOf(this.sel);
    this.sel = have[((i < 0 ? 0 : i + dir) % have.length + have.length) % have.length];
  },

  canCraft(r) {
    if (r.id === 'lyreResin' && strings < 3) return false;
    return r.needs.every((m) => this.mats[m] > 0);
  },

  craft(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r || !this.canCraft(r)) return false;
    for (const m of r.needs) this.mats[m]--;
    if (id === 'jar') { Jars.left++; jarsFound = true; }
    else if (id === 'cake') this.cakes++;
    else if (id === 'bell') this.bells++;
    else if (id === 'lyreResin') Melody.uses++;
    if (id !== 'lyreResin' && this.count(this.sel) === 0) this.sel = id;
    return true;
  },
};

const Chests = {
  list: [],

  reset() {
    this.list = Level.chests.map((c, id) => ({
      id, x: c.x, y: c.y, region: c.region, map: c.map, opened: Inventory.opened.has(id),
      revealTime: -1e6, revealStrength: 0,
      onHear(wave, d, los) {
        if (!los) return;
        const s = Echoes.strengthAt(wave, d);
        if (s < this.revealStrength * Math.max(0, 1 - (Echoes.now - this.revealTime) / 3)) return;
        this.revealTime = Echoes.now;
        this.revealStrength = s;
      },
    }));
  },

  near(p) {
    let best = null, bd = CHEST_REACH;
    for (const c of this.list) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  // Ανοίγει: τρίζει (οι σκιές το ακούνε), και δίνει δύο υλικά (ένα ζευγάρι συνταγής, με τη σειρά), μερικές
  // φορές χαλίκια, και — στο σημαδεμένο κιβώτιο κάθε κεφαλαίου — τον χάρτη. Επιστρέφει το κείμενο.
  open(c, now) {
    c.opened = true;
    c.revealTime = now;
    c.revealStrength = 1;
    Inventory.opened.add(c.id);
    Echoes.emit(c.x, c.y, 170, 0.42, 'step');
    Sound.creak(c.x, c.y);
    const got = [];
    const a = MATERIALS[(c.id * 2) % MATERIALS.length], b = MATERIALS[(c.id * 2 + 1) % MATERIALS.length];
    for (const m of [a, b]) { Inventory.mats[m]++; got.push(STORY.materials[m]); }
    if (c.id % 3 === 0 || c.map) { Inventory.pebbles += 3; got.push(STORY.tools.pebble); }
    let text = STORY.chestInside(got.join(', '));
    if (c.map) { Inventory.maps.add(c.region); text = STORY.mapPiece + ' ' + text; }
    return text;
  },
};

const Hides = {
  list: [],
  active: null,       // η κρυψώνα όπου είσαι τώρα
  breath: 1,          // 0..1
  enteredAt: 0,

  reset() {
    this.list = Level.hides.map((h) => {
      // Η σαρκοφάγος ακουμπάει στον πιο κοντινό τοίχο.
      const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      const w = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dx, dy]) => Level.isOpaque(tx + dx, ty + dy)) || [0, -1];
      return { x: h.x, y: h.y, wx: w[0], wy: w[1], revealTime: -1e6, revealStrength: 0,
        onHear(wave, d, los) {
          if (!los) return;
          this.revealTime = Echoes.now;
          this.revealStrength = Math.max(0.5, Echoes.strengthAt(wave, d));
        } };
    });
    this.active = null;
    this.breath = 1;
  },

  near(p) {
    let best = null, bd = HIDE_REACH;
    for (const h of this.list) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  },

  enter(h, now) {
    this.active = h;
    this.enteredAt = now;
    player.x = h.x + h.wx * TILE * 0.2;
    player.y = h.y + h.wy * TILE * 0.2;
    // Κοιτάζεις έξω, μακριά από τον τοίχο.
    player.angle = Math.atan2(-h.wy, -h.wx);
    Sound.breath(true);
  },

  exit() {
    this.active = null;
    Sound.breath(false);
  },

  // Κάθε καρέ όσο είσαι κρυμμένος: η ανάσα αδειάζει όσο μια σκιά είναι κοντά και ξαναγεμίζει όταν φύγει.
  // Επιστρέφει true αν τελείωσε η ανάσα (λαχάνιασμα).
  update(dt, mons) {
    if (!this.active) {
      this.breath = Math.min(1, this.breath + dt / 3);
      return false;
    }
    const near = mons.some((m) => !m.isFrozen() && Math.hypot(m.x - player.x, m.y - player.y) < BREATH_NEAR);
    this.breath = near ? this.breath - dt / BREATH_TIME : Math.min(1, this.breath + dt / 3);
    return this.breath <= 0;
  },
};
