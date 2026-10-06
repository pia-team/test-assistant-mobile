import { runtimeData } from './runtimeData';

/**
 * Unique identifier values for form fields (personal number, account id, …).
 * Not for names, emails, or addresses.
 *
 * Pattern tokens (javafaker bothify-compatible):
 * - `#` → digit (prefers trailing digits of Date.now(), then random)
 * - `?` → uppercase letter A–Z
 * Other characters are kept as-is.
 *
 * Compatibility wrapper around `runtimeData.pattern`; new code should call that directly.
 */
export function uniqueFromPattern(pattern: string): string {
  if (!pattern) {
    throw new Error('uniqueFromPattern requires a non-empty pattern');
  }
  return runtimeData.pattern(pattern, { clockDigits: true });
}
