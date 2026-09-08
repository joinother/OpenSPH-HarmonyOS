import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {collect,options} from '../scripts/opensph-cli.mjs';
const require=createRequire(import.meta.url);
const ts=require(process.env.TYPESCRIPT_PATH||'/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const source=readFileSync(new URL('../entry/src/main/ets/common/CliBridge.ets',import.meta.url),'utf8');
function bridge() {
  const lines=[],emissions=[];let clock=0;
  const context={exports:{},Date:{now:()=>clock},setTimeout:(fn,ms)=>{clock+=ms;queueMicrotask(fn);},require:()=>({hilog:{info:(_domain,_tag,_format,id,index,total,chunk)=>{lines.push(`SPHCLI ${id} ${index}/${total} ${chunk}`);emissions.push({at:clock,bytes:Buffer.byteLength(chunk)+128});}}})};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  return {Bridge:context.exports.CliBridge,lines,emissions};
}
function want(id,command='getState',payload='{}') {
  return {parameters:{'sph.request':id,'sph.command':command,'sph.payload':encodeURIComponent(payload)}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('real ArkTS bridge queues cold launch, preserves Unicode JSON and responds in correlated chunks',async()=>{
  const {Bridge,lines}=bridge();
  Bridge.receive(want('cold','getState','{"label":"星体"}'));
  assert.equal(lines.length,0);
  Bridge.bind(async(command,payload)=>JSON.stringify({ok:true,command,label:payload.label,data:'粒子'.repeat(1000)}));
  await tick();
  const result=collect(lines.join('\n'),'cold');
  assert.equal(result.label,'星体');assert.equal(result.data.length,2000);
  assert.ok(lines.length>3);
});
test('serial processing and deduplication prevent repeated mutations',async()=>{
  const {Bridge,lines}=bridge();let release;const calls=[];
  Bridge.bind(async(command)=>{calls.push(command);if(command==='saveReplay')await new Promise(r=>release=r);return '{"ok":true}';});
  Bridge.receive(want('one','saveReplay'));Bridge.receive(want('two','start'));Bridge.receive(want('two','start'));
  assert.deepEqual(calls,['saveReplay']);release();await tick();
  assert.deepEqual(calls,['saveReplay','start']);assert.equal(collect(lines.join('\n'),'two').ok,true);
});
test('malformed payload, handler errors and queue overflow produce explicit errors',async()=>{
  const {Bridge,lines}=bridge();
  Bridge.bind(async()=>{throw Error('unknown command');});
  Bridge.receive(want('bad','getState','['));Bridge.receive(want('scalar','getState','1'));Bridge.receive(want('unknown','wrong'));
  await tick();
  for(const id of ['bad','scalar','unknown'])assert.equal(collect(lines.join('\n'),id).ok,false);
  Bridge.unbind();for(let i=0;i<17;i++)Bridge.receive(want('q'+i));
  await tick();assert.match(collect(lines.join('\n'),'q16').error,/queue full/);
});
test('out-of-order, duplicate and delayed chunks remain complete; unrelated requests ignored',()=>{
  const parts=new Map();
  assert.equal(collect('SPHCLI a 1/2 true}\nSPHCLI b 0/1 {}','a',parts),undefined);
  const result=collect('SPHCLI a 0/2 {"ok":\nSPHCLI a 1/2 true}\nSPHCLI a 1/2 true}','a',parts);
  assert.equal(result.ok,true);
  assert.throws(()=>collect('SPHCLI a 0/257 {}','a'));
});

function page() {
  // Execute actual non-rendering page actions with a controlled native adapter.
  // This tests command transactions; it is not an ArkUI/device integration test.
  const original=readFileSync(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'utf8');
  const interfaces=original.slice(original.indexOf('interface SceneSettings'),original.indexOf('@Component'));
  const body=original.slice(original.indexOf('struct Index {')+'struct Index {'.length,original.indexOf('  @Builder\n  materialControls()'));
  const transformed=(interfaces+'\nclass Index {'+body+'}\nexports.Index=Index;').replace(/@StorageLink\('[^']+'\)\s*/g,'').replace(/@Watch\('[^']+'\)\s*/g,'').replace(/@State\s*/g,'');
  let state={state:'paused',error:'',count:212,frames:5,selected:-1,time:1,duration:10,stepMs:5,steps:4,maxSpeed:5,meanDensity:2700};
  const calls=[],initialPauses=[];let trace={impulse:0,points:false,speedScale:1,rateHours:1,eccentricity:0,referenceXKm:76800,referenceYKm:0,innerApoapsisKm:76800,enabled:false,running:false,target:-1,timeHours:0,massSolar:.0002857,radiusKm:60000,count:192,innerPeriodHours:6,outerPeriodHours:14,model:'restricted-circular-kepler-v1'};
  let motion={requestId:0,sceneRevision:1,targetFocus:-1,targetCloseup:false,progress:1,state:'idle',reason:'',yaw:.15,pitch:.25,zoom:2.7};
  const noFollow=()=>({active:false,moving:false,seed:-1,anchor:-1,rank:0,count:0,sceneRevision:0,time:0,centerKm:[0,0,0]});
  const exactBodies=()=>structuredClone(state.orbitState??(page?.preset===5?page.orbitBodies:modelContext.exports.defaultOrbitBodies()));
  const simulation={orbitClock:rate=>{calls.push(['clock',rate]);state.continuous=true;state.daysPerSecond=rate;if(state.state==='completed'||state.state==='replay')state.state='paused';},freezeOrbit:()=>{state.orbitRevision=(state.orbitRevision??0)+1;state.state='paused';calls.push(['freeze']);},insertOrbit:(body,revision,resume,physical=false)=>{if(state.rejectStart||state.rejectInsert)throw Error('native rejected insertion');if(revision!==state.orbitRevision)throw Error('stale placement');calls.push(['insert',structuredClone(body),revision,resume]);state.orbitState=exactBodies().map(b=>physical?{...b,radiusKm:b.radiusKm??modelContext.exports.estimatedOrbitRadius(b.massSolar,b.surface===0)}:b).concat([structuredClone(body)]);state.state=resume?'running':'paused';state.frames++;state.continuous=true;},galaxyObserverStatus:()=>({...{available:!!state.galaxyObservation?.available,mode:0,primaryDirection:[-8,0,0],secondaryDirection:[50,12,0],primaryYaw:Math.PI,primaryPitch:0,secondaryYaw:.2355,secondaryPitch:.1},...state.observer}),setGalaxyObserver:(mode,yaw,pitch,fov,latitude,siderealHours)=>{state.observer={mode,yaw,pitch,fov,latitude,siderealHours};calls.push(['observer',mode,yaw,pitch,fov]);},galaxyObservation:()=>structuredClone(state.galaxyObservation??{available:false,sceneRevision:0,selected:-1,samples:[]}),setGalaxyPlacement:(...args)=>calls.push(['galaxyPlacement',...args]),placeGalaxyAt:()=>state.galaxyOffset??22,seekGalaxyObservation:(frame,revision,time)=>{if(revision!==state.galaxyObservation?.sceneRevision)throw Error('stale');state.selected=frame;state.time=time;},setOrbitPlacement:(bodies,candidate)=>{state.placementPreview={bodies:structuredClone(bodies),candidate};},placeOrbitAt:(x,y,tilt)=>{calls.push(['viewportPlacement',x,y,tilt]);return state.placementPoint??[2.5,35];},clearSphFragmentFollow:()=>{state.follow=noFollow();},followSphFragment:(particle,revision)=>{if(!state.fragments?.available||revision!==state.fragments.sceneRevision||particle>=state.fragments.particleCount)throw Error('stale material');calls.push(['follow',particle,revision]);const group=state.fragments.groups.find(g=>g.anchor===particle);state.follow={...noFollow(),active:true,seed:particle,anchor:particle,rank:group?.rank??1,count:group?.count??1,sceneRevision:revision};},sphFragments:(offset,limit)=>({...structuredClone(state.fragments??{available:false,reason:'legacy',sceneRevision:1,selected:state.selected??-1,time:state.time??0,linkScale:1.5,method:'symmetric-smoothing-connectivity-v1',groups:[]}),offset,groups:(state.fragments?.groups??[]).slice(offset,offset+limit),nextOffset:offset+limit<(state.fragments?.groups.length??0)?offset+limit:-1}),setSurfaceSeeds:(pairs)=>calls.push(['surfaceSeeds',...pairs]),cancel:()=>{state.state='cancelled';calls.push(['cancel']);},sphObservation:()=>structuredClone(state.sphObservation??{sceneRevision:1,selected:state.selected??-1,samples:[]}),seekSphObservation:(frame,revision,time)=>{const d=state.sphObservation;if(!d||d.sceneRevision!==revision||d.samples[frame]?.time!==time)throw Error('stale SPH observation');state.selected=frame;state.sphObservation.selected=frame;calls.push(['sph.seek',frame]);},orbitObservation:(body)=>({...structuredClone(state.observation??{sceneRevision:1,body,name:'',samples:[]}),body,selected:state.selected}),seekObservation:(frame,revision,time)=>{const o=state.observation;if(!o||o.sceneRevision!==revision||o.samples[frame]?.time!==time)throw Error('stale observation');state.selected=frame;calls.push(['observation.seek',frame]);},setMaterial:(...args)=>calls.push(['material',...args]),getCameraMotion:()=>({...motion}),cancelCameraMotion:()=>({...motion}),navigateCamera:(yaw,pitch,zoom,focus,color,closeup)=>{calls.push(['camera',yaw,pitch,zoom,focus,color]);motion={...motion,requestId:motion.requestId+1,yaw,pitch,zoom,targetFocus:focus,targetCloseup:closeup,state:'completed'};return {...motion};},setRingDisturbance:(impulse,points)=>{if(impulse!==trace.impulse){trace.timeHours=0;trace.running=false;}trace.impulse=impulse;trace.points=points;},setRingParameters:(speedScale,rateHours)=>{if(speedScale!==trace.speedScale){trace.timeHours=0;trace.running=false;}trace.speedScale=speedScale;trace.rateHours=rateHours;trace.eccentricity=speedScale*speedScale-1;},ringTraceStatus:()=>({...trace}),configureRingTrace:(enabled,running,target,massSolar)=>{if(enabled&&(!trace.enabled||target!==trace.target||massSolar!==trace.massSolar)){trace.timeHours=0;trace.speedScale=1;trace.rateHours=1;trace.impulse=0;trace.points=false;}trace={...trace,enabled,running,target,massSolar};},seekRingTrace:seconds=>{trace.timeHours=seconds/3600;trace.running=false;},setComposition:(x,y,scale)=>{state.composition={x,y,scale};},setSky:(mode,brightness)=>{state.sky={mode,brightness};},pickBody:()=>state.pick??-1,projectedScene:()=>({ready:true,bodies:[]}),setAppearance:()=>{},renderStatus:()=>({fragmentFollow:structuredClone(state.follow??noFollow()),panoramaReady:state.panoramaReady??false,panoramaBlend:state.panoramaReady?1:0,ready:true,texturesReady:true,active:true,frames:1,submitMs:1,previewSeconds:0,error:''}),status:()=>({...state,orbitState:exactBodies()}),startScene:(c,initiallyPaused)=>{if(state.rejectStart)throw Error('native rejected scene');state.orbitState=undefined;initialPauses.push(initiallyPaused);calls.push(['start',c.preset,c.count,c.speed,c.angle,c.duration]);state.state='preparing';},pause:v=>{calls.push(['pause',v]);if(state.state!=='preparing')state.state=v?'paused':'running';},setCamera:(...args)=>calls.push(['camera',...args]),seek:i=>state.selected=i,saveReplay:async()=>false,loadReplay:async()=>{if(state.loadReplayOK){state.state='replay';return true;}return false;}};
  const modelContext={exports:{}};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/SceneModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/WorkspaceLayout.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/ObservationModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  modelContext.require=()=>modelContext.exports;
  vm.runInNewContext('(function(){'+ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/GalaxyObservationModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'})()',modelContext);
  vm.runInNewContext('(function(){'+ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/SphObservationModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'})()',modelContext);
  vm.runInNewContext('(function(){'+ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/ObservationComparison.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'})()',modelContext);
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/ExperimentCatalog.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  vm.runInNewContext('(function(){'+ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/GalaxyComparison.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'})()',modelContext);
  const projects=new Map();
  const ProjectStore={list:()=>[...projects.values()],load:(_dir,id)=>{const p=projects.get(id);if(!p)throw Error('missing project');modelContext.exports.validateScene(p.scene);if(p.recipe!==undefined)modelContext.exports.validateRecipe(p.recipe,p.scene);return structuredClone(p);},save:(_dir,scene,recipe)=>{modelContext.exports.validateScene(scene);modelContext.exports.validateRecipe(recipe,scene);const p=structuredClone({id:'project-1-'+projects.size,savedAt:1,scene,recipe});projects.set(p.id,p);return p;}};
  let reference;const ObservationStore={load:()=>{if(state.rejectReferenceLoad)throw Error('bad reference file');return reference;},save:(_dir,value)=>{if(state.rejectReferenceSave)throw Error('disk full');reference=modelContext.exports.copyReference(value);return reference;},clear:()=>{if(state.rejectReferenceClear)throw Error('permission denied');reference=undefined;}};
  let galaxyReference;const GalaxyComparisonStore={load:()=>{if(state.rejectGalaxyLoad)throw Error('bad file');return structuredClone(galaxyReference);},save:(_dir,value)=>{if(state.rejectGalaxySave)throw Error('disk full');galaxyReference=modelContext.exports.copyGalaxyReference(value);return structuredClone(galaxyReference);},clear:()=>{if(state.rejectGalaxyClear)throw Error('denied');galaxyReference=undefined;}};
  const context={exports:{},...modelContext.exports,GalaxyComparisonStore,ObservationStore,ProjectStore,simulation,Scroller:class {scrollEdge(){}},Edge:{Top:0},Curve:{EaseOut:0},setInterval,clearInterval,console};
  vm.runInNewContext(ts.transpileModule(transformed,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  const page=new context.exports.Index();
  page.getUIContext=()=>({px2vp:v=>v,getHostContext:()=>({filesDir:'/mock'}),animateTo:(opts,apply)=>{apply();opts.onFinish?.();}});
  return {page,calls,state,initialPauses,projects};
}
test('scene and camera reject partial invalid transactions without changing prior state',async()=>{
  const {page:app,calls}=page();
  const before=app.snapshot();
  await assert.rejects(app.execute('setScene',{preset:1,count:300,speed:20,angle:40,duration:10}));
  await assert.rejects(app.execute('setCamera',{yaw:1,pitch:0,zoom:3,focus:4,color:1}));
  assert.equal(app.snapshot(),before);assert.equal(calls.length,0);
  await app.execute('setScene',{preset:1,count:200,speed:6,angle:40,duration:10});
  assert.deepEqual(calls.find(c=>c[0]==='start'),['start',1,200,6,40,10]);
  const result=JSON.parse(await app.execute('getState',{}));
  assert.equal(result.scene.speed,6);assert.equal(result.scene.preset,1);assert.equal(result.simulation.state,'preparing');
});
test('start is idempotent, seek bounded, replay failure reported as failure',async()=>{
  const {page:app,calls,state}=page();
  await app.execute('start',{});await app.execute('start',{});
  assert.equal(calls.filter(c=>c[0]==='pause'&&c[1]===false).length,1);
  await app.execute('pause',{});assert.equal(state.state,'paused');
  await assert.rejects(app.execute('seek',{frame:5}));
  await app.execute('seek',{frame:2});assert.equal(state.selected,2);
  await assert.rejects(app.execute('loadReplay',{}));assert.equal(app.ioBusy,false);
  await assert.rejects(app.execute('notACommand',{}));
});
test('closing and reopening during a tab animation discards its stale completion',()=>{
  const {page:app}=page();const completions=[];
  app.getUIContext=()=>({px2vp:v=>v,animateTo:(options,apply)=>{apply();if(options.onFinish)completions.push(options.onFinish);}});
  app.setPanel(0);app.setPanel(1);app.setPanel(-1);app.setPanel(2);
  completions.forEach(f=>f());
  assert.equal(app.tab,2);assert.equal(app.panelOpen,true);assert.equal(app.panelOpacity,1);assert.equal(app.panelContentOffset,0);
  app.setPanel(0);app.setTools(false);completions.forEach(f=>f());
  assert.equal(app.panelOpen,false);assert.equal(app.toolsVisible,false);
});

test('orbit models validate units, survive definitions, and reject invalid speed atomically',async()=>{
  const {page:app}=page();
  await app.execute('setScene',{preset:4,count:600,speed:1,angle:0,duration:3});
  let snap=JSON.parse(app.snapshot());assert.equal(snap.definition.model,'nbody-v1');assert.equal(snap.definition.bodies.length,0);
  const before=app.snapshot();
  await assert.rejects(app.execute('setScene',{preset:4,count:600,speed:5,angle:0,duration:3}));
  await assert.rejects(app.execute('setScene',{preset:3,count:600,speed:1,angle:0,duration:60}));
  assert.equal(app.snapshot(),before);
  await app.execute('setCamera',{yaw:0,pitch:0,zoom:2.7,focus:3,color:1});
  await assert.rejects(app.execute('setCamera',{yaw:0,pitch:0,zoom:2.7,focus:3,color:2}));
  await app.execute('setScene',{preset:3,count:600,speed:1,angle:0,duration:3});assert.equal(app.focus,-1);
  app.choose(3);assert.equal(app.speed,1);assert.equal(app.duration,3);
  app.choose(0);assert.equal(app.speed,5);assert.equal(app.duration,60);assert.equal(app.definition().model,'sph-rock-v1');
});

test('appearance changes are visual only and invalid transactions leave the scene intact',async()=>{
 const {page:app,calls}=page();const before=app.snapshot();
 await assert.rejects(app.execute('setAppearance',{closeup:true}));assert.equal(app.snapshot(),before);
 await app.execute('setScene',{preset:4,count:600,speed:1,angle:0,duration:3});
 const config=app.snapshot();await assert.rejects(app.execute('setAppearance',{clouds:false,atmosphere:'yes'}));assert.equal(app.snapshot(),config);
 const starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('setAppearance',{closeup:true,autoSpin:false,clouds:false});let snap=JSON.parse(app.snapshot());
 assert.equal(snap.appearance.closeup,true);assert.equal(snap.appearance.clouds,false);assert.equal(snap.camera.focus,1);assert.equal(snap.scene.dirty,false);
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);
 await app.execute('setCamera',{yaw:.2,pitch:.3,zoom:2,focus:-1,color:0});assert.equal(app.closeup,false);
 app.openSurface(2);assert.equal(app.closeup,true);app.onBackPress();assert.equal(app.closeup,false);
 app.openSurface(2);await app.execute('setScene',{preset:0,count:200,speed:5,angle:0,duration:1});assert.equal(app.closeup,false);assert.equal(app.autoSpin,false);
});

test('loading legacy SPH replay exits orbital closeup without inventing original parameters',async()=>{
 const {page:app,state}=page();
 await app.execute('setScene',{preset:4,count:600,speed:1,angle:0,duration:3});app.openSurface(2);
 state.loadReplayOK=true;await app.execute('loadReplay',{});
 assert.equal(app.preset,0);assert.equal(app.closeup,false);assert.equal(app.autoSpin,false);assert.match(app.notice,/原始参数未知/);
});

test('custom body edits are transactional; add/delete maintain star and clear stale focus',async()=>{
  const {page:app,calls}=page();app.choose(5);
  assert.equal(app.definition().model,'nbody-custom-v1');assert.equal(app.orbitBodies.length,4);
  app.selectOrbit(1);const before=JSON.stringify(app.orbitBodies),n=calls.length;
  app.orbitFields[1]='0';app.orbitFields[2]='0';app.orbitFields[3]='0';app.orbitDraft=true;app.applyOrbit();
  assert.equal(JSON.stringify(app.orbitBodies),before);assert.equal(calls.length,n);assert.match(app.notice,/0.05/);
  app.selectOrbit(1);app.orbitFields[0]='2';app.orbitFields[3]='0.2';app.orbitName='远洋';app.orbitSurface=3;app.applyOrbit();
  assert.equal(app.orbitBodies[1].name,'远洋');assert.equal(app.orbitBodies[1].surface,3);assert.equal(app.orbitBodies[1].zAU,0.2);
  app.focus=3;app.closeup=true;app.beginPlacement();app.confirmPlacement();assert.equal(app.orbitBodies.length,5);assert.equal(app.focus,0);assert.equal(app.closeup,false);
  app.removeOrbit();assert.equal(app.orbitBodies.length,4);app.selectOrbit(0);app.removeOrbit();assert.equal(app.orbitBodies.length,4);
  app.selectOrbit(1);app.removeOrbit();app.removeOrbit();app.removeOrbit();assert.equal(app.orbitBodies.length,2);
  while(app.orbitBodies.length<8){app.beginPlacement();app.confirmPlacement();}assert.equal(app.orbitBodies.length,8);assert.equal(app.maxFocus(),7);
  await app.execute('setCamera',{yaw:0,pitch:0,zoom:3,focus:7,color:0});assert.equal(app.focus,7);
  await assert.rejects(app.execute('setCamera',{yaw:0,pitch:0,zoom:3,focus:8,color:0}));
});
test('custom CLI rejects malformed body lists atomically and preserves all initial fields',async()=>{
  const {page:app,calls}=page();app.choose(5);const c=JSON.parse(JSON.stringify(app.config()));
  for(const mutation of [c=>c.orbitBodies[0].surface=2,c=>c.orbitBodies[1].massSolar=0,c=>c.orbitBodies[1].vzKmS=101,c=>c.orbitBodies[1].name='\n',c=>c.orbitBodies[1].name='\ud800',c=>c.orbitBodies.pop()&&c.orbitBodies.pop()&&c.orbitBodies.pop(),c=>c.orbitBodies[1].xAU=NaN,c=>c.speed=1.2,c=>delete c.orbitBodies]){
    const bad=JSON.parse(JSON.stringify(c));mutation(bad);const before=app.snapshot(),n=calls.length;
    await assert.rejects(app.execute('setScene',bad));assert.equal(app.snapshot(),before);assert.equal(calls.length,n);
  }
  c.orbitBodies[3].name='三维星球';c.orbitBodies[3].zAU=.3;c.orbitBodies[3].vzKmS=2;
  await app.execute('setScene',c);assert.equal(JSON.stringify(app.definition().config.orbitBodies),JSON.stringify(c.orbitBodies));
  c.orbitBodies[3].name='outside mutation';assert.equal(app.orbitBodies[3].name,'三维星球');
  app.selectOrbit(3);app.orbitFields[4]='';app.applyOrbit();assert.match(app.notice,/全部/);
});

test('semantic UI commands expose drafts, share button handlers and reject disabled actions',async()=>{
  const {page:app,state}=page();await app.execute('uiAction',{action:'preset.5'});state.state='paused';
  let ui=JSON.parse(await app.execute('getUiState',{}));assert.ok(ui.actions.find(a=>a.id==='orbit.add').enabled);
  await app.execute('uiAction',{action:'orbit.add'});assert.equal(app.orbitBodies.length,4);await app.execute('uiAction',{action:'placement.confirm'});state.state='paused';assert.equal(app.orbitBodies.length,5);
  const before=JSON.stringify(app.orbitBodies);
  await app.execute('setUiValue',{field:'orbit.name',value:'远洋 CLI'});
  await app.execute('setUiValue',{field:'orbit.value.0',value:'2'});
  assert.equal(JSON.stringify(app.orbitBodies),before);assert.equal(app.orbitDraft,true);
  await app.execute('uiAction',{action:'orbit.surface.3'});await app.execute('uiAction',{action:'orbit.apply'});state.state='paused';
  assert.equal(app.orbitBodies[4].name,'远洋 CLI');assert.equal(app.orbitBodies[4].surface,3);assert.equal(app.orbitDraft,false);
  await app.execute('uiAction',{action:'orbit.near'});assert.equal(app.focus,4);
  await app.execute('uiAction',{action:'surface.next'});assert.equal(app.focus,0);
  await app.execute('uiAction',{action:'surface.previous'});assert.equal(app.focus,4);
  await app.execute('uiAction',{action:'ui.focus'});assert.equal(app.toolsVisible,false);
  await app.execute('uiAction',{action:'ui.restore'});assert.equal(app.toolsVisible,true);
  await app.execute('uiAction',{action:'replay.toggle'});assert.equal(app.playing,true);
  await app.execute('uiAction',{action:'replay.toggle'});assert.equal(app.playing,false);
  await app.execute('uiAction',{action:'orbit.select.0'});
  await assert.rejects(app.execute('uiAction',{action:'orbit.remove'}),/unavailable/);
  await assert.rejects(app.execute('setUiValue',{field:'scene.speed',value:2}),/unavailable/);
  const saved=app.snapshot();await assert.rejects(app.execute('uiAction',{action:'orbit.select.999'}));assert.equal(app.snapshot(),saved);
  app.ioBusy=true;await assert.rejects(app.execute('uiAction',{action:'orbit.add'}));
  ui=JSON.parse(await app.execute('getUiState',{}));assert.ok(ui.actions.every(a=>!a.enabled));
});
test('invalid draft application reports CLI failure without replacing the physical system',async()=>{
  const {page:app,state}=page();await app.execute('uiAction',{action:'preset.5'});state.state='paused';
  const original=JSON.stringify(app.orbitBodies);
  await app.execute('setUiValue',{field:'orbit.value.0',value:''});
  await assert.rejects(app.execute('uiAction',{action:'orbit.apply'}),/全部/);
  assert.equal(JSON.stringify(app.orbitBodies),original);assert.equal(app.orbitDraft,true);
  await assert.rejects(app.execute('setUiValue',{field:'orbit.value.8',value:'1'}));
  await app.execute('uiAction',{action:'preset.0'});state.state='paused';
  await app.execute('uiAction',{action:'body.impactor'});await app.execute('setUiValue',{field:'body.radius',value:50});
  assert.equal(app.impactorRadiusKm,50);assert.equal(app.dirty,true);
  await assert.rejects(app.execute('setUiValue',{field:'body.radius',value:500}));assert.equal(app.impactorRadiusKm,50);
});
test('all rendered button callbacks and editor changes route through semantic actions',()=>{
  const source=readFileSync(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'utf8');
  const builders=source.slice(source.indexOf('  @Builder\n  materialControls()'));
  const buttons=[...builders.matchAll(/(?:onPress:\(\)\s*=>|\.onClick\(\(\)\s*=>)\s*\{([^}]+)\}/g)];
  assert.ok(buttons.length>=40);assert.equal(buttons.length,(builders.match(/onPress:|\.onClick\(/g)||[]).length);for(const b of buttons)assert.match(b[1],/^\s*this\.press\(/);
  const inputs=[...builders.matchAll(/\.onChange\(\(v:(?:string|number)[^=]*=>\s*\{([^}]+)/g)];
  assert.ok(inputs.length>=10);for(const input of inputs)assert.match(input[1],/this\.input\(/);
});
test('viewport selection shares focus/editor action; misses and invalid coordinates preserve draft',async()=>{
  const {page:app,state}=page();await app.execute('uiAction',{action:'preset.5'});state.state='paused';
  await app.execute('setUiValue',{field:'orbit.name',value:'草稿'});
  state.pick=-1;assert.equal(JSON.parse(await app.execute('pickBody',{x:.1,y:.1})).hit,-1);assert.equal(app.orbitName,'草稿');
  await assert.rejects(app.execute('pickBody',{x:2,y:.5}));assert.equal(app.orbitName,'草稿');
  state.pick=1;await app.execute('pickBody',{x:.5,y:.5});assert.equal(app.focus,1);assert.equal(app.orbitName,'草稿');
  state.pick=2;await app.execute('pickBody',{x:.5,y:.5});assert.equal(app.focus,2);assert.equal(app.orbitEdit,2);assert.equal(app.orbitDraft,false);
  app.preset=0;await assert.rejects(app.execute('pickBody',{x:.5,y:.5}));
});
test('initial vector preview handles 3D axes, zero vectors, invalid drafts and units without applying',async()=>{
  const {page:app,state}=page();await app.execute('uiAction',{action:'preset.5'});state.state='paused';app.orbitFields=['1','1','2','3','10','20','30'];
  const before=JSON.stringify(app.orbitBodies);let p=JSON.parse(await app.execute('getOrbitPreview',{}));
  assert.equal(p.reference,'initial-input');assert.deepEqual(p.preview.positionAU,[1,2,3]);assert.equal(p.preview.velocityScale,20);
  await app.execute('uiAction',{action:'orbit.plane.xz'});p=JSON.parse(await app.execute('getOrbitPreview',{}));assert.equal(p.preview.positionScale,3);assert.equal(p.preview.velocityScale,30);
  app.orbitFields=['1','0','0','0','0','0','0'];assert.equal(app.orbitPreview().valid,true);assert.equal(app.orbitPreview().velocityPath,'M47 45 L53 45 M50 42 L50 48');
  for(const value of ['', 'NaN','Infinity','101']){app.orbitFields[4]=value;assert.equal(app.orbitPreview().valid,false);assert.equal(app.orbitPreview().velocityPath,'');}
  assert.equal(JSON.stringify(app.orbitBodies),before);
});
test('sky controls are atomic, shared with UI and independent of physics',async()=>{
  const {page:app,state,calls}=page();const original=JSON.parse(app.snapshot());
  await app.execute('setSky',{mode:1,brightness:.4});assert.equal(app.skyMode,1);assert.equal(state.sky.brightness,.4);
  const previous=JSON.stringify(state.sky);await assert.rejects(app.execute('setSky',{mode:0,brightness:2}));assert.equal(JSON.stringify(state.sky),previous);assert.equal(app.skyMode,1);
  await assert.rejects(app.execute('setSky',{mode:1.5}));await assert.rejects(app.execute('setSky',{brightness:'0.5'}));
  await app.execute('uiAction',{action:'sky.mode.2'});await app.execute('setUiValue',{field:'sky.brightness',value:75});assert.equal(app.skyBrightness,.75);assert.equal(state.sky.mode,2);
  const result=JSON.parse(app.snapshot());assert.deepEqual(result.definition,original.definition);assert.deepEqual(result.camera,original.camera);assert.deepEqual(result.scene,original.scene);assert.equal(calls.length,0);
  assert.equal(JSON.parse(await app.execute('getSkyInfo',{})).reference,'procedural-fallback');
  state.panoramaReady=true;
  const photo=JSON.parse(await app.execute('getSkyInfo',{}));
  assert.equal(photo.reference,'photographic-panorama');assert.equal(photo.credit,'ESO/S. Brunier');
  assert.deepEqual(photo.textureSize,[2048,1024]);assert.equal(photo.proceduralStarsVisible,false);
  await app.execute('setSky',{mode:1});assert.equal(JSON.parse(await app.execute('getSkyInfo',{})).proceduralStarsVisible,true);
});

test('continuous selection/edit/overview preserves solver, replay cursor and per-body drafts',async()=>{
 const {page:app,calls,state}=page();await app.execute('uiAction',{action:'preset.5'});state.state='paused';state.selected=2;
 const before=JSON.stringify(app.definition()),starts=calls.filter(c=>c[0]==='start').length;
 const action=id=>app.execute('uiAction',{action:id});
 await action('focus.1');await action('selection.edit');assert.equal(app.panelOpen,true);assert.equal(app.tab,0);
 await app.execute('setUiValue',{field:'orbit.name',value:'保留海洋草稿'});
 await action('orbit.select.2');await app.execute('setUiValue',{field:'orbit.value.0',value:''});
 await action('orbit.near');assert.equal(app.focus,2);assert.equal(app.closeup,true);assert.equal(app.panelOpen,false);
 await action('surface.previous');assert.equal(app.focus,1);assert.equal(app.orbitName,'保留海洋草稿');assert.equal(app.orbitDraft,true);
 await action('selection.edit');await action('ui.back');assert.equal(app.closeup,true);await action('ui.back');assert.equal(app.focus,-1);
 await action('focus.2');assert.equal(app.orbitFields[0],'');assert.equal(app.orbitDraft,true);
 assert.equal(JSON.stringify(app.definition()),before);assert.equal(state.selected,2);assert.equal(state.time,1);
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);assert.equal(calls.filter(c=>c[0]==='pause').length,1);
 await action('focus.all');app.stopCameraMotion();
 await action('preset.5');assert.equal(app.orbitDraft,false);assert.equal(app.orbitDrafts.length,0);
});

test('placement preview is a cancellable transaction, with shared point positioning and explicit commit',async()=>{
 const {page:app,calls,state}=page();app.choose(5);state.state='completed';state.selected=3;
 await app.execute('setUiValue',{field:'orbit.name',value:'原编辑草稿'});
 const before=JSON.stringify(app.definition()),start=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'orbit.add'});assert.equal(app.placing,true);assert.equal(JSON.stringify(app.definition()),before);
 await app.execute('setPlacementPoint',{x:.7,y:.4});let preview=JSON.parse(await app.execute('getPlacementPreview',{})).preview;assert.equal(preview.valid,true);
 assert.ok(Math.abs(preview.candidateX/240-.7)<.001);assert.ok(Math.abs(preview.candidateY/240-.4)<.001);
 await assert.rejects(app.execute('setScene',app.config()));await assert.rejects(app.execute('uiAction',{action:'orbit.remove'}));
 await app.execute('setUiValue',{field:'placement.value.1',value:''});assert.equal(JSON.parse(await app.execute('getPlacementPreview')).preview.valid,false);await assert.rejects(app.execute('uiAction',{action:'placement.confirm'}));
 await app.execute('uiAction',{action:'panel.close'});assert.equal(app.placing,false);assert.equal(app.orbitName,'原编辑草稿');assert.equal(state.selected,3);assert.equal(JSON.stringify(app.definition()),before);assert.equal(calls.filter(c=>c[0]==='start').length,start);
 await app.execute('uiAction',{action:'orbit.add'});await app.execute('uiAction',{action:'placement.reverse'});await app.execute('setUiValue',{field:'placement.value.3',value:'30'});preview=JSON.parse(await app.execute('getPlacementPreview')).preview;
 await app.execute('uiAction',{action:'placement.confirm'});assert.equal(app.placing,false);assert.equal(app.orbitBodies.length,5);assert.deepEqual(JSON.parse(JSON.stringify(app.orbitBodies[4])),preview.body);assert.equal(calls.filter(c=>c[0]==='start').length,start);assert.equal(calls.filter(c=>c[0]==='insert').length,1);
 await assert.rejects(app.execute('uiAction',{action:'placement.confirm'}));
});
test('placement physics respects relative reference frames, inclined velocities and conic energy',()=>{
 const {page:app}=page();app.choose(5);app.orbitBodies[0].xAU=.2;app.orbitBodies[0].vxKmS=4;app.beginPlacement();
 app.placementFields=['1','2','90','30','1'];let p=app.placementPreview(),b=p.body,star=app.orbitBodies[0];assert.equal(p.valid,true);
 const r=[b.xAU-star.xAU,b.yAU-star.yAU,b.zAU-star.zAU],v=[b.vxKmS-star.vxKmS,b.vyKmS-star.vyKmS,b.vzKmS-star.vzKmS];
 assert.ok(Math.abs(Math.hypot(...r)-2)<1e-12);assert.ok(Math.abs(r.reduce((s,x,i)=>s+x*v[i],0))<1e-10);assert.ok(Math.abs(Math.hypot(...v)-p.circularKmS)<1e-10);assert.ok(Math.abs(b.zAU-1)<1e-12);
 app.placementDirection=-1;const reversed=app.placementPreview().body;assert.ok(Math.abs(reversed.vxKmS-star.vxKmS+v[0])<1e-12);
 app.placementFields[4]='0';p=app.placementPreview();assert.equal(p.speedKmS,0);assert.equal(p.body.vxKmS,4);
 app.placementFields[4]='1.45';p=app.placementPreview();assert.equal(p.bound,false);assert.ok(p.speedKmS>p.escapeKmS);assert.ok(p.orbitPath.length>10);
 app.placementFields=['1','1','0','0','1'];app.placementBodies[0].xAU=0;app.placementBodies[0].vxKmS=0;assert.equal(app.placementPreview().valid,false);assert.match(app.placementPreview().error,/间距/);
 app.placementFields[1]='NaN';assert.equal(app.placementPreview().valid,false);
});

test('fold and rotation update composition without losing drafts or mutating the solver',async()=>{
  const {page:app,calls,state}=page();
  await app.execute('uiAction',{action:'preset.5'});
  app.updateViewport(707.2,706.56);
  await app.execute('uiAction',{action:'surface.1'});
  await app.execute('uiAction',{action:'selection.edit'});
  await app.execute('setUiValue',{field:'orbit.name',value:'旋转保留草稿'});
  const before=JSON.parse(app.snapshot()),mutations=calls.length;
  for(const [w,h] of [[345.6,715.52],[744,307],[707.2,706.56],[345.6,715.52]]){
    app.updateViewport(w,h);const after=JSON.parse(app.snapshot());
    assert.deepEqual(after.definition,before.definition);assert.deepEqual(after.editor,before.editor);
    assert.deepEqual(after.camera,before.camera);assert.equal(after.ui.panelOpen,true);
    assert.equal(calls.length,mutations);assert.equal(after.window.layout.compact,h<480);
    const {drawer,dock}=after.window.layout;
    for(const r of [drawer,dock])assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=w+.01&&r.y+r.height<=h+.01);
    assert.ok(drawer.x+drawer.width<=dock.x||dock.x+dock.width<=drawer.x||drawer.y+drawer.height<=dock.y||dock.y+dock.height<=drawer.y);
  }
});

test('main-window orientation uses the system lock in auto mode and rejects invalid policies',async()=>{
  const context={exports:{},require:()=>({window:{Orientation:{AUTO_ROTATION_RESTRICTED:8,PORTRAIT:1,LANDSCAPE:2,LANDSCAPE_INVERTED:4}}})};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/WindowControl.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  const control=context.exports.WindowControl,policies=[];
  control.bind({setPreferredOrientation:async p=>policies.push(p)});
  for(const mode of ['landscape','reverse-landscape','portrait','auto'])await control.orient(mode);
  assert.deepEqual(policies,[2,4,1,8]);await assert.rejects(control.orient('invalid'));assert.equal(policies.length,4);
  control.bind(undefined);await assert.rejects(control.orient('portrait'));assert.equal(policies.length,4);
});

test('body transactions preserve unrelated drafts; undo and redo restore deleted bodies and draft indices',async()=>{
 const {page:app}=page();app.choose(5);const original=JSON.stringify(app.orbitBodies);
 app.setUiValue('orbit.name','第一颗草稿');app.selectOrbit(3);app.setUiValue('orbit.value.6','');
 app.selectOrbit(2);app.setUiValue('orbit.name','第二颗已应用');app.applyOrbit(true);
 assert.equal(app.editHistory().undoCount,1);assert.equal(app.bodyDrafts().length,2);
 assert.equal(app.orbitBodies[2].name,'第二颗已应用');app.selectOrbit(3);assert.equal(app.orbitFields[6],'');
 app.travelOrbitHistory(false);assert.equal(JSON.stringify(app.orbitBodies),original);assert.equal(app.orbitEdit,2);assert.equal(app.orbitName,'第二颗已应用');assert.equal(app.orbitDraft,true);
 app.travelOrbitHistory(true);assert.equal(app.orbitBodies[2].name,'第二颗已应用');assert.equal(app.orbitEdit,3);assert.equal(app.orbitFields[6],'');
 app.selectOrbit(1);app.removeOrbit();assert.equal(app.orbitBodies.length,3);
 assert.deepEqual(JSON.parse(JSON.stringify(app.bodyDrafts())).map(d=>d.index),[2]);app.selectOrbit(2);assert.equal(app.orbitFields[6],'');
 app.travelOrbitHistory(false);assert.equal(app.orbitBodies.length,4);assert.equal(app.orbitName,'第一颗草稿');assert.equal(app.orbitEdit,1);
 app.travelOrbitHistory(true);assert.equal(app.orbitBodies.length,3);assert.equal(app.orbitFields[6],'');assert.equal(app.orbitEdit,2);
});

test('live placement commits without rebuilding, retains drafts, and clears initial-condition undo history',async()=>{
 const {page:app,calls,state}=page();app.choose(5);state.state='paused';
 app.setUiValue('orbit.name','保留草稿');app.beginPlacement();app.cancelPlacement();assert.equal(app.editHistory().undoCount,0);
 const time=state.time,frames=state.frames;app.beginPlacement();app.placementName='候选一';app.confirmPlacement();assert.equal(app.editHistory().undoCount,0);
 assert.equal(app.orbitBodies.length,5);assert.equal(state.time,time);assert.equal(state.frames,frames+1);assert.equal(app.placing,false);assert.equal(app.bodyDrafts()[0].name,'保留草稿');
 await assert.rejects(app.execute('uiAction',{action:'orbit.undo'}),/unavailable/);
 app.selectOrbit(1);state.selected=3;state.state='paused';const starts=calls.length;const history=JSON.stringify(app.editHistory());
 await app.execute('uiAction',{action:'orbit.discard'});assert.equal(app.orbitDraft,false);assert.equal(state.selected,3);assert.equal(calls.length,starts);assert.equal(JSON.stringify(app.editHistory()),history);
 await assert.rejects(app.execute('uiAction',{action:'orbit.discard'}),/unavailable/);
});

test('history branches only on successful commits, stays bounded, and does not undo global duration',async()=>{
 const {page:app}=page();app.choose(5);
 for(let i=0;i<23;i++){app.setUiValue('orbit.name','版本 '+i);app.applyOrbit(true);}
 assert.equal(app.editHistory().undoCount,20);app.travelOrbitHistory(false);const history=JSON.stringify(app.editHistory());
 app.setUiValue('orbit.value.0','');await assert.rejects(app.execute('uiAction',{action:'orbit.apply'}));assert.equal(JSON.stringify(app.editHistory()),history);
 app.setUiValue('scene.duration',7);app.travelOrbitHistory(true);assert.equal(app.duration,7);
 app.travelOrbitHistory(false);app.setUiValue('orbit.value.0','2');app.setUiValue('orbit.name','新分支');app.applyOrbit(true);assert.equal(app.editHistory().redoCount,0);
 await assert.rejects(app.execute('uiAction',{action:'orbit.redo'}),/unavailable/);
 for(let i=0;i<20;i++)app.travelOrbitHistory(false);assert.equal(app.orbitBodies[1].name,'版本 2');
 await assert.rejects(app.execute('uiAction',{action:'orbit.undo'}),/unavailable/);
});

test('history actions obey placement and I/O guards, and scene replacement clears the prior session history',async()=>{
 const {page:app,state}=page();app.choose(5);app.setUiValue('orbit.name','提交');app.applyOrbit(true);
 app.beginPlacement();await assert.rejects(app.execute('uiAction',{action:'orbit.undo'}),/unavailable/);app.cancelPlacement();
 app.ioBusy=true;await assert.rejects(app.execute('uiAction',{action:'orbit.undo'}),/unavailable/);app.ioBusy=false;
 const c=JSON.parse(JSON.stringify(app.config()));await app.execute('setScene',c);assert.equal(app.editHistory().undoCount,0);
 app.setUiValue('orbit.name','再次提交');app.applyOrbit(true);app.choose(0);app.choose(5);assert.equal(app.editHistory().undoCount,0);assert.equal(app.bodyDrafts().length,0);
 app.setUiValue('orbit.name','回放前提交');app.applyOrbit(true);state.loadReplayOK=true;await app.execute('loadReplay',{});assert.equal(app.editHistory().undoCount,0);
});

test('synchronous native rejection leaves body transactions, drafts and history untouched',async()=>{
 const {page:app,state}=page();app.choose(5);app.setUiValue('orbit.name','已提交');app.applyOrbit(true);
 const before=JSON.stringify(app.captureOrbitWorkspace()),history=JSON.stringify(app.editHistory());state.rejectStart=true;
 await assert.rejects(app.execute('uiAction',{action:'orbit.undo'}),/native rejected/);
 assert.equal(JSON.stringify(app.captureOrbitWorkspace()),before);assert.equal(JSON.stringify(app.editHistory()),history);
 app.setUiValue('orbit.name','待提交');const draft=JSON.stringify(app.captureOrbitWorkspace());
 await assert.rejects(app.execute('uiAction',{action:'orbit.apply'}),/native rejected/);
 assert.equal(JSON.stringify(app.captureOrbitWorkspace()),draft);assert.equal(JSON.stringify(app.editHistory()),history);
});

test('programmatic input echoes and reselecting the current surface do not create false drafts',async()=>{
 const {page:app,calls}=page();app.choose(5);
 const before=JSON.stringify(app.editorState()),starts=calls.length;
 for(const field of app.uiFields().filter(f=>f.enabled&&(f.field.startsWith('orbit.')||f.field==='scene.duration')))app.setUiValue(field.field,field.value);
 await app.execute('uiAction',{action:'orbit.surface.1'});
 assert.equal(JSON.stringify(app.editorState()),before);assert.equal(app.dirty,false);assert.equal(calls.length,starts);
 app.setUiValue('orbit.name','修改草稿');app.discardOrbitDraft();app.setUiValue('orbit.name',app.orbitName);assert.equal(app.orbitDraft,false);assert.equal(app.bodyDrafts().length,0);
});

test('full-bleed composition keeps controls within insets without shrinking the native viewport',()=>{
 const {page:app,calls}=page();app.choose(5);app.closeup=true;app.panelOpen=true;
 for(const [w,h,top,bottom,left,right]of [[345,782,24,28,0,0],[782,345,0,0,24,0],[707,773,24,0,0,0]]){
  app.windowGeometry={widthPx:w,heightPx:h,topPx:top,bottomPx:bottom,leftPx:left,rightPx:right,revision:1};app.updateViewport(w,h);
  const l=app.layout();assert.equal(app.viewportWidth,w);assert.equal(app.viewportHeight,h);
  assert.equal(l.safe.x,left);assert.equal(l.safe.y,top);assert.equal(l.safe.width,w-left-right);
  for(const r of [l.drawer,l.dock,l.scene]){assert.ok(r.x>=left);assert.ok(r.y>=top);assert.ok(r.x+r.width<=w-right+.01);assert.ok(r.y+r.height<=h-bottom+.01);}
 }
 const starts=calls.filter(c=>c[0]==='start').length;app.windowGeometry.topPx=36;app.geometryChanged();assert.equal(calls.filter(c=>c[0]==='start').length,starts);
});

test('immersive window policy hides status, navigation and gesture indicator independently',async()=>{
 const context={exports:{},require:()=>({window:{}})};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/WindowControl.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 const c=context.exports.WindowControl,calls=[];
 c.bind({setWindowLayoutFullScreen:async v=>calls.push(['full',v]),setWindowSystemBarProperties:async()=>{},setSpecificSystemBarEnabled:async(n,v)=>{calls.push([n,v]);if(n==='navigation')throw Error('unsupported mode');}});
 await assert.rejects(c.immersive(),/navigation/);assert.deepEqual(calls,[['full',true],['status',false],['navigation',false],['navigationIndicator',false]]);
 c.bind(undefined);await assert.rejects(c.immersive(),/unavailable/);
});

test('theme catalog isolates conditions and collision speed comparison changes only speed',async()=>{
  const {page:app}=page();
  const catalog=JSON.parse(await app.execute('listExperiments',{}));assert.equal(catalog.catalogVersion,1);assert.equal(catalog.experiments.length,20);
  const [slow,fast]=catalog.experiments;assert.equal(slow.config.speed,2);assert.equal(fast.config.speed,8);
  assert.deepEqual({...slow.config,speed:8},fast.config);
  assert.ok(catalog.experiments.every(t=>t.goal&&t.limit&&t.question));
  slow.config.seed=999;assert.equal(JSON.parse(await app.execute('listExperiments',{})).experiments[0].config.seed,1234);
  for(const t of catalog.experiments){await app.execute('uiAction',{action:'theme.'+t.id});assert.equal(app.themeState().id,t.id);assert.equal(app.themeState().modified,false);assert.equal(app.panelOpen,false);assert.equal(app.colorMode,0);}
});
test('resolution pair changes only particle budget; observe preserves scene and camera',async()=>{
  const {page:app,state,calls}=page();
  await app.execute('uiAction',{action:'theme.resolution-coarse'});state.state='paused';
  const original=app.config(),before=app.snapshot(),starts=calls.filter(c=>c[0]==='start').length;
  await app.execute('uiAction',{action:'theme.observe'});
  assert.equal(app.panelOpen,true);assert.equal(app.tab,1);assert.equal(app.sphMetric,'pressure');
  assert.deepEqual(app.config(),original);assert.deepEqual(app.snapshot().camera,before.camera);
  assert.equal(calls.filter(c=>c[0]==='start').length,starts);
  await app.execute('uiAction',{action:'theme.compare'});assert.deepEqual(JSON.parse(JSON.stringify(app.config())),{...original,count:1200});
  assert.equal(app.themeState().modified,false);assert.equal(app.panelOpen,false);
  await app.execute('uiAction',{action:'theme.compare'});assert.deepEqual(app.config(),original);
  await app.execute('uiAction',{action:'theme.ocean-world'});await assert.rejects(app.execute('uiAction',{action:'theme.observe'}));
});
test('theme restore and compare discard edited initial conditions and reset physical preview exactly once',async()=>{
  const {page:app,state,calls}=page();
  await app.execute('uiAction',{action:'theme.rock-slow'});state.state='paused';const original=app.config();
  await app.execute('setUiValue',{field:'scene.speed',value:4});assert.equal(app.themeState().modified,true);
  const n=calls.filter(c=>c[0]==='start').length;
  await app.execute('uiAction',{action:'theme.compare'});assert.equal(app.config().speed,8);assert.equal(app.themeState().modified,false);
  assert.equal(calls.filter(c=>c[0]==='start').length,n+1);
  await app.execute('uiAction',{action:'theme.compare'});assert.deepEqual(app.config(),original);
  app.seed=987;app.closeup=false;app.colorMode=2;app.panelOpen=true;
  await app.execute('uiAction',{action:'theme.restore'});assert.deepEqual(app.config(),original);assert.equal(app.colorMode,0);assert.equal(app.panelOpen,false);
  await app.execute('uiAction',{action:'preset.0'});assert.equal(app.themeState().id,'');await assert.rejects(app.execute('uiAction',{action:'theme.restore'}));
});
test('theme loading rejects atomically and orbital templates retain editable surfaces',async()=>{
  const {page:app,state,calls}=page();app.choose(5);app.orbitName='未保存草稿';app.orbitDraft=true;
  const old=app.snapshot(),n=calls.length;state.rejectStart=true;
  await assert.rejects(app.execute('uiAction',{action:'theme.ocean-world'}),/native rejected/);
  delete state.rejectStart;assert.equal(app.snapshot(),old);assert.equal(calls.length,n);
  await assert.rejects(app.execute('uiAction',{action:'theme.unknown'}));assert.equal(app.snapshot(),old);
  await app.execute('uiAction',{action:'theme.ocean-world'});assert.equal(app.orbitBodies.length,2);assert.equal(app.focus,1);assert.equal(app.closeup,true);assert.equal(app.orbitBodies[1].surface,1);assert.equal(app.bodyDrafts().length,0);
  await app.execute('uiAction',{action:'theme.three-worlds'});assert.equal(app.orbitBodies.length,4);assert.equal(app.focus,-1);assert.equal(app.closeup,false);
  app.orbitBodies[1].surface=3;assert.equal(app.themeState().modified,true);
  await app.execute('uiAction',{action:'theme.restore'});assert.equal(app.orbitBodies[1].surface,1);
  const c=app.config();await app.execute('setScene',c);assert.equal(app.themeState().id,'');
});
test('library categories use semantic handlers without changing the current scene or camera',async()=>{
  const {page:app,calls}=page();const before=app.snapshot(),n=calls.length;
  for(const section of ['collision','explore','saved']){await app.execute('uiAction',{action:'library.'+section});assert.equal(JSON.parse(await app.execute('getUiState',{})).librarySection,section);}
  assert.equal(app.snapshot(),before);assert.equal(calls.length,n);
});


test('initial pause is passed atomically to native for themes, previews and body edits',async()=>{
  const {page:app,initialPauses}=page();
  app.prepare(false);assert.equal(initialPauses.at(-1),true);
  app.prepare(true);assert.equal(initialPauses.at(-1),false);
  await app.execute('uiAction',{action:'theme.ocean-world'});assert.equal(initialPauses.at(-1),true);
  app.orbitName='修改名称';app.orbitDraft=true;app.applyOrbit();assert.equal(initialPauses.at(-1),true);
});

test('ring appearance shares UI and CLI, validates atomically and preserves the solver and camera',async()=>{
  const {page:app,calls,state}=page();await app.execute('uiAction',{action:'theme.ring-world'});state.state='paused';
  const before=JSON.parse(app.snapshot()),starts=calls.filter(c=>c[0]==='start').length;
  assert.equal(before.definition.config.orbitBodies[1].surface,4);assert.equal(before.appearance.rings,true);
  await app.execute('uiAction',{action:'appearance.rings'});assert.equal(app.rings,false);
  await app.execute('setAppearance',{rings:true});assert.equal(app.rings,true);
  const snapshot=app.snapshot();await assert.rejects(app.execute('setAppearance',{rings:'yes',clouds:false}));assert.equal(app.snapshot(),snapshot);
  await assert.rejects(app.execute('uiAction',{action:'orbit.surface.6'}));
  assert.deepEqual(JSON.parse(app.snapshot()).camera,before.camera);assert.deepEqual(JSON.parse(app.snapshot()).definition.config,before.definition.config);
  assert.equal(calls.filter(c=>c[0]==='start').length,starts);
});
test('ring style survives placement, edit history and serialized scene reload',async()=>{
  const {page:app,state}=page();app.choose(5);state.state='paused';
  await app.execute('uiAction',{action:'orbit.add'});await app.execute('uiAction',{action:'placement.surface.4'});
  assert.equal(app.placementPreview().valid,true);assert.equal(app.placementPreview().body.surface,4);
  await app.execute('uiAction',{action:'placement.confirm'});state.state='paused';
  assert.equal(app.orbitBodies[4].surface,4);
  app.setUiValue('orbit.name','环星');app.applyOrbit(true);state.state='paused';
  await app.execute('uiAction',{action:'orbit.undo'});state.state='paused';assert.equal(app.orbitBodies[4].surface,4);
  await app.execute('uiAction',{action:'orbit.redo'});state.state='paused';assert.equal(app.orbitBodies[4].name,'环星');
  const saved=JSON.parse(JSON.stringify(app.definition()));await app.execute('setScene',saved.config);state.state='paused';
  assert.equal(app.orbitBodies[4].surface,4);
  const before=app.snapshot();saved.config.orbitBodies[4].surface=6;await assert.rejects(app.execute('setScene',saved.config));assert.equal(app.snapshot(),before);
});

test('local ring clock shares controls, preserves orbital initial conditions and rejects invalid seeks atomically',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';
 const before=JSON.parse(app.snapshot()),starts=calls.filter(c=>c[0]==='start').length;
 assert.equal(before.ringTrace.enabled,true);assert.equal(before.ringTrace.timeHours,0);
 await app.execute('uiAction',{action:'trace.play'});assert.equal(app.trace.running,true);
 await app.execute('setUiValue',{field:'trace.hours',value:6});assert.equal(app.trace.timeHours,6);assert.equal(app.trace.running,false);
 const stable=app.snapshot();await assert.rejects(app.execute('setUiValue',{field:'trace.hours',value:25}));await assert.rejects(app.execute('getRingTrace',{particles:'yes'}));assert.equal(app.snapshot(),stable);
 await app.execute('uiAction',{action:'trace.reset'});assert.equal(app.trace.timeHours,0);
 assert.deepEqual(JSON.parse(app.snapshot()).definition,before.definition);assert.equal(calls.filter(c=>c[0]==='start').length,starts);
 await app.execute('uiAction',{action:'surface.toggle'});assert.equal(app.trace.enabled,false);
 await assert.rejects(app.execute('uiAction',{action:'trace.play'}));
});
test('local ring mode exits on host restart or body changes and pause stops both clocks',async()=>{
 const {page:app,state}=page();await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';
 await app.execute('uiAction',{action:'trace.play'});await app.execute('pause',{});assert.equal(app.trace.running,false);assert.equal(state.state,'paused');
 await app.execute('start',{});assert.equal(app.trace.enabled,false);
 await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';await app.execute('uiAction',{action:'surface.next'});assert.equal(app.trace.enabled,false);
 await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';await app.execute('uiAction',{action:'theme.ocean-world'});assert.equal(app.trace.enabled,false);
 await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';await app.execute('uiAction',{action:'orbit.add'});assert.equal(app.trace.enabled,false);
 await app.execute('uiAction',{action:'placement.cancel'});await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';await app.execute('uiAction',{action:'replay.latest'});assert.equal(app.trace.enabled,false);
});

test('elliptic launch and rate controls reset only on launch change, with atomic validation',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.eccentric-ring'});state.state='paused';
 assert.equal(app.trace.speedScale,1.12);assert.equal(app.trace.running,false);
 const before=JSON.parse(app.snapshot()),starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('setUiValue',{field:'trace.hours',value:2});await app.execute('uiAction',{action:'trace.play'});
 await app.execute('setUiValue',{field:'trace.rate',value:.1});assert.equal(app.trace.timeHours,2);assert.equal(app.trace.running,true);
 await app.execute('setUiValue',{field:'trace.speed',value:1.12});assert.equal(app.trace.timeHours,2);assert.equal(app.trace.running,true);
 for(const [field,value] of [['trace.speed',.99],['trace.speed',1.21],['trace.speed','1.1'],['trace.rate',0],['trace.rate',4.1],['trace.rate',null]]){
  const stable=app.snapshot();await assert.rejects(app.execute('setUiValue',{field,value}));assert.equal(app.snapshot(),stable);
 }
 await app.execute('setUiValue',{field:'trace.speed',value:1.2});assert.equal(app.trace.timeHours,0);assert.equal(app.trace.running,false);assert.equal(app.trace.rateHours,.1);
 await app.execute('uiAction',{action:'trace.apoapsis'});assert.equal(app.trace.timeHours,app.trace.innerPeriodHours/2);
 await app.execute('uiAction',{action:'trace.circular'});assert.equal(app.trace.speedScale,1);assert.equal(app.trace.timeHours,0);
 await app.execute('uiAction',{action:'trace.ellipse'});assert.equal(app.trace.speedScale,1.12);
 assert.deepEqual(JSON.parse(app.snapshot()).camera,before.camera);assert.deepEqual(JSON.parse(app.snapshot()).definition,before.definition);assert.equal(calls.filter(c=>c[0]==='start').length,starts);
 await app.execute('uiAction',{action:'trace.toggle'});await assert.rejects(app.execute('setUiValue',{field:'trace.speed',value:1.1}));
 await app.execute('uiAction',{action:'trace.toggle'});assert.equal(app.trace.speedScale,1);assert.equal(app.trace.rateHours,1);
});
test('reference orbit plot is finite at circular and maximum eccentricity, readouts share native position',async()=>{
 const {page:app,state}=page();await app.execute('uiAction',{action:'theme.eccentric-ring'});state.state='paused';
 app.pathPixels=p=>p;
 for(const value of [1,1.12,1.2]){await app.execute('setUiValue',{field:'trace.speed',value});const path=app.tracePlotPath();assert.equal((path.match(/ L/g)||[]).length,96);assert.doesNotMatch(path,/NaN|Infinity/);assert.doesNotMatch(app.tracePlotPath(true),/NaN|Infinity/);}
});

test('HiLog replies pace UTF-8 bytes across sequential large requests and bound output size',async()=>{
 const {Bridge,lines,emissions}=bridge(),text='星🙂'.repeat(4000);
 Bridge.bind(async()=>JSON.stringify({ok:true,text}));Bridge.receive(want('largeone'));Bridge.receive(want('largetwo'));await tick();
 for(const line of lines){assert.doesNotMatch(line,/[\uD800-\uDBFF]$/);assert.doesNotMatch(line,/\d+\/\d+ [\uDC00-\uDFFF]/);}
 assert.equal(collect(lines.join('\n'),'largeone').text,text);assert.equal(collect(lines.join('\n'),'largetwo').text,text);
 assert.ok(emissions.at(-1).at>2000);
 for(let i=1;i<emissions.length;i++)assert.ok(emissions[i].at-emissions[i-1].at>=emissions[i-1].bytes/12-1,'unpaced chunk burst');
 Bridge.bind(async()=>JSON.stringify({ok:true,text:'a'.repeat(128001)}));Bridge.receive(want('oversize'));await tick();assert.equal(collect(lines.join('\n'),'oversize').ok,false);
});

test('named recipe restores appearance, camera, theme and ring while both clocks remain paused',async()=>{
 const {page:app,state,projects}=page();app.chooseTheme('eccentric-ring');
 app.changeAppearance({clouds:false,atmosphere:false,trails:false,autoSpin:false,rings:false});app.changeSky(1,.37);
 app.traceParameter('trace.speed',1.17);app.traceParameter('trace.rate',.3);app.traceTime(4.75);
 const saved=app.saveProject('环与夜色'),recipe=structuredClone(saved.recipe),config=JSON.stringify(saved.scene.config);
 app.chooseTheme('rock-slow');app.openProject(saved.id);
 assert.deepEqual(JSON.parse(JSON.stringify(app.captureRecipe())),recipe);assert.equal(JSON.stringify(app.config()),config);
 assert.equal(app.trace.running,false);assert.equal(state.state,'preparing');assert.equal(app.playing,false);
 assert.equal(JSON.parse(await app.execute('listProjects',{})).projects[0].hasRecipe,true);
 assert.equal(projects.size,1);
});
test('legacy projects use deterministic defaults; invalid recipes and native rejection preserve the workspace',()=>{
 const {page:app,projects,state,calls}=page();app.chooseTheme('eccentric-ring');
 const saved=app.saveProject('版本兼容');const legacy=structuredClone(saved);delete legacy.recipe;legacy.id='project-2-0';projects.set(legacy.id,legacy);
 app.openProject(legacy.id);assert.equal(app.activeThemeId,'');assert.equal(app.focus,-1);assert.equal(app.closeup,false);assert.equal(app.trace.enabled,false);assert.equal(app.skyBrightness,.65);
 app.chooseTheme('eccentric-ring');app.traceTime(6);const before=app.snapshot(),count=calls.length;
 const bad=structuredClone(saved);bad.recipe.ring.target=0;projects.set(bad.id,bad);
 assert.throws(()=>app.openProject(bad.id));assert.equal(app.snapshot(),before);assert.equal(calls.length,count);
 projects.set(saved.id,saved);state.rejectStart=true;assert.throws(()=>app.openProject(saved.id));delete state.rejectStart;
 assert.equal(app.snapshot(),before);assert.equal(calls.length,count);
});
test('return-to-overview is part of a saved close-up recipe',()=>{
 const {page:app}=page();app.chooseTheme('three-worlds');app.closeSurface();app.stopCameraMotion();
 app.yaw=.78;app.pitch=.32;app.zoom=4.2;app.openSurface(1);app.stopCameraMotion();
 const saved=app.saveProject('回到全景');assert.equal(saved.recipe.overview.zoom,4.2);
 app.chooseTheme('rock-slow');app.openProject(saved.id);assert.equal(app.overviewCamera.zoom,4.2);
 app.closeSurface();app.stopCameraMotion();assert.equal(app.focus,-1);assert.equal(app.closeup,false);
});

test('explicit camera navigation validates all fields before mutation and returns a queryable request',async()=>{
 const {page:app,calls}=page();await app.execute('uiAction',{action:'preset.5'});
 const before=app.snapshot(),count=calls.length;
 for(const payload of [{focus:99},{focus:1,durationMs:3001},{focus:1,closeup:'yes'},{focus:-1,closeup:true},{focus:1,yaw:101}])await assert.rejects(app.execute('navigateCamera',payload));
 assert.equal(app.snapshot(),before);assert.equal(calls.length,count);
 const result=JSON.parse(await app.execute('navigateCamera',{focus:2,closeup:true,durationMs:1200,yaw:.8,zoom:4}));
 assert.equal(result.camera.focus,2);assert.equal(result.appearance.closeup,true);assert.ok(result.cameraMotion.requestId>0);
 assert.equal(JSON.parse(await app.execute('getCameraMotion',{requestId:result.cameraMotion.requestId})).cameraMotion.targetFocus,2);
});
test('editing a selected body retains the current viewing distance',async()=>{
 const {page:app,calls}=page();await app.execute('uiAction',{action:'preset.5'});await app.execute('uiAction',{action:'focus.1'});
 const before=JSON.parse(app.snapshot()),count=calls.length;
 await app.execute('uiAction',{action:'selection.edit'});const after=JSON.parse(app.snapshot());
 assert.equal(after.appearance.closeup,false);assert.deepEqual(after.camera,before.camera);assert.equal(calls.length,count);assert.equal(after.ui.panelOpen,true);
});
test('CLI camera wait flag is explicit and cannot be combined with a batch envelope',()=>{
 assert.equal(options(['--device','127.0.0.1:5555','--command','navigateCamera','--wait-camera'])['wait-camera'],true);
 assert.throws(()=>options(['--device','127.0.0.1:5555','--batch','x.json','--wait-camera']));
});

test('material controls validate atomically and never submit camera or solver changes',async()=>{
 const {page:app,calls}=page();app.chooseTheme('three-worlds');calls.length=0;
 const before=JSON.parse(app.snapshot());
 for(const payload of [{exposure:2.01},{exposure:null},{exposure:NaN},{exposure:1,ocean:'yes'},{exposure:-1,cloudShadows:null}])await assert.rejects(app.execute('setMaterial',payload));
 assert.equal(calls.length,0);assert.deepEqual(JSON.parse(app.snapshot()),before);
 await app.execute('setMaterial',{exposure:1.2,ocean:false,cloudShadows:false});
 await app.execute('setUiValue',{field:'material.exposure',value:-.7});
 await app.execute('uiAction',{action:'material.ocean'});
 const after=JSON.parse(app.snapshot());assert.deepEqual(after.material,{exposure:-.7,ocean:true,cloudShadows:false});
 assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.cameraMotion,before.cameraMotion);assert.deepEqual(after.definition,before.definition);assert.deepEqual(after.simulation,before.simulation);
 assert.ok(calls.every(c=>c[0]==='material'));await app.execute('uiAction',{action:'material.reset'});assert.deepEqual(JSON.parse(app.snapshot()).material,{exposure:0,ocean:true,cloudShadows:true});
});
test('material recipes round-trip and v1 appearance resets material to defaults',()=>{
 const {page:app,projects}=page();app.chooseTheme('three-worlds');app.changeMaterial({exposure:1.3,ocean:false,cloudShadows:false});
 const saved=app.saveProject('光照配方');assert.equal(saved.recipe.appearanceVersion,3);
 app.changeMaterial({exposure:-2});app.openProject(saved.id);assert.deepEqual(JSON.parse(JSON.stringify(app.materialState())),saved.recipe.material);
 const legacy=structuredClone(saved);legacy.id='project-3-0';legacy.recipe.appearanceVersion=1;delete legacy.recipe.material;delete legacy.recipe.surfaces;projects.set(legacy.id,legacy);
 app.openProject(legacy.id);assert.deepEqual(JSON.parse(JSON.stringify(app.materialState())),{exposure:0,ocean:true,cloudShadows:true});
 assert.equal(projects.get(legacy.id).recipe.appearanceVersion,1,'reading legacy must not rewrite it');
});

test('Moon atlas is an explicit teaching scene and moon styles survive editing and recipes',async()=>{
 const {page:app}=page();app.chooseTheme('moon-atlas');assert.equal(app.orbitBodies[1].surface,5);assert.equal(app.orbitBodies[1].massSolar,398600.435507e9/1.32712440041279419e20);
 const saved=app.saveProject('月海');app.chooseTheme('three-worlds');app.openProject(saved.id);assert.equal(app.orbitBodies[1].surface,5);
 await app.execute('uiAction',{action:'orbit.add'});await app.execute('uiAction',{action:'placement.surface.5'});assert.equal(app.placementPreview().body.surface,5);assert.equal(app.placementPreview().valid,true);
});

test('copy uses current mass and skin, preserves drafts and timeline, and commits without rebuilding',async()=>{
 const {page:app,calls,state}=page();app.choose(5);state.state='completed';state.selected=3;
 app.orbitBodies[1].surface=5;app.surfaces[1]={version:1,seed:0,cloudSeed:0};app.orbitBodies[1].massSolar*=7;app.selectOrbit(1,true);
 await app.execute('setUiValue',{field:'orbit.name',value:'未应用名称'});
 await app.execute('setUiValue',{field:'orbit.value.0',value:''});
 await app.execute('uiAction',{action:'orbit.surface.4'});
 const before=JSON.parse(app.snapshot()),starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'orbit.copy'});
 let s=JSON.parse(app.snapshot()),p=s.placement.preview;
 assert.equal(s.placement.sourceIndex,1);assert.equal(s.placement.sourceName,'蔚蓝');
 assert.equal(p.valid,true);assert.equal(p.body.surface,5);assert.equal(p.body.massSolar,app.orbitBodies[1].massSolar);
 assert.match(p.body.name,/蔚蓝 · 副本/);assert.equal(s.placement.fields[3],'0');assert.equal(s.placement.fields[4],'1');
 assert.deepEqual(s.definition,before.definition);assert.deepEqual(s.editor,before.editor);assert.equal(state.selected,3);
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);assert.equal(app.editHistory().undoCount,0);
 await assert.rejects(app.execute('uiAction',{action:'orbit.copy'}));
 await app.execute('uiAction',{action:'placement.cancel'});assert.deepEqual(JSON.parse(app.snapshot()).camera,before.camera);
 assert.equal(app.orbitName,'未应用名称');assert.equal(app.editHistory().undoCount,0);
 await app.execute('uiAction',{action:'orbit.copy'});await app.execute('setUiValue',{field:'placement.value.4',value:'1.2'});
 p=JSON.parse(app.snapshot()).placement.preview;assert.equal(p.valid,true);
 await app.execute('uiAction',{action:'placement.confirm'});state.state='paused';
 assert.deepEqual(JSON.parse(JSON.stringify(app.orbitBodies.at(-1))),p.body);assert.equal(app.editHistory().undoCount,0);
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);assert.equal(calls.filter(c=>c[0]==='insert').length,1);
 app.selectOrbit(1);assert.equal(app.orbitName,'未应用名称');assert.equal(app.orbitFields[0],'');
 await assert.rejects(app.execute('uiAction',{action:'orbit.undo'}),/unavailable/);
 await app.execute('uiAction',{action:'orbit.add'});assert.equal(JSON.parse(app.snapshot()).placement.sourceIndex,-1);assert.equal(app.placementSurface,1);
});

