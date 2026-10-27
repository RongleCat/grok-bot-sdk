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

test('default client version is 0.75.8 and roster options stay off the wire until set',async()=>{
 feature();let headers,body;
 const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async(url,init)=>{headers=init.headers;body=JSON.parse(init.body);return new Response(JSON.stringify({authId:'account',agents:[{agentId:uuid,kind:1,role:'main',createdAtMs:'10',slackConnections:[]}],truncated:false,slackConnections:[{agentId:uuid,connected:true,workspaceName:'kept-out'}],teamsConnections:[{agentId:uuid,installState:'GROK_BOT_TEAMS_INSTALL_STATE_INSTALLED',installedTeamCount:1,installedTeams:[{teamId:'t',displayName:'Team',rscGranted:true,installedAtMs:'4'}]}]}),{status:200});}});
 await client.getMe();
 assert.equal(headers['x-cursor-client-version'],'0.75.8');
 assert.match(headers['user-agent'],/Sand\/0\.75\.8/);
 const roster=await client.listBots({role:'main',addedTeamAgentsOnly:true});
 assert.deepEqual(body,{includeTeamAgents:true,role:'main',addedTeamAgentsOnly:true});
 assert.equal(roster.bots[0].kind,'1');
 assert.equal(roster.bots[0].role,'main');
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
 assert.equal(sent.isFork,false);assert.equal('machineId' in sent,false);
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
 assert.deepEqual(calls.find(call=>call.url.endsWith('/ListGrokBotTranscriptEntries')).body,{agentId:uuid,sessionId:'',limit:1,generation:4,beforeSeq:'9',unreadBoundaryMs:'3'});
 const statuses=await client.listAgentStatuses([uuid]);
 assert.equal(statuses.statuses[0].live.activityKind,'tool');
 assert.equal(statuses.statuses[0].client.unreadCount,2);
 assert.equal((await client.getSendStatus({botId:uuid,messageId:'missing',firstSentAgeMs:'12'})).status,'not-found');
 assert.equal((await client.listAgentTasks({botId:uuid,includeRecentlyDone:true})).tasks[0].subagentIds[0],'sub');
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
 assert.equal(events.find(event=>event.type==='page.title.changed').data.canvasId,'canvas');
 assert.ok(!JSON.stringify(events).includes('secret'));
});

test('a decoded null resume cursor fails with CURSOR_INVALID before any request',async()=>{
 feature();let calls=0;const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>{calls++;throw new Error();}});
 await assert.rejects(collect(client.watchBot({botId:uuid,resumeFrom:Buffer.from('null').toString('base64url')})),error=>error instanceof sdk.SDKError&&error.code==='CURSOR_INVALID');
 assert.equal(calls,0);
});
