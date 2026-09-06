#!/usr/bin/env node
// Mutates the development emulator's initial conditions and window; no touch navigation.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit development emulator required');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url)),project=fileURLToPath(new URL('../',import.meta.url));
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const temp=mkdtempSync(join(tmpdir(),'sph-edit-history-'));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000});
const args=(command,payload={},wait)=>[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])];
const call=(...a)=>JSON.parse(execFileSync(process.execPath,args(...a),{encoding:'utf8',timeout:35000}));
const action=(id,wait)=>call('uiAction',{action:id},wait),input=(field,value)=>call('setUiValue',{field,value});
const current=()=>call('getState'),bodies=s=>s.definition.config.orbitBodies,history=s=>s.editor.history;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function rejects(command,payload){const r=spawnSync(process.execPath,args(command,payload),{encoding:'utf8',timeout:35000});assert.equal(r.status,2);return JSON.parse(r.stdout);}
async function settled(folded,orientation){let stable=0,last='';for(let i=0;i<65;i++){
 const s=current(),p=call('getProjectedBodies').projection,g=s.window.geometry;
 const shape=(orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(folded?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000);
 const aligned=p.ready&&Math.abs(p.widthPx+g.leftPx+g.rightPx-g.widthPx)<4&&Math.abs(p.heightPx+g.topPx+g.bottomPx-g.heightPx)<4;
 const key=JSON.stringify([g.widthPx,g.heightPx,g.leftPx,g.topPx,g.rightPx,g.bottomPx,p.widthPx,p.heightPx]);
 if(shape&&aligned&&s.rendering.panoramaReady&&!s.rendering.cameraMoving&&s.rendering.error===''){stable=key===last?stable+1:0;if(stable>=3)return s;}else stable=0;
 last=key;await delay(170);
 }throw Error('Window did not settle');}
function capture(name){
 const remote='/data/local/tmp/sph-history-ui.json';h('shell','uitest','dumpLayout','-p',remote);const local=join(temp,'ui.json');h('file','recv',remote,local);h('shell','rm',remote);
 const nodes=[];function walk(v){if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;if(v.attributes?.bounds)nodes.push({...v.attributes,rect:v.attributes.bounds.match(/-?\d+/g).map(Number)});for(const [k,x]of Object.entries(v))if(k!=='attributes')walk(x);}walk(JSON.parse(readFileSync(local,'utf8')));
 const get=id=>{const n=nodes.find(n=>n.id===id);assert.ok(n,'missing '+id);return n;};const drawer=get('workspace-drawer').rect;
 const controls=['orbit-undo','orbit-redo'].map(id=>{const n=get(id),r=n.rect;assert.ok(r[2]>r[0]&&r[3]>r[1]);assert.ok(r[0]>=drawer[0]&&r[1]>=drawer[1]&&r[2]<=drawer[2]&&r[3]<=drawer[3],id+' clipped');return n;});
 const png='/data/local/tmp/sph-history.png';h('shell','uitest','screenCap','-p',png);h('file','recv',png,project+'../OpenSPH-0.15.0-history-'+name+'.png');h('shell','rm',png);
 return {name,drawer,controls};
}
const checks=[],layouts=[];
try{
 call('listCommands');let ui=call('getUiState');assert.ok(ui.actions.some(a=>a.id==='orbit.undo'));
 const config=JSON.parse(readFileSync(project+'examples/custom-system.json','utf8'));
 let s=call('setScene',config,'paused'),initial=bodies(s);assert.equal(history(s).undoCount,0);
 input('orbit.name','蔚蓝待编辑');action('orbit.select.3');input('orbit.value.6','');action('orbit.select.2');input('orbit.name','暮云新名称');
 s=action('orbit.apply','paused');assert.equal(bodies(s)[2].name,'暮云新名称');assert.deepEqual(s.editor.drafts.map(d=>d.index),[1,3]);assert.equal(history(s).undoCount,1);
 call('start',{},'completed');call('seek',{frame:20});
 s=action('orbit.undo','paused');assert.deepEqual(bodies(s),initial);assert.equal(s.simulation.time,0);assert.equal(s.simulation.frames,1);assert.equal(s.editor.orbitName,'暮云新名称');assert.equal(s.editor.orbitDraft,true);
 s=action('orbit.redo','paused');assert.equal(bodies(s)[2].name,'暮云新名称');assert.equal(s.editor.drafts.length,2);checks.push('apply/undo/redo restore bodies and per-body drafts; undo resets computed replay to time zero');
 action('orbit.select.1');s=action('orbit.remove','paused');assert.equal(bodies(s).length,4);assert.deepEqual(s.editor.drafts.map(d=>d.index),[2]);
 action('orbit.select.2');assert.equal(current().editor.orbitFields[6],'');s=action('orbit.undo','paused');assert.equal(s.editor.orbitName,'蔚蓝待编辑');assert.equal(bodies(s).length,5);
 action('orbit.redo','paused');s=action('orbit.undo','paused');checks.push('delete remaps other drafts; undo restores deleted body and its draft');
 input('orbit.value.0','');const beforeInvalid=current();rejects('uiAction',{action:'orbit.apply'});s=current();assert.deepEqual(bodies(s),bodies(beforeInvalid));assert.deepEqual(history(s),history(beforeInvalid));
 input('orbit.value.0','1');input('orbit.name','蔚蓝新分支');s=action('orbit.apply','paused');assert.equal(history(s).redoCount,0);rejects('uiAction',{action:'orbit.redo'});checks.push('invalid edit preserves redo; successful branch clears redo');
 let count=history(current()).undoCount;action('orbit.add');rejects('uiAction',{action:'orbit.undo'});action('placement.cancel');assert.equal(history(current()).undoCount,count);
 action('orbit.add');input('placement.name','晨星');s=action('placement.confirm','paused');assert.equal(history(s).undoCount,count+1);const withPlanet=bodies(s);
 s=action('orbit.undo','paused');assert.equal(bodies(s).length,5);s=action('orbit.redo','paused');assert.deepEqual(bodies(s),withPlanet);assert.equal(s.placement.active,false);checks.push('placement cancel leaves history unchanged; confirmed body is one undoable transaction');
 action('orbit.select.3');const beforeDiscard=current();assert.equal(beforeDiscard.editor.orbitFields[6],'');s=action('orbit.discard');assert.equal(s.editor.orbitDraft,false);assert.deepEqual(bodies(s),bodies(beforeDiscard));assert.deepEqual(history(s),history(beforeDiscard));assert.equal(s.simulation.frames,beforeDiscard.simulation.frames);assert.equal(s.rendering.sceneRevision,beforeDiscard.rendering.sceneRevision);checks.push('discard restores one body input without restarting native scene');
 // Leave both history directions available in the screenshots, alongside an unapplied draft.
 action('orbit.undo','paused');action('orbit.select.1');input('orbit.name','蔚蓝的下一次编辑');call('setPanel',{panel:0});
 const reference=current();
 for(const [name,folded,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',folded?'-p':'-y');call('setWindowOrientation',{orientation});s=await settled(folded,orientation);await delay(400);
  assert.deepEqual(s.editor,reference.editor);assert.deepEqual(bodies(s),bodies(reference));assert.equal(s.rendering.sceneRevision,reference.rendering.sceneRevision);
  layouts.push(capture(name));writeFileSync(project+'docs/evidence/edit-history-'+name+'-state.json',JSON.stringify(s,null,2)+'\n');
 }
 checks.push('undo/redo controls visible inside panel on expanded portrait, folded portrait and landscape; drafts/history survive resizing');
 s=call('setScene',config,'paused');assert.equal(history(s).undoCount,0);assert.equal(history(s).redoCount,0);assert.equal(s.editor.drafts.length,0);checks.push('new scene clears prior edit history and drafts');
 console.log(JSON.stringify({ok:true,device,checks,layouts},null,2));
}finally{try{call('setWindowOrientation',{orientation:'auto'});}catch{}rmSync(temp,{recursive:true,force:true});}
