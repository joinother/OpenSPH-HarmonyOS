#!/usr/bin/env node
// Back up the active history and the existing replay slot before running.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>{const args=[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)];if(wait)args.push('--wait-state',wait);return JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8',timeout:40000}));};
const action=(action,wait)=>call('uiAction',{action},wait),input=(field,value)=>call('setUiValue',{field,value});
call('listCommands');call('getUiState');action('theme.galaxy-tails','paused');
let s=call('getState');const initial=s;assert.equal(s.simulation.model,'galaxy-tidal-restricted-v1');assert.equal(s.simulation.timeUnit,'Myr');assert.equal(s.simulation.time,0);assert.equal(s.simulation.count,1600);assert.equal(s.definition.config.galaxyRetrograde,false);assert.equal(s.sky.mode,1);
let ui=call('getUiState');for(const id of ['surface.toggle','appearance.clouds','color.2'])assert.equal(ui.actions.find(a=>a.id===id).enabled,false);
input('galaxy.ratio',.4);input('galaxy.offset',20);input('scene.angle',60);input('scene.count',200);input('scene.duration',50);input('scene.speed',.9);action('galaxy.retrograde');
s=call('getState');assert.equal(s.scene.dirty,true);assert.deepEqual(s.simulation.config,initial.simulation.config);action('simulation.apply','paused');s=call('getState');assert.equal(s.simulation.config.galaxyMassRatio,.4);assert.equal(s.simulation.config.galaxyOffsetKpc,20);assert.equal(s.simulation.config.galaxyRetrograde,true);assert.equal(s.simulation.config.angle,60);assert.equal(s.simulation.count,200);
const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setScene','--payload-json',JSON.stringify({...s.definition.config,galaxyOffsetKpc:31})],{encoding:'utf8',timeout:40000});assert.equal(bad.status,2);assert.deepEqual(call('getState').simulation.config,s.simulation.config);
call('start',{},'completed');assert.equal(call('getGalaxyDiagnostics').time,50);
action('theme.galaxy-tails','paused');call('start',{},'completed');const prograde=call('getGalaxyDiagnostics');assert.equal(prograde.time,600);assert.equal(prograde.frames,151);assert.ok(prograde.diagnostics.secondaryOuterFraction>.2);assert.ok(Math.abs(prograde.centerEnergyError)<1e-4);
call('saveReplay');call('loadReplay');call('seek',{frame:-1});const replay=call('getGalaxyDiagnostics');assert.deepEqual(replay.diagnostics,prograde.diagnostics);assert.deepEqual(replay.config,prograde.config);assert.equal(replay.centerEnergyError,prograde.centerEnergyError);
call('seek',{frame:0});assert.equal(call('getGalaxyDiagnostics').time,0);call('seek',{frame:100});assert.equal(call('getGalaxyDiagnostics').time,400);
action('theme.galaxy-retrograde','paused');call('start',{},'completed');const retrograde=call('getGalaxyDiagnostics');assert.equal(retrograde.time,600);assert.ok(Math.abs(retrograde.diagnostics.secondaryOuterFraction-prograde.diagnostics.secondaryOuterFraction)>.05);
call('loadReplay');call('seek',{frame:100});action('focus.1');s=call('getState');assert.equal(s.camera.focus,1);assert.equal(s.simulation.time,400);assert.equal(s.rendering.error,'');assert.equal(s.appearance.closeup,false);
action('focus.all');
console.log(JSON.stringify({ok:true,device,checks:['preset model and Myr units','shared draft controls and explicit apply','invalid scene atomic rejection','actual completed gravity trajectories','151 frames including t=0 and t=600','v12 parameters/diagnostics exact roundtrip','seek without recompute','rotation-only comparison differs','continuous center follow without planet surface'],initial,prograde,retrograde,replay},null,2));
