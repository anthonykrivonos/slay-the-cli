## What this changes

<!-- One or two sentences. If it fixes an issue, "Fixes #123". -->

## Checks

<!-- CI runs this again, plus a generated-file check and a Node load check. -->

- [ ] `bun test` passes

## The rules

<!-- Delete any line that does not apply, but read them first: -->
<!-- docs/CONTRIBUTING.md#the-rules-that-will-get-a-pr-sent-back -->

- [ ] Numbers come from `data/corpus`, not from memory. Value changes cite a source.
- [ ] Deliberate deviations from the original carry a flagging comment.
- [ ] No snapshot in `tests/cli/fixtures/` was hand-edited. Frames changed only by
      changing the renderer and running `bun run fixtures`.
- [ ] Frames are still pure ASCII and exactly rows x cols at every size.
- [ ] Layer boundaries hold: `src/engine` stays pure, and in `src/cli` only
      `term/ io/ app.ts main.ts` touch the OS.
- [ ] `dependencies` is still empty.
- [ ] No em dashes or other typographic punctuation, in copy or comments.
- [ ] No generated file edited by hand (portraits, `docs/shots/*.svg`).

## AI assistance

<!-- Most of this codebase was written by an LLM, so this is a disclosure, not
     a confession. Say what helped and how much you checked it. -->
