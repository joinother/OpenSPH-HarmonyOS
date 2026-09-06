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
  const n=layout().find(x=>x.text===text&&area(x.rect)>0);assert.ok(n,'missing button '+text);
  const r=n.rect;h('shell','uitest','uiInput','click',String(Math.round((r[0]+r[2])/2)),String(Math.round((r[1]+r[3])/2)));
  await delay(600);
}
try{
  await command('setScene',{preset:0,count:200,speed:5,angle:0,duration:60});
  for(let i=0;i<80;i++){const s=await command('getState');if(s.simulation.state==='paused')break;await delay(100);}
  await command('setPanel',{panel:-1});await delay(350);
  const initial=await command('getState');assert.equal(initial.simulation.state,'paused');assert.equal(initial.ui.panelOpen,false);
  let nodes=layout();const canvas=node(nodes,'universe-viewport'),header=node(nodes,'workspace-header'),transport=node(nodes,'workspace-transport');
  assert.equal(nodes.filter(n=>n.type==='XComponent').length,1);
  assert.ok(transport[1]>header[3],'transport overlaps header');
  const clearFraction=(transport[1]-header[3])/(canvas[3]-canvas[1]);assert.ok(clearFraction>.65,'too little unobscured canvas');
  assert.ok(initial.window.viewportHeightVp>initial.window.heightVp*.8,'canvas does not fill safe area');
  await command('start');await click('参数');
  const open=await command('getState');assert.equal(open.ui.panelOpen,true);assert.deepEqual(open.simulation.config,initial.simulation.config);
  assert.deepEqual(open.definition.config,initial.definition.config,'opening drawer mutates editor');
  assert.ok(open.simulation.steps>=initial.simulation.steps,'opening drawer resets solver');
  nodes=layout();const drawer=node(nodes,'workspace-drawer');assert.deepEqual(node(nodes,'universe-viewport'),canvas);
  assert.ok(drawer[3]<=transport[1],'drawer overlaps transport');
  const wide=initial.window.widthVp>=600;
  if(wide)assert.ok((drawer[2]-drawer[0])/(canvas[2]-canvas[0])<.51,'side drawer too wide');
  else assert.ok((drawer[3]-drawer[1])/(canvas[3]-canvas[1])<=.51,'bottom drawer too tall');
  await click('观察');assert.equal((await command('getState')).ui.panel,1);
  const cameraBefore=command('getState').camera;await click('拉近 +');assert.ok(command('getState').camera.zoom<cameraBefore.zoom);
  await click('复位视角');assert.equal(command('getState').camera.zoom,2.7);
  assert.equal(command('getState').camera.yaw,0.15);
  await click('收起');assert.equal((await command('getState')).ui.panelOpen,false);
  await click('参数');assert.deepEqual((await command('getState')).definition.config,initial.definition.config,'reopening drawer mutates editor');
  await click('专注');
  const focused=await command('getState');assert.equal(focused.ui.toolsVisible,false);assert.equal(focused.ui.panelOpen,false);
  nodes=layout();assert.ok(!nodes.some(n=>n.id==='workspace-header'||n.id==='workspace-transport'));assert.deepEqual(node(nodes,'universe-viewport'),canvas);
  const x=Math.round((canvas[0]+canvas[2])*.5),y=Math.round((canvas[1]+canvas[3])*.5);
  h('shell','uitest','uiInput','swipe',String(x),String(y),String(x+100),String(y+40),'600');
  const dragged=await command('getState');assert.ok(Math.abs(dragged.camera.yaw-focused.camera.yaw)>.01,'canvas pan not received');
  await click('显示工具');assert.equal((await command('getState')).ui.toolsVisible,true);
  await click('实验库');assert.equal((await command('getState')).ui.panelOpen,true);
  h('shell','uitest','uiInput','keyEvent','Back');await delay(250);
  assert.equal((await command('getState')).ui.panelOpen,false,'Back should close drawer');
  await command('pause');
  console.log(JSON.stringify({ok:true,device,mode:wide?'side-drawer':'bottom-drawer',window:initial.window,
    geometry:{canvas,header,transport,drawer,clearFraction},checks:['single persistent surface','canvas fills safe area','unobscured area >65%','drawer bounds','solver preserved across panels','focus mode','actual canvas pan','restore controls','Back closes drawer']},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
