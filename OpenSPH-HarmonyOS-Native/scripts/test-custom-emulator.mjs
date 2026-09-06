#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const device=process.argv[2];if(!device)throw Error('Explicit device ID required');
const cli=fileURLToPath(new URL('./opensph-cli.mjs',import.meta.url));
function command(c,p={}){return JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',c,'--payload-json',JSON.stringify(p)],{encoding:'utf8',timeout:30000}));}
async function settled(state){for(let i=0;i<120;i++){const s=command('getState');assert.notEqual(s.simulation.state,'failed',s.simulation.error);if(s.simulation.state===state)return s;await delay(150);}throw Error('Timeout '+state);}
const bodies=[{name:'中央恒星',massSolar:1,xAU:0,yAU:0,zAU:0,vxKmS:0,vyKmS:0,vzKmS:0,surface:0}];
for(let i=1;i<8;i++){const r=.6+i*.35,p=i*.8,v=Math.sqrt(1.32712440041279419e20*(1+3e-6)/(r*149597870700))/1000;
  bodies.push({name:'行星 '+i,massSolar:3e-6,xAU:r*Math.cos(p),yAU:r*Math.sin(p),zAU:i===7?.2:0,vxKmS:-v*Math.sin(p),vyKmS:v*Math.cos(p),vzKmS:i===7?1:0,surface:1+i%3});}
const config={preset:5,count:600,speed:1,angle:0,duration:1,orbitBodies:bodies};
command('setScene',config);let s=await settled('paused');assert.equal(s.simulation.count,8);assert.equal(s.simulation.model,'nbody-custom-v1');
assert.deepEqual(s.simulation.config.orbitBodies,bodies);const initial=s.simulation.bodies;
command('setPanel',{panel:-1});command('setCamera',{yaw:0,pitch:.2,zoom:3,focus:7,color:0});command('setAppearance',{closeup:true,autoSpin:true});await delay(600);
for(let i=0;i<100;i++){s=command('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady)break;await delay(150);}
assert.equal(s.camera.focus,7);assert.equal(s.rendering.texturesReady,true);assert.equal(s.rendering.error,'');assert.equal(s.simulation.time,0);
command('setAppearance',{closeup:false,autoSpin:false});command('setCamera',{yaw:0,pitch:.2,zoom:3,focus:-1,color:0});command('start');s=await settled('completed');
assert.equal(s.simulation.time,1);assert.ok(Math.abs(s.simulation.energyError)<1e-5);assert.ok(Math.abs(s.simulation.bodies[7].zAU-initial[7].zAU)>.001);
command('saveReplay');const saved=command('getState');
const projects=command('listProjects');const title='自定义八天体 · 验证';const existing=projects.projects.find(p=>p.title===title);
const id=existing?.id??command('saveProject',{title}).id;
command('setScene',{preset:0,count:200,speed:5,angle:0,duration:1});await settled('paused');command('loadReplay');
s=await settled('replay');assert.deepEqual(s.definition.config.orbitBodies,bodies);command('seek',{frame:s.simulation.frames-1});s=command('getState');assert.deepEqual(s.simulation.bodies,saved.simulation.bodies);
// The transport exits nonzero on an application rejection. Confirm the scene survived.
const bad=structuredClone(config);bad.orbitBodies[1].massSolar=0;
assert.throws(()=>command('setScene',bad));assert.deepEqual(command('getState').definition.config.orbitBodies,bodies);
command('loadProject',{id});s=await settled('paused');assert.deepEqual(s.definition.config.orbitBodies,bodies);assert.equal(s.simulation.time,0);assert.equal(s.rendering.error,'');
console.log(JSON.stringify({ok:true,device,checks:['8-body native status and initial configuration','body 7 surface shader and camera','3D motion and energy','v4 replay complete state restoration','invalid transaction atomicity','saved project load'],projectId:id,state:s},null,2));
