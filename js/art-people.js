'use strict';

// Οι άνθρωποι, οι θεοί και οι ψυχές (js/art.js). Ένας άνθρωπος = σχέδιο 60 × 100 (τα πόδια στο 99), κοιτάζει
// δεξιά, σε τρία τέταρτα· οι θεοί στους θρόνους είναι από μπροστά.

// Ένας άνθρωπος. o: {
//   skin, robe (τόνος του χιτώνα), robe2 (ιμάτιο από πάνω, προαιρετικό), hem (χρώμα της ζώνης στον ποδόγυρο),
//   long (φόρεμα ως τους αστραγάλους), hair (τόνος), style: 'long' | 'short' | 'bald' | 'bun' | 'veil' | 'hood',
//   beard (τόνος), frame (0 στέκεται, 1 / 2 βάδισμα), armF / armB (σημεία του μπροστινού / πίσω χεριού),
//   hold(g) (κάτι στο μπροστινό χέρι, μετά το χέρι), bow (σκύβει το κεφάλι), flowers (στεφάνι), eyes (τόνος ματιών) }
function artPerson(g, o) {
  const skin = o.skin || 'skn3', robe = o.robe || 'crm4', hairT = o.hair || 'brn2';
  const f = o.frame || 0;
  const bow = o.bow || 0;
  // Τα πόδια: στέκεται / βάδισμα (το ένα μπροστά, το άλλο πίσω).
  const feet = f === 1 ? [[22, 98], [40, 99]] : f === 2 ? [[40, 98], [23, 99]] : [[28, 99], [35, 99]];
  const hemY = o.long ? 94 : 70;
  const leg = (hip, foot, far) => {
    const knee = [(hip[0] + foot[0]) / 2 + 1.5, (hip[1] + foot[1]) / 2];
    g.limb([hip, knee, foot], [6.5, 4.4, 3.2], 0, skin, { size: 5 });
    // σανδάλι
    g.blob([[foot[0] - 2.5, foot[1] - 1.8], [foot[0] + 4, foot[1] - 1.6], [foot[0] + 4.5, foot[1] + 0.5], [foot[0] - 2.5, foot[1] + 0.5]], 'brn2', { size: 2 });
    g.line([[foot[0] - 1, foot[1] - 4], [foot[0] + 1.5, foot[1] - 1.5]], 1, 'brn1', { px: true });
  };
  if (!o.long || f) {
    leg([30, 60], feet[1], true);
    leg([31, 60], feet[0], false);
  } else {
    // (κάτω από το μακρύ φόρεμα φαίνονται μόνο τα πόδια)
    for (const ft of feet) g.blob([[ft[0] - 2.5, ft[1] - 3], [ft[0] + 4, ft[1] - 2.5], [ft[0] + 4.5, ft[1] + 0.5], [ft[0] - 2.5, ft[1] + 0.5]], skin, { size: 2 });
  }
  // Μακριά μαλλιά πίσω από την πλάτη.
  if (o.style === 'long') {
    g.blob([[26, 6], [32, 3], [30, 18], [29, 34 + (o.hairLen || 0)], [24, 42 + (o.hairLen || 0)], [21, 30], [23, 16]], hairT, { size: 9 });
    g.hatch(g.path([[26, 6], [32, 3], [30, 18], [29, 34], [24, 42], [21, 30], [23, 16]]), hairT.replace(/\d/, (d) => Math.max(0, d - 1)), 4, (i) => [[27 - i, 8], [26 - i, 24], [24 - i * 0.6, 40]], 1, 4);
  }
  // Το πίσω χέρι.
  const armB = o.armB || [[28, 23], [25, 36], [26, 49]];
  g.limb(armB, [5, 4, 3.4], 0, skin, { size: 4 });
  // Ο χιτώνας: ώμοι, στήθος, μέση, ποδόγυρος (φαρδαίνει λίγο προς τα κάτω).
  const sway = f === 1 ? 2 : f === 2 ? -2 : 0;
  const hemPts = o.long
    ? [[43 + sway, hemY], [36, hemY + 1.5], [29, hemY + 0.5], [21 - sway, hemY]]
    : [[39 + sway, hemY], [32, hemY + 1.5], [24 - sway, hemY]];
  const body = g.blob([[26, 21], [31, 19.5], [37, 21], [39.5, 27], [38.5, 36], [36.5, 43], [38.5, 52], ...hemPts, [23, 52], [25.5, 42], [24, 30]], robe, { size: 15, hi: 1.3, rim: 3.5 });
  // Πτυχώσεις.
  const dk = robe.replace(/\d/, (d) => Math.max(0, d - 2));
  g.hatch(body, dk, 5, (i) => { const x = 26 + i * 3; return [[x + 1, 44], [x + (i - 2) * 0.6, (hemY + 44) / 2], [x - 1 + (i - 2) * 1.2 + sway * 0.4, hemY]]; }, 1, 2);
  g.hatch(body, dk, 2, (i) => [[29 + i * 5, 23], [30 + i * 4, 34]], 1, 3);
  // Η ζώνη στον ποδόγυρο (κόκκινη ή μαύρη ταινία με κουκκίδες, όπως στα αγγεία).
  if (o.hem) {
    g.inside(body, () => {
      g.line(hemPts.map(([x, y]) => [x, y - 2.2]), 2.2, o.hem, {});
      for (let x = 22; x < 44; x += 3) g.dot(x, hemY - 2.2 + (x > 34 ? 0.4 : 0), 0.45, 'crm5');
    });
  }
  // Ζώνη στη μέση.
  g.line([[24.5, 41], [31, 42.2], [37.5, 41]], 1.6, o.belt || 'brn1', {});
  // Ιμάτιο (μανδύας) από τον ώμο.
  if (o.robe2) {
    const cl = g.blob([[25, 20], [33, 19.5], [36, 26], [33, 40], [34, o.long ? 80 : 62], [26, o.long ? 84 : 66], [21, 60], [22, 36]], o.robe2, { size: 12 });
    g.hatch(cl, o.robe2.replace(/\d/, (d) => Math.max(0, d - 2)), 3, (i) => [[28 + i * 2, 26], [26 + i * 2.5, 50], [24 + i * 3, o.long ? 80 : 62]], 1, 5);
  }
  // Λαιμός και κεφάλι (προφίλ προς τα δεξιά).
  const hx = bow * 1.5, hy = bow * 2;
  g.limb([[31.5, 21], [32.5 + hx * 0.5, 15 + hy * 0.5]], 4.6, 4.2, skin, { size: 4 });
  const H = (pts) => pts.map(([x, y, q]) => [x + hx, y + hy, q]);
  const head = g.blob(H([[26.5, 8], [28.5, 3], [33, 1.8], [37, 3.8], [38.2, 7.5], [39.8, 10.5, 1], [38.3, 11.4], [38.6, 13], [37.7, 14.4], [37.3, 16.3], [34.5, 17.4], [30.5, 16], [27.5, 13]]), skin, { size: 11, hi: 0.9, rim: 2.2 });
  void head;
  g.blob(H([[30, 9.5], [32, 9], [32.4, 12], [30.6, 12.6]]), skin.replace(/\d/, (d) => Math.max(0, d - 1)), { size: 2 });   // αυτί
  g.px(36.4 + hx, 9.3 + hy, o.eyes || 'ink1', 1);
  g.line(H([[35, 7.4], [37.4, 7.6]]), 1, hairT.replace(/\d/, (d) => Math.max(0, d - 1)), { px: true });
  g.line(H([[36.6, 14.5], [37.8, 14.3]]), 1, 'mar3', { px: true });
  // Μαλλιά.
  const st = o.style || 'short';
  if (st === 'short' || st === 'long' || st === 'bun') {
    g.blob(H([[25.5, 10], [26.5, 3.5], [31, 0.5], [36, 1], [38.6, 4.5], [36.5, 5.8], [33.5, 5], [31.5, 7.5], [30.8, 11], [28.6, 14.8], [26, 14]]), hairT, { size: 8 });
    if (st === 'bun') g.ell(26.5 + hx, 4 + hy, 3.2, 2.8, hairT);
    if (o.band) g.line(H([[27, 4.5], [31, 2.2], [36.5, 3]]), 1.2, o.band, {});
  } else if (st === 'bald') {
    g.blob(H([[25.8, 10], [27, 6], [29.5, 6.5], [30.5, 11], [28.6, 14.8], [26, 14]]), hairT, { size: 5 });
  } else if (st === 'veil' || st === 'hood') {
    // Πέπλο / κουκούλα: σκεπάζει το κεφάλι και πέφτει στους ώμους.
    g.blob(H([[24, 12], [25, 3], [30, -0.5], [36, 0], [39.5, 4.5], [37.6, 6.5], [33, 5.5], [31.5, 10], [32, 18], [30, 26], [24, 30], [21, 22]]), o.veil || robe, { size: 10 });
  }
  if (o.flowers) for (const [x, y] of [[27, 4.5], [29.5, 2.5], [32.5, 1.6], [35.5, 2.4]]) { g.dot(x + hx, y + hy, 1.1, o.flowers); g.px(x + hx, y + hy, 'gld4'); }
  if (o.beard) {
    g.blob(H([[31.5, 13], [36, 14], [38.8, 13.8], [38.4, 17], [36, 21.5], [33, 22], [31, 18]]), o.beard, { size: 6 });
    g.line(H([[35.5, 15], [38.4, 14.6]]), 1, 'mar3', { px: true });
  }
  // Το μπροστινό χέρι (και ό,τι κρατάει).
  const armF = o.armF || [[34, 23], [36.5, 36], [39.5, 47]];
  g.limb([armF[0], armF[1]], 6, 5, o.sleeve || robe, { size: 5 });           // κοντό μανίκι
  g.limb(armF, [5, 4, 3.3], 0, skin, { size: 4 });
  g.limb([armF[0], [(armF[0][0] + armF[1][0]) / 2, (armF[0][1] + armF[1][1]) / 2]], 6, 5.5, o.sleeve || robe, { size: 5 });
  const hd = armF[armF.length - 1];
  g.ell(hd[0], hd[1] + 1, 2.2, 2.6, skin, { size: 3 });
  if (o.hold) o.hold(g, hd);
}

