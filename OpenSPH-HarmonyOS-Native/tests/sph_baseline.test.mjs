import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeBaseline} from '../scripts/analyze-sph-baseline.mjs';
const read=name=>readFileSync(new URL('../docs/evidence/sph-0.30.0-'+name+'-baseline.jsonl',import.meta.url),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const desktop=read('desktop'),emulator=read('emulator');
test('matched-time baseline checks analytic mass, repeatability and both platform scalars',()=>{
 const result=analyzeBaseline(emulator,desktop);assert.equal(result.runs,6);assert.equal(result.samples,24);assert.equal(result.eos.checks,30);
 assert.ok(result.crossPlatform.maximumNormalizedError<1e-8);assert.deepEqual(result.resolution.actualCounts,[212,641,1276]);
});
test('baseline rejects missing samples, wrong clocks, physics metadata, units and seeded divergence',()=>{
 for(const mutate of [r=>r.pop(),r=>{r[0].selfGravity=true;},r=>{r[2].time+=.1;},r=>{r[2].dt*=2;},r=>{r[2].count=0;},r=>{r[2].massKg*=1.01;},r=>{r[2].momentumError=1e-5;},r=>{r[2].values[0]=NaN;},r=>{r[2].values[1]*=1e6;},r=>{r[22].values[2]*=1.1;},r=>{r[3]=r[2];}]) {
  const bad=structuredClone(emulator);mutate(bad);assert.throws(()=>analyzeBaseline(bad));
 }
});
test('sensitivity reports non-monotonic changes without manufacturing a convergence order',()=>{
 const result=analyzeBaseline(desktop);assert.ok(result.timestep.mediumToFine.damageMean.absolute>result.timestep.coarseToMedium.damageMean.absolute);
 assert.equal(result.converged,undefined);assert.equal(result.order,undefined);assert.ok(result.limits.some(s=>s.includes('not a convergence order')));
});
