# Events and SSE

`watchBot` yields objects. `botEventsSSE` writes the same objects as named SSE events. `data` is JSON. When the object has an `id`, that string is the SSE `id` and the resume cursor.

## Event catalog

| `type` | When | What to do |
|---|---|---|
| `connected` | Stream handshake | Read `serverTimeMs` and `absoluteLifetimeMs` as decimal strings. |
| `heartbeat` | Upstream heartbeat | Read `serverTimeMs`. |
| `message` | A text `send-message` entry | Upsert `data.text` at `data.entryId`. The text is the full body. |
| `entry` | Any other decoded transcript entry | Read `data.entryKind` and `data.entry`. |
| `entry.unavailable` | Body missing or not valid JSON | Cursor still advances. `bodyOmitted` and `blobHash` are informational. |
| `message.deleted` | A transcript delete | Remove `data.entryId`. |
| `reset` | Generation changed, or the session was cleared | Drop local state for this session. `data.generation` is the new one. |
| `resync-required` | Cursor is older than the server allows | The generator returns after this event. Reload history, then subscribe again. |
| `turn.failed` | The bot turn failed | Read `turnId`, `code`, and `summary`. |
| `bot.state.changed` | State families changed for this bot | Read `families`. |
| `bot.updated` | This bot's roster fields changed | `data.bot` is a `Bot`, or `null` when the payload had no agent object. |
| `stream.closed` | SSE only. The iterator finished cleanly. | The watch ended. Open a new one to continue. |
| `error` | SSE only. The iterator threw after headers were sent. | `data.code` is an `SDKError` code. |

`message.data` also includes `operation: 'upsert'`, `botId`, `sessionId`, `generation`, `seq`, `updatedSeq`, and `replay`.

`seq` and `updatedSeq` are decimal strings. `replay` is `true` when the server marked the batch as replay.

User-visible text and other entry kinds stay distinct: a text `send-message` becomes `message`. Other decoded bodies become `entry`, so a user echo is not reported as the bot's `message` text unless that echo itself is a text `send-message`.

## SSE bytes

```text
event: message
id: <resume-cursor>
data: {"botId":"...","sessionId":"","generation":0,"seq":"22","updatedSeq":"22","entryId":"...","replay":false,"operation":"upsert","text":"..."}

```

Rules implemented by the encoder:

- `event` is the `type` string. It must match `^[a-z][a-z0-9._-]{0,60}$`.
- `id` is omitted when the event has no id (`connected`, `heartbeat`, `resync-required`, `turn.failed`, `bot.state.changed`, `bot.updated`, `stream.closed`, `error`).
- `id` must be at most 2048 characters and must not contain CR, LF, or NUL.
- `data` is one JSON object. `JSON.stringify` escapes text, so message content cannot break out of the `data` line.
- Events are separated by a blank line.
- A quiet stream receives `: keepalive\n\n` every `keepAliveMs` milliseconds when the buffer has room. Comments are not events.

Response headers:

```text
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
x-accel-buffering: no
```

## Resume cursor

The cursor id is Base64URL JSON:

```json
{ "botId": "...", "sessionId": "", "generation": 0, "afterUpdatedSeq": "22" }
```

Pass that string back as `resumeFrom` on the same bot and session. The browser sends it as `Last-Event-ID` when it reconnects to your route. Copy the header into `resumeFrom`.

`stream.closed` and `error` do not carry an id. Keep the last `message`, `entry`, `entry.unavailable`, `message.deleted`, or `reset` id if you want to resume.

## Ordering inside one frame

Entries and deletes from a single transcript batch are sorted by `updatedSeq` using `BigInt`, then applied. An update at or behind the current cursor is skipped. The cursor then becomes that update's `updatedSeq`.

A generation change inside the batch yields `reset` and sets the cursor's `afterUpdatedSeq` back to `0` before the rows in that batch are applied.

Frames for another `agentId` or `sessionId` are ignored.
