# Changelog

## 2026-10-02 12:55

- Fix `getProvider()` exploding with `Could not resolve authentication method` on Ollama-only local installs.
  - `api/src/lib/llm/index.ts`: extracted the provider-name resolution into `resolveProviderName(raw, providerSetting)`. The Anthropic branch is now only taken when at least one credential source is reachable — stored `anthropicApiKey`, stored `claudeOauthToken`, or one of `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_OAUTH_TOKEN` / `CLAUDE_CODE_OAUTH_TOKEN` env vars. Otherwise the wrapper falls back to the OpenAI-compatible path (Ollama / LM Studio / etc.). Explicit `llmProvider: 'anthropic'` with credentials is unchanged.
  - Rationale: the default in `raw = providerSetting('llmProvider') || process.env.LLM_PROVIDER || 'anthropic'` meant an install with no `llmProvider` setting, no env var, and no Anthropic credential fell into the Anthropic branch, hit `new AnthropicProvider({})`, and SDK 0.78 threw eagerly. The Settings → AI Provider panel called this on `GET /api/llm-status`, and `POST /api/chat` (`routes/chat.ts:124`) hit it on the first chat message. An Ollama-only local install — OpenAI-compatible provider, no Anthropic — was always broken.
  - Risks: a deployment that previously relied on the Anthropic default and intentionally had no `llmProvider` setting AND no credential anywhere will now silently land on the OpenAI-compatible path. That combination is precisely the broken case — there is no working Anthropic call possible without a credential — so the only observable change is "stops throwing", not "starts calling a different service". Hosts that have `ANTHROPIC_API_KEY` set get the Anthropic path back, as before.
- New unit test `api/src/lib/llm/index.test.ts` covers the five cases: stored API key, env API key, env OAuth token, no credential anywhere, and explicit `llmProvider: 'anthropic'` with no credential.

## 2026-10-02 12:15

- Add `start-dev.command`, a double-clickable macOS launcher for the local dev stack.
  - New file `start-dev.command` at the repo root, marked executable.
  - Runs `npm install` once if `node_modules` is missing, then opens two Terminal windows via `osascript`: one for `bun run --env-file=../.env.local --watch src/index.ts` (API on `:3457`) and one for `npm run dev` (Next.js UI on `:3456`).
  - Shows an alert and exits cleanly if Bun is not installed.
  - Skips the `--env-file` flag when `.env.local` is absent, matching the documented "no keys required" path.
  - Rationale: contributors currently need to remember two terminals, the API env-file flag, and the two port numbers; this lowers the barrier to a single Finder double-click.
  - Risks: macOS-only (`osascript`, `.command`). Linux/WSL contributors should keep using `npm run dev:api` + `npm run dev` from `CONTRIBUTING.md`.

## 2026-09-30 12:55

- Fix read-page handler routing multi-token CJK selections (newline-separated text, accidental multi-sentence drags) to the phrase-translation endpoint instead of failing the word-gloss server guard with `Word must be a single token` (400).
  - `src/app/read/[bookId]/page.tsx`: replaced `word.includes(' ')` token heuristic with `word.trim().split(/\s+/).filter(Boolean).length > 1`. The phrase path already accepts multi-token input; this routes it correctly instead of bouncing it at the server.
  - Rationale: Japanese / Chinese text has no spaces, so `内容について確認しました\nチェックをする` looked like a single word to the old check, then the gloss endpoint's single-token regex rejected it.
  - Risks: low — pure routing change. If the user genuinely clicked a single Japanese word, `tokenCount` is 1 and behaviour is unchanged.
