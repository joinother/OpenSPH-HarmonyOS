import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {collect} from '../scripts/opensph-cli.mjs';
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
  assert.throws(()=>collect('SPHCLI a 0/129 {}','a'));
});

function page() {
  // Execute actual non-rendering page actions with a controlled native adapter.
  // This tests command transactions; it is not an ArkUI/device integration test.
  const original=readFileSync(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'utf8');
  const interfaces=original.slice(original.indexOf('interface SceneSettings'),original.indexOf('@Component'));
  const body=original.slice(original.indexOf('struct Index {')+'struct Index {'.length,original.indexOf('  @Builder\n  header()'));
  const transformed=(interfaces+'\nclass Index {'+body+'}\nexports.Index=Index;').replace(/@StorageLink\('[^']+'\)\s*/g,'').replace(/@Watch\('[^']+'\)\s*/g,'').replace(/@State\s*/g,'');
  let state={state:'paused',error:'',count:212,frames:5,selected:-1,time:1,duration:10,stepMs:5,steps:4,maxSpeed:5,meanDensity:2700};
  const calls=[],initialPauses=[];let trace={speedScale:1,rateHours:1,eccentricity:0,referenceXKm:76800,referenceYKm:0,innerApoapsisKm:76800,enabled:false,running:false,target:-1,timeHours:0,massSolar:.0002857,radiusKm:60000,count:192,innerPeriodHours:6,outerPeriodHours:14,model:'restricted-circular-kepler-v1'};
  const simulation={setRingParameters:(speedScale,rateHours)=>{if(speedScale!==trace.speedScale){trace.timeHours=0;trace.running=false;}trace.speedScale=speedScale;trace.rateHours=rateHours;trace.eccentricity=speedScale*speedScale-1;},ringTraceStatus:()=>({...trace}),configureRingTrace:(enabled,running,target,massSolar)=>{if(enabled&&(!trace.enabled||target!==trace.target||massSolar!==trace.massSolar)){trace.timeHours=0;trace.speedScale=1;trace.rateHours=1;}trace={...trace,enabled,running,target,massSolar};},seekRingTrace:seconds=>{trace.timeHours=seconds/3600;trace.running=false;},setComposition:()=>{},setSky:(mode,brightness)=>{state.sky={mode,brightness};},pickBody:()=>state.pick??-1,projectedScene:()=>({ready:true,bodies:[]}),setAppearance:()=>{},renderStatus:()=>({panoramaReady:state.panoramaReady??false,panoramaBlend:state.panoramaReady?1:0,ready:true,texturesReady:true,active:true,frames:1,submitMs:1,previewSeconds:0,error:''}),status:()=>({...state}),startScene:(c,initiallyPaused)=>{if(state.rejectStart)throw Error('native rejected scene');initialPauses.push(initiallyPaused);calls.push(['start',c.preset,c.count,c.speed,c.angle,c.duration]);state.state='preparing';},pause:v=>{calls.push(['pause',v]);if(state.state!=='preparing')state.state=v?'paused':'running';},setCamera:(...args)=>calls.push(['camera',...args]),seek:i=>state.selected=i,saveReplay:async()=>false,loadReplay:async()=>{if(state.loadReplayOK){state.state='replay';return true;}return false;}};
  const modelContext={exports:{}};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/SceneModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/WorkspaceLayout.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  modelContext.require=()=>modelContext.exports;
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/ExperimentCatalog.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,modelContext);
  const context={exports:{},...modelContext.exports,simulation,Scroller:class {scrollEdge(){}},Edge:{Top:0},Curve:{EaseOut:0},setInterval,clearInterval,console};
  vm.runInNewContext(ts.transpileModule(transformed,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  const page=new context.exports.Index();
  page.getUIContext=()=>({px2vp:v=>v,getHostContext:()=>({filesDir:'/mock'}),animateTo:(opts,apply)=>{apply();opts.onFinish?.();}});
  return {page,calls,state,initialPauses};
}
test('scene and camera reject partial invalid transactions without changing prior state',async()=>{
  const {page:app,calls}=page();
  const before=app.snapshot();
  await assert.rejects(app.execute('setScene',{preset:1,count:300,speed:20,angle:40,duration:10}));
  await assert.rejects(app.execute('setCamera',{yaw:1,pitch:0,zoom:3,focus:4,color:1}));
  assert.equal(app.snapshot(),before);assert.equal(calls.length,0);
  await app.execute('setScene',{preset:1,count:200,speed:6,angle:40,duration:10});
  assert.deepEqual(calls[0],['start',1,200,6,40,10]);
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
  app.focus=3;app.closeup=true;app.beginPlacement();app.confirmPlacement();assert.equal(app.orbitBodies.length,5);assert.equal(app.focus,-1);assert.equal(app.closeup,false);
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
  const builders=source.slice(source.indexOf('  @Builder\n  header()'));
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
 await app.execute('uiAction',{action:'placement.confirm'});assert.equal(app.placing,false);assert.equal(app.orbitBodies.length,5);assert.deepEqual(JSON.parse(JSON.stringify(app.orbitBodies[4])),preview.body);assert.equal(calls.filter(c=>c[0]==='start').length,start+1);
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
 app.placementFields=['1','1','0','0','1'];app.orbitBodies[0].xAU=0;app.orbitBodies[0].vxKmS=0;assert.equal(app.placementPreview().valid,false);assert.match(app.placementPreview().error,/间距/);
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

test('placement confirm is one undoable transaction, cancel is none, and draft discard leaves replay intact',async()=>{
 const {page:app,calls,state}=page();app.choose(5);state.state='paused';
 app.setUiValue('orbit.name','保留草稿');app.beginPlacement();app.cancelPlacement();assert.equal(app.editHistory().undoCount,0);
 app.beginPlacement();app.placementName='候选一';app.confirmPlacement();assert.equal(app.editHistory().undoCount,1);
 const added=JSON.stringify(app.orbitBodies);app.travelOrbitHistory(false);assert.equal(app.orbitBodies.length,4);assert.equal(app.orbitName,'保留草稿');assert.equal(app.placing,false);
 app.travelOrbitHistory(true);assert.equal(JSON.stringify(app.orbitBodies),added);assert.equal(app.placing,false);assert.equal(app.bodyDrafts()[0].name,'保留草稿');
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
  const catalog=JSON.parse(await app.execute('listExperiments',{}));assert.equal(catalog.catalogVersion,1);assert.equal(catalog.experiments.length,9);
  const [slow,fast]=catalog.experiments;assert.equal(slow.config.speed,2);assert.equal(fast.config.speed,8);
  assert.deepEqual({...slow.config,speed:8},fast.config);
  assert.ok(catalog.experiments.every(t=>t.goal&&t.limit&&t.question));
  slow.config.seed=999;assert.equal(JSON.parse(await app.execute('listExperiments',{})).experiments[0].config.seed,1234);
  for(const t of catalog.experiments){await app.execute('uiAction',{action:'theme.'+t.id});assert.equal(app.themeState().id,t.id);assert.equal(app.themeState().modified,false);assert.equal(app.panelOpen,false);assert.equal(app.colorMode,0);}
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
  await assert.rejects(app.execute('uiAction',{action:'orbit.surface.5'}));
  assert.deepEqual(JSON.parse(app.snapshot()).camera,before.camera);assert.deepEqual(JSON.parse(app.snapshot()).definition.config,before.definition.config);
  assert.equal(calls.filter(c=>c[0]==='start').length,starts);
});
test('ring style survives placement, edit history and serialized scene reload',async()=>{
  const {page:app,state}=page();app.choose(5);state.state='paused';
  await app.execute('uiAction',{action:'orbit.add'});await app.execute('uiAction',{action:'placement.surface.4'});
  assert.equal(app.placementPreview().valid,true);assert.equal(app.placementPreview().body.surface,4);
  await app.execute('uiAction',{action:'placement.confirm'});state.state='paused';
  assert.equal(app.orbitBodies[4].surface,4);
  await app.execute('uiAction',{action:'orbit.undo'});state.state='paused';assert.equal(app.orbitBodies.length,4);
  await app.execute('uiAction',{action:'orbit.redo'});state.state='paused';assert.equal(app.orbitBodies[4].surface,4);
  const saved=JSON.parse(JSON.stringify(app.definition()));await app.execute('setScene',saved.config);state.state='paused';
  assert.equal(app.orbitBodies[4].surface,4);
  const before=app.snapshot();saved.config.orbitBodies[4].surface=5;await assert.rejects(app.execute('setScene',saved.config));assert.equal(app.snapshot(),before);
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
 for(let i=1;i<emissions.length;i++)assert.ok(emissions[i].at-emissions[i-1].at>=emissions[i-1].bytes/24-1,'unpaced chunk burst');
 Bridge.bind(async()=>JSON.stringify({ok:true,text:'a'.repeat(65000)}));Bridge.receive(want('oversize'));await tick();assert.equal(collect(lines.join('\n'),'oversize').ok,false);
});
