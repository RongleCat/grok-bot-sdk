# 授权

要交给别人用的程序，走一次新的浏览器登录。Mac 钥匙串路径只适合这台电脑上已经装着 Grok Bot、并且你本人在场的时候。

两条路径都得到一个 `accessToken` 字符串。把它传给 `new GrokBotClient({ accessToken })`。登录选中了团队时再加上 `teamId`。想让 `x-cursor-client-version` 写成 `0.78.1` 以外的版本时，传入 `version`。

## 浏览器登录

```sh
npx grok-bot-sdk login --out ./credentials.json
```

命令做这些事：

1. 生成随机 `uuid`，以及 32 字节的随机 `verifier`。
2. 计算 `challenge = Base64URL(SHA-256(verifier))`，不带 padding。
3. 打印 `https://cursor.com/loginDeepControl` 上的 `loginUrl`。查询参数是 `challenge`、`uuid`、`mode=login`、`redirectTarget=sand`、`supportsSelectedTeamLogin=true`。URL 里没有 `verifier`，也没有令牌。
4. 在 macOS 上用 `/usr/bin/open` 打开这个 URL。带了 `--no-open` 时只打印。
5. 轮询 `GET https://api2.cursor.sh/auth/poll?uuid&verifier`，直到拿到令牌、轮询失败，或等待结束。
6. 以权限 `0600` 写入 `credentials.json`。

文件形状如下：

```json
{
  "accessToken": "<密钥>",
  "refreshToken": "<密钥>",
  "selectedTeamId": 0
}
```

服务端没有返回 `selectedTeamId` 时，文件里就没有这个字段。把文件当成密码。放进 `.gitignore`。命令自己的日志不打印文件内容。

页面上可能出现“打开 Grok Bot”。这个 SDK 不需要那一次回跳。你在网页上批准之后，轮询就能收到会话。SDK 使用新的 uuid，所以不会接管官方应用已经发起的那次登录。

### 轮询结果

| 响应 | 含义 |
|---|---|
| HTTP 404 | 登录还在等待。客户端继续轮询。 |
| HTTP 200，且带有 `accessToken` 和 `refreshToken` | 会话已经就绪。 |
| HTTP 403 | 服务端拒绝了这次登录。这是失败。 |
| 其他错误连续出现 3 次 | 命令以 `LOGIN_POLL_FAILED` 停止。 |
| 150 次尝试用完 | 命令以 `LOGIN_TIMED_OUT` 停止。 |

等待从 1 秒开始，每次乘 1.2，上限 10 秒。单次 HTTP 超时 20 秒。

轮询 URL 里有 `verifier`。不要记录它，也不要把它送到会保存完整 URL 的代理上。

### 使用保存好的会话

```js
import { readFile } from 'node:fs/promises'
import { GrokBotClient } from 'grok-bot-sdk'

const saved = JSON.parse(await readFile('./credentials.json', 'utf8'))
const client = new GrokBotClient({
  accessToken: saved.accessToken,
  teamId: saved.selectedTeamId,
})
const me = await client.getMe()
```

`getMe()` 返回服务端的账号对象，里面可以有邮箱和姓名。做健康检查时记录 `Boolean(me.email)` 这种布尔值。`grok-bot-sdk whoami --token-file ./credentials.json` 已经这样做。

也可以自己驱动同一套流程：

```js
import { createLogin, pollLogin } from 'grok-bot-sdk'

const flow = createLogin()
console.log(flow.loginUrl)
const session = await pollLogin(flow)
```

`pollLogin` 接受 `fetchImpl`、`sleep`、`maxAttempts` 和 `onPending`，方便测试。返回对象包含 `accessToken` 和 `refreshToken`。把它们留在内存里，或留在你自己控制的 `0600` 文件里。这个 SDK 不替你持久化，不调用刷新接口，也不调用登出。

进程退出后，内存里的副本消失。服务端会话会保留到它过期，或被别的动作撤销。

## 环境变量

```sh
export GROK_BOT_ACCESS_TOKEN='<访问令牌>'
export GROK_BOT_CLIENT_VERSION='0.78.1'   # 可选
npx grok-bot-sdk whoami
```

令牌放在环境变量或 `--token-file` 里。CLI 没有 `--token` 参数，这样密钥不必出现在命令行上。

## Mac 桌面会话

```js
import { desktopCredentials } from 'grok-bot-sdk/desktop'
import { GrokBotClient } from 'grok-bot-sdk'

const client = new GrokBotClient(await desktopCredentials())
```

这个适配器：

- 读取 `~/Library/Application Support/Grok Bot/sand-secrets.json`。
- 使用 `cursor-accounts` 里的 `active` 账号。它不改去读其他已保存账号。
- 通过 `/usr/bin/security` 读取钥匙串通用密码 `Grok Bot Safe Storage`。
- 在内存里解密 Electron safeStorage 的 `v10` 数据：PBKDF2-SHA1，盐 `saltysalt`，1003 次，16 字节密钥，AES-128-CBC，IV 为 16 个空格。
- 从 `/Applications/Grok Bot.app` 读取安装版本，作为 `version` 返回。
- 解密成功时返回 `{ accessToken, machineId, teamId, version }`。没有的字段会省略。

macOS 会弹出自己的授权对话框。点允许是你的操作。适配器不修改客户端文件，也不刷新客户端的令牌。读不到钥匙串时抛出 `KEYCHAIN_ACCESS_UNAVAILABLE`。这段代码解不开的数据抛出 `CREDENTIAL_DECRYPT_FAILED`。

这里的 `v10` 参数描述的是当时那台 macOS 客户端。Windows 和 Linux 的存储不在这个包里。服务器、手机或手表应使用浏览器登录。

若随后 `getMe()` 抛出 `ACCOUNT_AUTH_FAILED`，这份旧令牌已经不能用。改走浏览器登录。

## 仍然由你负责的部分

- 令牌文件放在哪里、谁能读、何时删除。
- 刷新访问令牌。桌面客户端里有 `POST /oauth/token`，这里没有实现。
- 登出。`POST /auth/logout` 没有实现。删掉本地文件之后，服务端会话还在。
- 给你自己的用户发的后端会话。Grok Bot 令牌留在那个后端上。
