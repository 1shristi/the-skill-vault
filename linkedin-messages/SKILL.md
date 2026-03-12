---
name: linkedin-messages
description: Read, list, or send LinkedIn messages. Use when the user asks to check messages, read a conversation, or send a message on LinkedIn.
argument-hint: [list|read|send] [name or thread-id]
---

Manage LinkedIn messages using the `link-pulse` CLI.

## List Conversations

```
link-pulse messages list --limit <N> --no-cache
```

Each thread has: `id`, `participantName`, `snippet`, `timestamp`, `unread`.
Present as a table with unread indicators.

## Read a Thread

```
link-pulse messages read "<thread-id>" --no-cache
```

Each message has: `sender`, `body`, `timestamp`, `isMe`.
Present as a clean conversation view with sender names and timestamps.

If the user asks to read messages from a specific person:
1. First list conversations to find the matching thread ID
2. Then read that thread

## Send a Message

```
link-pulse messages send "<thread-id>" --message "<text>"
```

**Important:**
- Always draft the message and show it to the user for approval before sending.
- LinkedIn's compose box uses Shift+Enter for line breaks. Avoid multi-line messages when possible, or keep them on a single line. Newline characters may render as literal `\n` in the message.
- To reply to a specific person, first list conversations to find their thread ID.

## Workflow: Find and Message Someone

1. List messages: find the thread ID by participant name
2. Read the thread: understand the conversation context
3. Draft a reply: show it to the user
4. Send on approval
