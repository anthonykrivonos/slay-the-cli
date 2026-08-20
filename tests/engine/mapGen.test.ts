import { test, expect, describe } from "bun:test";
import { generateMap, act4Map, type Room } from "../../src/engine/run/mapGen";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Golden comparison against the reference C++ (tools/gen-map-vectors.cpp).

const SYM: Record<Room, string> = {
  shop: "$",
  rest: "R",
  event: "?",
  elite: "E",
  monster: "M",
  treasure: "T",
  boss: "B",
  none: "N",
};

interface Block {
  seed: bigint;
  act: number;
  asc: number;
  burning: [number, number, number];
  lines: string[];
}

function parseFixture(): Block[] {
  const text = readFileSync(join(import.meta.dir, "fixtures/map-vectors.txt"), "utf8");
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("#")) {
      const [seed, act, asc, bx, by, buff] = line.slice(2).split(" ");
      cur = {
        seed: BigInt(seed!),
        act: Number(act),
        asc: Number(asc),
        burning: [Number(bx), Number(by), Number(buff)],
        lines: [],
      };
      blocks.push(cur);
    } else if (line.trim() && cur) {
      cur.lines.push(line.trim());
    }
  }
  return blocks;
}

function dump(seed: bigint, asc: number, act: number): { lines: string[]; burning: [number, number, number] } {
  const map = generateMap(seed, asc, act, true);
  const lines: string[] = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 7; x++) {
      const n = map.nodes[y]![x]!;
      if (n.edges.length > 0) {
        lines.push(`${y},${x},${SYM[n.room]},${n.edges.join("")}`);
      }
    }
  }
  return { lines, burning: [map.burningEliteX, map.burningEliteY, map.burningEliteBuff] };
}

describe("map generation matches reference", () => {
  const blocks = parseFixture();
  test("fixture parsed", () => {
    expect(blocks.length).toBe(36);
  });

  for (const b of blocks) {
    test(`seed ${b.seed} act ${b.act} asc ${b.asc}`, () => {
      const got = dump(b.seed, b.asc, b.act);
      expect(got.lines).toEqual(b.lines);
      expect(got.burning).toEqual(b.burning);
    });
  }
});

describe("act 4 map", () => {
  test("fixed rest -> shop -> elite -> boss column", () => {
    const m = act4Map();
    expect(m.nodes[0]![3]!.room).toBe("rest");
    expect(m.nodes[1]![3]!.room).toBe("shop");
    expect(m.nodes[2]![3]!.room).toBe("elite");
    expect(m.nodes[3]![3]!.room).toBe("boss");
  });
});
