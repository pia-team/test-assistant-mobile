import { After, AfterAll, AfterStep, Before, BeforeStep, Status } from '@cucumber/cucumber';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Browser } from 'webdriverio';
import type { CustomWorld, ICustomWorld } from './world';
import {
  extractProjectKeyFromFeatureUri,
  resetEnvConfigLogCache,
  setScenarioCredentialProfile,
  setScenarioProjectKey,
} from './env';
import { closeSession, deviceInfo, getDriver, loadRunContext, prepareApp, sessionAlive } from './device';
import { resetTestDataCache } from './testData';

const LOGCAT_LINES = 500;

/** Tracks cucumber-js scenario attempts (initial run + retries) per pickle id. */
const attemptByPickleId = new Map<string, number>();

type ScreenshotMode = 'ALL_STEPS' | 'FAIL_ONLY' | 'FAIL_AND_LAST_PASS' | 'NONE';

function getScreenshotMode(): ScreenshotMode {
  const raw = (process.env.SCREENSHOT_MODE ?? process.env.screenshot ?? 'FAIL_ONLY').toUpperCase();
  if (raw === 'ON') return 'ALL_STEPS';
  if (raw === 'OFF') return 'NONE';
  if (raw === 'ALL_STEPS' || raw === 'FAIL_ONLY' || raw === 'FAIL_AND_LAST_PASS' || raw === 'NONE') {
    return raw;
  }
  return 'FAIL_ONLY';
}

function shouldTakeStepScreenshot(mode: ScreenshotMode, status: string, isLastStep: boolean): boolean {
  switch (mode) {
    case 'ALL_STEPS':
      return true;
    case 'FAIL_ONLY':
      return status !== 'PASSED';
    case 'FAIL_AND_LAST_PASS':
      return status !== 'PASSED' || isLastStep;
    default:
      return false;
  }
}

function isVideoRecordingEnabled(): boolean {
  const raw = (process.env.VIDEO_RECORDING ?? process.env.video ?? 'off').toLowerCase();
  return raw === 'on' || raw === 'true' || raw === '1';
}

function featureNameFromUri(featureUri: string): string {
  if (!featureUri) {
    return '';
  }
  const normalized = featureUri.replace(/\\/g, '/');
  return normalized.substring(normalized.lastIndexOf('/') + 1).replace('.feature', '');
}

function pickleKey(pickle: { id?: string; uri?: string } | undefined): string {
  return pickle?.id ?? pickle?.uri ?? 'unknown';
}

/** Relative artifact path (forward slashes) as printed to stdout, plus the absolute path to write. */
function artifactPath(dirKey: 'screenshotsDir' | 'videosDir' | 'deviceLogsDir' | 'pageSourceDir', ext: string) {
  const dir = loadRunContext().artifacts[dirKey];
  const fileName = `${randomUUID()}.${ext}`;
  const display = path.isAbsolute(dir) ? path.join(dir, fileName) : `${dir.replace(/\\/g, '/')}/${fileName}`;
  const absolute = path.isAbsolute(dir) ? path.join(dir, fileName) : path.resolve(process.cwd(), dir, fileName);
  return { display, absolute };
}

async function writeArtifact(absolute: string, content: Buffer | string): Promise<void> {
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content);
}

const SECRET_PATTERNS: RegExp[] = [
  /((?:password|passwd|pwd|token|secret|cookie|authorization)["']?\s*[:=]\s*["']?)[^\s"',;&]+/gi,
  /(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
  /((?:set-)?cookie:\s*)[^\r\n]+/gi,
];

export function maskDeviceLog(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '$1***'), text);
}

