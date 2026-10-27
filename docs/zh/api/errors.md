# 错误码

## `SDKError`

```ts
class SDKError extends Error {
  code: string
  httpStatus?: number
}
```

`error.message` 和 `error.code` 是同一个固定字符串。失败来自 HTTP 响应时设置 `httpStatus`。这个消息可以写进日志。类上不挂响应体，因此记录 `SDKError` 不会带出令牌或账号载荷。

构造时传入未知代码，会存成 `SDK_ERROR`。

| 代码 | 何时 |
|---|---|
| `MISSING_ACCESS_TOKEN` | `accessToken` 缺失或为空。CLI 的 `whoami` 没有令牌来源时也用它。 |
| `ACCOUNT_AUTH_FAILED` | `GetMe` 失败，或 HTTP 200 同时缺少 `authId` 和 `userId`。 |
| `RPC_FAILED` | 名单或转录的一元调用失败。 |
| `INVALID_ROSTER_RESPONSE` | `ListGrokBotAgents` 没有返回 `agents` 数组。 |
| `INVALID_BOT_RECORD` | 名单元素没有 `agentId`。 |
| `BOT_ID_REQUIRED` | `botId` 为空、长于 128，或超出 `[A-Za-z0-9_-]`。 |
| `MESSAGE_INVALID` | 文本、会话、消息 ID 或附件数组没有通过校验。 |
| `SEND_UNCONFIRMED` | 发送的 HTTP 调用失败。不要自动再发一次。 |
| `SEND_REFUSED` | HTTP 成功，但 `delivery` 不是已知的接受结果。整数 `4` 和 `GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED` 属于这种情况。 |
| `CURSOR_INVALID` | 游标字段、恢复编码，或两种游标形式同时使用。 |
| `CURSOR_SCOPE_MISMATCH` | `resumeFrom` 指向另一个 Bot 或会话。 |
| `STREAM_CONNECTION_FAILED` | 订阅 HTTP 失败，或在有类型的流错误之前套接字失败。 |
| `STREAM_INVALID_RESPONSE` | 订阅 HTTP 200 的内容类型不是 `application/connect+json`，或正文无法读取。 |
| `STREAM_FRAME_TOO_LARGE` | 帧超过 1 MiB，或 `inlineBodyMaxBytes` 超出范围。 |
| `STREAM_COMPRESSION_UNSUPPORTED` | 设置了压缩标志位。 |
| `STREAM_FLAGS_INVALID` | 标志既不是数据帧（`0`）也不是结束帧（`2`）。 |
| `STREAM_INVALID_JSON` | 帧不是 JSON 对象。 |
| `STREAM_UNEXPECTED_EOF` | 正文在结束帧之前结束。 |
| `STREAM_END_INVALID` | 结束帧之后还有字节。 |
| `STREAM_RPC_ERROR` | 结束帧带有 `error` 对象。服务端错误体被丢弃。 |
| `STREAM_PROTOCOL_ERROR` | 事件无法编码成 SSE。 |
| `STREAM_CANCELLED` | 保留在代码表里。中止订阅时，生成器返回。 |
| `SDK_ERROR` | SSE 迭代器抛出了非 `SDKError`。SSE 的 `error` 事件使用这个代码。 |

已经开始的 SSE 响应里，这些代码以如下形式到达：

```text
event: error
data: {"code":"STREAM_RPC_ERROR"}
```

## 登录与桌面错误

这些是 `Error`，`message` 为固定代码。由 `pollLogin`、`decryptMacSecret`、`selectDesktopAccount` 或 `desktopCredentials` 抛出。

| 消息 | 何时 |
|---|---|
| `LOGIN_POLL_FAILED` | 连续三次轮询既不是成功也不是 HTTP 404。 |
| `LOGIN_TIMED_OUT` | 登录仍在等待时，`maxAttempts` 已经用完。 |
| `SIGN_IN_POLICY_VIOLATION` | 轮询返回 HTTP 403 `{ "error": "sign_in_policy_violation" }`。轮询停止。 |
| `CREDENTIAL_DECRYPT_FAILED` | 数据不是这段代码能打开的 `v10` 密钥。 |
| `ACCOUNT_STORE_INVALID` | `cursor-accounts` 不是 JSON。 |
| `NO_ACTIVE_ACCOUNT` | 存储里没有可用的 `active` 账号。 |
| `ACCESS_TOKEN_MISSING` | 当前账号没有 `cursor-access-token`。 |
| `KEYCHAIN_ACCESS_UNAVAILABLE` | `security` 没有返回 Grok Bot 的密码。 |
| `TOKEN_FILE_INVALID` | CLI 的令牌文件里没有字符串 `accessToken`。 |

CLI 打印 `{ "status": "failed", "code": "<消息>" }` 并以 1 退出。用法错误以 2 退出。
