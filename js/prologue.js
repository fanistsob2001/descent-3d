'use strict';

// Ο πρόλογος (STORY.md, ενότητα 12): playable, στον πάνω κόσμο, στο φως της ημέρας — η μόνη φορά που ο
// παίκτης βλέπει τον κόσμο φωτισμένο. Είναι ένας δικός του μικρός κόσμος (5 "μπλοκ" χάρτη, όπως τα
// κεφάλαια), που φορτώνεται στη θέση του Κάτω Κόσμου (loadWorldData στο main.js) και στο τέλος δίνει τη
// θέση του πάλι σε αυτόν. Τα κείμενα: STORY.prologueObj / prologueEury / intro.
//
// Χάρτες: όπως στο levels.js ('#' βράχος / λόφοι, '.' χορτάρι, '~' νερό, '^' / 'v' σύνδεση μπλοκ, 'S' αφετηρία),
// και επιπλέον: '%' χαμηλή ξερολιθιά, '=' τοίχος σπιτιού (τα δύο τα ξέρει το Level), και μόνο για τον πρόλογο
// (το Level τα βλέπει ως δάπεδο): '_' δάπεδο σπιτιού (με ταβάνι), ',' χωματόδρομος, 'e' η Ευρυδίκη,
// 'U' η πηγή, 'f' λουλούδι (ασφόδελος), 'Y' κυπαρίσσι, 'O' ελιά, 'a' αμφορέας, 'k' εκεί που πέφτει η Ευρυδίκη,
// 'z' το φίδι, 'g' ο τάφος, 'n' / 'r' αφετηρία στον τάφο / στον δρόμο, 'm' το στόμιο του Ταινάρου,
// 'q' το πρώτο σκαλί.

const PROLOGUE_MAPS = [
  {
    // village
    theme: 'meadow', fade: 1.5,
    map: [
      '########################################',
      '#......................................#',
      '#...==========............==========...#',
      '#...=____t___=..O......Y..=________=...#',
      '#...=________=............=________=..Y#',
      '#...=________=..O.........=________=...#',
      '#...=====_====.......Y....====_=====...#',
      '#........,.......a.....a......,........#',
      '#........,............V.......,........#',
      '#....Y...,,,,,,,,,,,,,,W,,,,,,,.....O..#',
      '#...............a...,,.................#',
      '#...=====_====......,,....====_=====...#',
      '#...=________=......,,....=________=...#',
      '#...=________=.Y....,,....=___p____=...#',
      '#...=________=......,,....=________=...#',
      '#...==========......,,....==========...#',
      '#O................Y.,,.................#',
      '#...................,,.................#',
      '####################v###################',
    ],
  },
  {
    // road
    theme: 'meadow', fade: 1.5,
    map: [
      '####################^###################',
      '#...................,,.......O.........#',
      '#...................,,.................#',
      '#....O..............,,.................#',
      '#.O................,,...............%..#',
      '#..%..............,,................%..#',
      '#..%..O..........,,..O..............%..#',
      '#O.%.......O....,,..................%..#',
      '#..%...........,,...................%..#',
      '#..%..........,,....................%..#',
      '#..%..........,,......O.....O.......%..#',
      '#..%..........,,....................%..#',
      '#..%..........,,....................%..#',
      '#..%....O.....,,,.........O.........%..#',
      '#..%...........,,,,..........O......%..#',
      '#..%.............,,,,.....O.........%..#',
      '#..%...............,,,,.............%O.#',
      '#..%.................,,,,...........%..#',
      '#O.%...................,,,.........Y%..#',
      '#..%....O...............,,..........%..#',
      '#..%....................,,....O....Y%..#',
      '#..%....................,,..........%..#',
      '#O.%................O...,,.........O%..#',
      '#..%...................,,...........%..#',
      '#..%..................,,......Y.....%..#',
      '#.........O..........,,..Y........Y.%..#',
      '#O...O.........O....,,.....O...........#',
      '#...................,,.O......O.......Y#',
      '#...........Y.......,,.................#',
      '####################v###################',
    ],
  },
  {
    // home
    theme: 'meadow', fade: 1.5,
    map: [
      '####################^###################',
      '#...................,,.................#',
      '#...................,,.................#',
      '#....===================..%%%%%.%%%%%..#',
      '#....=________=________=..%.........%..#',
      '#....=__i_____=_____l__=..%.f....f..%..#',
      '#....=________=________=..%.........%..#',
      '#....=a_______=____e___=..%...f.....%..#',
      '#....=_________________=..%.........%..#',
      '#....=____S____________=..%f......f.%..#',
      '#....=________=___t____=..%....f....%..#',
      '#....=_p______=_______a=..%.........%..#',
      '#....=________=________=..%%%%%.%%%%%..#',
      '#....=========__========...............#',
      '#.............d,.,,....................#',
      '#...........O.,,.......................#',
      '#......O......,,......................O#',
      '#.............,,...........%%%%%%%%%%..#',
      '#....O..U.....,,,..........%........%..#',
      '#..............,,,.........%........%..#',
      '#...Y...........,,,,.......%..A.....%..#',
      '#.............O...,,,...............%.Y#',
      '#..........N.......,,,.....%........%..#',
      '#...................,,...O.%.....A..%..#',
      '#...................,,.....%........%..#',
      '#...................,,.....%%%%%%%%%%..#',
      '#...................,,...Y.............#',
      '#........Y..........,,.................#',
      '#...................,,.................#',
      '#.....O..Y..........,,.................#',
      '#...................,,...........Y...O.#',
      '####################v###################',
    ],
  },
  {
    // meadow
    theme: 'meadow', fade: 1.5,
    map: [
      '####################^###################',
      '#...................,,.................#',
      '#...................,,.................#',
      '#O..................,,.................#',
      '#...............Y...,,.................#',
      '#...................,,,..........#.....#',
      '#.......#............,,,...............#',
      '#....Y................,,...............#',
      '#.....................,,,..............#',
      '#......................,,,.............#',
      '#.......................,,.............#',
      '#.......................,,,.O..........#',
      '#........................,,.......Y....#',
      '#........................,,............#',
      '#Y.........O.Y...........,,,...........#',
      '#.........................k,..z........#',
      '#.........O.#........................O.#',
      '#..................................Y...#',
      '#........Y.............................#',
      '#......................................#',
      '#......................................#',
      '########################################',
    ],
  },
  {
    // grave
    theme: 'grave', fade: 1.5,
    map: [
      '##########################',
      '#........................#',
      '#..............Y.........#',
      '#......%%%%%%%%%%%%......#',
      '#....Y.%.......Y..%......#',
      '#......%....g.....%......#',
      '#...Y..%.I......I.%......#',
      '#......%..........%......#',
      '#......%..I....I..%......#',
      '#......%%%%%..%%%%%....Y.#',
      '#...................Y....#',
      '#..Y.....................#',
      '#..................Y.....#',
      '#........................#',
      '#...........n............#',
      '#........................#',
      '#........................#',
      '##########################',
    ],
  },
  {
    // taenarum
    theme: 'road', fade: 1.5,
    map: [
      '########################################',
      '#.~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#.~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#..~~~~~~~~~....~~~~~~~~~~~~~.....~~~~~#',
      '#....~~~~............~~~~~~..........~~#',
      '#r.....................................#',
      '#.....#..............#..........%%.....#',
      '#................................m.....#',
      '###############################....#####',
      '################################..######',
      '################################v#######',
    ],
  },
  {
    // steps
    theme: 'rock', fade: 1.5,
    map: [
      '#####^######',
      '#####.######',
      '####...#####',
      '####...#####',
      '#####.x#####',
      '####....####',
      '###......###',
      '###......###',
      '####....####',
      '#####..#####',
      '############',
    ],
  },
];

