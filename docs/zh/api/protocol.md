# 协议

账号 RPC 的基址：`https://api2.cursor.sh`。

一元调用是 HTTP POST，`content-type: application/json`，`connect-protocol-version: 1`，请求体是 camelCase JSON。重定向会被拒绝。大于 8 MiB 的响应在传输层记为 `RESPONSE_TOO_LARGE`，并表现为一次失败的 RPC。

## 请求头

| 头 | 值 |
|---|---|
| `authorization` | `Bearer <accessToken>` |
| `x-cursor-client-type` | `sand` |
| `x-cursor-client-source` | `sand-desktop` |
| `x-cursor-client-version` | `options.version`，默认 `0.70.2` |
| `x-cursor-client-os` | `darwin` |
| `x-sand-box-namespace` | `prod` |
| `x-ghost-mode` | `true` |
| `x-request-id` | 每次调用一个新的 UUID |
| `user-agent` | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sand/<version> Safari/537.36` |
| `x-cursor-team-id` | 设置了 `teamId` 时出现 |
| `x-cursor-checksum` | 设置了 `machineId` 时出现 |

校验和把一个粗粒度时间戳和 machine id 按 0.70.2 客户端的方式混合。对已经核对过的登录路径，它是可选的。

## `GET https://cursor.com/loginDeepControl`

查询参数：`challenge`、`uuid`、`mode=login`、`redirectTarget=sand`、`supportsSelectedTeamLogin=true`。

`challenge` 是 Base64URL(SHA-256(32 个随机字节))。账号持有人在这个页面上批准 SDK 会话。

## `GET /auth/poll`

查询参数：`uuid`、`verifier`。HTTP 404 表示仍在等待。HTTP 200 返回 `accessToken`、`refreshToken`，有时还有 `selectedTeamId`。

## `POST /aiserver.v1.DashboardService/GetMe`

请求体 `{}`。由 `getMe()` 使用。可用的响应体包含 `authId` 或 `userId`。

## `POST /aiserver.v1.GrokBotService/ListGrokBotAgents`

除非调用方把标志设为 false，请求体是 `{ "includeTeamAgents": true }`。

这个 SDK 读取的响应字段：`agents[]`、`truncated`。每个 agent 需要 `agentId`。头像输入是 `avatarShape`、`avatarColor`、`avatarUrl`、`avatarDataUrl` 和 `avatarVersion`。名单输入是 `id`、`name`、`description`、`title`、`harness`、`kind`、`viewerSessionId`、`teamId`、`viewerIsOwner` 和 `viewerCanManage`。

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

`delivery` 映射为 `accepted-box`、`accepted-temporal` 或 `duplicate`，见[客户端](/zh/api/client)。`dispatched` 从布尔字段原样复制。

## `POST /aiserver.v1.GrokBotService/ListGrokBotTranscriptEntries`

`watchBot` 既没有 `cursor` 也没有 `resumeFrom` 时使用。

```json
{ "agentId": "<Bot.id>", "sessionId": "", "limit": 1 }
```

SDK 读取 `generation`，以及返回条目的 `updatedSeq`（或 `seq`），然后从最大值之后开始订阅。

## `POST /aiserver.v1.GrokBotService/WatchGrokBotTranscripts`

Connect JSON 流，不是 SSE。

```text
content-type: application/connect+json
accept: application/connect+json
connect-accept-encoding: identity
```

请求体是一帧 Connect。载荷是：

```json
{
  "cursors": [
    { "agentId": "<Bot.id>", "sessionId": "", "generation": 0, "afterUpdatedSeq": "22" }
  ],
  "includeUnlistedAgents": false,
  "inlineBodyMaxBytes": 262144
}
```

### 帧

每一帧是 5 字节头加上一个 JSON 对象。

| 偏移 | 含义 |
|---|---|
| 0 | 标志。`0` 是数据帧。`2` 是结束帧。 |
| 1–4 | 载荷长度，大端 uint32。 |

压缩位（`flags & 1`）会被拒绝。其他标志值也会被拒绝。载荷必须是 JSON 对象，最大 1 MiB。

结束帧带有 `error` 属性时变成 `STREAM_RPC_ERROR`。错误对象不会被重新抛出，也不会复制进 SDK 错误。结束帧结束迭代器。数据帧交给映射器，产出[事件](/zh/api/events)。

转录文本是记录上的 base64 JSON 正文。解码器接受 UTF-8。文本消息是 `kind: "send-message"`，且 `message.type` 为 `"text"`，`message.content` 为字符串。这段内容变成 `event.data.text`。

订阅请求的响应头超时是 20 秒，使用与调用方相同的 `AbortSignal`。

## 这个 SDK 不调用的接口

在桌面客户端里看到过，并且有意没有实现：

- `POST /oauth/token`（刷新）
- `POST /auth/exchange_user_api_key`
- `POST /auth/logout`
- `EnsureSandBox`、gateway `/health`、gateway `listAgents`
- 附件上传（`BeginGrokBotAttachmentUpload` 以及 box 上传路径）

生成出来的客户端还有数百个 RPC 名字。上面这份清单里没有的名字，就没有被包装、没有被调用，也不在这个包的测试范围内。
