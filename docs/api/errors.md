# Errors

## `SDKError`

```ts
class SDKError extends Error {
  code: string
  httpStatus?: number
}
```

`error.message` and `error.code` are the same fixed string. `httpStatus` is set when the failure came from an HTTP response. The message is safe to log. The class does not attach the response body, so a log of `SDKError` does not contain the token or the account payload.

Unknown constructor codes are stored as `SDK_ERROR`.

| Code | When |
|---|---|
| `MISSING_ACCESS_TOKEN` | `accessToken` is missing or empty. Also used by the CLI when `whoami` has no token source. |
| `ACCOUNT_AUTH_FAILED` | `GetMe` failed, or HTTP 200 lacked `authId` and `userId`. |
| `RPC_FAILED` | A unary roster or transcript call failed. |
| `INVALID_ROSTER_RESPONSE` | `ListGrokBotAgents` returned no `agents` array. |
| `INVALID_BOT_RECORD` | A roster element has no `agentId`. |
| `BOT_ID_REQUIRED` | `botId` is empty, longer than 128, or outside `[A-Za-z0-9_-]`. |
| `MESSAGE_INVALID` | Text, session, message id, or attachment arrays failed validation. |
| `SEND_UNCONFIRMED` | The send HTTP call failed. Do not automatically send again. |
| `SEND_REFUSED` | HTTP succeeded and `delivery` was not a known acceptance. Integer `4` and `GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED` are this case. |
| `CURSOR_INVALID` | Cursor fields, resume encoding, or using both cursor forms. |
| `CURSOR_SCOPE_MISMATCH` | `resumeFrom` names another bot or session. |
| `STREAM_CONNECTION_FAILED` | Watch HTTP failed, or the socket failed before a typed stream error. |
| `STREAM_INVALID_RESPONSE` | Watch HTTP 200 used a content type other than `application/connect+json`, or the body cannot be read. |
| `STREAM_FRAME_TOO_LARGE` | A frame exceeds 1 MiB, or `inlineBodyMaxBytes` is out of range. |
| `STREAM_COMPRESSION_UNSUPPORTED` | The compression flag bit is set. |
| `STREAM_FLAGS_INVALID` | Flags are neither data (`0`) nor end (`2`). |
| `STREAM_INVALID_JSON` | A frame is not a JSON object. |
| `STREAM_UNEXPECTED_EOF` | The body ended without an end frame. |
| `STREAM_END_INVALID` | Bytes followed the end frame. |
| `STREAM_RPC_ERROR` | The end frame carried an `error` object. The server error body is discarded. |
| `STREAM_PROTOCOL_ERROR` | An event could not be encoded as SSE. |
| `STREAM_CANCELLED` | Reserved in the code list. Aborting a watch returns from the generator. |
| `SDK_ERROR` | An SSE iterator failed with a non-`SDKError`. The SSE `error` event uses this code. |

On an SSE response that has already started, these codes arrive as:

```text
event: error
data: {"code":"STREAM_RPC_ERROR"}
```

## Login and desktop errors

These are `Error` with a fixed `message`, thrown by `pollLogin`, `decryptMacSecret`, `selectDesktopAccount`, or `desktopCredentials`.

| Message | When |
|---|---|
| `LOGIN_POLL_FAILED` | Three poll responses in a row were neither success nor HTTP 404. |
| `LOGIN_TIMED_OUT` | `maxAttempts` finished while the login was still pending. |
| `SIGN_IN_POLICY_VIOLATION` | Poll returned HTTP 403 `{ "error": "sign_in_policy_violation" }`. Polling stops. |
| `CREDENTIAL_DECRYPT_FAILED` | The blob is not a `v10` secret this code can open. |
| `ACCOUNT_STORE_INVALID` | `cursor-accounts` is not JSON. |
| `NO_ACTIVE_ACCOUNT` | The store has no usable `active` account. |
| `ACCESS_TOKEN_MISSING` | The active account has no `cursor-access-token`. |
| `KEYCHAIN_ACCESS_UNAVAILABLE` | `security` could not return the Grok Bot password. |
| `TOKEN_FILE_INVALID` | The CLI token file has no string `accessToken`. |

The CLI prints `{ "status": "failed", "code": "<message>" }` and exits 1. Usage mistakes exit 2.
