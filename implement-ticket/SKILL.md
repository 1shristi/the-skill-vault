# Implement Ticket

> **PREREQUISITE:** This skill requires `.claude/skill-config.md` in the project root. Step 0 checks for it. If the file is missing, the skill MUST stop immediately and will not proceed under any circumstances.

Implement a reviewed ticket. Reads the review addendum from the issue tracker, verifies prerequisites, produces every file in the Deliverables, and verifies every Acceptance Criterion. Does not create anything outside the ticket scope.

## Usage

```
/implement-ticket ORU-5
```

Accepts an issue identifier. If no identifier is provided, ask the user which ticket to implement.

---

## Step 0: Load Config

**This is the first and mandatory step. Do not proceed to any other step until this check passes.**

Run:
```
test -f .claude/skill-config.md || echo "CONFIG_MISSING"
```

**If the output is `CONFIG_MISSING`:** Output this message exactly, then STOP. Do not execute Step 1 or any subsequent step under any circumstances.
> "Cannot run `/implement-ticket`: no `.claude/skill-config.md` found in this project. Create the config file first — see the user-level skill for the required format."

**If the command produces no output:** Read `.claude/skill-config.md` and extract the config values below.

Extract and hold these values for use throughout the skill:
- **Reference documents** — the paths listed (Reference Documents section)
- **Ticket dependency map** path (Reference Documents section)
- **Architecture rules** — the full list (Architecture Rules section)
- **Tech stack** — the full list (Tech Stack section)

---

## Step 1: Load the Review from the Issue Tracker

1. Call `get_issue` with the ticket identifier (e.g., `ORU-5`).
2. Find the `## Review` addendum section at the bottom of the description.

**If no `## Review` addendum exists:**
> "No review found for `<ticket_id>`. Run `/review-ticket <ticket_id>` first."
> Stop.

**If the addendum verdict is `Needs revision`:**
> "The review for `<ticket_id>` is marked **Needs revision**. Resolve the Required Changes listed in the ticket before implementing."
> Show the Required Changes from the addendum.
> Stop.

**If verdict is `Good to go` or `Minor flags`:**
- Read the full ticket description. All implementation decisions flow from the ticket's own sections:
  - **Deliverables** — the exact files to produce
  - **Implementation Notes** — technical guidance
  - **Acceptance Criteria** — pass/fail conditions to verify
  - **Unit Tests** — tests to write
- Note any flags from the addendum — be aware of them when implementing. Do not treat flags as blockers unless they are structural (e.g., a missing dependency).

---

## Step 2: Branch Check

Run `git branch --show-current`.

The current branch must match the pattern `*/<issue-id-lowercase>/*` (e.g., `feature/oru-5/...`).

**If on the wrong branch:**
> "You are on `<current-branch>`, not a branch for `<ticket_id>`. Run `/review-ticket` with the correct ticket, or check out the ticket branch manually."
> Stop.

---

## Step 3: Verify Inputs

Read the **Inputs** section from the ticket description.

For tickets with `None — this is a root ticket`, skip this step.

For each listed input dependency:
1. Identify what file(s) that dependency delivers (from the project structure and the **Ticket dependency map** from config if needed).
2. Check that the key deliverable files exist on disk.

**If any input's deliverables are missing:**
> "Missing input: **<ticket-id>** — `<expected file path>` does not exist. This ticket depends on that work being complete first."
> List all missing inputs.
> Stop.

---

## Step 3b: Mark Ticket In Progress

All pre-checks have passed — development is starting. Update the issue now:

1. Fetch the issue: use `get_issue` with the ticket identifier.
2. Find the "In Progress" state: use `list_issue_statuses` with the team from the issue.
3. Update the issue: use `update_issue` to set `state` to "In Progress".
4. Confirm to the user:
   > "Ticket <ticket_id> marked as In Progress."

---

## Step 4: Load Spec Context

Before writing any code, read the spec sections referenced in the ticket's References section. Use the **Reference documents** paths from config.

Read only the sections cited — do not load entire documents unless the ticket references them broadly. Use these to resolve any ambiguity in the implementation notes.

