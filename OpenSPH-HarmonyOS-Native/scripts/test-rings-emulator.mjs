#!/usr/bin/env node
// Visual/semantic acceptance on the development emulator; no touch/performance claim.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit development emulator required');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs';
const version=JSON.parse(readFileSync(root+'AppScope/app.json5','utf8')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=(action,wait)=>call('uiAction',{action},wait),delay=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(predicate=()=>true){for(let i=0;i<100;i++){const s=call('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady&&s.rendering.frames>1&&!s.rendering.cameraMoving&&predicate(s)){await delay(400);return call('getState');}await delay(250);}throw Error('Scene did not settle');}
async function capture(name){await settled();const file=root+'../OpenSPH-'+version+'-rings-'+name+'.png',remote='/data/local/tmp/sph-rings-'+Date.now()+'.png';rmSync(file,{force:true});h('shell','uitest','screenCap','-p',remote);h('file','recv',remote,file);h('shell','rm',remote);const data=readFileSync(file),width=data.readUInt32BE(16),height=data.readUInt32BE(20);
 const rgb=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-xerror','-f','image2','-pattern_type','none','-threads','1','-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:width*height*4,timeout:20000});
 assert.equal(rgb.length,width*height*3);return {width,height,rgb,body:call('getProjectedBodies').projection.bodies.find(b=>b.id===1)};}
function outerDifference(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let changed=0,total=0,n=0;const body=a.body,R=body.radius*a.height;
 for(let y=Math.max(0,Math.floor(body.y*a.height-R*2.3));y<Math.min(a.height,body.y*a.height+R*2.3);y++)for(let x=Math.max(0,Math.floor(body.x*a.width-R*2.3));x<Math.min(a.width,body.x*a.width+R*2.3);x++){
  const r=Math.hypot(x-body.x*a.width,y-body.y*a.height)/R;if(r<1.15||r>2.3)continue;let d=0;for(let k=0;k<3;k++)d+=Math.abs(a.rgb[(y*a.width+x)*3+k]-b.rgb[(y*b.width+x)*3+k]);if(d>12)changed++;total+=d;n+=3;
 }return {changed,mean:total/n};}
const results=[];
call('listCommands');call('getUiState');h('shell','hidumper','-s','DisplayManagerService','-a','-y');call('setWindowOrientation',{orientation:'portrait'});
const catalog=call('listExperiments'),theme=catalog.experiments.find(t=>t.id==='ring-world');assert.ok(theme);assert.equal(catalog.experiments.length,7);
action('theme.ring-world','paused');call('setAppearance',{autoSpin:false});await settled();
const original=call('getState');assert.equal(original.simulation.time,0);assert.equal(original.definition.config.orbitBodies[1].surface,4);
await capture('wide');call('setSky',{mode:0});action('ui.focus');const on=await capture('on');
action('appearance.rings');const off=await capture('off');assert.equal(call('getState').appearance.rings,false);const frontDiff=outerDifference(on,off);assert.ok(frontDiff.changed>1000&&frontDiff.mean>1,'ring toggle has no exterior pixels');results.push({view:'front',difference:frontDiff});
const before=call('getState');const rejected=spawnSync(process.execPath,[cli,'--device',device,'--command','setAppearance','--payload-json','{"rings":"bad","clouds":false}'],{encoding:'utf8'});assert.equal(rejected.status,2);assert.deepEqual(call('getState').appearance,before.appearance);
for(const [name,yaw,pitch] of [['edge',0,0],['back',.4,-.7]]){
 call('setCamera',{yaw,pitch,zoom:2.7,focus:1,color:0});call('setAppearance',{rings:true});const a=await capture(name+'-on');call('setAppearance',{rings:false});const b=await capture(name+'-off');const diff=outerDifference(a,b);
 if(name==='edge')assert.ok(diff.changed<40,'edge-on ring should have zero projected area');else assert.ok(diff.changed>1000,'back face missing');results.push({view:name,difference:diff});
}
call('setAppearance',{rings:true});call('setCamera',{yaw:theme.yaw,pitch:theme.pitch,zoom:theme.zoom,focus:1,color:0});call('setSky',{mode:2});action('ui.restore');
action('surface.toggle');await settled();action('surface.1');call('setAppearance',{autoSpin:false});await settled();
for(const [name,folded,orientation] of [['phone',true,'portrait'],['landscape',true,'landscape']]){
 h('shell','hidumper','-s','DisplayManagerService','-a',folded?'-p':'-y');call('setWindowOrientation',{orientation});
 const s=await settled(s=>(orientation==='portrait'?s.window.geometry.heightPx>s.window.geometry.widthPx:s.window.geometry.widthPx>s.window.geometry.heightPx)&&Math.min(s.window.geometry.widthPx,s.window.geometry.heightPx)<1500);
 const shot=await capture(name),b=shot.body,R=b.radius*shot.height*2.26;
 assert.ok(b.x*shot.width-R>=0&&b.x*shot.width+R<=shot.width&&b.y*shot.height-R>=0&&b.y*shot.height+R<=shot.height,'ring envelope clipped');assert.equal(s.window.immersive,true);results.push({layout:name,width:shot.width,height:shot.height,body:b});
}
let s=call('getState');assert.equal(s.rendering.sceneRevision,original.rendering.sceneRevision);assert.equal(s.simulation.time,0);assert.deepEqual(s.definition,original.definition);
// Native integration of the new themed body remains the existing point-mass model.
call('start',{},'completed');s=call('getState');assert.equal(s.simulation.time,1);assert.equal(s.simulation.count,2);assert.equal(s.rendering.error,'');
writeFileSync(root+'docs/evidence/rings-'+version+'-device-tests.json',JSON.stringify({ok:true,device,version,checks:['seven-entry catalog','visible ring pixels on both faces','edge-on ring has zero exterior area','atomic appearance rejection','toggle/navigation/rotation preserve native scene','ring envelope fits folded portrait and landscape','one-year point-mass integration'],results,final:s},null,2)+'\n');console.log(JSON.stringify({ok:true,results}));
