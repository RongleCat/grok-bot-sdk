import test from 'node:test';
import assert from 'node:assert/strict';
let sdk={};try{sdk=await import('../sdk.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const feature=()=>assert.equal(typeof sdk.GrokBotClient,'function','GrokBotClient must exist');
const uuid='33cf1aae-3a51-452d-b761-34a6ccb62201';

test('listBots returns the same avatar structure for explicit and ID-derived settings',async()=>{
 feature();const calls=[];const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({agents:[{id:'server-a',agentId:uuid,name:'Default'},{id:'server-b',agentId:'another',name:'Explicit',avatarShape:'cloud',avatarColor:'brown'}],truncated:true}),{status:200});}});
 const result=await client.listBots();assert.equal(result.truncated,true);
 assert.equal(result.bots[0].id,uuid);assert.equal(result.bots[0].serverId,'server-a');
 assert.equal(result.bots[0].avatarShape,'cloud');assert.equal(result.bots[0].avatarColor,'brown');
 assert.deepEqual(result.bots[0].avatar.character,result.bots[1].avatar.character);
 assert.deepEqual(Object.keys(result.bots[0]),Object.keys(result.bots[1]));
 assert.equal(result.bots[0].avatar.sources.shape,'id-default');assert.equal(result.bots[1].avatar.sources.shape,'explicit');
 assert.deepEqual(JSON.parse(calls[0].init.body),{includeTeamAgents:true});
});

test('listBots preserves a partial explicit avatar and does not expose raw account fields',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>new Response(JSON.stringify({agents:[{agentId:uuid,avatarShape:'heart',unexpectedSecret:'private'}]}),{status:200})});
 const {bots}=await client.listBots();assert.equal(bots[0].avatarShape,'heart');assert.equal(bots[0].avatarColor,'brown');assert.ok(!JSON.stringify(bots).includes('private'));
});

test('invalid roster bodies fail with a fixed SDK error',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>new Response('{"agents":[{}]}',{status:200})});
 await assert.rejects(client.listBots(),/INVALID_BOT_RECORD/);
});

function framed(data,flag=0){const p=Buffer.from(JSON.stringify(data)),h=Buffer.alloc(5);h[0]=flag;h.writeUInt32BE(p.length,1);return Buffer.concat([h,p]);}
const wireEntry=(text,seq,updatedSeq=seq)=>({seq,updatedSeq,entryId:'reply-1',entryKind:'send-message',body:Buffer.from(JSON.stringify({id:'reply-1',kind:'send-message',message:{type:'text',content:text}})).toString('base64')});
const wireResponse=frames=>new Response(new ReadableStream({start(c){for(const f of frames)c.enqueue(f);c.close();}}),{headers:{'content-type':'application/connect+json'}});
async function collect(events){const values=[];for await(const event of events)values.push(event);return values;}

test('watchBot forwards whole message upserts and suppresses repeated/other-Bot rows',async()=>{
 feature();const calls=[];
 const frames=[framed({connected:{serverTimeMs:'1'}}),framed({rows:{agentId:uuid,generation:1,entries:[wireEntry('中文 first','1')]}}),framed({rows:{agentId:uuid,generation:1,entries:[wireEntry('中文 updated','1','2')]}}),framed({rows:{agentId:uuid,generation:1,entries:[wireEntry('duplicate','1','2')]}}),framed({rows:{agentId:'other-private',generation:1,entries:[wireEntry('private other chat','1','3')]}}),framed({},2)];
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{calls.push({url,init});return wireResponse(frames);}});
 const events=await collect(client.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'}}));
 assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.data.text),['中文 first','中文 updated']);
 assert.ok(!JSON.stringify(events).includes('private other chat'));
 assert.ok(calls[0].url.endsWith('/WatchGrokBotTranscripts'));
 assert.equal(calls[0].init.headers['content-type'],'application/connect+json');
 const payload=JSON.parse(Buffer.from(calls[0].init.body).subarray(5).toString());assert.equal(payload.cursors[0].agentId,uuid);assert.equal(payload.includeUnlistedAgents,false);
});

test('SSE event cursor resumes exactly the selected Bot/session and preserves uint64 sequence',async()=>{
 feature();const updated='9007199254740993';let request;
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{request=JSON.parse(Buffer.from(init.body).subarray(5).toString());return wireResponse([framed({rows:{agentId:uuid,generation:1,entries:[wireEntry('reply','1',updated)]}}),framed({},2)]);}});
 const events=await collect(client.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'}}));
 const event=events.find(e=>e.type==='message');
 await collect(client.watchBot({botId:uuid,resumeFrom:event.id}));assert.equal(request.cursors[0].afterUpdatedSeq,updated);
 await assert.rejects(collect(client.watchBot({botId:'other',resumeFrom:event.id})),/CURSOR_SCOPE_MISMATCH/);
});

