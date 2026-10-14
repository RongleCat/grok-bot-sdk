# 事件与 SSE

`watchBot` 产出对象。`botEventsSSE` 把同样的对象写成具名 SSE 事件。`data` 是 JSON。对象带有 `id` 时，这个字符串既是 SSE 的 `id`，也是恢复游标。

## 事件目录

| `type` | 何时出现 | 怎么处理 |
|---|---|---|
| `connected` | 流握手 | 把 `serverTimeMs` 和 `absoluteLifetimeMs` 读成十进制字符串。 |
| `heartbeat` | 上游心跳 | 读取 `serverTimeMs`。 |
| `message` | 一条文本 `send-message` | 在 `data.entryId` 上用 `data.text` 做整段替换。文本是完整正文。 |
| `entry` | 其他已解码的转录记录 | 读取 `data.entryKind` 和 `data.entry`。 |
| `entry.unavailable` | 正文缺失或不是合法 JSON | 游标仍然前进。`bodyOmitted` 和 `blobHash` 只是说明。 |
| `message.deleted` | 一条转录被删除 | 移除 `data.entryId`。 |
| `reset` | 代际变化，或会话被清空 | 丢掉这个会话的本地状态。`data.generation` 是新的代际。 |
| `resync-required` | 游标比服务端允许的更旧 | 生成器在这个事件之后返回。重新加载历史，再订阅。 |
| `turn.failed` | Bot 回合失败 | 读取 `turnId`、`code` 和 `summary`。 |
| `bot.state.changed` | 这个 Bot 的状态族变了 | 读取 `families`。 |
| `bot.updated` | 这个 Bot 的名单字段变了 | `data.bot` 是 `Bot`；载荷里没有 agent 对象时为 `null`。 |
| `stream.closed` | 仅 SSE。迭代器正常结束。 | 订阅结束。要继续就再开一条。 |
| `error` | 仅 SSE。响应头发出之后迭代器抛错。 | `data.code` 是 `SDKError` 的代码。 |

`message.data` 还包含 `operation: 'upsert'`、`botId`、`sessionId`、`generation`、`seq`、`updatedSeq` 和 `replay`。

`seq` 和 `updatedSeq` 是十进制字符串。服务端把这一批标成回放时，`replay` 为 `true`。

用户可见文本和其他记录类型是分开的：文本 `send-message` 变成 `message`。其他已解码正文变成 `entry`。因此用户回显不会被报成 Bot 的 `message` 文本，除非这条回显本身就是文本 `send-message`。

## SSE 字节

```text
event: message
id: <恢复游标>
data: {"botId":"...","sessionId":"","generation":0,"seq":"22","updatedSeq":"22","entryId":"...","replay":false,"operation":"upsert","text":"..."}

```

编码器实现的规则：

- `event` 是 `type` 字符串。它必须匹配 `^[a-z][a-z0-9._-]{0,60}$`。
- 事件没有 id 时省略 `id`（`connected`、`heartbeat`、`resync-required`、`turn.failed`、`bot.state.changed`、`bot.updated`、`stream.closed`、`error`）。
- `id` 最长 2048 个字符，且不能包含 CR、LF 或 NUL。
- `data` 是一个 JSON 对象。`JSON.stringify` 会转义文本，因此消息内容不能冲出 `data` 行。
- 事件之间用空行分开。
- 安静的流在缓冲区有空间时，每 `keepAliveMs` 毫秒写入一次 `: keepalive\n\n`。注释不是事件。

响应头：

```text
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
x-accel-buffering: no
```

## 恢复游标

游标 id 是 Base64URL 的 JSON：

```json
{ "botId": "...", "sessionId": "", "generation": 0, "afterUpdatedSeq": "22" }
```

把这个字符串作为 `resumeFrom` 传回同一个 Bot 和会话。浏览器在重连你的路由时，会把它放进 `Last-Event-ID`。把这个头复制到 `resumeFrom`。

`stream.closed` 和 `error` 不带 id。若要恢复，保留最后一条 `message`、`entry`、`entry.unavailable`、`message.deleted` 或 `reset` 的 id。

## 同一帧内的顺序

一批转录里的新增和删除按 `updatedSeq` 用 `BigInt` 排序后再应用。等于或落后于当前游标的更新会被跳过。然后游标变成这条更新的 `updatedSeq`。

这一批内部若代际变化，会先产出 `reset`，并把游标的 `afterUpdatedSeq` 设回 `0`，再应用这一批里的行。

属于另一个 `agentId` 或 `sessionId` 的帧会被忽略。
