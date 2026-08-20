// Build data/corpus/{orbs,stances,characters}.json.
// These are small, fixed rule sets (V2.3.4), written out explicitly and then
// cross-checked against:
//  - spire-archive data/sts1/{orbs,stances,characters}.json (values, decks, relics)
//  - references/wiki/Keywords.lua (orb passive/evoke values + stance rules text)
//  - sts_lightspeed CharacterClasses.h (class order/ids)
//  - data/corpus/cards.json (starter card ids must exist; basic-rarity counts)
// Any disagreement fails the build loudly rather than being silently resolved.

const ROOT = `${import.meta.dir}/../..`;
const spireOrbs: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/orbs.json`).json();
const spireStances: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/stances.json`).json();
const spireChars: any[] = await Bun.file(`${ROOT}/references/spire-archive/data/sts1/characters.json`).json();
const cards: any[] = await Bun.file(`${ROOT}/data/corpus/cards.json`).json();
const keywords = await Bun.file(`${ROOT}/references/wiki/Keywords.lua`).text();
const classesH = await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/CharacterClasses.h`).text();

const fail: string[] = [];
const check = (cond: boolean, msg: string) => {
  if (!cond) fail.push(msg);
};

// --- orbs -----------------------------------------------------------------------
// Base values from the game's orb classes; passive timing: Lightning/Frost/Dark
// trigger at end of the player's turn, Plasma at start of the player's turn.
// Focus: applies to Lightning/Frost passive+evoke and to Dark's per-turn growth
// (not its initial 6 stored damage); Plasma ignores Focus entirely.
const orbs = [
  {
    id: "LIGHTNING",
    name: "Lightning",
    passive: { base: 3, timing: "endOfTurn", text: "Deal 3 damage to a random enemy." },
    evoke: { base: 8, text: "Deal 8 damage to a random enemy." },
    focusApplies: { passive: true, evoke: true },
    notes: "With the Electro power, Lightning hits ALL enemies instead. Orb damage is not affected by Strength; Lock-On increases it by 50%.",
    sources: { spire: "LIGHTNING", wiki: "Keywords.lua:Lightning", lightspeed: "PlayerStatusEffects.h:Orb::LIGHTNING" },
  },
  {
    id: "FROST",
    name: "Frost",
    passive: { base: 2, timing: "endOfTurn", text: "Gain 2 Block." },
    evoke: { base: 5, text: "Gain 5 Block." },
    focusApplies: { passive: true, evoke: true },
    notes: null,
    sources: { spire: "FROST", wiki: "Keywords.lua:Frost", lightspeed: "PlayerStatusEffects.h:Orb::FROST" },
  },
  {
    id: "DARK",
    name: "Dark",
    passive: { base: 6, timing: "endOfTurn", text: "This orb's stored Evoke damage increases by 6." },
    evoke: { base: 6, text: "Deal stored damage (starts at 6) to the enemy with the lowest HP." },
    focusApplies: { passive: true, evoke: false },
    notes: "Accumulates: starts storing 6 Evoke damage when channeled; each end of turn it gains 6 (+Focus) more. Focus modifies the per-turn growth, not the initial 6.",
    sources: { spire: "DARK", wiki: "Keywords.lua:Dark", lightspeed: "PlayerStatusEffects.h:Orb::DARK" },
  },
  {
    id: "PLASMA",
    name: "Plasma",
    passive: { base: 1, timing: "startOfTurn", text: "Gain 1 Energy." },
    evoke: { base: 2, text: "Gain 2 Energy." },
    focusApplies: { passive: false, evoke: false },
    notes: "The only orb whose passive triggers at the start of the player's turn; Focus never applies.",
    sources: { spire: "PLASMA", wiki: "Keywords.lua:Plasma", lightspeed: "PlayerStatusEffects.h:Orb::FUSION" },
  },
];

// cross-check spire orb amounts
for (const o of orbs) {
  const sp = spireOrbs.find((x) => x.id === o.id);
  check(!!sp, `orb ${o.id} missing from spire orbs.json`);
  if (sp) {
    check(sp.passive_amount === o.passive.base, `orb ${o.id} passive ${o.passive.base} != spire ${sp.passive_amount}`);
    check(sp.evoke_amount === o.evoke.base, `orb ${o.id} evoke ${o.evoke.base} != spire ${sp.evoke_amount}`);
  }
}
// cross-check wiki keyword numbers
const kw = (name: string) => keywords.match(new RegExp(`\\["${name}"\\][\\s\\S]*?Text = "([^"]*)"`))?.[1] ?? "";
check(/Deal 3 .* 8 /.test(kw("Lightning").replace(/\(.*?\)|<br>|\$\w+|:/g, " ").replace(/\s+/g, " ")) || (kw("Lightning").includes("Deal 3") && kw("Lightning").includes("8")), `wiki Lightning text mismatch: ${kw("Lightning")}`);
check(kw("Frost").includes("Gains 2") && kw("Frost").includes("5"), `wiki Frost text mismatch`);
check(kw("Dark").includes("6") && kw("Dark").includes("least HP"), `wiki Dark text mismatch`);
check(kw("Plasma").includes("Gain 1") && kw("Plasma").includes("2"), `wiki Plasma text mismatch`);
// lightspeed names the Plasma orb FUSION
check(/FUSION/.test(await Bun.file(`${ROOT}/references/sts_lightspeed/include/constants/PlayerStatusEffects.h`).text()), "lightspeed Orb::FUSION missing");

