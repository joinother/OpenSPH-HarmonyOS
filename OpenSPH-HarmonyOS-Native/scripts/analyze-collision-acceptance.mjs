#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {compareRuns,score} from './collision-acceptance.mjs';
const [reportPath,fixturePath]=process.argv.slice(2);if(!reportPath||!fixturePath)throw Error('Report and fixture required');
const report=JSON.parse(readFileSync(reportPath)),bytes=readFileSync(fixturePath),fixture=JSON.parse(bytes);
assert.equal(report.fixtureSha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(report.installedVersion,fixture.baselineVersion);
assert.equal(report.collectionComplete,true);assert.deepEqual(report.errors,[]);assert.equal(report.restoration.completed,true);assert.equal(report.restoration.exactFiles,true);assert.equal(report.runs.length,2);assert.equal(compareRuns(...report.runs),true);
for(const run of report.runs){assert.deepEqual(run.cases.map(c=>c.id),fixture.cases.map(c=>c.id));for(const c of run.cases){assert.equal(score(c.checks).workflowComplete,c.workflowComplete);assert.ok(c.wallSeconds>0);}
 const [g1,g2,g3]=run.cases;const expected=structuredClone(g1.observations.initialConfig);expected.orbitBodies[2].xAU+=fixture.cases[1].offsetKm/149597870.7;assert.deepEqual(g2.observations.initialConfig,expected,'G2 changed more than x offset');
 for(const c of [g1,g3]){assert.deepEqual(c.observations.returnedWorld,c.observations.parent.orbitState);assert.equal(c.observations.returnedTime,c.observations.parent.time);assert.ok(c.observations.localFinal.time>=60);assert.equal(c.observations.loadedImpact.canReturn,false);}
}
for(let i=0;i<3;i++){assert.deepEqual(report.runs[0].cases[i].observations.initialConfig,report.runs[1].cases[i].observations.initialConfig);assert.deepEqual(report.runs[0].cases[i].observations.initialWorld,report.runs[1].cases[i].observations.initialWorld);}
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),r01CollectionAccepted:true,workflowComplete:report.workflowComplete,repeatInputsIdentical:true,repeatStatusesIdentical:true,offsetOnlyControl:true,worldTimeEvidence:report.runs[0].cases.filter(c=>c.id!=='G2').map(c=>({id:c.id,eventSeconds:c.observations.contact.timeSeconds,parentSeconds:c.observations.parent.time*31557600,localElapsedSeconds:c.observations.localFinal.time,returnedParentSeconds:c.observations.returnedTime*31557600})),restoration:report.restoration,cases:report.runs[0].cases.map(c=>({id:c.id,firstBlocker:c.firstBlocker,checks:c.checks.map(x=>({id:x.id,status:x.status}))})),wallSeconds:report.runs.map(r=>r.cases.map(c=>c.wallSeconds)),limits:['No new collision force or world handoff implemented','No physical convergence or cross-device performance claim','G2 is a no-contact control, remnant stages are not tested']},null,2));
