// Requires a preserved live session; restore with restore-orbit-emulator-session.mjs after visual review.
import assert from 'node:assert/strict';
import{execFileSync,spawnSync}from'node:child_process';
import{mkdirSync,writeFileSync,readFileSync}from'node:fs';
import{resolve}from'node:path';
const [device,output,recovery]=process.argv.slice(2);assert.equal(device,'127.0.0.1:5555');assert.equal(JSON.parse(readFileSync(resolve(recovery,'backup.json'))).ok,true);
const out=resolve(output);mkdirSync(out,{recursive:true});const records=[];
const h=(...a)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...a],{encoding:'utf8',timeout:60000});
const call=(command,payload={},wait)=>{const r=JSON.parse(execFileSync(process.execPath,['scripts/opensph-cli.mjs','--device',device,'--timeout','120000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:195000,maxBuffer:16e6}));assert.equal(r.ok,true);records.push({command,payload,result:r});return r;};
let batchId=0;
const batch=commands=>{const path=resolve('build','thermal-batch-'+(++batchId)+'.json');writeFileSync(path,JSON.stringify(commands));const r=JSON.parse(execFileSync(process.execPath,['scripts/opensph-cli.mjs','--device',device,'--timeout','120000','--batch',path],{encoding:'utf8',timeout:240000,maxBuffer:24e6}));assert.equal(r.ok,true);records.push(...r.results);return r.results.map(v=>v.result);};
const action=a=>({command:'uiAction',payload:{action:a}});
const photo=name=>{call('getUiState');h('shell','snapshot_display','-f','/data/local/tmp/material-'+name+'.jpeg');h('file','recv','/data/local/tmp/material-'+name+'.jpeg',out+'/'+name+'.jpeg');};
const unchanged=(a,b)=>{assert.equal(a.simulation.time,b.simulation.time);assert.equal(a.simulation.frames,b.simulation.frames);assert.equal(a.rendering.sceneRevision,b.rendering.sceneRevision);assert.deepEqual({...a.camera,color:0},{...b.camera,color:0});};
const results=[];let savedId;
try{
 batch([{command:'listCommands'},{command:'getUiState'}]);
 for(const variant of ['cold','hot','fractured']){
  batch([{...action('theme.material-'+variant),waitForState:'paused'}]);const initial=call('getState');assert.equal(initial.simulation.time,0);assert.equal(initial.camera.color,7);assert.equal(initial.rendering.error,'');
  const r=initial.simulation.sph.response;assert.ok(r);assert.ok(Math.abs(r.strengthMean-(variant==='hot'?.5:variant==='fractured'?.1:1))<1e-10);
  if(variant==='fractured')assert.ok(r.damagedMassFraction>.9999999);
  if(variant==='hot'){call('setPanel',{panel:0});photo('material-inputs');call('setPanel',{panel:-1});photo('preheated-initial');}
  call('start',{},'completed');const completed=call('getState');assert.equal(completed.rendering.error,'');assert.ok(completed.simulation.sph.internalMeanMJkg>0);
  if(variant==='cold')assert.ok(completed.simulation.sph.damageMean>0);
  const fragments=call('getSphFragments',{limit:8}).fragments;assert.ok(fragments.available&&fragments.groupCount>1);
  batch([action('color.8'),{command:'getState'},action('color.7')]);const recolored=call('getState');unchanged(completed,recolored);photo(variant+'-impact');
  batch([{command:'saveReplay'},{command:'loadReplay'},{command:'seek',payload:{frame:-1}}]);const replay=call('getState');assert.deepEqual(replay.simulation.sph,completed.simulation.sph);assert.deepEqual(replay.simulation.config,completed.simulation.config);
  call('seek',{frame:0});const early=call('getState');assert.ok(early.simulation.time<replay.simulation.time);call('seek',{frame:-1});assert.deepEqual(call('getState').simulation.sph,replay.simulation.sph);
  results.push({variant,initial:initial.simulation,completed:completed.simulation,groups:fragments.groupCount});
 }
 savedId=call('saveProject',{title:'验收临时破坏与热软化'}).id;assert.match(savedId,/^project-\d+-\d+$/);
 batch([{...action('theme.material-cold'),waitForState:'paused'},{command:'loadProject',payload:{id:savedId},waitForState:'paused'}]);assert.equal(call('getState').simulation.config.initialDamage,.9);
 const before=call('getState');for(const patch of [{initialEnergyMJkg:7},{initialDamage:-1},{initialDamage:'1'},{initialDamage:.5,selfGravity:true,relaxationSeconds:16}]){const bad=spawnSync(process.execPath,['scripts/opensph-cli.mjs','--device',device,'--command','setScene','--payload-json',JSON.stringify({...before.definition.config,...patch})],{encoding:'utf8',timeout:45000});assert.equal(bad.status,2);unchanged(before,call('getState'));}
 batch([{command:'setUiValue',payload:{field:'scene.energy',value:3.4}},{command:'setUiValue',payload:{field:'scene.damage',value:0}},{...action('simulation.apply'),waitForState:'paused'}]);const threshold=call('getState');assert.ok(threshold.simulation.sph.response.zeroShearMassFraction>.9999999);assert.equal(threshold.simulation.sph.response.strengthMean,0);
 call('setPanel',{panel:1});photo('threshold-inspector');
 writeFileSync(out+'/device.json',JSON.stringify({ok:true,scope:'real ArkUI semantic actions and native solver; screenshots inspected separately; no finger-hit or frame-rate claims',results,threshold:threshold.simulation,records},null,2));
 console.log('PASS cold/hot/fractured collisions, live material inputs, thermal/strength views, exact v15 replay, recipe and invalid-input rollback');
}catch(error){writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),records},null,2));throw error;}finally{if(savedId)h('shell','rm','-f','/data/app/el2/100/base/com.opensph.lab/haps/entry/files/'+savedId+'.json');}
