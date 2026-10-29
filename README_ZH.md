<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/avatars-row-dark.png" />
    <img src="assets/avatars-row.png" alt="一排五个 Grok Bot 头像。中间是默认的黑色圆形，左边是橙色云朵和紫色水滴，右边是绿色六边形和蓝色圆角方块。" width="680" height="128" />
  </picture>
</p>

<h1 align="center">grok-bot-sdk</h1>

<p align="center"><strong>Grok Bot 桌面客户端协议的非官方 Node.js SDK</strong></p>
<p align="center"><em>浏览器登录 · 账号与 Bot 名单 · 会话、转录与任务 · 统一头像 · 发送 · Connect 回复转发为 SSE</em></p>
<p align="center"><a href="https://ronglecat.github.io/grok-bot-sdk/zh/">https://ronglecat.github.io/grok-bot-sdk/zh/</a></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README_ZH.md">中文</a>
</p>

<p align="center">
  <a href="https://ronglecat.github.io/grok-bot-sdk/zh/"><img src="https://img.shields.io/badge/docs-接口文档-0ea5e9" alt="接口文档" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/RongleCat/grok-bot-sdk/stargazers"><img src="https://img.shields.io/github/stars/RongleCat/grok-bot-sdk?style=social" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.13-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/client-Grok%20Bot%200.78.1-lightgrey" alt="Grok Bot 0.78.1" />
  <img src="https://img.shields.io/badge/note-unofficial-yellow" alt="非官方" />
</p>

<p align="center">
  <a href="https://x.com/cgnot996"><img src="https://img.shields.io/badge/X-铁柱AGI%20%40cgnot996-black?logo=x&logoColor=white" alt="X 铁柱AGI" /></a>
  <img src="https://img.shields.io/badge/微信公众号-铁柱AGI-07C160?logo=wechat&logoColor=white" alt="微信公众号 铁柱AGI" />
  <a href="https://bot.tiezhu.si/"><img src="https://img.shields.io/badge/学习站-bot.tiezhu.si-111111" alt="Grok Bot 学习站" /></a>
</p>

<p align="center">
  <img src="assets/wechat/mp-search-scan.png" alt="微信搜一搜 铁柱AGI，扫码关注公众号" width="420" />
  &nbsp;&nbsp;
  <img src="assets/wechat/community-group-qr.png" alt="作者个人微信二维码，添加后可申请加入付费交流群" width="200" />
</p>

<p align="center"><sub>左：微信公众号「铁柱AGI」。右：作者个人微信。付费交流群由作者邀请进入，扫码添加微信后说明来意。</sub></p>

---

