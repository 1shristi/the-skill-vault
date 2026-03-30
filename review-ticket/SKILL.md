# Review Ticket

> **PREREQUISITE:** This skill requires `.claude/skill-config.md` in the project root. Step 0 checks for it. If the file is missing, the skill MUST stop immediately and will not proceed under any circumstances.

Validate an implementation ticket against the project specs before work begins. Catch problems before they become code.

## Usage

Invoke with an issue identifier: `/review-ticket ORU-7`

Optional flag: `/review-ticket ORU-7 --fix`

- **Without `--fix`:** Audit-only mode. Run the 23-check checklist, present findings, and append a review addendum to the ticket. Does not modify the ticket description.
- **With `--fix`:** Audit-and-fix mode. Run the checklist. If any checks fail, research the codebase, rewrite the ticket description to pass all checks, then re-verify. The original ticket goal and scope are preserved — only gaps are filled.

If no identifier is provided, ask the user which ticket to review.

---

## Step 0: Load Config

**This is the first and mandatory step. Do not proceed to any other step until this check passes.**

Run:
```
test -f .claude/skill-config.md || echo "CONFIG_MISSING"
```

**If the output is `CONFIG_MISSING`:** Output this message exactly, then STOP. Do not execute Step 1 or any subsequent step under any circumstances.
> "Cannot run `/review-ticket`: no `.claude/skill-config.md` found in this project. Create the config file first — see the user-level skill for the required format."

**If the command produces no output:** Read `.claude/skill-config.md` and extract the config values below.

Extract and hold these values for use throughout the skill:
- **Branch naming convention** (Branch Naming Convention section)
- **Reference documents** — the four paths listed (Reference Documents section)
- **Source root** (Source Root section)
- **Canonical utility locations** — all three paths (Canonical Utility Locations section)
- **Architecture examples** (Architecture Examples section)
- **File structure spec reference** (File Structure Spec Reference section)

Also parse the arguments to determine whether `--fix` mode is active. Hold this as a boolean `fix_mode` for the remainder of the skill.

---

## Step 1: Branch Setup

Set up the correct branch for this ticket before loading any context.

1. Run `git branch --show-current`.
2. Derive the expected branch prefix: lowercase the issue ID (e.g., `ORU-7` → `oru-7`).
3. Check for a matching local branch: `git branch --list "*/<linear-id-lowercase>/*"`.

**If already on a matching branch:** confirm and continue.

**If a matching branch exists but is not checked out:**
- Stash uncommitted changes if present: `git stash push -u -m "WIP on <current-branch>"`
- Check it out: `git checkout <matching-branch>`

**If no matching branch exists:** derive the branch name following the **Branch Naming Convention** from config. State the derived name to the user before creating it, then:
- Stash uncommitted changes if present
- Run `git checkout -b <derived-branch-name>`

Report the branch you are now on before continuing.

IMPORTANT: Do NOT delete branches. Do NOT drop stashes.

---

## Step 2: Fetch Ticket

1. Call `get_issue` with the provided identifier (e.g., `ORU-7`).
2. Call `list_comments` to check for follow-up decisions that may affect the review.
3. If the description contains images, call `extract_images` to view them.

**Detect prior review:**

After fetching, scan the description for an existing `## Review` block (a section starting with `## Review` and continuing to the end of the description or the next `---` separator before it). Also scan comments for any comment that begins with `## Review`.

- If a prior review is found in the **description**: extract the full block and hold it as `prior_review`. Note its position in the description (the separator `\n\n---\n\n` that precedes it, plus everything after). You will need this to replace it in Step 7.
- If a prior review is found in a **comment**: extract the full text and hold it as `prior_review`. Note the comment ID — you will delete this comment and post the updated review to the description in Step 7.
- If no prior review is found: set `prior_review` to null.

Use `prior_review` as additional context during the checklist in Step 4. Prior findings can inform the current review — note whether issues from a prior review have been addressed or persist.

Hold the current description (excluding any prior review block) as `core_description`. This is the content that Step 7 preserves in audit-only mode, or that Step 6b replaces in fix mode.

