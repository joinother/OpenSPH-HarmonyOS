import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
function loader(){let reads=0,uploads=0,releases=0,sources=0,fail=false;const source={getImageInfo:async()=>({size:{width:2048,height:1024}}),createPixelMap:async()=>({readPixelsToBuffer:async()=>{if(fail)throw Error('decode failed');},release:async()=>releases++}),release:async()=>sources++};
 const context={exports:{},ArrayBuffer,require:n=>n==='@kit.ImageKit'?{image:{createImageSource:()=>source,PixelMapFormat:{RGBA_8888:3}}}:{default:{setMoonTexture:(buffer,w,h)=>{assert.equal(buffer.byteLength,8388608);assert.equal(w,2048);assert.equal(h,1024);uploads++;}}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../entry/src/main/ets/common/MoonTexture.ets',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {load:context.exports.loadMoonTexture,app:{resourceManager:{getRawFileContent:async()=>{reads++;return new Uint8Array(1);}}},source,fail:v=>fail=v,stats:()=>({reads,uploads,releases,sources})};}
test('Moon decoder coalesces demand and retains no ImageKit maps after handoff',async()=>{const l=loader();await Promise.all([l.load(l.app),l.load(l.app)]);await l.load(l.app);assert.deepEqual(l.stats(),{reads:1,uploads:1,releases:1,sources:1});});
test('Moon decoder failure releases resources and explicit retry uploads once',async()=>{const l=loader();l.fail(true);await assert.rejects(l.load(l.app));assert.deepEqual(l.stats(),{reads:1,uploads:0,releases:1,sources:1});l.fail(false);await l.load(l.app,true);assert.equal(l.stats().uploads,1);});
test('Moon decoder rejects unexpected dimensions before allocation and native upload',async()=>{const l=loader();l.source.getImageInfo=async()=>({size:{width:40000,height:20000}});await assert.rejects(l.load(l.app));assert.deepEqual(l.stats(),{reads:1,uploads:0,releases:0,sources:1});});
