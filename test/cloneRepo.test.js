// Checks that failed clones are explained in plain words, without running git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainCloneFailure } from '../src/cloneRepo.js';

const url = 'https://github.com/octocat/Hello-World';
const tempDir = '/tmp/vet-dBkB2U';

test('says git is missing when it cannot be started', () => {
  const error = Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' });
  assert.equal(
    explainCloneFailure(error, url, tempDir),
    "git isn't installed. Install it from https://git-scm.com, then try again.",
  );
});

test('says the repo could not be found when GitHub refuses it', () => {
  const stderrs = [
    "fatal: could not read Username for 'https://github.com': terminal prompts disabled\n",
    'remote: Repository not found.\nfatal: repository \'https://github.com/octocat/Hello-World/\' not found\n',
  ];
  for (const stderr of stderrs) {
    const error = Object.assign(new Error('Command failed'), { code: 128, stderr });
    const message = explainCloneFailure(error, url, tempDir);
    assert.match(message, /^Couldn't find octocat\/Hello-World\. Check the URL/);
  }
});

test('shows only the last line of anything else, without the temp folder', () => {
  const stderr = `Cloning into '${tempDir}'...\nfatal: unable to access '${url}/': Could not resolve host: github.com\n`;
  const error = Object.assign(new Error(`Command failed: git clone --depth 1 --quiet ${url} ${tempDir}`), { code: 128, stderr });
  const message = explainCloneFailure(error, url, tempDir);
  assert.equal(message, `git clone failed for "${url}": fatal: unable to access '${url}/': Could not resolve host: github.com`);
  assert.ok(!message.includes(tempDir));
});
