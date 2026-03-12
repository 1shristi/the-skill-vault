---
name: linkedin-feed
description: Read the user's LinkedIn feed and summarize what's new. Use when the user asks to check their LinkedIn feed, see what's new on LinkedIn, or wants a feed summary.
argument-hint: [limit]
---

Read the user's LinkedIn feed using the `link-pulse` CLI.

## Steps

1. Run the feed command:
   ```
   link-pulse feed --limit ${ARGUMENTS:-10} --no-cache
   ```

2. Parse the JSON output. Each post has: `author`, `body`, `reactions`, `comments`, `url`, `timestamp`.

3. Present a concise summary with:
   - Author name (bold)
   - Post summary (1-2 sentences, not the full body)
   - Engagement stats (reactions, comments)
   - Time ago
   - Direct link to the post (always include the URL)

4. At the end, identify any themes across the posts.

## Important
- Always include the post URL — never present a post without a link.
- Use `--no-cache` to get fresh results.
- Default to 10 posts if no limit specified.
- Skip duplicate posts (same author + same content).
