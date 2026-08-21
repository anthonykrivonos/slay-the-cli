// Update checking, built into the app so nobody has to paste a shell function.
//
// The rule this file exists to obey: startup must never wait on the network,
// and nothing may print while the TUI owns the screen. So the work is split in
// two, and git's own ref store is the cache between them:
//
//   readUpdateInfo()      local only. Compares HEAD against the origin/main
//                         ref already on disk. No network, a few ms.
//   startBackgroundFetch() detached, unref'd `git fetch`. Refreshes that ref
//                         for the NEXT launch to read. Cannot delay startup,
//                         cannot delay exit, cannot draw on the terminal.
//
// So the notice you see is one launch stale, and costs nothing. Checking is
// automatic; applying is `slay --update`, because rebuilding a binary out from
// under a running process is not something to do without being asked.
//
// Silence is deliberate throughout: no repo, no git, no network, or a detached
// HEAD all mean "no notice", never an error.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface UpdateInfo {
  /** commits on origin/main that this checkout does not have */
  behind: number;
}

/** Local git reads are quick, but never let one wedge startup. */
const GIT_TIMEOUT_MS = 2000;
/** Applying an update pulls and recompiles, which is allowed to take a while. */
const APPLY_TIMEOUT_MS = 300_000;

function looksLikeRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/** The checkout we are running out of, or null if we are not in one (a copied
 *  binary, a tarball, an install with the .git directory stripped). */
export function findRepo(): string | null {
  const candidates: string[] = [];

  // an explicit install root wins (this is what the README's SLAY_HOME sets)
  const home = process.env.SLAY_HOME;
  if (home !== undefined && home.trim().length > 0) {
    candidates.push(join(home, "app"), home);
  }

  // running from source: walk up from this file. Uses import.meta.url rather
  // than import.meta.dir so this works under Node/tsx as well as Bun.
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      candidates.push(dir);
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  } catch {
    // a compiled binary has no real file URL for this module
  }

  // compiled binary living at <repo>/dist/slay
  try {
    candidates.push(resolve(dirname(process.execPath), ".."));
  } catch {
    /* ignore */
  }

  for (const dir of candidates) {
    if (looksLikeRepo(dir)) return dir;
  }
  return null;
}

function git(repo: string, args: string[], timeout = GIT_TIMEOUT_MS): string | null {
  try {
    const r = spawnSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (r.status !== 0 || typeof r.stdout !== "string") return null;
    return r.stdout.trim();
  } catch {
    return null;
  }
}

/** SLAY_NO_UPDATE_CHECK=1 turns the whole thing off, network and all. */
export function updateCheckDisabled(): boolean {
  const v = process.env.SLAY_NO_UPDATE_CHECK;
  return v !== undefined && v !== "" && v !== "0";
}

/** How far behind origin/main this checkout is, read from local refs only. */
export function readUpdateInfo(repo: string): UpdateInfo | null {
  const out = git(repo, ["rev-list", "--count", "HEAD..origin/main"]);
  if (out === null) return null;
  const n = Number.parseInt(out, 10);
  if (!Number.isInteger(n) || n < 0) return null;
  return { behind: n };
}

/** Refresh origin/main for the next launch. Returns immediately, always. */
export function startBackgroundFetch(repo: string): void {
  try {
    const child = spawn("git", ["-C", repo, "fetch", "--quiet", "origin", "main"], {
      detached: true,
      stdio: "ignore",
    });
    // never let a missing git or a dead network surface as an unhandled error
    child.on("error", () => {});
    child.unref();
  } catch {
    /* offline, no git, no matter */
  }
}

/** The whole startup-side check: what to show, and a fetch for next time.
 *  Safe to call unconditionally; it no-ops when disabled or repo-less. */
export function checkForUpdates(): UpdateInfo | null {
  if (updateCheckDisabled()) return null;
  const repo = findRepo();
  if (repo === null) return null;
  const info = readUpdateInfo(repo); // read first: report the pre-fetch state
  startBackgroundFetch(repo);
  return info;
}

// --- applying ----------------------------------------------------------------

function run(cmd: string, args: string[], cwd: string): boolean {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", timeout: APPLY_TIMEOUT_MS });
  return r.status === 0;
}

function has(cmd: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(probe, [cmd], { stdio: "ignore", timeout: GIT_TIMEOUT_MS });
  return r.status === 0;
}

/** `slay --update`: fast-forward, reinstall, recompile. Returns an exit code.
 *  Runs in the foreground with inherited stdio, so the user sees git's output;
 *  this never runs while the TUI owns the screen. */
export function applyUpdate(): number {
  const repo = findRepo();
  if (repo === null) {
    console.error("slay: no git checkout found to update (set SLAY_HOME to the install root).");
    return 1;
  }
  console.log(`slay: updating ${repo}`);
  const before = git(repo, ["rev-parse", "HEAD"]);
  if (!run("git", ["pull", "--ff-only", "origin", "main"], repo)) {
    console.error("slay: git pull failed, nothing changed.");
    return 1;
  }
  // nothing moved: skip the reinstall and the recompile entirely, so running
  // --update when current costs a fetch and nothing else
  if (before !== null && git(repo, ["rev-parse", "HEAD"]) === before) {
    console.log(`slay: already at the top of the Spire (${git(repo, ["log", "-1", "--pretty=%h %s"]) ?? before}).`);
    return 0;
  }

  const pm = has("bun") ? "bun" : has("npm") ? "npm" : null;
  if (pm === null) {
    console.log("slay: pulled, but no bun or npm found to reinstall dependencies.");
    return 0;
  }
  if (!run(pm, ["install"], repo)) {
    console.error(`slay: ${pm} install failed.`);
    return 1;
  }

  // only Bun can compile the standalone binary; a Node install runs from source
  if (pm === "bun" && existsSync(join(repo, "dist"))) {
    if (!run("bun", ["run", "build"], repo)) {
      console.error("slay: rebuild failed.");
      return 1;
    }
  }

  const at = git(repo, ["log", "-1", "--pretty=%h %s"]) ?? "(unknown)";
  console.log(`slay: the Spire has shifted. Now at ${at}`);
  return 0;
}
