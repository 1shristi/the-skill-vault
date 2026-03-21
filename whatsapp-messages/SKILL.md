---
name: whatsapp-messages
description: Read, summarize, or send WhatsApp messages. Use when the user asks to check WhatsApp, read a conversation, summarize messages, draft a reply, or send a WhatsApp message.
argument-hint: [chats|read|send] [chat name]
---

Manage WhatsApp messages using the `link-pulse` CLI.

## List Recent Chats

```
link-pulse whatsapp chats --limit <N>
link-pulse whatsapp chats --unread
```

Each chat has: `name`, `lastMessage`, `timestamp`, `unread`, `unreadCount`.
Present as a table with unread indicators. If `--unread` is passed, only show chats with unread messages.

## Read a Chat

```
link-pulse whatsapp read "<chat name>" --limit <N>
```

Each message has: `sender`, `body`, `timestamp`, `isMe`.
Present as a clean conversation view with sender names and timestamps.

After reading, offer to:
- Summarise the conversation
- Extract any action items or follow-ups
- Draft a reply

## Send a Message

```
link-pulse whatsapp send '<chat name>' --message '<text>'
```

**IMPORTANT:** Always use single quotes for both `<chat name>` and `<text>` to avoid bash escaping issues (e.g., `!` becoming `\!` in double quotes).

**CONSENT REQUIRED — NEVER SKIP:**
- ALWAYS show the full drafted message to the user and wait for explicit approval before running the send command.
- Do NOT send even if the user previously described the message content — always confirm at the moment of sending.
- Only proceed after the user says yes, confirms, or approves. Treat any ambiguity as a no.
- WhatsApp's compose box uses Shift+Enter for line breaks. Keep messages on a single line where possible.

## Verify Delivery — NEVER SKIP

After every send command, verify the message was actually delivered:

1. Run `link-pulse whatsapp chats --limit 5`
2. Check that the sent message appears in the lastMessage snippet for that chat
3. Only tell the user "message sent" if verification passes
4. If the message does not appear, tell the user it may not have gone through

Do NOT trust the CLI's `success: true` response alone.

## Workflow: Summarise and Reply

1. List chats: `link-pulse whatsapp chats --limit 20` (or `--unread` to focus on unread)
2. User picks a chat to read
3. Read the chat: `link-pulse whatsapp read "<name>" --limit 50`
4. Summarise the conversation and flag any action items or things needing a response
5. If the user wants to reply: draft the message, show it clearly, ask "Shall I send this?"
6. Send ONLY after the user explicitly confirms
7. Verify delivery (see above)

## First-Time Setup

On first run, a browser window will open showing the WhatsApp Web QR code. The user must scan it with their phone once. After that, the session is saved and future runs won't require scanning.
