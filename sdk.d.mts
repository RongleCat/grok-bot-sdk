import type { ResolvedAvatar, CloudAvatarRecord } from './avatar.mjs';
export { deriveDefaultAvatar, resolveAgentAvatar } from './avatar.mjs';
export type { ResolvedAvatar, CharacterAvatar, AvatarSource } from './avatar.mjs';

export interface ClientOptions {
  accessToken: string;
  version?: string;
  machineId?: string;
  teamId?: number;
  fetchImpl?: typeof fetch;
}
export interface Bot {
  id: string;
  serverId: string | null;
  legacyAgentId: string;
  name: string;
  description: string;
  title: string;
  avatarShape: string;
  avatarColor: string;
  avatar: ResolvedAvatar;
  harness: string;
  role: string;
  kind: string;
  visibility: string;
  sessionId: string;
  teamId: number | null;
  viewerIsOwner: boolean;
  viewerCanManage: boolean;
  teamDefaultForViewer: boolean;
  ownerDisplayName: string;
  draftingDisabled: boolean;
  accessGrantsOnly: boolean;
  accessOwnerOnly: boolean;
  memberAgentIds: string[];
  viewerAllowedActions: string[];
  createdAtMs: string | null;
  updatedAtMs: string | null;
  voiceId: string;
  voiceSpeed: number | null;
  voiceLanguage: string;
}
export interface SlackConnection {
  agentId: string;
  connected: boolean;
  workspaceName: string | null;
  installUrl: string | null;
  unavailableReason: string | null;
  pendingAdminApproval: boolean;
  needsManifestUpdate: boolean;
  reinstallUrl: string | null;
  approvalDenied: boolean;
  appUnreachable: boolean;
  removedInSlack: boolean;
  approvalRequestUnsent: boolean;
}
export interface TeamsInstalledTeam {
  teamId: string;
  displayName: string;
  rscGranted: boolean;
  installedAtMs: string | null;
}
export interface TeamsConnection {
  agentId: string;
  installState: string;
  tenantId: string | null;
  tenantDisplayName: string | null;
  installedTeamCount: number;
  installedTeams: TeamsInstalledTeam[];
}
export interface BotSession {
  agentId: string;
  sessionId: string;
  kind: string;
  createdAtMs: string | null;
  updatedAtMs: string | null;
  lastActivityAtMs: string | null;
}
export interface TranscriptEntry {
  seq: string;
  updatedSeq: string;
  entryId: string | null;
  entryKind: string;
  bodyOmitted: boolean;
  blobHash: string | null;
  body: Record<string, unknown> | null;
}
export interface UnreadAnchor {
  hasNewerRows: boolean;
  entryId: string;
  seq: string | null;
  newerRows: number;
}
export interface AgentLiveState {
  agentId: string;
  sessionId: string;
  isRunning: boolean;
  isComposingMessage: boolean;
  isRetrying: boolean;
  updatedAtMs: string | null;
  staleAfterMs: string | null;
  hasRunningSubagents: boolean;
  surfaceTaskId: string;
  workingTaskIds: string[];
  activityKind: string;
}
export interface AgentClientState {
  agentId: string;
  lastViewedAtMs: string | null;
  unreadCount: number;
  lastActivityAtMs: string | null;
  lastEntryId: string;
  lastEntryKind: string;
  lastMessageId: string;
  lastMessagePreview: string;
  notificationsEnabled: boolean;
  notifyOnUpdatesEnabled: boolean;
  hiddenFromSidebar: boolean;
  updatedAtMs: string | null;
  lastMessageTaskId: string;
  removedFromSidebar: boolean;
  unreadThreadCount: number;
}
export interface AgentStatus {
  agentId: string;
  isRunning: boolean;
  live: AgentLiveState | null;
  client: AgentClientState | null;
}
export interface AgentTask {
  id: string;
  name: string;
  description: string;
  status: string;
  updatedAtMs: string | null;
  unreadEntryId: string | null;
  unreadPreview: string | null;
  unreadAtMs: string | null;
  pinnedAtMs: string | null;
  subagentIds: string[];
  followed: boolean;
}
export interface BotTask {
  id: string;
  title: string;
  state: string;
  note: string;
  createdAtMs: string | null;
  doneAtMs: string | null;
  seenDoneAtMs: string | null;
}
export interface RunningSubagent {
  subagentId: string;
  subagentType: string;
  title: string;
  startedAtMs: string | null;
  freshUntilMs: string | null;
}
export interface AgentTodo {
  id: string;
  content: string;
  status: string;
  createdAtMs: string | null;
  updatedAtMs: string | null;
  dependencies: string[];
}
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  source: string;
}
export interface PluginSkill {
  name: string;
  description: string;
  sourcePath: string;
  sourceUrl: string | null;
  content: string;
  environments: string[];
}
export interface AgentMarketplace {
  marketplaceId: string;
  displayName: string;
  description: string;
}
export interface AgentPlugin {
  pluginId: string;
  name: string;
  displayName: string;
  description: string;
  logoUrl: string | null;
  ownedByMarketplace: boolean;
  installMode: string;
  variableNames: string[];
  isDeprecated: boolean;
  mcpConfigJson: string | null;
  skills: PluginSkill[];
  mcpServerNames: string[];
  isBotSkills: boolean;
  connectorType: string;
  variablesJson: string | null;
  hasConfiguredVariables: boolean;
  credentialSource: string;
  delegatedCredential: DelegatedCredential | null;
  credentialAllowedActions: string[];
  supportsServiceAccount: boolean;
}
export interface DelegatedCredential {
  delegatorDisplayName: string;
  delegatorAvatarUrl: string | null;
  delegatorIsViewer: boolean;
  state: string;
  /** RFC 3339 timestamp from `google.protobuf.Timestamp`, or null. */
  attachedAt: string | null;
}
export interface CustomMcpHttp {
  url: string;
  headerNames: string[];
  hasOauthClientId: boolean;
  hasOauthClientSecret: boolean;
}
export interface CustomMcpStdio {
  command: string;
  args: string[];
  hasEnv: boolean;
}
export interface CustomMcpServer {
  pluginId: string;
  name: string;
  http: CustomMcpHttp | null;
  stdio: CustomMcpStdio | null;
}
export interface AgentAccessInvite {
  email: string;
  expiresAtMs: string | null;
  lastSharedAtMs: string | null;
  createdAtMs: string | null;
}
export interface InviteCapUsage {
  used: number;
  limit: number;
}
export interface AccessInviteBot {
  agentId: string;
  name: string;
  avatarUrl: string | null;
  avatarShape: string;
  avatarColor: string;
}
export interface AccessInviteSender {
  displayName: string;
  avatarUrl: string | null;
}
export interface AccessInvitePreviewItem {
  inviteId: string;
  bot: AccessInviteBot | null;
  role: string;
  state: string;
  expiresAtMs: string | null;
}
export interface AccessInviteEligibility {
  eligible: boolean;
  reason: string;
  currentTier: string;
}
export interface AccessInvitePreview {
  found: boolean;
  recipientMatch: string;
  sender: AccessInviteSender | null;
  invites: AccessInvitePreviewItem[];
  truncated: boolean;
  otherResourceInviteCount: number;
  eligibility: AccessInviteEligibility | null;
}
export interface SkillWriteResult {
  marketplace: AgentMarketplace;
  plugins: AgentPlugin[];
  skill: PluginSkill;
}
export interface CreateRoomOptions {
  name: string;
  memberAgentIds: string[];
  description?: string;
  humanMemberUserIds?: number[];
  agentId?: string;
}
export type HarnessKind = 'UNSPECIFIED' | 'BOX' | 'TEMPORAL' | 0 | 1 | 2;
export type CreateIntent = 'UNSPECIFIED' | 'FRESH' | 'REGISTER_EXISTING_LOCAL' | 0 | 1 | 2;
export type CreateCaller = 'UNSPECIFIED' | 'ROOM_MEMBERS' | 'ENSURE_SERVER_BACKED' | 'MINT' | 'BACKFILL' | 'PRODUCT_CREATE' | 0 | 1 | 2 | 3 | 4 | 5;
export interface CreateBotOptions {
  name: string;
  description?: string;
  title?: string;
  avatarShape?: string;
  avatarColor?: string;
  avatarDataUrl?: string;
  agentId?: string;
  harness?: HarnessKind;
  kickstartRequested?: boolean;
  introductionSuppressed?: boolean;
  purpose?: string;
  origin?: string;
  language?: string;
  createIntent?: CreateIntent;
  createCaller?: CreateCaller;
  createdAutomatically?: boolean;
  legacyAgentId?: string;
}
export interface UpdateBotOptions {
  /** `Bot.serverId` (`GrokBotAgent.id`), not `Bot.id`. */
  id: string;
  name?: string;
  description?: string;
  title?: string;
  avatarShape?: string;
  avatarColor?: string;
  avatarDataUrl?: string;
  clearAvatar?: boolean;
}
export interface RuntimeCapabilities {
  durableIdentityEnabled: boolean;
  durableIdentityWritesEnabled: boolean;
  temporalCreationEnabled: boolean;
  agentMessagingEnabled: boolean;
  serverRoomsEnabled: boolean;
}
export interface SandBoxImageInfo {
  registryTag: string | null;
  staticSnapshotPath: string | null;
}
export interface SandBoxRunState {
  runState: string;
  imageUpdateAvailable: boolean;
  egressTunnelOwnership: boolean;
  image: SandBoxImageInfo | null;
}
export interface BoxState {
  runState: string;
  recreateInFlight: boolean;
  imageUpdateAvailable: boolean;
  hostVersion: string | null;
  hostUpdateAvailable: boolean;
  diskPressure: string;
  updatedAtMs: string | null;
  imageTag: string | null;
  staticSnapshotPath: string | null;
  imageGitSha: string | null;
  staticSnapshotMatchesPin: boolean;
  staticSnapshotPin: string | null;
}
export interface ComputerAction {
  agentId: string;
  type: string;
  x: number | null;
  y: number | null;
  button: string;
  count: number;
  atMs: string | null;
}
export interface BotCursor { generation: number; afterUpdatedSeq: string; }
export interface WatchOptions {
  botId: string;
  sessionId?: string;
  cursor?: BotCursor;
  resumeFrom?: string;
  signal?: AbortSignal;
  inlineBodyMaxBytes?: number;
}
export interface TranscriptEventData {
  botId: string;
  sessionId: string;
  generation: number;
  seq: string;
  updatedSeq: string;
  entryId: string | null;
  replay: boolean;
}
export type BotEvent =
  | { type: 'connected'; data: { serverTimeMs: string; absoluteLifetimeMs: string } }
  | { type: 'heartbeat'; data: { serverTimeMs: string } }
  | { type: 'message'; id: string; data: TranscriptEventData & { operation: 'upsert'; text: string } }
  | { type: 'entry'; id: string; data: TranscriptEventData & { entryKind: string; entry: Record<string, unknown> } }
  | { type: 'entry.unavailable'; id: string; data: TranscriptEventData & { entryKind: string; bodyOmitted: boolean; blobHash: string | null } }
  | { type: 'message.deleted'; id: string; data: TranscriptEventData }
  | { type: 'reset'; id: string; data: { botId: string; generation: number } }
  | { type: 'resync-required'; data: { botId: string; generation: number } }
  | { type: 'turn.failed'; data: { botId: string; turnId: string; code: number | string; summary: string } }
  | { type: 'bot.state.changed'; data: { botId: string; families: string[]; changedAtMs: string | null } }
  | { type: 'bot.updated'; data: { botId: string; changedFields: Array<string | number>; bot: Bot | null } }
  | { type: 'agent.state'; data: { botId: string; sessionId: string; snapshot: boolean; live: AgentLiveState[]; client: AgentClientState[] } }
  | { type: 'computer.actions'; data: { botId: string; actions: ComputerAction[] } }
  | { type: 'box.state'; data: { botId: string; snapshot: boolean; state: BoxState | null } }
  | { type: 'page.title.changed'; data: { botId: string; storeId: string; canvasId: string | null; documentId: string | null; title: string; changedAtMs: string | null; contentChanged: boolean } };
