# Ship and Watch

> **PREREQUISITE:** This skill requires `.claude/skill-config.md` in the project root. Step 0 checks for it. If the file is missing, the skill MUST stop immediately and will not proceed under any circumstances.

Commit changes, push to origin, create a pull request, then monitor CI/CD until it passes — fixing failures iteratively with user approval.

## Usage

- `/ship-and-watch` — commit, push, open PR, and monitor CI
- `/ship-and-watch fix` — skip commit/PR (already exists), just monitor CI on the current PR and fix failures
- `/ship-and-watch --auto` — run fully autonomously: skip approval steps, auto-apply all CI fixes
- `/ship-and-watch fix --auto` — monitor and auto-fix CI failures without approval

### Auto Mode

When `--auto` is passed, the skill runs without stopping for user approval:
- Step 6: Still present the fix plan (for the record), but do NOT ask "Should I apply these fixes?"
- Step 7: SKIP entirely — proceed directly to Step 8
- Step 8: Apply ALL proposed fixes automatically
- Infrastructure issues: auto-rerun failed checks instead of asking
- Iteration rules still apply (3-cycle limit on same failure still flags and stops)

---

## Step 0: Load Config

**This is the first and mandatory step. Do not proceed to any other step until this check passes.**

Run:
```
test -f .claude/skill-config.md || echo "CONFIG_MISSING"
```

**If the output is `CONFIG_MISSING`:** Output this message exactly, then STOP. Do not execute Step 1 or any subsequent step under any circumstances.
> "Cannot run `/ship-and-watch`: no `.claude/skill-config.md` found in this project. Create the config file first — see the user-level skill for the required format."

**If the command produces no output:** Read `.claude/skill-config.md` and extract the config values below.

Extract and hold these values:
- **Issue tracker** and **Issue prefix** (Project Identity section)
- **Base branch** (Project Identity section)
- **Branch naming convention** (Branch Naming Convention section)
- **Deployment** section (optional) — if present, extract: Platform, Project, Environment, Services, Health check URL, Deploy timeout, Rollback on failure. If the section is absent, set `deployment_configured` to false and skip all deployment steps later.

---

## Step 1: Pre-flight Checks

1. Run `git status` (never use `-uall`) to see the current state.
2. Run `git branch --show-current` to get the current branch name.
3. Verify you are NOT on the **Base branch** from config. If you are, ask the user which branch to create or whether to create one from the current state.
4. Run `git log --oneline -5` to see recent commit style.
5. Run `git diff --stat` and `git diff --cached --stat` to understand what will be committed.

If there are no changes to commit (clean working tree, nothing staged), check if there's already a PR open for this branch:
- Run `gh pr view --json number,title,url,state 2>/dev/null`
- If a PR exists, skip to Step 4 (Monitor CI).
- If no PR and no changes, inform the user there's nothing to ship.

---

## Step 2: Commit and Push

### Stage changes
- Run `git add` with specific file paths — NOT `git add -A` or `git add .`
- Identify files to stage from `git status`. Exclude files that look like secrets (`.env`, `credentials.*`, `*.key`, `*.pem`). If any such files appear, warn the user and skip them.

### Craft the commit message
- Analyze the staged diff (`git diff --cached`) to understand the changes.
- Write a concise commit message:
  - First line: imperative mood, under 72 characters, describes the "what and why"
  - Blank line
  - Body (if needed): bullet points for multi-file changes
  - End with: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Use multiple `-m` flags — one per paragraph. Git separates them with a blank line automatically. Do NOT use HEREDOC or command substitution; they trigger a Claude Code safety check.

```
git commit \
  -m "<commit title>" \
  -m "<body details if needed>" \
  -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Push
- Check if the branch has an upstream: `git rev-parse --abbrev-ref @{upstream} 2>/dev/null`
- If no upstream: `git push -u origin <branch-name>`
- If upstream exists: `git push`

If the push fails (e.g., rejected), report the error to the user. Do NOT force-push.

---

## Step 3: Create Pull Request

Check if a PR already exists for this branch:
- Run `gh pr view --json number,title,url,state 2>/dev/null`
- If a PR already exists and is open, skip PR creation and report the existing PR URL.

If no PR exists, create one:

1. Use the **Base branch** from config.
2. Analyze all commits on this branch vs the base: `git log <base-branch>..HEAD --oneline`
3. Draft a PR title (under 70 characters) and body.
4. Create the PR using an inline multiline string for `--body`. Do NOT use HEREDOC or command substitution; they trigger a Claude Code safety check. Use actual newlines inside the double-quoted string:

```
gh pr create --title "<title>" --body "## Summary
<1-3 bullet points summarizing the changes>

## Changes
<list of key files changed and why>

## Test plan
- [ ] Unit tests pass
- [ ] CI pipeline passes
- [ ] <any other relevant checks>

