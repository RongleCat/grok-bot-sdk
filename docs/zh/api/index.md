# 接口总览

协议客户端从包的根入口导入。头像计算和 Mac 凭据适配器是单独入口，这样服务器安装不必加载钥匙串代码。

```js
import {
  GrokBotClient,
  SDKError,
  createLogin,
  pollLogin,
  normalizeBot,
} from 'grok-bot-sdk'
import { deriveDefaultAvatar, resolveAgentAvatar } from 'grok-bot-sdk/avatar'
import { desktopCredentials } from 'grok-bot-sdk/desktop'
```

| 符号 | 作用 |
|---|---|
| `GrokBotClient` | 账号、名单、发送、订阅、SSE |
| `createLogin` / `pollLogin` | 浏览器授权 |
| `normalizeBot` | 把一条原始名单记录变成 `Bot` |
| `SDKError` | 固定的 `code`，以及可选的 `httpStatus` |
| `deriveDefaultAvatar` | 用 agent UUID 离线算出形状和颜色 |
| `resolveAgentAvatar` | 先用显式字段，再用 UUID 回退 |
| `desktopCredentials` | 可选的 macOS 读取器，读取已经存在的 Grok Bot 登录 |

页面：

- [客户端](/zh/api/client) — 构造函数、`getMe`、`listBots`、`sendMessage`、`watchBot`、`botEventsSSE`
- [事件与 SSE](/zh/api/events) — 事件名、载荷、线上格式
- [头像](/zh/api/avatar) — 算法 `grok-bot-0.70.2`
- [错误码](/zh/api/errors) — `SDKError` 与登录错误
- [协议](/zh/api/protocol) — 这些方法实际发出的 HTTP 和 Connect 调用

桌面客户端还有大得多的生成 RPC 表面。协议页上没有的方法，这个 SDK 里也没有。
