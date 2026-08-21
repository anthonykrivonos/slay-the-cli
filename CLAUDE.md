---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## This project (Slay the CLI)

Mechanically exact Slay the Spire clone, adapted to the terminal: `bun src/cli/main.ts`.
- `src/engine`: pure deterministic core. No DOM/Bun APIs/randomness outside the seeded RNG (enforced by tests/architecture).
- `src/content`: the forkable content bundle; corpus-audited against `data/corpus/*.json` (ground truth; imported by tests/tools ONLY).
- `src/cli`: TUI. `render/ input/ state/ text/` are pure (no process/Bun./node:, enforced); only `term/ io/ app.ts main.ts` touch the OS. Frames are snapshot-tested; keep output ASCII-only.
- Exactness rule: game numbers/behavior come from the corpus, never from memory. Deviations get a flagging comment (`ENGINE-GAP`, `VERIFY-JAR`, etc.).
- Copy rule: no em dashes or other typographic punctuation in copy or comments; UI copy stays in the game's own terse voice.
- Portraits (`src/cli/render/{heroPortraits,monsterPortraits}.ts`) are GENERATED: edit `tools/gen-hero-portraits.ts` / `tools/gen-monster-portraits.ts` and rerun them against a local image directory, never the generated files. Source images are deliberately not committed.
- README screenshots (`docs/shots/*.svg`) are GENERATED from the real snapshot fixtures: edit `tools/gen-readme-shots.ts` and rerun it, never the SVGs. They are real `renderFrame` output in truecolor, so they cannot drift from the UI.
- Update checks (`src/cli/io/update.ts`): startup reads ONLY local git refs (no network, ~15ms); the `git fetch` that refreshes them is detached/unref'd, so the notice is one launch stale by design. Never make the startup path await the network or print while the TUI owns the screen. Off via `--no-update-check` / `SLAY_NO_UPDATE_CHECK=1`; silent when repo-less.
- Full suite: `bun test`. Corpus audit: `bun tools/corpus/check-all.ts`.

## TUI snapshots

The files under `tests/cli/fixtures/*.txt` ARE the expected UI. Never edit
them by hand: change the renderer, run `bun tests/cli/gen-fixtures.ts`, and
review the diff like a screenshot before committing. Frames are pure ASCII
(<0x80), exactly rows x cols at every size; layout math lives in
`src/cli/render/layout.ts` and must stay total (clamped) at all sizes.
