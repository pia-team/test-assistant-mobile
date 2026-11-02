import { Given, When } from '@cucumber/cucumber';
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

async function loadDatasetCell(
  world: ICustomWorld,
  varName: string,
  bindingKey: string,
  column: string,
  rowIndex: number,
  sheet?: string,
) {
  const value = await testData.getCell(bindingKey, column, {
    rowIndex,
    sheet: sheet || undefined,
  });
  world.scenarioVars[varName] = value;
}

Given(
  'the scenario variable {string} is loaded from Data Center dataset {string} column {string} as first row',
  async function (this: ICustomWorld, varName: string, bindingKey: string, column: string) {
    // getCell honors COTESTER_DATASET_ROW_INDEX when set (DATA-3 iteration).
    await loadDatasetCell(this, varName, bindingKey, column, 0);
  },
);

Given(
  'the scenario variable {string} is loaded from Data Center dataset {string} column {string} as row {int}',
  async function (
    this: ICustomWorld,
    varName: string,
    bindingKey: string,
    column: string,
    rowNumber: number,
  ) {
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      throw new Error(`Dataset row number must be a positive integer (got ${rowNumber})`);
    }
    await loadDatasetCell(this, varName, bindingKey, column, rowNumber - 1);
  },
);

Given(
  'the scenario variable {string} is loaded from Data Center dataset {string} column {string} sheet {string} as first row',
  async function (
    this: ICustomWorld,
    varName: string,
    bindingKey: string,
    column: string,
    sheet: string,
  ) {
    await loadDatasetCell(this, varName, bindingKey, column, 0, sheet);
  },
);

Given(
  'the scenario variable {string} is loaded from Data Center dataset {string} column {string} sheet {string} as row {int}',
  async function (
    this: ICustomWorld,
    varName: string,
    bindingKey: string,
    column: string,
    sheet: string,
    rowNumber: number,
  ) {
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      throw new Error(`Dataset row number must be a positive integer (got ${rowNumber})`);
    }
    await loadDatasetCell(this, varName, bindingKey, column, rowNumber - 1, sheet);
  },
);

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
