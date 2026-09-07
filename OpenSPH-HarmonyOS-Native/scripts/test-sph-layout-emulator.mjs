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
function capture(name){const file=root+'../OpenSPH-'+version+'-sph-'+name+'.png';rmSync(file,{force:true});h('shell','rm','-f','/data/local/tmp/sph-diagnostic-layout.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-diagnostic-layout.png');h('file','recv','/data/local/tmp/sph-diagnostic-layout.png',file);}
const results=[];
try{
 call('listCommands');call('getUiState');
 call('setScene',{preset:0,count:600,speed:5,angle:0,duration:20,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234},['--wait-state','paused']);call('start',{},['--wait-state','completed']);action('ui.restore');
 for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});let s;
  for(let i=0;i<80;i++){s=call('getState');const g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&!s.rendering.cameraMoving)break;if(i===79)throw Error('window did not settle');await delay(150);}
  const within=n=>{const b=bounds(n),g=s.window.geometry;return b[0]>=0&&b[1]>=0&&b[2]<=g.widthPx&&b[3]<=g.heightPx&&b[2]>b[0]&&b[3]>b[1];};
  action('panel.close');action('panel.observe');action('color.0');await delay(1200);
  const framed=call('getState');assert.ok(framed.rendering.compositionScale<1);const region=framed.window.layout.scene;
  assert.ok(Math.abs(framed.rendering.compositionX-(region.x+region.width/2)/framed.window.viewportWidthVp)<.005);assert.ok(Math.abs(framed.rendering.compositionY-(region.y+region.height/2)/framed.window.viewportHeightVp)<.005);
  function visible(id){for(let i=0;i<12;i++){const nodes=tree(),sc=nodes.find(n=>n.type==='Scroll'&&within(n));assert.ok(sc);const b=bounds(sc),n=nodes.find(n=>{if(n.id!==id||!within(n))return false;const r=bounds(n);if(id.startsWith('sph-')&&n.type==='Button'&&(r[3]-r[1])<36*s.window.geometry.widthPx/s.window.widthVp-4)return false;if(id==='observation-plot'&&Math.abs((r[3]-r[1])-(r[2]-r[0])*100/240)>3)return false;return r[0]>=b[0]&&r[1]>=b[1]&&r[2]<=b[2]&&r[3]<=b[3];});if(n)return n;const x=Math.round((b[0]+b[2])/2);h('shell','uitest','uiInput','swipe',String(x),String(Math.round(b[1]+(b[3]-b[1])*.8)),String(x),String(Math.round(b[1]+(b[3]-b[1])*.35)),'450');}throw Error('missing visible '+id);}
  function tap(n){const b=bounds(n);h('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));}
  const before=call('getState'),taps=[];
  for(const[id,color]of [['sph-pressure',3],['sph-internal',4],['sph-damage',5]]){
    const button=visible(id);tap(button);const after=call('getState');assert.equal(after.camera.color,color);
    assert.deepEqual(after.simulation,before.simulation);assert.deepEqual(after.definition,before.definition);assert.equal(after.camera.yaw,before.camera.yaw);assert.equal(after.camera.pitch,before.camera.pitch);assert.equal(after.camera.zoom,before.camera.zoom);assert.equal(after.camera.focus,before.camera.focus);
    assert.equal(after.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(after.rendering.surfaceStarts,before.rendering.surfaceStarts);assert.equal(after.window.immersive,true);assert.equal(after.rendering.error,'');
    const legend=visible('sph-legend');assert.ok(legend.text.length>10);if(name==='wide'||color===5)capture(name+'-'+color);
    taps.push({id,color,bounds:bounds(button),legend:legend.text});
  }
  results.push({name,window:before.window,composition:{x:framed.rendering.compositionX,y:framed.rendering.compositionY,scale:framed.rendering.compositionScale},taps,diagnostics:call('getSphDiagnostics')});
 }
 console.log(JSON.stringify({ok:true,device,checks:['three new scalar modes actually tapped in expanded, folded portrait and folded landscape','visible color legends and units','simulation, selected frame, camera pose and native surface preserved','immersive window and no rendering errors'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});h('shell','rm','-f','/data/local/tmp/sph-diagnostic-layout.json','/data/local/tmp/sph-diagnostic-layout.png');}
