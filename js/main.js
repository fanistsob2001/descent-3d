'use strict';

// ---- Ρυθμίσεις παίκτη / ήχων ----
const PLAYER_RADIUS = 7;
const RUN_SPEED = 115;             // γρήγορο περπάτημα, μονάδες κόσμου / δευτ.
const SNEAK_SPEED = 50;            // αργό, αθόρυβο περπάτημα
const STEP_LENGTH = 32;            // απόσταση ανάμεσα σε δύο βήματα

// Πόσο γυρίζει το βλέμμα (ακτίνια): ανά CSS px συρσίματος, ανά px ποντικιού, ανά δευτ. με τα βελάκια.
const LOOK_TOUCH = 0.0065;
const LOOK_MOUSE = 0.0026;
const TURN_SPEED = 2.4;

const STEP_WAVE = { radius: 65, strength: 0.22 };                   // αχνά βήματα (μόνο όταν τρέχεις)
const CALL_WAVE = { minR: 110, maxR: 560, minS: 0.5, maxS: 1.0 };   // το "κύμα" του παίκτη

// Πόσος κόσμος χωράει στην οθόνη (τουλάχιστον τόσο πλάτος / ύψος σε κατακόρυφη θέση·
// σε οριζόντια οι δύο τιμές αλλάζουν θέση, ώστε οι μορφές να έχουν το ίδιο μέγεθος).
const VIEW_MIN_W = 440;
const VIEW_MIN_H = 700;

// Πόσο κρατάει η "στιγμή" του θανάτου (jump scare + κόκκινο σβήσιμο)
// πριν ο παίκτης ξαναβγεί στον τελευταίο βωμό (δευτ.).
const DEATH_DELAY = 1.7;

// Οδηγίες χειρισμού (όχι κείμενα της ιστορίας): πώς πετάς αγγείο / παίζεις τη Μελωδία.
const JAR_HINTS = [
  { touch: 'Tap the jar button at the top right to throw it where you are looking.',
    keys: 'Press E to throw the jar where you are looking.', until: 'jar', time: 10 },
];
const MELODY_HINTS = [
  { touch: 'Tap the lyre button to play.', keys: 'Press Q to play the lyre.', until: 'melody', time: 10 },
];

// Ένταση του ambient βουητού ανά κατάσταση.
const AMBIENT = { play: 1, paused: 0.4, map: 0.4, menu: 0.6, dead: 0.25, cutscene: 0.35, end: 0.5 };

// ---- Στοιχεία σελίδας ----
const $ = (id) => document.getElementById(id);
const canvas = $('game');
let ctx = canvas.getContext('2d', { alpha: false });
const screens = {
  menu: $('menu'), settings: $('settings'), pause: $('pause'),
  endGood: $('end-good'), endBad: $('end-bad'), map: $('map-screen'),
};
const hudEl = $('hud');
const jarBtn = $('btn-jar');
const melodyBtn = $('btn-melody');

// ---- Κατάσταση ----
let cssW = 0, cssH = 0, dpr = 1, scale = 1;
// 'menu' | 'play' | 'paused' | 'map' | 'dead' | 'end'
let state = 'menu';
let chapter = -1;        // ο τελευταίος βωμός που άναψε (-1 = κανένας ακόμα)
let strings = 0;         // χορδές της λύρας (0..3)
let hasObol = false;     // έχει οβολό (για τον Χάροντα)
let jarsFound = false;   // έχει βρει ήδη αγγείο (για να φανεί η οδηγία ρίψης μόνο μία φορά)
let hudRegion = -1;      // σε ποιο κεφάλαιο δείχνει τώρα το HUD
let gameTime = 0;
let lastFrame = 0;
let endTime = 0;         // πότε πέθανε
let monsters = [];
let killer = null;       // η σκιά που έπιασε τον παίκτη
let showMap = false;     // βοήθεια για δοκιμές (από την κονσόλα): μικρός χάρτης με σκιές, έξοδο, τοίχους
let view2d = false;      // βοήθεια για δοκιμές (από την κονσόλα): η παλιά κάτοψη αντί για πρώτο πρόσωπο
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;

// angle = προς τα πού κοιτάει η κάμερα (ακτίνια, 0 = ανατολικά, π/2 = νότια/κάτω στον χάρτη).
// fx, fy = το ίδιο ως διάνυσμα — εκεί πετιέται το αγγείο.
const player = {
  x: 0, y: 0, r: PLAYER_RADIUS, stepDist: 0, foot: 1, fx: 0, fy: 1, angle: Math.PI / 2,
  dir: 1,          // προς ποια πλευρά κοιτάει η μορφή (1 = δεξιά)
  walkPhase: 0,    // φάση του βηματισμού (ακτίνια)
  walkSpeed: 0,    // 0..1, εξομαλυμένη ταχύτητα για την κίνηση των ποδιών
};
const camera = { x: 0, y: 0 };