---

## Step 3: Load Reference Documents

Read the documents listed under **Reference Documents** in config:

1. **Architecture overview** — architecture, data model, pipelines, design decisions
2. **File structure spec** — kernel blueprint, module interfaces, ports, build order
3. **Ticket dependency map** — full ticket plan with dependencies and sprint placement
4. **Ticket format standard** — ticket format and quality checklist

---

## Step 3b: Pre-Checklist Codebase Searches

Run these searches **before** the checklist. The results feed directly into Checks 7, 8, and 20.

### For tickets that replace or remove a pattern across files

If any deliverable says "replace X", "remove all occurrences of X", or "no X should remain", grep for X now using the **Source Root** from config as the search base:

```bash
# Example — adapt the pattern to what the ticket is removing:
grep -rn "<pattern>" <source-root>
```

Record every file returned. In Check 7, verify each returned file is explicitly listed in the Deliverables. Any file in the grep output that is not in the Deliverables is a missing deliverable.

### For tickets that introduce new validation logic, constants, or helper functions

If the ticket creates new validators, constraints, or utilities, grep the **Canonical Utility Locations** from config first:

```bash
grep -rn "<relevant pattern>" <validators-file>
grep -rn "<relevant pattern>" <constants-file>
grep -rn "<relevant pattern>" <id-file>
```

If the same logic already exists, the ticket should import from the canonical location rather than re-implementing. Flag this in Check 20.

### For tickets that introduce or use a third-party SDK

If the ticket adds a new package or includes SDK API calls in implementation notes, check the installed package:

```bash
source .venv/bin/activate && pip show <package-name>
```

Record the installed version. Compare against the version constraint in the ticket's deliverables — if the constraint is an open floor (e.g., `>=1.0`), check whether later major versions have breaking API changes. Verify that any class names, method names, or call signatures in the implementation notes exist in the installed version. Record discrepancies for Check 21.

### For tickets that change a public interface (API endpoint, port method, shared model)

If any deliverable modifies a function signature, changes an HTTP status code, alters a response shape, adds/removes enum values, or renames a public class or method, grep for all callers now:

```bash
# Find all callers of the changed function/endpoint/model
grep -rn "<function_name>\|<endpoint_path>\|<model_name>" <source-root>
```

Record every file that references the changed interface. In Check 22, verify that the ticket identifies all consumers and states a migration strategy for breaking changes. In Check 23, verify that all call sites are listed in the Deliverables or explicitly noted as unchanged.

### For tickets that add custom code for an external service workflow

If the ticket writes custom code to handle a common workflow involving an external service (e.g., Clerk, Knock, Supabase, Stripe, etc.), research whether the service already provides a built-in feature, dashboard toggle, or native configuration that accomplishes the same goal without custom code.

1. **Identify the workflow.** What is the ticket's custom code trying to achieve? (e.g., "auto-create an org when a user signs up", "send a notification when X happens", "sync data on event Y")
2. **Search for built-in alternatives.** Use web search to check the service's documentation and changelog:
   - `"<service> <workflow description>"` (e.g., `"clerk auto create organization user signup"`)
   - `"<service> dashboard setting <feature>"`
3. **Record findings.** Note whether a built-in feature exists, what it does, and whether it fully covers the ticket's requirements or only partially.

Use the results in Check 24.

---

## Step 4: Run the Checklist

Evaluate all 23 checks. For each, assign exactly one verdict: **Pass**, **Flag**, or **Fail**.

| # | Check |
|---|-------|
| 1 | Connects to pipeline goal |
| 2 | Fits sprint theme and build order |
| 3 | Scope is bounded |
| 4 | No architecture drift |
| 5 | All sections present |
| 6 | Inputs list dependencies by ticket ID |
| 7 | Deliverables have exact file paths + tests |
| 8 | Acceptance criteria are pass/fail testable |
| 9 | Implementation notes resolve ambiguity |
| 10 | Edge cases addressed |
| 11 | Canonical terminology only |
| 12 | File paths match project file structure spec |
| 13 | Data models match canonical definitions |
| 14 | All input dependencies exist |
| 15 | No unlisted dependencies |
| 16 | Downstream compatibility |
| 17 | Every AC has a test |
| 18 | Error/edge cases in tests |
| 19 | Test patterns followed |
| 20 | No duplicated utility logic |
| 21 | SDK version pinned and API verified |
| 22 | Blast radius documented |
| 23 | No silent bug introduction |