test('copy rejects stars, full systems, I/O and other models without partial mutations',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';
 for(const setup of [()=>app.selectOrbit(0),()=>{app.selectOrbit(1);app.ioBusy=true;},()=>{app.ioBusy=false;app.preset=0;}]){
  setup();const before=app.snapshot();await assert.rejects(app.execute('uiAction',{action:'orbit.copy'}));assert.equal(app.snapshot(),before);
 }
 app.choose(5);state.state='paused';while(app.orbitBodies.length<8){app.beginPlacement();app.confirmPlacement();state.state='paused';}
 const before=app.snapshot();await assert.rejects(app.execute('uiAction',{action:'orbit.copy'}));assert.equal(app.snapshot(),before);
});

test('copy avoids occupied positions and preserves Unicode names, all skins, mass bounds and stellar frame',()=>{
 const {page:app,state}=page();app.choose(5);app.orbitBodies[0].xAU=.3;app.orbitBodies[0].vxKmS=4;app.orbitBodies[0].vyKmS=-2;
 for(let surface=1;surface<=5;surface++){
  app.orbitBodies[1].surface=surface;app.orbitBodies[1].name='🌙'.repeat(24);app.beginPlacement(1);
  const p=app.placementPreview();assert.equal(p.valid,true);assert.equal(p.body.surface,surface);assert.ok(p.body.name.length<=48);assert.ok(p.nearestAU>=.05);
  const star=app.orbitBodies[0],r=[p.body.xAU-star.xAU,p.body.yAU-star.yAU,p.body.zAU-star.zAU],v=[p.body.vxKmS-star.vxKmS,p.body.vyKmS-star.vyKmS,p.body.vzKmS-star.vzKmS];
  assert.ok(Math.abs(r.reduce((sum,x,i)=>sum+x*v[i],0))<1e-10);assert.ok(Math.abs(Math.hypot(...v)-p.circularKmS)<1e-10);app.cancelPlacement();
 }
 app.beginPlacement(1);const first=app.placementPreview().body;app.confirmPlacement();app.beginPlacement(1);
 assert.notEqual(app.placementName,first.name);assert.equal(app.placementPreview().valid,true);app.cancelPlacement();
 for(const mass of [1e-8,.01]){state.orbitState[1].massSolar=mass;app.beginPlacement(1);assert.equal(app.placementPreview().valid,true);assert.ok(Math.abs(app.placementPreview().body.massSolar-mass)<1e-18);app.cancelPlacement();}
});

