// Minimal recursive-descent parser for the Lua *data-table subset* used by
// slaythespire.wiki.gg's Module:*/data pages. Handles: nested tables,
// ["key"] = / bareKey = / positional entries, quoted strings with escapes,
// numbers, booleans, nil, and `--` line comments. Not a general Lua parser.

export type LuaValue = string | number | boolean | null | LuaTable;
export interface LuaTable {
  [key: string]: LuaValue;
}

export function parseLuaModule(src: string): LuaTable {
  // Find the first table literal assigned in the module (e.g. `local all_data = {`).
  const m = src.match(/=\s*\{/);
  if (!m || m.index === undefined) throw new Error("no table literal found");
  const p = new Parser(src, m.index + m[0].length - 1);
  return p.parseTable() as LuaTable;
}

class Parser {
  constructor(
    private s: string,
    private i: number,
  ) {}

  private skipWs() {
    for (;;) {
      while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
      if (this.s.startsWith("--", this.i)) {
        const nl = this.s.indexOf("\n", this.i);
        this.i = nl === -1 ? this.s.length : nl + 1;
      } else return;
    }
  }

  private peek(): string {
    return this.s[this.i] ?? "";
  }

  private expect(ch: string) {
    if (this.s[this.i] !== ch)
      throw new Error(`expected '${ch}' at ${this.i}: ...${this.s.slice(Math.max(0, this.i - 40), this.i + 40)}...`);
    this.i++;
  }

  parseTable(): LuaTable | LuaValue[] {
    this.expect("{");
    const obj: LuaTable = {};
    const arr: LuaValue[] = [];
    let isArray = true;
    for (;;) {
      this.skipWs();
      if (this.peek() === "}") {
        this.i++;
        break;
      }
      // key forms: ["k"] =  |  [123] =  |  ident =  |  positional value
      if (this.peek() === "[" && this.s[this.i + 1] !== "[") {
        this.i++;
        this.skipWs();
        const key = this.parseValue();
        this.skipWs();
        this.expect("]");
        this.skipWs();
        this.expect("=");
        this.skipWs();
        obj[String(key)] = this.parseValue();
        isArray = false;
      } else {
        const save = this.i;
        const ident = this.tryIdent();
        this.skipWs();
        if (ident !== null && this.peek() === "=" && this.s[this.i + 1] !== "=") {
          this.i++;
          this.skipWs();
          obj[ident] = this.parseValue();
          isArray = false;
        } else {
          this.i = save;
          arr.push(this.parseValue());
        }
      }
      this.skipWs();
      if (this.peek() === "," || this.peek() === ";") this.i++;
    }
    if (isArray && Object.keys(obj).length === 0) return arr;
    if (arr.length > 0) arr.forEach((v, idx) => (obj[idx + 1] = v)); // mixed table: 1-based like Lua
    return obj;
  }

  private tryIdent(): string | null {
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.s.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return m[0];
  }

  parseValue(): LuaValue {
    this.skipWs();
    const c = this.peek();
    if (c === "{") return this.parseTable() as LuaValue;
    if (c === '"' || c === "'") return this.parseString(c);
    if (c === "-" || (c >= "0" && c <= "9")) return this.parseNumber();
    const ident = this.tryIdent();
    if (ident === "true") return true;
    if (ident === "false") return false;
    if (ident === "nil") return null;
    if (ident !== null) return ident; // bare identifier used as value - keep as string
    throw new Error(`unexpected char '${c}' at ${this.i}`);
  }

  private parseString(quote: string): string {
    this.expect(quote);
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === "\\") {
        const n = this.s[this.i + 1]!;
        out += n === "n" ? "\n" : n === "t" ? "\t" : n;
        this.i += 2;
      } else if (c === quote) {
        this.i++;
        return out;
      } else {
        out += c;
        this.i++;
      }
    }
    throw new Error("unterminated string");
  }

  private parseNumber(): number {
    const m = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i));
    if (!m) throw new Error(`bad number at ${this.i}`);
    this.i += m[0].length;
    return Number(m[0]);
  }
}
