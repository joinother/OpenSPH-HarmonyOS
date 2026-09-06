#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit development emulator required');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=(action,wait)=>call('uiAction',{action},wait),trace=(particles=true)=>call('getRingTrace',{particles}).ringTrace;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(predicate=()=>true){for(let i=0;i<100;i++){const s=call('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady&&!s.rendering.cameraMoving&&s.rendering.frames>1&&predicate(s)){await delay(350);return call('getState');}await delay(200);}throw Error('Scene not ready');}
function image(name){const file=root+'../OpenSPH-'+version+'-ellipse-'+name+'.png',remote='/data/local/tmp/sph-trace-'+Date.now()+'.png';rmSync(file,{force:true});h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,file);h('shell','rm',remote);const b=readFileSync(file),width=b.readUInt32BE(16),height=b.readUInt32BE(20);
 const rgb=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-xerror','-f','image2','-pattern_type','none','-threads','1','-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:width*height*4,timeout:20000});assert.equal(rgb.length,width*height*3);return {width,height,rgb};}
call('listCommands');call('getUiState');h('shell','hidumper','-s','DisplayManagerService','-a','-y');call('setWindowOrientation',{orientation:'portrait'});
assert.equal(call('listExperiments').experiments.length,9);action('theme.eccentric-ring','paused');await settled();const host=call('getState'),initial=trace();
assert.equal(initial.model,'restricted-elliptic-kepler-v2');assert.equal(initial.speedScale,1.12);assert.equal(initial.running,false);assert.ok(Math.abs(initial.eccentricity-.2544)<1e-14);assert.equal(initial.particles.length,192);
const energy=(p,m)=>.5*(p.vxKmS*p.vxKmS+p.vyKmS*p.vyKmS)-1.32712440041279419e11*m/Math.hypot(p.xKm,p.yKm),angular=p=>p.xKm*p.vyKmS-p.yKm*p.vxKmS;
const rows=[];for(const speed of [1,1.01,1.12,1.2]){
 call('setUiValue',{field:'trace.speed',value:speed});action('trace.reset');const zero=trace();action('trace.apoapsis');const apo=trace();
 assert.equal(apo.timeHours,zero.innerPeriodHours/2);assert.ok(Math.abs(apo.referenceRadiusKm-zero.innerApoapsisKm)<1e-6);assert.ok(Math.abs(apo.referenceXKm+zero.innerApoapsisKm)<1e-6);
 let energyError=0,angularError=0;for(let i=0;i<192;i++){
  energyError=Math.max(energyError,Math.abs(energy(apo.particles[i],apo.massSolar)/energy(zero.particles[i],zero.massSolar)-1));
  angularError=Math.max(angularError,Math.abs(angular(apo.particles[i])/angular(zero.particles[i])-1));
 }assert.ok(energyError<1e-12&&angularError<1e-12);assert.ok(apo.referenceSpeedKmS<=zero.referenceSpeedKmS+1e-12);
 call('setUiValue',{field:'trace.hours',value:zero.innerPeriodHours});const closed=trace();assert.ok(Math.hypot(closed.referenceXKm-zero.referenceXKm,closed.referenceYKm-zero.referenceYKm)<1e-6);
 rows.push({speed,eccentricity:zero.eccentricity,periodHours:zero.innerPeriodHours,periapsisKm:zero.referenceRadiusKm,apoapsisKm:apo.referenceRadiusKm,periSpeedKmS:zero.referenceSpeedKmS,apoSpeedKmS:apo.referenceSpeedKmS,energyError,angularError});
}
const stable=trace();for(const [field,value] of [['trace.speed',.99],['trace.speed',1.21],['trace.rate',0],['trace.rate',4.1],['trace.rate','1']]){
 const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setUiValue','--payload-json',JSON.stringify({field,value})],{encoding:'utf8'});assert.equal(bad.status,2);assert.deepEqual(trace(),stable);
}
action('trace.ellipse');call('setUiValue',{field:'trace.hours',value:2});call('setUiValue',{field:'trace.rate',value:.1});assert.equal(trace(false).timeHours,2);action('trace.play');await delay(700);call('pause');const slow=trace(false);assert.ok(slow.timeHours>2.03&&slow.timeHours<2.4);
const held=trace();call('setUiValue',{field:'trace.rate',value:4});assert.equal(trace(false).timeHours,held.timeHours);action('trace.play');await delay(700);call('pause');const fast=trace(false);assert.ok(fast.timeHours-held.timeHours>1.5);
action('trace.circular');assert.equal(trace(false).timeHours,0);assert.equal(trace(false).running,false);assert.equal(trace(false).rateHours,4);action('trace.ellipse');call('setUiValue',{field:'trace.rate',value:1});action('trace.apoapsis');await settled();image('wide-apoapsis');
action('trace.controls');await settled();image('wide-controls');
function layout(){const remote='/data/local/tmp/sph-ellipse-ui-'+Date.now()+'.json',local=tmpdir()+'/sph-ellipse-ui-'+Date.now()+'.json';h('shell','uitest','dumpLayout','-p',remote);h('file','recv',remote,local);h('shell','rm',remote);const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes?.id)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(local)));rmSync(local);return nodes;}
const layouts=[];for(const [name,fold,orientation] of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
 h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});await settled(s=>(orientation==='portrait'?s.window.geometry.heightPx>s.window.geometry.widthPx:s.window.geometry.widthPx>s.window.geometry.heightPx)&&(fold?Math.min(s.window.geometry.widthPx,s.window.geometry.heightPx)<1500:Math.min(s.window.geometry.widthPx,s.window.geometry.heightPx)>2000));
 action('trace.controls');await settled();const state=call('getState'),pic=image(name+'-controls'),nodes=layout(),controls=[];
 for(const id of ['ring-speed-slider','ring-rate-slider']){const node=nodes.find(n=>n.id===id);assert.ok(node,'missing '+id);const bounds=node.bounds.match(/-?\d+/g).map(Number);assert.ok(bounds[0]>=0&&bounds[1]>=0&&bounds[2]<=pic.width&&bounds[3]<=pic.height&&bounds[3]>bounds[1],'clipped '+id);controls.push({id,bounds});}
 if(!state.window.layout.compact){const node=nodes.find(n=>n.id==='ring-orbit-diagnostics');assert.ok(node,'diagnostics absent');const b=node.bounds.match(/-?\d+/g).map(Number);assert.ok(b[3]<=pic.height&&b[1]>=0);}
 assert.equal(state.window.immersive,true);assert.equal(state.ringTrace.speedScale,1.12);assert.equal(state.ringTrace.timeHours,initial.innerPeriodHours/2);assert.equal(state.rendering.surfaceStarts,host.rendering.surfaceStarts);layouts.push({name,width:pic.width,height:pic.height,controls});
 call('setPanel',{panel:-1});await settled();image(name+'-scene');
}
const current=call('getState');assert.deepEqual(current.definition,host.definition);assert.equal(current.simulation.time,0);assert.equal(current.rendering.sceneRevision,host.rendering.sceneRevision);assert.equal(current.rendering.error,'');
action('trace.toggle');action('trace.toggle');const reset=trace(false);assert.equal(reset.speedScale,1);assert.equal(reset.rateHours,1);assert.equal(reset.timeHours,0);
writeFileSync(root+'docs/evidence/ellipse-'+version+'-device-tests.json',JSON.stringify({ok:true,device,version,checks:['four launch speeds native peri/apo closure and invariants','invalid speed and rate atomicity','slow/fast clock','launch changes reset and pause; rate preserves time','fold rotation controls and immersive layout','host definition time revision and surface retained','mode reentry resets local parameters'],rows,slow,fast,layouts,initial,final:call('getState')},null,2)+'\n');console.log(JSON.stringify({ok:true,rows,layouts}));
