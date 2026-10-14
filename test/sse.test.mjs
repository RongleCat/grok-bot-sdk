import test from 'node:test';
import assert from 'node:assert/strict';
let sse={};try{sse=await import('../sse.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const feature=()=>assert.equal(typeof sse.eventsToSSE,'function','eventsToSSE must exist');

test('SSE JSON content cannot inject event/id fields through text newlines',async()=>{
 feature();async function* source(){yield {type:'message',id:'cursor-safe',data:{text:'中文\nevent: injected\nid: stolen'}};}
 const response=sse.eventsToSSE(source(),{keepAliveMs:0});const text=await response.text();
 assert.ok(response.headers.get('content-type').startsWith('text/event-stream'));
 assert.ok(text.includes('event: message\nid: cursor-safe\ndata: '));
 assert.ok(!text.includes('\nevent: injected\n'));assert.ok(text.includes('\\nevent: injected'));
});

test('stream failures become a fixed error event with no sensitive cause',async()=>{
 feature();async function* source(){throw new Error('credential secret leaked upstream');}
 const text=await sse.eventsToSSE(source(),{keepAliveMs:0}).text();
 assert.ok(text.includes('event: error'));assert.ok(!text.includes('credential'));assert.ok(!text.includes('leaked'));
});

test('downstream cancellation invokes the upstream abort hook',async()=>{
 feature();let cancelled=false;async function* source(){yield {type:'connected',data:{}};}
 const response=sse.eventsToSSE(source(),{keepAliveMs:0,onCancel:()=>{cancelled=true;}});
 const reader=response.body.getReader();await reader.read();await reader.cancel();assert.equal(cancelled,true);
});
