#!/usr/bin/env node
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const device=process.argv[2];
if(!device||!/^[A-Za-z0-9_.:-]+$/.test(device)) throw Error('Usage: node scripts/test-cli-emulator.mjs <explicit HDC device ID>');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
const hdc=process.env.HDC||'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
function cmd(command,payload={},expectError=false) {
  const r=spawnSync(process.execPath,[cli,'--device',device,'--hdc',hdc,'--command',command,'--payload-json',JSON.stringify(payload)],{encoding:'utf8',timeout:35000});
  if(r.error)throw r.error;
  const result=JSON.parse(r.stdout||r.stderr);
  if(expectError){assert.equal(r.status,2);assert.equal(result.ok,false);}
  else {assert.equal(r.status,0,r.stderr);assert.equal(result.ok,true);}
  return result;
}
async function until(check,timeout=30000) {
  const end=Date.now()+timeout;
  while(Date.now()<end){const s=cmd('getState');if(s.simulation.state==='failed')throw Error(s.simulation.error);if(check(s))return s;await delay(250);}
  throw Error('State condition timed out');
}
// Only this app is stopped. Do not clear shared device logs.
execFileSync(hdc,['-t',device,'shell','aa','force-stop','com.opensph.lab'],{timeout:10000});
const cold=cmd('getState');assert.equal(cold.protocol,1);
assert.ok(cmd('listCommands').commands.some(c=>c.name==='setScene'));
const config={preset:0,count:200,speed:5,angle:0,duration:10};
cmd('setScene',config);await until(s=>s.simulation.state==='paused');
cmd('setScene',{...config,speed:100},true);assert.equal(cmd('getState').scene.speed,5);
cmd('setCamera',{yaw:0.5,pitch:0.2,zoom:3,focus:-1,color:1});
assert.equal(cmd('getState').camera.color,1);
cmd('setPanel',{panel:1});await until(s=>s.ui.panel===1);
cmd('start');const finished=await until(s=>s.simulation.state==='completed',120000);
assert.ok(finished.simulation.time>=10);assert.ok(finished.simulation.count>=200);
cmd('seek',{frame:0});assert.equal(cmd('getState').simulation.selected,0);
cmd('saveReplay');cmd('reset');await until(s=>s.simulation.state==='paused');cmd('loadReplay');
assert.equal(cmd('getState').simulation.state,'replay');
cmd('unknownCommand',{},true);
const result=await until(s=>s.window.widthVp>0);
assert.equal(result.window.immersive,true);
console.log(JSON.stringify({ok:true,device,checks:['cold launch','catalog','invalid scene atomicity','camera','panel transition','native completion','seek','replay roundtrip','unknown command'],window:result.window},null,2));
