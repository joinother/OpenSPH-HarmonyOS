#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const device=process.argv[2];if(!device)throw Error('Explicit HDC target required');
const hdc=process.env.HDC||'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const ffmpeg=process.env.FFMPEG||'/opt/homebrew/bin/ffmpeg';
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'sph-material-'));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000});
const cmd=(c,p={},bad=false)=>{const r=spawnSync(process.execPath,[cli,'--device',device,'--command',c,'--payload-json',JSON.stringify(p)],{encoding:'utf8',timeout:35000});if(r.error)throw r.error;assert.equal(r.status,bad?2:0,r.stderr);return JSON.parse(r.stdout||r.stderr);};
async function ready(){for(let i=0;i<150;i++){const s=cmd('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady&&s.simulation.state==='paused')return s;await delay(150);}throw Error('Material did not become ready');}
async function capture(name){await delay(450);const file=join(temp,name+'.png'),remote='/data/local/tmp/sph-material-'+Date.now()+'-'+name+'.png';h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,file);h('shell','rm',remote);
 const data=readFileSync(file),width=data.readUInt32BE(16),height=data.readUInt32BE(20);
 const rgb=execFileSync(ffmpeg,['-v','error','-xerror','-f','image2','-pattern_type','none','-threads','1','-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:width*height*4,timeout:20000});assert.equal(rgb.length,width*height*3);return {rgb,width,height};}
function difference(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let total=0,changed=0,count=0;
 for(let y=Math.floor(a.height*.32);y<a.height*.72;++y)for(let x=Math.floor(a.width*.20);x<a.width*.80;++x){let d=0;const i=(y*a.width+x)*3;for(let k=0;k<3;++k)d+=Math.abs(a.rgb[i+k]-b.rgb[i+k]);if(d>12)++changed;total+=d;count+=3;}
 return {mean:total/count,changed};}
try{
 cmd('setScene',{preset:4,count:600,speed:1,angle:0,duration:3});cmd('setCamera',{yaw:.9,pitch:.2,zoom:2.7,focus:1,color:0});cmd('setPanel',{panel:-1});
 cmd('setAppearance',{closeup:true,autoSpin:false,clouds:true,atmosphere:true,trails:true});await ready();await delay(600);
 const initial=cmd('getState'),base=await capture('ocean-clouds');
 cmd('setAppearance',{clouds:false});const clear=await capture('ocean-clear'),cloudDifference=difference(base,clear);assert.ok(cloudDifference.mean>1&&cloudDifference.changed>500,'cloud toggle has no rendered effect');
 cmd('setAppearance',{atmosphere:false});const bare=await capture('ocean-no-air'),airDifference=difference(clear,bare);assert.ok(airDifference.mean>.01&&airDifference.changed>100,'atmosphere toggle has no rendered effect');
 const before=cmd('getState');cmd('setAppearance',{clouds:true,atmosphere:'invalid'},true);assert.deepEqual(cmd('getState').appearance,before.appearance);
 assert.equal(cmd('getState').simulation.time,initial.simulation.time);assert.deepEqual(cmd('getState').simulation.bodies,initial.simulation.bodies);
 cmd('setAppearance',{autoSpin:true,clouds:true,atmosphere:true});const animated=await capture('motion-a');await delay(1400);const moved=await capture('motion-b');const motionDifference=difference(animated,moved);assert.ok(motionDifference.mean>.5,'appearance animation did not move');assert.equal(cmd('getState').simulation.time,initial.simulation.time);
 const awake=cmd('getState');h('shell','uitest','uiInput','keyEvent','Home');await delay(1800);
 const resumed=cmd('getState');await ready();assert.ok(resumed.rendering.previewSeconds-awake.rendering.previewSeconds<1,'appearance advanced through background interval');assert.equal(resumed.simulation.time,initial.simulation.time);
 cmd('setAppearance',{autoSpin:false});const stop=cmd('getState');await delay(400);assert.equal(cmd('getState').rendering.previewSeconds,stop.rendering.previewSeconds);
 const rendered=[];
 for(const [focus,yaw,pitch] of [[0,.9,.2],[2,-.9,-.4],[3,-.9,.4]]){cmd('setCamera',{yaw,pitch,zoom:2.7,focus,color:0});await capture('style-'+focus);const s=cmd('getState');assert.equal(s.rendering.error,'');rendered.push(focus);}
 cmd('setAppearance',{closeup:false});cmd('setCamera',{yaw:.15,pitch:.25,zoom:2.7,focus:-1,color:0});cmd('start');await delay(800);cmd('pause');assert.ok(cmd('getState').simulation.time>0);
 cmd('setScene',{preset:0,count:200,speed:5,angle:0,duration:1});await delay(500);assert.equal(cmd('getState').appearance.closeup,false);assert.equal(cmd('getState').rendering.error,'');
 const sph=await capture('sph');let cyan=0;for(let i=0;i<sph.rgb.length;i+=3)if(sph.rgb[i+1]>100&&sph.rgb[i+1]>sph.rgb[i]*1.5&&sph.rgb[i+2]>sph.rgb[i]*1.5)++cyan;assert.ok(cyan>100,'SPH particles not visible after planet rendering');
 console.log(JSON.stringify({ok:true,device,checks:['actual cloud pixel changes','actual atmosphere pixel changes','visual controls preserve physics','invalid appearance atomicity','surface motion independent of paused solver','background suspends visual clock','four rendered surface styles','return to orbital integration','SPH rendering remains valid'],cloudDifference,airDifference,motionDifference,rendered,initialRendering:initial.rendering,final:cmd('getState')},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
