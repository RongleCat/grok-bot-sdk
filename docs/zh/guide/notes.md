# 注意事项

2026-10-14 对照 Grok Bot **0.70.2** 核对。更新的客户端可能改路径、请求头、枚举和头像盐值。你要匹配某个具体构建时，传入 `version`。默认字符串是 `0.70.2`。

## 这个库是什么

它独立实现了桌面客户端发出的那些调用。它不是 xAI SDK，也不是 Cursor SDK。你负责在自己控制的账号上使用它，并遵守该账号适用的条款。

运行环境是 Node.js 22.13 或更高，ESM，没有 npm 依赖。它使用全局 `fetch`、Web Streams、`AbortSignal.any` 和 `Response`。

## 凭据

访问令牌可以读取账号和 Bot。按密码保管。

日志、统计和工单附件里不要出现：

- 访问令牌和刷新令牌
- 登录 `verifier`，以及带着它的轮询 URL
- 钥匙串密码和 machine id
- 邮箱、显示名和消息正文
- 签名上传 URL 和 gateway 令牌

登录页 URL 可以打印。它只带 challenge 和 uuid。

浏览器登录建立的是另一份会话。它不轮换官方应用保存的刷新令牌。这个包不调用 `POST /oauth/token`，也不调用 `POST /auth/logout`。访问令牌失效后，重新登录。

删除本地凭据文件或退出进程，只丢掉你手里的副本。服务端会话还在。

`whoami` 和示例打印的是存在标记，或你要求打印的名单字段。`getMe()` 本身返回原始对象。不要把这个对象写进共享日志。

## 桌面适配器

`desktopCredentials()` 只在 macOS 上可用。它读取 Grok Bot 的支持目录和钥匙串项 `Grok Bot Safe Storage`。系统会要求授权。提示成功之后函数才返回。

解密参数对应那台 macOS 客户端上看到的 Electron `v10` 数据。这个包没有 Windows 或 Linux 的凭据读取器。

被拒绝或过期的桌面令牌会停在 `ACCOUNT_AUTH_FAILED`。接下来使用浏览器登录。不要去刷新官方应用也在使用的那份令牌。

只有带了 machine id 时才发送 `x-cursor-checksum`。一次新的浏览器登录在没有它的情况下完成了账号和名单读取。

## 网络

账号 RPC 发往 `https://api2.cursor.sh`。重定向算失败。客户端发送[协议页](/zh/api/protocol)里列出的桌面身份头：`x-cursor-client-type: sand`、来源 `sand-desktop`、操作系统 `darwin`、命名空间 `prod`、ghost mode，以及每次一个新的请求 ID。这些头里哪一个是服务端强制的，没有被逐个拆开验证。

即使你的进程跑在别的系统上，`x-cursor-client-os` 仍然是 `darwin`，因为被核对的客户端就是这样发送的。

## 名单

尊重 `truncated`。被截断的数组不是完整名单，这个 SDK 也不会继续翻页。

`includeTeamAgents: true` 可能包含团队 Bot 和分组。你自己的过滤可用 `kind`、`viewerIsOwner` 和 `teamId`。

`Bot.id` 是 `agentId`。`Bot.serverId` 是另一个 ID。发送、订阅和头像推算都用 `Bot.id`。

## 头像

推算使用到达时的 agent UUID 原文字符串：大小写不变，连字符保留，不再 trim。大写后的 UUID 是另一把钥匙。

形状和颜色各自回退。有效的显式形状配上缺失的颜色时，保留形状，只推算颜色。

默认池是 8 种形状乘 10 种颜色。编辑器允许更多形状，黑色也可以显式指定，但它不在随机颜色池里。不同 Bot 可以共用同一个头像。

`avatar.kind` 为 `picture` 时，若 `avatar.picture.url` 是字符串，就渲染它。只有 `avatarVersion` 的记录仍然报告 `kind: 'picture'`，且 `picture.url` 为 `null`。这个 SDK 不下载图片，也不带动画运行时。

离线推算是 `grok-bot-sdk/avatar` 的 `deriveDefaultAvatar(agentUuid)`。它不需要令牌。见[头像](/zh/api/avatar)。

