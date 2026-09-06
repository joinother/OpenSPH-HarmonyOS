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
function image(name){const file=root+'../OpenSPH-'+version+'-trace-'+name+'.png',remote='/data/local/tmp/sph-trace-'+Date.now()+'.png';rmSync(file,{force:true});h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,file);h('shell','rm',remote);const b=readFileSync(file),width=b.readUInt32BE(16),height=b.readUInt32BE(20);
 const rgb=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-xerror','-f','image2','-pattern_type','none','-threads','1','-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:width*height*4,timeout:20000});assert.equal(rgb.length,width*height*3);return {width,height,rgb};}
call('listCommands');call('getUiState');h('shell','hidumper','-s','DisplayManagerService','-a','-y');call('setWindowOrientation',{orientation:'portrait'});
action('theme.kepler-ring','paused');await settled();const before=call('getState'),zero=trace();assert.equal(zero.enabled,true);assert.equal(zero.running,false);assert.equal(zero.timeHours,0);assert.equal(zero.particles.length,192);assert.equal(before.simulation.time,0);
const initial=image('wide-zero');call('setUiValue',{field:'trace.hours',value:3});await settled();const three=trace(),after=image('wide-three-hours');let changed=0;
for(let y=Math.floor(initial.height*.3);y<initial.height*.72;y++)for(let x=Math.floor(initial.width*.15);x<initial.width*.85;x++){let d=0;for(let k=0;k<3;k++)d+=Math.abs(initial.rgb[(y*initial.width+x)*3+k]-after.rgb[(y*after.width+x)*3+k]);if(d>24)changed++;}
assert.ok(changed>100,'no visible tracer movement');assert.notDeepEqual(zero.particles[0],three.particles[0]);
const angle=p=>Math.atan2(p.yKm,p.xKm);assert.ok(angle(three.particles[0])>angle(three.particles[176]),'inner lane should lead outer lane');
call('setUiValue',{field:'trace.hours',value:zero.innerPeriodHours});const closed=trace();assert.ok(Math.hypot(closed.particles[0].xKm-zero.particles[0].xKm,closed.particles[0].yKm-zero.particles[0].yKm)<1e-6,'native period does not close orbit');
const stable=trace(),bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setUiValue','--payload-json','{"field":"trace.hours","value":25}'],{encoding:'utf8'});assert.equal(bad.status,2);assert.deepEqual(trace(),stable);
action('trace.reset');action('trace.play');await delay(600);call('pause');const paused=trace();assert.ok(paused.timeHours>.2);await delay(400);assert.deepEqual(trace(),paused);
action('trace.play');const awake=trace(false),homeStart=Date.now();h('shell','uitest','uiInput','keyEvent','Home');const homeMs=Date.now()-homeStart;await delay(3000);const resumeStart=Date.now(),resumed=trace(false),resumeMs=Date.now()-resumeStart;const foregroundBudgetHours=(homeMs+resumeMs)/1000+.25;assert.ok(foregroundBudgetHours<1.5,'foreground transport too slow for suspension test');assert.ok(resumed.timeHours-awake.timeHours<foregroundBudgetHours,'clock advanced through the 3-second background interval');call('pause');
call('setUiValue',{field:'trace.hours',value:23.99});action('trace.play');await delay(400);assert.equal(trace(false).timeHours,24);assert.equal(trace(false).running,false);
call('setUiValue',{field:'trace.hours',value:3});const layouts=[];
for(const [name,orientation] of [['phone','portrait'],['landscape','landscape']]){
 h('shell','hidumper','-s','DisplayManagerService','-a','-p');call('setWindowOrientation',{orientation});const s=await settled(s=>(orientation==='portrait'?s.window.geometry.heightPx>s.window.geometry.widthPx:s.window.geometry.widthPx>s.window.geometry.heightPx)&&Math.min(s.window.geometry.widthPx,s.window.geometry.heightPx)<1500);
 const pic=image(name),remote='/data/local/tmp/sph-trace-ui-'+Date.now()+'.json',local=tmpdir()+'/sph-trace-layout-'+Date.now()+'.json';h('shell','uitest','dumpLayout','-p',remote);h('file','recv',remote,local);h('shell','rm',remote);const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(['ring-time-slider','ring-periods'].includes(o.attributes?.id))nodes.push(o.attributes);for(const [k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(local)));rmSync(local);
 assert.equal(nodes.length,2);for(const node of nodes){const r=node.bounds.match(/-?\d+/g).map(Number);assert.ok(r[0]>=0&&r[1]>=0&&r[2]<=pic.width&&r[3]<=pic.height,'ring control outside window');}const bounds=nodes.find(n=>n.id==='ring-time-slider').bounds.match(/-?\d+/g).map(Number);assert.ok(bounds[0]>=0&&bounds[1]>=0&&bounds[2]<=pic.width&&bounds[3]<=pic.height,'local slider outside window');assert.equal(s.window.immersive,true);assert.equal(s.ringTrace.timeHours,3);assert.equal(s.ringTrace.enabled,true);layouts.push({name,width:pic.width,height:pic.height,slider:bounds});
}
const current=call('getState');assert.deepEqual(current.definition,before.definition);assert.equal(current.simulation.time,0);assert.equal(current.rendering.sceneRevision,before.rendering.sceneRevision);
action('surface.toggle');assert.equal(trace(false).enabled,false);assert.equal(call('getState').simulation.time,0);
writeFileSync(root+'docs/evidence/trace-'+version+'-device-tests.json',JSON.stringify({ok:true,device,version,checks:['192 native particles','actual marker pixel movement','inner lane leads outer lane','native one-period closure','invalid seek atomicity','run pause background and terminal clock','portrait/landscape local slider and immersive window','host scene and time preserved; overview exits local mode'],changed,zero,three,paused,foregroundBudgetHours,backgroundAdvanceHours:resumed.timeHours-awake.timeHours,layouts,final:call('getState')},null,2)+'\n');console.log(JSON.stringify({ok:true,changed,foregroundBudgetHours,backgroundAdvanceHours:resumed.timeHours-awake.timeHours,layouts}));
