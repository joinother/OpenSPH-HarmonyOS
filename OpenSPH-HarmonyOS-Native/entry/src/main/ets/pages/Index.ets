import simulation, { SimulationStatus, SimulationConfig, OrbitBodyConfig, OrbitBodyStatus, RenderStatus } from 'libsimulation.so';
import { CliBridge, CommandPayload } from '../common/CliBridge';
import { PlacementPreview, planPlanet, placementPoint, OrbitPreview, previewOrbit, SceneDefinition, BodyDefinition, SavedProject, validateConfig, validateScene, validName, sphereMass, validateOrbitBodies, defaultOrbitBodies, circularBody, copyOrbitBodies, EARTH_MASS_SOLAR } from '../common/SceneModel';
import { themeExperiments, themeConfigMatches, ThemeExperiment } from '../common/ExperimentCatalog';
import { ProjectStore } from '../common/ProjectStore';
import { curves, LengthMetrics } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { WindowControl } from '../common/WindowControl';
import { workspaceLayout, WorkspaceLayout, WindowGeometry } from '../common/WorkspaceLayout';
import { loadSkyPanorama } from '../common/SkyPanorama';
import { fileIo as fs } from '@kit.CoreFileKit';

interface OrbitDraftState { index:number; name:string; fields:string[]; surface:number; }
interface OrbitWorkspace { bodies:OrbitBodyConfig[]; selected:number; drafts:OrbitDraftState[]; }
interface OrbitHistoryEntry { label:string; workspace:OrbitWorkspace; }
interface EditHistoryState { undoCount:number; redoCount:number; undoLabel:string; redoLabel:string; limit:number; scope:string; }
interface UiActionInfo { id:string; label:string; enabled:boolean; selected:boolean; }
interface UiFieldInfo { field:string; value:string|number; enabled:boolean; }
interface EditorState { drafts:OrbitDraftState[]; history:EditHistoryState; vectorPlane:string; orbitIndex:number; orbitName:string; orbitFields:string[]; orbitSurface:number; orbitDraft:boolean; editedBody:number; targetName:string; impactorName:string; title:string; selectingPreset:boolean; }
interface SceneSettings { preset: number; count: number; speed: number; angle: number; duration: number; }
interface SceneState extends SceneSettings { dirty: boolean; }
interface CameraState { yaw: number; pitch: number; zoom: number; focus: number; color: number; }
interface UiState { panelOpen: boolean; toolsVisible: boolean; panel: number; playing: boolean; ioBusy: boolean; foreground: boolean; notice: string; }
interface SafeAreaState { top: number; bottom: number; left: number; right: number; }
interface WindowState { layout:WorkspaceLayout; geometry:WindowGeometry; viewportWidthVp: number; viewportHeightVp: number; widthVp: number; heightVp: number; immersive: boolean; safePx: SafeAreaState; }
interface ProjectSummary { id: string; title: string; savedAt: number; }
interface ProjectList { ok: boolean; projects: ProjectSummary[]; }
interface AppearanceState { clouds:boolean; atmosphere:boolean; trails:boolean; closeup:boolean; autoSpin:boolean; }
interface SkyState {mode:number;brightness:number;reference:string;}
interface PlacementState { active:boolean; name:string; fields:string[]; surface:number; direction:number; preview:PlacementPreview; }
interface ThemeState { id:string; title:string; goal:string; limit:string; modified:boolean; compareId:string; }
interface AppSnapshot { theme:ThemeState; placement:PlacementState; sky:SkyState; editor:EditorState; appearance:AppearanceState; rendering:RenderStatus; definition: SceneDefinition; ok: boolean; protocol: number; simulation: SimulationStatus; scene: SceneState; camera: CameraState; ui: UiState; window: WindowState; }
interface CommandDescription { name: string; payload: string; }
interface CommandCatalog { ok: boolean; commands: CommandDescription[]; }
interface ExperimentInfo { title: string; caption: string; symbol: string; }

@Component
struct ChoiceChip {
  @Prop label: string = '';
  @Prop active: boolean = false;
  @State pressed: boolean = false;
  onPress: () => void = () => {};
  build() {
    Button(this.label, {type:ButtonType.Normal}).fontSize(12).fontWeight(FontWeight.Medium)
      .fontColor(this.active ? '#F1EDFF' : '#B9BACB')
      .backgroundColor(this.active ? '#55493B70' : '#162E3044').borderRadius(18).height(36)
      .border({width:0.6,radius:18,color:this.active?'#807E68AC':'#24D4CDEF'})
      .padding({left:12,right:12}).scale({x:this.pressed?0.95:1,y:this.pressed?0.95:1})
      .animation({curve:curves.springMotion(0.24,0.86)})
      .onTouch((e:TouchEvent) => {this.pressed=e.type===TouchType.Down;})
      .onClick(() => {this.onPress();})
  }
}
@Component
struct FloatingButton {
  @Prop label: string = '';
  @Prop icon: ResourceStr = $r('app.media.ic_focus');
  @Prop active: boolean = false;
  @Prop primary: boolean = false;
  @Prop compact: boolean = false;
  @Prop enabledAction: boolean = true;
  @State pressed: boolean = false;
  onPress: () => void = () => {};
  build() {
    Button({type:ButtonType.Normal}) {
      Row({space:6}) {
        if(!this.compact) {Image(this.icon).width(this.primary?18:15).height(this.primary?18:15).objectFit(ImageFit.Contain)}
        Text(this.label).fontSize(this.primary?14:12).fontWeight(this.primary?FontWeight.Bold:FontWeight.Medium)
          .fontColor(this.primary?'#211936':(this.active?'#F4EFFF':'#DDDCEB')).maxLines(1)
      }.justifyContent(FlexAlign.Center)
    }.height(this.primary?50:42).padding({left:this.primary?22:11,right:this.primary?22:11}).borderRadius(26)
      .backgroundColor(this.primary?'#D9CEFF':(this.active?'#CC4A3D6C':'#87212434'))
      .backgroundBlurStyle(this.primary?BlurStyle.NONE:BlurStyle.COMPONENT_ULTRA_THIN,{colorMode:ThemeColorMode.DARK})
      .border({width:0.7,radius:26,color:this.primary?'#F2EAFF':(this.active?'#A9B5A0EC':'#42D4CDEF')})
      .shadow({radius:this.primary?20:12,color:this.primary?'#363D256F':'#28000000',offsetY:4})
      .scale({x:this.pressed?0.94:1,y:this.pressed?0.94:1}).animation({curve:curves.springMotion(0.26,0.82)})
      .opacity(1).enabled(this.enabledAction).accessibilityText(this.label)
      .onTouch((e:TouchEvent) => {this.pressed=e.type===TouchType.Down;})
      .onClick(() => {this.onPress();})
  }
}
@Component
struct MetricRow {
  @Prop label: string = '';
  @Prop value: string = '';
  build() {
    Row() {
      Text(this.label).fontSize(13).fontColor('#AEBDCD')
      Blank()
      Text(this.value).fontSize(13).fontColor('#EAF1F6').fontWeight(FontWeight.Medium)
    }.width('100%')
  }
}

