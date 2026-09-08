import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Designated emulator required');
const cli='scripts/opensph-cli.mjs';const call=(command,payload={})=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:70000,maxBuffer:12e6}));
const temp=mkdtempSync(join(tmpdir(),'impact-sph-'));
const batch=items=>{const file=join(temp,'batch.json');writeFileSync(file,JSON.stringify(items));return JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','120000','--batch',file],{encoding:'utf8',timeout:240000,maxBuffer:16e6}));};
const a=(action,waitForState)=>({command:'uiAction',payload:{action},...(waitForState?{waitForState}:{})});
const reject=(command,payload)=>{const result=spawnSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:70000});assert.equal(result.status,2);};
try{
 call('listCommands');call('getUiState');batch([a('preset.5','paused'),a('orbit.impact.tidesDemo','paused'),a('time.rate.0.01'),a('simulation.toggle','paused')]);
 const parent=call('getState'),source=call('getImpactPlan');assert.equal(source.contact.incoming.withinCurrentBounds,true);
 batch([a('impact.simulateTides','paused')]);const initial=call('getState');
 assert.equal(initial.simulation.model,'sph-orbit-impact-tides-v1');assert.equal(initial.definition.model,'sph-orbit-impact-tides-v1');assert.equal(initial.simulation.impact.canReturn,true);assert.equal(initial.simulation.time,0);assert.equal(initial.simulation.impact.tides,true);assert.equal(initial.simulation.contact.tides.sourceCount,1);assert.ok(initial.simulation.impact.tidalPotentialJ!==0);assert.equal(initial.simulation.sph.available,true);assert.deepEqual(call('getImpactPlan').contact,source.contact);
 const initialSources=call('getSphFragments',{limit:32}).fragments;assert.equal(initialSources.originAvailable,true);assert.deepEqual(initialSources.originIds,[1,2]);assert.equal(initialSources.originEventCount,source.contact.count);assert.equal(initialSources.originEventTimeSeconds,source.contact.timeSeconds);assert.equal(initialSources.originMaterial,'basalt-single-material-v1');
 const mass=source.contact.incoming.bodies.reduce((sum,b)=>sum+b.massKg,0);assert.ok(Math.abs(initial.simulation.totalMass/mass-1)<1e-9);assert.ok(Math.abs(initial.simulation.sph.kineticJ/source.contact.incoming.kineticEnergyJ-1)<1e-9);
 for(const [command,payload] of [['uiAction',{action:'impact.simulate'}],['setUiValue',{field:'scene.speed',value:5}],['loadReplay',{}],['saveProject',{title:'lossy'}]])reject(command,payload);
 batch([a('simulation.toggle','completed'),a('color.0'),a('fragments.inspect')]);const done=call('getState');assert.equal(done.ui.fragmentFirst,true);assert.equal(call('getUiState').fragmentFirst,true);assert.ok(done.simulation.time>=60);assert.ok(done.simulation.sph.internalJ>initial.simulation.sph.internalJ);assert.ok(Math.abs(done.simulation.totalMass/mass-1)<1e-9);assert.equal(done.rendering.error,'');assert.ok(Math.abs(done.simulation.impact.eventEpochPlusElapsedSeconds-(done.simulation.impact.sourceTimeSeconds+done.simulation.time))<1e-12);assert.ok(Number.isFinite(done.simulation.impact.trackedEnergyJ));
 const pieces=[];let offset=0;const totals=[0,0];const tables=[];
 do{const snapshot=call('getSphFragments',{offset,limit:32}).fragments;assert.equal(snapshot.time,done.simulation.time);assert.equal(snapshot.originAvailable,true);assert.deepEqual(snapshot.originTotalsKg,initialSources.originTotalsKg);assert.deepEqual(snapshot.originIds,[1,2]);
   for(const g of snapshot.groups){assert.ok(Math.abs((g.originMassKg[0]+g.originMassKg[1])/g.massKg-1)<1e-10);assert.ok(Math.abs(g.originFractions[0]+g.originFractions[1]-1)<1e-10);for(let k=0;k<2;k++)totals[k]+=g.originMassKg[k];pieces.push(g);}
   const table=call('getSphFragmentTable',{offset,limit:32});assert.equal(table.time,snapshot.time);assert.equal(table.frameIndex,snapshot.frameIndex);assert.equal(table.rows,snapshot.groups.length);assert.equal(table.csv.trim().split('\n').length,table.rows+1);tables.push(table);offset=snapshot.nextOffset;
 }while(offset>=0);
 for(let k=0;k<2;k++){assert.ok(Math.abs(totals[k]/initialSources.originTotalsKg[k]-1)<1e-10);assert.ok(Math.abs(totals[k]/source.contact.incoming.bodies[k].massKg-1)<1e-9);}
 assert.equal(pieces.length,call('getSphFragments').fragments.groupCount);
 const h=(...args)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...args],{encoding:'utf8',timeout:60000});
 h('shell','snapshot_display','-f','/data/local/tmp/sph-impact-local.jpeg');h('file','recv','/data/local/tmp/sph-impact-local.jpeg','docs/evidence/provenance-0.56.0/fragment-sources.jpeg');
 batch([{command:'saveReplay'},a('impact.return')]);const returned=call('getState');
 assert.deepEqual(returned.simulation.orbitState,parent.simulation.orbitState);assert.equal(returned.simulation.time,parent.simulation.time);assert.equal(returned.simulation.frames,parent.simulation.frames);assert.deepEqual(returned.camera,parent.camera);assert.deepEqual(returned.appearance,parent.appearance);assert.deepEqual(returned.surfaces,parent.surfaces);
 call('loadReplay');call('seek',{frame:done.simulation.frames-1});const loaded=call('getState');assert.equal(loaded.simulation.model,'sph-orbit-impact-tides-v1');assert.deepEqual(loaded.simulation.sph,done.simulation.sph);assert.equal(loaded.simulation.impact.tidalPotentialJ,done.simulation.impact.tidalPotentialJ);assert.deepEqual(loaded.simulation.contact.tides,done.simulation.contact.tides);assert.equal(loaded.simulation.impact.canReturn,false);assert.deepEqual(call('getImpactPlan').contact,source.contact);
 const loadedSources=call('getSphFragments',{offset:0,limit:32}).fragments;assert.deepEqual(loadedSources.groups,pieces.slice(0,32));assert.deepEqual(loadedSources.originTotalsKg,initialSources.originTotalsKg);
 batch([a('fragments.material'),a('preset.5','paused')]);assert.equal(call('getState').simulation.model,'nbody-custom-v1');
 console.log(JSON.stringify({ok:true,device,checks:['real incoming state to SPH particles','initial mass and kinetic budget','60-second material evolution','lossy and duplicate actions rejected','v20 real source masses, paged CSV, source IDs, field and diagnostics','exact parent state/history/camera/surfaces restored','loaded replay can exit to new experiment'],source:source.contact,initialSources,pieces,tables,initial:initial.simulation,final:done.simulation,returnChecks:{time:true,frames:true,vectors:true,camera:true,appearance:true,surfaces:true}},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
