// Exact port of the game's map generation (via sts_lightspeed's Map.cpp, which
// matches sts_map_oracle constant-for-constant). Two known oddities are ported
// verbatim because they ARE the game's behavior:
//   - the row-13 "rest row bug": row 13 counts as unassigned but not toward the
//     room-budget total (so no Rest Site proportion comes from it),
//   - getCommonAncestor's `x1 < y` comparison (a decompile-faithful quirk).
// Golden-tested against fixtures generated from the reference C++.

import { Rng } from "../core/rng";

export const MAP_HEIGHT = 15;
export const MAP_WIDTH = 7;
const PATH_DENSITY = 6;
const ROW_END_NODE = MAP_WIDTH - 1;

const SHOP_ROOM_CHANCE = 0.05;
const REST_ROOM_CHANCE = 0.12;
const TREASURE_ROOM_CHANCE = 0.0;
const EVENT_ROOM_CHANCE = 0.22;
const ELITE_ROOM_CHANCE_A0 = 0.08;
const ELITE_ROOM_CHANCE_A1 = ELITE_ROOM_CHANCE_A0 * 1.6;

export type Room = "shop" | "rest" | "treasure" | "elite" | "event" | "monster" | "boss" | "none";

export interface GenMapNode {
  x: number;
  y: number;
  room: Room;
  edges: number[]; // sorted, unique, target columns in row y+1 (row 14 edges -> boss col 3)
  parents: number[]; // source columns in row y-1 (duplicates possible pre-normalize)
}

export interface GeneratedMap {
  nodes: GenMapNode[][]; // [y][x]
  burningEliteX: number;
  burningEliteY: number;
  burningEliteBuff: number; // 0..3
}

const randRange = (rng: Rng, min: number, max: number): number => rng.random(max - min) + min;

function makeNodes(): GenMapNode[][] {
  return Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => ({ x, y, room: "none" as Room, edges: [], parents: [] })),
  );
}

function addEdge(node: GenMapNode, edge: number): void {
  // sorted unique insertion
  let cur = 0;
  while (cur < node.edges.length) {
    if (edge === node.edges[cur]) return;
    if (edge < node.edges[cur]!) break;
    cur++;
  }
  node.edges.splice(cur, 0, edge);
}

const maxEdge = (n: GenMapNode) => n.edges[n.edges.length - 1]!;
const minEdge = (n: GenMapNode) => n.edges[0]!;
const maxXParent = (n: GenMapNode) => Math.max(...n.parents);
const minXParent = (n: GenMapNode) => Math.min(...n.parents);

function getCommonAncestor(nodes: GenMapNode[][], x1: number, x2: number, y: number): number {
  if (y < 0) return -1;
  // `x1 < y` is the reference's exact comparison (not x1 < x2) - kept verbatim
  let lNode: number;
  let rNode: number;
  if (x1 < y) {
    lNode = x1;
    rNode = x2;
  } else {
    lNode = x2;
    rNode = x1;
  }
  if (nodes[y]![lNode]!.parents.length === 0 || nodes[y]![rNode]!.parents.length === 0) return -1;
  const leftX = maxXParent(nodes[y]![lNode]!);
  if (leftX === minXParent(nodes[y]![rNode]!)) return leftX;
  return -1;
}

function choosePathParentLoopRandomizer(
  nodes: GenMapNode[][],
  rng: Rng,
  curX: number,
  curY: number,
  newX: number,
): number {
  const newEdgeDest = nodes[curY + 1]![newX]!;
  for (let i = 0; i < newEdgeDest.parents.length; i++) {
    const parentX = newEdgeDest.parents[i]!;
    if (curX === parentX) continue;
    if (getCommonAncestor(nodes, parentX, curX, curY) === -1) continue;

    if (newX > curX) {
      newX = curX + randRange(rng, -1, 0);
      if (newX < 0) newX = curX;
    } else if (newX === curX) {
      newX = curX + randRange(rng, -1, 1);
      if (newX > ROW_END_NODE) newX = curX - 1;
      else if (newX < 0) newX = curX + 1;
    } else {
      newX = curX + randRange(rng, 0, 1);
      if (newX > ROW_END_NODE) newX = curX;
    }
  }
  return newX;
}

