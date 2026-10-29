---
layout: home

hero:
  name: grok-bot-sdk
  text: Grok Bot client protocol, in Node.js
  tagline: Browser login, the bot roster, sessions, transcript, tasks, normalized avatars, send, and Connect replies forwarded as SSE. Matched to Grok Bot 0.78.1. Unofficial.
  actions:
    - theme: brand
      text: Authorize
      link: /guide/auth
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: 中文
      link: /zh/

features:
  - title: Your own browser login
    details: PKCE-style login on cursor.com, then a poll for an access token. The official client's saved session stays where it is.
  - title: One avatar shape
    details: Explicit server fields win. Missing or invalid shape and color are derived from the agent UUID, each field on its own.
  - title: Replies as SSE
    details: watchBot reads the Connect JSON transcript stream. botEventsSSE turns those events into a standard text/event-stream Response.
  - title: The limits are written down
    details: No token refresh, no local file upload, no per-token stream claim, and no automatic resend. Read the notes before you ship a bot.
---

## Community

The author is [铁柱AGI on X (@cgnot996)](https://x.com/cgnot996). The desktop workbench for local Grok Build is [Grok App](https://github.com/RongleCat/grok-app). The course that walks through Grok Bot itself is the [learning site](https://bot.tiezhu.si/).

<p>
  <img src="/wechat/mp-search-scan.png" alt="WeChat Search 铁柱AGI" width="420" />
  &nbsp;&nbsp;
  <img src="/wechat/wechat-qr.png" alt="Author WeChat QR for the paid community" width="200" />
</p>

Search **铁柱AGI** for the WeChat official account. The right code is the author's personal WeChat. The paid community is joined by adding that account and asking to be invited.
