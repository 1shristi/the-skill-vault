# Test and Fix

> **PREREQUISITE:** This skill requires `.claude/skill-config.md` in the project root. Step 0 checks for it. If the file is missing, the skill MUST stop immediately and will not proceed under any circumstances.

Run unit tests related to the current work, diagnose failures, propose fixes, and iterate until all tests pass.

## Usage

Invoke with `/test-and-fix` to auto-detect what's being worked on, or pass a specific target:

- `/test-and-fix` — auto-detect from git changes
- `/test-and-fix src/myproject/kernel/contracts/` — test a specific module/directory
- `/test-and-fix ORU-7` — test files related to a specific ticket

---

## Step 0: Load Config

**This is the first and mandatory step. Do not proceed to any other step until this check passes.**

Run:
```
test -f .claude/skill-config.md || echo "CONFIG_MISSING"
```

**If the output is `CONFIG_MISSING`:** Output this message exactly, then STOP. Do not execute Step 1 or any subsequent step under any circumstances.
> "Cannot run `/test-and-fix`: no `.claude/skill-config.md` found in this project. Create the config file first — see the user-level skill for the required format."

**If the command produces no output:** Read `.claude/skill-config.md` and extract the config values below.

Extract and hold these values:
- **Source root** (Source Root section)
- **Test directories** — unit and integration paths (Test Directories section)
- **Test runner** command (Test Runner section)

---

## Step 1: Identify What's Being Worked On

Determine which files are currently being worked on using these signals, in priority order:

1. **Explicit argument** — if the user passed a path or ticket ID, use that.
   - If a ticket ID (e.g., `ORU-7`), fetch the ticket with `get_issue` and extract file paths from the Deliverables section.
2. **Git diff** — run `git diff --name-only HEAD` and `git diff --name-only --cached` to find modified files (staged and unstaged).
3. **Untracked files** — run `git status --porcelain` to find new files.

From the identified source files, determine the corresponding test files using the **Source root** and **Test directories** from config:
- Source file `<source-root>/path/to/module.py` maps to `<unit-test-dir>/test_module.py` or `<unit-test-dir>/path/to/test_module.py`
- If test files themselves are in the changed set, include them directly

Also search for related test files using the component names from changed files:
- Use `glob` to find `<unit-test-dir>/**/test_*<component>*.py`
- Use `glob` to find `<integration-test-dir>/**/test_*<component>*.py`

If no changed files are found and no argument was provided, ask the user what to test.

---

## Step 2: Verify Test Infrastructure

Before running tests, verify the test infrastructure exists:

1. Check that `pyproject.toml` (or `setup.cfg`) exists with pytest configuration
2. Check that the tests directory exists
3. Check that the identified test files exist

If test files don't exist yet, report this to the user:
> "No test files found for the current changes. The following source files were modified but have no corresponding tests: [list]. Would you like me to create the test files first?"

If the user agrees, that's a separate task — do NOT auto-generate tests in this skill. Just report and stop.

---

## Step 3: Run the Tests

Run the **Test runner** command from config, targeting only the relevant test files:

```
<test-runner> <test_files> -v --tb=short 2>&1
```

Rules for running tests:
- Use `-v` for verbose output so individual test names are visible
- Use `--tb=short` for readable tracebacks without excessive noise
- If there are both unit and integration tests, run unit tests first
- Capture the full output including exit code

---

## Step 4: Analyze Results

Parse the test output and categorize:

- **All passed** — report success with a summary (number of tests, time taken). Done.
- **Failures found** — proceed to Step 5.
- **Errors (not failures)** — these are import errors, fixture issues, or infrastructure problems. Distinguish these from test logic failures.

For each failure, extract:
- Test name and file location
- The assertion or error that failed
- The expected vs actual values (if available)
- The relevant source code context

---

## Step 5: Propose a Fix Plan

For each failure, analyze the root cause by reading:
1. The failing test code
2. The source code being tested
3. Any related contracts, ports, or module interfaces

Categorize each failure:
- **Source bug** — the implementation has a defect
- **Test bug** — the test itself has wrong expectations or setup
- **Missing implementation** — source code is incomplete or stubbed
- **Configuration issue** — imports, fixtures, or test infrastructure problem

Present the fix plan to the user as a structured summary:

```
## Test Results: X passed, Y failed, Z errors

### Failure 1: test_<name> (<file>:<line>)
- **Category:** Source bug
- **Root cause:** <description>
- **Proposed fix:** Update `<file>:<line>` to <change>

### Failure 2: ...
```

End with: **"Should I apply these fixes?"**

---

## Step 6: Wait for User Approval

IMPORTANT: Do NOT apply any fixes without user confirmation. Wait for the user to:
- Agree to all fixes ("yes", "go ahead", "apply them")
- Agree to specific fixes ("fix 1 and 3, skip 2")
- Reject fixes ("no", "I'll handle it")
- Provide alternative direction

If the user provides alternative direction, adjust the plan accordingly.

---

## Step 7: Apply Fixes

Apply only the approved fixes. For each fix:
1. Read the file to be modified
2. Make the minimal change needed — do not refactor surrounding code
3. Follow all project conventions from `CLAUDE.md`

Do NOT:
- Add unrelated improvements
- Refactor code that isn't broken
- Add comments explaining the fix
- Change test expectations to match broken behavior (unless the test was the bug)

---

## Step 8: Re-run Tests

After applying fixes, re-run the exact same test command from Step 3.

- **All passed** — report success. Done.
- **New failures** — if the fixes introduced new failures, go back to Step 5 with the new failures.
- **Same failures persist** — re-analyze. The fix didn't work. Propose an alternative approach and go back to Step 5.
- **Partial improvement** — some fixed, some remain. Report progress, then go back to Step 5 for the remaining failures.

---

## Iteration Rules

- Each iteration through Steps 5–8 counts as one cycle.
- Always show the user what changed between cycles (which tests now pass, which still fail).
- If after 3 cycles the same test is still failing, flag it explicitly: "This test has failed for 3 consecutive cycles. The issue may require deeper investigation. Would you like to continue or skip this test for now?"
- Never silently skip a failing test. Always report it.
- The user can stop the loop at any time by saying "stop", "that's enough", or similar.

---

## Output Summary

When the loop completes (all tests pass or user stops), provide a final summary:

```
## Test & Fix Summary

- **Tests run:** <count>
- **Initially failing:** <count>
- **Fixed this session:** <count>
- **Still failing:** <count> (if any)
- **Cycles:** <count>

### Changes Made
- `<file>:<line>` — <description of fix>
- `<file>:<line>` — <description of fix>
```

---

## Rules

- NEVER modify tests to make them pass by weakening assertions — fix the source code instead (unless the test itself is genuinely wrong).
- NEVER skip or delete failing tests without user approval.
- NEVER run the full test suite — only run tests related to current work.
- NEVER install packages or modify dependencies without asking the user.
- Follow all anti-patterns and conventions from `CLAUDE.md`.
- If a fix requires changing a contract or port interface, flag this to the user as a potentially breaking change before applying.