// Ο ουρανός και το φως κάθε μπλοκ (RC_OUTDOOR). Χωρίς μπλε: ο ουρανός του ελληνικού καλοκαιριού στην παλέτα
// του παιχνιδιού είναι ζεστός, θαμπός.
const SKY_DAY = { light: 1, sky: [[0, [168, 120, 40]], [0.5, [212, 190, 146]], [1, [236, 218, 186]]],
    sun: { az: -0.9, el: 0.55, r: 0.06, color: [255, 246, 228], glow: [255, 246, 228] }, hills: [[170, 142, 100], [128, 100, 66]] };
const SKY_AFTERNOON = { light: 0.92, sky: [[0, [158, 64, 30]], [0.5, [232, 138, 54]], [1, [248, 182, 100]]],
    sun: { az: 0.4, el: 0.2, r: 0.07, color: [255, 246, 228], glow: [248, 182, 100] }, hills: [[170, 142, 100], [128, 100, 66]] };
const SKY_DUSK = { light: 0.6, sky: [[0, [48, 16, 12]], [0.45, [124, 36, 25]], [0.8, [198, 98, 40]], [1, [232, 138, 54]]],
    sun: { az: -1.57, el: 0.03, r: 0.08, color: [248, 182, 100], glow: [232, 138, 54] }, hills: [[96, 26, 19], [70, 20, 15]] };
const SKY_NIGHT = { light: 0.34, stars: true, sky: [[0, [0, 0, 0]], [0.7, [16, 7, 5]], [1, [38, 24, 15]]],
    sun: { az: -1.2, el: 0.45, r: 0.035, color: [236, 218, 186], glow: [62, 40, 25] }, hills: [[30, 12, 9], [16, 7, 5]] };