// ---- Μέγεθος οθόνης ----
function resize() {
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const landscape = cssW > cssH;
  scale = landscape
    ? Math.min(cssW / VIEW_MIN_H, cssH / VIEW_MIN_W)
    : Math.min(cssW / VIEW_MIN_W, cssH / VIEW_MIN_H);
  document.body.classList.toggle('landscape', landscape);
  Pixel.resize(cssW, cssH);
  Raycast.resize(Pixel.w, Pixel.h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---- Παίκτης ----
function updatePlayer(dt) {
  // Το βλέμμα: σύρσιμο στο δεξί μισό, ποντίκι, ή ←/→.
  let a = player.angle + Input.lookDX * LOOK_TOUCH + Input.mouseDX * LOOK_MOUSE + Input.turn * TURN_SPEED * dt;
  Input.lookDX = Input.mouseDX = 0;
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  player.angle = a;
  player.fx = Math.cos(a);
  player.fy = Math.sin(a);

  // moveY < 0 = μπροστά (προς το βλέμμα), moveX > 0 = πλάγια δεξιά.
  const mx = Input.moveX, my = Input.moveY;
  const amount = Math.hypot(mx, my);
  // Η κίνηση των ποδιών (και το "κούνημα" της κάμερας) ακολουθεί ομαλά το αν περπατάς.
  const target = amount < 0.01 ? 0 : (Input.running ? 1 : 0.55);
  player.walkSpeed += (target - player.walkSpeed) * Math.min(1, dt * 10);
  if (amount < 0.01) return;

  const speed = Input.running
    ? RUN_SPEED
    : SNEAK_SPEED * Math.min(1, amount / RUN_THRESHOLD);
  const ux = (player.fx * -my - player.fy * mx) / amount;
  const uy = (player.fy * -my + player.fx * mx) / amount;
  if (Math.abs(ux) > 0.15) player.dir = ux < 0 ? -1 : 1;

  const ox = player.x, oy = player.y;
  player.x += ux * speed * dt;
  Level.pushOutOfWalls(player);
  player.y += uy * speed * dt;
  Level.pushOutOfWalls(player);
  player.walkPhase += Math.hypot(player.x - ox, player.y - oy) * 0.11;

  Hints.notify('move', dt);
  if (!Input.running) {
    Hints.notify('sneak', dt);
    return;
  }

  // Βήματα: μόνο το γρήγορο περπάτημα κάνει θόρυβο.
  player.stepDist += Math.hypot(player.x - ox, player.y - oy);
  if (player.stepDist >= STEP_LENGTH) {
    player.stepDist -= STEP_LENGTH;
    player.foot = -player.foot;
    const side = 3 * player.foot;
    Echoes.emit(player.x - uy * side, player.y + ux * side,
      STEP_WAVE.radius, STEP_WAVE.strength, 'step');
    Sound.step();
  }
}

// Κύμα που ακυρώθηκε με σύρσιμο: απαλός ήχος "ξεφουσκώματος" και το δαχτυλίδι μαζεύεται.
const cancelFx = { t: -1e6, r: 0 };
function cancelCall(amount) {
  if (state !== 'play') return;
  cancelFx.t = gameTime;
  cancelFx.r = player.r + 4 + amount * 16;
  Sound.cancel();
}

let lastCallAt = -1e6;   // πότε έβγαλε ο παίκτης το τελευταίο κύμα (για το "παίζει λύρα")
function emitCall(held) {
  if (state !== 'play') return;
  lastCallAt = gameTime;
  const c = Math.min(1, held / MAX_CHARGE);
  Echoes.emit(player.x, player.y,
    CALL_WAVE.minR + (CALL_WAVE.maxR - CALL_WAVE.minR) * c,
    CALL_WAVE.minS + (CALL_WAVE.maxS - CALL_WAVE.minS) * c,
    'call');
  Sound.voice(c, strings >= 3);
  Hints.notify('call');
  if (c >= LOOK_BACK_CHARGE && lookBackRuleActive()) lookBack();
}

// Στο VIII "κοιτάζω πίσω" σημαίνει και να γυρίσεις την κάμερα προς την Ευρυδίκη: αν εκείνη
// βρεθεί σε LOOK_BACK_ANGLE από το βλέμμα σου (δηλ. γύρισες > 120° από την κατεύθυνση που πας),
// την κοίταξες. Από το LOOK_WARN_ANGLE και μέσα, προειδοποίηση (κόκκινες άκρες, ένταση, δόνηση).
const LOOK_BACK_ANGLE = Math.PI / 3;          // 60°
const LOOK_WARN_ANGLE = (80 * Math.PI) / 180;
const LOOK_MIN_DIST = 14;                     // πιο κοντά (π.χ. μόλις άρχισε να ακολουθεί): δεν μετράει
let turnWarn = 0;                             // 0..1: πόσο κοντά στο όριο της στροφής

// Η γωνία ανάμεσα στο βλέμμα και στην Ευρυδίκη (0 = την κοιτάς, π = είναι ακριβώς πίσω σου).
function eurydiceAngle() {
  const dx = Eurydice.x - player.x, dy = Eurydice.y - player.y;
  if (Math.hypot(dx, dy) < LOOK_MIN_DIST) return Math.PI;
  let a = Math.atan2(dy, dx) - player.angle;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a);
}

function checkTurnBack() {
  turnWarn = 0;
  if (!lookBackRuleActive()) return;
  const a = eurydiceAngle();
  if (a <= LOOK_BACK_ANGLE) {
    lookBack();
    return;
  }
  if (a < LOOK_WARN_ANGLE) turnWarn = (LOOK_WARN_ANGLE - a) / (LOOK_WARN_ANGLE - LOOK_BACK_ANGLE);
}

// Στο VIII, όσο φορτίζεις πέρα από το όριο (ή γυρίζεις προς τα πίσω): ήχος έντασης που
// ανεβαίνει και παλμοί δόνησης.
let warnOn = false, nextWarnPulse = 0;
function updateLookBackWarning() {
  const warn = state === 'play' && lookBackRuleActive() &&
    ((Input.charging && Input.chargeAmount() >= LOOK_BACK_CHARGE) || turnWarn > 0.3);
  if (warn && !warnOn) {
    Sound.tension(true);
    vibrate([60, 40, 60]);
    nextWarnPulse = gameTime + 0.45;
  } else if (!warn && warnOn) {
    Sound.tension(false);
  }
  if (warn && gameTime >= nextWarnPulse) {
    vibrate(35);
    nextWarnPulse = gameTime + 0.45;
  }
  warnOn = warn;
}

// Μια σκιά μόλις άκουσε κάτι: ψιθυρίζει (STORY.md, ενότητα 10) — αν είναι αρκετά
// κοντά για να την ακούσεις, και όχι συνέχεια (κάθε σκιά το πολύ κάθε 9 δευτ.,
// και καμία αν μιλάει ήδη άλλη).
let lastShadeVoice = -1e6;
function shadeSpeaks(m) {
  if (state !== 'play') return;
  if (Math.hypot(m.x - player.x, m.y - player.y) > 460) return;
  if (gameTime - (m.spokeAt || -1e6) < 9 || gameTime - lastShadeVoice < 3.5) return;
  m.spokeAt = lastShadeVoice = gameTime;
  const lines = m.kind === 'erinys' ? STORY.erinysLines : STORY.shadeLines;
  const line = lines[Math.floor(Math.random() * lines.length)];
  const d = Voice.say(line, m.voice, { x: m.x, y: m.y });
  if (!Notice.busy(gameTime)) Notice.show(line, gameTime, d + 1, null, 'shade');
}

// Ο κανόνας "μην κοιτάξεις πίσω" ισχύει όσο η Ευρυδίκη ακολουθεί, μέσα στο τελευταίο κεφάλαιο (VIII).
function lookBackRuleActive() {
  return Eurydice.following() && playerRegion() === CHAPTERS.length - 1;
}

function playerRegion() {
  return Level.regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
}

// Κοίταξες πίσω: ψίθυρος, και τα βήματά της σταματούν για πάντα.
function lookBack() {
  Eurydice.lose(gameTime);
  const d = Voice.say(STORY.whisper, 'eurydice', { x: Eurydice.x, y: Eurydice.y, fade: true });
  Notice.show(STORY.whisper, gameTime, Math.max(2.5, d + 0.6), { text: STORY.footstepsStop, time: 6, who: 'narrator' });
  Notice.el.classList.add('whisper');
}

function throwJar() {
  if (state !== 'play') return;
  if (Jars.throw(player.x, player.y, player.fx, player.fy)) {
    Sound.jarThrow();
    Hints.notify('jar');
    updateHud();
  }
}

function playMelody() {
  if (state !== 'play' || strings < 3) return;
  if (Melody.play(player, monsters, gameTime) >= 0) {
    Hints.notify('melody');
    updateHud();
  }
}

// Ο παίκτης μάζεψε ένα αντικείμενο.
function pickUp(it) {
  if (it.kind === 'jar') {
    Jars.left++;
    Sound.jarPickup();
    Notice.show(STORY.jar, gameTime, Math.max(6, Voice.say(STORY.jar, 'narrator') + 1));
    if (!jarsFound) Hints.push(JAR_HINTS);
    jarsFound = true;
  } else if (it.kind === 'obol') {
    hasObol = true;
    Sound.coin();
  } else if (it.kind === 'string') {
    strings = Math.min(3, strings + 1);
    Sound.stringFound(strings);
    if (strings < 3) {
      Notice.show(STORY.string(strings), gameTime, 4);
    } else {
      Notice.show(STORY.lyreWhole, gameTime, Math.max(7, Voice.say(STORY.lyreWhole, 'narrator', { delay: 0.6 }) + 1.5));
      Melody.uses = MELODY_USES;
      Hints.push(MELODY_HINTS);
    }
  }
  updateHud();
}

// Ο Χάροντας στην πύλη του κεφαλαίου II.
function checkCharon() {
  const r = Charon.check(player, hasObol, gameTime);
  if (r === 'empty') {
    const d = Voice.say(STORY.charonEmpty, 'charon', { x: Charon.x, y: Charon.y });
    Notice.show(STORY.charonEmpty, gameTime, Math.max(5, d + 1), null, 'charon');
  } else if (r === 'paid') {
    hasObol = false;
    const d = Voice.say(STORY.charonPaid, 'charon', { x: Charon.x, y: Charon.y, delay: 0.5 });
    Notice.show(STORY.charonPaid, gameTime, Math.max(6, d + 1.5), null, 'charon');
    Sound.charonPaid();
  }
}

// ---- Σχεδίαση ----
// Όλα ζωγραφίζονται σε pixel art στον μικρό καμβά (js/pixel.js) και μετά μεγαλώνουν.
// Μόνο ό,τι πρέπει να διαβάζεται (τα λόγια των ψυχών) και το joystick ζωγραφίζονται
// σε πλήρη ανάλυση από πάνω.
let pxScale = 1;   // art pixels ανά μονάδα κόσμου

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pc = Pixel.begin();
  const W = Pixel.w, H = Pixel.h;

  if (state === 'menu') {
    Fx.drawMenu(pc, W, H, performance.now() / 1000, menuArtBox(W, H));
    Pixel.present(ctx, dpr);
    return;
  }
  if (state === 'cutscene') return;
  if (state === 'map') {
    drawMap(pc, W, H);
    Pixel.present(ctx, dpr);
    return;
  }

  // Jump scare: το πρόσωπο καλύπτει τα πάντα για λίγο, και η οθόνη τινάζεται.
  if (state === 'dead' && gameTime - endTime < SCARE_TIME) {
    Scare.draw(pc, W, H, gameTime - endTime);
    const k = 1 - (gameTime - endTime) / SCARE_TIME;
    Pixel.present(ctx, dpr, (Math.random() - 0.5) * 6 * k, (Math.random() - 0.5) * 6 * k);
    return;
  }

  if (!view2d) {
    draw3D(pc, W, H);
    return;
  }

  pxScale = scale / Pixel.px;
  const halfW = W / 2 / pxScale, halfH = H / 2 / pxScale;
  const view = {
    x0: camera.x - halfW, x1: camera.x + halfW,
    y0: camera.y - halfH, y1: camera.y + halfH,
  };

  // Τρέμουλο: από τον τρόμο όσο παίζεις, και ένα τίναγμα που σβήνει μετά τον θάνατο.
  let [shakeX, shakeY] = state === 'play' ? Dread.shake() : [0, 0];
  if (state === 'dead') {
    const k = Math.max(0, 1 - (gameTime - endTime - SCARE_TIME) / (DEATH_DELAY - SCARE_TIME));
    shakeX = (Math.random() - 0.5) * 10 * k;
    shakeY = (Math.random() - 0.5) * 10 * k;
  }
  // Η κάμερα "κουμπώνει" σε ακέραια art pixels, ώστε τα pixels να μη "κολυμπάνε".
  const camX = Math.round(W / 2 - camera.x * pxScale);
  const camY = Math.round(H / 2 - camera.y * pxScale);
  pc.setTransform(pxScale, 0, 0, pxScale, camX, camY);

  const saved = ctx;
  ctx = pc;   // οι βοηθητικές συναρτήσεις (drawPlayer κ.λπ.) ζωγραφίζουν στο ctx
  if (showMap) drawDebugMap();

  Echoes.draw(pc, gameTime, view, pxScale);
  Altars.draw(pc, gameTime, view);
  ExitDoor.draw(pc, gameTime);
  Items.draw(pc, gameTime, view);
  Eggs.draw(pc, gameTime, view);
  Souls.drawSpirits(pc, gameTime, view);
  Charon.draw(pc, gameTime);
  Jars.draw(pc, gameTime);
  Melody.draw(pc, gameTime);
  Fx.drawMotes(pc, gameTime);

  for (const m of monsters) {
    if (state === 'dead' && m === killer) {
      // Το τέρας φαίνεται ολόκληρο εκεί που σε έπιασε.
      m.draw(pc, gameTime, Math.max(0.25, 1 - deathFade() * 0.6));
    } else {
      m.draw(pc, gameTime);
    }
  }
  drawEurydice();
  drawPlayer();

  pc.setTransform(1, 0, 0, 1, 0, 0);
  if (state === 'play' || state === 'paused') Dread.drawVignette(pc, W, H, gameTime);
  // Λεπτός μαίανδρος πάνω και κάτω, σαν το στεφάνι ενός αγγείου.
  Pottery.meander(pc, 0, 0, W, 7, POT.terra, 0.35, 1);
  Pottery.meander(pc, 0, H - 7, W, 7, POT.terra, 0.35, 1);
  if (state === 'dead') drawDeathFlash(W, H);
  ctx = saved;

  Pixel.present(ctx, dpr, shakeX, shakeY);

  // Από πάνω, σε πλήρη ανάλυση: τα λόγια των ψυχών (για να διαβάζονται) και το joystick.
  const k = Pixel.px * dpr;
  ctx.setTransform(pxScale * k, 0, 0, pxScale * k, (camX + shakeX) * k, (camY + shakeY) * k);
  Souls.draw(ctx, gameTime, view);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state === 'play') drawJoystick();
}

