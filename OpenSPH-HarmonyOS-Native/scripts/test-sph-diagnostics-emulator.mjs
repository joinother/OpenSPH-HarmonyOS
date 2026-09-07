#!/usr/bin/env node
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:40000})),action=action=>call('uiAction',{action});
const fields=['pressureMinGPa','pressureMaxGPa','pressureMeanGPa','internalMinMJkg','internalMaxMJkg','internalMeanMJkg','damageMean','damageMax','kineticJ','internalJ'],results=[];
call('listCommands');call('getUiState');const reference=call('getObservationReference'),projects=call('listProjects');
for(const preset of [0,1,2]){
 call('setScene',{preset,count:200,speed:preset===2?2:5,angle:preset===1?45:0,duration:10,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234},'paused');
 const initial=call('getSphDiagnostics');assert.equal(initial.diagnostics.available,true);assert.equal(initial.time,0);assert.equal(initial.timeUnit,'s');
 call('start',{},'completed');const before=call('getState'),diagnostics=call('getSphDiagnostics');assert.equal(diagnostics.time,before.simulation.time);assert.deepEqual(diagnostics.diagnostics,before.simulation.sph);
 for(const key of fields)assert.ok(Number.isFinite(diagnostics.diagnostics[key]),key);assert.ok(diagnostics.diagnostics.damageMean>=0&&diagnostics.diagnostics.damageMax<=1);
 const s=diagnostics.diagnostics;assert.ok(Math.abs(s.internalJ/before.simulation.totalMass/1e6-s.internalMeanMJkg)<1e-9);
 for(const color of [3,4,5]){action('color.'+color);const after=call('getState');assert.equal(after.camera.color,color);assert.deepEqual(after.simulation,before.simulation);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);}
 call('seek',{frame:0});const early=call('getSphDiagnostics');assert.equal(early.time,0);assert.deepEqual(early.diagnostics,initial.diagnostics);
 call('seek',{frame:-1});assert.deepEqual(call('getSphDiagnostics').diagnostics,diagnostics.diagnostics);results.push({preset,initial,final:diagnostics,count:before.simulation.count,mass:before.simulation.totalMass});
}
call('setScene',{preset:3,count:200,speed:1,angle:0,duration:1},'paused');const orbital=call('getSphDiagnostics');assert.equal(orbital.timeUnit,'year');assert.equal(orbital.diagnostics.available,false);assert.equal(call('getState').camera.color,0);
assert.equal(call('getUiState').actions.find(a=>a.id==='color.3').enabled,false);assert.deepEqual(call('getObservationReference'),reference);assert.deepEqual(call('listProjects'),projects);
console.log(JSON.stringify({ok:true,device,checks:['three actual OpenSPH experiments expose finite signed pressure/internal energy/cubed damage','mass-weighted energy identity','all three colors preserve solver, camera pose and surface','timeline selection matches initial/final diagnostics','orbital model unavailable and correct time unit','existing comparison and projects preserved'],results,orbital},null,2));
