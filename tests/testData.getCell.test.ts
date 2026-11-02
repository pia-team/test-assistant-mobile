import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { testData, resetTestDataCache } from '../support/testData';

describe('mobile testData.getCell (DATA-3)', { concurrency: 1 }, () => {
  const envBackup = { ...process.env };
  let workDir: string;

  beforeEach(() => {
    delete process.env.COTESTER_DATASET_ROW_INDEX;
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotester-mobile-cell-'));
    const dataset = path.join(workDir, 'users.dataset.json');
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
            rowCount: 2,
            rows: [
              { username: 'user01', searchTerm: 'Samsung' },
              { username: 'user02', searchTerm: 'Apple' },
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
        runId: 'run-mobile-cell',
        resources: {
          users: {
            type: 'DATASET',
            bindingKey: 'users',
            localPath: `${workDir}/users.csv`,
            datasetPath: dataset,
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

  it('reads first and indexed cells fail-closed', async () => {
    assert.equal(await testData.getCell('users', 'username'), 'user01');
    assert.equal(await testData.getCell('users', 'searchTerm', { rowIndex: 1 }), 'Apple');
    await assert.rejects(() => testData.getCell('users', 'missing'), /no column/);
    await assert.rejects(() => testData.getCell('users', 'username', { rowIndex: 9 }), /no row/);
  });

  it('DATA-3 COTESTER_DATASET_ROW_INDEX overrides authoring rowIndex', async () => {
    process.env.COTESTER_DATASET_ROW_INDEX = '1';
    resetTestDataCache();
    assert.equal(await testData.getCell('users', 'username'), 'user02');
    assert.equal(await testData.getCell('users', 'searchTerm', { rowIndex: 0 }), 'Apple');
    delete process.env.COTESTER_DATASET_ROW_INDEX;
    resetTestDataCache();
    assert.equal(await testData.getCell('users', 'username', { rowIndex: 0 }), 'user01');
  });

  it('rejects invalid COTESTER_DATASET_ROW_INDEX', async () => {
    process.env.COTESTER_DATASET_ROW_INDEX = '-1';
    resetTestDataCache();
    await assert.rejects(() => testData.getCell('users', 'username'), /non-negative/);
  });
});
