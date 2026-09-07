#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',temp=mkdtempSync(tmpdir()+'/sph-moon-layout-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:35000}));
const action=action=>call('uiAction',{action}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const bounds=n=>n.bounds.match(/-?\d+/g).map(Number);
function tree(){h('shell','rm','-f','/data/local/tmp/sph-moon-layout.json');h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-moon-layout.json');h('file','recv','/data/local/tmp/sph-moon-layout.json',temp+'/tree.json');const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/tree.json')));return nodes;}
function capture(name){const file=root+'../OpenSPH-'+version+'-moon-'+name+'.png';rmSync(file,{force:true});h('shell','rm','-f','/data/local/tmp/sph-moon-layout.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-moon-layout.png');h('file','recv','/data/local/tmp/sph-moon-layout.png',file);}
const results=[];
try{
 call('listCommands');call('getUiState');call('uiAction',{action:'theme.moon-atlas'},['--wait-state','paused']);call('setAppearance',{autoSpin:false});action('ui.restore');
 for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<80;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&s.rendering.moonReady&&!s.rendering.cameraMoving)break;if(i===79)throw Error('window did not settle');await delay(150);}
  const within=n=>{const b=bounds(n),g=s.window.geometry;return b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1];};
  action('panel.close');await delay(500);capture(name);
  action('selection.edit');await delay(500);action('orbit.surface.3');let nodes,moon,scrolls=0;
  for(;scrolls<5;scrolls++){nodes=tree();moon=nodes.find(n=>n.text==='月面'&&within(n));if(moon)break;const sc=nodes.find(n=>n.type==='Scroll'&&within(n));assert.ok(sc,'editor scroll area available');const b=bounds(sc),x=Math.round((b[0]+b[2])/2);h('shell','uitest','uiInput','swipe',String(x),String(Math.round(b[1]+(b[3]-b[1])*.8)),String(x),String(Math.round(b[1]+(b[3]-b[1])*.3)),'450');await delay(250);}
  assert.ok(moon,'Moon appearance chip visible');const b=bounds(moon),before=call('getState');
  // Real injection verifies the new chip's touch target; navigation above is semantic.
  h('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));
  const after=call('getState');assert.equal(after.editor.orbitSurface,5);assert.deepEqual(after.definition,before.definition);assert.equal(after.simulation.time,before.simulation.time);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.window.immersive,true);assert.equal(after.rendering.error,'');capture('editor-'+name);
  results.push({name,window:after.window,moonBounds:b,scrolls,moonUploads:after.rendering.moonUploads,sceneRevision:after.rendering.sceneRevision});
 }
 console.log(JSON.stringify({ok:true,device,checks:['wide, folded portrait and landscape immersive Moon view','Moon appearance chip in bounds and real tap reaches shared editor draft','choosing a draft surface preserves live scene and solver time'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});h('shell','rm','-f','/data/local/tmp/sph-moon-layout.json','/data/local/tmp/sph-moon-layout.png');}
