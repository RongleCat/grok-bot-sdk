# 调用

一个账号令牌对应一个 client。各个方法共用这个令牌和客户端版本头。

```js
import { GrokBotClient } from 'grok-bot-sdk'

const client = new GrokBotClient({
  accessToken: process.env.GROK_BOT_ACCESS_TOKEN,
  version: '0.70.2',
  teamId: undefined,
})
```

`fetchImpl` 在测试里替换全局 `fetch`。生产环境留空。

## 账号与名单

```js
const me = await client.getMe()
const { bots, truncated } = await client.listBots({ includeTeamAgents: true })
```

`includeTeamAgents` 默认 `true`，与核对名单时使用的请求一致。需要更窄的请求时设为 `false`。`truncated` 为 `true` 时，数组只是一部分。这个 SDK 不会继续请求下一页。

每条 `Bot` 的字段相同：

| 字段 | 含义 |
|---|---|
| `id` | Agent UUID。发送和订阅都用它。 |
| `serverId` | 另一套服务端记录 ID，或 `null`。 |
| `name`、`description`、`title` | 展示字符串。缺失时是 `''`。 |
| `avatarShape`、`avatarColor` | 解析后的形状和颜色。总会有值。 |
| `avatar` | 完整的解析结果，包含来源和图片。 |
| `harness`、`kind` | 服务端字符串，或 `''`。 |
| `sessionId` | 查看者会话 ID，或 `''`。 |
| `teamId` | 整数，或 `null`。 |
| `viewerIsOwner`、`viewerCanManage` | 布尔值。只有严格等于 `true` 才是 `true`。 |

团队记录和分组记录由你的应用用 `kind`、`viewerIsOwner` 和 `teamId` 过滤。两条长度相同的名单，成员仍可能不同。

`examples/list-bots.mjs` 从凭据文件打印 `id`、名称、会话和头像摘要：

```sh
node examples/list-bots.mjs ./credentials.json
```

## 发送

```js
const sent = await client.sendMessage({
  botId: bot.id,
  sessionId: bot.sessionId,
  text: '总结我刚发过去的笔记。',
  messageId: crypto.randomUUID(),
})
```

`sent` 的形状是 `{ botId, messageId, delivery, dispatched }`。

| `delivery` | 含义 |
|---|---|
| `accepted-box` | 服务端在 box 路径上接受了这条消息。 |
| `accepted-temporal` | 服务端在 temporal 路径上接受了这条消息。 |
| `duplicate` | 这个 `messageId` 已经被接受过。 |

`dispatched` 是服务端的布尔值，原样变成 `true` 或 `false`。`sendMessage` 结束于“已接受投递”。Bot 的回复如果会来，稍后出现在 `watchBot` 上。

`attachmentPaths` 和 `attachmentNames` 是等长的服务端引用数组。它们是上传接口已经返回的标识。把本地文件路径放进去，请求里就会带上这串字符。这个包不读取文件，不上传，也不唤醒云电脑。

需要事后认出这次发送时，自己指定 `messageId`。省略时 SDK 生成 UUID。回复在转录里的 `entryId` 是另一个 ID。

## 订阅

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

`sessionId` 默认 `''`。名单上的 Bot 带有会话 ID 时，把那个 `sessionId` 传进去。

没有游标时，SDK 先以 `limit: 1` 调用 `ListGrokBotTranscriptEntries`，从最新一条的 `updatedSeq` 之后开始。更早的历史不进入这条流。更早的记录若之后被编辑，仍可能出现，因为游标是那条记录的更新序号，不是全局高水位。

要明确续订，下面两种传一种：

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

`generation` 必须是这个会话自己的代际。`afterUpdatedSeq` 是十进制字符串。`resumeFrom` 是上一条事件的 `id`，并且必须指向同一个 Bot 和同一个会话。

`inlineBodyMaxBytes` 默认 262144，必须是 1 到 524288 之间的整数。

上游流结束、信号中止，或服务端认为游标太旧（`resync-required`）时，循环结束。停止的方式是中止信号。这个方法不重连。

## 从你的后端转发 SSE

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

返回值是 Web `Response`。响应体是 `text/event-stream`。把它接到会刷新分片的服务器上。把整个响应缓冲到结束的代理，会把事件一直攒到订阅结束。

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

浏览器向你的源站认证。账号令牌留在创建 `client` 的那个进程里。

事件名、游标规则和 SSE 字节见[事件与 SSE](/zh/api/events)。
