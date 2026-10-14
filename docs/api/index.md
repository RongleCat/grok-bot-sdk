# API overview

Import the protocol client from the package root. Avatar math and the Mac credential adapter are separate entry points so a server install does not have to load Keychain code.

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

| Symbol | Role |
|---|---|
| `GrokBotClient` | Account, roster, send, watch, SSE |
| `createLogin` / `pollLogin` | Browser authorization |
| `normalizeBot` | One raw roster record to a `Bot` |
| `SDKError` | Fixed `code` plus optional `httpStatus` |
| `deriveDefaultAvatar` | Offline shape and color from an agent UUID |
| `resolveAgentAvatar` | Explicit fields first, then the UUID fallback |
| `desktopCredentials` | Optional macOS reader for an existing Grok Bot login |

Pages:

- [Client](/api/client) — constructor, `getMe`, `listBots`, `sendMessage`, `watchBot`, `botEventsSSE`
- [Events and SSE](/api/events) — event names, payloads, wire format
- [Avatar](/api/avatar) — algorithm `grok-bot-0.70.2`
- [Errors](/api/errors) — `SDKError` codes and login codes
- [Protocol](/api/protocol) — the HTTP and Connect calls those methods make

The desktop client contains a much larger generated RPC surface. Methods absent from the protocol page are absent from this SDK.
