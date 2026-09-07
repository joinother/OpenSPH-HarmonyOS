#!/usr/bin/env node
import assert from 'node:assert/strict';
import{execFileSync,spawnSync}from'node:child_process';import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath}from'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:45000}));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:20000}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const action=(action,wait)=>call('uiAction',{action},wait?['--wait-state',wait]:[]),field=(field,value)=>call('setUiValue',{field,value});
const created=[],checks=[],captures=[],states=[];
async function ready(){for(let i=0;i<50;i++){const s=call('getState');assert.equal(s.rendering.error,'');assert.equal(s.rendering.surfaceError,'');if(s.rendering.texturesReady&&!s.rendering.cameraMoving&&s.rendering.surfacePending===0){await delay(250);return call('getState');}await delay(100);}throw Error('render timeout');}
function unchanged(a,b){assert.deepEqual(a.definition,b.definition);assert.deepEqual(a.camera,b.camera);assert.equal(a.simulation.time,b.simulation.time);assert.equal(a.rendering.sceneRevision,b.rendering.sceneRevision);assert.equal(a.rendering.surfaceStarts,b.rendering.surfaceStarts);}
function shot(name){const remote='/data/local/tmp/dense-ring-'+name+'.png',dest=root+'../OpenSPH-0.33.0-'+name+'.png';h('shell','rm','-f',remote);h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,dest);const data=readFileSync(dest);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');captures.push(dest.split('/').pop());}
try{
 call('listCommands');call('getUiState');h('shell','hidumper','-s','DisplayManagerService','-a','-y');await delay(800);call('setWindowOrientation',{orientation:'portrait'});await delay(800);
 // Repeated cross-model loads exercise stale render frame vs newly configured ring.
 for(let i=0;i<3;i++){action('theme.rock-slow','paused');action('theme.kepler-ring','paused');assert.equal((await ready()).ringTrace.enabled,true);}
 checks.push('three cross-model transitions retain newly configured ring after first submitted frames');
 const initial=await ready();assert.equal(initial.ringTrace.count,8192);assert.equal(initial.ringTrace.impulse,0);assert.equal(initial.ringTrace.points,false);
 const samples0=call('getRingTrace').ringTrace;assert.equal(samples0.particles.length,192);assert.equal(samples0.returnedCount,192);assert.equal(samples0.count,8192);
 call('setCamera',{...initial.camera,zoom:3.8});call('setPanel',{panel:-1});await ready();shot('ring-initial');const before=call('getState');
 action('trace.disturb');field('trace.hours',6);const disturbed=await ready();unchanged(before,disturbed);assert.equal(disturbed.ringTrace.impulse,.25);assert.equal(disturbed.ringTrace.timeHours,6);shot('ring-disturbed');states.push(disturbed);
 const samples6=call('getRingTrace').ringTrace;assert.notDeepEqual(samples6.particles,samples0.particles);action('trace.points');const grains=await ready();unchanged(before,grains);assert.equal(grains.ringTrace.timeHours,6);assert.equal(grains.ringTrace.points,true);shot('ring-grains');
 action('trace.play');await delay(300);call('pause');const played=await ready();assert.ok(played.ringTrace.timeHours>6);assert.equal(played.simulation.time,0);assert.equal(played.ringTrace.running,false);checks.push('8192 particles, bounded 192-row diagnostics, play/seek and grains share the same state; host scene/camera stay intact');
 field('trace.hours',6);const stable=call('getState');const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setUiValue','--payload-json',JSON.stringify({field:'trace.impulse',value:.36})],{encoding:'utf8'});assert.equal(bad.status,2);assert.deepEqual(call('getState').ringTrace,stable.ringTrace);
 const saved=call('saveProject',{title:'验收 · 环密度与扰动'});created.push(saved.id);action('theme.ocean-world','paused');h('shell','aa','force-stop','com.opensph.lab');call('loadProject',{id:saved.id},['--wait-state','paused']);const restored=await ready();assert.equal(restored.ringTrace.enabled,true);assert.equal(restored.ringTrace.impulse,.25);assert.equal(restored.ringTrace.points,true);assert.equal(restored.ringTrace.timeHours,6);assert.equal(restored.ringTrace.running,false);assert.deepEqual(call('getRingTrace').ringTrace.particles,samples6.particles);checks.push('invalid impulse is atomic; cold process restores identical particle coordinates and versioned disturbance settings');
 action('trace.points');action('trace.controls');await ready();
 for(const [name,fold,orientation] of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');await delay(800);call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<30;i++){s=await ready();const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000))break;if(i===29)throw Error('layout timeout');await delay(100);}
  assert.equal(s.ringTrace.enabled,true);assert.equal(s.ringTrace.timeHours,6);assert.equal(s.window.immersive,true);states.push(s);shot('ring-'+name);
 }
 checks.push('expanded, folded portrait and folded landscape retain time, focus, ring and immersion');
 action('trace.clear');assert.equal(call('getState').ringTrace.timeHours,0);assert.equal(call('getState').ringTrace.impulse,0);action('focus.all');assert.equal(call('getState').ringTrace.enabled,false);checks.push('clear disturbance restarts at zero; leaving selected planet exits local ring mode');
 const result={ok:true,version:'0.33.0',device,checks,captures,states,samples0,samples6,limits:['massless central-force ring; no mutual collisions, self-gravity or impactor','semantic CLI and inspected static captures; no touch-hit, frame-rate or physical-device claim']};writeFileSync(root+'docs/evidence/dense-ring-0.33.0-emulator.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,checks,captures}));
}finally{for(const id of created){assert.match(id,/^project-[0-9]+-[0-9]+$/);h('shell','rm','-f','/data/app/el2/100/base/com.opensph.lab/haps/entry/files/'+id+'.json');}}