// ---- Πρώτο πρόσωπο ----
// Ο κόσμος από τα μάτια του Ορφέα (js/raycast.js), στον μικρό καμβά του Pixel.
function draw3D(pc, W, H) {
  // Το βλέμμα "κουνιέται" λίγο με τα βήματα.
  const bob = Math.sin(player.walkPhase * 2) * player.walkSpeed * 1.6;
  Raycast.exitA = World3D.exitAlpha(gameTime, player);
  const t0 = performance.now();
  Raycast.render(pc, player.x, player.y, player.angle, gameTime, bob);
  if (state === 'play') Raycast.measure(performance.now() - t0);
  // Οι μορφές (billboards). Μετά τον θάνατο, αυτή που σε έπιασε φαίνεται ολόκληρη.
  World3D.draw(pc, gameTime, killer, state === 'dead' ? Math.max(0.25, 1 - deathFade() * 0.6) : undefined);

  let [shakeX, shakeY] = state === 'play' ? Dread.shake() : [0, 0];
  if (state === 'dead') {
    const k = Math.max(0, 1 - (gameTime - endTime - SCARE_TIME) / (DEATH_DELAY - SCARE_TIME));
    shakeX = (Math.random() - 0.5) * 10 * k;
    shakeY = (Math.random() - 0.5) * 10 * k;
  }

  const saved = ctx;
  ctx = pc;
  if (state === 'play' || state === 'paused') {
    drawTurnWarning(pc, W, H);
    drawHands3D(pc, W, H);
    Dread.drawVignette(pc, W, H, gameTime);
  }
  Pottery.meander(pc, 0, 0, W, 7, POT.terra, 0.35, 1);
  if (showMap) drawMiniMap(pc, W, H);
  if (state === 'dead') drawDeathFlash(W, H);
  ctx = saved;

  Pixel.present(ctx, dpr, shakeX, shakeY);

  // Από πάνω, σε πλήρη ανάλυση: τα λόγια των ψυχών, το joystick και το κουμπί της λύρας.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  World3D.overlay(ctx, gameTime, Pixel.px);
  if (state === 'play') {
    drawJoystick();
    if (IS_TOUCH) drawLyreButton();
  }
}

