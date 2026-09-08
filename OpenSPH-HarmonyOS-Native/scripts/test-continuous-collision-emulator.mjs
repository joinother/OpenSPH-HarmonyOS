#!/usr/bin/env node
// R01 collector. Exit 2 means measured product workflow is incomplete, not a transport failure.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {request,options,waitForSimulation} from './opensph-cli.mjs';
import {score,compareRuns} from './collision-acceptance.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const [device,outArg,backupArg]=process.argv.slice(2);
if(device!=='127.0.0.1:5555'||!outArg||!backupArg)throw Error('Designated device, NEW evidence directory and NEW private backup directory required');
const out=resolve(outArg),backup=resolve(backupArg);mkdirSync(out,{recursive:false});mkdirSync(backup,{recursive:false});
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=readFileSync('examples/acceptance/continuous-collision-v1.json'),fixture=JSON.parse(bytes);
const report={schemaVersion:1,task:'R01',device,fixtureSha256:hash(bytes),collectionComplete:false,workflowComplete:false,runs:[],errors:[],restoration:{completed:false}};
const save=()=>writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const log=(message)=>{console.log(message);save();};
const h=(...a)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...a],{encoding:'utf8',timeout:60000,maxBuffer:12e6});
async function call(command,payload={},wait){const o=options(['--device',device,'--command',command,'--payload-json',JSON.stringify(payload),'--timeout','120000']);let r=await request(o);if(wait&&r.ok)r=await waitForSimulation({...o,'wait-state':wait},r);if(!r.ok)throw Error(command+': '+JSON.stringify(r));return r;}
const action=(id,wait)=>call('uiAction',{action:id},wait),state=()=>call('getState');
const files=dir=>{const entries=[];function visit(base,relative=''){for(const n of readdirSync(base).sort()){const path=join(base,n),key=relative?relative+'/'+n:n;if(statSync(path).isDirectory())visit(path,key);else entries.push([key,hash(readFileSync(path))]);}}visit(dir);return Object.fromEntries(entries);};
const remote='/data/app/el2/100/base/com.opensph.lab/haps/entry/files';
let before,backed=false;
try{
 const installed=h('shell','bm','dump','-n','com.opensph.lab');const versions=[...installed.matchAll(/\"versionName\"\s*:\s*\"([^\"]+)\"/g)].map(m=>m[1]);assert.ok(versions.includes(fixture.baselineVersion),'Collector requires the declared baseline app version');report.installedVersion=fixture.baselineVersion;
 const commands=await call('listCommands');const ui=await call('getUiState');before=await state();
 // A fresh paused zero-time SPH scene can be reconstructed without losing evolved state.
 // Other active sessions require a separately supported preservation path; fail before mutations.
 assert.ok(before.scene.preset<3&&before.simulation.state==='paused'&&before.simulation.time===0&&before.simulation.frames===1&&before.simulation.selected===-1&&!before.scene.dirty&&!before.placement.active&&!before.ui.playing&&!before.editor.orbitDraft&&!before.editor.drafts.length&&!before.editor.history.undoCount&&!before.editor.history.redoCount&&['idle','error'].includes(before.video.state)&&!before.ringTrace.enabled,'Requires pristine paused SPH initial frame; preserve other session types before testing');
 writeFileSync(join(backup,'before.json'),JSON.stringify(before));
 h('file','recv',remote,join(backup,'original-files'));const original=files(join(backup,'original-files'));writeFileSync(join(backup,'file-hashes.json'),JSON.stringify(original));backed=true;
 writeFileSync(join(out,'catalog.json'),JSON.stringify({commands:commands.commands,actions:ui.actions.filter(a=>!a.id.startsWith('project.')).map(a=>({id:a.id}))},null,2));
 async function launch(xAU){const config=structuredClone(fixture.baseScene);config.orbitBodies[1].xAU=xAU;await call('setScene',config,'paused');await call('setCamera',{yaw:0,pitch:0,zoom:4.2,focus:1,color:0});
  const prior=await state();await action('selection.launch');await action('placement.cancel');assert.deepEqual((await state()).simulation.orbitState,prior.simulation.orbitState);
  await action('selection.launch');await action('placement.units.center');await action('placement.units.radius');
  const l=fixture.launch;const values=[l.massKg,l.distanceKm,l.azimuthDeg,l.inclinationDeg,l.relativeSpeedKmS,l.radiusKm];
  for(let i=0;i<values.length;i++)await call('setUiValue',{field:'placement.value.'+i,value:String(values[i])});
  await call('setUiValue',{field:'placement.name',value:'60 km 岩体'});await action('placement.surface.5');
  const preview=await call('getPlacementPreview');assert.equal(preview.preview.valid,true);assert.ok(Math.abs(preview.preview.speedKmS-8)<1e-10);
  await action('placement.confirm');const placed=await state();assert.equal(placed.simulation.orbitState.length,3);assert.deepEqual(placed.simulation.orbitState.slice(0,2),prior.simulation.orbitState);assert.equal(placed.simulation.time,prior.simulation.time);
  return placed;
 }
 for(let repeat=1;repeat<=2;repeat++){
  const run={repeat,fixtureSha256:hash(bytes),collectionComplete:false,cases:[]};report.runs.push(run);let g1Config;
  for(const f of fixture.cases){const started=Date.now();const result={id:f.id,checks:[],observations:{}};run.cases.push(result);log(`Run ${repeat} ${f.id}: starting`);
   const check=(id,status,evidence)=>result.checks.push({id,status,evidence});
   let initial;
   if(f.id==='G2'){const changed=structuredClone(g1Config);changed.orbitBodies[2].xAU+=f.offsetKm/149597870.7;await call('setScene',changed,'paused');initial=await state();const reverted=structuredClone(changed);reverted.orbitBodies[2].xAU=g1Config.orbitBodies[2].xAU;assert.deepEqual(reverted,g1Config);result.observations.changedField={field:'orbitBodies[2].xAU',deltaKm:f.offsetKm};}
   else initial=await launch(f.xAU);
   if(f.id==='G1')g1Config=structuredClone(initial.simulation.config);
   result.observations.initialConfig=initial.simulation.config;result.observations.initialWorld=initial.simulation.orbitState;
   check('placement','passed',f.id==='G2'?'G1 applied configuration copied, only projectile x offset changed':'Selected target → launch preview → cancel preserves original vectors → configure mass/distance/speed/radius → confirm preserves original bodies and time');
   await action('time.rate.0.01');
   if(!f.contactExpected){await call('start');const deadline=Date.now()+60000;let latest;do{latest=await state();if(latest.simulation.state==='failed')throw Error(latest.simulation.error);if(Date.now()>deadline)throw Error('Near-miss observation deadline');}while(latest.simulation.time*31557600<f.observationMinimumSeconds);await call('pause');latest=await state();assert.equal(latest.simulation.contact?.count??0,0);assert.equal(latest.simulation.model,'nbody-hard-sphere-v1');assert.equal(latest.simulation.sph?.available??false,false);
    result.observations.noContact=latest.simulation;check('contact','passed','No contact during the measured window of at least 90 seconds; not a long-term no-contact claim');check('materialEvolution','not_tested','No-contact control; no SPH or heat should be triggered');
    const beforeView=latest;await action('camera.reset');await action('orbit.select.1');await action('orbit.near');const afterView=await state();assert.equal(afterView.simulation.time,beforeView.simulation.time);assert.deepEqual(afterView.simulation.orbitState,beforeView.simulation.orbitState);check('continuousView','passed','Near-miss camera changes preserve the same world/time; no cross-model transition in this control');
    await call('saveReplay');h('shell','aa','force-stop','com.opensph.lab');await call('listCommands');await call('getUiState');await call('loadReplay');const loaded=await state();assert.deepEqual(loaded.simulation.orbitState,latest.simulation.orbitState);assert.equal(loaded.simulation.time,latest.simulation.time);await call('start');const resumed=await state();await call('pause');assert.ok(resumed.simulation.time>loaded.simulation.time);check('worldEvolution','passed','Ordinary orbit clock advances, survives pause and restart');check('restartAndContinue','passed','Cold process loads saved near-miss orbit and advances it');check('commitRemnants','not_tested','No collision, therefore no remnant submission tested');check('addAfterImpact','not_tested','No committed impact result exists in this control');
   }else{
    await call('start',{},'paused');const parent=await state(),plan=await call('getImpactPlan');assert.equal(plan.contact.incoming.withinCurrentBounds,true);result.observations.contact=plan.contact;result.observations.parent=parent.simulation;result.observations.parentCamera=parent.camera;check('contact','passed','Actual surface contact captured after aimed insertion; incoming SPH bounds pass');
    await action(f.tides?'impact.simulateTides':'impact.simulate','paused');const local=await state();assert.equal(local.simulation.time,0);await action('simulation.toggle','completed');await action('fragments.inspect');await action('color.0');const done=await state();assert.ok(done.simulation.time>=60);assert.ok(done.simulation.sph.internalJ>local.simulation.sph.internalJ);assert.ok(Math.abs(done.simulation.totalMass/local.simulation.totalMass-1)<1e-9);result.observations.localInitial=local.simulation;result.observations.localFinal=done.simulation;result.observations.localCamera=done.camera;result.observations.fragments=(await call('getSphFragments',{limit:32})).fragments;
    check('materialEvolution','passed','Actual SPH reaches at least 60 seconds; internal energy rises and total mass is retained');check('continuousView','unsupported','Local SPH replaces the displayed world/history and changes camera; R03 continuity contract is absent');check('worldEvolution','unsupported',f.tides?'Frozen external tide; external world is retained for return and is not synchronously advanced':'Isolated local solver; parent world is retained without advancing');
    const available=await call('getUiState');result.observations.impactActions=available.actions.filter(a=>a.id.startsWith('impact.')||a.id==='orbit.add');
    await call('saveReplay');const blocked=await request(options(['--device',device,'--command','uiAction','--payload-json',JSON.stringify({action:'orbit.add'})]));assert.equal(blocked.ok,false);result.observations.addRejected=blocked;
    await action('impact.return');const returned=await state();assert.deepEqual(returned.simulation.orbitState,parent.simulation.orbitState);assert.equal(returned.simulation.time,parent.simulation.time);result.observations.returnedWorld=returned.simulation.orbitState;result.observations.returnedTime=returned.simulation.time;
    check('commitRemnants','unsupported','Only return is available; measured return restores exact original parent vectors and time, not SPH remnants');check('addAfterImpact','unsupported','Adding while local impact is active is rejected; returning would add to unchanged parent, so it is not counted');
    h('shell','aa','force-stop','com.opensph.lab');await call('listCommands');await call('getUiState');await call('loadReplay');await call('seek',{frame:done.simulation.frames-1});const loaded=await state();assert.deepEqual(loaded.simulation.sph,done.simulation.sph);assert.equal(loaded.simulation.impact.canReturn,false);result.observations.loadedImpact=loaded.simulation.impact;
    check('restartAndContinue','unsupported','Cold reload preserves local diagnostics, but has no parent session/solver continuation; it is observation replay only');
    h('shell','snapshot_display','-f','/data/local/tmp/r01.jpeg');h('file','recv','/data/local/tmp/r01.jpeg',join(out,`run-${repeat}-${f.id}.jpeg`));await action('fragments.material');await action('preset.0','paused');
   }
   Object.assign(result,score(result.checks));result.wallSeconds=(Date.now()-started)/1000;log(`Run ${repeat} ${f.id}: collected; workflowComplete=${result.workflowComplete}`);
  }
  run.collectionComplete=true;save();
 }
 report.repeatStatusesMatch=compareRuns(report.runs[0],report.runs[1]);assert.equal(report.repeatStatusesMatch,true);report.collectionComplete=true;report.workflowComplete=report.runs.every(r=>r.cases.every(c=>c.workflowComplete));
}catch(error){report.errors.push(String(error.stack??error));process.exitCode=1;}
finally{
 if(backed){try{let current=await state();if(current.simulation.impact?.canReturn)await action('impact.return');if(current.placement.active)await action('placement.cancel');await call('pause');await call('setScene',before.simulation.config,'paused');await call('setUiValue',{field:'scene.title',value:before.definition.title});await call('setAppearance',before.appearance);await call('setMaterial',before.material);await call('setCamera',before.camera);await action(before.ui.fragmentFirst?'fragments.inspect':'fragments.material');await action(before.ui.toolsVisible?'ui.restore':'ui.focus');await call('setPanel',{panel:before.ui.panelOpen?before.ui.panel:-1});
  const restored=await state();assert.deepEqual(restored.simulation.config,before.simulation.config);assert.equal(restored.simulation.time,0);assert.equal(restored.simulation.state,'paused');assert.deepEqual(restored.camera,before.camera);assert.deepEqual(restored.appearance,before.appearance);
  for(const name of Object.keys(files(join(backup,'original-files'))))h('file','send',join(backup,'original-files',name),remote+'/'+name);
  h('file','recv',remote,join(backup,'restored-files'));const old=JSON.parse(readFileSync(join(backup,'file-hashes.json'))),now=files(join(backup,'restored-files'));assert.deepEqual(now,old);report.restoration={completed:true,persistentFiles:Object.keys(old).length,exactFiles:true,initialPausedScene:true,camera:true,appearance:true};
 }catch(e){report.errors.push('RESTORATION: '+String(e.stack??e));process.exitCode=1;}}
 save();
}
if(!process.exitCode)process.exitCode=report.workflowComplete?0:2;
console.log(JSON.stringify({collectionComplete:report.collectionComplete,workflowComplete:report.workflowComplete,restoration:report.restoration,errors:report.errors}));