test('watchBot orders a replay page by update sequence before advancing the resume cursor',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>wireResponse([framed({rows:{agentId:uuid,generation:1,entries:[wireEntry('later','2'),wireEntry('earlier','1')]}}),framed({},2)])});
 const events=await collect(client.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'}}));
 assert.deepEqual(events.filter(e=>e.type==='message').map(e=>e.data.text),['earlier','later']);
});

test('a too-old cursor emits resync-required rather than pretending missed messages were delivered',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>wireResponse([framed({cursorTooOld:{agentId:uuid,generation:2}}),framed({},2)])});
 const events=await collect(client.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'7'}}));assert.equal(events.at(-1).type,'resync-required');
});

test('default watch starts from the latest tail without replaying all old chats',async()=>{
 feature();const calls=[];
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{calls.push({url,init});return url.endsWith('/ListGrokBotTranscriptEntries')?new Response(JSON.stringify({generation:3,entries:[{seq:'5',updatedSeq:'8'}]}),{status:200}):wireResponse([framed({},2)]);}});
 await collect(client.watchBot({botId:uuid}));
 assert.equal(calls.length,2);assert.deepEqual(JSON.parse(calls[0].init.body),{agentId:uuid,sessionId:'',limit:1});
 assert.equal(JSON.parse(Buffer.from(calls[1].init.body).subarray(5).toString()).cursors[0].afterUpdatedSeq,'8');
});

test('SSE downstream disconnect aborts a pending upstream watch immediately',async()=>{
 feature();let aborted=false,upstreamSignal;
 const stream=new ReadableStream({start(c){c.enqueue(framed({connected:{}}));}});
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{upstreamSignal=init.signal;init.signal.addEventListener('abort',()=>{aborted=true;},{once:true});return new Response(stream,{headers:{'content-type':'application/connect+json'}});}});
 const response=client.botEventsSSE({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'},keepAliveMs:0});
 const reader=response.body.getReader();await reader.read();await reader.cancel();assert.equal(aborted,true);assert.equal(upstreamSignal.aborted,true);
});

test('sendMessage uses a caller nonce once and never retries an ambiguous network failure',async()=>{
 feature();let calls=0;const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>{calls++;throw new Error('network failure with private token');}});
 await assert.rejects(client.sendMessage({botId:uuid,text:'hello',messageId:'caller-nonce'}),/SEND_UNCONFIRMED/);assert.equal(calls,1);
});

test('sendMessage passes attachment references and confirms the delivery enum',async()=>{
 feature();let sent;const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({delivery:'GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL',dispatched:true}),{status:200});}});
 const result=await client.sendMessage({botId:uuid,text:'read attachment',messageId:'caller-nonce',attachmentPaths:['/server/file.md'],attachmentNames:['file.md']});
 assert.equal(result.delivery,'accepted-temporal');assert.equal(result.messageId,'caller-nonce');assert.equal(sent.agentId,uuid);assert.deepEqual(sent.attachmentPaths,['/server/file.md']);
});

test('disconnect during the initial tail request aborts that request too',async()=>{
 feature();let upstreamSignal,finish;
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{upstreamSignal=init.signal;return await new Promise(resolve=>{finish=()=>resolve(new Response('{"entries":[]}',{status:200}));});}});
 const control=new AbortController(),iterator=client.watchBot({botId:uuid,signal:control.signal});const pending=iterator.next();
 await new Promise(resolve=>setImmediate(resolve));control.abort();
 try{assert.equal(upstreamSignal.aborted,true);}finally{finish();await pending;}
});

test('roster updates cannot embed a different Bot inside the selected scope',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>wireResponse([
 framed({rosterChanged:{agentId:uuid,agent:{agentId:'other-bot',name:'Other scope record'}}}),
 framed({rosterChanged:{agentId:uuid,agent:{agentId:uuid,name:'Selected'}}}),framed({},2),
 ])});
 const events=await collect(client.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'}}));
 assert.deepEqual(events.filter(e=>e.type==='bot.updated').map(e=>e.data.bot.id),[uuid]);
});

