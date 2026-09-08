import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('This acceptance is restricted to explicit emulator 127.0.0.1:5555');
const remote='/data/app/el2/100/base/com.opensph.lab/haps/entry/files/';
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const h=(...args)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...args],{encoding:'utf8',timeout:60000});
const call=(command,payload={},wait)=>{const a=[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload)];if(wait)a.push('--wait-state',wait);return JSON.parse(execFileSync(process.execPath,a,{encoding:'utf8',timeout:70000,maxBuffer:8*1024*1024}));};
import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import assert from 'node:assert/strict';
if(!process.argv[3])throw Error('Evidence directory required');const evidence=resolve(process.argv[3])+'/';mkdirSync(evidence,{recursive:true});
call('listCommands');call('getUiState');const before=call('getState');
if(before.placement.active||before.simulation.state!=='paused'||before.simulation.time!==0||before.simulation.frames!==1||before.scene.preset!==5||before.simulation.orbitState.length!==4||before.simulation.orbitState.some(b=>b.radiusKm!==undefined))throw Error('Requires paused four-body custom point-mass initial scene. Restore its recipe before running.');
writeFileSync(evidence+'session-before.json',JSON.stringify(before,null,2));
const saved=call('saveProject',{title:'临时验收恢复 0.50.0'}),id=saved.id;
if(!id)throw Error('No restore project');
writeFileSync(evidence+'restore-project.json',JSON.stringify(saved,null,2));
const results=[];const run=(c,p={},wait)=>{const r=call(c,p,wait);assert.equal(r.ok,true,JSON.stringify(r));results.push({command:c,payload:p,result:r});return r;};
const act=a=>run('uiAction',{action:a});
try {
 run('listCommands');run('getUiState');run('loadProject',{id},'paused');
 act('focus.1');let baseline=run('getState');const bodies=baseline.simulation.orbitState;
 for(const mode of ['satellite','drop','launch']) {
  act('selection.'+mode);const s=run('getState');assert.equal(s.placement.parent,1);assert.equal(s.placement.promotesContact,true);assert.equal(s.placement.preview.valid,true,s.placement.preview.error);
  const b=s.placement.preview.body,a=bodies[1];const v=[b.vxKmS-a.vxKmS,b.vyKmS-a.vyKmS,b.vzKmS-a.vzKmS],d=[b.xAU-a.xAU,b.yAU-a.yAU,b.zAU-a.zAU];
  if(mode==='satellite')assert.ok(Math.abs(d.reduce((sum,x,i)=>sum+x*v[i],0))<1e-12);
  if(mode==='drop')assert.equal(Math.hypot(...v),0);
  if(mode==='launch')assert.ok(d.reduce((sum,x,i)=>sum+x*v[i],0)<0);
  if(mode==='satellite'){
   const projection=run('getProjectedBodies').projection;assert.equal(projection.ready,true);assert.equal(projection.candidate,4);
   h('shell','snapshot_display','-f','/data/local/tmp/local-placement-preview.jpeg');h('file','recv','/data/local/tmp/local-placement-preview.jpeg',resolve(evidence+'local-placement-preview.jpeg'));
   run('setViewportPlacementPoint',{x:.65,y:.55});assert.equal(run('getState').placement.preview.valid,true);
  }
  act('placement.cancel');const cancelled=run('getState');assert.deepEqual(cancelled.simulation.orbitState,bodies);assert.equal(cancelled.simulation.time,baseline.simulation.time);assert.equal(cancelled.camera.focus,1);
 }
 act('selection.satellite');const draft=run('getState');act('placement.confirm');let inserted=run('getState');assert.equal(inserted.simulation.time,baseline.simulation.time);assert.equal(inserted.simulation.orbitState.length,5);
 assert.deepEqual(inserted.simulation.orbitState[4],draft.placement.preview.body);
 const withoutRadius=inserted.simulation.orbitState.slice(0,4).map(({radiusKm,...v})=>v);assert.deepEqual(withoutRadius,bodies);assert.ok(inserted.simulation.orbitState.every(b=>b.radiusKm>0));
 act('time.rate.0.1');run('start');let advanced=run('getState');run('pause');assert.ok(advanced.simulation.time>inserted.simulation.time);assert.equal(advanced.simulation.state,'running');
 // A fresh directed launch exercises actual model promotion and automatic contact pause.
 run('loadProject',{id},'paused');act('focus.1');act('selection.launch');act('placement.confirm');act('time.rate.1');run('start');
 const deadline=Date.now()+60000;let contact;
 do{contact=run('getState');assert.notEqual(contact.simulation.state,'failed',contact.simulation.error);if(Date.now()>deadline)throw Error('No contact in deadline');}while((contact.simulation.contact?.count??0)===0);
 assert.equal(contact.simulation.state,'paused');assert.ok([contact.simulation.contact.a,contact.simulation.contact.b].includes(1));assert.ok([contact.simulation.contact.a,contact.simulation.contact.b].includes(4));
 h('shell','snapshot_display','-f','/data/local/tmp/local-placement-contact.jpeg');h('file','recv','/data/local/tmp/local-placement-contact.jpeg',resolve(evidence+'local-placement-contact.jpeg'));
 writeFileSync(evidence+'local-placement-device.json',JSON.stringify({ok:true,checks:['three selected-body actions','parent-relative velocity','current-time physical promotion','exact existing vectors','cancel preserves point model','local viewport semantic placement','satellite continuous gravity','directed projectile contact auto-pause'],results},null,2));
 console.log('PASS selected-body actions, satellite insertion and directed contact on emulator');
} finally {
 // Restore the user's initial recipe, presentation and original replay slot.
 const current=call('getState');if(current.placement.active)call('uiAction',{action:'placement.cancel'});
 call('loadProject',{id},'paused');call('setUiValue',{field:'scene.title',value:before.definition.title});call('setCamera',before.camera);call('uiAction',{action:before.ui.toolsVisible?'ui.restore':'ui.focus'});call('setPanel',{panel:before.ui.panelOpen?before.ui.panel:-1});
 const restored=call('getState');assert.deepEqual(restored.simulation.orbitState,before.simulation.orbitState);assert.equal(restored.simulation.time,before.simulation.time);assert.deepEqual(restored.appearance,before.appearance);assert.deepEqual(restored.camera,before.camera);
 assert.match(id,/^project-\d+-\d+$/);h('shell','rm','-f',remote+id+'.json');
 writeFileSync(evidence+'local-placement-restoration.json',JSON.stringify({ok:true,time:restored.simulation.time,exactBodiesMatch:true,cameraMatch:true,appearanceMatch:true,originalReplayUntouched:true,removedTemporaryProject:id},null,2));
}
