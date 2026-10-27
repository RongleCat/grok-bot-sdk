# Changelog

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
