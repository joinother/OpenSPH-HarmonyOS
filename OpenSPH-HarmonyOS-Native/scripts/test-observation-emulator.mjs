#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:40000}));
const action=(action,wait)=>call('uiAction',{action},wait),results=[];
call('listCommands');call('getUiState');if(call('getState').placement.active)action('placement.cancel');
call('setScene',{preset:3,count:600,speed:.85,angle:0,duration:2},'paused');call('setAppearance',{autoSpin:false});
let first=call('getOrbitObservation');assert.equal(first.data.samples.length,1);assert.equal(first.plot.available,true);assert.equal(first.plot.currentTime,0);
call('start',{},'completed');action('panel.observe');
const before=call('getState');const o=call('getOrbitObservation');assert.equal(o.data.samples.length,240);assert.ok(o.plot.firstTime>0);assert.ok(o.plot.maximum-o.plot.minimum>.1);
assert.deepEqual(call('getState').simulation,before.simulation);
for(const metric of ['distance','speed']){
 action('observation.'+metric);const chart=call('getOrbitObservation');
 for(const which of ['minimum','maximum']){
  action('observation.'+which);const s=call('getState'),sample=chart.data.samples[chart.plot[which==='minimum'?'minFrame':'maxFrame']],current=call('getOrbitObservation');
  assert.equal(s.simulation.selected,sample.frame);assert.equal(s.simulation.time,sample.time);
  const a=s.simulation.bodies[1],b=s.simulation.bodies[0],distance=Math.hypot(a.xAU-b.xAU,a.yAU-b.yAU,a.zAU-b.zAU);
  assert.ok(Math.abs(distance-sample.distanceAU)<1e-12);assert.equal(sample.speedKmS,a.speedKmS);
  assert.equal(current.plot.current,metric==='distance'?sample.distanceAU:sample.speedKmS);
  assert.deepEqual(s.definition,before.definition);assert.deepEqual(s.camera,before.camera);assert.equal(s.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(s.rendering.surfaceStarts,before.rendering.surfaceStarts);
  results.push({metric,which,plot:current.plot,selected:s.simulation.selected,time:s.simulation.time});
 }
}
call('seek',{frame:90});const selected=call('getOrbitObservation');assert.equal(selected.data.selected,90);assert.equal(selected.plot.currentTime,selected.data.samples[90].time);
call('setScene',{preset:4,count:600,speed:1,angle:0,duration:1},'paused');action('focus.3');let target=call('getOrbitObservation');assert.equal(target.data.body,3);assert.equal(target.data.samples.length,1);assert.ok(target.data.sceneRevision!==o.data.sceneRevision);
action('focus.all');assert.equal(call('getOrbitObservation').data.body,1);
call('setScene',{preset:0,count:200,speed:1,angle:0,duration:1},'paused');const sph=call('getOrbitObservation');assert.equal(sph.plot.available,false);assert.equal(sph.data.samples.length,0);
const rejection=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json','{"action":"observation.minimum"}'],{encoding:'utf8'});assert.equal(rejection.status,2);
console.log(JSON.stringify({ok:true,device,checks:['initial single frame and retained 240-frame range','distance and speed match actual selected native body snapshots','sampled extrema seek exact times without scene/camera/surface rebuild','manual timeline selection updates cursor','body selection and overview fallback','new scene clears prior samples; SPH empty and actions disabled'],first,observed:o,results,selected,target,sph},null,2));