// Φάντασμα: η ίδια μορφή, χλωμή και φωτεινή, με τα κάτω λιωμένα σε ουρά καπνού.
function artGhost(g, o) {
  const f = o.frame || 0;
  artPerson(g, { ...o, long: true, frame: 0, skin: o.skin || 'crm4', robe: o.robe || 'crm3', hair: o.hair || 'crm2', eyes: 'crm1', hem: null, belt: 'crm2' });
  // Η ουρά: σβήνει (γράφει διάφανα pixels) από τα γόνατα και κάτω, σε κυματιστές γλώσσες.
  const c = g.ctx;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const sw = f ? 2 : -2;
  for (let i = 0; i < 7; i++) {
    const x = 18 + i * 4.4;
    c.fillStyle = 'rgba(0,0,0,1)';
    c.beginPath();
    c.moveTo(x, 100);
    c.quadraticCurveTo(x + 2 + sw, 86 - (i % 2) * 6, x + 4.4, 100);
    c.fill();
  }
  c.fillRect(0, 96, 60, 5);
  c.restore();
}

// ---- Οι θεοί στους θρόνους (από μπροστά). Σχέδιο 70 × 100: ο θρόνος πίσω, η μορφή καθισμένη. ----
function artThrone(g, cx) {
  // Ψηλή πλάτη με σκαλιστή κορυφή, μπράτσα, βάθρο. Πέτρα (brn) με χρυσές λεπτομέρειες.
  g.poly([[cx - 22, 96], [cx - 20, 18], [cx - 14, 8], [cx, 4], [cx + 14, 8], [cx + 20, 18], [cx + 22, 96]], 'brn2', { size: 30 });
  g.poly([[cx - 15, 90], [cx - 14, 22], [cx, 15], [cx + 14, 22], [cx + 15, 90]], 'brn1', { size: 20 });
  for (let i = 0; i < 5; i++) g.line([[cx - 13 + i * 6.5, 24 + Math.abs(i - 2) * 1.5], [cx - 13 + i * 6.5, 84]], 1, 'brn0', { px: true });
  g.dot(cx, 10, 2.4, 'gld3'); g.dot(cx, 10, 1.1, 'red4');
  for (const s of [-1, 1]) {
    g.poly([[cx + s * 26, 62], [cx + s * 26, 56], [cx + s * 14, 56], [cx + s * 14, 62]], 'brn3', { size: 6 });   // μπράτσο
    g.poly([[cx + s * 26, 96], [cx + s * 26, 62], [cx + s * 20, 62], [cx + s * 20, 96]], 'brn2', { size: 6 });
    g.ell(cx + s * 26, 57, 3, 3, 'gld3');
    g.blob([[cx + s * 25, 54], [cx + s * 29, 50], [cx + s * 30, 56], [cx + s * 27, 58]], 'brn3', { size: 3 });   // κεφάλι λιονταριού στο μπράτσο
  }
  g.poly([[cx - 27, 100], [cx - 26, 94], [cx + 26, 94], [cx + 27, 100]], 'brn1', { size: 6 });
  g.line([[cx - 25, 96.5], [cx + 25, 96.5]], 1, 'gld2', { px: true });
}