// Τα χέρια του Ορφέα με τη λύρα (js/hands.js): οι χορδές λάμπουν και τρέμουν όσο φορτίζεις
// κύμα, και για λίγο αφού το αφήσεις. Στο VIII κοκκινίζουν καθώς πλησιάζεις το όριο του
// "κοιτάζω πίσω", και γίνονται έντονα κόκκινες πέρα από αυτό. Το σύρσιμο για ακύρωση τις σβήνει.
function drawHands3D(pc, W, H) {
  const c = Input.chargeAmount();
  const rule = lookBackRuleActive();
  const near = rule && Input.charging ? Math.max(0, Math.min(1, (c - LOOK_BACK_CHARGE * 0.5) / (LOOK_BACK_CHARGE * 0.5))) : 0;
  const ct = (gameTime - cancelFx.t) / 0.35;
  let melody = 0;
  for (const r of Melody.rings) melody = Math.max(melody, 1 - (gameTime - r.t) / MELODY_RING_TIME);
  const cell = Math.floor(player.y / TILE) * Level.cols + Math.floor(player.x / TILE);
  Hands.draw(pc, W, H, gameTime, {
    strings,
    charge: c,
    charging: Input.charging,
    pluck: Math.max(0, 1 - (gameTime - lastCallAt) / HANDS_PLUCK),
    cancel: Math.max(Input.chargeDrag * 0.8, ct >= 0 && ct < 1 ? 1 - ct : 0),
    warn: rule && Input.charging && c >= LOOK_BACK_CHARGE,
    warnNear: near,
    light: Math.min(1, Raycast.cellLight ? Raycast.cellLight[cell] || 0 : 0),
    walkPhase: player.walkPhase,
    walkSpeed: player.walkSpeed,
    melody: Math.max(0, melody),
  });
}

// Στο VIII, όταν γυρίζεις προς τα πίσω (προς την Ευρυδίκη): οι άκρες της οθόνης κοκκινίζουν
// και πάλλονται — λίγο πριν από το όριο που σημαίνει "κοίταξες πίσω".
function drawTurnWarning(pc, W, H) {
  if (turnWarn <= 0.01) return;
  const pulse = 0.6 + 0.4 * Math.sin(gameTime * 9);
  const g = pc.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(255,40,30,0)');
  g.addColorStop(1, `rgba(255,40,30,${(0.55 * turnWarn * pulse).toFixed(3)})`);
  pc.fillStyle = g;
  pc.fillRect(0, 0, W, H);
}

// Το κουμπί της λύρας (κινητό): κράτημα = κύμα. Γεμίζει όσο φορτίζει.
const LYRE_PATH = typeof Path2D !== 'undefined'
  ? new Path2D('M7 4c-3 3-3 9 0 13h10c3-4 3-10 0-13M7 4c1 2 1 4 0 6M17 4c-1 2-1 4 0 6M6 10h12M9 10v7M12 10v7M15 10v7M8 20h8')
  : null;
function drawLyreButton() {
  const b = Input.lyreButton();
  const c = Input.chargeAmount();
  const warn = c >= LOOK_BACK_CHARGE && lookBackRuleActive();
  const col = warn ? '255,40,30' : POT.terra;
  ctx.fillStyle = `rgba(${col},${(0.08 + c * 0.3).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${col},${Input.charging ? 0.75 : 0.4})`;
  ctx.stroke();
  if (Input.charging) {
    // Το τόξο της φόρτισης γύρω γύρω.
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(${warn ? col : POT.light},0.8)`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 5, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2);
    ctx.stroke();
  }
  if (LYRE_PATH) {
    ctx.save();
    ctx.translate(b.x - 24, b.y - 25);
    ctx.scale(2, 2);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(${POT.light},${Input.charging ? 0.95 : 0.6})`;
    ctx.stroke(LYRE_PATH);
    ctx.restore();
  }
}

// Βοήθεια για δοκιμές (showMap = true): μικρός χάρτης γύρω από τον παίκτη, με τις σκιές.
function drawMiniMap(pc, W, H) {
  const cell = 3, R = 14;
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  const ox = W - (R * 2 + 1) * cell - 4, oy = 10;
  pc.fillStyle = 'rgba(0,0,0,0.7)';
  pc.fillRect(ox, oy, (R * 2 + 1) * cell, (R * 2 + 1) * cell);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const t = Level.terrainAt(ptx + dx, pty + dy);
      if (t === T_FLOOR) continue;
      pc.fillStyle = t === T_WALL ? 'rgba(206,108,56,0.55)' : t === T_WATER ? 'rgba(80,40,30,0.8)' : 'rgba(40,20,10,0.8)';
      pc.fillRect(ox + (dx + R) * cell, oy + (dy + R) * cell, cell, cell);
    }
  }
  const at = (x, y) => [ox + (x / TILE - ptx + R) * cell, oy + (y / TILE - pty + R) * cell];
  for (const m of monsters) {
    const [x, y] = at(m.x, m.y);
    if (x < ox || y < oy || x > ox + (R * 2 + 1) * cell || y > oy + (R * 2 + 1) * cell) continue;
    pc.fillStyle = m.kind === 'erinys' ? '#ff0' : m.guard ? '#f80' : '#f22';
    pc.fillRect(x - 1, y - 1, 3, 3);
  }
  const [x, y] = at(player.x, player.y);
  pc.fillStyle = '#fff';
  pc.fillRect(x - 1, y - 1, 3, 3);
  pc.strokeStyle = '#fff';
  pc.lineWidth = 1;
  pc.beginPath();
  pc.moveTo(x + 0.5, y + 0.5);
  pc.lineTo(x + 0.5 + player.fx * 6, y + 0.5 + player.fy * 6);
  pc.stroke();
}

// Πού μπαίνει η σκηνή του μενού (σε art pixels): στον χώρο #menu-art, πάνω από τον τίτλο.
// Σε οριζόντια οθόνη το #menu-art κρύβεται (το μενού πάει δεξιά) και η σκηνή μπαίνει αριστερά.
// null = το μενού δεν φαίνεται (π.χ. Settings): καμία σκηνή.
function menuArtBox(W, H) {
  if (screens.menu.classList.contains('hidden')) return null;
  const r = $('menu-art').getBoundingClientRect();
  if (r.width > 0) return { x: r.left / Pixel.px, y: r.top / Pixel.px, w: r.width / Pixel.px, h: r.height / Pixel.px };
  return { x: W * 0.03, y: H * 0.2, w: W * 0.38, h: H * 0.6 };
}

