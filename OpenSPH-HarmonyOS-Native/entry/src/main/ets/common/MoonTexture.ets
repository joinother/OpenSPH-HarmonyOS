import { image } from '@kit.ImageKit';
import { common } from '@kit.AbilityKit';
import simulation from 'libsimulation.so';
let loading:Promise<void>|undefined=undefined;
// Coalesce concurrent demand. Failed decoding can be retried explicitly.
export function loadMoonTexture(context:common.UIAbilityContext,retry:boolean=false):Promise<void>{
 if(retry)loading=undefined;
 if(loading===undefined)loading=decode(context).catch((error:Error)=>{loading=undefined;throw error;});
 return loading;
}
async function decode(context:common.UIAbilityContext):Promise<void>{
 const bytes=await context.resourceManager.getRawFileContent('lroc_color_2k.jpg');
 const source=image.createImageSource(bytes.buffer as ArrayBuffer);let pixels:image.PixelMap|undefined=undefined;
 try{
  const meta=await source.getImageInfo();if(meta.size.width!==2048||meta.size.height!==1024)throw new Error('Unexpected Moon dimensions');
  pixels=await source.createPixelMap({desiredPixelFormat:image.PixelMapFormat.RGBA_8888});
  const buffer=new ArrayBuffer(8388608);await pixels.readPixelsToBuffer(buffer);simulation.setMoonTexture(buffer,2048,1024);
 }finally{if(pixels!==undefined)await pixels.release();await source.release();}
}