// Καθιστός, από μπροστά: πόδια, γόνατα, κορμός, χέρια στα μπράτσα, κεφάλι. o: { skin, robe, robe2, hair, beard, crown, lean, hold }
function artSeated(g, cx, o) {
  const skin = o.skin || 'skn3', lean = o.lean || 0;
  // Γόνατα και κνήμες, πόδια.
  for (const s of [-1, 1]) {
    g.limb([[cx + s * 5, 66], [cx + s * 6, 80], [cx + s * 6.5, 94]], [8, 6.5, 5], 0, o.robe, { size: 6 });
    g.blob([[cx + s * 6.5 - 3.5, 94], [cx + s * 6.5 + 3.5, 94], [cx + s * 7 + 3.5, 98], [cx + s * 7 - 3.5, 98]], 'brn2', { size: 3 });
  }
  if (o.skirt) g.blob([[cx - 13, 64], [cx + 13, 64], [cx + 14, 95], [cx - 14, 95]], o.robe, { size: 14 });
  // Μηροί (κοιτάμε από μπροστά: φαίνονται κοντοί).
  g.blob([[cx - 13, 58], [cx + 13, 58], [cx + 12, 70], [cx - 12, 70]], o.robe, { size: 12 });
  // Κορμός (γέρνει με το lean).
  const L = lean * 5;
  const torso = g.blob([[cx - 11 + L * 0.3, 30], [cx + L, 28], [cx + 11 + L * 0.3, 30], [cx + 10, 46], [cx + 12, 60], [cx - 12, 60], [cx - 10, 46]], o.robe, { size: 18 });
  g.hatch(torso, o.robe.replace(/\d/, (d) => Math.max(0, d - 2)), 4, (i) => [[cx - 6 + i * 4 + L * 0.5, 32], [cx - 7 + i * 4.6, 58]], 1, 3);
  if (o.robe2) g.blob([[cx - 12 + L * 0.3, 29], [cx - 4 + L, 28], [cx + 6, 44], [cx + 12, 64], [cx + 2, 70], [cx - 13, 62]], o.robe2, { size: 14 });
  if (o.armor) {
    g.blob([[cx - 9 + L * 0.3, 31], [cx + 9 + L * 0.3, 31], [cx + 8, 44], [cx - 8, 44]], o.armor, { size: 10 });
    g.line([[cx - 6 + L * 0.3, 36], [cx + 6 + L * 0.3, 36]], 1, 'gld3', { px: true });
    g.line([[cx + L * 0.3, 32], [cx + L * 0.3, 43]], 1, 'gld2', { px: true });
  }
  g.line([[cx - 10, 46], [cx + 10, 46]], 1.6, 'gld2', {});
  // Χέρια: από τους ώμους στα μπράτσα του θρόνου (ή κρατάνε κάτι).
  const sh = [[cx - 12 + L * 0.3, 32], [cx + 12 + L * 0.3, 32]];
  const handL = o.handL || [cx - 22, 55], handR = o.handR || [cx + 22, 55];
  g.limb([sh[0], [cx - 16, 44], handL], [6, 5, 4], 0, skin, { size: 5 });
  g.limb([sh[1], [cx + 16, 44], handR], [6, 5, 4], 0, skin, { size: 5 });
  g.limb([sh[0], [cx - 15, 38]], 7, 6.5, o.robe, { size: 6 });
  g.limb([sh[1], [cx + 15, 38]], 7, 6.5, o.robe, { size: 6 });
  g.ell(handL[0], handL[1], 2.5, 2.5, skin); g.ell(handR[0], handR[1], 2.5, 2.5, skin);
  // Λαιμός, κεφάλι (από μπροστά).
  const hx = cx + L, hy = 17 + Math.abs(lean) * 2;
  g.limb([[hx, 30], [hx, hy + 6]], 5, 4.5, skin, { size: 4 });
  if (o.hair && !o.beard) g.blob([[hx - 8, hy - 2], [hx - 6, hy - 9], [hx, hy - 11], [hx + 6, hy - 9], [hx + 8, hy - 2], [hx + 10, hy + 17], [hx + 6, hy + 19], [hx + 4.5, hy + 7], [hx - 4.5, hy + 7], [hx - 6, hy + 19], [hx - 10, hy + 17]], o.hair, { size: 8 });
  else if (o.hair) g.blob([[hx - 8, hy - 2], [hx - 6, hy - 9], [hx, hy - 11], [hx + 6, hy - 9], [hx + 8, hy - 2], [hx + 8, hy + 6], [hx - 8, hy + 6]], o.hair, { size: 8 });
  g.blob([[hx - 6, hy - 3], [hx - 4.5, hy - 8.5], [hx, hy - 9.5], [hx + 4.5, hy - 8.5], [hx + 6, hy - 3], [hx + 5, hy + 4], [hx + 2, hy + 7.5], [hx - 2, hy + 7.5], [hx - 5, hy + 4]], skin, { size: 11 });
  g.px(hx - 2.4, hy - 1.5, o.eyes || 'ink1', 1); g.px(hx + 2.4, hy - 1.5, o.eyes || 'ink1', 1);
  if (o.eyes) { g.mark(hx - 2.4, hy - 1.5); g.mark(hx + 2.4, hy - 1.5); }
  g.line([[hx - 3.6, hy - 3.4], [hx - 1.2, hy - 3]], 1, 'ink1', { px: true }); g.line([[hx + 1.2, hy - 3], [hx + 3.6, hy - 3.4]], 1, 'ink1', { px: true });
  g.line([[hx, hy - 1], [hx + 0.4, hy + 1.8]], 1, skin.replace(/\d/, (d) => Math.max(0, d - 1)), { px: true });
  g.line([[hx - 1.4, hy + 4.2], [hx + 1.4, hy + 4.2]], 1, 'mar3', { px: true });
  if (o.beard) {
    g.blob([[hx - 5.5, hy + 1], [hx + 5.5, hy + 1], [hx + 5, hy + 8], [hx + 2, hy + 13], [hx - 2, hy + 13], [hx - 5, hy + 8]], o.beard, { size: 8 });
    g.line([[hx - 1.8, hy + 4], [hx + 1.8, hy + 4]], 1, 'mar2', { px: true });
    g.hatch(g.path([[hx - 5.5, hy + 1], [hx + 5.5, hy + 1], [hx + 5, hy + 8], [hx + 2, hy + 13], [hx - 2, hy + 13], [hx - 5, hy + 8]]), 'ink0', 4, (i) => [[hx - 3 + i * 2, hy + 6], [hx - 2.5 + i * 1.6, hy + 12]], 1, 7);
  }
  if (o.hairTop) g.blob([[hx - 6.5, hy - 3], [hx - 5, hy - 9.5], [hx, hy - 11], [hx + 5, hy - 9.5], [hx + 6.5, hy - 3], [hx + 3, hy - 6.5], [hx - 3, hy - 6.5]], o.hairTop, { size: 6 });
  if (o.crown) o.crown(g, hx, hy - 9);
  if (o.hold) o.hold(g, handL, handR);
}

