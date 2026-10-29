# 协议

账号 RPC 的基址：`https://api2.cursor.sh`。

一元调用是 HTTP POST，`content-type: application/json`，`connect-protocol-version: 1`，请求体是 camelCase JSON。重定向会被拒绝。大于 8 MiB 的响应在传输层记为 `RESPONSE_TOO_LARGE`，并表现为一次失败的 RPC。

## 请求头

| 头 | 值 |
|---|---|
| `authorization` | `Bearer <accessToken>` |
| `x-cursor-client-type` | `sand` |
| `x-cursor-client-source` | `sand-desktop` |
| `x-cursor-client-version` | `options.version`，默认 `0.78.1` |
| `x-cursor-client-os` | `darwin` |
| `x-sand-box-namespace` | `prod` |
| `x-ghost-mode` | `true` |
| `x-request-id` | 每次调用一个新的 UUID |
| `user-agent` | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sand/<version> Safari/537.36` |
| `x-cursor-team-id` | 设置了 `teamId` 时出现 |
| `x-cursor-checksum` | 设置了 `machineId` 时出现 |

校验和把一个粗粒度时间戳和 machine id 按 0.78.1 客户端仍然使用的方式混合（`Date.now()/1e6`，再 XOR 165）。对已经核对过的登录路径，它是可选的。

这个 SDK 里的 `x-ghost-mode` 保持 `true`。0.78.1 桌面客户端只有在账号隐私模式允许训练时才发送 `false`。本包不读取这项设置。

## `GET https://cursor.com/loginDeepControl`

查询参数：`challenge`、`uuid`、`mode=login`、`redirectTarget=sand`、`supportsSelectedTeamLogin=true`。

`challenge` 是 Base64URL(SHA-256(32 个随机字节))。账号持有人在这个页面上批准 SDK 会话。0.78.1 桌面登录仍然使用 `redirectTarget=sand` 和 `supportsSelectedTeamLogin=true`。

## `GET /auth/poll`

查询参数：`uuid`、`verifier`。HTTP 404 表示仍在等待。HTTP 200 返回 `accessToken`、`refreshToken`，有时还有 `selectedTeamId`。HTTP 403 且响应体为 `{ "error": "sign_in_policy_violation" }` 时停止轮询，并抛出 `SIGN_IN_POLICY_VIOLATION`。

## `POST /aiserver.v1.DashboardService/GetMe`

请求体 `{}`。由 `getMe()` 使用。可用的响应体包含 `authId` 或 `userId`。0.75.8 增加了可选请求字段 `teamId`、`sourceSiteHostname` 和 `includeMobileAppStatus`。这个 SDK 不发送它们。响应仍然包含 `authId`、`userId`、`email` 和 `teamId`，以及客户端原样返回的后续资料字段。0.78.1 增加了 `emailIsSynthetic`。`getMe()` 按服务端原样返回这个对象。

## `POST /aiserver.v1.GrokBotService/ListGrokBotAgents`

除非调用方把标志设为 false，请求体是 `{ "includeTeamAgents": true }`。调用方设置时才会发送 0.75.8 的可选字段：`role`（字符串）和 `addedTeamAgentsOnly`（布尔）。

这个 SDK 读取的响应字段：`agents[]`、`truncated`、`slackConnections[]` 和 `teamsConnections[]`。每个 agent 需要 `agentId`。头像输入是 `avatarShape`、`avatarColor`、`avatarUrl`、`avatarDataUrl` 和 `avatarVersion`。0.75.8 的 `GrokBotAgent` 记录不再包含 `avatarDataUrl`；旧载荷如果还带着这个字段，SDK 仍然接受。`kind` 现在是 `GrokBotAgentKind` 枚举（`GROK_BOT_AGENT_KIND_AGENT`、`GROK_BOT_AGENT_KIND_ROOM`，或整数 `1` 和 `2`）。数字枚举会存成十进制字符串。

名单还会读取 `legacyAgentId`、`role`、`visibility`、`createdAtMs`、`updatedAtMs`、`ownerDisplayName`、`draftingDisabled`、`accessGrantsOnly`、`memberAgentIds`、`viewerAllowedActions`、`teamDefaultForViewer`、`voiceId`、`voiceSpeed` 和 `voiceLanguage`。嵌套的 `people`、`suggestions`、`publishedAt`、`viewerAccess` 和 `routinePolicy` 不会复制到 `Bot` 上。

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

在 0.78.1 里，这三个整数仍然是 `GrokBotClientSurface.DESKTOP`、`GrokBotUserMessageInitiator.USER` 和 `GrokBotSendSource.CHAT`。桌面客户端还可以发送 `source` `2`（`MOBILE`）或 `3`（`GLASS`），`initiator` `2`–`6`，以及 `sendSource` `2`–`4`。这个 SDK 保持桌面聊天默认值，不把这些枚举做成选项。

