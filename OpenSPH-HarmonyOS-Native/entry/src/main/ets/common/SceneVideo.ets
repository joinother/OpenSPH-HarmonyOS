import { media } from '@kit.MediaKit';
import { common } from '@kit.AbilityKit';
import { fileIo as fs, picker, fileUri } from '@kit.CoreFileKit';
import simulation from 'libsimulation.so';

export interface VideoClip { id:string; name:string; path:string; bytes:number; createdAt:number; }
export interface VideoState { state:string; elapsedSeconds:number; width:number; height:number; frames:number; error:string; message:string; selectedId:string; clips:VideoClip[]; }
export function emptyVideoState():VideoState {return {state:'idle',elapsedSeconds:0,width:0,height:0,frames:0,error:'',message:'',selectedId:'',clips:[]};}
export interface VideoProfile {width:number;height:number;frameRate:number;bitrate:number;}
export function chooseVideoProfile(encoders:media.EncoderInfo[],width:number,height:number,longEdge:number):VideoProfile {
  const requested:number[]=videoDimensions(width,height,longEdge);
  for(const encoder of encoders){
    if(encoder.type!=='video'||encoder.mimeType!==media.CodecMimeType.VIDEO_AVC)continue;
    const scale:number=Math.min(1,(encoder.width?.max??1920)/requested[0],(encoder.height?.max??1920)/requested[1]);
    const w:number=Math.floor(requested[0]*scale/2)*2,h:number=Math.floor(requested[1]*scale/2)*2;
    const fps:number=Math.min(30,encoder.frameRate?.max??30);
    if(w<Math.max(128,encoder.width?.min??128)||h<Math.max(128,encoder.height?.min??128)||fps<Math.max(1,encoder.frameRate?.min??1))continue;
    return {width:w,height:h,frameRate:fps,bitrate:Math.max(encoder.bitRate?.min??1,Math.min(longEdge===1920?8000000:4000000,encoder.bitRate?.max??8000000))};
  }
  throw new Error('当前设备不支持所需的 H.264 视频编码，请在支持录制的真机上使用');
}
export function videoDimensions(w:number,h:number,longEdge:number):number[] {
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<128||h<128||![1280,1920].includes(longEdge))throw new Error('星图尺寸尚未就绪');
  const scale:number=Math.min(1,longEdge/Math.max(w,h));
  return [Math.max(128,Math.floor(w*scale/2)*2),Math.max(128,Math.floor(h*scale/2)*2)];
}

