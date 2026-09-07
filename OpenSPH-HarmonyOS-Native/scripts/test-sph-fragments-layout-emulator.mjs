#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',temp=mkdtempSync(tmpdir()+'/sph-diagnostic-layout-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:35000}));
const action=action=>call('uiAction',{action}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const bounds=n=>n.bounds.match(/-?\d+/g).map(Number);
function tree(){h('shell','rm','-f','/data/local/tmp/sph-diagnostic-layout.json');h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-diagnostic-layout.json');h('file','recv','/data/local/tmp/sph-diagnostic-layout.json',temp+'/tree.json');const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/tree.json')));return nodes;}
function capture(name){const file=root+'../OpenSPH-'+version+'-sph-fragments-'+name+'.png';rmSync(file,{force:true});h('shell','rm','-f','/data/local/tmp/sph-diagnostic-layout.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-diagnostic-layout.png');h('file','recv','/data/local/tmp/sph-diagnostic-layout.png',file);}
const results=[];
try{
 call('listCommands');call('getUiState');
 action('ui.restore');const originalCamera=call('getState').camera;call('setCamera',{...originalCamera,zoom:5});assert.ok(call('getSphFragments').fragments.available);
 for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');await delay(800);call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<80;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&!s.rendering.cameraMoving)break;if(i===79)throw Error('window did not settle');await delay(150);}
  const within=n=>{const b=bounds(n),g=s.window.geometry;return b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1];};
  action('panel.close');action('panel.observe');action('color.0');await delay(1200);
  const framed=call('getState');assert.ok(framed.rendering.compositionScale<1);const region=framed.window.layout.scene;
  assert.ok(Math.abs(framed.rendering.compositionX-(region.x+region.width/2)/framed.window.viewportWidthVp)<.005);assert.ok(Math.abs(framed.rendering.compositionY-(region.y+region.height/2)/framed.window.viewportHeightVp)<.005);
  function visible(id){for(let i=0;i<12;i++){const nodes=tree(),sc=nodes.find(n=>n.type==='Scroll'&&within(n));assert.ok(sc);const b=bounds(sc),n=nodes.find(n=>{if((n.id!==id&&n.text!==id)||!within(n))return false;const r=bounds(n);if(id.startsWith('sph-')&&n.type==='Button'&&(r[3]-r[1])<36*s.window.geometry.widthPx/s.window.widthVp-4)return false;if(id==='sph-curve-plot'&&Math.abs((r[3]-r[1])-(r[2]-r[0])*100/240)>3)return false;return r[0]>=b[0]&&r[1]>=b[1]&&r[2]<=b[2]&&r[3]<=b[3];});if(n)return n;const x=Math.round((b[0]+b[2])/2);h('shell','uitest','uiInput','swipe',String(x),String(Math.round(b[1]+(b[3]-b[1])*.8)),String(x),String(Math.round(b[1]+(b[3]-b[1])*.35)),'450');}throw Error('missing visible '+id);}
  function tap(n){const b=bounds(n);h('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));}
  const before=call('getState'),taps=[];
  const color=visible('sph-fragments-color');tap(color);assert.equal(call('getState').camera.color,6);taps.push({action:'color.6',bounds:bounds(color)});
  const info=call('getSphFragments').fragments;
  if(info.groupCount>8){const next=visible('sph-fragments-next');tap(next);assert.equal(call('getUiState').actions.find(a=>a.id==='fragments.previous')?.enabled,true);taps.push({action:'fragments.next',bounds:bounds(next)});tap(visible('sph-fragments-previous'));assert.equal(call('getUiState').actions.find(a=>a.id==='fragments.previous')?.enabled,false);}
  const after=call('getState');assert.deepEqual({...after.camera,color:before.camera.color},before.camera);assert.equal(after.simulation.time,before.simulation.time);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);
  action('panel.close');action('panel.observe');await delay(1000);visible('sph-fragments-heading');
  const viewed=call('getState');assert.equal(viewed.window.immersive,true);assert.equal(viewed.rendering.error,'');capture(name);
  results.push({name,window:before.window,composition:{x:framed.rendering.compositionX,y:framed.rendering.compositionY,scale:framed.rendering.compositionScale},taps,summary:info});
 }
 console.log(JSON.stringify({ok:true,device,checks:['Material group coloring and pagination physically tapped in expanded portrait, folded portrait and landscape','Actions preserve simulation time, generation and camera pose','Group heading visible and immersive window without render errors'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});h('shell','rm','-f','/data/local/tmp/sph-diagnostic-layout.json','/data/local/tmp/sph-diagnostic-layout.png');}
