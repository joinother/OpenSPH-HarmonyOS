import { SceneVideo } from '../common/SceneVideo';
import { UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import simulation from 'libsimulation.so';
import { WindowControl } from '../common/WindowControl';
import { WindowGeometry } from '../common/WorkspaceLayout';
import { CliBridge } from '../common/CliBridge';

export default class EntryAbility extends UIAbility {
  private mainWindow: window.Window | undefined = undefined;
  private avoidTimer:number=-1;
  private geometryRevision:number=0;
  private changed = ():void => {
    this.refreshAvoid();
    if(this.avoidTimer!==-1)clearTimeout(this.avoidTimer);
    this.avoidTimer=setTimeout(()=>{this.avoidTimer=-1;this.refreshAvoid();},80);
  };
  private refreshAvoid = (): void => {
    if (!this.mainWindow) return;
    try {
      const types: window.AvoidAreaType[] = [window.AvoidAreaType.TYPE_SYSTEM, window.AvoidAreaType.TYPE_CUTOUT, window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR];
      let top: number = 0; let bottom: number = 0; let left: number = 0; let right: number = 0;
      for (const type of types) {
        const a: window.AvoidArea = this.mainWindow.getWindowAvoidArea(type);
        top = Math.max(top,a.topRect.height); bottom = Math.max(bottom,a.bottomRect.height);
        left = Math.max(left,a.leftRect.width); right = Math.max(right,a.rightRect.width);
      }
      const rect=this.mainWindow.getWindowProperties().windowRect;
      const geometry:WindowGeometry={widthPx:rect.width,heightPx:rect.height,topPx:top,bottomPx:bottom,leftPx:left,rightPx:right,revision:++this.geometryRevision};
      AppStorage.setOrCreate('windowGeometry',geometry);
    } catch (e) { hilog.warn(0x0001,'SPHLab','Avoid area: %{public}s',String(e)); }
  };
  private async applyImmersive():Promise<void> {
    if(!this.mainWindow)return;
    try {await WindowControl.immersive();AppStorage.setOrCreate('immersive',true);}
    catch(e) {AppStorage.setOrCreate('immersive',false);hilog.warn(0x0001,'SPHLab','Immersive policy: %{public}s',String(e));}
    this.changed();
  }
  onCreate(want: Want): void { CliBridge.receive(want); }
  onNewWant(want: Want): void { CliBridge.receive(want); }
  async onWindowStageCreate(stage: window.WindowStage): Promise<void> {
    try {
      this.mainWindow = await stage.getMainWindow();
      WindowControl.bind(this.mainWindow);
      try {await WindowControl.orient('auto');}
      catch(e) {hilog.warn(0x0001,'SPHLab','Orientation policy: %{public}s',String(e));}
      await this.applyImmersive();
      this.refreshAvoid();
      this.mainWindow.on('avoidAreaChange',this.changed);
      this.mainWindow.on('windowSizeChange',this.changed);
    } catch (e) { hilog.warn(0x0001,'SPHLab','Window setup: %{public}s',String(e)); }
    try { await stage.loadContent('pages/Index'); }
    catch (e) { hilog.error(0x0001,'SPHLab','Page load failed: %{public}s',String(e)); }
  }
  onWindowStageDestroy(): void {
    if(this.avoidTimer!==-1){clearTimeout(this.avoidTimer);this.avoidTimer=-1;}
    if (this.mainWindow) {
      this.mainWindow.off('avoidAreaChange',this.changed);
      this.mainWindow.off('windowSizeChange',this.changed);
      WindowControl.bind(undefined);
      this.mainWindow = undefined;
    }
  }
  onBackground(): void { SceneVideo.background(); simulation.setRenderActive(false);simulation.pause(true); AppStorage.setOrCreate('appForeground',false); }
  onForeground(): void { simulation.setRenderActive(true);AppStorage.setOrCreate('appForeground',true); this.applyImmersive(); }
  onDestroy(): void { CliBridge.unbind(); simulation.cancel(); }
}
