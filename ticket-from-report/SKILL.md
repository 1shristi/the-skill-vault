# Ticket From Report

Walk through a skill-generated report, review each finding with the user, and create Linear tickets on approval. Supports resuming mid-session across context window boundaries.

## Usage

- `/ticket-from-report` — load the most recently modified report in the Report directory
- `/ticket-from-report .claude/skill-reports/refactor-check-2026-02-26.md` — load a specific report file
- `/ticket-from-report --from <ID>` — resume from a specific finding ID (e.g., `--from W4`)
- `/ticket-from-report <path> --from <ID>` — specific file, starting from a specific finding

The `--from <ID>` flag treats the named finding as the first one to present, regardless of its current Status in the file. All findings before it are skipped. This is the resume mechanism — use it when continuing after a context window boundary.

---

## Before Starting: Load Project Config

Read `.claude/skill-config.md` and resolve the following values. If the file does not exist, stop and print:
> No skill-config.md found. Create `.claude/skill-config.md` in this project with Linear team name, Linear project name, issue prefix, report directory, and ticket format standard path.

Values to resolve:
- **Issue prefix** — from `Issue prefix` (e.g., `ORU`)
- **Linear team name** — from `Linear team name`
- **Linear project name** — from `Linear project name`
- **Report directory** — from `Report directory` (e.g., `.claude/skill-reports/`)
- **Ticket format standard** — path from `Ticket format standard` under Reference Documents

Use these values throughout — never substitute hardcoded project names.

---

## Before Starting: Load and Validate the Report

### Step 1 — Resolve the report file

If a path is provided, use it. If not, list all files in the Report directory, sort by modification time, and use the most recently modified file.

If the Report directory does not exist or is empty, stop and print:
> No report found. Run a skill that generates a report first (e.g., `/refactor-check`), then come back.

### Step 2 — Parse the findings

Read the report and extract all finding blocks. A finding block begins with a line matching:

```
### <ID> — <Category>: <Title>
```

where `<ID>` is a string like `C1`, `W1`, `S1`, `C2`, etc. (one or more capital letters followed by one or more digits).

For each block, extract:
- `id` — the finding identifier (e.g., `C1`)
- `category` — the category string
- `title` — the short title
- `severity` — from the `**Severity:**` line
- `location` — from the `**Location:**` line
- `finding` — from the `**Finding:**` line
- `breaks_risk` — from the `**Breaks/Risk:**` line
- `root_cause` — from the `**Root cause:**` line
- `fix_options` — from the `**Fix options:**` block (all option bullets)
- `prevention_retrospective` — from the `**Prevention — retrospective:**` line
- `prevention_forward` — from the `**Prevention — forward:**` line
- `status` — from the `**Status:**` line (value: `pending`, `ticketed: <prefix>-XX`, or `skipped`)

### Step 3 — Build the work queue

1. Collect all findings where `status = pending`.
2. If `--from <ID>` is given, drop all findings that appear before `<ID>` in document order, regardless of their status. The named finding and everything after it that is `pending` enters the queue.
3. Sort the queue: all Criticals first, then Warnings, then Suggestions. Within each level, preserve document order.
4. If the queue is empty, print:

> All findings in this report are already resolved (ticketed or skipped). Nothing left to do.

### Step 4 — Print the opening checklist

Print the full ticket checklist showing every finding in the report (not just pending ones), with current status:

```
## Ticket Checklist — <report filename>
Source: <Report directory>/<filename>
Findings: <N> Critical · <N> Warning · <N> Suggestion
Pending: <N>

| Status | ID | Category | Title |
|--------|----|----------|-------|
| [✓] <prefix>-XX | C1 | Architecture | <title> |
| [-] skipped | W1 | Duplication | <title> |
| [→] current | W2 | Port Contract | <title> |
| [ ] pending | W3 | Magic Values | <title> |
| [ ] pending | S1 | Type Hints | <title> |
```

Status key:
- `[ ] pending` — not yet reviewed
- `[→] current` — the first finding about to be presented
- `[✓] <prefix>-XX` — ticket created (show ticket identifier using the resolved issue prefix)
- `[-] skipped` — user said no

Mark the first finding in the queue as `[→] current`.

Then print:
> Ready. I'll go through each finding one by one. You can answer **yes**, **no**, or **skip remaining suggestions** at any point.

---

## Finding Presentation Loop

Work through the queue in order. For each finding:

### Step 1 — Reprint the checklist

Before presenting each finding, reprint the full checklist with updated statuses so the user always knows where they are.

### Step 2 — Present the finding

Print the finding in this format:

