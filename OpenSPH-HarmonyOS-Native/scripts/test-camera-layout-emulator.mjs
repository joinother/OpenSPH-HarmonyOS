#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs';
const version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const temp=mkdtempSync(tmpdir()+'/sph-camera-layout-');
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},flags=[])=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...flags],{encoding:'utf8',timeout:35000}));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
try{
 call('listCommands');call('getUiState');call('uiAction',{action:'preset.5'},['--wait-state','paused']);call('uiAction',{action:'panel.close'});
 const baseline=call('getState');
 for(const [name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  const flight=call('navigateCamera',{focus:1,closeup:true,durationMs:3000}).cameraMotion;
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});
  let s;
  for(let i=0;i<40;i++){
   s=call('getState');const g=s.window.geometry;
   if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000)&&s.cameraMotion.state==='completed')break;
   if(i===39)throw Error('Window/camera did not settle');await delay(100);
  }
  assert.equal(s.cameraMotion.requestId,flight.requestId);assert.equal(s.rendering.sceneRevision,baseline.rendering.sceneRevision);assert.equal(s.simulation.time,baseline.simulation.time);assert.equal(s.window.immersive,true);
  call('navigateCamera',{focus:2,closeup:true,durationMs:3000});
  h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-camera-layout.json');h('file','recv','/data/local/tmp/sph-camera-layout.json',temp+'/layout.json');
  const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/layout.json')));
  const stop=nodes.find(n=>n.text==='停在这里');assert.ok(stop,'Stop control visible during flight');const bounds=stop.bounds.match(/-?\d+/g).map(Number);
  assert.ok(bounds[0]>=0&&bounds[1]>=0&&bounds[2]<=s.window.geometry.widthPx&&bounds[3]<=s.window.geometry.heightPx);
  const screenshot=root+'../OpenSPH-'+version+'-camera-'+name+'.png';rmSync(screenshot,{force:true});h('shell','rm','-f','/data/local/tmp/sph-camera.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-camera.png');h('file','recv','/data/local/tmp/sph-camera.png',screenshot);
  const touchFlight=call('navigateCamera',{focus:1,closeup:true,durationMs:3000}).cameraMotion;
  // Coordinate injection is confined to the actual hit-area acceptance test.
  h('shell','uitest','uiInput','click',String(Math.round((bounds[0]+bounds[2])/2)),String(Math.round((bounds[1]+bounds[3])/2)));
  const cancelled=call('getCameraMotion',{requestId:touchFlight.requestId}).cameraMotion;assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.reason,'user');
  const dragFlight=call('navigateCamera',{focus:2,closeup:true,durationMs:3000}).cameraMotion;
  const g=s.window.geometry,x=Math.round(g.widthPx*.45),y=Math.round(g.heightPx*.5);
  h('shell','uitest','uiInput','swipe',String(x),String(y),String(Math.round(g.widthPx*.6)),String(y),'400');
  const interrupted=call('getCameraMotion',{requestId:dragFlight.requestId}).cameraMotion;assert.equal(interrupted.state,'cancelled');assert.equal(interrupted.reason,'user');
  const after=call('getState');assert.equal(after.rendering.sceneRevision,baseline.rendering.sceneRevision);assert.equal(after.rendering.error,'');
  results.push({name,window:s.window,flightAfterResize:s.cameraMotion,stopBounds:bounds,touch:cancelled,gesture:interrupted,screenshot});
 }
 console.log(JSON.stringify({ok:true,device,checks:['fold/unfold/rotation retains the same camera request','immersive window','visible stop control inside window','actual stop-button touch hit','drag interrupts flight','solver revision/time unchanged'],results},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
