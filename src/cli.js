// Wires together the command line, the repo checks, and the report.
import { readFileSync } from 'node:fs';
import { Command, CommanderError } from 'commander';
import picocolors from 'picocolors';
import { parseRepoUrl } from './parseRepoUrl.js';
import { cloneRepo } from './cloneRepo.js';
import { removeTempDir } from './tempDir.js';
import { collectChecks } from './collectChecks.js';
import { explainTests } from './explainTests.js';
import { runTests } from './runTests.js';
import { scoreReport } from './scoreReport.js';
import { toJson } from './toJson.js';
import { findExitProblems, parseMinScore, EXIT_PROBLEMS_FOUND, EXIT_VET_FAILED } from './exitStatus.js';
import { printReport, printElapsedTime } from './report.js';
import { printTestSection } from './printTestReport.js';
import { printScore } from './printScore.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// By default Ctrl+C kills Node without running 'exit' handlers. Exiting
// normally lets tempDir.js and runCommand.js clean up after themselves.
process.on('SIGINT', () => process.exit(130));

export async function runCli(argv) {
  const program = new Command();
  program
    .name('vet')
    .version(packageJson.version)
    .description("Vet a GitHub repository: its health, security, licensing, docs and tests")
    .argument('<url>', 'GitHub repository URL, e.g. https://github.com/owner/repo')
    .option('--no-tests', "don't run the repo's tests (running them executes the repo's code on your machine)")
    .option('--json', 'print the full report as JSON instead of text')
    .option('--min-score <number>', 'exit with code 1 if the overall score is below this number (0 to 10)')
    .exitOverride();

  if (!parseArguments(program, argv)) return;

  const [url] = program.args;
  const options = program.opts();

  // Checked before cloning, so a typo fails instantly instead of after a long run.
  try {
    options.minScore = parseMinScore(options.minScore);
  } catch (error) {
    console.error(picocolors.red(error.message));
    process.exitCode = EXIT_VET_FAILED;
    return;
  }

  await vetRepository(url, options);
}

// Commander exits with 1 on a usage mistake, which CI would read as "problems
// found". exitOverride() makes it throw instead (after printing the error), so a
// usage mistake gets code 2 while --help and --version keep their code 0.
function parseArguments(program, argv) {
  try {
    program.parse(argv);
    return true;
  } catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    process.exitCode = error.exitCode === 0 ? 0 : EXIT_VET_FAILED;
    return false;
  }
}

async function vetRepository(url, options) {
  const startTime = Date.now();
  // With --json, standard output must hold only the JSON, so progress goes to stderr.
  const say = options.json ? console.error : console.log;
  let repoPath;

  try {
    const repoName = parseRepoUrl(url);
    say(`Vetting ${picocolors.bold(repoName)}...\n`);

    repoPath = await cloneRepo(url);
    const report = await collectChecks(repoName, repoPath);
    if (!options.json) printReport(report);

    report.tests = await reportTests(repoPath, options, say);
    report.score = scoreReport(report);
    finishReport(report, options, startTime);
  } catch (error) {
    console.error(picocolors.red(`Could not vet repository: ${error.message}`));
    process.exitCode = EXIT_VET_FAILED;
  } finally {
    if (repoPath) {
      await removeTempDir(repoPath);
    }
  }
}

function finishReport(report, options, startTime) {
  const problems = findExitProblems(report, options.minScore);
  if (problems.length > 0) {
    process.exitCode = EXIT_PROBLEMS_FOUND;
  }

  if (options.json) {
    console.log(JSON.stringify(toJson(report), null, 2));
    return;
  }
  printScore(report.score);
  if (problems.length > 0) {
    console.log(picocolors.dim(`\nExit code ${EXIT_PROBLEMS_FOUND}: ${problems.join(' and ')}.`));
  }
  printElapsedTime(((Date.now() - startTime) / 1000).toFixed(1));
}

// Test cases are always listed, since finding them only reads files. Running
// them is the part that executes the repo's code, so --no-tests turns just that off.
async function reportTests(repoPath, options, say) {
  const outline = await explainTests(repoPath);
  let testRun = null;

  if (options.tests) {
    say(picocolors.yellow("\nRunning the repo's tests. This executes its code on your machine (pass --no-tests to skip)."));
    testRun = await runTests(repoPath, (message) => say(picocolors.dim(`  ${message}`)));
  }

  if (!options.json) printTestSection({ outline, testRun });
  return { outline, testRun };
}
