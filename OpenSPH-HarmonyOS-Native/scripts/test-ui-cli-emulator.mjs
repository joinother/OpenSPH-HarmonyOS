#!/usr/bin/env node
// Semantic CLI acceptance. No coordinate navigation or synthetic typing.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(!device)throw Error('Explicit device required');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'opensph-ui-cli-'));
function call(command,payload={},wait){const args=[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload)];if(wait)args.push('--wait-state',wait);return JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8',timeout:70000}));}
const action=(id,wait)=>call('uiAction',{action:id},wait);
try{
  call('listCommands');call('getUiState');
  action('preset.5','paused');let catalog=call('getUiState');assert.ok(catalog.actions.length>45);for(const field of ['placement.name',...Array.from({length:5},(_,i)=>'placement.value.'+i),...Array.from({length:7},(_,i)=>'orbit.value.'+i)])assert.ok(catalog.fields.some(f=>f.field===field),'Missing semantic field '+field);assert.ok(catalog.fields.some(f=>f.field==='trace.impulse'));assert.ok(catalog.fields.some(f=>f.field==='material.exposure'));
  action('orbit.add');action('placement.confirm','paused');const original=call('getState').definition.config.orbitBodies;
  call('setUiValue',{field:'orbit.name',value:'CLI 远洋'});call('setUiValue',{field:'orbit.value.0',value:'2'});
  action('orbit.surface.3');assert.deepEqual(call('getState').definition.config.orbitBodies,original);
  let s=action('orbit.apply','paused');assert.equal(s.definition.config.orbitBodies[4].name,'CLI 远洋');assert.equal(s.definition.config.orbitBodies[4].surface,3);assert.equal(s.editor.orbitDraft,false);
  action('orbit.near');assert.equal(call('getState').camera.focus,4);action('surface.next');assert.equal(call('getState').camera.focus,0);action('surface.previous');assert.equal(call('getState').camera.focus,4);
  action('ui.focus');assert.equal(call('getState').ui.toolsVisible,false);action('ui.restore');
  action('panel.parameters');action('ui.back');assert.equal(call('getState').ui.panelOpen,false);
  const cloudsBefore=call('getState').appearance.clouds;
  action('appearance.clouds');assert.equal(call('getState').appearance.clouds,!cloudsBefore);action('appearance.clouds');assert.equal(call('getState').appearance.clouds,cloudsBefore);
  action('surface.toggle');call('setUiValue',{field:'scene.duration',value:1});action('simulation.apply','paused');action('simulation.toggle','running');assert.equal(call('getState').simulation.continuous,true);call('pause',{},'paused');
  action('replay.toggle');assert.equal(call('getState').ui.playing,true);action('replay.toggle');assert.equal(call('getState').ui.playing,false);action('replay.latest');
  action('orbit.select.0');const before=call('getState').definition;const rejected=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json','{"action":"orbit.remove"}'],{encoding:'utf8'});assert.equal(rejected.status,2);assert.deepEqual(call('getState').definition,before);
  // Batch validates envelopes first, then stops on a runtime failure. Earlier steps are retained.
  const batch=join(temp,'batch.json');writeFileSync(batch,JSON.stringify([{command:'uiAction',payload:{action:'orbit.select.1'}},{command:'setUiValue',payload:{field:'orbit.value.0',value:''}},{command:'uiAction',payload:{action:'orbit.apply'}},{command:'uiAction',payload:{action:'orbit.add'}}]));
  const r=spawnSync(process.execPath,[cli,'--device',device,'--batch',batch],{encoding:'utf8',timeout:30000});assert.equal(r.status,2);const results=JSON.parse(r.stdout);assert.equal(results.completed,3);assert.equal(call('getState').definition.config.orbitBodies.length,5);assert.equal(call('getUiState').editor.orbitDraft,true);
  const file=fileURLToPath(new URL('../examples/custom-system.json',import.meta.url));
  const restored=JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command','setScene','--payload-file',file,'--wait-state','paused'],{encoding:'utf8',timeout:30000}));
  assert.equal(restored.simulation.count,5);assert.equal(restored.rendering.error,'');
  console.log(JSON.stringify({ok:true,device,checks:['catalog','draft read/write without simulation mutation','shared add/apply/remove guards','surface/next/previous','focus/panels/back','appearance toggle','playback toggle','batch fail-fast','payload file','wait for solver state'],catalog,state:restored},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
