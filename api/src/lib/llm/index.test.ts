import '../../test-guard';
import { describe, expect, test } from 'bun:test';
import { db } from '../../db';

// Exercises the credential-probe auto-fallback in getProvider(): when llmProvider
// resolves to 'anthropic' but no Anthropic credential is reachable anywhere, the
// provider must downgrade to the OpenAI-compatible path rather than instantiate
// `new Anthropic()` with no args (SDK 0.78 throws "Could not resolve
// authentication method" eagerly). See the in-file comment in index.ts.

const ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_OAUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'LLM_PROVIDER',
] as const;

const SETTINGS_KEYS = ['llmProvider', 'anthropicApiKey', 'claudeOauthToken'];

let env: Record<string, string | undefined> = {};

beforeEachPersist();
afterEachPersist();

describe('getProvider credential probe', () => {
  test('falls back to openai when llmProvider=anthropic but no credential is reachable', () => {
    setLocalSetting('llmProvider', 'anthropic');
    clearEnv();

    const { getProvider, resetProvider } = require('../llm');
    resetProvider();
    const provider = getProvider();

    expect(provider.name).toBe('openai');
  });

  test('keeps anthropic when a stored API key is set', () => {
    setLocalSetting('llmProvider', 'anthropic');
    setLocalSetting('anthropicApiKey', 'sk-ant-test');
    clearEnv();

    const { getProvider, resetProvider } = require('../llm');
    resetProvider();
    const provider = getProvider();

    expect(provider.name).toBe('anthropic');
  });

  test('keeps anthropic when ANTHROPIC_API_KEY env is set', () => {
    setLocalSetting('llmProvider', 'anthropic');
    clearLocalSettings();
    clearEnv();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-env';

    const { getProvider, resetProvider } = require('../llm');
    resetProvider();
    const provider = getProvider();

    expect(provider.name).toBe('anthropic');
  });

  test('keeps anthropic when CLAUDE_CODE_OAUTH_TOKEN env is set', () => {
    setLocalSetting('llmProvider', 'anthropic');
    clearLocalSettings();
    clearEnv();
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'oauth-test';

    const { getProvider, resetProvider } = require('../llm');
    resetProvider();
    const provider = getProvider();

    expect(provider.name).toBe('anthropic');
  });

  test('falls back to openai when llmProvider is unset (default) and no credential is reachable', () => {
    clearLocalSettings();
    clearEnv();

    const { getProvider, resetProvider } = require('../llm');
    resetProvider();
    const provider = getProvider();

    expect(provider.name).toBe('openai');
  });
});

function beforeEachPersist() {
  // Snapshot once; each test restores in afterEach.
  for (const k of ENV_KEYS) env[k] = process.env[k];
}

function afterEachPersist() {
  for (const k of ENV_KEYS) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  env = {};
  // Wipe settings touched by these tests so unrelated tests start clean.
  db.prepare(
    "DELETE FROM settings WHERE key IN ('llmProvider', 'anthropicApiKey', 'claudeOauthToken')",
  ).run();
}

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

function clearLocalSettings() {
  db.prepare('DELETE FROM settings WHERE key IN (?, ?, ?)').run(...SETTINGS_KEYS);
}

function setLocalSetting(key: string, value: string) {
  db.prepare(
    `INSERT INTO settings (userId, key, value) VALUES ('local', ?, ?)
     ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value`,
  ).run(key, JSON.stringify(value));
}
