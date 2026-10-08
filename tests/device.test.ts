import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  artifactDir,
  assignedDevice,
  loadRunContext,
  resetDeviceModuleStateForTests,
  workerIndex,
} from '../support/device';

describe('mobile device run context (infra vs application config)', () => {
  let tmpDir: string;
  let contextPath: string;
  const savedContextEnv = process.env.COTESTER_MOBILE_RUN_CONTEXT;
  const savedWorker = process.env.CUCUMBER_WORKER_ID;

  beforeEach(() => {
    resetDeviceModuleStateForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-device-test-'));
    contextPath = path.join(tmpDir, 'run-context.json');
  });

  afterEach(() => {
    resetDeviceModuleStateForTests();
    if (savedContextEnv === undefined) delete process.env.COTESTER_MOBILE_RUN_CONTEXT;
    else process.env.COTESTER_MOBILE_RUN_CONTEXT = savedContextEnv;
    if (savedWorker === undefined) delete process.env.CUCUMBER_WORKER_ID;
    else process.env.CUCUMBER_WORKER_ID = savedWorker;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeContext(extra?: Partial<{ appiumUrl: string }>): void {
    const ctx = {
      jobId: 'job-unit-test',
      appiumUrl: extra?.appiumUrl ?? 'http://127.0.0.1:4723/wd/hub',
      app: {
        package: 'com.example.app',
        activity: 'com.example.app.MainActivity',
      },
      resetMode: 'RESTART',
      devices: [
        {
          index: 0,
          udid: 'emulator-5554',
          name: 'Pixel_6',
          platformVersion: '14',
          capabilities: {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:appPackage': 'com.example.app',
            'appium:appActivity': 'com.example.app.MainActivity',
          },
        },
        {
          index: 1,
          udid: 'emulator-5556',
          name: 'Pixel_7',
          platformVersion: '14',
          capabilities: {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:appPackage': 'com.example.app',
            'appium:appActivity': 'com.example.app.MainActivity',
          },
        },
      ],
      artifacts: {
        screenshotsDir: path.join(tmpDir, 'screenshots'),
        sessionsFile: path.join(tmpDir, 'sessions.jsonl'),
      },
    };
    fs.writeFileSync(contextPath, JSON.stringify(ctx));
    process.env.COTESTER_MOBILE_RUN_CONTEXT = contextPath;
  }

  it('loads Appium URL and Android package/activity from run context (not env credentials)', () => {
    writeContext({ appiumUrl: 'http://appium.local:4723/custom/path' });
    const ctx = loadRunContext();
    assert.equal(ctx.appiumUrl, 'http://appium.local:4723/custom/path');
    assert.equal(ctx.app.package, 'com.example.app');
    assert.equal(ctx.app.activity, 'com.example.app.MainActivity');
    const caps = ctx.devices[0]!.capabilities as Record<string, string>;
    assert.equal(caps['appium:appPackage'], 'com.example.app');
    assert.equal(caps['appium:appActivity'], 'com.example.app.MainActivity');
  });

  it('reserves devices per Cucumber worker index', () => {
    writeContext();
    process.env.CUCUMBER_WORKER_ID = '0';
    assert.equal(workerIndex(), 0);
    assert.equal(assignedDevice().udid, 'emulator-5554');

    resetDeviceModuleStateForTests();
    writeContext();
    process.env.CUCUMBER_WORKER_ID = '1';
    assert.equal(assignedDevice().udid, 'emulator-5556');
  });

  it('uses job-scoped artifact directories from run context', () => {
    writeContext();
    const screenshots = artifactDir('screenshotsDir');
    assert.ok(path.isAbsolute(screenshots));
    assert.ok(screenshots.includes(tmpDir));
  });

  it('fails when worker index exceeds reserved devices', () => {
    writeContext();
    process.env.CUCUMBER_WORKER_ID = '9';
    assert.throws(() => assignedDevice(), /no device reserved for worker 9/);
  });
});
