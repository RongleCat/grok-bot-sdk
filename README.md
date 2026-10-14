<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/avatars-row-dark.png" />
    <img src="assets/avatars-row.png" alt="Five Grok Bot avatars. The default black circle is in the middle, with an orange cloud and a violet teardrop on the left, and a green hexagon and a blue squircle on the right." width="680" height="128" />
  </picture>
</p>

<h1 align="center">grok-bot-sdk</h1>

<p align="center"><strong>Unofficial Node.js SDK for the Grok Bot desktop client protocol</strong></p>
<p align="center"><em>Browser login · Account and bot roster · Normalized avatars · Send · Connect replies forwarded as SSE</em></p>
<p align="center"><a href="https://ronglecat.github.io/grok-bot-sdk/">https://ronglecat.github.io/grok-bot-sdk/</a></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README_ZH.md">中文</a>
</p>

<p align="center">
  <a href="https://ronglecat.github.io/grok-bot-sdk/"><img src="https://img.shields.io/badge/docs-API%20reference-0ea5e9" alt="API docs" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/RongleCat/grok-bot-sdk/stargazers"><img src="https://img.shields.io/github/stars/RongleCat/grok-bot-sdk?style=social" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.13-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/client-Grok%20Bot%200.70.2-lightgrey" alt="Grok Bot 0.70.2" />
  <img src="https://img.shields.io/badge/note-unofficial-yellow" alt="Unofficial" />
</p>

<p align="center">
  <a href="https://x.com/cgnot996"><img src="https://img.shields.io/badge/X-铁柱AGI%20%40cgnot996-black?logo=x&logoColor=white" alt="X 铁柱AGI" /></a>
  <img src="https://img.shields.io/badge/WeChat-铁柱AGI-07C160?logo=wechat&logoColor=white" alt="WeChat 铁柱AGI" />
  <a href="https://bot.tiezhu.si/"><img src="https://img.shields.io/badge/learn-bot.tiezhu.si-111111" alt="Grok Bot learning site" /></a>
</p>

<p align="center">
  <img src="assets/wechat/mp-search-scan.png" alt="WeChat Search 铁柱AGI — scan to follow the official account" width="420" />
  &nbsp;&nbsp;
  <img src="assets/wechat/community-group-qr.png" alt="Author WeChat QR — add to join the paid community" width="200" />
</p>

<p align="center"><sub>Left: WeChat official account <strong>铁柱AGI</strong>. Right: the author's personal WeChat. The paid community is invite-only — add this WeChat and ask to join.</sub></p>

---

