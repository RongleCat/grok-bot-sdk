import type { ClientOptions } from './sdk.mjs';
export function version(): string;
export function desktopCredentials(): Promise<ClientOptions & {version: string}>;
