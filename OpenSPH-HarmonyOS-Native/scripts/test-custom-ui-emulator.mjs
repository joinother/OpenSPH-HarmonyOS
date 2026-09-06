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
async function findVisible(predicate){
  for(let i=0;i<14;i++){
    const nodes=layout(),drawer=node(nodes,'workspace-drawer');
    const n=nodes.find(x=>predicate(x)&&area(x.rect)>0&&x.rect[1]>drawer[1]+230&&x.rect[3]<drawer[3]-8);
    if(n)return n;
    const x=drawer[0]+25,from=drawer[3]-90,to=Math.max(drawer[1]+310,from-350);
    h('shell','uitest','uiInput','swipe',String(x),String(from),String(x),String(to),'600');await delay(200);
  }throw Error('Control not reachable in scroll');
}
async function visibleClick(text){const n=await findVisible(x=>x.text===text);const r=n.rect;h('shell','uitest','uiInput','click',String(Math.round((r[0]+r[2])/2)),String(Math.round((r[1]+r[3])/2)));await delay(450);}
async function input(id,text){const n=await findVisible(x=>x.id===id),r=n.rect;h('shell','uitest','uiInput','click',String(Math.round((r[0]+r[2])/2)),String(Math.round((r[1]+r[3])/2)));await delay(200);h('shell','uitest','uiInput','keyEvent','2082');for(let i=0;i<n.text.length;i++)h('shell','uitest','uiInput','keyEvent','2055');h('shell','uitest','uiInput','text',text);await delay(350);const updated=layout().find(x=>x.id===id);assert.equal(updated?.text,text);h('shell','uitest','uiInput','keyEvent','Back');await delay(300);await top();}
async function top(){command('setPanel',{panel:0});await delay(400);command('setPanel',{panel:0});await delay(400);}
try{
  command('setScene',{preset:4,count:600,speed:1,angle:0,duration:3});command('setPanel',{panel:0});await delay(600);
  await click('自定义系统');let s=command('getState');assert.equal(s.scene.preset,5);assert.equal(s.definition.config.orbitBodies.length,4);
  await visibleClick('添加行星');s=command('getState');assert.equal(s.definition.config.orbitBodies.length,5);
  await input('orbit-name','aurora');await input('orbit-value-0','2');
  await top();await visibleClick('荒漠');
  await visibleClick('应用天体 · 重新生成');s=command('getState');
  assert.equal(s.definition.config.orbitBodies[4].name,'aurora');assert.equal(s.definition.config.orbitBodies[4].surface,3);
  assert.ok(Math.abs(s.definition.config.orbitBodies[4].massSolar/(398600.435507e9/1.32712440041279419e20)-2)<1e-12);
  assert.equal(s.simulation.time,0);assert.equal(s.rendering.error,'');
  await visibleClick('近看这颗天体');s=command('getState');assert.equal(s.camera.focus,4);assert.equal(s.appearance.closeup,true);
  await click('下一颗');assert.equal(command('getState').camera.focus,0);await click('上一颗');assert.equal(command('getState').camera.focus,4);
  const nodes=layout(),canvas=node(nodes,'universe-viewport'),bar=node(nodes,'surface-bar');assert.ok(bar[0]>=canvas[0]&&bar[2]<=canvas[2]);
  await click('返回轨道');await top();await visibleClick('删除天体');s=command('getState');assert.equal(s.definition.config.orbitBodies.length,4);assert.equal(s.camera.focus,-1);
  console.log(JSON.stringify({ok:true,device,widthVp:s.window.widthVp,checks:['actual custom preset selection','add planet','keyboard name and mass editing','apply transaction','surface choice','body 4 near view','next/previous wrap','controls fit','delete resets focus'],state:s},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
