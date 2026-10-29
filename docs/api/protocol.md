# Protocol

Base URL for account RPCs: `https://api2.cursor.sh`.

Unary calls are HTTP POST, `content-type: application/json`, `connect-protocol-version: 1`, body JSON in camelCase. Redirects are rejected. A response larger than 8 MiB is `RESPONSE_TOO_LARGE` inside the transport and surfaces as a failed RPC.

## Headers

| Header | Value |
|---|---|
| `authorization` | `Bearer <accessToken>` |
| `x-cursor-client-type` | `sand` |
| `x-cursor-client-source` | `sand-desktop` |
| `x-cursor-client-version` | `options.version`, default `0.78.1` |
| `x-cursor-client-os` | `darwin` |
| `x-sand-box-namespace` | `prod` |
| `x-ghost-mode` | `true` |
| `x-request-id` | A new UUID per call |
| `user-agent` | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sand/<version> Safari/537.36` |
| `x-cursor-team-id` | Present when `teamId` is set |
| `x-cursor-checksum` | Present when `machineId` is set |

The checksum mixes a coarse timestamp with the machine id the way the 0.78.1 client still does (`Date.now()/1e6`, then XOR 165). It is optional for the login path that was verified.

`x-ghost-mode` stays `true` in this SDK. The 0.78.1 desktop client sends `false` only when the account privacy mode allows training. This package does not read that setting.

## `GET https://cursor.com/loginDeepControl`

Query: `challenge`, `uuid`, `mode=login`, `redirectTarget=sand`, `supportsSelectedTeamLogin=true`.

`challenge` is Base64URL(SHA-256(32 random bytes)). The page is where the account holder approves the SDK session. The 0.78.1 desktop login still uses `redirectTarget=sand` and `supportsSelectedTeamLogin=true`.

## `GET /auth/poll`

Query: `uuid`, `verifier`. HTTP 404 means pending. HTTP 200 returns `accessToken`, `refreshToken`, and sometimes `selectedTeamId`. HTTP 403 with `{ "error": "sign_in_policy_violation" }` stops polling and throws `SIGN_IN_POLICY_VIOLATION`.

## `POST /aiserver.v1.DashboardService/GetMe`

Body `{}`. Used by `getMe()`. A usable body contains `authId` or `userId`. 0.75.8 adds optional request fields `teamId`, `sourceSiteHostname`, and `includeMobileAppStatus`. This SDK does not send them. The response still includes `authId`, `userId`, `email`, and `teamId`, plus later profile fields the client leaves on the returned object. 0.78.1 adds `emailIsSynthetic`. `getMe()` returns that object as the server sent it.

## `POST /aiserver.v1.GrokBotService/ListGrokBotAgents`

Body `{ "includeTeamAgents": true }` unless the caller set the flag to false. Optional 0.75.8 fields, sent only when the caller sets them: `role` (string) and `addedTeamAgentsOnly` (boolean).

Response fields this SDK reads: `agents[]`, `truncated`, `slackConnections[]`, and `teamsConnections[]`. Each agent needs `agentId`. Avatar inputs are `avatarShape`, `avatarColor`, `avatarUrl`, `avatarDataUrl`, and `avatarVersion`. The 0.75.8 `GrokBotAgent` record no longer has `avatarDataUrl`; that field remains accepted when an older payload still sends it. `kind` is now the `GrokBotAgentKind` enum (`GROK_BOT_AGENT_KIND_AGENT`, `GROK_BOT_AGENT_KIND_ROOM`, or the integers `1` and `2`). A numeric enum is stored as its decimal string.

Roster inputs also include `legacyAgentId`, `role`, `visibility`, `createdAtMs`, `updatedAtMs`, `ownerDisplayName`, `draftingDisabled`, `accessGrantsOnly`, `memberAgentIds`, `viewerAllowedActions`, `teamDefaultForViewer`, `voiceId`, `voiceSpeed`, and `voiceLanguage`. Nested `people`, `suggestions`, `publishedAt`, `viewerAccess`, and `routinePolicy` are not copied onto `Bot`.

## `POST /aiserver.v1.GrokBotService/SendGrokBotUserMessage`

```json
{
  "agentId": "<Bot.id>",
  "text": "...",
  "sessionId": "",
  "messageId": "<uuid>",
  "attachmentPaths": [],
  "attachmentNames": [],
  "sentAtMs": "1710000000000",
  "isFork": false,
  "source": 1,
  "initiator": 1,
  "sendSource": 1
}
```

In 0.78.1 those integers are still `GrokBotClientSurface.DESKTOP`, `GrokBotUserMessageInitiator.USER`, and `GrokBotSendSource.CHAT`. The desktop client can also send `source` `2` (`MOBILE`) or `3` (`GLASS`), `initiator` `2`–`6`, and `sendSource` `2`–`4`. This SDK keeps the desktop chat defaults and does not expose those enums as options.

