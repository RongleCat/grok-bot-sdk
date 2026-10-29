import {randomUUID} from 'node:crypto';
import {API_ORIGIN,clientHeaders,requestJSON} from './core.mjs';
import {resolveAgentAvatar} from './avatar.mjs';
import {SDKError} from './errors.mjs';
import {encodeConnectFrame,readConnectFrames} from './connect-stream.mjs';
import {eventsToSSE} from './sse.mjs';

export {createLogin,pollLogin} from './core.mjs';
export {deriveDefaultAvatar,resolveAgentAvatar} from './avatar.mjs';
export {SDKError} from './errors.mjs';

const CLIENT_VERSION='0.78.1';
const SEND_STATUS={0:'unspecified',1:'not-found',2:'accepted',3:'rejected',4:'pending',5:'unknown-durability',GROK_BOT_SEND_STATUS_UNSPECIFIED:'unspecified',GROK_BOT_SEND_STATUS_NOT_FOUND:'not-found',GROK_BOT_SEND_STATUS_ACCEPTED:'accepted',GROK_BOT_SEND_STATUS_REJECTED:'rejected',GROK_BOT_SEND_STATUS_PENDING:'pending',GROK_BOT_SEND_STATUS_UNKNOWN_DURABILITY:'unknown-durability'};
const RUN_STATE={0:'unspecified',1:'absent',2:'hibernated',3:'running',4:'starting',SAND_BOX_RUN_STATE_UNSPECIFIED:'unspecified',SAND_BOX_RUN_STATE_ABSENT:'absent',SAND_BOX_RUN_STATE_HIBERNATED:'hibernated',SAND_BOX_RUN_STATE_RUNNING:'running',SAND_BOX_RUN_STATE_STARTING:'starting'};
const ROOM_KIND=new Set(['2','ROOM','GROK_BOT_AGENT_KIND_ROOM']);
const HARNESS_WIRE={0:'UNSPECIFIED',1:'BOX',2:'TEMPORAL',UNSPECIFIED:'UNSPECIFIED',BOX:'BOX',TEMPORAL:'TEMPORAL',GROK_BOT_AGENT_HARNESS_KIND_UNSPECIFIED:'UNSPECIFIED',GROK_BOT_AGENT_HARNESS_KIND_BOX:'BOX',GROK_BOT_AGENT_HARNESS_KIND_TEMPORAL:'TEMPORAL'};
const HARNESS_OUT={0:'unspecified',1:'box',2:'temporal',UNSPECIFIED:'unspecified',BOX:'box',TEMPORAL:'temporal',GROK_BOT_AGENT_HARNESS_KIND_UNSPECIFIED:'unspecified',GROK_BOT_AGENT_HARNESS_KIND_BOX:'box',GROK_BOT_AGENT_HARNESS_KIND_TEMPORAL:'temporal'};
const CREATE_INTENT_WIRE={0:'UNSPECIFIED',1:'FRESH',2:'REGISTER_EXISTING_LOCAL',UNSPECIFIED:'UNSPECIFIED',FRESH:'FRESH',REGISTER_EXISTING_LOCAL:'REGISTER_EXISTING_LOCAL',GROK_BOT_AGENT_CREATE_INTENT_UNSPECIFIED:'UNSPECIFIED',GROK_BOT_AGENT_CREATE_INTENT_FRESH:'FRESH',GROK_BOT_AGENT_CREATE_INTENT_REGISTER_EXISTING_LOCAL:'REGISTER_EXISTING_LOCAL'};
const CREATE_CALLER_WIRE={0:'UNSPECIFIED',1:'ROOM_MEMBERS',2:'ENSURE_SERVER_BACKED',3:'MINT',4:'BACKFILL',5:'PRODUCT_CREATE',UNSPECIFIED:'UNSPECIFIED',ROOM_MEMBERS:'ROOM_MEMBERS',ENSURE_SERVER_BACKED:'ENSURE_SERVER_BACKED',MINT:'MINT',BACKFILL:'BACKFILL',PRODUCT_CREATE:'PRODUCT_CREATE',GROK_BOT_AGENT_CREATE_CALLER_UNSPECIFIED:'UNSPECIFIED',GROK_BOT_AGENT_CREATE_CALLER_ROOM_MEMBERS:'ROOM_MEMBERS',GROK_BOT_AGENT_CREATE_CALLER_ENSURE_SERVER_BACKED:'ENSURE_SERVER_BACKED',GROK_BOT_AGENT_CREATE_CALLER_MINT:'MINT',GROK_BOT_AGENT_CREATE_CALLER_BACKFILL:'BACKFILL',GROK_BOT_AGENT_CREATE_CALLER_PRODUCT_CREATE:'PRODUCT_CREATE'};

function botKey(value){if(typeof value!=='string'||!value.length||value.length>128||!/^[A-Za-z0-9_-]+$/.test(value))throw new SDKError('BOT_ID_REQUIRED');return value;}
function botIds(values,{allowEmpty=false}={}){if(!Array.isArray(values)||(!allowEmpty&&!values.length))throw new SDKError('BOT_ID_REQUIRED');return values.map(botKey);}
function asText(value){return typeof value==='string'?value:'';}
function wireText(value){if(typeof value==='string')return value;if(typeof value==='number'&&Number.isFinite(value))return String(value);return '';}
function msText(value){if(typeof value==='string'&&/^-?\d{1,20}$/.test(value))return value;if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);return null;}
function stringList(value){return Array.isArray(value)?value.filter(item=>typeof item==='string'):[];}
function wireList(value){return Array.isArray(value)?value.map(wireText).filter(item=>item.length>0):[];}
function mappedEnum(value,table){if(Object.hasOwn(table,value))return table[value];return wireText(value)||'unspecified';}
function objectRows(value){return Array.isArray(value)?value.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[];}
function uint64(value){
  if(typeof value==='number'&&!Number.isSafeInteger(value))throw new SDKError('CURSOR_INVALID');
  const text=String(value??0);if(!/^\d{1,20}$/.test(text)||BigInt(text)>18446744073709551615n)throw new SDKError('CURSOR_INVALID');return String(BigInt(text));
}
function generation(value){const number=value??0;if(!Number.isInteger(number)||number<0||number>4294967295)throw new SDKError('CURSOR_INVALID');return number;}
function cursorID(botId,sessionId,state){return Buffer.from(JSON.stringify({botId,sessionId,generation:state.generation,afterUpdatedSeq:state.afterUpdatedSeq})).toString('base64url');}
function resumeCursor(value,botId,sessionId){
  let parsed;try{if(typeof value!=='string'||value.length>2048||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error();parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));}catch{throw new SDKError('CURSOR_INVALID');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new SDKError('CURSOR_INVALID');
  if(parsed.botId!==botId||parsed.sessionId!==sessionId)throw new SDKError('CURSOR_SCOPE_MISMATCH');
  return {generation:generation(parsed.generation),afterUpdatedSeq:uint64(parsed.afterUpdatedSeq)};
}
function decodeEntry(entry){
  if(typeof entry.body!=='string'||!entry.body)return null;
  try{const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(entry.body,'base64')));return body&&typeof body==='object'&&!Array.isArray(body)?body:null;}catch{return null;}
}

