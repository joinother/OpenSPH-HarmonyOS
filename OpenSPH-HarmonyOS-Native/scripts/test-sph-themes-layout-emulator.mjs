#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',temp=mkdtempSync(tmpdir()+'/sph-themes-layout-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:70000}));
const action=action=>call('uiAction',{action}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const bounds=n=>n.bounds.match(/-?\d+/g).map(Number);
function tree(){h('shell','rm','-f','/data/local/tmp/sph-themes-layout.json');h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-themes-layout.json');h('file','recv','/data/local/tmp/sph-themes-layout.json',temp+'/tree.json');const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/tree.json')));return nodes;}
function capture(name){const file=root+'../OpenSPH-'+version+'-sph-theme-'+name+'.png';rmSync(file,{force:true});h('shell','rm','-f','/data/local/tmp/sph-themes-layout.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-themes-layout.png');h('file','recv','/data/local/tmp/sph-themes-layout.png',file);}
async function settled(predicate){for(let i=0;i<40;i++){const state=call('getState');if(predicate(state))return state;await delay(150);}throw Error('UI transition did not settle');}
const results=[];
try{
 call('listCommands');call('getUiState');action('ui.restore');
 for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<80;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&!s.rendering.cameraMoving)break;if(i===79)throw Error('window did not settle');await delay(150);}
  const within=n=>{const b=bounds(n),g=s.window.geometry;return b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1];};
  function visible(id){for(let i=0;i<22;i++){const nodes=tree(),sc=nodes.find(n=>n.type==='Scroll'&&within(n));assert.ok(sc);const b=bounds(sc),n=nodes.find(n=>{if(n.id!==id||!within(n))return false;const r=bounds(n),density=s.window.geometry.widthPx/s.window.widthVp;
    if(n.type==='Button'&&(r[3]-r[1])<35*density-4)return false;
    if(id.startsWith('theme-enter-')&&(r[3]-r[1])<(s.window.layout.compact?64:96)*density-4)return false;
    if(id==='sph-curve-plot'&&Math.abs((r[3]-r[1])-(r[2]-r[0])*100/240)>3)return false;
    return r[0]>=b[0]&&r[1]>=b[1]&&r[2]<=b[2]&&r[3]<=b[3];});if(n)return n;
    const x=Math.round((b[0]+b[2])/2);h('shell','uitest','uiInput','swipe',String(x),String(Math.round(b[1]+(b[3]-b[1])*.8)),String(x),String(Math.round(b[1]+(b[3]-b[1])*.35)),'450');}throw Error('missing visible '+id);}
  function tap(n){const b=bounds(n);h('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));}
  action('panel.close');action('panel.library');action('library.collision');await delay(1000);
  const enter=visible('theme-enter-resolution-fine');capture(name+'-library');tap(enter);
  const initial=await settled(s=>s.theme.id==='resolution-fine'&&s.simulation.state==='paused');assert.equal(initial.theme.id,'resolution-fine');assert.equal(initial.definition.config.count,1200);
  call('start',{},['--wait-state','completed']);action('panel.parameters');await delay(900);
  const before=call('getState'),observe=visible('theme-observe');tap(observe);
  const after=await settled(s=>s.ui.panel===1&&s.ui.panelOpen);assert.equal(after.ui.panel,1);assert.equal(after.ui.panelOpen,true);
  assert.deepEqual(after.definition,before.definition);assert.deepEqual(after.camera,before.camera);assert.equal(after.simulation.time,before.simulation.time);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);
  visible('sph-curve-plot');capture(name+'-curve');
  // Return through the semantic interface, then test the actual comparison hit.
  action('panel.parameters');await delay(900);const compare=visible('theme-compare');tap(compare);
  const coarse=await settled(s=>s.theme.id==='resolution-coarse'&&s.simulation.state==='paused');assert.equal(coarse.theme.id,'resolution-coarse');assert.equal(coarse.definition.config.count,200);assert.equal(coarse.window.immersive,true);assert.equal(coarse.rendering.error,'');
  assert.deepEqual(coarse.definition.config,{...initial.definition.config,count:200});
  results.push({name,window:after.window,taps:[{id:enter.id,bounds:bounds(enter)},{id:observe.id,bounds:bounds(observe)},{id:compare.id,bounds:bounds(compare)}],count:before.simulation.count,time:before.simulation.time,pressure:before.simulation.sph.pressureMaxGPa});
 }
 console.log(JSON.stringify({ok:true,device,checks:['actual new theme card, observe and compare button hits in three window shapes','fine collision completed in each shape; curve and themed cover screenshots','observing preserves scene camera time and native surface','comparison changes only particle budget and starts paused','immersive, no rendering error'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});h('shell','rm','-f','/data/local/tmp/sph-themes-layout.json','/data/local/tmp/sph-themes-layout.png');}
