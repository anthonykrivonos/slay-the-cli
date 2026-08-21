// Extract per-card data and pool structures from sts_lightspeed's constants headers
// into references/extracted/lightspeed-cards.json for corpus building/auditing.

const LS = `${import.meta.dir}/../../references/sts_lightspeed/include/constants`;
const OUT = `${import.meta.dir}/../../references/extracted`;

const cardsH = await Bun.file(`${LS}/Cards.h`).text();
const poolsH = await Bun.file(`${LS}/CardPools.h`).text();

/** Capture the balanced-brace initializer following a declaration pattern. */
function initializer(src: string, decl: RegExp): string {
  const m = decl.exec(src);
  if (!m || m.index === undefined) throw new Error(`decl not found: ${decl}`);
  const start = src.indexOf("{", m.index + m[0].length - 1);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces for ${decl}`);
}

/** Parse a brace tree; leaves matched by `leaf` regex (first capture group). */
function braceTree(text: string, leaf: RegExp): any {
  let i = 0;
  function parse(): any[] {
    if (text[i] !== "{") throw new Error(`expected { at ${i}`);
    i++;
    const out: any[] = [];
    while (i < text.length) {
      if (text[i] === "{") out.push(parse());
      else if (text[i] === "}") {
        i++;
        return out;
      } else {
        const rest = text.slice(i);
        const stop = Math.min(...["{", "}"].map((c) => (rest.indexOf(c) + 1 || Infinity) - 1));
        const chunk = rest.slice(0, stop);
        for (const m of chunk.matchAll(new RegExp(leaf, "g"))) out.push(m[1]);
        i += stop;
      }
    }
    throw new Error("unbalanced");
  }
  return parse();
}

const strings = (decl: RegExp) => braceTree(initializer(cardsH, decl), /"([^"]*)"/) as string[];
const enums = (src: string, decl: RegExp, kind: string) =>
  braceTree(initializer(src, decl), new RegExp(`${kind}::(\\w+)`));
const ints = (src: string, decl: RegExp) => braceTree(initializer(src, decl), /(-?\d+)/).flat === undefined
  ? braceTree(initializer(src, decl), /(-?\d+)/)
  : braceTree(initializer(src, decl), /(-?\d+)/);

/** Parse a constexpr switch(id) keyword function into { CARD_ID: returnExpr }. */
function switchFn(src: string, fnName: string): Record<string, string> {
  const m = new RegExp(`bool ${fnName}\\([^)]*\\)\\s*\\{`).exec(src);
  if (!m || m.index === undefined) throw new Error(`fn not found: ${fnName}`);
  const body = initializer(src, new RegExp(`bool ${fnName}\\([^)]*\\)\\s*`));
  const out: Record<string, string> = {};
  let pending: string[] = [];
  for (const line of body.split("\n")) {
    const c = line.match(/case CardId::(\w+):/);
    if (c) pending.push(c[1]!);
    const r = line.match(/return ([^;]+);/);
    if (r && pending.length) {
      for (const id of pending) out[id] = r[1]!.trim();
      pending = [];
    }
  }
  return out;
}

const deepInts = (x: any): any => (Array.isArray(x) ? x.map(deepInts) : parseInt(x, 10));

const data = {
  enumStrings: strings(/cardEnumStrings\[\]\s*=\s*/),
  names: strings(/cardNames\[\]\s*=\s*/),
  stringIds: strings(/cardStringIds\[\]\s*=\s*/),
  colors: enums(cardsH, /cardColors\[\]\s*=\s*/, "CardColor"),
  rarities: enums(cardsH, /cardRarities\[\]\s*=\s*/, "CardRarity"),
  types: enums(cardsH, /cardTypes\[\]\s*=\s*/, "CardType"),
  targets: braceTree(initializer(cardsH, /cardTargets\[\]\s*=\s*/), /(true|false)/).map((s: string) => s === "true"),
  baseDamage: deepInts(braceTree(initializer(cardsH, /cardBaseDamage\[2\]\[371\]\s*/), /(-?\d+)/)),
  keywords: {
    ethereal: switchFn(cardsH, "isCardEthereal"),
    innate: switchFn(cardsH, "isCardInnate"),
    exhaust: switchFn(cardsH, "doesCardExhaust"),
    selfRetain: switchFn(cardsH, "doesCardSelfRetain"),
    strikeCard: switchFn(cardsH, "isCardStrikeCard"),
    targetsEnemy: switchFn(cardsH, "cardTargetsEnemy"),
    xCost: switchFn(cardsH, "isXCost"),
  },
  pools: {
    rarity: {
      blob: enums(poolsH, /RarityCardPool \{[\s\S]*?cardBlob\[\]\s*/, "CardId"),
      groupOffset: deepInts(braceTree(initializer(poolsH, /RarityCardPool[\s\S]*?groupOffset\[4\]\[3\]\s*/), /(-?\d+)/)),
      groupSize: deepInts(braceTree(initializer(poolsH, /RarityCardPool[\s\S]*?groupSize\[4\]\[3\]\s*/), /(-?\d+)/)),
    },
    typeRarity: {
      blob: enums(poolsH, /TypeRarityCardPool \{[\s\S]*?cardBlob\[\]\s*=\s*/, "CardId"),
      groupOffset: deepInts(
        braceTree(initializer(poolsH, /TypeRarityCardPool[\s\S]*?groupOffset\[4\]\[3\]\[3\]\s*/), /(-?\d+)/),
      ),
      groupSize: deepInts(
        braceTree(initializer(poolsH, /TypeRarityCardPool[\s\S]*?groupSize\[4\]\[3\]\[3\]\s*/), /(-?\d+)/),
      ),
    },
    colorless: {
      blob: enums(poolsH, /colorlessCardBlob\[\]\s*/, "CardId"),
      groupSize: deepInts(braceTree(initializer(poolsH, /colorlessGroupSize\[3\]\s*=\s*/), /(-?\d+)/)),
      groupOffset: deepInts(braceTree(initializer(poolsH, /colorlessGroupOffset\[3\]\s*=\s*/), /(-?\d+)/)),
    },
    curse: enums(poolsH, /curseCardPool\[\]\s*=\s*/, "CardId"),
    srcColorless: enums(poolsH, /srcColorlessCardPool\[\]\s*=\s*/, "CardId"),
    baseColorless: enums(poolsH, /baseColorlessPool\s*=\s*/, "CardId"),
    transform: enums(poolsH, /colorCardPool\[4\]\[72\]\s*/, "CardId"),
    trulyRandom: enums(poolsH, /TrulyRandomCardPool \{[\s\S]*?pool\[4\]\[72\]\s*=\s*/, "CardId"),
    anyColorCommon: enums(poolsH, /commonCards\[\]\s*=\s*/, "CardId"),
    anyColorUncommon: enums(poolsH, /uncommonCards\[\]\s*=\s*/, "CardId"),
    anyColorRare: enums(poolsH, /rareCards\[\]\s*=\s*/, "CardId"),
  },
};

// sanity
const n = data.enumStrings.length;
console.log(`enum entries: ${n} (expect 371 incl INVALID)`);
for (const [k, v] of Object.entries({
  names: data.names,
  stringIds: data.stringIds,
  colors: data.colors,
  rarities: data.rarities,
  types: data.types,
  targets: data.targets,
})) {
  if ((v as any[]).length !== n) console.error(`LENGTH MISMATCH ${k}: ${(v as any[]).length}`);
}
console.log(`baseDamage rows: ${data.baseDamage.length} x ${data.baseDamage[0].length}`);
console.log(
  `pools: rarityBlob=${data.pools.rarity.blob.length} typeRarityBlob=${data.pools.typeRarity.blob.length} colorless=${data.pools.colorless.blob.length} curse=${data.pools.curse.length} anyColor=${data.pools.anyColorCommon.length}/${data.pools.anyColorUncommon.length}/${data.pools.anyColorRare.length}`,
);

await Bun.write(`${OUT}/lightspeed-cards.json`, JSON.stringify(data, null, 1));
console.log(`wrote ${OUT}/lightspeed-cards.json`);