**Check 4 — No architecture drift:** Evaluate all three sub-checks. Any single sub-check failure is a Fail on Check 4.

1. **Module purity — no direct external I/O.** Scan the implementation notes and deliverable code for any direct use of an external SDK, API client, or IO library inside a module class. Modules must never touch DB, filesystem, or external APIs directly. Use the **Architecture Examples** from config to recognise compliant vs. non-compliant patterns. If a module instantiates any external SDK directly in its body, that is a Fail.

2. **Port/adapter exists for every external service.** For each external service the ticket uses, verify that a port ABC exists in the ports directory AND an adapter exists in the adapters directory (or both are listed as deliverables in this ticket). Missing port or adapter is a Fail.

3. **No imports of adapters inside modules.** Modules must not import from the adapters directory — adapters are wired by the kernel/harness, never by modules themselves. Use the **Source Root** from config to derive the adapters path.

**Check 7 — Deliverables have exact file paths + tests:** For tickets that replace or remove a pattern across files, use the grep results from Step 3b. Every file returned by the grep must appear in the Deliverables list. If any file is missing, that is a Fail.

**Check 8 — Acceptance criteria are pass/fail testable:** For each AC that makes a universal claim ("all X use Y", "no Z remains"), verify that the Deliverables explicitly cover every file where Z exists (using Step 3b results). Also flag any hardcoded counts of existing files — ACs should say "all existing" with no number.

**Check 12 — File paths match project file structure spec:** Verify all deliverable paths against the **File Structure Spec Reference** from config.

**Check 20 — No duplicated utility logic:** For tickets introducing new validation logic, constants, or helpers, use the Step 3b search results against the **Canonical Utility Locations** from config. If the same logic already exists there, the ticket must import from the canonical location rather than re-implementing. If new logic will be used in two or more places, the ticket must either create a shared utility as a deliverable or have a prerequisite ticket. Re-implementing shared logic inline is a Fail.

This also applies to `Field()` constraint parameters — if a canonical location already defines the boundary value, the ticket must import from there. Inline literals when equivalent constants or types exist is a Fail on Check 20.

**Check 21 — SDK version pinned and API verified:** Applies only to tickets that introduce or use a third-party SDK. Skip with Pass if no external SDK dependency. Otherwise two sub-checks:

1. **Version constraint is pinned to a major version.** Must use a bounded constraint (e.g., `>=4.0,<5.0`), not an open floor. Open floor is a Fail.
2. **Implementation note code is verified against the installed SDK.** Use Step 3b results. Code written from memory without verification is a Fail.

**Check 22 — Blast radius documented:** Applies to tickets that change any public-facing interface — API endpoints, SDK methods, request/response schemas, status codes, or shared internal interfaces (port methods, domain models, enums) consumed by other components. Skip with Pass if the ticket makes no public interface changes. Otherwise evaluate these sub-checks:

1. **API contract changes explicitly listed.** If the ticket changes anything a consumer sees — endpoint URL, HTTP method, status code, request body fields, response body shape, field types, enum values, or function signatures in client libraries — the ticket must include a **Contract Changes** section (or equivalent in Implementation Notes) that lists every change in a before/after format. Examples: "`POST /v1/packs/generate` response changes from 200 to 202", "new `status: 'generating'` value added to response", "`GeneratePackResponse` replaced by `GeneratePackAcceptedResponse`". Undocumented contract changes are a Fail.

2. **External callers identified.** The ticket must list every external system, client library, or application that calls the changed interface. Use codebase knowledge (CLAUDE.md, spec docs) and grep for usages of the changed function/endpoint/model within the source root. If the ticket changes a public API endpoint, list known consumers (e.g., Cerebro, demo app, client libraries). Missing consumer list is a Fail.