// --- stances --------------------------------------------------------------------
const stances = {
  mantraThreshold: 10, // on reaching 10 Mantra, enter Divinity; excess Mantra carries over
  stances: [
    {
      id: "NEUTRAL",
      name: "Neutral",
      attackDamageDealtMultiplier: 1,
      attackDamageReceivedMultiplier: 1,
      onEnter: null,
      onExit: null,
      autoExit: null,
      sources: { spire: "NEUTRAL", lightspeed: "PlayerStatusEffects.h:Stance::NEUTRAL" },
    },
    {
      id: "CALM",
      name: "Calm",
      attackDamageDealtMultiplier: 1,
      attackDamageReceivedMultiplier: 1,
      onEnter: null,
      onExit: "Gain 2 Energy (3 with the Violet Lotus relic).",
      autoExit: null,
      sources: { spire: "CALM", wiki: "Keywords.lua:Calm", lightspeed: "PlayerStatusEffects.h:Stance::CALM" },
    },
    {
      id: "WRATH",
      name: "Wrath",
      attackDamageDealtMultiplier: 2,
      attackDamageReceivedMultiplier: 2,
      onEnter: null,
      onExit: null,
      autoExit: null,
      notes: "Multipliers apply to attack damage only (dealt by your attack cards, and received from enemy attacks).",
      sources: { spire: "WRATH", wiki: "Keywords.lua:Wrath", lightspeed: "PlayerStatusEffects.h:Stance::WRATH" },
    },
    {
      id: "DIVINITY",
      name: "Divinity",
      attackDamageDealtMultiplier: 3,
      attackDamageReceivedMultiplier: 1,
      onEnter: "Gain 3 Energy.",
      onExit: null,
      autoExit: "Exit this stance (to Neutral) at the start of your next turn.",
      notes: "Entered by reaching 10 Mantra (excess Mantra carries over) or directly via effects that say Enter Divinity (Blasphemy, Ambrosia).",
      sources: { spire: "DIVINITY", wiki: "Keywords.lua:Divinity", lightspeed: "PlayerStatusEffects.h:Stance::DIVINITY" },
    },
  ],
};

// cross-check: spire lists the same 4 stance ids; wiki text agrees on the numbers
check(
  JSON.stringify(spireStances.map((s) => s.id).sort()) === JSON.stringify(["CALM", "DIVINITY", "NEUTRAL", "WRATH"]),
  `spire stances ids unexpected: ${spireStances.map((s) => s.id)}`,
);
check(kw("Calm").includes("gain 2") && kw("Calm").includes("Energy"), "wiki Calm text mismatch");
check(kw("Wrath").includes("deal and receive double attack damage"), "wiki Wrath text mismatch");
check(kw("Divinity").includes("gain 3") && kw("Divinity").includes("triple damage") && kw("Divinity").includes("start of your next turn"), "wiki Divinity text mismatch");
check(kw("Mantra").includes("10"), "wiki Mantra threshold mismatch");

