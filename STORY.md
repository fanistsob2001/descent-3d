# DESCENT: Story & Game Design

This file is the source of truth for the story version of the game.
All in-game text is in ENGLISH and must be used exactly as written below.
Technical rules from CLAUDE.md still apply (plain HTML/CSS/JS + Canvas, no npm, no build tools, no external libraries).

---

## 1. Overview

- Title: **DESCENT**
- Based on the Greek myth of Orpheus and Eurydice.
- The player is Orpheus, descending into the Underworld to bring Eurydice back.
- Monsters are now called **shades** (souls of the dead). They are blind and hunt by sound, exactly like the current monsters.
- In Tartarus there are also **Erinyes** (the Furies): winged women with snakes for hair. They fly (over water and chasms), hear only loud sounds (a big wave or a shattering jar, never footsteps or small waves), but when they hear one they are faster than a running Orpheus.
- Target length: about **25-35 minutes** for a first playthrough. Each chapter about **3-4 minutes**.

## 2. Structure

- **One continuous map** instead of separate levels, split into **8 chapters**.
- **Organic linear flow, NOT a maze:** a continuous, atmospheric downward descent through open chambers, corridors, ruins and bridges. No complex mazes, no stressful dead ends. The challenge is avoiding the shades (stealth) and timing, not finding the way.
- Small, **optional side rooms** hold the collectibles (lyre strings) and the lost soul inscriptions.
- Difficulty ramp: tutorial → 1 shade → decoy introduced → 2 shades in the open → sound carries over water → Erinyes (only loud sounds are dangerous) → the palace → hardest.
- At the start of each chapter there is a **checkpoint**: an altar with an unlit flame.
  - Reaching it lights the flame and saves progress.
  - Shows: "The flame is lit. Your progress is saved."
  - Then shows the chapter title, the chapter line and the objective (see section 7).
- On death: jump scare, then respawn at the last checkpoint with the state saved at that checkpoint.

## 3. Chapters

| # | Name | Shades | What is new |
|---|---|---|---|
| I | The Gate of Taenarum | 0 | Tutorial: movement, sound waves, slow walking is silent. |
| II | The Shore of Acheron | 1 | Find the obol and pay Charon to cross (the obol works as a key for a gate). First string. |
| III | The Waters of Lethe | 1 (guarding the passage) | Libation jar introduced. **Lethe effect:** in this chapter, revealed walls fade much faster (about 0.5s instead of 1.5s). Second string. |
| IV | The Asphodel Meadows | 2 | A wide, open meadow with scattered stones: nowhere to hide, the shades can come from any side. |
| V | The Marshes of Styx | 2 (one guarding) | Narrow causeways over black water. Sound carries over the water, so shades hear from across it. |
| VI | The Pit of Tartarus | 2 Erinyes | Chasms and bridges. The Erinyes hear only loud sounds: keep the waves small (a rehearsal for the Ascent). |
| VII | The Palace of Hades | 2 | Third string. Middle cutscene plays at the end of this chapter. |
| VIII | The Ascent | 2 | Eurydice follows. The "Don't look back" rule (see section 5). |

## 4. Items and abilities

- **Obol** (chapter II): a coin. Needed to pay Charon. Without it, the gate/boat does not open.
- **Libation jar** (replaces the old decoy): thrown the same way as the old decoy. It shatters with a loud sound and the shades go to it. Limited number, with a counter on screen. More jars can be found on the map.
- **Lyre strings** (3 total: one in chapter II, one in III, one in VII): optional collectibles hidden off the main path. The count is shown as "Strings: X/3".
- **Melody** (ability): unlocked when all 3 strings are collected. Freezes nearby shades for a few seconds. Limited uses, refilled at each checkpoint. Its own button on mobile, key Q on PC.

## 5. Chapter VIII rule: "Don't look back"

