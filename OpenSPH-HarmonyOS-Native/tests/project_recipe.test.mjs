import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const context={exports:{}};
const compile=file=>ts.transpileModule(fs.readFileSync(new URL('../entry/src/main/ets/common/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(compile('SceneModel.ets'),context);const model=context.exports;
const adapter={listFileSync:fs.readdirSync,statSync:fs.statSync,readTextSync:p=>fs.readFileSync(p,'utf8'),OpenMode:{CREATE:0,READ_WRITE:0,TRUNC:0},openSync:p=>({fd:fs.openSync(p,'w')}),writeSync:fs.writeSync,fsyncSync:fs.fsyncSync,closeSync:fs.closeSync,renameSync:fs.renameSync};
const storeContext={exports:{},require:name=>name==='@kit.CoreFileKit'?{fileIo:adapter}:model};vm.runInNewContext(compile('ProjectStore.ets'),storeContext);const {ProjectStore}=storeContext.exports;
const scene=()=>({schemaVersion:1,model:'nbody-custom-v1',title:'环的实验',bodies:[],config:{preset:5,count:600,speed:1,angle:0,duration:3,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,orbitBodies:model.defaultOrbitBodies()}});
test('actual store writes complete recipes atomically and accepts old scene-only files',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-recipe-'));try{
  const s=scene();s.config.orbitBodies[1].surface=4;const r=model.defaultRecipe(s);r.camera.focus=1;r.ring={enabled:true,target:1,timeHours:7.25,speedScale:1.18,rateHours:.2};
  const saved=ProjectStore.save(dir,s,r),raw=JSON.parse(fs.readFileSync(join(dir,saved.id+'.json'),'utf8'));
  assert.deepEqual(raw.recipe,JSON.parse(JSON.stringify(r)));assert.deepEqual(JSON.parse(JSON.stringify(ProjectStore.load(dir,saved.id))),raw);assert.ok(!fs.readdirSync(dir).some(n=>n.endsWith('.tmp')));
  const old={id:'project-1-1',savedAt:1,scene:s};fs.writeFileSync(join(dir,old.id+'.json'),JSON.stringify(old));assert.equal(ProjectStore.load(dir,old.id).recipe,undefined);
  const bad={...raw,id:'project-2-2',recipe:{...raw.recipe,schemaVersion:999}};fs.writeFileSync(join(dir,bad.id+'.json'),JSON.stringify(bad));
  assert.throws(()=>ProjectStore.load(dir,bad.id));assert.equal(ProjectStore.list(dir).length,2);assert.throws(()=>ProjectStore.load(dir,'../outside'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('malformed and incompatible recipe fields are rejected before any file is written',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-recipe-invalid-'));try{
  const s=scene();s.config.orbitBodies[1].surface=4;const baseline=model.defaultRecipe(s);
  const mutations=[r=>r.schemaVersion=2,r=>r.appearanceVersion=999,r=>r.camera=null,r=>r.camera.zoom=0,r=>r.camera.pitch=2,r=>r.camera.focus=8,r=>r.camera.color=2,r=>r.appearance.clouds='true',r=>delete r.appearance.rings,r=>r.appearance.closeup=true,r=>r.sky.brightness=2,r=>r.sky.mode=.5,r=>r.themeId='../bad',r=>r.ring.timeHours=25,r=>r.ring.speedScale=1.3,r=>r.ring.rateHours=0,r=>r.ring.enabled=true,r=>r.ring.target=1,r=>r.overview={...r.camera,focus:0}];
  for(const mutate of mutations){const r=JSON.parse(JSON.stringify(baseline));mutate(r);assert.throws(()=>ProjectStore.save(dir,s,r));assert.deepEqual(fs.readdirSync(dir),[]);}
  const r=JSON.parse(JSON.stringify(baseline));r.camera.focus=2;r.ring={enabled:true,target:2,timeHours:1,speedScale:1.1,rateHours:1};assert.throws(()=>ProjectStore.save(dir,s,r));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('v2 materials are bounded, v1 loads unchanged, invalid variants never create files',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-material-recipe-'));try{
  const s=scene(),baseline=model.defaultRecipe(s);assert.equal(baseline.appearanceVersion,2);
  for(const mutate of [r=>delete r.material,r=>r.material=null,r=>r.material.exposure=2.01,r=>r.material.exposure=null,r=>r.material.exposure='1',r=>r.material.ocean=1,r=>delete r.material.cloudShadows,r=>r.appearanceVersion=1]){
   const r=JSON.parse(JSON.stringify(baseline));mutate(r);assert.throws(()=>ProjectStore.save(dir,s,r));assert.deepEqual(fs.readdirSync(dir),[]);
  }
  const old={id:'project-4-0',savedAt:1,scene:s,recipe:baseline};old.recipe.appearanceVersion=1;delete old.recipe.material;
  const path=join(dir,old.id+'.json'),bytes=JSON.stringify(old);fs.writeFileSync(path,bytes);assert.deepEqual(JSON.parse(JSON.stringify(ProjectStore.load(dir,old.id))),JSON.parse(JSON.stringify(old)));assert.equal(fs.readFileSync(path,'utf8'),bytes);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('v3 surface recipes roundtrip; seeds and generator versions validate before storage',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-surfaces-'));try{
  const s=scene(),r=model.defaultRecipe(s);r.appearanceVersion=3;r.surfaces=model.legacySurfaces(4);r.surfaces[1]={version:1,seed:812,cloudSeed:619};
  const saved=ProjectStore.save(dir,s,r);assert.deepEqual(JSON.parse(JSON.stringify(ProjectStore.load(dir,saved.id).recipe)),JSON.parse(JSON.stringify(r)));
  const mutations=[r=>r.surfaces.pop(),r=>r.surfaces[1].version=2,r=>r.surfaces[1].seed=-1,r=>r.surfaces[1].cloudSeed=1.5,r=>r.surfaces[0].seed=1,r=>r.surfaces[1].seed='1',r=>delete r.surfaces,r=>r.appearanceVersion=2];
  for(const change of mutations){const v=JSON.parse(JSON.stringify(r));change(v);assert.throws(()=>ProjectStore.save(dir,s,v));}
  s.config.orbitBodies[1].surface=5;assert.throws(()=>ProjectStore.save(dir,s,r));assert.equal(fs.readdirSync(dir).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('ring model 2 persists impulse/grain settings and rejects unknown or unversioned dynamics atomically',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-ring-recipe-'));try{
  const s=scene();s.config.orbitBodies[1].surface=4;const r=model.defaultRecipe(s);r.camera.focus=1;r.ring={enabled:true,target:1,timeHours:8,speedScale:1.12,rateHours:.4,modelVersion:2,impulse:.35,points:true};
  const saved=ProjectStore.save(dir,s,r);assert.deepEqual(JSON.parse(JSON.stringify(ProjectStore.load(dir,saved.id).recipe.ring)),r.ring);const files=fs.readdirSync(dir);
  for(const change of [t=>t.modelVersion=3,t=>delete t.modelVersion,t=>t.impulse=.36,t=>t.impulse=NaN,t=>delete t.impulse,t=>t.points='true',t=>delete t.points]){const bad=structuredClone(r);change(bad.ring);assert.throws(()=>ProjectStore.save(dir,s,bad));assert.deepEqual(fs.readdirSync(dir),files);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('self-gravitating rock projects retain model identity and reject mismatched legacy tags',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-gravity-'));try{
  const s={schemaVersion:1,model:'sph-rock-gravity-v1',title:'自引力',bodies:[{id:'primary',name:'岩石',kind:'rock',radiusKm:100,density:2700}],config:{...scene().config,preset:2,speed:1,selfGravity:true}};delete s.config.orbitBodies;
  const saved=ProjectStore.save(dir,s);assert.equal(ProjectStore.load(dir,saved.id).scene.config.selfGravity,true);
  for(const mutate of [s=>s.model='sph-rock-v1',s=>delete s.config.selfGravity,s=>s.config.count=1201,s=>s.config.selfGravity='true']){
   const bad=JSON.parse(JSON.stringify(s));mutate(bad);assert.throws(()=>ProjectStore.save(dir,bad));
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('finite spheres preserve radii, model identity, copied placement and atomic project validation',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sph-contact-'));try{
  const s=scene();s.model='nbody-hard-sphere-v1';s.config.orbitBodies=model.contactDemoBodies();
  model.validateScene(s);const copy=model.copyOrbitBodies(s.config.orbitBodies);assert.equal(copy[1].radiusKm,6371);copy[1].radiusKm=6000;assert.equal(s.config.orbitBodies[1].radiusKm,6371);
  const draft=model.copiedPlanetDraft(s.config.orbitBodies,1);assert.equal(draft.fields.length,6);assert.equal(Number(draft.fields[5]),6371);assert.equal(model.planPlanet(s.config.orbitBodies,draft.name,draft.fields,draft.surface,1).valid,true);
  const saved=ProjectStore.save(dir,s,model.defaultRecipe(s));assert.deepEqual(JSON.parse(JSON.stringify(ProjectStore.load(dir,saved.id).scene)),JSON.parse(JSON.stringify(s)));
  const original=fs.readdirSync(dir);
  for(const mutate of [v=>v.model='nbody-custom-v1',v=>delete v.config.orbitBodies[1].radiusKm,v=>v.config.orbitBodies[1].radiusKm=0,v=>v.config.orbitBodies[1].radiusKm=NaN,v=>v.config.orbitBodies[1].radiusKm='6371',v=>v.config.orbitBodies[1].radiusKm=1e8,v=>v.config.orbitBodies[1].yAU=v.config.orbitBodies[2].yAU]){
   const v=structuredClone(s);mutate(v);assert.throws(()=>ProjectStore.save(dir,v));assert.deepEqual(fs.readdirSync(dir),original);
  }
  const old=scene();model.validateScene(old);assert.equal(model.copyOrbitBodies(old.config.orbitBodies)[1].radiusKm,undefined);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
