import {randomUUID} from 'node:crypto';
import {API_ORIGIN,clientHeaders,requestJSON} from './core.mjs';
import {resolveAgentAvatar} from './avatar.mjs';
import {SDKError} from './errors.mjs';
import {encodeConnectFrame,readConnectFrames} from './connect-stream.mjs';
import {eventsToSSE} from './sse.mjs';

export {createLogin,pollLogin} from './core.mjs';
export {deriveDefaultAvatar,resolveAgentAvatar} from './avatar.mjs';
export {SDKError} from './errors.mjs';

const CLIENT_VERSION='0.75.8';
const SEND_STATUS={0:'unspecified',1:'not-found',2:'accepted',3:'rejected',4:'pending',5:'unknown-durability',GROK_BOT_SEND_STATUS_UNSPECIFIED:'unspecified',GROK_BOT_SEND_STATUS_NOT_FOUND:'not-found',GROK_BOT_SEND_STATUS_ACCEPTED:'accepted',GROK_BOT_SEND_STATUS_REJECTED:'rejected',GROK_BOT_SEND_STATUS_PENDING:'pending',GROK_BOT_SEND_STATUS_UNKNOWN_DURABILITY:'unknown-durability'};
const RUN_STATE={0:'unspecified',1:'absent',2:'hibernated',3:'running',4:'starting',SAND_BOX_RUN_STATE_UNSPECIFIED:'unspecified',SAND_BOX_RUN_STATE_ABSENT:'absent',SAND_BOX_RUN_STATE_HIBERNATED:'hibernated',SAND_BOX_RUN_STATE_RUNNING:'running',SAND_BOX_RUN_STATE_STARTING:'starting'};

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
  return {agentId:asText(row.agentId),lastViewedAtMs:msText(row.lastViewedAtMs),unreadCount:Number.isInteger(row.unreadCount)?row.unreadCount:0,lastActivityAtMs:msText(row.lastActivityAtMs),lastEntryId:asText(row.lastEntryId),lastEntryKind:asText(row.lastEntryKind),lastMessageId:asText(row.lastMessageId),lastMessagePreview:asText(row.lastMessagePreview),notificationsEnabled:row.notificationsEnabled===true,notifyOnUpdatesEnabled:row.notifyOnUpdatesEnabled===true,hiddenFromSidebar:row.hiddenFromSidebar===true,updatedAtMs:msText(row.updatedAtMs),lastMessageTaskId:asText(row.lastMessageTaskId),removedFromSidebar:row.removedFromSidebar===true};
}
function normalizeBoxState(state){
  if(!state||typeof state!=='object'||Array.isArray(state))return null;
  return {runState:mappedEnum(state.runState,RUN_STATE),recreateInFlight:state.recreateInFlight===true,imageUpdateAvailable:state.imageUpdateAvailable===true,hostVersion:typeof state.hostVersion==='string'?state.hostVersion:null,hostUpdateAvailable:state.hostUpdateAvailable===true,diskPressure:wireText(state.diskPressure),updatedAtMs:msText(state.updatedAtMs)};
}
function normalizeComputerAction(row){
  const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
  return {agentId:asText(row.agentId),type:asText(row.type),x:number(row.x),y:number(row.y),button:asText(row.button),count:Number.isInteger(row.count)?row.count:0,atMs:msText(row.atMs)};
}