function choosePathAdjustNewX(nodes: GenMapNode[][], curX: number, curY: number, newEdgeX: number): number {
  if (curX !== 0) {
    const leftNeighbor = nodes[curY]![curX - 1]!;
    if (leftNeighbor.edges.length > 0) {
      const e = maxEdge(leftNeighbor);
      if (e > newEdgeX) newEdgeX = e;
    }
  }
  if (curX < ROW_END_NODE) {
    const rightNeighbor = nodes[curY]![curX + 1]!;
    if (rightNeighbor.edges.length > 0) {
      const e = minEdge(rightNeighbor);
      if (e < newEdgeX) newEdgeX = e;
    }
  }
  return newEdgeX;
}

function chooseNewPath(nodes: GenMapNode[][], rng: Rng, curX: number, curY: number): number {
  let min: number;
  let max: number;
  if (curX === 0) {
    min = 0;
    max = 1;
  } else if (curX === ROW_END_NODE) {
    min = -1;
    max = 0;
  } else {
    min = -1;
    max = 1;
  }
  let newEdgeX = curX + randRange(rng, min, max);
  newEdgeX = choosePathParentLoopRandomizer(nodes, rng, curX, curY, newEdgeX);
  newEdgeX = choosePathAdjustNewX(nodes, curX, curY, newEdgeX);
  return newEdgeX;
}

function createPathsIteration(nodes: GenMapNode[][], rng: Rng, startX: number): void {
  let curX = startX;
  for (let curY = 0; curY < MAP_HEIGHT - 1; curY++) {
    const newX = chooseNewPath(nodes, rng, curX, curY);
    addEdge(nodes[curY]![curX]!, newX);
    nodes[curY + 1]![newX]!.parents.push(curX);
    curX = newX;
  }
  addEdge(nodes[14]![curX]!, 3);
}

function createPaths(nodes: GenMapNode[][], mapRng: Rng): void {
  const firstStartX = randRange(mapRng, 0, MAP_WIDTH - 1);
  createPathsIteration(nodes, mapRng, firstStartX);
  for (let i = 1; i < PATH_DENSITY; i++) {
    let startX = randRange(mapRng, 0, MAP_WIDTH - 1);
    while (startX === firstStartX && i === 1) {
      startX = randRange(mapRng, 0, MAP_WIDTH - 1);
    }
    createPathsIteration(nodes, mapRng, startX);
  }
}

function filterRedundantEdgesFromFirstRow(nodes: GenMapNode[][]): void {
  const visited = new Array<boolean>(MAP_WIDTH).fill(false);
  for (let srcX = 0; srcX < MAP_WIDTH; srcX++) {
    const node = nodes[0]![srcX]!;
    for (let i = node.edges.length - 1; i >= 0; i--) {
      const destX = node.edges[i]!;
      if (visited[destX]) {
        // remove ALL parent entries equal to srcX on the destination
        const dest = nodes[1]![destX]!;
        for (let p = dest.parents.length - 1; p >= 0; p--) {
          if (dest.parents[p] === srcX) dest.parents.splice(p, 1);
        }
        node.edges.splice(i, 1);
      } else {
        visited[destX] = true;
      }
    }
  }
}

// --- room assignment -----------------------------------------------------------

interface RoomCounts {
  total: number;
  unassigned: number;
}

function getRoomCountsAndAssignFixed(nodes: GenMapNode[][]): RoomCounts {
  const counts: RoomCounts = { total: 0, unassigned: 0 };
  for (let row = 0; row < MAP_HEIGHT; row++) {
    for (const node of nodes[row]!) {
      if (node.edges.length <= 0) continue;
      if (row === 0) {
        node.room = "monster";
        counts.total++;
      } else if (row === 8) {
        node.room = "treasure";
        counts.total++;
      } else if (row === MAP_HEIGHT - 1) {
        node.room = "rest";
        counts.total++;
      } else if (row === MAP_HEIGHT - 2) {
        counts.unassigned++; // row-13 bug: unassigned but NOT counted in total
      } else {
        counts.unassigned++;
        counts.total++;
      }
    }
  }
  return counts;
}

