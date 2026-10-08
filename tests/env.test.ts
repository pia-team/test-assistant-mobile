import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractProjectKeyFromFeatureUri,
  getEnvConfig,
  maskSecret,
  resetEnvConfigLogCache,
  resolveEnvConfig,
  setScenarioCredentialProfile,
  setScenarioProjectKey,
} from '../support/env';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECTS_DIR = path.join(PROJECT_ROOT, 'config', 'projects');

const ENV_KEYS = [
  'TEST_ENV',
  'COTESTER_WEB_USERNAME',
  'COTESTER_WEB_PASSWORD',
  'UI_USERNAME',
  'UI_PASSWORD',
  'COTESTER_API_BASE_URL',
  'BASE_URL',
  'UI_CREDENTIAL_PROFILE',
  'ENV_STRICT_PROJECT_CONFIG',
] as const;

const saved: Record<string, string | undefined> = {};
const createdFiles: string[] = [];

function saveEnv(): void {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
}

function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

function writeProjectConfig(name: string, body: Record<string, string>): void {
  const filePath = path.join(PROJECTS_DIR, name);
  fs.writeFileSync(filePath, JSON.stringify(body));
  createdFiles.push(filePath);
}

describe('mobile env config (MOBILE_LOGIN / runtime overlay)', () => {
  beforeEach(() => {
    saveEnv();
    resetEnvConfigLogCache();
    setScenarioProjectKey(undefined);
    setScenarioCredentialProfile(undefined);
  });

  afterEach(() => {
    restoreEnv();
    resetEnvConfigLogCache();
    setScenarioProjectKey(undefined);
    setScenarioCredentialProfile(undefined);
    for (const filePath of createdFiles.splice(0)) {
      fs.rmSync(filePath, { force: true });
    }
  });

  it('extracts project key from feature URI and ignores shared folders', () => {
    assert.equal(extractProjectKeyFromFeatureUri('features/GCU/Login/login.feature'), 'GCU');
    assert.equal(extractProjectKeyFromFeatureUri('features/steps/foo.feature'), undefined);
  });

  it('resolves project+tier file and isolates projects', () => {
    process.env.TEST_ENV = 'staging';
    writeProjectConfig('TESTISO_ALPHA.staging.json', {
      username: 'alpha@example.com',
      password: 'alpha-pass',
    });
    writeProjectConfig('TESTISO_BETA.staging.json', {
      username: 'beta@example.com',
      password: 'beta-pass',
    });

    const alpha = resolveEnvConfig('TESTISO_ALPHA');
    const beta = resolveEnvConfig('TESTISO_BETA');
    assert.equal(alpha.config.username, 'alpha@example.com');
    assert.equal(beta.config.username, 'beta@example.com');
    assert.equal(alpha.projectKey, 'TESTISO_ALPHA');
    assert.equal(beta.projectKey, 'TESTISO_BETA');
    assert.notEqual(alpha.filePath, beta.filePath);
  });

  it('applies CoTester MOBILE_LOGIN runtime overlay over JSON credentials', () => {
    process.env.TEST_ENV = 'dev';
    writeProjectConfig('TESTISO_DEMO.dev.json', {
      username: 'file-user',
      password: 'file-pass',
    });
    process.env.COTESTER_WEB_USERNAME = 'runtime-user';
    process.env.COTESTER_WEB_PASSWORD = 'runtime-pass';
    process.env.COTESTER_API_BASE_URL = 'https://api.example.test/';

    const cfg = getEnvConfig('TESTISO_DEMO');
    assert.equal(cfg.username, 'runtime-user');
    assert.equal(cfg.password, 'runtime-pass');
    assert.equal(cfg.apiBaseUrl, 'https://api.example.test/');
  });

  it('falls back to UI_USERNAME/UI_PASSWORD when CoTester vars absent', () => {
    process.env.TEST_ENV = 'dev';
    writeProjectConfig('TESTISO_DEMO2.dev.json', {
      username: 'file-user',
      password: 'file-pass',
    });
    process.env.UI_USERNAME = 'ui-user';
    process.env.UI_PASSWORD = 'ui-pass';

    const cfg = getEnvConfig('TESTISO_DEMO2');
    assert.equal(cfg.username, 'ui-user');
    assert.equal(cfg.password, 'ui-pass');
  });

  it('selects credential profile slug file when set on scenario', () => {
    process.env.TEST_ENV = 'uat';
    writeProjectConfig('TESTISO_DEMO.uat.json', {
      username: 'default-user',
      password: 'default-pass',
    });
    writeProjectConfig('TESTISO_DEMO.uat.faveo.json', {
      username: 'faveo-user',
      password: 'faveo-pass',
    });
    setScenarioCredentialProfile('faveo');
    const cfg = getEnvConfig('TESTISO_DEMO');
    assert.equal(cfg.username, 'faveo-user');
    assert.equal(cfg.password, 'faveo-pass');
  });

  it('masks secrets for logs', () => {
    assert.equal(maskSecret(''), '(empty)');
    assert.equal(maskSecret('ab'), '**');
    assert.equal(maskSecret('secret-value'), 'se***');
    assert.ok(!maskSecret('secret-value').includes('cret'));
  });
});
