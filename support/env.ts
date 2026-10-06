import * as fs from 'fs';
import * as path from 'path';

/**
 * Standard mobile environment configuration.
 * Generated mobile tests read credentials only through {@link getEnvConfig}.
 */
export interface EnvConfig {
  /** Login username/email */
  username: string;
  /** Login password */
  password: string;
  /** Optional backend base URL for API-assisted setup steps */
  apiBaseUrl?: string;
}

export type EnvConfigSource =
  | 'project-tier'
  | 'project-default'
  | 'legacy-tier'
  | 'legacy-no-project-key';

export interface ResolvedEnvConfig {
  config: EnvConfig;
  tier: string;
  projectKey?: string;
  source: EnvConfigSource;
  /** Absolute path to the JSON file that was loaded */
  filePath: string;
  /** Display-friendly path (relative to the mobile runner root when possible) */
  displayPath: string;
  /** True when a project key was expected but only config/{tier}.json was used */
  isLegacyFallback: boolean;
  /** Paths that were checked (for diagnostics) */
  attemptedPaths: string[];
}

const EXCLUDED_PROJECT_FOLDERS = new Set(['steps', 'pages', 'records']);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECTS_CONFIG_DIR = path.join(PROJECT_ROOT, 'config', 'projects');
const LEGACY_CONFIG_DIR = path.join(PROJECT_ROOT, 'config');

let scenarioProjectKey: string | undefined;
let scenarioCredentialProfile: string | undefined;
const loggedResolutionKeys = new Set<string>();

export function setScenarioProjectKey(projectKey: string | undefined): void {
  scenarioProjectKey = projectKey?.trim() || undefined;
}

export function getScenarioProjectKey(): string | undefined {
  return scenarioProjectKey;
}

export function setScenarioCredentialProfile(profileSlug: string | undefined): void {
  scenarioCredentialProfile = profileSlug?.trim() || undefined;
}

export function getScenarioCredentialProfile(): string | undefined {
  return scenarioCredentialProfile;
}

/**
 * Extract project key from a Cucumber feature URI/path.
 * Example: features/GCU/Login/login.feature -> GCU
 */
export function extractProjectKeyFromFeatureUri(featureUri: string): string | undefined {
  if (!featureUri) {
    return undefined;
  }
  const normalized = featureUri.replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)features\/([^/]+)\//i);
  if (!match) {
    return undefined;
  }
  const key = match[1]?.trim();
  if (!key || EXCLUDED_PROJECT_FOLDERS.has(key.toLowerCase())) {
    return undefined;
  }
  return key;
}

function normalizeTier(tier?: string): string {
  const normalized = (tier ?? 'dev').trim().toLowerCase();
  return normalized || 'dev';
}

function toDisplayPath(absolutePath: string): string {
  const relative = path.relative(PROJECT_ROOT, absolutePath);
  return relative && !relative.startsWith('..') ? relative.replace(/\\/g, '/') : absolutePath;
}

