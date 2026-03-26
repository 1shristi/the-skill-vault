---
name: explore-app
description: Autonomously explore a web app via Playwright — crawl every page, extract the design system, map features, infer API requirements, and propose a ticket or user story plan. Resumable. Usage: /explore-app https://example.com [--mode tickets|user-stories] [--ds design-system.md]
---

# Explore App

> **PREREQUISITE:** This skill reads `.claude/skill-config.md` for the **Explore App Settings** section. If the file is missing or has no such section, use defaults.

Crawl a web app, map every screen, extract the design system, infer API data requirements, and produce a plan (tickets or user stories) for user approval. Stops after the plan — use `/detail-exploration` to flesh out approved items.

## Usage

```
/explore-app https://example.com
/explore-app https://example.com --mode user-stories
/explore-app https://example.com --ds design-system.md
```

---

## Step 0: Load Config & Check Resume

1. Read `.claude/skill-config.md` → extract **Explore App Settings** values. Defaults:

| Setting | Default |
|---------|---------|
| Output directory | `exploration` |
| Progress log | `exploration/PROGRESS.md` |
| Output mode | `tickets` |
| Ticket prefix | `EX` |
| Max depth | `5` |
| Stay on domain | `true` |

2. CLI overrides: `--mode`, `--ds`, URL argument.
3. Check for existing progress log:
   - `IN PROGRESS` → resume from first incomplete step
   - `COMPLETE` → ask: `Start fresh or re-enter at /detail-exploration? (fresh/detail)`
   - Not found → proceed to Step 1

---

## Step 1: Pre-Crawl Interview

Ask the user (single list, answer all at once):

```
Before I start exploring:
1. Areas to focus on or prioritize?
2. Areas to skip or avoid?
3. Known bugs, gaps, or WIP sections?
4. Existing design system doc to cross-reference?
5. Existing API/backend spec to reference?
```

Merge answers into config. If user says "just go", proceed with defaults.

Update progress log: `Step 1: Interview — COMPLETE`

---

## Step 2: Crawl & Capture

Sequential Playwright session. For each page:

1. **Navigate** to URL
2. **Snapshot** accessibility tree (`browser_snapshot`)
3. **Screenshot** full page (`browser_take_screenshot`, `fullPage: true`)
4. **Extract design tokens** via `browser_evaluate` — use the script in `extract-tokens.js` (same directory as this skill). Run once for CSS variables (global), then only computed styles on subsequent pages.
5. **Catalog** all interactive elements: buttons, inputs, dropdowns, tabs, links, tables
6. **Explore sub-states**: click each tab, expand/collapse toggles, open dropdowns — snapshot each state
7. **Discover new links** from updated page state, add to queue

**Queue rules:**
- Filter external links (if stay on domain), skip paths, already-visited
- Prioritize focus paths
- Respect max depth
- Mark each page DONE in progress log after capture

**Resume:** Skip pages already marked DONE, continue from first PENDING.

Update progress log: `Step 2: Crawl — COMPLETE ({N} pages)`

---

## Step 3: Analyze & Synthesize

Launch **4 parallel agents** (no browser — they read saved snapshots/screenshots):

**Agent A — Feature Map:** Read snapshots + screenshots. Produce: feature inventory per page, user flows, data structures displayed, interactive behaviors. In `user-stories` mode, also identify user personas, end-to-end journeys, and business value signals.

**Agent B — Design System:** Read extracted tokens. Produce: color palette, typography scale, spacing, borders, shadows, component patterns. If DS ref exists, produce compliance audit (missing tokens, unused tokens, mismatches).

**Agent C — API Requirements:** Read snapshots + feature map. Produce: endpoints per screen, request/response schemas (TypeScript types), query params, mutation endpoints.

**Agent D — Recommendations:** Read all outputs. Produce: architecture suggestions, UX gaps, design system issues, data model concerns, missing features.

Update progress log: `Step 3: Analyze — COMPLETE`

---

## Step 4: Generate Report & Plan

### 4a: Compile Exploration Report

Save to `{output_dir}/EXPLORATION_REPORT.md`:

1. Pre-Exploration Interview (answers from Step 1)
2. Site Map (from Agent A)
3. Page-by-Page Feature Breakdown (from Agent A)
4. Design System Extraction (from Agent B; + compliance audit if DS ref provided)
5. API Data Requirements (from Agent C)
6. Navigation & Interaction Map (from Agent A)
7. Recommendations (from Agent D)
8. Key Observations

### 4b: Generate Plan

**Mode `tickets`:** Save to `{output_dir}/TICKET_PLAN.md`

```
| ID | Title | Description | Complexity |
|----|-------|-------------|------------|
| EX-01 | ... | ... | Low/Medium/High |
```

Group by: layout, pages, design system, AI features. One ticket per screen; separate tickets for complex tabs and shared components.

**Mode `user-stories`:** Save to `{output_dir}/STORY_PLAN.md`

```
| ID | User Story (As a... I want... So that...) | Priority | Screens |
|----|---------------------------------------------|----------|---------|
| US-01 | ... | High/Medium/Low | /path |
```

Group by persona/workflow, not by page. One story per user goal (can span screens).

### 4c: Present to User

Show summary + plan table. Ask:

> Which items should I detail? Specify IDs, ranges, or "all". You can also give feedback on grouping.
>
> When ready, run `/detail-exploration` to flesh them out.

Update progress log: `Step 4: Report & plan — COMPLETE`

---

## Important Rules

1. **Always interview first** — Step 1 is not optional
2. **Stay on domain** — never follow external links unless configured otherwise
3. **Screenshot everything** — every page and tab state; these are the implementation reference
4. **Capture before clicking** — snapshot + screenshot before interacting
5. **Read-only** — never submit forms, delete data, or change settings; only click tabs/toggles/dropdowns to observe
6. **User gate at Step 4c** — never auto-proceed to detailing; the user must approve the plan
7. **API schemas are inferred** — label as "inferred from UI" unless an API spec was provided
8. **Progress log is the resume contract** — update after every page and every step