Also read `CLAUDE.md` conventions if not already in context — especially the anti-patterns list.

---

## Step 5: Implement Deliverables

Work through the **Deliverables** section from the ticket description in order. For each file listed:

### 5a. Check if the file already exists

- **Does not exist** → create it.
- **Exists and is empty (only `__init__.py` stub)** → populate it.
- **Exists with content** → read it first. Understand what's there, then update only what's needed. Do not rewrite working code.

### 5b. Implement the file

Follow these rules exactly:

**Scope**
- Produce only what the ticket's Deliverables list. Nothing more.
- Do not create helper files, utilities, or abstractions not in the list.
- Do not modify files outside the Deliverables list.
- Do not add docstrings, comments, or type annotations to code not touched by this ticket.

**Architecture rules (hard constraints — from config)**

Apply every rule listed under **Architecture Rules** in config. These are blockers; violating any of them breaks the architecture.

**Code quality (from config)**

Apply every convention listed under **Tech Stack** in config.

**Implementation choices left to the implementer**
- When the Implementation Notes say "implementer decides X", make the most sensible choice for the project context and state it explicitly in a comment at the top of the file:
  ```
  # Implementation choice: <decision and rationale>
  ```

### 5c. Announce each file as you complete it

After finishing each file, briefly confirm:
> `src/path/to/file.py` — created

---

## Step 6: Verify Acceptance Criteria

Work through each item in the **Acceptance Criteria** section from the ticket description and verify it passes.

For each criterion, use the most direct verification method:

| AC type | How to verify |
|---------|--------------|
| File/directory exists | Check with Glob or Read |
| Import succeeds | Run `python -c "import ..."` via Bash |
| `pip install -e .` succeeds | Run the command via Bash |
| `pytest <file>` passes | Run via Bash |
| `.gitignore` contains entries | Read the file and check |
| `pyproject.toml` version pins | Read and parse |
| Model field validation | Reason from the code, or run a quick python -c snippet |

**For every AC, record the result:**

```
AC1: `pip install -e .` succeeds — PASS
AC2: `import <module>` succeeds — PASS
AC8: fixtures subdirs exist — FAIL — tests/fixtures/web/ missing
```

**If any AC fails:**
- Fix the gap immediately (within this ticket's scope).
- Re-verify after fixing.
- If the fix would require work outside this ticket's Deliverables, flag it:
  > "AC9 requires X, which is delivered by a separate ticket (not in scope here). This AC will be verifiable after that ticket is complete."

---

## Step 7: Report

Provide a final implementation summary:

```
## Implementation Complete: <ticket_id> — <title>

### Files Produced
- `<path>` — created
- `<path>` — created
- `<path>` — populated (was a stub)
(list every file from Deliverables)

### Acceptance Criteria
- AC1: PASS — <brief note>
- AC2: PASS
- AC8: PASS
(list all ACs)

### Implementation Choices Made
- <any "implementer decides" choices, with rationale>

### Flags Noted (from review addendum)
- <repeat any flags from the ticket's Review addendum, with status: addressed / still applies / not applicable>

### Next steps
Run `/test-and-fix` to execute the unit tests and fix any failures.
```

---

## Rules

- **Never produce files not in the Deliverables list.** If you realize a helper is needed, add it as a note in the summary for the user to decide whether to ticket it.
- **Never modify files outside the Deliverables list.** If another file needs a small change to make this ticket work, flag it rather than silently editing it.
- **Never skip an AC** — verify every single one. If you can't verify it (e.g., it depends on a missing input), say so explicitly.
- **Never weaken an AC** — if an AC says "X must raise ValidationError", make sure it does.
- **If the review addendum has `Needs revision` verdict**, do not proceed with implementation. Send the user back to fix the ticket.
- **If an input is missing**, stop and report it. Do not attempt to implement the dependency inline.
- **Do not run the full test suite** — only run the test file(s) listed in Deliverables during AC verification.
- Follow all architecture rules and code quality conventions from config at all times.