function isStrictProjectConfigEnabled(): boolean {
  const raw = (process.env.ENV_STRICT_PROJECT_CONFIG ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function maskSecret(value: string): string {
  if (!value) {
    return '(empty)';
  }
  if (value.length <= 2) {
    return '**';
  }
  return `${value.slice(0, 2)}***`;
}

function parseAndValidateEnvConfig(raw: string, filePath: string): EnvConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in env config '${toDisplayPath(filePath)}': ${message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Env config '${toDisplayPath(filePath)}' must be a JSON object.`);
  }

  const record = parsed as Record<string, unknown>;
  const username = typeof record.username === 'string' ? record.username.trim() : '';
  const password = typeof record.password === 'string' ? record.password : '';
  const apiBaseUrl = typeof record.apiBaseUrl === 'string' ? record.apiBaseUrl.trim() : '';

  const missing: string[] = [];
  if (!username) missing.push('username');
  if (!password) missing.push('password');
  if (missing.length > 0) {
    throw new Error(
      `Env config '${toDisplayPath(filePath)}' is missing required field(s): ${missing.join(', ')}`,
    );
  }

  if (apiBaseUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(apiBaseUrl);
    } catch {
      throw new Error(`Env config '${toDisplayPath(filePath)}' has invalid apiBaseUrl: '${apiBaseUrl}'`);
    }
  }

  return apiBaseUrl ? { username, password, apiBaseUrl } : { username, password };
}

function buildCandidatePaths(projectKey: string | undefined, tier: string): {
  candidates: Array<{ filePath: string; source: EnvConfigSource }>;
  attemptedPaths: string[];
} {
  const candidates: Array<{ filePath: string; source: EnvConfigSource }> = [];
  const attemptedPaths: string[] = [];
  const slug = getScenarioCredentialProfile() ?? process.env.UI_CREDENTIAL_PROFILE ?? undefined;

  const consider = (filePath: string, source: EnvConfigSource) => {
    attemptedPaths.push(filePath);
    if (fs.existsSync(filePath)) {
      candidates.push({ filePath, source });
    }
  };

  if (projectKey && slug) {
    consider(path.join(PROJECTS_CONFIG_DIR, `${projectKey}.${tier}.${slug}.json`), 'project-tier');
  }
  if (projectKey) {
    consider(path.join(PROJECTS_CONFIG_DIR, `${projectKey}.${tier}.json`), 'project-tier');
    consider(path.join(PROJECTS_CONFIG_DIR, `${projectKey}.json`), 'project-default');
  }
  consider(
    path.join(LEGACY_CONFIG_DIR, `${tier}.json`),
    projectKey ? 'legacy-tier' : 'legacy-no-project-key',
  );

  return { candidates, attemptedPaths };
}

function logEnvResolution(resolved: ResolvedEnvConfig): void {
  const logKey = [resolved.tier, resolved.projectKey ?? '(none)', resolved.filePath, resolved.source].join('|');
  if (loggedResolutionKeys.has(logKey)) {
    return;
  }
  loggedResolutionKeys.add(logKey);

  const sourceLabel =
    resolved.source === 'project-tier'
      ? 'project+tier'
      : resolved.source === 'project-default'
        ? 'project default'
        : resolved.source === 'legacy-tier'
          ? 'LEGACY FALLBACK'
          : 'legacy (no project key)';

  console.log(
    `[ENV] Resolved TEST_ENV=${resolved.tier}` +
      (resolved.projectKey ? ` project=${resolved.projectKey}` : ' project=(none)'),
  );
  console.log(`[ENV]   file: ${resolved.displayPath} (${sourceLabel})`);
  if (resolved.config.apiBaseUrl) {
    console.log(`[ENV]   apiBaseUrl: ${resolved.config.apiBaseUrl}`);
  }
  console.log(
    `[ENV]   username: ${resolved.config.username} | password: ${maskSecret(resolved.config.password)}`,
  );

  if (resolved.isLegacyFallback) {
    console.warn(
      `[ENV] WARNING: Project-specific config not found for '${resolved.projectKey}'. ` +
        `Using shared ${resolved.displayPath}. Expected: config/projects/${resolved.projectKey}.${resolved.tier}.json`,
    );
  }
  if (!resolved.projectKey) {
    console.warn(
      '[ENV] WARNING: No project key in scenario context. ' +
        'Ensure hooks.ts sets project key from features/{PROJECT}/ path.',
    );
  }
}

/**
 * Resolve credentials for the current scenario.
 * Priority: {P}.{tier}.{slug}.json → {P}.{tier}.json → {P}.json → config/{tier}.json
 * (slug from @credential:slug tag, else UI_CREDENTIAL_PROFILE).
 */
export function resolveEnvConfig(projectKey?: string): ResolvedEnvConfig {
  const tier = normalizeTier(process.env.TEST_ENV);
  const effectiveProjectKey = (projectKey ?? getScenarioProjectKey())?.trim() || undefined;
  const { candidates, attemptedPaths } = buildCandidatePaths(effectiveProjectKey, tier);

  if (candidates.length === 0) {
    throw new Error(
      `Config file not found for TEST_ENV='${tier}'` +
        (effectiveProjectKey ? ` project='${effectiveProjectKey}'` : '') +
        `. Checked: ${attemptedPaths.map(toDisplayPath).join(', ')}`,
    );
  }

  const selected = candidates[0];
  const isLegacyFallback =
    !!effectiveProjectKey &&
    (selected.source === 'legacy-tier' || selected.source === 'legacy-no-project-key');

  if (isLegacyFallback && isStrictProjectConfigEnabled()) {
    throw new Error(
      `ENV_STRICT_PROJECT_CONFIG is enabled and project '${effectiveProjectKey}' has no file under ` +
        `config/projects/. Refusing legacy fallback '${toDisplayPath(selected.filePath)}'.`,
    );
  }

  const config = parseAndValidateEnvConfig(fs.readFileSync(selected.filePath, 'utf-8'), selected.filePath);
  const resolved: ResolvedEnvConfig = {
    config,
    tier,
    projectKey: effectiveProjectKey,
    source: selected.source,
    filePath: selected.filePath,
    displayPath: toDisplayPath(selected.filePath),
    isLegacyFallback,
    attemptedPaths: attemptedPaths.map(toDisplayPath),
  };
  logEnvResolution(resolved);
  return resolved;
}

/**
 * Load credentials for the current scenario.
 * @param projectKey Optional override; defaults to scenario project key from hooks.
 */
export function getEnvConfig(projectKey?: string): EnvConfig {
  return resolveEnvConfig(projectKey).config;
}

/** Clears in-process env resolution log dedupe. */
export function resetEnvConfigLogCache(): void {
  loggedResolutionKeys.clear();
}
