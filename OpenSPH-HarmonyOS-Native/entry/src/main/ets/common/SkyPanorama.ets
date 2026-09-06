import { image } from '@kit.ImageKit';
import { common } from '@kit.AbilityKit';
import simulation from 'libsimulation.so';

let loading: Promise<void> | undefined = undefined;
export function loadSkyPanorama(context: common.UIAbilityContext): Promise<void> {
  if(loading === undefined) {
    loading = decodePanorama(context).catch((error: Error) => {loading=undefined;throw error;});
  }
  return loading;
}
async function decodePanorama(context: common.UIAbilityContext): Promise<void> {
  const bytes = await context.resourceManager.getRawFileContent('eso0932a.jpg');
  const source = image.createImageSource(bytes.buffer as ArrayBuffer);
  let pixels: image.PixelMap | undefined = undefined;
  try {
    pixels = await source.createPixelMap({desiredSize:{width:2048,height:1024},desiredPixelFormat:image.PixelMapFormat.RGBA_8888});
    const info = await pixels.getImageInfo();
    if(info.size.width!==2048 || info.size.height!==1024) {throw new Error('Unexpected panorama size');}
    const buffer = new ArrayBuffer(2048*1024*4);
    await pixels.readPixelsToBuffer(buffer);
    simulation.setSkyPanorama(buffer,2048,1024);
  } finally {
    if(pixels!==undefined) {await pixels.release();}
    await source.release();
  }
}
