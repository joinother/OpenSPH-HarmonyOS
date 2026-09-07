import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {exportTable} from '../scripts/export-observation.mjs';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const compile=file=>ts.transpileModule(fs.readFileSync(new URL('../entry/src/main/ets/common/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ctx={exports:{}};ctx.require=()=>ctx.exports;for(const f of ['SceneModel.ets','ObservationModel.ets','ObservationComparison.ets'])vm.runInNewContext(compile(f),ctx);
const m=ctx.exports;
const data=(times=[.1,.3,.6],values=[1,3,2])=>({body:1,name:'蓝色行星',sceneRevision:3,selected:-1,samples:times.map((time,i)=>({frame:i,time,distanceAU:values[i],speedKmS:values[i]*10}))});
const reference=()=>({schemaVersion:1,capturedAt:123456,title:'对照 · 🌍',config:{preset:3,count:600,speed:.85,angle:0,duration:1,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234},data:data()});
const plain=x=>JSON.parse(JSON.stringify(x));
test('shared axes keep actual time offsets, interpolate only inside range and never mutate inputs',()=>{
 const live=data([.2,.4,.5],[2,4,3]),ref=data(),before=JSON.stringify([live,ref]);live.selected=0;
 const c=m.comparisonPlot(live,'distance',ref);assert.equal(c.referenceVisible,true);assert.equal(c.plot.firstTime,.1);assert.equal(c.plot.lastTime,.6);assert.equal(c.deltaReady,true);assert.equal(c.referenceValue,2);assert.equal(c.delta,0);assert.match(c.plot.path,/^M48/);assert.match(c.referencePath,/^M0/);
 live.selected=-1;assert.equal(JSON.stringify([live,ref]),before);
 const p=m.comparisonPlot(live,'speed',ref);assert.ok(Math.abs(p.referenceValue-70/3)<1e-10);assert.ok(Math.abs(p.delta-20/3)<1e-10);assert.equal(p.plot.unit,'km/s');
});
test('disjoint ranges and out-of-range cursors produce no fabricated delta or extrapolation',()=>{
 const ref=data();for(const live of [data([.7,.9,1],[2,3,4]),data([0,.02,.05],[2,3,4])]){const c=m.comparisonPlot(live,'distance',ref);assert.equal(c.overlap,false);assert.equal(c.deltaReady,false);assert.equal(c.referenceValue,0);assert.equal(c.delta,0);}
 const c=m.comparisonPlot(data([.4,.5,.8],[1,2,3]),'distance',ref);assert.equal(c.overlap,true);assert.equal(c.deltaReady,false);
 assert.equal(m.comparisonPlot(data(),'distance').referenceVisible,false);
 assert.equal(m.comparisonPlot({...data(),samples:[]},'distance',ref).plot.available,false);
});
test('reference validation rejects malformed metadata, sparse/oversized/nonfinite data and wrong source',()=>{
 const r=reference();m.validateReference(r);const copy=m.copyReference(r);r.data.samples[0].distanceAU=99;assert.equal(copy.data.samples[0].distanceAU,1);
 for(const mutate of [r=>r.schemaVersion=2,r=>r.capturedAt=-1,r=>r.title='',r=>r.config.preset=0,r=>r.data.body=0,r=>r.data.body=2,r=>r.data.samples=[r.data.samples[0]],r=>r.data.samples[1]=null,r=>r.data.samples[1].time=2,r=>r.data.samples[1].time=.1,r=>r.data.samples[1].speedKmS=null,r=>r.data.samples[1].distanceAU=1e308,r=>r.data.samples=Array(241).fill(r.data.samples[0]),r=>r.data.selected=240]){const value=reference();mutate(value);assert.throws(()=>m.validateReference(value));}
 const custom=reference();custom.config.preset=5;custom.config.speed=1;custom.config.orbitBodies=m.defaultOrbitBodies();assert.throws(()=>m.validateReference(custom));custom.data.name=custom.config.orbitBodies[1].name;m.validateReference(custom);
});
function store(faults={}){
 const adapter={accessSync:fs.existsSync,statSync:fs.statSync,readTextSync:p=>fs.readFileSync(p,'utf8'),OpenMode:{CREATE:0,READ_WRITE:0,TRUNC:0},openSync:p=>({fd:fs.openSync(p,'w')}),writeSync:(fd,text)=>{if(faults.partial)return fs.writeSync(fd,text.slice(0,10));return fs.writeSync(fd,text);},fsyncSync:fd=>{if(faults.sync)throw Error('sync failure');fs.fsyncSync(fd);},closeSync:fs.closeSync,renameSync:(a,b)=>{if(faults.rename)throw Error('rename failure');fs.renameSync(a,b);},unlinkSync:p=>{if(faults.remove)throw Error('remove failure');fs.unlinkSync(p);}};
 const c={exports:{},require:n=>n==='@kit.CoreFileKit'?{fileIo:adapter}:m};vm.runInNewContext(compile('ObservationStore.ets'),c);return c.exports.ObservationStore;
}
test('reference storage survives cold reads, replacement and removal without altering other experiments',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-reference-'));try{
  const S=store(),r=reference();assert.equal(S.load(dir),undefined);fs.writeFileSync(join(dir,'project-1-1.json'),'unrelated');S.save(dir,r);assert.deepEqual(plain(store().load(dir)),r);
  r.title='另一次对照';r.config.speed=1;S.save(dir,r);assert.equal(S.load(dir).title,r.title);assert.deepEqual(fs.readdirSync(dir).sort(),['observation-reference.json','project-1-1.json']);S.clear(dir);assert.equal(S.load(dir),undefined);assert.equal(fs.readFileSync(join(dir,'project-1-1.json'),'utf8'),'unrelated');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('partial write, flush and rename failures preserve old reference and clean temporary files',()=>{
 for(const stage of ['partial','sync','rename']){const dir=fs.mkdtempSync(join(tmpdir(),'sph-reference-fail-'));try{
  const r=reference();store().save(dir,r);const path=join(dir,'observation-reference.json'),before=fs.readFileSync(path);r.title='不应提交';assert.throws(()=>store({[stage]:true}).save(dir,r));assert.deepEqual(fs.readFileSync(path),before);assert.deepEqual(fs.readdirSync(dir),['observation-reference.json']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}}
});
test('bad or oversized files stay intact for recovery; failed clear preserves reference',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-reference-bad-'));try{
  const path=join(dir,'observation-reference.json');for(const text of ['{bad',JSON.stringify({...reference(),schemaVersion:2}),' '.repeat(131073)]){fs.writeFileSync(path,text);assert.throws(()=>store().load(dir));assert.equal(fs.readFileSync(path,'utf8'),text);}
  store().save(dir,reference());assert.throws(()=>store({remove:true}).clear(dir));assert.ok(store().load(dir));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CSV retains original sample times and values, excludes arbitrary labels and exports at most 480 rows',()=>{
 const a=data(),b=data([.15,.35,.65],[4,2,3]);b.name='=DANGEROUS()';const csv=m.observationCsv(a,b);assert.match(csv,/reference,0,0.15,4,40/);assert.doesNotMatch(csv,/DANGEROUS/);assert.equal(csv.split('\n').length,8);
 a.samples=Array.from({length:240},(_,i)=>({frame:i,time:i/239,distanceAU:Math.PI+i/1000,speedKmS:Math.E+i}));const full=m.observationCsv(a,a);assert.equal(full.split('\n').length,482);assert.ok(JSON.stringify({ok:true,csv:full}).length<64000);
});
test('CSV helper writes provenance, refuses overwrite and rolls back its CSV if metadata exists',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-export-'));try{
  const file=join(dir,'compare.csv'),table={ok:true,rows:3,csv:m.observationCsv(data()),timeAlignment:'simulation-start',currentName:'中文行星'};const saved=exportTable(table,file);assert.equal(fs.readFileSync(saved.csv,'utf8'),table.csv);assert.equal(JSON.parse(fs.readFileSync(saved.metadata)).currentName,'中文行星');assert.throws(()=>exportTable(table,file));
  const next=join(dir,'blocked.csv'),metadata=join(dir,'blocked.metadata.json');fs.writeFileSync(metadata,'keep');assert.throws(()=>exportTable(table,next));assert.equal(fs.existsSync(next),false);assert.equal(fs.readFileSync(metadata,'utf8'),'keep');assert.throws(()=>exportTable({...table,rows:0},join(dir,'empty.csv')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
