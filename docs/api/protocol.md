# Protocol

Base URL for account RPCs: `https://api2.cursor.sh`.

Unary calls are HTTP POST, `content-type: application/json`, `connect-protocol-version: 1`, body JSON in camelCase. Redirects are rejected. A response larger than 8 MiB is `RESPONSE_TOO_LARGE` inside the transport and surfaces as a failed RPC.

## Headers

| Header | Value |
|---|---|
| `authorization` | `Bearer <accessToken>` |
| `x-cursor-client-type` | `sand` |
| `x-cursor-client-source` | `sand-desktop` |
| `x-cursor-client-version` | `options.version`, default `0.70.2` |
| `x-cursor-client-os` | `darwin` |
| `x-sand-box-namespace` | `prod` |
| `x-ghost-mode` | `true` |
| `x-request-id` | A new UUID per call |
| `user-agent` | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sand/<version> Safari/537.36` |
| `x-cursor-team-id` | Present when `teamId` is set |
| `x-cursor-checksum` | Present when `machineId` is set |

The checksum mixes a coarse timestamp with the machine id the way the 0.70.2 client did. It is optional for the login path that was verified.

## `GET https://cursor.com/loginDeepControl`

Query: `challenge`, `uuid`, `mode=login`, `redirectTarget=sand`, `supportsSelectedTeamLogin=true`.

`challenge` is Base64URL(SHA-256(32 random bytes)). The page is where the account holder approves the SDK session.

## `GET /auth/poll`

Query: `uuid`, `verifier`. HTTP 404 means pending. HTTP 200 returns `accessToken`, `refreshToken`, and sometimes `selectedTeamId`.

## `POST /aiserver.v1.DashboardService/GetMe`

Body `{}`. Used by `getMe()`. A usable body contains `authId` or `userId`.

## `POST /aiserver.v1.GrokBotService/ListGrokBotAgents`

Body `{ "includeTeamAgents": true }` unless the caller set the flag to false.

Response fields this SDK reads: `agents[]`, `truncated`. Each agent needs `agentId`. Avatar inputs are `avatarShape`, `avatarColor`, `avatarUrl`, `avatarDataUrl`, and `avatarVersion`. Roster inputs are `id`, `name`, `description`, `title`, `harness`, `kind`, `viewerSessionId`, `teamId`, `viewerIsOwner`, and `viewerCanManage`.

## `POST /aiserver.v1.GrokBotService/SendGrokBotUserMessage`

```json
{
  "agentId": "<Bot.id>",
  "text": "...",
  "sessionId": "",
  "messageId": "<uuid>",
  "attachmentPaths": [],
  "attachmentNames": [],
  "sentAtMs": "1710000000000",
  "isFork": false,
  "source": 1,
  "initiator": 1,
  "sendSource": 1
}
```

`delivery` maps to `accepted-box`, `accepted-temporal`, or `duplicate` as described in [Client](/api/client). `dispatched` is copied from the boolean field.

## `POST /aiserver.v1.GrokBotService/ListGrokBotTranscriptEntries`

Used when `watchBot` has neither `cursor` nor `resumeFrom`.

```json
{ "agentId": "<Bot.id>", "sessionId": "", "limit": 1 }
```

The SDK reads `generation` and the `updatedSeq` (or `seq`) of the returned entries, and starts the watch after the maximum.

## `POST /aiserver.v1.GrokBotService/WatchGrokBotTranscripts`

Connect JSON streaming, not SSE.

```text
content-type: application/connect+json
accept: application/connect+json
connect-accept-encoding: identity
```

The body is one Connect frame. The payload is:

```json
{
  "cursors": [
    { "agentId": "<Bot.id>", "sessionId": "", "generation": 0, "afterUpdatedSeq": "22" }
  ],
  "includeUnlistedAgents": false,
  "inlineBodyMaxBytes": 262144
}
```

### Frames

Each frame is a 5-byte header plus a JSON object.

| Offset | Meaning |
|---|---|
| 0 | Flags. `0` is a data frame. `2` is the end frame. |
| 1–4 | Payload length, big-endian uint32. |

The compression bit (`flags & 1`) is rejected. Any other flag value is rejected. The payload must be a JSON object, at most 1 MiB.

An end frame with an `error` property becomes `STREAM_RPC_ERROR`. The error object is not rethrown and not copied into the SDK error. An end frame ends the iterator. Data frames are yielded into the mapper that produces [events](/api/events).

Transcript text is a base64 JSON body on the entry. The decoder accepts UTF-8. A text message is `kind: "send-message"` with `message.type: "text"` and a string `message.content`. That content becomes `event.data.text`.

Header timeout for the watch request is 20 seconds, using the same `AbortSignal` as the caller.

## Calls this SDK does not make

Observed in the desktop client, and intentionally unimplemented:

- `POST /oauth/token` (refresh)
- `POST /auth/exchange_user_api_key`
- `POST /auth/logout`
- `EnsureSandBox`, gateway `/health`, and gateway `listAgents`
- Attachment upload (`BeginGrokBotAttachmentUpload` and the box upload path)

The generated client contains hundreds of additional RPC names. A name that is not in the list above is not wrapped, not called, and not covered by the tests of this package.