只有调用方提供时才发送的可选字段：`replyToId`、`replyQuote`、`taskId`、`language`、`richText` 和 `machineId`。`rendersMcpElicitationForms` 只有调用方传入 `true` 时才发送。请求里还有 `traceparent`、`enterEpochMs`、`composedAtMs`、`mcpConfigJson`、`onePasswordAppInstalled` 和 `firstSentAgeMs`。这个 SDK 不发送它们。

`delivery` `1`、`2`、`3` 映射为 `accepted-box`、`accepted-temporal` 和 `duplicate`。`delivery` `4`（`GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED`）抛出 `SEND_REFUSED`。`dispatched` 从布尔字段原样复制。响应里还可能有 `mode` 和 `refusal`；这个 SDK 不返回它们。

## `POST /aiserver.v1.GrokBotService/ListGrokBotTranscriptEntries`

`watchBot` 既没有 `cursor` 也没有 `resumeFrom` 时使用。

```json
{ "agentId": "<Bot.id>", "sessionId": "", "limit": 1 }
```

`listTranscript` 还可以发送可选的 `generation`、`beforeSeq` 和 `unreadBoundaryMs`。响应除了 `entries` 和 `generation`，还可能包含 `cloudAgentPeerIds`、`cloudAgentPeerIdsKnown` 和 `unreadAnchor`。

订阅路径读取 `generation`，以及返回条目的 `updatedSeq`（或 `seq`），然后从最大值之后开始订阅。

## `POST /aiserver.v1.GrokBotService/WatchGrokBotTranscripts`

Connect JSON 流，不是 SSE。

```text
content-type: application/connect+json
accept: application/connect+json
connect-accept-encoding: identity
```

请求体是一帧 Connect。载荷是：

```json
{
  "cursors": [
    { "agentId": "<Bot.id>", "sessionId": "", "generation": 0, "afterUpdatedSeq": "22" }
  ],
  "includeUnlistedAgents": false,
  "inlineBodyMaxBytes": 262144
}
```

### 帧

每一帧是 5 字节头加上一个 JSON 对象。

| 偏移 | 含义 |
|---|---|
| 0 | 标志。`0` 是数据帧。`2` 是结束帧。 |
| 1–4 | 载荷长度，大端 uint32。 |

压缩位（`flags & 1`）会被拒绝。其他标志值也会被拒绝。载荷必须是 JSON 对象，最大 1 MiB。

结束帧带有 `error` 属性时变成 `STREAM_RPC_ERROR`。错误对象不会被重新抛出，也不会复制进 SDK 错误。结束帧结束迭代器。数据帧交给映射器，产出[事件](/zh/api/events)。

0.75.8 在 `GrokBotTranscriptWatchFrame` 上增加了四个 oneof：`agentState`、`computerActions`、`boxState` 和 `pageTitleChanged`。`agentStateChanged` 还多了 `changedAtMs`。游标、记录行、清空、游标过旧、心跳、回合失败和名单变更字段没有变化。0.78.1 没有新增帧类型。`pageTitleChanged` 增加了 `contentChanged`。`boxState.state` 增加了 `imageTag`、`staticSnapshotPath`、`imageGitSha`、`staticSnapshotMatchesPin` 和 `staticSnapshotPin`。

转录文本是记录上的 base64 JSON 正文。解码器接受 UTF-8。文本消息是 `kind: "send-message"`，且 `message.type` 为 `"text"`，`message.content` 为字符串。这段内容变成 `event.data.text`。

订阅请求的响应头超时是 20 秒，使用与调用方相同的 `AbortSignal`。

## 为 0.75.8 增加的只读 RPC

这些都是 `POST /aiserver.v1.GrokBotService/<Method>`，Connect JSON。

