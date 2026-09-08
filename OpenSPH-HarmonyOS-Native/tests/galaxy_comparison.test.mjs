import assert from 'node:assert/strict';import {test} from 'node:test';import * as fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const compile=file=>ts.transpileModule(fs.readFileSync(new URL('../entry/src/main/ets/common/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ctx={exports:{}};ctx.require=()=>ctx.exports;for(const f of ['SceneModel.ets','ObservationModel.ets','GalaxyObservationModel.ets','GalaxyComparison.ets'])vm.runInNewContext('(function(){'+compile(f)+'})()',ctx);const m=ctx.exports,plain=x=>JSON.parse(JSON.stringify(x));
const data=(times=[0,4,8],values=[2,4,8])=>({available:true,sceneRevision:7,selected:-1,parameters:{count:1600,seed:1234,speed:1,inclination:25,duration:800,massRatio:.6,offset:12,retrograde:false},samples:times.map((time,frame)=>({frame,time,values:[values[frame],8,7,values[frame]/100,values[frame]/100],energyError:0,angularError:0}))});
const reference=()=>({schemaVersion:1,capturedAt:123456,title:'潮汐 · 🌌',model:'galaxy-tidal-restricted-v1',data:data()});
test('shared axes retain original extrema and current Myr selection; only cursor reference is interpolated',()=>{
 const current=data([0,2,6],[3,6,7]),ref=data(),before=JSON.stringify([current,ref]);current.selected=1;
 const c=m.galaxyComparisonPlot(current,0,ref);assert.equal(c.referenceVisible,true);assert.equal(c.plot.firstTime,0);assert.equal(c.plot.lastTime,8);assert.equal(c.referenceValue,3);assert.equal(c.delta,3);assert.equal(c.plot.minTime,0);assert.equal(c.plot.maxTime,6);assert.match(c.plot.path,/L60 /);assert.match(c.referencePath,/L120 /);assert.equal(c.plot.currentTime,2);
 for(let metric=0;metric<5;metric++){const p=m.galaxyComparisonPlot(current,metric,ref);assert.equal(p.referenceVisible,true);assert.equal(p.plot.unit,metric>=3?'%':'kpc');}
 assert.equal(m.galaxyComparisonPlot(current,4,ref).delta,3);current.selected=-1;assert.equal(JSON.stringify([current,ref]),before);
});
test('comparison does not extrapolate; absent, partial, constant and disjoint series remain explicit',()=>{
 const c=m.galaxyComparisonPlot(data([0,4,12]),0,data());assert.equal(c.deltaReady,false);assert.equal(c.delta,undefined);assert.match(c.reason,/超出/);
 const d=m.galaxyComparisonPlot(data([12,16,20]),0,data());assert.equal(d.overlap,false);assert.equal(d.deltaReady,false);
 const empty={available:false,sceneRevision:8,selected:-1,samples:[]};assert.equal(m.galaxyComparisonPlot(empty,0,data()).referenceVisible,false);
 const single=m.galaxyComparisonPlot(data([0],[2]),0,data());assert.equal(single.referenceValue,2);assert.equal(single.delta,0);assert.doesNotMatch(single.plot.path,/NaN|Infinity/);
 assert.doesNotMatch(m.galaxyComparisonPlot(data([0,4,8],[2,2,2]),0,data([0,4,8],[2,2,2])).referencePath,/NaN|Infinity/);
});
test('reference validation rejects damaged identity, vectors, parameters, time and unavailable datasets; copy is isolated',()=>{
 const r=reference(),copy=m.copyGalaxyReference(r);r.data.samples[1].values[0]=100;assert.equal(copy.data.samples[1].values[0],4);
 for(const change of [r=>r.schemaVersion=2,r=>r.model='sph-rock-v1',r=>r.title='',r=>r.capturedAt=-1,r=>r.data=null,r=>r.data.available=0,r=>r.data.samples=null,r=>r.data.samples[1]=null,r=>r.data.samples[1].values=null,r=>r.data.samples[1].values[3]=2,r=>r.data.samples[1].time=0,r=>r.data.samples[1].angularError=Infinity,r=>r.data.samples[0].frame=1,r=>r.data.samples.pop()&&r.data.samples.pop(),r=>r.data.selected=3,r=>r.data.selected=-2,r=>r.data.sceneRevision=NaN,r=>r.data.parameters.count=2401,r=>r.data.parameters.retrograde=1,r=>r.data.parameters.offset=31,r=>r.data.parameters=undefined,r=>r.data.samples=Array(241).fill(r.data.samples[0])]){const bad=reference();change(bad);assert.throws(()=>m.validateGalaxyReference(bad));}
});
test('parameter differences track all eight applied inputs including tracer budget and disk rotation',()=>{
 const a=data(),b=data();b.parameters={count:200,seed:42,speed:.75,inclination:0,duration:50,massRatio:.2,offset:0,retrograde:true};const differences=m.galaxyParameterDifferences(b,a);assert.equal(differences.length,8);assert.match(differences[0],/1600 → 200/);assert.match(differences[7],/顺行 → 逆行/);assert.deepEqual(plain(m.galaxyParameterDifferences(a,a)),[]);
});
test('CSV keeps both unresampled series, every applied parameter, fractions and all 402 rows',()=>{
 const a=data([0,2,6]),b=data();b.parameters.retrograde=true;const csv=m.galaxyComparisonCsv(a,b),rows=csv.trim().split('\n').map(r=>r.split(','));assert.equal(rows.length,7);assert.ok(rows.every(r=>r.length===19));assert.equal(+rows[2][11],2);assert.equal(+rows[2][16],.04);assert.equal(rows[4][0],'reference');assert.equal(+rows[4][8],1);assert.equal(+rows[4][11],0);
 const full=data(Array.from({length:201},(_,i)=>i*4),Array(201).fill(2));assert.equal(m.galaxyComparisonCsv(full,full).trim().split('\n').length,403);
 const empty={available:false,sceneRevision:8,selected:-1,samples:[]};assert.equal(m.galaxyComparisonCsv(empty,b).trim().split('\n').length,4);assert.equal(m.galaxyComparisonCsv(empty).trim().split('\n').length,1);
});
function store(faults={}){
 const adapter={accessSync:fs.existsSync,statSync:fs.statSync,readTextSync:p=>fs.readFileSync(p,'utf8'),OpenMode:{CREATE:0,READ_WRITE:0,TRUNC:0},openSync:p=>({fd:fs.openSync(p,'w')}),writeSync:(fd,text)=>{if(faults.partial)return fs.writeSync(fd,text.slice(0,10));return fs.writeSync(fd,text);},fsyncSync:fd=>{if(faults.sync)throw Error('sync failure');fs.fsyncSync(fd);},closeSync:fs.closeSync,renameSync:(a,b)=>{if(faults.rename)throw Error('rename failure');fs.renameSync(a,b);},unlinkSync:p=>{if(faults.remove)throw Error('remove failure');fs.unlinkSync(p);}};
 const c={exports:{},require:n=>n==='@kit.CoreFileKit'?{fileIo:adapter}:m};vm.runInNewContext(compile('GalaxyComparisonStore.ets'),c);return c.exports.GalaxyComparisonStore;
}
test('reference storage survives cold reads, replacement and removal without altering other experiments',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'galaxy-reference-'));try{
  const S=store(),r=reference();assert.equal(S.load(dir),undefined);fs.writeFileSync(join(dir,'project-1-1.json'),'unrelated');S.save(dir,r);assert.deepEqual(plain(store().load(dir)),r);
  r.title='另一次对照';r.data.parameters.speed=1;S.save(dir,r);assert.equal(S.load(dir).title,r.title);assert.deepEqual(fs.readdirSync(dir).sort(),['galaxy-reference.json','project-1-1.json']);S.clear(dir);assert.equal(S.load(dir),undefined);assert.equal(fs.readFileSync(join(dir,'project-1-1.json'),'utf8'),'unrelated');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('partial write, flush and rename failures preserve old reference and clean temporary files',()=>{
 for(const stage of ['partial','sync','rename']){const dir=fs.mkdtempSync(join(tmpdir(),'galaxy-reference-fail-'));try{
  const r=reference();store().save(dir,r);const path=join(dir,'galaxy-reference.json'),before=fs.readFileSync(path);r.title='不应提交';assert.throws(()=>store({[stage]:true}).save(dir,r));assert.deepEqual(fs.readFileSync(path),before);assert.deepEqual(fs.readdirSync(dir),['galaxy-reference.json']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}}
});
test('bad or oversized files stay intact for recovery; failed clear preserves reference',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'galaxy-reference-bad-'));try{
  const path=join(dir,'galaxy-reference.json');for(const text of ['{bad',JSON.stringify({...reference(),schemaVersion:2}),' '.repeat(131073)]){fs.writeFileSync(path,text);assert.throws(()=>store().load(dir));assert.equal(fs.readFileSync(path,'utf8'),text);}
  store().save(dir,reference());assert.throws(()=>store({remove:true}).clear(dir));assert.ok(store().load(dir));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('extreme finite records cannot create nonfinite shared paths',()=>{
 const a=data(),b=data();a.samples[1].values[0]=1e308;const c=m.galaxyComparisonPlot(a,0,b);assert.equal(c.referenceVisible,true);assert.doesNotMatch(c.plot.path+c.referencePath,/Infinity|NaN/);a.samples[1].values[0]=Number.MAX_VALUE;const d=m.galaxyComparisonPlot(a,0,b);assert.equal(d.referenceVisible,false);assert.equal(d.plot.available,false);assert.equal(d.plot.path,'');
});
