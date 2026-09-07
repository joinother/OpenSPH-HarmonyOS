#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs';
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:45000}));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000});
const action=(action,wait)=>call('uiAction',{action},wait?['--wait-state',wait]:[]),delay=ms=>new Promise(r=>setTimeout(r,ms));
const created=[],checks=[],captures=[];
async function ready(){for(let i=0;i<80;i++){const s=call('getState');assert.equal(s.rendering.error,'');assert.equal(s.rendering.surfaceError,'');if(s.rendering.texturesReady&&s.rendering.surfacePending===0&&!s.rendering.cameraMoving){await delay(450);return call('getState');}await delay(100);}throw Error('surface generation timed out');}
function unchanged(before,after){assert.deepEqual(after.definition,before.definition);assert.deepEqual(after.camera,before.camera);assert.equal(after.simulation.time,before.simulation.time);assert.equal(after.simulation.selected,before.simulation.selected);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);}
function screenshot(name){const remote='/data/local/tmp/sph-surface-'+name+'.png',dest=root+'../OpenSPH-0.32.0-'+name+'.png';h('shell','rm','-f',remote);h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,dest);const png=readFileSync(dest);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(png.readUInt32BE(16)>500&&png.readUInt32BE(20)>500);captures.push(dest.split('/').pop());}
try{
 call('listCommands');call('getUiState');action('theme.three-worlds','paused');call('setAppearance',{autoSpin:false});call('navigateCamera',{focus:1,closeup:true,durationMs:420},['--wait-camera']);call('setPanel',{panel:1});await ready();
 const before=call('getState');assert.equal(before.surfaces.length,before.definition.config.orbitBodies.length);assert.ok(before.rendering.surfaceGenerated>=3);
 call('setSurfaceSeed',{body:1,surfaceSeed:731,cloudSeed:919});let first=await ready();unchanged(before,first);assert.deepEqual(first.surfaces[1],{version:1,seed:731,cloudSeed:919});checks.push('seed edit reaches native generator without scene, timeline, surface or camera restart');screenshot('ocean-seed-731');
 action('terrain.clouds');const clouds=await ready();assert.equal(clouds.surfaces[1].seed,731);assert.notEqual(clouds.surfaces[1].cloudSeed,919);unchanged(first,clouds);
 action('terrain.undo');assert.deepEqual((await ready()).surfaces,first.surfaces);action('terrain.redo');assert.deepEqual((await ready()).surfaces,clouds.surfaces);checks.push('cloud-only action and independent visual undo/redo preserve scene');
 call('setSurfaceSeed',{body:1,surfaceSeed:391,cloudSeed:919});let second=await ready();screenshot('ocean-seed-391');
 const saved=call('saveProject',{title:'验收 · 独立外观'});created.push(saved.id);action('theme.rock-slow','paused');h('shell','aa','force-stop','com.opensph.lab');call('loadProject',{id:saved.id},['--wait-state','paused']);assert.deepEqual((await ready()).surfaces,second.surfaces);checks.push('cold process restores versioned per-body recipes after changing scene');
 action('orbit.select.1');action('orbit.copy');action('placement.confirm','paused');let copied=await ready();assert.deepEqual(copied.surfaces.at(-1),copied.surfaces[1]);const original=copied.surfaces;action('orbit.select.1');action('orbit.remove','paused');let removed=await ready();assert.deepEqual(removed.surfaces.at(-1),original[1]);action('orbit.undo','paused');assert.deepEqual((await ready()).surfaces,original);checks.push('copy and deletion remap surfaces; body-history undo restores association');
 const stable=call('getState');const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setSurfaceSeed','--payload-json',JSON.stringify({body:1,surfaceSeed:1.5})],{encoding:'utf8'});assert.equal(bad.status,2);unchanged(stable,call('getState'));checks.push('invalid seed rejected before mutation');
 action('theme.moon-atlas','paused');await ready();const moon=spawnSync(process.execPath,[cli,'--device',device,'--command','setSurfaceSeed','--payload-json',JSON.stringify({body:1,surfaceSeed:42})],{encoding:'utf8'});assert.equal(moon.status,2);assert.ok(call('getState').surfaces.every(v=>v.seed===0));checks.push('real moon atlas cannot receive synthetic geography');
 call('loadProject',{id:saved.id},['--wait-state','paused']);call('navigateCamera',{focus:1,closeup:true,durationMs:420},['--wait-camera']);call('setPanel',{panel:1});await ready();
 for(const [name,fold,orientation] of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  const seeds=call('getState').surfaces;h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});
  let s;for(let i=0;i<40;i++){s=await ready();const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000))break;if(i===39)throw Error('layout timeout');await delay(100);}
  assert.deepEqual(s.surfaces,seeds);assert.equal(s.camera.focus,1);assert.equal(s.window.immersive,true);screenshot('surface-'+name);checks.push(name+' preserves recipe, focus and immersion after resizing');
 }
 const result={ok:true,version:'0.32.0',device,checks,captures,final:call('getState'),limits:['semantic actions and static screenshots; no touch hit or animation frame-rate claim','emulator only; no scientific generation validation']};writeFileSync(root+'docs/evidence/surfaces-0.32.0-emulator.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,checks,captures}));
}finally{for(const id of created){assert.match(id,/^project-[0-9]+-[0-9]+$/);h('shell','rm','-f','/data/app/el2/100/base/com.opensph.lab/haps/entry/files/'+id+'.json');}}
