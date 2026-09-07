#!/usr/bin/env node
// Changes the active experiment and replay. Back up both before running.
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:70000}));
call('listCommands');call('getUiState');const runs=[];
for(const selfGravity of [false,true]){
 call('setScene',{preset:0,count:selfGravity?600:200,speed:5,angle:0,duration:16,selfGravity},'paused');
 const initial=call('getSphDiagnostics').diagnostics.structure;assert.equal(initial.length,4);assert.ok(initial[1]>0&&initial[2]>0&&initial[3]<0);assert.equal(initial[0]===0,!selfGravity);
 call('start',{},'completed');const before=call('getState'),table=call('getSphTable'),rows=table.csv.trim().split('\n').slice(1).map(r=>r.split(',').map(Number));
 assert.ok(rows.length>2);assert.ok(rows.every(r=>r.length===16&&r.every(Number.isFinite)));assert.deepEqual(rows.at(-1).slice(12),before.simulation.sph.structure);
 for(const [metric,index]of [['gravity',0],['relativeKinetic',1],['radius',2],['radial',3]]){
  call('uiAction',{action:'sph.metric.'+metric});const c=call('getSphObservation'),values=rows.map(r=>r[12+index]);
  assert.equal(c.plot.minimum,Math.min(...values));assert.equal(c.plot.maximum,Math.max(...values));assert.deepEqual(c.data.samples.map(s=>s.value),values);
  call('uiAction',{action:'sph.minimum'});assert.equal(call('getState').simulation.time,c.plot.minTime);
  call('uiAction',{action:'sph.maximum'});assert.equal(call('getState').simulation.time,c.plot.maxTime);
  const after=call('getState');assert.deepEqual(after.camera,before.camera);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);
 }
 call('seek',{frame:-1});const end=call('getSphDiagnostics');call('saveReplay');call('setScene',{preset:2,count:200,speed:1,angle:0,duration:1},'paused');call('loadReplay');call('seek',{frame:-1});
 assert.deepEqual(call('getSphDiagnostics').diagnostics,end.diagnostics);assert.equal(call('getState').simulation.config.selfGravity===true,selfGravity);
 runs.push({selfGravity,initial,final:end,rows:table.rows,csv:table.csv});
}
// Verify the largest supported gravity budget has finite structure at setup.
call('setScene',{preset:0,count:1200,speed:5,angle:0,duration:1,selfGravity:true},'paused');const large=call('getState');assert.ok(large.simulation.sph.structure.every(Number.isFinite));assert.ok(large.simulation.sph.structure[0]<0);
call('start',{},'completed');const largeEnd=call('getState');assert.ok(largeEnd.simulation.sph.structure.every(Number.isFinite));
call('setPanel',{panel:1});call('uiAction',{action:'sph.metric.gravity'});
console.log(JSON.stringify({ok:true,device,checks:['four physical structure values at setup and completion','zero potential only when gravity is disabled','all four curves and guarded extrema equal every CSV row','camera and scene identity unchanged by inspection','v7/v8 replay retains structure and model identity','1200-budget self-gravity completes with finite diagnostics'],runs,largeEnd},null,2));
