# Vet

A command-line tool that vets a GitHub repository before you depend on it.
In one run it tells you:

- **What it's made of:** lines of code per language, and each language's share.
- **Whether it's alive:** recent commits, last push, stars, contributors,
  latest release, or whether it's archived.
- **Whether you may use it:** which license it has, in plain words.
- **Whether it's well kept:** README, contributing guide, security policy,
  changelog, templates, CI, dependency updates and tests.
- **Whether it's safe:** committed programs that can't be reviewed, and risky
  GitHub Actions setups that could leak secrets.
- **Whether its docs work:** broken web links, links to missing files, and
  links to `#headings` that don't exist, each with its file and line.
- **Whether its tests pass:** every test the repo declares, with a result
  for each individual test case.

It then sums it all up as one **score out of 10**.

## Requirements

- **Node.js 20 or newer**
- **git**, because vet clones the repo it checks into a temporary folder
- **To run a repo's tests**, that repo's own tools (for example `npm` for
  JavaScript, `python3` for Python, `go`, `cargo`). If one is missing, vet says
  so and carries on. Running tests goes through `sh`, so it's built for macOS
  and Linux (on Windows, use WSL, or pass `--no-tests`). Windows hasn't been
  tested yet.

## Install

Try it without installing anything:

```bash
npx github:kabirvashisht4-glitch/Vet https://github.com/owner/repo
```

Install it so you can type `vet` anywhere:

```bash
npm install -g github:kabirvashisht4-glitch/Vet
```

Or work on it from a clone:

```bash
git clone https://github.com/kabirvashisht4-glitch/Vet.git
cd Vet
npm install
npm link
```

`npm link` puts the `vet` command on your PATH. Check it worked with
`vet --version`.

## Usage

```bash
vet https://github.com/owner/repo
```

Vet clones the repository into a temporary folder, scans it, prints a
report, and deletes the temporary folder when it's done — nothing is left
behind.

Example output (shortened):

```
Vetting tj/commander.js...

Languages
  ● JavaScript    100%  15,224 line(s) of code in 171 file(s), plus 2,847 comment and 2,571 blank

Repo health
  ? Quiet: 0 commit(s) on master in the last 90 days, last push to any branch 2 day(s) ago
      ⭐ 28415 stars, 1781 forks, 199 contributor(s), 12 open issues and PRs, latest release v15.0.0 (2026-05-29)
  ✔ License: MIT (permissive) — LICENSE
      You can reuse it almost any way you like, as long as you keep the copyright notice.
  Project files: 9 of 11 present
    ✔ README (Readme.md)
    ✘ Code of conduct — sets expectations for how people treat each other
    ...
  ✔ No compiled programs committed
  ✔ CI security: no risky patterns in 2 workflow(s)

Links
  ✘ 243 link(s) checked, 8 broken
    ✘ https://nodejs.org/en/docs/guides/debugging-getting-started/ (HTTP 404) — Readme.md:1078
    ✘ #独立的可执行（子）命令 (no heading #独立的可执行（子）命令) — Readme_zh-CN.md:30
    ...
  ? 2 couldn't be verified (the site blocks automated checks)

Vet score: 8.5 / 10 — Looks healthy and well kept
  Maintained             █████····· 5
  CI security            ██████████ 10
  License                ██████████ 10
  ...
```

### Options

| Option | What it does |
|--------|--------------|
| `--no-tests` | Don't run the repo's tests (they still get listed). |
| `--json` | Print the whole report as JSON on standard output, for scripts and CI. Progress goes to stderr. |
| `--min-score <number>` | Exit with code 1 if the overall score is below this number (0 to 10), so CI can reject low-scoring repos. |
| `--version` | Print vet's version. |

Set `GITHUB_TOKEN` to raise GitHub's API limit from 60 to 5,000 requests an
hour. Vet needs 4 per repo, so this only matters if you vet many repos.

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | No broken links, and all test commands passed. |
| `1` | Broken links, failing test commands, or a score below `--min-score` were found, so CI can fail the build. |
| `2` | Vet itself couldn't run (a usage mistake such as a missing URL or an unknown option, a bad URL, an invalid `--min-score`, or the clone failed). |

### Where the checks come from

The checks are modeled on well-known tools: the score and the security,
maintenance and binary checks on [OpenSSF Scorecard](https://github.com/ossf/scorecard),
the project-files checklist on [repolinter](https://github.com/todogroup/repolinter),
license detection on [licensee](https://github.com/licensee/licensee), line
counts on [scc](https://github.com/boyter/scc), and link checking on
[lychee](https://github.com/lycheeverse/lychee).

## Tests

Vet runs the repo's tests the way its own authors do. It collects every test
command the repo declares:

- `test` scripts in `package.json` (`test`, `test:unit`, `test:e2e`, ...)
- `test` targets in the `Makefile`
- test steps in its GitHub Actions workflows (`.github/workflows/*.yml`)

It skips anything that would never finish (watch modes, UIs) or only works on
GitHub's servers, and doesn't run a script twice when another already calls
it. If the repo declares nothing for a language, Vet falls back to that
language's usual command (`pytest`, `go test ./...`, `cargo test`).

Before running, it prepares each language inside the temporary clone:
`npm install` for JavaScript, a throwaway virtual environment for Python. Then
it lists **every test case**, each with its own result:

```
Tests

  Test commands

    ✘ npm run test (from package.json, 1.2s)
      2 passed, 1 failed, 1 skipped

    ✘ python -m pytest tests -q (from .github/workflows/ci.yml, 0.2s)
      1 passed, 1 failed, 1 skipped

  Test cases

    JavaScript
      math.test.js
        ✔ adds numbers
        ✘ doesn't divide by zero
        ○ rounds money

    Python
      tests/test_math.py
        ✔ add works
        ✘ this one fails
        ○ later

    6 test case(s): 2 passed, 2 failed, 2 skipped, 0 without an individual result
```

✔ passed, ✘ failed, ○ skipped, and ? means the test tool didn't name that
test in its output. Tests the code creates while running (like `it()` calls
inside a loop) are listed from the test output too.

**Running tests executes the repository's code on your machine**, just like
running `npm test` or `pytest` yourself. Only vet repos you trust, or pass
`--no-tests` to skip running them. Vet still lists the test cases it finds in
the code, since that only reads files:

```bash
vet https://github.com/owner/repo --no-tests
```

## How it works

See [CONTRIBUTING.md](CONTRIBUTING.md) for a walkthrough of the code, file
by file.

## License

MIT — see [LICENSE](LICENSE).
