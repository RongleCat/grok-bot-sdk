import { randomBytes, randomUUID, createHash, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const API_ORIGIN = 'https://api2.cursor.sh';
const fixedError = code => new Error(code);

export function createLogin() {
  const verifier = randomBytes(32).toString('base64url');
  const uuid = randomUUID();
  const url = new URL('/loginDeepControl', 'https://cursor.com');
  url.search = new URLSearchParams({challenge:createHash('sha256').update(verifier).digest('base64url'),uuid,mode:'login',redirectTarget:'sand',supportsSelectedTeamLogin:'true'}).toString();
  return {uuid,verifier,loginUrl:url.toString()};
}

export function decryptMacSecret(value, password) {
  try {
    const bytes = Buffer.from(value,'base64');
    if (bytes.subarray(0,3).toString() !== 'v10' || bytes.length < 19) throw fixedError('FORMAT');
    const key=pbkdf2Sync(password,'saltysalt',1003,16,'sha1');
    try {
      const decipher=createDecipheriv('aes-128-cbc',key,Buffer.alloc(16,32));
      return Buffer.concat([decipher.update(bytes.subarray(3)),decipher.final()]).toString('utf8');
    } finally {key.fill(0);}
  } catch {throw fixedError('CREDENTIAL_DECRYPT_FAILED');}
}

export function selectDesktopAccount(doc) {
  let record;
  try {record=JSON.parse(doc['cursor-accounts']);} catch {throw fixedError('ACCOUNT_STORE_INVALID');}
  if (typeof record.active !== 'string' || !record.accounts?.[record.active]) throw fixedError('NO_ACTIVE_ACCOUNT');
  const active=record.accounts[record.active];
  if (typeof active['cursor-access-token'] !== 'string') throw fixedError('ACCESS_TOKEN_MISSING');
  return {encryptedAccessToken:active['cursor-access-token'],encryptedTeamId:active['cursor-selected-team-id'],storedMachineId:doc['cursor-machine-id']};
}

export function validateOrigin(value, kind) {
  try {
    const u=new URL(value);
    const allowed=kind==='cursor' ? u.origin===API_ORIGIN : u.hostname.endsWith('.cursorvm.com');
    if (!allowed || u.protocol!=='https:' || u.username || u.password || u.search || u.hash || (u.port && u.port!=='443')) throw fixedError('ORIGIN');
    if (kind==='cursor' && u.pathname!=='/') throw fixedError('PATH');
    return u.toString().replace(/\/$/,'');
  } catch {throw fixedError('UNTRUSTED_ORIGIN');}
}

function checksum(machineId) {
  const t=Math.floor(Date.now()/1e6);
  const bytes=Uint8Array.from([t>>40&255,t>>32&255,t>>24&255,t>>16&255,t>>8&255,t&255]);
  let previous=165;
  for(let i=0;i<bytes.length;i++){bytes[i]=(bytes[i]^previous)+i%256;previous=bytes[i];}
  return Buffer.from(bytes).toString('base64url')+machineId;
}

export function clientHeaders({accessToken,version,machineId,teamId}) {
  const headers={
    'content-type':'application/json','connect-protocol-version':'1',
    'authorization':`Bearer ${accessToken}`,'x-cursor-client-type':'sand',
    'x-cursor-client-version':version,'x-cursor-client-source':'sand-desktop',
    'x-cursor-client-os':'darwin','x-sand-box-namespace':'prod','x-ghost-mode':'true',
    'x-request-id':randomUUID(),
    'user-agent':`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Sand/${version} Safari/537.36`,
  };
  if(machineId)headers['x-cursor-checksum']=checksum(machineId);
  if(teamId!==undefined)headers['x-cursor-team-id']=String(teamId);
  return headers;
}

export async function requestJSON(url,{method='POST',headers={},body,fetchImpl=fetch,timeoutMs=20000,signal}={}) {
  try {
    const timeout=AbortSignal.timeout(timeoutMs);
    const response=await fetchImpl(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:signal?AbortSignal.any([signal,timeout]):timeout});
    const text=await response.text();
    if(Buffer.byteLength(text)>8*1024*1024) return {ok:false,httpStatus:response.status,code:'RESPONSE_TOO_LARGE'};
    let data;
    try {data=JSON.parse(text);} catch {return {ok:false,httpStatus:response.status,code:'NON_JSON_RESPONSE'};}
    if(!response.ok) return {ok:false,httpStatus:response.status,code:typeof data?.code==='string' && /^[a-z_]{1,48}$/.test(data.code)?data.code:'HTTP_ERROR'};
    return {ok:true,httpStatus:response.status,data};
  } catch {return {ok:false,code:'NETWORK_OR_TLS_ERROR'};}
}

