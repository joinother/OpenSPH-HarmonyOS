import {exportTable} from '../scripts/export-sph-comparison.mjs';
import assert from 'node:assert/strict';import {test} from 'node:test';import * as fs from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const compile=file=>ts.transpileModule(fs.readFileSync(new URL('../entry/src/main/ets/common/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ctx={exports:{}};ctx.require=()=>ctx.exports;for(const f of ['SceneModel.ets','SphObservationModel.ets','SphComparison.ets'])vm.runInNewContext(compile(f),ctx);const m=ctx.exports,plain=x=>JSON.parse(JSON.stringify(x));
const data=(times=[0,1,4],values=[2,4,8])=>({sceneRevision:7,selected:-1,samples:times.map((time,i)=>({frame:i,time,values:[-3,values[i],0,0,5,2,.1,.5,20,30],structure:[-100,values[i]*10,80+i,-values[i]]}))});
const reference=()=>({schemaVersion:1,capturedAt:123456,title:'岩球 · 🌍',model:'sph-rock-gravity-v1',particleCount:210,config:{preset:2,count:200,speed:0,angle:0,duration:32,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,selfGravity:true},data:data()});
test('SPH reference shared axes preserve seconds, selection and extrema; interpolate only for cursor display',()=>{
 const live=data([1,2,3],[3,6,7]),ref=data(),before=JSON.stringify([live,ref]);live.selected=1;
 const c=m.sphComparisonPlot(live,'pressure',ref);assert.equal(c.referenceVisible,true);assert.equal(c.plot.firstTime,0);assert.equal(c.plot.lastTime,4);assert.ok(Math.abs(c.referenceValue-16/3)<1e-12);assert.ok(Math.abs(c.delta-2/3)<1e-12);assert.equal(c.plot.maxTime,3);assert.match(c.plot.path,/^M60 /);assert.match(c.referencePath,/^M0 /);
 live.selected=-1;assert.equal(JSON.stringify([live,ref]),before);
 for(const metric of ['pressure','internal','damage','kinetic','energy','gravity','relativeKinetic','radius','radial'])assert.equal(m.sphComparisonPlot(live,metric,ref).referenceVisible,true);
});
test('SPH comparisons disclose disjoint ranges, missing legacy fields and overflowing shared axes',()=>{
 const c=m.sphComparisonPlot(data([5,6,7]),'pressure',data());assert.equal(c.overlap,false);assert.equal(c.deltaReady,false);assert.equal(c.delta,undefined);assert.equal(c.referenceValue,undefined);
 const old=data();old.samples.forEach(s=>delete s.structure);assert.equal(m.sphComparisonPlot(data(),'radius',old).referenceVisible,false);assert.equal(m.sphComparisonPlot(data(),'pressure',old).referenceVisible,true);
 const a=data(),b=data();a.samples.forEach(s=>{s.values[0]=-1e308;s.values[1]=-1e308;s.values[2]=-1e308;});b.samples.forEach(s=>{s.values[0]=1e308;s.values[1]=1e308;s.values[2]=1e308;});const overflow=m.sphComparisonPlot(a,'pressure',b);assert.equal(overflow.referenceVisible,false);assert.doesNotMatch(overflow.plot.path,/NaN|Infinity/);
});
test('SPH saved reference rejects wrong model, config, malformed and oversized records and freezes a deep copy',()=>{
 const r=reference();m.validateSphReference(r);const copy=m.copySphReference(r);r.data.samples[0].values[1]=9;assert.equal(copy.data.samples[0].values[1],2);
 for(const mutate of [r=>r.schemaVersion=2,r=>r.capturedAt=-1,r=>r.title='',r=>r.model='nbody-v1',r=>r.particleCount=0,r=>r.config.selfGravity=false,r=>r.config.speed=-1,r=>r.data.samples.splice(1),r=>r.data.samples[1]=null,r=>r.data.samples[1].values=null,r=>r.data.samples[1].values[1]=NaN,r=>r.data.samples[1].time=0,r=>r.data.samples=Array(241).fill(r.data.samples[0]),r=>r.data.selected=240]){const bad=reference();mutate(bad);assert.throws(()=>m.validateSphReference(bad));}
 const old=reference();old.data.samples.forEach(s=>delete s.structure);m.validateSphReference(old);assert.equal(m.sphReferenceSummary(old).window.available,false);
});
test('SPH parameter differences include seed, budget, gravity and preparation with legacy defaults',()=>{
 const a=reference().config,b={...a,relaxationSeconds:64,count:600,seed:42};assert.deepEqual(plain(m.sphParameterDifferences(b,a)),['粒子预算：200 → 600','随机种子：1234 → 42','预松弛 s：0 → 64']);
 assert.deepEqual(plain(m.sphParameterDifferences({...a,relaxationSeconds:0},a)),[]);assert.equal(m.sphParameterDifferences({...a,selfGravity:false},a).length,1);
});
test('SPH metric CSV exports both raw series despite mismatched windows, bounded 480 rows and missing data flags',()=>{
 const a=data(),b=data([.5,2,5],[3,4,5]);const csv=m.sphComparisonCsv(a,'pressure',b);assert.match(csv,/reference,1,2,4/);assert.equal(csv.trim().split('\n').length,7);
 const full=data(Array.from({length:240},(_,i)=>i*.02),Array.from({length:240},(_,i)=>i+1));assert.equal(m.sphComparisonCsv(full,'pressure',full).trim().split('\n').length,481);assert.ok(m.sphComparisonCsv(full,'pressure',full).length<64000);
 b.samples.forEach(s=>delete s.structure);assert.equal(m.sphComparisonCsv(a,'radius',b).trim().split('\n').length,4);
});

function store(faults={}){
 const adapter={accessSync:fs.existsSync,statSync:fs.statSync,readTextSync:p=>fs.readFileSync(p,'utf8'),OpenMode:{CREATE:0,READ_WRITE:0,TRUNC:0},openSync:p=>({fd:fs.openSync(p,'w')}),writeSync:(fd,text)=>{if(faults.partial)return fs.writeSync(fd,text.slice(0,10));return fs.writeSync(fd,text);},fsyncSync:fd=>{if(faults.sync)throw Error('sync failure');fs.fsyncSync(fd);},closeSync:fs.closeSync,renameSync:(a,b)=>{if(faults.rename)throw Error('rename failure');fs.renameSync(a,b);},unlinkSync:p=>{if(faults.remove)throw Error('remove failure');fs.unlinkSync(p);}};
 const c={exports:{},require:n=>n==='@kit.CoreFileKit'?{fileIo:adapter}:m};vm.runInNewContext(compile('SphComparisonStore.ets'),c);return c.exports.SphComparisonStore;
}
test('reference storage survives cold reads, replacement and removal without altering other experiments',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-reference-'));try{
  const S=store(),r=reference();assert.equal(S.load(dir),undefined);fs.writeFileSync(join(dir,'project-1-1.json'),'unrelated');S.save(dir,r);assert.deepEqual(plain(store().load(dir)),r);
  r.title='另一次对照';r.config.speed=1;S.save(dir,r);assert.equal(S.load(dir).title,r.title);assert.deepEqual(fs.readdirSync(dir).sort(),['project-1-1.json','sph-reference.json']);S.clear(dir);assert.equal(S.load(dir),undefined);assert.equal(fs.readFileSync(join(dir,'project-1-1.json'),'utf8'),'unrelated');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('partial write, flush and rename failures preserve old reference and clean temporary files',()=>{
 for(const stage of ['partial','sync','rename']){const dir=fs.mkdtempSync(join(tmpdir(),'sph-reference-fail-'));try{
  const r=reference();store().save(dir,r);const path=join(dir,'sph-reference.json'),before=fs.readFileSync(path);r.title='不应提交';assert.throws(()=>store({[stage]:true}).save(dir,r));assert.deepEqual(fs.readFileSync(path),before);assert.deepEqual(fs.readdirSync(dir),['sph-reference.json']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}}
});
test('bad or oversized files stay intact for recovery; failed clear preserves reference',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-reference-bad-'));try{
  const path=join(dir,'sph-reference.json');for(const text of ['{bad',JSON.stringify({...reference(),schemaVersion:2}),' '.repeat(131073)]){fs.writeFileSync(path,text);assert.throws(()=>store().load(dir));assert.equal(fs.readFileSync(path,'utf8'),text);}
  store().save(dir,reference());assert.throws(()=>store({remove:true}).clear(dir));assert.ok(store().load(dir));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('SPH comparison export keeps provenance and refuses malformed, interpolated-schema or overwritten output',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-compare-export-'));try{
  const table={ok:true,rows:6,metric:'pressure',unit:'GPa',timeUnit:'s',timeAlignment:'simulation-start',csv:m.sphComparisonCsv(data(),'pressure',data()),currentConfig:reference().config};
  const file=join(dir,'raw.csv'),saved=exportTable(table,file);assert.equal(fs.readFileSync(saved.csv,'utf8'),table.csv);assert.deepEqual(JSON.parse(fs.readFileSync(saved.metadata)).currentConfig,table.currentConfig);assert.throws(()=>exportTable(table,file));
  for(const patch of [{unit:'km'},{metric:'temperature'},{timeUnit:'year'},{csv:table.csv.replace('current,0,0,2','current,0,0,NaN')},{csv:table.csv.replace('current,1,1,4','current,1,0,4')},{csv:table.csv.replace('reference,0,0,2','reference,0,0,')},{rows:481}])assert.throws(()=>exportTable({...table,...patch},join(dir,'bad.csv')));
  const next=join(dir,'existing.csv');fs.writeFileSync(join(dir,'existing.metadata.json'),'keep');assert.throws(()=>exportTable(table,next));assert.equal(fs.existsSync(next),false);assert.equal(fs.readFileSync(join(dir,'existing.metadata.json'),'utf8'),'keep');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