test('native copy commit rejection leaves candidate, source, drafts and history intact',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';app.beginPlacement(1);
 state.rejectStart=true;const before=app.snapshot();await assert.rejects(app.execute('uiAction',{action:'placement.confirm'}),/native rejected/);assert.equal(app.snapshot(),before);
});


test('observation reads real adapter history without seeking; metrics and extrema share UI actions',async()=>{
 const {page:app,state,calls}=page();app.choose(5);state.state='completed';state.selected=-1;
 state.observation={sceneRevision:6,body:1,name:'蔚蓝',samples:[{frame:0,time:.1,distanceAU:1,speedKmS:30},{frame:1,time:.2,distanceAU:2,speedKmS:15},{frame:2,time:.3,distanceAU:1.5,speedKmS:20}]};
 const definition=JSON.stringify(app.definition()),starts=calls.filter(c=>c[0]==='start').length,camera=JSON.parse(app.snapshot()).camera;
 let o=JSON.parse(await app.execute('getOrbitObservation',{}));assert.equal(o.plot.maximum,2);assert.equal(o.plot.maxFrame,1);assert.equal(state.selected,-1);
 await app.execute('uiAction',{action:'observation.maximum'});assert.equal(state.selected,1);assert.equal(app.playing,false);
 await app.execute('uiAction',{action:'observation.speed'});o=JSON.parse(await app.execute('getOrbitObservation',{}));assert.equal(o.plot.unit,'km/s');assert.equal(o.plot.current,15);
 await app.execute('uiAction',{action:'observation.maximum'});assert.equal(state.selected,0);
 assert.equal(JSON.stringify(app.definition()),definition);assert.deepEqual(JSON.parse(app.snapshot()).camera,camera);assert.equal(calls.filter(c=>c[0]==='start').length,starts);
 app.focus=2;assert.equal(JSON.parse(await app.execute('getOrbitObservation',{})).data.body,2);
 app.focus=-1;assert.equal(JSON.parse(await app.execute('getOrbitObservation',{})).data.body,1);
 app.beginPlacement();await assert.rejects(app.execute('uiAction',{action:'observation.maximum'}));app.cancelPlacement();
 app.ioBusy=true;await assert.rejects(app.execute('uiAction',{action:'observation.minimum'}));app.ioBusy=false;
 state.observation.samples=[];await assert.rejects(app.execute('uiAction',{action:'observation.minimum'}));assert.equal(JSON.parse(await app.execute('getOrbitObservation',{})).plot.available,false);
 app.preset=0;await assert.rejects(app.execute('uiAction',{action:'observation.speed'}));
});


