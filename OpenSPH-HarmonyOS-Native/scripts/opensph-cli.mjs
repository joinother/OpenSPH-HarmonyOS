#!/usr/bin/env node
// Independently implemented HDC/Want transport. No network listener in the app.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const defaults = { hdc: '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc', timeout: 20000 };
export function options(argv) {
  const o = {...defaults};
  for (let i=0;i<argv.length;i++) {
    const key = argv[i];
    if(key==='--json') continue;
    if(key==='--wait-camera'){o['wait-camera']=true;continue;}
    if(key==='--list') {o.command='listCommands';continue;}
    if(key==='--help') {o.help=true;continue;}
    if(!['--device','--command','--payload-json','--payload-file','--batch','--wait-state','--hdc','--timeout'].includes(key)||i+1>=argv.length) throw Error('Unknown or incomplete option: '+key);
    o[key.slice(2)] = argv[++i];
  }
  if(o.help) return o;
  if(!o.device) throw Error('--device is required (avoid operating on another connected device)');
  if(!/^[A-Za-z0-9_.:-]+$/.test(o.device)) throw Error('Invalid device ID');
  if(!o.batch&&!/^[A-Za-z]{1,32}$/.test(o.command||'')) throw Error('--command or --list is required');
  o.timeout=Number(o.timeout);
  if(!Number.isFinite(o.timeout)||o.timeout<1000||o.timeout>120000) throw Error('Timeout must be 1000..120000 ms');
  if(o['payload-json']&&o['payload-file'])throw Error('Choose payload JSON or payload file');
  if(o.batch&&(o.command||o['payload-json']||o['payload-file']||o['wait-state']||o['wait-camera']))throw Error('Batch cannot be combined with a single command');
  if(o['wait-state']&&!['paused','running','completed','replay','cancelled','failed'].includes(o['wait-state']))throw Error('Invalid wait state');
  const p=JSON.parse(o['payload-file']?readFileSync(o['payload-file'],'utf8'):(o['payload-json']||'{}'));
  if(!p||Array.isArray(p)||typeof p!=='object') throw Error('Payload must be a JSON object');
  // Encode shell metacharacters as well as JSON/Unicode: hdc shell rejoins argv remotely.
  o.payload=encodeURIComponent(JSON.stringify(p)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
  if(o.payload.length>16384) throw Error('Payload too large');
  return o;
}
export function collect(log, id, parts = new Map()) {
  let total;
  for(const line of log.split(/\r?\n/)) {
    const at=line.indexOf('SPHCLI '+id+' ');
    if(at<0) continue;
    const m=line.slice(at).match(/^SPHCLI [\w-]+ (\d+)\/(\d+) (.*)$/);
    if(!m) continue;
    const index=Number(m[1]), count=Number(m[2]);
    if(count<1||count>256||index>=count) throw Error('Invalid response chunk');
    if(total!==undefined&&total!==count) throw Error('Inconsistent response chunk count');
    total=count;parts.set(index,m[3]);
  }
  if(total===undefined||parts.size!==total) return undefined;
  return JSON.parse(Array.from({length:total},(_,i)=>parts.get(i)).join(''));
}
export async function request(o) {
  const id=randomUUID();
  const shell=(args)=>execFileSync(o.hdc,['-t',o.device,'shell',...args],{encoding:'utf8',timeout:Math.min(o.timeout,10000),maxBuffer:2*1024*1024});
  const started=shell(['aa','start','-b','com.opensph.lab','-a','EntryAbility','--ps','sph.command',o.command,'--ps','sph.request',id,'--ps','sph.payload',o.payload]);
  if(!/success/i.test(started)) throw Error('Ability launch failed: '+started.trim());
  const deadline=Date.now()+o.timeout, parts=new Map();let lastProgress=Date.now(),lastCount=0,retries=0;
  while(Date.now()<deadline) {
    const value=collect(shell(['hilog','-x','-T','SPHCLI','-e',id]),id,parts);
    if(value!==undefined)return value;
    if(parts.size!==lastCount){lastCount=parts.size;lastProgress=Date.now();}
    // Re-emit an already computed response under the same id; never repeat a mutation.
    if(parts.size>0&&Date.now()-lastProgress>2000&&retries<3){
      shell(['aa','start','-b','com.opensph.lab','-a','EntryAbility','--ps','sph.command','retryReply','--ps','sph.request',id]);
      retries++;lastProgress=Date.now();
    }
    await delay(200);
  }
  throw Error('Timed out waiting for device response '+id+'; received '+parts.size+' chunks. Check application logs.');
}
async function requestAndWait(o) {
  let result=await request(o);
  if(o['wait-camera']&&result.ok===true){
    const id=result.cameraMotion?.requestId;
    if(!Number.isInteger(id)||id<=0)return {ok:false,error:'Command did not produce a camera request',result};
    const deadline=Date.now()+o.timeout;
    for(;;){
      const response=await request({...o,command:'getCameraMotion',payload:encodeURIComponent(JSON.stringify({requestId:id}))});
      if(response.ok!==true)return response;
      const motion=response.cameraMotion;
      if(motion.state==='completed'){result={...result,cameraMotion:motion};break;}
      if(motion.state==='cancelled')return {ok:false,error:'Camera request cancelled: '+motion.reason,cameraMotion:motion};
      if(Date.now()>=deadline)return {ok:false,error:'Timed out waiting for camera request '+id,cameraMotion:motion};
      await delay(80);
    }
  }
  if(!o['wait-state']||result.ok!==true)return result;
  return waitForSimulation(o,result);
}
export async function waitForSimulation(o,result,io={request,now:Date.now,delay}) {
  const expected=result.simulation?.preparation?.requestId??result.preparation?.requestId;
  const deadline=io.now()+o.timeout;let state=result;
  const failure=error=>({ok:false,error,state,preparation:state.simulation?.preparation??state.preparation});
  while(io.now()<deadline){
    let next;
    try{next=await io.request({...o,timeout:Math.max(1,Math.min(o.timeout,deadline-io.now())),command:'getState',payload:'%7B%7D'});}
    catch(error){return failure(String(error.message??error));}
    if(next.ok!==true)return {...next,state,preparation:state.simulation?.preparation??state.preparation};
    state=next;
    const actual=state.simulation?.preparation?.requestId;
    if(expected>0&&actual!==undefined&&actual!==expected)return failure('Simulation request was replaced while waiting');
    if(state.simulation?.state===o['wait-state'])return state;
    if(state.simulation?.state==='failed')return failure(state.simulation.error);
    if(state.simulation?.state==='cancelled')return failure('Simulation was cancelled while waiting');
    await io.delay(150);
  }
  return failure('Timed out waiting for state '+o['wait-state']);
}

export async function run(argv) {
  const o=options(argv);
  if(o.help){console.log('node scripts/opensph-cli.mjs --device <HDC ID> --command getUiState\n--command uiAction --payload-json \'{"action":"orbit.add"}\'\n--payload-file config.json | --batch commands.json\n--wait-state paused waits for a solver state. --wait-camera waits for the returned camera request; cancellation is a failure. Batch: waitForCamera:true. --list lists commands.');return;}
  let result;
  if(o.batch){
    const batch=JSON.parse(readFileSync(o.batch,'utf8'));
    if(!Array.isArray(batch)||!batch.length||batch.length>100)throw Error('Batch requires 1–100 requests');
    // Validate every envelope before dispatching any mutation. Runtime failure stops the sequence.
    const requests=batch.map(item=>{
      if(!item||typeof item.command!=='string'||(item.waitForState!==undefined&&typeof item.waitForState!=='string'))throw Error('Invalid batch request');
      const args=['--device',o.device,'--hdc',o.hdc,'--timeout',String(o.timeout),'--command',item.command,'--payload-json',JSON.stringify(item.payload??{})];
      if(item.waitForState)args.push('--wait-state',item.waitForState);
      if(item.waitForCamera!==undefined&&typeof item.waitForCamera!=='boolean')throw Error('waitForCamera must be boolean');
      if(item.waitForCamera)args.push('--wait-camera');
      return options(args);
    });
    const results=[];let ok=true;
    for(let index=0;index<requests.length;index++){
      let value;try{value=await requestAndWait(requests[index]);}catch(e){value={ok:false,error:e.message};}
      results.push({index,command:requests[index].command,result:value});
      if(value.ok!==true){ok=false;break;}
    }
    result={ok,completed:results.length,total:requests.length,results};
  } else result=await requestAndWait(o);
  console.log(JSON.stringify(result,null,2));if(result.ok!==true)process.exitCode=2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;});
}
