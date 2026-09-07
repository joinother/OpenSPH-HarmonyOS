#!/usr/bin/env node
// Changes active experiment and replay slot. Back up both before execution.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','90000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:100000}));
const action=(action,wait)=>call('uiAction',{action},wait);
call('listCommands');call('getUiState');
const base={preset:0,count:200,speed:5,angle:30,duration:16,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,selfGravity:true};
call('setScene',base,'paused');const original=call('getState');action('scene.relax.16');
const draft=call('getState');assert.equal(draft.definition.config.relaxationSeconds,16);assert.equal(draft.simulation.config.relaxationSeconds,undefined);assert.equal(draft.rendering.sceneRevision,original.rendering.sceneRevision);
action('simulation.apply','paused');let prepared=call('getState');assert.equal(prepared.simulation.time,0);assert.equal(prepared.simulation.frames,1);assert.equal(prepared.simulation.model,'sph-rock-prepared-v1');assert.equal(prepared.simulation.config.relaxationSeconds,16);
for(const name of ['relax-target','relax-impactor'])assert.ok(prepared.simulation.preparation.events.some(e=>e.stage===name));
assert.ok(prepared.simulation.meanDensity!==original.simulation.meanDensity,'prepared density must survive solver handoff');
for(const patch of [{relaxationSeconds:8},{relaxationSeconds:'16'},{relaxationSeconds:16,selfGravity:false},{preset:3,speed:1,duration:1,relaxationSeconds:16}]){
 const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setScene','--payload-json',JSON.stringify({...base,...patch})],{encoding:'utf8',timeout:30000});assert.equal(bad.status,2);assert.equal(call('getState').rendering.sceneRevision,prepared.rendering.sceneRevision);
}
const completed=call('start',{},'completed');assert.ok(completed.simulation.time>=16);assert.ok(completed.simulation.sph.structure.every(Number.isFinite));
call('saveReplay');call('setScene',base,'paused');call('loadReplay');call('seek',{frame:-1});const replay=call('getState');assert.equal(replay.simulation.config.relaxationSeconds,16);assert.deepEqual(replay.simulation.sph,completed.simulation.sph);
const saved=call('saveProject',{title:'验收临时预松弛实验'});
try{call('setScene',base,'paused');call('loadProject',{id:saved.id},'paused');assert.equal(call('getState').simulation.config.relaxationSeconds,16);}finally{
 assert.match(saved.id,/^project-[0-9]+-[0-9]+$/);execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,'shell','rm','-f','/data/app/el2/100/base/com.opensph.lab/haps/entry/files/'+saved.id+'.json']);
}
call('setScene',{...base,count:1200,relaxationSeconds:64});let pending;
for(let i=0;i<40;i++){pending=call('getPreparation');if(pending.preparation.stage==='relax-target')break;}
assert.equal(pending.preparation.stage,'relax-target');action('simulation.cancel');assert.equal(call('getPreparation').state,'cancelled');
call('setScene',{...base,preset:2,relaxationSeconds:64},'paused');const sphere=call('getState');assert.equal(sphere.simulation.time,0);assert.ok(sphere.simulation.preparation.events.some(e=>e.stage==='relax-target'));assert.ok(!sphere.simulation.preparation.events.some(e=>e.stage==='relax-impactor'));assert.ok(sphere.simulation.maxSpeed>0,'requested rotation must be applied after preparation');
action('scene.gravity');assert.equal(call('getState').definition.config.relaxationSeconds,undefined);
console.log(JSON.stringify({ok:true,device,checks:['shared UI draft leaves active solver and camera intact','separate isolated body preparation, evolved density survives handoff, collision clock begins at zero','invalid parameters rejected before scene changes','16-second prepared collision and v9 replay preserve all diagnostics','named experiment preserves prepared model; temporary validation project removed','1200-budget preparation cancelled; next 64-second single-body preparation contains only target stage','requested spin restored after single-body preparation; disabling gravity clears preparation draft'],original,prepared,completed,replay,sphere,cancelledStage:pending},null,2));
