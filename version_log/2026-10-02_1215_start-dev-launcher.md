# 2026-10-02 12:15 — `start-dev.command` launcher

## Context

`CONTRIBUTING.md` documents the two-process dev stack: `npm run dev:api`
(Hono on `:3457`) and `npm run dev` (Next.js on `:3456`), each in its own
terminal. A contributor asked for a double-clickable launcher so they can
boot the stack from Finder without remembering the commands or the
`--env-file=../.env.local` flag on the API side.

## Files affected

- `start-dev.command` (new)
- `CHANGELOG.md`

## Before / After

Before: no repo-level launcher. Boot sequence was:

```
# terminal 1
npm run dev:api

# terminal 2
npm run dev
```

After (on macOS): double-click `start-dev.command` in Finder. It runs
`npm install` if `node_modules` is missing, then opens two Terminal windows
with the API and UI commands and prints a clear alert if Bun is missing.

## Implementation notes

- Script header `#!/usr/bin/env zsh` so Finder launches it directly.
- Marked executable with `chmod +x` (mode `755`).
- Uses `osascript` `do script` to spawn the two long-lived processes in
  separate Terminal windows. The launcher window itself can close without
  killing the children.
- If `.env.local` is absent, the API command drops the flag rather than
  failing — `bun --env-file=missing.path` errors out, but `bun run
  src/index.ts` without it falls back to no env, which matches the
  documented "app runs with no keys" path.
- If `bun` is not on `$PATH`, the script pops a native `display alert`
  instead of letting `bun run` fail with a cryptic shell error.

## Reasoning

- Finder's default action for `.command` files is "Open", which executes
  the script via Terminal — no extra configuration needed.
- Two `Terminal` `do script` calls give the API and UI independent
  scrollback and Ctrl-C behaviour, which the documented `npm run dev:api`
  + `npm run dev` flow also assumes.

## Risks / side effects

- macOS-only. Uses `osascript` and `.command` extension. Not portable to
  Linux/WSL contributors — they should keep using the documented npm flow.
- First-run delay: if `node_modules` is missing the script runs `npm
  install` synchronously in the launching Terminal before opening the
  two windows. That's intentional — avoids race conditions on first boot.
- Gatekeeper: unsigned scripts downloaded from the internet trigger a
  "cannot be opened because the developer cannot be verified" prompt the
  first time. Right-click → Open once, or remove the quarantine
  attribute: `xattr -d com.apple.quarantine start-dev.command`.