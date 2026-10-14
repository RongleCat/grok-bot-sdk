import { readFile } from 'node:fs/promises';
import { GrokBotClient } from '../sdk.mjs';

const file = process.argv[2];
const saved = file ? JSON.parse(await readFile(file, 'utf8')) : {};
const accessToken = saved.accessToken || process.env.GROK_BOT_ACCESS_TOKEN;
if (!accessToken) {
  console.error('Pass a credentials file from `grok-bot-sdk login --out`, or set GROK_BOT_ACCESS_TOKEN.');
  process.exit(2);
}

const client = new GrokBotClient({
  accessToken,
  ...saved.selectedTeamId !== undefined ? { teamId: saved.selectedTeamId } : {},
});
const { bots, truncated } = await client.listBots();
console.log(JSON.stringify({
  count: bots.length,
  truncated,
  bots: bots.map(bot => ({
    id: bot.id,
    name: bot.name,
    sessionId: bot.sessionId,
    avatarShape: bot.avatarShape,
    avatarColor: bot.avatarColor,
    avatarKind: bot.avatar.kind,
    avatarSources: bot.avatar.sources,
  })),
}, null, 2));
