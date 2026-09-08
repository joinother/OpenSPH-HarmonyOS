#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:20000});
const call=(command,payload={},wait)=>{const args=[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload)];if(wait)args.push('--wait-state',wait);return JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8',timeout:40000}));};
const action=action=>call('uiAction',{action}),delay=ms=>new Promise(r=>setTimeout(r,ms));
const temp=mkdtempSync(tmpdir()+'/sph-galaxy-layout-'),version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const capture=name=>{const remote='/data/local/tmp/sph-galaxy-layout.png',local=root+'../OpenSPH-'+version+'-galaxy-'+name+'.png';h('shell','rm','-f',remote);rmSync(local,{force:true});h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,local);const png=readFileSync(local);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let at=8;while(at+12<=png.length){const size=png.readUInt32BE(at),kind=png.subarray(at+4,at+8).toString();at+=size+12;if(kind==='IEND')break;}assert.equal(at,png.length);assert.equal(png.subarray(-8,-4).toString(),'IEND');};
const layouts=[];call('listCommands');call('getUiState');
call('loadReplay');call('seek',{frame:0});action('panel.close');action('camera.reset');h('shell','hidumper','-s','DisplayManagerService','-a','-y');call('setWindowOrientation',{orientation:'portrait'});await delay(1000);capture('initial');
call('seek',{frame:100});const baseline=call('getGalaxyDiagnostics');assert.equal(baseline.time,400);
for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
 h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');await delay(700);call('setWindowOrientation',{orientation});await delay(900);
 action('panel.close');action('camera.reset');await delay(650);const before=call('getState');assert.equal(before.window.immersive,true);assert.equal(before.rendering.error,'');assert.equal(before.simulation.time,400);assert.equal(before.simulation.model,'galaxy-tidal-restricted-v1');
 const g=before.window.geometry;assert.ok(orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx);
 // Actual viewport gesture, not a coordinate substitute for semantic controls.
 h('shell','uitest','uiInput','swipe',String(Math.round(g.widthPx*.40)),String(Math.round(g.heightPx*.44)),String(Math.round(g.widthPx*.52)),String(Math.round(g.heightPx*.49)),'400');await delay(500);
 const dragged=call('getState');assert.notEqual(dragged.camera.yaw,before.camera.yaw);assert.equal(dragged.simulation.time,400);assert.deepEqual(dragged.simulation.galaxy,before.simulation.galaxy);
 action('camera.reset');await delay(600);capture(name);
 action('panel.observe');await delay(700);const observed=call('getState');assert.equal(observed.simulation.time,400);assert.equal(observed.rendering.sceneRevision,before.rendering.sceneRevision);assert.ok(observed.rendering.compositionScale<1);assert.equal(observed.rendering.error,'');
 h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-galaxy-layout.json');h('file','recv','/data/local/tmp/sph-galaxy-layout.json',temp+'/'+name+'.json');const tree=readFileSync(temp+'/'+name+'.json','utf8');assert.ok(tree.includes('潮汐正在改变什么'));assert.ok(tree.includes('两个中心相距'));
 if(name==='wide')capture('observe');layouts.push({name,before,dragged,observed});
}
console.log(JSON.stringify({ok:true,device,checks:['expanded portrait, folded portrait and folded landscape','real viewport drag changes camera without recomputing','immersive view and correct time units','observation panel keeps galaxy and model diagnostics','layout tree exposes galaxy metrics','initial and evolved screenshots'],baseline,layouts},null,2));
