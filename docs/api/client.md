# Client

## `new GrokBotClient(options)`

```ts
interface ClientOptions {
  accessToken: string
  version?: string
  machineId?: string
  teamId?: number
  fetchImpl?: typeof fetch
}
```

| Option | Required | Behavior |
|---|---|---|
| `accessToken` | yes | Sent as `Authorization: Bearer`. An empty string throws `MISSING_ACCESS_TOKEN`. |
| `version` | no | `x-cursor-client-version`. Default `0.70.2`. |
| `machineId` | no | When set, adds `x-cursor-checksum`. |
| `teamId` | no | When set, adds `x-cursor-team-id`. |
| `fetchImpl` | no | Replaces global `fetch`. |

The client does not copy the token to disk.

## `getMe(): Promise<Record<string, unknown>>`

`POST /aiserver.v1.DashboardService/GetMe` with `{}`.

Resolves with the JSON object when `authId` or `userId` is present. Otherwise throws `ACCOUNT_AUTH_FAILED`, with `httpStatus` when the transport returned one.

The object can contain email, name, team, and profile fields. Persist only what your privacy rules allow.

## `listBots(options?): Promise<{ bots: Bot[]; truncated: boolean }>`

```ts
listBots({ includeTeamAgents?: boolean }): Promise<{ bots: Bot[]; truncated: boolean }>
```

`includeTeamAgents` defaults to `true`.

Throws `RPC_FAILED` when the HTTP call fails, and `INVALID_ROSTER_RESPONSE` when `agents` is missing. Each element goes through `normalizeBot`. `truncated` is `true` only when the server sends `truncated: true`.

## `normalizeBot(agent): Bot`

Requires `agent.agentId` to be a non-empty string. Otherwise throws `INVALID_BOT_RECORD`.

```ts
interface Bot {
  id: string
  serverId: string | null
  name: string
  description: string
  title: string
  avatarShape: string
  avatarColor: string
  avatar: ResolvedAvatar
  harness: string
  kind: string
  sessionId: string
  teamId: number | null
  viewerIsOwner: boolean
  viewerCanManage: boolean
}
```

`id` is `agentId`. `serverId` is the record's `id` when that value is a string. `sessionId` is `viewerSessionId`. `avatarShape` and `avatarColor` copy the resolved character, so they stay aligned with `avatar.character`.

## `sendMessage(options)`

```ts
interface SendOptions {
  botId: string
  text: string
  sessionId?: string
  messageId?: string
  attachmentPaths?: string[]
  attachmentNames?: string[]
}

sendMessage(options: SendOptions): Promise<{
  botId: string
  messageId: string
  delivery: 'accepted-box' | 'accepted-temporal' | 'duplicate'
  dispatched: boolean
}>
```

`botId` must match `^[A-Za-z0-9_-]{1,128}$`. `text` must contain non-whitespace. `sessionId` defaults to `''`. `messageId` defaults to a new UUID. The two attachment arrays must be the same length, and every item must be a non-empty string. Anything else throws `MESSAGE_INVALID`.

A failed HTTP call throws `SEND_UNCONFIRMED`. A body whose `delivery` is outside the known set throws `SEND_REFUSED`. Known deliveries are the integers `1`, `2`, `3` and the enum names `GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX`, `GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL`, and `GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE`.

The request also sends `sentAtMs` as a decimal string of `Date.now()`, plus `isFork: false`, `source: 1`, `initiator: 1`, and `sendSource: 1`. Those three integers are the values the 0.70.2 client sent. This SDK does not expose them as options.

## `watchBot(options): AsyncGenerator<BotEvent>`

```ts
interface WatchOptions {
  botId: string
  sessionId?: string
  cursor?: { generation: number; afterUpdatedSeq: string }
  resumeFrom?: string
  signal?: AbortSignal
  inlineBodyMaxBytes?: number
}
```

| Check | Error |
|---|---|
| `botId` shape, same rule as send | `BOT_ID_REQUIRED` |
| `sessionId` longer than 256, or both `cursor` and `resumeFrom` | `CURSOR_INVALID` |
| `resumeFrom` that decodes for another bot or session | `CURSOR_SCOPE_MISMATCH` |
| `generation` outside `0 .. 2^32-1` | `CURSOR_INVALID` |
| `afterUpdatedSeq` that is not a 1–20 digit decimal, or above `2^64-1` | `CURSOR_INVALID` |
| `inlineBodyMaxBytes` outside `1 .. 524288` | `STREAM_FRAME_TOO_LARGE` |

If `signal` is already aborted, the generator returns without a request.

Otherwise it resolves a cursor, opens `WatchGrokBotTranscripts`, and yields `BotEvent` values until the stream ends, the signal aborts, or a `resync-required` event is yielded. Transport and frame failures throw `SDKError`. An aborted signal returns instead of throwing.

`generation` on a cursor you pass must come from the target session. The field is not a constant you can set to `0` for every bot.

## `botEventsSSE(options): Response`

Accepts `WatchOptions` plus `keepAliveMs?: number` (default `15000`).

Returns a `Response` whose body encodes the `watchBot` iterator as SSE. The caller closing the body, or `options.signal` aborting, aborts the upstream request. After the response has started, failures are `error` events. See [Events and SSE](/api/events).

## `createLogin(): LoginFlow`

```ts
interface LoginFlow {
  uuid: string
  verifier: string
  loginUrl: string
}
```

`verifier` is 32 random bytes in Base64URL. `loginUrl` carries the SHA-256 challenge and does not carry `verifier`. See [Authorization](/guide/auth).

## `pollLogin(flow, options?): Promise<Session>`

```ts
pollLogin(flow: LoginFlow, options?: {
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<unknown>
  maxAttempts?: number
  onPending?: (attempt: number) => void
}): Promise<{ accessToken: string; refreshToken: string; selectedTeamId?: number }>
```

`maxAttempts` defaults to 150. Success requires both token strings. `LOGIN_POLL_FAILED` and `LOGIN_TIMED_OUT` are thrown as `Error` with that message, not as `SDKError`.

## `desktopCredentials(): Promise<ClientOptions & { version: string }>`

From `grok-bot-sdk/desktop`. macOS only. See [Authorization](/guide/auth).

`version(): string` reads `CFBundleShortVersionString` from `/Applications/Grok Bot.app`.
