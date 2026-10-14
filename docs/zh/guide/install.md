# 安装

需要 Node.js 22.13 或更高版本。包是 ESM。从本 GitHub 仓库安装：

```sh
npm install github:RongleCat/grok-bot-sdk
```

```js
import { GrokBotClient, createLogin, pollLogin } from 'grok-bot-sdk'
import { deriveDefaultAvatar } from 'grok-bot-sdk/avatar'
import { desktopCredentials } from 'grok-bot-sdk/desktop'
```

`grok-bot-sdk/desktop` 是可选的 macOS 适配器。另外两个入口在任何能跑 Node 22 的环境里都能用。

没有 CommonJS 构建，也没有运行时依赖。类型声明放在模块旁边（`sdk.d.mts`、`avatar.d.mts`、`desktop.d.mts`），给 `moduleResolution: "nodenext"` 使用。

要跑测试和这个文档站时，克隆仓库：

```sh
git clone https://github.com/RongleCat/grok-bot-sdk.git
cd grok-bot-sdk
npm install
npm test
npm run docs:dev
```

命令行工具叫 `grok-bot-sdk`。安装后可以用 `npx` 调用。在克隆下来的仓库里，`node bin/grok-bot-sdk.mjs` 跑的是同一个文件。