export function normalizeBot(agent){
  if(!agent||typeof agent.agentId!=='string'||!agent.agentId)throw new SDKError('INVALID_BOT_RECORD');
  const avatar=resolveAgentAvatar(agent);
  return {id:agent.agentId,serverId:typeof agent.id==='string'?agent.id:null,legacyAgentId:asText(agent.legacyAgentId),name:asText(agent.name),description:asText(agent.description),title:asText(agent.title),avatarShape:avatar.character.shape,avatarColor:avatar.character.color,avatar,harness:asText(agent.harness),role:asText(agent.role),kind:wireText(agent.kind),visibility:wireText(agent.visibility),sessionId:asText(agent.viewerSessionId),teamId:Number.isInteger(agent.teamId)?agent.teamId:null,viewerIsOwner:agent.viewerIsOwner===true,viewerCanManage:agent.viewerCanManage===true,teamDefaultForViewer:agent.teamDefaultForViewer===true,ownerDisplayName:asText(agent.ownerDisplayName),draftingDisabled:agent.draftingDisabled===true,accessGrantsOnly:agent.accessGrantsOnly===true,memberAgentIds:stringList(agent.memberAgentIds),viewerAllowedActions:wireList(agent.viewerAllowedActions),createdAtMs:msText(agent.createdAtMs),updatedAtMs:msText(agent.updatedAtMs),voiceId:asText(agent.voiceId),voiceSpeed:typeof agent.voiceSpeed==='number'&&Number.isFinite(agent.voiceSpeed)?agent.voiceSpeed:null,voiceLanguage:asText(agent.voiceLanguage)};
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

  async sendMessage({botId,text,sessionId='',messageId=randomUUID(),attachmentPaths=[],attachmentNames=[],replyToId,replyQuote,taskId,language,richText,machineId}={}){
    botKey(botId);
    if(typeof text!=='string'||!text.trim()||typeof sessionId!=='string'||typeof messageId!=='string'||!messageId||!Array.isArray(attachmentPaths)||!Array.isArray(attachmentNames)||attachmentPaths.length!==attachmentNames.length||[...attachmentPaths,...attachmentNames].some(value=>typeof value!=='string'||!value))throw new SDKError('MESSAGE_INVALID');
    const extra={};
    const put=(key,value)=>{if(value===undefined)return;if(typeof value!=='string'||!value)throw new SDKError('MESSAGE_INVALID');extra[key]=value;};
    put('replyToId',replyToId);put('replyQuote',replyQuote);put('taskId',taskId);put('language',language);put('machineId',machineId);
    if(richText!==undefined){if(typeof richText!=='string')throw new SDKError('MESSAGE_INVALID');extra.richText=richText;}
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
    if(!Array.isArray(data.sessions))throw new SDKError('RPC_FAILED');
    return {sessions:objectRows(data.sessions).map(normalizeSession)};
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
    return {generation:generation(data.generation),entries:data.entries.map(normalizeTranscriptEntry),cloudAgentPeerIds:stringList(data.cloudAgentPeerIds),cloudAgentPeerIdsKnown:data.cloudAgentPeerIdsKnown===true,unreadAnchor:normalizeUnreadAnchor(data.unreadAnchor)};
  }

  async listAgentStatuses(agentIds=[]){
    const ids=botIds(agentIds,{allowEmpty:true});
    const data=await this.#data('GrokBotService','ListGrokBotAgentStatuses',{agentIds:ids});
    if(!Array.isArray(data.statuses))throw new SDKError('RPC_FAILED');
    return {statuses:objectRows(data.statuses).map(row=>({agentId:asText(row.agentId),isRunning:row.isRunning===true,live:row.live&&typeof row.live==='object'&&!Array.isArray(row.live)?normalizeLiveState(row.live):null,client:row.client&&typeof row.client==='object'&&!Array.isArray(row.client)?normalizeClientState(row.client):null}))};
  }

  async getSendStatus({botId,messageId,sessionId='',firstSentAgeMs}={}){
    botKey(botId);
    if(typeof messageId!=='string'||!messageId||typeof sessionId!=='string')throw new SDKError('MESSAGE_INVALID');
    const body={agentId:botId,messageId,sessionId};
    if(firstSentAgeMs!==undefined)body.firstSentAgeMs=uint64(firstSentAgeMs);
    const data=await this.#data('GrokBotService','GetGrokBotSendStatus',body);
    return {status:mappedEnum(data.status,SEND_STATUS),echoEntryId:typeof data.echoEntryId==='string'?data.echoEntryId:null,rejectionCode:typeof data.rejectionCode==='string'?data.rejectionCode:null,acceptedAtMs:msText(data.acceptedAtMs)};
  }

  async listAgentTasks({botId,includeRecentlyDone}={}){
    botKey(botId);
    const body={agentId:botId};
    if(includeRecentlyDone!==undefined)body.includeRecentlyDone=includeRecentlyDone===true;
    const data=await this.#data('GrokBotService','ListGrokBotAgentTasks',body);
    if(!Array.isArray(data.tasks))throw new SDKError('RPC_FAILED');
    return {tasks:objectRows(data.tasks).map(row=>({id:asText(row.id),name:asText(row.name),description:asText(row.description),status:asText(row.status),updatedAtMs:msText(row.updatedAtMs),unreadEntryId:typeof row.unreadEntryId==='string'?row.unreadEntryId:null,unreadPreview:typeof row.unreadPreview==='string'?row.unreadPreview:null,unreadAtMs:msText(row.unreadAtMs),pinnedAtMs:msText(row.pinnedAtMs),subagentIds:stringList(row.subagentIds)}))};
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
        if(frame.pageTitleChanged){const page=frame.pageTitleChanged;const wrapped=page.page&&typeof page.page==='object'?page.page:null;yield {type:'page.title.changed',data:{botId,storeId:asText(page.storeId),canvasId:wrapped?.case==='canvasId'?asText(wrapped.value):typeof page.canvasId==='string'?page.canvasId:null,documentId:wrapped?.case==='documentId'?asText(wrapped.value):typeof page.documentId==='string'?page.documentId:null,title:asText(page.title),changedAtMs:msText(page.changedAtMs)}};}
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
