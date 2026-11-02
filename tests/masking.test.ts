import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maskDeviceLog } from '../support/logMasking';

describe('mobile secret masking in device logs', () => {
  it('redacts password and bearer tokens from logcat text', () => {
    const raw =
      'E/Auth: password=super-secret-123 token=abc123 bearer eyJhbGciOiJIUzI1NiJ9.payload.sig';
    const masked = maskDeviceLog(raw);
    assert.ok(!masked.includes('super-secret-123'));
    assert.ok(!masked.includes('abc123'));
    assert.match(masked, /password=\*\*\*/i);
    assert.match(masked, /bearer\s+\*\*\*/i);
  });
});
