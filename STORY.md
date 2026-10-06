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
| Narrator | warm, calm (male) | In the game: "The footsteps behind you stop.", the libation jar message and "Your lyre is whole again..." |
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

Not voiced (they are interface text, not something a character says): the cutscenes, the chapter title and line at the start of each chapter, the checkpoint message, the objectives, "You found a string (X/3).", and the control hints.

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
- Libations: Find every libation jar.
- Rekindle the flames: Light every altar.
- The guardian sleeps (secret): Wake the hound of Hades.
- Three thousand years (secret): Find the shade that walks into the wall.

A secret mission shows as "???" until it is completed. When a side mission is completed: Mission complete: (title)