function fillRoomArray(counts: RoomCounts, eliteChance: number): Room[] {
  const arr = new Array<Room>(counts.unassigned).fill("monster");
  const shopCount = Math.round(counts.total * SHOP_ROOM_CHANCE);
  const restCount = Math.round(counts.total * REST_ROOM_CHANCE);
  const treasureCount = Math.round(counts.total * TREASURE_ROOM_CHANCE);
  const eliteCount = Math.round(counts.total * eliteChance);
  const eventCount = Math.round(counts.total * EVENT_ROOM_CHANCE);

  let i = 0;
  const put = (room: Room, n: number) => {
    for (let k = 0; k < n && i < arr.length; k++) arr[i++] = room;
  };
  put("shop", shopCount);
  put("rest", restCount);
  put("treasure", treasureCount);
  put("elite", eliteCount);
  put("event", eventCount);
  // remainder stays "monster"
  return arr;
}

class RoomAssignData {
  offset = 0;
  rowRooms: (Room | null)[] = new Array(MAP_WIDTH).fill(null);
  prevRowRooms: (Room | null)[] = new Array(MAP_WIDTH).fill(null);
  siblingCols: Set<number>[] = Array.from({ length: MAP_WIDTH }, () => new Set());
  nextSiblingCols: Set<number>[] = Array.from({ length: MAP_WIDTH }, () => new Set());
  parentCols: Set<number>[] = Array.from({ length: MAP_WIDTH }, () => new Set());
  nextParentCols: Set<number>[] = Array.from({ length: MAP_WIDTH }, () => new Set());

  constructor(public rooms: Room[]) {}

  setData(node: GenMapNode): void {
    if (node.edges.length === 1) {
      this.nextParentCols[node.edges[0]!]!.add(node.x);
    } else {
      const siblingMask = new Set<number>();
      for (const edge of node.edges) {
        siblingMask.add(edge);
        for (const s of siblingMask) this.nextSiblingCols[edge]!.add(s);
        this.nextParentCols[edge]!.add(node.x);
      }
    }
  }

  setCurDataOnly(node: GenMapNode): void {
    this.rowRooms[node.x] = node.room;
  }

  removeElement(idx: number): void {
    for (let i = idx; i > this.offset; i--) {
      this.rooms[i] = this.rooms[i - 1]!;
    }
    this.offset++;
  }

  nextRow(): void {
    this.prevRowRooms = this.rowRooms;
    this.rowRooms = new Array(MAP_WIDTH).fill(null);
    this.siblingCols = this.nextSiblingCols;
    this.nextSiblingCols = Array.from({ length: MAP_WIDTH }, () => new Set());
    this.parentCols = this.nextParentCols;
    this.nextParentCols = Array.from({ length: MAP_WIDTH }, () => new Set());
  }

  siblingMatch(x: number, room: Room): boolean {
    for (const s of this.siblingCols[x]!) {
      if (this.rowRooms[s] === room) return true;
    }
    return false;
  }

  parentMatch(x: number, room: Room): boolean {
    for (const p of this.parentCols[x]!) {
      if (this.prevRowRooms[p] === room) return true;
    }
    return false;
  }
}

function assignRoomToNode(node: GenMapNode, data: RoomAssignData): void {
  const tried = new Set<Room>();
  for (let i = data.offset; i < data.rooms.length; i++) {
    const room = data.rooms[i]!;
    if (tried.has(room)) continue;
    tried.add(room);

    if (room === "elite" && node.y <= 4) continue;
    if (room === "rest" && (node.y <= 4 || node.y >= 13)) continue;

    if (room === "event" || room === "monster") {
      if (data.siblingMatch(node.x, room)) continue;
      node.room = room;
      data.rowRooms[node.x] = room;
      data.removeElement(i);
      return;
    }

    // shop / elite / rest: parent AND sibling constraints
    if (!data.parentMatch(node.x, room) && !data.siblingMatch(node.x, room)) {
      node.room = room;
      data.rowRooms[node.x] = room;
      data.removeElement(i);
      return;
    }
  }
  node.room = "monster"; // fallback (does not consume from the array)
}

