---
name: detail-exploration
description: Detail approved tickets or user stories from an /explore-app run. Reads the exploration report and plan, fleshes out selected items, and iterates on feedback. Resumable. Usage: /detail-exploration [IDs] or /detail-exploration all
---

# Detail Exploration

> **PREREQUISITE:** Requires a completed `/explore-app` run with an exploration report and plan in the output directory. This skill reads `.claude/skill-config.md` for the **Explore App Settings** section.

Take the plan produced by `/explore-app` (ticket plan or story plan), flesh out the approved items into detailed files, and iterate on user feedback until finalized.

## Usage

```
/detail-exploration EX-01 EX-02 EX-03     # detail specific items
/detail-exploration EX-01 through EX-05    # detail a range
/detail-exploration all                     # detail everything in the plan
/detail-exploration                         # resume from where you left off
```

---

## Step 0: Load Config & Determine Scope

1. Read `.claude/skill-config.md` → extract **Explore App Settings** (output directory, ticket prefix, ticket format, output mode).
2. Read the progress log at `{output_dir}/PROGRESS.md`.
   - If Step 4 (Report & plan) is not COMPLETE → stop: `Run /explore-app first to generate the plan.`
   - If detailing is IN PROGRESS → resume from first PENDING item
3. Determine output mode from the progress log or config (`tickets` or `user-stories`).
4. Read the plan file:
   - `tickets` mode → `{output_dir}/TICKET_PLAN.md`
   - `user-stories` mode → `{output_dir}/STORY_PLAN.md`
5. Parse arguments to determine which items to detail:
   - Specific IDs → detail only those
   - `all` → detail everything in the plan
   - No args + items already in progress → resume
   - No args + no items started → ask which to detail
6. Record user decisions in the progress log (approved/skipped items).

---

## Step 1: Detail Each Item

Process items sequentially. For each item, read the exploration report sections relevant to it, then produce the detail file.

### Ticket Format (when mode is `tickets`)

Save to `{output_dir}/tickets/{prefix}-{NN}.md`:

```markdown
## [{prefix}-{NN}] {Title}

### Context
Why this screen/feature exists and what depends on it.

### Screen Reference
- **URL:** {page URL}
- **Screenshot:** `{path}`

### Inputs (dependencies)
- **{prefix}-{NN}** — what it provides
- Or: "None — root ticket"

### Features to Implement
Numbered list with DOM structure references from the exploration.

### API Data Requirements
Endpoints, request/response schemas, query params — labeled "inferred from UI".

### Design Tokens Used
Typography, colors, components from the design system extraction.

### Code References (DOM Structure)
Key selectors, element hierarchy, class names from the accessibility snapshots.

### Acceptance Criteria
Numbered, pass/fail testable.

### Verification
How to confirm this ticket is complete — visual and interaction checks.

### References
Screenshot paths, snapshot paths, exploration report sections.
```

If ticket format is `standard`, read the project's `TICKET_STANDARD.md` and use that structure instead, mapping: Features → Implementation Notes, API Requirements → Implementation Notes, Verification → Unit Tests.

### User Story Format (when mode is `user-stories`)

Save to `{output_dir}/stories/US-{NN}.md`:

```markdown
## [US-{NN}] {Story Title}

### User Story
**As a** {persona}  **I want to** {action}  **So that** {outcome}

### Context & Motivation
Why this matters, what problem exists, what happens without it.

### User Flow
Step-by-step walkthrough across screens.

### Screens Involved
| Screen | URL | Screenshot |

### What the User Sees
Data displayed, interactive elements, user actions — from the user's perspective.

### Business Rules & Logic
Sorting defaults, filter behavior, status transitions, AI-generated content handling.

### Acceptance Criteria
Pass/fail from the user's perspective, not technical.

### Edge Cases & Open Questions
Zero-state, scale, permissions, data consistency — items for PM/eng discussion.

### Priority & Dependencies
Priority, depends on, enables.

### Engineering Notes
Non-prescriptive: API data needed, UI components, design tokens, accessibility.

### References
Screenshots, related stories, exploration report sections.
```

### After each item

Update the progress log:

```markdown
| Item | Title | Status | Revisions |
|------|-------|--------|-----------|
| EX-01 | ... | DONE | 0 |
| EX-02 | ... | IN PROGRESS | 0 |
| EX-03 | ... | PENDING | 0 |
```

---

## Step 2: Post-Generation Review

After all approved items are detailed, present a summary:

```
Detailing complete!

| ID | Title | Dependencies | Complexity/Priority |
|----|-------|-------------|---------------------|
| ... | ... | ... | ... |

Saved to: {output_dir}/tickets/ (or /stories/)

You can:
1. Revise specific items ("EX-03 needs more detail on filter behavior")
2. Merge or split items
3. Re-estimate complexity/priority
4. Add missing items
5. Say "looks good" to finalize
```

Handle feedback by reading the file, applying changes, re-presenting. Track revision count in the progress log.

Update progress log: `Step 6: Review — COMPLETE` (or IN PROGRESS with revision count).

---

## Resume Logic

- Items marked DONE → skip
- Items marked IN PROGRESS → re-detail from scratch
- Items marked PENDING → detail next
- If all items DONE → jump to Step 2 (review)
- Progress log is the single source of truth

---

## Important Rules

1. **One item, one responsibility** — each ticket/story is independently implementable
2. **Reference the exploration report** — every detail should trace back to a specific section, screenshot, or snapshot
3. **User gate is mandatory** — always present for review in Step 2; never auto-finalize
4. **Keep iterating** — stay in the review loop until the user says "looks good"
5. **API schemas are inferred** — always label as such unless an API spec was provided
