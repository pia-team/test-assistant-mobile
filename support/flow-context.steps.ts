import { Given, Then } from '@cucumber/cucumber';
import type { ICustomWorld } from './world';
import * as fs from 'fs/promises';
import * as path from 'path';

async function readFlowContext(): Promise<Record<string, string>> {
  const contextPath = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (!contextPath) {
    throw new Error(
      'Flow context path is not set (COTESTER_FLOW_CONTEXT_PATH). Store/read steps require a Test Flow run.',
    );
  }
  try {
    const raw = await fs.readFile(contextPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

async function writeFlowContext(data: Record<string, string>): Promise<void> {
  const contextPath = process.env.COTESTER_FLOW_CONTEXT_PATH;
  if (!contextPath) {
    throw new Error(
      'Flow context path is not set (COTESTER_FLOW_CONTEXT_PATH). Store/read steps require a Test Flow run.',
    );
  }
  await fs.mkdir(path.dirname(contextPath), { recursive: true });
  const tmp = contextPath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, contextPath);
}

Given('I store {string} as {string} in flow context', async function (this: ICustomWorld, value: string, key: string) {
  const ctx = await readFlowContext();
  ctx[key] = value;
  await writeFlowContext(ctx);
  this.scenarioVars[key] = value;
});

Given(
  'I store variable {string} as {string} in flow context',
  async function (this: ICustomWorld, varName: string, key: string) {
    const value = this.scenarioVars[varName];
    if (value === undefined || value === null) {
      throw new Error(`Scenario variable "${varName}" is not set`);
    }
    const ctx = await readFlowContext();
    ctx[key] = String(value);
    await writeFlowContext(ctx);
    this.scenarioVars[key] = String(value);
  },
);

Given(
  'I read {string} from flow context into {string}',
  async function (this: ICustomWorld, key: string, varName: string) {
    const ctx = await readFlowContext();
    if (!(key in ctx)) {
      throw new Error(`Flow context does not contain key "${key}"`);
    }
    this.scenarioVars[varName] = String(ctx[key]);
  },
);

Then('flow context contains {string}', async function (key: string) {
  const ctx = await readFlowContext();
  if (!(key in ctx)) {
    throw new Error(`Flow context does not contain key "${key}"`);
  }
});
