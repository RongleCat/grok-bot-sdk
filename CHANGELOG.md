# Changelog

## 0.78.1

Protocol surface matched to the Grok Bot 0.78.1 desktop client. The management writes from the unreleased set ship in this version.

Protocol upgrade from 0.75.8:

- Default `x-cursor-client-version` is `0.78.1`.
- `GrokBotService` grew from 367 methods to 414 (409 unary, 5 server-streaming). Removed `EnsureGrokBotCursorMainBot`. Streaming methods are unchanged.
- No restore RPC for a deleted agent. `AdminRestoreSandBoxStoreSnapshot` and `UndeleteAgentStoreFiles` are still present and are not a bot restore.
- Checksum (`Date.now()/1e6`, XOR 165, base64url + machine id), `x-ghost-mode` default, `loginDeepControl` query (`challenge`, `uuid`, `mode=login`, `redirectTarget=sand`, `supportsSelectedTeamLogin=true`), `/auth/poll?uuid&verifier`, and the desktop `POST /oauth/token` JSON body (`client_id`, `grant_type=refresh_token`, `refresh_token`) are unchanged. A separate form-urlencoded refresh helper with an optional `scope` posts to an issuer token URL, not this desktop refresh.
- Desktop chat enums are unchanged: `source=1` (`DESKTOP`), `initiator=1` (`USER`), `sendSource=1` (`CHAT`).
- `WatchGrokBotTranscripts` frame arms are unchanged. `page.title.changed` gained `contentChanged`. `GrokBotBoxState` gained `imageTag`, `staticSnapshotPath`, `imageGitSha`, `staticSnapshotMatchesPin`, and `staticSnapshotPin`.
- `SendGrokBotUserMessage` gained optional `rendersMcpElicitationForms`. `sendMessage` sends it only when called with `true`. `GetGrokBotSendStatus` gained optional `taskId`.
- Mapped response fields: `Bot.accessOwnerOnly`, `listTranscript` `updatedSeqLocked`, client `unreadThreadCount`, agent task `followed`, and plugin `credentialSource`, `delegatedCredential`, `credentialAllowedActions`, `supportsServiceAccount`. `getMe()` still returns the raw account object; that object may now include `emailIsSynthetic`.
- New reads: `getAgentCustomMcp`, `listAgentAccessInvites`, `previewAgentAccessInvite`.
- Avatar derivation is unchanged (`grok-bot-0.70.2`). The 0.78.1 bundle still has the same FNV constants and the `pumpkin` label.

Management writes for bots and rooms:

- `deleteBot` and `deleteRoom` call `DeleteGrokBotAgent`. Both are irreversible. `deleteRoom` checks the roster kind first and throws `NOT_A_ROOM` otherwise.
- `createRoom`, `addRoomMembers`, `removeRoomMembers`, and `setRoomMembers`. `removeRoomMembers` and `setRoomMembers` are irreversible.
- `createBot` calls `CreateGrokBotAgent`. `updateBot` calls `UpdateGrokBotAgent` with `partialUpdate: true`. `updateBot` takes `Bot.serverId`, not `Bot.id`.
- `addAgentSkill`, `updateAgentSkill`, and `removeAgentSkill`. `removeAgentSkill` is irreversible.
- No `restoreBot`. The 0.78.1 proto has no restore RPC for a deleted agent.
- `listSessions` returns `{ sessions: [] }` when the server omits an empty `sessions` field, instead of throwing `RPC_FAILED`.

Copy and file reads:

- `duplicateBot({ botId, newBotId? })` calls `DuplicateGrokBotAgent`. `botId` is sent as `sourceAgentId`. `newBotId` is the new bot id (`agentId`) and defaults to a UUID, the same pattern as `createRoom`. Returns `{ bot }` only when the server echoes that id. The 0.78.1 desktop client defines this RPC and does not call it.
- `listAgentFiles({ botId, pageToken? })` calls `ListGrokBotAgentFiles`. Returns `{ files, nextPageToken, totalBytes, canEdit }`. Each file is a `GrokBotAgentFile` (`name`, `path`, `sizeBytes`, `contentType`, `updatedAtMs`, `etag`). `pageToken` is sent only when provided. An omitted `files` field is an empty list.
- List reads (`listTranscript`, `listAgentSkills`, `listAgentStatuses`, tasks, subagents, todos, deleted ids, access invites) return an empty list when the server omits an empty repeated field, instead of throwing `RPC_FAILED`.

## 0.75.8

Protocol surface matched to the Grok Bot 0.75.8 desktop client. The package stays ESM, with no runtime dependencies.

- Default `x-cursor-client-version` is `0.75.8`.
- Login polling stops on HTTP 403 `{ "error": "sign_in_policy_violation" }` and throws `SIGN_IN_POLICY_VIOLATION`.
- Roster reads optional `role` and `addedTeamAgentsOnly`, and returns Slack and Teams connection records plus the additional `GrokBotAgent` scalars present in 0.75.8.
- `sendMessage` accepts `replyToId`, `replyQuote`, `taskId`, `language`, `richText`, and `machineId`. Delivery `4` (`REFUSED`) throws `SEND_REFUSED`.
- New read methods: `listSessions`, `listTranscript`, `listAgentStatuses`, `getSendStatus`, `listAgentTasks`, `listTasks`, `listSubagents`, `listAgentTodos`, `listAgentSkills`, `listDeletedAgentIds`, `getRuntimeCapabilities`, `getSandBoxRunState`.
- Watch events add `agent.state`, `computer.actions`, `box.state`, and `page.title.changed`. `bot.state.changed` includes `changedAtMs`.
- CLI read-only subcommands: `bots`, `sessions`, `transcript`, `tasks`, `capabilities`, `box`.
- Avatar derivation is unchanged (`grok-bot-0.70.2`). `pumpkin` is accepted as an explicit shape.

The checksum, ghost-mode default, and desktop chat enums `source=1`, `initiator=1`, `sendSource=1` are the same values the 0.75.8 client still sends for desktop chat.

## 0.1.0

First release, matched to the Grok Bot 0.70.2 desktop client. From 0.75.8 on, the package version follows the Grok Bot version it targets.
