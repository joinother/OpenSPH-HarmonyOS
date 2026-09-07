#!/usr/bin/env node
// Mutates the active experiment and last replay; caller must back up both.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
function call(command,payload={},wait){const a=[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)];if(wait)a.push('--wait-state',wait);return JSON.parse(execFileSync(process.execPath,a,{encoding:'utf8',timeout:45000}));}
call('listCommands');const catalog=call('getUiState');assert.ok(catalog.actions.some(a=>a.id==='scene.gravity'));
const config={preset:0,count:200,speed:5,angle:0,duration:16,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234};
call('setScene',config,'paused');call('uiAction',{action:'scene.gravity'});
let s=call('getState');assert.equal(s.definition.config.selfGravity,true);assert.equal(s.simulation.config.selfGravity,undefined);
call('uiAction',{action:'simulation.apply'},'paused');s=call('getState');assert.equal(s.simulation.config.selfGravity,true);assert.equal(s.simulation.model,'sph-rock-gravity-v1');
for(const bad of [{...config,selfGravity:true,count:1400},{...config,selfGravity:'true'},{...config,preset:3,speed:1,duration:1,selfGravity:true}]){
 const rejected=spawnSync(process.execPath,[cli,'--device',device,'--command','setScene','--payload-json',JSON.stringify(bad)],{encoding:'utf8',timeout:45000});assert.equal(rejected.status,2);assert.deepEqual(call('getState').definition,s.definition);
}
const completed=call('start',{},'completed');assert.equal(completed.simulation.state,'completed');assert.equal(completed.simulation.sph.available,true);assert.ok(completed.simulation.time>=16&&completed.simulation.time<16.2);assert.ok(completed.simulation.sph.pressureMaxGPa>0);
call('saveReplay');call('setScene',config,'paused');call('loadReplay');call('uiAction',{action:'replay.latest'});const replay=call('getState');assert.equal(replay.simulation.model,'sph-rock-gravity-v1');assert.equal(replay.definition.config.selfGravity,true);assert.deepEqual(replay.simulation.sph,completed.simulation.sph);
// Fresh application of the restored config must keep self-gravity enabled.
call('uiAction',{action:'simulation.apply'},'paused');assert.equal(call('getState').simulation.config.selfGravity,true);
call('setPanel',{panel:0});
console.log(JSON.stringify({ok:true,device,checks:['UI draft does not mutate active solver','apply enables native self-gravity','invalid configs rejected transactionally','16-second collision completes with pressure diagnostics','v6 replay preserves model and all ten diagnostics','reapply preserves gravity'],completed,replay},null,2));