function normalizeSlackConnection(row){
  return {agentId:asText(row.agentId),connected:row.connected===true,workspaceName:typeof row.workspaceName==='string'?row.workspaceName:null,installUrl:typeof row.installUrl==='string'?row.installUrl:null,unavailableReason:typeof row.unavailableReason==='string'?row.unavailableReason:null,pendingAdminApproval:row.pendingAdminApproval===true,needsManifestUpdate:row.needsManifestUpdate===true,reinstallUrl:typeof row.reinstallUrl==='string'?row.reinstallUrl:null,approvalDenied:row.approvalDenied===true,appUnreachable:row.appUnreachable===true,removedInSlack:row.removedInSlack===true,approvalRequestUnsent:row.approvalRequestUnsent===true};
}
function normalizeInstalledTeam(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {teamId:asText(row.teamId),displayName:asText(row.displayName),rscGranted:row.rscGranted===true,installedAtMs:msText(row.installedAtMs)};
}
function normalizeTeamsConnection(row){
  return {agentId:asText(row.agentId),installState:wireText(row.installState),tenantId:typeof row.tenantId==='string'?row.tenantId:null,tenantDisplayName:typeof row.tenantDisplayName==='string'?row.tenantDisplayName:null,installedTeamCount:Number.isInteger(row.installedTeamCount)?row.installedTeamCount:0,installedTeams:objectRows(row.installedTeams).map(normalizeInstalledTeam).filter(Boolean)};
}
function normalizeSession(row){
  return {agentId:asText(row.agentId),sessionId:asText(row.sessionId),kind:wireText(row.kind),createdAtMs:msText(row.createdAtMs),updatedAtMs:msText(row.updatedAtMs),lastActivityAtMs:msText(row.lastActivityAtMs)};
}
function normalizeTranscriptEntry(entry){
  return {seq:uint64(entry?.seq),updatedSeq:uint64(entry?.updatedSeq??entry?.seq),entryId:typeof entry?.entryId==='string'?entry.entryId:null,entryKind:asText(entry?.entryKind),bodyOmitted:entry?.bodyOmitted===true,blobHash:typeof entry?.blobHash==='string'?entry.blobHash:null,body:decodeEntry(entry??{})};
}
function normalizeUnreadAnchor(anchor){
  if(!anchor||typeof anchor!=='object'||Array.isArray(anchor))return null;
  return {hasNewerRows:anchor.hasNewerRows===true,entryId:asText(anchor.entryId),seq:msText(anchor.seq),newerRows:Number.isInteger(anchor.newerRows)?anchor.newerRows:0};
}
function normalizeLiveState(row){
  return {agentId:asText(row.agentId),sessionId:asText(row.sessionId),isRunning:row.isRunning===true,isComposingMessage:row.isComposingMessage===true,isRetrying:row.isRetrying===true,updatedAtMs:msText(row.updatedAtMs),staleAfterMs:msText(row.staleAfterMs),hasRunningSubagents:row.hasRunningSubagents===true,surfaceTaskId:asText(row.surfaceTaskId),workingTaskIds:stringList(row.workingTaskIds),activityKind:asText(row.activity?.kind)};
}
function normalizeClientState(row){
  return {agentId:asText(row.agentId),lastViewedAtMs:msText(row.lastViewedAtMs),unreadCount:Number.isInteger(row.unreadCount)?row.unreadCount:0,lastActivityAtMs:msText(row.lastActivityAtMs),lastEntryId:asText(row.lastEntryId),lastEntryKind:asText(row.lastEntryKind),lastMessageId:asText(row.lastMessageId),lastMessagePreview:asText(row.lastMessagePreview),notificationsEnabled:row.notificationsEnabled===true,notifyOnUpdatesEnabled:row.notifyOnUpdatesEnabled===true,hiddenFromSidebar:row.hiddenFromSidebar===true,updatedAtMs:msText(row.updatedAtMs),lastMessageTaskId:asText(row.lastMessageTaskId),removedFromSidebar:row.removedFromSidebar===true,unreadThreadCount:Number.isInteger(row.unreadThreadCount)?row.unreadThreadCount:0};
}
function normalizeBoxState(state){
  if(!state||typeof state!=='object'||Array.isArray(state))return null;
  const textOrNull=value=>typeof value==='string'?value:null;
  return {runState:mappedEnum(state.runState,RUN_STATE),recreateInFlight:state.recreateInFlight===true,imageUpdateAvailable:state.imageUpdateAvailable===true,hostVersion:textOrNull(state.hostVersion),hostUpdateAvailable:state.hostUpdateAvailable===true,diskPressure:wireText(state.diskPressure),updatedAtMs:msText(state.updatedAtMs),imageTag:textOrNull(state.imageTag),staticSnapshotPath:textOrNull(state.staticSnapshotPath),imageGitSha:textOrNull(state.imageGitSha),staticSnapshotMatchesPin:state.staticSnapshotMatchesPin===true,staticSnapshotPin:textOrNull(state.staticSnapshotPin)};
}
function normalizeComputerAction(row){
  const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
  return {agentId:asText(row.agentId),type:asText(row.type),x:number(row.x),y:number(row.y),button:asText(row.button),count:Number.isInteger(row.count)?row.count:0,atMs:msText(row.atMs)};
}
function isRoomKind(kind){return ROOM_KIND.has(kind);}
function requiredText(value){if(typeof value!=='string'||!value)throw new SDKError('MESSAGE_INVALID');return value;}
function defaultText(value){if(value===undefined)return '';if(typeof value!=='string')throw new SDKError('MESSAGE_INVALID');return value;}
function optionalString(value){if(value===undefined)return undefined;if(typeof value!=='string'||!value)throw new SDKError('MESSAGE_INVALID');return value;}
function presentString(value){if(value===undefined)return undefined;if(typeof value!=='string')throw new SDKError('MESSAGE_INVALID');return value;}
function returnedBot(agent){try{return normalizeBot(agent);}catch(error){if(error instanceof SDKError&&error.code==='INVALID_BOT_RECORD')throw new SDKError('RPC_FAILED');throw error;}}
function optionalBool(value){if(value===undefined)return undefined;if(typeof value!=='boolean')throw new SDKError('MESSAGE_INVALID');return value;}
function enumWire(value,table){if(!Object.hasOwn(table,value))throw new SDKError('MESSAGE_INVALID');return table[value];}
function optionalEnum(value,table){if(value===undefined)return undefined;return enumWire(value,table);}
function int32List(values){if(!Array.isArray(values))throw new SDKError('MESSAGE_INVALID');return values.map(value=>{if(!Number.isInteger(value)||value<-2147483648||value>2147483647)throw new SDKError('MESSAGE_INVALID');return value;});}
function int64Text(value){
  if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
  if(typeof value==='string'&&/^-?\d{1,19}$/.test(value)){const number=BigInt(value);if(number>=-9223372036854775808n&&number<=9223372036854775807n)return number.toString();}
  return '';
}
function int64Wire(value){
  const text=int64Text(value);
  if(!text||text.startsWith('-'))throw new SDKError('MESSAGE_INVALID');
  return text;
}
function putField(body,key,value){if(value!==undefined)body[key]=value;}
function normalizePluginSkill(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {name:asText(row.name),description:asText(row.description),sourcePath:asText(row.sourcePath),sourceUrl:typeof row.sourceUrl==='string'?row.sourceUrl:null,content:asText(row.content),environments:stringList(row.environments)};
}
function normalizeMarketplace(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {marketplaceId:int64Text(row.marketplaceId),displayName:asText(row.displayName),description:asText(row.description)};
}
function normalizeDelegatedCredential(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {delegatorDisplayName:asText(row.delegatorDisplayName),delegatorAvatarUrl:typeof row.delegatorAvatarUrl==='string'?row.delegatorAvatarUrl:null,delegatorIsViewer:row.delegatorIsViewer===true,state:wireText(row.state),attachedAt:typeof row.attachedAt==='string'?row.attachedAt:null};
}
function normalizePlugin(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {pluginId:int64Text(row.pluginId),name:asText(row.name),displayName:asText(row.displayName),description:asText(row.description),logoUrl:typeof row.logoUrl==='string'?row.logoUrl:null,ownedByMarketplace:row.ownedByMarketplace===true,installMode:asText(row.installMode),variableNames:stringList(row.variableNames),isDeprecated:row.isDeprecated===true,mcpConfigJson:typeof row.mcpConfigJson==='string'?row.mcpConfigJson:null,skills:objectRows(row.skills).map(normalizePluginSkill).filter(Boolean),mcpServerNames:stringList(row.mcpServerNames),isBotSkills:row.isBotSkills===true,connectorType:wireText(row.connectorType),variablesJson:typeof row.variablesJson==='string'?row.variablesJson:null,hasConfiguredVariables:row.hasConfiguredVariables===true,credentialSource:wireText(row.credentialSource),delegatedCredential:normalizeDelegatedCredential(row.delegatedCredential),credentialAllowedActions:wireList(row.credentialAllowedActions),supportsServiceAccount:row.supportsServiceAccount===true};
}
function normalizeCustomMcp(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const http=row.http&&typeof row.http==='object'&&!Array.isArray(row.http)?{url:asText(row.http.url),headerNames:stringList(row.http.headerNames),hasOauthClientId:row.http.hasOauthClientId===true,hasOauthClientSecret:row.http.hasOauthClientSecret===true}:null;
  const stdio=row.stdio&&typeof row.stdio==='object'&&!Array.isArray(row.stdio)?{command:asText(row.stdio.command),args:stringList(row.stdio.args),hasEnv:row.stdio.hasEnv===true}:null;
  return {pluginId:int64Text(row.pluginId),name:asText(row.name),http,stdio};
}
function normalizeAccessInvite(row){
  return {email:asText(row.email),expiresAtMs:msText(row.expiresAtMs),lastSharedAtMs:msText(row.lastSharedAtMs),createdAtMs:msText(row.createdAtMs)};
}
function normalizeCapUsage(row){
  return {used:Number.isInteger(row?.used)?row.used:0,limit:Number.isInteger(row?.limit)?row.limit:0};
}
function normalizeInviteBot(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {agentId:asText(row.agentId),name:asText(row.name),avatarUrl:typeof row.avatarUrl==='string'?row.avatarUrl:null,avatarShape:asText(row.avatarShape),avatarColor:asText(row.avatarColor)};
}
function normalizeInviteSender(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {displayName:asText(row.displayName),avatarUrl:typeof row.avatarUrl==='string'?row.avatarUrl:null};
}
function normalizeInviteEligibility(row){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  return {eligible:row.eligible===true,reason:wireText(row.reason),currentTier:wireText(row.currentTier)};
}
function skillWriteResult(data,{requireSkill}){
  if(!Array.isArray(data?.plugins))throw new SDKError('RPC_FAILED');
  const marketplace=normalizeMarketplace(data.marketplace);
  if(!marketplace)throw new SDKError('RPC_FAILED');
  const plugins=data.plugins.map(normalizePlugin);
  if(plugins.some(row=>!row))throw new SDKError('RPC_FAILED');
  const result={marketplace,plugins};
  if(!requireSkill)return result;
  const skill=normalizePluginSkill(data.skill);
  if(!skill)throw new SDKError('RPC_FAILED');
  return {...result,skill};
}

