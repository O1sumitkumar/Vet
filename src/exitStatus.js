// Decides vet's exit code so CI pipelines can fail a build on problems:
// 0 = nothing wrong, 1 = broken links, failing tests, or a score under
// --min-score. (cli.js uses 2 when vet itself couldn't run, e.g. a bad URL
// or a usage mistake like a missing URL or an unknown option.)
export const EXIT_PROBLEMS_FOUND = 1;
export const EXIT_VET_FAILED = 2;

// Reads the --min-score value. Returns null when the flag wasn't given, and
// throws a plain-English error for anything that isn't a number from 0 to 10.
export function parseMinScore(text) {
  if (text === undefined) return null;

  const number = Number(text);
  if (text.trim() === '' || !Number.isFinite(number) || number < 0 || number > 10) {
    throw new Error(`--min-score must be a number from 0 to 10, but got "${text}"`);
  }
  return number;
}

export function findExitProblems(report, minScore = null) {
  const problems = [];

  const brokenCount = report.links.brokenLinks.length;
  if (brokenCount > 0) {
    problems.push(`${brokenCount} broken link(s)`);
  }

  const testRun = report.tests.testRun;
  if (testRun) {
    const failingCount = testRun.commandResults.filter((result) => result.exitCode !== 0).length;
    if (failingCount > 0) {
      problems.push(`${failingCount} failing test command(s)`);
    }
  }

  if (minScore !== null && report.score.score < minScore) {
    problems.push(`a score of ${report.score.score}, below the minimum of ${minScore}`);
  }

  return problems;
}