```
---
**<ID> — <Category>: <Title>**
Location: `<file:line>`
Severity: Critical | Warning | Suggestion
Breaks/Risk: <one sentence>

**Root cause:** <from report>

**Fix options:**
<all option bullets from report, formatted as a numbered list>

**Prevention — retrospective:** <from report>
**Prevention — forward:** <from report>

Which fix option do you prefer? (Enter option letter, or state your own)
Then: Create a ticket for this? (yes / no / skip remaining suggestions)
```

Wait for the user's response. The user may respond in one message (e.g., "Option A, yes") or in two separate messages.

### Step 3 — Handle the response

**yes (with a chosen fix option):**
1. Note which fix option the user chose (or their stated alternative).
2. Draft the ticket — see Ticket Format below.
3. Show the draft to the user and ask: "Create this ticket?"
4. On confirmation: create the ticket in Linear using the resolved Linear team name and project name.
5. Update the finding's `**Status:**` line in the report file from `pending` to `ticketed: <prefix>-XX`.
6. Print: `✓ Ticket created: <prefix>-XX — <title>`
7. Move to the next finding.

**yes (no fix option chosen yet):**
Ask: "Which fix option would you like to go with? (A, B, C, or describe your own)" then proceed as above once answered.

**no:**
1. Update the finding's `**Status:**` line in the report file from `pending` to `skipped`.
2. Move to the next finding immediately.

**skip remaining suggestions:**
1. Mark all remaining Suggestion-level findings in the queue as `skipped` in the report file.
2. Print: `Skipped all remaining Suggestion-level findings.`
3. If any Warning or Critical findings remain in the queue, continue with those. Otherwise stop.

**False positive (user says "this is a false positive"):**
1. Update the finding's `**Status:**` line to `false_positive`.
2. Note it in the checklist as `[~] false positive`.
3. Move to the next finding.

---

## Ticket Format

For each approved finding, create a Linear ticket in the team and project resolved from skill-config.md.

Follow the ticket format standard from skill-config.md exactly. Keep every section concise — most findings produce chore or refactor tickets, not feature tickets.

**Title format:** `[Chore] <one-line description of what to fix>` (or `[Refactor]` if the change restructures existing code rather than removing a violation)

**Context:** Reference the finding ID and the report file it came from. One sentence on why this matters.

**Inputs:** Reference the ticket(s) that originally delivered the code being refactored. If it's foundational code with no clear ticket origin, write "None — baseline code."

**Deliverables:** List only the files that need to change. Include the test file only if test changes are required. When a finding has a Prevention line (and it is not a one-off), include the `CLAUDE.md` or skill update as a deliverable alongside the code fix.

**Implementation Notes:** Name the fix option chosen by the user. Describe the specific change — what to replace, what to delete, what to extract. No ambiguity.

**Acceptance Criteria:** One criterion per change. Each must be pass/fail verifiable.

**Unit Tests:** Only include tests if the change affects behavior. Style-only changes (docstrings, type hints) do not need new tests — state this explicitly.

**References:** Point to the relevant CLAUDE.md anti-pattern or convention section, not the full document.

**Label:** Apply `chore` or `refactor` label if available in the workspace.

**Prevention deliverable:** When the fix option includes a CI test or doc rule update, add it explicitly to Deliverables. Write the rule broadly enough to cover the class of problem. If another ticket from this session already addresses the same prevention, note the cross-reference in Context instead of duplicating it.

---

## Completion

After the queue is exhausted, print a final summary:

```
## Session Complete — <report filename>

| Outcome | Count | Tickets |
|---------|-------|---------|
| Ticketed | N | <prefix>-XX, <prefix>-YY, ... |
| Skipped | N | C1, W3, ... |
| False positives | N | — |
| Remaining pending | N | — |

Report file updated: <Report directory>/<filename>
```

If any findings remain `pending` (e.g., session ended before all were reviewed), add:

> To continue in a new session, run:
> `/ticket-from-report <Report directory>/<filename> --from <next-pending-ID>`

---

## Rules

- Never create a ticket without explicit user approval for that specific finding.
- Never group multiple unrelated findings into one ticket. One finding = one ticket. Exception: two findings in the same file that are tightly related (e.g., two adjacent magic values) may be combined with clear scope.
- Always update the report file's `**Status:**` line immediately after each decision — before moving to the next finding. This ensures the file reflects state even if the session ends mid-loop.
- Severity is non-negotiable: Critical findings are always Critical regardless of how small the fix appears.
- Keep ticket descriptions tight. A refactor ticket should not take more than a single focused session to implement.
- This skill is generic — it works with any report that follows the standardized finding block format. The report's source (refactor-check or any other skill) does not affect how this skill behaves.
- Do not re-analyse or second-guess the fix options in the report. The analysis was done when the report was generated. Present the options as written; the user's job is to choose.
