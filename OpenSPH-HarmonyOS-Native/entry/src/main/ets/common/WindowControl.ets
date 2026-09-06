import { window } from '@kit.ArkUI';

export class WindowControl {
  private static target:window.Window|undefined=undefined;
  static bind(target:window.Window|undefined):void {WindowControl.target=target;}
  static async immersive():Promise<void> {
    const target=WindowControl.target;if(target===undefined)throw new Error('Main window unavailable');
    await target.setWindowLayoutFullScreen(true);
    await target.setWindowSystemBarProperties({statusBarColor:'#00000000',statusBarContentColor:'#EAF1F6',navigationBarColor:'#00000000',navigationBarContentColor:'#EAF1F6'});
    // Each bar request is independent: an unsupported navigation mode must not leave the status bar visible.
    const errors:string[]=[];
    for(const name of ['status','navigation','navigationIndicator'] as window.SpecificSystemBar[]) {
      try {await target.setSpecificSystemBarEnabled(name,false,false);}catch(e){errors.push(name+': '+String(e));}
    }
    if(errors.length)throw new Error(errors.join('; '));
  }
  static async orient(mode:string):Promise<void> {
    let policy:window.Orientation;
    if(mode==='auto')policy=window.Orientation.AUTO_ROTATION_RESTRICTED;
    else if(mode==='portrait')policy=window.Orientation.PORTRAIT;
    else if(mode==='landscape')policy=window.Orientation.LANDSCAPE;
    else if(mode==='reverse-landscape')policy=window.Orientation.LANDSCAPE_INVERTED;
    else throw new Error('orientation must be auto, portrait, landscape or reverse-landscape');
    if(WindowControl.target===undefined)throw new Error('Main window unavailable');
    await WindowControl.target.setPreferredOrientation(policy);
  }
}
