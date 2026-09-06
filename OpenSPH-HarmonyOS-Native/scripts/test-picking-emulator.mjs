#!/usr/bin/env node
// CLI is the control path. --touch adds only the explicit viewport hit test.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('This acceptance is scoped to emulator 127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:30000}));
const action=(action,wait)=>call('uiAction',{action},wait);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function projection(){for(let i=0;i<30;i++){const p=call('getProjectedBodies').projection;if(p.ready)return p;await wait(100);}throw Error('Projected frame unavailable');}
async function settle(){await wait(450);return projection();}
action('preset.5','paused');action('panel.close');action('focus.all');let p=await settle();assert.equal(p.bodies.length,4);
for(const id of [3,1,0,2]){
 action('focus.all');p=await settle();const b=p.bodies.find(b=>b.id===id);
 assert.equal(call('pickBody',{x:b.x,y:b.y}).hit,id);const s=call('getState');assert.equal(s.camera.focus,id);assert.equal(s.editor.orbitIndex,id);
}
const selected=call('getState').camera.focus;assert.equal(call('pickBody',{x:.01,y:.99}).hit,-1);assert.equal(call('getState').camera.focus,selected);
const invalid=spawnSync(process.execPath,[cli,'--device',device,'--command','pickBody','--payload-json','{"x":-1,"y":0.5}'],{encoding:'utf8'});assert.equal(invalid.status,2);assert.equal(call('getState').camera.focus,selected);
action('surface.2');p=await settle();assert.equal(call('pickBody',{x:.5,y:.5}).hit,2);assert.equal(p.bodies.filter(b=>b.opacity>=.5).length,1);
action('focus.all');action('orbit.select.1');const before=call('getState').definition;
for(const [field,value] of [[1,'1'],[2,'0.2'],[3,'0.3'],[4,'-5'],[5,'28'],[6,'4']])call('setUiValue',{field:'orbit.value.'+field,value});
action('orbit.plane.xz');let preview=call('getOrbitPreview');assert.equal(preview.reference,'initial-input');assert.equal(preview.preview.valid,true);assert.deepEqual(preview.preview.velocityKmS,[-5,28,4]);assert.equal(preview.preview.plane,'XZ');assert.deepEqual(call('getState').definition,before);
call('setUiValue',{field:'orbit.value.4',value:''});assert.equal(call('getOrbitPreview').preview.valid,false);assert.deepEqual(call('getState').definition,before);
call('setUiValue',{field:'orbit.value.4',value:'-5'});action('orbit.apply','paused');assert.equal(call('getState').definition.config.orbitBodies[1].vxKmS,-5);
// Clear drafts using a preset before testing the real gesture recognizer.
action('preset.5','paused');action('panel.close');action('ui.restore');action('focus.all');p=await settle();
let touch=null;
if(process.argv.includes('--touch')){
 const s=call('getState'),b=p.bodies.find(b=>b.id===1);
 const x=Math.round(s.window.safePx.left+b.x*p.widthPx),y=Math.round(s.window.safePx.top+b.y*p.heightPx);
 execFileSync(hdc,['-t',device,'shell','uitest','uiInput','click',String(x),String(y)],{encoding:'utf8'});await wait(350);
 const after=call('getState');assert.equal(after.camera.focus,1);assert.equal(after.editor.orbitIndex,1);touch={x,y,focus:after.camera.focus,window:s.window};
 action('focus.all');const dragP=await settle(),dragS=call('getState'),dragB=dragP.bodies.find(b=>b.id===1);
 const dx=Math.round(dragS.window.safePx.left+dragB.x*dragP.widthPx),dy=Math.round(dragS.window.safePx.top+dragB.y*dragP.heightPx);
 execFileSync(hdc,['-t',device,'shell','uitest','uiInput','swipe',String(dx),String(dy),String(dx+100),String(dy+40),'600']);await wait(250);
 const dragged=call('getState');assert.equal(dragged.camera.focus,-1);assert.ok(Math.abs(dragged.camera.yaw-dragS.camera.yaw)>.01);touch.dragRotatesWithoutSelecting=true;
}
console.log(JSON.stringify({ok:true,device,checks:['all four body IDs','empty space','invalid coordinates','near-view hidden bodies','initial vector draft/units/XZ','invalid preview clears','apply remains explicit'],touch,preview,projection:p},null,2));
