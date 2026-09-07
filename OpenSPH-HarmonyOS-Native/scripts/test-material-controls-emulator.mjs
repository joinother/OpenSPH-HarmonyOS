#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',temp=mkdtempSync(tmpdir()+'/sph-material-controls-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:35000}));
const action=id=>call('uiAction',{action:id}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
function tree(){h('shell','rm','-f','/data/local/tmp/sph-material-controls.json');h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-material-controls.json');h('file','recv','/data/local/tmp/sph-material-controls.json',temp+'/layout.json');const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/layout.json')));return nodes;}
try{
 call('listCommands');call('getUiState');call('uiAction',{action:'preset.5'},['--wait-state','paused']);action('ui.restore');call('setAppearance',{autoSpin:false});
 call('navigateCamera',{focus:1,closeup:true,durationMs:420},['--wait-camera']);const baseline=call('getState');
 for(const [name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});
  let s;for(let i=0;i<40;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000))break;if(i===39)throw Error('window did not settle');await delay(100);}
  action('material.reset');call('setPanel',{panel:1});await delay(450);const nodes=tree();
  const slider=nodes.find(n=>n.id==='material.exposure'),ocean=nodes.find(n=>n.text==='海洋反光'),shadow=nodes.find(n=>n.text==='云影');assert.ok(slider&&ocean&&shadow,'material controls visible');
  const bounds=n=>{const b=n.bounds.match(/-?\d+/g).map(Number),g=s.window.geometry;assert.ok(b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1]);return b;};
  const b=bounds(slider),o=bounds(ocean);bounds(shadow);const y=Math.round((b[1]+b[3])/2);
  // Physical injection is only for slider gesture and control hit-area acceptance.
  h('shell','uitest','uiInput','swipe',String(Math.round((b[0]+b[2])/2)),String(y),String(Math.round(b[0]+(b[2]-b[0])*.78)),String(y),'400');
  const dragged=call('getState');assert.ok(dragged.material.exposure>.3,'slider drag did not reach shared material input');
  h('shell','uitest','uiInput','click',String(Math.round((o[0]+o[2])/2)),String(Math.round((o[1]+o[3])/2)));
  const touched=call('getState');assert.equal(touched.material.ocean,false);assert.equal(touched.simulation.time,baseline.simulation.time);assert.equal(touched.rendering.sceneRevision,baseline.rendering.sceneRevision);assert.equal(touched.cameraMotion.requestId,baseline.cameraMotion.requestId);assert.equal(touched.window.immersive,true);assert.equal(touched.rendering.error,'');
  const screenshot=root+'../OpenSPH-'+version+'-material-controls-'+name+'.png';rmSync(screenshot,{force:true});h('shell','rm','-f','/data/local/tmp/sph-material-controls.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-material-controls.png');h('file','recv','/data/local/tmp/sph-material-controls.png',screenshot);
  results.push({name,window:touched.window,sliderBounds:b,oceanBounds:o,material:touched.material,requestId:touched.cameraMotion.requestId,screenshot});
 }
 console.log(JSON.stringify({ok:true,device,checks:['wide, folded portrait and landscape controls inside window','actual slider drag reaches shared input','actual ocean button toggles shader option','camera request, solver time and scene preserved','immersive'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
