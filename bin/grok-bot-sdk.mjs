#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createLogin, pollLogin } from '../core.mjs';
import { GrokBotClient } from '../sdk.mjs';

const args = process.argv.slice(2);
const command = args[0];
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const failed = code => {
  console.log(JSON.stringify({ status: 'failed', code }));
  process.exitCode = 1;
};

function usage() {
  console.log(`grok-bot-sdk login [--no-open] --out <file>
grok-bot-sdk whoami [--token-file <file>]

login opens the browser, waits for approval, and writes the session to <file> (mode 0600).
The command prints the login page URL and a redacted summary. It does not print tokens.
whoami reads GROK_BOT_ACCESS_TOKEN, or the accessToken field inside --token-file, and prints only whether account fields exist.`);
  process.exitCode = 2;
}

async function login() {
  const out = option('--out');
  if (!out || out.startsWith('-')) {
    usage();
    return;
  }
  const flow = createLogin();
  console.log(JSON.stringify({ phase: 'browser-login', loginUrl: flow.loginUrl }));
  if (!args.includes('--no-open') && process.platform === 'darwin') {
    execFileSync('/usr/bin/open', [flow.loginUrl], { stdio: 'ignore' });
  }
  const session = await pollLogin(flow, {
    onPending: attempt => {
      if (attempt === 1 || attempt % 6 === 0) console.log(JSON.stringify({ phase: 'awaiting-browser-authorization', attempt }));
    },
  });
  const path = resolve(out);
  await mkdir(dirname(path), { recursive: true });
  const body = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    ...session.selectedTeamId !== undefined ? { selectedTeamId: session.selectedTeamId } : {},
  };
  await writeFile(path, JSON.stringify(body, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({
    phase: 'saved',
    path,
    accessTokenPresent: true,
    refreshTokenPresent: true,
    selectedTeamIdPresent: session.selectedTeamId !== undefined,
    persistedBySdk: false,
    refreshImplemented: false,
  }));
}

async function loadToken() {
  const file = option('--token-file');
  if (file) {
    const parsed = JSON.parse(await readFile(resolve(file), 'utf8'));
    if (typeof parsed?.accessToken !== 'string' || !parsed.accessToken) throw new Error('TOKEN_FILE_INVALID');
    return { accessToken: parsed.accessToken, teamId: parsed.selectedTeamId, version: parsed.version };
  }
  const accessToken = process.env.GROK_BOT_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MISSING_ACCESS_TOKEN');
  return { accessToken, version: process.env.GROK_BOT_CLIENT_VERSION };
}

async function whoami() {
  const loaded = await loadToken();
  const client = new GrokBotClient({
    accessToken: loaded.accessToken,
    ...loaded.version ? { version: loaded.version } : {},
    ...loaded.teamId !== undefined ? { teamId: loaded.teamId } : {},
  });
  const me = await client.getMe();
  console.log(JSON.stringify({
    status: 'ok',
    identityPresent: Boolean(me.authId || me.userId),
    emailPresent: Boolean(me.email),
    teamPresent: me.teamId !== undefined && me.teamId !== null,
  }));
}

try {
  if (command === 'login') await login();
  else if (command === 'whoami') await whoami();
  else usage();
} catch (error) {
  const code = error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message) ? error.message : 'COMMAND_FAILED';
  failed(code);
}
