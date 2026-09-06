#!/usr/bin/env node
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const device=process.argv[2];
if(!device||!/^[A-Za-z0-9_.:-]+$/.test(device))throw Error('Specify the test device');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const hdc=process.env.HDC||'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
function cmd(command,payload={},error=false){
 const r=spawnSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:35000});
 const v=JSON.parse(r.stdout||r.stderr);assert.equal(r.status,error?2:0,r.stderr);return v;
}
async function ready(state='paused'){
 for(let i=0;i<120;i++){const s=cmd('getState');if(s.simulation.state==='failed')throw Error(s.simulation.error);if(s.simulation.state===state)return s;await delay(250);}throw Error('State timeout');
}
const a={preset:0,count:200,speed:3,angle:20,duration:1,targetRadiusKm:80,impactorRadiusKm:40,targetDensity:2600,impactorDensity:2800,targetSpin:0.002,seed:4321};
cmd('setScene',a);const initial=await ready();
assert.deepEqual(initial.simulation.config,a);
const expected=4*Math.PI/3*((80000**3)*2600+(40000**3)*2800);
assert.ok(Math.abs(initial.simulation.totalMass/expected-1)<0.02,'native mass must reflect edited geometry');
cmd('setScene',{...a,targetRadiusKm:0},true);assert.deepEqual(cmd('getState').simulation.config,a);
const savedA=cmd('saveProject',{title:'撞击比较 A · 80 km'});
cmd('setScene',{...a,targetRadiusKm:120,seed:5678});await ready();
const savedB=cmd('saveProject',{title:'撞击比较 B · 120 km'});
assert.notEqual(savedA.id,savedB.id);
const list=cmd('listProjects');assert.ok(list.projects.some(p=>p.id===savedA.id)&&list.projects.some(p=>p.id===savedB.id));
cmd('loadProject',{id:'../scene'},true);
execFileSync(hdc,['-t',device,'shell','aa','force-stop','com.opensph.lab']);
cmd('loadProject',{id:savedA.id});const loaded=await ready();assert.deepEqual(loaded.simulation.config,a);
assert.equal(loaded.definition.title,'撞击比较 A · 80 km');
cmd('start');await ready('completed');cmd('saveReplay');
cmd('loadProject',{id:savedB.id});await ready();cmd('loadReplay');
assert.deepEqual(cmd('getState').definition.config,a,'replay must restore its own simulation config');
cmd('loadProject',{id:savedB.id});await ready();cmd('setPanel',{panel:2});
console.log(JSON.stringify({ok:true,device,projects:[savedA.id,savedB.id],checks:['custom native config and mass','invalid input preserves config','multiple project files','path validation','cold launch project restoration','replay restores original config']},null,2));
