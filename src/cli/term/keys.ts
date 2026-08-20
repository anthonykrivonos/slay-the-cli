// PURE byte -> Key parser for raw-mode stdin. No Bun/node APIs.
//
// Handles: printable ASCII, Enter, Esc, Backspace, Tab, arrow keys (CSI and
// SS3 forms), and Ctrl+C (raw mode delivers it as byte 0x03). Lone-ESC rule:
// an ESC byte not followed (in the same chunk) by a recognizable sequence is
// the Escape key — real escape sequences arrive within a single read.

export type Key =
  | { kind: "char"; ch: string }
  | { kind: "enter" }
  | { kind: "esc" }
  | { kind: "backspace" }
  | { kind: "tab" }
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "left" }
  | { kind: "right" }
  | { kind: "ctrlC" };

const ARROWS: Record<string, Key> = {
  A: { kind: "up" },
  B: { kind: "down" },
  C: { kind: "right" },
  D: { kind: "left" },
};

export function parseKeys(bytes: Uint8Array): Key[] {
  const out: Key[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b === 0x03) {
      out.push({ kind: "ctrlC" });
      i += 1;
    } else if (b === 0x0d || b === 0x0a) {
      out.push({ kind: "enter" });
      i += 1;
    } else if (b === 0x7f || b === 0x08) {
      out.push({ kind: "backspace" });
      i += 1;
    } else if (b === 0x09) {
      out.push({ kind: "tab" });
      i += 1;
    } else if (b === 0x1b) {
      // ESC [ <letter>  (CSI)  or  ESC O <letter>  (SS3 application mode)
      const b1 = bytes[i + 1];
      if (b1 === 0x5b /* [ */ || b1 === 0x4f /* O */) {
        // skip any CSI parameter bytes (0x30-0x3f) before the final byte
        let j = i + 2;
        while (j < bytes.length && bytes[j]! >= 0x30 && bytes[j]! <= 0x3f) j += 1;
        const fin = bytes[j];
        if (fin !== undefined) {
          const arrow = ARROWS[String.fromCharCode(fin)];
          if (arrow) out.push(arrow);
          // unknown sequences (F-keys, home/end...) are swallowed
          i = j + 1;
        } else {
          // truncated sequence at end of chunk: treat as lone ESC
          out.push({ kind: "esc" });
          i = bytes.length;
        }
      } else {
        out.push({ kind: "esc" });
        i += 1;
      }
    } else if (b >= 0x20 && b <= 0x7e) {
      out.push({ kind: "char", ch: String.fromCharCode(b) });
      i += 1;
    } else {
      i += 1; // other control bytes: ignored
    }
  }
  return out;
}
