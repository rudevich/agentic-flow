import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interactive } from '../prompt.js';

describe('interactive', () => {
  // Everything downstream hangs on this: no TTY means ask nobody anything.
  it('is false when stdin is not a terminal, as under a test runner or CI', () => {
    assert.equal(interactive(), Boolean(process.stdin.isTTY && process.stdout.isTTY));
    assert.equal(typeof interactive(), 'boolean');
  });
});
