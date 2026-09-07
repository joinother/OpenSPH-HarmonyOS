#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const metrics=['pressureMaxGPa','internalMeanMJkg','damageMean','kineticJ','internalJ'];
const groups=[[200,.125,0],[200,.0625,0],[200,.03125,0],[600,.03125,0],[1200,.03125,0],[200,.03125,1]];
const normalized=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(b));
const key=r=>[r.budget,r.dt,r.repeat,r.time].join('/');
export function analyzeBaseline(rows,other) {
  assert.equal(rows.length,27,'Expected configuration, EOS, 24 samples and completion');
  const config=rows[0];assert.deepEqual(config,{kind:'configuration',schemaVersion:1,model:'basalt-impact-v1',upstream:'f3033faf4422a056dcb79cc6643c7c6f3d9fee19',seed:1234,targetRadiusKm:100,impactorRadiusKm:60,densityKgM3:2700,speedKmS:5,separationKm:180,angle:0,durationSeconds:16,selfGravity:false,timestep:'fixed'});
  assert.equal(rows[1].kind,'eos');assert.equal(rows[1].ok,true);assert.equal(rows[1].checks,30);
  assert.equal(rows[1].rho0KgM3,2700);assert.equal(rows[1].bulkModulusPa,2.67e10);
  assert.ok(normalized(rows[1].referenceSoundSpeedMS,Math.sqrt(2.67e10/2700))<1e-12);
  assert.deepEqual(rows.at(-1),{kind:'complete',ok:true,runs:6});
  const samples=rows.slice(2,-1),expectedMass=4/3*Math.PI*(100000**3+60000**3)*2700;
  assert.equal(new Set(samples.map(key)).size,24,'Duplicate samples');
  for(const [budget,dt,repeat] of groups) {
    const group=samples.filter(r=>r.budget===budget&&r.dt===dt&&r.repeat===repeat);
    assert.deepEqual(group.map(r=>r.time),[4,8,12,16],'Missing matched-time samples');
    assert.ok(Number.isInteger(group[0].count)&&group[0].count>0);
    for(const r of group) {
      assert.equal(r.kind,'collision');assert.equal(r.count,group[0].count);assert.equal(r.steps*dt,r.time);
      assert.ok(Number.isFinite(r.massKg)&&normalized(r.massKg,expectedMass)<1e-12,'Mass differs from analytic spheres');
      for(const field of ['momentumError','centerError'])assert.ok(Number.isFinite(r[field])&&r[field]>=0&&r[field]<1e-10,field);
      assert.equal(r.values.length,5);assert.ok(r.values.every(Number.isFinite));
      assert.ok(r.values[2]>=0&&r.values[2]<=1);assert.ok(r.values[3]>=0&&r.values[4]>=0);
      assert.ok(normalized(r.values[1],r.values[4]/r.massKg/1e6)<1e-12,'Internal energy/mean units differ');
    }
  }
  const row=(budget,dt,time=16,repeat=0)=>samples.find(r=>r.budget===budget&&r.dt===dt&&r.time===time&&r.repeat===repeat);
  for(const budget of [200,600,1200])assert.equal(new Set(samples.filter(r=>r.budget===budget).map(r=>r.count)).size,1,'Same budget produced inconsistent initial sampling');
  assert.ok(row(200,.03125).count<row(600,.03125).count&&row(600,.03125).count<row(1200,.03125).count);
  let repeatError=0,bitwiseEqual=true;
  for(const t of [4,8,12,16]) {
    const a=row(200,.03125,t,1),b=row(200,.03125,t);
    assert.equal(a.count,b.count);
    for(let i=0;i<5;i++){
      bitwiseEqual=bitwiseEqual&&a.values[i]===b.values[i];
      repeatError=Math.max(repeatError,Math.abs(a.values[i]-b.values[i])/Math.max(1e-30,Math.abs(b.values[i])));
    }
  }
  assert.ok(repeatError<=1e-12,'Seeded rerun exceeds roundoff tolerance');
  const differences=(a,b)=>Object.fromEntries(metrics.map((name,i)=>[name,{absolute:Math.abs(a.values[i]-b.values[i]),relativeToFiner:b.values[i]===0?null:Math.abs(a.values[i]-b.values[i])/Math.abs(b.values[i])}]));
  let crossPlatform;
  if(other) {
    analyzeBaseline(other);assert.deepEqual(other[0],config);
    let maximum=0;
    for(const a of samples){const b=other.find(r=>r.kind==='collision'&&key(r)===key(a));assert.ok(b);assert.equal(a.count,b.count);for(let i=0;i<5;i++)maximum=Math.max(maximum,normalized(a.values[i],b.values[i]));}
    assert.ok(maximum<=1e-8,'Cross-platform scalar mismatch');crossPlatform={maximumNormalizedError:maximum,tolerance:1e-8};
  }
  return {ok:true,config,eos:rows[1],samples:24,runs:6,repeatability:{maximumRelativeError:repeatError,tolerance:1e-12,bitwiseEqual},crossPlatform,
    matchedTimesSeconds:[4,8,12,16],invariants:{maxMomentumError:Math.max(...samples.map(r=>r.momentumError)),maxCenterError:Math.max(...samples.map(r=>r.centerError))},
    timestep:{budget:200,actualCount:row(200,.03125).count,coarseToMedium:differences(row(200,.125),row(200,.0625)),mediumToFine:differences(row(200,.0625),row(200,.03125))},
    resolution:{fixedDt:.03125,actualCounts:[200,600,1200].map(n=>row(n,.03125).count),coarseToMedium:differences(row(200,.03125),row(600,.03125)),mediumToFine:differences(row(600,.03125),row(1200,.03125))},
    limits:['Constitutive limits and continuity, not a Sod shock tube or elastic wave solution.','Sensitivity is reported, not a convergence order or accepted physical accuracy.','Resolution changes particle sampling and damage flaw assignments despite the same seed.','Fixed dt is a test-only policy; the application retains adaptive Courant stepping.','Kinetic plus internal energy omits elastic energy; no total-energy conservation claim.']};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{assert.ok(process.argv.length===3||process.argv.length===4,'Usage: analyze-sph-baseline.mjs reference.jsonl [other.jsonl]');const read=p=>readFileSync(p,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line));console.log(JSON.stringify(analyzeBaseline(read(process.argv[2]),process.argv[3]?read(process.argv[3]):undefined),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
