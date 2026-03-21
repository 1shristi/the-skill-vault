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
link-pulse messages send '<thread-id>' --message '<text>'
```

**IMPORTANT:** Always use single quotes for both `<thread-id>` and `<text>` to avoid bash escaping issues (e.g., `!` becoming `\!` in double quotes).

**CONSENT REQUIRED — NEVER SKIP:**
- ALWAYS show the drafted message to the user and wait for explicit approval before running the send command.
- Do NOT send even if the user previously described the message content — always confirm at the moment of sending.
- Only proceed after the user says yes, confirms, or approves. Treat any ambiguity as a no.
- LinkedIn's compose box uses Shift+Enter for line breaks. Avoid multi-line messages when possible, or keep them on a single line. Newline characters may render as literal `\n` in the message.
- To reply to a specific person, first list conversations to find their thread ID.

## Verify Delivery — NEVER SKIP

After every send command, verify the message was actually delivered:

1. Run `link-pulse messages list --limit 5 --no-cache`
2. Check that the sent message appears in the thread snippet for that person
3. Only tell the user "message sent" if verification passes
4. If the message does not appear, tell the user it may not have gone through

Do NOT trust the CLI's `success: true` response alone — it has returned false positives before.

## Workflow: Find and Message Someone

1. List messages: find the thread ID by participant name
2. Read the thread: understand the conversation context
3. Draft a reply: show it to the user and explicitly ask "Shall I send this?"
4. Send ONLY after user confirms
5. Verify delivery (see above)