ART_BUILDERS.push((A) => {
  const P = ART_PX;
  // Η ζωντανή Ευρυδίκη: λευκό φόρεμα με κόκκινη ταινία, μακριά σκούρα μαλλιά, στεφάνι από λουλούδια.
  A.paint('euryAlive', 60, 100, 23 * P, (g, f) => artPerson(g, { frame: f, long: true, robe: 'crm4', hem: 'red3', hair: 'mar4', style: 'long', hairLen: 4, flowers: 'crm5', skin: 'skn3', belt: 'red3' }), { frames: 3, dither: 0.3 });
  // Η Ευρυδίκη-σκιά (VIII, και στο τέλος): χλωμή, φωτεινή, η ουρά της λιώνει.
  A.paint('eurydice3d', 60, 100, 23 * P, (g, f) => artGhost(g, { frame: f, style: 'long', hairLen: 6, robe: 'crm3', hair: 'crm2', flowers: 'crm5' }), { frames: 3, dither: 0.3, outline: [92, 66, 42] });
  // Οι ψυχές: άντρας, γυναίκα, γέρος.
  A.paint('soulM3d', 60, 100, 23 * P, (g, f) => artGhost(g, { frame: f, style: 'short', robe: 'crm2', hair: 'crm1' }), { frames: 2, dither: 0.3, outline: [92, 66, 42] });
  A.paint('soulF3d', 60, 100, 22 * P, (g, f) => artGhost(g, { frame: f, style: 'bun', robe: 'crm2', hair: 'crm1' }), { frames: 2, dither: 0.3, outline: [92, 66, 42] });
  A.paint('soulOld3d', 60, 100, 22 * P, (g, f) => artGhost(g, { frame: f, style: 'bald', beard: 'crm4', robe: 'crm2', hair: 'crm4', bow: 0.6 }), { frames: 2, dither: 0.3, outline: [92, 66, 42] });
  // Ο γέρος του χωριού: λευκά μαλλιά και γένια, καφέ μανδύας, ραβδί.
  A.paint('villager', 60, 100, 23 * P, (g) => artPerson(g, {
    robe: 'crm3', robe2: 'brn3', style: 'bald', hair: 'crm4', beard: 'crm4', bow: 0.5, skin: 'skn2',
    armF: [[34, 23], [38, 33], [43, 38]], hold: (g2, h) => g2.limb([[h[0] + 1, h[1] - 18], [h[0] + 1.5, h[1]], [h[0] + 3, 99]], 2.2, 2, 'brn2', { size: 2 }),
  }), { dither: 0.3 });
  // Χωρικοί (νέοι): μια γυναίκα με κανάτι στον ώμο, ένας βοσκός, ένα παιδί.
  A.paint('villagerF', 60, 100, 22 * P, (g, f) => artPerson(g, {
    frame: f, long: true, robe: 'brn5', hem: 'mar3', style: 'bun', hair: 'brn1', belt: 'mar3', skin: 'skn3',
    armF: [[34, 23], [37, 34], [41, 40]], hold: (g2, h) => { const x = h[0] + 2, y = h[1] + 6; g2.blob([[x - 5, y - 4], [x - 2, y - 10], [x + 3, y - 10], [x + 6, y - 4], [x + 4, y + 5], [x - 3, y + 5]], 'cla2', { size: 9 }); g2.line([[x - 4, y - 5], [x + 5, y - 5]], 1, 'ink1', { px: true }); g2.ell(h[0], h[1] + 1, 2.2, 2.6, 'skn3'); },
  }), { frames: 3, dither: 0.3 });
  A.paint('shepherd', 60, 100, 23 * P, (g, f) => artPerson(g, {
    frame: f, robe: 'brn4', robe2: 'brn2', style: 'short', hair: 'ink3', beard: 'ink3', skin: 'skn2',
    armF: [[34, 23], [38, 33], [43, 38]], hold: (g2, h) => { g2.limb([[h[0] + 1, h[1] - 22], [h[0] + 1.5, h[1]], [h[0] + 3, 99]], 2.2, 2, 'brn2', { size: 2 }); g2.limb([[h[0] + 1, h[1] - 22], [h[0] + 5, h[1] - 26], [h[0] + 7, h[1] - 22]], 2, 1.8, 'brn2', { size: 2 }); },
  }), { frames: 3, dither: 0.3 });
  A.paint('child', 60, 100, 14 * P, (g, f) => artPerson(g, { frame: f, robe: 'crm4', hem: 'red3', style: 'short', hair: 'brn2', skin: 'skn3' }), { frames: 3, dither: 0.3 });
  // Άνθρωποι της κηδείας: μαύρα, η γυναίκα με μαντίλα και τα χέρια στο πρόσωπο, ο άντρας σκυφτός.
  A.paint('mournerF', 60, 100, 22 * P, (g) => artPerson(g, {
    long: true, robe: 'ink3', robe2: 'ink2', style: 'veil', veil: 'ink2', hair: 'ink1', bow: 1, skin: 'skn2',
    armF: [[34, 23], [40, 26], [39, 17]], armB: [[29, 23], [33, 27], [37, 18]],
  }), { dither: 0.3 });
  A.paint('mournerM', 60, 100, 23 * P, (g) => artPerson(g, { robe: 'ink3', robe2: 'ink2', style: 'short', hair: 'ink1', beard: 'ink2', bow: 1.2, skin: 'skn2' }), { dither: 0.3 });

  // Ο Χάροντας: ψηλός, σκελετωμένος γέρος με κουκούλα, γκρίζα γένια, μάτια που λάμπουν, κουπί.
  // f = 0 ήρεμος (κρατάει το κουπί), 1 = απλώνει την παλάμη για τον οβολό.
  A.paint('charon3d', 60, 100, 24 * P, (g, f) => {
    // Το κουπί, διαγώνια πίσω του.
    g.limb([[52, 2], [22, 96]], 2.6, 2.4, 'brn2', { size: 2 });
    g.blob([[18, 86], [25, 88], [24, 100], [17, 99]], 'brn2', { size: 5 });
    artPerson(g, {
      long: true, robe: 'brn2', robe2: 'brn1', style: 'hood', veil: 'brn1', hair: 'crm2', beard: 'crm3', skin: 'skn2', bow: 0.8, eyes: 'gld4',
      armB: [[28, 23], [36, 22], [43, 18]],
      armF: f ? [[34, 23], [42, 30], [49, 32]] : [[34, 23], [40, 30], [44, 26]],
    });
    if (f) g.blob([[47, 31], [52, 30], [53, 33], [48, 34]], 'skn3', { size: 2 });   // η παλάμη ανοιχτή
    g.mark(36.4 + 1.2, 9.3 + 1.6);
  }, { frames: 2, dither: 0.3 });
  // Η βάρκα του Χάροντα: μακριά, μαύρη, με πλώρη που σηκώνεται και ένα "μάτι".
  A.paint('boat3d', 170, 40, 10 * P, (g) => {
    g.blob([[4, 4], [10, 14], [30, 22], [140, 22], [160, 12], [168, 2, 1], [164, 18], [150, 32], [120, 38], [40, 38], [16, 30]], 'brn1/brn3', { size: 22 });
    g.line([[12, 16], [40, 24], [140, 24], [158, 16]], 1.5, 'brn3', {});
    g.hatch(g.path([[4, 4], [10, 14], [30, 22], [140, 22], [160, 12], [168, 2], [164, 18], [150, 32], [120, 38], [40, 38], [16, 30]]), 'ink1', 4, (i) => [[20, 27 + i * 3], [150, 27 + i * 3]], 1, 2);
    g.ell(150, 20, 4, 2.6, 'crm4'); g.dot(151, 20, 1.4, 'ink0');
  }, { dither: 0.2 });

  // Ο Άδης: καθιστός, σκούρος χιτώνας, θώρακας, μαύρα γένια, στέμμα με αγκάθια, δικράνι στο δεξί χέρι.
  A.paint('hades3d', 70, 100, 31 * P, (g) => {
    artThrone(g, 35);
    artSeated(g, 35, {
      robe: 'ink3', robe2: 'mar2', armor: 'ink4', skin: 'skn2', hair: 'ink2', beard: 'ink2', eyes: 'red5',
      handR: [55, 50],
      crown: (g2, x, y) => { g2.poly([[x - 7, y + 3], [x - 7, y - 1], [x + 7, y - 1], [x + 7, y + 3]], 'ink2/ink4', { size: 4 }); for (let i = 0; i < 5; i++) g2.poly([[x - 6.5 + i * 3.2, y - 0.5], [x - 5.5 + i * 3.2, y - 6 - (i === 2 ? 3 : 0), 1], [x - 4.5 + i * 3.2, y - 0.5]], 'ink2/ink4', { size: 2 }); g2.dot(x, y + 1, 1, 'red4'); },
      hold: (g2, hl, hr) => {
        // Το δικράνι: κοντάρι από το χέρι ως πάνω, με δύο δόντια.
        g2.limb([[hr[0], 98], [hr[0], 2]], 2, 2, 'ink3/ink5', { size: 2 });
        g2.limb([[hr[0] - 4, 10], [hr[0] - 4, 1]], 1.6, 0.6, 'ink3/ink5', { size: 2 });
        g2.limb([[hr[0] + 4, 10], [hr[0] + 4, 1]], 1.6, 0.6, 'ink3/ink5', { size: 2 });
        g2.line([[hr[0] - 4.5, 10.5], [hr[0] + 4.5, 10.5]], 1.6, 'ink4', {});
        g2.ell(hr[0], hr[1], 2.6, 3, 'skn2');
      },
    });
  }, { dither: 0.3 });
  // Η Περσεφόνη: καθιστή, κρασάτο φόρεμα με χρυσή ζώνη, μακριά μαλλιά, στεφάνι με λουλούδια και ρόδια,
  // ένα ρόδι στο χέρι. f = 1: γέρνει, συγκινημένη.
  A.paint('persephone3d', 70, 100, 30 * P, (g, f) => {
    artThrone(g, 35);
    artSeated(g, 35, {
      robe: 'mar4', robe2: 'red3', skin: 'skn3', hair: 'mar2', hairTop: 'mar2', skirt: true, lean: f ? -0.8 : 0,
      handL: [26, 54], handR: f ? [33, 36] : [44, 54],
      crown: (g2, x, y) => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.117); const px = x - Math.cos(a) * 7, py = y + 4 - Math.sin(a) * 4; g2.dot(px, py, 1.4, i % 2 ? 'crm4' : 'red4'); g2.px(px, py, i % 2 ? 'gld4' : 'red5'); } },
      hold: (g2, hl) => { g2.ell(hl[0], hl[1] - 1, 3, 2.8, 'red4'); g2.px(hl[0], hl[1] - 3.6, 'gld3'); },
    });
  }, { frames: 2, dither: 0.3 });

  // Άγαλμα: μια μορφή από μάρμαρο σε βάθρο, με δόρυ (ο μεγάλος τοίχος του παλατιού / των Αγρών του Πένθους).
  A.paint('statue', 60, 130, 30 * P, (g) => {
    g.ctx.save();
    g.ctx.translate(0, 0);
    artPerson(g, { robe: 'brn5', robe2: 'brn4', skin: 'brn5', hair: 'brn4', beard: 'brn4', style: 'short', eyes: 'brn3', belt: 'brn3',
      armF: [[34, 23], [40, 18], [42, 10]], hold: (g2, h) => g2.limb([[h[0], -0], [h[0] + 1, 99]], 1.6, 1.6, 'brn4', { size: 2 }) });
    g.ctx.restore();
    g.poly([[16, 100], [44, 100], [46, 126], [14, 126]], 'brn3', { size: 20 });
    g.poly([[12, 126], [48, 126], [49, 130], [11, 130]], 'brn2', { size: 4 });
    g.poly([[14, 98], [46, 98], [46, 102], [14, 102]], 'brn4', { size: 4 });
    g.line([[20, 112], [40, 112]], 1, 'brn2', { px: true });
  }, { dither: 0.3 });
});

