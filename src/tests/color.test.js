import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { colorEnabled, green } from '../color.js';

/** Runs `fn` with the environment the test needs, then puts it back. */
function withEnv(vars, fn) {
  const before = {};
  for (const [key, value] of Object.entries(vars)) {
    before[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const PLAIN = { FORCE_COLOR: undefined, NO_COLOR: undefined, TERM: undefined };

describe('colorEnabled', () => {
  it('is off when the output is not a terminal', () => {
    // node --test gives us no TTY, which is exactly the piped case.
    withEnv(PLAIN, () => assert.equal(colorEnabled(), false));
  });

  it('is off when NO_COLOR is set, whatever else says', () => {
    withEnv({ ...PLAIN, NO_COLOR: '1' }, () => assert.equal(colorEnabled(), false));
  });

  it('is off on a dumb terminal', () => {
    withEnv({ ...PLAIN, TERM: 'dumb' }, () => assert.equal(colorEnabled(), false));
  });

  it('is on when FORCE_COLOR asks for it', () => {
    withEnv({ ...PLAIN, FORCE_COLOR: '1' }, () => assert.equal(colorEnabled(), true));
  });

  it('treats FORCE_COLOR=0 as not asking', () => {
    withEnv({ ...PLAIN, FORCE_COLOR: '0' }, () => assert.equal(colorEnabled(), false));
  });
});

describe('the wrappers', () => {
  it('hand back the text untouched when colour is off', () => {
    withEnv(PLAIN, () => assert.equal(green('created'), 'created'));
  });

  it('wrap in an escape and reset when colour is on', () => {
    withEnv({ ...PLAIN, FORCE_COLOR: '1' }, () => {
      assert.equal(green('created'), '\x1b[32mcreated\x1b[0m');
    });
  });
});
