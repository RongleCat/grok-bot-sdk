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
| `version` | no | `x-cursor-client-version`. Default `0.78.1`. |
| `machineId` | no | When set, adds `x-cursor-checksum`. |
| `teamId` | no | When set, adds `x-cursor-team-id`. |
| `fetchImpl` | no | Replaces global `fetch`. |

The client does not copy the token to disk.

## `getMe(): Promise<Record<string, unknown>>`

`POST /aiserver.v1.DashboardService/GetMe` with `{}`.

Resolves with the JSON object when `authId` or `userId` is present. Otherwise throws `ACCOUNT_AUTH_FAILED`, with `httpStatus` when the transport returned one.

The object can contain email, name, team, and profile fields. Persist only what your privacy rules allow.

## `listBots(options?): Promise<{ bots: Bot[]; truncated: boolean; slackConnections: SlackConnection[]; teamsConnections: TeamsConnection[] }>`

```ts
listBots({
  includeTeamAgents?: boolean
  role?: string
  addedTeamAgentsOnly?: boolean
}): Promise<{ bots: Bot[]; truncated: boolean; slackConnections: SlackConnection[]; teamsConnections: TeamsConnection[] }>
```

`includeTeamAgents` defaults to `true`. `role` and `addedTeamAgentsOnly` are omitted from the request unless you set them.

Throws `RPC_FAILED` when the HTTP call fails, and `INVALID_ROSTER_RESPONSE` when `agents` is missing. Each element goes through `normalizeBot`. `truncated` is `true` only when the server sends `truncated: true`. Missing connection arrays become empty arrays.

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
  role: string
  kind: string
  visibility: string
  sessionId: string
  teamId: number | null
  viewerIsOwner: boolean
  viewerCanManage: boolean
  teamDefaultForViewer: boolean
  ownerDisplayName: string
  draftingDisabled: boolean
  accessGrantsOnly: boolean
  memberAgentIds: string[]
  viewerAllowedActions: string[]
  createdAtMs: string | null
  updatedAtMs: string | null
  legacyAgentId: string
  voiceId: string
  voiceSpeed: number | null
  voiceLanguage: string
}
```

`id` is `agentId`. `serverId` is the record's `id` when that value is a string. `sessionId` is `viewerSessionId`. `avatarShape` and `avatarColor` copy the resolved character, so they stay aligned with `avatar.character`. `kind` and `visibility` keep a string enum name, or the decimal form when the server sends a number.

## `sendMessage(options)`

```ts
interface SendOptions {
  botId: string
  text: string
  sessionId?: string
  messageId?: string
  attachmentPaths?: string[]
  attachmentNames?: string[]
  replyToId?: string
  replyQuote?: string
  taskId?: string
  language?: string
  richText?: string
  machineId?: string
}