// ---- Τα χέρια του Ορφέα με τη λύρα (ο παίκτης, js/hands.js) ----
// Ίδια γεωμετρία με την παλιά ζωγραφιά (HANDS_W × HANDS_H, η βάση της λύρας στο HANDS_OX / HANDS_OY), σε διπλή
// ανάλυση: ηχείο από καβούκι χελώνας με πλάκες, χρυσά κέρατα, ζυγός, χέρια με δάχτυλα και λευκά μανίκια.
// Οι χορδές ζωγραφίζονται ζωντανά από το Hands.draw.
function artLyreHands(g, pluck) {
  const X = (x) => x + HANDS_OX, Y = (y) => y + HANDS_OY;
  const SKIN = 'skn3/skn4', SLV = 'crm4/crm5';
  // Πήχεις (πίσω από τη λύρα): δέρμα ως τη μέση, μετά λευκό μανίκι με πτυχές.
  const arm = (x0, y0, x1, y1) => {
    const mx = x0 + (x1 - x0) * 0.55, my = y0 + (y1 - y0) * 0.55;
    g.limb([[X(x0), Y(y0)], [X(mx), Y(my)]], 6.4, 7.6, SKIN, { size: 6 });
    const sl = g.limb([[X(mx), Y(my)], [X(x1), Y(y1)]], 9, 11, SLV, { size: 8, cap: false });
    g.hatch(sl, 'crm2', 3, (i) => [[X(mx) + i * 3 - 3, Y(my) + 2], [X(x1) + i * 3 - 6, Y(y1)]], 1, 2);
  };
  arm(-13, -24, -44, 14);
  arm(pluck ? 6 : 8, -12, 42, 14);
  // Τα κέρατα (βραχίονες): χρυσά, καμπύλα, ανοίγουν και ξανακλείνουν προς τον ζυγό.
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([X(sd * (8 + 5 * Math.sin(t * Math.PI) - t)), Y(-12 - 26 * t)]); }
    g.limb(pts, [3.4, 3, 2.6, 2.4, 2.4, 2.6, 3], 0, 'gld2/gld4', { size: 3 });
  }
  // Ο ζυγός, με κόμβους στις άκρες.
  g.limb([[X(-12), Y(-36.5)], [X(12), Y(-36.5)]], 2.4, 2.4, 'brn2/brn4', { size: 2 });
  for (const sd of [-1, 1]) g.ell(X(sd * 11.5), Y(-36.5), 1.8, 2.4, 'gld2/gld4');
  // Το ηχείο: καβούκι χελώνας — χρυσό χείλος, καφέ πλάκες με σκούρους αρμούς.
  const shell = g.ell(X(0), Y(-7), 12, 7.6, 'gld1/gld3', { size: 10 });
  const inner = g.ell(X(0), Y(-7.2), 10.4, 6.2, 'brn3/brn4', { size: 8 });
  g.inside(inner, () => {
    for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) {
      const cx = X(c * 3.4 + (r % 2) * 1.7), cy = Y(-11 + r * 3.2);
      g.poly([[cx - 1.4, cy - 1.4], [cx + 1.4, cy - 1.4], [cx + 2, cy], [cx + 1.4, cy + 1.4], [cx - 1.4, cy + 1.4], [cx - 2, cy]], r === 1 ? 'brn4' : 'brn3', { flat: true });
    }
  });
  void shell;
  // Ο καβαλάρης, όπου δένουν οι χορδές.
  g.poly([[X(-6), Y(-10.6)], [X(6), Y(-10.6)], [X(6), Y(-8.6)], [X(-6), Y(-8.6)]], 'brn1/brn3', { size: 2 });
  // Αριστερό χέρι: τυλιγμένο γύρω από το κέρατο (δάχτυλα μπροστά του).
  g.blob([[X(-18), Y(-29)], [X(-15), Y(-32)], [X(-11), Y(-31)], [X(-9), Y(-27)], [X(-10), Y(-23)], [X(-15), Y(-22.5)], [X(-18), Y(-25)]], SKIN, { size: 7 });
  for (let k = 0; k < 4; k++) g.limb([[X(-12.5), Y(-30.4 + k * 2)], [X(-9.2), Y(-30 + k * 2)]], 1.8, 1.6, SKIN, { size: 2 });
  g.limb([[X(-16), Y(-31)], [X(-13), Y(-33.5)]], 2, 1.6, SKIN, { size: 2 });   // αντίχειρας
  // Δεξί χέρι: στο ηχείο, ο δείκτης και ο μέσος προς τις χορδές (στο χτύπημα: πάνω από τις χορδές).
  const dx = pluck ? -2 : 0;
  g.blob([[X(5 + dx), Y(-18)], [X(10 + dx), Y(-19)], [X(12.5 + dx), Y(-15)], [X(11 + dx), Y(-11)], [X(6 + dx), Y(-10.5)], [X(4.4 + dx), Y(-14)]], SKIN, { size: 7 });
  const tip = pluck ? -3 : 1;
  g.limb([[X(5.5 + dx), Y(-16)], [X(tip + 1.5), Y(-16.4)], [X(tip), Y(-15.6)]], 1.8, 1.5, SKIN, { size: 2 });
  g.limb([[X(5.5 + dx), Y(-13.8)], [X(tip + 2), Y(-14)], [X(tip + 0.6), Y(-13.2)]], 1.8, 1.5, SKIN, { size: 2 });
  g.limb([[X(8 + dx), Y(-11.2)], [X(5 + dx), Y(-10.6)]], 1.8, 1.6, SKIN, { size: 2 });
}

