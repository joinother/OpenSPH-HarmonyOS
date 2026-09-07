#!/usr/bin/env node
// Compare independent desktop Storage extraction with app CLI acceptance output.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const fields=['pressureMinGPa','pressureMaxGPa','pressureMeanGPa','internalMinMJkg','internalMaxMJkg','internalMeanMJkg','damageMean','damageMax','kineticJ','internalJ'];
export function compareReference(desktop,device){
 assert.equal(device.ok,true);assert.equal(desktop.length,3);assert.equal(device.results.length,3);
 assert.deepEqual(desktop.map(r=>r.preset).sort(),[0,1,2]);assert.deepEqual(device.results.map(r=>r.preset).sort(),[0,1,2]);
 const tolerance=1e-8,relative=(a,b)=>{assert.ok(Number.isFinite(a)&&Number.isFinite(b));return Math.abs(a-b)/Math.max(1,Math.abs(b));};
 const cases=desktop.map(reference=>{
  const actual=device.results.find(r=>r.preset===reference.preset),frame=actual.final;
  const expected={preset:reference.preset,count:200,speed:reference.preset===2?2:5,angle:reference.preset===1?45:0,duration:10,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234};
  for(const [key,value] of Object.entries(expected))assert.equal(frame.config[key],value,'initial '+key+' differs');
  assert.equal(frame.diagnostics.available,true);assert.equal(frame.timeUnit,'s');assert.equal(reference.values.length,10);
  assert.ok(Number.isInteger(reference.count)&&reference.count>0);assert.equal(actual.count,reference.count);
  const timeError=relative(frame.time,reference.time),massError=relative(actual.mass,reference.mass);
  assert.ok(timeError<=tolerance&&massError<=tolerance,'time or total mass differs');
  const normalizedErrors=Object.fromEntries(fields.map((key,i)=>[key,relative(frame.diagnostics[key],reference.values[i])]));
  const maxNormalizedError=Math.max(timeError,massError,...Object.values(normalizedErrors));
  assert.ok(maxNormalizedError<=tolerance,'preset '+reference.preset+' exceeds diagnostic tolerance');
  return {preset:reference.preset,count:reference.count,time:reference.time,timeError,massError,normalizedErrors,maxNormalizedError};
 });
 return {ok:true,platforms:['macOS arm64 Apple Clang','HarmonyOS emulator arm64 DevEco Clang'],tolerance,errorDefinition:'abs(device-reference)/max(1,abs(reference))',scope:'Three 200-particle-budget, 10-second application initial conditions. Independent direct Storage extraction; same fixed OpenSPH equations and initial-condition recipe. Not independent physics or resolution convergence.',desktopCompatibility:'Temporary copy only: Iterator operator[] added for recent Apple libc++; live vendored kernel unchanged.',cases};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{assert.equal(process.argv.length,4,'Usage: node scripts/compare-sph-reference.mjs desktop.jsonl emulator.json');
 const desktop=readFileSync(process.argv[2],'utf8').trim().split('\n').map(line=>JSON.parse(line));
 console.log(JSON.stringify(compareReference(desktop,JSON.parse(readFileSync(process.argv[3],'utf8'))),null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