---
Generated with [Claude Code](https://claude.com/claude-code)"
```

5. Capture and display the PR URL to the user.

---

## Step 4: Monitor CI/CD Pipeline

This is the core watch loop. Poll GitHub for CI check status.

### Polling strategy
- Use `gh pr checks <pr-number> --json name,state,conclusion,detailsUrl` to get check status.
- Poll every **30 seconds**.
- On each poll, report status to the user ONLY when something changes (don't spam identical updates).
- Show a brief status line: `"CI: 3/5 checks complete, 2 in progress..."`

### Interpreting results

Wait until ALL checks have completed (no checks in `pending` or `in_progress` state), then:

- **All checks passed** — proceed to Step 4b.
- **One or more checks failed** — proceed to Step 5.
- **Checks stuck** (no progress after 10 minutes) — inform the user and ask if they want to keep waiting or investigate.

### What to capture on failure

For each failed check:
- Check name
- Conclusion (failure, cancelled, timed_out, etc.)
- Details URL

---

## Step 4b: Merge PR

After all CI checks pass, merge **without** deleting the branch:

```
gh pr merge <pr-number> --merge
```

Do NOT pass `--delete-branch`. The branch stays alive until deployment is verified (Step 4c) or, if no deployment is configured, until the end of this step.

**If `deployment_configured` is true:** proceed to Step 4c. Do NOT delete the branch or mark the ticket yet.

**If `deployment_configured` is false:** delete the branch, mark the ticket as Done, and proceed to the Final Summary:

```
git push origin --delete <branch-name>
git branch -d <branch-name>
```

### Mark the issue as Done

If the **Issue tracker** in config is set:

1. Extract the issue ID from the branch name using the **Branch naming convention** from config.
   - The branch segment containing the issue ID will match `<issue-prefix-lowercase>-<number>` — uppercase it to get the identifier (e.g., `oru-74` → `ORU-74`).
2. Fetch the issue: use `get_issue` with the identifier.
3. Find the "Done" state: use `list_issue_statuses` with the team from the issue.
4. Update the issue: use `update_issue` to set `state` to "Done".
5. Confirm to the user:
   > "<ticket_id> marked as Done."

If no issue tracker is configured, skip the issue update and go straight to the Final Summary.

Then provide the Final Summary.

---

## Step 4c: Verify Deployment (only when Deployment section exists in config)

This step runs only when the **Deployment** section is present in `skill-config.md`. It verifies the merged code deploys successfully before cleaning up.

### 1. Wait for deploy to trigger

After merge, wait **30 seconds** for the platform's auto-deploy to pick up the new commit.

### 2. Check deployment status via configured tools

If the config includes a **Deployment status tools** subsection, use the listed tools to monitor deployment progress before falling through to the health check.

1. If a **List services tool** is configured, call it with the provided parameters to discover service IDs for each service in **Services to monitor**.
2. If a **List deployments tool** is configured, call it per service to find the most recent deployment (started after the merge timestamp).
3. Poll every **30 seconds** until all deployments reach a terminal state (success or failure), or the **Deploy timeout** is reached.
4. Report status changes:
   > `"Deploy: <service> — <status> (<elapsed>)"`
5. If any deployment fails and a **Get logs tool** is configured, call it for the failed service to retrieve recent logs. Present the logs to the user (see "Deployment failed" below). Do NOT proceed to health check.
6. If all deployments succeed, proceed to the health check (step 3).

If no deployment status tools are configured, skip straight to the health check.

### 3. Verify health check

The **Health check URL** is the final confirmation. Even if the status tools report success, the health check must pass.

- Make an HTTP GET request to the **Health check URL** using `curl` via Bash.
- Expect the **Health check expected status** (default 200).
- **Retry logic:** after the first successful status code, retry 2 more times with 10-second intervals. All 3 must return the expected status to guard against rolling deploy blips.
- If the health check has not passed after **Deploy timeout**, treat it as a failure.
- Report each attempt:
  > `"Health check: <url> returned <status> (<elapsed>)"`

### 4. Interpret results

**Deployment and health check both pass:**
1. Report success:
   > "Deployment verified: health check at `<url>` passed."
2. Delete the branch:
   ```
   git push origin --delete <branch-name>
   git branch -d <branch-name>
   ```
3. Proceed to mark the ticket as Done (same logic as Step 4b), then the Final Summary.

**Deployment or health check failed:**
1. If a **Get logs tool** is configured and logs were not already fetched, call it for each service in **Services to monitor**.
2. Present the failure to the user:
   ```
   ## Deployment Failed

   **Failed service(s):** <service names, or "health check only">
   **Health check:** <url> returned <actual status> (expected <expected status>)
   **Elapsed:** <time since merge>

   ### Logs
   <logs from configured tool, or "No logs tool configured">

   ### What was preserved
   - Branch `<branch-name>` has NOT been deleted
   - Ticket has NOT been marked as Done

   ### Suggested next steps
   - Check the logs above for the root cause
   - Push a follow-up fix to the same branch, or investigate on the platform directly
   ```
3. Do NOT delete the branch. Do NOT mark the ticket as Done.
4. If **Rollback on failure** is `yes`: offer to trigger a rollback. If `no`: just flag the issue.
5. Ask:
   > "Deployment failed. Branch preserved for follow-up. Would you like to investigate, push a fix, or stop here?"

**Health check returns unexpected response shape (e.g., 200 but empty body):**
- Treat as a pass if the status code matches. The skill checks status codes, not response bodies.

---

## Step 5: Investigate CI Failures

For each failed check:

1. Fetch the failure details:
   - Run `gh pr checks <pr-number> --json name,state,conclusion,detailsUrl` to get the run details.
   - If the check is a GitHub Actions workflow, get the run ID and fetch logs:
     ```
     gh run view <run-id> --log-failed 2>&1 | tail -200
     ```
   - If `--log-failed` doesn't give enough context, try:
     ```
     gh run view <run-id> --log 2>&1 | tail -300
     ```

2. Parse the failure logs to identify:
   - Which tests failed (test name, file, line number)
   - The error message and traceback
   - Whether it's a test failure, lint error, type check error, build error, or infrastructure issue

3. Read the relevant source and test files locally to understand the failure context.

4. Categorize each failure:
   - **Test failure** — a test assertion failed
   - **Lint/format error** — code style violation
   - **Type error** — mypy or similar type checker complaint
   - **Build error** — import error, missing dependency, syntax error
   - **Infrastructure issue** — CI config problem, flaky test, timeout (not a code issue)

---

## Step 6: Present Fix Plan

Present findings to the user in a structured format:

```
## CI Results: X passed, Y failed

### Failure 1: <check-name>
- **Category:** Test failure
- **Failed test:** <test name> (<file>:<line>)
- **Error:** <error message>
- **Root cause:** <analysis after reading source code>
- **Proposed fix:** <specific change with file path and line>

### Failure 2: <check-name>
- **Category:** Lint error
- **Error:** <file>:<line>: <message>
- **Proposed fix:** <specific change>

### Infrastructure Issues (if any)
- <check-name>: Timed out — this is a CI infrastructure issue, not a code problem. Consider re-running.
```

End with: **"Should I apply these fixes?"**

For infrastructure issues, offer: **"Should I re-run the failed checks?"** (using `gh run rerun <run-id> --failed`)

---

## Step 7: Wait for User Approval

IMPORTANT: Do NOT apply any fixes without explicit user approval.

The user may:
- Approve all fixes — proceed to Step 8
- Approve specific fixes — apply only those
- Reject fixes — stop the loop
- Provide alternative direction — adjust the plan
- Ask to re-run failed checks (for flaky/infra issues) — run `gh run rerun <run-id> --failed` and go back to Step 4

---

## Step 8: Apply Fixes and Push

1. Apply the approved fixes following all project conventions from `CLAUDE.md`.
2. Make minimal changes — do not refactor unrelated code.
3. Stage only the changed files (specific paths, not `git add .`).
4. Commit with a descriptive message referencing the CI fix using multiple `-m` flags:

```
git commit \
  -m "Fix CI failures: <brief description>" \
  -m "- <fix 1 summary>
- <fix 2 summary>" \
  -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

5. Push to the same branch: `git push`
   - Do NOT create a new PR. The existing PR will automatically pick up the new commit.

6. Go back to **Step 4** (Monitor CI) to watch the new run.

---

## Iteration Rules

- Each cycle through Steps 4–8 counts as one iteration.
- Always show the user what changed between iterations: which checks now pass, which still fail, any new failures.
- If the same check fails for **3 consecutive iterations**, flag it:
  > "The check `<name>` has failed for 3 consecutive iterations. This may require deeper investigation or could be a flaky test. Would you like to continue, skip this check, or investigate further?"
- Never silently ignore a failed check.
- The user can stop the loop at any time.

---

## Final Summary

When the loop completes (all checks pass or user stops), provide a final summary:

```
## Ship & Watch Summary

- **PR:** <url>
- **Branch:** <branch-name> (deleted | preserved — see deployment)
- **Commits pushed:** <count>
- **CI iterations:** <count>
- **Initial failures:** <count>
- **Fixed this session:** <count>
- **Still failing:** <count> (if any)
- **Deployment:** Verified | Failed | Skipped (no config)
- **Ticket:** <ticket-id> marked Done (or "Not marked — deployment failed" or "No issue tracker configured")

### Commits Made
1. `<hash>` — <original commit message>
2. `<hash>` — Fix CI failures: <description>

### Fixes Applied
- `<file>:<line>` — <description>
- `<file>:<line>` — <description>
```

---

## Rules

- NEVER force-push (`git push --force` or `--force-with-lease`) without explicit user request.
- NEVER push directly to the base branch.
- NEVER commit files that look like secrets (`.env`, `*.key`, `*.pem`, `credentials.*`).
- NEVER skip pre-commit hooks (`--no-verify`) unless the user explicitly requests it.
- NEVER amend the previous commit — always create new commits.
- NEVER delete branches or close PRs without explicit user request.
- NEVER weaken test assertions to make CI pass — fix the source code (unless the test is genuinely wrong).
- NEVER modify CI configuration files (`.github/workflows/`, etc.) without user approval — flag these as infrastructure issues.
- If a fix requires changing a contract, port interface, or shared model, warn the user about potential downstream impact before applying.
- Follow all anti-patterns and conventions from `CLAUDE.md` at all times.