// AVRecorder consumes only the native scene surface. It never captures other applications or microphone audio.
export class SceneVideo {
  private static current:SceneVideo|undefined=undefined;
  private recorder:media.AVRecorder|undefined=undefined;
  private file:fs.File|undefined=undefined;
  private data:VideoState=emptyVideoState();
  private startedAt:number=0;
  private partial:string='';
  private finalPath:string='';
  private cancelStarting:boolean=false;
  private stopTask:Promise<void>|undefined=undefined;
  private directory:string;
  private context:common.UIAbilityContext;
  constructor(context:common.UIAbilityContext) {
    this.context=context;
    this.directory=context.filesDir+'/videos';
    if(!fs.accessSync(this.directory))fs.mkdirSync(this.directory);
    SceneVideo.current=this;this.refresh();
  }
  static background():void {
    const current:SceneVideo|undefined=SceneVideo.current;
    if(!current)return;
    current.cancelStarting=true;
    if(current.data.state==='recording')current.stop('已结束录制 · 应用进入后台').catch(()=>{});
  }
  snapshot():VideoState {
    if(this.data.state==='recording'){
      this.data.elapsedSeconds=(Date.now()-this.startedAt)/1000;
      const status=simulation.videoOutputStatus();this.data.frames=status.frames;
      if(status.error)this.stop('星图输出中断：'+status.error).catch(()=>{});
      else if(this.data.elapsedSeconds>=180)this.stop('已达到 3 分钟上限，视频已留在本机').catch(()=>{});
    }
    return {state:this.data.state,elapsedSeconds:this.data.elapsedSeconds,width:this.data.width,height:this.data.height,frames:this.data.frames,error:this.data.error,message:this.data.message,selectedId:this.data.selectedId,clips:this.data.clips.slice()};
  }
  private refresh():void {
    this.data.clips=fs.listFileSync(this.directory).filter((name:string):boolean=>/^scene-\d+-\d+\.mp4$/.test(name)).map((name:string):VideoClip=>{
      const path:string=this.directory+'/'+name,stat=fs.statSync(path);
      return {id:name,name:name,path:path,bytes:stat.size,createdAt:Number(name.split('-')[1])};
    }).sort((a:VideoClip,b:VideoClip):number=>b.createdAt-a.createdAt);
    if(!this.data.clips.some((c:VideoClip):boolean=>c.id===this.data.selectedId))this.data.selectedId=this.data.clips[0]?.id??'';
  }
  async capabilities():Promise<media.EncoderInfo[]> {
    if(['starting','recording','stopping','exporting'].includes(this.data.state))throw new Error('请先结束视频操作');
    const recorder:media.AVRecorder=await media.createAVRecorder();
    try{return await recorder.getAvailableEncoder();}finally{await recorder.release();}
  }
  reload():void {this.refresh();}
  select(id:string):void {if(!this.data.clips.some((c:VideoClip):boolean=>c.id===id))throw new Error('视频不存在');this.data.selectedId=id;}
  selected():VideoClip|undefined {return this.data.clips.find((c:VideoClip):boolean=>c.id===this.data.selectedId);}
  previewUri():string {const clip=this.selected();return clip?fileUri.getUriFromPath(clip.path):'';}
  private async waitOutput(attached:boolean):Promise<void> {
    const limit:number=Date.now()+5000;
    while(Date.now()<limit){
      const state=simulation.videoOutputStatus();
      if(attached&&state.error)throw new Error(state.error);
      if(state.attached===attached&&!state.pending)return;
      await new Promise<void>((resolve:()=>void)=>{setTimeout(resolve,25);});
    }
    throw new Error('星图视频输出响应超时');
  }
  private async detach():Promise<void> {simulation.setVideoOutput('0',0,0);await this.waitOutput(false);}
  private async release():Promise<void> {
    try{if(this.recorder)await this.recorder.release();}
    finally{this.recorder=undefined;if(this.file){fs.closeSync(this.file);this.file=undefined;}}
  }
  async start(width:number,height:number,longEdge:number):Promise<void> {
    if(['starting','recording','stopping','exporting'].includes(this.data.state))throw new Error('请先结束当前视频操作');
    const dimensions:number[]=videoDimensions(width,height,longEdge);
    if(!simulation.renderStatus().ready)throw new Error('请等待星图显示后再录制');
    this.cancelStarting=false;this.data.state='starting';this.data.error='';this.data.message='正在准备视频';this.data.frames=0;this.data.elapsedSeconds=0;
    this.data.width=dimensions[0];this.data.height=dimensions[1];
    const id:string='scene-'+Date.now()+'-'+Math.floor(Math.random()*1000000)+'.mp4';
    this.finalPath=this.directory+'/'+id;this.partial=this.finalPath+'.part';
    try {
      if(fs.accessSync(this.partial)||fs.accessSync(this.finalPath))throw new Error("视频文件名冲突，请重试");
      this.file=fs.openSync(this.partial,fs.OpenMode.CREATE|fs.OpenMode.READ_WRITE);
      this.recorder=await media.createAVRecorder();
      this.recorder.on('error',(error:Error)=>{
        this.data.error=String(error);
        if(this.data.state==='recording')this.stop('编码器中断').catch(()=>{});
      });
      const encoders:media.EncoderInfo[]=await this.recorder.getAvailableEncoder();
      const profile:VideoProfile=chooseVideoProfile(encoders,width,height,longEdge);
      this.data.width=profile.width;this.data.height=profile.height;
      const config:media.AVRecorderConfig={videoSourceType:media.VideoSourceType.VIDEO_SOURCE_TYPE_SURFACE_YUV,
        profile:{fileFormat:media.ContainerFormatType.CFT_MPEG_4,videoCodec:media.CodecMimeType.VIDEO_AVC,videoBitrate:profile.bitrate,
          videoFrameWidth:profile.width,videoFrameHeight:profile.height,videoFrameRate:profile.frameRate},metadata:{customInfo:{'credits':'OpenSPH simulation. Sky adapted from ESO/S. Brunier https://www.eso.org/public/images/eso0932a/ licensed CC BY 4.0 https://creativecommons.org/licenses/by/4.0/; Moon texture NASA SVS. Rendered visualisation, not an astronomical prediction.'}},url:'fd://'+this.file.fd};
      await this.recorder.prepare(config);
      const surface:string=await this.recorder.getInputSurface();
      if(this.cancelStarting)throw new Error('应用已进入后台，录制已取消');
      await this.recorder.start();
      simulation.setVideoOutput(surface,profile.width,profile.height);await this.waitOutput(true);
      if(this.cancelStarting||this.data.error)throw new Error(this.data.error||'应用已进入后台，录制已取消');
      this.startedAt=Date.now();this.data.state='recording';this.data.message='系统录制 · '+profile.width+' × '+profile.height+' · 最高 '+profile.frameRate+' 帧/秒';
    } catch(error) {
      try{await this.detach();}finally{try{await this.release();}finally{this.data.state='error';this.data.error=String(error);this.data.message='未开始录制';}}
      if(this.partial&&fs.accessSync(this.partial))fs.unlinkSync(this.partial);
      throw new Error(String(error));
    }
  }
  stop(message:string='视频已留在本机，可预览或导出'):Promise<void> {
    if(this.stopTask)return this.stopTask;
    if(this.data.state!=='recording')return Promise.reject(new Error('当前没有正在录制的视频'));
    this.data.state='stopping';this.data.elapsedSeconds=(Date.now()-this.startedAt)/1000;
    this.stopTask=this.finish(message).finally(()=>{this.stopTask=undefined;});return this.stopTask;
  }
  private async finish(message:string):Promise<void> {
    try {
      await this.detach();this.data.frames=simulation.videoOutputStatus().frames;await this.recorder!.stop();
      await this.release();
      if(this.data.frames<2||fs.statSync(this.partial).size<1024)throw new Error('录制过短，未生成有效视频');
      await this.validateClip(this.partial);
      fs.renameSync(this.partial,this.finalPath);
      this.data.selectedId=this.finalPath.split('/').pop()!;this.refresh();this.data.state='ready';this.data.message=message;
    } catch(error){this.data.state='error';this.data.error=String(error);this.data.message='视频未完成 · 临时文件未加入列表';try{await this.release();}catch(_){}throw new Error(String(error));}
  }
  private async validateClip(path:string):Promise<void> {
    const file:fs.File=await fs.open(path,fs.OpenMode.READ_ONLY);
    let extractor:media.AVMetadataExtractor|undefined=undefined;
    try {
      extractor=await media.createAVMetadataExtractor();extractor.fdSrc={fd:file.fd,offset:0,length:fs.statSync(path).size};
      const metadata:media.AVMetadata=await extractor.fetchMetadata();
      if(!(Number(metadata.duration)>0)||Number(metadata.videoWidth)!==this.data.width||Number(metadata.videoHeight)!==this.data.height)throw new Error('视频校验失败，文件未加入本机视频列表');
    }finally{try{if(extractor)await extractor.release();}finally{fs.closeSync(file);}}
  }
  async exportSelected():Promise<void> {
    if(['starting','recording','stopping','exporting'].includes(this.data.state))throw new Error('请先停止录制');
    const clip=this.selected();if(!clip)throw new Error('请先录制一段视频');
    this.data.state='exporting';this.data.error='';this.data.message='请选择视频保存位置';
    let destination:fs.File|undefined=undefined;
    try {
      const view:picker.DocumentViewPicker=new picker.DocumentViewPicker(this.context);
      const options:picker.DocumentSaveOptions={newFileNames:[clip.name],fileSuffixChoices:['MP4 视频|.mp4']};
      const uris:string[]=await view.save(options);
      if(uris.length===0){this.data.message='已取消导出 · 本机视频仍保留';return;}
      destination=await fs.open(uris[0],fs.OpenMode.READ_WRITE|fs.OpenMode.TRUNC);
      await fs.copyFile(clip.path,destination.fd);await fs.fsync(destination.fd);
      this.data.message='视频已导出';
    } catch(error){this.data.error=String(error);this.data.message='导出失败 · 本机视频仍保留';throw new Error(String(error));}
    finally {if(destination)fs.closeSync(destination);this.data.state='ready';}
  }
}
