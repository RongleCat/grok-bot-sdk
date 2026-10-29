# Notes

Checked against Grok Bot **0.78.1**. A newer client can change paths, headers, enums, and the avatar salt. Pass `version` when you are matching a specific build. The default string is `0.78.1`. The avatar hash string remains `grok-bot-0.70.2` because that derivation did not change.

## Identity of the library

This is an independent implementation of calls the desktop client makes. It is not an xAI SDK and not a Cursor SDK. You are responsible for using it with an account you control, and for the terms that apply to that account.

The runtime is Node.js 22.13 or newer, ESM, with no npm dependencies. It uses global `fetch`, Web Streams, `AbortSignal.any`, and `Response`.

## Credentials

The access token can read the account and the bots. Store it like a password.

Keep these out of logs, analytics, and ticket attachments:

- access token and refresh token
- the login `verifier` and the poll URL that carries it
- Keychain password and machine id
- email, display name, and message text
- signed upload URLs and gateway tokens

The login page URL is safe to print. It carries the challenge and the uuid.

Browser login creates a separate session. It does not rotate the refresh token stored by the official app. This package does not call `POST /oauth/token` and does not call `POST /auth/logout`. When the access token stops working, start a new login.

Deleting a local credentials file, or exiting the process, drops your copy. The server session remains.

`whoami` and the examples print presence flags or roster fields you asked to print. `getMe()` itself returns the raw payload. Do not write that object to a shared log.

## Desktop adapter

`desktopCredentials()` is macOS-only. It reads the Grok Bot support directory and the Keychain item `Grok Bot Safe Storage`. The operating system prompts for access. The function returns after that prompt succeeds.

The decrypt parameters match the Electron `v10` blobs observed on that macOS client. This package has no Windows or Linux credential reader.

A rejected or expired desktop token stops at `ACCOUNT_AUTH_FAILED`. Use browser login next. Do not refresh the token the official app is also using.

`x-cursor-checksum` is sent only when a machine id is present. A fresh browser login completed account and roster reads without it.

## Network

Account RPCs go to `https://api2.cursor.sh`. Redirects are errors. The client sends the desktop identity headers documented on the [protocol page](/api/protocol): `x-cursor-client-type: sand`, source `sand-desktop`, OS `darwin`, namespace `prod`, ghost mode, and a per-request id. Which of those headers the server requires was not isolated one by one.

`x-cursor-client-os` stays `darwin` even when your process runs elsewhere, because that is the header the inspected client sent.

## Roster

Honor `truncated`. A truncated array is not the full roster, and this SDK does not page further.

`includeTeamAgents: true` can include team bots and groups. `kind`, `viewerIsOwner`, and `teamId` are the fields available for your own filter.

`Bot.id` is `agentId`. `Bot.serverId` is the other id. Send, watch, and avatar derivation use `Bot.id`.

## Avatars

Derivation uses the agent UUID exactly as the string arrived: same case, hyphens included, no extra trim. An uppercased UUID is a different key.

Shape and color fall back independently. A valid explicit shape with a missing color keeps the shape and derives the color.

The default pool is 8 shapes by 10 colors. The editor allows more shapes, and black is an explicit color outside the random pool. Different bots can share an avatar.

When `avatar.kind` is `picture`, render `avatar.picture.url` if it is a string. A record that only has `avatarVersion` still reports `kind: 'picture'` and `picture.url: null`. This SDK does not download images and does not ship the animation runtime.

Offline derivation is `deriveDefaultAvatar(agentUuid)` from `grok-bot-sdk/avatar`. It needs no token. See [Avatar](/api/avatar).

## Send

`accepted-box`, `accepted-temporal`, and `duplicate` mean the server accepted the delivery record. They do not mean the bot read the text or produced a reply. `dispatched` is a separate boolean.

`SEND_UNCONFIRMED` means the HTTP result was not a confirmed acceptance. Leave the message unsent from the SDK's point of view and decide in your own code. An automatic retry can deliver a second copy. A stable `messageId` makes a later duplicate visible as `delivery: 'duplicate'`.

`attachmentPaths` and `attachmentNames` are server references. This package does not upload bytes, does not call `EnsureSandBox`, and does not set `wake`.

`messageId` on the send and `entryId` on the transcript are different identifiers. The watch is the bot session. Other sends in that session appear on the same stream. There is no method that returns only the reply to one `messageId`.

## Streams

`watchBot` speaks Connect JSON to `WatchGrokBotTranscripts`. `botEventsSSE` is the adapter that emits a browser-compatible SSE response. The upstream is not itself an SSE socket.

A `message` event's `text` is the full current body of that entry. Later events with the same `entryId` replace it. Per-token deltas were not part of the verified stream. The JSON is not an OpenAI Chat Completions chunk.

The default cursor is the newest transcript row's `updatedSeq`, after a `limit: 1` read. Edits to older rows can still be delivered. Pass `cursor` when you want a known point, and take `generation` from that session.

`seq` and `updatedSeq` are decimal strings. Compare them with `BigInt`. JavaScript numbers lose integers past `2^53 - 1`.

`cursor` and `resumeFrom` together throw `CURSOR_INVALID`. A `resumeFrom` value for another bot or session throws `CURSOR_SCOPE_MISMATCH`.

`reset` means the generation changed or the session was cleared. Drop your local copy of that session. `resync-required` ends the subscription. Reload history in your app, then subscribe again. The SDK stops at that event.

`entry.unavailable` still moves the cursor forward. The body is omitted or could not be decoded. This SDK does not fetch the missing blob.

There is no reconnect loop inside `watchBot` or `botEventsSSE`. `stream.closed` means the HTTP body ended. It does not mean the bot finished a turn. Open a new request and pass the last event id as `resumeFrom` when you want to continue.

Frames are uncompressed. A frame larger than 1 MiB fails. `inlineBodyMaxBytes` defaults to 256 KiB and the maximum you can request is 512 KiB.

Once the watch response is HTTP 200, a later upstream failure becomes an SSE `error` event whose data is `{ "code": "<SDK code>" }`. The HTTP status of that response stays 200. On the browser side, a network failure and an SDK `error` event are different: the SDK event has a JSON `data` payload.

Keepalive lines are SSE comments (`: keepalive`). They keep proxies from closing a quiet stream. `keepAliveMs` defaults to 15000. The comment is written when the stream has room.

Cancelling the request aborts the upstream watch, including the transcript lookup that happens before the frames start.

`bot.updated` is emitted for the subscribed bot. Roster changes for other bots are not forwarded.

## SSE deployment

Response headers are:

```text
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
x-accel-buffering: no
```

Your framework and your proxy have to flush the body. The SDK returns a `Response`. It does not listen on a port.

The account token belongs in the server that holds `GrokBotClient`. The browser `EventSource` calls your route. Query-string tokens end up in access logs.

## Outside this package

Recording, a native watch client, avatar animation, file upload, multipart upload, credential refresh, logout, and paging a truncated roster are outside this release. The desktop client declares many more RPCs. The [protocol page](/api/protocol) lists the ones this SDK calls.