3. **Migration strategy stated.** For breaking changes, the ticket must describe how consumers will transition — coordinated deploy, feature flag, versioned endpoint, backwards-compatible period, or "consumers updated in same release." Unstated migration for a breaking change is a Fail. Non-breaking changes (additive fields, new endpoints) Pass automatically.

4. **Rollback plan considered.** If the change is hard to reverse (schema migration, enum value added to a DB column, status code change), the ticket should note whether rollback is safe or requires a migration. Missing rollback consideration for irreversible changes is a Flag.

**Check 23 — No silent bug introduction:** Analyze the ticket's proposed changes for potential bugs or failure modes that are not covered by the Acceptance Criteria or Unit Tests. This check requires reading the source code in the Deliverables (or the files being modified) to identify risks. Evaluate these sub-checks:

1. **Race conditions.** If the ticket introduces async operations, concurrent writes, or status transitions, verify that the ticket addresses what happens when two operations overlap (e.g., regenerate while generating, duplicate submissions). Unaddressed race conditions are a Flag.

2. **Orphaned state.** If the ticket creates placeholder or intermediate state (e.g., a row with status "pending" or "generating"), verify that the ticket addresses cleanup when the operation fails, crashes, or times out. Permanent orphaned state with no cleanup mechanism is a Fail.

3. **Data leakage.** If the ticket introduces new statuses, intermediate objects, or placeholder rows, verify that these are filtered from list/query endpoints and not visible to consumers before they're ready. Unfiltered intermediate state in list endpoints is a Flag.

4. **Implicit contract changes.** If the ticket modifies internal behavior that external callers depend on (e.g., changing a synchronous function to async, adding a new required field, changing return semantics), verify that all call sites are updated in the Deliverables. Missing call site updates are a Fail.

For any **Flag** or **Fail**, note the issue and suggested fix — these go in the addendum, not in the checklist table.

**After the checklist:** If `fix_mode` is active AND there are any Flags or Fails, proceed to Step 5b (fix path). Otherwise, proceed to Step 5 (audit path).

---

# AUDIT PATH (default — no `--fix` flag)

Steps 5 through 8 run when `fix_mode` is false.

---

## Step 5: Open Questions

After running the checklist, list any open questions a developer would need resolved before safely starting work.

**If there are open questions:** ask the user each one directly and wait for answers before proceeding.

**If there are no open questions:** skip this step.

Incorporate all answers into the flags/required changes before publishing.

---

## Step 6: Review Findings with User

**If there are no flags or fails (all checks pass):** skip this step and proceed directly to Step 7.

**If there are any flags or fails:** present every issue to the user before touching the issue tracker. Use this format for each one:

```
**Issue #<N> — Check <#> — <short title>**
Problem: <one sentence describing what's wrong>
Proposed fix: <one sentence describing the change to be made to the ticket>
```

After listing all issues, ask the user two things:
1. Does each proposed fix look right, or should the wording change?
2. Are there any issues you want to dismiss (not include in the update)?

**Wait for explicit approval before proceeding.** Do not call `update_issue` until the user confirms.

Apply every user-requested change to the fix wording before constructing the addendum in Step 7. If the user dismisses an issue, remove it from the Flags and Required Changes sections entirely.

---

## Step 7: Publish Review to Issue

Write the review to the ticket, ensuring exactly one review block exists at all times.

1. Read the current description from the issue already fetched in Step 2.
2. Construct the addendum (see format below).
3. Determine placement based on whether a `prior_review` was found in Step 2:

   **If prior review was in the description:**
   - Strip everything from the `\n\n---\n\n` separator that precedes the existing `## Review` block to the end of the description.
   - Call `update_issue` with: stripped description + `\n\n---\n\n` + new addendum.

   **If prior review was in a comment:**
   - Call `delete_comment` with the comment ID noted in Step 2.
   - Call `update_issue` with: full current description + `\n\n---\n\n` + new addendum.

   **If no prior review exists:**
   - Call `update_issue` with: full current description + `\n\n---\n\n` + new addendum.

