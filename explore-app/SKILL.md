---
name: explore-app
description: Autonomously explore a web app via Playwright, extract its design system, map all features, and generate implementation tickets or user stories. Resumable. Usage: /explore-app https://example.com [--mode tickets|user-stories] [--ds design-system.md]
---

# Explore App

Autonomously crawl a web application, map every screen and feature, extract the design system, infer API data requirements, and generate implementation tickets or user stories — all with user review gates.

**Two output modes:**
- `tickets` (default) — detailed implementation tickets with code references, API schemas, and design tokens for an engineering team to build from
- `user-stories` — product-oriented user stories with acceptance criteria, user flows, business context, and prioritization guidance for a PM-to-engineering handoff

---

## Overview

This skill runs in 6 phases:

1. **Pre-crawl interview** — ask the user scoping questions
2. **Crawl & capture** — navigate every page, snapshot, extract design tokens
3. **Analyze & synthesize** — build feature map, API requirements, recommendations
4. **Propose ticket plan** — summary table for user approval
5. **Detail approved tickets** — flesh out only the ones the user picks
6. **Post-generation review** — collect feedback, iterate

**Resumable:** Progress is tracked in a log file. If interrupted, the skill picks up from the last completed phase/page.

---

## Constants & Configuration

### Config file resolution

Read the project-level `skill-config.md` file at `{project_root}/.claude/skill-config.md`. Look for the **"Explore App Settings"** section to resolve all configuration values.

If `skill-config.md` does not exist or has no Explore App section, use these defaults:

| Setting | Default |
|---------|---------|
| Output directory | `exploration` |
| Progress log | `exploration/PROGRESS.md` |
| Screenshot format | `png` |
| Output mode | `tickets` |
| Ticket prefix | `EX` |
| Ticket format | `adapted` |
| Max depth | `5` |
| Stay on domain | `true` |
| Focus paths | _(none)_ |
| Skip paths | _(none)_ |
| Design system ref | `null` |
| API spec ref | `null` |
| Known issues | _(none)_ |

### CLI argument overrides

Arguments passed on the command line override `skill-config.md` values:
- `--mode tickets|user-stories` → overrides Output mode
- `--ds path/to/file` → overrides Design system ref
- Any URL argument → the target to crawl

---

## Phase 0: Pre-Crawl Interview

Before crawling, ask the user these questions using AskUserQuestion. Present them as a single numbered list so the user can answer all at once:

```
Before I start exploring, a few questions:

1. Are there specific areas of the site to focus on or prioritize?
2. Are there areas to skip or avoid (e.g., admin panels, settings)?
3. Are there known bugs, gaps, or WIP sections I should be aware of?
4. Is there an existing design system doc I should cross-reference? (I'll also extract tokens from the live site)
5. Is there an existing API or backend spec I should reference for data requirements?
```

Record the answers in the config (merge with `explore-config.json` if it exists):
- Answers to Q1 → `focus_paths`
- Answers to Q2 → `skip_paths`
- Answers to Q3 → `known_issues`
- Answers to Q4 → `design_system_ref`
- Answers to Q5 → store as `api_spec_ref` in the report

If the user says "just go" or similar, proceed with defaults.

**Update the progress log:**
```
Phase 0: Pre-crawl interview — COMPLETE
```

---

## Phase 1: Crawl & Capture

This phase navigates the app page by page, captures snapshots, screenshots, and extracts design tokens. It is sequential (single Playwright session).

### Step 1.1: Initialize

1. Create the output directory if it doesn't exist: `mkdir -p {output_dir}`
2. Initialize or read the progress log at `{progress_log}`
3. Navigate to the starting URL

### Step 1.2: Build Page Queue

Starting from the initial URL:

1. Take an accessibility snapshot (`browser_snapshot`)
2. Take a full-page screenshot (`browser_take_screenshot` with `fullPage: true`)
3. Extract all navigable links from the snapshot (links, nav items, buttons that navigate)
4. Filter links:
   - Remove external links if `stay_on_domain` is true
   - Remove links matching `skip_paths`
   - Prioritize links matching `focus_paths` (move to front of queue)
   - Remove already-visited URLs
5. Add filtered links to the page queue

