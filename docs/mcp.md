# Connecting an agent over MCP

Mailflare exposes a [Model Context Protocol](https://modelcontextprotocol.io) server at `/mcp`, so an agent can read and send mail with an API key instead of a browser session. It is **stateless** Streamable HTTP: one POST per JSON-RPC message, no session to keep alive.

## 1. Create the agent's account and key

1. Open **Admin → Accounts → New account**.
2. Pick a username and domain (for example `agent@example.com`).
3. Leave **Password** blank: the server generates a random one that is never shown, so the account cannot be signed into — only its key works.
4. Keep **Create an API key for this account** checked and fill **Allowed recipients** with who the agent may email:
   - `maya@example.com` — one exact address
   - `@example.com` (or `example.com`) — anyone on that domain
   - `*` — anyone (same as leaving it empty)
5. Create the account and **copy the key from the dialog**. It is `ep_…`, it is shown once, and only a hash is stored. If you lose it, revoke it in **Admin → API Keys** and mint a new one.

The key carries the `read` and `send` scopes. A key can never reach the session-only routes, so the agent cannot create or revoke keys, reset the password, or change the account.

## 2. Point a client at the endpoint

```
POST https://<your-worker-host>/mcp
Authorization: Bearer ep_…
Accept: application/json, text/event-stream
Content-Type: application/json
```

`<your-worker-host>` is the Worker's `workers.dev` hostname or your custom domain.

The `Accept` header is **required** by the Streamable HTTP transport — a request without it is rejected with `406 Not Acceptable`.

### opencode

`opencode.json` (project) or `~/.config/opencode/opencode.json` (global):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mailflare": {
      "type": "remote",
      "url": "https://mail.example.com/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer {env:MAILFLARE_API_KEY}" }
    }
  }
}
```

opencode substitutes `{env:VAR}` (not `${VAR}`), so export the key instead of pasting it into the file. Restart opencode after editing the config.

### Other clients

Clients that take a JSON server list usually accept:

```json
{
  "mcpServers": {
    "mailflare": {
      "url": "https://mail.example.com/mcp",
      "headers": { "Authorization": "Bearer ep_…" }
    }
  }
}
```

Some desktop clients only speak stdio; point them at a remote-to-stdio bridge (for example `npx -y mcp-remote https://mail.example.com/mcp --header "Authorization: Bearer ep_…"`).

## 3. Tools

| Tool | Arguments | What it does |
| --- | --- | --- |
| `whoami` | — | The authenticated account and its mailboxes |
| `list_mailboxes` | — | Mailboxes the account can read or send from, with their addresses |
| `list_folders` | `mailboxId` | User folders of a mailbox |
| `search_messages` | `q`, `mailboxId`, `folderId`, `status`, `read`, `starred`, `limit`, `offset` | Search and list messages |
| `get_message` | `messageId` | One message: body, contacts, attachment metadata, unsubscribe URL |
| `get_thread` | `messageId` | Every message in the conversation, oldest first |
| `list_attachments` | `messageId` | Attachment metadata |
| `download_attachment` | `messageId`, `attachmentId` | Base64 content (5 MB cap) |
| `send_message` | `from`, `to`, `cc?`, `bcc?`, `subject`, `text?`, `html?`, `mailboxId`, `inReplyTo?`, `references?`, `attachments?` | Send a new email |
| `reply_message` | `messageId`, `text?`, `html?`, `replyAll?`, `from?` | Reply, threading it correctly |
| `forward_message` | `messageId`, `to`, `text?`, `from?` | Forward (attachments are not copied) |
| `mark_read` / `mark_unread` | `messageId` | Toggle the read flag |
| `star_message` / `unstar_message` | `messageId` | Toggle the star |
| `archive_message` / `trash_message` / `move_to_inbox` | `messageId` | Change the folder view |
| `mark_spam` / `mark_ham` | `messageId` | Spam classification (feeds the spam filter) |
| `snooze_message` / `unsnooze_message` | `messageId`, `snoozedUntil` (ISO date-time, future) | Hide from the inbox until then |
| `move_message` | `messageId`, `folderId` | Move into a user folder |

`search_messages` accepts the same query grammar as the API: words, `"exact phrase"`, `-exclude`, `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `is:read`, `is:starred`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`.

When the key's allow-list has more than one mailbox address, pass `mailboxId` to `send_message` so the mail leaves from the right address; otherwise use the id from `list_mailboxes`.

## 4. Raw JSON-RPC example

```bash
KEY=ep_…
HOST=https://mail.example.com

# 1. Handshake
curl -s $HOST/mcp -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'

# 2. List tools
curl -s $HOST/mcp -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. Unread mail
curl -s $HOST/mcp -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_messages","arguments":{"q":"is:unread"}}}'
```

## 5. Limits and safety

- **Recipient allow-list** — a send to an address outside the list fails with `403` and the rejected addresses. Do not rely on the model to respect it: it is enforced in `POST /api/v1/send`, which the tools call, so it cannot be bypassed through the REST API either.
- **Rate limit** — `AGENT_SEND_RATE_LIMIT` caps API-key sends at 60 per minute per key (editable in `wrangler.jsonc`).
- **Attachment download** — capped at 5 MB over MCP; use the REST endpoint for larger files.
- **Scope** — the tools only ever see the mailboxes that account can access, using the same `getMailboxAccessLevel` rules as the dashboard.
- **Kill switch** — disabling the account in Admin → Accounts invalidates its key immediately.

## 6. Troubleshooting

| Symptom | Cause |
| --- | --- |
| `401 Unauthorized` | Missing/mistyped `Authorization`, or the key was revoked or the account disabled |
| `406 Not Acceptable: Client must accept both application/json and text/event-stream` | The `Accept` header is missing |
| Tool returns `Error 403: …not allowed to send to…` | The recipient is outside the key's allow-list |
| Tool returns `Error 403: This API key does not have the send scope` | The key was minted without `send` (only the account-creation flow adds `read` + `send`) |
| `whoami` returns no mailboxes | The account has no mailbox yet — add one in Admin → Mailboxes, or give it a domain |
| Client shows no tools | The server is stateless: clients must send `initialize` before `tools/list`; check the `Accept` header first |

Machine-facing surfaces (`/api/v1/**`, JMAP, `/mcp` errors) return English text; only the dashboard UI and its API errors are localized.
