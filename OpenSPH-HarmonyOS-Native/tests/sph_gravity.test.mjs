import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeGravity} from '../scripts/analyze-sph-gravity.mjs';
const read=p=>readFileSync(new URL('../docs/evidence/gravity-0.34.0-'+p+'.jsonl',import.meta.url),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const desktop=read('desktop'),emulator=read('emulator');
test('independent softened-force and short-time material response agree across platforms',()=>{
 const result=analyzeGravity(emulator,desktop);assert.equal(result.runs.length,3);assert.ok(result.maxCrossPlatformError<1e-8);
});
test('gravity evidence rejects incomplete runs, wrong model/units and broken invariants',()=>{
 for(const mutate of [r=>r.pop(),r=>r[0].cases=0,r=>r[0].maxForceError=NaN,r=>r[2].selfGravity=false,r=>r[2].count=0,r=>r[2].timeSeconds=3,r=>r[2].dt=1,r=>r[2].radialMS=0,r=>r[2].rmsRadiusM=1,r=>r[2].maxMomentumError=1e-2,r=>r[4]=r[1]]){
  const bad=structuredClone(emulator);mutate(bad);assert.throws(()=>analyzeGravity(bad));
 }
});
