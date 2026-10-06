import { setWorldConstructor, setDefaultTimeout, World, IWorldOptions } from '@cucumber/cucumber';
import type { Browser } from 'webdriverio';

function parsePositiveInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

setDefaultTimeout(parsePositiveInt('COTESTER_STEP_TIMEOUT_MS', 120 * 1000));

export interface DeviceInfo {
  index: number;
  udid: string;
  name: string;
  platformVersion: string;
}

/**
 * Custom fields merged onto Cucumber's {@link World}.
 * Step definitions use `this: ICustomWorld` and create screen objects with `new XPage(this.driver!)`.
 */
type CustomWorldState = {
  /** Appium session for this worker (owned by support/hooks.ts, never created by generated code). */
  driver?: Browser;
  /** Device assigned to this worker from the run context. */
  device?: DeviceInfo;
  /** Set in Before hook from the running feature path; used in step logging. */
  currentFeatureName?: string;
  /** Set in Before hook from features/{project}/… path; drives per-project env config. */
  scenarioProjectKey?: string;
  /** Per-scenario key/value data between steps (reset in Before). */
  scenarioVars: Record<string, string>;
  /** True while a screen recording is running for the current scenario. */
  recording?: boolean;
};

export type ICustomWorld = World & CustomWorldState;

export class CustomWorld extends World implements ICustomWorld {
  driver?: Browser;
  device?: DeviceInfo;
  currentFeatureName?: string;
  scenarioProjectKey?: string;
  scenarioVars: Record<string, string> = {};
  recording?: boolean;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(CustomWorld);
