import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

/** True only when someone is actually there to answer. */
export function interactive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function createPrompt() {
  let muted = false;

  // Secret answers are read normally but never echoed back to the terminal.
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });

  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });

  return {
    async ask(question, { secret = false } = {}) {
      if (!secret) return (await rl.question(`${question} `)).trim();

      process.stdout.write(`${question} `);
      muted = true;
      const answer = await rl.question('');
      muted = false;
      process.stdout.write('\n');
      return answer.trim();
    },
    async confirm(question, expected) {
      const answer = (await rl.question(`${question} `)).trim();
      return answer === expected;
    },
    close() {
      rl.close();
    },
  };
}
