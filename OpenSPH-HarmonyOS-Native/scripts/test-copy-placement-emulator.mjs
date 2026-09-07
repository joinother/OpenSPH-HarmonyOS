#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs';
const version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',created=[];
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:40000}));
const action=(action,wait)=>call('uiAction',{action},wait),input=(field,value)=>call('setUiValue',{field,value});
const reject=action=>{const r=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json',JSON.stringify({action})],{encoding:'utf8',timeout:40000});assert.equal(r.status,2,r.stdout+r.stderr);};
const results=[];
try{
 call('listCommands');call('getUiState');if(call('getState').placement.active)action('placement.cancel');
 for(const theme of ['ring-world','moon-atlas']){
  action('theme.'+theme,'paused');call('setAppearance',{autoSpin:false});call('start',{},'completed');call('seek',{frame:30});action('selection.edit');
  input('orbit.name','尚未应用的名字');input('orbit.value.0','');
  const before=call('getState');assert.equal(before.editor.orbitIndex,1);
  assert.equal(call('getUiState').actions.find(a=>a.id==='orbit.copy').enabled,true);
  action('orbit.copy');const preview=call('getState');
  assert.equal(preview.placement.sourceName,before.definition.config.orbitBodies[1].name);assert.equal(preview.placement.sourceIndex,1);
  const p=preview.placement.preview;assert.equal(p.valid,true);assert.equal(p.body.surface,before.definition.config.orbitBodies[1].surface);
  assert.ok(Math.abs(p.body.massSolar-before.definition.config.orbitBodies[1].massSolar)<1e-18);
  const preserved=()=>{const s=call('getState');assert.deepEqual(s.definition,before.definition);assert.deepEqual(s.editor,before.editor);for(const k of ['time','selected','frames'])assert.equal(s.simulation[k],before.simulation[k]);for(const k of ['sceneRevision','surfaceStarts'])assert.equal(s.rendering[k],before.rendering[k]);return s;};
  preserved();reject('orbit.copy');input('placement.value.1','');reject('placement.confirm');preserved();
  action('placement.cancel');const canceled=preserved();assert.deepEqual(canceled.camera,before.camera);
  action('orbit.copy');input('placement.value.4','1.2');input('placement.value.3','25');const candidate=call('getPlacementPreview').preview;assert.equal(candidate.valid,true);
  action('placement.confirm','paused');let after=call('getState');assert.equal(after.simulation.count,before.simulation.count+1);assert.equal(after.simulation.time,0);
  assert.deepEqual(after.definition.config.orbitBodies.at(-1),candidate.body);assert.equal(after.editor.history.undoCount,1);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);
  reject('placement.confirm');action('orbit.undo','paused');let undone=call('getState');assert.deepEqual(undone.definition,before.definition);assert.deepEqual(undone.editor.orbitFields,before.editor.orbitFields);assert.equal(undone.editor.orbitName,before.editor.orbitName);
  action('orbit.redo','paused');after=call('getState');assert.deepEqual(after.definition.config.orbitBodies.at(-1),candidate.body);
  const saved=call('saveProject',{title:'验收 · 复制 '+theme});created.push(saved.id);
  call('loadProject',{id:saved.id},'paused');const loaded=call('getState');assert.deepEqual(loaded.definition.config.orbitBodies,after.definition.config.orbitBodies);
  action('orbit.select.0');const star=call('getState');reject('orbit.copy');assert.deepEqual(call('getState').definition,star.definition);
  results.push({theme,before,preview,canceled,candidate,after,loaded});
 }
 console.log(JSON.stringify({ok:true,version,device,checks:['Moon and ring styles copied from applied initial conditions','invalid source draft retained','preview/cancel preserves scene, time, frame, camera and surface','duplicate action and invalid confirmation rejected','exact candidate committed once','undo/redo restores source drafts','named save/load retains new body','star copy rejected'],results},null,2));
}finally{for(const id of created)execFileSync(hdc,['-t',device,'shell','rm','/data/app/el2/100/base/com.opensph.lab/haps/entry/files/'+id+'.json']);}
