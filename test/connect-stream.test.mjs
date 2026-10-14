import test from 'node:test';
import assert from 'node:assert/strict';
let mod={};try{mod=await import('../connect-stream.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const feature=()=>assert.equal(typeof mod.readConnectFrames,'function','readConnectFrames must exist');
function frame(data,flag=0){const payload=Buffer.from(JSON.stringify(data)),header=Buffer.alloc(5);header[0]=flag;header.writeUInt32BE(payload.length,1);return Buffer.concat([header,payload]);}
const body=chunks=>new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(chunk);c.close();}});
const collect=async values=>{const result=[];for await(const value of values)result.push(value);return result;};

test('reassembles Connect headers/payloads across chunks including split UTF-8',async()=>{
 feature();const bytes=Buffer.concat([frame({rows:{text:'中文🤖'}}),frame({},2)]);
 const chunks=Array.from(bytes,x=>Uint8Array.of(x));
 assert.deepEqual(await collect(mod.readConnectFrames(body(chunks))),[{rows:{text:'中文🤖'}}]);
});

test('an error in the terminal frame fails even after HTTP 200 data was received',async()=>{
 feature();await assert.rejects(collect(mod.readConnectFrames(body([frame({connected:{}}),frame({error:{code:'unauthenticated',message:'private token'}},2)]))),/STREAM_RPC_ERROR/);
});

test('a declared oversized frame and a missing end envelope are rejected',async()=>{
 feature();const header=Buffer.alloc(5);header.writeUInt32BE(1024*1024+1,1);
 await assert.rejects(collect(mod.readConnectFrames(body([header]))),/STREAM_FRAME_TOO_LARGE/);
 await assert.rejects(collect(mod.readConnectFrames(body([frame({heartbeat:{}})]))),/STREAM_UNEXPECTED_EOF/);
});

test('unsupported compressed frames fail without parsing them as JSON',async()=>{
 feature();await assert.rejects(collect(mod.readConnectFrames(body([frame({secret:'do-not-log'},1)]))),/STREAM_COMPRESSION_UNSUPPORTED/);
});
