import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let avatar={};
try{avatar=await import('../avatar.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const fixture=JSON.parse(await readFile(new URL('./fixtures/avatar-vectors.json',import.meta.url),'utf8'));
const feature=name=>assert.equal(typeof avatar[name],'function',`${name} must exist`);

test('default avatar matches independent uint32/UTF-16 reference vectors',()=>{
  feature('deriveDefaultAvatar');
  for(const expected of fixture.vectors){
    const actual=avatar.deriveDefaultAvatar(expected.key);
    for(const field of ['hash','shapeHash','shapeIndex','colorIndex','shape','color'])assert.equal(actual[field],expected[field],`${expected.key}: ${field}`);
  }
});

test('cloud roster uses agentId UUID rather than the numeric server id or name',()=>{
  feature('resolveAgentAvatar');
  const resolved=avatar.resolveAgentAvatar({id:'11635495',agentId:'33cf1aae-3a51-452d-b761-34a6ccb62201',name:'Webhook 测试员'});
  assert.equal(resolved.character.shape,'cloud');
  assert.equal(resolved.character.color,'brown');
  assert.deepEqual(resolved.sources,{shape:'id-default',color:'id-default'});
  assert.throws(()=>avatar.resolveAgentAvatar({id:'11635495',name:'Webhook 测试员'}),/AVATAR_AGENT_ID_REQUIRED/);
});

test('explicit valid fields override each default independently, including black and non-default shapes',()=>{
  feature('resolveAgentAvatar');
  const agentId='33cf1aae-3a51-452d-b761-34a6ccb62201';
  const partial=avatar.resolveAgentAvatar({agentId,avatarShape:'heart',avatarColor:''});
  assert.equal(partial.character.shape,'heart');assert.equal(partial.character.color,'brown');
  assert.deepEqual(partial.sources,{shape:'explicit',color:'id-default'});
  const black=avatar.resolveAgentAvatar({agentId,avatarShape:'unknown',avatarColor:'black'});
  assert.equal(black.character.shape,'cloud');assert.equal(black.character.color,'black');
  assert.deepEqual(black.sources,{shape:'id-default',color:'explicit'});
});

test('a custom picture takes precedence while retaining derived character metadata',()=>{
  feature('resolveAgentAvatar');
  const result=avatar.resolveAgentAvatar({agentId:'fixture',avatarUrl:'https://example.invalid/avatar.png',avatarVersion:'v1'});
  assert.equal(result.kind,'picture');
  assert.equal(result.picture.url,'https://example.invalid/avatar.png');
  assert.equal(avatar.resolveAgentAvatar({agentId:'fixture',avatarVersion:'v1'}).kind,'picture');
});

test('brown base palette and theme-specific static icon colors are distinct',()=>{
  feature('deriveDefaultAvatar');
  const result=avatar.deriveDefaultAvatar('33cf1aae-3a51-452d-b761-34a6ccb62201');
  assert.equal(result.baseHex,'#936439');
  assert.equal(result.lightHex,'#A27952');
  assert.equal(result.darkHex,'#855C36');
});

test('non-string explicit fields cannot impersonate valid palette keys',()=>{
  feature('resolveAgentAvatar');
  const result=avatar.resolveAgentAvatar({agentId:'33cf1aae-3a51-452d-b761-34a6ccb62201',avatarShape:['heart'],avatarColor:['blue']});
  assert.equal(result.character.shape,'cloud');
  assert.equal(result.character.color,'brown');
  assert.deepEqual(result.sources,{shape:'id-default',color:'id-default'});
});
