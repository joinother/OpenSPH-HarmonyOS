#!/usr/bin/env node
// Caller must preserve active scene and saved replay before running.
import assert from 'node:assert/strict';import{execFileSync,spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';import{mkdtempSync,writeFileSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url)),hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','90000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:100000}));
const action=a=>call('uiAction',{action:a}),h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:20000});
const temp=mkdtempSync(tmpdir()+'/sph-comparison-ui-'),remote='/data/app/el2/100/base/com.opensph.lab/haps/entry/files/sph-reference.json';
const unchanged=(a,b)=>{assert.deepEqual(a.camera,b.camera);assert.equal(a.simulation.time,b.simulation.time);assert.equal(a.simulation.frames,b.simulation.frames);assert.equal(a.rendering.sceneRevision,b.rendering.sceneRevision);};
try{
 call('listCommands');call('getUiState');assert.equal(call('getSphReference').reference,null);
 const orbitBefore=call('getObservationReference');
 call('uiAction',{action:'theme.sphere-unprepared'},'paused');call('start',{},'completed');const before=call('getState');action('sph.reference.capture');const saved=call('getSphReference').reference;assert.equal(saved.config.relaxationSeconds??0,0);assert.equal(saved.data.samples.length,before.simulation.frames);unchanged(before,call('getState'));
 h('shell','aa','force-stop','com.opensph.lab');h('shell','aa','start','-a','EntryAbility','-b','com.opensph.lab');assert.deepEqual(call('getSphReference').reference,saved);
 call('uiAction',{action:'theme.sphere-release'},'paused');call('start',{},'completed');const active=call('getState'),charts=[];
 for(const metric of ['pressure','internal','damage','kinetic','energy','gravity','relativeKinetic','radius','radial']){
  action('sph.metric.'+metric);const c=call('getSphComparison');assert.ok(c.chart.referenceVisible&&c.chart.overlap);assert.deepEqual(c.differences,['预松弛 s：0 → 64']);assert.equal(c.reference.title,saved.title);assert.equal(c.currentModel,'sph-rock-prepared-v1');assert.ok(c.chart.deltaReady);charts.push({metric,chart:c.chart});
 }
 unchanged(active,call('getState'));assert.deepEqual(call('getSphReference').reference,saved);
 action('sph.metric.relativeKinetic');const table=call('getSphComparisonTable'),raw=call('getSphTable');assert.equal(table.rows,saved.data.samples.length+active.simulation.frames);assert.equal(table.unit,'J');assert.equal(table.timeAlignment,'simulation-start');
 const rows=table.csv.trim().split('\n').slice(1).map(s=>s.split(',')),currentRows=raw.csv.trim().split('\n').slice(1).map(s=>s.split(',').map(Number));
 assert.deepEqual(rows.filter(r=>r[0]==='current').map(r=>r.slice(1).map(Number)),currentRows.map(r=>[r[0],r[1],r[13]]));assert.deepEqual(rows.filter(r=>r[0]==='reference').map(r=>r.slice(1).map(Number)),saved.data.samples.map(s=>[s.frame,s.time,s.structure[1]]));
 call('seek',{frame:7});const cursor=call('getSphComparison');const t=cursor.chart.plot.currentTime,ss=saved.data.samples;let expected;
 for(let i=0;i<ss.length;i++){if(ss[i].time<t)continue;expected=ss[i].structure[1];if(ss[i].time>t){const f=(t-ss[i-1].time)/(ss[i].time-ss[i-1].time);expected=(1-f)*ss[i-1].structure[1]+f*expected;}break;}
 assert.equal(cursor.chart.referenceValue,expected);assert.equal(cursor.chart.delta,cursor.chart.plot.current-expected);
 const selected=call('getState');action('sph.reference.toggle');assert.equal(call('getSphComparison').chart.referenceVisible,false);assert.equal(call('getSphComparisonTable').csv,table.csv);action('sph.reference.toggle');unchanged(selected,call('getState'));call('seek',{frame:-1});
 // Invalid persisted data must remain on disk for recovery, never silently overwrite it.
 h('file','recv',remote,temp+'/saved.json');writeFileSync(temp+'/bad.json','{"schemaVersion":99}');h('file','send',temp+'/bad.json',remote);
 const failed=spawnSync(process.execPath,[cli,'--device',device,'--command','uiAction','--payload-json',JSON.stringify({action:'sph.reference.reload'})],{encoding:'utf8',timeout:30000});assert.equal(failed.status,2);const bad=call('getSphReference');assert.equal(bad.reference,null);assert.ok(bad.error);h('file','recv',remote,temp+'/after-bad.json');assert.equal(readFileSync(temp+'/after-bad.json','utf8'),' {"schemaVersion":99}'.trim());
 h('file','send',temp+'/saved.json',remote);action('sph.reference.reload');assert.deepEqual(call('getSphReference').reference,saved);
 action('sph.reference.clear');assert.equal(call('getSphReference').reference,null);unchanged(active,call('getState'));assert.deepEqual(call('getObservationReference'),orbitBefore);
 action('sph.reference.capture');const replacement=call('getSphReference').reference;assert.equal(replacement.config.relaxationSeconds,64);assert.equal(replacement.model,'sph-rock-prepared-v1');
 // Leave two different visible curves for layout acceptance; reference stays frozen.
 call('uiAction',{action:'theme.sphere-unprepared'},'paused');call('start',{},'completed');action('panel.observe');action('sph.metric.relativeKinetic');
 console.log(JSON.stringify({ok:true,device,checks:['saved SPH reference survives cold application restart and scene switch','nine shared-axis metrics preserve preparation-only parameter difference','raw CSV exactly matches native current and saved source samples','cursor interpolation independently checked; hiding does not change export','save/read/hide/clear preserve history, camera and scene revision','invalid file reported and kept intact; restoring valid file recovers reference','SPH reference separate from existing orbital reference; replacement preserves applied model'],reference:{title:saved.title,config:saved.config,frames:saved.data.samples.length},charts,cursor,table:{rows:table.rows,metric:table.metric,unit:table.unit},replacement:{title:replacement.title,config:replacement.config},final:call('getSphComparison')},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
