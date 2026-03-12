# Review Ticket

> **PREREQUISITE:** This skill requires `.claude/skill-config.md` in the project root. Step 0 checks for it. If the file is missing, the skill MUST stop immediately and will not proceed under any circumstances.

Validate an implementation ticket against the project specs before work begins. Catch problems before they become code.

## Usage

Invoke with an issue identifier: `/review-ticket ORU-7`

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

---

## Step 4: Run the Checklist

Evaluate all 21 checks. For each, assign exactly one verdict: **Pass**, **Flag**, or **Fail**.

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

For any **Flag** or **Fail**, note the issue and suggested fix — these go in the addendum, not in the checklist table.

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
...all 21 rows...

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

## Rules

- The addendum is always appended — never replace or modify the core ticket content. When a prior review exists, strip only the prior review block (the `\n\n---\n\n` separator that precedes it and everything after) before appending the new one. Core ticket content is always preserved. There is exactly one review block per ticket at all times.
- The checklist table shows only Pass/Flag/Fail — no notes column.
- Flags and fails get detail in the Flags section, not in the table.
- Resolve all open questions with the user before publishing.
- Do NOT modify the ticket description during the review phase — only append the addendum in Step 7.
- **Never call `update_issue` when there are flags or fails without first completing Step 6.** User approval is required before the issue tracker is touched.
- The user may change the wording of any proposed fix or dismiss any issue entirely. Honor both without argument.
- If the issue description contains images, view them with `extract_images`.
- Check comments for decisions that supersede the description.
