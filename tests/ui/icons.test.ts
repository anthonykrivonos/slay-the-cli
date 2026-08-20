// Every icon name the UI draws must resolve to real path data in the
// installed Iconify sets — a guessed id would silently render nothing
// (drawIcon no-ops on unknown names), so this test is the roster's gate.
// It also asserts the generated runtime snapshot (src/ui/icondata.ts) is
// byte-identical to the real sets: after changing USED_ICONS, run
//   bun tests/ui/gen-icondata.ts

import { test, expect, describe } from "bun:test";
import { icons as gameIcons } from "@iconify-json/game-icons";
import { icons as mdiIcons } from "@iconify-json/mdi";
import { getIconData } from "@iconify/utils";
import { USED_ICONS, hasIcon } from "../../src/ui/icons";
import { ICON_DATA } from "../../src/ui/icondata";

describe("icon roster", () => {
  test("USED_ICONS is non-trivial and namespaced", () => {
    expect(USED_ICONS.length).toBeGreaterThan(10);
    for (const name of USED_ICONS) {
      expect(name).toMatch(/^(gi|mdi):[a-z0-9-]+$/);
    }
  });

  for (const name of USED_ICONS) {
    test(`${name} resolves to drawable path data, in sync with the real set`, () => {
      expect(hasIcon(name)).toBe(true);

      // the runtime snapshot must match the installed set exactly
      const sep = name.indexOf(":");
      const prefix = name.slice(0, sep);
      const set = prefix === "gi" ? gameIcons : mdiIcons;
      const real = getIconData(set, name.slice(sep + 1));
      expect(real).toBeTruthy();
      const snap = ICON_DATA[name];
      expect(snap).toBeTruthy();
      expect(snap!.body).toBe(real!.body);
      expect(snap!.width).toBe(real!.width ?? set.width ?? 16);
      expect(snap!.height).toBe(real!.height ?? set.height ?? 16);
    });
  }

  test("snapshot carries no unused icons", () => {
    const used = new Set<string>(USED_ICONS);
    for (const key of Object.keys(ICON_DATA)) expect(used.has(key)).toBe(true);
  });

  test("unknown icons are rejected, not guessed", () => {
    expect(hasIcon("gi:definitely-not-an-icon")).toBe(false);
    expect(hasIcon("lucide:sword")).toBe(false); // stroke sets aren't wired in
    expect(hasIcon("no-namespace")).toBe(false);
  });
});
