---
name: linkedin-search
description: Search LinkedIn for posts or people on a topic. Use when the user asks to find posts, see what people are saying about a topic, or search LinkedIn.
argument-hint: <query> [--location <place>] [--experience <years>] [--type posts|people|companies] [--remote] [--industry <sector>] [--limit N]
---

Search LinkedIn using the `link-pulse` CLI with structured filters.

## Parsing Arguments

Extract these filters from the user's input. They can be provided as flags or as natural language.

| Filter        | Flag                  | Natural language examples                        |
|---------------|-----------------------|--------------------------------------------------|
| Location      | `--location <place>`  | "in SF", "based in London", "remote"             |
| Experience    | `--experience <years>`| "3+ years", "senior", "junior", "entry-level"    |
| Search type   | `--type <type>`       | "people", "companies", "posts" (default: posts)  |
| Remote        | `--remote`            | "remote", "remote-friendly"                      |
| Industry      | `--industry <sector>` | "fintech", "healthcare", "SaaS"                  |
| Limit         | `--limit <N>`         | (default: 10)                                    |

Examples of natural language parsing:
- `/linkedin-search product designer in SF with 3+ years` → query: "product designer", location: SF, experience: 3+
- `/linkedin-search remote frontend engineer fintech` → query: "frontend engineer", remote: true, industry: fintech
- `/linkedin-search --type people UX researcher London` → type: people, query: "UX researcher", location: London

## Building the Search Query

Since `link-pulse` only accepts a text query and `--limit`, bake all filters into the query string:

1. Start with the core search terms (the role/topic).
2. Append each active filter as additional keywords:
   - Location → append city/region name (e.g., "San Francisco", "London UK")
   - Experience → append "N+ years experience" or seniority level
   - Remote → append "remote"
   - Industry → append industry/sector name
3. Run the constructed query:
   ```
   link-pulse search <type> "<constructed query>" --limit <N> --no-cache
   ```

**Example:** filters `{query: "product designer", location: "SF", experience: "3+", remote: true}` becomes:
```
link-pulse search posts "product designer San Francisco 3+ years experience remote" --limit 10 --no-cache
```

## Multi-Query Strategy

When filters are specific, run **parallel searches** with slight variations for richer results:
- One query with all filters combined
- One query emphasizing the role + location (e.g., "hiring product designer San Francisco")
- One query emphasizing the role + experience (e.g., "senior product designer 3+ years")

Deduplicate results by `urn` before presenting.

## Running the Search

```
link-pulse search posts "<query>" --limit <N> --no-cache
link-pulse search people "<query>" --limit <N> --no-cache
link-pulse search companies "<query>" --limit <N> --no-cache
```

## Presenting Results

1. Parse the JSON output. Each result has: `author`, `body`, `url`, `urn`.

2. Present results as a curated summary:
   - Group by theme if there are clear clusters (e.g., "Active Hiring", "Open to Work", "Industry Insights")
   - For each post: author (bold), 1-2 sentence summary, and the direct URL
   - Highlight particularly insightful or high-engagement posts
   - If filters were applied, note which results match the filters most closely

3. End with a brief synthesis of the key themes/takeaways.

## Tips
- If the query is broad (e.g., "AI"), try multiple targeted searches in parallel (e.g., "AI agents", "AI startups", "AI hiring") for richer results.
- Always include the post URL — never present a post without a link.
- Use `--no-cache` to get fresh results.
- When location is specified, also try common abbreviations/full names (e.g., "SF" → also try "San Francisco").
