/**
 * ANSI colour, and only when a human is looking: piped output, `NO_COLOR` and a
 * dumb terminal all get plain text. Checked on every call rather than once at
 * import, so the environment can change — and so it can be tested at all.
 */
export function colorEnabled(): boolean {
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === 'dumb') return false;
  return Boolean(process.stdout.isTTY);
}

export type Paint = (text: string | number) => string;

const wrap =
  (code: number): Paint =>
  (text) =>
    colorEnabled() ? `\x1b[${code}m${text}\x1b[0m` : String(text);

export const bold = wrap(1);
export const dim = wrap(2);
export const red = wrap(31);
export const green = wrap(32);
export const yellow = wrap(33);
export const cyan = wrap(36);
