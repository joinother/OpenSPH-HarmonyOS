#!/usr/bin/env node
import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs';
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:45000}));
const action=(action,wait)=>call('uiAction',{action},wait),input=(field,value)=>call('setUiValue',{field,value});const delay=ms=>new Promise(r=>setTimeout(r,ms));
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:20000});
async function pointAt(x,y){for(let i=0;i<30;i++){const p=call('getProjectedBodies').projection,b=p.bodies.find(b=>b.id===p.candidate);if(p.ready&&p.placement&&b&&Math.abs(b.x-x)*p.widthPx<2&&Math.abs(b.y-y)*p.heightPx<2)return p;await delay(100);}throw Error('Candidate failed to reach clicked screen point');}
async function ready(){for(let i=0;i<30;i++){const p=call('getProjectedBodies').projection;if(p.ready&&p.placement&&p.candidate>=0)return p;await delay(100);}throw Error('No presented candidate');}
function tree(){const file='/data/local/tmp/opensph-placement-layout.json',local=root+'build/placement-layout.json';h('shell','rm','-f',file);h('shell','uitest','dumpLayout','-p',file);h('file','recv',file,local);const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(local)));return nodes;}
call('listCommands');call('getUiState');if(call('getState').placement.active)action('placement.cancel');action('preset.5','paused');call('start',{},'completed');call('seek',{frame:40});action('panel.close');input('orbit.name','原有天体草稿');const before=call('getState');
action('orbit.add');await ready();const results=[];
for(const[name,fold,orientation]of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
 const old=call('getPlacementPreview').preview;
 h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');await delay(800);call('setWindowOrientation',{orientation});await delay(600);await ready();
 assert.deepEqual(call('getPlacementPreview').preview.body,old.body);
 const s=call('getState');assert.equal(s.simulation.time,before.simulation.time);assert.equal(s.rendering.sceneRevision,before.rendering.sceneRevision);
 call('setViewportPlacementPoint',{x:.7,y:.54});await pointAt(.7,.54);
 // Explicit touch hit/drag acceptance, not routine navigation.
 const g=s.window.geometry,x=.73,y=.57;h('shell','uitest','uiInput','click',String(Math.round(x*g.widthPx)),String(Math.round(y*g.heightPx)));const tapped=await pointAt(x,y);
 h('shell','uitest','uiInput','swipe',String(Math.round(x*g.widthPx)),String(Math.round(y*g.heightPx)),String(Math.round(.77*g.widthPx)),String(Math.round(.62*g.heightPx)),'500');const dragged=await pointAt(.77,.62);
 action('placement.options');input('placement.value.3','35');action('placement.align');action('placement.options');await delay(600);call('setViewportPlacementPoint',{x:.65,y:.58});const tilted=await pointAt(.65,.58);
 action('placement.target.1');action('placement.surface.4');await delay(700);const preview=call('getPlacementPreview').preview;assert.equal(preview.valid,true);
 const nodes=tree(),dock=nodes.find(n=>n.id==='placement-dock');assert.ok(dock);const bounds=dock.bounds.match(/-?\d+/g).map(Number);assert.ok(bounds[0]>=0&&bounds[1]>=0&&bounds[2]<=g.widthPx&&bounds[3]<=g.heightPx);
 const screenshot=root+'../OpenSPH-0.41.0-placement-'+name+'.png';h('shell','rm','-f','/data/local/tmp/opensph-placement.png');h('shell','uitest','screenCap','-p','/data/local/tmp/opensph-placement.png');h('file','recv','/data/local/tmp/opensph-placement.png',screenshot);
 results.push({name,window:s.window,tapped,dragged,tilted,preview,dock:bounds});
}
action('placement.cancel');let restored=call('getState');assert.deepEqual(restored.definition,before.definition);assert.deepEqual(restored.camera,before.camera);assert.equal(restored.editor.orbitName,'原有天体草稿');assert.equal(restored.simulation.time,before.simulation.time);assert.equal(restored.simulation.frames,before.simulation.frames);
action('orbit.add');await ready();call('setViewportPlacementPoint',{x:.7,y:.57});action('placement.target.2');action('placement.surface.3');const candidate=call('getPlacementPreview').preview;action('placement.confirm','paused');const after=call('getState');assert.deepEqual(after.definition.config.orbitBodies.at(-1),candidate.body);assert.equal(after.simulation.time,0);assert.equal(after.simulation.count,5);assert.equal(after.placement.active,false);
action('orbit.undo','paused');assert.deepEqual(call('getState').definition.config.orbitBodies,before.definition.config.orbitBodies);
console.log(JSON.stringify({ok:true,device,checks:['Actual main viewport semantic placement + touch hit and drag in expanded/folded portrait and landscape','Candidate follows inclined plane with exact presented projection; fold/rotation preserves pending body','Textured candidate and launch direction; parameter drawer leaves main viewport available','Cancel preserves original replay time, history, camera and body draft','One confirm commits exact candidate; undo restores original bodies'],before,results,candidate,after},null,2));