export function normalizeBot(agent){
  if(!agent||typeof agent.agentId!=='string'||!agent.agentId)throw new SDKError('INVALID_BOT_RECORD');
  const avatar=resolveAgentAvatar(agent);
  return {id:agent.agentId,serverId:typeof agent.id==='string'?agent.id:null,legacyAgentId:asText(agent.legacyAgentId),name:asText(agent.name),description:asText(agent.description),title:asText(agent.title),avatarShape:avatar.character.shape,avatarColor:avatar.character.color,avatar,harness:asText(agent.harness),role:asText(agent.role),kind:wireText(agent.kind),visibility:wireText(agent.visibility),sessionId:asText(agent.viewerSessionId),teamId:Number.isInteger(agent.teamId)?agent.teamId:null,viewerIsOwner:agent.viewerIsOwner===true,viewerCanManage:agent.viewerCanManage===true,teamDefaultForViewer:agent.teamDefaultForViewer===true,ownerDisplayName:asText(agent.ownerDisplayName),draftingDisabled:agent.draftingDisabled===true,accessGrantsOnly:agent.accessGrantsOnly===true,accessOwnerOnly:agent.accessOwnerOnly===true,memberAgentIds:stringList(agent.memberAgentIds),viewerAllowedActions:wireList(agent.viewerAllowedActions),createdAtMs:msText(agent.createdAtMs),updatedAtMs:msText(agent.updatedAtMs),voiceId:asText(agent.voiceId),voiceSpeed:typeof agent.voiceSpeed==='number'&&Number.isFinite(agent.voiceSpeed)?agent.voiceSpeed:null,voiceLanguage:asText(agent.voiceLanguage)};
}

