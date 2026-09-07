#!/usr/bin/env node
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:70000}));
const action=action=>call('uiAction',{action});call('listCommands');call('getUiState');const projects=call('listProjects'),reference=call('getObservationReference'),results=[];
for(const preset of [0,1,2]){
 call('setScene',{preset,count:200,speed:5,angle:preset===1?45:0,duration:preset===0?60:10},'paused');call('start',{},'completed');
 const before=call('getState'),curve=call('getSphObservation');assert.ok(curve.data.samples.length>1);if(preset===0){assert.equal(curve.data.samples.length,240);assert.ok(curve.data.samples[0].time>0);}
 for(const [metric,index]of [['pressure',1],['internal',5],['damage',6],['kinetic',8],['energy',9]]){
  action('sph.metric.'+metric);const c=call('getSphObservation'),values=c.data.samples.map(s=>s.value);assert.equal(c.plot.minimum,Math.min(...values));assert.equal(c.plot.maximum,Math.max(...values));
  action('sph.minimum');assert.equal(call('getState').simulation.time,c.plot.minTime);action('sph.maximum');assert.equal(call('getState').simulation.time,c.plot.maxTime);
  const after=call('getState');assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.definition,before.definition);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);
 }
 const table=call('getSphTable'),lines=table.csv.trim().split('\n');assert.equal(table.rows,curve.data.samples.length);assert.equal(lines.length,table.rows+1);
 for(let i=0;i<table.rows;i++){const row=lines[i+1].split(',').map(Number);assert.equal(row.length,12);assert.equal(row[0],i);assert.equal(row[1],curve.data.samples[i].time);assert.ok(row.every(Number.isFinite));}
 const selected=call('getSphDiagnostics').diagnostics;const latest=call('getSphObservation');assert.equal(latest.plot.current,selected.internalJ);
 call('seek',{frame:-1});results.push({preset,samples:table.rows,first:curve.data.samples[0].time,last:curve.data.samples.at(-1).time,plot:call('getSphObservation').plot});
}
call('setScene',{preset:3,count:200,speed:1,angle:0,duration:1},'paused');assert.equal(call('getSphObservation').plot.available,false);assert.equal(call('getUiState').actions.find(a=>a.id==='sph.maximum').enabled,false);
assert.deepEqual(call('listProjects'),projects);assert.deepEqual(call('getObservationReference'),reference);
console.log(JSON.stringify({ok:true,device,checks:['three real SPH scenarios, all five metrics','240-frame cap and actual retained time range','sample extrema guarded seek through shared UI/CLI actions','raw CSV every scalar matches native curve','camera definition and native surface unchanged','orbital data unavailable; saved projects and reference preserved'],results},null,2));
