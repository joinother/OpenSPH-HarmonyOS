#!/usr/bin/env node
// Device UI checks: modifies only this app's current experiment, not saved projects.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];
if(!device)throw Error('Pass the explicit HDC device ID.');
const hdc=process.env.HDC||'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const temp=mkdtempSync(join(tmpdir(),'sph-workspace-'));
const remote='/data/local/tmp/sph-workspace-layout.json';
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000,maxBuffer:8*1024*1024});
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const command=(c,p={})=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--hdc',hdc,'--command',c,'--payload-json',JSON.stringify(p)],{encoding:'utf8',timeout:30000}));
function layout(){
  h('shell','uitest','dumpLayout','-p',remote);
  h('file','recv',remote,join(temp,'layout.json'));
  const found=[];
  function walk(v){
    if(Array.isArray(v)){v.forEach(walk);return;}
    if(!v||typeof v!=='object')return;
    if(v.attributes?.bounds){const a=v.attributes;found.push({...a,rect:(a.bounds.match(/-?\d+/g)||[]).map(Number)});}
    for(const [k,x] of Object.entries(v))if(k!=='attributes')walk(x);
  }
  walk(JSON.parse(readFileSync(join(temp,'layout.json'),'utf8')));return found;
}
const node=(nodes,id)=>{const n=nodes.find(x=>x.id===id);assert.ok(n,'missing '+id);return n.rect;};
const area=r=>(r[2]-r[0])*(r[3]-r[1]);
async function click(text){
  const matches=layout().filter(x=>x.text===text&&area(x.rect)>0);const n=matches.find(x=>x.type==='Button')??matches[0];assert.ok(n,'missing button '+text);
  const r=n.rect;h('shell','uitest','uiInput','click',String(Math.round((r[0]+r[2])/2)),String(Math.round((r[1]+r[3])/2)));
  await delay(600);
}
try{
  command('setScene',{preset:4,count:600,speed:1,angle:0,duration:3});command('setPanel',{panel:-1});await delay(600);
  for(let i=0;i<100;i++){const s=command('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady)break;await delay(150);}
  await click('近看行星');let s=command('getState');assert.equal(s.appearance.closeup,true);assert.equal(s.camera.focus,1);assert.equal(s.appearance.autoSpin,true);
  const initialTime=s.simulation.time;
  await click('厚云');assert.equal(command('getState').camera.focus,2);
  await click('荒漠');assert.equal(command('getState').camera.focus,3);
  await click('海洋');assert.equal(command('getState').camera.focus,1);
  const nodes=layout(),canvas=node(nodes,'universe-viewport'),bar=node(nodes,'surface-bar');
  assert.ok(bar[0]>=canvas[0]&&bar[2]<=canvas[2],'surface controls overflow');
  const x=Math.round((canvas[0]+canvas[2])/2),y=Math.round((canvas[1]+canvas[3])/2),oldYaw=command('getState').camera.yaw;
  h('shell','uitest','uiInput','swipe',String(x),String(y),String(x+90),String(y+25),'500');
  assert.ok(Math.abs(command('getState').camera.yaw-oldYaw)>.01,'closeup camera gesture not received');
  await click('观察');await click('云层');assert.equal(command('getState').appearance.clouds,false);
  await click('大气');assert.equal(command('getState').appearance.atmosphere,false);
  h('shell','uitest','uiInput','keyEvent','Back');await delay(400);assert.equal(command('getState').ui.panelOpen,false);assert.equal(command('getState').appearance.closeup,true);
  h('shell','uitest','uiInput','keyEvent','Back');await delay(450);assert.equal(command('getState').appearance.closeup,false);
  await click('近看行星');await click('专注');assert.equal(command('getState').ui.toolsVisible,false);await click('显示工具');
  assert.equal(command('getState').ui.toolsVisible,true);assert.equal(command('getState').simulation.time,initialTime);
  command('setAppearance',{clouds:true,atmosphere:true,autoSpin:false});s=command('getState');assert.equal(s.rendering.error,'');
  console.log(JSON.stringify({ok:true,device,widthVp:s.window.widthVp,checks:['near-view actual click','three surface switches','surface bar fits width','native closeup pan','cloud/air controls','Back closes drawer before near view','focus and restore','visual actions preserve paused physics'],state:s},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
