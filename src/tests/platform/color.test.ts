import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { colorEnabled, green } from '../../platform/color.ts';

/** Runs `fn` with the environment the test needs, then puts it back. */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const before: Record<string, string | undefined> = {};
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

/**
 * Says whether stdout is a terminal, instead of asking the machine. The suite
 * runs both from a terminal and from a pipe, and must give the same answer.
 */
function withStdout<T>(isTTY: boolean, fn: () => T): T {
  const before = process.stdout.isTTY;
  process.stdout.isTTY = isTTY;
  try {
    return fn();
  } finally {
    process.stdout.isTTY = before;
  }
}

const PLAIN = { FORCE_COLOR: undefined, NO_COLOR: undefined, TERM: undefined };
const check = (vars: Record<string, string | undefined>, isTTY: boolean, expected: boolean) =>
  withEnv({ ...PLAIN, ...vars }, () => withStdout(isTTY, () => assert.equal(colorEnabled(), expected)));

describe('colorEnabled', () => {
  it('is on when stdout is a terminal', () => {
    check({}, true, true);
  });

  it('is off when the output is piped somewhere', () => {
    check({}, false, false);
  });

  it('is off when NO_COLOR is set, terminal or not', () => {
    check({ NO_COLOR: '1' }, true, false);
    check({ NO_COLOR: '1' }, false, false);
  });

  it('is off on a dumb terminal', () => {
    check({ TERM: 'dumb' }, true, false);
  });

  it('is on when FORCE_COLOR asks for it, even through a pipe', () => {
    check({ FORCE_COLOR: '1' }, false, true);
  });

  it('treats FORCE_COLOR=0 as not asking', () => {
    check({ FORCE_COLOR: '0' }, false, false);
  });
});

describe('the wrappers', () => {
  it('hand back the text untouched when colour is off', () => {
    withEnv(PLAIN, () => withStdout(false, () => assert.equal(green('created'), 'created')));
  });

  it('wrap in an escape and reset when colour is on', () => {
    withEnv(PLAIN, () => withStdout(true, () => assert.equal(green('created'), '\x1b[32mcreated\x1b[0m')));
  });
});
