import { When } from '@cucumber/cucumber';
import * as path from 'path';
import type { ICustomWorld } from './world';
import { testData } from './testData';

async function pullDeviceFile(world: ICustomWorld, devicePath: string): Promise<Buffer> {
  if (!world.driver) {
    throw new Error('Appium session is not available');
  }
  const base64 = await world.driver.pullFile(devicePath);
  return Buffer.from(base64, 'base64');
}

When(
  'I save the device file {string} as {string} in Data Center',
  async function (this: ICustomWorld, devicePath: string, bindingKey: string) {
    const content = await pullDeviceFile(this, devicePath);
    const result = await testData.saveFile(bindingKey, content, path.posix.basename(devicePath));
    this.scenarioVars[bindingKey] = result.resourceRef;
  },
);

When(
  'I save the device file {string} as {string} for the test flow',
  async function (this: ICustomWorld, devicePath: string, bindingKey: string) {
    const content = await pullDeviceFile(this, devicePath);
    const result = await testData.saveFile(bindingKey, content, path.posix.basename(devicePath));
    this.scenarioVars[bindingKey] = result.resourceRef;
  },
);
