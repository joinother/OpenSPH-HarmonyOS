#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const args=(command,payload={},extra=[])=>[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...extra];
const call=(command,payload={},extra=[])=>JSON.parse(execFileSync(process.execPath,args(command,payload,extra),{encoding:'utf8',timeout:35000}));
const action=action=>call('uiAction',{action});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const query=id=>call('getCameraMotion',{requestId:id}).cameraMotion;
const evidence=[],checks=[];
call('listCommands');assert.ok(call('getUiState').actions.some(a=>a.id==='camera.cancel'));
call('uiAction',{action:'preset.5'},['--wait-state','paused']);action('panel.close');
call('setAppearance',{autoSpin:false,closeup:false});
call('navigateCamera',{focus:-1,yaw:.4,pitch:.3,zoom:3.1,durationMs:0},['--wait-camera']);
const initial=call('getState');
function preserved(s){assert.equal(s.rendering.sceneRevision,initial.rendering.sceneRevision);assert.equal(s.rendering.surfaceStarts,initial.rendering.surfaceStarts);assert.deepEqual(s.definition,initial.definition);for(const k of ['state','time','selected','frames'])assert.equal(s.simulation[k],initial.simulation[k],k);assert.equal(s.rendering.error,'');}
let first=call('navigateCamera',{focus:1,closeup:true,yaw:1.1,zoom:4,durationMs:3000}).cameraMotion;
await delay(150);const mid=query(first.requestId);assert.ok(mid.progress>0&&mid.progress<1);assert.equal(mid.state,'running');
const stopped=call('cancelCameraMotion',{requestId:first.requestId}).cameraMotion;assert.equal(stopped.state,'cancelled');assert.equal(stopped.reason,'user');
const a=call('getProjectedBodies').projection,sa=call('getState');await delay(250);const b=call('getProjectedBodies').projection,sb=call('getState');
assert.deepEqual(a.bodies,b.bodies);for(const k of ['centerX','centerY','centerZ'])assert.equal(sa.rendering[k],sb.rendering[k]);preserved(sb);
// Pure appearance updates do not silently resume a cancelled flight.
call('setAppearance',{clouds:false});assert.equal(query(first.requestId).state,'cancelled');
checks.push('native flight advances while solver paused; cancel freezes current projection; appearance does not resume it');evidence.push({first,mid,stopped,afterCancel:sb.cameraMotion});
const second=call('navigateCamera',{focus:2,closeup:true,durationMs:3000}).cameraMotion;
const superseding=call('navigateCamera',{focus:3,closeup:true,durationMs:3000}).cameraMotion;
assert.equal(query(second.requestId).reason,'superseded');call('cancelCameraMotion',{requestId:second.requestId});assert.equal(query(superseding.requestId).state,'running');
const done=call('navigateCamera',{focus:1,closeup:true,durationMs:250},['--wait-camera']);assert.equal(done.cameraMotion.state,'completed');assert.equal(done.cameraMotion.progress,1);preserved(call('getState'));
checks.push('rapid retarget records superseded result; stale cancel cannot affect newer request; CLI waits for matching completion');
const stable=call('getState');const bad=spawnSync(process.execPath,args('navigateCamera',{focus:99,closeup:true}),{encoding:'utf8'});assert.equal(bad.status,2);
const unchanged=call('getState');assert.equal(unchanged.cameraMotion.requestId,stable.cameraMotion.requestId);assert.deepEqual(unchanged.camera,stable.camera);preserved(unchanged);
call('navigateCamera',{focus:1,closeup:false,durationMs:0},['--wait-camera']);const distant=call('getState');action('selection.edit');const edited=call('getState');assert.equal(edited.appearance.closeup,false);assert.equal(edited.cameraMotion.requestId,distant.cameraMotion.requestId);preserved(edited);action('panel.close');
checks.push('invalid target leaves prior state intact; editing does not force close-up');
// Wait on the host, so another semantic command can still cancel the flight.
const previous=query(0).requestId;
const child=spawn(process.execPath,args('navigateCamera',{focus:2,closeup:true,durationMs:3000},['--wait-camera']),{stdio:['ignore','pipe','pipe']});
let output='',stderr='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>stderr+=x);
const exit=new Promise(resolve=>child.on('close',resolve));
let flight;for(let i=0;i<30;i++){const m=query(0);if(m.requestId>previous){flight=m;break;}await delay(50);}assert.ok(flight);action('camera.cancel');
const code=await exit;assert.equal(code,2,stderr);assert.equal(JSON.parse(output).cameraMotion.requestId,flight.requestId);assert.match(JSON.parse(output).error,/cancelled/);
checks.push('CLI wait remains cancellable through shared ArkUI action and exits with explicit cancellation');
call('uiAction',{action:'focus.all'},['--wait-camera']);const final=call('getState');preserved(final);assert.equal(final.appearance.closeup,false);assert.equal(final.camera.focus,-1);
console.log(JSON.stringify({ok:true,device,checks,initial,final,evidence},null,2));
