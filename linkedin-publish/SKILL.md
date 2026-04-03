---
name: linkedin-publish
description: Draft and publish LinkedIn posts in Babajide's voice. Fact-checks claims, avoids hype, delivers actionable content. Use when the user wants to create a LinkedIn post, write about AI/Claude/Lovable, or share a takeaway.
argument-hint: [topic or raw idea]
---

Draft and publish LinkedIn posts that match Babajide's voice: grounded, direct, structured, zero hype.

## Step 0: Understand the Request

Parse what the user wants to post about. If the input is vague (e.g., "post about Claude Code"), ask **one** clarifying question to nail down the angle:

- "What specific thing did you do / learn / observe?"
- "Who is this for — builders, PMs, leaders adopting AI?"
- "Is there a concrete outcome or workflow you want to highlight?"

Do NOT proceed with a vague topic. Every post needs a grounded anchor — something that actually happened, a real result, or a specific observation.

---

## Step 1: Research and Fact-Check

Before drafting, verify any claims the post will make.

### For product claims (Claude, Lovable, any tool):
- Use `WebSearch` to confirm the feature exists, when it shipped, and what it actually does
- Cross-reference official docs or changelogs — not blog hype or Twitter threads
- If a claim can't be verified, flag it: "I couldn't confirm X. Want to include it as your personal observation instead?"

### For statistics or trends:
- Find the primary source (company blog, research paper, official report)
- Note the date and source so it can be cited or dropped if stale
- Never invent or extrapolate numbers

### For personal experiences the user shares:
- These don't need fact-checking — they're first-person observations
- But if the user generalizes from them ("most teams are doing X"), ask: "Is this your observation or is there data behind it?"

---

## Step 2: Gather Voice Context

Before drafting, pull recent posts to calibrate tone:

```
link-pulse search posts "Babajide Okusanya" --limit 10 --no-cache
```

Also pull recent messages for conversational tone:

```
link-pulse messages --limit 5 --no-cache
```

Read the results silently. Do NOT summarize them to the user. Use them only to match voice and tone.

---

## Step 3: Draft the Post

Write a draft following these voice rules:

### Voice Profile — Babajide Okusanya

**Tone:** Direct, observational, grounded. Writes like someone reporting from the field, not preaching from a stage.

**Structure pattern:**
- Opens with a concrete anchor (event, thing built, specific observation)
- Middle section: specifics — names, tools, workflows, what actually happened
- Closes with a broader pattern or insight, stated plainly
- Optional: ends with an invitation to exchange notes (not a generic "thoughts?")

**What Babajide does:**
- Names specific people, tools, and workflows
- States observations as observations, not universal truths
- Uses numbered lists for key takeaways (sparingly, 2-3 max)
- Acknowledges others who contributed
- Keeps sentences short and declarative
- Uses line breaks between thoughts (LinkedIn formatting)

**What Babajide does NOT do:**
- Use superlatives ("game-changing", "revolutionary", "mind-blowing")
- Start with a hook line designed to bait clicks
- Use emoji as bullet points or decorators
- Write in a breathless or excited tone
- Make sweeping claims without grounding them
- End with "What do you think?" or "Agree?"
- Use hashtags excessively (1-2 max, at the end, only if relevant)

**Sentence-level patterns:**
- "What stood out was..." (observation framing)
- "The bigger pattern across all of it:" (synthesis)
- "If you're [doing X], I'd be interested in comparing notes." (invitation)
- "This is a critical pattern: [insight]." (direct assertion grounded in specifics)

### Formatting rules:
- Line break between each paragraph (LinkedIn collapses dense text)
- No bold or italic (LinkedIn doesn't render markdown)
- 1-2 hashtags max, at the very end
- Aim for 150-300 words. Shorter is better if the point is clear.
- No emoji unless the user explicitly asks for them

### Post types and what "actionable" means for each:

| Post type | Actionable element |
|-----------|-------------------|
| Event recap | Name the people and demos; link patterns to things the reader can try |
| Tool workflow | Describe the specific setup so someone could replicate it |
| Observation / trend | State what you'd do differently knowing this, or what to watch for |
| Announcement | What it means for the reader, not just that it happened |

---

## Step 4: Self-Review Checklist

Before showing the draft, run through these checks silently:

| Check | Pass? |
|-------|-------|
| Every factual claim is verified or clearly framed as personal observation | |
| No superlatives or hype words (game-changing, revolutionary, incredible, insane) | |
| A reader can walk away knowing what to do, try, or think about | |
| The post sounds like Babajide wrote it, not a content marketer | |
| No clickbait opening hook | |
| Specific names, tools, or workflows are mentioned (not vague "AI tools") | |
| Under 300 words unless the content genuinely requires more | |

If any check fails, revise before showing the draft.

---

## Step 5: Present Draft for Approval

Show the draft to the user with:

> **Draft post:**
>
> [the post text, formatted exactly as it would appear on LinkedIn]
>
> **Fact-check notes:**
> - [Claim X] — verified via [source]
> - [Claim Y] — this is your personal observation, no external verification needed
>
> **Shall I publish this, or would you like to adjust anything?**

## Step 5.5: Save Draft as Markdown

Once the user is satisfied with the draft (after any revisions), ask:

> **Would you like me to save this as a markdown file?**

If the user agrees (or asks to save at any point during drafting), save the post to:

```
/Users/babajideokusanya/Documents/Projects-with-Babajide/linkedin/YYYY-MM-DD-<slug>.md
```

- **Date prefix**: Use the current date in `YYYY-MM-DD` format (e.g., `2026-04-01`)
- **Slug**: A short, lowercase, hyphen-separated description of the post topic (e.g., `claude-code-850m-tokens`, `agent-ops-conversation`, `waterloo-meetup-recap`)
- **Content**: Save only the post text (no fact-check notes or meta commentary)
- Always offer this step before moving to publish

---

## Step 6: Publish

Only after explicit user approval:

```
link-pulse post create --text "<post text>"
```

**CONSENT REQUIRED — NEVER SKIP:**
- ALWAYS wait for explicit approval before publishing
- If the user says "looks good" or "go ahead" — that counts as approval
- If the user gives feedback — revise and show the new draft, then ask again
- NEVER publish on the first pass without showing the draft

After publishing, confirm:
> "Posted. [link to post if available]"

---

## Responding to Comments (optional)

If the user asks to respond to comments on a published post:

1. Read the comments: the user will share them or you can ask for them
2. Draft a reply that:
   - References something specific the commenter said
   - Adds a new angle or detail, not just "thanks!"
   - Stays in Babajide's voice
3. Show draft, get approval, then post:
   ```
   link-pulse post comment "<post-urn>" --text "<comment text>"
   ```

---

## Rules

- NEVER publish without showing the draft and getting explicit approval
- NEVER use hype language — if a word would fit in a product launch press release, don't use it
- NEVER fabricate quotes, statistics, or feature claims
- NEVER use more than 2 hashtags
- NEVER use emoji unless the user explicitly requests them
- NEVER start a post with a hook-bait pattern ("I just discovered something that will change how you...")
- If you can't verify a claim, say so — let the user decide whether to include it
- When in doubt, understate rather than overstate