test('comparison capture stores applied native config and immutable samples; survives edits, hide and errors',async()=>{
 const {page:app,state,calls}=page();app.choose(5);state.state='completed';state.selected=-1;state.config=JSON.parse(JSON.stringify(app.config()));
 state.observation={sceneRevision:8,body:1,name:'蔚蓝',samples:[{frame:0,time:.1,distanceAU:1,speedKmS:30},{frame:1,time:.2,distanceAU:2,speedKmS:15}]};
 app.duration=4;app.orbitName='未应用名称';app.orbitDraft=true;
 const before=app.snapshot(),starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'comparison.capture'});let saved=JSON.parse(await app.execute('getObservationReference',{})).reference;
 assert.equal(saved.config.duration,state.config.duration);assert.notEqual(saved.config.duration,app.duration);assert.equal(saved.data.name,'蔚蓝');assert.equal(saved.data.samples.length,2);
 state.observation.samples[0].distanceAU=1.5;assert.equal(JSON.parse(await app.execute('getObservationReference',{})).reference.data.samples[0].distanceAU,1);
 await app.execute('uiAction',{action:'comparison.toggle'});assert.equal(JSON.parse(await app.execute('getObservationComparison',{})).chart.referenceVisible,false);
 assert.deepEqual(JSON.parse(await app.execute('getObservationReference',{})).reference,saved);
 await app.execute('uiAction',{action:'comparison.toggle'});let c=JSON.parse(await app.execute('getObservationComparison',{}));assert.equal(c.chart.referenceVisible,true);assert.equal(c.chart.deltaReady,true);
 state.rejectReferenceSave=true;await assert.rejects(app.execute('uiAction',{action:'comparison.capture'}),/disk full/);assert.deepEqual(JSON.parse(await app.execute('getObservationReference',{})).reference,saved);
 state.rejectReferenceClear=true;await assert.rejects(app.execute('uiAction',{action:'comparison.clear'}));assert.deepEqual(JSON.parse(await app.execute('getObservationReference',{})).reference,saved);
 app.comparisonReference=undefined;app.reloadReference();assert.deepEqual(JSON.parse(await app.execute('getObservationReference',{})).reference,saved);
 state.rejectReferenceClear=false;await app.execute('uiAction',{action:'comparison.clear'});assert.equal(JSON.parse(await app.execute('getObservationReference',{})).reference,null);
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);assert.deepEqual(JSON.parse(app.snapshot()).definition,JSON.parse(before).definition);assert.equal(app.orbitName,'未应用名称');assert.equal(state.selected,-1);
});