// Τα μπλοκ: 0 χωριό, 1 δρόμος, 2 σπίτι, 3 λιβάδι (ενωμένα), 4 τάφος, 5 δρόμος του Ταινάρου, 6 σκαλιά.
const PRO_MEADOW = 3, PRO_STEPS = 6;
const PROLOGUE_SKY = { 0: SKY_DAY, 1: SKY_DAY, 2: SKY_DAY, 3: SKY_AFTERNOON, 4: SKY_DUSK, 5: SKY_NIGHT };
// Πόσο φωτεινές είναι οι μορφές σε κάθε μπλοκ (μέρα → νύχτα).
const PROLOGUE_DIM = [1, 1, 1, 0.94, 0.66, 0.42, 0.5];

const EURY_SPEED = 52;
const PRO_NEAR = 70;        // τόσο κοντά = "μιλάς" με την Ευρυδίκη
const PRO_PICK = 20;        // τόσο κοντά = μαζεύεις λουλούδι

const Prologue = {
  active: false,
  loaded: false,        // ο κόσμος του προλόγου είναι φορτωμένος (και μετά τα τέλη, ώσπου να βγεις στο μενού)
  mode: 'prologue',     // 'prologue' | 'good' | 'bad' (τα τέλη: STORY.md, ενότητα 12)
  turnReady: false,
  step: '',
  stepAt: 0,
  objective: '',
  marks: {},            // θέσεις από τους χάρτες: spring, eury, lie, snake, grave, graveStart, roadStart, mouth, slip
  props: [],            // { name, frame, x, y, scale }
  flowers: [],          // { x, y, taken }
  picked: 0,
  hasWater: false,
  lookedAt: false,
  eury: null,           // { x, y, mode: 'idle' | 'walk' | 'follow' | 'lying' | 'gone', path, dist, face, target }
  snake: null,          // { x, y, t0, a }
  fade: { from: 0, to: 0, t0: 0, dur: 1 },
  lock: false,          // ο παίκτης δεν κινείται (σκηνές)
  noLyre: false,        // η λύρα έσπασε (δεν φαίνονται τα χέρια)
  strings: [],          // οι χορδές που "φεύγουν" στο σκοτάδι: { x, y, z, vx, vy, vz }
  timers: [],           // [{ at, fn }]
  _dim: new Map(),

  // ---- Έναρξη / τέλος ----
  start() {
    this.mode = 'prologue';
    this.setupWorld(PROLOGUE_SKY);
    this.beginPlay(Level.start, Math.PI / 2);
    this.setStep('find');
    Sound.nature('day');
    Hints.start(CHAPTERS[0].hints.filter((h) => h.until === 'move'), gameTime);
  },

  // Φορτώνει τον πάνω κόσμο (πρόλογος ή τέλος) και διαβάζει τα σημάδια των χαρτών.
  setupWorld(sky) {
    this.active = true;
    this.loaded = true;
    document.body.classList.add('prologue');
    loadWorldData(PROLOGUE_MAPS, sky);
    const L = Level;
    // Οι ειδικοί χαρακτήρες του προλόγου, από τους χάρτες (με τη θέση κάθε μπλοκ στον κόσμο).
    this.marks = {};
    this.props = [];
    this.flowers = [];
    this.goats = [];
    this.hasWine = false;
    const ambientCave = [];
    PROLOGUE_MAPS.forEach((b, r) => {
      b.map.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          const tx = L.blockX[r] + x, ty = L.blockY[r] + y, c = ty * L.cols + tx;
          const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
          const ch = line[x];
          if (ch === '_') {
            // Μέσα στο σπίτι: πήλινα πλακάκια, ταβάνι με δοκάρια, λιγότερο φως.
            Raycast.cellFloor[c] = Raycast.tex.floor[(tx * 7 + ty * 13) & 3];
            Raycast.cellCeil[c] = Raycast.tex.beams;
            Raycast.ceilOn[c] = 1;
            Raycast.ambient[c] = 0.62;
          }
          if (ch === ',') Raycast.cellFloor[c] = Raycast.tex.dirt;
          const block = (name, frame, scale) => { this.props.push({ name, frame, x: cx, y: cy, scale }); L.grid[c] = 1; };
          if (ch === 'Y') block('cypress', 0, 1);
          if (ch === 'O') block('olive', (tx + ty) & 1, 1);
          if (ch === 'a') block('amphora', 0, 0.85);
          if (ch === 'g') { block('stele', 0, 0.75); this.marks.grave = { x: cx, y: cy }; }
          if (ch === 'f') this.flowers.push({ x: cx + (Math.sin(c) * 6), y: cy + (Math.cos(c) * 6), taken: false });
          // Το σπίτι, η αυλή, το χωριό, η κηδεία.
          if (ch === 'i') { block('hearth', 0, 0.8); this.hearth = { x: cx, y: cy }; }
          if (ch === 'l') block('loom', 0, 0.75);
          if (ch === 't') block('table', 0, 0.75);
          if (ch === 'p') block('bed', 0, 0.75);
          if (ch === 'N') block('laundry', 0, 0.75);
          if (ch === 'U') block('well', 0, 0.75);
          if (ch === 'V') { block('villager', 0, 0.39); this.villager = this.props[this.props.length - 1]; }
          if (ch === 'W') block('amphora', 0, 0.85);
          if (ch === 'I') block((tx + ty) & 1 ? 'mournerF' : 'mournerM', 0, 0.39);
          if (ch === 'A') this.goats.push({ x: cx, y: cy, hx: cx, hy: cy, t: Math.random() * 10 });
          const names = { U: 'well', e: 'eury', k: 'lie', z: 'snake', n: 'graveStart', r: 'roadStart', m: 'mouth', x: 'slip', d: 'door', W: 'wine', V: 'oldman' };
          if (names[ch]) this.marks[names[ch]] = { x: cx, y: cy };
          // Στα σκαλιά: λίγο φως του φεγγαριού από το στόμιο, που σβήνει προς τα κάτω.
          if (r === PRO_STEPS && !L.opaque[c]) ambientCave.push([c, Math.max(0, 0.22 - y * 0.03)]);
        }
      });
    });
    for (const [c, a] of ambientCave) Raycast.ambient[c] = a;
    this.picked = 0;
    this.hasWater = false;
    this.lookedAt = false;
    this.noLyre = false;
    this.lock = false;
    this.strings = [];
    this.timers = [];
    this.snake = null;
    this.eury = { x: this.marks.eury.x, y: this.marks.eury.y, mode: 'idle', path: [], dist: 0, face: 1, target: null, stepDist: 0 };
    this.fade = { from: 1, to: 0, t0: gameTime, dur: 2.5 };
    this.turnReady = false;
    this.slipAt = 0;
  },

  // Ο παίκτης στη θέση at, με ολόκληρη τη λύρα, και τα υπόλοιπα του Κάτω Κόσμου άδεια.
  beginPlay(at, angle) {
    const L = Level;
    Echoes.init();
    Echoes.markSeen = false;
    Echoes.listeners = [];
    monsters = [];
    killer = null;
    chapter = -1;
    strings = 3;
    hasObol = false;
    jarsFound = false;
    ExitDoor.reset();
    Altars.reset(-1);
    Items.reset([]);
    Charon.reset(false);
    Jars.reset(0);
    Melody.reset(0);
    Souls.reset();
    Eggs.reset();
    World3D.reset();
    Missions.reset(Save.fresh());
    Inventory.reset(Save.fresh());
    Chests.reset();
    Hides.reset();
    Eurydice.reset('none', Level.start);
    Notice.clear();
    Chases.reset();
    Throne.reset(true);
    player.x = camera.x = at.x;
    player.y = camera.y = at.y;
    player.angle = angle;
    player.fx = Math.cos(angle); player.fy = Math.sin(angle);
    player.pitch = 0;
    void L;
    stopInput();
    Dread.reset();
    setState('play');
    showScreen(null);
  },

  // ---- Τα τέλη (playable): βγαίνεις στο φως, και είναι το λιβάδι του προλόγου ----
  startEnding(good) {
    this.mode = good ? 'good' : 'bad';
    const sky = good ? SKY_DAY : SKY_DUSK;
    this.setupWorld({ 0: sky, 1: sky, 2: sky, 3: sky, 4: SKY_DUSK, 5: SKY_NIGHT });
    for (const f of this.flowers) f.taken = true;
    if (!good) this.props.find((q) => q.name === 'stele').frame = 1;
    this.beginPlay({ x: this.marks.lie.x, y: this.marks.lie.y + TILE }, -Math.PI / 2);
    this.eury.mode = good ? 'behind' : 'gone';
    Sound.nature(good ? 'day' : 'dusk');
    this.setStep('');
    this.objective = STORY.goHome;
    updateHud();
    const L = good ? STORY.good : STORY.bad;
    showNarration(L[0]);
    this.after(4.5, () => showNarration(L[1]));
    if (!good) this.after(9, () => showNarration(L[2]));
    this.endStep = 'home';
  },

  // Η προτροπή του τέλους ("Turn around").
  prompt() {
    return this.mode === 'good' && this.turnReady ? STORY.prompts.turn : '';
  },

  // E στο τέλος: γυρίζεις — για πρώτη φορά επιτρέπεται — και τη βλέπεις.
  interact() {
    if (this.mode !== 'good' || !this.turnReady) return;
    this.turnReady = false;
    this.turnFrom = player.angle;
    this.turnAt = gameTime;
    const e = this.eury;
    e.mode = 'stand';
    const L = STORY.good;
    this.after(1.6, () => showNarration(L[3]));
    this.after(6.2, () => showNarration(L[4]));
    this.after(10.8, () => showNarration(L[5]));
    this.after(14.5, () => this.fadeTo(1, 2.5));
    this.after(17.5, () => this.finishEnding());
  },

  updateEnding(dt, now) {
    const p = player, e = this.eury;
    // Πίσω σου, πάντα έξω από το βλέμμα σου (δεν μπορείς να τη δεις ώσπου να γυρίσεις στην πόρτα).
    if (e.mode === 'behind') {
      e.x = p.x - Math.cos(p.angle) * 40;
      e.y = p.y - Math.sin(p.angle) * 40;
      e.moving = false;
    }
    if (this.turnAt) {
      const k = Math.min(1, (now - this.turnAt) / 1.3);
      p.angle = this.turnFrom + Math.PI * (k * k * (3 - 2 * k));
      p.fx = Math.cos(p.angle); p.fy = Math.sin(p.angle);
      if (k >= 1) this.turnAt = 0;
    }
    const door = this.marks.door;
    if (this.endStep === 'home' && Math.hypot(door.x - p.x, door.y - p.y) < 55) {
      this.endStep = 'door';
      this.lock = true;
      this.objective = '';
      updateHud();
      if (this.mode === 'good') {
        showNarration(STORY.good[2]);
        this.after(3.5, () => { this.turnReady = true; });
      } else {
        // Το σπίτι είναι άδειο. Μετά, ο τάφος της.
        showNarration(STORY.bad[3]);
        this.after(5, () => this.fadeTo(1, 2));
        this.after(7.2, () => {
          this.teleport(this.marks.graveStart, -Math.PI / 2);
          this.fadeTo(0, 2.5);
          this.lock = false;
          this.objective = STORY.playAtGrave;
          this.endStep = 'grave';
          updateHud();
        });
      }
    }
  },

  finishEnding() {
    const good = this.mode === 'good';
    this.active = false;
    document.body.classList.remove('prologue');
    Sound.nature(null);
    setState('end');
    showScreen(good ? 'endGood' : 'endBad');
  },

  // Τέλος του προλόγου (ή Skip): πίσω ο Κάτω Κόσμος, και το παιχνίδι ξεκινάει από το κεφάλαιο I.
  finish() {
    this.active = false;
    this.loaded = false;
    document.body.classList.remove('prologue');
    Sound.nature(null);
    Voice.stop();
    loadWorldData(CHAPTERS);
    strings = 0;
    spawn(Save.fresh());
  },

  // Βγήκε στο μενού στη μέση του προλόγου: ξαναφορτώνεται ο Κάτω Κόσμος (για τη σκηνή του μενού).
  abort() {
    if (!this.loaded) return;
    this.loaded = false;
    this.active = false;
    document.body.classList.remove('prologue');
    Sound.nature(null);
    Voice.stop();
    loadWorldData(CHAPTERS);
    strings = 0;
  },

  setStep(s) {
    this.step = s;
    this.stepAt = gameTime;
    const O = STORY.prologueObj;
    this.objective = { find: O.find, water: O.water, bring: O.bring, play: O.play, flowers: O.flowers(this.picked),
      wine: O.wine, run: O.run, grave: O.grave, road: O.road }[s] || '';
    updateHud();
  },

  after(sec, fn) {
    this.timers.push({ at: gameTime + sec, fn });
  },

  // Η Ευρυδίκη μιλάει (φωνή + υπότιτλος). Επιστρέφει πόσο κρατάει.
  say(key, then) {
    const text = STORY.prologueEury[key];
    const d = Voice.say(text, 'eurydice', { x: this.eury.x, y: this.eury.y });
    Notice.show(text, gameTime, Math.max(3, d + 0.8));
    if (then) this.after(Math.max(3, d + 0.8) + 0.3, then);
    return d;
  },

  // Αφήγηση στη μέση της οθόνης (οι γραμμές του intro).
  narrate(i) {
    showNarration(STORY.intro[i]);
  },

  fadeTo(to, dur) {
    this.fade = { from: this.fadeAlpha(gameTime), to, t0: gameTime, dur };
  },
  fadeAlpha(now) {
    const f = this.fade, k = Math.min(1, (now - f.t0) / f.dur);
    return f.from + (f.to - f.from) * k;
  },

  teleport(m, angle) {
    player.x = camera.x = m.x;
    player.y = camera.y = m.y;
    player.angle = angle;
    player.pitch = 0;
  },

  // Ο παίκτης έπαιξε λύρα (κύμα). charge = 0..1.
  onCall(charge) {
    if (this.active && this.mode === 'bad' && this.endStep === 'grave' && Math.hypot(this.marks.grave.x - player.x, this.marks.grave.y - player.y) < 140) {
      // Παίζεις στον τάφο της. Τίποτα δεν απαντάει.
      this.endStep = 'played';
      this.objective = '';
      updateHud();
      this.after(2.5, () => showNarration(STORY.bad[4]));
      this.after(7.5, () => this.fadeTo(1, 2.5));
      this.after(10.5, () => this.finishEnding());
      return;
    }
    if (!this.active || this.step !== 'play') return;
    if (Math.hypot(this.eury.x - player.x, this.eury.y - player.y) > 180 || charge < 0.25) return;
    this.setStep('');
    this.after(1.4, () => this.say('played', () => this.say('askFlowers', () => {
      this.eury.mode = 'follow';
      this.setStep('flowers');
    })));
  },

  // ---- Κάθε καρέ ----
  update(dt, now) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (now >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    }
    Sound.natureTick(now);
    if (this.mode !== 'prologue') { this.updateEnding(dt, now); return; }
    const e = this.eury, p = player;
    const dE = Math.hypot(e.x - p.x, e.y - p.y);

    if (this.step === 'find' && dE < PRO_NEAR) {
      this.setStep('');
      this.say('greet', () => this.setStep('water'));
    } else if (this.step === 'water' && Math.hypot(this.marks.well.x - p.x, this.marks.well.y - p.y) < 62) {
      this.hasWater = true;
      Sound.drip(this.marks.well.x, this.marks.well.y);
      Sound.jarPickup();
      this.setStep('bring');
    } else if (this.step === 'bring' && dE < PRO_NEAR) {
      this.setStep('');
      this.say('water', () => this.say('askPlay', () => {
        this.setStep('play');
        Hints.start(CHAPTERS[0].hints.filter((h) => h.until === 'call'), gameTime);
      }));
    } else if (this.step === 'flowers') {
      for (const f of this.flowers) {
        if (f.taken || Math.hypot(f.x - p.x, f.y - p.y) > PRO_PICK) continue;
        f.taken = true;
        this.picked++;
        Sound.pluck(523 + this.picked * 60, Sound.ctx ? Sound.ctx.currentTime : 0, 0.12);
        this.setStep('flowers');
        if (this.picked >= 3) {
          this.setStep('');
          this.after(0.6, () => this.say('flowers', () => this.say('goVillage', () => {
            // Σε στέλνει στο χωριό· εκείνη κατεβαίνει στο λιβάδι.
            e.mode = 'walk';
            e.target = this.marks.lie;
            e.path = null;
            this.setStep('wine');
          })));
        }
        break;
      }
      // Αν γυρίσεις και την κοιτάξεις όσο σε ακολουθεί (εδώ επιτρέπεται).
      if (!this.lookedAt && e.mode === 'follow' && dE < 130 && dE > 20 && now - this.stepAt > 3) {
        let a = Math.atan2(e.y - p.y, e.x - p.x) - p.angle;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) < 0.3 && !Notice.busy(now)) { this.lookedAt = true; this.say('lookAt'); }
      }
    } else if (this.step === 'wine' && Math.hypot(this.marks.wine.x - p.x, this.marks.wine.y - p.y) < 60) {
      // Στο χωριό: παίρνεις το κρασί, ο γέρος σε χαιρετάει — και από μακριά, η κραυγή.
      this.setStep('');
      this.hasWine = true;
      Sound.jarPickup();
      const ol = this.marks.oldman;
      const d = Voice.say(STORY.villagerWine, 'soulOld', { x: ol.x, y: ol.y });
      Notice.show(STORY.villagerWine, now, Math.max(3.5, d + 0.8));
      this.after(Math.max(4.5, d + 1.5), () => this.scream());
    } else if (this.step === 'run' && Math.hypot(this.marks.lie.x - p.x, this.marks.lie.y - p.y) < 75) {
      this.setStep('');
      this.lock = true;
      this.snake.leaveAt = now;
      Sound.hiss(this.snake.x, this.snake.y);
      this.narrate(0);
      this.after(4.5, () => this.narrate(1));
      this.after(8.5, () => this.fadeTo(1, 2));
      this.after(11, () => {
        e.mode = 'gone';
        this.teleport(this.marks.graveStart, -Math.PI / 2);
        Sound.nature('dusk');
        this.fadeTo(0, 2.5);
        this.lock = false;
        this.setStep('grave');
      });
    } else if (this.step === 'grave' && Math.hypot(this.marks.grave.x - p.x, this.marks.grave.y - p.y) < 55) {
      this.setStep('');
      this.lock = true;
      this.props.find((q) => q.name === 'stele').frame = 1;
      Sound.pluck(392, Sound.ctx ? Sound.ctx.currentTime : 0, 0.15);
      this.narrate(2);
      this.after(5, () => this.narrate(3));
      this.after(9, () => this.fadeTo(1, 2));
      this.after(11.5, () => {
        this.teleport(this.marks.roadStart, 0);
        Sound.nature('night');
        this.fadeTo(0, 2.5);
        this.lock = false;
        this.setStep('road');
      });
    } else if (this.step === 'road' && Math.hypot(this.marks.mouth.x - p.x, this.marks.mouth.y - p.y) < 60) {
      this.setStep('descend');
      this.narrate(4);
    } else if (this.step === 'descend' && Math.hypot(this.marks.slip.x - p.x, this.marks.slip.y - p.y) < 34) {
      this.slip();
    }

    this.updateEury(dt, now);
    // Το φίδι φεύγει σέρνοντας μέσα στο χορτάρι.
    if (this.snake && this.snake.leaveAt) {
      const k = now - this.snake.leaveAt;
      this.snake.x += 38 * dt;
      this.snake.a = Math.max(0, 1 - k / 3);
    }
    // Οι χορδές πετάνε μακριά και σβήνουν.
    for (const s of this.strings) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.vz -= 6 * dt;
      s.a = Math.max(0, s.a - dt * 0.18);
    }
    // Στο γλίστρημα: το βλέμμα πέφτει, η κάμερα κουνιέται.
    if (this.slipAt) {
      const k = now - this.slipAt;
      if (k < 0.6) player.pitch = Math.max(-PITCH_MAX, player.pitch - dt * 2.4);
      if (k > 1.2 && k < 4) player.pitch += (0 - player.pitch) * Math.min(1, dt * 1.5);
    }
  },

  scream() {
    const e = this.eury, now = gameTime;
    e.mode = 'lying';
    e.x = this.marks.lie.x;
    e.y = this.marks.lie.y;
    this.snake = { x: this.marks.snake.x, y: this.marks.snake.y, t0: now, a: 1, leaveAt: 0 };
    // Είναι πολύ μακριά: η κραυγή ακούγεται από την κατεύθυνσή της, σιγανή (από ένα σημείο προς τα εκεί).
    const dx = e.x - player.x, dy = e.y - player.y, dd = Math.hypot(dx, dy) || 1, far = Math.min(dd, 520);
    const sx = player.x + (dx / dd) * far, sy = player.y + (dy / dd) * far;
    Sound.scream(sx, sy);
    const text = STORY.prologueEury.scream;
    Voice.say(text, 'eurydice', { x: sx, y: sy, delay: 0.3 });
    Notice.show(text, now, 3);
    this.setStep('run');
  },

  // Το πρώτο σκαλί: γλιστράς, η λύρα σπάει, οι χορδές σκορπίζουν, όλα σβήνουν.
  slip() {
    this.setStep('');
    this.lock = true;
    this.slipAt = gameTime;
    this.noLyre = true;
    Sound.slip();
    vibrate([120, 40, 200]);
    const p = player;
    for (let k = 0; k < 3; k++) {
      const a = p.angle + (k - 1) * 0.5;
      this.strings.push({ x: p.x + Math.cos(p.angle) * 14, y: p.y + Math.sin(p.angle) * 14, z: 14, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, vz: 4 + k * 2, a: 1 });
    }
    this.narrate(5);
    this.after(4.5, () => this.narrate(6));
    this.after(7, () => {
      // Το φως του φεγγαριού σβήνει: σκοτάδι.
      for (let c = 0; c < Raycast.ambient.length; c++) if (Level.region[c] === PRO_STEPS) Raycast.ambient[c] = 0;
      this.fadeTo(1, 3);
    });
    this.after(9, () => this.narrate(7));
    this.after(13.5, () => this.narrate(8));
    this.after(18, () => this.finish());
  },

  // Η Ευρυδίκη: στέκεται (σε κοιτάζει), περπατάει σε έναν στόχο, σε ακολουθεί.
  updateEury(dt, now) {
    const e = this.eury, p = player;
    let goal = null, stopAt = 0;
    if (e.mode === 'follow') { goal = p; stopAt = 46; }
    else if (e.mode === 'walk') { goal = e.target; stopAt = 4; }
    if (!goal) { e.moving = false; return; }
    const d = Math.hypot(goal.x - e.x, goal.y - e.y);
    if (d <= stopAt) {
      e.moving = false;
      if (e.mode === 'walk') { e.mode = 'arrived'; e.arrivedAt = now; }
      return;
    }
    // Διαδρομή (BFS) κάθε μισό δευτ.: κελί-κελί προς τον στόχο.
    if (!e.path || now - (e.pathAt || 0) > 0.5) {
      e.pathAt = now;
      e.path = Level.findPath(Math.floor(e.x / TILE), Math.floor(e.y / TILE), Math.floor(goal.x / TILE), Math.floor(goal.y / TILE));
    }
    let tx = goal.x, ty = goal.y;
    if (e.path && e.path.length > 1) {
      const [cx, cy] = e.path[0];
      tx = (cx + 0.5) * TILE; ty = (cy + 0.5) * TILE;
      if (Math.hypot(tx - e.x, ty - e.y) < 6) e.path.shift();
    }
    const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
    const sp = Math.min(EURY_SPEED * (e.mode === 'follow' && d > 140 ? 1.8 : 1) * dt, len);
    e.x += (dx / len) * sp;
    e.y += (dy / len) * sp;
    e.dirX = dx / len; e.dirY = dy / len;
    e.moving = true;
    e.dist += sp;
    e.stepDist += sp;
    if (e.stepDist > 26) {
      e.stepDist = 0;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 320) Sound.softStep(e.x, e.y);
    }
  },

  // ---- Μορφές (billboards), από το World3D.draw ----
  // Σκοτεινότερο αντίγραφο ενός καρέ (σούρουπο / νύχτα), μία φορά για κάθε επίπεδο φωτός.
  dim(fr, k) {
    if (k > 0.97) return fr;
    const q = Math.round(k * 20) / 20;
    let m = this._dim.get(fr);
    if (!m) this._dim.set(fr, (m = {}));
    if (!m[q]) {
      const mk = (src) => {
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        const x = c.getContext('2d');
        x.filter = 'brightness(' + q + ')';
        x.drawImage(src, 0, 0);
        return c;
      };
      m[q] = { ...fr, c: mk(fr.c), f: mk(fr.f) };
    }
    return m[q];
  },

  sprites(R, now) {
    const S = (name, i) => Sprites.getHD(name, i);
    const reg = Level.regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    const k = PROLOGUE_DIM[Math.max(0, reg)] || 1;
    const D = (fr) => this.dim(fr, k);
    const near = (o) => Math.abs(o.x - player.x) < TILE * 26 && Math.abs(o.y - player.y) < TILE * 26;
    // Στο ύπαιθρο τίποτα δεν σβήνει με την απόσταση (fog: false): είναι μέρα.
    for (const q of this.props) if (near(q)) R.sprite(D(S(q.name, q.frame)), { x: q.x, y: q.y, scale: q.scale, fog: false });
    // Η φωτιά στο τζάκι (η ίδια φλόγα με τους βωμούς).
    if (this.hearth && near(this.hearth) && this.mode === 'prologue') {
      World3D.drawFlame(now);
      R.sprite(World3D.flame, { x: this.hearth.x, y: this.hearth.y, z: 4, h: 24, add: true, fog: false, glow: { r: 40, color: '255,160,70', a: 0.35 } });
    }
    // Οι κατσίκες: βόσκουν, σηκώνουν το κεφάλι, κάνουν λίγα βήματα.
    for (const g of this.goats) {
      g.t += 1 / 60;
      const k2 = Math.sin(g.t * 0.3);
      g.x = g.hx + k2 * 14;
      const right = -Math.sin(player.angle) * Math.cos(g.t * 0.3) + Math.cos(player.angle) * 0;
      if (near(g)) R.sprite(D(S('goat', Math.sin(g.t * 1.1) > 0.6 ? 1 : 0)), { x: g.x, y: g.y, scale: 0.42, fog: false, flip: right < 0 });
    }
    for (const f of this.flowers) if (!f.taken && near(f)) R.sprite(D(S('asphodel', 0)), { x: f.x, y: f.y, scale: 1.1, fog: false, glow: { r: 10, color: '255,246,228', a: 0.25 } });
    // Η Ευρυδίκη.
    const e = this.eury;
    if (e && e.mode !== 'gone' && e.mode !== 'behind') {
      if (e.mode === 'lying') {
        R.sprite(D(S('euryLying', 0)), { x: e.x, y: e.y, scale: 0.39, fog: false });
      } else {
        // Κοιτάζει προς τα εκεί που πάει (ή προς εσένα όταν στέκεται): καθρέφτισμα ως προς την κάμερα.
        const fx = e.moving ? e.dirX : player.x - e.x, fy = e.moving ? e.dirY : player.y - e.y;
        const right = -Math.sin(player.angle) * fx + Math.cos(player.angle) * fy;
        const frame = e.moving ? 1 + (Math.floor(e.dist / 14) % 2) : 0;
        R.sprite(D(S('euryAlive', frame)), { x: e.x, y: e.y, scale: 0.39, flip: right < 0, fog: false });
      }
    }
    // Το φίδι.
    const s = this.snake;
    if (s && s.a > 0.01) R.sprite(D(S('snake3d', s.leaveAt ? 0 : 1)), { x: s.x, y: s.y, scale: 0.36, alpha: s.a, flip: true });
    // Οι χορδές που φεύγουν: λεπτές γραμμές φωτός.
    for (const st of this.strings) {
      if (st.a < 0.02) continue;
      R.sprite(S('stringLoose', Math.floor(now * 6 + st.vx) % 2), { x: st.x, y: st.y, z: Math.max(0, st.z), scale: 0.45, alpha: st.a, add: true, fog: false,
        glow: { r: 12, color: '255,220,150', a: 0.4 * st.a } });
    }
  },

  // Σβήσιμο από / προς το μαύρο (πάνω από τον κόσμο, πριν από την παλέτα).
  drawOverlay(pc, W, H, now) {
    const a = this.fadeAlpha(now);
    if (a <= 0.01) return;
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.globalAlpha = Math.min(1, a);
    pc.fillStyle = '#000';
    pc.fillRect(0, 0, W, H);
    pc.restore();
  },
};
