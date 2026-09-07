#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs';
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:20000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:40000}));
const action=action=>call('uiAction',{action}),ref=()=>call('getObservationReference').reference;
const run=(speed,duration)=>{call('setScene',{preset:3,count:600,speed,angle:0,duration},'paused');call('start',{},'completed');};
const restart=()=>{h('shell','aa','force-stop','com.opensph.lab');return call('getObservationReference');};
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-11*Math.max(1,Math.abs(b)),`${a} differs from ${b}`);
const temp=mkdtempSync(tmpdir()+'/sph-comparison-'),results=[];
try{
 call('listCommands');call('getUiState');assert.equal(ref(),null,'test requires no preexisting reference; preserve it before running');
 const projects=call('listProjects');
 call('setScene',{preset:3,count:600,speed:.85,angle:0,duration:2},'paused');
 assert.equal(call('getUiState').actions.find(a=>a.id==='comparison.capture').enabled,false);
 const rejected=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json','{"action":"comparison.capture"}'],{encoding:'utf8'});assert.equal(rejected.status,2);assert.equal(ref(),null);
 call('start',{},'completed');call('seek',{frame:100});
 const before=call('getState'),first=call('getOrbitObservation');action('comparison.capture');const original=ref(),after=call('getState');
 assert.equal(original.data.samples.length,240);assert.deepEqual(original.data,first.data);assert.deepEqual(original.config,before.simulation.config);
 assert.deepEqual(after.simulation,before.simulation);assert.deepEqual(after.camera,before.camera);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);
 action('comparison.toggle');assert.equal(call('getObservationComparison').chart.referenceVisible,false);assert.deepEqual(ref(),original);action('comparison.toggle');
 run(1,2);call('seek',{frame:100});const current=call('getOrbitObservation');assert.deepEqual(ref(),original);
 for(const metric of ['distance','speed']){
  action('observation.'+metric);const c=call('getObservationComparison'),single=call('getOrbitObservation');
  assert.equal(c.chart.referenceVisible,true);assert.equal(c.chart.overlap,true);assert.equal(c.chart.deltaReady,true);
  const samples=original.data.samples,t=single.plot.currentTime,k=samples.findIndex(s=>s.time>=t),right=samples[k],left=samples[Math.max(0,k-1)],field=metric==='distance'?'distanceAU':'speedKmS';
  const expected=right.time===t?right[field]:left[field]+(right[field]-left[field])*(t-left.time)/(right.time-left.time);
  close(c.chart.referenceValue,expected);close(c.chart.delta,single.plot.current-expected);
  assert.equal(c.chart.plot.firstTime,Math.min(single.plot.firstTime,samples[0].time));assert.equal(c.chart.plot.lastTime,Math.max(single.plot.lastTime,samples.at(-1).time));
  assert.ok(c.chart.plot.low<=single.plot.minimum&&c.chart.plot.high>=single.plot.maximum);assert.notEqual(c.chart.referencePath,c.chart.plot.path);
  action('observation.maximum');assert.equal(call('getState').simulation.selected,single.plot.maxFrame);
  results.push({metric,comparison:c,singlePlot:single.plot});
 }
 const table=call('getObservationTable');assert.equal(table.rows,480);assert.equal(table.timeAlignment,'simulation-start');
 const lines=table.csv.trimEnd().split('\n');assert.equal(lines.length,481);
 for(const [series,data]of [['current',current.data],['reference',original.data]])for(const s of data.samples){const row=lines.find(l=>l.startsWith(series+','+s.frame+','));assert.ok(row,'missing '+series+' '+s.frame);const values=row.split(',').slice(1).map(Number);assert.equal(values[0],s.frame);for(const [i,v]of [s.time,s.distanceAU,s.speedKmS].entries())assert.ok(Math.abs(values[i+1]-v)<=2*Number.EPSILON*Math.max(1,Math.abs(v)),JSON.stringify({series,s,row}));}
 const exported=JSON.parse(execFileSync(process.execPath,[root+'scripts/export-observation.mjs','--device',device,'--output',temp+'/comparison.csv'],{encoding:'utf8',timeout:40000}));
 assert.equal(readFileSync(exported.csv,'utf8'),table.csv);assert.deepEqual(JSON.parse(readFileSync(exported.metadata)).reference,table.reference);
 const duplicate=spawnSync(process.execPath,[root+'scripts/export-observation.mjs','--device',device,'--output',temp+'/comparison.csv'],{encoding:'utf8',timeout:40000});assert.notEqual(duplicate.status,0);assert.equal(readFileSync(exported.csv,'utf8'),table.csv);
 assert.deepEqual(call('listProjects'),projects);assert.deepEqual(restart().reference,original);
 run(.95,1);const gap=call('getObservationComparison');assert.equal(gap.chart.overlap,false);assert.equal(gap.chart.deltaReady,false);assert.equal(gap.chart.referenceVisible,true);
 action('comparison.capture');const replacement=ref();assert.equal(replacement.config.speed,.95);assert.equal(replacement.config.duration,1);assert.notDeepEqual(replacement,original);assert.deepEqual(restart().reference,replacement);
 action('comparison.clear');assert.equal(ref(),null);assert.equal(restart().reference,null);assert.deepEqual(call('listProjects'),projects);
 console.log(JSON.stringify({ok:true,device,checks:['single-frame capture disabled and rejected','capture preserves solver, cursor, camera and surface','reference survives new scenes, visibility changes and two cold launches','both metrics share absolute-time axes and validated interpolated deltas','extrema seek current samples','480 original CSV rows with metadata and overwrite refusal','disjoint windows suppress difference','replacement persists and clear survives cold launch','saved experiment list preserved'],reference:original,results,gap,table,replacement},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
