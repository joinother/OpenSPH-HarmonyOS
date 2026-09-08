import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const ctx={exports:{}};ctx.require=()=>ctx.exports;for(const name of ['ObservationModel','GalaxyObservationModel'])vm.runInNewContext('(function(){'+ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/'+name+'.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText+'})()',ctx);
const {galaxyPlot,galaxyCsv}=ctx.exports;
const source=()=>({available:true,sceneRevision:7,selected:1,parameters:{count:1600,seed:1234,speed:1,inclination:25,duration:800,massRatio:.6,offset:12,retrograde:false},samples:[{frame:0,time:0,values:[60,8,7,0,0],energyError:0,angularError:0},{frame:1,time:4,values:[59,9,8,.1,.2],energyError:1e-9,angularError:-1e-15},{frame:2,time:8,values:[61,10,9,.2,.3],energyError:-1e-10,angularError:1e-14}]});
test('galaxy curves retain Myr times, origin fractions and sampled extrema',()=>{
 const d=source(),before=JSON.stringify(d),p=galaxyPlot(d,0);assert.equal(p.unit,'kpc');assert.equal(p.currentTime,4);assert.equal(p.current,59);assert.equal(p.minFrame,1);assert.equal(p.maxFrame,2);
 const f=galaxyPlot(d,4);assert.equal(f.unit,'%');assert.equal(f.current,20);assert.equal(f.maximum,30);assert.equal(JSON.stringify(d),before);
});
test('galaxy CSV includes applied parameters and lossless recorded values, not display percentages',()=>{
 const d=source(),rows=galaxyCsv(d).trim().split('\n').map(x=>x.split(','));assert.equal(rows.length,4);assert.equal(rows[0].length,18);assert.ok(rows.every(r=>r.length===18));
 assert.equal(rows[2][0],'galaxy-tidal-restricted-v1');assert.equal(+rows[2][6],12);assert.equal(+rows[2][10],4);assert.equal(+rows[2][15],.2);assert.equal(+rows[2][17],-1e-15);
 d.parameters.retrograde=true;assert.equal(galaxyCsv(d).trim().split('\n')[1].split(',')[7],'1');
});
test('galaxy data rejects malformed records and does not fabricate measurements for another model',()=>{
 for(const modify of [d=>d.samples[1].time=0,d=>d.samples[1].values[4]=1.1,d=>d.samples[1].energyError=NaN,d=>d.samples[1].values.pop(),d=>d.parameters.offset=31,d=>d.parameters=undefined,d=>d.samples[0].frame=2]){const d=source();modify(d);assert.throws(()=>galaxyCsv(d));assert.throws(()=>galaxyPlot(d,0));}
 const empty={available:false,sceneRevision:8,selected:-1,samples:[]};assert.equal(galaxyPlot(empty,0).available,false);assert.equal(galaxyCsv(empty).trim().split('\n').length,1);assert.throws(()=>galaxyPlot(source(),5));
});
test('full 800 Myr record exports every one of 201 samples in original order',()=>{
 const d=source();d.samples=Array.from({length:201},(_,frame)=>({frame,time:frame*4,values:[60+frame,8,7,.1,.2],energyError:1e-8,angularError:1e-15}));d.selected=-1;
 const csv=galaxyCsv(d);assert.equal(csv.trim().split('\n').length,202);assert.equal(+csv.trim().split('\n').at(-1).split(',')[10],800);assert.equal(galaxyPlot(d,0).currentTime,800);
});