### Addendum format

```
## Review

**Date:** <ISO-8601 date>
**Verdict:** Good to go | Minor flags | Needs revision
**Results:** <N> Pass · <N> Flag · <N> Fail

| # | Check | Result |
|---|-------|--------|
| 1 | Connects to pipeline goal | Pass |
| 2 | Fits sprint theme and build order | Pass |
...all 23 rows...

**Flags**

- **Flag #1 — <short title>:** <one-sentence issue>. Fix: <one-sentence fix>.

(Omit this section if no flags or fails.)

**Required Changes**

1. <specific change>

(Omit this section if verdict is not "Needs revision".)

**Open Questions Resolved**

- <question> → <answer>

(Omit this section if no questions were raised.)
```

Keep the addendum tight — only what is needed for the implementer to act.

---

## Step 8: Report to User

Show a compact summary in the conversation:

```
**<TICKET-ID> — <title>**
Verdict: Good to go | Minor flags | Needs revision
Results: <N> Pass · <N> Flag · <N> Fail

<Flag #1 — one-line summary if any>
<Flag #2 — one-line summary if any>

Review appended to the ticket.
Branch: <branch-name>
```

---

# FIX PATH (`--fix` flag active)

Steps 5b through 8b run when `fix_mode` is true AND the checklist produced Flags or Fails.

If `fix_mode` is true but all 23 checks passed, skip to Step 7b directly (publish passing review, no rewrite needed).

---

## Step 5b: Deep Codebase Research

This is the critical step. Every change to the ticket description must be grounded in code that was actually read — never written from memory.

### 5b-i. Identify ticket type and required sections

Detect the ticket type from the description (`**Type:** Implementation | Fix | Ops/Chore`). If no type line is present, infer from the ticket labels and title:
- Label "Bug" or title contains "fix" → **Fix**
- Label "Feature" or title contains "add", "create", "implement" → **Implementation**
- Otherwise → ask the user

**Required sections by type:**

| Section | Implementation | Fix | Ops/Chore |
|---------|:-:|:-:|:-:|
| Context | Y | Y | Y |
| Inputs | Y | Y | Y |
| Deliverables | Y | Y | Y |
| Implementation Notes | Y | Y | Y |
| Acceptance Criteria | Y | Y | Y |
| Unit Tests | Y | Y | - |
| Manual Verification Steps | - | - | Y |
| References | Y | Y | optional |

**Fix tickets additionally require:** Unit Tests must open with a `**Regression:**` category.

### 5b-ii. Read every source file referenced by the ticket

For each file path in the Deliverables (existing or implied), read the full file. Record:
- Current imports, function signatures, class structure
- What the ticket wants to change and where the change fits
- Any helpers, constants, or patterns already in use at that location

### 5b-iii. Trace dependencies

For each change the ticket describes:
- What modules, models, or functions does the implementation need to import?
- Do those exist? Are they exported from the expected location?
- Are there existing functions that already do the same thing (potential duplication)?
- What is the correct test file name? (Verify — do not guess.)

### 5b-iv. Check canonical utilities

Search the **Canonical Utility Locations** from config for any validators, constants, or helpers relevant to the ticket's changes.

### 5b-v. Check for pattern-wide changes

If the ticket replaces or removes a pattern across files, grep for it and record every hit — each must appear in the Deliverables.

### 5b-vi. Resolve implementation ambiguities

Identify questions that an implementer would need answered. For each one, find the answer in the code. Common ambiguities:
- Which function signature or model field to use (read the model definition)
- Whether to reuse an existing helper or write a new one (read the helper, compare scope)
- How a dependency is wired (read the wiring/harness code)
- What version/value to use for a field (read the model constraints)

---

## Step 6b: Rewrite the Ticket Description

Using research from Step 5b, construct a complete ticket description with all required sections.