test('comparison and table APIs keep original observation semantics, empty and placement guards',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';state.config=JSON.parse(JSON.stringify(app.config()));state.selected=-1;
 state.observation={sceneRevision:2,body:1,name:'蔚蓝',samples:[{frame:0,time:.1,distanceAU:1,speedKmS:30}]};
 await assert.rejects(app.execute('uiAction',{action:'comparison.capture'}));
 state.observation.samples.push({frame:1,time:.2,distanceAU:2,speedKmS:15});await app.execute('uiAction',{action:'comparison.capture'});
 state.observation.samples=[{frame:0,time:.5,distanceAU:3,speedKmS:10},{frame:1,time:.6,distanceAU:4,speedKmS:8}];
 const raw=JSON.parse(await app.execute('getOrbitObservation',{})),comparison=JSON.parse(await app.execute('getObservationComparison',{}));assert.equal(raw.plot.firstTime,.5);assert.equal(comparison.chart.plot.firstTime,.1);assert.equal(comparison.chart.overlap,false);assert.equal(comparison.chart.deltaReady,false);
 const table=JSON.parse(await app.execute('getObservationTable',{}));assert.equal(table.rows,4);assert.match(table.csv,/reference,0,0.1,1,30/);assert.equal(table.timeAlignment,'simulation-start');
 app.beginPlacement();await assert.rejects(app.execute('uiAction',{action:'comparison.clear'}));app.cancelPlacement();app.ioBusy=true;await assert.rejects(app.execute('uiAction',{action:'comparison.capture'}));
});

test('reference read failures remain visible, retry rejects while corrupt and recovers the same saved data',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='completed';state.selected=-1;state.config=JSON.parse(JSON.stringify(app.config()));
 state.observation={sceneRevision:5,body:1,name:'蔚蓝',samples:[{frame:0,time:.1,distanceAU:1,speedKmS:30},{frame:1,time:.2,distanceAU:2,speedKmS:15}]};
 await app.execute('uiAction',{action:'comparison.capture'});const saved=JSON.parse(await app.execute('getObservationReference',{})).reference;
 state.rejectReferenceLoad=true;app.reloadReference();let r=JSON.parse(await app.execute('getObservationReference',{}));assert.equal(r.reference,null);assert.match(r.error,/bad reference file/);
 await assert.rejects(app.execute('uiAction',{action:'comparison.reload'}),/bad reference file/);assert.equal(JSON.parse(await app.execute('getUiState',{})).actions.find(a=>a.id==='comparison.clear').enabled,true);
 state.rejectReferenceLoad=false;await app.execute('uiAction',{action:'comparison.reload'});r=JSON.parse(await app.execute('getObservationReference',{}));assert.deepEqual(r.reference,saved);assert.equal(r.error,'');
});