function readLogcatViaAdb(udid: string): Promise<string> {
  const adb = process.env.ADB_PATH || 'adb';
  return new Promise((resolve, reject) => {
    execFile(
      adb,
      ['-s', udid, 'logcat', '-d', '-t', String(LOGCAT_LINES)],
      { timeout: 15_000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });
}

async function readLogcat(driver: Browser | undefined, udid: string): Promise<string> {
  try {
    return await readLogcatViaAdb(udid);
  } catch {
    if (!driver) {
      return '';
    }
    const entries = (await driver.getLogs('logcat')) as Array<{ message?: string }>;
    return entries
      .slice(-LOGCAT_LINES)
      .map((e) => e.message ?? '')
      .join('\n');
  }
}

async function captureScreenshot(world: ICustomWorld, featureName: string): Promise<void> {
  if (!world.driver) return;
  const base64 = await world.driver.takeScreenshot();
  const buffer = Buffer.from(base64, 'base64');
  const { display, absolute } = artifactPath('screenshotsDir', 'png');
  await writeArtifact(absolute, buffer);
  console.log(`📸 Screenshot [${featureName}]: ${display}`);
  await world.attach(buffer, 'image/png');
}

Before(async function (this: CustomWorld, scenario) {
  this.scenarioVars = {};
  resetTestDataCache();

  const flowContextPath = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (flowContextPath) {
    try {
      const parsed = JSON.parse((await fs.readFile(flowContextPath, 'utf8')) || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.scenarioVars = { ...(parsed as Record<string, string>) };
      }
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn('Failed to load flow context:', e);
      }
    }
  }

  const pickleUri = scenario.pickle?.uri || '';
  const originalFeature = process.env.COTESTER_FLOW_ORIGINAL_FEATURE || '';
  const featureUri = originalFeature || pickleUri;
  const projectKey = extractProjectKeyFromFeatureUri(pickleUri) || extractProjectKeyFromFeatureUri(originalFeature);
  this.scenarioProjectKey = projectKey;
  setScenarioProjectKey(projectKey);
  resetEnvConfigLogCache();

  const credentialTag = scenario.pickle?.tags?.find((tag) =>
    tag.name.replace(/^@/, '').toLowerCase().startsWith('credential:'),
  );
  if (credentialTag) {
    const slug = credentialTag.name.split(':').slice(1).join(':').trim();
    if (slug) {
      setScenarioCredentialProfile(slug);
    }
  }

  const featureName = featureNameFromUri(featureUri);
  const pickleId = pickleKey(scenario.pickle);
  const attempt = (attemptByPickleId.get(pickleId) ?? 0) + 1;
  attemptByPickleId.set(pickleId, attempt);
  this.currentFeatureName = featureName;

  if (featureName) {
    if (attempt > 1) {
      console.log(`⟳ RETRY ATTEMPT ${attempt}: ${featureName}`);
    }
    console.log(`🎯 FEATURE START: ${featureName}`);
    console.log(`📁 Feature File: ${featureUri}`);
    if (projectKey) {
      console.log(`🏷️ Project env: ${projectKey} (TEST_ENV=${process.env.TEST_ENV || 'dev'})`);
    }
  }

  const info = deviceInfo();
  this.device = info;
  console.log(`📱 Device [${featureName || 'unknown'}]: ${info.udid} ${info.name} Android ${info.platformVersion}`);

  this.driver = await getDriver();
  await prepareApp(this.driver);

  if (isVideoRecordingEnabled()) {
    try {
      await this.driver.startRecordingScreen({ timeLimit: 1800 });
      this.recording = true;
    } catch (e) {
      console.warn(`⚠️ Screen recording could not start: ${e}`);
    }
  }
});

BeforeStep(function (this: ICustomWorld, { pickleStep }) {
  const featureName = this.currentFeatureName || 'unknown';
  console.error(`➡ STEP START [${featureName}]: ${pickleStep.text}`);
});

AfterStep(async function (this: ICustomWorld, { result, pickleStep, pickle }) {
  const featureName = this.currentFeatureName || 'unknown';
  const status = result.status;

  if (status === 'PASSED') {
    console.error(`✓ STEP PASS [${featureName}]: ${pickleStep.text}`);
  } else {
    console.error(`✗ STEP FAIL [${featureName}]: ${pickleStep.text}`);
    if (status === 'FAILED' && this.driver && !(await sessionAlive())) {
      console.error(`DEVICE_LOST: Appium session on ${this.device?.udid ?? 'device'} is no longer available`);
      this.driver = undefined;
    }
  }

  const steps = pickle?.steps ?? [];
  const isLastStep = steps.length > 0 && steps[steps.length - 1]?.id === pickleStep.id;
  if (!shouldTakeStepScreenshot(getScreenshotMode(), status, isLastStep)) {
    return;
  }
  try {
    await captureScreenshot(this, featureName);
  } catch (e) {
    console.warn(`⚠️ Step screenshot failed: ${e}`);
  }
});

After(async function (this: ICustomWorld, scenario) {
  const status = scenario.result?.status;
  const featureName = this.currentFeatureName || 'unknown';
  const failed = status === Status.FAILED;

  if (scenario.willBeRetried) {
    const nextAttempt = (attemptByPickleId.get(pickleKey(scenario.pickle)) ?? 1) + 1;
    console.log(`⟳ RETRY SCHEDULED: ${featureName} yeniden denenecek (attempt ${nextAttempt})`);
  } else {
    attemptByPickleId.delete(pickleKey(scenario.pickle));
  }

  setScenarioProjectKey(undefined);
  setScenarioCredentialProfile(undefined);
  this.scenarioProjectKey = undefined;

  const driver = this.driver;

  if (failed && driver) {
    if (getScreenshotMode() !== 'NONE') {
      try {
        const buffer = Buffer.from(await driver.takeScreenshot(), 'base64');
        await this.attach(buffer, 'image/png');
      } catch (e) {
        console.warn(`⚠️ Final screenshot failed: ${e}`);
      }
    }
    try {
      const xml = await driver.getPageSource();
      const { absolute } = artifactPath('pageSourceDir', 'xml');
      await writeArtifact(absolute, xml);
      await this.attach(xml, 'application/xml');
    } catch (e) {
      console.warn(`⚠️ Page source capture failed: ${e}`);
    }
  }

  if (failed && this.device) {
    try {
      const logcat = maskDeviceLog(await readLogcat(driver, this.device.udid));
      if (logcat) {
        const { absolute } = artifactPath('deviceLogsDir', 'txt');
        await writeArtifact(absolute, logcat);
        await this.attach(logcat, 'text/plain');
      }
    } catch (e) {
      console.warn(`⚠️ Device log capture failed: ${e}`);
    }
  }

  if (this.recording && driver) {
    this.recording = false;
    try {
      const base64 = await driver.stopRecordingScreen();
      if (failed && base64) {
        const buffer = Buffer.from(base64, 'base64');
        const { display, absolute } = artifactPath('videosDir', 'mp4');
        await writeArtifact(absolute, buffer);
        console.log(`🎥 Video kaydedildi [${featureName}]: ${display}`);
        await this.attach(buffer, 'video/mp4');
      }
    } catch (e) {
      console.warn(`⚠️ Screen recording could not be saved: ${e}`);
    }
  }
});

AfterAll(async function () {
  await closeSession();
});
