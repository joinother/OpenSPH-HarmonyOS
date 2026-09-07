#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:70000}));
const action=(action,wait)=>call('uiAction',{action},wait);
call('listCommands');call('getUiState');const projects=call('listProjects'),reference=call('getObservationReference');
const catalog=call('listExperiments');assert.equal(catalog.experiments.length,12);
const coarse=catalog.experiments.find(t=>t.id==='resolution-coarse'),fine=catalog.experiments.find(t=>t.id==='resolution-fine');
assert.deepEqual({...coarse.config,count:1200},fine.config);assert.equal(coarse.cover,'rock-oblique');
action('theme.resolution-coarse','paused');const results=[];
for(const theme of [coarse,fine]) {
 const initial=call('getState');assert.deepEqual(initial.definition.config,theme.config);assert.equal(initial.theme.id,theme.id);assert.equal(initial.simulation.state,'paused');assert.equal(initial.ui.panelOpen,false);
 call('start',{},'completed');const before=call('getState');
 action('theme.observe');const after=call('getState'),curve=call('getSphObservation'),diagnostic=call('getSphDiagnostics');
 assert.equal(after.ui.panelOpen,true);assert.equal(after.ui.panel,1);assert.equal(curve.metric,'pressure');assert.ok(curve.plot.available);
 assert.deepEqual(after.definition,before.definition);assert.deepEqual(after.camera,before.camera);
 assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);assert.equal(after.simulation.time,before.simulation.time);
 assert.equal(diagnostic.diagnostics.available,true);assert.ok(curve.data.samples.at(-1).time>=16);assert.ok(curve.data.samples.at(-1).time<16.2);
 assert.equal(call('getSphTable').rows,curve.data.samples.length);
 results.push({theme:theme.id,initial:initial.simulation,final:diagnostic,plot:curve.plot});
 action('theme.compare','paused');
}
assert.deepEqual(call('getState').definition.config,coarse.config);
assert.deepEqual(call('listProjects'),projects);assert.deepEqual(call('getObservationReference'),reference);
console.log(JSON.stringify({ok:true,device,checks:['two illustrated resolution themes differ only in budget','shared compare action returns to identical initial conditions','actual adaptive OpenSPH runs complete','observe action preserves native scene camera time and results','curves and raw CSV available','projects and orbital reference untouched'],results},null,2));
