// ANSI escape constants + pure string helpers. This file is PURE by design
// (no Bun./process/node: - enforced by tests/cli/boundaries.test.ts) so the
// render layer may import it. Only term/terminal.ts, io/, app.ts and main.ts
// touch the OS.

export const ESC = "\x1b";
export const CSI = `${ESC}[`;

// screen control (used by terminal.ts / app.ts)
export const ENTER_ALT_SCREEN = `${CSI}?1049h`;
export const LEAVE_ALT_SCREEN = `${CSI}?1049l`;
export const HIDE_CURSOR = `${CSI}?25l`;
export const SHOW_CURSOR = `${CSI}?25h`;
export const CURSOR_HOME = `${CSI}H`;
export const CLEAR_TO_EOL = `${CSI}K`;
/** OSC 2: window/tab title. Restored by the pair below on exit. */
export const SET_TITLE = `${ESC}]2;Slay the CLI\x07`;
export const PUSH_TITLE = `${CSI}22;2t`;
export const POP_TITLE = `${CSI}23;2t`;
export const SYNC_START = `${CSI}?2026h`; // synchronized output (flicker-free)
export const SYNC_END = `${CSI}?2026l`;
export const RESET = `${CSI}0m`;

// SGR builders (pure)
export function sgr(...codes: number[]): string {
  return `${CSI}${codes.join(";")}m`;
}

export function fg256(n: number): string {
  return `${CSI}38;5;${n}m`;
}

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** Strip all CSI escape sequences (pure reimplementation - no Bun.stripANSI). */
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/** Printable width of a line. The CLI's charset is pure ASCII + SGR codes, so
 *  width == length of the stripped string (no wide-char tables needed). */
export function visibleWidth(s: string): number {
  return stripAnsi(s).length;
}
