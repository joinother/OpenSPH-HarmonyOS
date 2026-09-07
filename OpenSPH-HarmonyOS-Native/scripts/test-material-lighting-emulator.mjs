#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',ffmpeg='/opt/homebrew/bin/ffmpeg';
const temp=mkdtempSync(tmpdir()+'/sph-lighting-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:35000}));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function capture(name){await delay(600);const path=root+'../OpenSPH-'+version+'-material-'+name+'.png',remote='/data/local/tmp/sph-lighting.png';
 rmSync(path,{force:true});h('shell','rm','-f',remote);h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,path);
 const data=readFileSync(path),width=data.readUInt32BE(16),height=data.readUInt32BE(20),rgb=execFileSync(ffmpeg,['-v','error','-xerror','-i',path,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:width*height*4,timeout:15000});assert.equal(rgb.length,width*height*3);return {width,height,rgb,path};}
function compare(a,b,body,region='body'){
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);let difference=0,lumA=0,lumB=0,count=0,changed=0;
 for(let y=0;y<a.height;y+=2)for(let x=0;x<a.width;x+=2){const d=Math.hypot(x-body.x*a.width,y-body.y*a.height),radius=body.radius*a.height;
  if(region==='body'?d>radius*.90:(d<radius*1.3||y<a.height*.15||y>a.height*.85))continue;
  const i=(y*a.width+x)*3;let diff=0;for(let k=0;k<3;k++)diff+=Math.abs(a.rgb[i+k]-b.rgb[i+k]);difference+=diff;changed+=diff>12?1:0;lumA+=.2126*a.rgb[i]+.7152*a.rgb[i+1]+.0722*a.rgb[i+2];lumB+=.2126*b.rgb[i]+.7152*b.rgb[i+1]+.0722*b.rgb[i+2];count++;
 }assert.ok(count>100);return {difference:difference/(count*3),luminanceA:lumA/count,luminanceB:lumB/count,changed,pixels:count};}
try{
 call('listCommands');call('getUiState');call('uiAction',{action:'preset.5'},['--wait-state','paused']);
 call('setAppearance',{closeup:false,autoSpin:false,clouds:false,atmosphere:false,trails:false});call('setSky',{mode:2,brightness:.65});call('setPanel',{panel:-1});call('uiAction',{action:'ui.focus'});
 call('navigateCamera',{focus:1,closeup:true,yaw:.9,pitch:.2,zoom:2.7,durationMs:420},['--wait-camera']);
 let s;for(let i=0;i<60;i++){s=call('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady&&s.rendering.panoramaBlend===1&&!s.rendering.cameraMoving)break;if(i===59)throw Error('render not ready');await delay(100);}
 const initial=call('getState'),body=call('getProjectedBodies').projection.bodies.find(b=>b.id===1);assert.ok(body&&body.radius>.05);
 call('setMaterial',{exposure:-1,ocean:true,cloudShadows:true});const dark=await capture('minus-one');
 call('setUiValue',{field:'material.exposure',value:0});const normal=await capture('zero');
 call('setMaterial',{exposure:1});const bright=await capture('plus-one');
 const low=compare(dark,normal,body),high=compare(normal,bright,body),background=compare(dark,bright,body,'background');
 assert.ok(low.luminanceB>low.luminanceA+4&&high.luminanceB>high.luminanceA+4,'EV must brighten rendered planet');assert.ok(background.difference<.05,'exposure must not brighten sky/UI');
 call('uiAction',{action:'material.ocean'});const matte=await capture('matte'),ocean=compare(bright,matte,body);assert.ok(ocean.changed>10&&ocean.difference>.01,'ocean mask must change the glint');
 call('setAppearance',{clouds:true});const shadows=await capture('cloud-shadow');call('uiAction',{action:'material.cloudShadows'});const noShadows=await capture('no-cloud-shadow'),cloud=compare(shadows,noShadows,body);assert.ok(cloud.changed>10&&cloud.difference>.01,'cloud shadow control has no effect');
 call('setAppearance',{clouds:false});const noCloud=await capture('no-cloud');call('setMaterial',{cloudShadows:true});const noCloudShadow=await capture('no-cloud-shadow-off'),cloudOff=compare(noCloud,noCloudShadow,body);assert.ok(cloudOff.difference<.01,'disabled clouds still cast shadows');
 const beforeInvalid=call('getState');for(const payload of [{exposure:3},{exposure:null},{exposure:1,ocean:'yes'},{cloudShadows:null}]){
  const result=spawnSync(process.execPath,[cli,'--device',device,'--command','setMaterial','--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:35000});assert.equal(result.status,2,result.stderr);
 }assert.deepEqual(call('getState').material,beforeInvalid.material);
 call('uiAction',{action:'color.1'});call('setMaterial',{exposure:-2});const speedLow=await capture('speed-low');call('setMaterial',{exposure:2});const speedHigh=await capture('speed-high'),speed=compare(speedLow,speedHigh,body);assert.ok(speed.difference<.01,'EV changed diagnostic speed colors');
 call('uiAction',{action:'color.0'});call('uiAction',{action:'material.reset'});call('setAppearance',{clouds:true,atmosphere:true});
 const after=call('getState');assert.deepEqual(after.material,{exposure:0,ocean:true,cloudShadows:true});assert.equal(after.rendering.sceneRevision,initial.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,initial.rendering.surfaceStarts);assert.deepEqual(after.definition,initial.definition);assert.deepEqual(after.simulation.bodies,initial.simulation.bodies);assert.equal(after.simulation.time,initial.simulation.time);assert.deepEqual(after.camera,initial.camera);assert.equal(after.cameraMotion.requestId,initial.cameraMotion.requestId);assert.equal(after.rendering.error,'');
 // Read the frame-applied settings rather than only the ArkTS target values.
 assert.equal(after.rendering.materialExposure,0);assert.equal(after.rendering.materialOcean,true);assert.equal(after.rendering.materialCloudShadows,true);
 console.log(JSON.stringify({ok:true,device,checks:['rendered EV is monotonic and sky unchanged','ocean reflection and cloud shadow pixel differences','disabled clouds cast no shadow','diagnostic colors ignore EV','invalid transactions atomic','material edits preserve camera request, physical bodies/time and render surface'],comparison:{low,high,background,ocean,cloud,cloudOff,speed},initial:{camera:initial.camera,request:initial.cameraMotion,revision:initial.rendering.sceneRevision,time:initial.simulation.time},after:{material:after.material,rendering:after.rendering}},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