### General rules
- Preserve the original Context intent — do not change what the ticket is trying to do
- Every file path must be verified against the actual codebase (correct name, correct location)
- Every implementation detail must be grounded in code read in Step 5b
- Use only canonical terminology from the spec documents
- Add a scope boundary statement ("Does NOT change...")
- The ticket type line (`**Type:** ...`) must be the first line of the description
- Ordering notes (e.g., "Implement BEFORE ...") come immediately after the type line

### Section-specific rules

**Context:** Keep the original reasoning. For Fix tickets, ensure root cause is stated. Add "what depends on this" if missing.

**Inputs:** List every direct dependency by ticket ID. Reference the specific deliverable from each dependency.

**Deliverables:** List every file that will be created or modified, with a one-line description. Test files are always listed. Use verified file paths from Step 5b — if a test file has a different name than expected, use the real name.

**Implementation Notes:** Address:
- Exactly which functions/classes to modify and how
- Key design decisions with rationale grounded in code constraints
- What NOT to do and why
- New imports needed
- Anything that would otherwise require the implementer to ask a question

**Acceptance Criteria:** Numbered, pass/fail testable. No subjective language. Include edge cases.

**Unit Tests (Implementation/Fix):** Explicit test names grouped by category. For Fix tickets, open with `**Regression:**`. Map every AC to at least one test. Include error/edge case tests.

**Manual Verification Steps (Ops/Chore):** Numbered, executable commands.

**References:** Specific spec sections, not whole documents. Include relevant source file locations.

### Present the rewrite to the user

Show a summary of changes:
```
**Sections added:** <list>
**Sections modified:** <list>
**Key decisions resolved:** <list of implementation ambiguities resolved>
**File paths corrected:** <list, if any>
```

Ask: "Update the ticket with this rewritten description?"

**Wait for explicit approval before proceeding.** Do not call `save_issue` until the user confirms.

---

## Step 7b: Re-verify and Publish

1. Re-run the 23-check checklist against the rewritten description. All checks should now pass. If any still fail, flag them to the user and ask whether to proceed or iterate.

2. Construct the review addendum (same format as Step 7's addendum) reflecting the post-rewrite checklist results.

3. Call `save_issue` with `id` set to the ticket identifier and `description` set to: rewritten description + `\n\n---\n\n` + review addendum.

   If a `prior_review` existed in the original description, it is naturally replaced since the entire description is being rewritten.

---

## Step 8b: Report to User

Show a compact summary:

```
**<TICKET-ID> — <title>**
Verdict: Good to go (after fix)
Results: <N> Pass · <N> Flag · <N> Fail (before fix) → 23 Pass (after fix)

Sections added: <count>
Key decisions resolved: <count>
File paths corrected: <count>

Ticket rewritten and review appended.
Branch: <branch-name>
```

---

# Rules (apply to both paths)

- The checklist table shows only Pass/Flag/Fail — no notes column.
- Flags and fails get detail in the Flags section, not in the table.
- Resolve all open questions with the user before publishing.
- **Never call `save_issue` or `update_issue` without user approval** — in audit mode, approval is required when there are flags/fails; in fix mode, approval is always required before rewriting.
- The user may change the wording of any proposed fix or dismiss any issue entirely. Honor both without argument.
- If the issue description contains images, view them with `extract_images`.
- Check comments for decisions that supersede the description.

### Fix-mode specific rules

- NEVER write implementation notes from memory — every technical detail must come from reading actual source files in Step 5b.
- NEVER guess file paths — verify against the codebase. If a file doesn't exist, note it.
- NEVER invent acceptance criteria that contradict the original ticket intent.
- Preserve the original ticket's goal and scope — only fill gaps, don't expand scope.
- If research reveals that the ticket's approach is fundamentally flawed (e.g., the function it plans to modify doesn't exist), flag this to the user instead of silently rewriting.

### Audit-mode specific rules

- The addendum is always appended — never replace or modify the core ticket content. When a prior review exists, strip only the prior review block (the `\n\n---\n\n` separator that precedes it and everything after) before appending the new one. Core ticket content is always preserved. There is exactly one review block per ticket at all times.
- Do NOT modify the ticket description during the review phase — only append the addendum in Step 7.