export interface SendOptions {
  botId: string;
  text: string;
  sessionId?: string;
  messageId?: string;
  attachmentPaths?: string[];
  attachmentNames?: string[];
  replyToId?: string;
  replyQuote?: string;
  taskId?: string;
  language?: string;
  richText?: string;
  machineId?: string;
  /** Sent only when `true`. `false` is omitted, matching the 0.78.1 desktop client. */
  rendersMcpElicitationForms?: boolean;
}
export interface TranscriptQuery {
  botId: string;
  sessionId?: string;
  limit?: number;
  generation?: number;
  beforeSeq?: string;
  unreadBoundaryMs?: string;
}
export class SDKError extends Error {
  code: string;
  httpStatus?: number;
  constructor(code: string, httpStatus?: number);
}
export function normalizeBot(agent: CloudAvatarRecord): Bot;
export class GrokBotClient {
  constructor(options: ClientOptions);
  getMe(): Promise<Record<string, unknown>>;
  listBots(options?: { includeTeamAgents?: boolean; role?: string; addedTeamAgentsOnly?: boolean }): Promise<{ bots: Bot[]; truncated: boolean; slackConnections: SlackConnection[]; teamsConnections: TeamsConnection[] }>;
  sendMessage(options: SendOptions): Promise<{ botId: string; messageId: string; delivery: 'accepted-box' | 'accepted-temporal' | 'duplicate'; dispatched: boolean }>;
  listSessions(botId: string): Promise<{ sessions: BotSession[] }>;
  listTranscript(options: TranscriptQuery): Promise<{ generation: number; entries: TranscriptEntry[]; cloudAgentPeerIds: string[]; cloudAgentPeerIdsKnown: boolean; unreadAnchor: UnreadAnchor | null; updatedSeqLocked: boolean }>;
  listAgentStatuses(agentIds?: string[]): Promise<{ statuses: AgentStatus[] }>;
  getSendStatus(options: { botId: string; messageId: string; sessionId?: string; firstSentAgeMs?: string; taskId?: string }): Promise<{ status: string; echoEntryId: string | null; rejectionCode: string | null; acceptedAtMs: string | null }>;
  listAgentTasks(options: { botId: string; includeRecentlyDone?: boolean }): Promise<{ tasks: AgentTask[] }>;
  listTasks(options: { botId: string; sessionId?: string }): Promise<{ tasks: BotTask[] }>;
  listSubagents(botId: string): Promise<{ subagents: RunningSubagent[] }>;
  listAgentTodos(botId: string): Promise<{ todos: AgentTodo[] }>;
  listAgentSkills(botId: string): Promise<{ skills: AgentSkill[] }>;
  listDeletedAgentIds(agentIds?: string[]): Promise<{ agentIds: string[] }>;
  getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
  getSandBoxRunState(): Promise<SandBoxRunState>;
  /** Reads one custom MCP server. `pluginId` is the int64 plugin id, sent as a decimal string. */
  getAgentCustomMcp(options: { botId: string; pluginId: string | number }): Promise<{ server: CustomMcpServer }>;
  listAgentAccessInvites(botId: string): Promise<{ invites: AgentAccessInvite[]; capUsage: InviteCapUsage }>;
  previewAgentAccessInvite(code: string): Promise<AccessInvitePreview>;
  /** Irreversible. Deletes the bot or room with this agent id (`Bot.id`). */
  deleteBot(botId: string): Promise<{ id: string }>;
  /** Irreversible. Deletes a room only after the roster shows this id with kind ROOM. */
  deleteRoom(roomId: string): Promise<{ id: string }>;
  createRoom(options: CreateRoomOptions): Promise<{ bot: Bot }>;
  addRoomMembers(options: { roomId: string; userIds: number[] }): Promise<{ bot: Bot }>;
  /** Irreversible. Removes human members. No agent in the response returns `{ bot: null }`. */
  removeRoomMembers(options: { roomId: string; userIds: number[] }): Promise<{ bot: Bot | null }>;
  /** Irreversible. Replaces the room's bot members, including with an empty list. */
  setRoomMembers(options: { roomId: string; memberAgentIds: string[] }): Promise<{ bot: Bot }>;
  createBot(options: CreateBotOptions): Promise<{ bot: Bot; harness: string }>;
  /** Updates name, description, title, or avatar. `id` is `Bot.serverId`. `partialUpdate` is always true. */
  updateBot(options: UpdateBotOptions): Promise<{ bot: Bot }>;
  addAgentSkill(options: { botId: string; content: string; name?: string; description?: string }): Promise<SkillWriteResult>;
  updateAgentSkill(options: { botId: string; name: string; content: string; description?: string }): Promise<SkillWriteResult>;
  /** Irreversible. Removes one skill by name. */
  removeAgentSkill(options: { botId: string; name: string }): Promise<Omit<SkillWriteResult, 'skill'>>;
  watchBot(options: WatchOptions): AsyncGenerator<BotEvent, void, unknown>;
  botEventsSSE(options: WatchOptions & { keepAliveMs?: number }): Response;
}
export interface LoginFlow { uuid: string; verifier: string; loginUrl: string; }
export function createLogin(): LoginFlow;
export function pollLogin(flow: LoginFlow, options?: { fetchImpl?: typeof fetch; sleep?: (milliseconds: number) => Promise<unknown>; maxAttempts?: number; onPending?: (attempt: number) => void }): Promise<{ accessToken: string; refreshToken: string; selectedTeamId?: number; [key: string]: unknown }>;
