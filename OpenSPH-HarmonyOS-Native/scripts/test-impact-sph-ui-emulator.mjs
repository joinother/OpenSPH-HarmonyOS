import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Designated emulator required');
const evidence='build/impact-sph-ui';mkdirSync(evidence,{recursive:true});
const cli='scripts/opensph-cli.mjs';const call=(command,payload={})=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:70000,maxBuffer:12e6}));
const temp=mkdtempSync(join(tmpdir(),'impact-sph-'));
const batch=items=>{const file=join(temp,'batch.json');writeFileSync(file,JSON.stringify(items));return JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','120000','--batch',file],{encoding:'utf8',timeout:240000,maxBuffer:16e6}));};
const a=(action,waitForState)=>({command:'uiAction',payload:{action},...(waitForState?{waitForState}:{})});
const reject=(command,payload)=>{const result=spawnSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:70000});assert.equal(result.status,2);};
try{
 call('listCommands');call('getUiState');batch([a('preset.5','paused'),a('orbit.impact.demo','paused'),a('time.rate.0.01'),a('simulation.toggle','paused')]);
 const parent=call('getState'),source=call('getImpactPlan');assert.equal(source.contact.incoming.withinCurrentBounds,true);
 batch([a('impact.simulate','paused')]);const initial=call('getState');
 assert.equal(initial.simulation.model,'sph-orbit-impact-v1');assert.equal(initial.definition.model,'sph-orbit-impact-v1');assert.equal(initial.simulation.impact.canReturn,true);assert.equal(initial.simulation.time,0);assert.equal(initial.simulation.sph.available,true);assert.deepEqual(call('getImpactPlan').contact,source.contact);
 const mass=source.contact.incoming.bodies.reduce((sum,b)=>sum+b.massKg,0);assert.ok(Math.abs(initial.simulation.totalMass/mass-1)<1e-9);assert.ok(Math.abs(initial.simulation.sph.kineticJ/source.contact.incoming.kineticEnergyJ-1)<1e-9);
 for(const [command,payload] of [['uiAction',{action:'impact.simulate'}],['setUiValue',{field:'scene.speed',value:5}],['loadReplay',{}],['saveProject',{title:'lossy'}]])reject(command,payload);
 batch([a('simulation.toggle','completed'),a('color.7'),a('panel.observe')]);const done=call('getState');assert.ok(done.simulation.time>=60);assert.ok(done.simulation.sph.internalJ>initial.simulation.sph.internalJ);assert.ok(Math.abs(done.simulation.totalMass/mass-1)<1e-9);assert.equal(done.rendering.error,'');
 const h=(...args)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...args],{encoding:'utf8',timeout:60000});
 h('shell','snapshot_display','-f','/data/local/tmp/sph-impact-local.jpeg');h('file','recv','/data/local/tmp/sph-impact-local.jpeg',join(evidence,'local-sph.jpeg'));
 batch([{command:'saveReplay'},a('impact.return')]);const returned=call('getState');
 assert.deepEqual(returned.simulation.orbitState,parent.simulation.orbitState);assert.equal(returned.simulation.time,parent.simulation.time);assert.equal(returned.simulation.frames,parent.simulation.frames);assert.deepEqual(returned.camera,parent.camera);assert.deepEqual(returned.appearance,parent.appearance);assert.deepEqual(returned.surfaces,parent.surfaces);
 call('loadReplay');call('seek',{frame:done.simulation.frames-1});const loaded=call('getState');assert.equal(loaded.simulation.model,'sph-orbit-impact-v1');assert.deepEqual(loaded.simulation.sph,done.simulation.sph);assert.equal(loaded.simulation.impact.canReturn,false);assert.deepEqual(call('getImpactPlan').contact.incoming,source.contact.incoming);assert.equal(loaded.simulation.contact.tides.available,false);
 batch([a('preset.5','paused')]);assert.equal(call('getState').simulation.model,'nbody-custom-v1');
 console.log(JSON.stringify({ok:true,device,checks:['real incoming state to SPH particles','initial mass and kinetic budget','60-second material evolution','lossy and duplicate actions rejected','v17 source and diagnostics','exact parent state/history/camera/surfaces restored','loaded replay can exit to new experiment'],source:source.contact,initial:initial.simulation,final:done.simulation,returnChecks:{time:true,frames:true,vectors:true,camera:true,appearance:true,surfaces:true}},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