- Eurydice follows the player. Soft footsteps are heard behind the player, and now and then she whispers "Orpheus... I am right behind you."
- Small waves are allowed. A **big wave** (charging past a threshold) means "looking back".
- First-person version: **turning around** also means "looking back" — turning the view more than 120° away from the way you are going, towards her (she is then within 60° of where you look). A little before that, the edges of the screen turn red, with the same warning vibration and tension audio.
- While charging in chapter VIII, the charge indicator turns red past that threshold as a warning, with a warning vibration pulse and rising tension audio.
- **Drag-to-cancel:** the player can drag the finger away (while holding) to cancel a charged wave safely without releasing it. This works in every chapter.
- If the player releases a big wave: a whisper "Orpheus..." that fades away into silence, then the text "The footsteps behind you stop." Her footsteps stop for good. The player continues alone, and this leads to the bad ending.
- Reaching the exit without a big wave in chapter VIII leads to the good ending.
- After the bad ending, offer: "Try again from the last checkpoint" and "Main menu".

## 6. Art direction

- **Retro 8-bit / pixel art combined with ancient Greek pottery**: black background, terracotta/orange outlines, dark clay floor tiles, meander (Greek key) patterns as borders and decoration.
- Waves reveal walls as terracotta lines (and the clay floor tiles), as if uncovering a painted vase.
- Smooth camera follow, subtle screen shake on jump scares. Works in portrait and landscape.
- Characters (Orpheus, Eurydice, shades, Erinyes, Charon, the lost souls; Hades, Persephone and the snake in the cutscenes) are 8-bit pixel sprites in the same warm palette. The Erinyes are winged women seen from the front: dark red faces, glowing yellow eyes, golden snakes for hair, black robes and wings; they hover as they fly.
- The jump scare face is the face of the monster that caught Orpheus, drawn like it is in the game (same pixel style): a shade (glowing white eyes, black tears, jagged teeth) or an Erinys (snakes for hair, yellow eyes, screaming mouth, wings).

## 7. Menu and cutscenes

- **Main menu:** New Game, Continue (from last checkpoint, only if a save exists), Settings (sound on/off, vibration on/off). One save slot only.
- **Cutscenes:** text lines fade in one at a time on a black screen, with subtle sound. Tap/click to advance, with a Skip button.
- Cutscenes: Intro (on New Game), Middle (end of chapter VII), Good ending, Bad ending.
- **All characters have voices** (see section 10), always with subtitles.

---

## 8. ALL IN-GAME TEXT

### Intro cutscene
A snake in the grass. A single bite.
Eurydice never woke again.
Everyone said the dead do not return.
Orpheus did not listen.
At Taenarum, the earth opens downward. He went down.
On the first step he slipped. His lyre shattered on the rocks.
Its strings scattered into the dark.
There is no light down here.
Only what can be heard.

### Checkpoint message
The flame is lit. Your progress is saved.

### Chapters (title / line / objective)

**I. The Gate of Taenarum**
Line: The living do not come down here. You did.
Objective: Your lyre is broken. Its three strings lie somewhere below. Find the way down.

**II. The Shore of Acheron**
Line: The ferryman takes no one for free. Not even the dead.
Objective: Find an obol to pay the ferryman. A string lies somewhere along the shore. Strings: X/3

**III. The Waters of Lethe**
Line: What you see here, you soon forget. Do not forget why you came.
Objective: A string sank near the river. Strings: X/3

**IV. The Asphodel Meadows**
Line: Here wander the dead who were neither good nor wicked. Only forgotten.
Objective: The meadow is wide and open. Cross it unheard. Strings: X/3

**V. The Marshes of Styx**
Line: Even the gods fear this water. They swear their oaths on it.
Objective: Sound carries far over the water. Cross the causeways quietly. Strings: X/3

**VI. The Pit of Tartarus**
Line: Below everything, the Furies keep watch over the damned.
Objective: The Furies hear only loud sounds, but nothing is faster. Keep your voice low. Strings: X/3

**VII. The Palace of Hades**
Line: The king of the dead has never heard a song.
Objective: A string is hidden in the palace. Strings: X/3

**VIII. The Ascent**
Line: Behind you, footsteps. Hers. Do not look back.
Objective if Strings = 3/3: Your lyre is whole. Play it when the shades come near.
Objective otherwise: Your lyre is still broken. You climb without its song.

(X is always the real number of strings the player has collected.)

