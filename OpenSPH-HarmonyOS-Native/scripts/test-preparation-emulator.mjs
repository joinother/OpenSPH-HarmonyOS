#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const args=(command,payload={},wait,timeout=60000)=>[cli,'--device',device,'--timeout',String(timeout),'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])];
const call=(command,payload,wait)=>JSON.parse(execFileSync(process.execPath,args(command,payload,wait),{encoding:'utf8',timeout:70000}));
const action=(action,wait)=>call('uiAction',{action},wait);
call('listCommands');call('getUiState');const projects=call('listProjects'),reference=call('getObservationReference'),results=[];
let lastId=0;
for(const [preset,count] of [[0,2400],[1,1200],[2,200],[3,600],[0,200],[0,1200]]) {
 const initial=call('setScene',{preset,count,speed:preset>=3?1:5,angle:preset===1?45:0,duration:1,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234},'paused');
 const p=initial.simulation.preparation;
 assert.ok(p.requestId>lastId);lastId=p.requestId;assert.equal(p.stage,'ready');assert.equal(p.slow,false);assert.equal(p.previousRequestId,0);
 const stages=['queued','starting',...(preset>=3?['orbits']:preset===2?['target','solver']:['target','impactor','solver']),'snapshot','ready'];
 assert.deepEqual(p.events.map(e=>e.stage),stages);assert.ok(p.elapsedMs>=0);assert.equal(p.stageMs,0);
 for(let i=1;i<p.events.length;i++)assert.ok(p.events[i].elapsedMs>=p.events[i-1].elapsedMs);
 const diagnostic=call('getPreparation'),unchanged=call('getState');
 assert.equal(diagnostic.state,'paused');assert.deepEqual(diagnostic.preparation,p);assert.deepEqual(unchanged.simulation,initial.simulation);assert.deepEqual(unchanged.definition,initial.definition);assert.deepEqual(unchanged.camera,initial.camera);
 const cancelled=action('simulation.cancel');assert.equal(cancelled.simulation.state,'cancelled');assert.deepEqual(cancelled.simulation.preparation,p);assert.deepEqual(cancelled.definition,initial.definition);
 const rejected=spawnSync(process.execPath,args('uiAction',{action:'simulation.cancel'}),{encoding:'utf8',timeout:70000});assert.equal(rejected.status,2);
 const restarted=call('start',{},'completed');assert.ok(restarted.simulation.preparation.requestId>lastId);lastId=restarted.simulation.preparation.requestId;assert.ok(restarted.simulation.time>=1);assert.equal(restarted.rendering.error,'');
 results.push({preset,count,preparation:p,restarted:restarted.simulation});
}
// A real CLI timeout on an intentionally paused scene retains the last device snapshot.
action('theme.resolution-coarse','paused');
const timeout=spawnSync(process.execPath,args('getState',{},'completed',1500),{encoding:'utf8',timeout:10000});assert.equal(timeout.status,2);const failure=JSON.parse(timeout.stdout);
assert.equal(failure.ok,false);assert.equal(failure.state.simulation.state,'paused');assert.equal(failure.preparation.stage,'ready');assert.ok(failure.preparation.requestId>0);assert.ok(failure.error.length>0);
assert.deepEqual(call('listProjects'),projects);assert.deepEqual(call('getObservationReference'),reference);
console.log(JSON.stringify({ok:true,device,checks:['six SPH/orbit preparation traces including maximum budget','monotonic request IDs and stage timings','read-only diagnostics and frozen ready timers','shared cancel action preserves initial conditions; repeated cancel rejected','restart after cancel completes','actual CLI timeout preserves last device snapshot','user projects and reference untouched'],limits:['15-second warning threshold tested with deterministic native clock, not a forced application stall','physical touch during transient preparation not asserted','old 0.30 preparation stall root cause remains unknown'],timeout:failure,results},null,2));