function drawPlayer() {
  const c = Input.chargeAmount();

  // Φόρτιση: ένα δαχτυλίδι που μεγαλώνει και "τρέμει" όσο κρατάς.
  if (Input.charging) {
    const pulse = 0.5 + 0.5 * Math.sin(gameTime * (8 + c * 16));
    const rr = player.r + 4 + c * 16;
    const rule = lookBackRuleActive();
    const warn = c >= LOOK_BACK_CHARGE && rule;
    // Όσο σέρνεις το δάχτυλο για ακύρωση, το δαχτυλίδι ξεθωριάζει και γίνεται διακεκομμένο.
    const drag = Input.chargeDrag;
    const fadeDrag = 1 - drag * 0.75;
    if (drag > 0.2) ctx.setLineDash([2 / pxScale, 2 / pxScale]);
    // Κανονικά στο χρώμα του πηλού· κόκκινο (έντονο, παλλόμενο) όταν στο V θα σήμαινε "κοιτάζω πίσω".
    const color = warn ? '255,40,30' : POT.light;
    ctx.lineWidth = (warn ? 2 + 1 * pulse : 1) / pxScale;
    ctx.strokeStyle = `rgba(${color},${(((warn ? 0.6 : 0.2) + 0.35 * c * pulse) * fadeDrag).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(player.x, player.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (warn) {
      // Κόκκινη λάμψη γύρω του: προειδοποίηση.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(player.x, player.y, rr * 0.5, player.x, player.y, rr * 2.2);
      g.addColorStop(0, `rgba(255,40,30,${(0.18 * pulse * fadeDrag).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(player.x, player.y, rr * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (rule) {
      // Στο V: μια αχνή γραμμή δείχνει ως πού μπορείς να φορτίσεις χωρίς να κοιτάξεις πίσω.
      ctx.strokeStyle = `rgba(255,60,40,${(0.35 * fadeDrag).toFixed(3)})`;
      ctx.lineWidth = 1 / pxScale;
      ctx.setLineDash([2 / pxScale, 3 / pxScale]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 4 + LOOK_BACK_CHARGE * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Ακυρωμένο κύμα: το δαχτυλίδι μαζεύεται και σβήνει (δεν βγήκε κανένας ήχος).
  const ct = (gameTime - cancelFx.t) / 0.35;
  if (ct >= 0 && ct < 1) {
    ctx.strokeStyle = `rgba(${POT.light},${(0.5 * (1 - ct)).toFixed(3)})`;
    ctx.lineWidth = 1 / pxScale;
    ctx.beginPath();
    ctx.arc(player.x, player.y, Math.max(1, cancelFx.r * (1 - ct)), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Απαλή λάμψη γύρω του και σκιά κάτω από τα πόδια.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r * 3.4);
  halo.addColorStop(0, `rgba(${POT.terra},${(0.13 + 0.12 * c).toFixed(3)})`);
  halo.addColorStop(1, `rgba(${POT.terra},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r * 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ο Ορφέας ως pixel sprite (js/sprites.js): στέκεται, περπατάει αργά, τρέχει, ή παίζει
  // τη λύρα όσο φορτίζει κύμα (και για λίγο αφού το αφήσει). Στη λύρα φαίνονται όσες
  // χορδές έχει βρει.
  let anim = 'idle', frame = Math.floor(gameTime * 1.6);
  if (Input.charging || gameTime - lastCallAt < 0.35) {
    anim = 'play';
    frame = Math.floor(gameTime * 8);
  } else if (player.walkSpeed > 0.15) {
    anim = player.walkSpeed > 0.75 ? 'run' : 'walk';
    frame = Math.floor(player.walkPhase / (Math.PI / 2));
  }
  Sprites.draw(ctx, `orpheus_${anim}_${strings}`, frame, player.x, player.y, { flip: player.dir < 0, center: true });
}

// Η Ευρυδίκη στο V: χλωμό, διάφανο φάσμα λίγα βήματα πίσω του, με απαλή λάμψη γύρω της.
// Όταν κοιτάξει πίσω, σβήνει και ανεβαίνει σαν καπνός.
function drawEurydice() {
  const e = Eurydice;
  let a = 0, rise = 0;
  if (e.state === 'following') {
    a = 0.74 + 0.08 * Math.sin(gameTime * 2.3);
  } else if (e.state === 'lost') {
    const t = (gameTime - e.lostAt) / EURY_VANISH;
    if (t >= 1 || t < 0) return;
    a = 0.78 * (1 - t);
    rise = t * 14;
  } else {
    return;
  }
  const x = e.x, y = e.y - rise;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const R = 26;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(${POT.cream},${(a * 0.3).toFixed(3)})`);
  g.addColorStop(1, `rgba(${POT.cream},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  Sprites.draw(ctx, 'eurydice', e.moving ? Math.floor(e.walked / 12) : 1, x, y,
    { flip: e.dir < 0, alpha: a, center: true });
}

function drawJoystick() {
  const j = Input.joy;
  if (j.id === null) return;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${POT.terra},0.3)`;
  ctx.beginPath();
  ctx.arc(j.ox, j.oy, JOY_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Εσωτερικός κύκλος: μέσα του περπατάς αθόρυβα, έξω του τρέχεις.
  const runR = JOY_RADIUS * (JOY_DEADZONE + RUN_THRESHOLD * (1 - JOY_DEADZONE));
  ctx.strokeStyle = `rgba(${POT.terra},0.15)`;
  ctx.beginPath();
  ctx.arc(j.ox, j.oy, runR, 0, Math.PI * 2);
  ctx.stroke();

  let dx = j.x - j.ox, dy = j.y - j.oy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) { dx *= JOY_RADIUS / len; dy *= JOY_RADIUS / len; }
  ctx.fillStyle = Input.running ? `rgba(${POT.terra},0.45)` : `rgba(${POT.terra},0.2)`;
  ctx.beginPath();
  ctx.arc(j.ox + dx, j.oy + dy, 20, 0, Math.PI * 2);
  ctx.fill();
}

// 0..1: πόσο έχει προχωρήσει το κόκκινο σβήσιμο μετά το jump scare.
function deathFade() {
  return Math.max(0, Math.min(1, (gameTime - endTime - SCARE_TIME) / (DEATH_DELAY - SCARE_TIME)));
}

function drawDeathFlash(w = cssW, h = cssH) {
  const t = deathFade();
  const a = 0.55 * (1 - t) + 0.2;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15,
    w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(120,0,0,0)');
  g.addColorStop(1, `rgba(120,0,0,${a.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---- Χάρτης του παίκτη ----
// Δείχνει ΜΟΝΟ τη μορφή του χώρου (δάπεδο, νερό, χάσματα, τοίχοι) που έχεις ήδη ανακαλύψει
// (Level.seen: ό,τι φώτισε κύμα ή όπου περπάτησες), και πού είσαι — όχι σκιές, αντικείμενα,
// ψυχές ή την έξοδο. Το παιχνίδι σταματάει όσο είναι ανοιχτός. Ζωγραφίζεται σε pixel art:
// κάθε κελί = λίγα art pixels.
let mapBounds = null;   // για κάθε κεφάλαιο: { x0, x1, y0, y1 } σε κελιά

function regionBounds() {
  const b = CHAPTERS.map(() => ({ x0: Infinity, x1: -1, y0: Infinity, y1: -1 }));
  for (let ty = 0; ty < Level.rows; ty++) {
    for (let tx = 0; tx < Level.cols; tx++) {
      const r = Level.region[ty * Level.cols + tx];
      if (r < 0 || Level.terrain[ty * Level.cols + tx] === T_WALL) continue;
      const q = b[r];
      q.x0 = Math.min(q.x0, tx); q.x1 = Math.max(q.x1, tx);
      q.y0 = Math.min(q.y0, ty); q.y1 = Math.max(q.y1, ty);
    }
  }
  return b;
}

function drawMap(pc, W, H) {
  if (!mapBounds) mapBounds = regionBounds();
  const here = Math.max(0, playerRegion());
  const reached = Math.max(chapter, here);
  const cur = mapBounds[here];
  // Μέγεθος κελιού: να χωράει ολόκληρο το τωρινό κεφάλαιο (με χώρο για τίτλο και κουμπί).
  const cell = Math.max(2, Math.min(8, Math.floor(Math.min(
    (W - 12) / (cur.x1 - cur.x0 + 1), (H - 70) / (cur.y1 - cur.y0 + 1)))));
  // Κεντραρισμένο στο τωρινό κεφάλαιο.
  const ox = Math.round(W / 2 - ((cur.x0 + cur.x1 + 1) / 2) * cell);
  const oy = Math.round(H / 2 + 4 - ((cur.y0 + cur.y1 + 1) / 2) * cell);
  const L = Level;
  const shown = (tx, ty) => {
    const r = L.regionAt(tx, ty);
    return r >= 0 && r <= reached && L.seen[ty * L.cols + tx] === 1;
  };
  const ty0 = Math.max(0, Math.floor(-oy / cell)), ty1 = Math.min(L.rows - 1, Math.ceil((H - oy) / cell));
  const tx0 = Math.max(0, Math.floor(-ox / cell)), tx1 = Math.min(L.cols - 1, Math.ceil((W - ox) / cell));

  // Δάπεδο (σκούρος πηλός), νερό (με κυματάκια), χάσματα (μαύρα, με αχνές κουκκίδες).
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!shown(tx, ty)) continue;
      const t = L.terrain[ty * L.cols + tx];
      if (t === T_WALL) continue;
      const x = ox + tx * cell, y = oy + ty * cell;
      // Τα προηγούμενα κεφάλαια πιο σβηστά από το τωρινό.
      const dim = L.regionAt(tx, ty) === here ? 1 : 0.55;
      if (t === T_FLOOR) {
        pc.fillStyle = `rgba(92,48,28,${dim})`;
        pc.fillRect(x, y, cell, cell);
      } else if (t === T_WATER) {
        pc.fillStyle = `rgba(40,26,20,${dim})`;
        pc.fillRect(x, y, cell, cell);
        pc.fillStyle = `rgba(${POT.terra},${0.5 * dim})`;
        if ((tx + ty) % 2 === 0) pc.fillRect(x + 1, y + Math.floor(cell / 2), Math.max(1, cell - 2), 1);
      } else if (t === T_CHASM && (tx + ty) % 2 === 0) {
        pc.fillStyle = `rgba(${POT.terra},${0.25 * dim})`;
        pc.fillRect(x + Math.floor(cell / 2), y + Math.floor(cell / 2), 1, 1);
      }
    }
  }
  // Τοίχοι: φωτεινές γραμμές πηλού εκεί που ένα ανοιχτό κελί ακουμπάει τοίχο.
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!shown(tx, ty) || L.isOpaque(tx, ty)) continue;
      const x = ox + tx * cell, y = oy + ty * cell;
      pc.fillStyle = `rgba(${POT.light},${L.regionAt(tx, ty) === here ? 0.95 : 0.5})`;
      if (L.isOpaque(tx, ty - 1)) pc.fillRect(x, y, cell, 1);
      if (L.isOpaque(tx, ty + 1)) pc.fillRect(x, y + cell - 1, cell, 1);
      if (L.isOpaque(tx - 1, ty)) pc.fillRect(x, y, 1, cell);
      if (L.isOpaque(tx + 1, ty)) pc.fillRect(x + cell - 1, y, 1, cell);
    }
  }

  // Εσύ: μια κουκκίδα που αναβοσβήνει, με δαχτυλίδι που απλώνει σαν κύμα.
  const now = performance.now() / 1000;
  const px = Math.round(ox + (player.x / TILE) * cell), py = Math.round(oy + (player.y / TILE) * cell);
  const ring = (now * 0.8) % 1;
  pc.strokeStyle = `rgba(${POT.light},${(0.8 * (1 - ring)).toFixed(3)})`;
  pc.lineWidth = 1;
  pc.beginPath();
  pc.arc(px + 0.5, py + 0.5, 2 + ring * cell * 2.5, 0, Math.PI * 2);
  pc.stroke();
  // Προς τα πού κοιτάς: αχνή δέσμη (το οπτικό πεδίο) και μια γραμμή μπροστά από την κουκκίδα.
  const reach = cell * 3 + 6, half = RC_FOV / 2;
  pc.globalCompositeOperation = 'lighter';
  pc.fillStyle = `rgba(${POT.light},0.16)`;
  pc.beginPath();
  pc.moveTo(px + 0.5, py + 0.5);
  pc.lineTo(px + 0.5 + Math.cos(player.angle - half) * reach, py + 0.5 + Math.sin(player.angle - half) * reach);
  pc.lineTo(px + 0.5 + Math.cos(player.angle + half) * reach, py + 0.5 + Math.sin(player.angle + half) * reach);
  pc.closePath();
  pc.fill();
  pc.globalCompositeOperation = 'source-over';
  pc.strokeStyle = `rgba(${POT.cream},0.9)`;
  pc.lineWidth = 1;
  pc.beginPath();
  pc.moveTo(px + 0.5, py + 0.5);
  pc.lineTo(px + 0.5 + player.fx * (cell + 4), py + 0.5 + player.fy * (cell + 4));
  pc.stroke();
  pc.fillStyle = Math.floor(now * 3) % 2 ? `rgb(${POT.cream})` : `rgb(${POT.light})`;
  pc.fillRect(px - 1, py - 1, 3, 3);

  Pottery.meander(pc, 0, 0, W, 7, POT.terra, 0.5, 1);
  Pottery.meander(pc, 0, H - 7, W, 7, POT.terra, 0.5, 1);
}

function openMap() {
  if (state !== 'play') return;
  setState('map');
  stopInput();
  const ch = CHAPTERS[Math.max(0, playerRegion())];
  $('map-chapter').textContent = `${ch.numeral}. ${ch.name}`;
  showScreen('map');
  document.body.classList.add('map-open');
}

function closeMap() {
  if (state !== 'map') return;
  setState('play');
  showScreen(null);
  document.body.classList.remove('map-open');
}

function drawDebugMap() {
  ctx.fillStyle = 'rgba(255,60,60,0.12)';
  for (let ty = 0; ty < Level.rows; ty++) {
    for (let tx = 0; tx < Level.cols; tx++) {
      if (Level.isWall(tx, ty)) ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  ctx.fillStyle = 'rgba(255,214,150,0.4)';
  ctx.fillRect(Level.exit.tx * TILE, Level.exit.ty * TILE, TILE, TILE);
  for (const m of monsters) {
    ctx.fillStyle = m.guard ? 'rgba(255,140,60,0.6)' : 'rgba(255,60,60,0.6)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Βρόχος ----
function frame(t) {
  const now = t / 1000;
  const dt = Math.min(0.05, Math.max(0, now - (lastFrame || now)));
  lastFrame = now;

  if (state === 'play') {
    gameTime += dt;
    Input.update();
    updatePlayer(dt);
    for (const m of monsters) m.update(dt, gameTime);
    Jars.update(dt, gameTime);
    Eggs.update(dt, gameTime);
    Fx.update(dt, camera, cssW / 2 / scale, cssH / 2 / scale);
    Echoes.update(dt, gameTime);
    Hints.update(gameTime);
    updateLookBackWarning();
    Notice.update(gameTime);

    killer = monsters.find((m) => m.touches(player)) || null;
    const lit = killer ? -1 : Altars.check(player, gameTime);
    const item = killer ? null : Items.check(player);
    if (killer) die();
    else if (lit >= 0) lightAltar(lit);
    else if (ExitDoor.reached(player)) reachedExit();
    if (item) pickUp(item);
    if (state === 'play') checkCharon();

    const region = Level.regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (region !== hudRegion) updateHud();
    Eurydice.update(player);
    if (state === 'play') checkTurnBack();
    // Όπου περπατάς, το "βλέπεις" (για τον χάρτη), ακόμα και χωρίς κύμα.
    Level.seen[Math.floor(player.y / TILE) * Level.cols + Math.floor(player.x / TILE)] = 1;
    if (Eurydice.wantsToSpeak(gameTime) && lookBackRuleActive() && !Notice.busy(gameTime)) {
      const d = Voice.say(STORY.eurydiceFollow, 'eurydice', { x: Eurydice.x, y: Eurydice.y });
      Notice.show(STORY.eurydiceFollow, gameTime, d + 1.2, null, 'whisper');
    }

    // Τέλος του κεφαλαίου IV: μόλις περάσεις στο V, παίζει η μεσαία cutscene.
    if (state === 'play' && region === CHAPTERS.length - 1 && Eurydice.state === 'none') playMiddle();

    // Η κάμερα ακολουθεί τον παίκτη απαλά.
    const follow = 1 - Math.pow(0.001, dt);
    camera.x += (player.x - camera.x) * follow;
    camera.y += (player.y - camera.y) * follow;
  } else if (state === 'dead') {
    gameTime += dt;
    Echoes.update(dt, gameTime);
    // Μετά το jump scare: πίσω στον τελευταίο βωμό, με ό,τι είχες εκεί.
    if (gameTime - endTime >= DEATH_DELAY) {
      Sound.gameOver();
      continueGame();
    }
  }

  // Γρύλισμα, καρδιοχτύπι, βινιετάρισμα: μόνο όσο παίζεις.
  Sound.listenerX = player.x;
  Sound.listenerY = player.y;
  Sound.listenerAngle = player.angle;
  Sound.updateListener();
  Dread.update(dt, gameTime, player, monsters, state === 'play');

  draw();
  requestAnimationFrame(frame);
}

// ---- Οθόνες ----
function showScreen(name) {
  for (const key in screens) screens[key].classList.toggle('hidden', key !== name);
  hudEl.classList.toggle('hidden', state !== 'play' && state !== 'paused');
  if (name === 'menu') {
    // Continue μόνο αν υπάρχει save· τότε είναι και το κύριο κουμπί (Enter).
    const hasSave = Save.exists();
    $('btn-continue').classList.toggle('hidden', !hasSave);
    $('btn-continue').classList.toggle('primary', hasSave);
    $('btn-new').classList.toggle('primary', !hasSave);
  }
  if (name === 'pause') {
    const ch = CHAPTERS[Math.max(0, chapter)];
    $('pause-chapter').textContent = `${ch.numeral}. ${ch.name}`;
    $('pause-objective').textContent = ch.objective(strings);
  }
}

function updateToggleLabels() {
  for (const b of document.querySelectorAll('.sound-toggle')) {
    b.textContent = Settings.sound ? 'Sound: on' : 'Sound: off';
  }
  for (const b of document.querySelectorAll('.vibration-toggle')) {
    b.textContent = Settings.vibration ? 'Vibration: on' : 'Vibration: off';
  }
}

function updateHud() {
  // Το κουμπί του αγγείου εμφανίζεται μόλις βρεις το πρώτο· της λύρας με την 3η χορδή.
  jarBtn.classList.toggle('hidden', !jarsFound);
  jarBtn.classList.toggle('empty', Jars.left === 0);
  $('jar-count').textContent = String(Jars.left);
  melodyBtn.classList.toggle('hidden', strings < 3);
  melodyBtn.classList.toggle('empty', Melody.uses === 0);
  $('melody-count').textContent = String(Melody.uses);
  const r = Level.regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  hudRegion = r;
  $('level-label').textContent = r >= 0 ? CHAPTERS[r].numeral : '';
  // Οι χορδές φαίνονται από το κεφάλαιο II (εκεί βρίσκεται η πρώτη).
  $('strings-label').textContent = Math.max(r, chapter) >= 1 || strings > 0 ? `Strings: ${strings}/3` : '';
}

// Τίτλος κεφαλαίου στη μέση της οθόνης (καλείται από την ουρά μηνυμάτων).
function showChapterTitle(ch) {
  const el = $('level-intro');
  $('intro-number').textContent = ch.numeral;
  $('intro-name').textContent = ch.name;
  $('intro-line').textContent = ch.line;
  Voice.say(ch.line, 'narrator', { delay: 0.8 });
  el.classList.remove('show');
  void el.offsetWidth;   // ξαναξεκινάει το CSS animation
  el.classList.add('show');
}

function blurButtons() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// Μέσα σε iframe (π.χ. στο site του game jam) ή με ?embed στο URL: χωρίς δικό μας
// fullscreen, και η πάνω δεξιά γωνία μένει ελεύθερη για το κουμπί του site (CSS body.embedded).
const EMBEDDED = (() => {
  if (/[?&]embed\b/.test(location.search)) return true;
  try { return window.self !== window.top; } catch (_) { return true; }
})();

// ---- Ροή παιχνιδιού ----
function goFullscreen() {
  if (EMBEDDED) return;
  if (!matchMedia('(pointer: coarse)').matches) return;   // στο PC όχι
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) {
      p.catch(() => {});
    }
  } catch (_) { /* π.χ. iPhone: δεν υποστηρίζεται, συνεχίζουμε κανονικά */ }
}

function stopInput() {
  Input.cancelCharge();
  Input.joy.id = null;
  Input.look.id = null;
  Input.lookDX = Input.mouseDX = 0;
}

function setState(s) {
  state = s;
  // Το ποντίκι μένει "κλειδωμένο" μόνο όσο παίζεις (αλλιώς δεν πατιούνται τα κουμπιά).
  if (s !== 'play' && s !== 'dead' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  if (s !== 'play' && warnOn) { warnOn = false; Sound.tension(false); }
  Sound.setAmbient(AMBIENT[s]);
}

// Τα μηνύματα που βγαίνουν όταν ανάβει ο βωμός ενός κεφαλαίου (STORY.md, ενότητα 2).
function chapterMessages(i) {
  const ch = CHAPTERS[i];
  return [
    { touch: STORY.checkpoint, time: 3.5 },
    { title: ch, time: 5 },
    { touch: ch.objective(strings), time: 8 },
    // Η οδηγία κίνησης έχει ήδη φανεί στην αρχή (και για να φτάσει εδώ, ο παίκτης κινήθηκε).
    ...ch.hints.filter((h) => h.until !== 'move'),
  ];
}

// Βάζει τον παίκτη στον κόσμο με την κατάσταση ενός save (βλ. Save.fresh()).
// chapter -1 = καινούργιο παιχνίδι (από την αφετηρία).
function spawn(saved) {
  goFullscreen();
  chapter = saved.chapter;
  strings = saved.strings;
  hasObol = saved.obol;
  jarsFound = saved.jars > 0 || saved.taken.some((id) => Level.items[id] && Level.items[id].kind === 'jar');
  // Ο χάρτης θυμάται ό,τι έχεις δει: μετά από θάνατο κρατάει και όσα είδες μετά τον βωμό.
  Level.mergeSeen(saved.seen);

  Echoes.init();
  monsters = Level.monsters.map((m) => (m.kind === 'erinys'
    ? new Erinys(m.x, m.y, m.region)
    : new Monster(m.x, m.y, m.guard, m.region)));
  monsters.forEach((m, i) => {
    m.onSense = shadeSpeaks;
    // Μισές σκιές με αντρική, μισές με γυναικεία φωνή· οι Ερινύες με τη δική τους.
    m.voice = m.kind === 'erinys' ? 'erinys' : i % 2 ? 'shadeF' : 'shade';
  });
  killer = null;
  ExitDoor.reset();
  Altars.reset(chapter);
  Items.reset(saved.taken);
  Charon.reset(saved.paid);
  Jars.reset(saved.jars);
  Melody.reset(saved.melody);
  Notice.clear();
  Souls.reset();
  Eggs.reset();
  World3D.reset();
  // Αν ξαναβγαίνεις στον βωμό του V, εκείνη σε ακολουθεί ήδη.
  Eurydice.reset(chapter >= CHAPTERS.length - 1 ? 'following' : 'none', chapter >= 0 ? Level.altars[chapter] : Level.start);
  Echoes.listeners = [...monsters, ExitDoor, Charon, ...Altars.list, ...Items.list, ...Souls.list, ...Eggs.listeners(), ...World3D.listeners()];

  const at = chapter >= 0 ? Level.altars[chapter] : Level.start;
  player.x = camera.x = at.x;
  player.y = camera.y = at.y;
  player.stepDist = 0;
  // Αρχική κατεύθυνση: προς τον πρώτο ανοιχτό διάδρομο (προτιμάει κάτω και δεξιά).
  const stx = Math.floor(player.x / TILE), sty = Math.floor(player.y / TILE);
  const open = [[0, 1], [1, 0], [-1, 0], [0, -1]].find(([dx, dy]) => !Level.isWall(stx + dx, sty + dy));
  [player.fx, player.fy] = open || [0, 1];
  player.angle = Math.atan2(player.fy, player.fx);

  stopInput();
  Dread.reset();
  setState('play');
  showScreen(null);
  updateHud();
  // Καινούργιο παιχνίδι: πρώτα πώς κινείσαι (ο πρώτος βωμός είναι ένα βήμα μακριά).
  // Μετά από θάνατο / Continue: θύμισε τον στόχο του κεφαλαίου.
  Hints.start(chapter >= 0
    ? [{ touch: CHAPTERS[chapter].objective(strings), time: 6 }]
    : CHAPTERS[0].hints.filter((h) => h.until === 'move'), gameTime);

  // Μια πρώτη ανάσα: ένα μέτριο κύμα για να δεις πού βρίσκεσαι.
  Echoes.emit(player.x, player.y, 220, 0.6, 'call');
  Sound.voice(0.3, strings >= 3);
}

// Παίζει μια cutscene (με τη ζωγραφιά art από πάνω) και μετά καλεί το then.
function playCutscene(lines, style, art, then, who) {
  setState('cutscene');
  stopInput();
  Hints.stop();
  Notice.clear();
  showScreen(null);
  Cutscene.play(lines, style, then, art, who);
}

function newGame() {
  Save.clear();
  Level.seen.fill(0);
  goFullscreen();
  playCutscene(STORY.intro, '', 'intro', () => spawn(Save.fresh()), STORY.introWho);
}

// Τέλος του κεφαλαίου IV: ο Άδης δίνει την Ευρυδίκη. Μετά συνεχίζεις από εκεί
// που ήσουν (στην είσοδο του V), και εκείνη σε ακολουθεί.
function playMiddle() {
  playCutscene(STORY.middle, '', 'middle', () => {
    Eurydice.reset('following', player);
    Dread.reset();
    setState('play');
    showScreen(null);
    updateHud();
  }, STORY.middleWho);
}

function continueGame() {
  spawn(Save.load() || Save.fresh());
}

// Ο παίκτης έφτασε στον βωμό του κεφαλαίου i: η Μελωδία ξαναγεμίζει και
// αποθηκεύονται όλα όπως είναι τώρα.
function lightAltar(i) {
  chapter = i;
  if (strings >= 3) Melody.uses = MELODY_USES;
  Save.write({
    chapter: i, jars: Jars.left, strings, obol: hasObol, paid: Charon.paid,
    melody: Melody.uses, taken: Items.takenIds(), seen: Level.seenString(),
  });
  Sound.win();
  updateHud();
  Hints.start(chapterMessages(i), gameTime);
}

function die() {
  setState('dead');
  endTime = gameTime;
  stopInput();
  Hints.stop();
  Notice.clear();
  showScreen(null);
  Scare.prepare(killer ? killer.kind : 'shade');
  Sound.scare(killer ? killer.kind : 'shade');
  vibrate([250, 60, 500]);
}

// Η έξοδος στο φως: καλό τέλος αν η Ευρυδίκη ακόμα σε ακολουθεί, αλλιώς κακό.
function reachedExit() {
  const good = Eurydice.following();
  if (good) Sound.win(); else Sound.gameOver();
  const kind = good ? 'good' : 'bad';
  playCutscene(good ? STORY.good : STORY.bad, kind, kind, () => {
    setState('end');
    showScreen(good ? 'endGood' : 'endBad');
  });
}

let pausedAt = 0;
function pauseGame() {
  if (state !== 'play') return;
  pausedAt = performance.now();
  setState('paused');
  stopInput();
  showScreen('pause');
}

function resumeGame() {
  if (state !== 'paused') return;
  setState('play');
  showScreen(null);
}

function goToMenu() {
  setState('menu');
  stopInput();
  Hints.stop();
  Notice.clear();
  showScreen('menu');
}

function doAction(action) {
  Sound.unlock();   // πρέπει να γίνει μέσα στο πάτημα του κουμπιού (iPhone)
  blurButtons();
  if (action === 'new') newGame();
  else if (action === 'continue' || action === 'retry') continueGame();
  else if (action === 'settings') showScreen('settings');
  else if (action === 'back') showScreen('menu');
  else if (action === 'resume') resumeGame();
  else if (action === 'map-close') closeMap();
  else if (action === 'menu') goToMenu();
  else if (action === 'sound') { Sound.setMuted(!Sound.muted); updateToggleLabels(); }
  else if (action === 'vibration') {
    Settings.vibration = !Settings.vibration;
    Settings.store();
    updateToggleLabels();
    vibrate(40);   // μικρό "τσίμπημα" για να νιώσεις ότι άνοιξε
  }
}

// Η ορατή οθόνη (αν υπάρχει).
function visibleScreen() {
  for (const key in screens) {
    if (!screens[key].classList.contains('hidden')) return screens[key];
  }
  return null;
}

// ---- Έναρξη ----
function init() {
  Settings.load();
  Sound.loadSettings();
  updateToggleLabels();
  Hints.init($('hint'));
  Notice.init($('notice'));
  Hints.onTitle = showChapterTitle;
  Cutscene.init();

  Level.loadWorld(CHAPTERS);
  Raycast.init();
  player.x = camera.x = Level.start.x;
  player.y = camera.y = Level.start.y;

  Input.now = () => gameTime;
  Input.onRelease = emitCall;
  Input.onCancel = cancelCall;
  Input.canLook = () => state === 'play';
  Input.init(canvas);

  for (const btn of document.querySelectorAll('[data-action]')) {
    btn.addEventListener('click', (e) => { e.preventDefault(); doAction(btn.dataset.action); });
  }
  $('btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); pauseGame(); });
  $('btn-map').addEventListener('pointerdown', (e) => { e.preventDefault(); openMap(); });
  jarBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); throwJar(); });
  melodyBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); playMelody(); });

  window.addEventListener('keydown', (e) => {
    if (state === 'cutscene') {
      // Space / Enter = επόμενη γραμμή, Esc = Skip.
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) Cutscene.advance(); }
      else if (e.code === 'Escape') Cutscene.finish();
      return;
    }
    if (e.code === 'Enter') {
      // Enter = το κύριο κουμπί της οθόνης που φαίνεται.
      e.preventDefault();
      const scr = visibleScreen();
      const primary = scr && scr.querySelector('.primary:not(.hidden)');
      if (primary) doAction(primary.dataset.action);
    } else if (state === 'map' && (e.code === 'Escape' || e.code === 'KeyM' || e.code === 'KeyP')) {
      if (!e.repeat) closeMap();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play') pauseGame();
      // (όχι αμέσως: το Esc που ξεκλείδωσε το ποντίκι έβαλε ήδη παύση)
      else if (state === 'paused' && performance.now() - pausedAt > 300) resumeGame();
    } else if (e.code === 'KeyE' && !e.repeat) {
      throwJar();
    } else if (e.code === 'KeyQ' && !e.repeat) {
      playMelody();
    } else if (e.code === 'KeyM' && !e.repeat) {
      openMap();
    }
  });

  // Αν η σελίδα κρυφτεί (π.χ. έρχεται κλήση), το παιχνίδι μπαίνει σε παύση
  // και ο ήχος σταματάει.
  // PC: αν ο κέρσορας ξεκλειδώσει ενώ παίζεις (π.χ. Esc), μπαίνει σε παύση.
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && state === 'play') pauseGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
    Sound.setBackground(document.hidden);
  });

  // Κλείδωμα zoom / scroll / μενού στα κινητά.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.body.classList.toggle('embedded', EMBEDDED);
  Pixel.init();
  Sprites.init();
  World3D.init();
  Hands.init();
  resize();
  showScreen('menu');
  requestAnimationFrame(frame);
}

init();
