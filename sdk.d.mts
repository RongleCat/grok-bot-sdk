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
  name: string;
  description: string;
  title: string;
  avatarShape: string;
  avatarColor: string;
  avatar: ResolvedAvatar;
  harness: string;
  kind: string;
  sessionId: string;
  teamId: number | null;
  viewerIsOwner: boolean;
  viewerCanManage: boolean;
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
  | { type: 'bot.state.changed'; data: { botId: string; families: string[] } }
  | { type: 'bot.updated'; data: { botId: string; changedFields: Array<string | number>; bot: Bot | null } };
export interface SendOptions {
  botId: string;
  text: string;
  sessionId?: string;
  messageId?: string;
  attachmentPaths?: string[];
  attachmentNames?: string[];
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
  listBots(options?: { includeTeamAgents?: boolean }): Promise<{ bots: Bot[]; truncated: boolean }>;
  sendMessage(options: SendOptions): Promise<{ botId: string; messageId: string; delivery: 'accepted-box' | 'accepted-temporal' | 'duplicate'; dispatched: boolean }>;
  watchBot(options: WatchOptions): AsyncGenerator<BotEvent, void, unknown>;
  botEventsSSE(options: WatchOptions & { keepAliveMs?: number }): Response;
}
export interface LoginFlow { uuid: string; verifier: string; loginUrl: string; }
export function createLogin(): LoginFlow;
export function pollLogin(flow: LoginFlow, options?: { fetchImpl?: typeof fetch; sleep?: (milliseconds: number) => Promise<unknown>; maxAttempts?: number; onPending?: (attempt: number) => void }): Promise<{ accessToken: string; refreshToken: string; selectedTeamId?: number; [key: string]: unknown }>;
