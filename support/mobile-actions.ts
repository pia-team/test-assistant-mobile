import type { Browser } from 'webdriverio';

/**
 * Element interactions used by generated screen objects.
 * Selectors are WebdriverIO strings: `~accessibilityId`, `android=new UiSelector()…`, or XPath (`//…`).
 */

const DEFAULT_ACTION_TIMEOUT_MS = 15_000;

export function actionTimeoutMs(): number {
  const raw = process.env.COTESTER_ACTION_TIMEOUT_MS;
  if (raw == null || raw.trim() === '') {
    return DEFAULT_ACTION_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ACTION_TIMEOUT_MS;
}

export function requireDriver(driver: Browser | undefined): Browser {
  if (!driver) {
    throw new Error('DEVICE_NOT_READY: Appium session is not available for this scenario');
  }
  return driver;
}

function describeError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return message.split('\n')[0];
}

async function visibleElement(driver: Browser, selector: string, timeout = actionTimeoutMs()) {
  const element = driver.$(selector);
  try {
    await element.waitForDisplayed({ timeout });
  } catch (e) {
    throw new Error(`Element not visible within ${timeout} ms: ${selector} (${describeError(e)})`);
  }
  return element;
}

export async function waitVisible(driver: Browser, selector: string, timeout = actionTimeoutMs()): Promise<void> {
  await visibleElement(driver, selector, timeout);
}

export async function tap(driver: Browser, selector: string): Promise<void> {
  const element = await visibleElement(driver, selector);
  try {
    await element.click();
  } catch (e) {
    throw new Error(`Tap failed on ${selector}: ${describeError(e)}`);
  }
}

export async function typeText(driver: Browser, selector: string, value: string): Promise<void> {
  const element = await visibleElement(driver, selector);
  try {
    await element.clearValue();
    await element.setValue(value);
  } catch (e) {
    throw new Error(`Typing into ${selector} failed: ${describeError(e)}`);
  }
}

export async function clear(driver: Browser, selector: string): Promise<void> {
  const element = await visibleElement(driver, selector);
  try {
    await element.clearValue();
  } catch (e) {
    throw new Error(`Clearing ${selector} failed: ${describeError(e)}`);
  }
}

export async function getText(driver: Browser, selector: string): Promise<string> {
  const element = await visibleElement(driver, selector);
  return (await element.getText()) ?? '';
}

/** Waits until the element text contains `expected` (case-sensitive). */
export async function expectText(driver: Browser, selector: string, expected: string): Promise<void> {
  const timeout = actionTimeoutMs();
  const element = await visibleElement(driver, selector, timeout);
  let last = '';
  try {
    await driver.waitUntil(
      async () => {
        last = (await element.getText()) ?? '';
        return last.includes(expected);
      },
      { timeout, interval: 300 },
    );
  } catch {
    throw new Error(`Expected text "${expected}" in ${selector} but found "${last}"`);
  }
}

const UI_SELECTOR_PREFIX = 'android=';

/**
 * Scrolls the first scrollable container until the element is visible.
 * UiSelector selectors use UiScrollable; other selectors fall back to repeated swipes.
 */
export async function scrollTo(driver: Browser, selector: string, maxSwipes = 8): Promise<void> {
  if (selector.startsWith(UI_SELECTOR_PREFIX) && selector.includes('UiSelector()')) {
    const target = selector.substring(UI_SELECTOR_PREFIX.length);
    const scrollable =
      `${UI_SELECTOR_PREFIX}new UiScrollable(new UiSelector().scrollable(true))` + `.scrollIntoView(${target})`;
    try {
      await driver.$(scrollable).waitForExist({ timeout: actionTimeoutMs() });
      return;
    } catch {
      // fall through to swipe-based scrolling
    }
  }
  const { width, height } = await driver.getWindowSize();
  for (let i = 0; i <= maxSwipes; i++) {
    if (await driver.$(selector).isDisplayed().catch(() => false)) {
      return;
    }
    await swipe(
      driver,
      { x: Math.round(width / 2), y: Math.round(height * 0.75) },
      { x: Math.round(width / 2), y: Math.round(height * 0.3) },
    );
  }
  throw new Error(`Element not found after scrolling ${maxSwipes} times: ${selector}`);
}

export async function back(driver: Browser): Promise<void> {
  await driver.back();
}

export async function hideKeyboard(driver: Browser): Promise<void> {
  try {
    if (await driver.isKeyboardShown()) {
      await driver.hideKeyboard();
    }
  } catch {
    // keyboard already hidden or not supported on this screen
  }
}

/** Coordinate tap — fragile across screen sizes; prefer element selectors. */
export async function tapAt(driver: Browser, x: number, y: number): Promise<void> {
  await driver
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(x), y: Math.round(y) })
    .down()
    .pause(80)
    .up()
    .perform();
}

export async function swipe(
  driver: Browser,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs = 400,
): Promise<void> {
  await driver
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(from.x), y: Math.round(from.y) })
    .down()
    .pause(100)
    .move({ x: Math.round(to.x), y: Math.round(to.y), duration: durationMs })
    .up()
    .perform();
}
