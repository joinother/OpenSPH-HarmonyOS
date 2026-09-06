#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit emulator required');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url)),hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const tmp=mkdtempSync(join(tmpdir(),'sph-sky-')),delay=ms=>new Promise(r=>setTimeout(r,ms));
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000});
async function ready(){for(let i=0;i<40;i++){let s=call('getState');assert.equal(s.rendering.error,'');if(s.rendering.panoramaReady&&s.rendering.panoramaBlend===1&&s.rendering.skyReady&&s.rendering.texturesReady&&s.simulation.state==='paused')return s;await delay(100);}throw Error('Sky unavailable');}
async function capture(name){await delay(650);const remote='/data/local/tmp/sph-sky-'+Date.now()+'-'+name+'.png',file=join(tmp,name+'.png');h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,file);h('shell','rm',remote);
 const data=readFileSync(file),width=data.readUInt32BE(16),height=data.readUInt32BE(20);const rgb=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-xerror','-f','image2','-pattern_type','none','-threads','1','-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:width*height*4,timeout:20000});assert.equal(rgb.length,width*height*3);
 return {rgb,width,height,state:call('getState'),p:call('getProjectedBodies').projection};}
function diff(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let total=0,changed=0,count=0;
 const left=a.state.window.safePx.left,top=a.state.window.safePx.top,w=a.p.widthPx,h=a.p.heightPx;
 for(let y=Math.floor(top+h*.13);y<top+h*.85;y+=2)for(let x=Math.floor(left+w*.02);x<left+w*.96;x+=2){
  if([a.p,b.p].some(p=>p.bodies.some(b=>Math.hypot(x-left-b.x*w,y-top-b.y*h)<b.radius*h*1.2+14)))continue;
  const i=(y*a.width+x)*3;let d=0;for(let k=0;k<3;k++)d+=Math.abs(a.rgb[i+k]-b.rgb[i+k]);total+=d;changed+=d>12?1:0;count+=3;
 }return {mean:total/count,changed,samples:count/3};}
try{
 call('uiAction',{action:'preset.5'},'paused');call('setAppearance',{trails:false,closeup:false,autoSpin:false});call('uiAction',{action:'ui.focus'});
 const camera={yaw:.15,pitch:.25,zoom:2.7,focus:-1,color:0};call('setCamera',camera);await ready();const physics=call('getState').simulation;
 call('setSky',{mode:2,brightness:.8});const galaxy=await capture('galaxy');assert.ok(galaxy.state.rendering.skyGalaxy>.79);
 call('setSky',{mode:1});const stars=await capture('stars'),galaxyDifference=diff(galaxy,stars);assert.ok(galaxyDifference.mean>1,'galaxy absent');assert.equal(stars.state.rendering.skyGalaxy,0);
 call('setSky',{mode:0});const clean=await capture('clean'),starsDifference=diff(stars,clean);assert.ok(starsDifference.changed>150,'stars absent');assert.equal(clean.state.rendering.skyStars,0);
 call('setSky',{mode:2,brightness:0});const zero=await capture('zero');assert.ok(diff(clean,zero).mean<.05,'zero brightness not clean');
 call('setSky',{mode:2,brightness:.8});call('setCamera',camera);const base=await capture('fixed');
 call('setCamera',{...camera,zoom:4,focus:1});const followed=await capture('follow'),parallaxDifference=diff(base,followed);assert.ok(parallaxDifference.mean<.05,'background moved with local focus/zoom');
 call('setCamera',{...camera,yaw:.8,pitch:.4});const turned=await capture('turned'),rotationDifference=diff(base,turned);assert.ok(rotationDifference.mean>1,'sky did not rotate');
 call('setCamera',{...camera,yaw:camera.yaw+Math.PI*2});const wrapped=await capture('wrapped'),wrapDifference=diff(base,wrapped);assert.ok(wrapDifference.mean<.1,'full turn changed fixed sky');
 const before=call('getState').sky;const bad=spawnSync(process.execPath,[cli,'--device',device,'--command','setSky','--payload-json','{"mode":0,"brightness":2}'],{encoding:'utf8'});assert.equal(bad.status,2);assert.deepEqual(call('getState').sky,before);
 call('uiAction',{action:'sky.mode.1'});call('setUiValue',{field:'sky.brightness',value:50});assert.equal(call('getState').sky.brightness,.5);
 call('setSky',{mode:2,brightness:.8});call('uiAction',{action:'surface.1'});await delay(1000);const near=call('getState');assert.ok(Math.abs(near.rendering.skyGalaxy-.28)<.01,'near view did not dim sky');
 assert.equal(near.simulation.time,physics.time);assert.deepEqual(near.simulation.bodies,physics.bodies);
 h('shell','uitest','uiInput','keyEvent','Home');await delay(650);const resume=call('getState');await ready();assert.equal(resume.simulation.time,physics.time);
 call('setAppearance',{closeup:false,autoSpin:false,trails:true});call('uiAction',{action:'focus.all'});call('uiAction',{action:'ui.restore'});call('setSky',{mode:2,brightness:.65});
 console.log(JSON.stringify({ok:true,device,galaxyDifference,starsDifference,parallaxDifference,rotationDifference,wrapDifference,nearStrength:near.rendering.skyGalaxy,info:call('getSkyInfo')},null,2));
}finally{rmSync(tmp,{recursive:true,force:true});}
