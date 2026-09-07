import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js'),context={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/ObservationModel.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const plot=context.exports.observationPlot;
const data=()=>({body:1,name:'行星',sceneRevision:2,selected:-1,samples:[{frame:0,time:.7,distanceAU:2,speedKmS:4},{frame:1,time:.8,distanceAU:1,speedKmS:8},{frame:2,time:1,distanceAU:3,speedKmS:2}]});
test('curve respects nonuniform sample times, selected cursor, units and sampled extrema',()=>{
 const d=data(),p=plot(d,'distance');assert.equal(p.available,true);assert.equal(p.minimum,1);assert.equal(p.minFrame,1);assert.equal(p.maximum,3);assert.equal(p.firstTime,.7);assert.equal(p.currentTime,1);assert.match(p.cursorPath,/M240/);
 d.selected=1;const speed=plot(d,'speed');assert.equal(speed.current,8);assert.equal(speed.maxFrame,1);assert.equal(speed.unit,'km/s');assert.ok(Math.abs(Number(speed.cursorPath.split(' ')[0].slice(1))-80)<1e-10);
});
test('single frames, zero speed and flat curves have finite scales and deterministic earliest ties',()=>{
 for(const count of [1,240]){const d=data();d.samples=Array.from({length:count},(_,i)=>({frame:i,time:i*.01,distanceAU:1,speedKmS:0}));for(const metric of ['distance','speed']){const p=plot(d,metric);assert.equal(p.available,true);assert.ok(p.high>p.low);assert.doesNotMatch(p.path+p.cursorPath,/NaN|Infinity/);assert.equal(p.minFrame,0);assert.equal(p.maxFrame,0);}}
});
test('invalid, unbounded or nonmonotonic observations never draw misleading curves',()=>{
 for(const mutate of [d=>d.samples=[],d=>d.samples[1].time=.7,d=>d.samples[1].distanceAU=NaN,d=>d.samples[0].frame=3,d=>d.samples[1].distanceAU=-1,d=>d.samples=Array(241).fill(d.samples[0])]){const d=data();mutate(d);assert.equal(plot(d,'distance').available,false);}
 assert.throws(()=>plot(data(),'temperature'));
});