// --- characters -----------------------------------------------------------------
// spire starter-deck ids -> corpus card ids (lightspeed enum names)
const CARD_MAP: Record<string, string> = {
  STRIKE_R: "STRIKE_RED", DEFEND_R: "DEFEND_RED", BASH: "BASH",
  STRIKE_G: "STRIKE_GREEN", DEFEND_G: "DEFEND_GREEN", SURVIVOR: "SURVIVOR", NEUTRALIZE: "NEUTRALIZE",
  STRIKE_B: "STRIKE_BLUE", DEFEND_B: "DEFEND_BLUE", ZAP: "ZAP", DUALCAST: "DUALCAST",
  STRIKE_P: "STRIKE_PURPLE", DEFEND_P: "DEFEND_PURPLE", ERUPTION: "ERUPTION", VIGILANCE: "VIGILANCE",
};

const characters = [
  {
    id: "IRONCLAD",
    name: "Ironclad",
    color: "red",
    maxHp: 80,
    startingEnergy: 3,
    startingHandSize: 5,
    startingDeck: [
      { card: "STRIKE_RED", count: 5 },
      { card: "DEFEND_RED", count: 4 },
      { card: "BASH", count: 1 },
    ],
    masterDeckSize: 10,
    startingRelic: { id: "BURNING_BLOOD", name: "Burning Blood" },
    startingGold: 99,
    startingPotionSlots: 3,
    orbSlots: 0,
    ascension14MaxHpLoss: 5,
    spireId: "IRONCLAD",
  },
  {
    id: "SILENT",
    name: "Silent",
    color: "green",
    maxHp: 70,
    startingEnergy: 3,
    startingHandSize: 5,
    startingDeck: [
      { card: "STRIKE_GREEN", count: 5 },
      { card: "DEFEND_GREEN", count: 5 },
      { card: "SURVIVOR", count: 1 },
      { card: "NEUTRALIZE", count: 1 },
    ],
    masterDeckSize: 12,
    startingRelic: { id: "RING_OF_THE_SNAKE", name: "Ring of the Snake" },
    startingGold: 99,
    startingPotionSlots: 3,
    orbSlots: 0,
    ascension14MaxHpLoss: 4,
    spireId: "THE_SILENT",
    notes: "All characters draw 5 cards per turn; the Silent's extra 2 cards on turn 1 come from Ring of the Snake, not the character.",
  },
  {
    id: "DEFECT",
    name: "Defect",
    color: "blue",
    maxHp: 75,
    startingEnergy: 3,
    startingHandSize: 5,
    startingDeck: [
      { card: "STRIKE_BLUE", count: 4 },
      { card: "DEFEND_BLUE", count: 4 },
      { card: "ZAP", count: 1 },
      { card: "DUALCAST", count: 1 },
    ],
    masterDeckSize: 10,
    startingRelic: { id: "CRACKED_CORE", name: "Cracked Core" },
    startingGold: 99,
    startingPotionSlots: 3,
    orbSlots: 3,
    ascension14MaxHpLoss: 4,
    spireId: "DEFECT",
  },
  {
    id: "WATCHER",
    name: "Watcher",
    color: "purple",
    maxHp: 72,
    startingEnergy: 3,
    startingHandSize: 5,
    startingDeck: [
      { card: "STRIKE_PURPLE", count: 4 },
      { card: "DEFEND_PURPLE", count: 4 },
      { card: "ERUPTION", count: 1 },
      { card: "VIGILANCE", count: 1 },
    ],
    masterDeckSize: 10,
    startingRelic: { id: "PURE_WATER", name: "Pure Water" },
    startingGold: 99,
    startingPotionSlots: 3,
    orbSlots: 0,
    ascension14MaxHpLoss: 4,
    spireId: "WATCHER",
  },
].map((c) => ({
  ...c,
  sources: {
    lightspeed: `CharacterClasses.h:${c.id}`,
    spire: c.spireId,
    constants: "V2.3.4 CharSelectInfo",
  },
}));

