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

test('a decoded null resume cursor fails with CURSOR_INVALID before any request',async()=>{
 feature();let calls=0;const client=new sdk.GrokBotClient({accessToken:'fixture',fetchImpl:async()=>{calls++;throw new Error();}});
 await assert.rejects(collect(client.watchBot({botId:uuid,resumeFrom:Buffer.from('null').toString('base64url')})),error=>error instanceof sdk.SDKError&&error.code==='CURSOR_INVALID');
 assert.equal(calls,0);
});
