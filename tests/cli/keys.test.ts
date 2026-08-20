// keys.ts parser: escape sequences, lone ESC, ctrl-c byte, printables.

import { test, expect, describe } from "bun:test";
import { parseKeys, type Key } from "../../src/cli/term/keys";

function parse(s: string): Key[] {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
  return parseKeys(arr);
}

describe("parseKeys", () => {
  test("printable ASCII becomes char keys", () => {
    expect(parse("a1 Z~")).toEqual([
      { kind: "char", ch: "a" },
      { kind: "char", ch: "1" },
      { kind: "char", ch: " " },
      { kind: "char", ch: "Z" },
      { kind: "char", ch: "~" },
    ]);
  });

  test("enter, backspace, tab", () => {
    expect(parse("\r")).toEqual([{ kind: "enter" }]);
    expect(parse("\n")).toEqual([{ kind: "enter" }]);
    expect(parse("\x7f")).toEqual([{ kind: "backspace" }]);
    expect(parse("\x08")).toEqual([{ kind: "backspace" }]);
    expect(parse("\t")).toEqual([{ kind: "tab" }]);
  });

  test("ctrl+c arrives as byte 0x03 under raw mode", () => {
    expect(parse("\x03")).toEqual([{ kind: "ctrlC" }]);
    expect(parse("a\x03b")).toEqual([
      { kind: "char", ch: "a" },
      { kind: "ctrlC" },
      { kind: "char", ch: "b" },
    ]);
  });

  test("CSI arrow sequences", () => {
    expect(parse("\x1b[A")).toEqual([{ kind: "up" }]);
    expect(parse("\x1b[B")).toEqual([{ kind: "down" }]);
    expect(parse("\x1b[C")).toEqual([{ kind: "right" }]);
    expect(parse("\x1b[D")).toEqual([{ kind: "left" }]);
  });

  test("SS3 (application mode) arrows", () => {
    expect(parse("\x1bOA")).toEqual([{ kind: "up" }]);
    expect(parse("\x1bOD")).toEqual([{ kind: "left" }]);
  });

  test("lone ESC is the Escape key", () => {
    expect(parse("\x1b")).toEqual([{ kind: "esc" }]);
    expect(parse("\x1bq")).toEqual([{ kind: "esc" }, { kind: "char", ch: "q" }]);
  });

  test("truncated escape sequence at chunk end degrades to ESC", () => {
    expect(parse("\x1b[")).toEqual([{ kind: "esc" }]);
  });

  test("unknown CSI sequences are swallowed (parameters skipped)", () => {
    // F5 = ESC [ 1 5 ~ — must not leak "15~" as chars
    expect(parse("\x1b[15~x")).toEqual([{ kind: "char", ch: "x" }]);
  });

  test("multiple keys in one chunk parse in order", () => {
    expect(parse("1\x1b[B2")).toEqual([
      { kind: "char", ch: "1" },
      { kind: "down" },
      { kind: "char", ch: "2" },
    ]);
  });

  test("other control bytes are ignored", () => {
    expect(parse("\x01\x02a")).toEqual([{ kind: "char", ch: "a" }]);
  });
});