// cross-check lightspeed class order/names
const clsOrder = [...classesH.matchAll(/"(IRONCLAD|SILENT|DEFECT|WATCHER)"/g)].map((m) => m[1]);
check(JSON.stringify(clsOrder) === JSON.stringify(["IRONCLAD", "SILENT", "DEFECT", "WATCHER"]), `CharacterClasses.h order unexpected: ${clsOrder}`);

// cross-check spire characters
const cardIds = new Map(cards.map((c) => [c.id, c]));
for (const ch of characters) {
  const sp = spireChars.find((x) => x.id === (ch as any).spireId);
  check(!!sp, `character ${ch.id}: spire record ${(ch as any).spireId} missing`);
  if (sp) {
    check(sp.hp === ch.maxHp, `character ${ch.id}: maxHp ${ch.maxHp} != spire ${sp.hp}`);
    check(sp.energy_per_turn === ch.startingEnergy, `character ${ch.id}: energy ${ch.startingEnergy} != spire ${sp.energy_per_turn}`);
    check(sp.starting_relic === ch.startingRelic.name, `character ${ch.id}: relic ${ch.startingRelic.name} != spire ${sp.starting_relic}`);
    // starter deck multiset must match spire's exactly (after id mapping)
    const spireDeck = (sp.starting_deck as string[]).map((c) => CARD_MAP[c] ?? `?${c}`).sort();
    const ourDeck = ch.startingDeck.flatMap((d) => Array(d.count).fill(d.card)).sort();
    check(JSON.stringify(spireDeck) === JSON.stringify(ourDeck), `character ${ch.id}: deck mismatch ours=${ourDeck} spire=${spireDeck}`);
  }
  // deck size + card corpus validity
  const size = ch.startingDeck.reduce((n, d) => n + d.count, 0);
  check(size === ch.masterDeckSize, `character ${ch.id}: deck size ${size} != masterDeckSize ${ch.masterDeckSize}`);
  for (const d of ch.startingDeck) {
    const card = cardIds.get(d.card);
    check(!!card, `character ${ch.id}: starter card ${d.card} not in data/corpus/cards.json`);
    if (card) {
      check(card.rarity === "basic", `character ${ch.id}: starter ${d.card} rarity ${card.rarity} != basic`);
      check(card.color === (ch as any).color, `character ${ch.id}: starter ${d.card} color ${card.color} != ${(ch as any).color}`);
    }
  }
  // basic-rarity pool per class: Ironclad 3 distinct basics, others 4
  const basics = cards.filter((c) => c.rarity === "basic" && c.color === (ch as any).color);
  const wantBasics = ch.id === "IRONCLAD" ? 3 : 4;
  check(basics.length === wantBasics, `character ${ch.id}: ${basics.length} basic cards in corpus != ${wantBasics}`);
  const starterSet = new Set(ch.startingDeck.map((d) => d.card));
  check(basics.every((b) => starterSet.has(b.id)), `character ${ch.id}: basics ${basics.map((b) => b.id)} not all in starter deck`);
}
check(characters.length === 4, `characters ${characters.length} != 4`);

// strip the helper field before writing
const charactersOut = characters.map(({ spireId, ...rest }: any) => rest);

// --- report / write ---------------------------------------------------------------
console.log(`orbs: ${orbs.length} (expect 4), stances: ${stances.stances.length} (expect 4), characters: ${charactersOut.length} (expect 4)`);
if (fail.length) {
  console.error("CROSS-CHECKS FAILED:\n - " + fail.join("\n - "));
  process.exit(1);
}
await Bun.write(`${ROOT}/data/corpus/orbs.json`, JSON.stringify(orbs, null, 1));
await Bun.write(`${ROOT}/data/corpus/stances.json`, JSON.stringify(stances, null, 1));
await Bun.write(`${ROOT}/data/corpus/characters.json`, JSON.stringify(charactersOut, null, 1));
console.log("all cross-checks passed; wrote data/corpus/{orbs,stances,characters}.json");
