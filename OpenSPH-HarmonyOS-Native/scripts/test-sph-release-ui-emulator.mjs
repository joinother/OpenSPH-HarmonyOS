#!/usr/bin/env node
// Backs up neither scene nor replay; caller must preserve both before running.
import assert from 'node:assert/strict';import{execFileSync,spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','90000','--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:100000}));
function verifySummary(){
 const before=call('getState'),r=call('getSphWindowSummary').summary,table=call('getSphTable');const rows=table.csv.trim().split('\n').slice(1).map(s=>s.split(',').map(Number));assert.ok(r.available);assert.equal(r.samples,rows.length);assert.equal(r.firstTime,rows[0][1]);assert.equal(r.lastTime,rows.at(-1)[1]);assert.equal(r.includesInitial,rows[0][1]===0);
 const span=rows.at(-1)[1]-rows[0][1];let mean=0,change=0,peak=0;
 for(let i=0;i<rows.length;i++){change=Math.max(change,Math.abs(rows[i][14]/rows[0][14]-1)*100);peak=Math.max(peak,Math.abs(rows[i][15]));if(i>0)mean+=(rows[i][1]-rows[i-1][1])/span*(rows[i-1][13]/2+rows[i][13]/2);}
 assert.equal(r.meanKineticJ,mean);assert.equal(r.maxRadiusChangePercent,change);assert.equal(r.peakAbsRadialMS,peak);assert.equal(r.stable,undefined);
 const after=call('getState');assert.deepEqual(after.camera,before.camera);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.simulation.time,before.simulation.time);return r;
}
call('listCommands');call('getUiState');const cases=[];
for(const id of ['sphere-unprepared','sphere-release']){
 call('uiAction',{action:'theme.'+id},'paused');const initial=call('getState');assert.equal(initial.simulation.maxSpeed,0);assert.equal(initial.simulation.config.speed,0);assert.equal(initial.simulation.config.targetSpin,0);assert.equal(call('getSphWindowSummary').summary.available,false);
 const completed=call('start',{},'completed'),summary=verifySummary();assert.ok(summary.includesInitial);assert.equal(completed.simulation.config.preset,2);cases.push({id,initial,completed,summary});
}
const expected=cases[1].summary;call('seek',{frame:0});assert.deepEqual(call('getSphWindowSummary').summary,expected);call('seek',{frame:-1});call('saveReplay');call('loadReplay');call('seek',{frame:-1});const restored=verifySummary();assert.deepEqual({...restored,sceneRevision:expected.sceneRevision},expected);
const saved=call('saveProject',{title:'验收临时静止岩球'});try{call('uiAction',{action:'theme.sphere-unprepared'},'paused');call('loadProject',{id:saved.id},'paused');assert.equal(call('getState').simulation.maxSpeed,0);}finally{assert.match(saved.id,/^project-[0-9]+-[0-9]+$/);execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,'shell','rm','-f','/data/app/el2/100/base/com.opensph.lab/haps/entry/files/'+saved.id+'.json']);}
const config=call('getState').simulation.config;
for(const patch of [{preset:0},{preset:1},{speed:-1}]){const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setScene','--payload-json',JSON.stringify({...config,...patch})],{encoding:'utf8',timeout:30000});assert.equal(bad.status,2);}
call('setScene',{...config,relaxationSeconds:0,duration:40},'paused');call('start',{},'completed');const evicted=verifySummary();assert.equal(evicted.samples,240);assert.equal(evicted.includesInitial,false);assert.ok(evicted.firstTime>0);
console.log(JSON.stringify({ok:true,device,checks:['two static sphere themes have exactly zero initial spin','new summary matches independent CSV integration, extrema and actual adaptive sampling','playback selection does not truncate window summary; reads preserve camera and scene','zero-speed prepared replay and named project roundtrip','zero impact and negative speed rejected','evicted initial frame explicitly disclosed; no equilibrium verdict'],cases,restored,evicted},null,2));
