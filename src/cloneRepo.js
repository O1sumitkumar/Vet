// Shallow-clones a GitHub repo into a fresh temp directory so we can inspect its files.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { makeTempDir } from './tempDir.js';
import { parseRepoUrl } from './parseRepoUrl.js';

const execFileAsync = promisify(execFile);

// What git prints when a repo doesn't exist or we aren't allowed to see it.
// Over HTTPS, GitHub answers a private or missing repo with a login prompt,
// which GIT_TERMINAL_PROMPT=0 turns into "could not read Username".
const NOT_FOUND_PATTERN = /repository not found|could not read username|does not exist/i;

export async function cloneRepo(url) {
  const tempDir = await makeTempDir();

  try {
    await execFileAsync('git', ['clone', '--depth', '1', '--quiet', url, tempDir], {
      // Without this, a missing or private repo can make git stop and ask
      // for a username on a real terminal, leaving vet hanging.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (error) {
    throw new Error(explainCloneFailure(error, url, tempDir));
  }

  return tempDir;
}

// Turns a failed `git clone` into one plain sentence a new user can act on.
export function explainCloneFailure(error, url, tempDir) {
  if (error.code === 'ENOENT') {
    return "git isn't installed. Install it from https://git-scm.com, then try again.";
  }

  const gitOutput = error.stderr || error.message || '';
  if (NOT_FOUND_PATTERN.test(gitOutput)) {
    return `Couldn't find ${repoLabel(url)}. Check the URL (private repos need git access, and GitHub details like activity need a token).`;
  }

  const lines = gitOutput.split('\n').map((line) => line.trim()).filter(Boolean);
  let lastLine = lines.length > 0 ? lines[lines.length - 1] : 'unknown error';
  if (tempDir) {
    lastLine = lastLine.split(tempDir).join('').trim();
  }
  return `git clone failed for "${url}": ${lastLine}`;
}

function repoLabel(url) {
  try {
    return parseRepoUrl(url);
  } catch {
    return url;
  }
}
