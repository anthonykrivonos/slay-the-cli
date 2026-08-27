// The build's version, and the only place in src/ that reads package.json.
// package.json is ground truth: the title screen and the README banner both
// render this, so a bump is a UI change (see AGENTS.md, "When to bump").
//
// The import is inlined by every runner this project supports (bun, tsx for
// the Node path, and `bun build --compile`), so nothing is read at runtime.

import pkg from "../../package.json";

export const VERSION: string = pkg.version;

/** How the version is written in the UI: `v0.1.0`. */
export const VERSION_LABEL = `v${VERSION}`;