test('default client version is 0.78.1 and roster options stay off the wire until set',async()=>{
 feature();let headers,body;
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{headers=init.headers;body=JSON.parse(init.body);return new Response(JSON.stringify({authId:'account',emailIsSynthetic:true,agents:[{agentId:uuid,kind:1,role:'main',createdAtMs:'10',accessOwnerOnly:true,slackConnections:[]}],truncated:false,slackConnections:[{agentId:uuid,connected:true,workspaceName:'kept-out'}],teamsConnections:[{agentId:uuid,installState:'GROK_BOT_TEAMS_INSTALL_STATE_INSTALLED',installedTeamCount:1,installedTeams:[{teamId:'t',displayName:'Team',rscGranted:true,installedAtMs:'4'}]}]}),{status:200});}});
 const me=await client.getMe();
 assert.equal(headers['x-cursor-client-version'],'0.78.1');
 assert.match(headers['user-agent'],/Sand\/0\.78\.1/);
 assert.equal(me.emailIsSynthetic,true);
 const roster=await client.listBots({role:'main',addedTeamAgentsOnly:true});
 assert.deepEqual(body,{includeTeamAgents:true,role:'main',addedTeamAgentsOnly:true});
 assert.equal(roster.bots[0].kind,'1');
 assert.equal(roster.bots[0].role,'main');
 assert.equal(roster.bots[0].accessOwnerOnly,true);
 assert.equal(roster.bots[0].createdAtMs,'10');
 assert.equal(roster.slackConnections[0].connected,true);
 assert.equal(roster.slackConnections[0].workspaceName,'kept-out');
 assert.equal(roster.teamsConnections[0].installedTeams[0].displayName,'Team');
 assert.ok(!JSON.stringify({kind:roster.bots[0].kind}).includes('private'));
});

test('sendMessage keeps desktop user chat enums and adds only provided reply fields',async()=>{
 feature();let sent;const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({delivery:4}),{status:200});}});
 await assert.rejects(client.sendMessage({botId:uuid,text:'hello',messageId:'caller-nonce',replyToId:'reply-1',taskId:'task-1',richText:'[]'}),/SEND_REFUSED/);
 assert.equal(sent.source,1);assert.equal(sent.initiator,1);assert.equal(sent.sendSource,1);
 assert.equal(sent.replyToId,'reply-1');assert.equal(sent.taskId,'task-1');assert.equal(sent.richText,'[]');
 assert.equal(sent.isFork,false);assert.equal('machineId' in sent,false);assert.equal('rendersMcpElicitationForms' in sent,false);
 await assert.rejects(client.sendMessage({botId:uuid,text:'hello',replyToId:''}),/MESSAGE_INVALID/);
});

test('read methods map 0.75.8 records',async()=>{
 feature();const calls=[];
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});const path=url.split('/').pop();
  const bodies={
   ListGrokBotAgentSessions:{sessions:[{agentId:uuid,sessionId:'s',kind:'GROK_BOT_AGENT_SESSION_KIND_MAIN',createdAtMs:'1',updatedAtMs:'2',lastActivityAtMs:'3'}]},
   ListGrokBotTranscriptEntries:{generation:4,entries:[{seq:'8',updatedSeq:'9',entryId:'e',entryKind:'send-message',body:Buffer.from(JSON.stringify({kind:'note'})).toString('base64')}],cloudAgentPeerIds:['peer'],cloudAgentPeerIdsKnown:true,unreadAnchor:{hasNewerRows:true,entryId:'e',seq:'8',newerRows:2}},
   ListGrokBotAgentStatuses:{statuses:[{agentId:uuid,isRunning:true,live:{agentId:uuid,sessionId:'',isRunning:true,activity:{kind:'tool'}},client:{agentId:uuid,unreadCount:2,lastMessagePreview:'hidden'}}]},
   GetGrokBotSendStatus:{status:'GROK_BOT_SEND_STATUS_NOT_FOUND',echoEntryId:null,rejectionCode:'missing',acceptedAtMs:'5'},
   ListGrokBotAgentTasks:{tasks:[{id:'t',name:'Name',description:'d',status:'open',updatedAtMs:'6',subagentIds:['sub']}]},
   ListGrokBotTasks:{tasks:[{id:'task',title:'Title',state:2,note:'n',createdAtMs:'7',doneAtMs:'0',seenDoneAtMs:null}]},
   ListGrokBotSubagents:{subagents:[{subagentId:'sub',subagentType:'research',title:'Sub',startedAtMs:'8',freshUntilMs:'9'}]},
   ListGrokBotAgentTodos:{todos:[{id:'todo',content:'do',status:'TODO_STATUS_PENDING',createdAt:'1',updatedAt:'2',dependencies:['a']}]},
   ListGrokBotAgentSkills:{skills:[{id:'skill',name:'Skill',description:'desc',body:'secret body',source:'user'}]},
   ListDeletedGrokBotAgentIds:{agentIds:[uuid]},
   GetGrokBotRuntimeCapabilities:{capabilities:{durableIdentityEnabled:true,durableIdentityWritesEnabled:false,temporalCreationEnabled:true,agentMessagingEnabled:true,serverRoomsEnabled:false}},
   GetSandBoxRunState:{state:'SAND_BOX_RUN_STATE_HIBERNATED',imageUpdateAvailable:true,egressTunnelOwnership:false,image:{registryTag:'tag',staticSnapshotPath:'/snap'}},
  };
  return new Response(JSON.stringify(bodies[path]??{}),{status:200});}});
 const sessions=await client.listSessions(uuid);
 assert.equal(sessions.sessions[0].kind,'GROK_BOT_AGENT_SESSION_KIND_MAIN');
 const transcript=await client.listTranscript({botId:uuid,limit:1,generation:4,beforeSeq:'9',unreadBoundaryMs:'3'});
 assert.equal(transcript.entries[0].body.kind,'note');
 assert.equal(transcript.unreadAnchor.newerRows,2);
 assert.equal(transcript.updatedSeqLocked,false);
 assert.deepEqual(calls.find(call=>call.url.endsWith('/ListGrokBotTranscriptEntries')).body,{agentId:uuid,sessionId:'',limit:1,generation:4,beforeSeq:'9',unreadBoundaryMs:'3'});
 const statuses=await client.listAgentStatuses([uuid]);
 assert.equal(statuses.statuses[0].live.activityKind,'tool');
 assert.equal(statuses.statuses[0].client.unreadCount,2);
 assert.equal(statuses.statuses[0].client.unreadThreadCount,0);
 assert.equal((await client.getSendStatus({botId:uuid,messageId:'missing',firstSentAgeMs:'12'})).status,'not-found');
 assert.equal('taskId' in calls.find(call=>call.url.endsWith('/GetGrokBotSendStatus')).body,false);
 assert.equal((await client.listAgentTasks({botId:uuid,includeRecentlyDone:true})).tasks[0].subagentIds[0],'sub');
 assert.equal((await client.listAgentTasks({botId:uuid})).tasks[0].followed,false);
 assert.equal((await client.listTasks({botId:uuid})).tasks[0].state,'2');
 assert.equal((await client.listSubagents(uuid)).subagents[0].subagentType,'research');
 assert.equal((await client.listAgentTodos(uuid)).todos[0].status,'TODO_STATUS_PENDING');
 assert.equal((await client.listAgentSkills(uuid)).skills[0].body,'secret body');
 assert.deepEqual(await client.listDeletedAgentIds([uuid]),{agentIds:[uuid]});
 assert.equal((await client.getRuntimeCapabilities()).serverRoomsEnabled,false);
 const box=await client.getSandBoxRunState();
 assert.equal(box.runState,'hibernated');
 assert.equal(box.image.registryTag,'tag');
});

