# 客户端

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

| 选项 | 是否必须 | 行为 |
|---|---|---|
| `accessToken` | 必须 | 作为 `Authorization: Bearer` 发送。空字符串抛出 `MISSING_ACCESS_TOKEN`。 |
| `version` | 可选 | `x-cursor-client-version`。默认 `0.75.8`。 |
| `machineId` | 可选 | 有值时增加 `x-cursor-checksum`。 |
| `teamId` | 可选 | 有值时增加 `x-cursor-team-id`。 |
| `fetchImpl` | 可选 | 替换全局 `fetch`。 |

客户端不把令牌写入磁盘。

## `getMe(): Promise<Record<string, unknown>>`

`POST /aiserver.v1.DashboardService/GetMe`，请求体 `{}`。

当存在 `authId` 或 `userId` 时，解析为该 JSON 对象。否则抛出 `ACCOUNT_AUTH_FAILED`；传输层返回了 HTTP 状态时，带上 `httpStatus`。

对象里可以有邮箱、姓名、团队和头像字段。只持久化你的隐私规则允许的部分。

## `listBots(options?): Promise<{ bots: Bot[]; truncated: boolean; slackConnections: SlackConnection[]; teamsConnections: TeamsConnection[] }>`

```ts
listBots({
  includeTeamAgents?: boolean
  role?: string
  addedTeamAgentsOnly?: boolean
}): Promise<{ bots: Bot[]; truncated: boolean; slackConnections: SlackConnection[]; teamsConnections: TeamsConnection[] }>
```

`includeTeamAgents` 默认 `true`。只有调用方设置了 `role` 和 `addedTeamAgentsOnly`，请求里才会带上它们。

HTTP 失败时抛出 `RPC_FAILED`。缺少 `agents` 时抛出 `INVALID_ROSTER_RESPONSE`。每个元素经过 `normalizeBot`。只有服务端发送 `truncated: true` 时，结果里的 `truncated` 才是 `true`。连接数组缺失时变成空数组。

## `normalizeBot(agent): Bot`

要求 `agent.agentId` 是非空字符串。否则抛出 `INVALID_BOT_RECORD`。

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

`id` 是 `agentId`。记录的 `id` 是字符串时，它成为 `serverId`。`sessionId` 是 `viewerSessionId`。`avatarShape` 和 `avatarColor` 复制解析后的角色，因此与 `avatar.character` 保持一致。`kind` 和 `visibility` 保留字符串枚举名；服务端发来数字时，存成十进制字符串。

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

`botId` 必须匹配 `^[A-Za-z0-9_-]{1,128}$`。`text` 必须含有非空白字符。`sessionId` 默认 `''`。`messageId` 默认是新的 UUID。两个附件数组必须等长，且每一项都是非空字符串。其余情况抛出 `MESSAGE_INVALID`。

HTTP 失败抛出 `SEND_UNCONFIRMED`。响应体里的 `delivery` 不在已知接受集合中时抛出 `SEND_REFUSED`。已知接受是整数 `1`、`2`、`3`，以及枚举名 `GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX`、`GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL`、`GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE`。整数 `4` 和 `GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED` 是拒绝，抛出 `SEND_REFUSED`。

请求还会发送 `sentAtMs`，它是 `Date.now()` 的十进制字符串，以及 `isFork: false`、`source: 1`（`DESKTOP`）、`initiator: 1`（`USER`）、`sendSource: 1`（`CHAT`）。这三个整数是 0.75.8 桌面聊天使用的值。回复、任务、语言、富文本和 machine id 只有调用方传入时才发送。可选字符串为空时抛出 `MESSAGE_INVALID`。`richText` 可以是空字符串。

## 为 0.75.8 增加的只读方法

HTTP 失败，或响应里缺少预期的数组或对象时，这些方法抛出 `RPC_FAILED`。`botId` 的形状与 `sendMessage` 相同，否则抛出 `BOT_ID_REQUIRED`。

