import * as fs from 'fs';
import * as path from 'path';
import { remote } from 'webdriverio';
import type { Browser } from 'webdriverio';
import type { DeviceInfo } from './world';

/** Run context written by the backend before the runner starts (runner-contract §4). */
export interface RunContextDevice {
  index: number;
  udid: string;
  name: string;
  platformVersion: string;
  capabilities: Record<string, unknown>;
}

export interface RunContext {
  jobId: string;
  appiumUrl: string;
  app: { package: string; activity?: string; buildVersion?: string };
  resetMode: 'RESTART' | 'CLEAR_DATA';
  devices: RunContextDevice[];
  artifacts: {
    screenshotsDir: string;
    videosDir: string;
    deviceLogsDir: string;
    pageSourceDir: string;
    sessionsFile: string;
  };
}

const DEFAULT_ARTIFACTS: RunContext['artifacts'] = {
  screenshotsDir: 'reports/screenshots',
  videosDir: 'reports/videos',
  deviceLogsDir: 'reports/device-logs',
  pageSourceDir: 'reports/page-source',
  sessionsFile: 'reports/run-context/local.sessions.json',
};

let cachedContext: RunContext | undefined;
let driver: Browser | undefined;
let sessionCreatedOnce = false;

export function workerIndex(): number {
  const raw = process.env.CUCUMBER_WORKER_ID;
  const parsed = raw == null || raw.trim() === '' ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function loadRunContext(): RunContext {
  if (cachedContext) {
    return cachedContext;
  }
  const contextPath = process.env.COTESTER_MOBILE_RUN_CONTEXT;
  if (!contextPath) {
    throw new Error(
      'DEVICE_NOT_READY: COTESTER_MOBILE_RUN_CONTEXT is not set. Mobile runs must be started by CoTester ' +
        '(or point the variable at a run-context JSON for local runs).',
    );
  }
  let parsed: RunContext;
  try {
    parsed = JSON.parse(fs.readFileSync(contextPath, 'utf8')) as RunContext;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`DEVICE_NOT_READY: cannot read run context '${contextPath}': ${message}`);
  }
  if (!parsed.appiumUrl || !parsed.app?.package || !Array.isArray(parsed.devices)) {
    throw new Error(`DEVICE_NOT_READY: run context '${contextPath}' is missing appiumUrl, app.package or devices`);
  }
  parsed.artifacts = { ...DEFAULT_ARTIFACTS, ...(parsed.artifacts ?? {}) };
  parsed.resetMode = parsed.resetMode === 'CLEAR_DATA' ? 'CLEAR_DATA' : 'RESTART';
  cachedContext = parsed;
  return parsed;
}

export function artifactDir(key: keyof RunContext['artifacts']): string {
  const dir = loadRunContext().artifacts[key];
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

export function assignedDevice(): RunContextDevice {
  const ctx = loadRunContext();
  const index = workerIndex();
  const device = ctx.devices[index];
  if (!device) {
    throw new Error(
      `DEVICE_NOT_READY: no device reserved for worker ${index} (reserved devices: ${ctx.devices.length}). ` +
        'Reduce --parallel to the number of reserved devices.',
    );
  }
  return device;
}

export function deviceInfo(): DeviceInfo {
  const d = assignedDevice();
  return { index: d.index, udid: d.udid, name: d.name, platformVersion: d.platformVersion };
}

function appendSessionRecord(udid: string, sessionId: string): void {
  try {
    const file = artifactDir('sessionsFile');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(
      file,
      JSON.stringify({ workerId: workerIndex(), udid, sessionId, createdAt: new Date().toISOString() }) + '\n',
      'utf8',
    );
  } catch (e) {
    console.warn(`⚠️ Could not record Appium session id: ${e}`);
  }
}

async function isAlive(d: Browser): Promise<boolean> {
  try {
    await d.getWindowSize();
    return true;
  } catch {
    return false;
  }
}

async function createSession(): Promise<Browser> {
  const ctx = loadRunContext();
  const device = assignedDevice();
  const url = new URL(ctx.appiumUrl);
  const protocol = url.protocol.replace(':', '') === 'https' ? 'https' : 'http';
  try {
    const session = await remote({
      protocol,
      hostname: url.hostname,
      port: url.port ? Number(url.port) : protocol === 'https' ? 443 : 80,
      path: url.pathname && url.pathname !== '' ? url.pathname : '/',
      logLevel: 'warn',
      connectionRetryCount: 1,
      connectionRetryTimeout: 180_000,
      capabilities: device.capabilities as WebdriverIO.Capabilities,
    });
    appendSessionRecord(device.udid, session.sessionId);
    return session;
  } catch (e) {
    const message = e instanceof Error ? e.message.split('\n')[0] : String(e);
    throw new Error(
      `DEVICE_NOT_READY: could not start Appium session on ${device.udid} (${device.name}) via ${ctx.appiumUrl}: ${message}`,
    );
  }
}

/**
 * Returns the worker's Appium session, creating it lazily and recreating it if it died.
 * A dead session after the first successful start is reported as DEVICE_LOST when it cannot be recreated.
 */
export async function getDriver(): Promise<Browser> {
  if (driver && (await isAlive(driver))) {
    return driver;
  }
  const hadSession = sessionCreatedOnce;
  driver = undefined;
  try {
    driver = await createSession();
    sessionCreatedOnce = true;
    return driver;
  } catch (e) {
    if (hadSession) {
      const message = e instanceof Error ? e.message.replace(/^DEVICE_NOT_READY:\s*/, '') : String(e);
      throw new Error(`DEVICE_LOST: ${message}`);
    }
    throw e;
  }
}

export function currentDriver(): Browser | undefined {
  return driver;
}

export async function sessionAlive(): Promise<boolean> {
  return driver ? isAlive(driver) : false;
}

/** Per-scenario app state: terminate → (CLEAR_DATA: clear app data) → activate. */
export async function prepareApp(d: Browser): Promise<void> {
  const ctx = loadRunContext();
  const pkg = ctx.app.package;
  try {
    await d.terminateApp(pkg);
  } catch {
    // app was not running
  }
  if (ctx.resetMode === 'CLEAR_DATA') {
    await d.execute('mobile: clearApp', { appId: pkg });
  }
  await d.activateApp(pkg);
}

export async function closeSession(): Promise<void> {
  if (!driver) {
    return;
  }
  try {
    await driver.deleteSession();
  } catch (e) {
    console.warn(`⚠️ Appium session close failed: ${e}`);
  } finally {
    driver = undefined;
  }
}