test('watch frames new in 0.75.8 stay scoped to the selected bot',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>wireResponse([
  framed({agentStateChanged:{agentId:uuid,families:['live'],changedAtMs:'11'}}),
  framed({agentState:{snapshot:true,live:[{agentId:uuid,sessionId:'',isRunning:true},{agentId:'other',sessionId:'',isRunning:true}],client:[{agentId:'other',unreadCount:1}]}}),
  framed({computerActions:{actions:[{agentId:uuid,type:'click',x:1.5,y:2,button:'left',count:1,atMs:'12'},{agentId:'other',type:'secret'}]}}),
  framed({boxState:{snapshot:false,state:{runState:3,recreateInFlight:false,updatedAtMs:'13'}}}),
  framed({pageTitleChanged:{storeId:'store',canvasId:'canvas',title:'Title',changedAtMs:'14'}}),
  framed({},2),
 ])});
 const events=await collect(client.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'}}));
 assert.equal(events.find(event=>event.type==='bot.state.changed').data.changedAtMs,'11');
 assert.deepEqual(events.find(event=>event.type==='agent.state').data.live.map(row=>row.agentId),[uuid]);
 assert.equal(events.find(event=>event.type==='agent.state').data.client.length,0);
 assert.deepEqual(events.find(event=>event.type==='computer.actions').data.actions.map(row=>row.type),['click']);
 assert.equal(events.find(event=>event.type==='box.state').data.state.runState,'running');
 assert.equal(events.find(event=>event.type==='box.state').data.state.imageTag,null);
 assert.equal(events.find(event=>event.type==='box.state').data.state.staticSnapshotMatchesPin,false);
 assert.equal(events.find(event=>event.type==='page.title.changed').data.canvasId,'canvas');
 assert.equal(events.find(event=>event.type==='page.title.changed').data.contentChanged,false);
 assert.ok(!JSON.stringify(events).includes('secret'));
});

