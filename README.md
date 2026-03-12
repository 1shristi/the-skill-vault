# the-skill-vault

Claude Code skills for Babajide's personal workflow. These are invoked by Claude Code as slash commands (e.g. `/ship-chore`, `/linkedin-feed`).

Skills are symlinked from `~/.claude/skills/` into this repo — edits here are live immediately.

---

## LinkedIn

| Skill | What it does |
|---|---|
| `linkedin-feed` | Read and summarize the LinkedIn home feed |
| `linkedin-messages` | List, read, and send LinkedIn messages |
| `linkedin-post` | Create a post or comment on an existing one |
| `linkedin-search` | Search LinkedIn for posts or people on a topic |

> Requires [`link-pulse`](https://www.npmjs.com/package/link-pulse) installed globally.

## Engineering Workflow

| Skill | What it does |
|---|---|
| `review-ticket` | Validate a ticket against project specs before work begins |
| `implement-ticket` | Implement a reviewed ticket end-to-end |
| `ship-and-watch` | Commit, push, open a PR, and monitor CI until it passes |
| `ship-chore` | Ship an ad-hoc change without a pre-existing ticket |
| `test-and-fix` | Run tests, diagnose failures, and iterate until they pass |
| `ticket-from-report` | Turn a skill-generated report into Linear tickets |

> Engineering skills require `.claude/skill-config.md` in the project root.

## Productivity

| Skill | What it does |
|---|---|
| `log-meeting-to-notion` | Log meeting notes to Notion (from Granola or raw paste) |
| `reddit-read` | Read subreddits, threads, and search Reddit posts |
