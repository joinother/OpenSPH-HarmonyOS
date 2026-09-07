import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function analyzeGravity(rows,reference){
 assert.equal(rows.length,11);const f=rows[0],last=rows.at(-1);
 assert.equal(f.kind,'force-reference');assert.equal(f.cases,36);
 for(const key of ['maxForceError','maxPotentialError','maxMomentumError'])assert.ok(Number.isFinite(f[key])&&f[key]>=0&&f[key]<(key==='maxMomentumError'?1e-12:2e-5));
 assert.deepEqual(last,{kind:'complete',ok:true,sphereRuns:9});const runs=[];
 for(let i=0;i<3;i++){
  const group=rows.slice(1+3*i,4+3*i);for(let j=0;j<3;j++){
   const v=group[j];assert.equal(v.kind,'sphere');assert.equal(v.budget,[200,600,1200][i]);assert.equal(v.selfGravity,j!==0);
   assert.equal(v.dt,j===2?.015625:.03125);assert.equal(v.steps,4/v.dt);assert.equal(v.timeSeconds,4);
   assert.ok(Number.isInteger(v.count)&&v.count>=v.budget&&v.count<v.budget*1.2);assert.equal(v.count,group[0].count);
   for(const key of ['radialMS','rmsRadiusM','maxMomentumError'])assert.ok(Number.isFinite(v[key]));
   assert.ok(v.maxMomentumError>=0&&v.maxMomentumError<1e-10);assert.ok(v.rmsRadiusM>70000&&v.rmsRadiusM<85000);
  }
  assert.ok(Math.abs(group[0].radialMS)<1e-12);assert.ok(group[1].radialMS<group[0].radialMS-.01);
  assert.ok(group[1].rmsRadiusM<group[0].rmsRadiusM);
  const delta=Math.abs(group[1].radialMS-group[2].radialMS);assert.ok(delta<.01);
  runs.push({budget:group[0].budget,count:group[0].count,radialMS:group[2].radialMS,timestepDifferenceMS:delta});
 }
 let maxCrossPlatformError=0;if(reference){analyzeGravity(reference);for(let i=1;i<=9;i++)for(const key of ['radialMS','rmsRadiusM','maxMomentumError']){
  const err=Math.abs(rows[i][key]-reference[i][key])/Math.max(1,Math.abs(reference[i][key]));assert.ok(err<1e-8);maxCrossPlatformError=Math.max(maxCrossPlatformError,err);
 }}
 return {ok:true,force:f,runs,maxCrossPlatformError:reference?maxCrossPlatformError:null,limits:['4-second unrelaxed single basalt sphere; not hydrostatic equilibrium','no elastic/gravity full-energy conservation or fragmentation/reaggregation validation','no ring self-gravity; no planetary-scale impact claim']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const read=p=>readFileSync(p,'utf8').trim().split(/\r?\n/).map(JSON.parse);console.log(JSON.stringify(analyzeGravity(read(process.argv[2]),process.argv[3]?read(process.argv[3]):undefined),null,2));}