> [!NOTE]
> **关于这个 SDK。** grok-bot-sdk 复现 Grok Bot **0.78.1** 桌面客户端使用的浏览器登录，以及读取账号、读取名单、发送消息和订阅回复。作者是 [铁柱AGI](https://x.com/cgnot996)。它**不是 xAI 官方产品，不是 Cursor 官方产品，也不是 Grok Bot 官方 SDK**。
>
> 同一作者的 [Grok App](https://github.com/RongleCat/grok-app) 是本机 Grok Build CLI 的桌面工作台。Grok App 和这个 SDK 是两个程序。

---

## 目录

- [安装](#安装)
- [授权](#授权)
- [调用](#调用)
- [这一版包含什么](#这一版包含什么)
- [使用前要知道的事](#使用前要知道的事)
- [接口文档](#接口文档)
- [相关项目](#相关项目)
- [作者与社区](#作者与社区)

## 安装

需要 Node.js **22.13 或更高版本**。只提供 ESM。运行时没有 npm 依赖。

包从本 GitHub 仓库安装，尚未发布到 npm registry。

```sh
npm install github:RongleCat/grok-bot-sdk
```

```js
import { GrokBotClient, createLogin, pollLogin } from 'grok-bot-sdk';
```

## 授权

常规路径是一次新的浏览器登录。它为这个 SDK 建立独立会话，不改写官方客户端已经保存的登录。

```sh
npx grok-bot-sdk login --out ./credentials.json
```

在 macOS 上，命令会打开系统浏览器。其他系统，或者加上 `--no-open` 时，终端只打印 `loginUrl`。在页面里完成登录后，命令把 `accessToken`、`refreshToken`，以及服务端返回时的 `selectedTeamId`，写入指定文件。文件权限是 `0600`。终端只说明令牌已经写入，不打印令牌本身。

```js
import { readFile } from 'node:fs/promises';
import { GrokBotClient } from 'grok-bot-sdk';

const saved = JSON.parse(await readFile('./credentials.json', 'utf8'));
const client = new GrokBotClient({
  accessToken: saved.accessToken,
  teamId: saved.selectedTeamId,
});
```

也可以把访问令牌放在环境变量 `GROK_BOT_ACCESS_TOKEN` 里。不要把它留在 shell 历史或日志里。

另一条可选路径读取这台 Mac 上 Grok Bot 已经保存的会话：

```js
import { desktopCredentials } from 'grok-bot-sdk/desktop';
import { GrokBotClient } from 'grok-bot-sdk';

const client = new GrokBotClient(await desktopCredentials());
```

macOS 会为钥匙串项目 `Grok Bot Safe Storage` 弹出系统授权。由你自己点允许。若这份旧令牌已经被拒绝，停下来，改用 `login`。

检查会话时不打印账号内容：

```sh
npx grok-bot-sdk whoami --token-file ./credentials.json
```

完整顺序、轮询响应、请求头和 Mac 路径见[授权说明](https://ronglecat.github.io/grok-bot-sdk/zh/guide/auth)。

## 调用

```js
const me = await client.getMe();
const { bots, truncated } = await client.listBots();
const bot = bots[0];

const sent = await client.sendMessage({
  botId: bot.id,
  sessionId: bot.sessionId,
  text: '总结我刚发过去的笔记。',
});

for await (const event of client.watchBot({
  botId: bot.id,
  sessionId: bot.sessionId,
})) {
  if (event.type === 'message') {
    // 用 event.data.text 替换 event.data.entryId 对应的那条消息。
  }
}
```

已经认证过自己用户的后端，可以直接返回 SDK 的响应：

```js
return client.botEventsSSE({
  botId: authorizedBot.id,
  sessionId: authorizedBot.sessionId,
  resumeFrom: request.headers.get('last-event-id') || undefined,
  signal: request.signal,
});
```

`Bot.id` 是 Bot 的 UUID。每条记录都有 `avatarShape`、`avatarColor` 和统一的 `avatar` 对象。名单缺少有效形状或颜色时，SDK 用 agent UUID 补上该字段。形状和颜色分开决定。

`examples/list-bots.mjs` 用保存的凭据文件打印名单摘要。

## 这一版包含什么

对照 Grok Bot 0.78.1 核对过：

- 一次浏览器登录可以接着读账号和云端 Bot 名单。
- 用 Mac 客户端里已有的会话，可以走同一条读取路径。
- 名单里的每条记录都带回同一种头像结构。服务端带了字段就用字段，缺了就按 UUID 推算。头像哈希仍是 `grok-bot-0.70.2`。`pumpkin` 只在显式指定时出现。
- `WatchGrokBotTranscripts` 以 Connect JSON 接通，既有回复可以经 `botEventsSSE` 转发。
- 只读调用：`listSessions`、`listTranscript`、`listAgentStatuses`、`getSendStatus`、`listAgentTasks`、`listTasks`、`listSubagents`、`listAgentTodos`、`listAgentSkills`、`listDeletedAgentIds`、`getRuntimeCapabilities`、`getSandBoxRunState`。
- 管理类写入：`createBot`、`updateBot`、`deleteBot`、`createRoom`、`addRoomMembers`、`removeRoomMembers`、`setRoomMembers`、`deleteRoom`、`addAgentSkill`、`updateAgentSkill`、`removeAgentSkill`。`delete*`、`remove*` 和 `setRoomMembers` 不可撤销。
- 订阅事件还包含 `agent.state`、`computer.actions`、`box.state` 和 `page.title.changed`。
- 离线测试覆盖登录 URL、头像向量、帧解析、游标、取消、SSE 帧、发送结果，以及新增的只读记录。

默认客户端版本字符串是 `0.78.1`。你知道自己要匹配的客户端版本时，传入 `version`。CLI 还有只读子命令：`bots`、`sessions`、`transcript`、`tasks`、`capabilities`、`box`。

## 使用前要知道的事

这些边界就是这份 SDK 的约定。[注意事项](https://ronglecat.github.io/grok-bot-sdk/zh/guide/notes)逐条写了会看到的行为。

- 访问令牌是账号凭据，按密码保管。SDK 不刷新它，不替你登出，进程退出也不等于服务端撤销。
- `truncated: true` 表示名单不完整。`includeTeamAgents` 可能带上团队记录。
- `sendMessage` 返回 `accepted-box`、`accepted-temporal` 或 `duplicate`，只表示服务端接受了投递，不表示 Bot 已经阅读或回复。遇到 `SEND_UNCONFIRMED` 时，不要自动再发一次。
- `attachmentPaths` 是已经上传完成的服务端引用。这个包不上传本地文件，也不唤醒云电脑。
- 回复事件给出的是某一条记录当前的完整文本。逐 token 输出尚未验证。它也不是 OpenAI Chat Completions 的流格式。
- SDK 不自动重连，不补齐被省略的正文，也不渲染头像动画。
- 账号令牌放在你自己的服务端。浏览器里的 `EventSource` 只访问你的后端。

## 接口文档

文档站使用 VitePress，由 GitHub Pages 发布：[ronglecat.github.io/grok-bot-sdk/zh/](https://ronglecat.github.io/grok-bot-sdk/zh/)。

站点包含中文和英文。参考页写明 `GrokBotClient`、事件类型、SSE 帧、头像推算、错误码，以及这个 SDK 实际调用的 HTTP 接口。

```sh
npm install
npm test
npm run docs:dev
```

## 相关项目

| 项目 | 是什么 |
|---|---|
| [Grok App](https://github.com/RongleCat/grok-app) | 本机 Grok Build CLI 的开源桌面工作台。[grok-app.com](https://grok-app.com) |
| [awesome-grok-bot](https://github.com/RongleCat/awesome-grok-bot) | Grok Bot 社区索引 |
| [Grok Bot 学习站](https://bot.tiezhu.si/) | 从装好客户端到带一支 Bot 团队：安装、例程、案例、额度 |

## 作者与社区

| 渠道 | 入口 |
|---|---|
| X | [@cgnot996（铁柱AGI）](https://x.com/cgnot996) |
| 微信公众号 | 搜索 **铁柱AGI**，或扫描上方左侧二维码 |
| 付费交流群 | 扫描上方右侧二维码添加作者微信，再说明要入群 |
| 学习站 | [bot.tiezhu.si](https://bot.tiezhu.si/) |

页顶是一排 Grok Bot 头像，中间是默认的黑色圆形，左右是另外四种形状和颜色。这不是 xAI 的标志。

MIT License。Copyright 2026 RongleCat。