function manageFetch(calls){
 return async(url,init)=>{
  const body=JSON.parse(init.body);
  calls.push({url,body});
  const path=url.split('/').pop();
  const roomId=body.agentId||'room-1';
  const agent={agentId:roomId,id:'server-'+roomId.slice(0,8),name:body.name||'Room',kind:'ROOM',description:body.description||'',memberAgentIds:body.memberAgentIds||[]};
  const skill={name:body.name||'skill',description:body.description||'',sourcePath:'skills/skill/SKILL.md',sourceUrl:null,content:body.content||'',environments:['dev']};
  const marketplace={marketplaceId:'17',displayName:'Desk',description:'plugins'};
  const plugin={pluginId:9,name:'p',displayName:'Plugin',description:'pd',logoUrl:null,ownedByMarketplace:true,installMode:'inline',variableNames:['TOKEN'],isDeprecated:false,mcpConfigJson:null,skills:[skill],mcpServerNames:['srv'],isBotSkills:true,connectorType:'USER',variablesJson:null,hasConfiguredVariables:false};
  const bodies={
   ListGrokBotAgents:{agents:[{agentId:uuid,id:'server-agent',name:'Bot',kind:'AGENT'},{agentId:'room-1',id:'server-room',name:'Room',kind:'ROOM'},{agentId:'room-num',id:'server-num',name:'Num',kind:2},{agentId:'room-full',id:'server-full',name:'Full',kind:'GROK_BOT_AGENT_KIND_ROOM'}]},
   DeleteGrokBotAgent:{},
   CreateGrokBotRoom:{agent},
   AddGrokBotRoomPeople:{agent:{...agent,agentId:body.agentId}},
   RemoveGrokBotRoomPeople:{agent:null},
   SetGrokBotRoomMembers:{agent:{...agent,memberAgentIds:body.memberAgentIds}},
   CreateGrokBotAgent:{agent:{agentId:body.agentId,id:'server-bot',name:body.name,kind:'AGENT'},harness:'TEMPORAL'},
   UpdateGrokBotAgent:{agent:{agentId:'kept-agent',id:body.id,name:body.name||'Kept',kind:'AGENT'}},
   AddGrokBotAgentSkill:{marketplace,plugins:[plugin],skill},
   UpdateGrokBotAgentSkill:{marketplace,plugins:[plugin],skill},
   RemoveGrokBotAgentSkill:{marketplace,plugins:[plugin]},
  };
  return new Response(JSON.stringify(bodies[path]??{}),{status:200});
 };
}

