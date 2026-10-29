# Call the SDK

Create one client per account token. Methods share that token and the client version header.

```js
import { GrokBotClient } from 'grok-bot-sdk'

const client = new GrokBotClient({
  accessToken: process.env.GROK_BOT_ACCESS_TOKEN,
  version: '0.78.1',
  teamId: undefined,
})
```

`fetchImpl` replaces global `fetch` in tests. Leave it unset in production.

## Account and roster

```js
const me = await client.getMe()
const { bots, truncated } = await client.listBots({ includeTeamAgents: true })
```

`includeTeamAgents` defaults to `true`, which matches the call used when the roster was verified. Set it to `false` when you want the narrower request. When `truncated` is `true`, the array is a partial page. This SDK does not request the next page.

Each `Bot` has the same fields:

| Field | Meaning |
|---|---|
| `id` | Agent UUID. Use this in send and watch. |
| `serverId` | A different server record id, or `null`. |
| `name`, `description`, `title` | Display strings. Missing values are `''`. |
| `avatarShape`, `avatarColor` | The resolved pair. Always filled. |
| `avatar` | The full resolved object, including source and picture. |
| `harness`, `kind` | Server strings, or `''`. |
| `sessionId` | The viewer session id, or `''`. |
| `teamId` | Integer, or `null`. |
| `viewerIsOwner`, `viewerCanManage` | Booleans. Anything other than `true` becomes `false`. |

Filter team and group records in your app with `kind`, `viewerIsOwner`, and `teamId`. Two rosters with the same length can still be different sets.

`examples/list-bots.mjs` prints `id`, `name`, session, and avatar summary from a credentials file:

```sh
node examples/list-bots.mjs ./credentials.json
```

## Send

```js
const sent = await client.sendMessage({
  botId: bot.id,
  sessionId: bot.sessionId,
  text: 'Summarize the notes I just sent.',
  messageId: crypto.randomUUID(),
})
```

`sent` is `{ botId, messageId, delivery, dispatched }`.

| `delivery` | Meaning |
|---|---|
| `accepted-box` | The server accepted the message on the box path. |
| `accepted-temporal` | The server accepted the message on the temporal path. |
| `duplicate` | This `messageId` was already accepted. |

`dispatched` is the server's boolean, passed through as `true` or `false`. Acceptance is the end of `sendMessage`. The bot's reply arrives later on `watchBot`, if it arrives.

`attachmentPaths` and `attachmentNames` are parallel arrays of server-side references. They are the identifiers an upload API already returned. A local filesystem path in either array is sent as that string. This package does not read the file, does not upload it, and does not wake a cloud computer.

Choose `messageId` yourself when you need to recognize the send later. The SDK generates a UUID when you omit it. The transcript `entryId` of the reply is a different id.

## Watch

```js
const control = new AbortController()
for await (const event of client.watchBot({
  botId: bot.id,
  sessionId: bot.sessionId,
  signal: control.signal,
})) {
  if (event.type === 'message') {
    replace(event.data.entryId, event.data.text)
  }
  if (event.type === 'resync-required') break
}
```

`sessionId` defaults to `''`. Pass the roster's `sessionId` when the bot has one.

With no cursor, the SDK first calls `ListGrokBotTranscriptEntries` with `limit: 1` and starts from the newest returned `updatedSeq`. History before that point stays out of the stream. An older row that is edited afterward can still appear, because the cursor is that row's update sequence, not a global high-water mark.

To resume explicitly, pass one of these, not both:

```js
client.watchBot({
  botId: bot.id,
  sessionId: bot.sessionId,
  cursor: { generation: 3, afterUpdatedSeq: '18' },
})

client.watchBot({
  botId: bot.id,
  sessionId: bot.sessionId,
  resumeFrom: lastEventId,
})
```

`generation` has to be the generation of this session. `afterUpdatedSeq` is a decimal string. `resumeFrom` is the `id` field from a previous event, and it must name the same bot and session.

`inlineBodyMaxBytes` defaults to 262144 and must be an integer from 1 through 524288.

The loop ends when the upstream stream ends, the signal aborts, or the server says the cursor is too old (`resync-required`). Aborting is the way to stop. The method does not reconnect.

## Forward SSE from your backend

```js
function replyEvents(request, client, authorizedBot) {
  return client.botEventsSSE({
    botId: authorizedBot.id,
    sessionId: authorizedBot.sessionId,
    resumeFrom: request.headers.get('last-event-id') || undefined,
    signal: request.signal,
    keepAliveMs: 15000,
  })
}
```

The return value is a Web `Response`. Its body is `text/event-stream`. Wire it through a server that flushes chunks. A proxy that buffers the whole body will hold events until the watch ends.

```js
const events = new EventSource('/api/bots/selected/events')
events.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  replace(message.entryId, message.text)
})
events.addEventListener('resync-required', () => {
  events.close()
  reloadHistory()
})
```

The browser authenticates to your origin. The account token stays in the process that constructed `client`.

Event names, cursor rules, and the SSE bytes are specified in [Events and SSE](/api/events).