export async function verify(options) {
  const report={mode:options.mode??'desktop-existing-session',clientVersion:options.version,steps:[]};
  const headers=clientHeaders(options);
  const rpc=async(method,body)=>requestJSON(API_ORIGIN+'/'+method,{headers,body,fetchImpl:options.fetchImpl});
  const checked=(result,predicate)=>result.ok&&!predicate(result.data)?{ok:false,httpStatus:result.httpStatus,code:'INVALID_RESPONSE'}:result;
  const record=(name,result,extra={})=>report.steps.push({name,status:result.ok?'passed':'failed',httpStatus:result.httpStatus,...result.code?{code:result.code}:{},...extra});
  const me=checked(await rpc('aiserver.v1.DashboardService/GetMe',{}),data=>!!(data?.authId||data?.userId));
  record('account.GetMe',me,{...me.ok?{identityPresent:!!(me.data.authId||me.data.userId),emailPresent:!!me.data.email}:{}});
  if(!me.ok)return report;
  if(options.cloudRoster){
    const roster=checked(await rpc('aiserver.v1.GrokBotService/ListGrokBotAgents',{includeTeamAgents:true}),data=>Array.isArray(data?.agents)&&data.agents.every(x=>x&&typeof x==='object'));
    record('cloud.ListGrokBotAgents',roster,{...roster.ok?{agentsArrayPresent:Array.isArray(roster.data.agents)}:{}});
    if(roster.ok&&Array.isArray(roster.data.agents)){
      report.cloudBotCount=roster.data.agents.length;
      report.cloudRoster={truncated:roster.data.truncated===true,avatarMetadataCount:roster.data.agents.filter(x=>!!(x.avatarShape||x.avatarColor||x.avatarDataUrl)).length,harnessCounts:roster.data.agents.reduce((counts,x)=>{const harness=typeof x.harness==='string'&&/^[a-z_]{1,30}$/.test(x.harness)?x.harness:'other';counts[harness]=(counts[harness]??0)+1;return counts;},{})};
    }
    if(options.cloudOnly)return report;
  }
  const box=checked(await rpc('aiserver.v1.GrokBotService/EnsureSandBox',{wake:false,supportsAsleepBox:true}),data=>data&&typeof data==='object'&&!Array.isArray(data)&&data.runState!==undefined);
  record('broker.EnsureSandBox(no-wake)',box);
  if(!box.ok)return report;
  const {gatewayUrl,gatewayToken,networkToken,runState}=box.data;
  report.connection={gatewayURLPresent:!!gatewayUrl,gatewayTokenPresent:!!gatewayToken,networkTokenPresent:!!networkToken,runState:typeof runState==='string'&&/^[A-Z_]{1,80}$/.test(runState)?runState:typeof runState==='number'?runState:'unknown'};
  if(!gatewayUrl || !gatewayToken){report.steps.push({name:'gateway',status:'host_not_running'});return report;}
  let base;
  try{base=validateOrigin(gatewayUrl,'gateway');}catch{report.steps.push({name:'gateway',status:'failed',code:'UNTRUSTED_ORIGIN'});return report;}
  const gatewayHeaders={'authorization':`Bearer ${gatewayToken}`,'content-type':'application/json'};
  if(networkToken)gatewayHeaders['x-anyrun-network-token']=networkToken;
  const health=checked(await requestJSON(base+'/health',{method:'GET',headers:gatewayHeaders,fetchImpl:options.fetchImpl}),data=>data?.ok===true);
  record('gateway.health',health,{...health.ok?{reportedOK:health.data.ok===true}:{}});
  if(!health.ok)return report;
  const roster=checked(await requestJSON(base+'/api/listAgents',{headers:gatewayHeaders,body:{},fetchImpl:options.fetchImpl}),data=>Array.isArray(data)&&data.every(x=>x&&typeof x==='object'));
  record('gateway.listAgents',roster,{...roster.ok?{arrayResponse:Array.isArray(roster.data)}:{}});
  if(roster.ok&&Array.isArray(roster.data)){
    report.botCount=roster.data.length;
    report.rosterMetadata={hiddenCount:roster.data.filter(x=>x.isHiddenFromSidebar===true).length,groupCount:roster.data.filter(x=>x.isGroup===true).length,avatarCount:roster.data.filter(x=>!!(x.avatarDataUrl||x.avatarVersion||x.avatarShape)).length};
  }
  return report;
}

export async function pollLogin(flow,{fetchImpl=fetch,sleep=delay,maxAttempts=150,onPending=()=>{}}={}) {
  const url=new URL('/auth/poll',API_ORIGIN);
  url.search=new URLSearchParams({uuid:flow.uuid,verifier:flow.verifier}).toString();
  let errors=0;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const result=await requestJSON(url,{method:'GET',headers:{'content-type':'application/json'},fetchImpl});
    if(result.ok && typeof result.data.accessToken==='string' && typeof result.data.refreshToken==='string')return result.data;
    if(result.httpStatus===404){errors=0;onPending(attempt+1);}
    else if(++errors>=3)throw fixedError('LOGIN_POLL_FAILED');
    await sleep(Math.min(1000*1.2**attempt,10000));
  }
  throw fixedError('LOGIN_TIMED_OUT');
}
