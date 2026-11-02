import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExecutionUnitKey,
  buildScenarioKey,
} from '../support/step-event';

describe('MOBILE step-event identity', () => {
  it('parity: rowIndex separates execution units', () => {
    const scen = buildScenarioKey({
      featurePath: 'mobile.feature',
      scenarioName: 'Tap',
      pickleId: 'pm',
      rowIndex: 0,
    });
    const u0 = buildExecutionUnitKey({
      featurePath: 'mobile.feature',
      scenarioKey: scen,
      attempt: 1,
      rowIndex: 0,
    });
    const u1 = buildExecutionUnitKey({
      featurePath: 'mobile.feature',
      scenarioKey: scen,
      attempt: 1,
      rowIndex: 1,
    });
    assert.notEqual(u0, u1);
  });
});