test('management writes send the 0.75.8 fields and keep destructive calls explicit',async()=>{
 feature();const calls=[];
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:manageFetch(calls)});
 const room=await client.createRoom({name:'sdk-test-room',memberAgentIds:[uuid],description:'notes',humanMemberUserIds:[7],agentId:'room-created'});
 assert.equal(room.bot.id,'room-created');assert.equal(room.bot.kind,'ROOM');
 assert.deepEqual(calls.at(-1).body,{agentId:'room-created',name:'sdk-test-room',description:'notes',memberAgentIds:[uuid],humanMemberUserIds:[7]});
 assert.ok(calls.at(-1).url.endsWith('/CreateGrokBotRoom'));
 const created=await client.createBot({name:'New',harness:2,language:'zh',kickstartRequested:false,agentId:'bot-created'});
 assert.equal(created.bot.id,'bot-created');assert.equal(created.harness,'temporal');
 assert.equal(calls.at(-1).body.harness,'TEMPORAL');assert.equal(calls.at(-1).body.language,'zh');
 assert.equal(calls.at(-1).body.description,'');assert.equal(calls.at(-1).body.kickstartRequested,false);
 assert.equal('createIntent' in calls.at(-1).body,false);
 assert.ok(calls.at(-1).url.endsWith('/CreateGrokBotAgent'));
 const updated=await client.updateBot({id:'server-agent',name:'Renamed',description:''});
 assert.equal(updated.bot.serverId,'server-agent');
 assert.deepEqual(calls.at(-1).body,{id:'server-agent',name:'Renamed',description:'',partialUpdate:true});
 assert.ok(calls.at(-1).url.endsWith('/UpdateGrokBotAgent'));
 await client.updateBot({id:'server-agent',clearAvatar:true});
 assert.deepEqual(calls.at(-1).body,{id:'server-agent',partialUpdate:true,clearAvatar:{}});
 await assert.rejects(client.updateBot({id:'server-agent',clearAvatar:true,avatarDataUrl:'data:image/png;base64,a'}),/MESSAGE_INVALID/);
 await assert.rejects(client.updateBot({id:'server-agent'}),/MESSAGE_INVALID/);
 const added=await client.addRoomMembers({roomId:'room-1',userIds:[3,4]});
 assert.equal(added.bot.id,'room-1');
 assert.deepEqual(calls.at(-1).body,{agentId:'room-1',userIds:[3,4]});
 assert.ok(calls.at(-1).url.endsWith('/AddGrokBotRoomPeople'));
 assert.deepEqual(await client.removeRoomMembers({roomId:'room-1',userIds:[3]}),{bot:null});
 assert.deepEqual(calls.at(-1).body,{agentId:'room-1',userIds:[3]});
 assert.ok(calls.at(-1).url.endsWith('/RemoveGrokBotRoomPeople'));
 const replaced=await client.setRoomMembers({roomId:'room-1',memberAgentIds:[]});
 assert.deepEqual(replaced.bot.memberAgentIds,[]);
 assert.deepEqual(calls.at(-1).body,{agentId:'room-1',memberAgentIds:[]});
 assert.ok(calls.at(-1).url.endsWith('/SetGrokBotRoomMembers'));
 const skill=await client.addAgentSkill({botId:uuid,content:'# Skill',description:''});
 assert.equal(skill.skill.content,'# Skill');assert.equal(skill.marketplace.marketplaceId,'17');assert.equal(skill.plugins[0].pluginId,'9');
 assert.deepEqual(calls.at(-1).body,{agentId:uuid,content:'# Skill',description:''});
 assert.equal('name' in calls.at(-1).body,false);
 assert.ok(calls.at(-1).url.endsWith('/AddGrokBotAgentSkill'));
 await client.updateAgentSkill({botId:uuid,name:'Skill',content:'# Next'});
 assert.deepEqual(calls.at(-1).body,{agentId:uuid,name:'Skill',content:'# Next'});
 assert.ok(calls.at(-1).url.endsWith('/UpdateGrokBotAgentSkill'));
 const removed=await client.removeAgentSkill({botId:uuid,name:'Skill'});
 assert.equal(removed.plugins[0].connectorType,'USER');assert.equal('skill' in removed,false);
 assert.deepEqual(calls.at(-1).body,{agentId:uuid,name:'Skill'});
 assert.ok(calls.at(-1).url.endsWith('/RemoveGrokBotAgentSkill'));
 assert.deepEqual(await client.deleteBot(uuid),{id:uuid});
 assert.deepEqual(calls.at(-1).body,{id:uuid});
 assert.ok(calls.at(-1).url.endsWith('/DeleteGrokBotAgent'));
 const beforeDelete=calls.length;
 assert.deepEqual(await client.deleteRoom('room-1'),{id:'room-1'});
 assert.ok(calls[beforeDelete].url.endsWith('/ListGrokBotAgents'));
 assert.deepEqual(calls.at(-1).body,{id:'room-1'});
 assert.deepEqual(await client.deleteRoom('room-num'),{id:'room-num'});
 assert.deepEqual(await client.deleteRoom('room-full'),{id:'room-full'});
 const refused=calls.length;
 await assert.rejects(client.deleteRoom(uuid),error=>error instanceof sdk.SDKError&&error.code==='NOT_A_ROOM');
 assert.equal(calls.length,refused+1);assert.ok(calls.at(-1).url.endsWith('/ListGrokBotAgents'));
 await assert.rejects(client.deleteRoom('missing-room'),/NOT_A_ROOM/);
 await assert.rejects(client.addRoomMembers({roomId:'room-1',userIds:[1.5]}),/MESSAGE_INVALID/);
 await assert.rejects(client.createRoom({name:'',memberAgentIds:[]}),/MESSAGE_INVALID/);
});