sendMessage(options: SendOptions): Promise<{
  botId: string
  messageId: string
  delivery: 'accepted-box' | 'accepted-temporal' | 'duplicate'
  dispatched: boolean
}>
```

`botId` must match `^[A-Za-z0-9_-]{1,128}$`. `text` must contain non-whitespace. `sessionId` defaults to `''`. `messageId` defaults to a new UUID. The two attachment arrays must be the same length, and every item must be a non-empty string. Anything else throws `MESSAGE_INVALID`.

A failed HTTP call throws `SEND_UNCONFIRMED`. A body whose `delivery` is outside the known acceptance set throws `SEND_REFUSED`. Known acceptances are the integers `1`, `2`, `3` and the enum names `GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX`, `GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL`, and `GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE`. Integer `4` and `GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED` are a refusal and throw `SEND_REFUSED`.

The request also sends `sentAtMs` as a decimal string of `Date.now()`, plus `isFork: false`, `source: 1` (`DESKTOP`), `initiator: 1` (`USER`), and `sendSource: 1` (`CHAT`). Those are the 0.78.1 desktop chat values. Optional reply, task, language, rich text, and machine id fields are sent only when you pass them. `rendersMcpElicitationForms: true` is sent only when you pass `true`; `false` is omitted. An empty optional string throws `MESSAGE_INVALID`. `richText` may be an empty string.

## Read methods added for 0.75.8

Each method throws `RPC_FAILED` when the HTTP call fails or the expected array or object is missing. `botId` uses the same shape as `sendMessage` and otherwise throws `BOT_ID_REQUIRED`.

| Method | Call |
|---|---|
| `listSessions(botId)` | `{ sessions }` from `ListGrokBotAgentSessions` |
| `listTranscript({ botId, sessionId?, limit?, generation?, beforeSeq?, unreadBoundaryMs? })` | `{ generation, entries, cloudAgentPeerIds, cloudAgentPeerIdsKnown, unreadAnchor, updatedSeqLocked }`. `limit` defaults to 50. |
| `listAgentStatuses(agentIds?)` | `{ statuses }` with `live` and `client` scalar fields, including `client.unreadThreadCount` |
| `getSendStatus({ botId, messageId, sessionId?, firstSentAgeMs?, taskId? })` | `{ status, echoEntryId, rejectionCode, acceptedAtMs }`. `taskId` is sent only when set. Known statuses are `unspecified`, `not-found`, `accepted`, `rejected`, `pending`, and `unknown-durability`. |
| `listAgentTasks({ botId, includeRecentlyDone? })` | `{ tasks }`, including `followed` |
| `listTasks({ botId, sessionId? })` | `{ tasks }` for one session. `sessionId` defaults to `''`. |
| `listSubagents(botId)` | `{ subagents }` |
| `listAgentTodos(botId)` | `{ todos }` |
| `listAgentSkills(botId)` | `{ skills }`, including each skill `body` |
| `listDeletedAgentIds(agentIds?)` | `{ agentIds }` that the server still reports as deleted |
| `getRuntimeCapabilities()` | five booleans: durable identity, durable identity writes, temporal creation, agent messaging, server rooms |
| `getSandBoxRunState()` | `{ runState, imageUpdateAvailable, egressTunnelOwnership, image }`. `runState` is `unspecified`, `absent`, `hibernated`, `running`, or `starting` when the enum is known. |

`listTranscript` throws `CURSOR_INVALID` for a bad session, limit, generation, or sequence. `getSendStatus` throws `MESSAGE_INVALID` when `messageId` is empty. These reads do not send a chat message. `getSendStatus` only asks whether an earlier send was accepted.

`Bot.accessOwnerOnly` comes from `GrokBotAgent.accessOwnerOnly`. A missing value is `false`.

## Reads added for 0.78.1

| Method | Call |
|---|---|
| `getAgentCustomMcp({ botId, pluginId })` | `GetGrokBotAgentCustomMcp`. `pluginId` is a non-negative int64, sent as a decimal string. Returns `{ server }` with `http` and `stdio`. Only one transport is set by the server. The read returns header names and `hasOauthClientId` / `hasOauthClientSecret`, not header values or secrets. A missing server throws `RPC_FAILED`. |
| `listAgentAccessInvites(botId)` | `ListGrokBotAgentAccessInvites`. Returns `{ invites, capUsage }`. |
| `previewAgentAccessInvite(code)` | `PreviewGrokBotAgentAccessInvite`. Returns the proto fields: `found`, `recipientMatch`, `sender`, `invites`, `truncated`, `otherResourceInviteCount`, and `eligibility`. An empty code throws `MESSAGE_INVALID`. |

## Management writes

These call `GrokBotService` write RPCs. A failed HTTP call, or a response that is missing the agent or skill record the method requires, throws `RPC_FAILED`. `botId`, `roomId`, and member agent ids use the same shape as `sendMessage` and otherwise throw `BOT_ID_REQUIRED`. Bad text, user ids, or enums throw `MESSAGE_INVALID`.

`roomId` is `Bot.id`. A room's `kind` is `ROOM`, `GROK_BOT_AGENT_KIND_ROOM`, or `2`.

| Method | Call | Destructive |
|---|---|---|
| `deleteBot(botId)` | `DeleteGrokBotAgent` with `{id: botId}`. Returns `{id}`. The response message is empty. | Irreversible |
| `deleteRoom(roomId)` | Lists the roster, then deletes only when that id is present and its kind is ROOM. Otherwise throws `NOT_A_ROOM` and does not delete. | Irreversible |
| `createRoom({name, memberAgentIds, description?, humanMemberUserIds?, agentId?})` | `CreateGrokBotRoom`. `agentId` defaults to a new UUID. `description` defaults to `''`. `humanMemberUserIds` are int32 user ids and default to `[]`. Returns `{bot}` only when the server echoes the same id and a ROOM kind. | No |
| `addRoomMembers({roomId, userIds})` | `AddGrokBotRoomPeople`. Returns `{bot}`. | No |
| `removeRoomMembers({roomId, userIds})` | `RemoveGrokBotRoomPeople`. Returns `{bot: null}` when the response has no agent. | Irreversible |
| `setRoomMembers({roomId, memberAgentIds})` | `SetGrokBotRoomMembers`. Replaces bot members. An empty array is sent as an empty array. | Irreversible |
| `createBot({name, ...})` | `CreateGrokBotAgent`. Always sends `agentId`, `name`, `description`, `title`, `avatarShape`, and `avatarColor` (`description`, `title`, and avatar strings default to `''`). Optional: `legacyAgentId`, `avatarDataUrl`, `harness` (`UNSPECIFIED`, `BOX`, `TEMPORAL`, or `0`/`1`/`2`), `kickstartRequested`, `introductionSuppressed`, `purpose`, `origin`, `language`, `createIntent`, `createCaller`, `createdAutomatically`. Returns `{bot, harness}`. | No |
| `updateBot({id, name?, description?, title?, avatarShape?, avatarColor?, avatarDataUrl?, clearAvatar?})` | `UpdateGrokBotAgent`. `id` is `Bot.serverId` (`GrokBotAgent.id`), not `Bot.id`. `partialUpdate` is always `true`. Omitted text fields are not sent. `clearAvatar: true` sends `clearAvatar: {}`. Combining it with `avatarDataUrl` throws `MESSAGE_INVALID`. At least one change is required. | No |
| `addAgentSkill({botId, content, name?, description?})` | `AddGrokBotAgentSkill`. `content` may be empty. Returns `{marketplace, plugins, skill}`. | No |
| `updateAgentSkill({botId, name, content, description?})` | `UpdateGrokBotAgentSkill`. | No |
| `removeAgentSkill({botId, name})` | `RemoveGrokBotAgentSkill`. Returns `{marketplace, plugins}` and no skill. | Irreversible |

The desktop client creates temporal bots with `CreateGrokBotTemporalAgent`, which shares this request message. `createBot` calls `CreateGrokBotAgent`. Skill IPC `files` are not a field on these three skill requests, so this SDK does not send them. The skill record on a write is `GrokBotAgentPluginSkill` (`name`, `description`, `sourcePath`, `sourceUrl`, `content`, `environments`), not the `GrokBotAgentSkill` shape returned by `listAgentSkills`. A plugin on that response also includes `credentialSource`, `delegatedCredential`, `credentialAllowedActions`, and `supportsServiceAccount`. `delegatedCredential.attachedAt` is an RFC 3339 timestamp string.

There is no restore, undelete, or recover RPC for a deleted agent in the 0.78.1 proto. `deleteBot` and `deleteRoom` cannot be undone through this package.

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

`maxAttempts` defaults to 150. Success requires both token strings. `LOGIN_POLL_FAILED`, `LOGIN_TIMED_OUT`, and `SIGN_IN_POLICY_VIOLATION` are thrown as `Error` with that message, not as `SDKError`. The policy error is HTTP 403 `{ "error": "sign_in_policy_violation" }` and does not retry.

## `desktopCredentials(): Promise<ClientOptions & { version: string }>`

From `grok-bot-sdk/desktop`. macOS only. See [Authorization](/guide/auth).

`version(): string` reads `CFBundleShortVersionString` from `/Applications/Grok Bot.app`.
