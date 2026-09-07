import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {createRequire} from 'node:module';import vm from 'node:vm';
import {exportTable} from '../scripts/export-sph.mjs';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js'),context={exports:{},require:()=>({})};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/SphObservationModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const {sphPlot,sphCsv}=context.exports;
const data=()=>({sceneRevision:7,selected:-1,samples:[0,.2,2].map((time,frame)=>({frame,time,values:[-3,-2+frame,-2.5+frame/2,0,4,frame,frame*.1,.5,20-frame,frame*100]}))});
test('SPH curves retain signed pressure and nonuniform seconds, five units, selection and deterministic extrema',()=>{
 const d=data(),p=sphPlot(d,'pressure');assert.equal(p.minimum,-2);assert.equal(p.maximum,0);assert.equal(p.maxTime,2);assert.ok(p.low< -2);assert.match(p.path,/ L24 /);assert.equal(p.currentTime,2);
 d.selected=1;assert.equal(sphPlot(d,'internal').current,1);assert.equal(sphPlot(d,'damage').unit,'0–1');assert.equal(sphPlot(d,'kinetic').maxFrame,0);assert.equal(sphPlot(d,'energy').unit,'J');
 d.samples=d.samples.slice(0,1);d.selected=-1;assert.equal(sphPlot(d,'pressure').minFrame,0);assert.match(sphPlot(d,'pressure').path,/^M120 /);
});
test('missing, malformed, evicted and nonfinite SPH data cannot draw curves or export invented zeros',()=>{
 for(const mutate of [d=>d.samples=[],d=>d.selected=9,d=>d.samples[1].time=0,d=>d.samples[0].values[0]=NaN,d=>d.samples[0].values.pop(),d=>d.samples[0].values[6]=2,d=>d.samples[0].frame=1]){
  const d=data();mutate(d);assert.equal(sphPlot(d,'pressure').available,false);assert.throws(()=>sphCsv(d));
 }assert.throws(()=>sphPlot(data(),'temperature'));
 const huge=data();for(const s of huge.samples){s.values[0]=-1e308;s.values[1]=s.frame===0?-1e308:1e308;s.values[2]=-1e308;}assert.equal(sphPlot(huge,'pressure').available,false);assert.equal(sphPlot(huge,'pressure').path,'');
});
test('SPH CSV contains all raw diagnostics and export preserves provenance and refuses overwrite',()=>{
 const d=data(),csv=sphCsv(d),rows=csv.trim().split('\n');assert.equal(rows.length,4);assert.deepEqual(rows[2].split(',').map(Number),[1,.2,...d.samples[1].values]);
 const directory=mkdtempSync(tmpdir()+'/sph-export-');try{
  const file=directory+'/result.csv',result=exportTable({ok:true,rows:3,csv,timeUnit:'s',sceneRevision:7,config:{preset:0}},file);
  assert.equal(readFileSync(file,'utf8'),csv);assert.equal(JSON.parse(readFileSync(result.metadata)).sceneRevision,7);assert.throws(()=>exportTable({ok:true,rows:3,csv},file));assert.equal(readFileSync(file,'utf8'),csv);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
