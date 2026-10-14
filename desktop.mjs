import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {selectDesktopAccount,decryptMacSecret} from './core.mjs';

const app='/Applications/Grok Bot.app';
export function version(){return execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',app+'/Contents/Info.plist'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
export async function desktopCredentials(){
  const doc=JSON.parse(await readFile(join(homedir(),'Library/Application Support/Grok Bot/sand-secrets.json'),'utf8'));
  const selected=selectDesktopAccount(doc);
  let password;
  try{password=execFileSync('/usr/bin/security',['find-generic-password','-s','Grok Bot Safe Storage','-w'],{encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trimEnd();}
  catch{throw new Error('KEYCHAIN_ACCESS_UNAVAILABLE');}
  const accessToken=decryptMacSecret(selected.encryptedAccessToken,password);
  let machineId,teamId;
  if(selected.storedMachineId){
    const wrapped=selected.storedMachineId.replace(/^scoped:v1:[a-f0-9]{64}:/,'');
    if(wrapped.startsWith('plaintext:v1:'))machineId=wrapped.slice('plaintext:v1:'.length);
    else machineId=decryptMacSecret(wrapped,password);
  }
  if(selected.encryptedTeamId){
    const value=decryptMacSecret(selected.encryptedTeamId,password);
    if(/^\d+$/.test(value))teamId=Number(value);
  }
  password=undefined;
  return {accessToken,machineId,teamId,version:version()};
}