### Step 1.3: Per-Page Capture

For each page in the queue:

1. **Navigate** to the URL
2. **Snapshot** the accessibility tree → save to `{output_dir}/snapshots/{page-slug}.yaml`
3. **Screenshot** full page → save to `{output_dir}/screenshots/{page-slug}.{format}`
4. **Extract design tokens** via `browser_evaluate`:

```javascript
() => {
  const result = { colors: {}, typography: {}, spacing: {}, borders: {}, shadows: {}, cssVariables: {} };

  // CSS custom properties from :root
  const sheets = document.styleSheets;
  for (const sheet of sheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
          const text = rule.cssText;
          const vars = text.match(/--[^:]+:\s*[^;]+/g) || [];
          vars.forEach(v => {
            const [name, ...val] = v.split(':');
            result.cssVariables[name.trim()] = val.join(':').trim();
          });
        }
      }
    } catch(e) {}
  }

  // Sample computed styles from key elements
  const elements = document.querySelectorAll('h1, h2, h3, p, a, button, table, th, td, input, nav, [class]');
  const colorSet = new Set();
  const fontSet = new Set();

  elements.forEach(el => {
    const s = getComputedStyle(el);
    colorSet.add(s.color);
    colorSet.add(s.backgroundColor);
    if (s.borderColor !== 'rgb(0, 0, 0)') colorSet.add(s.borderColor);
    fontSet.add(`${s.fontFamily}|${s.fontSize}|${s.fontWeight}|${s.lineHeight}`);
    if (s.boxShadow !== 'none') result.shadows[el.tagName + '.' + (el.className?.split?.(' ')?.[0] || '')] = s.boxShadow;
    if (s.borderRadius !== '0px') result.borders[el.tagName + '.' + (el.className?.split?.(' ')?.[0] || '')] = { radius: s.borderRadius, width: s.borderWidth, color: s.borderColor };
  });

  result.colors = [...colorSet].filter(c => c && c !== 'rgba(0, 0, 0, 0)');
  result.typography = [...fontSet].map(f => {
    const [family, size, weight, lineHeight] = f.split('|');
    return { family, size, weight, lineHeight };
  });

  return result;
}
```

5. **Catalog interactive elements** on the page:
   - All buttons (text, ref, disabled state)
   - All form inputs (type, placeholder, validation)
   - All dropdowns/selects
   - All tabs
   - All links (text, href)
   - All tables (columns, row count)
   - All modals/dialogs (if triggered)

6. **Explore sub-states** on the page:
   - Click each tab and snapshot the resulting content
   - Click expand/collapse toggles
   - Open dropdown menus to capture options
   - Note any disabled buttons and what enables them

7. **Discover new links** from the updated page state (tabs may reveal new navigation)

8. **Update the progress log** after each page:

```markdown
| Page | URL | Status | Screenshots | Tokens | Links Found |
|------|-----|--------|-------------|--------|-------------|
| Companies List | /companies | DONE | companies-full.png | yes | 5 |
| Company Detail | /companies/corevault-technologies | DONE | company-detail-*.png | yes | 3 |
| ... | ... | PENDING | — | — | — |
```

### Step 1.4: Design Token Extraction (Once)

