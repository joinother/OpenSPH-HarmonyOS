#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',temp=mkdtempSync(tmpdir()+'/sph-comparison-layout-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:35000}));
const action=action=>call('uiAction',{action}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const bounds=n=>n.bounds.match(/-?\d+/g).map(Number);
function tree(){h('shell','rm','-f','/data/local/tmp/sph-comparison-layout.json');h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-comparison-layout.json');h('file','recv','/data/local/tmp/sph-comparison-layout.json',temp+'/tree.json');const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/tree.json')));return nodes;}
function capture(name){const file=root+'../OpenSPH-'+version+'-comparison-'+name+'.png';rmSync(file,{force:true});h('shell','rm','-f','/data/local/tmp/sph-comparison-layout.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-comparison-layout.png');h('file','recv','/data/local/tmp/sph-comparison-layout.png',file);}
const results=[];
try{
 call('listCommands');call('getUiState');
 assert.equal(call('getObservationReference').reference,null,'preserve existing reference before this test');
 action('ui.restore');
 for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<80;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&!s.rendering.cameraMoving)break;if(i===79)throw Error('window did not settle');await delay(150);}
  call('setScene',{preset:3,count:600,speed:.85,angle:0,duration:2},['--wait-state','paused']);call('start',{},['--wait-state','completed']);call('setAppearance',{autoSpin:false});
  const within=n=>{const b=bounds(n),g=s.window.geometry;return b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1];};
  action('panel.close');action('panel.observe');action('observation.distance');await delay(500);
  function visible(id){for(let i=0;i<12;i++){const nodes=tree(),sc=nodes.find(n=>n.type==='Scroll'&&within(n));assert.ok(sc);const b=bounds(sc),n=nodes.find(n=>{if(n.id!==id||!within(n))return false;const r=bounds(n);if(id.startsWith('comparison-')&&n.type==='Button'&&(r[3]-r[1])<36*s.window.geometry.widthPx/s.window.widthVp-4)return false;if(id==='observation-plot'&&Math.abs((r[3]-r[1])-(r[2]-r[0])*100/240)>3)return false;return r[0]>=b[0]&&r[1]>=b[1]&&r[2]<=b[2]&&r[3]<=b[3];});if(n)return n;const x=Math.round((b[0]+b[2])/2);h('shell','uitest','uiInput','swipe',String(x),String(Math.round(b[1]+(b[3]-b[1])*.8)),String(x),String(Math.round(b[1]+(b[3]-b[1])*.35)),'450');}throw Error('missing visible '+id);}
  function tap(n){const b=bounds(n);h('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));}
  const initial=call('getState'),button=visible('comparison-capture');tap(button);const reference=call('getObservationReference').reference;
  assert.equal(reference.data.samples.length,240);assert.deepEqual(call('getState').simulation,initial.simulation);
  call('setScene',{preset:3,count:600,speed:1,angle:0,duration:2},['--wait-state','paused']);call('start',{},['--wait-state','completed']);action('surface.1');
  action('panel.close');action('panel.observe');action('observation.distance');await delay(500);
  const before=call('getState'),baseline=call('getOrbitObservation').data.samples,plot=visible('observation-plot');
  const comparison=call('getObservationComparison');assert.equal(comparison.chart.referenceVisible,true);assert.notEqual(comparison.chart.referencePath,comparison.chart.plot.path);capture(name);
  const toggle=visible('comparison-toggle'),caption=tree().find(n=>n.id==='comparison-reference');assert.ok(caption);assert.match(caption.text,/双体轨道/);assert.match(caption.text,/240/);
  tap(toggle);assert.equal(call('getObservationComparison').chart.referenceVisible,false);assert.deepEqual(call('getObservationReference').reference,reference);
  tap(visible('comparison-toggle'));assert.equal(call('getObservationComparison').chart.referenceVisible,true);visible('comparison-delta');capture('controls-'+name);
  const clear=visible('comparison-clear');tap(clear);assert.equal(call('getObservationReference').reference,null);
  const after=call('getState');assert.deepEqual(after.simulation,before.simulation);assert.deepEqual(after.camera,before.camera);assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);assert.equal(after.window.immersive,true);assert.equal(after.rendering.error,'');assert.deepEqual(call('getOrbitObservation').data.samples,baseline);
  results.push({name,window:after.window,buttonBounds:bounds(button),plotBounds:bounds(plot),toggleBounds:bounds(toggle),clearBounds:bounds(clear),referenceCaption:caption.text,comparison});
 }
 console.log(JSON.stringify({ok:true,device,checks:['wide, folded portrait and landscape remain immersive','actual capture tap preserves simulation and saves 240 samples','two distinct curves fit fully inside scroll viewport','reference provenance visible','actual hide/show/clear taps preserve current simulation, camera and surface'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});h('shell','rm','-f','/data/local/tmp/sph-comparison-layout.json','/data/local/tmp/sph-comparison-layout.png');}
