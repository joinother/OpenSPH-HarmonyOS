import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor/node_modules/typescript/lib/typescript.js');
const source=readFileSync(new URL('../entry/src/main/ets/common/SceneVideo.ets',import.meta.url),'utf8');
function setup(){
 const files=new Map(),fds=new Map(),closed=[],configs=[];let nextFd=1,clock=10000,prepareGate;
 const state={frames:0,attached:false,pending:false,error:'',failPrepare:false,failStop:false,failRelease:false,failCopy:false,saveUris:[],ready:true,software:false};
 const fs={OpenMode:{CREATE:1,READ_WRITE:2,TRUNC:4},accessSync:p=>files.has(p),mkdirSync:p=>files.set(p,0),
  listFileSync:dir=>[...files.keys()].filter(p=>p.startsWith(dir+'/')).map(p=>p.slice(dir.length+1)),statSync:p=>({size:files.get(p)}),
  openSync:(p)=>{const fd=nextFd++;fds.set(fd,p);if(!files.has(p))files.set(p,0);return {fd};},open:async p=>fs.openSync(p),
  closeSync:file=>{closed.push(file.fd);fds.delete(file.fd);},unlinkSync:p=>files.delete(p),renameSync:(a,b)=>{files.set(b,files.get(a));files.delete(a);},
  copyFile:async(src,dest)=>{if(state.failCopy)throw Error('copy failed');files.set(fds.get(dest),files.get(src));},fsync:async()=>{}};
 let errorCallback;
 const recorder={on:(_type,cb)=>errorCallback=cb,prepare:async config=>{configs.push(config);if(prepareGate)await prepareGate;if(state.failPrepare)throw Error('unsupported codec');},
  getAvailableEncoder:async()=>state.software?[]:[{type:'video',mimeType:'video/avc'}],getInputSurface:async()=> '12345',start:async()=>{},stop:async()=>{if(state.failStop)throw Error('stop failed');for(const path of files.keys())if(path.endsWith('.part'))files.set(path,4096);},release:async()=>{if(state.failRelease)throw Error('release failed');}};
 const simulation={renderStatus:()=>({ready:state.ready}),setVideoOutput:(id)=>{state.attached=id!=='0';if(id!=='0'){state.frames=0;state.error='';}},videoOutputStatus:()=>({...state})};
 const context={exports:{},console,Error,Date:{now:()=>clock},setTimeout,require:name=>name==='@kit.MediaKit'?{media:{createAVRecorder:async()=>recorder,createAVMetadataExtractor:async()=>({fetchMetadata:async()=>({hasVideo:'yes',duration:1000,videoWidth:configs.at(-1).profile.videoFrameWidth,videoHeight:configs.at(-1).profile.videoFrameHeight}),release:async()=>{}}),VideoSourceType:{VIDEO_SOURCE_TYPE_SURFACE_YUV:0},ContainerFormatType:{CFT_MPEG_4:'mp4'},CodecMimeType:{VIDEO_AVC:'video/avc'}}}:name==='@kit.CoreFileKit'?{fileIo:fs,picker:{DocumentViewPicker:class{async save(){return state.saveUris;}}},fileUri:{getUriFromPath:p=>'file://'+p}}:{default:simulation}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 const Manager=context.exports.SceneVideo,manager=new Manager({filesDir:'/app'});
 return{manager,Manager,state,files,fds,configs,closed,dimensions:context.exports.videoDimensions,profile:context.exports.chooseVideoProfile,advance:n=>clock+=n,gate:p=>prepareGate=p,error:()=>errorCallback(Error('encoder error'))};
}
test('recording dimensions preserve even aspect within two quality budgets and reject unavailable windows',()=>{
 const{dimensions}=setup();assert.deepEqual(Array.from(dimensions(2416,2210,1280)),[1280,1170]);assert.deepEqual(Array.from(dimensions(720,1280,1920)),[720,1280]);
 for(const args of [[NaN,500,1280],[10,500,1280],[900,600,10000]])assert.throws(()=>dimensions(...args));
});
test('start-stop publishes only finalized MP4, releases fd and reopens durable local clips',async()=>{
 const t=setup();await t.manager.start(1280,720,1280);assert.equal(t.manager.snapshot().state,'recording');assert.equal(t.manager.snapshot().clips.length,0);
 await assert.rejects(t.manager.start(1280,720,1280));assert.equal(t.configs[0].audioSourceType,undefined);assert.match(t.configs[0].metadata.customInfo.credits,/CC BY 4.0/);
 t.state.frames=60;t.advance(2000);const a=t.manager.stop(),b=t.manager.stop();assert.equal(a,b);await a;
 assert.equal(t.manager.snapshot().state,'ready');assert.equal(t.manager.snapshot().clips.length,1);assert.equal(t.fds.size,0);assert.equal(t.state.attached,false);
 const second=new t.Manager({filesDir:'/app'});assert.equal(second.snapshot().clips.length,1);assert.match(second.previewUri(),/^file:\/\/\/app\/videos\/scene-/);
});
test('failed prepare closes descriptors without deleting previous clips; incomplete and short recordings are not published',async()=>{
 const t=setup();t.files.set('/app/videos/scene-100-1.mp4',8192);t.files.set('/app/videos/scene-200-1.mp4.part',10);t.state.failPrepare=true;
 await assert.rejects(t.manager.start(1280,720,1280),/unsupported/);assert.equal(t.fds.size,0);assert.equal(t.files.get('/app/videos/scene-100-1.mp4'),8192);
 const second=new t.Manager({filesDir:'/app'});assert.equal(second.snapshot().clips.length,1);t.state.failPrepare=false;t.advance(1000);await second.start(1280,720,1280);t.state.frames=1;await assert.rejects(second.stop(),/过短/);assert.equal(second.snapshot().clips.length,1);
});
test('background cancels in-flight preparation and closes active recordings',async()=>{
 const t=setup();let resolve;t.gate(new Promise(r=>resolve=r));const starting=t.manager.start(1280,720,1280);t.Manager.background();resolve();await assert.rejects(starting,/后台/);assert.equal(t.fds.size,0);
 t.gate(undefined);t.advance(1000);await t.manager.start(1280,720,1280);t.state.frames=50;t.Manager.background();await t.manager.stop();assert.equal(t.manager.snapshot().state,'ready');assert.match(t.manager.snapshot().message,/后台/);
});
test('duration cap stops recording; unavailable renderer rejects before opening a file',async()=>{
 const t=setup();t.state.ready=false;await assert.rejects(t.manager.start(1280,720,1280));assert.equal(t.fds.size,0);
 t.state.ready=true;await t.manager.start(1280,720,1280);t.state.frames=100;t.advance(180000);t.manager.snapshot();await t.manager.stop();assert.match(t.manager.snapshot().message,/3 分钟/);
});
test('export cancellation and failed copy preserve source; success copies exact bytes and closes destination',async()=>{
 const t=setup();await t.manager.start(1280,720,1280);t.state.frames=20;await t.manager.stop();const original=t.manager.selected();
 await t.manager.exportSelected();assert.match(t.manager.snapshot().message,/取消/);assert.equal(t.files.get(original.path),4096);
 t.state.saveUris=['/chosen/clip.mp4'];t.state.failCopy=true;await assert.rejects(t.manager.exportSelected(),/copy failed/);assert.equal(t.fds.size,0);assert.equal(t.files.get(original.path),4096);
 t.state.failCopy=false;await t.manager.exportSelected();assert.equal(t.files.get('/chosen/clip.mp4'),4096);assert.equal(t.fds.size,0);
 await assert.rejects(t.manager.exportSelected.call(new t.Manager({filesDir:'/empty'})));
});
test('release failure closes file and cannot publish a supposedly complete recording',async()=>{
 const t=setup();await t.manager.start(1280,720,1280);t.state.frames=20;t.state.failRelease=true;await assert.rejects(t.manager.stop(),/release failed/);assert.equal(t.fds.size,0);assert.equal(t.manager.snapshot().clips.length,0);assert.equal(t.state.attached,false);
});

test('missing system video encoder is an explicit failure and never substitutes software encoding',async()=>{
 const t=setup();t.state.software=true;await assert.rejects(t.manager.start(2416,2210,1920),/H.264/);assert.equal(t.manager.snapshot().state,'error');assert.equal(t.manager.snapshot().clips.length,0);assert.equal(t.fds.size,0);assert.equal(t.state.active,undefined);
});

test('hardware profile respects advertised encoder bounds without stretching requested aspect',()=>{
 const t=setup();const p=t.profile([{type:'video',mimeType:'video/avc',width:{min:128,max:1920},height:{min:128,max:1080},frameRate:{min:1,max:25},bitRate:{min:100000,max:3000000}}],2416,2210,1920);
 assert.ok(p.width<=1920&&p.height<=1080);assert.equal(p.frameRate,25);assert.equal(p.bitrate,3000000);assert.ok(Math.abs(p.width/p.height-2416/2210)<.004);
});