## 发送

`accepted-box`、`accepted-temporal` 和 `duplicate` 表示服务端接受了投递记录。它们不表示 Bot 已经阅读文本或产生回复。`dispatched` 是另一个布尔值。

`SEND_UNCONFIRMED` 表示这次 HTTP 结果不是一次确认过的接受。从 SDK 的角度看，这条消息还不能当成已送达，下一步由你的代码决定。自动重试可能投递第二份。固定的 `messageId` 能让之后的重复显示为 `delivery: 'duplicate'`。

`attachmentPaths` 和 `attachmentNames` 是服务端引用。这个包不上传字节，不调用 `EnsureSandBox`，也不设置 `wake`。

发送上的 `messageId` 和转录上的 `entryId` 是不同的标识。订阅的是 Bot 会话。同一会话里的其他发送也会出现在同一条流上。没有方法只返回某一个 `messageId` 的回复。

## 流

`watchBot` 用 Connect JSON 访问 `WatchGrokBotTranscripts`。`botEventsSSE` 把这些事件适配成浏览器能读的 SSE 响应。上游本身不是 SSE 套接字。

`message` 事件的 `text` 是该记录当前的完整正文。之后同一个 `entryId` 的事件替换它。已核对的流里没有逐 token 增量。这份 JSON 也不是 OpenAI Chat Completions 的分片。

默认游标是最新一条转录的 `updatedSeq`，来自 `limit: 1` 的读取。更早记录的编辑仍可能被投递。你想从已知位置开始时传入 `cursor`，`generation` 取自那个会话。

`seq` 和 `updatedSeq` 是十进制字符串。用 `BigInt` 比较。JavaScript 数字在 `2^53 - 1` 之后会丢精度。

同时传入 `cursor` 和 `resumeFrom` 会抛出 `CURSOR_INVALID`。指向另一个 Bot 或会话的 `resumeFrom` 会抛出 `CURSOR_SCOPE_MISMATCH`。

`reset` 表示代际变了，或会话被清空。丢掉这个会话的本地副本。`resync-required` 结束订阅。在你的应用里重新加载历史，然后再订阅。SDK 在这个事件上停住。

`entry.unavailable` 仍会向前推进游标。正文被省略，或无法解码。这个 SDK 不去取缺失的 blob。

`watchBot` 和 `botEventsSSE` 内部没有重连循环。`stream.closed` 表示 HTTP 正文结束。它不表示 Bot 完成了一个回合。要继续时，新开一个请求，把最后一条事件 ID 作为 `resumeFrom`。

帧不压缩。超过 1 MiB 的帧会失败。`inlineBodyMaxBytes` 默认 256 KiB，你能请求的上限是 512 KiB。

订阅响应一旦是 HTTP 200，之后的上游失败会变成 SSE `error` 事件，数据是 `{ "code": "<SDK 错误码>" }`。这个响应的 HTTP 状态保持 200。在浏览器侧，网络失败和 SDK 的 `error` 事件是两件事：SDK 事件带有 JSON `data`。

保活行是 SSE 注释（`: keepalive`）。它们让代理在安静时不要关掉流。`keepAliveMs` 默认 15000。流还有空间时才写入这条注释。

取消请求会中止上游订阅，包括帧开始之前的那次转录查询。

`bot.updated` 针对当前订阅的 Bot 发出。其他 Bot 的名单变化不会被转发。

## SSE 部署

响应头是：

```text
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
x-accel-buffering: no
```

你的框架和代理必须刷新响应体。SDK 返回的是 `Response`。它自己不监听端口。

账号令牌放在持有 `GrokBotClient` 的服务端。浏览器的 `EventSource` 调用你的路由。放在查询字符串里的令牌会进访问日志。

## 这一版不做的事

录音、原生手表客户端、头像动画、文件上传、分片上传、凭据刷新、登出，以及对截断名单翻页，都不在这一版里。桌面客户端还声明了更多 RPC。[协议页](/zh/api/protocol)列出这个 SDK 实际调用的那些。
