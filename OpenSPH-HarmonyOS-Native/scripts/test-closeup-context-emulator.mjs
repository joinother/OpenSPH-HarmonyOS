#!/usr/bin/env node
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync}from'node:fs';import{fileURLToPath}from'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:45000}));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:20000}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[],states=[],captures=[];
async function ready(){for(let i=0;i<50;i++){const s=call('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady&&!s.rendering.cameraMoving&&s.rendering.surfacePending===0){await delay(200);return call('getState');}await delay(100);}throw Error('render not ready');}
function shot(name){const remote='/data/local/tmp/closeup-'+name+'.png',dest=root+'../OpenSPH-0.33.1-'+name+'.png';h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,dest);assert.equal(readFileSync(dest).subarray(0,8).toString('hex'),'89504e470d0a1a0a');captures.push(dest.split('/').pop());}
call('listCommands');call('getUiState');call('uiAction',{action:'theme.three-worlds'},['--wait-state','paused']);call('setAppearance',{autoSpin:false});call('setPanel',{panel:-1});
const initial=await ready();
function preserved(s){assert.deepEqual(s.definition,initial.definition);assert.equal(s.simulation.time,initial.simulation.time);assert.equal(s.rendering.sceneRevision,initial.rendering.sceneRevision);assert.equal(s.rendering.surfaceStarts,initial.rendering.surfaceStarts);}
const pose=(yaw,focus=1,closeup=true)=>call('navigateCamera',{focus,closeup,yaw,pitch:0,zoom:2.7,durationMs:300},['--wait-camera']);
for(const [name,fold,orientation]of[['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
 h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');await delay(800);call('setWindowOrientation',{orientation});await delay(800);pose(-.97);const s=await ready();preserved(s);assert.equal(s.window.immersive,true);
 const p=call('getProjectedBodies').projection,sun=p.bodies.find(b=>b.id===0),target=p.bodies.find(b=>b.id===1);assert.equal(sun.opacity,1);assert.ok(sun.x>0&&sun.x<1&&sun.y>0&&sun.y<1);assert.ok(sun.depth<target.depth);
 const distance=Math.hypot((sun.x-target.x)*p.widthPx/p.heightPx,sun.y-target.y);assert.ok(distance>target.radius+sun.radius,'Sun must be outside planet disk');shot('closeup-'+name);states.push({state:s,projection:p});
 const hit=call('pickBody',{x:sun.x,y:sun.y});assert.equal(hit.hit,0);await ready();preserved(call('getState'));pose(-.97);await ready();
}
checks.push('Sun visible beside enlarged planet, projected behind target, and semantically pickable in three immersive layouts without restarting simulation');
pose(.97);await ready();assert.equal(call('getProjectedBodies').projection.bodies.find(b=>b.id===0).opacity,0);checks.push('opposite viewing direction excludes rear-hemisphere Sun');
pose(-Math.PI/2);await ready();const occulted=call('getProjectedBodies').projection;const star=occulted.bodies.find(b=>b.id===0);assert.equal(call('pickBody',{x:star.x,y:star.y}).hit,1);checks.push('Sun behind enlarged target is correctly occluded and cannot steal target selection');
const seen=new Set();for(const yaw of[-2.5,-1.5,-.5,.5,1.5,2.5]){pose(yaw);await ready();const p=call('getProjectedBodies').projection,t=p.bodies.find(b=>b.id===1);for(const b of p.bodies){if(b.id>1&&b.opacity===1&&b.x>0&&b.x<1&&b.y>0&&b.y<1&&Math.hypot((b.x-t.x)*p.widthPx/p.heightPx,b.y-t.y)>t.radius+b.radius)seen.add(b.id);}}
assert.ok(seen.size>0,'rotation must expose at least one companion planet');checks.push('rotating near selected planet exposes other simulated planets');
pose(0,-1,false);const final=await ready();preserved(final);assert.ok(call('getProjectedBodies').projection.bodies.every(b=>b.opacity===1));checks.push('return to overview restores all system bodies with original timeline and scene');
writeFileSync(root+'docs/evidence/closeup-0.33.1-emulator.json',JSON.stringify({ok:true,device,checks,captures,seen:[...seen],states,final,limits:['readable marker sizes, not physical angular diameters','semantic picking and static screenshots; no physical touch or frame-rate measurement']},null,2)+'\n');console.log(JSON.stringify({ok:true,checks,captures,seen:[...seen]}));