Run the `browser_evaluate` script on the first page to get CSS variables (they're global). On subsequent pages, only extract computed styles to find page-specific additions.

### Depth Control

- Track click depth from the starting URL
- Stop following links beyond `max_depth`
- If a page has already been visited, skip it
- If a page is in `skip_paths`, skip it

### Resume Support

If the progress log shows pages already marked `DONE`:
1. Report: `Resuming crawl — {N} pages already captured, continuing from {next_page}...`
2. Skip all `DONE` pages
3. Continue from the first `PENDING` page

**Update the progress log:**
```
Phase 1: Crawl & capture — COMPLETE ({N} pages captured)
```

---

## Phase 2: Analyze & Synthesize

After crawling is complete, launch **parallel agents** to analyze the captured data. These agents do NOT use the browser — they work from the saved snapshots and token data.

### Agent A: Feature Map Builder

Prompt:
```
You are analyzing captured accessibility snapshots and screenshots from a web application.

Read all snapshot files in {output_dir}/snapshots/.
Read the screenshot images in {output_dir}/screenshots/.

For each page, produce:
1. A feature inventory — every interactive element, its purpose, and its behavior
2. User flows — how pages connect (navigation paths, breadcrumbs, tab flows)
3. Data displayed — what data is shown on each screen and how it's structured
4. Interactive behaviors — sorting, filtering, expanding, form submission, AI-powered actions

Output a structured feature map as markdown.
```

### Agent B: Design System Analyzer

Prompt:
```
You are analyzing design tokens extracted from a web application.

Read the design token data captured during crawling.
{If design_system_ref exists: Also read the existing design system doc at {design_system_ref} and cross-reference.}

Produce:
1. A unified design system document with:
   - Color palette (semantic tokens + computed RGB values)
   - Typography scale (font families, sizes, weights, line heights, roles)
   - Spacing system (base unit, common values)
   - Border styles (radius scale, border widths, colors)
   - Shadow scale
   - Component patterns observed (buttons, badges, cards, tables, inputs, tabs)

{If design_system_ref exists:
2. A compliance audit:
   - Tokens in the live site not in the DS doc
   - DS tokens not used in the live site
   - Value mismatches between DS and live site
}

Output as a structured markdown document.
```

### Agent C: API Requirements Inferrer

Prompt:
```
You are inferring API data requirements from a web application's UI.

Read all snapshot files in {output_dir}/snapshots/.
Read the feature map produced by Agent A.

For each page/screen, produce:
1. The API endpoint(s) needed to render that screen
2. Request/response schemas (TypeScript-style types)
3. Query parameters for filtering, sorting, pagination
4. Mutation endpoints for interactive actions (status changes, form submissions, AI generation)
5. Relationships between endpoints (which data is shared/nested)

Output as a structured markdown document with code blocks for schemas.
```

### Agent D: Recommendations Generator

Prompt:
```
You are reviewing a web application exploration to provide architectural and UX recommendations.

Read the feature map, design system analysis, and API requirements.
Read the captured screenshots.

Produce recommendations in these categories:
1. **Architecture** — data fetching strategy, caching, real-time updates
2. **UX gaps** — missing empty states, loading states, error states, accessibility
3. **Design system** — inconsistencies, missing tokens, dark mode readiness
4. **Data model** — normalization issues, naming inconsistencies, relationship concerns
5. **Missing features** — buttons/links that exist but have no destination, placeholder content

Output as a numbered list with category labels.
```

Run Agents A, B, C, D in parallel. Collect their outputs.

**Update the progress log:**
```
Phase 2: Analyze & synthesize — COMPLETE
```

---

## Phase 3: Generate Report & Ticket Plan

### Step 3.1: Compile the Exploration Report

Combine all agent outputs into a single `{output_dir}/EXPLORATION_REPORT.md` with these sections:

```markdown
# {App Name} — App Exploration Report

**URL:** {url}
**Explored:** {date}

## 0. Pre-Exploration Interview
{Questions and answers from Phase 0}

## 1. Site Map
{Page tree from Agent A}

## 2. Page-by-Page Feature Breakdown
{Feature inventory from Agent A — one subsection per page}

## 3. Design System Extraction
{Design system from Agent B}
{If DS ref was provided: ## 3.1 Design System Compliance Audit}

## 4. API Data Requirements
{API schemas from Agent C}

## 5. Navigation & Interaction Map
{Interaction table from Agent A}

## 6. Recommendations
{From Agent D}

## 7. Key Observations
{Notable findings, gaps, surprises}
```

### Step 3.2: Generate Ticket Plan

From the feature map, generate a ticket plan table. Group tickets logically:

```markdown
# Ticket Plan

{N} tickets proposed from exploration of {url}.

Review the list below. Mark which tickets to proceed with by responding with the IDs you want detailed (e.g., "proceed with EX-01 through EX-05, skip EX-06").

## Global / Layout
| ID | Title | Description | Complexity |
|----|-------|-------------|------------|
| {prefix}-01 | Global Layout & Sidebar | App shell with icon sidebar, breadcrumb header, responsive layout | Medium |
| {prefix}-02 | Navigation & Routing | Client-side routing for all pages, sidebar active states | Low |

## {Section Name}
| ID | Title | Description | Complexity |
|----|-------|-------------|------------|
| {prefix}-03 | {Page/Feature Name} | {One-line description of what this ticket covers} | Low/Medium/High |
| ... | ... | ... | ... |

## Design System
| ID | Title | Description | Complexity |
|----|-------|-------------|------------|
| {prefix}-XX | Design Tokens & Theme | CSS custom properties, color palette, typography scale | Medium |
| {prefix}-XX | Component Library | Shared components: buttons, badges, cards, tables, inputs, tabs | High |
```

**Ticket grouping rules:**
- One ticket per distinct page/screen
- Separate tickets for tabs within a page if they have significantly different UIs
- Shared components get their own ticket(s)
- Global layout/navigation gets its own ticket
- Design system extraction gets its own ticket
- AI-powered features get their own tickets (they need different backend work)

**Complexity estimation:**
- **Low:** Simple display page, few interactive elements, straightforward data
- **Medium:** Table with sorting/filtering, multiple sections, moderate interactivity
- **High:** Complex interactions (AI generation, real-time updates, multi-step flows), many sub-states

Save the ticket plan to `{output_dir}/TICKET_PLAN.md`.

### Step 3.3: Present to User

Show the user:
1. A brief summary of what was found (page count, feature count, design tokens extracted)
2. The ticket plan table
3. Ask: **"Which tickets should I detail? You can specify IDs, ranges, or 'all'. You can also give feedback on the grouping."**

**Update the progress log:**
```
Phase 3: Report & ticket plan — COMPLETE
```

---

## Phase 4: Detail Approved Tickets

After the user specifies which tickets to detail, flesh out each one.

### Ticket Format (Adapted)

Each ticket file is saved to `{output_dir}/tickets/{prefix}-{NN}.md`:

```markdown
## [{prefix}-{NN}] {Title}

### Context
{Why this screen/feature exists, what it does in the app, what depends on it}

### Screen Reference
- **URL:** {page URL}
- **Screenshot:** `{screenshot path}`

### Inputs (dependencies)
- **{prefix}-{NN}** — {what it provides}
- Or: "None — this is a root ticket"

### Features to Implement
{Numbered list of every feature on this screen, with DOM structure references}

### API Data Requirements
{Endpoint(s) needed, request/response schema, query params}

### Design Tokens Used
- **Typography:** {which tokens apply}
- **Colors:** {which tokens apply}
- **Components:** {which shared components are used}

### Code References (DOM Structure)
{Key selectors, element hierarchy, class names observed}

### Acceptance Criteria
{Numbered, pass/fail testable criteria}

### Verification
{How to verify this ticket is complete — visual checks, interaction tests}

### References
- Screenshot: `{path}`
- Snapshot: `{path}`
- Design System: Section {X}
- API: Section {Y} of exploration report
```

### Ticket Format (Standard)

If `ticket_format` is `standard`, use the project's `TICKET_STANDARD.md` format instead. Read it first, then produce tickets in that exact structure. Map the exploration data to the standard sections:
- Features to Implement → Implementation Notes
- API Data Requirements → Implementation Notes (subsection)
- Code References → Implementation Notes (subsection)
- Verification → Unit Tests

### Processing

Detail tickets sequentially. After each ticket, update the progress log:

```markdown
| Ticket | Title | Status |
|--------|-------|--------|
| EX-01 | Global Layout & Sidebar | DONE |
| EX-02 | Navigation & Routing | DONE |
| EX-03 | Companies List Page | IN PROGRESS |
| EX-04 | Company Detail — Summary | PENDING |
```

### Resume Support

If the progress log shows tickets already marked `DONE`:
1. Report: `Resuming ticket detailing — {N} tickets already detailed, continuing from {next_ticket}...`
2. Skip all `DONE` tickets
3. Continue from the first `PENDING` or `IN PROGRESS` ticket

**Update the progress log:**
```
Phase 4: Detail tickets — COMPLETE ({N} tickets detailed)
```

---

## Phase 5: Post-Generation Review

After all approved tickets are detailed, present a summary to the user:

```
Ticket detailing complete!

Detailed: {N} tickets
Saved to: {output_dir}/tickets/

Summary:
| ID | Title | Dependencies | Complexity |
|----|-------|-------------|------------|
| EX-01 | ... | None | Medium |
| EX-02 | ... | EX-01 | Low |
| ... | ... | ... | ... |

Please review the tickets. You can:
1. Ask me to revise specific tickets (e.g., "EX-03 needs more detail on the filter behavior")
2. Ask me to merge or split tickets
3. Ask me to re-estimate complexity
4. Ask me to add missing tickets
5. Say "looks good" to finalize

I'll keep iterating until you're happy with the result.
```

Handle feedback by:
- Reading the specific ticket file
- Applying the requested changes
- Re-presenting the updated ticket for approval
- Updating the progress log with revision notes

**Update the progress log:**
```
Phase 5: Review — {COMPLETE | IN PROGRESS}
Revisions: {count}
```

---

## Progress Log Format

The progress log at `{progress_log}` tracks the full run state for resumability:

```markdown
# Exploration Progress Log

**URL:** {url}
**Started:** {datetime}
**Status:** IN PROGRESS | COMPLETE

## Phases
| Phase | Status | Completed |
|-------|--------|-----------|
| 0. Pre-crawl interview | COMPLETE | {datetime} |
| 1. Crawl & capture | COMPLETE | {datetime} |
| 2. Analyze & synthesize | COMPLETE | {datetime} |
| 3. Report & ticket plan | COMPLETE | {datetime} |
| 4. Detail tickets | IN PROGRESS | — |
| 5. Post-generation review | PENDING | — |

## Pages Crawled
| Page | URL | Status | Screenshot | Tokens |
|------|-----|--------|------------|--------|
| ... | ... | DONE/PENDING | ... | yes/no |

## Tickets
| Ticket | Title | Status | Revisions |
|--------|-------|--------|-----------|
| EX-01 | ... | DONE | 0 |
| EX-02 | ... | PENDING | 0 |

## User Decisions
- Approved tickets: EX-01, EX-02, EX-03, EX-05
- Skipped tickets: EX-04, EX-06
- Feedback: "EX-03 needs more detail on filter behavior"
```

---

## Resume Logic

When the skill is invoked:

1. Check for an existing progress log at `{progress_log}`
2. If found and status is `IN PROGRESS`:
   - Report: `Found existing exploration in progress. Resuming from Phase {N}...`
   - Jump to the first incomplete phase
   - Within Phase 1 (crawl), skip pages already marked DONE
   - Within Phase 4 (detail), skip tickets already marked DONE
3. If found and status is `COMPLETE`:
   - Ask: `Previous exploration is complete. Start fresh or re-enter review? (fresh/review)`
   - `fresh` → archive the old progress log, start over
   - `review` → jump to Phase 5 (post-generation review)
4. If not found: start from Phase 0

---

## Important Rules

1. **Always ask before crawling** — Phase 0 is not optional. Even if the user says "just go", confirm the URL and note that no focus/skip preferences were given.
2. **Stay on domain** — Never follow links to external sites unless `stay_on_domain` is false.
3. **Screenshot everything** — Every page and every tab state gets a screenshot. These are the primary reference for ticket implementation.
4. **Capture before clicking** — Always snapshot + screenshot a page before clicking interactive elements.
5. **Don't modify the app** — Read-only exploration. Don't submit forms, don't delete data, don't change settings. Exception: clicking tabs, expanding sections, opening dropdowns to see their options.
6. **User gates are mandatory** — Never skip Phase 3 (ticket plan review) or Phase 5 (post-generation review). The user must approve before tickets are detailed.
7. **One ticket, one responsibility** — Each ticket should be implementable independently. If it depends on another ticket, list it in Inputs.
8. **Design tokens from the live site** — Always extract tokens via `browser_evaluate`, even if a design system doc exists. The live site is the source of truth for what's actually rendered.
9. **API schemas are inferred, not authoritative** — Clearly label API requirements as "inferred from UI" unless an API spec was provided. The backend team may structure things differently.
10. **Progress log is the resumability contract** — Update it after every meaningful step. If the skill is interrupted mid-page, the page should be marked `IN PROGRESS` so it's re-crawled on resume.