export class GrokBotClient{
  #options;
  constructor(options){
    if(typeof options?.accessToken!=='string'||!options.accessToken)throw new SDKError('MISSING_ACCESS_TOKEN');
    this.#options={...options,version:options.version??CLIENT_VERSION};
  }
  async #rpc(service,method,body,signal){
    return requestJSON(`${API_ORIGIN}/aiserver.v1.${service}/${method}`,{headers:clientHeaders(this.#options),body,fetchImpl:this.#options.fetchImpl,signal});
  }
  async #data(service,method,body){
    const response=await this.#rpc(service,method,body);
    if(!response.ok)throw new SDKError('RPC_FAILED',response.httpStatus);
    return response.data??{};
  }
  async getMe(){
    const response=await this.#rpc('DashboardService','GetMe',{});
    if(!response.ok||!(response.data?.authId||response.data?.userId))throw new SDKError('ACCOUNT_AUTH_FAILED',response.httpStatus);
    return response.data;
  }
  async listBots({includeTeamAgents=true,role,addedTeamAgentsOnly}={}){
    const body={includeTeamAgents};
    if(role!==undefined){if(typeof role!=='string')throw new SDKError('MESSAGE_INVALID');body.role=role;}
    if(addedTeamAgentsOnly!==undefined)body.addedTeamAgentsOnly=addedTeamAgentsOnly===true;
    const response=await this.#rpc('GrokBotService','ListGrokBotAgents',body);
    if(!response.ok)throw new SDKError('RPC_FAILED',response.httpStatus);
    if(!Array.isArray(response.data?.agents))throw new SDKError('INVALID_ROSTER_RESPONSE');
    return {bots:response.data.agents.map(normalizeBot),truncated:response.data.truncated===true,slackConnections:objectRows(response.data.slackConnections).map(normalizeSlackConnection),teamsConnections:objectRows(response.data.teamsConnections).map(normalizeTeamsConnection)};
  }

  async sendMessage({botId,text,sessionId='',messageId=randomUUID(),attachmentPaths=[],attachmentNames=[],replyToId,replyQuote,taskId,language,richText,machineId,rendersMcpElicitationForms}={}){
    botKey(botId);
    if(typeof text!=='string'||!text.trim()||typeof sessionId!=='string'||typeof messageId!=='string'||!messageId||!Array.isArray(attachmentPaths)||!Array.isArray(attachmentNames)||attachmentPaths.length!==attachmentNames.length||[...attachmentPaths,...attachmentNames].some(value=>typeof value!=='string'||!value))throw new SDKError('MESSAGE_INVALID');
    if(rendersMcpElicitationForms!==undefined&&typeof rendersMcpElicitationForms!=='boolean')throw new SDKError('MESSAGE_INVALID');
    const extra={};
    const put=(key,value)=>{if(value===undefined)return;if(typeof value!=='string'||!value)throw new SDKError('MESSAGE_INVALID');extra[key]=value;};
    put('replyToId',replyToId);put('replyQuote',replyQuote);put('taskId',taskId);put('language',language);put('machineId',machineId);
    if(richText!==undefined){if(typeof richText!=='string')throw new SDKError('MESSAGE_INVALID');extra.richText=richText;}
    if(rendersMcpElicitationForms===true)extra.rendersMcpElicitationForms=true;
    const response=await this.#rpc('GrokBotService','SendGrokBotUserMessage',{agentId:botId,text,sessionId,messageId,attachmentPaths,attachmentNames,sentAtMs:String(Date.now()),isFork:false,source:1,initiator:1,sendSource:1,...extra});
    if(!response.ok)throw new SDKError('SEND_UNCONFIRMED',response.httpStatus);
    const deliveries={1:'accepted-box',2:'accepted-temporal',3:'duplicate',GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX:'accepted-box',GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL:'accepted-temporal',GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE:'duplicate'};
    const delivery=deliveries[response.data?.delivery];
    if(!delivery)throw new SDKError('SEND_REFUSED');
    return {botId,messageId,delivery,dispatched:response.data.dispatched===true};
  }

  async listSessions(botId){
    botKey(botId);
    const data=await this.#data('GrokBotService','ListGrokBotAgentSessions',{agentId:botId});
    if(data.sessions!==undefined&&!Array.isArray(data.sessions))throw new SDKError('RPC_FAILED');
    return {sessions:objectRows(data.sessions??[]).map(normalizeSession)};
  }

  async listTranscript({botId,sessionId='',limit=50,generation:generationValue,beforeSeq,unreadBoundaryMs}={}){
    botKey(botId);
    if(typeof sessionId!=='string'||sessionId.length>256||!Number.isInteger(limit)||limit<1||limit>4294967295)throw new SDKError('CURSOR_INVALID');
    const body={agentId:botId,sessionId,limit};
    if(generationValue!==undefined)body.generation=generation(generationValue);
    if(beforeSeq!==undefined)body.beforeSeq=uint64(beforeSeq);
    if(unreadBoundaryMs!==undefined)body.unreadBoundaryMs=uint64(unreadBoundaryMs);
    const data=await this.#data('GrokBotService','ListGrokBotTranscriptEntries',body);
    if(!Array.isArray(data.entries))throw new SDKError('RPC_FAILED');
    return {generation:generation(data.generation),entries:data.entries.map(normalizeTranscriptEntry),cloudAgentPeerIds:stringList(data.cloudAgentPeerIds),cloudAgentPeerIdsKnown:data.cloudAgentPeerIdsKnown===true,unreadAnchor:normalizeUnreadAnchor(data.unreadAnchor),updatedSeqLocked:data.updatedSeqLocked===true};
  }

  async listAgentStatuses(agentIds=[]){
    const ids=botIds(agentIds,{allowEmpty:true});
    const data=await this.#data('GrokBotService','ListGrokBotAgentStatuses',{agentIds:ids});
    if(!Array.isArray(data.statuses))throw new SDKError('RPC_FAILED');
    return {statuses:objectRows(data.statuses).map(row=>({agentId:asText(row.agentId),isRunning:row.isRunning===true,live:row.live&&typeof row.live==='object'&&!Array.isArray(row.live)?normalizeLiveState(row.live):null,client:row.client&&typeof row.client==='object'&&!Array.isArray(row.client)?normalizeClientState(row.client):null}))};
  }

  async getSendStatus({botId,messageId,sessionId='',firstSentAgeMs,taskId}={}){
    botKey(botId);
    if(typeof messageId!=='string'||!messageId||typeof sessionId!=='string')throw new SDKError('MESSAGE_INVALID');
    const body={agentId:botId,messageId,sessionId};
    if(firstSentAgeMs!==undefined)body.firstSentAgeMs=uint64(firstSentAgeMs);
    if(taskId!==undefined){if(typeof taskId!=='string'||!taskId)throw new SDKError('MESSAGE_INVALID');body.taskId=taskId;}
    const data=await this.#data('GrokBotService','GetGrokBotSendStatus',body);
    return {status:mappedEnum(data.status,SEND_STATUS),echoEntryId:typeof data.echoEntryId==='string'?data.echoEntryId:null,rejectionCode:typeof data.rejectionCode==='string'?data.rejectionCode:null,acceptedAtMs:msText(data.acceptedAtMs)};
  }

  async listAgentTasks({botId,includeRecentlyDone}={}){
    botKey(botId);
    const body={agentId:botId};
    if(includeRecentlyDone!==undefined)body.includeRecentlyDone=includeRecentlyDone===true;
    const data=await this.#data('GrokBotService','ListGrokBotAgentTasks',body);
    if(!Array.isArray(data.tasks))throw new SDKError('RPC_FAILED');
    return {tasks:objectRows(data.tasks).map(row=>({id:asText(row.id),name:asText(row.name),description:asText(row.description),status:asText(row.status),updatedAtMs:msText(row.updatedAtMs),unreadEntryId:typeof row.unreadEntryId==='string'?row.unreadEntryId:null,unreadPreview:typeof row.unreadPreview==='string'?row.unreadPreview:null,unreadAtMs:msText(row.unreadAtMs),pinnedAtMs:msText(row.pinnedAtMs),subagentIds:stringList(row.subagentIds),followed:row.followed===true}))};
  }

  async listTasks({botId,sessionId=''}={}){
    botKey(botId);
    if(typeof sessionId!=='string'||sessionId.length>256)throw new SDKError('CURSOR_INVALID');
    const data=await this.#data('GrokBotService','ListGrokBotTasks',{agentId:botId,sessionId});
    if(!Array.isArray(data.tasks))throw new SDKError('RPC_FAILED');
    return {tasks:objectRows(data.tasks).map(row=>({id:asText(row.id),title:asText(row.title),state:wireText(row.state),note:asText(row.note),createdAtMs:msText(row.createdAtMs),doneAtMs:msText(row.doneAtMs),seenDoneAtMs:msText(row.seenDoneAtMs)}))};
  }

  async listSubagents(botId){
    botKey(botId);
    const data=await this.#data('GrokBotService','ListGrokBotSubagents',{agentId:botId});
    if(!Array.isArray(data.subagents))throw new SDKError('RPC_FAILED');
    return {subagents:objectRows(data.subagents).map(row=>({subagentId:asText(row.subagentId),subagentType:asText(row.subagentType),title:asText(row.title),startedAtMs:msText(row.startedAtMs),freshUntilMs:msText(row.freshUntilMs)}))};
  }

  async listAgentTodos(botId){
    botKey(botId);
    const data=await this.#data('GrokBotService','ListGrokBotAgentTodos',{agentId:botId});
    if(!Array.isArray(data.todos))throw new SDKError('RPC_FAILED');
    return {todos:objectRows(data.todos).map(row=>({id:asText(row.id),content:asText(row.content),status:wireText(row.status),createdAtMs:msText(row.createdAt),updatedAtMs:msText(row.updatedAt),dependencies:stringList(row.dependencies)}))};
  }

  async listAgentSkills(botId){
    botKey(botId);
    const data=await this.#data('GrokBotService','ListGrokBotAgentSkills',{agentId:botId});
    if(!Array.isArray(data.skills))throw new SDKError('RPC_FAILED');
    return {skills:objectRows(data.skills).map(row=>({id:asText(row.id),name:asText(row.name),description:asText(row.description),body:asText(row.body),source:asText(row.source)}))};
  }

  async listDeletedAgentIds(agentIds=[]){
    const ids=botIds(agentIds,{allowEmpty:true});
    const data=await this.#data('GrokBotService','ListDeletedGrokBotAgentIds',{agentIds:ids});
    if(!Array.isArray(data.agentIds))throw new SDKError('RPC_FAILED');
    return {agentIds:stringList(data.agentIds)};
  }

  async getRuntimeCapabilities(){
    const data=await this.#data('GrokBotService','GetGrokBotRuntimeCapabilities',{});
    const caps=data.capabilities;
    if(!caps||typeof caps!=='object'||Array.isArray(caps))throw new SDKError('RPC_FAILED');
    return {durableIdentityEnabled:caps.durableIdentityEnabled===true,durableIdentityWritesEnabled:caps.durableIdentityWritesEnabled===true,temporalCreationEnabled:caps.temporalCreationEnabled===true,agentMessagingEnabled:caps.agentMessagingEnabled===true,serverRoomsEnabled:caps.serverRoomsEnabled===true};
  }

  async getSandBoxRunState(){
    const data=await this.#data('GrokBotService','GetSandBoxRunState',{});
    const image=data.image&&typeof data.image==='object'&&!Array.isArray(data.image)?{registryTag:typeof data.image.registryTag==='string'?data.image.registryTag:null,staticSnapshotPath:typeof data.image.staticSnapshotPath==='string'?data.image.staticSnapshotPath:null}:null;
    return {runState:mappedEnum(data.state,RUN_STATE),imageUpdateAvailable:data.imageUpdateAvailable===true,egressTunnelOwnership:data.egressTunnelOwnership===true,image};
  }

  async getAgentCustomMcp({botId,pluginId}={}){
    const id=botKey(botId);
    const data=await this.#data('GrokBotService','GetGrokBotAgentCustomMcp',{agentId:id,pluginId:int64Wire(pluginId)});
    const server=normalizeCustomMcp(data.server);
    if(!server)throw new SDKError('RPC_FAILED');
    return {server};
  }

  async listAgentAccessInvites(botId){
    const id=botKey(botId);
    const data=await this.#data('GrokBotService','ListGrokBotAgentAccessInvites',{agentId:id});
    if(!Array.isArray(data.invites))throw new SDKError('RPC_FAILED');
    return {invites:objectRows(data.invites).map(normalizeAccessInvite),capUsage:normalizeCapUsage(data.capUsage)};
  }

  async previewAgentAccessInvite(code){
    const data=await this.#data('GrokBotService','PreviewGrokBotAgentAccessInvite',{code:requiredText(code)});
    return {found:data.found===true,recipientMatch:wireText(data.recipientMatch),sender:normalizeInviteSender(data.sender),invites:objectRows(data.invites).map(row=>({inviteId:asText(row.inviteId),bot:normalizeInviteBot(row.bot),role:asText(row.role),state:wireText(row.state),expiresAtMs:msText(row.expiresAtMs)})),truncated:data.truncated===true,otherResourceInviteCount:Number.isInteger(data.otherResourceInviteCount)?data.otherResourceInviteCount:0,eligibility:normalizeInviteEligibility(data.eligibility)};
  }

  /**
   * Irreversible. Deletes one bot or room.
   * `botId` is `Bot.id` (`GrokBotAgent.agentId`). The 0.78.1 client sends that value as `DeleteGrokBotAgent.id`.
   * The response message has no fields. `{id}` is the id that was sent.
   */
  async deleteBot(botId){
    const id=botKey(botId);
    await this.#data('GrokBotService','DeleteGrokBotAgent',{id});
    return {id};
  }

  /**
   * Irreversible. Deletes a room only when `ListGrokBotAgents` currently contains this id and its kind is ROOM.
   * Anything else throws `NOT_A_ROOM` and does not call delete.
   */
  async deleteRoom(roomId){
    const id=botKey(roomId);
    const roster=await this.listBots();
    const room=roster.bots.find(bot=>bot.id===id);
    if(!room||!isRoomKind(room.kind))throw new SDKError('NOT_A_ROOM');
    return this.deleteBot(id);
  }

  async createRoom({name,memberAgentIds,description,humanMemberUserIds,agentId}={}){
    if(!Array.isArray(memberAgentIds))throw new SDKError('MESSAGE_INVALID');
    const id=agentId===undefined?randomUUID():botKey(agentId);
    const data=await this.#data('GrokBotService','CreateGrokBotRoom',{agentId:id,name:requiredText(name),description:defaultText(description),memberAgentIds:botIds(memberAgentIds,{allowEmpty:true}),humanMemberUserIds:int32List(humanMemberUserIds??[])});
    const bot=returnedBot(data.agent);
    if(bot.id!==id||!isRoomKind(bot.kind))throw new SDKError('RPC_FAILED');
    return {bot};
  }

  async addRoomMembers({roomId,userIds}={}){
    const id=botKey(roomId);
    const data=await this.#data('GrokBotService','AddGrokBotRoomPeople',{agentId:id,userIds:int32List(userIds)});
    const bot=returnedBot(data.agent);
    if(bot.id!==id||!isRoomKind(bot.kind))throw new SDKError('RPC_FAILED');
    return {bot};
  }

  /**
   * Irreversible. Removes human user ids from a room.
   * A response with no agent returns `{bot:null}`, which is what the 0.78.1 client does.
   */
  async removeRoomMembers({roomId,userIds}={}){
    const id=botKey(roomId);
    const data=await this.#data('GrokBotService','RemoveGrokBotRoomPeople',{agentId:id,userIds:int32List(userIds)});
    if(data.agent===undefined||data.agent===null)return {bot:null};
    const bot=returnedBot(data.agent);
    if(bot.id!==id||!isRoomKind(bot.kind))throw new SDKError('RPC_FAILED');
    return {bot};
  }

  /**
   * Irreversible. Replaces the room's bot members with `memberAgentIds`, including when that array is empty.
   */
  async setRoomMembers({roomId,memberAgentIds}={}){
    const id=botKey(roomId);
    if(!Array.isArray(memberAgentIds))throw new SDKError('MESSAGE_INVALID');
    const data=await this.#data('GrokBotService','SetGrokBotRoomMembers',{agentId:id,memberAgentIds:botIds(memberAgentIds,{allowEmpty:true})});
    const bot=returnedBot(data.agent);
    if(bot.id!==id||!isRoomKind(bot.kind))throw new SDKError('RPC_FAILED');
    return {bot};
  }

  async createBot({name,description,title,avatarShape,avatarColor,avatarDataUrl,agentId,harness,kickstartRequested,introductionSuppressed,purpose,origin,language,createIntent,createCaller,createdAutomatically,legacyAgentId}={}){
    const id=agentId===undefined?randomUUID():botKey(agentId);
    const body={agentId:id,name:requiredText(name),description:defaultText(description),title:defaultText(title),avatarShape:defaultText(avatarShape),avatarColor:defaultText(avatarColor)};
    putField(body,'legacyAgentId',optionalString(legacyAgentId));
    putField(body,'avatarDataUrl',optionalString(avatarDataUrl));
    putField(body,'harness',optionalEnum(harness,HARNESS_WIRE));
    putField(body,'kickstartRequested',optionalBool(kickstartRequested));
    putField(body,'introductionSuppressed',optionalBool(introductionSuppressed));
    putField(body,'purpose',optionalString(purpose));
    putField(body,'origin',optionalString(origin));
    putField(body,'language',optionalString(language));
    putField(body,'createIntent',optionalEnum(createIntent,CREATE_INTENT_WIRE));
    putField(body,'createCaller',optionalEnum(createCaller,CREATE_CALLER_WIRE));
    putField(body,'createdAutomatically',optionalBool(createdAutomatically));
    const data=await this.#data('GrokBotService','CreateGrokBotAgent',body);
    const bot=returnedBot(data.agent);
    if(bot.id!==id)throw new SDKError('RPC_FAILED');
    return {bot,harness:mappedEnum(data.harness,HARNESS_OUT)};
  }

  /**
   * Changes name, description, title, or avatar. Omitted text fields are not sent.
   * `id` is `Bot.serverId` (`GrokBotAgent.id`). The 0.78.1 client sends that value, not `Bot.id`.
   * `partialUpdate` is always true. `clearAvatar` and `avatarDataUrl` cannot be combined.
   */
  async updateBot({id,name,description,title,avatarShape,avatarColor,avatarDataUrl,clearAvatar}={}){
    const recordId=botKey(id);
    if(clearAvatar!==undefined&&typeof clearAvatar!=='boolean')throw new SDKError('MESSAGE_INVALID');
    if(clearAvatar===true&&avatarDataUrl!==undefined)throw new SDKError('MESSAGE_INVALID');
    const body={id:recordId,partialUpdate:true};
    putField(body,'name',presentString(name));
    putField(body,'description',presentString(description));
    putField(body,'title',presentString(title));
    putField(body,'avatarShape',presentString(avatarShape));
    putField(body,'avatarColor',presentString(avatarColor));
    putField(body,'avatarDataUrl',optionalString(avatarDataUrl));
    if(clearAvatar===true)body.clearAvatar={};
    if(Object.keys(body).length===2)throw new SDKError('MESSAGE_INVALID');
    const data=await this.#data('GrokBotService','UpdateGrokBotAgent',body);
    return {bot:returnedBot(data.agent)};
  }

  async addAgentSkill({botId,name,description,content}={}){
    const id=botKey(botId);
    if(typeof content!=='string')throw new SDKError('MESSAGE_INVALID');
    const body={agentId:id,content};
    putField(body,'name',optionalString(name));
    putField(body,'description',presentString(description));
    return skillWriteResult(await this.#data('GrokBotService','AddGrokBotAgentSkill',body),{requireSkill:true});
  }

  async updateAgentSkill({botId,name,description,content}={}){
    const id=botKey(botId);
    if(typeof content!=='string')throw new SDKError('MESSAGE_INVALID');
    const body={agentId:id,name:requiredText(name),content};
    putField(body,'description',presentString(description));
    return skillWriteResult(await this.#data('GrokBotService','UpdateGrokBotAgentSkill',body),{requireSkill:true});
  }

  /**
   * Irreversible. Removes one skill by name. The response has no skill record.
   */
  async removeAgentSkill({botId,name}={}){
    const id=botKey(botId);
    const data=await this.#data('GrokBotService','RemoveGrokBotAgentSkill',{agentId:id,name:requiredText(name)});
    return skillWriteResult(data,{requireSkill:false});
  }

  async *watchBot({botId,sessionId='',cursor,resumeFrom,signal,inlineBodyMaxBytes=262144}={}){
    botKey(botId);
    if(typeof sessionId!=='string'||sessionId.length>256||cursor&&resumeFrom)throw new SDKError('CURSOR_INVALID');
    if(!Number.isInteger(inlineBodyMaxBytes)||inlineBodyMaxBytes<1||inlineBodyMaxBytes>524288)throw new SDKError('STREAM_FRAME_TOO_LARGE');
    if(signal?.aborted)return;
    let state;
    if(resumeFrom)state=resumeCursor(resumeFrom,botId,sessionId);
    else if(cursor)state={generation:generation(cursor.generation),afterUpdatedSeq:uint64(cursor.afterUpdatedSeq)};
    else{
      const tail=await this.#rpc('GrokBotService','ListGrokBotTranscriptEntries',{agentId:botId,sessionId,limit:1},signal);
      if(signal?.aborted)return;
      if(!tail.ok||!Array.isArray(tail.data?.entries))throw new SDKError('RPC_FAILED',tail.httpStatus);
      state={generation:generation(tail.data.generation),afterUpdatedSeq:tail.data.entries.reduce((max,row)=>BigInt(uint64(row.updatedSeq??row.seq))>BigInt(max)?uint64(row.updatedSeq??row.seq):max,'0')};
    }
    if(signal?.aborted)return;
    const control=new AbortController();
    const upstreamSignal=signal?AbortSignal.any([signal,control.signal]):control.signal;
    let headersTimeout=setTimeout(()=>control.abort(),20000);headersTimeout.unref?.();
    try{
      const response=await(this.#options.fetchImpl??fetch)(`${API_ORIGIN}/aiserver.v1.GrokBotService/WatchGrokBotTranscripts`,{method:'POST',headers:{...clientHeaders(this.#options),'content-type':'application/connect+json','accept':'application/connect+json','connect-accept-encoding':'identity'},body:encodeConnectFrame({cursors:[{agentId:botId,sessionId,...state}],includeUnlistedAgents:false,inlineBodyMaxBytes}),redirect:'error',signal:upstreamSignal});
      clearTimeout(headersTimeout);
      if(!response.ok)throw new SDKError('STREAM_CONNECTION_FAILED',response.status);
      if(response.headers.get('content-type')?.split(';')[0].trim()!=='application/connect+json')throw new SDKError('STREAM_INVALID_RESPONSE');
      for await(const frame of readConnectFrames(response.body,{onClose:()=>control.abort()})){
        if(signal?.aborted)return;
        if(frame.connected)yield {type:'connected',data:{serverTimeMs:String(frame.connected.serverTimeMs??0),absoluteLifetimeMs:String(frame.connected.absoluteLifetimeMs??0)}};
        if(frame.heartbeat)yield {type:'heartbeat',data:{serverTimeMs:String(frame.heartbeat.serverTimeMs??0)}};
        const rows=frame.rows;
        if(rows?.agentId===botId&&(rows.sessionId??'')===sessionId){
          const nextGeneration=generation(rows.generation);
          if(nextGeneration!==state.generation){state={generation:nextGeneration,afterUpdatedSeq:'0'};yield {type:'reset',id:cursorID(botId,sessionId,state),data:{botId,generation:nextGeneration}};}
          const operations=[...(rows.entries??[]).map(entry=>({entry,deleted:false,updated:uint64(entry.updatedSeq??entry.seq)})),...(rows.deletes??[]).map(entry=>({entry,deleted:true,updated:uint64(entry.updatedSeq??entry.seq)}))].sort((a,b)=>BigInt(a.updated)<BigInt(b.updated)?-1:BigInt(a.updated)>BigInt(b.updated)?1:0);
          for(const {entry,deleted,updated} of operations){
            if(BigInt(updated)<=BigInt(state.afterUpdatedSeq))continue;
            state.afterUpdatedSeq=updated;
            const base={botId,sessionId,generation:state.generation,seq:uint64(entry.seq),updatedSeq:updated,entryId:entry.entryId??null,replay:rows.replay===true};
            const id=cursorID(botId,sessionId,state);
            if(deleted){yield {type:'message.deleted',id,data:base};continue;}
            const body=decodeEntry(entry);
            if(!body){yield {type:'entry.unavailable',id,data:{...base,entryKind:entry.entryKind??'',bodyOmitted:entry.bodyOmitted===true,blobHash:entry.blobHash??null}};continue;}
            if(body.kind==='send-message'&&body.message?.type==='text'&&typeof body.message.content==='string')yield {type:'message',id,data:{...base,entryId:entry.entryId??body.id??null,operation:'upsert',text:body.message.content}};
            else yield {type:'entry',id,data:{...base,entryKind:body.kind??entry.entryKind??'',entry:body}};
          }
        }
        if(frame.cleared?.agentId===botId&&(frame.cleared.sessionId??'')===sessionId){state={generation:generation(frame.cleared.newGeneration),afterUpdatedSeq:'0'};yield {type:'reset',id:cursorID(botId,sessionId,state),data:{botId,generation:state.generation}};}
        if(frame.cursorTooOld?.agentId===botId&&(frame.cursorTooOld.sessionId??'')===sessionId){yield {type:'resync-required',data:{botId,generation:generation(frame.cursorTooOld.generation)}};return;}
        if(frame.turnFailed?.agentId===botId&&(frame.turnFailed.sessionId??'')===sessionId)yield {type:'turn.failed',data:{botId,turnId:frame.turnFailed.turnId??'',code:frame.turnFailed.code??0,summary:frame.turnFailed.summary??''}};
        if(frame.agentStateChanged?.agentId===botId)yield {type:'bot.state.changed',data:{botId,families:stringList(frame.agentStateChanged.families),changedAtMs:msText(frame.agentStateChanged.changedAtMs)}};
        if(frame.rosterChanged?.agentId===botId){const changed=frame.rosterChanged;if(!changed.agent||changed.agent.agentId===botId)yield {type:'bot.updated',data:{botId,changedFields:changed.changedFields??[],bot:changed.agent?normalizeBot(changed.agent):null}};}
        if(frame.agentState){const live=objectRows(frame.agentState.live).filter(row=>row.agentId===botId&&asText(row.sessionId)===sessionId).map(normalizeLiveState);const client=objectRows(frame.agentState.client).filter(row=>row.agentId===botId).map(normalizeClientState);if(frame.agentState.snapshot===true||live.length||client.length)yield {type:'agent.state',data:{botId,sessionId,snapshot:frame.agentState.snapshot===true,live,client}};}
        if(frame.computerActions){const actions=objectRows(frame.computerActions.actions).filter(row=>row.agentId===botId).map(normalizeComputerAction);if(actions.length)yield {type:'computer.actions',data:{botId,actions}};}
        if(frame.boxState)yield {type:'box.state',data:{botId,snapshot:frame.boxState.snapshot===true,state:normalizeBoxState(frame.boxState.state)}};
        if(frame.pageTitleChanged){const page=frame.pageTitleChanged;const wrapped=page.page&&typeof page.page==='object'?page.page:null;yield {type:'page.title.changed',data:{botId,storeId:asText(page.storeId),canvasId:wrapped?.case==='canvasId'?asText(wrapped.value):typeof page.canvasId==='string'?page.canvasId:null,documentId:wrapped?.case==='documentId'?asText(wrapped.value):typeof page.documentId==='string'?page.documentId:null,title:asText(page.title),changedAtMs:msText(page.changedAtMs),contentChanged:page.contentChanged===true}};}
      }
    }catch(error){
      if(signal?.aborted)return;
      if(error instanceof SDKError)throw error;
      throw new SDKError('STREAM_CONNECTION_FAILED');
    }finally{clearTimeout(headersTimeout);control.abort();}
  }

  botEventsSSE(options={}){
    const control=new AbortController();
    const signal=options.signal?AbortSignal.any([options.signal,control.signal]):control.signal;
    return eventsToSSE(this.watchBot({...options,signal}),{signal,keepAliveMs:options.keepAliveMs??15000,onCancel:()=>control.abort()});
  }
}
