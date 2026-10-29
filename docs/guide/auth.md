# Authorization

Use a new browser login for any app you ship. The Mac Keychain path is a local convenience for a machine that already runs Grok Bot.

Both paths produce an `accessToken` string. Pass it to `new GrokBotClient({ accessToken })`. Add `teamId` when the login selected a team. Add `version` when you want the `x-cursor-client-version` header to name a client other than `0.78.1`.

## Browser login

```sh
npx grok-bot-sdk login --out ./credentials.json
```

What the command does:

1. Creates a random `uuid` and a random 32-byte `verifier`.
2. Sets `challenge` to Base64URL(SHA-256(`verifier`)), without padding.
3. Prints a `loginUrl` on `https://cursor.com/loginDeepControl`. That URL contains `challenge`, `uuid`, `mode=login`, `redirectTarget=sand`, and `supportsSelectedTeamLogin=true`. It does not contain `verifier` or any token.
4. On macOS, opens that URL with `/usr/bin/open`, unless you passed `--no-open`.
5. Polls `GET https://api2.cursor.sh/auth/poll?uuid&verifier` until the server returns tokens, the poll fails, or the wait ends.
6. Writes `credentials.json` with mode `0600`.

The file looks like this:

```json
{
  "accessToken": "<secret>",
  "refreshToken": "<secret>",
  "selectedTeamId": 0
}
```

`selectedTeamId` is omitted when the server does not send it. Treat the file as a password. Add it to `.gitignore`. The command's own log never prints the file contents.

The page may offer to open the official Grok Bot app. This SDK does not need that handoff. After you approve the login, polling receives the session. The SDK uses a new uuid, so it does not take over a login the official app already started.

### Poll results

| Response | Meaning |
|---|---|
| HTTP 404 | The login is still waiting. The client keeps polling. |
| HTTP 200 with `accessToken` and `refreshToken` | The session is ready. |
| HTTP 403 | The server refused the sign-in. This is a failure. |
| Any other error, three times in a row | The command stops with `LOGIN_POLL_FAILED`. |
| 150 attempts elapsed | The command stops with `LOGIN_TIMED_OUT`. |

The wait starts at 1 second and grows by 1.2, capped at 10 seconds. Each HTTP call times out after 20 seconds.

The poll URL contains `verifier`. Do not log it, and do not send it through a proxy that records full URLs.

### Use the saved session

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

`getMe()` returns the account payload from the server, which can include an email and a name. Log a boolean such as `Boolean(me.email)` when you need a health check. `grok-bot-sdk whoami --token-file ./credentials.json` already does that.

You can drive the same flow yourself:

```js
import { createLogin, pollLogin } from 'grok-bot-sdk'

const flow = createLogin()
console.log(flow.loginUrl)
const session = await pollLogin(flow)
```

`pollLogin` accepts `fetchImpl`, `sleep`, `maxAttempts`, and `onPending` for tests. The returned object includes `accessToken` and `refreshToken`. Keep both in memory or in a `0600` file that you control. This SDK does not store them for you, does not call the refresh endpoint, and does not call logout.

Exiting the process drops the in-memory copy. The server session remains until it expires or something else revokes it.

## Environment variable

```sh
export GROK_BOT_ACCESS_TOKEN='<access token>'
export GROK_BOT_CLIENT_VERSION='0.78.1'   # optional
npx grok-bot-sdk whoami
```

Pass the token in the environment or in `--token-file`. The CLI has no `--token` flag, so the value does not have to sit in the shell command line.

## Mac desktop session

```js
import { desktopCredentials } from 'grok-bot-sdk/desktop'
import { GrokBotClient } from 'grok-bot-sdk'

const client = new GrokBotClient(await desktopCredentials())
```

This adapter:

- Reads `~/Library/Application Support/Grok Bot/sand-secrets.json`.
- Selects the `active` account inside `cursor-accounts`. It does not scan other saved accounts.
- Asks macOS Keychain for the generic password named `Grok Bot Safe Storage`, via `/usr/bin/security`.
- Decrypts the Electron safeStorage `v10` blob in memory: PBKDF2-SHA1, salt `saltysalt`, 1003 iterations, 16-byte key, AES-128-CBC, IV of 16 spaces.
- Reads the installed app version from `/Applications/Grok Bot.app` and returns it as `version`.
- Returns `{ accessToken, machineId, teamId, version }` when those fields decrypt. `machineId` and `teamId` are omitted when absent.

macOS shows its own permission dialog. Approving that dialog is the user's action. The adapter does not change the client's files and does not refresh the client's token. A failure to read the Keychain throws `KEYCHAIN_ACCESS_UNAVAILABLE`. A blob this code cannot decrypt throws `CREDENTIAL_DECRYPT_FAILED`.

The `v10` parameters describe the macOS client that was inspected. Windows and Linux stores are outside this package. A server, a phone, or a watch should use browser login.

If `getMe()` then fails with `ACCOUNT_AUTH_FAILED`, the stored token is no longer usable. Switch to browser login.

## What you still own

- Where the token file lives, who can read it, and when you delete it.
- Refreshing the access token. `POST /oauth/token` appears in the desktop client and is not implemented here.
- Logout. `POST /auth/logout` is not implemented here. Deleting the local file leaves the server session in place.
- A backend session for your own users. The Grok Bot token stays on that backend.