test('0.78.1 additive fields and new reads stay on the confirmed wire shape',async()=>{
 feature();const calls=[];
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body);
  calls.push({url,body});
  const path=url.split('/').pop();
  const bodies={
   SendGrokBotUserMessage:{delivery:'GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX',dispatched:true},
   ListGrokBotTranscriptEntries:{generation:1,entries:[],updatedSeqLocked:true},
   ListGrokBotAgentStatuses:{statuses:[{agentId:uuid,isRunning:false,client:{agentId:uuid,unreadThreadCount:3}}]},
   GetGrokBotSendStatus:{status:2},
   ListGrokBotAgentTasks:{tasks:[{id:'t',name:'Name',status:'open',followed:true}]},
   AddGrokBotAgentSkill:{marketplace:{marketplaceId:'1',displayName:'Desk',description:''},plugins:[{pluginId:'4',name:'p',displayName:'P',description:'',credentialSource:'DELEGATED',delegatedCredential:{delegatorDisplayName:'Ada',delegatorAvatarUrl:null,delegatorIsViewer:true,state:'ACTIVE',attachedAt:'2026-10-29T00:00:00Z'},credentialAllowedActions:['USE_DELEGATED_AUTH'],supportsServiceAccount:true,skills:[]}],skill:{name:'s',description:'',sourcePath:'',content:'',environments:[]}},
   GetGrokBotAgentCustomMcp:{server:{pluginId:body.pluginId,name:'local',http:{url:'https://mcp.example',headerNames:['Authorization'],hasOauthClientId:true,hasOauthClientSecret:false}}},
   ListGrokBotAgentAccessInvites:{invites:[{email:'a@example.com',expiresAtMs:'11',lastSharedAtMs:'12',createdAtMs:'13'}],capUsage:{used:1,limit:5}},
   PreviewGrokBotAgentAccessInvite:{found:true,recipientMatch:'MATCHES',sender:{displayName:'Ada',avatarUrl:null},invites:[{inviteId:'inv',bot:{agentId:uuid,name:'Bot',avatarUrl:null,avatarShape:'cloud',avatarColor:'brown'},role:'USER',state:'OPEN',expiresAtMs:'14'}],truncated:false,otherResourceInviteCount:2,eligibility:{eligible:false,reason:'NO_SUBSCRIPTION',currentTier:'NONE'}},
  };
  return new Response(JSON.stringify(bodies[path]??{}),{status:200});
 }});
 await client.sendMessage({botId:uuid,text:'hello',rendersMcpElicitationForms:false});
 assert.equal('rendersMcpElicitationForms' in calls.at(-1).body,false);
 await client.sendMessage({botId:uuid,text:'hello',rendersMcpElicitationForms:true});
 assert.equal(calls.at(-1).body.rendersMcpElicitationForms,true);
 assert.equal(calls.at(-1).body.source,1);
 await assert.rejects(client.sendMessage({botId:uuid,text:'hello',rendersMcpElicitationForms:'yes'}),/MESSAGE_INVALID/);
 assert.equal((await client.listTranscript({botId:uuid})).updatedSeqLocked,true);
 assert.equal((await client.listAgentStatuses([uuid])).statuses[0].client.unreadThreadCount,3);
 await client.getSendStatus({botId:uuid,messageId:'m',taskId:'task-9'});
 assert.equal(calls.at(-1).body.taskId,'task-9');
 await assert.rejects(client.getSendStatus({botId:uuid,messageId:'m',taskId:''}),/MESSAGE_INVALID/);
 assert.equal((await client.listAgentTasks({botId:uuid})).tasks[0].followed,true);
 const skill=await client.addAgentSkill({botId:uuid,content:'# Skill'});
 assert.equal(skill.plugins[0].credentialSource,'DELEGATED');
 assert.equal(skill.plugins[0].delegatedCredential.attachedAt,'2026-10-29T00:00:00Z');
 assert.deepEqual(skill.plugins[0].credentialAllowedActions,['USE_DELEGATED_AUTH']);
 assert.equal(skill.plugins[0].supportsServiceAccount,true);
 const mcp=await client.getAgentCustomMcp({botId:uuid,pluginId:'42'});
 assert.equal(calls.at(-1).body.pluginId,'42');
 assert.ok(calls.at(-1).url.endsWith('/GetGrokBotAgentCustomMcp'));
 assert.equal(mcp.server.http.url,'https://mcp.example');
 assert.equal(mcp.server.http.headerNames[0],'Authorization');
 assert.equal(mcp.server.stdio,null);
 assert.equal(mcp.server.http.hasOauthClientSecret,false);
 await assert.rejects(client.getAgentCustomMcp({botId:uuid,pluginId:-1}),/MESSAGE_INVALID/);
 const invites=await client.listAgentAccessInvites(uuid);
 assert.deepEqual(calls.at(-1).body,{agentId:uuid});
 assert.equal(invites.invites[0].email,'a@example.com');
 assert.deepEqual(invites.capUsage,{used:1,limit:5});
 const preview=await client.previewAgentAccessInvite('code-1');
 assert.deepEqual(calls.at(-1).body,{code:'code-1'});
 assert.equal(preview.found,true);
 assert.equal(preview.invites[0].bot.agentId,uuid);
 assert.equal(preview.eligibility.reason,'NO_SUBSCRIPTION');
 assert.equal(preview.otherResourceInviteCount,2);
 await assert.rejects(client.previewAgentAccessInvite(''),/MESSAGE_INVALID/);
 const watched=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>wireResponse([
  framed({boxState:{snapshot:true,state:{runState:'RUNNING',imageTag:'box',staticSnapshotPath:'/snap',imageGitSha:'abc',staticSnapshotMatchesPin:true,staticSnapshotPin:'pin'}}}),
  framed({pageTitleChanged:{storeId:'store',title:'Title',contentChanged:true,changedAtMs:'15'}}),
  framed({},2),
 ])});
 const events=await collect(watched.watchBot({botId:uuid,cursor:{generation:1,afterUpdatedSeq:'0'}}));
 const box=events.find(event=>event.type==='box.state').data.state;
 assert.equal(box.imageTag,'box');
 assert.equal(box.staticSnapshotPath,'/snap');
 assert.equal(box.imageGitSha,'abc');
 assert.equal(box.staticSnapshotMatchesPin,true);
 assert.equal(box.staticSnapshotPin,'pin');
 assert.equal(events.find(event=>event.type==='page.title.changed').data.contentChanged,true);
});

