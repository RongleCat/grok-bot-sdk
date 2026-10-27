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
grok-bot-sdk bots [--token-file <file>]
grok-bot-sdk sessions --bot <id> [--token-file <file>]
grok-bot-sdk transcript --bot <id> [--session <id>] [--limit <n>] [--token-file <file>]
grok-bot-sdk tasks --bot <id> [--session <id>] [--token-file <file>]
grok-bot-sdk capabilities [--token-file <file>]
grok-bot-sdk box [--token-file <file>]

login opens the browser, waits for approval, and writes the session to <file> (mode 0600).
The command prints the login page URL and a redacted summary. It does not print tokens.
whoami reads GROK_BOT_ACCESS_TOKEN, or the accessToken field inside --token-file, and prints only whether account fields exist.
The other commands are read-only. They print roster, session, transcript, task, capability, or box fields for the saved token.`);
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

async function clientFromToken() {
  const loaded = await loadToken();
  return new GrokBotClient({
    accessToken: loaded.accessToken,
    ...loaded.version ? { version: loaded.version } : {},
    ...loaded.teamId !== undefined ? { teamId: loaded.teamId } : {},
  });
}

async function whoami() {
  const client = await clientFromToken();
  const me = await client.getMe();
  console.log(JSON.stringify({
    status: 'ok',
    identityPresent: Boolean(me.authId || me.userId),
    emailPresent: Boolean(me.email),
    teamPresent: me.teamId !== undefined && me.teamId !== null,
  }));
}

function requireBot() {
  const bot = option('--bot');
  if (!bot || bot.startsWith('-')) {
    usage();
    return undefined;
  }
  return bot;
}

async function bots() {
  const roster = await (await clientFromToken()).listBots();
  console.log(JSON.stringify({
    status: 'ok',
    count: roster.bots.length,
    truncated: roster.truncated,
    slackConnectionCount: roster.slackConnections.length,
    teamsConnectionCount: roster.teamsConnections.length,
    bots: roster.bots.map(bot => ({
      id: bot.id,
      name: bot.name,
      kind: bot.kind,
      role: bot.role,
      sessionId: bot.sessionId,
    })),
  }));
}

async function sessions() {
  const bot = requireBot();
  if (!bot) return;
  const result = await (await clientFromToken()).listSessions(bot);
  console.log(JSON.stringify({ status: 'ok', count: result.sessions.length, sessions: result.sessions }));
}

async function transcript() {
  const bot = requireBot();
  if (!bot) return;
  const limitText = option('--limit');
  const limit = limitText === undefined ? 20 : Number(limitText);
  const result = await (await clientFromToken()).listTranscript({
    botId: bot,
    sessionId: option('--session') ?? '',
    limit,
  });
  console.log(JSON.stringify({
    status: 'ok',
    generation: result.generation,
    count: result.entries.length,
    cloudAgentPeerIdsKnown: result.cloudAgentPeerIdsKnown,
    peerCount: result.cloudAgentPeerIds.length,
    unreadAnchor: result.unreadAnchor,
    entries: result.entries.map(entry => ({
      seq: entry.seq,
      updatedSeq: entry.updatedSeq,
      entryId: entry.entryId,
      entryKind: entry.entryKind,
      bodyOmitted: entry.bodyOmitted,
      bodyKind: typeof entry.body?.kind === 'string' ? entry.body.kind : null,
    })),
  }));
}

async function tasks() {
  const bot = requireBot();
  if (!bot) return;
  const client = await clientFromToken();
  const sessionId = option('--session') ?? '';
  const [agentTasks, taskList] = await Promise.all([
    client.listAgentTasks({ botId: bot }),
    client.listTasks({ botId: bot, sessionId }),
  ]);
  console.log(JSON.stringify({
    status: 'ok',
    agentTaskCount: agentTasks.tasks.length,
    taskCount: taskList.tasks.length,
    agentTasks: agentTasks.tasks,
    tasks: taskList.tasks,
  }));
}

async function capabilities() {
  const result = await (await clientFromToken()).getRuntimeCapabilities();
  console.log(JSON.stringify({ status: 'ok', ...result }));
}

async function box() {
  const result = await (await clientFromToken()).getSandBoxRunState();
  console.log(JSON.stringify({ status: 'ok', ...result }));
}

try {
  if (command === 'login') await login();
  else if (command === 'whoami') await whoami();
  else if (command === 'bots') await bots();
  else if (command === 'sessions') await sessions();
  else if (command === 'transcript') await transcript();
  else if (command === 'tasks') await tasks();
  else if (command === 'capabilities') await capabilities();
  else if (command === 'box') await box();
  else usage();
} catch (error) {
  const code = error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message) ? error.message : 'COMMAND_FAILED';
  failed(code);
}
