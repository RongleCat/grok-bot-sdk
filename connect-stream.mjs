import {SDKError} from './errors.mjs';
export function encodeConnectFrame(data){
  const payload=Buffer.from(JSON.stringify(data));
  const header=Buffer.alloc(5);header.writeUInt32BE(payload.length,1);
  return Buffer.concat([header,payload]);
}

export async function* readConnectFrames(body,{maxFrameBytes=1024*1024,onClose=()=>{}}={}){
  if(!body?.getReader)throw new SDKError('STREAM_INVALID_RESPONSE');
  const reader=body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
  let pending=Buffer.alloc(0);
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)throw new SDKError('STREAM_UNEXPECTED_EOF');
      pending=Buffer.concat([pending,Buffer.from(value)]);
      while(pending.length>=5){
        const flags=pending[0],length=pending.readUInt32BE(1);
        if(length>maxFrameBytes)throw new SDKError('STREAM_FRAME_TOO_LARGE');
        if(flags&1)throw new SDKError('STREAM_COMPRESSION_UNSUPPORTED');
        if(flags!==0&&flags!==2)throw new SDKError('STREAM_FLAGS_INVALID');
        if(pending.length<5+length)break;
        let data;
        try{data=JSON.parse(decoder.decode(pending.subarray(5,5+length)));}catch{throw new SDKError('STREAM_INVALID_JSON');}
        pending=pending.subarray(5+length);
        if(!data||typeof data!=='object'||Array.isArray(data))throw new SDKError('STREAM_INVALID_JSON');
        if(flags===2){
          if(Object.hasOwn(data,'error'))throw new SDKError('STREAM_RPC_ERROR');
          if(pending.length)throw new SDKError('STREAM_END_INVALID');
          return;
        }
        yield data;
      }
    }
  }finally{onClose();await reader.cancel().catch(()=>{});reader.releaseLock();}
}