function assignRooms(nodes: GenMapNode[][], rng: Rng, ascension: number): void {
  const counts = getRoomCountsAndAssignFixed(nodes);
  const rooms = fillRoomArray(counts, ascension > 0 ? ELITE_ROOM_CHANCE_A1 : ELITE_ROOM_CHANCE_A0);

  // in-place shuffle using the RAW counterless nextInt, as the reference does
  for (let i = counts.unassigned; i > 1; i--) {
    const j = rng.nextIntRaw(i);
    const tmp = rooms[i - 1]!;
    rooms[i - 1] = rooms[j]!;
    rooms[j] = tmp;
  }

  const data = new RoomAssignData(rooms);
  for (let row = 0; row < MAP_HEIGHT - 1; row++) {
    for (const node of nodes[row]!) {
      if (node.edges.length <= 0) continue;
      if (row === 0 || row === 8) {
        data.setData(node); // fixed rooms: propagate constraints only
      } else if (row === 7 || row === 13) {
        assignRoomToNode(node, data);
        data.setCurDataOnly(node);
      } else {
        assignRoomToNode(node, data);
        data.setData(node);
      }
    }
    data.nextRow();
  }
}

function assignBurningElite(nodes: GenMapNode[][], mapRng: Rng): { x: number; y: number } {
  const elites: { x: number; y: number }[] = [];
  for (let row = 0; row < MAP_HEIGHT; row++) {
    for (let col = 0; col < MAP_WIDTH; col++) {
      if (nodes[row]![col]!.room === "elite") elites.push({ x: col, y: row });
    }
  }
  const idx = mapRng.random(elites.length - 1);
  return elites[idx] ?? { x: -1, y: -1 };
}

export function generateMap(seed: bigint, ascension: number, act: number, setBurningElite: boolean): GeneratedMap {
  const offset = act === 1 ? 1n : BigInt(act * (100 * (act - 1)));
  const mapRng = new Rng(seed + offset);
  const nodes = makeNodes();
  createPaths(nodes, mapRng);
  filterRedundantEdgesFromFirstRow(nodes);
  assignRooms(nodes, mapRng, ascension);
  let burning = { x: -1, y: -1 };
  let buff = -1;
  if (setBurningElite) {
    burning = assignBurningElite(nodes, mapRng);
    buff = mapRng.randomRange(0, 3);
  }
  return { nodes, burningEliteX: burning.x, burningEliteY: burning.y, burningEliteBuff: buff };
}

/** Act 4: fixed 4-node column at x=3 (rest -> shop -> elite -> boss). */
export function act4Map(): GeneratedMap {
  const nodes = makeNodes();
  const set = (y: number, room: Room) => {
    const n = nodes[y]![3]!;
    n.room = room;
    if (y < 3) n.edges = [3];
    if (y > 0) n.parents = [3];
  };
  set(0, "rest");
  set(1, "shop");
  set(2, "elite");
  set(3, "boss");
  return { nodes, burningEliteX: -1, burningEliteY: -1, burningEliteBuff: -1 };
}

/** Render the map like the reference's toString for golden comparisons. */
export function mapToString(map: GeneratedMap): string {
  const roomChar: Record<Room, string> = {
    shop: "$",
    rest: "R",
    treasure: "T",
    elite: "E",
    event: "?",
    monster: "M",
    boss: "B",
    none: " ",
  };
  const lines: string[] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    let line = "";
    for (let x = 0; x < MAP_WIDTH; x++) {
      const node = map.nodes[y]![x]!;
      const present = y === 14 ? map.nodes[13]!.some((n) => n.edges.includes(x)) : node.edges.length > 0;
      line += present ? roomChar[node.room] : " ";
      line += node.edges.map(String).join(",").padEnd(6);
    }
    lines.push(line.trimEnd());
  }
  return lines.join("\n");
}
