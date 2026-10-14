export type AvatarSource = 'explicit' | 'id-default';
export interface CharacterAvatar {
  shape: string;
  color: string;
  baseHex: string;
  lightHex: string;
  darkHex: string;
}
export interface ResolvedAvatar {
  algorithmVersion: string;
  kind: 'character' | 'picture';
  character: CharacterAvatar;
  sources: { shape: AvatarSource; color: AvatarSource };
  picture: { url: string | null; version: string | null } | null;
}
export interface CloudAvatarRecord {
  agentId: string;
  avatarShape?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  avatarDataUrl?: string | null;
  avatarVersion?: string | null;
  [key: string]: unknown;
}
export const AVATAR_ALGORITHM_VERSION: string;
export const DEFAULT_SHAPES: readonly string[];
export const VALID_SHAPES: readonly string[];
export const DEFAULT_COLORS: readonly string[];
export function hashBotId(key: string): number;
export function deriveDefaultAvatar(key: string): CharacterAvatar & {
  algorithmVersion: string;
  hash: number;
  shapeHash: number;
  shapeIndex: number;
  colorIndex: number;
};
export function resolveAgentAvatar(agent: CloudAvatarRecord): ResolvedAvatar;