Optional fields sent only when the caller provides them: `replyToId`, `replyQuote`, `taskId`, `language`, `richText`, and `machineId`. `rendersMcpElicitationForms` is sent only when the caller passes `true`. The request also has `traceparent`, `enterEpochMs`, `composedAtMs`, `mcpConfigJson`, `onePasswordAppInstalled`, and `firstSentAgeMs`. This SDK does not send those.

`delivery` `1`, `2`, and `3` map to `accepted-box`, `accepted-temporal`, and `duplicate`. `delivery` `4` (`GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED`) throws `SEND_REFUSED`. `dispatched` is copied from the boolean field. The response may also include `mode` and `refusal`; this SDK does not return them.

## `POST /aiserver.v1.GrokBotService/ListGrokBotTranscriptEntries`

Used when `watchBot` has neither `cursor` nor `resumeFrom`.

```json
{ "agentId": "<Bot.id>", "sessionId": "", "limit": 1 }
```

`listTranscript` can also send optional `generation`, `beforeSeq`, and `unreadBoundaryMs`. The response may include `cloudAgentPeerIds`, `cloudAgentPeerIdsKnown`, and `unreadAnchor` in addition to `entries` and `generation`.

The watch path reads `generation` and the `updatedSeq` (or `seq`) of the returned entries, and starts the watch after the maximum.

## `POST /aiserver.v1.GrokBotService/WatchGrokBotTranscripts`

Connect JSON streaming, not SSE.

```text
content-type: application/connect+json
accept: application/connect+json
connect-accept-encoding: identity
```

The body is one Connect frame. The payload is:

```json
{
  "cursors": [
    { "agentId": "<Bot.id>", "sessionId": "", "generation": 0, "afterUpdatedSeq": "22" }
  ],
  "includeUnlistedAgents": false,
  "inlineBodyMaxBytes": 262144
}
```

### Frames

Each frame is a 5-byte header plus a JSON object.

| Offset | Meaning |
|---|---|
| 0 | Flags. `0` is a data frame. `2` is the end frame. |
| 1–4 | Payload length, big-endian uint32. |

The compression bit (`flags & 1`) is rejected. Any other flag value is rejected. The payload must be a JSON object, at most 1 MiB.

An end frame with an `error` property becomes `STREAM_RPC_ERROR`. The error object is not rethrown and not copied into the SDK error. An end frame ends the iterator. Data frames are yielded into the mapper that produces [events](/api/events).

0.75.8 adds four oneof arms on `GrokBotTranscriptWatchFrame`: `agentState`, `computerActions`, `boxState`, and `pageTitleChanged`. `agentStateChanged` also gained `changedAtMs`. Cursor, rows, cleared, cursor-too-old, heartbeat, turn-failed, and roster-changed fields are unchanged. 0.78.1 does not add a frame arm. `pageTitleChanged` gained `contentChanged`. `boxState.state` gained `imageTag`, `staticSnapshotPath`, `imageGitSha`, `staticSnapshotMatchesPin`, and `staticSnapshotPin`.

Transcript text is a base64 JSON body on the entry. The decoder accepts UTF-8. A text message is `kind: "send-message"` with `message.type: "text"` and a string `message.content`. That content becomes `event.data.text`.

Header timeout for the watch request is 20 seconds, using the same `AbortSignal` as the caller.

## Read RPCs added for 0.75.8

All of these are `POST /aiserver.v1.GrokBotService/<Method>` with Connect JSON.

