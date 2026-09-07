import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareReference} from '../scripts/compare-sph-reference.mjs';
const desktop=readFileSync(new URL('../docs/evidence/sph-0.28.0-desktop-reference.jsonl',import.meta.url),'utf8').trim().split('\n').map(line=>JSON.parse(line));
const device=JSON.parse(readFileSync(new URL('../docs/evidence/sph-0.28.0-emulator.json',import.meta.url),'utf8'));
test('independent desktop/app SPH evidence agrees across all ten diagnostics, mass, time and particle counts',()=>{
 const result=compareReference(desktop,device);assert.equal(result.cases.length,3);assert.ok(result.cases.every(r=>r.maxNormalizedError<1e-8));
});
test('SPH comparison rejects missing/duplicate cases, unavailable data, wrong units and numerical regressions',()=>{
 for(const mutate of [d=>{d.results[0].final.config.seed=2;},d=>{d.results.pop();},d=>{d.results[1].preset=0;},d=>{d.results[0].final.diagnostics.available=false;},d=>{d.results[0].final.timeUnit='year';},d=>{d.results[0].count++;},d=>{d.results[0].mass*=1.01;},d=>{d.results[0].final.time+=1;},d=>{d.results[0].final.diagnostics.damageMean=NaN;},d=>{d.results[0].final.diagnostics.pressureMaxGPa*=1.01;}]){
  const bad=structuredClone(device);mutate(bad);assert.throws(()=>compareReference(desktop,bad));
 }
});
