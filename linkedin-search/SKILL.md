---
name: linkedin-search
description: Search LinkedIn for posts or people on a topic. Use when the user asks to find posts, see what people are saying about a topic, or search LinkedIn.
argument-hint: <query> [--limit N]
---

Search LinkedIn for posts using the `link-pulse` CLI.

## Steps

1. Run the search command:
   ```
   link-pulse search posts "<query>" --limit <N> --no-cache
   ```
   Default limit is 10 if not specified.

2. Parse the JSON output. Each result has: `author`, `body`, `url`, `urn`.

3. Present results as a curated summary:
   - Group by theme if there are clear clusters
   - For each post: author (bold), 1-2 sentence summary, and the direct URL
   - Highlight particularly insightful or high-engagement posts

4. End with a brief synthesis of the key themes/takeaways.

## Tips
- If the query is broad (e.g., "AI"), try multiple targeted searches in parallel (e.g., "AI agents", "AI startups", "AI hiring") for richer results.
- For location-specific queries, include the location in the search (e.g., "AI Waterloo Kitchener").
- Always include the post URL — never present a post without a link.
- Use `--no-cache` to get fresh results.

## People Search
To search for people instead of posts:
```
link-pulse search people "<query>" --limit <N>
```