### Item and event messages
- At Charon without obol: The ferryman takes no one for free. Show me the coin, living one.
- At Charon with obol: The river claims your coin. Step aboard...
- Picking up a libation jar: A libation jar. The dead hunger for offerings. Throw it, and they will come.
- Picking up a string (1st and 2nd): You found a string (X/3).
- Picking up the 3rd string: Your lyre is whole again. When you play, the shades remember they were once alive.
- Big wave in chapter VIII: (whisper) Orpheus... then: The footsteps behind you stop.
- Eurydice following in chapter VIII (soft whisper, now and then): Orpheus... I am right behind you.
- Shades, when they sense a sound wave (distorted whisper, one of): Who is there? | I hear life...
- Erinyes, when they hear a loud sound (shriek, one of): Who dares to sing here? | We hear you, living one.
- First-person version, in the throne room of chapter VII, when a wave reveals them on their thrones:
  - Hades (deep, heavy): Another living soul in my halls. Come closer, singer.
  - Persephone (soft, regal): I can hear the world above in your footsteps.

### Messages from lost souls
Hidden on the map, visible only when a wave touches them. Placement: 1 in chapter I, 2 in II, 3 and 4 in III, 7 in IV, 8 in V, 9 in VI, 5 in VII, 6 in VIII.
1. I thought I would find my way back, too.
2. I had no obol. I have waited on this shore for a hundred years.
3. I drank from the river. I don't remember my name. Only that someone was waiting for me.
4. The shades cannot see. They listen. Walk as if you do not exist.
5. The queen ate six pomegranate seeds. That is why she can never leave.
6. Everyone looks back at the end. Everyone.
7. I was not good enough for Elysium, nor wicked enough for Tartarus. So I wait here, and nothing ever happens.
8. I swore I would wait for him. The river remembers every oath.
9. The Furies have never wept. They say only a song could make them.

### Middle cutscene (end of chapter VII)
Orpheus played.
For the first time, something wept in the Underworld.
Persephone leaned toward Hades. He was silent for a long time.
"Take her," he said. "She will follow you to the light.
But if you turn to look at her before you leave,
she stays here. Forever."

### Good ending
Light.
Orpheus stepped into the open air and did not turn. He waited.
A hand touched his shoulder.
You didn't look...
In the myth, he looked.
You didn't.

### Bad ending
Orpheus turned.
For a moment he saw her, just as he remembered.
Then the dark took her back, without a sound.
He stepped into the light alone.
Just like in the myth.

---

## 9. Easter eggs (add ONLY after all 4 stages are done)

Rule: easter eggs are hidden and harmless. Never in chapter VIII, cutscenes or endings.

**A. The shade stuck in the wall** (chapter II)
- In a quiet side corridor, a harmless shade endlessly walks into a wall, like a pathfinding bug.
- It never chases the player, never hears sounds and cannot kill.
- When a wave touches it, show: I have been walking into this wall for three thousand years.

**B. Cerberus sleeps** (hidden room, chapter VII)
- A small, out-of-the-way room with no shades nearby. A big three-headed dog silhouette sleeps there (same pottery style).
- When a wave touches it, it barks three times, each head at a different pitch (low, middle, high).
- Show: Good boy. Good boy. Good boy.
- The barks do NOT attract shades. Cerberus never moves and cannot hurt the player.

---

## 10. Voices