test('duplicateBot sends a client agent id and listAgentFiles maps GrokBotAgentFile',async()=>{
 feature();const calls=[];
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body);
  calls.push({url,body});
  const path=url.split('/').pop();
  if(path==='DuplicateGrokBotAgent')return new Response(JSON.stringify({agent:{agentId:body.agentId,id:'server-copy',name:'Copy',kind:'AGENT',description:'kept',title:'Title'}}),{status:200});
  if(path==='ListGrokBotAgentFiles'){
   if(body.pageToken==='bad-shape')return new Response(JSON.stringify({files:{name:'nope'}}),{status:200});
   if(body.pageToken==='empty')return new Response(JSON.stringify({}),{status:200});
   return new Response(JSON.stringify({files:[{name:'a.md',path:'/a.md',sizeBytes:12,contentType:'text/markdown',updatedAtMs:'20',etag:'abc'},null],nextPageToken:'next',totalBytes:'12',canEdit:true}),{status:200});
  }
  return new Response('{}',{status:200});
 }});
 const copied=await client.duplicateBot({botId:uuid});
 assert.match(calls.at(-1).body.agentId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
 assert.deepEqual({source:calls.at(-1).body.sourceAgentId,echo:copied.bot.id},{source:uuid,echo:calls.at(-1).body.agentId});
 assert.equal(copied.bot.serverId,'server-copy');
 assert.equal(copied.bot.name,'Copy');
 assert.equal(copied.bot.description,'kept');
 assert.ok(calls.at(-1).url.endsWith('/DuplicateGrokBotAgent'));
 const named=await client.duplicateBot({botId:uuid,newBotId:'copy-bot'});
 assert.deepEqual(calls.at(-1).body,{sourceAgentId:uuid,agentId:'copy-bot'});
 assert.equal(named.bot.id,'copy-bot');
 assert.equal(named.bot.title,'Title');
 const files=await client.listAgentFiles({botId:uuid,pageToken:'p'});
 assert.deepEqual(calls.at(-1).body,{agentId:uuid,pageToken:'p'});
 assert.ok(calls.at(-1).url.endsWith('/ListGrokBotAgentFiles'));
 assert.equal(files.files.length,1);
 assert.deepEqual(files.files[0],{name:'a.md',path:'/a.md',sizeBytes:'12',contentType:'text/markdown',updatedAtMs:'20',etag:'abc'});
 assert.equal(files.nextPageToken,'next');
 assert.equal(files.totalBytes,'12');
 assert.equal(files.canEdit,true);
 await client.listAgentFiles({botId:uuid});
 assert.equal('pageToken' in calls.at(-1).body,false);
 const empty=await client.listAgentFiles({botId:uuid,pageToken:'empty'});
 assert.deepEqual(empty,{files:[],nextPageToken:'',totalBytes:'0',canEdit:false});
 await assert.rejects(client.listAgentFiles({botId:uuid,pageToken:'bad-shape'}),error=>error instanceof sdk.SDKError&&error.code==='RPC_FAILED');
 await assert.rejects(client.listAgentFiles({botId:uuid,pageToken:1}),/MESSAGE_INVALID/);
 await assert.rejects(client.duplicateBot({botId:''}),/BOT_ID_REQUIRED/);
 await assert.rejects(client.duplicateBot({botId:uuid,newBotId:''}),/BOT_ID_REQUIRED/);
 const mismatch=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>new Response(JSON.stringify({agent:{agentId:'other-id',name:'x'}}),{status:200})});
 await assert.rejects(mismatch.duplicateBot({botId:uuid,newBotId:'copy-bot'}),error=>error instanceof sdk.SDKError&&error.code==='RPC_FAILED');
});

test('a decoded null resume cursor fails with CURSOR_INVALID before any request',async()=>{
 feature();let calls=0;const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>{calls++;throw new Error();}});
 await assert.rejects(collect(client.watchBot({botId:uuid,resumeFrom:Buffer.from('null').toString('base64url')})),error=>error instanceof sdk.SDKError&&error.code==='CURSOR_INVALID');
 assert.equal(calls,0);
});

test('listSessions treats an omitted sessions field as an empty list',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>new Response('{}',{status:200})});
 assert.deepEqual(await client.listSessions(uuid),{sessions:[]});
 const bad=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>new Response('{"sessions":{}}',{status:200})});
 await assert.rejects(bad.listSessions(uuid),/RPC_FAILED/);
});

test('list reads treat omitted repeated fields as empty lists',async()=>{
 feature();const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>new Response('{}',{status:200})});
 assert.deepEqual((await client.listTranscript({botId:uuid})).entries,[]);
 assert.deepEqual((await client.listAgentSkills(uuid)).skills,[]);
 assert.deepEqual((await client.listAgentStatuses([uuid])).statuses,[]);
});