> [!NOTE]
> **About this SDK.** grok-bot-sdk reproduces the browser login and the read, send, and reply-stream calls used by the Grok Bot **0.70.2** desktop client. It is an independent open-source library by [铁柱AGI](https://x.com/cgnot996). It is **not an xAI product, not a Cursor product, and not the official Grok Bot SDK**.
>
> The same author also builds [Grok App](https://github.com/RongleCat/grok-app), a desktop workbench for the local Grok Build CLI. Grok App and this SDK are different programs.

---

## Contents

- [Install](#install)
- [Authorize](#authorize)
- [Call](#call)
- [What this release includes](#what-this-release-includes)
- [Notes you should read](#notes-you-should-read)
- [Docs](#docs)
- [Related projects](#related-projects)
- [Author and community](#author-and-community)

## Install

Node.js **22.13 or newer**. ESM only. The runtime has zero npm dependencies.

The package is published from this GitHub repository. It is not on the npm registry.

```sh
npm install github:RongleCat/grok-bot-sdk
```

```js
import { GrokBotClient, createLogin, pollLogin } from 'grok-bot-sdk';
```

## Authorize

The normal path is a fresh browser login. It creates a session for this SDK and leaves the official client's saved login alone.

```sh
npx grok-bot-sdk login --out ./credentials.json
```

On macOS the command opens the system browser. Elsewhere, or with `--no-open`, it prints a `loginUrl`. Finish the login in that page. The command then writes `accessToken`, `refreshToken`, and `selectedTeamId` when the server returns one. The file mode is `0600`. The terminal output says the token is present. It does not print the token.

```js
import { readFile } from 'node:fs/promises';
import { GrokBotClient } from 'grok-bot-sdk';

const saved = JSON.parse(await readFile('./credentials.json', 'utf8'));
const client = new GrokBotClient({
  accessToken: saved.accessToken,
  teamId: saved.selectedTeamId,
});
```

You can also pass `GROK_BOT_ACCESS_TOKEN` in the environment. Keep that value out of shell history and logs.

A second, optional path reads the Grok Bot session already stored on this Mac:

```js
import { desktopCredentials } from 'grok-bot-sdk/desktop';
import { GrokBotClient } from 'grok-bot-sdk';

const client = new GrokBotClient(await desktopCredentials());
```

macOS shows the normal Keychain prompt for `Grok Bot Safe Storage`. Approve it yourself. If that stored token is no longer accepted, stop and use `login`.

Check the session without printing the account:

```sh
npx grok-bot-sdk whoami --token-file ./credentials.json
```

The full sequence, poll responses, headers, and the Mac path are in the [authorization guide](https://ronglecat.github.io/grok-bot-sdk/guide/auth).

## Call

```js
const me = await client.getMe();
const { bots, truncated } = await client.listBots();
const bot = bots[0];

const sent = await client.sendMessage({
  botId: bot.id,
  sessionId: bot.sessionId,
  text: 'Summarize the notes I just sent.',
});

for await (const event of client.watchBot({
  botId: bot.id,
  sessionId: bot.sessionId,
})) {
  if (event.type === 'message') {
    // Replace the bubble for event.data.entryId with event.data.text.
  }
}
```

A backend that already authenticates its own user can return the SDK response directly:

```js
return client.botEventsSSE({
  botId: authorizedBot.id,
  sessionId: authorizedBot.sessionId,
  resumeFrom: request.headers.get('last-event-id') || undefined,
  signal: request.signal,
});
```

`Bot.id` is the agent UUID. Every bot includes `avatarShape`, `avatarColor`, and a normalized `avatar` object. When the roster omits a valid shape or color, the SDK derives that field from the agent UUID. The shape and the color are decided separately.

`examples/list-bots.mjs` prints the roster summary from a saved credentials file.

## What this release includes

Verified against Grok Bot 0.70.2 on 14 October 2026:

- One browser login continued into account read and the cloud bot roster.
- The same read path works with the Mac client's existing session.
- Roster records come back with one avatar shape, whether the server sent the fields or the SDK derived them.
- `WatchGrokBotTranscripts` connects with Connect JSON, and an existing reply was forwarded through `botEventsSSE`.
- Offline tests cover login URL shape, avatar vectors, frame parsing, cursors, cancellation, SSE framing, and send results.

The default client version string is `0.70.2`. Pass `version` when you know the client you are matching.

## Notes you should read

These limits are part of the contract. The [notes page](https://ronglecat.github.io/grok-bot-sdk/guide/notes) lists each one with the behavior to expect.

- The access token is an account credential. Store it like a password. The SDK does not refresh it, does not log it out, and does not revoke it when the process exits.
- `truncated: true` means the roster is incomplete. `includeTeamAgents` can include team records.
- `sendMessage` returning `accepted-box`, `accepted-temporal`, or `duplicate` means the server accepted delivery. It does not mean the bot has read or answered. `SEND_UNCONFIRMED` means you must not automatically send again.
- `attachmentPaths` are server references from an upload that already finished. This package does not upload local files and does not wake a cloud computer.
- Reply events carry the current full text of one transcript entry. Per-token streaming was not verified. The shape is not an OpenAI Chat Completions stream.
- The SDK does not reconnect, does not fill in omitted entry bodies, and does not render avatar animation.
- Put the account token on your server. The browser `EventSource` should call your backend.

## Docs

The API site is VitePress, deployed with GitHub Pages: [ronglecat.github.io/grok-bot-sdk](https://ronglecat.github.io/grok-bot-sdk/).

English and Chinese are both in the site. The reference covers `GrokBotClient`, event types, SSE frames, avatar derivation, error codes, and the HTTP endpoints this SDK calls.

```sh
npm install
npm test
npm run docs:dev
```

## Related projects

| Project | What it is |
|---|---|
| [Grok App](https://github.com/RongleCat/grok-app) | Open-source desktop workbench for the local Grok Build CLI. [grok-app.com](https://grok-app.com) |
| [GrokGo](https://github.com/RongleCat/grok-go) | Sister project |
| [awesome-grok-bot](https://github.com/RongleCat/awesome-grok-bot) | Grok Bot community index |
| [Grok Bot learning site](https://bot.tiezhu.si/) | From zero to a bot team: install, routines, cases, usage |

## Author and community

| Channel | Where |
|---|---|
| X | [@cgnot996 (铁柱AGI)](https://x.com/cgnot996) |
| WeChat official account | Search **铁柱AGI**, or scan the left code above |
| Paid community | Add the author's WeChat with the right code, then ask to join |
| Learning site | [bot.tiezhu.si](https://bot.tiezhu.si/) |

The avatars at the top are the Grok Bot shapes and colors, with the default black circle in the middle. They are not an xAI logo.

MIT License. Copyright 2026 RongleCat.