| 方法 | 调用 |
|---|---|
| `listSessions(botId)` | `ListGrokBotAgentSessions`，返回 `{ sessions }` |
| `listTranscript({ botId, sessionId?, limit?, generation?, beforeSeq?, unreadBoundaryMs? })` | 返回 `{ generation, entries, cloudAgentPeerIds, cloudAgentPeerIdsKnown, unreadAnchor }`。`limit` 默认 50。 |
| `listAgentStatuses(agentIds?)` | 返回 `{ statuses }`，含 `live` 和 `client` 的标量字段 |
| `getSendStatus({ botId, messageId, sessionId?, firstSentAgeMs? })` | 返回 `{ status, echoEntryId, rejectionCode, acceptedAtMs }`。已知状态是 `unspecified`、`not-found`、`accepted`、`rejected`、`pending`、`unknown-durability`。 |
| `listAgentTasks({ botId, includeRecentlyDone? })` | 返回 `{ tasks }` |
| `listTasks({ botId, sessionId? })` | 一个会话的 `{ tasks }`。`sessionId` 默认 `''`。 |
| `listSubagents(botId)` | 返回 `{ subagents }` |
| `listAgentTodos(botId)` | 返回 `{ todos }` |
| `listAgentSkills(botId)` | 返回 `{ skills }`，包含每条 skill 的 `body` |
| `listDeletedAgentIds(agentIds?)` | 返回服务端仍报告为已删除的 `{ agentIds }` |
| `getRuntimeCapabilities()` | 五个布尔值：持久身份、持久身份写入、Temporal 创建、agent 消息、服务端房间 |
| `getSandBoxRunState()` | 返回 `{ runState, imageUpdateAvailable, egressTunnelOwnership, image }`。已知 `runState` 是 `unspecified`、`absent`、`hibernated`、`running`、`starting`。 |

`listTranscript` 在会话、limit、generation 或序号不合法时抛出 `CURSOR_INVALID`。`getSendStatus` 在 `messageId` 为空时抛出 `MESSAGE_INVALID`。这些读取不会发送聊天消息。`getSendStatus` 只询问先前那次发送是否被接受。

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

| 检查 | 错误 |
|---|---|
| `botId` 的形状，与发送相同 | `BOT_ID_REQUIRED` |
| `sessionId` 长于 256，或同时给了 `cursor` 和 `resumeFrom` | `CURSOR_INVALID` |
| `resumeFrom` 解出来属于另一个 Bot 或会话 | `CURSOR_SCOPE_MISMATCH` |
| `generation` 不在 `0 .. 2^32-1` | `CURSOR_INVALID` |
| `afterUpdatedSeq` 不是 1 到 20 位十进制数，或大于 `2^64-1` | `CURSOR_INVALID` |
| `inlineBodyMaxBytes` 不在 `1 .. 524288` | `STREAM_FRAME_TOO_LARGE` |

`signal` 已经中止时，生成器直接返回，不发请求。

否则它先确定游标，打开 `WatchGrokBotTranscripts`，然后产出 `BotEvent`，直到流结束、信号中止，或产出 `resync-required`。传输和帧错误抛出 `SDKError`。信号中止时生成器返回，不抛错。

你传入的游标上的 `generation` 必须来自目标会话。这个字段不是可以给每个 Bot 都写成 `0` 的常数。

## `botEventsSSE(options): Response`

接受 `WatchOptions`，另加 `keepAliveMs?: number`（默认 `15000`）。

返回一个 `Response`，其正文把 `watchBot` 迭代器编码成 SSE。调用方关闭正文，或 `options.signal` 中止时，上游请求一并中止。响应开始之后，失败变成 `error` 事件。见[事件与 SSE](/zh/api/events)。

## `createLogin(): LoginFlow`

```ts
interface LoginFlow {
  uuid: string
  verifier: string
  loginUrl: string
}
```

`verifier` 是 32 个随机字节的 Base64URL。`loginUrl` 带 SHA-256 challenge，不带 `verifier`。见[授权](/zh/guide/auth)。

## `pollLogin(flow, options?): Promise<Session>`

```ts
pollLogin(flow: LoginFlow, options?: {
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<unknown>
  maxAttempts?: number
  onPending?: (attempt: number) => void
}): Promise<{ accessToken: string; refreshToken: string; selectedTeamId?: number }>
```

`maxAttempts` 默认 150。成功要求两段令牌都是字符串。`LOGIN_POLL_FAILED`、`LOGIN_TIMED_OUT` 和 `SIGN_IN_POLICY_VIOLATION` 以 `Error` 抛出，消息就是这个代码，不是 `SDKError`。策略错误是 HTTP 403 `{ "error": "sign_in_policy_violation" }`，不会重试。

## `desktopCredentials(): Promise<ClientOptions & { version: string }>`

来自 `grok-bot-sdk/desktop`。仅 macOS。见[授权](/zh/guide/auth)。

`version(): string` 读取 `/Applications/Grok Bot.app` 的 `CFBundleShortVersionString`。