test('SPH diagnostics and color actions share the selected frame, preserve physics and survive recipes',async()=>{
 const {page:app,state,calls,projects}=page();state.state='completed';state.config=JSON.parse(JSON.stringify(app.config()));state.sph={available:true,pressureMinGPa:-2,pressureMaxGPa:3,pressureMeanGPa:1,internalMinMJkg:0,internalMaxMJkg:2,internalMeanMJkg:1,damageMean:.125,damageMax:.5,kineticJ:20,internalJ:30};
 app.camera();const initial=app.snapshot(),startCount=calls.filter(c=>c[0]==='start').length;
 for(const color of [3,4,5]){await app.execute('uiAction',{action:'color.'+color});assert.equal(app.colorMode,color);const r=JSON.parse(await app.execute('getSphDiagnostics',{}));assert.deepEqual(r.diagnostics,state.sph);assert.equal(r.selected,state.selected);assert.equal(r.time,state.time);assert.equal(r.timeUnit,'s');}
 assert.equal(calls.filter(c=>c[0]==='start').length,startCount);assert.deepEqual(JSON.parse(app.snapshot()).simulation,JSON.parse(initial).simulation);
 const saved=JSON.parse(await app.execute('saveProject',{}));assert.equal(projects.get(saved.id).recipe.camera.color,5);
 state.sph={available:false};assert.equal(JSON.parse(await app.execute('getSphDiagnostics',{})).diagnostics.available,false);await assert.rejects(app.execute('uiAction',{action:'color.3'}));
 await app.execute('setScene',{preset:3,count:200,speed:1,angle:0,duration:1});assert.equal(app.colorMode,0);await assert.rejects(app.execute('setCamera',{yaw:0,pitch:0,zoom:3,focus:-1,color:3}));
});

test('SPH panel composition follows free viewport through fold and rotation without changing physics or camera',async()=>{
 const {page:app,calls,state}=page();app.camera();app.panelOpen=true;app.toolsVisible=true;
 const camera=JSON.parse(app.snapshot()).camera,mutations=calls.length;
 for(const [w,h] of [[707,707],[345,716],[744,307]]){
  app.updateViewport(w,h);const region=app.layout().scene,c=state.composition;
  assert.equal(c.x,(region.x+region.width/2)/w);assert.equal(c.y,(region.y+region.height/2)/h);
  assert.equal(c.scale,Math.min(1,Math.min(region.width,region.height)/Math.min(w,h)));assert.ok(c.scale<1&&c.scale>0);
  assert.deepEqual(JSON.parse(app.snapshot()).camera,camera);assert.equal(calls.length,mutations);
 }
 app.panelOpen=false;app.composeViewport();assert.deepEqual(state.composition,{x:.5,y:.5,scale:1});
});

test('SPH curve CLI and UI share metric/seek actions, export raw values and preserve scene/camera',async()=>{
 const {page:app,state,calls}=page();state.sphObservation={sceneRevision:11,selected:-1,samples:[0,1,3].map((time,frame)=>({frame,time,values:[-1,frame,0,0,3,frame,frame*.1,.5,10-frame,frame*100]}))};
 app.camera();const before=JSON.parse(app.snapshot()),mutations=calls.length;
 for(const metric of ['pressure','internal','damage','kinetic','energy']){await app.execute('uiAction',{action:'sph.metric.'+metric});const result=JSON.parse(await app.execute('getSphObservation',{}));assert.equal(result.metric,metric);assert.equal(result.plot.available,true);}
 assert.equal(calls.length,mutations);assert.deepEqual(JSON.parse(app.snapshot()).camera,before.camera);
 const csv=JSON.parse(await app.execute('getSphTable',{}));assert.equal(csv.rows,3);assert.match(csv.csv,/time_s/);
 await app.execute('uiAction',{action:'sph.maximum'});assert.equal(state.selected,2);assert.equal(app.playing,false);assert.deepEqual(JSON.parse(app.snapshot()).definition,before.definition);
});

test('preparation labels, slow hint and cancellation share the CLI handler without recreating a scene',async()=>{
 const {page:app,state,calls}=page();state.state='preparing';state.preparation={requestId:7,stage:'target',elapsedMs:16000,stageMs:15000,slow:true,previousRequestId:0,previousStage:'',events:[]};app.info={...state};
 assert.equal(app.stateLabel(),'正在生成主天体');assert.match(app.preparationHint(),/16.0 s.*耗时较长/);
 state.preparation.previousRequestId=6;app.info={...state};assert.equal(app.stateLabel(),'等待上一轮结束');
 const before=app.snapshot(),n=calls.filter(c=>c[0]==='start').length;
 const report=JSON.parse(await app.execute('getPreparation',{}));assert.equal(report.preparation.requestId,7);
 await app.execute('uiAction',{action:'simulation.cancel'});assert.equal(state.state,'cancelled');assert.equal(calls.filter(c=>c[0]==='start').length,n);assert.deepEqual(app.snapshot().camera,before.camera);assert.deepEqual(app.snapshot().definition,before.definition);
 await assert.rejects(app.execute('uiAction',{action:'simulation.cancel'}));
});

test('surface actions preserve solver/camera, persist copies and remap deletion histories',async()=>{
 const {page:app,calls,state}=page();app.choose(5);state.state='completed';state.selected=3;
 const before=JSON.parse(app.snapshot());calls.length=0;
 await app.execute('setSurfaceSeed',{body:1,surfaceSeed:771,cloudSeed:992});
 let s=JSON.parse(app.snapshot());assert.deepEqual(s.definition,before.definition);assert.deepEqual(s.camera,before.camera);assert.equal(s.simulation.selected,3);assert.ok(calls.every(c=>c[0]==='surfaceSeeds'));
 assert.deepEqual(s.surfaces[1],{version:1,seed:771,cloudSeed:992});
 for(const bad of [{body:1,surfaceSeed:1.2},{body:0,surfaceSeed:1},{body:1,cloudSeed:-1},{body:1,surfaceSeed:null}]){const stable=app.snapshot();await assert.rejects(app.execute('setSurfaceSeed',bad));assert.equal(app.snapshot(),stable);}
 await app.execute('uiAction',{action:'terrain.undo'});assert.deepEqual(JSON.parse(app.snapshot()).surfaces,before.surfaces);
 await app.execute('uiAction',{action:'terrain.redo'});assert.equal(app.surfaces[1].seed,771);
 const saved=app.saveProject('独立外观');app.openProject(saved.id);assert.equal(app.surfaces[1].cloudSeed,992);
 await app.execute('uiAction',{action:'orbit.copy'});await app.execute('uiAction',{action:'placement.confirm'});state.state='paused';assert.equal(app.surfaces.at(-1).seed,771);
 app.selectOrbit(1);await app.execute('uiAction',{action:'orbit.remove'});state.state='paused';assert.equal(app.surfaces.at(-1).seed,771);
 await app.execute('uiAction',{action:'orbit.undo'});state.state='paused';assert.equal(app.surfaces[1].seed,771);assert.equal(app.surfaces.at(-1).cloudSeed,992);
});

test('dense ring disturbance shares UI/CLI, preserves host simulation, toggles grains without reset and restores versioned recipe',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.kepler-ring'});state.state='paused';
 const before=JSON.parse(app.snapshot()),starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'trace.disturb'});assert.equal(app.trace.impulse,.25);
 await app.execute('setUiValue',{field:'trace.hours',value:6});await app.execute('uiAction',{action:'trace.play'});
 await app.execute('uiAction',{action:'trace.points'});assert.equal(app.trace.points,true);assert.equal(app.trace.timeHours,6);assert.equal(app.trace.running,true);
 for(const value of [-.01,.36,'0.2',null]){const stable=app.snapshot();await assert.rejects(app.execute('setUiValue',{field:'trace.impulse',value}));assert.equal(app.snapshot(),stable);}
 await app.execute('setUiValue',{field:'trace.impulse',value:.35});assert.equal(app.trace.running,false);assert.equal(app.trace.timeHours,0);
 await app.execute('setUiValue',{field:'trace.hours',value:3});const recipe=app.captureRecipe();assert.equal(recipe.ring.modelVersion,2);assert.equal(recipe.ring.impulse,.35);
 assert.deepEqual(JSON.parse(app.snapshot()).definition,before.definition);assert.equal(calls.filter(c=>c[0]==='start').length,starts);
 await app.execute('uiAction',{action:'trace.clear'});assert.equal(app.trace.impulse,0);app.restoreRecipe(recipe);assert.equal(app.trace.impulse,.35);assert.equal(app.trace.points,true);assert.equal(app.trace.timeHours,3);
 const legacy=structuredClone(recipe);delete legacy.ring.modelVersion;delete legacy.ring.impulse;delete legacy.ring.points;app.restoreRecipe(legacy);assert.equal(app.trace.impulse,0);assert.equal(app.trace.points,false);
 await app.execute('uiAction',{action:'trace.toggle'});await assert.rejects(app.execute('setUiValue',{field:'trace.impulse',value:.25}));
});

test('SPH gravity UI drafts share native config and reject incompatible budgets atomically',async()=>{
 const {page:app,calls}=page();app.choose(0);
 await app.execute('uiAction',{action:'scene.gravity'});
 assert.equal(app.config().selfGravity,true);assert.equal(app.definition().model,'sph-rock-gravity-v1');assert.equal(app.dirty,true);
 await app.execute('uiAction',{action:'simulation.apply'});
 assert.equal(app.config().selfGravity,true);
 const before=app.snapshot(),n=calls.length;
 for(const config of [{...app.config(),selfGravity:'true'},{...app.config(),count:1400},{...app.config(),preset:3,speed:1,duration:1}]){
  await assert.rejects(app.execute('setScene',config));assert.equal(app.snapshot(),before);assert.equal(calls.length,n);
 }
 await assert.rejects(app.execute('setUiValue',{field:'scene.count',value:1400}));
 const legacy=JSON.parse(JSON.stringify(app.config()));delete legacy.selfGravity;
 await app.execute('setScene',legacy);assert.equal(app.config().selfGravity,undefined);assert.equal(app.definition().model,'sph-rock-v1');
 app.applyConfig({...legacy,selfGravity:true});assert.equal(app.config().selfGravity,true);
 app.choose(4);assert.equal(app.config().selfGravity,undefined);
});

test('gravity changes theme identity and restores the original material model on theme reset',async()=>{
 const {page:app}=page();app.chooseTheme('rock-slow');assert.equal(app.themeState().modified,false);
 await app.execute('uiAction',{action:'scene.gravity'});assert.equal(app.themeState().modified,true);assert.match(app.themeState().limit,/已开启/);
 app.chooseTheme('rock-slow');assert.equal(app.config().selfGravity,undefined);assert.equal(app.themeState().modified,false);
});

test('structure commands reject missing old-replay data without changing the current metric',async()=>{
 const {page:app,state}=page();app.choose(0);state.state='paused';
 for(const metric of ['gravity','relativeKinetic','radius','radial']){
  const before=app.sphMetric;await assert.rejects(app.execute('uiAction',{action:'sph.metric.'+metric}));assert.equal(app.sphMetric,before);
 }
});

test('pre-relaxation shared controls preserve draft/applied separation, model identity and safe defaults',async()=>{
 const {page:app,calls}=page();app.applyConfig({...app.config(),selfGravity:true});
 const count=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'scene.relax.16'});assert.equal(app.config().relaxationSeconds,16);assert.equal(app.definition().model,'sph-rock-prepared-v1');assert.equal(app.dirty,true);assert.equal(calls.filter(c=>c[0]==='start').length,count);
 await app.execute('uiAction',{action:'scene.relax.64'});assert.equal(app.config().relaxationSeconds,64);
 const frozen=JSON.stringify(app.config());for(const extra of [{relaxationSeconds:8},{relaxationSeconds:'16'},{relaxationSeconds:16,selfGravity:false},{relaxationSeconds:16,preset:3,speed:1,duration:1}]){await assert.rejects(app.execute('setScene',{...app.config(),...extra}));assert.equal(JSON.stringify(app.config()),frozen);}
 await app.execute('uiAction',{action:'scene.gravity'});assert.equal(app.config().relaxationSeconds,undefined);await assert.rejects(app.execute('uiAction',{action:'scene.relax.16'}));
 app.applyConfig({...app.config(),selfGravity:true,relaxationSeconds:16});const saved=JSON.parse(await app.execute('saveProject',{title:'预松弛'}));await app.execute('uiAction',{action:'scene.relax.0'});await app.execute('loadProject',{id:saved.id});assert.equal(app.config().relaxationSeconds,16);
 app.choose(4);assert.equal(app.config().relaxationSeconds,undefined);assert.equal(app.definition().model,'nbody-v1');
});

test('prepared impact pair keeps input configuration fixed except isolated preparation',async()=>{
 const {page:app}=page();await app.execute('uiAction',{action:'theme.direct-impact'});const direct=app.config();assert.equal(direct.selfGravity,true);
 await app.execute('uiAction',{action:'theme.compare'});assert.equal(app.themeState().id,'prepared-impact');assert.deepEqual(JSON.parse(JSON.stringify(app.config())),{...direct,relaxationSeconds:16});assert.equal(app.themeState().modified,false);
 await app.execute('uiAction',{action:'scene.relax.64'});assert.equal(app.themeState().modified,true);await app.execute('uiAction',{action:'theme.compare'});assert.deepEqual(app.config(),direct);
});

test('stationary sphere accepts zero spin only in single-body model and exposes read-only window summary',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.sphere-unprepared'});assert.equal(app.config().speed,0);assert.equal(app.config().targetSpin,0);
 const direct=app.config();await app.execute('uiAction',{action:'theme.compare'});assert.equal(app.themeState().id,'sphere-release');assert.deepEqual(JSON.parse(JSON.stringify(app.config())),{...direct,relaxationSeconds:64});
 for(const patch of [{preset:0},{preset:1},{preset:3,duration:1},{speed:-.1}])await assert.rejects(app.execute('setScene',{...app.config(),...patch}));
 state.sphObservation={sceneRevision:7,selected:-1,samples:[0,1,3].map((time,frame)=>({frame,time,values:[0,0,0,0,0,0,0,0,0,0],structure:[-1,2*time,80+time,-time]}))};
 const before=calls.length;const reply=JSON.parse(await app.execute('getSphWindowSummary'));assert.equal(reply.summary.available,true);assert.equal(reply.summary.meanKineticJ,3);assert.equal(reply.summary.includesInitial,true);assert.equal(calls.length,before);
});

test('stationary shortcut clears both spin inputs without mutating the active solver',async()=>{
 const {page:app,calls}=page();app.choose(2);app.applyConfig({...app.config(),speed:2,targetSpin:.004});const count=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'scene.stationary'});assert.equal(app.config().speed,0);assert.equal(app.config().targetSpin,0);assert.equal(calls.filter(c=>c[0]==='start').length,count);assert.ok(app.dirty);
 app.choose(0);await assert.rejects(app.execute('uiAction',{action:'scene.stationary'}));
});

test('bounded large response supports full SPH tables without dropping Unicode or pacing',async()=>{
 const {Bridge,lines,emissions}=bridge();const csv='0123456789'.repeat(9600)+'星体🌏';Bridge.bind(async()=>JSON.stringify({ok:true,csv}));Bridge.receive(want('large'));await tick();
 const result=collect(lines.join('\n'),'large');assert.equal(result.csv,csv);assert.ok(lines.length>128&&lines.length<=256);
 for(let i=1;i<emissions.length;i++)assert.ok(emissions[i].at-emissions[i-1].at>=Math.ceil(emissions[i-1].bytes/24000*1000));
 const over=bridge();over.Bridge.bind(async()=>JSON.stringify({ok:true,csv:'x'.repeat(128001)}));over.Bridge.receive(want('over'));await tick();assert.equal(collect(over.lines.join('\n'),'over').ok,false);
});

