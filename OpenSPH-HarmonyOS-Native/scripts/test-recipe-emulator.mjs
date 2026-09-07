#!/usr/bin/env node
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const device=process.argv[2];if(device!=='127.0.0.1:5555')throw Error('Explicit development emulator required');
const root=fileURLToPath(new URL('../',import.meta.url)),cli=root+'scripts/opensph-cli.mjs',version=JSON.parse(readFileSync(root+'AppScope/app.json5')).app.versionName;
const hdc='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc',remote='/data/app/el2/100/base/com.opensph.lab/haps/entry/files';
const temp=mkdtempSync(tmpdir()+'/sph-recipe-'),created=[];
const h=(...a)=>execFileSync(hdc,['-t',device,...a],{encoding:'utf8',timeout:15000});
const call=(command,payload={},wait)=>JSON.parse(execFileSync(process.execPath,[cli,'--device',device,'--command',command,'--payload-json',JSON.stringify(payload),...(wait?['--wait-state',wait]:[])],{encoding:'utf8',timeout:35000}));
const action=(action,wait)=>call('uiAction',{action},wait),value=(field,value)=>call('setUiValue',{field,value});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const read=id=>{h('file','recv',remote+'/'+id+'.json',temp+'/'+id+'.json');return JSON.parse(readFileSync(temp+'/'+id+'.json','utf8'));};
const fixture=p=>{
 // Create through the app so the inode retains the app UID and security label.
 p.id=call('saveProject',{title:'验收 · 文件兼容样本'}).id;created.push(p.id);
 writeFileSync(temp+'/'+p.id+'.json',JSON.stringify(p));h('file','send',temp+'/'+p.id+'.json','/data/local/tmp/sph-recipe-fixture.json');
 h('shell','cat','/data/local/tmp/sph-recipe-fixture.json','>',remote+'/'+p.id+'.json');
};
async function settled(){for(let i=0;i<80;i++){const s=call('getState');assert.equal(s.rendering.error,'');if(s.rendering.texturesReady&&!s.rendering.cameraMoving&&s.rendering.frames>1)return s;await delay(150);}throw Error('render not ready');}
function equivalent(s,r){assert.deepEqual(s.material,r.material??{exposure:0,ocean:true,cloudShadows:true});assert.ok(Math.abs(s.rendering.materialExposure-s.material.exposure)<1e-5);assert.deepEqual(s.camera,r.camera);assert.deepEqual(s.appearance,r.appearance);assert.equal(s.sky.mode,r.sky.mode);assert.equal(s.sky.brightness,r.sky.brightness);assert.equal(s.theme.id,r.themeId);assert.equal(s.simulation.time,0);assert.equal(s.simulation.state,'paused');assert.equal(s.ringTrace.enabled,r.ring.enabled);assert.equal(s.ringTrace.running,false);if(r.ring.enabled)for(const key of ['target','timeHours','speedScale','rateHours'])assert.ok(Math.abs(s.ringTrace[key]-r.ring[key])<1e-10,key);}
const checks=[],layouts=[];
try{
 call('listCommands');call('getUiState');
 action('theme.eccentric-ring','paused');await settled();
 call('setCamera',{yaw:.4,pitch:.3,zoom:3.1,focus:1,color:0});
 call('setAppearance',{clouds:false,atmosphere:false,trails:false,closeup:true,autoSpin:false,rings:false});call('setSky',{mode:1,brightness:.37});
 call('setMaterial',{exposure:1.3,ocean:false,cloudShadows:false});
 value('trace.speed',1.17);value('trace.rate',.3);value('trace.hours',4.75);await settled();
 const before=call('getState'),particles=call('getRingTrace',{particles:true}).ringTrace.particles;
 const saved=call('saveProject',{title:'验收 · 环与观察配方'});created.push(saved.id);const file=read(saved.id);
 assert.equal(file.recipe.ring.timeHours,4.75);assert.equal(file.recipe.appearanceVersion,3);
 action('theme.rock-slow','paused');h('shell','aa','force-stop','com.opensph.lab');
 call('loadProject',{id:saved.id},'paused');const loaded=await settled();equivalent(loaded,file.recipe);assert.deepEqual(loaded.definition,file.scene);assert.deepEqual(call('getRingTrace',{particles:true}).ringTrace.particles,particles);
 assert.equal(call('listProjects').projects.find(p=>p.id===saved.id).hasRecipe,true);checks.push('cold process restores recipe, initial conditions and all 192 ring positions');
 // Saving must sample the live clock, while loading always pauses it.
 action('trace.play');await delay(250);const running=call('saveProject',{title:'验收 · 运行环采样'});created.push(running.id);const runningFile=read(running.id);assert.ok(runningFile.recipe.ring.timeHours>4.75);
 call('loadProject',{id:running.id},'paused');equivalent(await settled(),runningFile.recipe);checks.push('running ring captured at save and restored paused');
 const prefix=Date.now();const bad=structuredClone(file);bad.id='project-'+prefix+'-701';bad.recipe.ring.speedScale=2;fixture(bad);
 const stable=call('getState');const rejected=spawnSync(process.execPath,[cli,'--device',device,'--command','loadProject','--payload-json',JSON.stringify({id:bad.id})],{encoding:'utf8'});assert.equal(rejected.status,2);assert.match(JSON.parse(rejected.stdout).error,/参数超出范围/);
 const after=call('getState');assert.deepEqual(after.definition,stable.definition);assert.deepEqual(after.camera,stable.camera);assert.equal(after.rendering.sceneRevision,stable.rendering.sceneRevision);assert.equal(after.ringTrace.timeHours,stable.ringTrace.timeHours);assert.ok(!call('listProjects').projects.some(p=>p.id===bad.id));checks.push('corrupt recipe rejected without replacing scene; isolated from valid library entries');
 const v1=structuredClone(file);v1.recipe.appearanceVersion=1;delete v1.recipe.material;delete v1.recipe.surfaces;fixture(v1);
 call('loadProject',{id:v1.id},'paused');equivalent(await settled(),v1.recipe);assert.equal(read(v1.id).recipe.appearanceVersion,1);checks.push('v1 appearance migrates in memory to default material without rewriting file');
 const broken=structuredClone(file);broken.recipe.material.exposure=9;fixture(broken);const stableMaterial=call('getState');
 const invalid=spawnSync(process.execPath,[cli,'--device',device,'--command','loadProject','--payload-json',JSON.stringify({id:broken.id})],{encoding:'utf8'});assert.equal(invalid.status,2);const intact=call('getState');assert.deepEqual(intact.material,stableMaterial.material);assert.equal(intact.rendering.sceneRevision,stableMaterial.rendering.sceneRevision);checks.push('invalid material recipe rejected before scene mutation');
 const legacy=structuredClone(file);legacy.id='project-'+prefix+'-702';delete legacy.recipe;fixture(legacy);
 call('loadProject',{id:legacy.id},'paused');const old=await settled();assert.equal(old.camera.focus,-1);assert.equal(old.appearance.closeup,false);assert.equal(old.ringTrace.enabled,false);assert.equal(old.sky.mode,2);assert.equal(old.sky.brightness,.65);assert.equal(old.theme.id,'');checks.push('legacy scene-only file loads with deterministic defaults');
 call('loadProject',{id:saved.id},'paused');await settled();
 // Shared UI route must save the same recipe format and expose that fact in the library.
 value('scene.title','验收 · 按钮保存');action('project.save');const uiSaved=call('listProjects').projects.find(p=>p.title==='验收 · 按钮保存');assert.ok(uiSaved?.hasRecipe);created.push(uiSaved.id);assert.deepEqual(read(uiSaved.id).recipe,file.recipe);checks.push('ArkUI save action and direct CLI save share the recipe writer');
 for(const [name,fold,orientation] of [['wide',false,'portrait'],['phone',true,'portrait'],['landscape',true,'landscape']]){
  h('shell','hidumper','-s','DisplayManagerService','-a',fold?'-p':'-y');call('setWindowOrientation',{orientation});
  for(let i=0;i<50;i++){const s=call('getState'),g=s.window.geometry;if((orientation==='portrait'?g.heightPx>g.widthPx:g.widthPx>g.heightPx)&&(fold?Math.min(g.widthPx,g.heightPx)<1500:Math.min(g.widthPx,g.heightPx)>2000))break;if(i===49)throw Error('window not ready');await delay(200);}
  action('library.saved');call('setPanel',{panel:2});await settled();await delay(250);
  const s=call('getState');assert.equal(s.window.immersive,true);assert.equal(s.ringTrace.timeHours,4.75);
  const png=root+'../OpenSPH-'+version+'-recipe-'+name+'.png';rmSync(png,{force:true});h('shell','rm','-f','/data/local/tmp/sph-recipe.png');h('shell','uitest','screenCap','-p','/data/local/tmp/sph-recipe.png');h('file','recv','/data/local/tmp/sph-recipe.png',png);
  h('shell','uitest','dumpLayout','-p','/data/local/tmp/sph-recipe-layout.json');h('file','recv','/data/local/tmp/sph-recipe-layout.json',temp+'/layout.json');
  const nodes=[];function walk(o){if(!o||typeof o!=='object')return;if(o.attributes)nodes.push(o.attributes);for(const[k,v]of Object.entries(o))if(k!=='attributes')walk(v);}walk(JSON.parse(readFileSync(temp+'/layout.json')));
  const button=nodes.find(n=>n.text==='保存当前实验与视角');assert.ok(button,'save button visible');const bounds=button.bounds.match(/-?\d+/g).map(Number),b=readFileSync(png),width=b.readUInt32BE(16),height=b.readUInt32BE(20);assert.ok(bounds[0]>=0&&bounds[1]>=0&&bounds[2]<=width&&bounds[3]<=height);
  let end=8;while(end<b.length){const size=b.readUInt32BE(end),type=b.toString('ascii',end+4,end+8);end+=12+size;if(type==='IEND')break;}assert.equal(end,b.length,'PNG must not contain bytes from an older capture');
  layouts.push({name,width,height,saveButton:bounds});
 }
 checks.push('wide, folded portrait and landscape library controls in bounds, immersive and recipe retained');
 writeFileSync(root+'docs/evidence/recipe-'+version+'-device-tests.json',JSON.stringify({ok:true,device,version,checks,layouts,saved:file,loaded,legacy:old},null,2)+'\n');console.log(JSON.stringify({ok:true,checks,layouts},null,2));
}finally{
 for(const id of created)h('shell','rm',remote+'/'+id+'.json');
 h('shell','rm','-f','/data/local/tmp/sph-recipe.png','/data/local/tmp/sph-recipe-layout.json','/data/local/tmp/sph-recipe-fixture.json');
 call('listProjects');h('shell','hidumper','-s','DisplayManagerService','-a','-y');call('setWindowOrientation',{orientation:'auto'});rmSync(temp,{recursive:true,force:true});
}
