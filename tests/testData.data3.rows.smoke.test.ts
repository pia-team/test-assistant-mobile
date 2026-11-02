/**
 * Runner-layer DATA-3 smoke: 3-row ALL iteration without Appium.
 * Does NOT prove backend TestRunService / device prep — only getCell + env contract.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { testData, resetTestDataCache } from '../support/testData';

describe('mobile DATA-3 three-row runner smoke (no Appium)', { concurrency: 1 }, () => {
  const envBackup = { ...process.env };
  let workDir: string;

  beforeEach(() => {
    delete process.env.COTESTER_DATASET_ROW_INDEX;
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotester-mobile-data3-'));
    const dataset = path.join(workDir, 'products.dataset.json');
    fs.writeFileSync(
      dataset,
      JSON.stringify({
        format: 'cotester.dataset/v1',
        sourceFormat: 'CSV',
        defaultSheet: 'default',
        sheets: [
          {
            name: 'default',
            hidden: false,
            headerRow: true,
            columns: ['username', 'searchTerm'],
            rowCount: 3,
            rows: [
              { username: 'user01', searchTerm: 'Samsung' },
              { username: 'user02', searchTerm: 'Apple' },
              { username: 'user03', searchTerm: 'Pixel' },
            ],
          },
        ],
      }),
      'utf8',
    );
    const manifest = path.join(workDir, 'manifest.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify({
        runId: 'smoke-data3',
        resources: {
          products: {
            type: 'DATASET',
            bindingKey: 'products',
            localPath: `${workDir}/products.csv`,
            datasetPath: dataset,
            versionId: 'pin-version-smoke',
            versionNumber: 7,
          },
        },
        configs: {},
      }),
      'utf8',
    );
    process.env.COTESTER_RUN_DATA_MANIFEST_PATH = manifest;
    resetTestDataCache();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envBackup)) delete process.env[key];
    }
    Object.assign(process.env, envBackup);
    delete process.env.COTESTER_DATASET_ROW_INDEX;
    resetTestDataCache();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('resolves distinct cells for indices 0,1,2 like backend ALL plan', async () => {
    const expected = [
      { username: 'user01', searchTerm: 'Samsung' },
      { username: 'user02', searchTerm: 'Apple' },
      { username: 'user03', searchTerm: 'Pixel' },
    ];
    for (let i = 0; i < 3; i++) {
      process.env.COTESTER_DATASET_ROW_INDEX = String(i);
      resetTestDataCache();
      assert.equal(await testData.getCell('products', 'username'), expected[i].username);
      assert.equal(await testData.getCell('products', 'searchTerm'), expected[i].searchTerm);
    }
  });

  it('fail-closed when ROW_INDEX out of range for 3-row dataset', async () => {
    process.env.COTESTER_DATASET_ROW_INDEX = '3';
    resetTestDataCache();
    await assert.rejects(() => testData.getCell('products', 'username'), /no row at index 3/);
  });
});
