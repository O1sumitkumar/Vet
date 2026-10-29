// Runs bin/vet.js as CI would and checks the exit code for usage mistakes,
// --help and --version. None of these cases reaches the clone, so no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vetPath = fileURLToPath(new URL('../bin/vet.js', import.meta.url));

function runVet(args) {
  return spawnSync(process.execPath, [vetPath, ...args], { encoding: 'utf8' });
}

test('a missing URL exits with 2', () => {
  const result = runVet([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /missing required argument 'url'/);
});

test('an unknown option exits with 2', () => {
  const result = runVet(['https://github.com/a/b', '--nope']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option '--nope'/);
});

test('--min-score without a value exits with 2', () => {
  const result = runVet(['https://github.com/a/b', '--min-score']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /argument missing/);
});

test('--help exits with 0', () => {
  const result = runVet(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: vet/);
});

test('--version exits with 0', () => {
  const result = runVet(['--version']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '0.1.0');
});