Every line of dialogue is voiced, always with subtitles (except the chapter lines, see below). First-person version: the voices are real human-sounding speech voices (the most natural voices the player's browser has), male or female as below, each character with a voice of their own where possible. There are no 8-bit voices any more.

| Speaker | Voice | Lines |
|---|---|---|
| Narrator | warm, calm (male) | In the game: "The footsteps behind you stop." |
| Orpheus | young man, warm, melodic | "Good boy. Good boy. Good boy." (to Cerberus) |
| Charon | very deep, slow, gravelly (old man) | Both Charon lines |
| Eurydice | soft, high, breathy whisper (female) | "Orpheus... I am right behind you." · "Orpheus..." (big wave, fades into silence) |
| Shades | distorted, eerie whisper/moan, from where the shade is; half of the shades male, half female | "Who is there?" · "I hear life..." |
| Erinyes | female, harsh shriek with hissing snakes, from where the Erinys is | "Who dares to sing here?" · "We hear you, living one." |
| Lost souls | whispered, from where the inscription is: souls 1, 4 and 7 a man, souls 2 and 9 an old man, souls 3, 5, 6 and 8 a woman | Each inscription is spoken when a wave touches it |
| Persephone | soft, regal (female) | First-person version: "I can hear the world above in your footsteps." |
| Hades (in the throne room) | deep, heavy (male) | First-person version: "Another living soul in my halls. Come closer, singer." |
| Cerberus | three real dog barks (low, middle, high), deep snoring while asleep | — |
| The snake | a hiss when a wave touches it | — |

The player can turn the voices off in Settings (the subtitles stay).

First-person version: the cutscenes are not voiced (text only, under the pictures). In the middle cutscene Persephone has no line: she is only described.

Not voiced (they are interface text, not something a character says): the cutscenes, the chapter title and line at the start of each chapter, the item messages (the libation jar message, "Your lyre is whole again..."), the checkpoint message, the objectives, "You found a string (X/3).", and the control hints.

---

## 11. Missions (first-person version)

Written by Claude at the user's request; the user may change them. Interface text: shown in the pause menu and (the current main mission) in the corner of the screen, not voiced.

The goal: Bring Eurydice back to the world of the living.

Main mission of each chapter (a short title; the full objective is the chapter objective of section 8):
- I: Find the way down
- II: Cross the Acheron
- III: Cross the waters of Lethe
- IV: Cross the Asphodel Meadows
- V: Cross the marshes of Styx
- VI: Pass through Tartarus
- VII: Reach the throne of Hades
- VIII: Lead Eurydice to the light. Do not look back.

Side missions (title: description):
- Mend the lyre: Find the three strings of your lyre.
- The ferryman's toll: Find an obol and pay Charon.
- Voices of the lost: Hear all nine lost souls.
- The potter's hands: Make each of the four offerings at a shrine. (Before 8/10: "Libations: Find every libation jar." — jars are no longer scattered on the map; you make them.)
- Rekindle the flames: Light every altar.
- The guardian sleeps: Lull the hound of Hades to sleep. (First-person version; before: secret, "Wake the hound of Hades.")
- Three thousand years (secret): Find the shade that walks into the wall.

A secret mission shows as "???" until it is completed. When a side mission is completed: Mission complete: (title)

---

## 12. The extended descent (first-person version) — design plan

Written by Claude at the user's request (7/10/2026); the user may change anything here. This is the plan for the
big expansion of the 3D version. It is built in stages; the texts of each part are finalised in this file before
that part is built. Until then, the game keeps the 8 chapters above.

### The world

- One continuous, much bigger world. Spaces are not all the same: narrow passages with a low rock ceiling, and
  huge caverns, river halls and palace halls where there is no ceiling at all — only darkness above, with
  stalactites, roots and chains hanging out of it. Cave walls are tall and jagged; built walls are straight.
- **Never a maze.** Spaces are open and readable: wide caverns, long sight lines, landmarks (a waterfall, a
  statue, a glow in the distance) and one clear way forward. Side rooms are short and obviously optional.
- Saving happens only in **safe rooms** (small shrines of Hermes, guide of souls). Each has a small oil lamp
  (not a big fire): rest at the lamp to save. Shades never enter a shrine. Each shrine also has an offering table
  where you **craft** items.

### Chapters

| # | Name | Line | What is new there |
|---|---|---|---|
| 0 | Thrace (prologue) | — | Playable, in daylight (see below) |
| I | The Gate of Taenarum | The living do not come down here. You did. | The first cave |
| II | The Shore of Acheron | The ferryman takes no one for free. Not even the dead. | Charon and the obol; the crossing (see below) |
| III | The River of Wailing | Cocytus is made of tears. Every one of them is still crying. | Weeping souls everywhere: their noise hides you, and hides the shades |
| IV | The Waters of Lethe | What you see here, you soon forget. Do not forget why you came. | Walls fade fast |
| V | The Asphodel Meadows | Here wander the dead who were neither good nor wicked. Only forgotten. | Wide open space |
| VI | The Fields of Mourning | Here walk those who died of love. They never stopped. | A quiet chapter with no shades, many souls, many stories |
| VII | The Marshes of Styx | Even the gods fear this water. They swear their oaths on it. | First meeting with Cerberus: he breaks loose and you must run (chase) |
| VIII | The River of Fire | Phlegethon burns and roars. Down here, no one can hear you. Or them. | The roar of the fire hides your steps, but also the shades' |
| IX | The Pit of Tartarus | Below everything, the Furies keep watch over the damned. | Sisyphus' boulder; the Furies wake and the whole pit hunts you (chase) |
| X | The Gate of Hades | Three heads. Six ears. One song. | **Boss: Cerberus** |
| XI | The Palace of Hades | The king of the dead has never heard a song. | You play for Hades and Persephone (playable) |
| XII | The Ascent | Behind you, footsteps. Hers. Do not look back. | Eurydice follows; playable endings |

### No monsters before the river; the crossing

- Chapters I and II have **no shades**: only the dark, the sounds and the first lessons of echolocation.
- On the shore of Acheron, before the crossing, you find a **letter** (a clay tablet) left by a living man who
  came down before you. It tells what waits on the other side: the shades are blind, they hunt by sound, walk as
  if you do not exist.
- Paying Charon is a scene: you step into his boat and he rows you across. Thick fog closes in, the shore
  disappears, only the oar and the water are heard. When the fog lifts you are in chapter III, in the
  Underworld proper. From here on, the shades hunt you.

### Texts of the chapters (first-person version, title / line / objective)

The chapters of section 8 keep their texts; only their numbers change. New chapters are marked (new).

**I. The Gate of Taenarum** — as in section 8.
**II. The Shore of Acheron** — as in section 8.
**III. The River of Wailing** (new)
Line: Cocytus is made of tears. Every one of them is still crying.
Objective: The weeping hides your steps, and hides theirs. Listen closely. Strings: X/3
**IV. The Waters of Lethe** — as III in section 8.
**V. The Asphodel Meadows** — as IV in section 8.
**VI. The Fields of Mourning** (new)
Line: Here walk those who died of love. They never stopped.
Objective: No shade walks here. Read what the lovers left behind. Strings: X/3
**VII. The Marshes of Styx** — as V in section 8.
**VIII. The River of Fire** (new)
Line: Phlegethon burns and roars. Down here, no one can hear you. Or them.
Objective: The roar of the fire hides every sound. Watch the light. Strings: X/3
**IX. The Pit of Tartarus** — as VI in section 8.
**X. The Gate of Hades** (new)
Line: Three heads. Six ears. One song.
Objective: The gate of the palace is ahead. Strings: X/3
**XI. The Palace of Hades** — as VII in section 8.
**XII. The Ascent** — as VIII in section 8.

Main missions (section 11) for the new chapters: III "Cross the River of Wailing", VI "Walk the Fields of Mourning",
VIII "Cross the River of Fire", X "Pass the Gate of Hades".

### Clay tablets (read when you pick them up)

- The letter, on the shore of Acheron (II): "I came down alive, like you, with a friend and a foolish plan. Across this river the dead are blind, but they hear everything: a step, a breath, a song. Walk as if you do not exist. If you meet Theseus, tell him I am still waiting. — Pirithous"
- Fields of Mourning (VI), three tablets:
  - "Dido. I built a city and burned with it. When he came down here, he spoke to me. I did not answer."
  - "Laodamia. The gods gave him back to me for three hours. Then he left again, and I followed."
  - "Phaedra. Love was the only monster I ever met, and it wore my own face."
- The recipes, at the shrine of the River of Wailing (III), the first chapter after Charon: "A potter's tablet, left at the shrine of Hermes. Clay and wine make a libation jar: break it, and the dead run to the sound. Oil and linen make a torch: the dead are blind to its light, and it shows you the way without a sound. Bronze and thread make a bell that rings when you are already gone. Pine resin and wax let the lyre sing once more. Bring what you find in the chests to a shrine, and make what you need there."
  Until you read it, the shrine says: You do not know how to make anything yet.
- Before the arena of Cerberus (X): "To whoever comes next. The hound is blind; he charges at your scent like a bull. Stand with stone behind you and step aside at the last moment. When he strikes the stone he staggers, and after three charges he lies down, panting. Only then will he listen: play your lyre to him, close. Three heads, three songs. — A keeper of the gate"

### Prologue (playable, chapter 0)

A morning in Thrace, in full daylight and colour — the only time the player sees the world lit.
1. Home: small chores with Eurydice (fetch water from the spring, tune the lyre and play for her, gather
   flowers). She can walk behind you here, and you may turn and look at her freely.
2. The meadow: she goes ahead while you finish a chore. A scream. You run. The snake. You arrive too late.
3. The grave, at dusk: you leave the flowers. "Everyone said the dead do not return."
4. The road to Taenarum at night, along the cliffs by the sea, to the mouth of the cave.
5. The first step: you slip, the lyre shatters, the strings scatter into the dark. Everything goes black.
   Chapter I begins.
The lines of the intro cutscene (section 8) appear during the prologue, at these moments.

#### Prologue texts

Objectives (interface text, not voiced):
- Find Eurydice.
- Fetch water from the well.
- Bring the water to Eurydice.
- Play the lyre for Eurydice.
- Gather flowers for her hair. Flowers: X/3
- Bring wine from the village.
- Run.
- Leave the flowers on her grave.
- Go to Taenarum.

Eurydice (voiced, soft, young woman):
- When you find her: There you are. The water jar is empty, and the spring will not come to us.
- When you bring the water: Cold as winter. Thank you, my love.
- Then: Now play for me. The new song, the one you keep hiding.
- After you play: Even the birds stopped to listen.
- Then: Will you find me some flowers for my hair? I will come with you.
- If you turn and look at her while she follows you: What? Is there something on my face?
- When you have three flowers: Asphodels? Those are flowers for the dead. I will wear them anyway.
- Then (she sends you away, and goes to the meadow): We have no wine for tonight's feast. Go up to the village and bring some. I will be in the meadow, gathering more flowers.
- In the meadow (a scream, far away, while you are in the village): Orpheus!

The old man of the village (voiced, old man), when you take the wine: For the singer! Play for us tonight, Orpheus.

The prologue map (first-person version, bigger): the village (houses, a square, the old man with the wine), the road
through the olive grove, the house (two rooms: hearth, loom, table, bed; a yard with a well, washing on a line, a pen with
goats, the garden), the meadow. At the grave, people of the village stand around it in black.

The intro lines (section 8) are shown in the middle of the screen: "A snake in the grass. A single bite." and
"Eurydice never woke again." when you reach her in the meadow; "Everyone said the dead do not return." and
"Orpheus did not listen." at the grave; "At Taenarum, the earth opens downward. He went down." at the mouth of
the cave; "On the first step he slipped. His lyre shattered on the rocks.", "Its strings scattered into the
dark.", "There is no light down here." and "Only what can be heard." on the first step.

In the pause menu during the prologue: Skip prologue

### Boss: Cerberus (chapter X)

An arena before the gate, with pillars and braziers (lit, so you can see him). Since 8/10 the fight works like
Tiny Tiger in Crash Bandicoot: Cerberus cannot see, but he smells you. He turns to you, growls and paws the
ground (the warning), then charges in a straight line to where you stood. Step aside: he slams into the stone
and staggers. After three charges he lies down, panting — the only moment he can be put to sleep: as in the myth, play the lyre to him from close (a wave with the lyre
in your hands, or the Melody). There is no food in the game (the user asked for a single way, the myth's). One head
sleeps; he rises angrier and faster. Three heads, three phases; a health bar at the top of the screen shows how
many heads are still awake. If you hide behind a pillar, he walks around it instead of charging. When all
three sleep, the gate opens.
Interface text: the health bar is titled "Cerberus"; when he lies down: The hound lies down, panting.

### Chases

- Chapter VII: Cerberus breaks his chain in the marsh and comes after you. Run across the causeways to a gate
  that closes behind you. (He waits for you again in chapter X.)
- Chapter IX: the Furies wake all at once. Run through the pit while Sisyphus' boulder thunders down behind you.

### Chests, map pieces, hiding places

- **Chests** (wooden chests, clay jars, sarcophagi): opening one creaks — a small sound that shades can hear.
  Inside: materials, pebbles, or the chapter's map piece. Libation jars are not
  found any more: you make them.
- **Map pieces**: one per chapter, not hard to find (in a side room or chest close to the main path).
  Without it the map shows only what you have seen; with it, the whole chapter.
- **Hiding places** (alcoves, open sarcophagi, reeds): inside you hold your breath for a few seconds and the
  shade passes by. Your heartbeat grows louder as it comes closer. Run out of breath, and you gasp.

### Crafting (at the offering table of a safe room)

| Item | Made from | Use |
|---|---|---|
| Libation jar | clay + wine | Thrown: a loud sound far from you (as now) |
|  |  | (The recipes are learned from the potter's tablet in chapter III.) |
| Pebbles | (found, no crafting) | Thrown: a small sound, to distract one shade |
| Torch | olive oil + linen | Lit: half a minute of light around you, without a sound (the dead are blind). Replaced the honey cake: no food in the game. |
| Bronze bell | bronze + thread | Placed: rings after a few seconds, far from where you are |
| Lyre resin | pine resin + wax | One more use of the Melody |

### Item and interface texts (first-person version)

Interface text, not voiced.
- Materials: Clay · Wine · Honey · Poppy seeds · Bronze · Thread · Pine resin · Beeswax
- Items: Libation jar · Pebbles · Torch · Bronze bell · Lyre resin
- Materials (8/10): Honey and Poppy seeds became Olive oil and Linen.
- Opening a chest: Inside: (list of what you found).
- The map piece: A map of this place, scratched on a shard.
- The shrine: title "Shrine of Hermes", line "Shades never cross this threshold.", buttons "Rest", "Craft", "Leave";
  after crafting: Made: (item).; after resting, the checkpoint message of section 8.
- Using lyre resin: The lyre can play once more.
- Hiding: You hold your breath. · When the breath runs out: You gasp for air!
- Prompts: Open · Shrine · Hide · Come out
- What each item does (shown in the Inventory and next to each recipe at the shrine):
  - Lyre: Hold it to play: the wave shows you the world. With three strings, it can play the Melody.
  - Libation jar: Thrown: it shatters with a loud sound, and the shades run to it.
  - Pebbles: Thrown: a small click, to lead one shade away.
  - Torch: Light it: it burns for half a minute and shows you the world around you, without a sound. The dead are blind to it.
  - Bronze bell: Thrown: it rings loudly a few seconds after it lands, far from you.
  - Lyre resin: One more use of the Melody.
  - Any material: A material. Bring it to a shrine of Hermes.
- The Inventory (like Minecraft): sections "Bag" and "In hand" (the bar of six at the bottom of the screen); the lyre
  is one of the things you can hold — put it in the bag to hold something else. Maps · Tablets.

### Texts of the set pieces (interface / narration, not voiced)

- Chase in the Styx (VII), when it starts: Chains snap somewhere in the marsh. Three voices howl.
- When you reach the river of fire: Behind you, the hound stops at the edge of the fire. He will wait for you at the gate.
- Chase in Tartarus (IX): The Furies wake. Above you, a great stone begins to roll.
- Cerberus (X), each head that falls asleep: One head sleeps. · The last one: The last head sighs and sleeps. The gate of Hades stands open.
- The throne room (XI): prompt "Play". The lines of the middle cutscene (section 8) appear one by one while you play;
  then Eurydice's shade appears and follows you.
- Endings: objectives "Go home." and (bad ending) "Play the lyre at her grave."; prompt "Turn around".
  The lines of the good / bad ending (section 8) appear during the walk, at the door, and at the grave.

The side mission "The guardian sleeps" (section 11) is no longer secret: Lull the hound of Hades to sleep.

### Lost souls with requests

Some lost souls ask for something (find an obol for one who cannot cross, carry words to someone in another
chapter). These become side missions.

### Endings (playable)

- **Good:** you come out into the light; it is the meadow of the prologue. You walk home with her behind you.
  At the door, for the first time: "Turn around". You turn, and you see her.
- **Bad:** you come out alone. The house is empty. You can walk to her grave and play the lyre. Nothing answers.


### Movement, the lyre, hiding (8/10)

- Walking is silent; **Shift = run** (loud steps, and it tires you: a stamina bar; when it runs out you gasp and
  can only walk until it recovers). No stamina loss in the chases and the prologue.
- The lyre cannot be spammed: after each wave it needs a moment (longer after a big one) — the strings are dim.
  Holding the button too long past the full charge cancels the wave (the strings fade out, no sound).
- Hiding: when a shade that heard you searches right outside your hiding place, you hold your breath with the
  heartbeat (like the hiding minigame in DOORS): hearts come from left and right; press their side (A / D, left /
  right click, or tap left / right) as they reach the circle. Every miss costs breath; out of breath, you gasp.
