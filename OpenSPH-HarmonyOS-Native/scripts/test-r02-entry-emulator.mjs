// R02 first slice: strict completed-galaxy preservation, install, shared actions, restore.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {request,options,waitForSimulation} from './opensph-cli.mjs';
const [device,outArg,privateArg,hapArg,mode]=process.argv.slice(2);
if(device!=='127.0.0.1:5555'||!outArg||!privateArg||!hapArg)throw Error('Designated device, new public/private directories and HAP required; run from project root');
const out=resolve(outArg),backup=resolve(privateArg),hap=resolve(hapArg);mkdirSync(out);if(mode!=='restore')mkdirSync(backup);
const h=(...args)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...args],{encoding:'utf8',timeout:60000,maxBuffer:16e6});
const remote='/data/app/el2/100/base/com.opensph.lab/haps/entry/files';
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=dir=>{const pairs=[];function visit(path,rel=''){for(const n of readdirSync(path).sort()){const key=rel?rel+'/'+n:n;if(statSync(join(path,n)).isDirectory())visit(join(path,n),key);else pairs.push([key,hash(readFileSync(join(path,n)))]);}}visit(dir);return Object.fromEntries(pairs);};
async function raw(command,payload={}){return request(options(['--device',device,'--command',command,'--payload-json',JSON.stringify(payload),'--timeout','120000']));}
async function call(command,payload={},wait){let r=await raw(command,payload);assert.equal(r.ok,true,JSON.stringify(r));if(wait){r=await waitForSimulation({...options(['--device',device,'--command','getState','--timeout','120000']),'wait-state':wait},r);assert.equal(r.ok,true,JSON.stringify(r));}return r;}
const state=()=>call('getState'),action=(id,wait)=>call('uiAction',{action:id},wait);
const report={version:'0.57.0',task:'R02-first-slice',startedAt:new Date().toISOString(),checks:[],errors:[],restoration:{completed:false}};
const save=()=>writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const check=name=>{report.checks.push(name);console.log('PASS '+name);save();};
const shot=name=>{h('shell','snapshot_display','-f','/data/local/tmp/r02-ui.jpeg');h('file','recv','/data/local/tmp/r02-ui.jpeg',join(out,name+'.jpeg'));};
let before,backed=false,replaySaved=false;
if(mode==='restore'){before=JSON.parse(readFileSync(join(backup,'before.json')));assert.ok(readFileSync(join(backup,'active.osphr')).length>0);backed=true;replaySaved=true;}
try{
 if(mode!=='restore'){
 await call('listCommands');await call('getUiState');before=await state();
 assert.ok(before.scene.preset===6&&before.simulation.state==='completed'&&before.simulation.selected===-1&&!before.scene.dirty&&!before.placement.active&&!before.galaxyPlacement.active&&!before.ui.playing&&!before.ringTrace.enabled&&before.galaxyObserver.mode===0&&!before.editor.orbitDraft&&!before.editor.drafts.length&&!before.editor.history.undoCount&&!before.editor.history.redoCount&&before.video.state==='idle','Only a completed clean galaxy session is supported; reject before mutation');
 writeFileSync(join(backup,'before.json'),JSON.stringify(before));h('file','recv',remote,join(backup,'original-files'));backed=true;
 await call('saveReplay');h('file','recv',remote+'/last-replay.osphr',join(backup,'active.osphr'));replaySaved=true;
 report.hapSha256=hash(readFileSync(hap));assert.match(h('install','-r',hap),/success/i);
 await call('listCommands');await call('getUiState');assert.match(h('shell','bm','dump','-n','com.opensph.lab'),/"versionName"\s*:\s*"0\.57\.0"/);
 h('file','send',join(backup,'active.osphr'),remote+'/last-replay.osphr');await call('loadReplay');await action('replay.latest');
 const initial=await state(),ui=await call('getUiState');assert.equal(ui.actions.find(a=>a.id==='simulation.primary').label,'播放回放');assert.equal(ui.actions.find(a=>a.id==='simulation.toggle').label,'从头重跑');
 await action('simulation.primary');assert.equal((await state()).ui.playing,true);await action('simulation.primary');await action('replay.latest');
 const stopped=await state();assert.equal(stopped.simulation.time,initial.simulation.time);assert.equal(stopped.simulation.frames,initial.simulation.frames);assert.equal(stopped.simulation.orbitRevision,initial.simulation.orbitRevision);check('Galaxy primary playback preserves completed result and never restarts solver');
 await action('preset.5','paused');await action('orbit.impact.demo','paused');await action('time.rate.0.01');await action('simulation.primary','paused');
 const parent=await state(),plan=await call('getImpactPlan');assert.equal(parent.simulation.impactEntryReady,true);assert.equal(plan.entryReady,true);report.contactSeconds=plan.contact.timeSeconds;
 await action('impact.simulate','paused');const local=await state();assert.equal(local.simulation.impact.canReturn,true);assert.equal((await raw('uiAction',{action:'impact.simulate'})).ok,false);
 await action('simulation.primary','completed');const done=await state();assert.ok(done.simulation.time>=60);assert.ok(done.simulation.sph.internalJ>local.simulation.sph.internalJ);assert.ok(Math.abs(done.simulation.totalMass/local.simulation.totalMass-1)<1e-9);
 assert.match(done.ui.notice,/返回原轨道不会带入碎片/);assert.doesNotMatch(done.ui.notice,/编辑设置/);const completeUi=await call('getUiState');assert.equal(completeUi.actions.find(a=>a.id==='simulation.primary').label,'查看回放');shot('local-completed');
 await action('simulation.primary');assert.equal((await state()).simulation.impact.canReturn,true);await action('simulation.primary');await action('replay.latest');await call('saveReplay');
 check('Real local SPH reaches 60 seconds; completed primary plays results instead of returning old orbit');
 await action('impact.return');const returned=await state();assert.deepEqual(returned.simulation.orbitState,parent.simulation.orbitState);assert.equal(returned.simulation.time,parent.simulation.time);assert.deepEqual(returned.camera,parent.camera);
 await action('simulation.primary');let advanced=await state();const deadline=Date.now()+30000;while(advanced.simulation.time<=parent.simulation.time){assert.ok(Date.now()<deadline);advanced=await state();}await call('pause');advanced=await state();assert.equal(advanced.simulation.impactEntryReady,false);
 for(const id of ['impact.simulate','impact.simulateTides'])assert.equal((await raw('uiAction',{action:id})).ok,false);
 assert.deepEqual((await state()).simulation.orbitState,advanced.simulation.orbitState);report.expiredReason=advanced.simulation.impactEntryReason;check('Continued orbit rejects old collision in both shared entry actions without changing world');
 h('shell','aa','force-stop','com.opensph.lab');await call('listCommands');await call('getUiState');await call('loadReplay');await call('seek',{frame:done.simulation.frames-1});const loaded=await state();assert.equal(loaded.simulation.impact.canReturn,false);assert.deepEqual(loaded.simulation.sph,done.simulation.sph);assert.match(loaded.ui.notice,/仅供观看/);assert.doesNotMatch(loaded.ui.notice,/原轨道.*保留/);shot('local-reloaded');
 await action('simulation.primary');assert.equal((await state()).ui.playing,true);await action('simulation.primary');assert.equal((await raw('uiAction',{action:'impact.return'})).ok,false);check('Cold local replay keeps diagnostics, explains no continuation and permits only playback');
 await action('preset.5','paused');await action('orbit.impact.tidesDemo','paused');await action('time.rate.0.01');await action('simulation.primary','paused');const tidalParent=await state();assert.equal(tidalParent.simulation.impactEntryReady,true);await action('impact.simulateTides','paused');assert.equal((await state()).simulation.impact.tides,true);await action('impact.return');assert.deepEqual((await state()).simulation.orbitState,tidalParent.simulation.orbitState);check('Near-star action uses shared readiness, starts tidal branch and returns exact parent');
 const catalog=await call('getUiState');for(const [id,label] of [['theme.material-fractured','撞击受损岩石'],['theme.galaxy-retrograde','让一个星系反向旋转'],['project.save','保存设置与视角']])assert.equal(catalog.actions.find(a=>a.id===id).label,label);check('Theme and save-setting labels exposed through the same UI catalog');
}}catch(e){report.errors.push(String(e.stack??e));process.exitCode=1;}
finally{
 if(backed){let sceneRestored=!replaySaved;try{
  if(replaySaved){
   const current=await state();if(current.simulation.impact?.canReturn)await action('impact.return');
   if(before.theme.id){
    await action('theme.'+before.theme.id,'paused');const cfg=before.simulation.config;
    for(const key of ['count','speed','angle','duration'])await call('setUiValue',{field:'scene.'+key,value:cfg[key]});
    await call('setUiValue',{field:'galaxy.ratio',value:cfg.galaxyMassRatio});await call('setUiValue',{field:'galaxy.offset',value:cfg.galaxyOffsetKpc});
    const themeConfig=(await state()).simulation.config;
    if(!!themeConfig.galaxyResponsive!==!!cfg.galaxyResponsive)await action('galaxy.responsive');
    if(!!themeConfig.galaxyRetrograde!==!!cfg.galaxyRetrograde)await action('galaxy.retrograde');
    await action('simulation.apply','paused');assert.deepEqual((await state()).simulation.config,cfg);
   }else await call('setScene',before.simulation.config,'paused');
   await call('start',{},'completed');await call('saveReplay');h('file','recv',remote+'/last-replay.osphr',join(backup,'regenerated.osphr'));
   // Galaxy equations and serialization are unchanged. Require exact full replay, not a similar screenshot.
   const exact=readFileSync(join(backup,'active.osphr')).equals(readFileSync(join(backup,'regenerated.osphr')));
   if(!exact){h('file','send',join(backup,'active.osphr'),remote+'/last-replay.osphr');await call('loadReplay');}
   await call('setUiValue',{field:'scene.title',value:before.definition.title});await call('setAppearance',before.appearance);await call('setMaterial',before.material);await call('setSky',{mode:before.sky.mode,brightness:before.sky.brightness});await call('setCamera',before.camera);await action(before.ui.toolsVisible?'ui.restore':'ui.focus');await call('setPanel',{panel:before.ui.panelOpen?before.ui.panel:-1});
   const restored=await state();assert.equal(restored.simulation.time,before.simulation.time);assert.equal(restored.simulation.frames,before.simulation.frames);assert.deepEqual(restored.simulation.galaxy,before.simulation.galaxy);assert.deepEqual(restored.camera,before.camera);assert.deepEqual(restored.appearance,before.appearance);assert.deepEqual(restored.simulation.config,before.simulation.config);
   assert.equal(restored.theme.id,before.theme.id);
   report.restoration={completed:false,themeId:true,exactRegeneratedReplay:exact,mode:restored.simulation.state,time:restored.simulation.time,camera:true,appearance:true};shot('restored-galaxy');sceneRestored=true;
  }
 }catch(e){report.errors.push('SCENE RESTORATION '+String(e.stack??e));process.exitCode=1;}
 try{
  for(const name of Object.keys(files(join(backup,'original-files'))))h('file','send',join(backup,'original-files',name),remote+'/'+name);
  const received=join(backup,'restored-files-'+Date.now());h('file','recv',remote,received);const original=files(join(backup,'original-files'));assert.ok(JSON.stringify(files(received))===JSON.stringify(original),'Persistent file set or hashes differ; inspect private backup');report.restoration.completed=sceneRestored;report.restoration.exactFiles=true;report.restoration.fileCount=Object.keys(original).length;
 }catch(e){report.errors.push('RESTORATION '+String(e.stack??e));process.exitCode=1;}}
 report.completedAt=new Date().toISOString();save();
}
console.log(JSON.stringify(report));
