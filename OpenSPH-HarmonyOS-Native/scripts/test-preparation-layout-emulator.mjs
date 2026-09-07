#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',temp=mkdtempSync(tmpdir()+'/preparation-layout-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:70000}));
const action=action=>call('uiAction',{action}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const bounds=n=>n.bounds.match(/-?\d+/g).map(Number);
function tree(){h('shell','rm','-f','/data/local/tmp/preparation-layout.json');h('shell','uitest','dumpLayout','-p','/data/local/tmp/preparation-layout.json');h('file','recv','/data/local/tmp/preparation-layout.json',temp+'/tree.json');const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/tree.json')));return nodes;}
function capture(name){const file=root+'../OpenSPH-'+version+'-preparation-'+name+'.png';rmSync(file,{force:true});h('shell','rm','-f','/data/local/tmp/preparation-layout.png');h('shell','uitest','screenCap','-p','/data/local/tmp/preparation-layout.png');h('file','recv','/data/local/tmp/preparation-layout.png',file);}
async function settled(predicate){for(let i=0;i<40;i++){const state=call('getState');if(predicate(state))return state;await delay(150);}throw Error('UI transition did not settle');}
const results=[];
try{
 call('listCommands');call('getUiState');action('ui.restore');
 for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<80;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&!s.rendering.cameraMoving)break;if(i===79)throw Error('window did not settle');await delay(150);}
  const within=n=>{const b=bounds(n),g=s.window.geometry;return b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1];};
  function visible(id){for(let i=0;i<22;i++){const nodes=tree(),sc=nodes.find(n=>n.type==='Scroll'&&within(n));assert.ok(sc);const b=bounds(sc),n=nodes.find(n=>{if(n.id!==id||!within(n))return false;const r=bounds(n),density=s.window.geometry.widthPx/s.window.widthVp;
    if((n.type==='Button'||id==='simulation-stop')&&(r[3]-r[1])<35*density-4)return false;
    if(id.startsWith('theme-enter-')&&(r[3]-r[1])<(s.window.layout.compact?64:96)*density-4)return false;
    if(id==='sph-curve-plot'&&Math.abs((r[3]-r[1])-(r[2]-r[0])*100/240)>3)return false;
    return r[0]>=b[0]&&r[1]>=b[1]&&r[2]<=b[2]&&r[3]<=b[3];});if(n)return n;
    const x=Math.round((b[0]+b[2])/2);h('shell','uitest','uiInput','swipe',String(x),String(Math.round(b[1]+(b[3]-b[1])*.8)),String(x),String(Math.round(b[1]+(b[3]-b[1])*.35)),'450');}throw Error('missing visible '+id);}
  function tap(n){const b=bounds(n);h('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));}
  action('panel.close');call('uiAction',{action:'theme.resolution-coarse'},['--wait-state','paused']);call('setPanel',{panel:1});await delay(900);
  const before=call('getState'),stop=visible('simulation-stop');capture(name+'-stop');tap(stop);
  const cancelled=await settled(s=>s.simulation.state==='cancelled');assert.deepEqual(cancelled.definition,before.definition);assert.deepEqual(cancelled.camera,before.camera);assert.equal(cancelled.rendering.sceneRevision,before.rendering.sceneRevision+1);
  action('panel.close');await delay(900);const main=tree().find(n=>n.id===(s.window.layout.compact?'simulation-main-compact':'simulation-main')&&within(n));assert.ok(main);tap(main);
  const restarted=await settled(s=>s.simulation.state==='running'||s.simulation.state==='completed');assert.ok(restarted.simulation.preparation.requestId>before.simulation.preparation.requestId);assert.equal(restarted.window.immersive,true);assert.equal(restarted.rendering.error,'');
  action('simulation.cancel');
  results.push({name,window:cancelled.window,taps:[{id:stop.id,bounds:bounds(stop)},{id:main.id,bounds:bounds(main)}],preparation:before.simulation.preparation});
 }
 console.log(JSON.stringify({ok:true,device,checks:['actual stop and restart button hits in three window shapes','cancel preserves initial conditions and camera','restart uses a new preparation request','immersive and no rendering error'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});h('shell','rm','-f','/data/local/tmp/preparation-layout.json','/data/local/tmp/preparation-layout.png');}
