#!/usr/bin/env node
// Uses real main-window orientation and simulator folding; no fake viewport sizes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit development emulator required');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const project=fileURLToPath(new URL('../',import.meta.url));
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const temp=mkdtempSync(join(tmpdir(),'sph-window-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const h=(...args)=>execFileSync(hdc,['-t',device,...args],{encoding:'utf8',timeout:15000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=id=>call('uiAction',{action:id});
function rectInside(a,b,t=3){return a[0]>=b[0]-t&&a[1]>=b[1]-t&&a[2]<=b[2]+t&&a[3]<=b[3]+t;}
function overlaps(a,b){return Math.min(a[2],b[2])-Math.max(a[0],b[0])>3&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>3;}
function uiBounds(){const remote='/data/local/tmp/sph-window-layout.json';h('shell','uitest','dumpLayout','-p',remote);const local=join(temp,'ui.json');h('file','recv',remote,local);h('shell','rm',remote);const nodes=[];
 function walk(v){if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;const a=v.attributes;if(a?.bounds)nodes.push({...a,rect:(a.bounds.match(/-?\d+/g)||[]).map(Number)});for(const [k,x] of Object.entries(v))if(k!=='attributes')walk(x);}
 walk(JSON.parse(readFileSync(local,'utf8')));return nodes;
}
async function settled(folded,orientation){let previous='',stable=0;
 for(let i=0;i<80;i++){const s=call('getState'),g=s.window.geometry,p=call('getProjectedBodies').projection;
 const landscape=g.widthPx>g.heightPx;
 const shape=(orientation==='portrait'?!landscape:landscape)&&(folded?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000);
 const aligned=p.ready&&Math.abs(p.widthPx-g.widthPx)<4&&Math.abs(p.heightPx-g.heightPx)<4;
 const key=JSON.stringify([s.window.viewportWidthVp,s.window.viewportHeightVp,g.topPx,g.bottomPx,g.leftPx,g.rightPx,p.widthPx,p.heightPx]);
 if(shape&&aligned&&s.rendering.panoramaReady&&s.rendering.texturesReady&&s.rendering.error===''&&!s.rendering.cameraMoving){stable=key===previous?stable+1:0;if(stable>=3)return s;}else stable=0;
 previous=key;await delay(180);
 }throw Error('Window failed to settle: '+JSON.stringify(call('getState').window));
}
async function inspect(name,folded,orientation,reference){
 h('shell','hidumper','-s','DisplayManagerService','-a',folded?'-p':'-y');call('setWindowOrientation',{orientation});
 let s=await settled(folded,orientation);await delay(550);s=call('getState');
 assert.equal(s.rendering.sceneRevision,reference.rendering.sceneRevision,'scene restarted');
 assert.equal(s.window.immersive,true,'system bar policy failed');
 assert.deepEqual(s.definition,reference.definition,'initial conditions changed');
 assert.deepEqual(s.editor,reference.editor,'editor draft lost');assert.deepEqual(s.camera,reference.camera,'camera state changed');
 assert.equal(s.ui.panelOpen,reference.ui.panelOpen);assert.equal(s.ui.toolsVisible,reference.ui.toolsVisible);
 assert.equal(s.simulation.time,reference.simulation.time);assert.equal(s.simulation.frames,reference.simulation.frames);
 assert.deepEqual(s.placement,reference.placement,'placement draft lost');
 const nodes=uiBounds(),get=id=>{const node=nodes.find(n=>n.id===id);assert.ok(node,'missing '+id);return node.rect;};
 const viewport=get('universe-viewport');assert.deepEqual(viewport,[0,0,s.window.geometry.widthPx,s.window.geometry.heightPx],'native viewport must fill the window');
 const dock=get('workspace-transport'),header=get('workspace-header'),drawer=s.ui.panelOpen?get('workspace-drawer'):[0,0,0,0];
 for(const [id,r] of [['dock',dock],['header',header],...(s.ui.panelOpen?[['drawer',drawer]]:[])])assert.ok(rectInside(r,viewport),id+' outside viewport: '+JSON.stringify({r,viewport}));
 assert.ok(!overlaps(drawer,dock),'drawer overlaps transport');assert.ok(!overlaps(header,drawer),'header overlaps drawer');
 if(!s.ui.panelOpen){const bar=get('surface-bar');assert.ok(rectInside(bar,viewport),'surface bar clipped');assert.ok(!overlaps(bar,dock),'surface bar overlaps transport');}
 // Compare actual native body placement against visible UI, after animation.
 const projection=call('getProjectedBodies').projection;
 if(s.appearance.closeup){const body=projection.bodies.find(b=>b.id===s.camera.focus);assert.ok(body&&body.radius>0);
 const x=viewport[0]+body.x*projection.widthPx,y=viewport[1]+body.y*projection.heightPx,r=body.radius*projection.heightPx;
 const disk=[x-r,y-r,x+r,y+r];assert.ok(rectInside(disk,viewport,6),'body clipped');assert.ok(!overlaps(disk,drawer),'body under drawer');assert.ok(!overlaps(disk,dock),'body under dock');assert.ok(!overlaps(disk,header),'body under header');}
 const remote='/data/local/tmp/sph-window-'+name+'.png',file=project+'../OpenSPH-0.16.0-'+name+'.png';h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,file);h('shell','rm',remote);
 const result={name,folded,orientation,window:s.window,viewport,dock,drawer,header,sceneRevision:s.rendering.sceneRevision,surfaceStarts:s.rendering.surfaceStarts};
 writeFileSync(project+'docs/evidence/immersive-'+name+'-state.json',JSON.stringify(s,null,2)+'\n');return result;
}
const results=[];
const selected=process.argv[3]??'all';
try{
 h('shell','hidumper','-s','DisplayManagerService','-a','-p');call('setWindowOrientation',{orientation:'portrait'});
 call('setScene',JSON.parse(readFileSync(project+'examples/custom-system.json','utf8')),'paused');
 call('start',{},'completed');call('seek',{frame:20});call('setAppearance',{autoSpin:false});
 action('surface.1');call('setAppearance',{autoSpin:false});action('selection.edit');call('setUiValue',{field:'orbit.name',value:'折叠旋转保留草稿'});
 await settled(true,'portrait');let baseline=call('getState');
 for(const [name,folded,orientation] of [['fold-portrait',true,'portrait'],['fold-landscape',true,'landscape'],['fold-reverse',true,'reverse-landscape'],['unfold-landscape',false,'landscape'],['unfold-portrait',false,'portrait'],['refold-portrait',true,'portrait']])if(selected==='all'||selected===name)results.push(await inspect(name,folded,orientation,baseline));
 action('panel.close');action('surface.toggle');action('orbit.add');call('setUiValue',{field:'placement.name',value:'候选旋转保留'});
 baseline=call('getState');
 if(selected==='all'||selected==='placement-landscape')results.push(await inspect('placement-landscape',true,'landscape',baseline));
 if(selected==='all'||selected==='placement-unfold')results.push(await inspect('placement-unfold',false,'portrait',baseline));
 action('placement.cancel');baseline=call('getState');
 if(selected==='all'||selected==='overview-landscape')results.push(await inspect('overview-landscape',true,'landscape',baseline));
 assert.ok(results.length>0,'unknown phase filter');
 console.log(JSON.stringify({ok:true,device,checks:['actual fold/expand and main-window rotation','native viewport fills entire window; controls avoid safe area','actual UI bounds and panel/dock separation','near body visible above UI','editor and placement drafts preserved','scene revision, replay frame and camera preserved'],results},null,2));
}finally{
 try{call('setWindowOrientation',{orientation:'auto'});}catch{}
 rmSync(temp,{recursive:true,force:true});
}
