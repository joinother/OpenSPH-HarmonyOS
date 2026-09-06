#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=action=>call('uiAction',{action});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(){for(let i=0;i<40;i++){const s=call('getState');if(s.rendering.texturesReady&&!s.rendering.cameraMoving){await delay(50);return s;}await delay(60);}throw Error('Camera did not settle');}
call('listCommands');assert.ok(call('getUiState').actions.some(a=>a.id==='selection.edit'));
call('uiAction',{action:'preset.5'},'paused');call('start',{},'completed');call('seek',{frame:70});action('panel.close');
call('setCamera',{yaw:.4,pitch:.3,zoom:3.1,focus:-1,color:0});await settled();
const before=call('getState'), evidence=[];
function preserved(s){assert.equal(s.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(s.rendering.surfaceStarts,before.rendering.surfaceStarts);assert.ok(s.rendering.frames>=before.rendering.frames);assert.equal(s.rendering.error,'');assert.deepEqual(s.definition,before.definition);for(const k of ['state','count','time','frames','selected'])assert.equal(s.simulation[k],before.simulation[k],k);}
action('focus.1');action('selection.edit');
const composed=await settled();preserved(composed);const body=call('getProjectedBodies').projection.bodies.find(b=>b.id===1);
if(composed.window.widthVp>=600){const right=(composed.window.viewportWidthVp-324)/composed.window.viewportWidthVp;assert.ok(body.x+body.radius*composed.window.viewportHeightVp/composed.window.viewportWidthVp<right);}
else {const height=composed.window.viewportHeightVp,top=height-158-Math.max(120,Math.min(410,height*.5));assert.ok((body.y+body.radius)*height<top);assert.ok((body.y-body.radius)*height>66);}
call('setUiValue',{field:'orbit.name',value:'海洋草稿仍在'});action('panel.close');
action('surface.1');await settled();
const first=call('getProjectedBodies').projection.bodies.find(b=>b.id===1);assert.ok(first.radius>.15);
action('surface.next');let moving=false;
for(let i=0;i<5;i++){const s=call('getState'),p=call('getProjectedBodies').projection;preserved(s);moving ||= s.rendering.cameraMoving;evidence.push({rendering:s.rendering,bodies:p.bodies});}
assert.ok(moving,'Observed an intermediate camera frame');
const second=await settled();preserved(second);assert.equal(second.camera.focus,2);
const projected=call('getProjectedBodies').projection;assert.equal(projected.bodies.find(b=>b.id===1).opacity,0);assert.ok(projected.bodies.find(b=>b.id===2).radius>.15);
// Retarget again before completion; no model/renderer restart is permitted.
action('surface.3');action('surface.1');action('selection.edit');assert.equal(call('getState').editor.orbitName,'海洋草稿仍在');
call('setUiValue',{field:'orbit.value.0',value:''});action('orbit.select.2');call('setUiValue',{field:'orbit.name',value:'第二颗草稿'});action('orbit.select.1');assert.equal(call('getState').editor.orbitFields[0],'');
action('ui.back');assert.equal(call('getState').appearance.closeup,true);action('ui.back');let after=await settled();preserved(after);assert.equal(after.camera.focus,-1);assert.equal(after.appearance.closeup,false);
for(const k of ['yaw','pitch','zoom'])assert.ok(Math.abs(after.camera[k]-before.camera[k])<1e-5);
// All original bodies remain in the same replay frame, with overview opacity.
assert.ok(call('getProjectedBodies').projection.bodies.every(b=>b.opacity===1));
console.log(JSON.stringify({ok:true,device,checks:['scene revision unchanged','surface creation unchanged','replay time/cursor/history unchanged','observed intermediate native frames','rapid retarget','per-body drafts','close drawer then return overview','restore previous camera','selected planet outside editor bounds'],before,after,composed,evidence},null,2));
