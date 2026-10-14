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
| `version` | 可选 | `x-cursor-client-version`。默认 `0.70.2`。 |
| `machineId` | 可选 | 有值时增加 `x-cursor-checksum`。 |
| `teamId` | 可选 | 有值时增加 `x-cursor-team-id`。 |
| `fetchImpl` | 可选 | 替换全局 `fetch`。 |

客户端不把令牌写入磁盘。

## `getMe(): Promise<Record<string, unknown>>`

`POST /aiserver.v1.DashboardService/GetMe`，请求体 `{}`。

当存在 `authId` 或 `userId` 时，解析为该 JSON 对象。否则抛出 `ACCOUNT_AUTH_FAILED`；传输层返回了 HTTP 状态时，带上 `httpStatus`。

对象里可以有邮箱、姓名、团队和头像字段。只持久化你的隐私规则允许的部分。

## `listBots(options?): Promise<{ bots: Bot[]; truncated: boolean }>`

```ts
listBots({ includeTeamAgents?: boolean }): Promise<{ bots: Bot[]; truncated: boolean }>
```

`includeTeamAgents` 默认 `true`。

HTTP 失败时抛出 `RPC_FAILED`。缺少 `agents` 时抛出 `INVALID_ROSTER_RESPONSE`。每个元素经过 `normalizeBot`。只有服务端发送 `truncated: true` 时，结果里的 `truncated` 才是 `true`。

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
  kind: string
  sessionId: string
  teamId: number | null
  viewerIsOwner: boolean
  viewerCanManage: boolean
}
```

`id` 是 `agentId`。记录的 `id` 是字符串时，它成为 `serverId`。`sessionId` 是 `viewerSessionId`。`avatarShape` 和 `avatarColor` 复制解析后的角色，因此与 `avatar.character` 保持一致。

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

`botId` 必须匹配 `^[A-Za-z0-9_-]{1,128}$`。`text` 必须含有非空白字符。`sessionId` 默认 `''`。`messageId` 默认是新的 UUID。两个附件数组必须等长，且每一项都是非空字符串。其余情况抛出 `MESSAGE_INVALID`。

HTTP 失败抛出 `SEND_UNCONFIRMED`。响应体里的 `delivery` 不在已知集合中时抛出 `SEND_REFUSED`。已知投递是整数 `1`、`2`、`3`，以及枚举名 `GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX`、`GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL`、`GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE`。

请求还会发送 `sentAtMs`，它是 `Date.now()` 的十进制字符串，以及 `isFork: false`、`source: 1`、`initiator: 1`、`sendSource: 1`。这三个整数是 0.70.2 客户端发送的值。这个 SDK 不把它们做成选项。

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

`maxAttempts` 默认 150。成功要求两段令牌都是字符串。`LOGIN_POLL_FAILED` 和 `LOGIN_TIMED_OUT` 以 `Error` 抛出，消息就是这个代码，不是 `SDKError`。

## `desktopCredentials(): Promise<ClientOptions & { version: string }>`

来自 `grok-bot-sdk/desktop`。仅 macOS。见[授权](/zh/guide/auth)。

`version(): string` 读取 `/Applications/Grok Bot.app` 的 `CFBundleShortVersionString`。
