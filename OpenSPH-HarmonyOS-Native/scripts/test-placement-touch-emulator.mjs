#!/usr/bin/env node
// Coordinates are used only to verify the new plot's tap/drag recognizers.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url)),temp=mkdtempSync(join(tmpdir(),'sph-placement-'));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 call('listCommands');call('getUiState');if(call('getState').placement.active)call('uiAction',{action:'placement.cancel'});call('uiAction',{action:'preset.5'},'paused');call('uiAction',{action:'orbit.add'});await delay(700);
 const remote='/data/local/tmp/sph-placement-layout-'+Date.now()+'.json',local=join(temp,'layout.json');h('shell','uitest','dumpLayout','-p',remote);h('file','recv',remote,local);h('shell','rm',remote);
 const nodes=[];function walk(v){if(!v||typeof v!=='object')return;if(v.attributes?.id==='placement-plot'||v.attributes?.id==='workspace-drawer')nodes.push(v.attributes);for(const [k,x]of Object.entries(v))if(k!=='attributes')walk(x);}
 walk(JSON.parse(readFileSync(local,'utf8')));const rect=id=>{const n=nodes.find(x=>x.id===id);assert.ok(n);return n.bounds.match(/-?\d+/g).map(Number);};
 const r=rect('placement-plot'),d=rect('workspace-drawer');assert.ok(r[1]>=d[1]&&r[3]<=d[3],'whole plot visible without scrolling');
 const x=r[0]+(r[2]-r[0])*.73,y=r[1]+(r[3]-r[1])*.34;
 const before=call('getState');h('shell','uitest','uiInput','click',String(Math.round(x)),String(Math.round(y)));await delay(250);let s=call('getState');
 assert.ok(Math.abs(s.placement.preview.candidateX/240-.73)<.02);assert.ok(Math.abs(s.placement.preview.candidateY/240-.34)<.02);
 const ex=r[0]+(r[2]-r[0])*.63,ey=r[1]+(r[3]-r[1])*.24;
 h('shell','uitest','uiInput','swipe',String(Math.round(x)),String(Math.round(y)),String(Math.round(ex)),String(Math.round(ey)),'600');await delay(250);s=call('getState');
 assert.ok(Math.abs(s.placement.preview.candidateX/240-.63)<.035);assert.ok(Math.abs(s.placement.preview.candidateY/240-.24)<.035);
 assert.deepEqual(s.camera,before.camera);assert.equal(s.rendering.sceneRevision,before.rendering.sceneRevision);assert.equal(s.rendering.surfaceStarts,before.rendering.surfaceStarts);assert.deepEqual(s.definition,before.definition);
 call('uiAction',{action:'placement.cancel'});
 console.log(JSON.stringify({ok:true,device,checks:['plot wholly visible','actual plot tap','actual plot drag','drag does not rotate underlying viewport','scene and surface preserved'],plot:r,drawer:d,state:s},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
