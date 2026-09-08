#!/usr/bin/env node
// Read capabilities and check the unsupported-device UX. Does not create a video or replace the experiment.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];assert.equal(device,'127.0.0.1:5555');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const args=(command,payload={})=>[cli,'--device',device,'--timeout','60000','--command',command,'--payload-json',JSON.stringify(payload)];
const call=(command,payload={})=>JSON.parse(execFileSync(process.execPath,args(command,payload),{encoding:'utf8',timeout:70000,maxBuffer:8*1024*1024}));
const action=action=>call('uiAction',{action});call('listCommands');call('getUiState');
const before=call('getState'),initial=call('getVideoState');const capabilities=call('getVideoCapabilities');
assert.ok(!capabilities.encoders.some(e=>e.type==='video'),'This check is only for the encoder-less emulator; use the real-device acceptance guide for actual recording.');
action('video.open');assert.equal(call('getVideoState').dialogOpen,true);action('video.quality.1920');assert.equal(call('getVideoState').quality,1920);
const result=spawnSync(process.execPath,args('uiAction',{action:'video.start'}),{encoding:'utf8',timeout:70000});assert.equal(result.status,2);assert.match(JSON.parse(result.stdout).error,/H.264/);
const failed=call('getVideoState');assert.equal(failed.video.state,'error');assert.equal(failed.video.frames,0);assert.deepEqual(failed.video.clips,initial.video.clips);assert.match(failed.video.error,/真机/);
action('video.reload');action('video.quality.1280');action('video.close');
const after=call('getState');assert.deepEqual(after.definition,before.definition);assert.equal(after.simulation.frames,before.simulation.frames);assert.equal(after.simulation.time,before.simulation.time);assert.equal(after.rendering.error,'');
console.log(JSON.stringify({ok:true,device,capabilities,failed,checks:['Shared video actions and quality choices','Explicit unsupported H.264 result without software substitution','No invalid clip published; native output detached and simulation unchanged'],notVerified:['Real-device recording, encoded picture/color/timing, lifecycle finalization, export picker and playback']},null,2));