// Το δεξί χέρι μόνο του (όταν κρατάς κάτι άλλο): πήχης από κάτω δεξιά με λευκό μανίκι, ανοιχτή παλάμη. 44 × 40.
function artHoldHand(g) {
  const sl = g.limb([[42, 44], [31, 33]], 12, 11, 'crm4/crm5', { size: 9, cap: false });
  g.hatch(sl, 'crm2', 3, (i) => [[30 + i * 4, 34], [40 + i * 4, 44]], 1, 2);
  g.limb([[32, 34], [19, 21]], 8.4, 7, 'skn3/skn4', { size: 7 });
  g.blob([[8, 18], [12, 15], [20, 14.5], [25, 17], [24, 22], [16, 23.5], [9, 22]], 'skn3/skn4', { size: 8 });
  for (const fx of [9.5, 12.5, 15.5]) g.limb([[fx, 17], [fx - 0.6, 13.4]], 2.2, 1.8, 'skn3/skn4', { size: 2 });
  g.limb([[22, 16], [25.5, 13.5]], 2.4, 2, 'skn3/skn4', { size: 2 });
}

ART_BUILDERS.push((A) => {
  if (typeof HANDS_W === 'undefined') return;
  const lyre = [false, true].map((pluck) => A.paint('_lyre' + (pluck ? 1 : 0), HANDS_W, HANDS_H, HANDS_H * 2, (g) => artLyreHands(g, pluck), { pad: 0, dither: 0.25 })[0]);
  const hold = A.paint('_hold', 44, 40, 80, artHoldHand, { pad: 0, dither: 0.25 })[0];
  // Η μαύρη σιλουέτα (για το σκοτάδι) του κάθε καρέ.
  const black = (cv) => {
    const s = document.createElement('canvas');
    s.width = cv.width; s.height = cv.height;
    const c = s.getContext('2d');
    c.drawImage(cv, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#000';
    c.fillRect(0, 0, s.width, s.height);
    return s;
  };
  A.hands = { art: lyre.map((fr) => ({ c: fr.c, s: black(fr.c) })), hold: { c: hold.c, w: 44, h: 40, palmX: 16, palmY: 15 } };
});
