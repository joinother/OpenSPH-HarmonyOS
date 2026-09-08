import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Designated emulator required');
const call=(command,payload={})=>JSON.parse(execFileSync(process.execPath,['scripts/opensph-cli.mjs','--device',device,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:70000,maxBuffer:12e6}));
const temp=mkdtempSync(join(tmpdir(),'sph-impact-'));
const batch=items=>{const file=join(temp,'batch.json');writeFileSync(file,JSON.stringify(items));return JSON.parse(execFileSync(process.execPath,['scripts/opensph-cli.mjs','--device',device,'--batch',file],{encoding:'utf8',timeout:120000,maxBuffer:12e6}));};
const action=(action,waitForState)=>({command:'uiAction',payload:{action},...(waitForState?{waitForState}:{})});
try {
 const catalog=call('listCommands');assert.ok(catalog.commands.some(c=>c.name==='getImpactPlan'));call('getUiState');
 batch([action('preset.5','paused'),action('orbit.impact.demo','paused')]);
 assert.equal(call('getImpactPlan').contact.incoming.available,false);
 batch([action('time.rate.0.01'),action('simulation.toggle','paused')]);
 const before=call('getState');const plan=call('getImpactPlan');
 assert.equal(before.simulation.state,'paused');assert.equal(plan.contact.a,1);assert.equal(plan.contact.b,2);assert.equal(plan.contact.incoming.available,true);assert.equal(plan.contact.incoming.withinCurrentBounds,true);
 const p=plan.contact.incoming;assert.ok(p.relativeSpeedKmS>8&&p.relativeSpeedKmS<8.01);assert.ok(p.timeSeconds>29&&p.timeSeconds<31);
 assert.ok(Math.abs(p.bodies[0].radiusKm-100)<1e-9);assert.ok(Math.abs(p.bodies[1].radiusKm-60)<1e-9);
 for(let k=0;k<3;k++){const [a,b]=p.bodies;assert.ok(Math.abs(a.massKg*a.velocityMS[k]+b.massKg*b.velocityMS[k])<a.massKg*1e-6);}
 batch([action('impact.inspect'),{command:'saveReplay'},{command:'loadReplay'}]);
 const loaded=call('getImpactPlan');assert.deepEqual(loaded.contact,plan.contact);
 const displayed=call('getState');assert.equal(displayed.ui.panel,1);assert.equal(displayed.ui.panelOpen,true);assert.equal(displayed.simulation.time,before.simulation.time);assert.equal(displayed.rendering.error,'');
 call('seek',{frame:0});assert.equal(call('getImpactPlan').contact.incoming.available,false);
 call('seek',{frame:before.simulation.frames-1});assert.deepEqual(call('getImpactPlan').contact,plan.contact);
 const h=(...args)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...args],{encoding:'utf8',timeout:60000});
 h('shell','snapshot_display','-f','/data/local/tmp/sph-impact-plan.jpeg');h('file','recv','/data/local/tmp/sph-impact-plan.jpeg','docs/evidence/impact-plan-0.53.0/impact-plan.jpeg');
 batch([action('orbit.contact.demo','paused'),action('time.rate.1'),action('simulation.toggle','paused')]);
 const large=call('getImpactPlan');assert.equal(large.contact.incoming.available,true);assert.equal(large.contact.incoming.withinCurrentBounds,false);assert.ok(large.contact.incoming.bodies[0].radiusKm>6000);
 console.log(JSON.stringify({ok:true,device,checks:['semantic shared actions','real pre-response vectors','SI conversion and COM','read-only observation','exact v16 save/load','seek before/after contact','large planets retain unsupported true dimensions','native render status'],small:plan,large},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
