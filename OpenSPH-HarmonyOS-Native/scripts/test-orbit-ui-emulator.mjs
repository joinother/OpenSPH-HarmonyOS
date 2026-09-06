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
  command('setScene',{preset:0,count:200,speed:5,angle:0,duration:1});
  command('setPanel',{panel:0});await delay(650);
  await click('双体轨道');let s=command('getState');assert.equal(s.scene.preset,3);assert.equal(s.scene.speed,1);assert.equal(s.simulation.count,2);
  await click('行星系统');s=command('getState');assert.equal(s.scene.preset,4);assert.equal(s.simulation.count,4);
  const nodes=layout(),canvas=node(nodes,'universe-viewport'),drawer=node(nodes,'workspace-drawer');
  const buttons=nodes.filter(n=>['双体轨道','行星系统','正面碰撞','掠过与碰撞','旋转天体'].includes(n.text)&&n.type==='Button');
  assert.equal(buttons.length,5);
  for(const n of buttons)assert.ok(n.rect[0]>=drawer[0]&&n.rect[2]<=drawer[2],'preset outside drawer');
  await click('观察');await click('红色行星');assert.equal(command('getState').camera.focus,3);
  await click('金色行星');assert.equal(command('getState').camera.focus,2);
  await click('全景');assert.equal(command('getState').camera.focus,-1);
  await click('收起');command('start');await delay(700);command('pause');
  s=command('getState');assert.ok(s.simulation.time>0);assert.equal(s.simulation.model,'nbody-v1');
  assert.deepEqual(node(layout(),'universe-viewport'),canvas);
  console.log(JSON.stringify({ok:true,device,widthVp:s.window.widthVp,checks:['five presets fit drawer','actual dual orbit selection','actual planetary system selection','red and gold body camera tracking','orbit advances on native surface','persistent viewport'],state:s},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
