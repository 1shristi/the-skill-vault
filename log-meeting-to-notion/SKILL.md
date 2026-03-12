---
name: log-meeting-to-notion
description: Log meeting notes to Notion. Supports two modes: (1) fetch from Granola by topic, or (2) accept raw notes pasted directly. Drafts structured notes, shows a preview for approval, then creates a page in the Meetings database and action items in the Action Items database. Database IDs are read from a per-project config file so different projects can use different Notion workspaces.
---

## Project Config

Database IDs are **not** hardcoded in this skill. They are read from a project-level config file at:

```
<project-root>/.claude/log-meeting-to-notion.json
```

### Config file schema

```json
{
  "meetings_database_url": "https://www.notion.so/<id>",
  "meetings_data_source_id": "<uuid>",
  "action_items_database_url": "https://www.notion.so/<id>",
  "action_items_data_source_id": "<uuid>",
  "default_project_tag": "<e.g. Cerebro>"
}
```

### Step 0 — Load config (always run first)

Before doing anything else:

1. Read `.claude/log-meeting-to-notion.json` from the current project root
2. If the file **exists and is valid**, load the IDs and proceed to detect mode
3. If the file **does not exist or is missing required fields**, run **Setup Mode** (see below) before proceeding

---

## Setup Mode

Run this when no valid project config exists.

1. Tell the user no config was found for this project and you need to locate the Notion databases
2. Use `notion-search` to look for a Meetings database and an Action Items database in the connected workspace
3. If found, show the user what you found and confirm before saving
4. If not found, ask the user to provide the Notion URLs for:
   - The Meetings database
   - The Action Items database (offer to create it if it doesn't exist)
5. Fetch each database URL using `notion-fetch` to extract the real `data_source_id` (look for `collection://<uuid>` in the response)
6. Write the config file to `.claude/log-meeting-to-notion.json` with the discovered IDs
7. Continue with the original request

---

## Expected Database Schemas

### Meetings database

The Meetings database should have these properties (exact names matter):
- `Name` (TITLE) — meeting title
- `date:Date:start` (DATE) — meeting date. Set using key `date:Date:start`
- `Project` (SELECT or MULTI_SELECT) — project tag, e.g. Cerebro
- `Attendees` (RICH_TEXT) — comma-separated names
- `Summary` (RICH_TEXT) — one-sentence summary

### Action Items database

The Action Items database should have these properties:
- `Task` (TITLE) — action item text
- `Status` (SELECT) — one of: Not Started, In Progress, Done
- `Owner` (RICH_TEXT) — person responsible
- Due date (DATE, optional) — use whatever key the `notion-fetch` schema shows
- `Source Meeting` (RELATION → Meetings database) — link back to the meeting page

**Important**: Always `notion-fetch` each database before creating pages to confirm the exact property names and date key format — do not guess them.

---

When the user invokes this skill, run Step 0 first, then detect which mode they're using:

---

## Mode A — Raw Notes Input

**Trigger**: User pastes raw meeting notes directly (bullet points, a wall of text, a transcript snippet, etc.).

1. **Parse the raw notes** to extract:
   - Meeting title (infer from topic if not stated)
   - Date (use today's date if not mentioned)
   - Attendees (extract names; ask if none found)
   - Meeting type (infer from context; default to "Other" if unclear)
   - Project tag (default to "General" if unclear)
   - One-sentence summary of purpose

2. **Draft structured notes** with these sections:
   - **Context** — what this meeting was about, enough for someone who wasn't there
   - **Agenda / Topics Covered**
   - **Discussion Notes** — key points raised, with attribution where possible
   - **Key Decisions** — what was decided and why
   - **Action Items** — checklist with owner and deadline if mentioned
   - **Next Steps**
   - Include a `## Outcomes & Decisions Summary` table for scannability

3. **Show preview first**
   - Display the full draft in the conversation
   - State the properties that will be set (Name, Date, Type, Project, Attendees, Summary)
   - Ask the user for any corrections before touching Notion
   - Do not proceed until the user explicitly approves

4. **Push to Notion**
   - Create a new page in the Meetings database using the `meetings_data_source_id` from the project config
   - Set all extracted properties
   - Write the full structured notes as the page body
   - After the meeting page is created, extract all action items from the notes and create a row for each in the Action Items database using `action_items_data_source_id` from the project config, setting `Source Meeting` to the URL of the newly created meeting page and `Status` to "Not Started"

5. **Return links**
   - Share the Notion page URL
   - Remind the user they can update action item status in the Action Items database

---

## Mode B — Granola Fetch by Topic

**Trigger**: User provides a topic, project name, or keyword (no raw notes pasted).

1. **Fetch from Granola**
   - Use `query_granola_meetings` to find relevant meetings matching the topic
   - Use `get_meetings` to pull full transcripts and summaries for the relevant meeting IDs
   - Collect all participant names, dates, and meeting titles

2. **Draft verbose notes**
   Write structured, teammate-readable notes that cover:
   - **What the product/project is** — enough context that someone who wasn't in the meeting can orient themselves
   - **Key decisions made and the reasoning behind them** — not just what was decided, but why
   - **Design or architecture choices** — with the tradeoffs discussed
   - **Outcomes and current state** — what changed or was confirmed as a result of the meeting(s)
   - **Open action items** — as a checklist
   - Use a `## Outcomes & Decisions Summary` table for scannability
   - Split into sessions if there were multiple meetings on the same topic, using `## Session N — <title>` headings (no timestamps under headings)

3. **Show preview first**
   - Display the full draft in the conversation before touching Notion
   - Ask the user for any changes (wording, missing attendees, sections to add/remove)
   - Do not proceed to Notion until the user explicitly approves

4. **Push to Notion**
   - Create a new page in the Meetings database using the `meetings_data_source_id` from the project config
   - Set: Name, Date, Project, Attendees, Summary
   - Full verbose notes as the page body
   - After the meeting page is created, extract all action items and create a row for each in the Action Items database using `action_items_data_source_id` from the project config, setting `Source Meeting` to the URL of the newly created meeting page and `Status` to "Not Started"

5. **Return links**
   - Share the Notion database URL and the individual page URL at the end
