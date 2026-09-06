#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=(action,wait)=>call('uiAction',{action},wait),input=(field,value)=>call('setUiValue',{field,value});
call('listCommands');call('getUiState');if(call('getState').placement.active)action('placement.cancel');action('preset.5','paused');call('start',{},'completed');call('seek',{frame:70});action('panel.close');input('orbit.name','保留原编辑草稿');
const before=call('getState');action('orbit.add');assert.equal(call('getState').placement.active,true);
function preserved(){const s=call('getState');assert.deepEqual(s.definition,before.definition);assert.equal(s.simulation.time,before.simulation.time);assert.equal(s.simulation.selected,before.simulation.selected);assert.equal(s.simulation.frames,before.simulation.frames);assert.equal(s.rendering.surfaceStarts,before.rendering.surfaceStarts);assert.equal(s.rendering.sceneRevision,before.rendering.sceneRevision);return s;}
let p=call('getPlacementPreview').preview;assert.equal(p.valid,true);call('setPlacementPoint',{x:.7,y:.35});p=call('getPlacementPreview').preview;assert.ok(Math.abs(p.candidateX/240-.7)<.001);assert.ok(Math.abs(p.candidateY/240-.35)<.001);preserved();
action('placement.still');assert.equal(call('getPlacementPreview').preview.speedKmS,0);action('placement.escape');assert.equal(call('getPlacementPreview').preview.bound,false);action('placement.circular');action('placement.reverse');input('placement.value.3','30');preserved();
input('placement.value.1','');assert.equal(call('getPlacementPreview').preview.valid,false);
const invalid=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json','{"action":"placement.confirm"}'],{encoding:'utf8'});assert.equal(invalid.status,2);preserved();
action('panel.close');let canceled=preserved();assert.equal(canceled.placement.active,false);assert.equal(canceled.editor.orbitName,'保留原编辑草稿');
action('orbit.add');input('placement.name','倾斜新行星');input('placement.value.3','25');action('placement.surface.3');p=call('getPlacementPreview').preview;assert.equal(p.valid,true);action('placement.confirm','paused');
const after=call('getState');assert.equal(after.simulation.count,5);assert.equal(after.simulation.time,0);assert.deepEqual(after.definition.config.orbitBodies[4],p.body);assert.ok(after.rendering.sceneRevision>=before.rendering.sceneRevision);assert.equal(after.placement.active,false);
const once=after.rendering.sceneRevision;const twice=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json','{"action":"placement.confirm"}'],{encoding:'utf8'});assert.equal(twice.status,2);assert.equal(call('getState').rendering.sceneRevision,once);
console.log(JSON.stringify({ok:true,device,checks:['candidate before commit','shared point placement','circular/still/escape/reverse','inclination','invalid commit rejected','cancel keeps original scene/time/history/surface/draft','single explicit commit produces exact candidate','duplicate confirm rejected'],before,canceled,candidate:p,after},null,2));
