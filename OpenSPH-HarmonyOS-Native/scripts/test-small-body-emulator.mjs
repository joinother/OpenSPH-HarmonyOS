import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit designated emulator required');
if(!process.argv[3]||!process.argv[4])throw Error('Evidence directory and recovery directory required');
const out=resolve(process.argv[3]),recovery=resolve(process.argv[4]);mkdirSync(out,{recursive:true});
const before=JSON.parse(readFileSync(recovery+'/before.json')),frozen=JSON.parse(readFileSync(recovery+'/frozen.json')),backup=JSON.parse(readFileSync(recovery+'/backup.json'));
assert.equal(backup.ok,true);assert.match(backup.projectId,/^project-\d+-\d+$/);assert.ok(existsSync(recovery+'/active.osphr'));assert.ok(existsSync(recovery+'/original-files/last-replay.osphr'));
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const remote='/data/app/el2/100/base/com.opensph.lab/haps/entry/files/';
const h=(...a)=>execFileSync('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',['-t',device,...a],{encoding:'utf8',timeout:60000});
const records=[];const call=(command,payload={},wait)=>{const args=[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload)];if(wait)args.push('--wait-state',wait);const result=JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8',timeout:70000,maxBuffer:12e6}));assert.equal(result.ok,true);records.push({command,payload,result});return result;};
const action=a=>call('uiAction',{action:a}),input=(i,v)=>call('setUiValue',{field:'placement.value.'+i,value:v});
const photo=name=>{h('shell','snapshot_display','-f','/data/local/tmp/small-body-'+name+'.jpeg');h('file','recv','/data/local/tmp/small-body-'+name+'.jpeg',out+'/'+name+'.jpeg');};
try{
 call('listCommands');call('getUiState');call('uiAction',{action:'preset.5'},'paused');action('focus.1');
 const baseline=call('getState');action('selection.launch');action('placement.rock');input(1,'25000');input(2,'0');input(4,'10');
 let p=call('getState').placement;assert.equal(p.preview.valid,true,p.preview.error);assert.equal(p.units.distance,'altitude');assert.equal(p.preview.body.radiusKm,7.5);
 const original=p.preview.body,mass=4*Math.PI/3*7500**3*2700/(1.32712440041279419e20/6.67430e-11);assert.ok(Math.abs(original.massSolar/mass-1)<1e-14);
 for(const mode of ['astro','physical','center','radius','altitude','diameter']){action('placement.units.'+mode);p=call('getState').placement;assert.equal(p.preview.valid,true);for(const key of ['massSolar','radiusKm','xAU','yAU','zAU','vxKmS','vyKmS','vzKmS'])assert.ok(Math.abs(p.preview.body[key]-original[key])<Math.max(1e-30,Math.abs(original[key])*2e-14),key);}
 action('placement.options');photo('physical-inputs');action('placement.options');photo('launch-preview');
 // Semantic viewport input tests the presented plane, not actual finger hit testing.
 call('setViewportPlacementPoint',{x:.65,y:.55});p=call('getState').placement;assert.equal(p.preview.valid,true);assert.ok(Math.abs(p.preview.speedKmS-10)<1e-12);
 action('placement.cancel');let cancelled=call('getState');assert.deepEqual(cancelled.simulation.orbitState,baseline.simulation.orbitState);assert.equal(cancelled.simulation.time,baseline.simulation.time);
 action('selection.launch');action('placement.rock');input(1,'25000');input(2,'0');input(4,'10');p=call('getState').placement;
 action('placement.confirm');let inserted=call('getState');assert.equal(inserted.simulation.time,baseline.simulation.time);assert.deepEqual(inserted.simulation.orbitState[4],p.preview.body);
 assert.deepEqual(inserted.simulation.orbitState.slice(0,4).map(({radiusKm,...b})=>b),baseline.simulation.orbitState);
 call('saveReplay');call('loadReplay');let loaded=call('getState');assert.deepEqual(loaded.simulation.orbitState,inserted.simulation.orbitState);assert.equal(loaded.simulation.time,inserted.simulation.time);
 action('time.rate.0.01');call('start');const deadline=Date.now()+60000;let contact;
 do{contact=call('getState');assert.notEqual(contact.simulation.state,'failed',contact.simulation.error);if(Date.now()>deadline)throw Error('No projectile contact');}while(!contact.simulation.contact?.count);
 assert.equal(contact.simulation.state,'paused');assert.deepEqual([contact.simulation.contact.a,contact.simulation.contact.b],[1,4]);assert.ok(contact.simulation.contact.normalSpeedKmS>10);
 assert.equal(contact.simulation.orbitState[4].massSolar,inserted.simulation.orbitState[4].massSolar);photo('small-rock-contact');
 writeFileSync(out+'/device.json',JSON.stringify({ok:true,scope:'semantic UI/CLI, not touch or animation validation',contact:contact.simulation.contact,records},null,2));
 console.log('PASS physical units, small asteroid, viewport input, cancel, insert, replay and gravity contact');
 if(process.argv[5]==='--ui-regression'){const result=execFileSync(process.execPath,[fileURLToPath(new URL('./test-ui-cli-emulator.mjs',import.meta.url)),device],{encoding:'utf8',timeout:240000,maxBuffer:20e6});writeFileSync(out+'/ui-regression.json',result);console.log('PASS existing semantic UI regression');}
}catch(error){writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),records},null,2));throw error;}finally{
 execFileSync(process.execPath,[fileURLToPath(new URL('./restore-orbit-emulator-session.mjs',import.meta.url)),device,recovery,out],{stdio:'inherit',timeout:180000});
}
