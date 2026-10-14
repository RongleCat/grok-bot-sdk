# Install

Node.js 22.13 or newer. The package is ESM. Import it from this GitHub repository:

```sh
npm install github:RongleCat/grok-bot-sdk
```

```js
import { GrokBotClient, createLogin, pollLogin } from 'grok-bot-sdk'
import { deriveDefaultAvatar } from 'grok-bot-sdk/avatar'
import { desktopCredentials } from 'grok-bot-sdk/desktop'
```

`grok-bot-sdk/desktop` is the optional macOS adapter. The other two entry points run anywhere Node 22 runs.

There is no CommonJS build and no runtime dependency. TypeScript declarations ship beside the modules (`sdk.d.mts`, `avatar.d.mts`, `desktop.d.mts`) for `moduleResolution: "nodenext"`.

Clone the repository when you want the tests and this site:

```sh
git clone https://github.com/RongleCat/grok-bot-sdk.git
cd grok-bot-sdk
npm install
npm test
npm run docs:dev
```

The command-line helper is `grok-bot-sdk`. After installation it is on your `npx` path. From a clone, `node bin/grok-bot-sdk.mjs` runs the same file.
