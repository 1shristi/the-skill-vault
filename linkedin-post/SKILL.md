---
name: linkedin-post
description: Create a LinkedIn post or comment on a post. Use when the user wants to post on LinkedIn, share something, or comment on a post.
argument-hint: [create|comment] [text or post-urn]
---

Create posts or comments on LinkedIn using the `link-pulse` CLI.

## Create a Post

```
link-pulse post create --text "<post text>"
```

**Important:**
- Always draft the post and show it to the user for approval before publishing.
- This uses the official LinkedIn API (not browser automation), so it's reliable.
- Keep posts authentic to the user's voice — don't make them sound like AI slop.

## Comment on a Post

```
link-pulse post comment "<post-urn>" --text "<comment text>"
```

The post URN looks like `urn:li:ugcPost:1234567890` or `urn:li:share:1234567890`. You can get it from feed or search results.

**Important:**
- Always draft the comment and show it to the user for approval before posting.

## Workflow: React to Feed Content

1. Use `/linkedin-feed` to read the feed
2. User picks a post to engage with
3. Draft a thoughtful comment (not generic — reference specific points from the post)
4. Show draft to user
5. Post on approval
