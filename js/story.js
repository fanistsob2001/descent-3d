'use strict';

// Όλα τα κείμενα της ιστορίας, ΑΚΡΙΒΩΣ όπως στο STORY.md (ενότητες 8, 9 και 10).
// Βγήκαν αυτόματα από το STORY.md· αν αλλάξει εκεί, άλλαξέ τα κι εδώ ίδια.
// (Οι τίτλοι, οι φράσεις και οι στόχοι των κεφαλαίων είναι στο js/levels.js.)
// Τα *Who δίνουν ποιος μιλάει σε κάθε γραμμή: 'narrator' | 'hades' | 'eurydice'.
const STORY = {
  intro: [
    "A snake in the grass. A single bite.",
    "Eurydice never woke again.",
    "Everyone said the dead do not return.",
    "Orpheus did not listen.",
    "At Taenarum, the earth opens downward. He went down.",
    "On the first step he slipped. His lyre shattered on the rocks.",
    "Its strings scattered into the dark.",
    "There is no light down here.",
    "Only what can be heard.",
  ],
  introWho: ["narrator", "narrator", "narrator", "narrator", "narrator", "narrator", "narrator", "narrator", "narrator"],

  middle: [
    "Orpheus played.",
    "For the first time, something wept in the Underworld.",
    "Persephone leaned toward Hades. He was silent for a long time.",
    "\"Take her,\" he said. \"She will follow you to the light.",
    "But if you turn to look at her before you leave,",
    "she stays here. Forever.\"",
  ],
  middleWho: ["narrator", "narrator", "narrator", "hades", "hades", "hades"],

  good: [
    "Light.",
    "Orpheus stepped into the open air and did not turn. He waited.",
    "A hand touched his shoulder.",
    "You didn't look...",
    "In the myth, he looked.",
    "You didn't.",
  ],
  goodWho: ["narrator", "narrator", "narrator", "eurydice", "narrator", "narrator"],

  bad: [
    "Orpheus turned.",
    "For a moment he saw her, just as he remembered.",
    "Then the dark took her back, without a sound.",
    "He stepped into the light alone.",
    "Just like in the myth.",
  ],
  badWho: ["narrator", "narrator", "narrator", "narrator", "narrator"],

  // Μηνύματα χαμένων ψυχών: souls[0] είναι το 1 κ.λπ.
  souls: [
    "I thought I would find my way back, too.",
    "I had no obol. I have waited on this shore for a hundred years.",
    "I drank from the river. I don't remember my name. Only that someone was waiting for me.",
    "The shades cannot see. They listen. Walk as if you do not exist.",
    "The queen ate six pomegranate seeds. That is why she can never leave.",
    "Everyone looks back at the end. Everyone.",
    "I was not good enough for Elysium, nor wicked enough for Tartarus. So I wait here, and nothing ever happens.",
    "I swore I would wait for him. The river remembers every oath.",
    "The Furies have never wept. They say only a song could make them.",
  ],

  checkpoint: "The flame is lit. Your progress is saved.",
  charonEmpty: "The ferryman takes no one for free. Show me the coin, living one.",
  charonPaid: "The river claims your coin. Step aboard...",
  jar: "A libation jar. The dead hunger for offerings. Throw it, and they will come.",
  string: (x) => "You found a string " + `(${x}/3)` + ".",
  lyreWhole: "Your lyre is whole again. When you play, the shades remember they were once alive.",
  whisper: "Orpheus...",
  footstepsStop: "The footsteps behind you stop.",
  eurydiceFollow: "Orpheus... I am right behind you.",
  shadeLines: [
    "Who is there?",
    "I hear life...",
  ],
  erinysLines: [
    "Who dares to sing here?",
    "We hear you, living one.",
  ],

  // Ο πρόλογος (STORY.md, ενότητα 12, "Prologue texts").
  prologueObj: {
    find: "Find Eurydice.",
    water: "Fetch water from the spring.",
    bring: "Bring the water to Eurydice.",
    play: "Play the lyre for Eurydice.",
    flowers: (n) => "Gather flowers for her hair. Flowers: " + n + "/3",
    follow: "Follow Eurydice to the meadow.",
    run: "Run.",
    grave: "Leave the flowers on her grave.",
    road: "Go to Taenarum.",
  },
  prologueEury: {
    greet: "There you are. The water jar is empty, and the spring will not come to us.",
    water: "Cold as winter. Thank you, my love.",
    askPlay: "Now play for me. The new song, the one you keep hiding.",
    played: "Even the birds stopped to listen.",
    askFlowers: "Will you find me some flowers for my hair? I will come with you.",
    lookAt: "What? Is there something on my face?",
    flowers: "Asphodels? Those are flowers for the dead. I will wear them anyway.",
    goMeadow: "I am going down to the meadow before the sun sets. Don't be long.",
    scream: "Orpheus!",
  },
  skipPrologue: "Skip prologue",

  // Πρώτο πρόσωπο: ο Άδης και η Περσεφόνη στους θρόνους τους (STORY.md, ενότητα 8).
  hadesHall: "Another living soul in my halls. Come closer, singer.",
  persephoneHall: "I can hear the world above in your footsteps.",

  // Αποστολές (STORY.md, ενότητα 11).
  goal: "Bring Eurydice back to the world of the living.",
  missionMain: [
    "Find the way down",
    "Cross the Acheron",
    "Cross the waters of Lethe",
    "Cross the Asphodel Meadows",
    "Cross the marshes of Styx",
    "Pass through Tartarus",
    "Reach the throne of Hades",
    "Lead Eurydice to the light. Do not look back.",
  ],
  sideMissions: [
    { id: 'strings', title: "Mend the lyre", text: "Find the three strings of your lyre." },
    { id: 'obol', title: "The ferryman's toll", text: "Find an obol and pay Charon." },
    { id: 'souls', title: "Voices of the lost", text: "Hear all nine lost souls." },
    { id: 'jars', title: "Libations", text: "Find every libation jar." },
    { id: 'altars', title: "Rekindle the flames", text: "Light every altar." },
    { id: 'cerberus', title: "The guardian sleeps", text: "Wake the hound of Hades.", secret: true },
    { id: 'stuck', title: "Three thousand years", text: "Find the shade that walks into the wall.", secret: true },
  ],
  missionComplete: (t) => "Mission complete: " + t,

  // Easter eggs (STORY.md, ενότητα 9).
  stuckShade: "I have been walking into this wall for three thousand years.",
  cerberus: "Good boy. Good boy. Good boy.",

  // Επιλογές μετά το κακό τέλος (STORY.md, ενότητα 5).
  tryAgain: 'Try again from the last checkpoint',
  mainMenu: 'Main menu',
};
