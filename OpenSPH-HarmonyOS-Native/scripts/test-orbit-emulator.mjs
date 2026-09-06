#!/usr/bin/env node
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const device=process.argv[2];if(!device)throw Error('Explicit HDC target required');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
function cmd(command,payload={},failure=false){
 const r=spawnSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:35000});
 if(r.error)throw r.error;const value=JSON.parse(r.stdout||r.stderr);assert.equal(r.status,failure?2:0,r.stderr);return value;
}
async function until(test){for(let i=0;i<100;i++){const s=cmd('getState');if(s.simulation.state==='failed')throw Error(s.simulation.error);if(test(s))return s;await delay(100);}throw Error('Orbit condition timeout');}
const scene={preset:4,count:600,speed:1,angle:0,duration:3};
cmd('setScene',scene);const first=await until(s=>s.simulation.state==='paused');
assert.equal(first.simulation.model,'nbody-v1');assert.equal(first.simulation.timeUnit,'year');assert.equal(first.simulation.bodies.length,4);
cmd('setScene',{...scene,speed:5},true);assert.equal(cmd('getState').scene.speed,1);
cmd('start');await delay(750);cmd('pause');const a=cmd('getState');await delay(150);const b=cmd('getState');assert.equal(a.simulation.time,b.simulation.time);
assert.notDeepEqual(a.simulation.bodies,first.simulation.bodies);
cmd('start');const end=await until(s=>s.simulation.state==='completed');
assert.equal(end.simulation.time,3);assert.equal(end.simulation.frames,240);assert.ok(Math.abs(end.simulation.energyError)<1e-7);
const project=cmd('saveProject',{title:'行星轨道 · 0.6 验证'});
cmd('saveReplay');cmd('setScene',{preset:0,count:200,speed:5,angle:0,duration:1});await until(s=>s.simulation.state==='paused');
cmd('loadReplay');cmd('seek',{frame:-1});const loaded=cmd('getState');
assert.equal(loaded.scene.preset,4);assert.deepEqual(loaded.simulation.bodies,end.simulation.bodies);assert.equal(loaded.simulation.energyError,end.simulation.energyError);
cmd('loadProject',{id:project.id});const reopened=await until(s=>s.simulation.state==='paused');
assert.equal(reopened.definition.model,'nbody-v1');assert.equal(reopened.scene.preset,4);assert.equal(reopened.simulation.time,0);
cmd('loadReplay');cmd('seek',{frame:-1});cmd('setCamera',{yaw:0.15,pitch:0.25,zoom:2.1,focus:-1,color:0});cmd('setPanel',{panel:-1});
console.log(JSON.stringify({ok:true,device,checks:['native orbit movement','pause stable','invalid orbit config atomicity','3 years completion','240-frame limit','energy diagnostic','v3 bodies and diagnostics roundtrip','saved orbit project reconstruction'],final:cmd('getState')},null,2));
