# explore-app

Autonomously explore a web application via Playwright, map every screen and feature, extract the design system, infer API data requirements, and produce a plan — either implementation tickets or user stories.

## Skills

This folder contains two skills that work together:

| Skill | File | What it does |
|-------|------|-------------|
| `/explore-app` | `SKILL.md` | Crawl the app, extract everything, produce a report and plan |
| `/detail-exploration` | `DETAIL.md` | Flesh out approved items from the plan into detailed tickets or user stories |

`extract-tokens.js` is a helper script used by `/explore-app` to pull design tokens from the live DOM.

## Requirements

- **Playwright MCP server** — must be configured in your Claude Code MCP settings. The skill uses `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`, `browser_evaluate`, and `browser_click`.
- **`.claude/skill-config.md`** (optional) — project-level config with an **Explore App Settings** section. If missing, the skill uses sensible defaults.

### Playwright MCP setup

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-server-playwright"]
    }
  }
}
```

## Quick Start

```
# Explore an app and generate a ticket plan
/explore-app https://myapp.com

# Explore with user stories instead of tickets
/explore-app https://myapp.com --mode user-stories

# Cross-reference against an existing design system
/explore-app https://myapp.com --ds docs/design-system.md

# After reviewing the plan, detail approved items
/detail-exploration EX-01 through EX-05

# Detail everything
/detail-exploration all

# Resume if interrupted
/detail-exploration
```

## Workflow

```
/explore-app https://myapp.com
        │
        ├── 1. Pre-crawl interview (focus areas, skip areas, known issues)
        ├── 2. Crawl & capture (snapshots, screenshots, design tokens)
        ├── 3. Analyze (4 parallel agents: features, design system, API, recommendations)
        └── 4. Report + plan (EXPLORATION_REPORT.md + TICKET_PLAN.md or STORY_PLAN.md)
                │
                ▼
        User reviews plan, picks items to detail
                │
                ▼
/detail-exploration EX-01 EX-02 EX-03
        │
        ├── 1. Detail each approved item
        └── 2. Review loop (revise, merge, split, add — until "looks good")
```

## Output Modes

### `tickets` (default)

Implementation tickets for an engineering team. Each ticket includes:
- Screen reference with screenshot
- Features to implement with DOM structure references
- API data requirements (inferred from UI)
- Design tokens used
- Pass/fail acceptance criteria

### `user-stories`

Product-oriented user stories for a PM-to-engineering handoff. Each story includes:
- "As a... I want to... So that..." format
- User flow across screens
- Business rules and logic
- Acceptance criteria from the user's perspective
- Edge cases and open questions for discussion
- Non-prescriptive engineering notes

## Configuration

Add an **Explore App Settings** section to your project's `.claude/skill-config.md`:

```markdown
## Explore App Settings

### Output
- **Output directory:** `exploration`
- **Progress log:** `exploration/PROGRESS.md`
- **Screenshot format:** `png`

### Output Mode
- **Output mode:** `tickets`

### Tickets
- **Ticket prefix:** `EX`
- **Ticket format:** `adapted`

### Crawl Behavior
- **Max depth:** `5`
- **Stay on domain:** `true`

### Focus & Skip Paths
**Focus paths:** _(none)_
**Skip paths:** _(none)_

### Design System Reference
- **Design system ref:** `null`
- **API spec ref:** `null`

### Known Issues
- (list any known bugs or WIP areas here)
```

## Resumability

Both skills track progress in `exploration/PROGRESS.md`. If interrupted:
- `/explore-app` resumes crawling from the last captured page
- `/detail-exploration` resumes from the last detailed item

## Files Produced

```
exploration/
├── PROGRESS.md              # Resume state
├── EXPLORATION_REPORT.md     # Full analysis report
├── TICKET_PLAN.md            # Ticket plan (tickets mode)
├── STORY_PLAN.md             # Story plan (user-stories mode)
├── screenshots/              # Full-page screenshots per page
├── snapshots/                # Accessibility tree snapshots per page
├── tickets/                  # Detailed ticket files (tickets mode)
│   ├── EX-01.md
│   └── ...
└── stories/                  # Detailed story files (user-stories mode)
    ├── US-01.md
    └── ...
```
