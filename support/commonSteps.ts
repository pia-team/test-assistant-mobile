import { Given, When } from '@cucumber/cucumber';
import type { ICustomWorld } from './world';
import { back, hideKeyboard, requireDriver } from './mobile-actions';

/**
 * Device-agnostic steps shared by every mobile feature.
 *
 * Feature-specific steps (with the `for {NAME}` suffix) live in
 * features/steps/{PROJECT}/{GROUP}/{NAME}StepDef/ and must not repeat these patterns.
 */

Given('the app is in the foreground', async function (this: ICustomWorld) {
  const driver = requireDriver(this.driver);
  const pkg = await driver.getCurrentPackage();
  if (!pkg) {
    throw new Error('No foreground app package reported by the device');
  }
});

When('I press the device back button', async function (this: ICustomWorld) {
  await back(requireDriver(this.driver));
});

When('I hide the keyboard', async function (this: ICustomWorld) {
  await hideKeyboard(requireDriver(this.driver));
});

When('I wait {int} seconds', async function (this: ICustomWorld, seconds: number) {
  if (seconds < 0 || seconds > 60) {
    throw new Error(`Explicit wait must be between 0 and 60 seconds (got ${seconds})`);
  }
  await requireDriver(this.driver).pause(seconds * 1000);
});