test('material-group CLI pagination and coloring share UI actions without changing solver or camera pose',async()=>{
 const {page:app,state,calls}=page();state.fragments={available:true,reason:'',sceneRevision:15,selected:-1,time:3,linkScale:1.5,method:'symmetric-smoothing-connectivity-v1',groupCount:10,particleCount:10,totalMassKg:10,singletonCount:10,singletonMassKg:10,largestMassFraction:.1,groups:Array.from({length:10},(_,i)=>({rank:i+1,anchor:i,count:1,massKg:1,massFraction:.1,centerKm:[i,0,0],velocityKmS:[0,0,0],rmsRadiusKm:0}))};
 const before=[app.yaw,app.pitch,app.zoom,app.focus,state.time];await app.execute('uiAction',{action:'color.6'});assert.equal(app.colorMode,6);assert.deepEqual([app.yaw,app.pitch,app.zoom,app.focus,state.time],before);assert.equal(calls.some(c=>c[0]==='start'),false);
 await app.execute('uiAction',{action:'fragments.next'});assert.equal(app.fragmentOffset,8);assert.equal(app.fragments.groups.length,2);assert.equal(app.fragments.groups[0].rank,9);await app.execute('uiAction',{action:'fragments.previous'});assert.equal(app.fragmentOffset,0);
 const result=JSON.parse(await app.execute('getSphFragments',{offset:4,limit:3}));assert.equal(result.fragments.groups[0].rank,5);assert.equal(result.fragments.groups.length,3);assert.equal(app.fragmentOffset,0);
 for(const payload of [{offset:-1},{limit:33},{offset:.5},{limit:0}])await assert.rejects(app.execute('getSphFragments',payload));
 await app.execute('uiAction',{action:'fragments.next'});state.fragments.sceneRevision++;await app.execute('getUiState',{});assert.equal(app.fragmentOffset,0);
 state.fragments.available=false;await assert.rejects(app.execute('uiAction',{action:'color.6'}));assert.equal(JSON.parse(await app.execute('getSphFragments',{})).fragments.available,false);
});

test('material follow actions keep particle identity, preserve camera and reject stale scene requests',async()=>{
 const {page:app,state,calls}=page();state.fragments={available:true,sceneRevision:23,particleCount:8,groupCount:2,groups:[{anchor:3,rank:1,count:5},{anchor:0,rank:2,count:3}]};
 const pose=[app.yaw,app.pitch,app.zoom,app.focus,state.time];await app.execute('uiAction',{action:'fragments.largest'});assert.deepEqual(calls.at(-1),['follow',3,23]);assert.deepEqual([app.yaw,app.pitch,app.zoom,app.focus,state.time],pose);
 await app.execute('uiAction',{action:'fragments.follow.0'});assert.equal(JSON.parse(await app.execute('getSphFragmentFollow')).follow.seed,0);
 for(const payload of [{particle:0,sceneRevision:22},{particle:-1,sceneRevision:23},{particle:1.5,sceneRevision:23},{particle:8,sceneRevision:23}])await assert.rejects(app.execute('followSphFragment',payload));assert.equal(state.follow.seed,0);
 await app.execute('uiAction',{action:'color.6'});assert.equal(state.follow.seed,0);await app.execute('uiAction',{action:'camera.out'});assert.equal(state.follow.seed,0);
 await app.execute('uiAction',{action:'fragments.stop'});assert.equal(state.follow.active,false);await app.execute('uiAction',{action:'fragments.largest'});await app.execute('uiAction',{action:'focus.all'});assert.equal(state.follow.active,false);
 await app.execute('uiAction',{action:'fragments.largest'});app.panelOpen=false;assert.equal(app.onBackPress(),true);assert.equal(state.follow.active,false);
 assert.equal(calls.some(c=>c[0]==='start'||c[0]==='seek'),false);
});


test('main viewport placement uses the presented plane, aim velocity and one cancellable transaction',async()=>{
 const {page:app,calls,state}=page();app.choose(5);state.state='paused';state.selected=4;
 const before=JSON.stringify(app.definition()),starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'orbit.add'});assert.equal(app.panelOpen,false);assert.equal(state.placementPreview.candidate,4);
 state.placementPoint=[2.25,60];await app.execute('setViewportPlacementPoint',{x:.62,y:.36});
 assert.equal(Number(app.placementFields[1]),2.25);assert.equal(app.placementFields[2],'60.000000');assert.deepEqual(calls.filter(c=>c[0]==='viewportPlacement').at(-1),['viewportPlacement',.62,.36,0]);
 await assert.rejects(app.execute('pickBody',{x:.5,y:.5}));
 await app.execute('uiAction',{action:'placement.target.1'});let preview=app.placementPreview(),b=preview.body,t=app.orbitBodies[1],star=app.orbitBodies[0];
 let d=[t.xAU-b.xAU,t.yAU-b.yAU,t.zAU-b.zAU],v=[b.vxKmS-star.vxKmS,b.vyKmS-star.vyKmS,b.vzKmS-star.vzKmS];
 assert.ok(d.reduce((sum,x,i)=>sum+x*v[i],0)>0);assert.ok(Math.hypot(d[1]*v[2]-d[2]*v[1],d[2]*v[0]-d[0]*v[2],d[0]*v[1]-d[1]*v[0])<1e-10);assert.equal(preview.orbitPath,'');
 await app.execute('uiAction',{action:'placement.options'});assert.equal(app.panelOpen,true);await app.execute('uiAction',{action:'placement.options'});assert.equal(app.panelOpen,false);
 await app.execute('setUiValue',{field:'placement.value.1',value:''});assert.equal(state.placementPreview.candidate,-1);assert.equal(state.placementPreview.bodies.length,4);
 await app.execute('uiAction',{action:'placement.cancel'});assert.equal(state.placementPreview.bodies.length,0);assert.equal(JSON.stringify(app.definition()),before);assert.equal(state.selected,4);assert.equal(calls.filter(c=>c[0]==='start').length,starts);
 await app.execute('uiAction',{action:'orbit.add'});await app.execute('uiAction',{action:'placement.target.2'});const candidate=JSON.stringify(app.placementPreview().body);
 await app.execute('uiAction',{action:'placement.confirm'});assert.deepEqual(JSON.parse(JSON.stringify(app.orbitBodies.at(-1))),JSON.parse(candidate));assert.equal(state.placementPreview.bodies.length,0);
});
test('placement pauses a live solver and replay playback then resumes only on cancellation',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='running';app.playing=true;
 app.beginPlacement();assert.equal(state.state,'paused');assert.equal(app.playing,false);app.cancelPlacement();assert.equal(state.state,'running');assert.equal(app.playing,true);
 state.state='paused';app.playing=false;app.beginPlacement();app.cancelPlacement();assert.equal(state.state,'paused');assert.equal(app.playing,false);
});


test('galaxy UI/CLI uses an independent model, validates atomically and retains recipes',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.galaxy-tails'});state.state='paused';
 const initial=app.definition();assert.equal(initial.model,'galaxy-tidal-restricted-v1');assert.equal(initial.config.duration,600);assert.equal(app.zoom,5.2);
 let ui=JSON.parse(await app.execute('getUiState',{}));assert.equal(ui.actions.find(a=>a.id==='surface.toggle').enabled,false);assert.equal(ui.actions.find(a=>a.id==='color.2').enabled,false);assert.equal(ui.fields.find(f=>f.field==='scene.count').enabled,true);
 await assert.rejects(app.execute('setScene',{...initial.config,galaxyMassRatio:0}));assert.deepEqual(app.definition(),initial);
 await assert.rejects(app.execute('setScene',{...initial.config,preset:3,duration:1}));assert.deepEqual(app.definition(),initial);
 await assert.rejects(app.execute('setScene',{...initial.config,galaxyRetrograde:1}));assert.deepEqual(app.definition(),initial);
 await assert.rejects(app.execute('navigateCamera',{focus:1,closeup:true}));assert.deepEqual(app.definition(),initial);
 await app.execute('uiAction',{action:'theme.compare'});assert.deepEqual(JSON.parse(JSON.stringify(app.config())),{...initial.config,galaxyRetrograde:true});
 const starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('setUiValue',{field:'galaxy.offset',value:20});await app.execute('setUiValue',{field:'galaxy.ratio',value:.4});await app.execute('setUiValue',{field:'scene.angle',value:60});await app.execute('setUiValue',{field:'scene.duration',value:800});
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);assert.equal(app.dirty,true);
 const saved=await app.execute('saveProject',{title:'潮汐对照'});const id=JSON.parse(saved).id;await app.execute('uiAction',{action:'preset.3'});await app.execute('loadProject',{id});
 assert.equal(app.config().galaxyOffsetKpc,20);assert.equal(app.config().galaxyMassRatio,.4);assert.equal(app.config().galaxyRetrograde,true);assert.equal(app.config().duration,800);
 await app.execute('uiAction',{action:'focus.1'});assert.equal(app.focus,1);assert.equal(app.closeup,false);
 state.galaxy={separationKpc:12,primaryRmsKpc:4,secondaryRmsKpc:3,primaryOuterFraction:.2,secondaryOuterFraction:.3};state.timeUnit='Myr';
 const diag=JSON.parse(await app.execute('getGalaxyDiagnostics',{}));assert.equal(diag.timeUnit,'Myr');assert.equal(diag.diagnostics.separationKpc,12);
});


test('time labels render for every model without recursion or unit leakage',()=>{
 const {page:app}=page();for(let preset=0;preset<=6;preset++){app.preset=preset;assert.equal(app.timeLabel(),preset===6?' Myr':preset>=3?' 年':' s');}
});


test('galaxy offset preview keeps draft and history, cancels camera, commits only after native acceptance',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.galaxy-tails'});state.state='paused';state.frames=20;state.time=76;state.selected=19;
 app.galaxyOffsetKpc=13;app.dirty=true;app.yaw=.4;app.pitch=.2;app.zoom=4;app.focus=1;app.setPanel(0);
 const definition=JSON.stringify(app.definition()),camera=JSON.stringify(JSON.parse(app.snapshot()).camera),startCount=()=>calls.filter(c=>c[0]==='start').length,before=startCount();
 await app.execute('uiAction',{action:'galaxy.place'});assert.equal(app.galaxyPlacing,true);assert.equal(state.time,76);assert.equal(startCount(),before);
 await app.execute('setUiValue',{field:'galaxy.placement.offset',value:24});assert.equal(app.galaxyPlacementOffset,24);assert.equal(JSON.stringify(app.definition()),definition);
 await assert.rejects(app.execute('setUiValue',{field:'galaxy.placement.offset',value:31}));assert.equal(app.galaxyPlacementOffset,24);
 await assert.rejects(app.execute('setScene',{preset:3,count:200,speed:1,angle:0,duration:1}));await assert.rejects(app.execute('uiAction',{action:'replay.latest'}));
 await app.execute('setGalaxyPlacementPoint',{x:.7,y:.3});assert.equal(app.galaxyPlacementOffset,22);
 await app.execute('uiAction',{action:'galaxy.place.cancel'});assert.equal(app.galaxyPlacing,false);assert.equal(JSON.stringify(app.definition()),definition);assert.equal(JSON.stringify(JSON.parse(app.snapshot()).camera),camera);assert.equal(app.dirty,true);assert.equal(app.panelOpen,true);assert.equal(startCount(),before);assert.equal(state.selected,19);
 await app.execute('uiAction',{action:'galaxy.place'});await app.execute('setUiValue',{field:'galaxy.placement.offset',value:18});state.rejectStart=true;
 await assert.rejects(app.execute('uiAction',{action:'galaxy.place.confirm'}));assert.equal(app.galaxyPlacing,true);assert.equal(JSON.stringify(app.definition()),definition);
 state.rejectStart=false;await app.execute('uiAction',{action:'galaxy.place.confirm'});assert.equal(app.galaxyPlacing,false);assert.equal(app.galaxyOffsetKpc,18);assert.equal(app.dirty,false);assert.equal(startCount(),before+1);
});
test('galaxy preview cancellation resumes prior running state and blocks unrelated inputs',async()=>{
 const {page:app,state}=page();app.choose(6);state.state='running';state.frames=2;app.info={...state};app.playing=false;
 await app.execute('uiAction',{action:'galaxy.place'});assert.equal(state.state,'paused');
 await assert.rejects(app.execute('setUiValue',{field:'galaxy.ratio',value:.8}));await assert.rejects(app.execute('setCamera',{yaw:0}));
 await app.execute('uiAction',{action:'ui.back'});assert.equal(state.state,'running');assert.equal(app.galaxyPlacing,false);
});
test('galaxy placement leaves offset unchanged for two-finger input while one-finger drag still updates',async()=>{
 const {page:app,state}=page();app.choose(6);state.state='paused';state.frames=1;app.info={...state};await app.execute('uiAction',{action:'galaxy.place'});app.viewportWidth=800;app.viewportHeight=600;
 const original=app.galaxyPlacementOffset;app.dragGalaxyPlacement({fingerList:[{localX:400,localY:300},{localX:500,localY:300}]});assert.equal(app.galaxyPlacementOffset,original);
 app.dragGalaxyPlacement({fingerList:[{localX:400,localY:300}]});assert.equal(app.galaxyPlacementOffset,22);
});

test('galaxy reference actions use applied snapshot, survive scene changes, and preserve old data on I/O failure',async()=>{
 const {page:app,state,calls}=page();app.preset=6;app.speed=1;app.duration=800;app.title='顺行参照';
 state.galaxyObservation={available:true,sceneRevision:7,selected:1,parameters:{count:1600,seed:1234,speed:1,inclination:25,duration:800,massRatio:.6,offset:12,retrograde:false},samples:[{frame:0,time:0,values:[60,8,7,0,0],energyError:0,angularError:0},{frame:1,time:4,values:[59,9,8,.1,.2],energyError:0,angularError:0}]};
 app.galaxyOffsetKpc=30;app.dirty=true;await app.execute('uiAction',{action:'galaxy.reference.capture'});
 const original=JSON.parse(await app.execute('getGalaxyReference',{})).reference;assert.equal(original.data.parameters.offset,12);assert.equal(app.dirty,true);assert.equal(calls.length,0);
 state.galaxyObservation.parameters.retrograde=true;state.galaxyObservation.samples[1].values[4]=.3;
 const comparison=JSON.parse(await app.execute('getGalaxyComparison',{}));assert.deepEqual(comparison.differences,['次盘自转：顺行 → 逆行']);assert.equal(comparison.chart.referenceVisible,true);
 const raw=JSON.parse(await app.execute('getGalaxyComparisonTable',{}));assert.equal(raw.rows,4);assert.equal(raw.csv.trim().split('\n')[0].split(',').length,19);
 await app.execute('uiAction',{action:'galaxy.reference.toggle'});assert.equal(JSON.parse(await app.execute('getGalaxyComparison',{})).chart.referenceVisible,false);assert.equal(JSON.parse(await app.execute('getGalaxyComparisonTable',{})).csv,raw.csv);
 state.rejectGalaxySave=true;await assert.rejects(app.execute('uiAction',{action:'galaxy.reference.capture'}));assert.deepEqual(JSON.parse(await app.execute('getGalaxyReference',{})).reference,original);state.rejectGalaxySave=false;
 state.rejectGalaxyClear=true;await assert.rejects(app.execute('uiAction',{action:'galaxy.reference.clear'}));assert.deepEqual(JSON.parse(await app.execute('getGalaxyReference',{})).reference,original);state.rejectGalaxyClear=false;
 app.galaxyReference=undefined;await app.execute('uiAction',{action:'galaxy.reference.reload'});assert.deepEqual(JSON.parse(await app.execute('getGalaxyReference',{})).reference,original);
 app.preset=0;app.speed=2;app.duration=90;state.galaxyObservation={available:false,sceneRevision:8,selected:-1,samples:[]};await assert.rejects(app.execute('uiAction',{action:'galaxy.reference.capture'}));assert.equal(JSON.parse(await app.execute('getGalaxyComparisonTable',{})).rows,2);
 state.rejectGalaxyLoad=true;await assert.rejects(app.execute('uiAction',{action:'galaxy.reference.reload'}));assert.equal(app.galaxyReference,undefined);assert.match(app.galaxyReferenceError,/bad file/);state.rejectGalaxyLoad=false;
 await app.execute('uiAction',{action:'galaxy.reference.reload'});await app.execute('uiAction',{action:'galaxy.reference.clear'});assert.equal(JSON.parse(await app.execute('getGalaxyReference',{})).reference,null);assert.equal(calls.length,0);
});

