#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit development emulator required');
const project=fileURLToPath(new URL('../',import.meta.url)),cli=project+'scripts/opensph-cli.mjs';
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const temp=mkdtempSync(join(tmpdir(),'sph-themes-')),results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=(action,wait)=>call('uiAction',{action},wait);
function screenshot(name){const remote='/data/local/tmp/sph-theme.png';h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,project+'../OpenSPH-0.17.0-'+name+'.png');h('shell','rm',remote);}
async function waitFor(predicate,limit=120000){const end=Date.now()+limit;let polls=0;do{const s=call('getState');if(++polls%15===0)console.log('WAIT '+JSON.stringify({ready:s.rendering.ready,moving:s.rendering.cameraMoving,state:s.simulation.state,time:s.simulation.time}));if(s.rendering.error)throw Error('Renderer failed: '+s.rendering.error);if(s.simulation.state==='failed')throw Error('Solver failed: '+s.simulation.error);if(predicate(s))return s;await delay(600);}while(Date.now()<end);throw Error('Scene did not settle');}
function uiNodes(){const remote='/data/local/tmp/sph-theme-ui.json',local=join(temp,'ui.json');h('shell','uitest','dumpLayout','-p',remote);h('file','recv',remote,local);h('shell','rm',remote);const nodes=[];
 function walk(v){if(!v||typeof v!=='object')return;if(v.attributes?.bounds)nodes.push({...v.attributes,rect:(v.attributes.bounds.match(/-?\d+/g)||[]).map(Number)});Object.entries(v).filter(([k])=>k!=='attributes').forEach(([,x])=>walk(x));}walk(JSON.parse(readFileSync(local,'utf8')));return nodes;
}
try {
 call('listCommands');call('getUiState');const catalog=call('listExperiments');assert.equal(catalog.experiments.length,6);
 const [slow,fast]=catalog.experiments;assert.deepEqual({...slow.config,speed:8},fast.config);
 h('shell','hidumper','-s','DisplayManagerService','-a','-y');call('setWindowOrientation',{orientation:'portrait'});
 for(const t of catalog.experiments){
  let s=action('theme.'+t.id,'paused');assert.deepEqual(s.definition.config,t.config);assert.equal(s.theme.id,t.id);assert.equal(s.theme.modified,false);assert.equal(s.simulation.time,0);assert.equal(s.ui.panelOpen,false);
  await waitFor(s=>s.rendering.ready&&!s.rendering.cameraMoving);await delay(450);screenshot(t.id+'-initial');
  call('start');s=await waitFor(s=>s.simulation.state==='completed');assert.ok(Math.abs(s.simulation.time-t.config.duration)<(t.category==='collision'?.151:1e-8),'end time exceeds one maximum SPH step');assert.equal(s.rendering.error,'');
  results.push({id:t.id,config:s.definition.config,simulation:s.simulation});
  if(t.category==='collision'){call('setCamera',{...s.camera,zoom:t.id==='rock-fast'?5:3.5});await delay(500);screenshot(t.id+'-result');}
  writeFileSync(project+'docs/evidence/themes-'+t.id+'-state.json',JSON.stringify(s,null,2)+'\n');console.log('PASS '+t.id+' '+s.simulation.time+' '+s.simulation.timeUnit);
 }
 for(let i=0;i<20;i++){const zero=action('theme.ocean-world','paused');assert.equal(zero.simulation.time,0);assert.equal(zero.simulation.frames,1);}
 console.log('PASS atomic paused start x20');
 action('theme.rock-slow','paused');call('setUiValue',{field:'scene.speed',value:4});assert.equal(call('getState').theme.modified,true);
 let s=action('theme.compare','paused');assert.equal(s.scene.speed,8);assert.equal(s.simulation.time,0);assert.equal(s.theme.modified,false);
 s=action('theme.compare','paused');assert.deepEqual(s.definition.config,slow.config);
 call('setUiValue',{field:'body.radius',value:120});s=action('theme.restore','paused');assert.deepEqual(s.definition.config,slow.config);
 // Gallery navigation preserves the native scene; actual first card fits the scrolling drawer.
 action('theme.ocean-world','paused');call('setAppearance',{autoSpin:false});call('setPanel',{panel:2});action('library.collision');
 const reference=call('getState');
 for(const [name,folded,orientation] of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',folded?'-p':'-y');call('setWindowOrientation',{orientation});
  s=await waitFor(s=>s.window.immersive&&!s.rendering.cameraMoving&&(orientation==='portrait'?s.window.geometry.heightPx>s.window.geometry.widthPx:s.window.geometry.widthPx>s.window.geometry.heightPx)&&(folded?Math.min(s.window.geometry.widthPx,s.window.geometry.heightPx)<1500:Math.min(s.window.geometry.widthPx,s.window.geometry.heightPx)>2000));await delay(800);
  assert.equal(s.rendering.sceneRevision,reference.rendering.sceneRevision);assert.deepEqual(s.definition,reference.definition);
  assert.deepEqual(s.camera,reference.camera);assert.equal(s.simulation.time,reference.simulation.time);
  const nodes=uiNodes(),viewport=nodes.find(n=>n.id==='universe-viewport'),drawer=nodes.find(n=>n.id==='workspace-drawer');assert.ok(viewport&&drawer);
  assert.deepEqual(viewport.rect,[0,0,s.window.geometry.widthPx,s.window.geometry.heightPx]);
  assert.ok(nodes.some(n=>n.id==='theme-card-rock-slow'),'missing theme card');
  const button=nodes.find(n=>n.id==='theme-enter-rock-slow');assert.ok(button,'missing first theme action');
  // In a short drawer the button can legitimately be below the current scroll position.
  assert.ok(button.rect[0]>=drawer.rect[0]&&button.rect[2]<=drawer.rect[2]);
  screenshot('library-'+name);results.push({gallery:name,window:s.window,drawer:drawer.rect,firstButton:button.rect});
 }
 action('library.explore');await delay(650);screenshot('library-explore');assert.equal(call('getUiState').librarySection,'explore');
 action('library.saved');assert.equal(call('getUiState').librarySection,'saved');assert.deepEqual(call('getState').definition,reference.definition);
 writeFileSync(project+'docs/evidence/themes-device-tests.json',JSON.stringify({ok:true,device,checks:['six fixed templates complete native integration','20 repeated native initial-paused starts remain at time zero','speed-only comparison and exact restore','gallery navigation preserves scene and camera','full immersive viewport and theme gallery in wide/phone/landscape'],results},null,2)+'\n');console.log('PASS gallery and comparisons');
} finally {try{call('pause');call('setWindowOrientation',{orientation:'auto'});}catch{}rmSync(temp,{recursive:true,force:true});}