@Entry
@Component
struct Index {
  @StorageLink('windowGeometry') @Watch('geometryChanged') windowGeometry:WindowGeometry={widthPx:0,heightPx:0,topPx:0,bottomPx:0,leftPx:0,rightPx:0,revision:0};
  @StorageLink('immersive') immersive: boolean = false;
  @StorageLink('appForeground') appForeground: boolean = true;
  @State panelOpen: boolean = false;
  @State toolsVisible: boolean = true;
  @State hudHeight:number=112;
  @State skyMode:number=2;
  @State skyBrightness:number=.65;
  @State viewportWidth: number = 0;
  @State viewportHeight: number = 0;
  @State panelContentOffset: number = 0;
  @State panelOpacity: number = 1;
  private panelEpoch: number = 0;
  private scroller: Scroller = new Scroller();
  @State windowWidth: number = 0;
  @State windowHeight: number = 0;
  @State preset: number = 0;
  @State count: number = 600;
  @State speed: number = 5;
  @State angle: number = 0;
  @State duration: number = 60;
  @State targetRadiusKm: number = 100;
  @State impactorRadiusKm: number = 60;
  @State targetDensity: number = 2700;
  @State impactorDensity: number = 2700;
  @State targetSpin: number = 0;
  @State seed: number = 1234;
  @State title: string = '我的碰撞实验';
  @State targetName: string = '主天体';
  @State impactorName: string = '撞击体';
  @State editedBody: number = 0;
  @State orbitBodies: OrbitBodyConfig[] = defaultOrbitBodies();
  @State orbitEdit: number = 1;
  @State orbitName: string = '蔚蓝';
  @State vectorPlane:string = 'XY';
  @State orbitFields: string[] = ['1','1','0','0','0','29.78474','0'];
  @State orbitSurface: number = 1;
  @State orbitDraft: boolean = false;
  @State placing:boolean=false;
  @State placementName:string='新行星';
  @State placementFields:string[]=['1','2.5','45','0','1'];
  @State placementSurface:number=1;
  @State placementDirection:number=1;
  private placementPlotSize():number {return this.layout().compact||!this.layout().sidePanel?160:220;}
  private placementPath(path:string):string {return this.pathPixels(path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,(v:string):string=>String(Number(v)*this.placementPlotSize()/240)));}
  @State placementScale:number=5;
  private placementView:CameraState|undefined=undefined;
  private placementWasClose:boolean=false;
  private placementWasSpin:boolean=false;
  private placementWasPanel:boolean=false;
  private placementWasTab:number=0;
  private placementLabels:string[]=['质量 · 地球','距离 · AU','方位 · °','倾角 · °','速度 · 圆轨道倍数'];
  @State selectingPreset: boolean = false;
  private orbitLabels: string[] = ['质量','X · AU','Y · AU','Z · AU','Vx · km/s','Vy · km/s','Vz · km/s'];
  @State projects: SavedProject[] = [];
  @State librarySection:string='collision';
  @State activeThemeId:string='';
  private themes:ThemeExperiment[]=themeExperiments();
  @State clouds: boolean = true;
  @State atmosphere: boolean = true;
  @State trails: boolean = true;
  @State closeup: boolean = false;
  @State autoSpin: boolean = false;
  @State skyLoadError:string='';
  @State rendering: RenderStatus = {panoramaReady:false,panoramaBlend:0,compositionX:.5,compositionY:.5,compositionScale:1,sceneRevision:0,surfaceStarts:0,cameraMoving:false,centerX:0,centerY:0,centerZ:0,skyReady:false,skyStars:0,skyGalaxy:0,ready:false,texturesReady:false,active:true,frames:0,submitMs:0,previewSeconds:0,error:''};
  @State colorMode: number = 0;
  @State focus: number = -1;
  @State zoom: number = 2.7;
  @State yaw: number = 0.15;
  @State pitch: number = 0.25;
  @State dirty: boolean = false;
  @State notice: string = '拖动旋转视角 · 双指缩放';
  @State tab: number = 0;
  @State ioBusy: boolean = false;
  @State playing: boolean = false;
  @State info: SimulationStatus = {state:'empty',error:'',count:0,frames:0,selected:-1,time:0,duration:60,stepMs:0,steps:0,maxSpeed:0,meanDensity:0};
  private poll: number = -1;
  private dragYaw: number = 0;
  private dragPitch: number = 0;
  private pinchZoom: number = 2.7;
  private experiments: ExperimentInfo[] = [
    {title:'正面碰撞',caption:'两颗岩质天体相遇',symbol:'01'},
    {title:'掠过与碰撞',caption:'改变偏移，观察碎片',symbol:'02'},
    {title:'旋转天体',caption:'探索旋转下的形变',symbol:'03'},
    {title:'双体轨道',caption:'引力与椭圆轨道',symbol:'04'},
    {title:'行星系统',caption:'所有天体相互吸引',symbol:'05'},
    {title:'自定义系统',caption:'亲手搭建一片星系',symbol:'06'}
  ];
  private stateLabel(): string {
    if (this.info.state === 'preparing') return '正在构建场景';
    if (this.info.state === 'running') return '正在计算';
    if (this.info.state === 'paused') return '已暂停';
    if (this.info.state === 'completed') return '计算完成';
    if (this.info.state === 'cancelled') return '已停止';
    if (this.info.state === 'failed') return '计算异常';
    if (this.info.state === 'replay') return '已载入回放';
    return '准备实验';
  }
  private directory(): string { return (this.getUIContext().getHostContext() as common.UIAbilityContext).filesDir; }
  aboutToAppear(): void {
    this.refreshProjects();
    loadSkyPanorama(this.getUIContext().getHostContext() as common.UIAbilityContext).catch((error:Error) => {this.skyLoadError=error.message;});
    this.prepare(false);
    CliBridge.bind((command: string, payload: CommandPayload) => this.execute(command,payload));
    this.poll = setInterval(() => {
      const previousState: string = this.info.state;
      this.info = simulation.status();this.rendering=simulation.renderStatus();
      if (this.info.state === 'completed' && previousState !== 'completed' && !this.ioBusy) { this.notice = '计算完成 · 可在时间轴回看结果'; }
      if (this.playing && this.appForeground && this.info.frames > 0) {
        const next: number = this.info.selected < 0 ? 0 : this.info.selected + 1;
        if (next >= this.info.frames) { this.playing = false; }
        else { simulation.seek(next); }
      }
    }, 200);
  }
  aboutToDisappear(): void { this.stopCameraMotion();CliBridge.unbind(); this.panelEpoch++; clearInterval(this.poll); simulation.pause(true); }
  @State private orbitDrafts:OrbitDraftState[]=[];
  @State private orbitUndo:OrbitHistoryEntry[]=[];
  @State private orbitRedo:OrbitHistoryEntry[]=[];
  private clearOrbitHistory():void {this.orbitUndo=[];this.orbitRedo=[];}
  private editHistory():EditHistoryState {
    return {undoCount:this.orbitUndo.length,redoCount:this.orbitRedo.length,
      undoLabel:this.orbitUndo.length?this.orbitUndo[this.orbitUndo.length-1].label:'',
      redoLabel:this.orbitRedo.length?this.orbitRedo[this.orbitRedo.length-1].label:'',limit:20,scope:'custom-body-initial-conditions'};
  }
  private bodyDrafts():OrbitDraftState[] {
    if(this.preset!==5)return [];
    const drafts:OrbitDraftState[]=this.orbitDrafts.filter((d:OrbitDraftState):boolean=>d.index!==this.orbitEdit)
      .map((d:OrbitDraftState):OrbitDraftState=>({index:d.index,name:d.name,fields:d.fields.slice(),surface:d.surface}));
    if(this.orbitDraft)drafts.push({index:this.orbitEdit,name:this.orbitName,fields:this.orbitFields.slice(),surface:this.orbitSurface});
    return drafts.sort((a:OrbitDraftState,b:OrbitDraftState):number=>a.index-b.index);
  }
  private captureOrbitWorkspace():OrbitWorkspace {
    return {bodies:copyOrbitBodies(this.orbitBodies),selected:this.orbitEdit,drafts:this.bodyDrafts()};
  }
  private hasBodyDraft(index:number):boolean {return this.bodyDrafts().some((d:OrbitDraftState):boolean=>d.index===index);}
  private restoreBodyDrafts(workspace:OrbitWorkspace):void {
    this.orbitBodies=copyOrbitBodies(workspace.bodies);
    this.orbitDrafts=workspace.drafts.map((d:OrbitDraftState):OrbitDraftState=>({index:d.index,name:d.name,fields:d.fields.slice(),surface:d.surface}));
    this.orbitEdit=-1;this.orbitDraft=false;this.selectOrbit(workspace.selected);
  }
  private discardOrbitDraft():void {
    this.orbitDrafts=this.bodyDrafts().filter((d:OrbitDraftState):boolean=>d.index!==this.orbitEdit);
    const selected=this.orbitEdit;this.orbitEdit=-1;this.orbitDraft=false;this.selectOrbit(selected);
    this.notice='已还原这颗天体的输入 · 模拟与其他草稿保留';
  }
  private travelOrbitHistory(redo:boolean):void {
    const source=redo?this.orbitRedo:this.orbitUndo;
    if(!source.length)throw new Error('没有可'+(redo?'重做':'撤销')+'的天体编辑');
    const entry=source[source.length-1],current:OrbitHistoryEntry={label:entry.label,workspace:this.captureOrbitWorkspace()};
    this.installOrbitWorkspace(entry.workspace);
    if(redo){this.orbitRedo=this.orbitRedo.slice(0,-1);this.orbitUndo=this.orbitUndo.concat([current]).slice(-20);}
    else {this.orbitUndo=this.orbitUndo.slice(0,-1);this.orbitRedo=this.orbitRedo.concat([current]).slice(-20);}
    this.notice='已'+(redo?'重做':'撤销')+'：'+entry.label+' · 初始条件已恢复，旧轨迹已清空';
  }
  private overviewCamera:CameraState|undefined=undefined;
  private rememberOverview():void {if(this.focus<0)this.overviewCamera={yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:-1,color:this.colorMode};}
  private focusBody(body:number):void {this.stopCameraMotion();this.rememberOverview();this.focus=body;if(this.preset===5)this.selectOrbit(body);this.camera();if(this.preset>=3)this.notice='已选中 '+this.surfaceName()+' · 可近看或编辑初始条件';}
  private cameraTween: number = -1;
  private stopCameraMotion(): void {if(this.cameraTween!==-1){clearInterval(this.cameraTween);this.cameraTween=-1;}}
  private easeCamera(yaw: number, pitch: number, zoom: number): void {
    this.stopCameraMotion();const y=this.yaw,p=this.pitch,z=this.zoom,start=Date.now();
    this.cameraTween=setInterval(() => {const t=Math.min(1,(Date.now()-start)/320);const k=1-Math.pow(1-t,3);
      this.yaw=y+(yaw-y)*k;this.pitch=p+(pitch-p)*k;this.zoom=z+(zoom-z)*k;this.camera();
      if(t===1)this.stopCameraMotion();},16);
  }
  private geometryChanged():void {this.composeViewport();}
  private layout():WorkspaceLayout {
    const ui=this.getUIContext(),g=this.windowGeometry;
    return workspaceLayout(this.viewportWidth,this.viewportHeight,this.panelOpen&&this.toolsVisible,
      {top:ui.px2vp(g.topPx),bottom:ui.px2vp(g.bottomPx),left:ui.px2vp(g.leftPx),right:ui.px2vp(g.rightPx)});
  }
  private updateViewport(width:number,height:number):void {
    if(width<=0||height<=0)return;
    this.stopCameraMotion();
    this.viewportWidth=width;this.viewportHeight=height;
    this.composeViewport();
  }
  private composeViewport():void {
    let x:number=.5,y:number=.5,scale:number=1;
    if(this.closeup&&this.panelOpen&&this.toolsVisible&&this.viewportWidth>0&&this.viewportHeight>0){
      const region=this.layout().scene;
      const radius=Math.min(Math.min(this.viewportWidth,this.viewportHeight)*.37,this.viewportHeight*.28)*Math.max(.4,Math.min(1.1,2.7/this.zoom));
      x=(region.x+region.width/2)/this.viewportWidth;y=(region.y+region.height/2)/this.viewportHeight;
      scale=Math.min(1,Math.max(0,Math.min(region.width,region.height)/2-12)/radius);
    }
    simulation.setComposition(Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y)),Math.max(.05,scale));
  }
  private camera(): void {
    this.composeViewport();
    simulation.setSky(this.skyMode,this.skyBrightness);
    simulation.setCamera(this.yaw,this.pitch,this.zoom,this.focus,this.colorMode);
    simulation.setAppearance(this.clouds,this.atmosphere,this.trails,this.closeup,this.autoSpin);
  }
  private surfaceName(): string {if(this.preset===5)return this.orbitBodies[Math.max(0,this.focus)]?.name??'行星';return this.focus===0?'恒星':(this.focus===2?'厚云行星':(this.focus===3?'荒漠行星':'海洋行星'));}
  private openSurface(body: number = 1): void {
    if(this.preset<3)return;
    this.rememberOverview();this.focus=body;if(this.preset===5)this.selectOrbit(body);this.closeup=true;this.autoSpin=true;this.colorMode=0;this.camera();this.setPanel(-1);
    this.notice='近看天体 · 保留当前模拟时间与轨迹';
  }
  private closeSurface(): void {
    this.closeup=false;this.autoSpin=false;this.focus=-1;this.camera();
    const saved=this.overviewCamera;this.overviewCamera=undefined;
    if(saved)this.easeCamera(saved.yaw,saved.pitch,saved.zoom);
    this.notice='系统全景 · 保留当前模拟时间与轨迹';
  }
  private changeAppearance(p: CommandPayload): void {
    const values: (boolean|undefined)[]=[p.clouds,p.atmosphere,p.trails,p.closeup,p.autoSpin];
    for(const v of values)if(v!==undefined&&typeof v!=='boolean')throw new Error('外观参数必须是 boolean');
    const closeup:boolean=p.closeup??this.closeup;
    if(closeup&&this.preset<3)throw new Error('近看表面仅支持引力预设');
    this.clouds=p.clouds??this.clouds;this.atmosphere=p.atmosphere??this.atmosphere;this.trails=p.trails??this.trails;
    if(closeup)this.rememberOverview();
    this.closeup=closeup;this.autoSpin=p.autoSpin??this.autoSpin;
    if(this.closeup&&this.focus<0)this.focus=1;
    this.camera();
  }
  private prepare(run: boolean): boolean {
    this.stopCameraMotion();this.overviewCamera=undefined;this.placing=false;this.placementView=undefined;
    try {
      this.playing = false;
      simulation.startScene(this.config(),!run);
      simulation.pause(!run);
      this.dirty = false;
      this.notice = run ? (this.preset>=3?'正在计算多体引力 · 轨迹来自积分结果':'正在运行真实 SPH 求解') : '场景就绪后，点击开始实验';
      this.camera();
      this.info = simulation.status();
      return true;
    } catch (_) { this.notice = '场景创建失败，请检查参数'; return false; }
  }
  private themeState():ThemeState {
    const t=this.themes.find((e:ThemeExperiment):boolean=>e.id===this.activeThemeId);
    if(!t)return {id:'',title:'',goal:'',limit:'',modified:false,compareId:''};
    return {id:t.id,title:t.title,goal:t.goal,limit:t.limit,modified:!themeConfigMatches(this.config(),t.config),compareId:t.compareId};
  }
  private chooseTheme(id:string):void {
    const t=themeExperiments().find((e:ThemeExperiment):boolean=>e.id===id);
    if(!t)throw new Error('未知主题实验');
    validateConfig(t.config);
    // Native rejection must leave the current scene/editor untouched.
    simulation.startScene(t.config,true);simulation.pause(true);
    this.applyConfig(t.config);this.stopCameraMotion();this.overviewCamera=undefined;
    this.placing=false;this.placementView=undefined;this.playing=false;this.selectingPreset=false;
    this.activeThemeId=t.id;this.title=t.title;this.targetName='玄岩';this.impactorName='赭岩';
    this.yaw=t.yaw;this.pitch=t.pitch;this.zoom=t.zoom;this.focus=t.focus;
    this.clouds=true;this.atmosphere=true;this.trails=true;this.closeup=t.closeup;this.autoSpin=t.closeup;this.colorMode=0;
    this.dirty=false;this.toolsVisible=true;this.info=simulation.status();this.camera();this.setPanel(-1);
    this.notice=t.question+' · 点击开始实验';
  }
  private choose(i: number): void {
    if (this.ioBusy) return;
    this.activeThemeId='';this.clearOrbitHistory();
    this.targetRadiusKm=100;this.impactorRadiusKm=60;this.targetDensity=2700;this.impactorDensity=2700;this.targetSpin=0;
    this.editedBody=0;this.title=i>=3?(i===3?'双体轨道':'行星系统'):(i===2?'旋转实验':'碰撞实验');
    this.duration=i>=3?3:60;this.colorMode=0;
    this.closeup=false;this.autoSpin=false;
    this.preset = i;this.selectingPreset=false;
    this.angle = i === 1 ? 45 : 0;
    this.speed = i>=3?1:(i === 2 ? 2 : 5);
    this.focus = -1;
    this.yaw = 0.15; this.pitch = 0.25; this.zoom = 2.7;
    if(i===5){this.title='自定义系统';this.orbitBodies=defaultOrbitBodies();this.selectOrbit(1,true);}
    this.prepare(false);
  }
  private run(): void {
    this.playing = false;
    if (this.info.state === 'running') { simulation.pause(true); this.notice = '已暂停，可回看时间轴或调整视角'; }
    else if (this.dirty || this.info.state === 'completed' || this.info.state === 'cancelled' || this.info.state === 'failed' || this.info.state === 'replay') { this.prepare(true); }
    else { simulation.pause(false); this.notice = (this.preset>=3?'正在计算多体引力 · 轨迹来自积分结果':'正在运行真实 SPH 求解'); }
    this.info = simulation.status();
  }
  private config(): SimulationConfig {
    const c: SimulationConfig={preset:this.preset,count:this.count,speed:this.speed,angle:this.angle,duration:this.duration,
      targetRadiusKm:this.targetRadiusKm,impactorRadiusKm:this.impactorRadiusKm,targetDensity:this.targetDensity,
      impactorDensity:this.impactorDensity,targetSpin:this.targetSpin,seed:this.seed};
    if(this.preset===5)c.orbitBodies=copyOrbitBodies(this.orbitBodies);
    validateConfig(c);return c;
  }
  private applyConfig(c: SimulationConfig): void {
    validateConfig(c);this.activeThemeId='';this.clearOrbitHistory();
    if(c.preset!==this.preset){this.closeup=false;this.autoSpin=false;}
    this.preset=c.preset;this.count=c.count;this.speed=c.speed;this.angle=c.angle;this.duration=c.duration;
    this.targetRadiusKm=c.targetRadiusKm;this.impactorRadiusKm=c.impactorRadiusKm;
    this.targetDensity=c.targetDensity;this.impactorDensity=c.impactorDensity;this.targetSpin=c.targetSpin;this.seed=c.seed;
    this.editedBody=0;
    if(c.preset===5){this.orbitBodies=copyOrbitBodies(c.orbitBodies!);this.selectOrbit(1,true);this.focus=-1;this.closeup=false;this.autoSpin=false;}
    if(this.focus>this.maxFocus())this.focus=-1;
    if(c.preset>=3&&this.colorMode===2)this.colorMode=0;
  }
  private definition(): SceneDefinition {
    if(this.preset>=3){const scene:SceneDefinition={schemaVersion:1,model:this.preset===5?'nbody-custom-v1':'nbody-v1',title:this.title,config:this.config(),bodies:[]};return scene;}
    const bodies: BodyDefinition[]=[{id:'primary',name:this.targetName,kind:'rock',radiusKm:this.targetRadiusKm,density:this.targetDensity}];
    if(this.preset!==2) bodies.push({id:'impactor',name:this.impactorName,kind:'rock',radiusKm:this.impactorRadiusKm,density:this.impactorDensity});
    const scene: SceneDefinition={schemaVersion:1,model:'sph-rock-v1',title:this.title,config:this.config(),bodies:bodies};
    return scene;
  }
  private maxFocus():number {return this.preset===5?this.orbitBodies.length-1:(this.preset===4?3:1);}
  private selectOrbit(i:number,reset:boolean=false):void {
    if(reset){this.orbitDrafts=[];this.overviewCamera=undefined;}
    else {
      if(i===this.orbitEdit)return;
      this.orbitDrafts=this.orbitDrafts.filter((d:OrbitDraftState):boolean=>d.index!==this.orbitEdit);
      if(this.orbitDraft)this.orbitDrafts.push({index:this.orbitEdit,name:this.orbitName,fields:this.orbitFields.slice(),surface:this.orbitSurface});
      const saved=this.orbitDrafts.find((d:OrbitDraftState):boolean=>d.index===i);
      if(saved){this.orbitEdit=i;this.orbitName=saved.name;this.orbitFields=saved.fields.slice();this.orbitSurface=saved.surface;this.orbitDraft=true;return;}
    }
    const b:OrbitBodyConfig=this.orbitBodies[i];this.orbitEdit=i;this.orbitName=b.name;this.orbitSurface=b.surface;
    this.orbitFields=[String(i===0?b.massSolar:b.massSolar/EARTH_MASS_SOLAR),String(b.xAU),String(b.yAU),String(b.zAU),String(b.vxKmS),String(b.vyKmS),String(b.vzKmS)];
    this.orbitDraft=false;
  }
  private installOrbitWorkspace(workspace:OrbitWorkspace):void {
    validateOrbitBodies(workspace.bodies);
    const config=this.config();config.orbitBodies=copyOrbitBodies(workspace.bodies);validateConfig(config);
    // Submit validated initial conditions before altering drafts or history.
    simulation.startScene(config,true);simulation.pause(true);
    this.stopCameraMotion();this.overviewCamera=undefined;this.playing=false;this.placing=false;this.placementView=undefined;
    this.restoreBodyDrafts(workspace);this.focus=-1;this.closeup=false;this.autoSpin=false;
    let mass:number=0,cx:number=0,cy:number=0,cz:number=0;
    for(const b of workspace.bodies){mass+=b.massSolar;cx+=b.massSolar*b.xAU;cy+=b.massSolar*b.yAU;cz+=b.massSolar*b.zAU;}
    cx/=mass;cy/=mass;cz/=mass;
    let extent:number=0;
    for(const b of workspace.bodies)extent=Math.max(extent,Math.sqrt((b.xAU-cx)**2+(b.yAU-cy)**2+(b.zAU-cz)**2));
    this.zoom=Math.min(15,Math.max(2.7,extent*1.18));this.dirty=false;this.camera();this.info=simulation.status();
  }
  private replaceOrbits(bodies:OrbitBodyConfig[],selected:number,label:string,applied:number=-1,removed:number=-1):void {
    validateOrbitBodies(bodies);
    const before=this.captureOrbitWorkspace();
    const drafts:OrbitDraftState[]=before.drafts.filter((d:OrbitDraftState):boolean=>d.index!==applied&&d.index!==removed)
      .map((d:OrbitDraftState):OrbitDraftState=>({index:removed>=0&&d.index>removed?d.index-1:d.index,name:d.name,fields:d.fields.slice(),surface:d.surface}));
    this.installOrbitWorkspace({bodies:bodies,selected:selected,drafts:drafts});
    this.orbitUndo=this.orbitUndo.concat([{label:label,workspace:before}]).slice(-20);this.orbitRedo=[];
    this.notice='已'+label+' · 可撤销，其他天体草稿保留，旧轨迹已清空';
  }
  private applyOrbit(strict:boolean=false):void {
    try {
      if(this.orbitFields.some((v:string):boolean=>v.trim().length===0))throw new Error('请填写全部数值');
      const v:number[]=this.orbitFields.map((s:string):number=>Number(s));
      const b:OrbitBodyConfig={name:validName(this.orbitName),massSolar:v[0]*(this.orbitEdit===0?1:EARTH_MASS_SOLAR),xAU:v[1],yAU:v[2],zAU:v[3],vxKmS:v[4],vyKmS:v[5],vzKmS:v[6],surface:this.orbitSurface};
      const bodies:OrbitBodyConfig[]=copyOrbitBodies(this.orbitBodies);bodies[this.orbitEdit]=b;
      this.replaceOrbits(bodies,this.orbitEdit,'修改 · '+b.name,this.orbitEdit);
    }catch(e){this.notice=String(e);if(strict)throw new Error(String(e));}
  }
  private placementPreview():PlacementPreview {return planPlanet(this.orbitBodies,this.placementName,this.placementFields,this.placementSurface,this.placementDirection,this.placementScale);}
  private beginPlacement():void {
    if(this.placing)return;
    this.stopCameraMotion();this.placementView={yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:this.focus,color:this.colorMode};
    this.placementWasClose=this.closeup;this.placementWasSpin=this.autoSpin;this.placementWasPanel=this.panelOpen;this.placementWasTab=this.tab;
    this.placementName='新行星 '+this.orbitBodies.length;this.placementFields=['1',String(2+this.orbitBodies.length*.35),'45','0','1'];this.placementSurface=1;this.placementDirection=1;
    this.placementScale=planPlanet(this.orbitBodies,this.placementName,this.placementFields,this.placementSurface,this.placementDirection).plotScale;
    this.placing=true;this.setPanel(0);this.notice='放置预览 · 确认前不会改变模拟';
  }
  private cancelPlacement():void {
    this.placing=false;const view=this.placementView;this.placementView=undefined;
    if(view){this.stopCameraMotion();this.yaw=view.yaw;this.pitch=view.pitch;this.zoom=view.zoom;this.focus=view.focus;this.colorMode=view.color;this.closeup=this.placementWasClose;this.autoSpin=this.placementWasSpin;this.camera();}
    this.setPanel(this.placementWasPanel?this.placementWasTab:-1);this.notice='已取消放置 · 原模拟与编辑草稿保留';
  }
  private confirmPlacement():void {
    const preview=this.placementPreview();if(!preview.valid||!preview.body)throw new Error(preview.error);
    const bodies=copyOrbitBodies(this.orbitBodies).concat([preview.body]);
    this.replaceOrbits(bodies,bodies.length-1,'添加 · '+preview.body.name);this.placing=false;this.placementView=undefined;this.setPanel(0);
    this.notice='新行星已加入 · 可撤销，其他草稿保留，从零重新计算';
  }
  private movePlacement(x:number,y:number):void {
    if(!this.placing||this.ioBusy)throw new Error('当前未在放置行星');
    const point=placementPoint(x,y,this.placementPreview().plotScale);
    this.placementFields=this.placementFields.map((v:string,i:number):string=>i===1?point[0].toFixed(3):i===2?point[1].toFixed(2):v);
  }
  private placementGesture(e:GestureEvent):void {
    const finger=e.fingerList[0];if(!finger)return;
    try{this.movePlacement(finger.localX/this.placementPlotSize(),finger.localY/this.placementPlotSize());}catch(e){this.notice=String(e);}
  }
  private removeOrbit():void {
    if(this.orbitEdit===0||this.orbitBodies.length<=2)return;
    const bodies=copyOrbitBodies(this.orbitBodies);bodies.splice(this.orbitEdit,1);this.replaceOrbits(bodies,Math.min(this.orbitEdit,bodies.length-1),'删除 · '+this.orbitBodies[this.orbitEdit].name,-1,this.orbitEdit);
  }
  private refreshProjects(): void {
    try { this.projects=ProjectStore.list(this.directory()); }
    catch (_) { this.notice='实验库暂时无法读取'; }
  }
  private saveProject(title: string): SavedProject {
    const scene: SceneDefinition=this.definition();scene.title=validName(title);
    const saved: SavedProject=ProjectStore.save(this.directory(),scene);
    this.title=scene.title;this.refreshProjects();this.notice='已另存实验 · '+scene.title;
    return saved;
  }
  private openProject(id: string): void {
    const p: SavedProject=ProjectStore.load(this.directory(),id);
    validateScene(p.scene);this.applyConfig(p.scene.config);this.title=p.scene.title;
    this.targetName=p.scene.bodies.length>0?p.scene.bodies[0].name:'恒星';this.impactorName=p.scene.bodies.length>1?p.scene.bodies[1].name:'撞击体';
    this.focus=-1;this.zoom=2.7*Math.max(1,this.targetRadiusKm/100);
    if(!this.prepare(false)) throw new Error(this.notice);
    this.notice='已载入参数 · 点击开始重新计算';
  }
  private saveScene(): void {
    if(this.ioBusy) return;
    try {this.saveProject(this.title);} catch (e) {this.notice=String(e);}
  }
  private loadScene(): void {
    if(this.ioBusy) return;
    this.refreshProjects();this.setPanel(2);
  }
  private lastIOOk: boolean = false;
  private async replayIO(load: boolean): Promise<void> {
    this.lastIOOk = false;
    this.ioBusy = true; this.playing = false; simulation.pause(true);
    try {
      const ok: boolean = load ? await simulation.loadReplay(this.directory()) : await simulation.saveReplay(this.directory());
      this.lastIOOk = ok;
      this.notice = ok ? (load ? '已载入历史，可拖动时间轴' : '已保存最近 240 帧以内的回放') : (load ? '没有可用的回放文件' : '暂无可保存的粒子帧');
      this.info = simulation.status();
      if(load&&ok) {
        this.clearOrbitHistory();
        if(this.info.config) {this.applyConfig(this.info.config);this.title='历史回放';this.targetName='主天体';this.impactorName='撞击体';this.dirty=false;this.camera();this.notice='回放已载入 · 求解参数已恢复';}
        else {if(this.preset>=3){this.preset=0;this.speed=5;this.duration=60;this.title='旧版碰撞回放';this.closeup=false;this.autoSpin=false;this.camera();}this.notice='旧版回放 · 原始参数未知，开始实验将使用当前参数';}
      }
    } catch (_) { this.notice = '回放文件读写失败'; }
    finally { this.ioBusy = false; }
  }
  onBackPress(): boolean {
    if(this.placing){this.cancelPlacement();return true;}
    if(this.panelOpen) {this.setPanel(-1);return true;}
    if(this.closeup||this.focus>=0){this.closeSurface();return true;}
    if(!this.toolsVisible) {this.setTools(true);return true;}
    return false;
  }
  private dockWidth(): number {return this.layout().dock.width;}
  private drawerHeight(): number {return this.layout().drawer.height;}
  private setTools(value: boolean): void {
    this.panelEpoch++;
    if(!value) this.panelOpen=false;
    this.toolsVisible=value;this.composeViewport();
  }
  private togglePanel(value: number): void {this.setPanel(this.panelOpen&&this.tab===value?-1:value);}
  private setPanel(value: number): void {
    const epoch: number = ++this.panelEpoch;
    if(value===-1) {this.panelOpen=false;this.composeViewport();return;}
    this.toolsVisible=true;
    if(!this.panelOpen) {this.tab=value;this.panelOpen=true;this.composeViewport();this.panelOpacity=1;this.panelContentOffset=0;this.scroller.scrollEdge(Edge.Top);return;}
    this.getUIContext().animateTo({duration:90,curve:Curve.EaseOut,onFinish:() => {
      if(epoch!==this.panelEpoch||!this.panelOpen) return;
      this.tab=value;this.scroller.scrollEdge(Edge.Top);
      this.getUIContext().animateTo({duration:180,curve:Curve.EaseOut},() => {this.panelOpacity=1;this.panelContentOffset=0;});
    }},() => {this.panelOpacity=0;this.panelContentOffset=8;});
  }
  private checked(value: number | undefined, low: number, high: number, integer: boolean = false): number {
    if(typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value))) {
      throw new Error('invalid or missing numeric parameter ['+low+','+high+']');
    }
    return value;
  }
  private snapshot(): string {
    this.info=simulation.status();
    const snapshot: AppSnapshot = {theme:this.themeState(),placement:{active:this.placing,name:this.placementName,fields:this.placementFields.slice(),surface:this.placementSurface,direction:this.placementDirection,preview:this.placementPreview()},sky:{mode:this.skyMode,brightness:this.skyBrightness,reference:this.rendering.panoramaReady?'photographic-panorama':'procedural-fallback'},ok:true,protocol:1,definition:this.definition(),editor:this.editorState(),
      appearance:{clouds:this.clouds,atmosphere:this.atmosphere,trails:this.trails,closeup:this.closeup,autoSpin:this.autoSpin},rendering:simulation.renderStatus(),
      simulation:this.info,
      scene:{preset:this.preset,count:this.count,speed:this.speed,angle:this.angle,duration:this.duration,dirty:this.dirty},
      camera:{yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:this.focus,color:this.colorMode},
      ui:{panelOpen:this.panelOpen,toolsVisible:this.toolsVisible,panel:this.tab,playing:this.playing,ioBusy:this.ioBusy,foreground:this.appForeground,notice:this.notice},
      window:{layout:this.layout(),geometry:this.windowGeometry,viewportWidthVp:this.viewportWidth,viewportHeightVp:this.viewportHeight,widthVp:this.windowWidth,heightVp:this.windowHeight,immersive:this.immersive,
        safePx:{top:this.windowGeometry.topPx,bottom:this.windowGeometry.bottomPx,left:this.windowGeometry.leftPx,right:this.windowGeometry.rightPx}}};
    return JSON.stringify(snapshot);
  }
  private editorState():EditorState {
    return {drafts:this.bodyDrafts(),history:this.editHistory(),vectorPlane:this.vectorPlane,orbitIndex:this.orbitEdit,orbitName:this.orbitName,orbitFields:this.orbitFields.slice(),orbitSurface:this.orbitSurface,orbitDraft:this.orbitDraft,
      editedBody:this.editedBody,targetName:this.targetName,impactorName:this.impactorName,title:this.title,selectingPreset:this.selectingPreset};
  }
  private uiActions():UiActionInfo[] {
    const a:UiActionInfo[]=[];
    const add=(id:string,label:string,enabled:boolean=true,selected:boolean=false):void=>{a.push({id:id,label:label,enabled:enabled&&!this.ioBusy,selected:selected});};
    add('panel.parameters','参数',true,this.panelOpen&&this.tab===0);add('panel.observe','观察',true,this.panelOpen&&this.tab===1);add('panel.library','实验库',true,this.panelOpen&&this.tab===2);
    add('panel.close','收起');add('ui.focus','专注');add('ui.restore','显示工具');add('ui.back','返回',this.panelOpen||this.closeup||this.focus>=0||!this.toolsVisible);
    for(const t of this.themes)add('theme.'+t.id,t.title,true,this.activeThemeId===t.id);
    add('theme.restore','恢复主题初始条件',this.activeThemeId!=='');
    add('theme.compare','切换速度对照',this.themeState().compareId!=='');
    add('library.collision','碰撞',true,this.librarySection==='collision');add('library.explore','探索',true,this.librarySection==='explore');add('library.saved','我的实验',true,this.librarySection==='saved');
    add('presets.show','切换实验',this.preset===5);
    for(let i=0;i<this.experiments.length;i++)add('preset.'+i,this.experiments[i].title,true,this.preset===i);
    add('simulation.toggle',this.info.state==='running'?'暂停实验':'开始实验',this.info.state!=='preparing');add('simulation.apply','应用参数 · 重新生成');
    add('replay.toggle',this.playing?'暂停回放':'播放回放',this.info.frames>1,this.playing);add('replay.latest','最新',this.info.frames>0);
    add('replay.save','保存回放',this.info.frames>0);add('replay.load','载入回放');
    add('project.save','另存实验');add('project.open','打开实验库');
    for(const project of this.projects)add('project.load.'+project.id,'载入实验 · '+project.scene.title);
    add('surface.toggle',this.closeup?'返回轨道':'近看行星',this.preset>=3,this.closeup);
    add('selection.edit','编辑这颗天体',this.preset===5&&this.focus>=0);
    add('surface.previous','上一颗',this.preset===5&&this.closeup);add('surface.next','下一颗',this.preset===5&&this.closeup);
    for(let i=0;i<=this.maxFocus();i++){add('focus.'+i,'跟踪天体 '+i,true,this.focus===i);if(this.preset>=3)add('surface.'+i,'近看天体 '+i,true,this.closeup&&this.focus===i);}
    add('orbit.plane.xy','XY 平面',this.preset===5,this.vectorPlane==='XY');add('orbit.plane.xz','XZ 平面',this.preset===5,this.vectorPlane==='XZ');
    add('sky.mode.0','纯净',true,this.skyMode===0);add('sky.mode.1','星空',true,this.skyMode===1);add('sky.mode.2','银河',true,this.skyMode===2);
    add('focus.all','全景');add('camera.out','拉远');add('camera.in','拉近');add('camera.reset','复位视角');
    add('color.0','原色',true,this.colorMode===0);add('color.1','速度',true,this.colorMode===1);add('color.2','密度',this.preset<3,this.colorMode===2);
    add('appearance.clouds','云层',this.preset>=3,this.clouds);add('appearance.atmosphere','大气',this.preset>=3,this.atmosphere);add('appearance.trails','轨迹',this.preset>=3,this.trails);add('appearance.spin','外观自转',this.preset>=3,this.autoSpin);
    add('body.primary','主天体',this.preset<3,this.editedBody===0);add('body.impactor','撞击体',this.preset<2,this.editedBody===1);
    add('placement.cancel','取消放置',this.placing);add('placement.confirm','确认加入 · 重新计算',this.placing&&this.placementPreview().valid);
    add('placement.circular','圆轨道',this.placing);add('placement.still','相对静止',this.placing);add('placement.escape','掠过',this.placing);add('placement.reverse','反向',this.placing,this.placementDirection===-1);
    for(let i=1;i<=3;i++)add('placement.surface.'+i,['海洋','厚云','荒漠'][i-1],this.placing,this.placementSurface===i);
    add('orbit.add','添加行星',this.preset===5&&this.orbitBodies.length<8);add('orbit.remove','删除天体',this.preset===5&&this.orbitEdit>0&&this.orbitBodies.length>2);
    add('orbit.undo','撤销天体编辑',this.preset===5&&this.orbitUndo.length>0);add('orbit.redo','重做天体编辑',this.preset===5&&this.orbitRedo.length>0);
    add('orbit.discard','还原当前输入',this.preset===5&&this.orbitDraft);
    add('orbit.apply','应用天体 · 重新生成',this.preset===5&&this.orbitDraft);add('orbit.near','近看这颗天体',this.preset===5);
    if(this.preset===5)for(let i=0;i<this.orbitBodies.length;i++)add('orbit.select.'+i,this.orbitBodies[i].name,true,this.orbitEdit===i);
    for(let i=1;i<=3;i++)add('orbit.surface.'+i,['海洋','厚云','荒漠'][i-1],this.preset===5&&this.orbitEdit>0,this.orbitSurface===i);
    if(this.placing)for(const action of a)if(!action.id.startsWith('placement.')&&action.id!=='ui.back'&&action.id!=='panel.close')action.enabled=false;
    return a;
  }
  private uiFields():UiFieldInfo[] {
    const active:boolean=!this.ioBusy,rock:boolean=this.preset<3;
    const fields:UiFieldInfo[]=[{field:'sky.brightness',value:this.skyBrightness*100,enabled:active},{field:'scene.title',value:this.title,enabled:active},
      {field:'scene.count',value:this.count,enabled:active&&rock},{field:'scene.speed',value:this.speed,enabled:active&&this.preset!==5},
      {field:'scene.angle',value:this.angle,enabled:active&&this.preset<2},{field:'scene.duration',value:this.duration,enabled:active},
      {field:'body.name',value:this.editedBody===0?this.targetName:this.impactorName,enabled:active&&rock},
      {field:'body.radius',value:this.editedBody===0?this.targetRadiusKm:this.impactorRadiusKm,enabled:active&&rock},
      {field:'body.density',value:this.editedBody===0?this.targetDensity:this.impactorDensity,enabled:active&&rock},
      {field:'body.spin',value:this.targetSpin,enabled:active&&rock&&this.editedBody===0},
      {field:'orbit.name',value:this.orbitName,enabled:active&&this.preset===5},
      {field:'time.frame',value:this.info.selected,enabled:active&&this.info.frames>1}];
    for(let i=0;i<7;i++)fields.push({field:'orbit.value.'+i,value:this.orbitFields[i],enabled:active&&this.preset===5});
    if(this.placing)for(const f of fields)f.enabled=false;
    fields.push({field:'placement.name',value:this.placementName,enabled:active&&this.placing});
    for(let i=0;i<5;i++)fields.push({field:'placement.value.'+i,value:this.placementFields[i],enabled:active&&this.placing});
    return fields;
  }
  private setUiValue(field:string,value:string|number):void {
    this.info=simulation.status();const descriptor=this.uiFields().find((f:UiFieldInfo):boolean=>f.field===field);
    if(!descriptor||!descriptor.enabled)throw new Error('Field unavailable: '+field);
    // ArkUI can echo programmatic text updates through onChange. Only a changed value is an edit.
    if(value===descriptor.value)return;
    if(field.startsWith('placement.')){
      if(typeof value!=='string'||value.length>48)throw new Error('Expected bounded text');
      if(field==='placement.name')this.placementName=value;else{const index=Number(field.slice(16));this.placementFields=this.placementFields.map((v:string,i:number):string=>i===index?value:v);if(index===1&&Number.isFinite(Number(value)))this.placementScale=Math.max(this.placementScale,Math.min(13,Number(value)*1.3));}
      return;
    }
    if(field==='scene.title'||field==='body.name'||field==='orbit.name'||field.startsWith('orbit.value.')){
      if(typeof value!=='string'||value.length>(field.startsWith('orbit.value.')?64:48))throw new Error('Expected bounded text');
      if(field==='scene.title')this.title=value;
      else if(field==='body.name'){if(this.editedBody===0)this.targetName=value;else this.impactorName=value;}
      else if(field==='orbit.name'){this.orbitName=value;this.orbitDraft=true;}
      else {const i=Number(field.slice(12));this.orbitFields=this.orbitFields.map((s:string,j:number):string=>j===i?value:s);this.orbitDraft=true;}
      return;
    }
    if(typeof value!=='number')throw new Error('Expected number');
    if(field==='sky.brightness'){this.checked(value,0,100);this.changeSky(this.skyMode,value/100);return;}
    if(field==='time.frame'){this.checked(value,-1,this.info.frames-1,true);this.playing=false;simulation.seek(value);this.info=simulation.status();return;}
    if(field==='scene.count'){this.checked(value,200,2400,true);this.count=value;}
    else if(field==='scene.speed'){this.checked(value,this.preset>=3?.75:.5,this.preset>=3?1.25:10);this.speed=value;}
    else if(field==='scene.angle'){this.checked(value,0,70);this.angle=value;}
    else if(field==='scene.duration'){this.checked(value,1,this.preset>=3?10:120);this.duration=value;}
    else if(field==='body.radius'){this.checked(value,this.editedBody===0?40:20,this.editedBody===0?200:120);if(this.editedBody===0)this.targetRadiusKm=value;else this.impactorRadiusKm=value;}
    else if(field==='body.density'){this.checked(value,2400,3000);if(this.editedBody===0)this.targetDensity=value;else this.impactorDensity=value;}
    else if(field==='body.spin'){this.checked(value,-.01,.01);this.targetSpin=value;}
    this.dirty=true;
  }
  private input(field:string,value:string|number):void {try{this.setUiValue(field,value);}catch(e){this.notice=String(e);}}
  private async press(action:string):Promise<void> {try{await this.performUiAction(action);}catch(e){this.notice=String(e);}}
  private async performUiAction(action:string):Promise<void> {
    this.info=simulation.status();const descriptor=this.uiActions().find((a:UiActionInfo):boolean=>a.id===action);
    if(!descriptor||!descriptor.enabled)throw new Error('Action unavailable: '+action);
    if(action==='panel.parameters')this.togglePanel(0);
    else if(action==='panel.observe')this.togglePanel(1);
    else if(action==='panel.library'){this.refreshProjects();this.togglePanel(2);}
    else if(action==='panel.close'){if(this.placing)this.cancelPlacement();else this.setPanel(-1);}
    else if(action==='ui.focus')this.setTools(false);
    else if(action==='ui.restore')this.setTools(true);
    else if(action==='ui.back')this.onBackPress();
    else if(action==='presets.show')this.selectingPreset=true;
    else if(action==='theme.restore')this.chooseTheme(this.activeThemeId);
    else if(action==='theme.compare')this.chooseTheme(this.themeState().compareId);
    else if(action.startsWith('theme.'))this.chooseTheme(action.slice(6));
    else if(action.startsWith('library.')){this.librarySection=action.slice(8);this.scroller.scrollEdge(Edge.Top);}
    else if(action.startsWith('preset.'))this.choose(Number(action.slice(7)));
    else if(action==='simulation.toggle'){this.run();this.setPanel(-1);}
    else if(action==='simulation.apply'){if(!this.prepare(false))throw new Error(this.notice);this.setPanel(-1);}
    else if(action==='replay.toggle'){if(this.playing)this.playing=false;else {simulation.pause(true);if(this.info.selected<0||this.info.selected>=this.info.frames-1)simulation.seek(0);this.playing=true;}}
    else if(action==='replay.latest'){this.playing=false;simulation.seek(-1);}
    else if(action==='replay.save'||action==='replay.load'){await this.replayIO(action==='replay.load');if(!this.lastIOOk)throw new Error(this.notice);}
    else if(action==='project.save')this.saveProject(this.title);
    else if(action==='project.open'){this.refreshProjects();this.setPanel(2);}
    else if(action.startsWith('project.load.')){this.openProject(action.slice(13));this.setPanel(-1);}
    else if(action==='surface.toggle'){if(this.closeup)this.closeSurface();else this.openSurface(this.focus<0?1:this.focus);}
    else if(action==='surface.previous')this.openSurface((this.focus+this.orbitBodies.length-1)%this.orbitBodies.length);
    else if(action==='surface.next')this.openSurface((this.focus+1)%this.orbitBodies.length);
    else if(action.startsWith('surface.'))this.openSurface(Number(action.slice(8)));
    else if(action==='focus.all')this.closeSurface();
    else if(action.startsWith('focus.'))this.focusBody(Number(action.slice(6)));
    else if(action==='selection.edit'){this.selectOrbit(this.focus);if(!this.closeup){this.closeup=true;this.autoSpin=false;this.camera();}this.setPanel(0);this.notice='编辑初始条件 · 关闭面板或切换天体会保留草稿';}
    else if(action==='camera.out')this.easeCamera(this.yaw,this.pitch,Math.min(15,this.zoom*1.2));
    else if(action==='camera.in')this.easeCamera(this.yaw,this.pitch,Math.max(.5,this.zoom/1.2));
    else if(action==='camera.reset'){this.closeSurface();this.easeCamera(.15,.25,2.7);}
    else if(action.startsWith('color.')){this.colorMode=Number(action.slice(6));this.camera();}
    else if(action==='appearance.clouds'){this.clouds=!this.clouds;this.camera();}
    else if(action==='appearance.atmosphere'){this.atmosphere=!this.atmosphere;this.camera();}
    else if(action==='appearance.trails'){this.trails=!this.trails;this.camera();}
    else if(action==='appearance.spin'){if(!this.closeup)this.openSurface(this.focus<0?1:this.focus);else{this.autoSpin=!this.autoSpin;this.camera();}}
    else if(action==='body.primary')this.editedBody=0;
    else if(action==='body.impactor')this.editedBody=1;
    else if(action.startsWith('sky.mode.'))this.changeSky(Number(action.slice(9)),this.skyBrightness);
    else if(action==='orbit.plane.xy')this.vectorPlane='XY';
    else if(action==='orbit.plane.xz')this.vectorPlane='XZ';
    else if(action==='orbit.add')this.beginPlacement();
    else if(action==='placement.cancel')this.cancelPlacement();
    else if(action==='placement.confirm')this.confirmPlacement();
    else if(action==='placement.reverse')this.placementDirection=-this.placementDirection;
    else if(action.startsWith('placement.surface.'))this.placementSurface=Number(action.slice(18));
    else if(action.startsWith('placement.')){const speed=action==='placement.still'?'0':action==='placement.escape'?'1.45':'1';this.placementFields=this.placementFields.map((v:string,i:number):string=>i===4?speed:v);}
    else if(action==='orbit.undo'||action==='orbit.redo')this.travelOrbitHistory(action==='orbit.redo');
    else if(action==='orbit.discard')this.discardOrbitDraft();
    else if(action==='orbit.remove')this.removeOrbit();
    else if(action==='orbit.apply')this.applyOrbit(true);
    else if(action==='orbit.near')this.openSurface(this.orbitEdit);
    else if(action.startsWith('orbit.select.'))this.focusBody(Number(action.slice(13)));
    else if(action.startsWith('orbit.surface.')){const surface=Number(action.slice(14));if(surface!==this.orbitSurface){this.orbitSurface=surface;this.orbitDraft=true;}}
    else throw new Error('Unimplemented action: '+action);
    this.info=simulation.status();
  }
  private pathPixels(path:string):string {return path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,(v:string):string=>String(this.getUIContext().vp2px(Number(v))));}
  private orbitPreview():OrbitPreview {return previewOrbit(this.orbitFields,this.vectorPlane);}
  private async pickViewport(x:number,y:number):Promise<number> {
    if(this.preset<3||this.ioBusy||simulation.status().state==='preparing')throw new Error('当前视口暂不可点选');
    this.checked(x,0,1);this.checked(y,0,1);
    const id=simulation.pickBody(x,y,Math.min(.05,12/Math.max(1,this.viewportHeight)));
    if(id>=0){await this.performUiAction('focus.'+id);this.notice='已选中 '+this.surfaceName()+' · 可打开参数编辑或近看';}
    return id;
  }
  private tapViewport(e:GestureEvent):void {
    const finger=e.fingerList[0];if(!finger||this.viewportWidth<=0||this.viewportHeight<=0||this.preset<3)return;
    this.pickViewport(finger.localX/this.viewportWidth,finger.localY/this.viewportHeight).catch((error:Error)=>{this.notice=String(error);});
  }
  private changeSky(mode:number,brightness:number):void {
    this.checked(mode,0,2,true);this.checked(brightness,0,1);
    simulation.setSky(mode,brightness);this.skyMode=mode;this.skyBrightness=brightness;
  }
  private async execute(command: string, p: CommandPayload): Promise<string> {
    if(command==='listCommands') {
      const catalog: CommandCatalog = {ok:true,commands:[
      {name:'getState',payload:'{}'},
      {name:'setSky',payload:'{mode?:0 clean|1 stars|2 galaxy,brightness?:0..1}; photographic galaxy / procedural stars; fixed-direction background'},
      {name:'setWindowOrientation',payload:'{orientation:auto|portrait|landscape|reverse-landscape}; main window only; auto respects system rotation lock'},
      {name:'getSkyInfo',payload:'{} - provenance and sky rendering status'},
      {name:'getProjectedBodies',payload:'{} - last presented orbital frame; normalized top-left x/y, radius in viewport-height units; ignores UI occlusion'},
      {name:'pickBody',payload:'{x:0..1,y:0..1} - viewport hit test, shared focus action; hit=-1 leaves selection unchanged'},
      {name:'getPlacementPreview',payload:'{} - candidate initial conditions, two-body guide; no mutation'},
      {name:'setPlacementPoint',payload:'{x:0..1,y:0..1} in the placement plot; same handler as tap/drag'},
      {name:'getOrbitPreview',payload:'{} - initial editor vector drafts, input coordinates, XY/XZ; does not change physics'},
      {name:'listExperiments',payload:'{} - built-in theme initial conditions, observation goals and default cameras'},
      {name:'getUiState',payload:'{} - editor drafts, body edit undo/redo history, action IDs/enabled/selected, input fields'},
      {name:'listUiActions',payload:'{} - same semantic control catalog'},
      {name:'uiAction',payload:'{action:string} - invoke a catalog action through the same ArkUI handler'},
      {name:'setUiValue',payload:'{field:string,value:string|number} - edit a catalog field; orbital inputs stay draft until orbit.apply'},
      {name:'setScene',payload:'{preset:0..5,count:200..2400,speed:0.5..10,angle:0..70,duration:1..120; custom preset 5 requires orbitBodies (2..8), speed=1; orbit preset 3/4: speed 0.75..1.25 circular-velocity factor, duration 1..10 Julian years; count/rock fields ignored; optional targetRadiusKm:40..200,impactorRadiusKm:20..120,targetDensity:2400..3000,impactorDensity:2400..3000,targetSpin:-0.01..0.01,seed:1..1000000}'},
      {name:'start',payload:'{}'}, {name:'pause',payload:'{}'}, {name:'reset',payload:'{}'},
      {name:'seek',payload:'{frame:-1 or retained frame index}'},
      {name:'setCamera',payload:'{yaw:-100..100,pitch:-1.5..1.5,zoom:0.5..15,focus:-1..1 (orbit preset 4: -1..3; custom: -1..bodyCount-1),color:0..2 (orbit 0..1)}'},
      {name:'setAppearance',payload:'{clouds?:boolean,atmosphere?:boolean,trails?:boolean,closeup?:boolean,autoSpin?:boolean} (visual settings only)'},
      {name:'setPanel',payload:'{panel:-1 close,0 parameters,1 observe,2 library}'},
      {name:'listProjects',payload:'{}'}, {name:'saveProject',payload:'{title:string}'}, {name:'loadProject',payload:'{id:string}'},
      {name:'saveReplay',payload:'{}'}, {name:'loadReplay',payload:'{}'}]};
      return JSON.stringify(catalog);
    }
    if(command==='listExperiments')return JSON.stringify({ok:true,catalogVersion:1,experiments:themeExperiments(),active:this.themeState()});
    if(command==='getState') return this.snapshot();
    if(command==='setWindowOrientation'){if(typeof p.orientation!=='string')throw new Error('missing orientation');await WindowControl.orient(p.orientation);return this.snapshot();}
    if(command==='getSkyInfo'){const rendered:RenderStatus=simulation.renderStatus();return JSON.stringify({ok:true,reference:rendered.panoramaReady?'photographic-panorama':'procedural-fallback',catalog:'procedural-v1 (stars-only mode)',proceduralStarsVisible:this.skyMode===1||(this.skyMode===2&&!rendered.panoramaReady),seed:24190906,stars:6500,textureSize:rendered.panoramaReady?[2048,1024]:[1024,512],panorama:'eso0932a',credit:'ESO/S. Brunier',sourceUrl:'https://www.eso.org/public/images/eso0932a/',license:'CC BY 4.0',coordinateFrame:'simulation-orientation (not astrometric)',translationParallax:false,localZoomAffectsSky:false,loadError:this.skyLoadError,mode:this.skyMode,brightness:this.skyBrightness,rendering:rendered});}
    if(command==='getProjectedBodies')return JSON.stringify({ok:true,projection:simulation.projectedScene()});
    if(command==='pickBody'){const hit=await this.pickViewport(this.checked(p.x,0,1),this.checked(p.y,0,1));return JSON.stringify({ok:true,hit:hit});}
    if(command==='getPlacementPreview')return JSON.stringify({ok:true,active:this.placing,preview:this.placementPreview()});
    if(command==='setPlacementPoint'){this.movePlacement(this.checked(p.x,0,1),this.checked(p.y,0,1));return this.snapshot();}
    if(command==='getOrbitPreview'){if(this.preset!==5)throw new Error('需要自定义系统');return JSON.stringify({ok:true,body:this.orbitEdit,draft:this.orbitDraft,reference:'initial-input',preview:this.orbitPreview()});}
    if(command==='getUiState'||command==='listUiActions'){this.info=simulation.status();return JSON.stringify({ok:true,actions:this.uiActions(),fields:this.uiFields(),editor:this.editorState(),theme:this.themeState(),librarySection:this.librarySection});}
    if(command==='uiAction'){if(typeof p.action!=='string')throw new Error('missing action');await this.performUiAction(p.action);return this.snapshot();}
    if(command==='setUiValue'){if(typeof p.field!=='string'||p.value===undefined)throw new Error('missing field/value');this.setUiValue(p.field,p.value);return this.snapshot();}
    if(command==='listProjects') {
      this.refreshProjects();
      const result: ProjectList={ok:true,projects:this.projects.map((p: SavedProject): ProjectSummary => {return {id:p.id,title:p.scene.title,savedAt:p.savedAt};})};
      return JSON.stringify(result);
    }
    if(this.ioBusy) throw new Error('replay I/O in progress');
    if(this.placing)throw new Error('请先确认或取消放置');
    this.info=simulation.status();
    if(command==='setSky'){this.changeSky(p.mode===undefined?this.skyMode:p.mode,p.brightness===undefined?this.skyBrightness:p.brightness);return this.snapshot();}
    if(command==='setScene') {
      // Validate the entire transaction before changing any UI state.
      const preset: number=this.checked(p.preset,0,5,true);
      const count: number=this.checked(p.count,200,2400,true);
      const speed: number=this.checked(p.speed,0.5,10);
      const angle: number=this.checked(p.angle,0,70);
      const duration: number=this.checked(p.duration,1,120);
      const c: SimulationConfig={preset:preset,count:count,speed:speed,angle:angle,duration:duration,
        targetRadiusKm:p.targetRadiusKm===undefined?this.targetRadiusKm:p.targetRadiusKm,
        impactorRadiusKm:p.impactorRadiusKm===undefined?this.impactorRadiusKm:p.impactorRadiusKm,
        targetDensity:p.targetDensity===undefined?this.targetDensity:p.targetDensity,
        impactorDensity:p.impactorDensity===undefined?this.impactorDensity:p.impactorDensity,
        targetSpin:p.targetSpin===undefined?this.targetSpin:p.targetSpin,seed:p.seed===undefined?this.seed:p.seed};
      if(p.orbitBodies!==undefined)c.orbitBodies=p.orbitBodies;
      validateConfig(c);this.applyConfig(c);
      this.title=preset>=3?(preset===5?'自定义系统':preset===3?'双体轨道':'行星系统'):'碰撞实验';
      if(!this.prepare(false)) throw new Error(this.notice);
    } else if(command==='saveProject') {
      const saved: SavedProject=this.saveProject(p.title===undefined?this.title:p.title);
      return JSON.stringify({ok:true,id:saved.id});
    } else if(command==='loadProject') {
      if(typeof p.id!=='string') throw new Error('missing project id');this.openProject(p.id);
    } else if(command==='start') {
      if(this.info.state==='preparing') throw new Error('scene is preparing; poll getState');
      if(this.info.state!=='running') {
        if(this.dirty || ['completed','cancelled','failed','replay','empty'].includes(this.info.state)) {
          if(!this.prepare(true)) throw new Error(this.notice);
        } else this.run();
      }
    } else if(command==='pause') { this.playing=false;simulation.pause(true);this.notice='已暂停，可回看时间轴或调整视角';
    } else if(command==='reset') { if(!this.prepare(false)) throw new Error(this.notice);
    } else if(command==='seek') {
      const frame: number=this.checked(p.frame,-1,this.info.frames-1,true);
      this.playing=false;simulation.seek(frame);
    } else if(command==='setCamera') {
      const yaw: number=this.checked(p.yaw,-100,100);const pitch: number=this.checked(p.pitch,-1.5,1.5);
      const zoom: number=this.checked(p.zoom,0.5,15);const focus: number=this.checked(p.focus,-1,this.maxFocus(),true);
      const color: number=this.checked(p.color,0,this.preset>=3?1:2,true);
      this.stopCameraMotion();if(focus>=0)this.rememberOverview();else this.overviewCamera=undefined;this.yaw=yaw;this.pitch=pitch;this.zoom=zoom;this.focus=focus;if(this.preset===5&&focus>=0)this.selectOrbit(focus);this.colorMode=color;if(focus<0){this.closeup=false;this.autoSpin=false;}this.camera();
    } else if(command==='setAppearance'){this.changeAppearance(p);
    } else if(command==='setPanel') { this.setPanel(this.checked(p.panel,-1,2,true));
      // The return is an acknowledgement; query getState after the transition for settled UI state.
      return JSON.stringify({ok:true,accepted:true,panel:p.panel});
    } else if(command==='saveReplay'||command==='loadReplay') {
      await this.replayIO(command==='loadReplay');
      if(!this.lastIOOk) throw new Error(this.notice);
    } else throw new Error('unknown command: '+command);
    return this.snapshot();
  }
  @Builder
  header() {
    Row({space:6}) {
      Image($r('app.media.ic_orbit')).width(28).height(28).margin({right:2})
      if(this.viewportWidth>=600&&!this.layout().compact) {Text('星体实验室').fontSize(15).fontColor('#EFEDFA').fontWeight(FontWeight.Medium)}
      Blank()
      FloatingButton({label:'参数',icon:$r('app.media.ic_sliders'),active:this.panelOpen&&this.tab===0,onPress:() => {this.press('panel.parameters');}})
      FloatingButton({label:'观察',icon:$r('app.media.ic_observe'),active:this.panelOpen&&this.tab===1,onPress:() => {this.press('panel.observe');}})
      FloatingButton({label:'实验库',icon:$r('app.media.ic_library'),active:this.panelOpen&&this.tab===2,onPress:() => {this.press('panel.library');}})
      FloatingButton({label:'专注',compact:true,onPress:() => {this.press('ui.focus');}})
    }.id('workspace-header').enabled(!this.placing).width(this.layout().safe.width).position({x:this.layout().safe.x,y:this.layout().safe.y}).height(this.layout().headerHeight).padding({left:14,right:14})
      .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({y:-12})).animation({duration:200,curve:Curve.EaseOut}))
  }
  @Builder
  presets() {
    Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
      ForEach(this.experiments, (e:ExperimentInfo,i:number) => {
        ChoiceChip({label:e.title,active:this.preset===i,onPress:() => {this.press('preset.'+i);}})
      })
    }.width('100%')
  }
  @Builder
  viewport() {
    Stack({alignContent:Alignment.TopStart}) {
      XComponent({id:'sph-surface',type:XComponentType.SURFACE,libraryname:'simulation'})
        .width('100%').height('100%')
        .gesture(GestureGroup(GestureMode.Parallel,
          TapGesture({count:1,fingers:1}).onAction((e:GestureEvent)=>{this.tapViewport(e);}),
          PanGesture({fingers:1}).onActionStart(() => {this.stopCameraMotion();this.dragYaw=this.yaw;this.dragPitch=this.pitch;})
            .onActionUpdate((e:GestureEvent) => {this.yaw=this.dragYaw+e.offsetX*0.006;this.pitch=Math.max(-1.5,Math.min(1.5,this.dragPitch+e.offsetY*0.006));this.camera();}),
          PinchGesture({fingers:2}).onActionStart(() => {this.stopCameraMotion();this.pinchZoom=this.zoom;})
            .onActionUpdate((e:GestureEvent) => {this.zoom=Math.max(0.5,Math.min(15,this.pinchZoom/e.scale));this.camera();})
        ))
      if(this.toolsVisible&&!(this.closeup&&this.panelOpen)) {
        Column({space:5}) {
          Text(this.closeup?this.surfaceName()+' · 近看':this.title).fontColor('#F1EDFC').fontSize(14).fontWeight(FontWeight.Medium).maxLines(1)
          Text(this.stateLabel()+' · '+this.info.count+(this.preset>=3?' 个天体':' 粒子')).fontSize(11).fontColor('#A5A0B7')
          if(this.preset>=3&&!this.layout().compact) {Text(this.closeup?(this.autoSpin?'程序表面 · 外观自转演示':'程序表面 · 随轨道时间变化'):'牛顿引力 · AU / 年 · 天体尺寸已放大').fontSize(10).fontColor('#9E97B4')}
          if(this.preset>=3&&!this.closeup&&!this.layout().compact) {Text(this.focus>=0?'已选中 · '+this.surfaceName():'轻点天体以选中 · 拖动旋转').fontSize(11).fontColor('#C9B8F3')}
          if(this.skyMode===2&&!this.layout().compact) {Text(this.rendering.panoramaReady?'银河摄影 · 非定位星图':(this.skyLoadError?'银河示意 · 摄影全景加载失败':'银河背景 · 载入摄影全景')).fontSize(10).fontColor('#9E97B4')}
          if(this.preset<3) {Text('岩质 SPH · 未启用自引力').fontSize(10).fontColor('#9E97B4')}
          if(this.dirty) {Text('参数待应用').fontSize(11).fontColor('#F0BD82')}
        }.alignItems(HorizontalAlign.Start).padding({left:16,right:16,top:this.layout().compact?8:16,bottom:8}).width(this.layout().safe.width).margin({left:this.layout().safe.x,top:this.layout().safe.y+this.layout().headerHeight+10}).hitTestBehavior(HitTestMode.None)
          .onAreaChange((_:Area,area:Area)=>{this.hudHeight=Number(area.height);})
      }
    }.id('universe-viewport').width('100%').height('100%').clip(true)
      .onAreaChange((_:Area,area:Area) => {this.updateViewport(Number(area.width),Number(area.height));})
  }
  @Builder
  surfacePrimary() {
    FloatingButton({label:this.closeup?'返回全景':'近看行星',icon:$r('app.media.ic_observe'),onPress:() => {this.press('surface.toggle');}})
    if(this.focus>=0&&this.preset===5) {ChoiceChip({label:'编辑',onPress:() => {this.press('selection.edit');}})}
    if(this.focus>=0&&!this.closeup) {ChoiceChip({label:'全景',onPress:() => {this.press('focus.all');}})}
  }
  @Builder
  surfaceSecondary() {
    if(this.closeup&&this.preset===5) {
      ChoiceChip({label:'上一颗',onPress:() => {this.press('surface.previous');}})
      ChoiceChip({label:'下一颗',onPress:() => {this.press('surface.next');}})
    } else if(this.closeup&&this.preset===4) {
      ChoiceChip({label:'海洋',active:this.focus===1,onPress:() => {this.press('surface.1');}})
      ChoiceChip({label:'厚云',active:this.focus===2,onPress:() => {this.press('surface.2');}})
      ChoiceChip({label:'荒漠',active:this.focus===3,onPress:() => {this.press('surface.3');}})
    }
    if(this.preset===5&&!this.closeup) {ChoiceChip({label:'＋ 放置行星',onPress:()=>{this.press('orbit.add');}})}
  }
  @Builder
  surfaceBar() {
    Column({space:8}) {
      if(this.layout().compact) {
        Scroll() {Row({space:8}) {this.surfacePrimary();this.surfaceSecondary()}}
          .scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).align(Alignment.Start).width('100%').height(44)
      } else {
        Row({space:8}) {this.surfacePrimary()}
        Row({space:8}) {this.surfaceSecondary()}
      }
    }.alignItems(HorizontalAlign.Start).id('surface-bar').width(Math.max(0,this.layout().safe.width-32))
      .position({x:this.layout().safe.x+16,y:this.layout().safe.y+this.layout().headerHeight+10+this.hudHeight+8})
      .transition(TransitionEffect.OPACITY.animation({duration:180}))
  }
  @Builder
  transport() {
    Column({space:this.layout().compact?4:10}) {
      if(this.layout().compact) {
        Row({space:6}) {
          Text(this.info.time.toFixed(2)+(this.preset>=3?' 年':' s')).fontSize(11).fontColor('#E9E2F5').width(50)
          Slider({value:this.info.selected<0?Math.max(0,this.info.frames-1):this.info.selected,min:0,max:Math.max(1,this.info.frames-1),step:1})
            .id('history-slider-compact').layoutWeight(1).height(30).selectedColor('#BEABF5').trackColor('#404154').blockColor('#F1E9FF')
            .enabled(this.info.frames>1&&!this.ioBusy).onChange((v:number,mode:SliderChangeMode)=>{
              if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End){this.input('time.frame',Math.round(v));}
            })
          FloatingButton({label:this.playing?'停播':'回放',compact:true,enabledAction:this.info.frames>1&&!this.ioBusy,onPress:()=>{this.press('replay.toggle');}})
          FloatingButton({label:this.info.state==='running'?'暂停':'开始',compact:true,primary:true,enabledAction:this.info.state!=='preparing'&&!this.ioBusy,onPress:()=>{this.press('simulation.toggle');}})
          FloatingButton({label:'最新',compact:true,onPress:()=>{this.press('replay.latest');}})
        }.width('100%').height(50)
      } else {

      Row({space:8}) {
        Text(this.info.time.toFixed(2)+(this.preset>=3?' 年':' s')).fontSize(13).fontColor('#F1EEFC').width(65).fontWeight(FontWeight.Medium)
        Slider({value:this.info.selected<0?Math.max(0,this.info.frames-1):this.info.selected,min:0,max:Math.max(1,this.info.frames-1),step:1})
          .id('history-slider').layoutWeight(1).height(26).selectedColor('#BEABF5').trackColor('#404154').blockColor('#F1E9FF')
          .enabled(this.info.frames>1&&!this.ioBusy).onChange((v:number,mode:SliderChangeMode) => {
            if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End){this.input('time.frame',Math.round(v));}
          })
        Text(this.info.selected<0?'最新':(this.info.selected+1)+' / '+this.info.frames).fontSize(10).fontColor('#B4B0CA').width(48).textAlign(TextAlign.End)
      }.id('floating-timeline').width('100%').height(42).padding({left:16,right:16}).borderRadius(24)
        .backgroundColor('#66222537').backgroundBlurStyle(BlurStyle.COMPONENT_ULTRA_THIN,{colorMode:ThemeColorMode.DARK})
        .border({width:0.6,radius:24,color:'#33D6D0F5'}).shadow({radius:18,color:'#26000000',offsetY:5})
      Row({space:10}) {
        FloatingButton({label:this.playing?'暂停回放':'播放回放',icon:$r('app.media.ic_replay'),enabledAction:this.info.frames>1&&!this.ioBusy,compact:this.viewportWidth<380,onPress:() => {
          this.press('replay.toggle');
        }})
        FloatingButton({label:this.info.state==='running'?'暂停实验':(this.dirty?'应用并开始':'开始实验'),primary:true,
          icon:this.info.state==='running'?$r('app.media.ic_pause'):$r('app.media.ic_play'),enabledAction:this.info.state!=='preparing'&&!this.ioBusy,
          onPress:() => {this.press('simulation.toggle');}})
        FloatingButton({label:'最新',icon:$r('app.media.ic_latest'),compact:this.viewportWidth<380,onPress:() => {this.press('replay.latest');}})
      }.justifyContent(FlexAlign.Center).width('100%')
      }
      Text(this.rendering.error.length>0?'渲染异常：'+this.rendering.error:this.info.error.length>0?this.info.error:(this.preset>=3&&!this.rendering.texturesReady?'正在准备行星表面…':this.ioBusy?'正在读写回放…':this.notice)).width('100%').textAlign(TextAlign.Center)
        .fontSize(10).fontColor(this.info.error.length>0||this.rendering.error.length>0?'#F8AD95':'#9996AE').maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis})
    }.id('workspace-transport').enabled(!this.placing).position({x:this.layout().dock.x,y:this.layout().dock.y})
      .width(this.dockWidth()).height(this.layout().dock.height)
      .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({y:20})).animation({curve:curves.springMotion(0.32,0.90)}))
  }
  @Builder
  drawer() {
    Column({space:0}) {
      Row() {
        Column({space:3}) {
          Text(this.placing?'放置新行星':this.tab===0?(this.preset===5?'编辑 · '+this.orbitBodies[this.orbitEdit].name:(this.preset>=3?'让引力描绘轨道':'构建一次相遇')):(this.tab===1?'换一种方式观察':(this.librarySection==='saved'?'我的实验':'主题实验'))).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#F4F0FF').maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis})
          Text(this.placing?'先预览，再确认加入':this.tab===0?(this.preset===5?'初始条件 · 草稿保留在本次会话':'实验参数'):(this.tab===1?'观察与记录':'实验库')).fontSize(10).fontColor('#ACA4C8')
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Blank()
        ChoiceChip({label:'收起',onPress:() => {this.press('panel.close');}})
      }.width('100%').height(this.layout().compact?54:70).padding({left:20,right:16})
      Divider().color('#25D4CDEF').margin({left:20,right:20})
      Scroll(this.scroller) {this.inspector()}.layoutWeight(1).width('100%').scrollBar(BarState.Off)
        .opacity(this.panelOpacity).translate({y:this.panelContentOffset})
    }.id('workspace-drawer').position({x:this.layout().drawer.x,y:this.layout().drawer.y})
      .width(this.layout().drawer.width).height(this.drawerHeight())
      .backgroundColor('#98212638').backgroundBlurStyle(BlurStyle.COMPONENT_THIN,{colorMode:ThemeColorMode.DARK})
      .border({width:0.7,color:'#45D4CDEF'}).borderRadius(28).clip(true).shadow({radius:30,color:'#48000000',offsetY:10})
      .enabled(this.panelOpen&&this.toolsVisible)
      .transition(TransitionEffect.asymmetric(
        TransitionEffect.OPACITY.combine(TransitionEffect.translate({x:this.layout().sidePanel?32:0,y:this.layout().sidePanel?0:42})).combine(TransitionEffect.scale({x:0.97,y:0.97})).animation({curve:curves.springMotion(0.36,0.88)}),
        TransitionEffect.OPACITY.combine(TransitionEffect.translate({x:this.layout().sidePanel?20:0,y:this.layout().sidePanel?0:24})).animation({duration:170,curve:Curve.EaseIn})))
  }
  @Builder
  orbitControls() {
    Column({space:10}) {
      Row({space:8}) {
        Button('撤销',{type:ButtonType.Normal}).id('orbit-undo').layoutWeight(1).height(34).borderRadius(17).fontSize(12).backgroundColor('#554F416E').fontColor('#D9CCF5')
          .enabled(this.orbitUndo.length>0&&!this.ioBusy).onClick(()=>{this.press('orbit.undo');})
        Button('重做',{type:ButtonType.Normal}).id('orbit-redo').layoutWeight(1).height(34).borderRadius(17).fontSize(12).backgroundColor('#554F416E').fontColor('#D9CCF5')
          .enabled(this.orbitRedo.length>0&&!this.ioBusy).onClick(()=>{this.press('orbit.redo');})
      }.width('100%')
      Text(this.orbitUndo.length?'可撤销：'+this.editHistory().undoLabel:'天体编辑可撤销 · 本次会话保留 20 步').fontSize(10).fontColor('#ACA5C0').maxLines(2)
      Flex({wrap:FlexWrap.Wrap}) {
        ForEach(this.orbitBodies,(b:OrbitBodyConfig,i:number)=>{
          ChoiceChip({label:b.name.slice(0,10)+(this.hasBodyDraft(i)?' · 草稿':''),active:this.orbitEdit===i,onPress:()=>{this.press('orbit.select.'+i);}}).margin({right:6,bottom:6})
        })
      }.width('100%')
      TextInput({text:this.orbitName,placeholder:'天体名称'}).id('orbit-name').maxLength(48).height(40).borderRadius(16).fontColor('#EBE7F8').backgroundColor('#5533334D')
        .onChange((v:string)=>{this.input('orbit.name',v);})
      if(this.orbitEdit>0) {
        Row({space:6}) {
          ChoiceChip({label:'海洋',active:this.orbitSurface===1,onPress:()=>{this.press('orbit.surface.1');}})
          ChoiceChip({label:'厚云',active:this.orbitSurface===2,onPress:()=>{this.press('orbit.surface.2');}})
          ChoiceChip({label:'荒漠',active:this.orbitSurface===3,onPress:()=>{this.press('orbit.surface.3');}})
        }
      }
      ForEach(this.orbitLabels,(label:string,i:number)=>{
        Row({space:8}) {
          Text(i===0?(this.orbitEdit===0?'质量 · 太阳':'质量 · 地球'):label).fontSize(12).fontColor('#B6ADC9').width(92)
          TextInput({text:this.orbitFields[i]}).id('orbit-value-'+i).height(38).layoutWeight(1).borderRadius(14).fontColor('#EBE7F8').backgroundColor('#4533334D')
            .onChange((v:string)=>{this.input('orbit.value.'+i,v);})
        }.width('100%')
      })
      Text('位置 ±10 AU · 速度合计 ≤100 km/s。系统自动转为质心参考系；表面风格不改变质量。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      Text('应用或增删保留其他天体草稿。撤销／重做恢复初始条件和草稿，会清空旧轨迹；时长保持当前设置。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      Button(this.orbitDraft?'应用天体 · 重新生成':'天体已应用',{type:ButtonType.Normal}).id('apply-orbit').width('100%').height(42).borderRadius(20).fontColor('#241B36').backgroundColor('#D9CEFF')
        .enabled(this.orbitDraft&&!this.ioBusy).onClick(()=>{this.press('orbit.apply');})
      Button('还原当前输入',{type:ButtonType.Normal}).id('orbit-discard').width('100%').height(34).borderRadius(17).fontSize(12).backgroundColor('#162E3044').fontColor('#B9BACB')
        .enabled(this.orbitDraft&&!this.ioBusy).onClick(()=>{this.press('orbit.discard');})
      ChoiceChip({label:'近看这颗天体',onPress:()=>{this.press('orbit.near');}})
      Row({space:8}) {
        Button('添加行星').fontSize(12).height(34).backgroundColor('#554F416E').fontColor('#D9CCF5').enabled(this.orbitBodies.length<8&&!this.ioBusy).onClick(()=>{this.press('orbit.add');})
        Button('删除天体').fontSize(12).height(34).backgroundColor('#554B3749').fontColor('#EDB7C5').enabled(this.orbitEdit>0&&this.orbitBodies.length>2&&!this.ioBusy).onClick(()=>{this.press('orbit.remove');})
      }
      this.vectorPreview()
    }.width('100%')
  }
  @Builder
  placementControls() {
    Column({space:10}) {
      Text('初始条件预览 · 确认后从零重新计算').fontSize(11).fontColor('#D1C1F0')
      Row({space:8}) {
        ChoiceChip({label:'取消',onPress:()=>{this.press('placement.cancel');}})
        Button('确认加入 · 重算').height(38).fontSize(12).backgroundColor('#D9CEFF').fontColor('#241B36').layoutWeight(1)
          .enabled(this.placementPreview().valid&&!this.ioBusy).onClick(()=>{this.press('placement.confirm');})
      }.width('100%')
      Stack() {
        Path().width(this.placementPlotSize()).height(this.placementPlotSize()).commands(this.placementPath('M20 120 L220 120 M120 20 L120 220')).stroke('#49415F').strokeWidth(1).fillOpacity(0)
        Path().width(this.placementPlotSize()).height(this.placementPlotSize()).commands(this.placementPath(this.placementPreview().orbitPath)).stroke('#AA91E0').strokeWidth(1.5).fillOpacity(0)
        Path().width(this.placementPlotSize()).height(this.placementPlotSize()).commands(this.placementPath(this.placementPreview().markerPath)).stroke('#9B9EBA').strokeWidth(3).fillOpacity(0)
        Circle().width(10).height(10).fill('#FFD18C')
        Circle().width(14).height(14).fill(this.placementPreview().valid?'#BDE9FF':'#F4A993')
          .position({x:this.placementPreview().candidateX*this.placementPlotSize()/240-7,y:this.placementPreview().candidateY*this.placementPlotSize()/240-7})
        Path().width(this.placementPlotSize()).height(this.placementPlotSize()).commands(this.placementPath(this.placementPreview().velocityPath)).stroke('#A5DFFF').strokeWidth(2).fillOpacity(0)
      }.id('placement-plot').width(this.placementPlotSize()).height(this.placementPlotSize()).clip(true).borderRadius(22).backgroundColor('#44202438')
        .gesture(GestureGroup(GestureMode.Exclusive,
          TapGesture().onAction((e:GestureEvent)=>{this.placementGesture(e);}),
          PanGesture({distance:3}).onActionUpdate((e:GestureEvent)=>{this.placementGesture(e);})
        ))
      Text('轨道平面俯视 · 轻点或拖动放置\n紫线为二体估计，灰点为已有天体初始位置投影').fontSize(10).fontColor('#ACA5C0').textAlign(TextAlign.Center)
      Row({space:6}) {
        ChoiceChip({label:'圆轨道',active:this.placementFields[4]==='1',onPress:()=>{this.press('placement.circular');}})
        ChoiceChip({label:'静止',active:this.placementFields[4]==='0',onPress:()=>{this.press('placement.still');}})
        ChoiceChip({label:'掠过',active:this.placementFields[4]==='1.45',onPress:()=>{this.press('placement.escape');}})
        ChoiceChip({label:'反向',active:this.placementDirection===-1,onPress:()=>{this.press('placement.reverse');}})
      }
      Text(this.placementPreview().valid?'相对恒星 '+this.placementPreview().speedKmS.toFixed(2)+' km/s · '+(this.placementFields[4]==='0'?'径向落向恒星':this.placementPreview().bound?'二体束缚轨道':'二体非束缚轨道'):this.placementPreview().error)
        .fontSize(11).fontColor(this.placementPreview().valid?'#AECFD9':'#F4A993').width('100%')
      TextInput({text:this.placementName,placeholder:'新行星名称'}).height(38).fontColor('#EBE7F8').backgroundColor('#4533334D').borderRadius(14)
        .onChange((v:string)=>{this.input('placement.name',v);})
      Row({space:6}) {
        ChoiceChip({label:'海洋',active:this.placementSurface===1,onPress:()=>{this.press('placement.surface.1');}})
        ChoiceChip({label:'厚云',active:this.placementSurface===2,onPress:()=>{this.press('placement.surface.2');}})
        ChoiceChip({label:'荒漠',active:this.placementSurface===3,onPress:()=>{this.press('placement.surface.3');}})
      }
      ForEach(this.placementLabels,(label:string,i:number)=>{
        Row({space:8}) {
          Text(label).fontSize(11).fontColor('#B6ADC9').width(108)
          TextInput({text:this.placementFields[i]}).height(38).layoutWeight(1).borderRadius(14).fontColor('#EBE7F8').backgroundColor('#4533334D')
            .onChange((v:string)=>{this.input('placement.value.'+i,v);})
        }.width('100%')
      })
      Text('相对恒星设置；静止为相对恒星零速度。速度上限、初始间距和坐标越界会阻止确认。倾角围绕 X 轴，反向改变速度方向。已有编辑草稿在取消后保留；确认会清空旧轨迹和草稿。').fontSize(10).fontColor('#ACA5C0').lineHeight(16)
    }.width('100%')
  }
  @Builder
  vectorPlot(path:string,label:string,scale:number,color:string) {
    Column({space:3}) {
      Text(label+' · ±'+scale.toFixed(1)).fontSize(10).fontColor(color)
      Stack() {
        Path().width(100).height(90).commands(this.pathPixels('M12 45 L88 45 M50 8 L50 82')).stroke('#534A66').strokeWidth(1).fillOpacity(0)
        Path().width(100).height(90).commands(this.pathPixels(path)).stroke(color).strokeWidth(2).fillOpacity(0).strokeLineCap(LineCapStyle.Round)
      }.width(100).height(90)
    }.layoutWeight(1)
  }
  @Builder
  vectorPreview() {
    Column({space:5}) {
      Row({space:6}) {
        Text('初始向量').fontSize(12).fontColor('#DACCEE');Blank()
        ChoiceChip({label:'XY',active:this.vectorPlane==='XY',onPress:()=>{this.press('orbit.plane.xy');}})
        ChoiceChip({label:'XZ',active:this.vectorPlane==='XZ',onPress:()=>{this.press('orbit.plane.xz');}})
      }.width('100%')
      if(this.orbitPreview().valid) {
        Row() {
          this.vectorPlot(this.orbitPreview().positionPath,'位置 AU',this.orbitPreview().positionScale,'#A9CFFF')
          this.vectorPlot(this.orbitPreview().velocityPath,'速度 km/s',this.orbitPreview().velocityScale,'#D6B9FF')
        }.width('100%')
        Text('右 +X · 上 +'+(this.vectorPlane==='XY'?'Y':'Z')+' · 两图独立缩放').fontSize(10).fontColor('#B0A7C1')
      } else {Text(this.orbitPreview().error).fontSize(11).fontColor('#F0BD82')}
      Text('输入参考系 · 初始草稿，非实时轨道速度').fontSize(10).fontColor('#9E97B4')
    }.id('orbit-vector-preview').width('100%').padding({top:6,bottom:8})
  }
  @Builder
  skyControls() {
    Column({space:10}) {
      Text('远方星空').fontSize(13).fontColor('#DCCEF3').width('100%')
      Row({space:8}) {
        ChoiceChip({label:'纯净',active:this.skyMode===0,onPress:()=>{this.press('sky.mode.0');}})
        ChoiceChip({label:'星空',active:this.skyMode===1,onPress:()=>{this.press('sky.mode.1');}})
        ChoiceChip({label:'银河',active:this.skyMode===2,onPress:()=>{this.press('sky.mode.2');}})
      }.width('100%')
      MetricRow({label:'背景亮度',value:(this.skyBrightness*100).toFixed(0)+'%'})
      Slider({value:this.skyBrightness*100,min:0,max:100,step:5}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
        .onChange((v:number)=>{this.input('sky.brightness',v);})
      Text('银河摄影：ESO/S. Brunier · CC BY 4.0。全景按模拟方向放置，不用于天体定位；星空模式仍为程序星点，近看时自动变暗。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      Divider().color('#33B4A7D6')
    }.width('100%')
  }
  @Builder
  bodyControls() {
    Column({space:10}) {
      Row({space:8}) {
        ChoiceChip({label:'主天体',active:this.editedBody===0,onPress:() => {this.press('body.primary');}})
        if(this.preset!==2) {ChoiceChip({label:'撞击体',active:this.editedBody===1,onPress:() => {this.press('body.impactor');}})}
      }.width('100%')
      TextInput({text:this.editedBody===0?this.targetName:this.impactorName,placeholder:'天体名称'}).maxLength(48)
        .fontColor('#EBE7F8').backgroundColor('#5533334D').height(42).borderRadius(16)
        .onChange((v:string) => {this.input('body.name',v);})
      MetricRow({label:'半径',value:(this.editedBody===0?this.targetRadiusKm:this.impactorRadiusKm).toFixed(0)+' km'})
      Slider({value:this.editedBody===0?this.targetRadiusKm:this.impactorRadiusKm,min:this.editedBody===0?40:20,max:this.editedBody===0?200:120,step:10})
        .selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
        .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('body.radius',v);})
      MetricRow({label:'初始密度',value:(this.editedBody===0?this.targetDensity:this.impactorDensity).toFixed(0)+' kg/m³'})
      Slider({value:this.editedBody===0?this.targetDensity:this.impactorDensity,min:2400,max:3000,step:100})
        .selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
        .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('body.density',v);})
      MetricRow({label:'球体质量 · 估算',value:sphereMass(this.editedBody===0?this.targetRadiusKm:this.impactorRadiusKm,this.editedBody===0?this.targetDensity:this.impactorDensity).toExponential(3)+' kg'})
      if(this.editedBody===0) {
        MetricRow({label:'附加自转',value:this.targetSpin.toFixed(3)+' rad/s'})
        Slider({value:this.targetSpin,min:-0.01,max:0.01,step:0.001}).selectedColor('#BDA5F2').trackColor('#414154')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('body.spin',v);})
      }
      Divider().color('#33B4A7D6')
    }.width('100%')
  }
  @Builder
  themeGuide() {
    if(this.activeThemeId!=='') {
      Column({space:8}) {
        Text(this.themeState().title+(this.themeState().modified?' · 已改参数':'')).fontSize(14).fontColor('#E6DDF9').width('100%')
        Text(this.themeState().goal).fontSize(12).fontColor('#C7BFD7').lineHeight(19).width('100%')
        Row({space:6}) {
          ChoiceChip({label:'恢复主题',onPress:()=>{this.press('theme.restore');}})
          if(this.themeState().compareId!=='') {ChoiceChip({label:'切换速度对照',onPress:()=>{this.press('theme.compare');}})}
        }.width('100%')
        Text('恢复或切换会从零开始；可先另存当前参数。').fontSize(10).fontColor('#ADA8BF').width('100%')
      }.width('100%').padding({bottom:10})
    }
  }
  private themeCover(id:string):ResourceStr {
    if(id==='rock-slow')return $r('app.media.theme_rock_slow');
    if(id==='rock-fast')return $r('app.media.theme_rock_fast');
    if(id==='rock-oblique')return $r('app.media.theme_rock_oblique');
    if(id==='rock-spin')return $r('app.media.theme_rock_spin');
    if(id==='ocean-world')return $r('app.media.theme_ocean_world');
    return $r('app.media.theme_three_worlds');
  }
  @Builder
  library() {
    Column({space:12}) {
      Row({space:6}) {
        ChoiceChip({label:'碰撞',active:this.librarySection==='collision',onPress:()=>{this.press('library.collision');}})
        ChoiceChip({label:'探索',active:this.librarySection==='explore',onPress:()=>{this.press('library.explore');}})
        ChoiceChip({label:'我的实验',active:this.librarySection==='saved',onPress:()=>{this.press('library.saved');}})
      }.width('100%')
      if(this.librarySection==='saved') {this.savedLibrary()} else {
        if(!this.layout().compact) {Text(this.librarySection==='collision'?'改变一次相遇，观察不同结果。':'先走近一颗星球，再看它的世界。').fontSize(14).fontColor('#E4DDF2').width('100%')
        Text('封面为概念插画 · 进入后暂停，点击开始计算').fontSize(10).fontColor('#AFA8C0').width('100%')}
        ForEach(this.themes.filter((t:ThemeExperiment):boolean=>t.category===this.librarySection),(t:ThemeExperiment)=>{
          Column({space:8}) {
            Button({type:ButtonType.Normal}) {
              Stack({alignContent:Alignment.BottomEnd}) {
                Image(this.themeCover(t.id)).width('100%').height(this.layout().compact?64:96).objectFit(ImageFit.Cover)
                Text('进入实验  →').fontSize(11).fontColor('#EEE6FF').padding({left:12,right:12,top:6,bottom:6}).backgroundColor('#BD342B49').borderRadius(14).margin(8)
              }.width('100%').height(this.layout().compact?64:96)
            }.id('theme-enter-'+t.id).width('100%').height(this.layout().compact?64:96).padding(0).borderRadius(16).clip(true).backgroundColor('#171927')
              .accessibilityText('进入实验 · '+t.title).enabled(!this.ioBusy).onClick(()=>{this.press('theme.'+t.id);})
            Row(){Text(t.title).fontSize(15).fontWeight(FontWeight.Medium).fontColor('#F1ECFC').layoutWeight(1);Text(t.badge).fontSize(10).fontColor('#C8B7E5')}.width('100%')
            Text(t.question).fontSize(12).fontColor('#C9C3D5').lineHeight(18).width('100%')
            Text(t.limit).fontSize(10).fontColor('#AFA7BC').lineHeight(15).width('100%')
          }.id('theme-card-'+t.id).width('100%').padding(12).borderRadius(24).backgroundColor('#40282A3D')
            .border({width:.6,color:'#36D2C5EF',radius:24})
        },(t:ThemeExperiment)=>t.id)
      }
    }.width('100%')
  }
  @Builder
  savedLibrary() {
    Column({space:12}) {
      Text('把一次想法，留作下一次实验。').fontSize(14).fontColor('#DAEAEF').width('100%')
      TextInput({text:this.title,placeholder:'实验名称'}).maxLength(48).height(40).fontColor('#EBE7F8').backgroundColor('#5533334D')
        .onChange((v:string) => {this.input('scene.title',v);})
      Button('将当前参数另存为实验',{type:ButtonType.Normal}).width('100%').height(40).borderRadius(10)
        .fontSize(13).fontColor('#07282C').backgroundColor('#D2C2FF').enabled(!this.ioBusy).onClick(() => {this.press('project.save');})
      Text('保存天体参数与随机种子；回放仍单独保存。载入实验会重新生成场景。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      if(this.projects.length===0) {Text('还没有保存的实验').fontColor('#AAA3BF').fontSize(13).padding(16)}
      ForEach(this.projects,(p:SavedProject) => {
        Column({space:6}) {
          Text(p.scene.title).fontColor('#EBE7F8').fontSize(14).maxLines(1).width('100%')
          Text(p.scene.config.preset>=3?'多体引力 · '+p.scene.config.duration+' 年':p.scene.bodies.length+' 个岩质天体 · '+p.scene.config.count+' 粒子预算 · '+p.scene.config.duration+' s').fontColor('#ADA8BF').fontSize(11)
          Button('载入实验',{type:ButtonType.Normal}).fontSize(12).height(32).borderRadius(8).backgroundColor('#554F416E').fontColor('#CEBEF5')
            .enabled(!this.ioBusy).onClick(() => {this.press('project.load.'+p.id);})
        }.alignItems(HorizontalAlign.Start).width('100%').padding(14).backgroundColor('#5533334D').borderRadius(20)
      },(p:SavedProject) => p.id)
    }.width('100%')
  }
  @Builder
  inspector() {
    Column({space:14}) {
      if(this.placing){this.placementControls()} else if(this.tab===0) {
        this.themeGuide()
        if(this.preset!==5||this.selectingPreset){this.presets()}else{
          Row(){Text('自定义系统 · '+this.orbitBodies.length+' 个天体').fontSize(13).fontColor('#DCCEF3');Blank();ChoiceChip({label:'切换实验',onPress:()=>{this.press('presets.show');}})}.width('100%')
        }
        if(this.preset>=3) {
          if(this.preset!==5){Text('牛顿多体引力 · 恒星与行星相互作用。初始位置为教学预设，不代表实时太阳系。').fontSize(12).fontColor('#ADA8BF').lineHeight(19)}
          if(this.preset===5){this.orbitControls()} else {Text('调节初始速度，观察圆轨道如何变成椭圆。1.00 × 为双体圆轨道初速。').fontSize(12).fontColor('#CBBDEE').lineHeight(19)}
        } else {
        Text('岩质模型 · 初始密度可调，尚未做静力平衡。质量由半径与密度计算。')
          .fontSize(12).fontColor('#ADA8BF').lineHeight(19).width('100%')
        this.bodyControls()
        MetricRow({label:'粒子预算',value:this.count.toString()})
        Slider({value:this.count,min:200,max:2400,step:200}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.count',Math.round(v));})
        }
        if(this.preset!==5) {
        MetricRow({label:this.preset>=3?'初始轨道速度':this.preset===2?'角速度':'撞击速度',value:this.preset>=3?this.speed.toFixed(2)+' × 圆轨道初速':this.preset===2?(this.speed*0.003).toFixed(4)+' rad/s':this.speed.toFixed(1)+' km/s'})
        Slider({value:this.speed,min:this.preset>=3?0.75:0.5,max:this.preset>=3?1.25:10,step:this.preset>=3?0.05:0.5}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.speed',v);})
        }
        if(this.preset<2) {
          MetricRow({label:'横向偏移',value:(Math.sin(this.angle*Math.PI/180)*0.5625*(this.targetRadiusKm+this.impactorRadiusKm)).toFixed(0)+' km'})
          Slider({value:this.angle,min:0,max:70,step:5}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
            .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.angle',v);})
        }
        MetricRow({label:'模拟时长',value:this.duration.toFixed(0)+(this.preset>=3?' 年':' s')})
        Slider({value:this.duration,min:1,max:this.preset>=3?10:120,step:1}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.duration',v);})
        Text(this.dirty?'参数已修改，应用后会重新生成实验。':(this.preset>=3?'轨迹保留最近 2 年；近距离遭遇会停止计算。':'粒子数是预算值，实际数量由采样分布决定。')).fontSize(11).fontColor(this.dirty?'#F0BD82':'#A5A0B6').width('100%')
        Button('应用参数 · 重新生成',{type:ButtonType.Normal}).width('100%').height(38).borderRadius(10).backgroundColor('#6657477D').fontColor('#E2D7FC').fontSize(12)
          .enabled(!this.ioBusy).onClick(() => {this.press('simulation.apply');})
        Row({space:8}) {
          ChoiceChip({label:'另存实验',active:false,onPress:() => {this.press('project.save');}})
          ChoiceChip({label:'打开实验库',active:false,onPress:() => {this.press('project.open');}})
        }.width('100%')
      } else if(this.tab===1) {
        this.themeGuide()
        this.skyControls()
        if(this.preset>=3) {
          Text('行星外观').fontSize(13).fontColor('#AEBDCD').width('100%')
          Row({space:6}) {
            ChoiceChip({label:'云层',active:this.clouds,onPress:() => {this.press('appearance.clouds');}})
            ChoiceChip({label:'大气',active:this.atmosphere,onPress:() => {this.press('appearance.atmosphere');}})
            ChoiceChip({label:'轨迹',active:this.trails,onPress:() => {this.press('appearance.trails');}})
          }.width('100%')
          ChoiceChip({label:this.autoSpin?'停止外观自转':'演示外观自转',active:this.autoSpin,onPress:() => {this.press('appearance.spin');}})
          Text('海陆与云层为程序生成的教学外观；不代表实时地图、气象或流体计算。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
          Divider().color('#33B4A7D6')
        }
        Text(this.preset>=3?'天体着色':'粒子着色').fontSize(13).fontColor('#AEBDCD').width('100%')
        Row({space:6}) {
          ChoiceChip({label:'原色',active:this.colorMode===0,onPress:() => {this.press('color.0');}})
          ChoiceChip({label:'速度',active:this.colorMode===1,onPress:() => {this.press('color.1');}})
          if(this.preset<3) {ChoiceChip({label:'密度',active:this.colorMode===2,onPress:() => {this.press('color.2');}})}
        }.width('100%')
        Text(this.preset>=3?(this.colorMode===1?'速度 0 → 50 km/s':'金 · 恒星 / 蓝、金、红 · 行星'):this.colorMode===0?'灰岩 · 主天体 / 赭岩 · 撞击体；颜色不代表温度':(this.colorMode===1?'速度 0 → 10 km/s':'密度 0 → 5000 kg/m³')).fontSize(11).fontColor('#CBBDEE').width('100%')
        Row({space:8}) {
          ChoiceChip({label:'拉远 −',active:false,onPress:() => {this.press('camera.out');}})
          ChoiceChip({label:'拉近 +',active:false,onPress:() => {this.press('camera.in');}})
        }.width('100%')
        Text('镜头跟踪').fontSize(13).fontColor('#AEBDCD').width('100%')
        if(this.preset>=3) {
          Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
            ChoiceChip({label:'全景',active:this.focus===-1,onPress:() => {this.press('focus.all');}})
            ForEach(this.info.bodies??[],(b:OrbitBodyStatus) => {
              ChoiceChip({label:b.name,active:this.focus===b.id,onPress:() => {this.press('focus.'+b.id);}})
            },(b:OrbitBodyStatus) => b.id.toString())
          }.width('100%')
        } else {
        Row({space:6}) {
          ChoiceChip({label:'全景',active:this.focus===-1,onPress:() => {this.press('focus.all');}})
          ChoiceChip({label:this.preset>=3?'恒星':'主天体',active:this.focus===0,onPress:() => {this.press('focus.0');}})
          if(this.preset!==2) {ChoiceChip({label:this.preset>=3?'蓝色行星':'撞击体',active:this.focus===1,onPress:() => {this.press('focus.1');}})}
        }.width('100%')
        }
        ChoiceChip({label:'复位视角',active:false,onPress:() => {this.press('camera.reset');}})
        Divider().color('#33B4A7D6')
        MetricRow({label:'最高速度',value:this.info.maxSpeed.toFixed(2)+' km/s'})
        if(this.preset>=3) {
          MetricRow({label:this.preset===5?'能量归一化偏差':'能量相对误差',value:(this.info.energyError??0).toExponential(2)})
          MetricRow({label:this.preset===5?'角动量归一化偏差':'角动量相对误差',value:(this.info.angularError??0).toExponential(2)})
          ForEach(this.info.bodies??[],(b:OrbitBodyStatus) => {
            MetricRow({label:b.name,value:b.speedKmS.toFixed(2)+' km/s'})
          },(b:OrbitBodyStatus) => b.id.toString())
        } else {MetricRow({label:'平均密度',value:this.info.meanDensity.toFixed(0)+' kg/m³'})}
        MetricRow({label:this.preset>=3?'最近 16 步耗时':'最近求解步耗时',value:this.info.stepMs.toFixed(1)+' ms'})
        MetricRow({label:'已记录帧数',value:this.info.steps.toString()})
        Divider().color('#33B4A7D6')
        Row({space:8}) {
          ChoiceChip({label:'保存回放',active:false,onPress:() => {this.press('replay.save');}})
          ChoiceChip({label:'载入回放',active:false,onPress:() => {this.press('replay.load');}})
        }.width('100%')
        Text('回放保存在本机，最多保留最近 240 帧。回放仅用于观察；恢复参数会重新计算。').fontSize(11).fontColor('#AAA3BF').lineHeight(18)
        Text('OpenSPH · MIT 开源内核\n原生 ArkTS 界面 / OpenGL ES 粒子视口\n科学探索原型 · 低分辨率结果用于演示').fontSize(11).fontColor('#9792AC').lineHeight(18)
      } else { this.library() }
    }.padding(16).width('100%')
  }
  build() {
    Stack({alignContent:Alignment.TopStart}) {
      this.viewport()
      if(this.toolsVisible) {
        this.header()
        if(this.preset>=3&&!this.panelOpen) {this.surfaceBar()}
        if(this.panelOpen) {this.drawer()}
        this.transport()
      } else {
        Button('显示工具',{type:ButtonType.Normal}).id('restore-tools').fontSize(12).fontColor('#E2D7FC')
          .backgroundColor('#A6222438').backgroundBlurStyle(BlurStyle.COMPONENT_ULTRA_THIN,{colorMode:ThemeColorMode.DARK}).height(42).borderRadius(24).padding({left:14,right:14})
          .width(96).position({x:this.layout().safe.x+Math.max(0,this.layout().safe.width-108),y:this.layout().safe.y+12}).onClick(() => {this.press('ui.restore');})
          .transition(TransitionEffect.OPACITY.combine(TransitionEffect.scale({x:0.94,y:0.94})).animation({duration:200,curve:Curve.EaseOut}))
      }
      if(this.rendering.panoramaReady&&this.rendering.skyGalaxy>0.001) {
        Text('ESO/S. Brunier · CC BY 4.0').id('sky-photo-credit').fontSize(10).fontColor('#C1BDCA')
          .position({x:this.layout().safe.x+16,y:this.layout().safe.y+(this.toolsVisible?this.layout().headerHeight+2:20)}).hitTestBehavior(HitTestMode.None)
      }
    }.width('100%').height('100%').backgroundColor('#080B15')
      .onAreaChange((_:Area,area:Area) => {this.windowWidth=Number(area.width);this.windowHeight=Number(area.height);})
  }
}
