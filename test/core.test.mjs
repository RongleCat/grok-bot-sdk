import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createCipheriv, pbkdf2Sync } from 'node:crypto';
let core = {};
try { core = await import('../core.mjs'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const feature = name => assert.equal(typeof core[name], 'function', `${name} must exist`);

test('PKCE login contains challenge, never verifier, and uses the client redirect target', () => {
  feature('createLogin');
  const flow = core.createLogin();
  const url = new URL(flow.loginUrl);
  assert.equal(url.origin, 'https://cursor.com');
  assert.equal(url.pathname, '/loginDeepControl');
  assert.equal(url.searchParams.get('redirectTarget'), 'sand');
  assert.equal(url.searchParams.get('challenge'), createHash('sha256').update(flow.verifier).digest('base64url'));
  assert.ok(!flow.loginUrl.includes(flow.verifier));
});

test('decrypts a macOS v10 fixture and rejects unknown formats with a fixed error', () => {
  feature('decryptMacSecret');
  const password = 'fixture-keychain-password';
  const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16, 32));
  const bytes = Buffer.concat([Buffer.from('v10'), cipher.update('fixture-access-token'), cipher.final()]);
  assert.equal(core.decryptMacSecret(bytes.toString('base64'), password), 'fixture-access-token');
  assert.throws(() => core.decryptMacSecret('fixture-invalid-secret', password), /CREDENTIAL_DECRYPT_FAILED/);
});

test('uses the active account, never an arbitrary other saved account', () => {
  feature('selectDesktopAccount');
  const doc = { 'cursor-machine-id': 'fixture-machine', 'cursor-accounts': JSON.stringify({ active: 'active', accounts: { other: {'cursor-access-token':'other'}, active: {'cursor-access-token':'wanted'} } }) };
  assert.equal(core.selectDesktopAccount(doc).encryptedAccessToken, 'wanted');
  assert.throws(() => core.selectDesktopAccount({...doc, 'cursor-accounts': JSON.stringify({active:null,accounts:{other:{}}})}), /NO_ACTIVE_ACCOUNT/);
});

test('rejects credential destinations outside the client API and hosted computer domains', () => {
  feature('validateOrigin');
  assert.equal(core.validateOrigin('https://api2.cursor.sh', 'cursor'), 'https://api2.cursor.sh');
  assert.equal(core.validateOrigin('https://box.region.cursorvm.com/', 'gateway'), 'https://box.region.cursorvm.com');
  for (const url of ['https://api2.cursor.sh.evil.example', 'https://user:password@api2.cursor.sh', 'http://box.region.cursorvm.com', 'https://box.region.cursorvm.com?token=secret']) {
    assert.throws(() => core.validateOrigin(url, url.includes('cursorvm') ? 'gateway' : 'cursor'), /UNTRUSTED_ORIGIN/);
  }
});

test('verification fixes wake=false and uses separate gateway/network credentials without logging content', async () => {
  feature('verify');
  const requests = [];
  const responses = [
    {authId:'private-user', email:'private@example.com', userId:1},
    {gatewayUrl:'https://box.region.cursorvm.com', gatewayToken:'gateway-secret', networkToken:'network-secret', runState:'SAND_BOX_RUN_STATE_RUNNING'},
    {ok:true},
    [{id:'private-bot',name:'Private Bot',lastMessagePreview:'private chat'}],
  ];
  const report = await core.verify({accessToken:'account-secret',version:'0.70.2',machineId:'fixture',fetchImpl:async (url, init) => { requests.push({url, init}); return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'content-type':'application/json'}}); }});
  assert.deepEqual(JSON.parse(requests[1].init.body), {wake:false, supportsAsleepBox:true});
  assert.equal(requests[1].init.redirect, 'error');
  assert.equal(requests[3].init.headers.authorization, 'Bearer gateway-secret');
  assert.equal(requests[3].init.headers['x-anyrun-network-token'], 'network-secret');
  assert.equal(report.botCount, 1);
  const text = JSON.stringify(report);
  for (const secret of ['account-secret','gateway-secret','network-secret','Private Bot','private chat','private@example.com','private-user']) assert.ok(!text.includes(secret));
});

test('stops at denied account authentication and does not attempt Broker', async () => {
  feature('verify');
  let calls=0;
  const report=await core.verify({accessToken:'secret',version:'0.70.2',fetchImpl:async()=>{calls++;return new Response(JSON.stringify({code:'unauthenticated',message:'contains secret'}),{status:401});}});
  assert.equal(calls,1);
  assert.equal(report.steps[0].status,'failed');
  assert.ok(!JSON.stringify(report).includes('contains secret'));
});

test('does not wake an asleep host or claim the roster is verified', async () => {
  feature('verify');
  const responses=[{authId:'fixture'}, {runState:'SAND_BOX_RUN_STATE_HIBERNATED'}];let calls=0;
  const report=await core.verify({accessToken:'secret',version:'0.70.2',fetchImpl:async()=>{calls++;return new Response(JSON.stringify(responses.shift()),{status:200});}});
  assert.equal(calls,2);
  assert.equal(report.steps.at(-1).status,'host_not_running');
  assert.equal(report.botCount,undefined);
});

test('does not treat HTTP 200 with an invalid account or roster body as successful verification', async()=>{
  const invalid=await core.verify({accessToken:'fixture',version:'fixture',fetchImpl:async()=>new Response('{}',{status:200})});
  assert.equal(invalid.steps[0].status,'failed');
  assert.equal(invalid.steps[0].code,'INVALID_RESPONSE');
  const responses=[{authId:'fixture'}, {agents:'wrong'}];
  const report=await core.verify({accessToken:'fixture',version:'fixture',cloudRoster:true,cloudOnly:true,fetchImpl:async()=>new Response(JSON.stringify(responses.shift()),{status:200})});
  assert.equal(report.steps[1].status,'failed');
  assert.equal(report.cloudBotCount,undefined);
});

test('login polling waits on 404 and returns credentials only in memory', async () => {
  feature('pollLogin');
  let calls=0;
  const credentials=await core.pollLogin({uuid:'fixture-uuid',verifier:'fixture-verifier'}, {fetchImpl:async()=> ++calls===1 ? new Response('{}',{status:404}) : new Response(JSON.stringify({accessToken:'new-access',refreshToken:'new-refresh'}),{status:200}),sleep:async()=>{},maxAttempts:2});
  assert.equal(calls,2);assert.equal(credentials.accessToken,'new-access');
});

test('can fetch the cloud roster without connecting to or waking the Bot computer', async()=>{
  feature('verify');
  const calls=[];const responses=[{authId:'private'}, {agents:[{agentId:'a',name:'Private A',avatarShape:'circle'},{agentId:'b',name:'Private B'}],truncated:false}];
  const report=await core.verify({accessToken:'secret',version:'0.70.2',cloudRoster:true,cloudOnly:true,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(responses.shift()),{status:200});}});
  assert.equal(calls.length,2);
  assert.ok(calls[1].url.endsWith('/aiserver.v1.GrokBotService/ListGrokBotAgents'));
  assert.deepEqual(JSON.parse(calls[1].init.body),{includeTeamAgents:true});
  assert.equal(report.cloudBotCount,2);
  assert.equal(report.cloudRoster.truncated,false);
  assert.ok(!JSON.stringify(report).includes('Private A'));
});