| Method | Request fields this SDK sends | Response fields this SDK reads |
|---|---|---|
| `ListGrokBotAgentSessions` | `agentId` | `sessions[]`: `agentId`, `sessionId`, `kind`, `createdAtMs`, `updatedAtMs`, `lastActivityAtMs` |
| `ListGrokBotAgentStatuses` | `agentIds` | `statuses[]`: `agentId`, `isRunning`, scalar fields of `live` and `client`, including `unreadThreadCount` |
| `GetGrokBotSendStatus` | `agentId`, `messageId`, `sessionId`, optional `firstSentAgeMs`, optional `taskId` | `status`, `echoEntryId`, `rejectionCode`, `acceptedAtMs` |
| `ListGrokBotAgentTasks` | `agentId`, optional `includeRecentlyDone` | `tasks[]`: `id`, `name`, `description`, `status`, `updatedAtMs`, unread fields, `pinnedAtMs`, `subagentIds`, `followed` |
| `ListGrokBotTasks` | `agentId`, `sessionId` | `tasks[]`: `id`, `title`, `state`, `note`, `createdAtMs`, `doneAtMs`, `seenDoneAtMs` |
| `ListGrokBotSubagents` | `agentId` | `subagents[]`: `subagentId`, `subagentType`, `title`, `startedAtMs`, `freshUntilMs` |
| `ListGrokBotAgentTodos` | `agentId` | `todos[]`: `id`, `content`, `status`, `createdAt`, `updatedAt`, `dependencies` |
| `ListGrokBotAgentSkills` | `agentId` | `skills[]`: `id`, `name`, `description`, `body`, `source` |
| `ListDeletedGrokBotAgentIds` | `agentIds` | `agentIds` |
| `GetGrokBotRuntimeCapabilities` | `{}` | `capabilities.durableIdentityEnabled`, `durableIdentityWritesEnabled`, `temporalCreationEnabled`, `agentMessagingEnabled`, `serverRoomsEnabled` |
| `GetSandBoxRunState` | `{}` | `state`, `imageUpdateAvailable`, `egressTunnelOwnership`, `image.registryTag`, `image.staticSnapshotPath` |
| `GetGrokBotAgentCustomMcp` | `agentId`, `pluginId` | `server.pluginId`, `server.name`, `server.http` (`url`, `headerNames`, `hasOauthClientId`, `hasOauthClientSecret`), `server.stdio` (`command`, `args`, `hasEnv`) |
| `ListGrokBotAgentAccessInvites` | `agentId` | `invites[]` (`email`, `expiresAtMs`, `lastSharedAtMs`, `createdAtMs`), `capUsage.used`, `capUsage.limit` |
| `PreviewGrokBotAgentAccessInvite` | `code` | `found`, `recipientMatch`, `sender`, `invites[]`, `truncated`, `otherResourceInviteCount`, `eligibility` |

## Write RPCs

All of these are `POST /aiserver.v1.GrokBotService/<Method>` with Connect JSON. Enums in this table are sent as protobuf JSON names, for example `TEMPORAL`.

| Method | Request fields this SDK sends | Response fields this SDK reads | Destructive |
|---|---|---|---|
| `DeleteGrokBotAgent` | `id` (`Bot.id`) | none | Irreversible |
| `CreateGrokBotRoom` | `agentId`, `name`, `description`, `memberAgentIds`, `humanMemberUserIds` | `agent`, then the same `Bot` fields as the roster | No |
| `AddGrokBotRoomPeople` | `agentId`, `userIds` | `agent` | No |
| `RemoveGrokBotRoomPeople` | `agentId`, `userIds` | `agent`, which may be absent | Irreversible |
| `SetGrokBotRoomMembers` | `agentId`, `memberAgentIds` | `agent` | Irreversible |
| `CreateGrokBotAgent` | `agentId`, `name`, `description`, `title`, `avatarShape`, `avatarColor`, plus any optional proto fields you pass | `agent`, `harness` | No |
| `UpdateGrokBotAgent` | `id` (`Bot.serverId`), `partialUpdate: true`, and only the text or avatar fields you pass. `clearAvatar` is `{}` | `agent` | No |
| `AddGrokBotAgentSkill` | `agentId`, `content`, optional `name` and `description` | `marketplace`, `plugins`, `skill` | No |
| `UpdateGrokBotAgentSkill` | `agentId`, `name`, `content`, optional `description` | `marketplace`, `plugins`, `skill` | No |
| `RemoveGrokBotAgentSkill` | `agentId`, `name` | `marketplace`, `plugins` | Irreversible |

`DeleteGrokBotAgent.id` is the agent id. The 0.78.1 coordinator deletes a temporal agent with `{method:"deleteAgent", args:{id: agentId}}`. `UpdateGrokBotAgent.id` is the other id: the desktop team path passes `serverId` (`GrokBotAgent.id`). Skill-write plugins also return `credentialSource`, `delegatedCredential`, `credentialAllowedActions`, and `supportsServiceAccount`.

## Calls this SDK does not make

Observed in the desktop client, and intentionally unimplemented:

- `POST /oauth/token` (refresh)
- `POST /auth/exchange_user_api_key`
- `POST /auth/logout`
- `EnsureSandBox` on the public client (it remains inside `verify()` in `core.mjs`), gateway `/health`, and gateway `listAgents`
- Attachment upload (`BeginGrokBotAttachmentUpload` and the box upload path)
- Write RPCs other than the management methods in the table above, including publish, pin, dismiss, and message reactions
- Restoring a deleted agent. The 0.78.1 proto has no `Restore`, `Undelete`, or `Recover` RPC for a `GrokBotAgent`. `AdminRestoreSandBoxStoreSnapshot` and `UndeleteAgentStoreFiles` are not that RPC

`GrokBotService` in 0.78.1 has 414 methods: 409 unary and 5 server-streaming. A name that is not in the lists above is not wrapped, not called, and not covered by the tests of this package. `ListGrokBotTranscriptEntries` also returns `updatedSeqLocked`. Roster agents also return `accessOwnerOnly`.