| 方法 | 这个 SDK 发送的请求字段 | 这个 SDK 读取的响应字段 |
|---|---|---|
| `ListGrokBotAgentSessions` | `agentId` | `sessions[]`：`agentId`、`sessionId`、`kind`、`createdAtMs`、`updatedAtMs`、`lastActivityAtMs` |
| `ListGrokBotAgentStatuses` | `agentIds` | `statuses[]`：`agentId`、`isRunning`，以及 `live` 和 `client` 的标量字段，包括 `unreadThreadCount` |
| `GetGrokBotSendStatus` | `agentId`、`messageId`、`sessionId`，可选 `firstSentAgeMs`，可选 `taskId` | `status`、`echoEntryId`、`rejectionCode`、`acceptedAtMs` |
| `ListGrokBotAgentTasks` | `agentId`，可选 `includeRecentlyDone` | `tasks[]`：`id`、`name`、`description`、`status`、`updatedAtMs`、未读字段、`pinnedAtMs`、`subagentIds`、`followed` |
| `ListGrokBotTasks` | `agentId`、`sessionId` | `tasks[]`：`id`、`title`、`state`、`note`、`createdAtMs`、`doneAtMs`、`seenDoneAtMs` |
| `ListGrokBotSubagents` | `agentId` | `subagents[]`：`subagentId`、`subagentType`、`title`、`startedAtMs`、`freshUntilMs` |
| `ListGrokBotAgentTodos` | `agentId` | `todos[]`：`id`、`content`、`status`、`createdAt`、`updatedAt`、`dependencies` |
| `ListGrokBotAgentSkills` | `agentId` | `skills[]`：`id`、`name`、`description`、`body`、`source` |
| `ListDeletedGrokBotAgentIds` | `agentIds` | `agentIds` |
| `GetGrokBotRuntimeCapabilities` | `{}` | `capabilities` 的五项布尔值：持久身份、持久身份写入、Temporal 创建、agent 消息、服务器房间 |
| `GetSandBoxRunState` | `{}` | `state`、`imageUpdateAvailable`、`egressTunnelOwnership`、`image.registryTag`、`image.staticSnapshotPath` |
| `GetGrokBotAgentCustomMcp` | `agentId`、`pluginId` | `server.pluginId`、`server.name`、`server.http`（`url`、`headerNames`、`hasOauthClientId`、`hasOauthClientSecret`）、`server.stdio`（`command`、`args`、`hasEnv`） |
| `ListGrokBotAgentAccessInvites` | `agentId` | `invites[]`（`email`、`expiresAtMs`、`lastSharedAtMs`、`createdAtMs`）、`capUsage.used`、`capUsage.limit` |
| `PreviewGrokBotAgentAccessInvite` | `code` | `found`、`recipientMatch`、`sender`、`invites[]`、`truncated`、`otherResourceInviteCount`、`eligibility` |

## 写 RPC

这些都是 `POST /aiserver.v1.GrokBotService/<Method>`，Connect JSON。本表里的枚举按 protobuf JSON 名字发送，例如 `TEMPORAL`。

| 方法 | 这个 SDK 发送的请求字段 | 这个 SDK 读取的响应字段 | 破坏性 |
|---|---|---|---|
| `DeleteGrokBotAgent` | `id`（`Bot.id`） | 无 | 不可撤销 |
| `CreateGrokBotRoom` | `agentId`、`name`、`description`、`memberAgentIds`、`humanMemberUserIds` | `agent`，再映射成与名单相同的 `Bot` 字段 | 否 |
| `AddGrokBotRoomPeople` | `agentId`、`userIds` | `agent` | 否 |
| `RemoveGrokBotRoomPeople` | `agentId`、`userIds` | `agent`，可以缺失 | 不可撤销 |
| `SetGrokBotRoomMembers` | `agentId`、`memberAgentIds` | `agent` | 不可撤销 |
| `CreateGrokBotAgent` | `agentId`、`name`、`description`、`title`、`avatarShape`、`avatarColor`，以及调用方传入的可选 proto 字段 | `agent`、`harness` | 否 |
| `UpdateGrokBotAgent` | `id`（`Bot.serverId`）、`partialUpdate: true`，以及调用方传入的文本或头像字段。`clearAvatar` 是 `{}` | `agent` | 否 |
| `AddGrokBotAgentSkill` | `agentId`、`content`，可选 `name` 和 `description` | `marketplace`、`plugins`、`skill` | 否 |
| `UpdateGrokBotAgentSkill` | `agentId`、`name`、`content`，可选 `description` | `marketplace`、`plugins`、`skill` | 否 |
| `RemoveGrokBotAgentSkill` | `agentId`、`name` | `marketplace`、`plugins` | 不可撤销 |

`DeleteGrokBotAgent.id` 是 agent id。0.78.1 协调器删除 Temporal agent 时发送 `{method:"deleteAgent", args:{id: agentId}}`。`UpdateGrokBotAgent.id` 是另一个 id：桌面端团队资料路径传入的是 `serverId`（`GrokBotAgent.id`）。技能写入返回的 plugin 还包含 `credentialSource`、`delegatedCredential`、`credentialAllowedActions` 和 `supportsServiceAccount`。

## 这个 SDK 不调用的接口

在桌面客户端里看到过，并且有意没有实现：

- `POST /oauth/token`（刷新）
- `POST /auth/exchange_user_api_key`
- `POST /auth/logout`
- 公开客户端上的 `EnsureSandBox`（它仍留在 `core.mjs` 的 `verify()` 里）、gateway `/health`、gateway `listAgents`
- 附件上传（`BeginGrokBotAttachmentUpload` 以及 box 上传路径）
- 上面表格以外的写 RPC，包括发布、置顶、忽略和消息表情
- 恢复已删除的 agent。0.78.1 的 proto 没有针对 `GrokBotAgent` 的 `Restore`、`Undelete` 或 `Recover` RPC。`AdminRestoreSandBoxStoreSnapshot` 和 `UndeleteAgentStoreFiles` 不是这个接口

0.78.1 的 `GrokBotService` 有 414 个方法：409 个一元调用，5 个服务端流。上面清单里没有的名字，就没有被包装、没有被调用，也不在这个包的测试范围内。`ListGrokBotTranscriptEntries` 还会返回 `updatedSeqLocked`。名单里的 agent 还会返回 `accessOwnerOnly`。