function galaxyFixture(){return {available:true,sceneRevision:7,selected:1,parameters:{count:1600,seed:1234,speed:1,inclination:25,duration:800,massRatio:.6,offset:12,retrograde:false},samples:[{frame:0,time:0,values:[60,8,7,0,0],energyError:0,angularError:0},{frame:1,time:4,values:[59,9,8,.1,.2],energyError:0,angularError:0}]};}

test('galaxy sky shares semantic controls without restarting or seeking the simulation or altering the external camera',async()=>{
 const {page:app,state,calls}=page();await app.execute('uiAction',{action:'theme.galaxy-tails'});state.galaxyObservation=galaxyFixture();
 const before=JSON.parse(app.snapshot());calls.length=0;
 await app.execute('uiAction',{action:'galaxy.observer.space'});
 let observer=JSON.parse(await app.execute('getGalaxyObserver',{})).data;assert.equal(observer.mode,1);
 await app.execute('setUiValue',{field:'galaxy.observer.fov',value:65});
 await app.execute('setUiValue',{field:'galaxy.observer.yaw',value:-2});
 await app.execute('setUiValue',{field:'galaxy.observer.pitch',value:.7});
 await app.execute('uiAction',{action:'galaxy.observer.ground'});observer=JSON.parse(await app.execute('getGalaxyObserver',{})).data;
 assert.equal(observer.mode,2);assert.equal(observer.fov,65);assert.equal(observer.yaw,.2355);assert.equal(observer.pitch,.1);
 await app.execute('uiAction',{action:'galaxy.observer.primary'});assert.equal(state.observer.yaw,Math.PI);
 await app.execute('uiAction',{action:'ui.back'});assert.equal(state.observer.mode,0);
 const after=JSON.parse(app.snapshot());assert.deepEqual(after.camera,before.camera);assert.equal(after.simulation.time,before.simulation.time);assert.equal(after.simulation.frames,before.simulation.frames);
 assert.ok(!calls.some(c=>['start','pause','camera'].includes(c[0])));
});
test('galaxy sky rejects unsupported scenes and out-of-range fields without changing view',async()=>{
 const {page:app,state}=page();await assert.rejects(app.execute('uiAction',{action:'galaxy.observer.space'}));
 await app.execute('uiAction',{action:'theme.galaxy-tails'});state.galaxyObservation=galaxyFixture();await app.execute('uiAction',{action:'galaxy.observer.space'});
 const before=structuredClone(state.observer);
 for(const [field,value]of [['fov',121],['fov',0],['pitch',1.6],['yaw',101],['yaw',NaN]])await assert.rejects(app.execute('setUiValue',{field:'galaxy.observer.'+field,value}));
 assert.deepEqual(state.observer,before);await app.execute('uiAction',{action:'galaxy.observer.exit'});
 await assert.rejects(app.execute('setUiValue',{field:'galaxy.observer.fov',value:60}));
});

test('responsive galaxy UI/CLI shares draft flag, budget guard, scene identity and preview parameters',async()=>{
 const {page:app}=page();await app.execute('uiAction',{action:'theme.galaxy-tails'});
 await app.execute('uiAction',{action:'galaxy.responsive'});assert.equal(app.galaxyResponsive,true);assert.equal(app.count,800);assert.equal(app.dirty,true);
 assert.equal(app.definition().model,'galaxy-responsive-v1');assert.equal(app.config().galaxyResponsive,true);
 await assert.rejects(()=>app.execute('setUiValue',{field:'scene.count',value:801}));assert.equal(app.count,800);
 await app.execute('uiAction',{action:'galaxy.responsive'});assert.equal(app.definition().model,'galaxy-tidal-restricted-v1');assert.equal(app.config().galaxyResponsive,undefined);
 await app.execute('uiAction',{action:'theme.galaxy-responsive'});assert.equal(app.count,600);assert.equal(app.speed,.75);assert.equal(app.themeState().modified,false);
 await app.execute('uiAction',{action:'theme.compare'});assert.equal(app.galaxyResponsive,false);assert.equal(app.count,600);assert.equal(app.speed,.75);
 await app.execute('uiAction',{action:'preset.3'});await assert.rejects(()=>app.execute('uiAction',{action:'galaxy.responsive'}));
});

test('sandbox uses the current snapshot for insertion and switches stellar mass units without restarting',async()=>{
 const {page:app,state,calls}=page();app.choose(5);state.state='running';state.time=8.25;
 state.orbitState=structuredClone(app.orbitBodies);state.orbitState[0].xAU=12;state.orbitState[0].vxKmS=7;
 for(let i=1;i<state.orbitState.length;i++)state.orbitState[i].xAU+=12;
 const original=structuredClone(state.orbitState),time=state.time,starts=calls.filter(c=>c[0]==='start').length;
 await app.execute('uiAction',{action:'orbit.add'});assert.equal(app.placementWasRunning,true);assert.equal(state.state,'paused');
 await app.execute('uiAction',{action:'placement.surface.0'});let p=app.placementPreview();assert.equal(p.valid,true);assert.equal(p.body.massSolar,1);assert.equal(p.body.surface,0);assert.ok(p.body.xAU>12);
 await app.execute('uiAction',{action:'placement.still'});p=app.placementPreview();assert.equal(p.body.vxKmS,7);assert.equal(p.body.vyKmS,0);
 await app.execute('uiAction',{action:'placement.confirm'});assert.equal(state.state,'running');assert.equal(state.time,time);assert.deepEqual(state.orbitState.slice(0,4),original);
 assert.equal(calls.filter(c=>c[0]==='start').length,starts);assert.equal(app.surfaces[4].seed,0);
 await app.execute('uiAction',{action:'time.rate.10'});assert.equal(state.daysPerSecond,10);assert.equal(state.time,time);assert.equal(app.orbitDays,10);
});

test('all orbit presets expose add-body and clock actions and share continuous start/pause controls',async()=>{
 const {page:app,state,calls}=page();app.choose(4);state.state='paused';app.info={...state,orbitState:app.orbitBodies};
 const ui=JSON.parse(await app.execute('getUiState'));assert.equal(ui.actions.find(a=>a.id==='orbit.add').enabled,true);
 await app.execute('uiAction',{action:'simulation.toggle'});assert.equal(state.continuous,true);assert.equal(state.state,'running');
 await app.execute('uiAction',{action:'simulation.toggle'});assert.equal(state.state,'paused');
 assert.ok(calls.some(c=>c[0]==='clock'));assert.equal(calls.filter(c=>c[0]==='start').length,1);
});


test('selected-planet satellite, drop and launch use the moving parent and cancel without changing the system',async()=>{
 const {page:app,state,calls}=page();app.choose(5);state.state='paused';app.focusBody(1);
 state.orbitState=structuredClone(app.orbitBodies);state.orbitState[1].vxKmS=8;state.orbitState[1].vzKmS=-2;
 const before=JSON.stringify(state.orbitState),t=state.time;
 for(const mode of ['satellite','drop','launch']) {
  await app.execute('uiAction',{action:'selection.'+mode});
  const p=app.placementPreview(),host=state.orbitState[1];assert.equal(p.valid,true,p.error);assert.equal(app.placementParent,1);assert.equal(app.placementPromotesContact,true);
  const d=[p.body.xAU-host.xAU,p.body.yAU-host.yAU,p.body.zAU-host.zAU],v=[p.body.vxKmS-host.vxKmS,p.body.vyKmS-host.vyKmS,p.body.vzKmS-host.vzKmS];
  if(mode==='satellite'){assert.ok(Math.abs(d.reduce((n,x,i)=>n+x*v[i],0))<1e-12);assert.ok(Math.abs(Math.hypot(...v)-p.circularKmS)<1e-10);}
  if(mode==='drop')assert.equal(Math.hypot(...v),0);
  if(mode==='launch'){assert.equal(app.placementTarget,1);assert.ok(d.reduce((n,x,i)=>n+x*v[i],0)<0);assert.ok(Math.abs(d[0]*v[1]-d[1]*v[0])<1e-12);}
  const fields=JSON.parse(await app.execute('getUiState',{})).fields;assert.ok(fields.some(f=>f.field==='placement.value.5'&&f.enabled));
  await app.execute('uiAction',{action:'placement.cancel'});assert.equal(JSON.stringify(state.orbitState),before);assert.equal(app.focus,1);assert.equal(state.time,t);
 }
 await app.execute('uiAction',{action:'selection.satellite'});const expected=structuredClone(app.placementPreview().body);
 await app.execute('uiAction',{action:'placement.confirm'});assert.equal(state.orbitState.length,5);assert.equal(state.time,t);
 assert.equal(JSON.stringify(state.orbitState[4]),JSON.stringify(expected));
 for(let i=0;i<4;i++){const b={...state.orbitState[i]};delete b.radiusKm;assert.equal(JSON.stringify(b),JSON.stringify(JSON.parse(before)[i]));}
 assert.equal(calls.filter(c=>c[0]==='insert').length,1);
});

test('local satellite preview rejects physical overlap and failed insertion stays cancellable',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';app.focusBody(2);const original=JSON.stringify(state.orbitState??app.orbitBodies);
 await app.execute('uiAction',{action:'selection.satellite'});
 await app.execute('setUiValue',{field:'placement.value.1',value:'0.000001'});assert.equal(app.placementPreview().valid,false);
 await assert.rejects(app.execute('uiAction',{action:'placement.confirm'}));
 await app.execute('setUiValue',{field:'placement.value.1',value:'300000'});assert.equal(app.placementPreview().valid,true);
 state.rejectInsert=true;await assert.rejects(app.execute('uiAction',{action:'placement.confirm'}));assert.equal(app.placing,true);
 await app.execute('uiAction',{action:'placement.cancel'});assert.equal(JSON.stringify(state.orbitState??app.orbitBodies),original);
});

test('small rock physical units preserve the same candidate across unit switches and inherit host velocity',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';app.focusBody(1);
 state.orbitState=structuredClone(app.orbitBodies);state.orbitState[1].vxKmS=8;state.orbitState[1].vzKmS=-2;
 const initial=structuredClone(state.orbitState);
 await app.execute('uiAction',{action:'selection.launch'});
 assert.equal(app.placementUnits.distance,'altitude');assert.equal(app.placementUnits.speed,'kms');
 await app.execute('uiAction',{action:'placement.rock'});
 for(const [i,v] of [[1,'25000'],[2,'0'],[4,'10']])await app.execute('setUiValue',{field:'placement.value.'+i,value:v});
 const candidate=structuredClone(app.placementPreview().body),host=initial[1];assert.equal(app.placementPreview().valid,true,app.placementPreview().error);
 assert.equal(candidate.radiusKm,7.5);assert.ok(candidate.massSolar<1e-14);assert.ok(candidate.massSolar>1e-16);
 assert.ok(Math.abs((candidate.xAU-host.xAU)*149597870.7-31371)<1e-7);
 assert.ok(Math.abs(candidate.vxKmS-(host.vxKmS-10))<1e-12);assert.equal(candidate.vyKmS,host.vyKmS);assert.equal(candidate.vzKmS,host.vzKmS);
 for(const action of ['center','radius','astro','physical','diameter','altitude']){
  await app.execute('uiAction',{action:'placement.units.'+action});const p=app.placementPreview();assert.equal(p.valid,true,p.error);
  for(const key of ['massSolar','radiusKm','xAU','yAU','zAU','vxKmS','vyKmS','vzKmS'])assert.ok(Math.abs(p.body[key]-candidate[key])<=Math.max(1e-30,Math.abs(candidate[key])*2e-14),key);
 }
 await app.execute('setUiValue',{field:'placement.value.5',value:'30'});assert.equal(app.placementPreview().body.radiusKm,15);
 assert.ok(Math.abs(Number(app.placementFields[1])-25000)<1e-8);assert.ok(Math.abs(app.placementPreview().speedKmS-10)<1e-12);
 await app.execute('setUiValue',{field:'placement.value.1',value:'50000'});assert.ok(Math.abs(app.placementPreview().speedKmS-10)<1e-12);
 assert.deepEqual(state.orbitState,initial);await app.execute('uiAction',{action:'placement.confirm'});assert.equal(state.orbitState[4].radiusKm,15);
});

test('physical draft rejects invalid units inputs, does not reinterpret incomplete text, and keeps cancellation atomic',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';app.focusBody(1);const original=JSON.stringify(state.orbitState??app.orbitBodies);
 await app.execute('uiAction',{action:'selection.launch'});await app.execute('uiAction',{action:'placement.rock'});
 for(const [i,v] of [[0,'1'],[0,'NaN'],[1,'-1'],[1,'0'],[4,'101'],[5,'1']]){
  const old=app.placementFields[i];await app.execute('setUiValue',{field:'placement.value.'+i,value:v});assert.equal(app.placementPreview().valid,false);
  await assert.rejects(app.execute('uiAction',{action:'placement.confirm'}));await app.execute('setUiValue',{field:'placement.value.'+i,value:old});
 }
 await app.execute('setUiValue',{field:'placement.value.0',value:''});const fields=app.placementFields.slice(),units=JSON.stringify(app.placementUnits);
 await assert.rejects(app.execute('uiAction',{action:'placement.units.astro'}));assert.deepEqual(app.placementFields,fields);assert.equal(JSON.stringify(app.placementUnits),units);
 await app.execute('uiAction',{action:'placement.rock'});await app.execute('uiAction',{action:'placement.circular'});assert.ok(Math.abs(app.placementPreview().speedKmS/app.placementPreview().circularKmS-1)<1e-12);
 await app.execute('uiAction',{action:'placement.cancel'});assert.equal(JSON.stringify(state.orbitState??app.orbitBodies),original);
});

test('viewport placement respects selected altitude units and preserves an absolute launch speed',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';app.focusBody(1);
 await app.execute('uiAction',{action:'selection.launch'});await app.execute('uiAction',{action:'placement.rock'});
 await app.execute('setUiValue',{field:'placement.value.4',value:'10'});state.placementPoint=[31371/149597870.7,60];
 await app.execute('setViewportPlacementPoint',{x:.6,y:.4});assert.ok(Math.abs(Number(app.placementFields[1])-25000)<1e-8);assert.ok(Math.abs(app.placementPreview().speedKmS-10)<1e-12);
 const s=JSON.parse(app.snapshot());assert.equal(s.placement.units.distance,'altitude');assert.match(s.placement.labels[1],/表面/);
 await app.execute('uiAction',{action:'placement.surface.4'});await app.execute('uiAction',{action:'placement.confirm'});app.focusBody(4);
 assert.equal(app.canTrace(),false);await assert.rejects(app.execute('uiAction',{action:'trace.toggle'}));
});

test('adding a satellite to a small asteroid does not silently create a lunar-mass object',async()=>{
 const {page:app,state}=page();app.choose(5);state.state='paused';app.focusBody(1);
 await app.execute('uiAction',{action:'selection.drop'});await app.execute('uiAction',{action:'placement.rock'});await app.execute('uiAction',{action:'placement.confirm'});app.focusBody(4);
 const host=state.orbitState[4];await app.execute('uiAction',{action:'selection.satellite'});const p=app.placementPreview();assert.equal(p.valid,true,p.error);
 assert.ok(p.body.massSolar<host.massSolar*.02);assert.ok(p.body.radiusKm>=1);assert.ok(p.body.radiusKm<host.radiusKm);
});

test('lost reply chunks can be recovered without executing an insertion twice',async()=>{
 const {Bridge,lines}=bridge();let mutations=0;const result={ok:true,body:'small asteroid',payload:'物理状态'.repeat(300)};
 Bridge.bind(async()=>{mutations++;return JSON.stringify(result);});Bridge.receive(want('insert-once','uiAction','{"action":"placement.confirm"}'));await tick();
 const complete=lines.splice(0);const partial=complete.filter((_,i)=>i!==1);assert.equal(collect(partial.join('\n'),'insert-once'),undefined);
 Bridge.receive(want('insert-once','retryReply'));await tick();assert.deepEqual(collect(lines.join('\n'),'insert-once'),result);assert.equal(mutations,1);
 Bridge.receive(want('unknown-id','retryReply'));await tick();assert.equal(mutations,1);
 Bridge.receive(want('insert-once','uiAction','{"action":"placement.confirm"}'));await tick();assert.equal(mutations,1);
});
