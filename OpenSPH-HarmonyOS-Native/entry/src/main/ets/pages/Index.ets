import { SceneVideo, VideoState, VideoClip } from '../common/SceneVideo';
import { GalaxyReference, GalaxyComparisonPlot, galaxyComparisonPlot, galaxyParameterDifferences, galaxyComparisonCsv } from '../common/GalaxyComparison';
import { GalaxyComparisonStore } from '../common/GalaxyComparisonStore';
import { SphReference, SphReferenceSummary, SphComparisonPlot, sphComparisonPlot, sphReferenceSummary, sphParameterDifferences, sphComparisonCsv } from '../common/SphComparison';
import { SphComparisonStore } from '../common/SphComparisonStore';
import { sphPlot, sphCsv, sphMetricLabel, sphMetricIndex, sphMetricValue, sphWindowSummary, SphWindowSummary } from '../common/SphObservationModel';
import { ObservationReference, ReferenceSummary, ComparisonPlot, comparisonPlot, referenceSummary, observationCsv } from '../common/ObservationComparison';
import { ObservationStore } from '../common/ObservationStore';
import { observationPlot, ObservationPlot } from '../common/ObservationModel';
import { GALAXY_METRICS, galaxyModel, galaxyPlot, galaxyCsv } from '../common/GalaxyObservationModel';
import simulation, { LocalImpactBody, GalaxyObserverStatus, GalaxyObservation, SphFragmentSnapshot, SphMaterialGroup, SphObservationSample, SphObservation, OrbitObservation, SimulationStatus, SimulationConfig, OrbitBodyConfig, OrbitBodyStatus, RenderStatus, RingTraceStatus, CameraMotionStatus } from 'libsimulation.so';
import { CliBridge, CommandPayload } from '../common/CliBridge';
import { PlacementUnits, defaultPlacementUnits, physicalPlacementUnits, placementCanonicalFields, placementFieldsInUnits, placementUnitLabels, MIN_ORBIT_MASS_SOLAR, SOLAR_MASS_KG, AU_KM, finiteOrbitBodies, estimatedOrbitRadius, contactDemoBodies, SurfaceRecipe, legacySurfaces, copySurfaces, validateSurfaces, copiedPlanetDraft, PlacementPreview, planPlanet, placementPoint, OrbitPreview, previewOrbit, SceneDefinition, BodyDefinition, SavedProject, ExperimentRecipe, RecipeMaterial, defaultMaterial, validateMaterial, defaultRecipe, validateRecipe, validateConfig, validateScene, validName, sphereMass, validateOrbitBodies, defaultOrbitBodies, circularBody, copyOrbitBodies, EARTH_MASS_SOLAR } from '../common/SceneModel';
import { themeExperiments, themeConfigMatches, ThemeExperiment } from '../common/ExperimentCatalog';
import { ProjectStore } from '../common/ProjectStore';
import { curves, LengthMetrics } from '@kit.ArkUI';
import { common } from '@kit.AbilityKit';
import { WindowControl } from '../common/WindowControl';
import { workspaceLayout, WorkspaceLayout, WindowGeometry } from '../common/WorkspaceLayout';
import { loadMoonTexture } from '../common/MoonTexture';
import { loadSkyPanorama } from '../common/SkyPanorama';
import { fileIo as fs } from '@kit.CoreFileKit';

interface OrbitDraftState { index:number; name:string; fields:string[]; surface:number; }
interface OrbitWorkspace { surfaces:SurfaceRecipe[]; bodies:OrbitBodyConfig[]; selected:number; drafts:OrbitDraftState[]; }
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
interface ProjectSummary { id: string; title: string; savedAt: number; hasRecipe:boolean; themeId:string; }
interface ProjectList { ok: boolean; projects: ProjectSummary[]; }
interface AppearanceState { clouds:boolean; atmosphere:boolean; trails:boolean; closeup:boolean; autoSpin:boolean; rings:boolean; }
interface SkyState {mode:number;brightness:number;reference:string;}
interface PlacementState { units:PlacementUnits; labels:string[]; parent:number; promotesContact:boolean; target:number; sourceIndex:number; sourceName:string; active:boolean; name:string; fields:string[]; surface:number; direction:number; preview:PlacementPreview; }
interface ComparisonReply {ok:boolean;visible:boolean;reference?:ReferenceSummary;currentName:string;currentCount:number;currentConfig?:SimulationConfig;chart:ComparisonPlot;error:string;}
interface ObservationTableReply {ok:boolean;csv:string;rows:number;timeAlignment:string;reference?:ReferenceSummary;currentName:string;currentConfig?:SimulationConfig;}
interface SphCurveData {sceneRevision:number;selected:number;samples:SphCurveSample[];}
interface SphCurveReply {ok:boolean;metric:string;label:string;data:SphCurveData;plot:ObservationPlot;}
interface SphCurveSample {frame:number;time:number;value:number;}
interface ObservationReply {ok:boolean;metric:string;data:OrbitObservation;plot:ObservationPlot;}
interface ThemeState { id:string; title:string; goal:string; limit:string; modified:boolean; compareId:string; }
interface MoonAssetInfo {source:string;asset:string;credit:string;width:number;height:number;requested:boolean;ready:boolean;uploads:number;blend:number;error:string;decodedBudgetBytes:number;gpuBudgetBytes:number;}
interface MoonAssetReply {ok:boolean;moon:MoonAssetInfo;}
interface GalaxyPlacementState {active:boolean;offsetKpc:number;sourceTime:number;constraint:string;}
interface AppSnapshot {video:VideoState;galaxyObserver:GalaxyObserverStatus;galaxyPlacement:GalaxyPlacementState; surfaces:SurfaceRecipe[];surfaceUndoCount:number;surfaceRedoCount:number; material:RecipeMaterial; cameraMotion:CameraMotionStatus; ringTrace:RingTraceStatus; theme:ThemeState; placement:PlacementState; sky:SkyState; editor:EditorState; appearance:AppearanceState; rendering:RenderStatus; definition: SceneDefinition; ok: boolean; protocol: number; simulation: SimulationStatus; scene: SceneState; camera: CameraState; ui: UiState; window: WindowState; }
interface CommandDescription { name: string; payload: string; }
interface CommandCatalog { ok: boolean; commands: CommandDescription[]; }
interface ExperimentInfo { title: string; caption: string; symbol: string; }

@Component
struct ChoiceChip {
  @Prop label: string = '';
  @Prop active: boolean = false;
  @Prop enabledAction: boolean = true;
  @State pressed: boolean = false;
  onPress: () => void = () => {};
  build() {
    Button(this.label, {type:ButtonType.Normal}).enabled(this.enabledAction).opacity(this.enabledAction?1:.4).fontSize(12).fontWeight(FontWeight.Medium)
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
  @State videoState:VideoState={state:'idle',elapsedSeconds:0,width:0,height:0,frames:0,error:'',message:'',selectedId:'',clips:[]};
  @State videoOpen:boolean=false;
  @State videoPreview:boolean=false;
  @State videoPreviewReady:boolean=false;
  @State videoPreviewError:string='';
  @State videoQuality:number=1280;
  @State videoUri:string='';
  private video:SceneVideo|undefined=undefined;
  private videos():SceneVideo {if(!this.video)this.video=new SceneVideo(this.getUIContext().getHostContext() as common.UIAbilityContext);return this.video;}
  private videoBusy():boolean {return ['starting','recording','stopping','exporting'].includes(this.videoState.state);}
  private syncVideo():void {if(this.video)this.videoState=this.video.snapshot();}
  private videoTime():string {const seconds:number=Math.floor(this.videoState.elapsedSeconds);return Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');}

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
  @State selfGravity: boolean = false;
  @State relaxationSeconds: number = 0;
  @State observerMode:number=0;
  @State observerYaw:number=Math.PI;
  @State observerPitch:number=0.12;
  @State observerFov:number=90;
  @State observerLatitude:number=35;
  @State observerSidereal:number=12;
  private observerDragYaw:number=0;
  private observerDragPitch:number=0;
  private observerPinchFov:number=90;
  @State galaxyPlacing:boolean=false;
  @State galaxyPlacementOffset:number=12;
  @State galaxyReference:GalaxyReference|undefined=undefined;
  @State galaxyReferenceShown:boolean=true;
  @State galaxyReferenceError:string='';
  @State galaxyMetric:number=0;
  @State galaxyObserved:GalaxyObservation={available:false,sceneRevision:0,selected:-1,samples:[]};
  private galaxyPlacementView:CameraState|undefined=undefined;
  private galaxyPlacementRunning:boolean=false;
  private galaxyPlacementPlaying:boolean=false;
  private galaxyPlacementPanel:number=-1;
  private galaxyPlacementTime:number=0;
  private galaxyPlacementOverview:CameraState|undefined=undefined;
  @State galaxyMassRatio:number=.6;
  @State galaxyOffsetKpc:number=12;
  @State galaxyRetrograde:boolean=false;
  @State galaxyResponsive:boolean=false;
  private isOrbit():boolean {return this.preset>=3&&this.preset<=5;}
  private timeLabel():string {return this.preset===6?' Myr':this.isOrbit()?' 年':' s';}
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
  @State placementSource:number=-1;
  @State placementName:string='新行星';
  @State placementUnits:PlacementUnits=defaultPlacementUnits();
  @State placementFields:string[]=['1','2.5','45','0','1'];
  @State placementSurface:number=1;
  @State placementDirection:number=1;
  @State placementTarget:number=-1;
  @State placementParent:number=0;
  @State placementPromotesContact:boolean=false;
  private placementPlotSize():number {return this.layout().compact||!this.layout().sidePanel?160:220;}
  private placementPath(path:string):string {return this.pathPixels(path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,(v:string):string=>String(Number(v)*this.placementPlotSize()/240)));}
  @State placementScale:number=5;
  private placementView:CameraState|undefined=undefined;
  private placementSurfaceRecipe:SurfaceRecipe={version:1,seed:1,cloudSeed:2};
  private placementWasRunning:boolean=false;
  private placementWasPlaying:boolean=false;
  private placementWasClose:boolean=false;
  private placementWasSpin:boolean=false;
  private placementWasPanel:boolean=false;
  private placementWasTab:number=0;
  @State selectingPreset: boolean = false;
  private orbitLabels: string[] = ['质量','X · AU','Y · AU','Z · AU','Vx · km/s','Vy · km/s','Vz · km/s'];
  @State projects: SavedProject[] = [];
  @State librarySection:string='collision';
  @State activeThemeId:string='';
  private themes:ThemeExperiment[]=themeExperiments();
  @State moonRequested:boolean=false;
  @State moonLoadError:string='';
  @State exposure: number = 0;
  @State ocean: boolean = true;
  @State cloudShadows: boolean = true;
  @State clouds: boolean = true;
  @State atmosphere: boolean = true;
  @State trails: boolean = true;
  @State closeup: boolean = false;
  @State autoSpin: boolean = false;
  @State rings: boolean = true;
  @State comparisonReference:ObservationReference|undefined=undefined;
  @State comparisonShown:boolean=true;
  @State comparisonError:string='';
  @State sphMetric:string='pressure';
  @State sphReference:SphReference|undefined=undefined;
  @State sphReferenceShown:boolean=true;
  @State sphReferenceError:string='';
  @State fragments:SphFragmentSnapshot={available:false,reason:'等待材料团块',sceneRevision:0,selected:-1,time:0,linkScale:1.5,offset:0,method:'symmetric-smoothing-connectivity-v1',groups:[]};
  @State fragmentOffset:number=0;
  @State sphObserved:SphObservation={sceneRevision:0,selected:-1,samples:[]};
  @State observationMetric:string='distance';
  @State observed:OrbitObservation={sceneRevision:0,body:1,name:'',selected:-1,samples:[]};
  @State trace:RingTraceStatus={impulse:0,points:false,speedScale:1,rateHours:1,eccentricity:0,innerApoapsisKm:76800,outerApoapsisKm:133200,referenceXKm:76800,referenceYKm:0,referenceRadiusKm:76800,referenceSpeedKmS:0,enabled:false,running:false,target:-1,timeHours:0,massSolar:.0002857,radiusKm:60000,count:8192,innerPeriodHours:0,outerPeriodHours:0,model:'restricted-impulse-ring-v3'};
  @State skyLoadError:string='';
  @State rendering: RenderStatus = {fragmentFollow:{active:false,moving:false,seed:-1,anchor:-1,rank:0,count:0,sceneRevision:0,time:0,centerKm:[0,0,0]},surfacePending:0,surfaceGenerated:0,surfaceError:'',moonReady:false,moonUploads:0,moonBlend:0,moonError:'',materialExposure:0,materialOcean:true,materialCloudShadows:true,panoramaReady:false,panoramaBlend:0,compositionX:.5,compositionY:.5,compositionScale:1,sceneRevision:0,surfaceStarts:0,cameraMoving:false,centerX:0,centerY:0,centerZ:0,skyReady:false,skyStars:0,skyGalaxy:0,ready:false,texturesReady:false,active:true,frames:0,submitMs:0,previewSeconds:0,error:''};
  @State initialEnergyMJkg:number=0;
  @State initialDamage:number=0;
  @State colorMode: number = 0;
  @State cameraFlight:string='idle';
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
    {title:'单体岩球',caption:'观察静止与旋转初态',symbol:'03'},
    {title:'双体轨道',caption:'引力与椭圆轨道',symbol:'04'},
    {title:'行星系统',caption:'所有天体相互吸引',symbol:'05'},
    {title:'自定义系统',caption:'亲手搭建行星系统',symbol:'06'},
    {title:'星系潮汐',caption:'引力拉出恒星长尾',symbol:'07'}
  ];
  private stateLabel(): string {
    if(this.trace.enabled)return this.trace.running?'局部环运行中':'局部环已暂停';
    if (this.info.state === 'preparing') return this.preparationLabel();
    if (this.info.state === 'running') return '正在计算';
    if (this.info.state === 'paused') return '已暂停';
    if (this.info.state === 'completed') return '计算完成';
    if (this.info.state === 'cancelled') return '已停止';
    if (this.info.state === 'failed') return '计算异常';
    if (this.info.state === 'replay') return '已载入回放';
    return '准备实验';
  }
  private sphComparisonView():SphComparisonPlot {return sphComparisonPlot(this.sphObserved,this.sphMetric,this.sphReferenceShown?this.sphReference?.data:undefined);}
  private sphChart():ObservationPlot {return this.sphComparisonView().plot;}
  private sphDifferences():string[] {return this.sphReference?sphParameterDifferences(this.info.config,this.sphReference.config):[];}
  private reloadSphReference():void {
    try{this.sphReference=SphComparisonStore.load(this.directory());this.sphReferenceError='';}
    catch(e){this.sphReference=undefined;this.sphReferenceError='无法读取 SPH 参照 · '+String(e);}
  }
  private captureSphReference():void {
    const captured=simulation.sphObservation(),source=simulation.status();
    if(!source.config||source.config.preset>=3||!source.model||captured.samples.length<2||simulation.sphObservation().sceneRevision!==captured.sceneRevision)throw new Error('需要同一场景的至少两帧 SPH 记录');
    const value:SphReference={schemaVersion:1,capturedAt:Date.now(),title:this.title,model:source.model,particleCount:source.count,config:source.config,data:captured};
    try{this.sphReference=SphComparisonStore.save(this.directory(),value);this.sphReferenceShown=true;this.sphReferenceError='';this.notice='已保留本次结果 · 切换实验后可叠加比较';}
    catch(e){this.sphReferenceError='保存 SPH 参照失败 · '+String(e);throw new Error(this.sphReferenceError);}
  }
  private clearSphReference():void {
    try{SphComparisonStore.clear(this.directory());this.sphReference=undefined;this.sphReferenceError='';this.notice='已移除 SPH 参照 · 当前实验保留';}
    catch(e){this.sphReferenceError='移除 SPH 参照失败 · '+String(e);throw new Error(this.sphReferenceError);}
  }
  private sphSummary():SphWindowSummary {return sphWindowSummary(this.sphObserved);}
  private sphView():ObservationPlot {return sphPlot(this.sphObserved,this.sphMetric);}
  private preparationLabel():string {
    const p=this.info.preparation;
    if(!p)return '正在构建场景';
    if(p.previousRequestId>0)return '等待上一轮结束';
    if(p.stage==='queued'||p.stage==='starting')return '正在准备实验';
    if(p.stage==='target')return '正在生成主天体';
    if(p.stage==='impactor')return '正在生成撞击体';
    if(p.stage==='relax-target')return '主天体正在预松弛';
    if(p.stage==='relax-impactor')return '撞击体正在预松弛';
    if(p.stage==='solver')return '正在设置运动与材料';
    if(p.stage==='galaxies')return '正在生成恒星盘';
    if(p.stage==='orbits')return '正在准备行星轨道';
    if(p.stage==='snapshot')return '正在生成初始画面';
    return '正在构建场景';
  }
  private preparationHint():string {
    const p=this.info.preparation;
    return this.preparationLabel()+(p?' · '+(p.elapsedMs/1000).toFixed(1)+' s':'')+(p&&p.slow?' · 此阶段耗时较长，可取消后重试':'');
  }
  private cancelSimulation():void {
    simulation.cancel();this.stopTrace();this.playing=false;this.info=simulation.status();
    this.notice='已取消本次请求 · 可重新开始；正在生成的天体会在阶段结束后释放';
  }
  private sphLabel():string {return sphMetricLabel(this.sphMetric);}
  private seekSphExtreme(maximum:boolean):void {
    const data=this.sphObserved,p=this.sphView();if(!p.available)throw new Error('暂无 SPH 曲线');
    simulation.seekSphObservation(maximum?p.maxFrame:p.minFrame,data.sceneRevision,maximum?p.maxTime:p.minTime);
    this.playing=false;this.info=simulation.status();this.refreshObservation();this.notice='已定位所显示记录的'+(maximum?'最大值':'最小值')+' · '+this.sphLabel();
  }
  private refreshObservation():void {
    const fragments=simulation.sphFragments(this.fragmentOffset,8);
    if(fragments.sceneRevision!==this.fragments.sceneRevision||(fragments.available&&this.fragmentOffset>=fragments.groupCount!)){this.fragmentOffset=0;this.fragments=simulation.sphFragments(0,8);}else this.fragments=fragments;
    this.observerMode=simulation.galaxyObserverStatus().mode;
    this.galaxyObserved=simulation.galaxyObservation();
    this.sphObserved=simulation.sphObservation();
    this.observed=simulation.orbitObservation(this.focus>0?this.focus:1);
  }
  private comparisonView():ComparisonPlot {return comparisonPlot(this.observed,this.observationMetric,this.comparisonShown?this.comparisonReference?.data:undefined);}
  private observationView():ObservationPlot {return this.comparisonView().plot;}
  private reloadReference():void {
    try{const saved=ObservationStore.load(this.directory());this.comparisonReference=saved;this.comparisonError='';}
    catch(e){this.comparisonReference=undefined;this.comparisonError='无法读取参照 · '+String(e);}
  }
  private captureReference():void {
    this.refreshObservation();const captured=this.observed,source=simulation.status();
    if(!source.config||source.config.preset<3||captured.samples.length<2||simulation.orbitObservation(captured.body).sceneRevision!==captured.sceneRevision)throw new Error('需要同一场景的至少两帧轨道记录');
    const value:ObservationReference={schemaVersion:1,capturedAt:Date.now(),title:this.title,config:source.config,data:captured};
    try{const saved=ObservationStore.save(this.directory(),value);this.comparisonReference=saved;this.comparisonShown=true;this.comparisonError='';this.notice='已保存参照 · 改参数或切换实验后仍可比较';}
    catch(e){this.comparisonError='保存参照失败 · '+String(e);throw new Error(this.comparisonError);}
  }
  private clearReference():void {
    try{ObservationStore.clear(this.directory());this.comparisonReference=undefined;this.comparisonError='';this.notice='已移除参照 · 当前模拟保留';}
    catch(e){this.comparisonError='移除参照失败 · '+String(e);throw new Error(this.comparisonError);}
  }
  private referenceCaption():string {
    const r=this.comparisonReference;if(!r)return '';
    return r.title+' / '+r.data.name+' · '+r.data.samples.length+' 帧 · '+r.data.samples[0].time.toFixed(3)+'–'+r.data.samples[r.data.samples.length-1].time.toFixed(3)+' 年';
  }
  private referenceParameters():string {
    const c=this.comparisonReference?.config;if(!c)return '';
    return (c.preset===5?'自定义 '+c.orbitBodies!.length+' 天体':(c.preset===3?'双体':'行星系统')+' · 初速 '+c.speed.toFixed(2)+' ×')+' · 时长 '+c.duration+' 年';
  }
  private observationWidth():number {return Math.max(120,Math.min(240,this.layout().drawer.width-64));}
  private observationPath(path:string):string {
    const scale=this.observationWidth()/240;
    return this.pathPixels(path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,(v:string):string=>String(Number(v)*scale)));
  }
  private seekObservationExtreme(maximum:boolean):void {
    this.refreshObservation();const p=this.observationView();if(!p.available)throw new Error('暂无轨道记录');
    simulation.seekObservation(maximum?p.maxFrame:p.minFrame,this.observed.sceneRevision,maximum?p.maxTime:p.minTime);
    this.stopTrace();this.playing=false;this.info=simulation.status();this.refreshObservation();
    this.notice='已定位记录中的'+(maximum?'最大值':'最小值')+' · 不代表完整轨道极值';
  }
  private contactNoticeKey:string='';
  private mainSimulationAction():string {
    if(this.info.impact?.canReturn&&['completed','failed','cancelled'].includes(this.info.state))return 'impact.return';
    return this.info.state==='preparing'?'simulation.cancel':'simulation.toggle';
  }
  private mainSimulationEnabled():boolean {
    return !this.ioBusy&&!(this.info.impact?.local&&!this.info.impact?.canReturn&&!['paused','running'].includes(this.info.state));
  }
  private simulationLabel(compact:boolean=false):string {
    if(this.mainSimulationAction()==='impact.return')return compact?'返回':'返回轨道';
    if(this.info.impact?.local&&!this.info.impact?.canReturn&&!['paused','running'].includes(this.info.state))return '仅回放';
    if(this.info.state==='preparing')return compact?'取消':'取消准备';
    if(this.info.state==='running')return compact?'暂停':'暂停时间';
    if(this.isOrbit()&&!this.dirty&&(this.info.orbitState??[]).length>0)return compact?'继续':'时间继续';
    if(this.dirty)return compact?'应用':'应用并开始';
    if(this.contactMode()&&this.info.state==='paused'&&this.info.time>0)return compact?'继续':'继续实验';
    return compact?'开始':'开始实验';
  }
  private directory(): string { return (this.getUIContext().getHostContext() as common.UIAbilityContext).filesDir; }
  aboutToAppear(): void {
    this.videos();this.syncVideo();
    this.refreshProjects();this.reloadReference();this.reloadSphReference();this.reloadGalaxyReference();
    loadSkyPanorama(this.getUIContext().getHostContext() as common.UIAbilityContext).catch((error:Error) => {this.skyLoadError=error.message;});
    this.prepare(false);
    CliBridge.bind((command: string, payload: CommandPayload) => this.execute(command,payload));
    this.poll = setInterval(() => {
      this.syncVideo();
      const previousState: string = this.info.state;
      this.info = simulation.status();this.syncImpactView();this.cameraFlight=simulation.getCameraMotion(0).state;this.rendering=simulation.renderStatus();this.observerMode=simulation.galaxyObserverStatus().mode;this.trace=simulation.ringTraceStatus(false);
      if(this.contactMode()&&this.info.state==='paused'&&this.info.selected<0&&(this.info.contact?.count??0)>0){
        const key=String(this.info.preparation?.requestId??0)+':'+String(this.info.contact!.count);
        if(key!==this.contactNoticeKey){this.contactNoticeKey=key;this.notice='实体接触已响应 · 可继续查看分离过程，或回放接近过程';}
      }
      this.ensureMoonTexture();
      if(this.panelOpen&&this.tab===1&&this.appForeground)this.refreshObservation();
      if (this.info.state === 'completed' && previousState !== 'completed' && !this.ioBusy) { this.notice = '计算完成 · 可在时间轴回看结果'; }
      if (this.playing && this.appForeground && this.info.frames > 0) {
        const next: number = this.info.selected < 0 ? 0 : this.info.selected + 1;
        if (next >= this.info.frames) { this.playing = false; }
        else { simulation.seek(next); }
      }
    }, 200);
  }
  aboutToDisappear(): void { SceneVideo.background(); this.stopCameraMotion();CliBridge.unbind(); this.panelEpoch++; clearInterval(this.poll); simulation.pause(true); }
  @State private orbitDrafts:OrbitDraftState[]=[];
  @State private orbitUndo:OrbitHistoryEntry[]=[];
  @State private orbitRedo:OrbitHistoryEntry[]=[];
  @State private surfaces:SurfaceRecipe[]=[];
  @State private surfaceUndo:SurfaceRecipe[][]=[];
  @State private surfaceRedo:SurfaceRecipe[][]=[];
  private surfaceTarget():number {return this.focus>0?this.focus:this.orbitEdit;}
  private canGenerateSurface():boolean {const i=this.surfaceTarget();return this.preset===5&&!this.placing&&i>0&&i<this.orbitBodies.length&&this.orbitBodies[i].surface!==5;}
  private syncSurfaces():void {
    const pairs:number[]=[];for(let i=0;i<8;i++){const v=this.placing&&i===this.orbitBodies.length?this.placementSurfaceRecipe:this.surfaces[i];pairs.push(v?v.seed:0,v?v.cloudSeed:0);}simulation.setSurfaceSeeds(pairs);
  }
  private resetSurfaces(fresh:boolean=false):void {
    this.surfaces=legacySurfaces(this.preset===5?this.orbitBodies.length:0);
    if(fresh)this.surfaces=this.surfaces.map((v:SurfaceRecipe,i:number):SurfaceRecipe=>i===0||this.orbitBodies[i].surface===5?v:{version:1,seed:(this.seed+i*104729)%1000000+1,cloudSeed:(this.seed+i*193939)%1000000+1});
    this.surfaceUndo=[];this.surfaceRedo=[];this.syncSurfaces();
  }
  private changeSurface(body:number,seed:number,cloudSeed:number):void {
    if(this.preset!==5||this.placing||this.ioBusy||!Number.isInteger(body)||body<1||body>=this.orbitBodies.length)throw new Error('请选择自定义系统中的行星');
    const next=copySurfaces(this.surfaces);next[body]={version:1,seed:seed,cloudSeed:cloudSeed};validateSurfaces(next,this.orbitBodies);
    if(JSON.stringify(next)===JSON.stringify(this.surfaces))return;
    this.surfaceUndo=this.surfaceUndo.concat([copySurfaces(this.surfaces)]).slice(-20);this.surfaceRedo=[];this.surfaces=next;this.syncSurfaces();
    this.notice='已修改 '+this.orbitBodies[body].name+' 的外观 · 模拟与视角保留';
  }
  private regenerateSurface(cloudOnly:boolean):void {
    const i=this.surfaceTarget(),v=this.surfaces[i];
    if(!this.canGenerateSurface()||!v)throw new Error('当前天体不支持程序化地貌');
    this.changeSurface(i,cloudOnly?v.seed:(v.seed+104729)%1000000+1,cloudOnly?(v.cloudSeed+193939)%1000000+1:v.cloudSeed);
  }
  private travelSurfaceHistory(redo:boolean):void {
    const from=redo?this.surfaceRedo:this.surfaceUndo;if(!from.length)throw new Error('没有可恢复的外观编辑');
    const next=copySurfaces(from[from.length-1]);validateSurfaces(next,this.orbitBodies);
    if(redo){this.surfaceRedo=this.surfaceRedo.slice(0,-1);this.surfaceUndo=this.surfaceUndo.concat([copySurfaces(this.surfaces)]).slice(-20);}
    else{this.surfaceUndo=this.surfaceUndo.slice(0,-1);this.surfaceRedo=this.surfaceRedo.concat([copySurfaces(this.surfaces)]).slice(-20);}
    this.surfaces=next;this.syncSurfaces();this.notice='已'+(redo?'重做':'撤销')+'外观 · 模拟与视角保留';
  }
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
    return {surfaces:copySurfaces(this.surfaces),bodies:copyOrbitBodies(this.orbitBodies),selected:this.orbitEdit,drafts:this.bodyDrafts()};
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
  private focusBody(body:number):void {simulation.clearSphFragmentFollow();this.adoptCameraPose();this.rememberOverview();this.focus=body;if(this.preset===5)this.selectOrbit(body);this.camera(.42,false,true);if(this.isOrbit())this.notice='已选中 '+this.surfaceName()+' · 可近看或编辑初始条件';}
  private adoptCameraPose():void {
    const m:CameraMotionStatus=simulation.getCameraMotion(0);
    if(m.state==='queued'||m.state==='running'){this.yaw=m.yaw;this.pitch=m.pitch;this.zoom=m.zoom;}
  }
  private stopCameraMotion():void {
    const m:CameraMotionStatus=simulation.getCameraMotion(0);
    if(m.state==='queued'||m.state==='running'){
      const stopped:CameraMotionStatus=simulation.cancelCameraMotion(m.requestId);
      this.yaw=stopped.yaw;this.pitch=stopped.pitch;this.zoom=stopped.zoom;this.cameraFlight=stopped.state;
    }
  }
  private easeCamera(yaw:number,pitch:number,zoom:number):void {
    this.yaw=yaw;this.pitch=pitch;this.zoom=zoom;this.camera(.32,true,true);
  }
  private geometryChanged():void {this.composeViewport();}
  private layout():WorkspaceLayout {
    const ui=this.getUIContext(),g=this.windowGeometry;
    return workspaceLayout(this.viewportWidth,this.viewportHeight,this.panelOpen&&this.toolsVisible,
      {top:ui.px2vp(g.topPx),bottom:ui.px2vp(g.bottomPx),left:ui.px2vp(g.leftPx),right:ui.px2vp(g.rightPx)});
  }
  private updateViewport(width:number,height:number):void {
    if(width<=0||height<=0)return;
    this.viewportWidth=width;this.viewportHeight=height;
    this.composeViewport();
  }
  private composeViewport():void {
    let x:number=.5,y:number=.5,scale:number=1;
    if((this.preset<3||this.preset===6||this.closeup)&&this.panelOpen&&this.toolsVisible&&this.viewportWidth>0&&this.viewportHeight>0){
      const region=this.layout().scene;
      const radius=Math.min(Math.min(this.viewportWidth,this.viewportHeight)*.37,this.viewportHeight*.28)*Math.max(.4,Math.min(1.1,2.7/this.zoom));
      x=(region.x+region.width/2)/this.viewportWidth;y=(region.y+region.height/2)/this.viewportHeight;
      scale=(this.preset<3||this.preset===6)?Math.min(1,Math.min(region.width,region.height)/Math.min(this.viewportWidth,this.viewportHeight)):Math.min(1,Math.max(0,Math.min(region.width,region.height)/2-12)/radius);
    }
    simulation.setComposition(Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y)),Math.max(.05,scale));
  }
  private canTrace():boolean {return this.preset===5&&this.focus>0&&this.orbitBodies[this.focus]?.surface===4&&this.orbitBodies[this.focus].massSolar>=1e-8&&!this.placing;}
  private stopTrace():void {if(this.trace.enabled){simulation.configureRingTrace(false,false,-1,this.trace.massSolar);this.trace=simulation.ringTraceStatus(false);}}
  private toggleTrace():void {
    if(this.trace.enabled){this.stopTrace();return;}
    if(!this.canTrace())throw new Error('请先选择带环气态行星');
    this.playing=false;simulation.pause(true);this.autoSpin=false;
    simulation.configureRingTrace(true,false,this.focus,this.orbitBodies[this.focus].massSolar);this.trace=simulation.ringTraceStatus(false);this.camera();
    this.notice='8192 个环粒子生成同一条环带 · 独立小时钟';
  }
  private playTrace():void {
    if(!this.trace.enabled)throw new Error('示踪环未开启');
    const now:RingTraceStatus=simulation.ringTraceStatus(false);
    if(now.timeHours>=24)simulation.seekRingTrace(0);
    simulation.configureRingTrace(true,!now.running,now.target,now.massSolar);this.trace=simulation.ringTraceStatus(false);
  }
  private traceParameter(field:string,value:number):void {
    this.checked(value,field==='trace.speed'?1:.1,field==='trace.speed'?1.2:4);
    if(!this.trace.enabled)throw new Error('示踪环未开启');
    const now:RingTraceStatus=simulation.ringTraceStatus(false);
    simulation.setRingParameters(field==='trace.speed'?value:now.speedScale,field==='trace.rate'?value:now.rateHours);
    this.trace=simulation.ringTraceStatus(false);
    this.notice=field==='trace.speed'?'发射速度已调整 · 从近点重新开始，主星系保持暂停':'已调整局部播放倍率 · 当前时刻保持';
  }
  private ringDisturbance(value:number,points:boolean=this.trace.points):void {
    this.checked(value,0,.35);if(!this.trace.enabled)throw new Error('局部环未开启');
    simulation.setRingDisturbance(value,points);this.trace=simulation.ringTraceStatus(false);
    this.notice='环带与颗粒同步 · 改扰动会归零；只开关颗粒保留时刻';
  }
  // Face-on diagnostic for the innermost reference particle; follows native x/y.
  private tracePlotPath(marker:boolean=false):string {
    const e=this.trace.eccentricity,a=76800/(1-e),scale=68/a;
    if(marker){const x=90+(this.trace.referenceXKm+a*e)*scale,y=76-this.trace.referenceYKm*scale;return this.tracePlotPixels('M'+(x-3)+' '+y+' L'+(x+3)+' '+y+' M'+x+' '+(y-3)+' L'+x+' '+(y+3));}
    let path='';for(let i=0;i<=96;i++){const E=i*2*Math.PI/96;path+=(i===0?'M':' L')+(90+68*Math.cos(E))+' '+(76-68*Math.sqrt(1-e*e)*Math.sin(E));}
    return this.tracePlotPixels(path);
  }
  private tracePlotPixels(path:string):string {return this.pathPixels(path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,(v:string):string=>String(Number(v)*112/180)));}
  private traceTime(hours:number):void {this.checked(hours,0,24);if(!this.trace.enabled)throw new Error('示踪环未开启');simulation.seekRingTrace(hours*3600);this.trace=simulation.ringTraceStatus(false);}
  private camera(duration:number=.42,animatePose:boolean=false,force:boolean=false): void {
    if(this.trace.enabled&&(!this.canTrace()||this.trace.target!==this.focus))this.stopTrace();
    this.composeViewport();
    simulation.setSky(this.skyMode,this.skyBrightness);
    simulation.setMaterial(this.exposure,this.ocean,this.cloudShadows);
    simulation.setAppearance(this.clouds,this.atmosphere,this.trails,this.closeup,this.autoSpin,this.rings);
    const m:CameraMotionStatus=simulation.navigateCamera(this.yaw,this.pitch,this.zoom,this.focus,this.colorMode,this.closeup,duration,animatePose,force);
    this.cameraFlight=m.state;
  }
  private ensureMoonTexture(retry:boolean=false):void {
    if(this.moonRequested||(!(this.placing&&this.placementSurface===5)&&!(this.info.bodies??[]).some((b:OrbitBodyStatus):boolean=>b.surface===5)))return;
    this.moonRequested=true;this.moonLoadError='';
    loadMoonTexture(this.getUIContext().getHostContext() as common.UIAbilityContext,retry).catch((error:Error)=>{this.moonLoadError=error.message;});
  }
  private selectedMoon():boolean {return this.preset===5&&this.focus>0&&this.orbitBodies[this.focus]?.surface===5;}
  private surfaceName(): string {if(this.preset===5)return this.orbitBodies[Math.max(0,this.focus)]?.name??'行星';return this.focus===0?'恒星':(this.focus===2?'厚云行星':(this.focus===3?'荒漠行星':'海洋行星'));}
  private openSurface(body: number = 1): void {
    if(!this.isOrbit())return;
    this.adoptCameraPose();this.rememberOverview();this.focus=body;if(this.preset===5)this.selectOrbit(body);this.closeup=true;this.autoSpin=true;this.colorMode=0;this.camera(.42,false,true);this.setPanel(-1);
    this.notice='近看天体 · 保留当前模拟时间与轨迹';
  }
  private closeSurface(): void {
    this.closeup=false;this.autoSpin=false;this.focus=-1;
    const saved=this.overviewCamera;this.overviewCamera=undefined;
    if(saved){this.yaw=saved.yaw;this.pitch=saved.pitch;this.zoom=saved.zoom;}
    this.camera(.42,true,true);
    this.notice='系统全景 · 保留当前模拟时间与轨迹';
  }
  private changeAppearance(p: CommandPayload): void {
    const values: (boolean|undefined)[]=[p.clouds,p.atmosphere,p.trails,p.closeup,p.autoSpin,p.rings];
    for(const v of values)if(v!==undefined&&typeof v!=='boolean')throw new Error('外观参数必须是 boolean');
    const closeup:boolean=p.closeup??this.closeup;
    if(closeup&&!this.isOrbit())throw new Error('近看表面仅支持引力预设');
    this.clouds=p.clouds??this.clouds;this.atmosphere=p.atmosphere??this.atmosphere;this.trails=p.trails??this.trails;
    if(closeup)this.rememberOverview();
    this.closeup=closeup;this.autoSpin=p.autoSpin??this.autoSpin;this.rings=p.rings??this.rings;
    if(this.closeup&&this.focus<0)this.focus=1;
    this.camera();
  }
  private prepare(run: boolean): boolean {
    this.stopTrace();
    this.stopCameraMotion();this.overviewCamera=undefined;this.placing=false;this.placementView=undefined;
    try {
      this.playing = false;
      simulation.startScene(this.config(),!run);
      if(run&&this.isOrbit())simulation.orbitClock(this.orbitDays);
      simulation.pause(!run);
      this.dirty = false;
      this.notice = run ? (this.preset===6?'正在计算星系潮汐 · 恒星群随引力演化':this.isOrbit()?'正在计算多体引力 · 轨迹来自积分结果':'正在运行真实 SPH 求解') : '场景就绪后，点击开始实验';
      this.camera();
      this.info = simulation.status();
      return true;
    } catch (_) { this.notice = '场景创建失败，请检查参数'; return false; }
  }
  private themeState():ThemeState {
    const t=this.themes.find((e:ThemeExperiment):boolean=>e.id===this.activeThemeId);
    if(!t)return {id:'',title:'',goal:'',limit:'',modified:false,compareId:''};
    return {id:t.id,title:t.title,goal:t.goal,limit:this.selfGravity&&this.preset<3?'已开启材料自引力；未建立静力平衡，不模拟月球形成。':t.limit,modified:!themeConfigMatches(this.config(),t.config),compareId:t.compareId};
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
    this.rings=true;this.clouds=true;this.atmosphere=true;this.trails=true;this.closeup=t.closeup;this.autoSpin=t.closeup;this.colorMode=t.id.startsWith('material-')?7:0;
    this.dirty=false;this.toolsVisible=true;this.info=simulation.status();this.camera();this.setPanel(-1);
    if(t.id==='kepler-ring'||t.id==='eccentric-ring'){this.toggleTrace();if(t.id==='eccentric-ring')this.traceParameter('trace.speed',1.12);}
    this.notice=t.question+((t.id==='kepler-ring'||t.id==='eccentric-ring')?' · 点击运行环，调轨可改发射速度':' · 点击开始实验');
  }
  private choose(i: number): void {
    if (this.ioBusy) return;
    this.initialEnergyMJkg=0;this.initialDamage=0;this.activeThemeId='';this.clearOrbitHistory();
    this.targetRadiusKm=100;this.impactorRadiusKm=60;this.targetDensity=2700;this.impactorDensity=2700;this.targetSpin=0;this.selfGravity=false;this.relaxationSeconds=0;
    this.editedBody=0;this.title=i>=3?(i===3?'双体轨道':'行星系统'):(i===2?'旋转实验':'碰撞实验');
    this.duration=i===6?600:i>=3?3:60;this.colorMode=0;this.galaxyMassRatio=.6;this.galaxyOffsetKpc=12;this.galaxyRetrograde=false;this.galaxyResponsive=false;
    this.closeup=false;this.autoSpin=false;
    this.preset = i;this.selectingPreset=false;
    this.angle = i === 1 ? 45 : 0;
    this.speed = i>=3?1:(i === 2 ? 2 : 5);
    this.focus = -1;
    this.yaw = 0.15; this.pitch = 0.25; this.zoom = 2.7;
    if(i===6){this.title='星系潮汐相遇';this.count=1600;this.angle=25;this.zoom=5.2;this.changeSky(1,.35);}
    if(i===5){this.title='自定义系统';this.orbitBodies=defaultOrbitBodies();this.selectOrbit(1,true);}
    this.resetSurfaces(true);this.prepare(false);
  }
  private run(): void {
    this.stopTrace();
    this.playing = false;
    if (this.info.state === 'running') { simulation.pause(true); this.notice = '已暂停，可回看时间轴或调整视角'; }
    else if (this.isOrbit()&&!this.dirty&&!['failed','cancelled'].includes(this.info.state)&&(this.info.orbitState??[]).length>0) {this.changeOrbitClock(this.orbitDays);simulation.pause(false);this.notice='持续演化 · 可随时暂停或加入天体';}
    else if (this.dirty || this.info.state === 'completed' || this.info.state === 'cancelled' || this.info.state === 'failed' || this.info.state === 'replay') { this.prepare(true); }
    else { simulation.pause(false); this.notice = (this.preset===6?'正在计算星系潮汐 · 恒星群随引力演化':this.isOrbit()?'正在计算多体引力 · 轨迹来自积分结果':'正在运行真实 SPH 求解'); }
    this.info = simulation.status();
  }
  private config(): SimulationConfig {
    const c: SimulationConfig={preset:this.preset,count:this.count,speed:this.speed,angle:this.angle,duration:this.duration,
      targetRadiusKm:this.targetRadiusKm,impactorRadiusKm:this.impactorRadiusKm,targetDensity:this.targetDensity,
      impactorDensity:this.impactorDensity,targetSpin:this.targetSpin,seed:this.seed};
    if(this.initialEnergyMJkg>0)c.initialEnergyMJkg=this.initialEnergyMJkg;
    if(this.initialDamage>0)c.initialDamage=this.initialDamage;
    if(this.selfGravity)c.selfGravity=true;
    if(this.relaxationSeconds>0)c.relaxationSeconds=this.relaxationSeconds;
    if(this.preset===6){c.galaxyMassRatio=this.galaxyMassRatio;c.galaxyOffsetKpc=this.galaxyOffsetKpc;c.galaxyRetrograde=this.galaxyRetrograde;if(this.galaxyResponsive)c.galaxyResponsive=true;}
    if(this.preset===5)c.orbitBodies=copyOrbitBodies(this.orbitBodies);
    return c; // State inspection must also work after bodies evolve beyond initial editor bounds.
  }
  private applyConfig(c: SimulationConfig,live:boolean=false): void {
    if(!live)validateConfig(c);this.initialEnergyMJkg=c.initialEnergyMJkg??0;this.initialDamage=c.initialDamage??0;this.stopTrace();this.activeThemeId='';this.clearOrbitHistory();
    if(c.preset!==this.preset){this.closeup=false;this.autoSpin=false;}
    if(c.preset===6&&this.preset!==6){this.zoom=5.2;this.focus=-1;this.changeSky(1,.35);}
    this.galaxyMassRatio=c.galaxyMassRatio??.6;this.galaxyOffsetKpc=c.galaxyOffsetKpc??12;this.galaxyRetrograde=c.galaxyRetrograde??false;this.galaxyResponsive=c.galaxyResponsive??false;
    this.preset=c.preset;this.count=c.count;this.speed=c.speed;this.angle=c.angle;this.duration=c.duration;
    this.targetRadiusKm=c.targetRadiusKm;this.impactorRadiusKm=c.impactorRadiusKm;
    this.relaxationSeconds=c.relaxationSeconds??0;this.selfGravity=c.selfGravity===true;this.targetDensity=c.targetDensity;this.impactorDensity=c.impactorDensity;this.targetSpin=c.targetSpin;this.seed=c.seed;
    this.editedBody=0;
    if(c.preset===5){this.orbitBodies=copyOrbitBodies(c.orbitBodies!);this.selectOrbit(1,true);this.focus=-1;this.closeup=false;this.autoSpin=false;}
    if(this.focus>this.maxFocus())this.focus=-1;
    if(c.preset>=3&&this.colorMode>=2)this.colorMode=0;
    this.resetSurfaces(true);
  }
  private definition(): SceneDefinition {
    if(this.preset===6)return {schemaVersion:1,model:this.galaxyResponsive?'galaxy-responsive-v1':'galaxy-tidal-restricted-v1',title:this.title,config:this.config(),bodies:[]};
    if(this.isOrbit()){const scene:SceneDefinition={schemaVersion:1,model:this.preset===5?(this.contactMode()?'nbody-hard-sphere-v1':'nbody-custom-v1'):'nbody-v1',title:this.title,config:this.config(),bodies:[]};return scene;}
    const bodies: BodyDefinition[]=[{id:'primary',name:this.targetName,kind:'rock',radiusKm:this.targetRadiusKm,density:this.targetDensity}];
    if(this.preset!==2) bodies.push({id:'impactor',name:this.impactorName,kind:'rock',radiusKm:this.impactorRadiusKm,density:this.impactorDensity});
    const scene: SceneDefinition={schemaVersion:1,model:this.info.impact?.local?'sph-orbit-impact-v1':this.relaxationSeconds>0?'sph-rock-prepared-v1':(this.selfGravity?'sph-rock-gravity-v1':'sph-rock-v1'),title:this.title,config:this.info.impact?.local?this.info.config!:this.config(),bodies:bodies};
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
      if(saved){this.orbitEdit=i;this.orbitName=saved.name;this.orbitFields=saved.fields.slice();if(this.contactMode()&&this.orbitFields.length===7)this.orbitFields.push(String(this.orbitBodies[i].radiusKm));this.orbitSurface=saved.surface;this.orbitDraft=true;return;}
    }
    const b:OrbitBodyConfig=this.orbitBodies[i];this.orbitEdit=i;this.orbitName=b.name;this.orbitSurface=b.surface;
    this.orbitFields=[String(b.surface===0?b.massSolar:b.massSolar/EARTH_MASS_SOLAR),String(b.xAU),String(b.yAU),String(b.zAU),String(b.vxKmS),String(b.vyKmS),String(b.vzKmS)];if(b.radiusKm!==undefined)this.orbitFields.push(String(b.radiusKm));
    this.orbitDraft=false;
  }
  private installOrbitWorkspace(workspace:OrbitWorkspace):void {
    validateOrbitBodies(workspace.bodies);validateSurfaces(workspace.surfaces,workspace.bodies);
    const config=this.config();config.orbitBodies=copyOrbitBodies(workspace.bodies);validateConfig(config);
    // Submit validated initial conditions before altering drafts or history.
    simulation.startScene(config,true);simulation.pause(true);this.stopTrace();
    this.stopCameraMotion();this.overviewCamera=undefined;this.playing=false;this.placing=false;this.placementView=undefined;
    this.surfaces=copySurfaces(workspace.surfaces);this.surfaceUndo=[];this.surfaceRedo=[];this.syncSurfaces();
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
    let surfaces=copySurfaces(before.surfaces);
    if(removed>=0)surfaces.splice(removed,1);
    while(surfaces.length<bodies.length){const source=this.placementSource;surfaces.push(this.placing?copySurfaces([this.placementSurfaceRecipe])[0]:{version:1,seed:Date.now()%1000000+1,cloudSeed:(Date.now()+193939)%1000000+1});}
    surfaces=surfaces.map((v:SurfaceRecipe,i:number):SurfaceRecipe=>bodies[i].surface===5?{version:1,seed:0,cloudSeed:0}:v);
    this.installOrbitWorkspace({surfaces:surfaces,bodies:bodies,selected:selected,drafts:drafts});
    this.orbitUndo=this.orbitUndo.concat([{label:label,workspace:before}]).slice(-20);this.orbitRedo=[];
    this.notice='已'+label+' · 可撤销，其他天体草稿保留，旧轨迹已清空';
  }
  private applyOrbit(strict:boolean=false):void {
    try {
      if(this.orbitFields.some((v:string):boolean=>v.trim().length===0))throw new Error('请填写全部数值');
      const v:number[]=this.orbitFields.map((s:string):number=>Number(s));
      const b:OrbitBodyConfig={name:validName(this.orbitName),massSolar:v[0]*(this.orbitSurface===0?1:EARTH_MASS_SOLAR),xAU:v[1],yAU:v[2],zAU:v[3],vxKmS:v[4],vyKmS:v[5],vzKmS:v[6],surface:this.orbitSurface};
      if(this.contactMode())b.radiusKm=v[7];
      const bodies:OrbitBodyConfig[]=copyOrbitBodies(this.orbitBodies);bodies[this.orbitEdit]=b;
      this.replaceOrbits(bodies,this.orbitEdit,'修改 · '+b.name,this.orbitEdit);
    }catch(e){this.notice=String(e);if(strict)throw new Error(String(e));}
  }
  private impactRecipe?:ExperimentRecipe;
  private impactTitle:string='';
  private impactEntered:boolean=false;
  private syncImpactView():void {
    if(!this.info.impact)this.impactEntered=false;
    if(this.info.impact?.local&&!this.impactEntered){
      this.applyConfig(this.info.config!);this.impactEntered=true;this.title='局部撞击 · 岩质 SPH';this.closeup=false;this.autoSpin=false;this.focus=-1;this.yaw=0;this.pitch=.25;this.zoom=3;this.colorMode=7;this.dirty=false;this.camera(0,true,true);this.setPanel(-1);
      this.notice='已按真实入射状态生成粒子 · 开始后计算破坏与热软化 · 原轨道暂停保留';
    } else if(!this.info.impact&&this.impactRecipe){
      const recipe=this.impactRecipe;this.applyConfig(this.info.config!,true);this.title=this.impactTitle;this.restoreRecipe(recipe);this.impactRecipe=undefined;this.impactEntered=false;this.dirty=false;this.notice=this.info.error||'已返回原轨道 · 保留原来的时刻与历史，局部碎片尚不回注';
    }
  }
  private beginImpact():void {
    const source:SimulationStatus=simulation.status();
    const recipe=this.captureRecipe();simulation.startImpact(source.orbitRevision!,source.contact!.count);
    this.impactRecipe=recipe;this.impactTitle=this.title;this.impactEntered=false;this.playing=false;this.info=simulation.status();this.notice='正在生成真实入射状态的岩体粒子 · 原轨道已保留';
  }
  private localImpactActionAllowed(action:string):boolean {
    if(!this.info.impact?.canReturn&&['preset.','project.load.'].some((prefix:string):boolean=>action.startsWith(prefix)))return true;
    return ['impact.return','simulation.cancel'].includes(action)||((action==='simulation.toggle')&&['paused','running'].includes(this.info.state))||['panel.','ui.','camera.','color.','focus.','replay.','video.','sky.','sph.metric.','fragments.'].some((prefix:string):boolean=>action.startsWith(prefix));
  }
  private contactMode():boolean {return this.preset===5&&finiteOrbitBodies(this.orbitBodies);}
  private contactDemo(small:boolean=false):void {
    const c=this.config();c.preset=5;c.speed=1;c.duration=1;c.orbitBodies=contactDemoBodies(small);c.initialEnergyMJkg=undefined;c.initialDamage=undefined;c.selfGravity=false;c.relaxationSeconds=0;
    validateConfig(c);this.applyConfig(c);this.title=small?'小岩体 · 撞击初值':'球体接触 · 理想弹性';if(!this.prepare(false))throw new Error(this.notice);
    this.focus=1;this.yaw=0;this.pitch=0;this.zoom=4.2;this.closeup=true;this.autoSpin=false;this.camera(0,true,true);this.setPanel(-1);this.notice='启动后在接触响应处暂停 · 球体保持完整，不模拟行星破裂';
  }
  private updateGalaxyObserver():void {
    simulation.setGalaxyObserver(this.observerMode,this.observerYaw,this.observerPitch,this.observerFov,this.observerLatitude,this.observerSidereal);
  }
  private changeGalaxyObserver(mode:number):void {
    simulation.setGalaxyObserver(mode,this.observerYaw,this.observerPitch,this.observerFov,this.observerLatitude,this.observerSidereal);
    const entering=this.observerMode===0&&mode>0;this.observerMode=mode;
    if(entering){this.stopCameraMotion();this.setPanel(-1);this.setTools(true);}
    if(mode>0)this.aimGalaxyObserver(true);
    this.notice=mode===2&&this.observerPitch<0?'中心在地平线下 · 可调整当地恒星时，或切换太空视角':mode>0?'假设相遇 · 太阳位置类比 · 拖动环顾，双指改变视场':'已返回外部视角 · 保留当前模拟时间';
  }
  private aimGalaxyObserver(secondary:boolean):void {
    const data:GalaxyObserverStatus=simulation.galaxyObserverStatus();if(data.mode===0)throw new Error('请先进入盘内观测');
    this.observerYaw=secondary?data.secondaryYaw:data.primaryYaw;this.observerPitch=secondary?data.secondaryPitch:data.primaryPitch;this.updateGalaxyObserver();
    if(this.observerMode===2)this.notice=this.observerPitch<0?'中心在地平线下 · 可调整当地恒星时，或切换太空视角':'已对准'+(secondary?'来访星系':'主星系')+' · 拖动环顾，双指改变视场';
  }
  private galaxyPlacementState():GalaxyPlacementState {return {active:this.galaxyPlacing,offsetKpc:this.galaxyPlacementOffset,sourceTime:this.galaxyPlacementTime,constraint:'initial X separation fixed at 60 kpc; transverse offset 0..30 kpc; confirmation regenerates initial conditions'};}
  private updateGalaxyPlacement():void {
    simulation.setGalaxyPlacement(this.galaxyPlacing,this.count,this.seed,this.speed,this.angle,this.galaxyMassRatio,this.galaxyPlacementOffset,this.galaxyRetrograde,this.galaxyResponsive);
  }
  private beginGalaxyPlacement():void {
    if(this.observerMode>0)this.changeGalaxyObserver(0);
    if(this.preset!==6||this.ioBusy||this.info.state==='preparing'||this.info.frames===0)throw new Error('请等待星系初态就绪');
    validateConfig(this.config());this.stopCameraMotion();
    this.galaxyPlacementView={yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:this.focus,color:this.colorMode};this.galaxyPlacementOverview=this.overviewCamera;
    this.galaxyPlacementRunning=simulation.status().state==='running';this.galaxyPlacementPlaying=this.playing;
    this.galaxyPlacementPanel=this.panelOpen?this.tab:-1;this.galaxyPlacementTime=simulation.status().time;
    if(this.galaxyPlacementRunning)simulation.pause(true);this.playing=false;
    this.galaxyPlacementOffset=this.galaxyOffsetKpc;this.galaxyPlacing=true;this.updateGalaxyPlacement();
    this.yaw=0;this.pitch=0;this.zoom=5.2;this.focus=-1;this.colorMode=0;this.camera();this.setPanel(-1);
    this.notice='上下拖动次星系，调整错身距离 · 确认后从初始时刻重算';
  }
  private cancelGalaxyPlacement():void {
    this.galaxyPlacing=false;this.updateGalaxyPlacement();const c=this.galaxyPlacementView;this.galaxyPlacementView=undefined;
    if(c){this.yaw=c.yaw;this.pitch=c.pitch;this.zoom=c.zoom;this.focus=c.focus;this.colorMode=c.color;this.camera();}this.overviewCamera=this.galaxyPlacementOverview;
    if(this.galaxyPlacementRunning)simulation.pause(false);this.playing=this.galaxyPlacementPlaying;this.setPanel(this.galaxyPlacementPanel);this.notice='已取消 · 原实验、参数草稿和视角保留';
  }
  private confirmGalaxyPlacement():void {
    const c=this.config();c.galaxyOffsetKpc=this.galaxyPlacementOffset;validateConfig(c);simulation.startScene(c,true);simulation.pause(true);
    this.applyConfig(c);this.galaxyPlacing=false;this.updateGalaxyPlacement();this.galaxyPlacementView=undefined;this.overviewCamera=undefined;this.playing=false;this.dirty=false;this.camera();this.info=simulation.status();this.notice='新的相遇初态已建立 · 点击开始实验';
  }
  private moveGalaxyPlacement(x:number,y:number):void {
    if(!this.galaxyPlacing||this.ioBusy)throw new Error('尚未打开星系相遇预览');
    const offset=simulation.placeGalaxyAt(x,y);this.galaxyPlacementOffset=offset;this.updateGalaxyPlacement();
  }
  private dragGalaxyPlacement(e:GestureEvent):void {const f=e.fingerList[0];if(e.fingerList.length!==1||!f||this.viewportWidth<=0||this.viewportHeight<=0)return;try{this.moveGalaxyPlacement(f.localX/this.viewportWidth,f.localY/this.viewportHeight);}catch(error){this.notice=String(error);}}
  private galaxyComparisonView():GalaxyComparisonPlot {return galaxyComparisonPlot(this.galaxyObserved,this.galaxyMetric,this.galaxyReferenceShown?this.galaxyReference?.data:undefined);}
  private galaxyView():ObservationPlot {return this.galaxyComparisonView().plot;}
  private galaxyDifferences():string[] {return this.galaxyReference?galaxyParameterDifferences(this.galaxyObserved,this.galaxyReference.data):[];}
  private reloadGalaxyReference():void {
    try{this.galaxyReference=GalaxyComparisonStore.load(this.directory());this.galaxyReferenceError='';}
    catch(e){this.galaxyReference=undefined;this.galaxyReferenceError='无法读取星系参照 · '+String(e);}
  }
  private captureGalaxyReference():void {
    const data=simulation.galaxyObservation();
    const value:GalaxyReference={schemaVersion:1,capturedAt:Date.now(),title:this.title,model:galaxyModel(data),data:data};
    try{this.galaxyReference=GalaxyComparisonStore.save(this.directory(),value);this.galaxyReferenceShown=true;this.galaxyReferenceError='';this.notice='已保留星系结果 · 换参数后可叠加比较';}
    catch(e){this.galaxyReferenceError='保存星系参照失败 · '+String(e);throw new Error(this.galaxyReferenceError);}
  }
  private clearGalaxyReference():void {
    try{GalaxyComparisonStore.clear(this.directory());this.galaxyReference=undefined;this.galaxyReferenceError='';this.notice='已移除参照 · 当前星系实验保留';}
    catch(e){this.galaxyReferenceError='移除星系参照失败 · '+String(e);throw new Error(this.galaxyReferenceError);}
  }
  private seekGalaxyExtreme(maximum:boolean):void {
    const p=this.galaxyView();if(!p.available)throw new Error('暂无星系记录');
    simulation.seekGalaxyObservation(maximum?p.maxFrame:p.minFrame,this.galaxyObserved.sceneRevision,maximum?p.maxTime:p.minTime);this.playing=false;this.info=simulation.status();this.refreshObservation();this.notice='已定位保留记录的'+(maximum?'最大值':'最小值');
  }
  @State private placementBodies:OrbitBodyConfig[]=[];
  private placementRevision:number=0;
  @State private orbitDays:number=1;
  private changeOrbitClock(rate:number):void {simulation.orbitClock(rate);this.orbitDays=rate;this.info=simulation.status();if(this.preset===5&&(this.info.orbitState??[]).length!==this.orbitBodies.length){this.orbitBodies=copyOrbitBodies(this.info.orbitState??[]);this.orbitUndo=[];this.orbitRedo=[];this.focus=Math.min(this.focus,this.orbitBodies.length-1);this.selectOrbit(Math.min(this.orbitEdit,this.orbitBodies.length-1),true);this.surfaces=this.surfaces.slice(0,this.orbitBodies.length);this.syncSurfaces();}this.notice='持续演化 · 每秒 '+rate+' 个模拟日';}
  private placementPreview():PlacementPreview {return planPlanet(this.placementBodies,this.placementName,this.placementFields,this.placementSurface,this.placementDirection,this.placementScale,this.placementTarget,true,this.placementParent,this.placementUnits);}
  private placementLabels():string[] {return placementUnitLabels(this.placementUnits,this.placementSurface===0).slice(0,this.placementFields.length);}
  private placementDistanceAU():number {
    const n=this.placementFields[1]?.trim()===''?Number.NaN:Number(this.placementFields[1]);
    return this.placementUnits.distance==='au'?n:(n+(this.placementUnits.distance==='altitude'?(this.placementBodies[this.placementParent]?.radiusKm??0):0))/AU_KM;
  }
  private placementDistanceInput(au:number):string {
    return String(this.placementUnits.distance==='au'?au:au*AU_KM-(this.placementUnits.distance==='altitude'?(this.placementBodies[this.placementParent]?.radiusKm??0):0));
  }
  private changePlacementUnits(next:PlacementUnits):void {
    const canonical=placementCanonicalFields(this.placementFields,this.placementUnits,this.placementBodies,this.placementParent,this.placementSurface);
    const fields=placementFieldsInUnits(canonical,next,this.placementBodies,this.placementParent,this.placementSurface);
    this.placementFields=fields;this.placementUnits=next;
  }
  private setPlacementSpeedRatio(ratio:number):void {
    const draft=this.placementFields.map((v:string,i:number):string=>i===4?'0':v);
    const canonical=placementCanonicalFields(draft,this.placementUnits,this.placementBodies,this.placementParent,this.placementSurface);canonical[4]=String(ratio);
    const value=placementFieldsInUnits(canonical,this.placementUnits,this.placementBodies,this.placementParent,this.placementSurface)[4];
    this.placementFields=this.placementFields.map((v:string,i:number):string=>i===4?value:v);
  }
  private useSmallRock():void {
    const mass=sphereMass(7.5,2700)/SOLAR_MASS_KG;
    this.placementSurface=3;this.placementName='岩质小行星 · 直径 15 km';
    this.placementFields=this.placementFields.map((v:string,i:number):string=>i===0?String(this.placementUnits.mass==='kg'?mass*SOLAR_MASS_KG:mass/EARTH_MASS_SOLAR):i===5?String(this.placementUnits.size==='diameter'?15:7.5):v);
    this.notice='直径 15 km · 均匀密度 2700 kg/m³ · 保留当前距离和速度';
  }
  private beginPlacement(sourceIndex:number=-1):void {
    if(this.placing)return;
    const wasRunning=simulation.status().state==='running';
    simulation.freezeOrbit();this.info=simulation.status();
    this.placementBodies=copyOrbitBodies(this.info.orbitState??[]);this.placementRevision=this.info.orbitRevision??0;
    const copied=sourceIndex>=0?copiedPlanetDraft(this.placementBodies,sourceIndex,true):undefined;
    this.stopTrace();this.stopCameraMotion();this.placementView={yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:this.focus,color:this.colorMode};
    this.placementWasRunning=wasRunning;this.placementWasPlaying=this.playing;this.playing=false;if(this.placementWasRunning)simulation.pause(true);
    this.placementWasClose=this.closeup;this.placementWasSpin=this.autoSpin;this.placementWasPanel=this.panelOpen;this.placementWasTab=this.tab;
    this.placementSource=sourceIndex;
    this.placementSurfaceRecipe=sourceIndex>0?copySurfaces([this.surfaces[sourceIndex]])[0]:{version:1,seed:Date.now()%1000000+1,cloudSeed:(Date.now()+193939)%1000000+1};
    this.placementName=copied?copied.name:'新行星 '+this.placementBodies.length;
    this.placementUnits=defaultPlacementUnits();
    this.placementFields=copied?copied.fields:['1',String(2+this.placementBodies.length*.35),'45','0','1'];
    if(finiteOrbitBodies(this.placementBodies)&&this.placementFields.length===5)this.placementFields.push(String(estimatedOrbitRadius(Number(this.placementFields[0])*EARTH_MASS_SOLAR,false)));
    this.placementSurface=copied?copied.surface:1;this.placementDirection=1;this.placementTarget=-1;this.placementParent=0;this.placementPromotesContact=false;
    this.placementScale=planPlanet(this.placementBodies,this.placementName,this.placementFields,this.placementSurface,this.placementDirection,0,-1,true).plotScale;
    this.placing=true;this.closeup=false;this.autoSpin=false;this.focus=0;this.yaw=0;this.pitch=0;this.zoom=Math.min(15,Math.max(2.7,this.placementScale));this.camera();this.setPanel(-1);this.updatePlacementPreview();this.notice='在星图轻点或拖动放置 · 箭头表示相对恒星速度 · 当前时刻预览';
  }
  private beginLocalPlacement(mode:string):void {
    const parent=this.focus;
    if(parent<0||parent>=(this.info.orbitState??[]).length)throw new Error('先选中一颗天体');
    this.beginPlacement();this.placementParent=parent;
    this.placementPromotesContact=!finiteOrbitBodies(this.placementBodies);
    if(this.placementPromotesContact)this.placementBodies=this.placementBodies.map((b:OrbitBodyConfig):OrbitBodyConfig=>{const v=copyOrbitBodies([b])[0];v.radiusKm=estimatedOrbitRadius(v.massSolar,v.surface===0);return v;});
    const host=this.placementBodies[parent];
    const mass=Math.max(MIN_ORBIT_MASS_SOLAR/EARTH_MASS_SOLAR,Math.min(.0123,host.massSolar/EARTH_MASS_SOLAR*.0123));
    const radius=estimatedOrbitRadius(mass*EARTH_MASS_SOLAR,false);
    const distance=parent===0?.1:Math.max(.000001,(host.radiusKm!+radius)*5/AU_KM,host.radiusKm!*30/AU_KM);
    this.placementName=host.name+(mode==='satellite'?'的卫星':mode==='launch'?'的撞击体':'旁的小天体');
    this.placementFields=[String(mass),String(distance),'45','0',mode==='drop'?'0':mode==='launch'?'1.5':'1',String(radius)];
    this.placementSurface=mode==='satellite'?5:3;this.placementTarget=mode==='launch'?parent:-1;
    this.changePlacementUnits(physicalPlacementUnits());
    this.placementScale=distance*1.7;this.focus=parent;this.zoom=2.7;this.camera();this.updatePlacementPreview();
    this.notice='围绕 '+host.name+' 放置 · 继承母体速度 · '+(this.placementPromotesContact?'确认时按估算半径启用球体接触':'同一多体引力系统');
  }
  private placementParentName():string {return this.placementBodies[this.placementParent]?.name??'恒星';}
  private updatePlacementPreview():void {
    if(!this.placing)return;
    const p=this.placementPreview();this.syncSurfaces();
    simulation.setOrbitPlacement(p.valid&&p.body?copyOrbitBodies(this.placementBodies).concat([p.body]):copyOrbitBodies(this.placementBodies),p.valid?this.placementBodies.length:-1,this.placementParent,this.placementScale);
  }
  private moveViewportPlacement(x:number,y:number):void {
    if(!this.placing||this.ioBusy)throw new Error('当前未在放置行星');
    const p=simulation.placeOrbitAt(x,y,Number(this.placementFields[3]));
    this.placementFields=this.placementFields.map((v:string,i:number):string=>i===1?this.placementDistanceInput(p[0]):i===2?p[1].toFixed(6):v);
    this.updatePlacementPreview();
  }
  private dragViewportPlacement(e:GestureEvent):void {
    const f=e.fingerList[0];if(e.fingerList.length!==1||!f||this.viewportWidth<=0||this.viewportHeight<=0)return;
    try{this.moveViewportPlacement(f.localX/this.viewportWidth,f.localY/this.viewportHeight);}catch(error){this.notice=String(error);}
  }
  private cancelPlacement():void {
    simulation.setOrbitPlacement([],-1);
    this.placing=false;this.syncSurfaces();const view=this.placementView;this.placementView=undefined;
    if(view){this.stopCameraMotion();this.yaw=view.yaw;this.pitch=view.pitch;this.zoom=view.zoom;this.focus=view.focus;this.colorMode=view.color;this.closeup=this.placementWasClose;this.autoSpin=this.placementWasSpin;this.camera();}
    if(this.placementWasRunning)simulation.pause(false);this.playing=this.placementWasPlaying;
    this.setPanel(this.placementWasPanel?this.placementWasTab:-1);this.notice='已取消放置 · 原模拟与编辑草稿保留';
  }
  private confirmPlacement():void {
    const preview=this.placementPreview();if(!preview.valid||!preview.body)throw new Error(preview.error);
    simulation.insertOrbit(preview.body,this.placementRevision,this.placementWasRunning,this.placementPromotesContact);
    const bodies=copyOrbitBodies(this.placementBodies).concat([preview.body]);
    this.preset=5;this.speed=1;this.orbitBodies=bodies;this.orbitUndo=[];this.orbitRedo=[];
    this.surfaces=copySurfaces(this.surfaces.slice(0,bodies.length-1)).concat(copySurfaces([preview.body.surface===0||preview.body.surface===5?{version:1,seed:0,cloudSeed:0}:this.placementSurfaceRecipe]));
    simulation.setOrbitPlacement([],-1);this.placing=false;this.placementView=undefined;this.syncSurfaces();
    this.selectOrbit(bodies.length-1);this.dirty=false;this.info=simulation.status();this.setPanel(-1);
    if(this.placementParent>0){this.closeup=true;this.focus=this.placementParent;this.zoom=Math.min(15,Math.max(.5,this.placementScale/.0001));this.camera(.42,false,true);}
    this.notice='已在当前时刻加入 '+preview.body.name+' · 原有天体继续演化';
  }
  private movePlacement(x:number,y:number):void {
    if(!this.placing||this.ioBusy)throw new Error('当前未在放置行星');
    const point=placementPoint(x,y,this.placementPreview().plotScale,this.placementParent>0);
    this.placementFields=this.placementFields.map((v:string,i:number):string=>i===1?this.placementDistanceInput(point[0]):i===2?point[1].toFixed(2):v);this.updatePlacementPreview();
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
  private captureRecipe():ExperimentRecipe {
    const trace=simulation.ringTraceStatus(false);
    const recipe:ExperimentRecipe={schemaVersion:1,appearanceVersion:3,surfaces:copySurfaces(this.surfaces),material:this.materialState(),themeId:this.activeThemeId,
      camera:{yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:this.focus,color:this.colorMode},
      appearance:{clouds:this.clouds,atmosphere:this.atmosphere,trails:this.trails,closeup:this.closeup,autoSpin:this.autoSpin,rings:this.rings},
      sky:{mode:this.skyMode,brightness:this.skyBrightness},
      ring:trace.enabled?{enabled:true,target:trace.target,timeHours:trace.timeHours,speedScale:trace.speedScale,rateHours:trace.rateHours,modelVersion:2,impulse:trace.impulse,points:trace.points}:
        {enabled:false,target:-1,timeHours:0,speedScale:1,rateHours:1}};
    if(this.overviewCamera)recipe.overview={yaw:this.overviewCamera.yaw,pitch:this.overviewCamera.pitch,zoom:this.overviewCamera.zoom,focus:-1,color:this.overviewCamera.color};
    return recipe;
  }
  private restoreRecipe(recipe:ExperimentRecipe):void {
    this.surfaces=recipe.appearanceVersion===3?copySurfaces(recipe.surfaces!):legacySurfaces(this.preset===5?this.orbitBodies.length:0);this.surfaceUndo=[];this.surfaceRedo=[];this.syncSurfaces();
    this.applyMaterial(recipe.appearanceVersion===1?defaultMaterial():recipe.material!);
    const c=recipe.camera,a=recipe.appearance;
    this.yaw=c.yaw;this.pitch=c.pitch;this.zoom=c.zoom;this.focus=c.focus;this.colorMode=c.color;
    this.clouds=a.clouds;this.atmosphere=a.atmosphere;this.trails=a.trails;this.closeup=a.closeup;this.autoSpin=a.autoSpin;this.rings=a.rings;
    this.skyMode=recipe.sky.mode;this.skyBrightness=recipe.sky.brightness;
    const overview=recipe.overview;
    this.overviewCamera=overview?{yaw:overview.yaw,pitch:overview.pitch,zoom:overview.zoom,focus:-1,color:overview.color}:undefined;
    this.activeThemeId=this.themes.some((t:ThemeExperiment):boolean=>t.id===recipe.themeId)?recipe.themeId:'';
    if(this.preset===5&&this.focus>=0)this.selectOrbit(this.focus);
    this.camera();
    if(recipe.ring.enabled){
      const t=recipe.ring;
      simulation.configureRingTrace(true,false,t.target,this.orbitBodies[t.target].massSolar);
      simulation.setRingParameters(t.speedScale,t.rateHours);simulation.setRingDisturbance(t.impulse??0,t.points??false);simulation.seekRingTrace(t.timeHours*3600);
      this.trace=simulation.ringTraceStatus(false);
    }
  }
  private saveProject(title: string): SavedProject {
    if(this.info.impact?.local)throw new Error('局部撞击请保存回放；普通配方不含入射上下文');
    const scene: SceneDefinition=this.definition();scene.title=validName(title);
    const saved: SavedProject=ProjectStore.save(this.directory(),scene,this.captureRecipe());
    this.title=scene.title;this.refreshProjects();this.notice='已保存实验与观察设置 · '+scene.title;
    return saved;
  }
  private openProject(id: string): void {
    const p: SavedProject=ProjectStore.load(this.directory(),id);
    validateScene(p.scene);
    const recipe:ExperimentRecipe=p.recipe??defaultRecipe(p.scene);validateRecipe(recipe,p.scene);
    // Validate the complete document and let native accept before changing UI state.
    simulation.startScene(p.scene.config,true);simulation.pause(true);
    this.applyConfig(p.scene.config);this.stopCameraMotion();this.overviewCamera=undefined;
    this.placing=false;this.placementView=undefined;this.playing=false;this.selectingPreset=false;
    this.title=p.scene.title;
    this.targetName=p.scene.bodies.length>0?p.scene.bodies[0].name:'恒星';this.impactorName=p.scene.bodies.length>1?p.scene.bodies[1].name:'撞击体';
    this.dirty=false;this.restoreRecipe(recipe);this.info=simulation.status();
    this.notice=p.recipe?'已恢复实验与观察设置 · 当前暂停，主系统从初始条件开始':'旧版实验已载入 · 使用默认外观与全景，点击开始重新计算';
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
        this.clearOrbitHistory();this.orbitDays=this.info.daysPerSecond??1;
        if(this.info.config) {this.applyConfig(this.info.config,(this.info.orbitState??[]).length>0);this.title='历史回放';this.targetName='主天体';this.impactorName='撞击体';this.dirty=false;this.camera();this.notice='回放已载入 · 求解参数已恢复';}
        else {if(this.isOrbit()){this.preset=0;this.speed=5;this.duration=60;this.title='旧版碰撞回放';this.closeup=false;this.autoSpin=false;this.camera();}this.notice='旧版回放 · 原始参数未知，开始实验将使用当前参数';}
      }
    } catch (_) { this.notice = '回放文件读写失败'; }
    finally { this.ioBusy = false; }
  }
  onBackPress(): boolean {
    if(this.videoPreview){this.videoPreview=false;return true;}
    if(this.videoOpen){this.videoOpen=false;return true;}
    if(this.observerMode>0){this.changeGalaxyObserver(0);return true;}
    if(this.galaxyPlacing){this.cancelGalaxyPlacement();return true;}
    if(this.placing){this.cancelPlacement();return true;}
    if(this.panelOpen) {this.setPanel(-1);return true;}
    if(simulation.renderStatus().fragmentFollow.active){simulation.clearSphFragmentFollow();return true;}
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
    if(value===1)this.refreshObservation();
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
    this.info=simulation.status();this.syncImpactView();
    const snapshot: AppSnapshot = {video:this.videoState,galaxyObserver:simulation.galaxyObserverStatus(),galaxyPlacement:this.galaxyPlacementState(),surfaces:copySurfaces(this.surfaces),surfaceUndoCount:this.surfaceUndo.length,surfaceRedoCount:this.surfaceRedo.length,ringTrace:simulation.ringTraceStatus(false),theme:this.themeState(),placement:{units:this.placementUnits,labels:this.placementLabels(),parent:this.placementParent,promotesContact:this.placementPromotesContact,target:this.placementTarget,sourceIndex:this.placing?this.placementSource:-1,sourceName:this.placing&&this.placementSource>0?this.orbitBodies[this.placementSource].name:'',active:this.placing,name:this.placementName,fields:this.placementFields.slice(),surface:this.placementSurface,direction:this.placementDirection,preview:this.placementPreview()},sky:{mode:this.skyMode,brightness:this.skyBrightness,reference:this.observerMode>0?'galaxy-tracer-observer':this.rendering.panoramaReady?'photographic-panorama':'procedural-fallback'},ok:true,protocol:1,definition:this.definition(),editor:this.editorState(),
      material:this.materialState(),appearance:{clouds:this.clouds,atmosphere:this.atmosphere,trails:this.trails,closeup:this.closeup,autoSpin:this.autoSpin,rings:this.rings},rendering:simulation.renderStatus(),
      simulation:this.info,
      scene:{preset:this.preset,count:this.count,speed:this.speed,angle:this.angle,duration:this.duration,dirty:this.dirty},
      camera:{yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,focus:this.focus,color:this.colorMode},
      cameraMotion:simulation.getCameraMotion(0),
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
    this.syncVideo();this.refreshObservation();this.rendering=simulation.renderStatus();
    const a:UiActionInfo[]=[];
    const add=(id:string,label:string,enabled:boolean=true,selected:boolean=false):void=>{a.push({id:id,label:label,enabled:enabled&&!this.ioBusy,selected:selected});};
    add('panel.parameters','参数',true,this.panelOpen&&this.tab===0);add('panel.observe','观察',true,this.panelOpen&&this.tab===1);add('panel.library','实验库',true,this.panelOpen&&this.tab===2);
    add('panel.close','收起');add('ui.focus','专注');add('ui.restore','显示工具');add('ui.back','返回',this.videoOpen||this.videoPreview||this.observerMode>0||this.galaxyPlacing||this.panelOpen||this.closeup||this.focus>=0||!this.toolsVisible||this.rendering.fragmentFollow.active);
    for(const t of this.themes)add('theme.'+t.id,t.title,true,this.activeThemeId===t.id);
    add('theme.restore','恢复主题初始条件',this.activeThemeId!=='');
    add('theme.compare','切换对照实验',this.themeState().compareId!=='');
    add('theme.observe',this.preset===2?'查看岩球曲线':'查看碰撞曲线',this.activeThemeId!==''&&this.preset<3);
    add('library.collision','碰撞',true,this.librarySection==='collision');add('library.explore','探索',true,this.librarySection==='explore');add('library.saved','我的实验',true,this.librarySection==='saved');
    add('presets.show','切换实验',this.preset===5);
    for(let i=0;i<this.experiments.length;i++)add('preset.'+i,this.experiments[i].title,true,this.preset===i);
    for(const rate of [.01,.1,1,10,100])add('time.rate.'+rate,rate+' 天/秒',this.isOrbit()&&this.info.frames>0,this.orbitDays===rate);
    add('simulation.toggle',this.simulationLabel(),this.info.state!=='preparing');add('simulation.apply','应用参数 · 重新生成');
    add('simulation.cancel','停止实验',['preparing','running','paused'].includes(this.info.state));
    add('replay.toggle',this.playing?'暂停回放':'播放回放',this.info.frames>1,this.playing);add('replay.latest','最新',this.info.frames>0);
    add('replay.save','保存回放',this.info.frames>0);add('replay.load','载入回放');
    add('video.open','视频',!this.placing&&!this.galaxyPlacing);
    add('video.close','返回星图',true);add('video.reload','刷新视频',!this.videoBusy());
    add('video.start','开始录制',!this.videoBusy()&&this.appForeground&&this.rendering.ready);
    add('video.stop','停止录制',this.videoState.state==='recording');
    add('video.preview','预览视频',!this.videoBusy()&&this.videoState.selectedId!=='');
    add('video.preview.close','关闭预览',this.videoPreview);
    add('video.export','导出 MP4',!this.videoBusy()&&this.videoState.selectedId!=='');
    add('video.quality.1280','标准 · 长边 1280',!this.videoBusy(),this.videoQuality===1280);
    add('video.quality.1920','高清 · 长边 1920',!this.videoBusy(),this.videoQuality===1920);
    for(const clip of this.videoState.clips)add('video.select.'+clip.id,'选择视频 · '+clip.name,!this.videoBusy(),this.videoState.selectedId===clip.id);
    add('project.save','另存实验');add('project.open','打开实验库');
    for(const project of this.projects)add('project.load.'+project.id,'载入实验 · '+project.scene.title);
    add('surface.toggle',this.closeup?'返回轨道':'近看行星',this.isOrbit(),this.closeup);
    add('selection.edit','编辑这颗天体',this.preset===5&&this.focus>=0);
    add('surface.previous','上一颗',this.preset===5&&this.closeup);add('surface.next','下一颗',this.preset===5&&this.closeup);
    for(let i=0;i<=this.maxFocus();i++){add('focus.'+i,'跟踪天体 '+i,true,this.focus===i);if(this.isOrbit())add('surface.'+i,'近看天体 '+i,true,this.closeup&&this.focus===i);}
    add('orbit.plane.xy','XY 平面',this.preset===5,this.vectorPlane==='XY');add('orbit.plane.xz','XZ 平面',this.preset===5,this.vectorPlane==='XZ');
    add('sky.mode.0','纯净',true,this.skyMode===0);add('sky.mode.1','星空',true,this.skyMode===1);add('sky.mode.2','银河',true,this.skyMode===2);
    const motion:CameraMotionStatus=simulation.getCameraMotion(0);add('camera.cancel','停在这里',motion.state==='queued'||motion.state==='running');
    add('focus.all','全景');add('camera.out','拉远');add('camera.in','拉近');add('camera.reset','复位视角');
    add('color.0','原色',true,this.colorMode===0);add('color.1','速度',true,this.colorMode===1);add('color.2','密度',this.preset<3,this.colorMode===2);
    add('trace.disturb','局部扰动',this.trace.enabled,this.trace.impulse>0);add('trace.clear','清除扰动',this.trace.enabled);add('trace.points','显示环颗粒',this.trace.enabled,this.trace.points);
    add('trace.controls','调整局部轨道',this.trace.enabled);add('trace.circular','圆轨道对照',this.trace.enabled);add('trace.ellipse','拉长轨道',this.trace.enabled);add('trace.apoapsis','跳到内圈远点',this.trace.enabled&&this.trace.innerPeriodHours/2<=24);
    add('trace.toggle','启用动态环带',this.canTrace()||this.trace.enabled,this.trace.enabled);add('trace.play',this.trace.running?'暂停环时钟':'运行环时钟',this.trace.enabled,this.trace.running);add('trace.reset','环时钟归零',this.trace.enabled);
    for(const metric of ['pressure','internal','damage','kinetic','energy','gravity','relativeKinetic','radius','radial'])add('sph.metric.'+metric,sphMetricLabel(metric),this.preset<3&&(sphMetricIndex(metric)<10||this.info.sph?.structure!==undefined),this.sphMetric===metric);
    add('sph.minimum','SPH 记录最小',this.preset<3&&this.sphView().available);add('sph.maximum','SPH 记录最大',this.preset<3&&this.sphView().available);
    add('fragments.largest','跟随最大团块',this.fragments.available);
    add('fragments.stop','停止团块跟随',this.rendering.fragmentFollow.active);
    for(const g of this.fragments.groups)add('fragments.follow.'+g.anchor,'跟随第 '+g.rank+' 团',this.fragments.available,this.rendering.fragmentFollow.active&&this.rendering.fragmentFollow.anchor===g.anchor);
    add('color.7','热软化外观',this.preset<3&&this.info.sph?.response!==undefined,this.colorMode===7);add('color.8','剩余强度',this.preset<3&&this.info.sph?.response!==undefined,this.colorMode===8);
    add('color.6','材料团块',this.preset<3&&this.fragments.available,this.colorMode===6);
    add('fragments.previous','上一组团块',this.fragments.available&&this.fragmentOffset>0);add('fragments.next','下一组团块',this.fragments.available&&(this.fragments.nextOffset??-1)>=0);
    add('color.3','压力',this.preset<3&&this.info.sph?.available===true,this.colorMode===3);add('color.4','比内能',this.preset<3&&this.info.sph?.available===true,this.colorMode===4);add('color.5','材料损伤',this.preset<3&&this.info.sph?.available===true,this.colorMode===5);
    add('sph.reference.capture',this.sphReference?'替换 SPH 参照':'保存 SPH 参照',this.info.config!==undefined&&this.info.config.preset<3&&this.sphObserved.samples.length>=2);
    add('sph.reference.toggle',this.sphReferenceShown?'隐藏 SPH 参照':'显示 SPH 参照',this.sphReference!==undefined,this.sphReferenceShown);
    add('sph.reference.clear','移除 SPH 参照',this.sphReference!==undefined||this.sphReferenceError!=='');add('sph.reference.reload','重读 SPH 参照',true);
    add('comparison.capture',this.comparisonReference?'替换参照':'保存作参照',this.isOrbit()&&this.observed.samples.length>=2);
    add('comparison.toggle',this.comparisonShown?'隐藏参照':'显示参照',this.comparisonReference!==undefined,this.comparisonShown);
    add('comparison.clear','移除参照',this.comparisonReference!==undefined||this.comparisonError!=='');add('comparison.reload','重试读取',this.comparisonError!=='');
    add('observation.distance','距恒星',this.isOrbit(),this.observationMetric==='distance');add('observation.speed','速度',this.isOrbit(),this.observationMetric==='speed');
    add('observation.minimum','记录最小',this.isOrbit()&&this.observationView().available);add('observation.maximum','记录最大',this.isOrbit()&&this.observationView().available);
    add('moon.retry','重试月面贴图',!!(this.moonLoadError||this.rendering.moonError));
    add('material.ocean','海洋反光',this.isOrbit(),this.ocean);add('material.cloudShadows','云影',this.isOrbit(),this.cloudShadows);add('material.reset','还原光照',this.isOrbit());
    add('terrain.new','新地貌',this.canGenerateSurface());add('terrain.clouds','换云层',this.canGenerateSurface());
    add('terrain.undo','撤销外观',this.preset===5&&!this.placing&&this.surfaceUndo.length>0);add('terrain.redo','重做外观',this.preset===5&&!this.placing&&this.surfaceRedo.length>0);
    add('appearance.rings','环带',this.isOrbit(),this.rings);add('appearance.clouds','云层',this.isOrbit(),this.clouds);add('appearance.atmosphere','大气',this.isOrbit(),this.atmosphere);add('appearance.trails','轨迹',this.isOrbit(),this.trails);add('appearance.spin','外观自转',this.isOrbit(),this.autoSpin);
    for(const seconds of [0,16,64])add('scene.relax.'+seconds,seconds===0?'直接生成':'预松弛 '+seconds+' 秒',this.preset<3&&(seconds===0||(this.selfGravity&&this.initialEnergyMJkg===0&&this.initialDamage===0)),this.relaxationSeconds===seconds);
    add('galaxy.place','在星图调整相遇',this.preset===6&&this.info.frames>0&&this.info.state!=='preparing');
    add('galaxy.place.cancel','取消相遇调整',this.galaxyPlacing);add('galaxy.place.confirm','确认相遇初态',this.galaxyPlacing);
    const observer:GalaxyObserverStatus=simulation.galaxyObserverStatus();
    add('galaxy.observer.space','太阳位置观测',observer.available&&!this.galaxyPlacing,this.observerMode===1);
    add('galaxy.observer.ground','地表天空示意',observer.available&&!this.galaxyPlacing,this.observerMode===2);
    add('galaxy.observer.exit','回到外部',this.observerMode>0);
    add('galaxy.observer.primary','看主星系中心',this.observerMode>0);add('galaxy.observer.secondary','看来访星系',this.observerMode>0);
    add('galaxy.reference.capture',this.galaxyReference?'替换星系参照':'保存星系参照',this.galaxyObserved.available&&this.galaxyObserved.samples.length>=2);
    add('galaxy.reference.toggle',this.galaxyReferenceShown?'隐藏星系参照':'显示星系参照',this.galaxyReference!==undefined,this.galaxyReferenceShown);
    add('galaxy.reference.clear','移除星系参照',this.galaxyReference!==undefined||this.galaxyReferenceError!=='');add('galaxy.reference.reload','重读星系参照',true);
    for(let i=0;i<5;i++)add('galaxy.metric.'+i,GALAXY_METRICS[i],this.preset===6,this.galaxyMetric===i);
    add('galaxy.minimum','记录最小',this.preset===6&&this.galaxyView().available);add('galaxy.maximum','记录最大',this.preset===6&&this.galaxyView().available);
    add('galaxy.responsive','恒星参与引力',this.preset===6,this.galaxyResponsive);
    add('galaxy.retrograde','反转次星系旋转',this.preset===6,this.galaxyRetrograde);
    add('scene.stationary','设为静止初态',this.preset===2,this.speed===0&&this.targetSpin===0);
    add('scene.gravity','材料自引力',this.preset<3&&this.count<=1200,this.selfGravity);
    add('body.primary','主天体',this.preset<3,this.editedBody===0);add('body.impactor','撞击体',this.preset<2,this.editedBody===1);
    add('placement.options','放置参数',this.placing,this.panelOpen);add('placement.align','正对轨道面',this.placing&&Number.isFinite(Number(this.placementFields[3])));
    for(let i=0;i<this.placementBodies.length;i++)add('placement.target.'+i,'瞄准 '+this.placementBodies[i].name,this.placing,this.placementTarget===i);
    add('placement.cancel','取消放置',this.placing);add('placement.confirm','在当前时刻加入',this.placing&&this.placementPreview().valid);
    add('placement.circular','圆轨道',this.placing);add('placement.still','相对静止',this.placing);add('placement.escape','掠过',this.placing);add('placement.reverse','反向',this.placing,this.placementDirection===-1);
    add('placement.units.physical','公斤 / 公里 / 秒',this.placing&&finiteOrbitBodies(this.placementBodies),this.placementUnits.mass==='kg');
    add('placement.units.astro','天文单位',this.placing,this.placementUnits.mass==='astronomical');
    add('placement.units.center','距母体中心',this.placing&&finiteOrbitBodies(this.placementBodies),this.placementUnits.distance==='km');
    add('placement.units.altitude','距母体表面',this.placing&&finiteOrbitBodies(this.placementBodies),this.placementUnits.distance==='altitude');
    add('placement.units.radius','半径',this.placing&&finiteOrbitBodies(this.placementBodies),this.placementUnits.size==='radius');
    add('placement.units.diameter','直径',this.placing&&finiteOrbitBodies(this.placementBodies),this.placementUnits.size==='diameter');
    add('placement.rock','15 km 岩质小行星',this.placing&&finiteOrbitBodies(this.placementBodies));
    for(let i=0;i<=5;i++)add('placement.surface.'+i,['恒星','海洋','厚云','荒漠','带环','月面'][i],this.placing,this.placementSurface===i);
    for(const mode of ['satellite','launch','drop'])add('selection.'+mode,mode==='satellite'?'添加卫星':mode==='launch'?'向它发射':'附近投放',this.isOrbit()&&this.focus>=0&&this.focus<(this.info.orbitState??[]).length&&(this.info.orbitState??[]).length<8);
    add('orbit.contact','启用球体接触',this.preset===5&&!this.contactMode());add('orbit.contact.demo','球体接触实验',this.preset===5);add('orbit.impact.demo','小岩体撞击初值',this.preset===5);add('impact.inspect','查看撞击初值',this.contactMode());add('impact.simulate','模拟这次撞击',this.contactMode()&&this.info.state==='paused'&&this.info.selected<0&&this.info.contact?.incoming?.withinCurrentBounds===true&&!this.dirty&&!this.orbitDraft&&!this.trace.enabled&&this.orbitDrafts.length===0&&this.orbitUndo.length===0&&this.orbitRedo.length===0);add('impact.return','返回轨道',this.info.impact?.canReturn===true);
    add('orbit.copy','复制并放置',this.preset===5&&this.orbitEdit>0&&this.orbitBodies.length<8);
    add('orbit.add','加入天体',this.isOrbit()&&(this.info.orbitState??[]).length>=2&&(this.info.orbitState??[]).length<8);add('orbit.remove','删除天体',this.preset===5&&this.orbitEdit>0&&this.orbitBodies.length>2);
    add('orbit.undo','撤销天体编辑',this.preset===5&&this.orbitUndo.length>0);add('orbit.redo','重做天体编辑',this.preset===5&&this.orbitRedo.length>0);
    add('orbit.discard','还原当前输入',this.preset===5&&this.orbitDraft);
    add('orbit.apply','应用天体 · 重新生成',this.preset===5&&this.orbitDraft);add('orbit.near','近看这颗天体',this.preset===5);
    if(this.preset===5)for(let i=0;i<this.orbitBodies.length;i++)add('orbit.select.'+i,this.orbitBodies[i].name,true,this.orbitEdit===i);
    for(let i=1;i<=5;i++)add('orbit.surface.'+i,['海洋','厚云','荒漠','带环','月面'][i-1],this.preset===5&&this.orbitEdit>0,this.orbitSurface===i);
    if(this.observerMode>0)for(const action of a)if(['focus.','camera.','color.','sky.'].some((prefix:string):boolean=>action.id.startsWith(prefix)))action.enabled=false;
    if(this.galaxyPlacing)for(const action of a)if(!action.id.startsWith('galaxy.place.')&&action.id!=='ui.back')action.enabled=false;
    if(this.placing)for(const action of a)if(!action.id.startsWith('placement.')&&action.id!=='ui.back'&&action.id!=='panel.close')action.enabled=false;
    if(this.info.impact?.canReturn||this.info.impact?.local)for(const action of a)if(!this.localImpactActionAllowed(action.id))action.enabled=false;
    return a;
  }
  private uiFields():UiFieldInfo[] {
    const active:boolean=!this.ioBusy,rock:boolean=this.preset<3;
    const fields:UiFieldInfo[]=[{field:'scene.energy',value:this.initialEnergyMJkg,enabled:active&&rock&&this.relaxationSeconds===0},{field:'scene.damage',value:this.initialDamage,enabled:active&&rock&&this.relaxationSeconds===0},{field:'galaxy.ratio',value:this.galaxyMassRatio,enabled:active&&this.preset===6},{field:'galaxy.offset',value:this.galaxyOffsetKpc,enabled:active&&this.preset===6},{field:'trace.impulse',value:this.trace.impulse,enabled:active&&this.trace.enabled},{field:'material.exposure',value:this.exposure,enabled:active&&this.isOrbit()},{field:'trace.speed',value:this.trace.speedScale,enabled:active&&this.trace.enabled},{field:'trace.rate',value:this.trace.rateHours,enabled:active&&this.trace.enabled},{field:'trace.hours',value:this.trace.timeHours,enabled:active&&this.trace.enabled},{field:'sky.brightness',value:this.skyBrightness*100,enabled:active&&this.observerMode===0},{field:'scene.title',value:this.title,enabled:active},
      {field:'scene.count',value:this.count,enabled:active&&(rock||this.preset===6)},{field:'scene.speed',value:this.speed,enabled:active&&this.preset!==5},
      {field:'scene.angle',value:this.angle,enabled:active&&(this.preset<2||this.preset===6)},{field:'scene.duration',value:this.duration,enabled:active},
      {field:'body.name',value:this.editedBody===0?this.targetName:this.impactorName,enabled:active&&rock},
      {field:'body.radius',value:this.editedBody===0?this.targetRadiusKm:this.impactorRadiusKm,enabled:active&&rock},
      {field:'body.density',value:this.editedBody===0?this.targetDensity:this.impactorDensity,enabled:active&&rock},
      {field:'body.spin',value:this.targetSpin,enabled:active&&rock&&this.editedBody===0},
      {field:'orbit.name',value:this.orbitName,enabled:active&&this.preset===5},
      {field:'time.frame',value:this.info.selected,enabled:active&&this.info.frames>1}];
    for(let i=0;i<(this.contactMode()?8:7);i++)fields.push({field:'orbit.value.'+i,value:this.orbitFields[i],enabled:active&&this.preset===5});
    if(this.placing)for(const f of fields)f.enabled=false;
    if(this.galaxyPlacing)for(const f of fields)f.enabled=false;
    fields.push({field:'galaxy.placement.offset',value:this.galaxyPlacementOffset,enabled:active&&this.galaxyPlacing});
    fields.push({field:'placement.name',value:this.placementName,enabled:active&&this.placing});
    for(let i=0;i<(finiteOrbitBodies(this.placementBodies)?6:5);i++)fields.push({field:'placement.value.'+i,value:this.placementFields[i],enabled:active&&this.placing});
    for(const field of ['yaw','pitch','fov','latitude','sidereal'])fields.push({field:'galaxy.observer.'+field,value:field==='yaw'?this.observerYaw:field==='pitch'?this.observerPitch:field==='latitude'?this.observerLatitude:field==='sidereal'?this.observerSidereal:this.observerFov,enabled:active&&this.observerMode>0&&!this.galaxyPlacing});
    if(this.info.impact?.canReturn||this.info.impact?.local)for(const f of fields)if(!['time.frame','sky.brightness'].includes(f.field))f.enabled=false;
    return fields;
  }
  private setUiValue(field:string,value:string|number):void {
    this.info=simulation.status();this.observerMode=simulation.galaxyObserverStatus().mode;const descriptor=this.uiFields().find((f:UiFieldInfo):boolean=>f.field===field);
    if(!descriptor||!descriptor.enabled)throw new Error('Field unavailable: '+field);
    // ArkUI can echo programmatic text updates through onChange. Only a changed value is an edit.
    if(value===descriptor.value)return;
    if(field==='galaxy.placement.offset'){if(typeof value!=='number')throw new Error('需要数值');this.galaxyPlacementOffset=this.checked(value,0,30);this.updateGalaxyPlacement();return;}
    if(field.startsWith('placement.')){
      if(typeof value!=='string'||value.length>48)throw new Error('Expected bounded text');
      if(field==='placement.name')this.placementName=value;else{const index=Number(field.slice(16));this.placementFields=this.placementFields.map((v:string,i:number):string=>i===index?value:v);if(index===1&&Number.isFinite(this.placementDistanceAU()))this.placementScale=this.placementParent>0?Math.max(.000001,Math.min(13,this.placementDistanceAU()*1.7)):Math.max(this.placementScale,Math.min(13,this.placementDistanceAU()*1.3));}
      this.updatePlacementPreview();return;
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
    if(field.startsWith('galaxy.observer.')){
      if(field==='galaxy.observer.yaw')this.observerYaw=this.checked(value,-100,100);
      else if(field==='galaxy.observer.pitch')this.observerPitch=this.checked(value,-1.5,1.5);
      else if(field==='galaxy.observer.latitude')this.observerLatitude=this.checked(value,-90,90);
      else if(field==='galaxy.observer.sidereal')this.observerSidereal=this.checked(value,0,24);
      else this.observerFov=this.checked(value,35,120);
      this.updateGalaxyObserver();return;
    }
    if(field==='trace.impulse'){this.ringDisturbance(value);return;}
    if(field==='trace.speed'||field==='trace.rate'){this.traceParameter(field,value);return;}
    if(field==='trace.hours'){this.traceTime(value);return;}
    if(field==='material.exposure'){this.changeMaterial({exposure:value});return;}
    if(field==='sky.brightness'){this.checked(value,0,100);this.changeSky(this.skyMode,value/100);return;}
    if(field==='time.frame'){this.checked(value,-1,this.info.frames-1,true);this.stopTrace();this.playing=false;simulation.seek(value);this.info=simulation.status();return;}
    if(field==='scene.energy'){this.checked(value,0,6.8);this.initialEnergyMJkg=value;}
    else if(field==='scene.damage'){this.checked(value,0,1);this.initialDamage=value;}
    else if(field==='scene.count'){this.checked(value,200,this.preset===6&&this.galaxyResponsive?800:(this.selfGravity?1200:2400),true);this.count=value;}
    else if(field==='scene.speed'){this.checked(value,this.preset>=3?.75:(this.preset===2?0:.5),this.preset>=3?1.25:10);this.speed=value;}
    else if(field==='scene.angle'){this.checked(value,0,70);this.angle=value;}
    else if(field==='scene.duration'){this.checked(value,this.preset===6?50:1,this.preset===6?800:(this.isOrbit()?10:120));this.duration=value;}
    else if(field==='galaxy.ratio'){this.checked(value,.2,1);this.galaxyMassRatio=value;}
    else if(field==='galaxy.offset'){this.checked(value,0,30);this.galaxyOffsetKpc=value;}
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
    if(action==='video.open'){this.videos();this.syncVideo();this.videoOpen=true;}
    else if(action==='video.reload'){this.videos().reload();this.syncVideo();}
    else if(action==='video.close'){this.videoOpen=false;this.videoPreview=false;}
    else if(action==='video.preview.close')this.videoPreview=false;
    else if(action==='video.start'){
      this.videoPreview=false;this.setPanel(-1);
      try{await this.videos().start(this.windowGeometry.widthPx,this.windowGeometry.heightPx,this.videoQuality);this.videoOpen=false;}finally{this.syncVideo();}
    }
    else if(action==='video.stop'){try{await this.videos().stop();this.videoOpen=true;}finally{this.syncVideo();}}
    else if(action==='video.preview'){this.videoUri=this.videos().previewUri();this.videoPreviewReady=false;this.videoPreviewError='';this.videoPreview=true;}
    else if(action==='video.export'){try{await this.videos().exportSelected();}finally{this.syncVideo();}}
    else if(action.startsWith('video.select.')){this.videos().select(action.slice(13));this.videoPreview=false;this.syncVideo();}
    else if(action.startsWith('video.quality.'))this.videoQuality=Number(action.slice(14));
    else if(action==='panel.parameters')this.togglePanel(0);
    else if(action==='panel.observe')this.togglePanel(1);
    else if(action==='panel.library'){this.refreshProjects();this.togglePanel(2);}
    else if(action==='panel.close'){if(this.placing)this.cancelPlacement();else this.setPanel(-1);}
    else if(action==='ui.focus')this.setTools(false);
    else if(action==='ui.restore')this.setTools(true);
    else if(action==='ui.back')this.onBackPress();
    else if(action==='presets.show')this.selectingPreset=true;
    else if(action==='theme.restore')this.chooseTheme(this.activeThemeId);
    else if(action==='theme.compare')this.chooseTheme(this.themeState().compareId);
    else if(action==='theme.observe'){this.sphMetric='pressure';this.refreshObservation();this.setPanel(1);}
    else if(action.startsWith('theme.'))this.chooseTheme(action.slice(6));
    else if(action.startsWith('library.')){this.librarySection=action.slice(8);this.scroller.scrollEdge(Edge.Top);}
    else if(action.startsWith('preset.'))this.choose(Number(action.slice(7)));
    else if(action==='galaxy.observer.space')this.changeGalaxyObserver(1);
    else if(action==='galaxy.observer.ground')this.changeGalaxyObserver(2);
    else if(action==='galaxy.observer.exit')this.changeGalaxyObserver(0);
    else if(action==='galaxy.observer.primary')this.aimGalaxyObserver(false);
    else if(action==='galaxy.observer.secondary')this.aimGalaxyObserver(true);
    else if(action==='galaxy.place')this.beginGalaxyPlacement();
    else if(action==='galaxy.place.cancel')this.cancelGalaxyPlacement();
    else if(action==='galaxy.place.confirm')this.confirmGalaxyPlacement();
    else if(action==='galaxy.reference.capture')this.captureGalaxyReference();
    else if(action==='galaxy.reference.toggle')this.galaxyReferenceShown=!this.galaxyReferenceShown;
    else if(action==='galaxy.reference.clear')this.clearGalaxyReference();
    else if(action==='galaxy.reference.reload'){this.reloadGalaxyReference();if(this.galaxyReferenceError!=='')throw new Error(this.galaxyReferenceError);}
    else if(action.startsWith('galaxy.metric.')){this.galaxyMetric=Number(action.slice(14));this.refreshObservation();}
    else if(action==='galaxy.minimum'||action==='galaxy.maximum')this.seekGalaxyExtreme(action==='galaxy.maximum');
    else if(action==='galaxy.responsive'){this.galaxyResponsive=!this.galaxyResponsive;if(this.galaxyResponsive&&this.count>800){this.count=800;this.notice='双向引力暂限 800 个恒星群；应用后生效';}this.dirty=true;}
    else if(action==='galaxy.retrograde'){this.galaxyRetrograde=!this.galaxyRetrograde;this.dirty=true;}
    else if(action==='scene.stationary'){this.speed=0;this.targetSpin=0;this.dirty=true;}
    else if(action==='scene.gravity'){this.selfGravity=!this.selfGravity;if(!this.selfGravity)this.relaxationSeconds=0;this.dirty=true;}
    else if(action.startsWith('scene.relax.')){this.relaxationSeconds=Number(action.slice('scene.relax.'.length));this.dirty=true;}
    else if(action.startsWith('time.rate.'))this.changeOrbitClock(Number(action.slice(10)));
    else if(action==='simulation.toggle'){this.run();this.setPanel(-1);}
    else if(action==='simulation.apply'){if(!this.prepare(false))throw new Error(this.notice);this.setPanel(-1);}
    else if(action==='simulation.cancel'){this.cancelSimulation();}
    else if(action==='replay.toggle'){this.stopTrace();if(this.playing)this.playing=false;else {simulation.pause(true);if(this.info.selected<0||this.info.selected>=this.info.frames-1)simulation.seek(0);this.playing=true;}}
    else if(action==='replay.latest'){this.stopTrace();this.playing=false;simulation.seek(-1);}
    else if(action==='replay.save'||action==='replay.load'){await this.replayIO(action==='replay.load');if(!this.lastIOOk)throw new Error(this.notice);}
    else if(action==='project.save')this.saveProject(this.title);
    else if(action==='project.open'){this.refreshProjects();this.setPanel(2);}
    else if(action.startsWith('project.load.')){this.openProject(action.slice(13));this.setPanel(-1);}
    else if(action==='surface.toggle'){if(this.closeup)this.closeSurface();else this.openSurface(this.focus<0?1:this.focus);}
    else if(action==='surface.previous')this.openSurface((this.focus+this.orbitBodies.length-1)%this.orbitBodies.length);
    else if(action==='surface.next')this.openSurface((this.focus+1)%this.orbitBodies.length);
    else if(action.startsWith('surface.'))this.openSurface(Number(action.slice(8)));
    else if(action==='focus.all'){simulation.clearSphFragmentFollow();this.closeSurface();}
    else if(action.startsWith('focus.'))this.focusBody(Number(action.slice(6)));
    else if(action==='selection.edit'){this.selectOrbit(this.focus);this.setPanel(0);this.notice='编辑初始条件 · 关闭面板或切换天体会保留草稿';}
    else if(action==='camera.cancel'){this.stopCameraMotion();this.notice='已停止镜头过渡 · 可继续拖动或重新近看';}
    else if(action==='camera.out')this.easeCamera(this.yaw,this.pitch,Math.min(15,this.zoom*1.2));
    else if(action==='camera.in')this.easeCamera(this.yaw,this.pitch,Math.max(.5,this.zoom/1.2));
    else if(action==='camera.reset'){simulation.clearSphFragmentFollow();this.closeSurface();this.easeCamera(.15,.25,this.preset===6?5.2:2.7);}
    else if(action==='fragments.largest'){const first=simulation.sphFragments(0,1);if(!first.available||!first.groups.length)throw new Error('材料团块暂不可用');this.beginFragmentFollow(first.groups[0].anchor,first.sceneRevision);}
    else if(action==='fragments.stop'){simulation.clearSphFragmentFollow();this.notice='已停止团块跟随 · 返回原观察中心';}
    else if(action.startsWith('fragments.follow.'))this.beginFragmentFollow(Number(action.slice(17)),this.fragments.sceneRevision);
    else if(action==='fragments.previous'){this.fragmentOffset=Math.max(0,this.fragmentOffset-8);this.refreshObservation();}
    else if(action==='fragments.next'){this.fragmentOffset=this.fragments.nextOffset!;this.refreshObservation();}
    else if(action.startsWith('color.')){this.colorMode=Number(action.slice(6));if(this.colorMode>=3&&this.colorMode<=5){this.sphMetric=this.colorMode===3?'pressure':(this.colorMode===4?'internal':'damage');this.refreshObservation();}this.camera();}
    else if(action==='trace.controls'){this.setPanel(1);this.scroller.scrollEdge(Edge.Top);}
    else if(action==='trace.disturb')this.ringDisturbance(.25);
    else if(action==='trace.clear')this.ringDisturbance(0);
    else if(action==='trace.points')this.ringDisturbance(this.trace.impulse,!this.trace.points);
    else if(action==='trace.circular')this.traceParameter('trace.speed',1);
    else if(action==='trace.ellipse')this.traceParameter('trace.speed',1.12);
    else if(action==='trace.apoapsis')this.traceTime(this.trace.innerPeriodHours/2);
    else if(action==='trace.toggle')this.toggleTrace();
    else if(action==='trace.play')this.playTrace();
    else if(action==='trace.reset')this.traceTime(0);
    else if(action==='moon.retry'){this.moonRequested=false;this.ensureMoonTexture(true);}
    else if(action==='material.ocean')this.changeMaterial({ocean:!this.ocean});
    else if(action==='material.cloudShadows')this.changeMaterial({cloudShadows:!this.cloudShadows});
    else if(action==='material.reset')this.applyMaterial(defaultMaterial());
    else if(action==='terrain.new')this.regenerateSurface(false);
    else if(action==='terrain.clouds')this.regenerateSurface(true);
    else if(action==='terrain.undo')this.travelSurfaceHistory(false);
    else if(action==='terrain.redo')this.travelSurfaceHistory(true);
    else if(action==='appearance.rings'){this.rings=!this.rings;this.camera();}
    else if(action==='appearance.clouds'){this.clouds=!this.clouds;this.camera();}
    else if(action==='appearance.atmosphere'){this.atmosphere=!this.atmosphere;this.camera();}
    else if(action==='appearance.trails'){this.trails=!this.trails;this.camera();}
    else if(action==='appearance.spin'){if(!this.closeup)this.openSurface(this.focus<0?1:this.focus);else{this.autoSpin=!this.autoSpin;this.camera();}}
    else if(action==='body.primary')this.editedBody=0;
    else if(action==='body.impactor')this.editedBody=1;
    else if(action.startsWith('sky.mode.'))this.changeSky(Number(action.slice(9)),this.skyBrightness);
    else if(action==='orbit.plane.xy')this.vectorPlane='XY';
    else if(action==='orbit.plane.xz')this.vectorPlane='XZ';
    else if(action.startsWith('sph.metric.')){this.sphMetric=action.slice(11);this.refreshObservation();}
    else if(action==='sph.minimum'||action==='sph.maximum')this.seekSphExtreme(action==='sph.maximum');
    else if(action==='sph.reference.capture')this.captureSphReference();
    else if(action==='sph.reference.toggle')this.sphReferenceShown=!this.sphReferenceShown;
    else if(action==='sph.reference.clear')this.clearSphReference();
    else if(action==='sph.reference.reload'){this.reloadSphReference();if(this.sphReferenceError!=='')throw new Error(this.sphReferenceError);}
    else if(action==='comparison.capture')this.captureReference();
    else if(action==='comparison.toggle')this.comparisonShown=!this.comparisonShown;
    else if(action==='comparison.clear')this.clearReference();
    else if(action==='comparison.reload'){this.reloadReference();if(this.comparisonError!=='')throw new Error(this.comparisonError);}
    else if(action==='observation.distance'||action==='observation.speed'){this.observationMetric=action==='observation.speed'?'speed':'distance';this.refreshObservation();}
    else if(action==='observation.minimum'||action==='observation.maximum')this.seekObservationExtreme(action==='observation.maximum');
    else if(action==='orbit.contact'){const bodies=copyOrbitBodies(this.orbitBodies);for(let i=0;i<bodies.length;i++)bodies[i].radiusKm=estimatedOrbitRadius(bodies[i].massSolar,i===0);this.replaceOrbits(bodies,this.orbitEdit,'启用理想弹性接触');}
    else if(action==='orbit.contact.demo')this.contactDemo();
    else if(action==='orbit.impact.demo')this.contactDemo(true);
    else if(action==='impact.simulate')this.beginImpact();
    else if(action==='impact.return'){simulation.returnImpact();this.info=simulation.status();this.syncImpactView();}
    else if(action==='impact.inspect'){this.setPanel(1);this.scroller.scrollEdge(Edge.Top);}
    else if(action==='selection.satellite'||action==='selection.launch'||action==='selection.drop')this.beginLocalPlacement(action.slice(10));
    else if(action==='orbit.add')this.beginPlacement();
    else if(action==='orbit.copy')this.beginPlacement(this.orbitEdit);
    else if(action==='placement.cancel')this.cancelPlacement();
    else if(action==='placement.confirm')this.confirmPlacement();
    else if(action==='placement.options')this.setPanel(this.panelOpen?-1:0);
    else if(action==='placement.align'){this.yaw=0;this.pitch=Math.max(-1.5,Math.min(1.5,-Number(this.placementFields[3])*Math.PI/180));this.camera();}
    else if(action.startsWith('placement.target.'))this.placementTarget=Number(action.slice(17));
    else if(action==='placement.reverse')this.placementDirection=-this.placementDirection;
    else if(action==='placement.rock')this.useSmallRock();
    else if(action.startsWith('placement.units.')){
      const mode=action.slice(16),u=this.placementUnits;
      this.changePlacementUnits(mode==='physical'?physicalPlacementUnits():mode==='astro'?defaultPlacementUnits():{mass:u.mass,distance:mode==='center'?'km':mode==='altitude'?'altitude':u.distance,speed:u.speed,size:mode==='radius'?'radius':mode==='diameter'?'diameter':u.size});
    }
    else if(action.startsWith('placement.surface.')){const next=Number(action.slice(18)),star=next===0;
      if(star!==(this.placementSurface===0)){this.placementFields=this.placementFields.map((v:string,i:number):string=>i===0?String(this.placementUnits.mass==='kg'?(star?1:EARTH_MASS_SOLAR)*SOLAR_MASS_KG:1):i===5?String(estimatedOrbitRadius(star?1:EARTH_MASS_SOLAR,star)*(this.placementUnits.size==='diameter'?2:1)):v);this.placementName=star?'新恒星':'新行星';}
      this.placementSurface=next;}
    else if(action.startsWith('placement.')){this.placementTarget=-1;const speed=action==='placement.still'?'0':action==='placement.escape'?'1.45':'1';this.setPlacementSpeedRatio(Number(speed));}
    else if(action==='orbit.undo'||action==='orbit.redo')this.travelOrbitHistory(action==='orbit.redo');
    else if(action==='orbit.discard')this.discardOrbitDraft();
    else if(action==='orbit.remove')this.removeOrbit();
    else if(action==='orbit.apply')this.applyOrbit(true);
    else if(action==='orbit.near')this.openSurface(this.orbitEdit);
    else if(action.startsWith('orbit.select.'))this.focusBody(Number(action.slice(13)));
    else if(action.startsWith('orbit.surface.')){const surface=Number(action.slice(14));if(surface!==this.orbitSurface){this.orbitSurface=surface;this.orbitDraft=true;}}
    else throw new Error('Unimplemented action: '+action);
    if(this.placing)this.updatePlacementPreview();
    this.info=simulation.status();this.syncImpactView();
  }
  private pathPixels(path:string):string {return path.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g,(v:string):string=>String(this.getUIContext().vp2px(Number(v))));}
  private orbitPreview():OrbitPreview {return previewOrbit(this.orbitFields,this.vectorPlane);}
  private async pickViewport(x:number,y:number):Promise<number> {
    if(this.placing||!this.isOrbit()||this.ioBusy||simulation.status().state==='preparing')throw new Error('当前视口暂不可点选');
    this.checked(x,0,1);this.checked(y,0,1);
    const id=simulation.pickBody(x,y,Math.min(.05,12/Math.max(1,this.viewportHeight)));
    if(id>=0){await this.performUiAction('focus.'+id);this.notice='已选中 '+this.surfaceName()+' · 可打开参数编辑或近看';}
    return id;
  }
  private tapViewport(e:GestureEvent):void {
    if(this.observerMode>0)return;
    if(this.galaxyPlacing){this.dragGalaxyPlacement(e);return;}
    const finger=e.fingerList[0];if(!finger||this.viewportWidth<=0||this.viewportHeight<=0||!this.isOrbit())return;
    if(this.placing){this.dragViewportPlacement(e);return;}
    this.pickViewport(finger.localX/this.viewportWidth,finger.localY/this.viewportHeight).catch((error:Error)=>{this.notice=String(error);});
  }
  private materialState():RecipeMaterial {return {exposure:this.exposure,ocean:this.ocean,cloudShadows:this.cloudShadows};}
  private changeMaterial(p:CommandPayload):void {
    // Undefined means unchanged; explicit null and all malformed values must fail atomically.
    const m:RecipeMaterial={exposure:p.exposure===undefined?this.exposure:p.exposure,
      ocean:p.ocean===undefined?this.ocean:p.ocean,cloudShadows:p.cloudShadows===undefined?this.cloudShadows:p.cloudShadows};
    this.applyMaterial(m);
  }
  private applyMaterial(m:RecipeMaterial):void {
    validateMaterial(m);simulation.setMaterial(m.exposure,m.ocean,m.cloudShadows);
    this.exposure=m.exposure;this.ocean=m.ocean;this.cloudShadows=m.cloudShadows;
  }
  private changeSky(mode:number,brightness:number):void {
    this.checked(mode,0,2,true);this.checked(brightness,0,1);
    simulation.setSky(mode,brightness);this.skyMode=mode;this.skyBrightness=brightness;
  }
  private async execute(command: string, p: CommandPayload): Promise<string> {
    this.info=simulation.status();this.syncImpactView();
    if((this.info.impact?.canReturn||this.info.impact?.local)&&!command.startsWith('get')&&!command.startsWith('list')&&!['uiAction','setUiValue','pause','seek','saveReplay','setCamera','setAppearance','setSky','setWindowOrientation','setPanel'].includes(command)&&!(!this.info.impact?.canReturn&&['setScene','loadProject','loadReplay'].includes(command)))throw new Error('局部撞击中请先返回轨道，再创建或载入其他实验；局部结果可保存回放');
    if(this.galaxyPlacing&&!command.startsWith('get')&&!command.startsWith('list')&&!['uiAction','setUiValue','setGalaxyPlacementPoint','setWindowOrientation'].includes(command))throw new Error('请先确认或取消星系相遇调整');
    if(command==='listCommands') {
      const catalog: CommandCatalog = {ok:true,commands:[
      {name:'getState',payload:'{}'},
      {name:'getImpactPlan',payload:'{} - latest incoming orbital contact in the selected frame; local COM metres, m/s and kg; bounds check only, no SPH handoff'},
      {name:'getCameraMotion',payload:'{requestId?:number}; 0/current by default, last 32 terminal requests retained'},
      {name:'cancelCameraMotion',payload:'{requestId?:number}; stops only that request; stale cancellation cannot stop a newer flight'},
      {name:'navigateCamera',payload:'{focus:number,closeup?:boolean,yaw?:number,pitch?:number,zoom?:number,durationMs?:0..3000}; explicit continuous flight, request ID in cameraMotion'},
      {name:'getGalaxyObservation',payload:'{} - coherent recorded galaxy samples, applied parameters and selected curve; time Myr'},
      {name:'getGalaxyReference',payload:'{} - locally retained galaxy result with applied parameters and original samples'},
      {name:'getGalaxyComparison',payload:'{} - shared Myr axes, parameter differences and interpolated cursor delta; no extrapolation'},
      {name:'getGalaxyComparisonTable',payload:'{} - both raw series, 19-column CSV with applied parameters; outer fractions remain 0..1'},
      {name:'getGalaxyTable',payload:'{} - CSV of every retained galaxy frame with model, initial parameters, units and model-scoped normalized errors'},
      {name:'getGalaxyPlacement',payload:'{} - active constrained initial offset preview; original history remains untouched'},
      {name:'setGalaxyPlacementPoint',payload:'{x:0..1,y:0..1} - displayed viewport point projected onto XY offset rail; X separation fixed 60 kpc, offset clamped 0..30 kpc'},
      {name:'getGalaxyDiagnostics',payload:'{} - current frame separation/radii in kpc, outer fractions and model-scoped energy error; not unbound mass'},
      {name:'getRingTrace',payload:'{particles?:boolean}; 8192 massless particles drive ring density; returns first 192 when particles=true; controlled radial impulse 0–0.35; km/km/s; speedScale 1–1.2, rateHours 0.1–4, independent 0–24 hour clock'},
      {name:'setSky',payload:'{mode?:0 clean|1 stars|2 galaxy,brightness?:0..1}; photographic galaxy / procedural stars; fixed-direction background'},
      {name:'setWindowOrientation',payload:'{orientation:auto|portrait|landscape|reverse-landscape}; main window only; auto respects system rotation lock'},
      {name:'getSkyInfo',payload:'{} - provenance and sky rendering status'},
      {name:'getProjectedBodies',payload:'{} - last presented orbital frame; normalized top-left x/y, radius in viewport-height units; ignores UI occlusion'},
      {name:'pickBody',payload:'{x:0..1,y:0..1} - viewport hit test, shared focus action; hit=-1 leaves selection unchanged'},
      {name:'followSphFragment',payload:'{particle:0..9999,sceneRevision:number} - follow the current component containing a selected material particle; no reload'},
      {name:'getSphFragmentFollow',payload:'{} - last rendered follow state, current group identity and target center in km'},
      {name:'getSphFragments',payload:'{offset?:0..10000,limit?:1..32} - selected-frame geometric material groups, SI-derived units and frame identity; not binding/reaggregation'},
      {name:'getSphComparison',payload:'{} - shared axes, parameter differences, saved SPH provenance and interpolated cursor delta'},
      {name:'getSphReference',payload:'{} - full saved SPH reference or null; independent from orbital reference'},
      {name:'getSphComparisonTable',payload:'{} - selected metric raw current/reference CSV, seconds, no interpolated rows'},
      {name:'getSphWindowSummary',payload:'{} - read-only retained-window radius/kinetic/radial statistics; no equilibrium verdict'},
      {name:'getSphObservation',payload:'{} - retained double-precision SPH curve, metric, units, extrema and frame identity; read-only'},
      {name:'getSphTable',payload:'{} - raw SPH CSV and applied source configuration; no interpolation'},
      {name:'getSphDiagnostics',payload:'{} - selected SPH frame pressure GPa, specific internal energy MJ/kg, cubed scalar damage and mass-weighted statistics; no seek'},
      {name:'getObservationComparison',payload:'{} - shared axes, overlap, interpolated difference and saved reference provenance'},
      {name:'getObservationReference',payload:'{} - complete saved local reference or null; does not seek'},
      {name:'getObservationTable',payload:'{} - CSV rows for current and saved reference; no interpolation'},
      {name:'getOrbitObservation',payload:'{} - current planet (or first planet), retained-frame distance/speed curve; read-only'},
      {name:'getPlacementPreview',payload:'{} - candidate at frozen current time, exact source revision, two-body guide; no mutation'},
      {name:'setViewportPlacementPoint',payload:'{x:0..1,y:0..1} main viewport tap/drag; exact presented plane projection; requires active placement'},
      {name:'setPlacementPoint',payload:'{x:0..1,y:0..1} in the placement plot; same handler as tap/drag'},
      {name:'getOrbitPreview',payload:'{} - initial editor vector drafts, input coordinates, XY/XZ; does not change physics'},
      {name:'listExperiments',payload:'{} - built-in theme initial conditions, observation goals and default cameras'},
      {name:'getVideoCapabilities',payload:'{} - device encoder capabilities; unavailable during video operations'},
      {name:'getVideoState',payload:'{} - recording status, elapsed wall seconds, submitted frames and local MP4 clips; uiAction video.* controls'},
      {name:'getUiState',payload:'{} - editor drafts, body edit undo/redo history, action IDs/enabled/selected, input fields'},
      {name:'listUiActions',payload:'{} - same semantic control catalog'},
      {name:'uiAction',payload:'{action:string} - invoke a catalog action through the same ArkUI handler'},
      {name:'getGalaxyObserver',payload:'{} - solar-radius analogue observer, current frame and sky orientation; illustrative horizon'},
      {name:'setUiValue',payload:'{field:string,value:string|number} - edit a catalog field; orbital inputs stay draft until orbit.apply'},
      {name:'setScene',payload:'{preset:0..6,count:200..2400,speed:0.5..10 (preset 2 allows 0; total spin = targetSpin + speed*0.003),angle:0..70,duration:1..120; galaxy preset 6: duration 50..800 Myr, speed .75..1.25 of 156.45 km/s, angle 0..70 inclination degrees, galaxyMassRatio?:.2..1, galaxyOffsetKpc?:0..30 initial transverse offset, galaxyRetrograde?:boolean, galaxyResponsive?:boolean (massive stellar response, count<=800); custom preset 5 requires orbitBodies (2..8), speed=1; optional radiusKm:1..10000000 on every body enables ideal elastic sphere contact and auto-pause; orbit preset 3/4: speed 0.75..1.25 circular-velocity factor, duration 1..10 Julian years; count/rock fields ignored; optional initialEnergyMJkg:0..6.8, initialDamage:0..1 (SPH only, incompatible with relaxation; same initial material state for both bodies); optional selfGravity:boolean (SPH only, count<=1200, defaults false); relaxationSeconds?:0|16|64 (requires selfGravity, isolated stationary pre-relaxation); targetRadiusKm:40..200,impactorRadiusKm:20..120,targetDensity:2400..3000,impactorDensity:2400..3000,targetSpin:-0.01..0.01,seed:1..1000000}'},
      {name:'start',payload:'{}'}, {name:'pause',payload:'{}'}, {name:'reset',payload:'{}'},
      {name:'getPreparation',payload:'{}; monotonic phase timings, request ID, previous worker phase and bounded history; no mutation'},
      {name:'seek',payload:'{frame:-1 or retained frame index}'},
      {name:'setCamera',payload:'{yaw:-100..100,pitch:-1.5..1.5,zoom:0.5..15,focus:-1..1 (orbit preset 4: -1..3; custom: -1..bodyCount-1),color:0..8 (galaxy 0..1; 0 original,1 speed,2 density,3 pressure,4 specific internal energy,5 damage,6 geometric groups,7 thermal appearance,8 remaining yield strength; orbit 0..1)}'},
      {name:'getSurfaceInfo',payload:'{}; Moon source, loading state, upload count and bounded memory'},
      {name:'setSurfaceSeed',payload:'{body:1..7,surfaceSeed?:0..1000000,cloudSeed?:0..1000000}; custom planets; preserves simulation and camera; 0 = legacy'},
      {name:'setMaterial',payload:'{exposure?:-2..2 EV,ocean?:boolean,cloudShadows?:boolean}; original-color orbital surfaces only; no camera or solver reset'},
      {name:'setAppearance',payload:'{clouds?:boolean,atmosphere?:boolean,trails?:boolean,closeup?:boolean,autoSpin?:boolean,rings?:boolean} (visual settings only)'},
      {name:'setPanel',payload:'{panel:-1 close,0 parameters,1 observe,2 library}'},
      {name:'listProjects',payload:'{}'}, {name:'saveProject',payload:'{title:string}'}, {name:'loadProject',payload:'{id:string}'},
      {name:'saveReplay',payload:'{}'}, {name:'loadReplay',payload:'{}'}]};
      return JSON.stringify(catalog);
    }
    if(command==='getRingTrace'){if(p.particles!==undefined&&typeof p.particles!=='boolean')throw new Error('particles must be boolean');return JSON.stringify({ok:true,ringTrace:simulation.ringTraceStatus(p.particles??true)});}
    if(command==='listExperiments')return JSON.stringify({ok:true,catalogVersion:1,experiments:themeExperiments(),active:this.themeState()});
    if(command==='getState') return this.snapshot();
    if(command==='getImpactPlan'){const state:SimulationStatus=simulation.status();return JSON.stringify({ok:true,sceneRevision:state.orbitRevision,selected:state.selected,contact:state.contact});}
    if(command==='getCameraMotion'||command==='cancelCameraMotion'){
      const id:number=p.requestId===undefined?0:this.checked(p.requestId,0,1.e9,true);
      const m:CameraMotionStatus=command==='getCameraMotion'?simulation.getCameraMotion(id):simulation.cancelCameraMotion(id);
      if(command==='cancelCameraMotion'&&m.requestId===simulation.getCameraMotion(0).requestId&&m.state==='cancelled'){
        this.yaw=m.yaw;this.pitch=m.pitch;this.zoom=m.zoom;this.cameraFlight=m.state;this.notice='已停止镜头过渡';
      }
      return JSON.stringify({ok:true,cameraMotion:m});
    }
    if(command==='setWindowOrientation'){if(typeof p.orientation!=='string')throw new Error('missing orientation');await WindowControl.orient(p.orientation);return this.snapshot();}
    if(command==='getSkyInfo'){const rendered:RenderStatus=simulation.renderStatus();return JSON.stringify({ok:true,reference:rendered.panoramaReady?'photographic-panorama':'procedural-fallback',catalog:'procedural-v1 (stars-only mode)',proceduralStarsVisible:this.skyMode===1||(this.skyMode===2&&!rendered.panoramaReady),seed:24190906,stars:6500,textureSize:rendered.panoramaReady?[2048,1024]:[1024,512],panorama:'eso0932a',credit:'ESO/S. Brunier',sourceUrl:'https://www.eso.org/public/images/eso0932a/',license:'CC BY 4.0',coordinateFrame:'simulation-orientation (not astrometric)',translationParallax:false,localZoomAffectsSky:false,loadError:this.skyLoadError,mode:this.skyMode,brightness:this.skyBrightness,rendering:rendered});}
    if(command==='getSurfaceInfo'){const response:MoonAssetReply={ok:true,moon:{source:'https://svs.gsfc.nasa.gov/4720/',asset:'lroc_color_2k.jpg',credit:"NASA's Scientific Visualization Studio",width:2048,height:1024,requested:this.moonRequested,ready:simulation.renderStatus().moonReady,uploads:simulation.renderStatus().moonUploads,blend:simulation.renderStatus().moonBlend,error:this.moonLoadError||simulation.renderStatus().moonError,decodedBudgetBytes:8388608,gpuBudgetBytes:11184812}};return JSON.stringify(response);}
    if(command==='getProjectedBodies')return JSON.stringify({ok:true,projection:simulation.projectedScene()});
    if(command==='pickBody'){const hit=await this.pickViewport(this.checked(p.x,0,1),this.checked(p.y,0,1));return JSON.stringify({ok:true,hit:hit});}
    if(command==='getPreparation'){const state:SimulationStatus=simulation.status();return JSON.stringify({ok:true,state:state.state,error:state.error,config:state.config,preparation:state.preparation});}
    if(command==='getSphFragmentFollow')return JSON.stringify({ok:true,follow:simulation.renderStatus().fragmentFollow});
    if(command==='followSphFragment'){this.beginFragmentFollow(this.checked(p.particle,0,9999,true),this.checked(p.sceneRevision,0,2147483647,true));return JSON.stringify({ok:true,particle:p.particle,sceneRevision:p.sceneRevision});}
    if(command==='getSphFragments')return JSON.stringify({ok:true,fragments:simulation.sphFragments(this.checked(p.offset??0,0,10000,true),this.checked(p.limit??8,1,32,true))});
    if(command==='getSphReference')return JSON.stringify({ok:true,reference:this.sphReference??null,error:this.sphReferenceError});
    if(command==='getSphComparison'){this.refreshObservation();const source=simulation.status();return JSON.stringify({ok:true,metric:this.sphMetric,visible:this.sphReferenceShown,reference:this.sphReference?sphReferenceSummary(this.sphReference):undefined,currentConfig:source.config,currentModel:source.model,currentSceneRevision:this.sphObserved.sceneRevision,differences:this.sphReference?sphParameterDifferences(source.config,this.sphReference.config):[],chart:this.sphComparisonView(),error:this.sphReferenceError});}
    if(command==='getSphComparisonTable'){this.refreshObservation();const source=simulation.status(),csv=sphComparisonCsv(this.sphObserved,this.sphMetric,this.sphReference?.data);return JSON.stringify({ok:true,metric:this.sphMetric,unit:this.sphView().unit,timeAlignment:'simulation-start',timeUnit:'s',csv,rows:csv.trim().split('\n').length-1,currentConfig:source.config,currentModel:source.model,currentSceneRevision:this.sphObserved.sceneRevision,currentAvailable:this.sphView().available,referenceAvailable:this.sphReference!==undefined&&sphPlot(this.sphReference.data,this.sphMetric).available,reference:this.sphReference?sphReferenceSummary(this.sphReference):undefined});}
    if(command==='getSphWindowSummary'){this.refreshObservation();return JSON.stringify({ok:true,config:simulation.status().config,summary:this.sphSummary()});}
    if(command==='getSphObservation'){this.refreshObservation();const reply:SphCurveReply={ok:true,metric:this.sphMetric,label:this.sphLabel(),data:{sceneRevision:this.sphObserved.sceneRevision,selected:this.sphObserved.selected,samples:(this.sphView().available?this.sphObserved.samples.map((s:SphObservationSample):SphCurveSample=>({frame:s.frame,time:s.time,value:sphMetricValue(s,sphMetricIndex(this.sphMetric))})):[])},plot:this.sphView()};return JSON.stringify(reply);}
    if(command==='getSphTable'){const data:SphObservation=simulation.sphObservation(),config:SimulationConfig|undefined=simulation.status().config;if(simulation.sphObservation().sceneRevision!==data.sceneRevision)throw new Error('场景已变化，请重试导出');return JSON.stringify({ok:true,rows:data.samples.length,timeUnit:'s',sceneRevision:data.sceneRevision,config,csv:sphCsv(data)});}
    if(command==='getGalaxyPlacement')return JSON.stringify({ok:true,placement:this.galaxyPlacementState(),projection:simulation.projectedScene()});
    if(command==='setGalaxyPlacementPoint'){this.moveGalaxyPlacement(this.checked(p.x,0,1),this.checked(p.y,0,1));return JSON.stringify({ok:true,placement:this.galaxyPlacementState()});}
    if(command==='getGalaxyObserver')return JSON.stringify({ok:true,data:simulation.galaxyObserverStatus()});
    if(command==='getGalaxyObservation'){this.galaxyObserved=simulation.galaxyObservation();return JSON.stringify({ok:true,timeUnit:'Myr',data:this.galaxyObserved,metric:this.galaxyMetric,label:GALAXY_METRICS[this.galaxyMetric],plot:galaxyPlot(this.galaxyObserved,this.galaxyMetric)});}
    if(command==='getGalaxyReference')return JSON.stringify({ok:true,reference:this.galaxyReference??null,error:this.galaxyReferenceError});
    if(command==='getGalaxyComparison'){this.galaxyObserved=simulation.galaxyObservation();return JSON.stringify({ok:true,metric:this.galaxyMetric,visible:this.galaxyReferenceShown,timeUnit:'Myr',timeAlignment:'simulation-start',current:this.galaxyObserved,reference:this.galaxyReference??null,differences:this.galaxyDifferences(),chart:this.galaxyComparisonView(),error:this.galaxyReferenceError});}
    if(command==='getGalaxyComparisonTable'){const data=simulation.galaxyObservation(),csv=galaxyComparisonCsv(data,this.galaxyReference?.data);return JSON.stringify({ok:true,timeUnit:'Myr',timeAlignment:'simulation-start',csv,rows:data.samples.length+(this.galaxyReference?.data.samples.length??0),currentAvailable:data.available,currentSceneRevision:data.sceneRevision,currentParameters:data.parameters,reference:this.galaxyReference??null,error:this.galaxyReferenceError,scope:'raw recorded samples; outer fractions 0..1; no interpolation or extrapolation'});}
    if(command==='getGalaxyTable'){const data=simulation.galaxyObservation();return JSON.stringify({ok:true,available:data.available,sceneRevision:data.sceneRevision,selected:data.selected,model:data.available?galaxyModel(data):undefined,parameters:data.parameters,timeUnit:'Myr',rows:data.samples.length,csv:galaxyCsv(data),scope:data.parameters?.responsive?'massive stars and responsive extended centers; total system energy; outer fractions are not unbound mass':'two softened centers and massless tracers; center energy only; outer fractions are not unbound mass'});}
    if(command==='getGalaxyDiagnostics'){const state:SimulationStatus=simulation.status();return JSON.stringify({ok:true,available:state.galaxy!==undefined,model:state.model,time:state.time,timeUnit:state.timeUnit,selected:state.selected,frames:state.frames,config:state.config,diagnostics:state.galaxy,energyError:state.galaxy?state.energyError:undefined,angularError:state.galaxy?state.angularError:undefined,energyScope:state.galaxy?.energyScope,centerEnergyError:state.galaxy&&!state.config?.galaxyResponsive?state.energyError:undefined,centerAngularError:state.galaxy&&!state.config?.galaxyResponsive?state.angularError:undefined});}
    if(command==='getSphDiagnostics'){const state:SimulationStatus=simulation.status();return JSON.stringify({ok:true,time:state.time,timeUnit:state.timeUnit??'s',selected:state.selected,frameCount:state.frames,model:state.model,config:state.config,diagnostics:state.sph??{available:false},source:'OpenSPH Storage PRESSURE/ENERGY/DAMAGE; effective damage = stored root cubed; means mass-weighted; response uses fixed basalt von Mises strength, not temperature or liquid phase fraction'});}
    if(command==='getObservationComparison'){this.refreshObservation();const reply:ComparisonReply={ok:true,visible:this.comparisonShown,reference:this.comparisonReference?referenceSummary(this.comparisonReference):undefined,currentName:this.observed.name,currentCount:this.observed.samples.length,currentConfig:simulation.status().config,chart:this.comparisonView(),error:this.comparisonError};return JSON.stringify(reply);}
    if(command==='getObservationReference')return JSON.stringify({ok:true,reference:this.comparisonReference??null,error:this.comparisonError});
    if(command==='getObservationTable'){this.refreshObservation();const ref=this.comparisonReference;const reply:ObservationTableReply={ok:true,csv:observationCsv(this.observed,ref?.data),rows:this.observed.samples.length+(ref?.data.samples.length??0),timeAlignment:'simulation-start',reference:ref?referenceSummary(ref):undefined,currentName:this.observed.name,currentConfig:simulation.status().config};return JSON.stringify(reply);}
    if(command==='getOrbitObservation'){this.refreshObservation();const reply:ObservationReply={ok:true,metric:this.observationMetric,data:this.observed,plot:observationPlot(this.observed,this.observationMetric)};return JSON.stringify(reply);}
    if(command==='setSurfaceSeed'){const body=this.checked(p.body,1,this.orbitBodies.length-1);if(!Number.isInteger(body))throw new Error('天体编号必须为整数');const old=this.surfaces[body];if(!old)throw new Error('需要自定义系统');this.changeSurface(body,p.surfaceSeed===undefined?old.seed:p.surfaceSeed,p.cloudSeed===undefined?old.cloudSeed:p.cloudSeed);return this.snapshot();}
    if(command==='getPlacementPreview')return JSON.stringify({ok:true,active:this.placing,sourceTime:this.info.time,sourceRevision:this.placementRevision,preview:this.placementPreview()});
    if(command==='setViewportPlacementPoint'){this.moveViewportPlacement(this.checked(p.x,0,1),this.checked(p.y,0,1));return JSON.stringify({ok:true,active:this.placing,sourceTime:this.info.time,sourceRevision:this.placementRevision,preview:this.placementPreview()});}
    if(command==='setPlacementPoint'){this.movePlacement(this.checked(p.x,0,1),this.checked(p.y,0,1));return this.snapshot();}
    if(command==='getOrbitPreview'){if(this.preset!==5)throw new Error('需要自定义系统');return JSON.stringify({ok:true,body:this.orbitEdit,draft:this.orbitDraft,reference:'initial-input',preview:this.orbitPreview()});}
    if(command==='getVideoCapabilities')return JSON.stringify({ok:true,encoders:await this.videos().capabilities()});
    if(command==='getVideoState'){this.videos();this.syncVideo();return JSON.stringify({ok:true,video:this.videoState,quality:this.videoQuality,dialogOpen:this.videoOpen,previewOpen:this.videoPreview,previewReady:this.videoPreviewReady,previewError:this.videoPreviewError});}
    if(command==='getUiState'||command==='listUiActions'){this.info=simulation.status();return JSON.stringify({ok:true,actions:this.uiActions(),fields:this.uiFields(),editor:this.editorState(),theme:this.themeState(),librarySection:this.librarySection});}
    if(command==='uiAction'){if(typeof p.action!=='string')throw new Error('missing action');await this.performUiAction(p.action);return this.snapshot();}
    if(command==='setUiValue'){if(typeof p.field!=='string'||p.value===undefined)throw new Error('missing field/value');this.setUiValue(p.field,p.value);return this.snapshot();}
    if(command==='listProjects') {
      this.refreshProjects();
      const result: ProjectList={ok:true,projects:this.projects.map((p: SavedProject): ProjectSummary => {return {id:p.id,title:p.scene.title,savedAt:p.savedAt,hasRecipe:p.recipe!==undefined,themeId:p.recipe?.themeId??''};})};
      return JSON.stringify(result);
    }
    if(this.ioBusy) throw new Error('replay I/O in progress');
    if(this.placing)throw new Error('请先确认或取消放置');
    this.info=simulation.status();this.syncImpactView();
    if(command==='setSky'){this.changeSky(p.mode===undefined?this.skyMode:p.mode,p.brightness===undefined?this.skyBrightness:p.brightness);return this.snapshot();}
    if(command==='setScene') {
      // Validate the entire transaction before changing any UI state.
      const preset: number=this.checked(p.preset,0,6,true);
      const count: number=this.checked(p.count,200,2400,true);
      const speed: number=this.checked(p.speed,preset===2?0:0.5,10);
      const angle: number=this.checked(p.angle,0,70);
      const duration: number=this.checked(p.duration,preset===6?50:1,preset===6?800:120);
      const c: SimulationConfig={preset:preset,count:count,speed:speed,angle:angle,duration:duration,
        targetRadiusKm:p.targetRadiusKm===undefined?this.targetRadiusKm:p.targetRadiusKm,
        impactorRadiusKm:p.impactorRadiusKm===undefined?this.impactorRadiusKm:p.impactorRadiusKm,
        targetDensity:p.targetDensity===undefined?this.targetDensity:p.targetDensity,
        impactorDensity:p.impactorDensity===undefined?this.impactorDensity:p.impactorDensity,
        targetSpin:p.targetSpin===undefined?this.targetSpin:p.targetSpin,seed:p.seed===undefined?this.seed:p.seed};
      if(p.initialEnergyMJkg!==undefined)c.initialEnergyMJkg=p.initialEnergyMJkg;
      if(p.initialDamage!==undefined)c.initialDamage=p.initialDamage;
      if(p.selfGravity!==undefined)c.selfGravity=p.selfGravity;
      if(p.relaxationSeconds!==undefined)c.relaxationSeconds=p.relaxationSeconds;
      if(p.orbitBodies!==undefined)c.orbitBodies=p.orbitBodies;
      if(p.galaxyMassRatio!==undefined)c.galaxyMassRatio=p.galaxyMassRatio;
      if(p.galaxyOffsetKpc!==undefined)c.galaxyOffsetKpc=p.galaxyOffsetKpc;
      if(p.galaxyRetrograde!==undefined)c.galaxyRetrograde=p.galaxyRetrograde;
      if(p.galaxyResponsive!==undefined)c.galaxyResponsive=p.galaxyResponsive;
      validateConfig(c);this.applyConfig(c);
      this.title=preset===6?'星系潮汐相遇':preset>=3?(preset===5?'自定义系统':preset===3?'双体轨道':'行星系统'):'碰撞实验';
      if(!this.prepare(false)) throw new Error(this.notice);
    } else if(command==='saveProject') {
      const saved: SavedProject=this.saveProject(p.title===undefined?this.title:p.title);
      return JSON.stringify({ok:true,id:saved.id});
    } else if(command==='loadProject') {
      if(typeof p.id!=='string') throw new Error('missing project id');this.openProject(p.id);
    } else if(command==='start') {
      this.stopTrace();
      if(this.info.state==='preparing') throw new Error('scene is preparing; poll getState');
      if(this.info.state!=='running') {
        if(this.dirty || (!(this.isOrbit()&&(this.info.orbitState??[]).length>0)&&['completed','cancelled','failed','replay','empty'].includes(this.info.state))) {
          if(!this.prepare(true)) throw new Error(this.notice);
        } else this.run();
      }
    } else if(command==='pause') { if(this.trace.enabled){const t:RingTraceStatus=simulation.ringTraceStatus(false);simulation.configureRingTrace(true,false,t.target,t.massSolar);this.trace=simulation.ringTraceStatus(false);}this.playing=false;simulation.pause(true);this.notice='已暂停，可回看时间轴或调整视角';
    } else if(command==='reset') { if(!this.prepare(false)) throw new Error(this.notice);
    } else if(command==='seek') {
      const frame: number=this.checked(p.frame,-1,this.info.frames-1,true);
      this.stopTrace();this.playing=false;simulation.seek(frame);
    } else if(command==='navigateCamera') {
      const focus:number=this.checked(p.focus,-1,this.maxFocus(),true);
      if(p.closeup!==undefined&&typeof p.closeup!=='boolean')throw new Error('closeup must be boolean');
      const close:boolean=p.closeup??false;
      if(close&&(!this.isOrbit()||focus<0))throw new Error('近看需要有效的引力天体');
      const duration:number=p.durationMs===undefined?420:this.checked(p.durationMs,0,3000);
      const yaw:number=p.yaw===undefined?this.yaw:this.checked(p.yaw,-100,100);
      const pitch:number=p.pitch===undefined?this.pitch:this.checked(p.pitch,-1.5,1.5);
      const zoom:number=p.zoom===undefined?this.zoom:this.checked(p.zoom,.5,15);
      if(focus>=0)this.rememberOverview();
      this.focus=focus;this.closeup=close;if(!close)this.autoSpin=false;
      this.yaw=yaw;this.pitch=pitch;this.zoom=zoom;if(this.preset===5&&focus>=0)this.selectOrbit(focus);
      this.camera(duration/1000,true,true);
    } else if(command==='setCamera') {
      const yaw: number=this.checked(p.yaw,-100,100);const pitch: number=this.checked(p.pitch,-1.5,1.5);
      const zoom: number=this.checked(p.zoom,0.5,15);const focus: number=this.checked(p.focus,-1,this.maxFocus(),true);
      const color: number=this.checked(p.color,0,this.preset>=3?1:8,true);
      simulation.clearSphFragmentFollow();this.stopCameraMotion();if(focus>=0)this.rememberOverview();else this.overviewCamera=undefined;this.yaw=yaw;this.pitch=pitch;this.zoom=zoom;this.focus=focus;if(this.preset===5&&focus>=0)this.selectOrbit(focus);this.colorMode=color;if(focus<0){this.closeup=false;this.autoSpin=false;}this.camera();
    } else if(command==='setMaterial'){this.changeMaterial(p);
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
  private sphNumber(value:number|undefined,unit:string):string {return value===undefined?'—':value.toPrecision(5)+' '+unit;}
  private beginFragmentFollow(particle:number,revision:number):void {
    simulation.followSphFragment(particle,revision);
    this.notice='正在跟随所选材料所在团块 · 拖动可旋转，缩放可拉近';
  }
  private sphLegend():string {
    if(this.colorMode>=3&&!this.info.sph?.available)return '当前记录不含 SPH 诊断 · 暂显示原色';
    if(this.colorMode>=7&&!this.info.sph?.response)return '旧记录不含材料响应 · 暂显示原色';
    if(this.colorMode===7)return '热软化外观：内能越高越亮，损伤区变暗；颜色不是温度，软化不是液相比例';
    if(this.colorMode===8)return '剩余屈服强度：红 0 → 青 100%；同时计入损伤与热软化';
    if(this.colorMode===3)return '压力：蓝 −10 / 白 0 / 红 +10 GPa';
    if(this.colorMode===4)return '比内能：深蓝 0 → 金色 10 MJ/kg';
    if(this.colorMode===6)return this.fragments.available?'按当前几何团块着色，列表颜色与画面对应；不是引力束缚判定':'此回放无团块记录 · 暂显示原色';
    if(this.colorMode===5)return '材料损伤：青色 0 → 红色 1';
    return this.colorMode===0?'灰岩 · 主天体 / 赭岩 · 撞击体；颜色不代表温度':(this.colorMode===1?'速度 0 → 10 km/s':'密度 0 → 5000 kg/m³');
  }
  @Builder
  materialControls() {
    if(this.selectedMoon()){Text(this.moonLoadError||this.rendering.moonError?'月面贴图暂不可用 · 显示灰色球体':(this.rendering.moonReady?"月面底图 · NASA’s Scientific Visualization Studio":'正在载入月面底图…')).fontSize(11).fontColor('#C9BEDF').width('100%')}
    if(this.moonLoadError||this.rendering.moonError){ChoiceChip({label:'重试月面贴图',active:false,onPress:()=>{this.press('moon.retry');}})}
    Text('光与质感').fontSize(14).fontColor('#E4DCF8').width('100%')
    MetricRow({label:'曝光',value:(this.exposure>0?'+':'')+this.exposure.toFixed(1)+' EV'})
    Slider({value:this.exposure,min:-2,max:2,step:.1}).id('material.exposure').accessibilityText('行星曝光')
      .selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
      .onChange((v:number,mode:SliderChangeMode)=>{if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End)this.input('material.exposure',v);})
    Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
      ChoiceChip({label:'海洋反光',active:this.ocean,onPress:()=>{this.press('material.ocean');}})
      ChoiceChip({label:'云影',active:this.cloudShadows,onPress:()=>{this.press('material.cloudShadows');}})
      ChoiceChip({label:'还原光照',active:false,onPress:()=>{this.press('material.reset');}})
    }.width('100%')
    Text(this.colorMode===0?'只调整天体画面亮度；海洋反光用于海陆外观，云影随云层开关。':'速度着色中暂不显示曝光与材质效果。').fontSize(11).fontColor('#ADA8BF').lineHeight(18).width('100%')
    Divider().color('#33B4A7D6')
  }
  @Builder
  sphCurveControls() {
    Column({space:7}) {
      Text('随时间变化 · '+this.sphLabel()).fontSize(13).fontColor('#D9CCF5').width('100%')
      Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(6)}}) {
        ChoiceChip({label:'峰值压力',active:this.sphMetric==='pressure',onPress:()=>{this.press('sph.metric.pressure');}}).id('sph-curve-pressure')
        ChoiceChip({label:'平均比内能',active:this.sphMetric==='internal',onPress:()=>{this.press('sph.metric.internal');}}).id('sph-curve-internal')
        ChoiceChip({label:'平均损伤',active:this.sphMetric==='damage',onPress:()=>{this.press('sph.metric.damage');}}).id('sph-curve-damage')
        ChoiceChip({label:'动能',active:this.sphMetric==='kinetic',onPress:()=>{this.press('sph.metric.kinetic');}}).id('sph-curve-kinetic')
        ChoiceChip({label:'内能总量',active:this.sphMetric==='energy',onPress:()=>{this.press('sph.metric.energy');}}).id('sph-curve-energy')
        if(this.info.sph?.structure!==undefined){
          ChoiceChip({label:'引力势能',active:this.sphMetric==='gravity',onPress:()=>{this.press('sph.metric.gravity');}}).id('sph-curve-gravity')
          ChoiceChip({label:'相对动能',active:this.sphMetric==='relativeKinetic',onPress:()=>{this.press('sph.metric.relativeKinetic');}}).id('sph-curve-relativeKinetic')
          ChoiceChip({label:'分布尺度',active:this.sphMetric==='radius',onPress:()=>{this.press('sph.metric.radius');}}).id('sph-curve-radius')
          ChoiceChip({label:'径向速度',active:this.sphMetric==='radial',onPress:()=>{this.press('sph.metric.radial');}}).id('sph-curve-radial')
        }
      }.width('100%')
      if(this.sphChart().available) {
        Text(this.sphChart().current.toPrecision(5)+' '+this.sphChart().unit+' · '+this.sphChart().currentTime.toFixed(2)+' s').id('sph-curve-current').fontSize(12).fontColor('#BDE9FF').width('100%')
        if(this.sphComparisonView().referenceVisible){Text('青色 · 当前　金色 · 参照').id('sph-comparison-legend').fontSize(10).fontColor('#EBC08B').width('100%')}
        Text(this.sphChart().high.toPrecision(4)+' '+this.sphChart().unit).fontSize(10).fontColor('#ABA6C0').width('100%')
        Stack({alignContent:Alignment.TopStart}) {
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath('M0 0 L240 0 M0 50 L240 50 M0 100 L240 100')).stroke('#414055').strokeWidth(1).fillOpacity(0)
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.sphChart().path)).stroke('#A9E1EF').strokeWidth(2).fillOpacity(0)
          if(this.sphComparisonView().referenceVisible){Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.sphComparisonView().referencePath)).stroke('#EBC08B').strokeWidth(2).fillOpacity(0)}
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.sphChart().cursorPath)).stroke('#CDB9F0').strokeWidth(1).fillOpacity(0)
        }.id('sph-curve-plot').width(this.observationWidth()).height(this.observationWidth()*100/240).clip(true)
        Text(this.sphChart().low.toPrecision(4)+' '+this.sphChart().unit+' · '+this.sphChart().firstTime.toFixed(2)+'–'+this.sphChart().lastTime.toFixed(2)+' s').fontSize(10).fontColor('#ABA6C0').width('100%')
        Row({space:6}) {
          ChoiceChip({label:'记录最小',onPress:()=>{this.press('sph.minimum');}}).id('sph-curve-minimum')
          ChoiceChip({label:'记录最大',onPress:()=>{this.press('sph.maximum');}}).id('sph-curve-maximum')
        }.width('100%')
        Text('最近 '+this.sphObserved.samples.length+' / 240 帧；极值只代表保留的采样，不等于接触或破碎事件。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
      } else {Text(sphMetricIndex(this.sphMetric)>=10?'此回放缺少结构记录，重新计算后可查看':'等待完整 SPH 诊断记录').fontSize(12).fontColor('#B7C5D5')}
      this.sphReferenceControls()
    }.width('100%')
  }
  @Builder
  sphReferenceControls() {
    Column({space:7}) {
      Button(this.sphReference?'替换为本次结果':'保存本次作参照',{type:ButtonType.Normal}).id('sph-reference-capture').width('100%').height(36).borderRadius(18).fontSize(12).backgroundColor('#334F416E').fontColor('#D9CCF5')
        .enabled(this.sphObserved.samples.length>=2&&!this.ioBusy).onClick(()=>{this.press('sph.reference.capture');})
      if(this.sphReference){
        Text('参照 · '+this.sphReference.title).id('sph-reference-title').fontSize(12).fontColor('#EBC08B').width('100%')
        Text(this.sphReference.particleCount+' 粒子 · '+this.sphReference.data.samples.length+' 帧 · '+this.sphReference.data.samples[0].time.toFixed(2)+'–'+this.sphReference.data.samples[this.sphReference.data.samples.length-1].time.toFixed(2)+' s').fontSize(10).fontColor('#B8AFA7').width('100%')
        Text('参数差异 · 参照 → 当前').fontSize(11).fontColor('#DCCEF3').width('100%')
        if(this.sphDifferences().length===0){Text('已记录的初始参数相同').fontSize(10).fontColor('#ABA6C0').width('100%')}
        ForEach(this.sphDifferences(),(difference:string)=>{Text(difference).fontSize(10).fontColor('#B8AFA7').lineHeight(16).width('100%')},(difference:string):string=>difference)
        Row({space:6}){
          ChoiceChip({label:this.sphReferenceShown?'隐藏参照':'显示参照',active:this.sphReferenceShown,onPress:()=>{this.press('sph.reference.toggle');}}).id('sph-reference-toggle')
          ChoiceChip({label:'移除参照',onPress:()=>{this.press('sph.reference.clear');}}).id('sph-reference-clear')
        }.width('100%')
        if(this.sphReferenceShown){
          Text(this.sphComparisonView().deltaReady?'当前 − 参照 '+this.sphComparisonView().delta!.toPrecision(5)+' '+this.sphChart().unit+' · 参照按当前时刻线性插值':this.sphComparisonView().reason).id('sph-comparison-delta').fontSize(10).fontColor('#B7C5D5').lineHeight(16).width('100%')
        }
        Text('按各自开始后的秒数对齐；只比较保留记录，曲线差异不自动解释原因。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
      }
      if(this.sphReferenceError!==''){
        Text(this.sphReferenceError).fontSize(10).fontColor('#F4A993').width('100%')
        Row({space:6}){
          ChoiceChip({label:'重试读取',onPress:()=>{this.press('sph.reference.reload');}})
          ChoiceChip({label:'移除参照',onPress:()=>{this.press('sph.reference.clear');}})
        }.width('100%')
      }
    }.width('100%')
  }
  private fragmentColor(anchor:number):string {
    const hue=((anchor+1)*0.61803398875)%1;
    return '#'+[0,0.333333,0.666667].map((phase:number):string=>Math.round(255*(0.55+0.38*Math.cos(6.2831853*(hue+phase)))).toString(16).padStart(2,'0')).join('');
  }
  @Builder
  fragmentControls() {
    Column({space:6}) {
      Text('材料分成了几团').id('sph-fragments-heading').fontSize(13).fontColor('#D9CCF5').width('100%')
      if(this.fragments.available){
        Row({space:6}){
          ChoiceChip({label:'跟随最大团块',onPress:()=>{this.press('fragments.largest');}}).id('sph-fragments-largest')
          if(this.rendering.fragmentFollow.active){ChoiceChip({label:'停止跟随',onPress:()=>{this.press('fragments.stop');}}).id('sph-fragments-stop')}
        }.width('100%')
        if(this.rendering.fragmentFollow.active){Text('正在跟随第 '+this.rendering.fragmentFollow.rank+' 团 · '+this.rendering.fragmentFollow.count+' 粒子').id('sph-follow-status').fontSize(11).fontColor(this.fragmentColor(this.rendering.fragmentFollow.anchor)).width('100%')}
        Text(this.fragments.groupCount+' 个几何团块 · '+this.fragments.time.toFixed(2)+' s').fontSize(12).fontColor('#E2EEF5').width('100%')
        MetricRow({label:'最大团块质量占比',value:(this.fragments.largestMassFraction!*100).toFixed(2)+' %'})
        Text('单粒子团块 '+this.fragments.singletonCount+' 个 · '+(this.fragments.singletonMassKg!/this.fragments.totalMassKg!*100).toFixed(2)+' % 质量').fontSize(10).fontColor('#ABA6C0').width('100%')
        ForEach(this.fragments.groups,(g:SphMaterialGroup)=>{
          Column({space:3}){
            Row({space:6}){
              Text('#'+g.rank+' · '+g.count+' 粒子 · '+(g.massFraction*100).toFixed(2)+' %').fontSize(11).fontColor(this.fragmentColor(g.anchor)).layoutWeight(1).maxLines(2)
              ChoiceChip({label:this.rendering.fragmentFollow.active&&this.rendering.fragmentFollow.anchor===g.anchor?'跟随中':'跟随',active:this.rendering.fragmentFollow.active&&this.rendering.fragmentFollow.anchor===g.anchor,onPress:()=>{this.press('fragments.follow.'+g.anchor);}}).id('sph-follow-'+g.anchor)
            }.width('100%')
            Text(g.massKg.toPrecision(4)+' kg · 质心速度 '+Math.hypot(g.velocityKmS[0],g.velocityKmS[1],g.velocityKmS[2]).toPrecision(3)+' km/s').fontSize(10).fontColor('#B7C5D5').width('100%')
            Text('质心 km ['+g.centerKm.map((v:number):string=>v.toFixed(1)).join(', ')+'] · 尺度 '+g.rmsRadiusKm.toPrecision(3)+' km').fontSize(10).fontColor('#ABA6C0').lineHeight(15).width('100%')
          }.width('100%')
        },(g:SphMaterialGroup):string=>g.rank+'-'+g.anchor+'-'+this.fragments.time)
        if(this.fragmentOffset>0||(this.fragments.nextOffset??-1)>=0){Row({space:6}){
          ChoiceChip({label:'上一组',enabledAction:this.fragmentOffset>0,onPress:()=>{this.press('fragments.previous');}}).id('sph-fragments-previous')
          ChoiceChip({label:'下一组',enabledAction:(this.fragments.nextOffset??-1)>=0,onPress:()=>{this.press('fragments.next');}}).id('sph-fragments-next')
        }.width('100%')}
        Text('分裂或连接后，继续跟随选中材料点所在的一团。以 1.5 × 平均光滑长度连接；序号是本帧质量排名，不是永久碎片身份。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
      }else{Text(this.fragments.reason).fontSize(10).fontColor('#ABA6C0').width('100%')}
    }.width('100%')
  }
  @Builder
  sphControls() {
    Column({space:8}) {
      Text(this.info.config?.preset===2?'岩球内部发生了什么':'碰撞内部发生了什么').fontSize(15).fontColor('#E2EEF5').width('100%')
      Text('SPH 诊断 · '+this.info.time.toFixed(2)+' s').fontSize(11).fontColor('#B7C5D5').width('100%')
      if(this.info.sph?.available) {
        Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(6)}}) {
          if(this.info.sph?.response){
            ChoiceChip({label:'热软化外观',active:this.colorMode===7,onPress:()=>{this.press('color.7');}}).id('sph-thermal')
            ChoiceChip({label:'剩余强度',active:this.colorMode===8,onPress:()=>{this.press('color.8');}}).id('sph-strength')
          }
          ChoiceChip({label:'压力',active:this.colorMode===3,onPress:()=>{this.press('color.3');}}).id('sph-pressure')
          ChoiceChip({label:'比内能',active:this.colorMode===4,onPress:()=>{this.press('color.4');}}).id('sph-internal')
          ChoiceChip({label:'材料损伤',active:this.colorMode===5,onPress:()=>{this.press('color.5');}}).id('sph-damage')
          if(this.fragments.available){ChoiceChip({label:'材料团块',active:this.colorMode===6,onPress:()=>{this.press('color.6');}}).id('sph-fragments-color')}
        }.width('100%')
        Text(this.sphLegend()+(this.colorMode===6?'。':'；超出色标的值仅在显示时饱和。')).id('sph-legend').fontSize(11).fontColor('#D2C3E9').lineHeight(16).width('100%')
        if(this.info.sph?.response){
          Text('破坏与热软化').fontSize(13).fontColor('#FFD1A5').width('100%')
          MetricRow({label:'严重损伤质量 · D ≥ 0.9',value:((this.info.sph?.response?.damagedMassFraction??0)*100).toFixed(2)+' %'})
          MetricRow({label:'平均热软化',value:((this.info.sph?.response?.softeningMean??0)*100).toFixed(2)+' %'})
          MetricRow({label:'热致零屈服强度质量',value:((this.info.sph?.response?.zeroShearMassFraction??0)*100).toFixed(2)+' %'})
          MetricRow({label:'平均剩余屈服强度',value:((this.info.sph?.response?.strengthMean??0)*100).toFixed(2)+' %'})
          Text('内能达到 3.4 MJ/kg 后，本材料模型不再承受剪切屈服应力。压缩压力与引力仍可作用；未计算液相比例、潜热或冷却结壳。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
        }
        this.fragmentControls()
        this.sphCurveControls()
        if(this.sphSummary().available){
          Column({space:6}){
            Text('记录窗口 · '+this.sphSummary().firstTime!.toFixed(2)+'–'+this.sphSummary().lastTime!.toFixed(2)+' s').id('sph-window-summary').fontSize(12).fontColor('#DCCEF3').width('100%')
            MetricRow({label:'尺度最大偏离',value:this.sphSummary().maxRadiusChangePercent!.toPrecision(4)+' %'})
            MetricRow({label:'平均相对动能',value:this.sphSummary().meanKineticJ!.toPrecision(4)+' J'})
            MetricRow({label:'径向速度绝对峰值',value:this.sphSummary().peakAbsRadialMS!.toPrecision(4)+' m/s'})
            Text(this.sphSummary().includesInitial?'相对本次计算初始帧；统计不判定平衡或再聚合。':'初始帧已不在记录中；偏离量只相对窗口首帧，不代表全程。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
          }.width('100%')
        }
        MetricRow({label:'压力 · 质量加权均值',value:this.sphNumber(this.info.sph?.pressureMeanGPa,'GPa')})
        Text('范围 '+this.sphNumber(this.info.sph?.pressureMinGPa,'')+' → '+this.sphNumber(this.info.sph?.pressureMaxGPa,'GPa')).fontSize(11).fontColor('#B7C5D5').width('100%')
        MetricRow({label:'比内能 · 质量加权均值',value:this.sphNumber(this.info.sph?.internalMeanMJkg,'MJ/kg')})
        Text('范围 '+this.sphNumber(this.info.sph?.internalMinMJkg,'')+' → '+this.sphNumber(this.info.sph?.internalMaxMJkg,'MJ/kg')).fontSize(11).fontColor('#B7C5D5').width('100%')
        MetricRow({label:'损伤 · 质量加权均值',value:this.sphNumber(this.info.sph?.damageMean,'')})
        MetricRow({label:'损伤 · 最大值',value:this.sphNumber(this.info.sph?.damageMax,'')})
        MetricRow({label:'动能',value:this.sphNumber(this.info.sph?.kineticJ,'J')})
        MetricRow({label:'内能',value:this.sphNumber(this.info.sph?.internalJ,'J')})
        if(this.info.sph?.structure!==undefined){
          MetricRow({label:'引力势能',value:this.sphNumber(this.info.sph?.structure![0],'J')})
          MetricRow({label:'相对动能',value:this.sphNumber(this.info.sph?.structure![1],'J')})
          MetricRow({label:'分布尺度',value:this.sphNumber(this.info.sph?.structure![2],'km')})
          MetricRow({label:'平均径向速度',value:this.sphNumber(this.info.sph?.structure![3],'m/s')})
        }
        Text('相对动能扣除整体平移；分布尺度为全部材料距质心的质量加权均方根距离，并非天体表面半径。径向速度为负表示平均向内运动，不代表碎片已经聚合。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
        Text('压力保留正负号；比内能不是温度。损伤是材料模型中 0–1 的强度退化量，不等于碎片数量。均值按粒子质量加权，随时间轴回看。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
        Text('引力势能来自同一软化引力模型；关闭自引力时为零。尚未计入弹性应变能，不能当作完整守恒预算。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
      } else {Text(this.info.state==='replay'?'旧回放没有压力、内能或损伤记录；重新运行实验后可查看。':'等待 SPH 初始帧').fontSize(12).fontColor('#B7C5D5').width('100%')}
      Divider().color('#33B4A7D6')
    }.width('100%')
  }
  @Builder
  impactControls() {
    if(this.contactMode()) {
      Column({space:6}) {
        ChoiceChip({label:'模拟这次撞击',enabledAction:this.info.state==='paused'&&this.info.selected<0&&this.info.contact?.incoming?.withinCurrentBounds===true&&!this.dirty&&!this.orbitDraft&&!this.trace.enabled&&this.orbitDrafts.length===0&&this.orbitUndo.length===0&&this.orbitRedo.length===0,onPress:()=>{this.press('impact.simulate');}})
        Text('撞击初值 · 反弹前').fontSize(15).fontColor('#EBC08B').width('100%')
        if(this.info.contact?.incoming?.available) {
          Text('相对速度 '+this.info.contact!.incoming!.relativeSpeedKmS!.toFixed(3)+' km/s · 入射角 '+this.info.contact!.incoming!.contactAngleDegrees!.toFixed(1)+'°').fontSize(12).fontColor('#E2EEF5').width('100%')
          Text('质心系动能 '+this.info.contact!.incoming!.kineticEnergyJ!.toExponential(3)+' J').fontSize(11).fontColor('#B7C5D5').width('100%')
          ForEach(this.info.contact!.incoming!.bodies!, (body:LocalImpactBody)=>{
            Text('天体 '+body.id+' · 半径 '+body.radiusKm.toFixed(1)+' km · 密度 '+body.densityKgM3.toFixed(0)+' kg/m³').fontSize(11).fontColor('#B7C5D5').width('100%')
          })
        }
        Text(this.info.contact?.incoming?.reason??'等待接触事件').fontSize(11).fontColor('#D1BB9A').lineHeight(18).width('100%')
        Text('撞速取积分的入射半步。可用冷态、无自转的岩质模型进行局部 SPH 实验；外部引力暂不耦合。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
        Divider().color('#33B4A7D6')
      }.id('impact-plan').width('100%')
    }
  }
  @Builder
  observationControls() {
    Column({space:8}) {
      Text('轨道观察 · '+(this.observed.name||'等待初始帧')).fontSize(15).fontColor('#E2EEF5').width('100%')
      Row({space:6}) {
        ChoiceChip({label:'距恒星',active:this.observationMetric==='distance',onPress:()=>{this.press('observation.distance');}}).id('observation-distance')
        ChoiceChip({label:'速度',active:this.observationMetric==='speed',onPress:()=>{this.press('observation.speed');}}).id('observation-speed')
      }.width('100%')
      if(this.observationView().available) {
        Row({space:8}) {
          Text('当前 · '+this.observed.name).id('comparison-current-legend').fontSize(10).fontColor('#A9E1EF').layoutWeight(1).maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis})
          if(this.comparisonView().referenceVisible) {
            Text('参照 · '+this.comparisonReference!.data.name).id('comparison-reference-legend').fontSize(10).fontColor('#EBC08B').layoutWeight(1).maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis})
          }
        }.width('100%')
        Text(this.observationView().current.toPrecision(5)+' '+this.observationView().unit+' · '+this.observationView().currentTime.toFixed(3)+' 年').fontSize(13).fontColor('#BDE9FF').width('100%')
        Text(this.observationView().high.toPrecision(5)+' '+this.observationView().unit).fontSize(10).fontColor('#ABA6C0').width('100%')
        Stack({alignContent:Alignment.TopStart}) {
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath('M0 0 L240 0 M0 50 L240 50 M0 100 L240 100')).stroke('#414055').strokeWidth(1).fillOpacity(0)
          if(this.comparisonView().referenceVisible) {
            Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.comparisonView().referencePath)).stroke('#EBC08B').strokeWidth(2).fillOpacity(0)
          }
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.observationView().path)).stroke('#A9E1EF').strokeWidth(2).fillOpacity(0)
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.observationView().cursorPath)).stroke('#CDB9F0').strokeWidth(1).fillOpacity(0)
        }.id('observation-plot').width(this.observationWidth()).height(this.observationWidth()*100/240).clip(true)
        Row(){Text(this.observationView().low.toPrecision(5)+' '+this.observationView().unit).fontSize(10).fontColor('#ABA6C0');Blank();Text(this.observationView().firstTime.toFixed(3)+'–'+this.observationView().lastTime.toFixed(3)+' 年').fontSize(10).fontColor('#ABA6C0')}.width('100%')
        Row({space:6}) {
          ChoiceChip({label:'记录最小',onPress:()=>{this.press('observation.minimum');}}).id('observation-minimum')
          ChoiceChip({label:'记录最大',onPress:()=>{this.press('observation.maximum');}}).id('observation-maximum')
        }.width('100%')
        Text('最小 '+this.observationView().minimum.toPrecision(5)+' / 最大 '+this.observationView().maximum.toPrecision(5)+' '+this.observationView().unit).fontSize(10).fontColor('#B7C5D5').width('100%')
      } else {Text('运行轨道实验后显示曲线').fontSize(12).fontColor('#B7C5D5')}
      Button(this.comparisonReference?'替换为本次结果':'保存本次作参照',{type:ButtonType.Normal}).id('comparison-capture').width('100%').height(36).borderRadius(18).fontSize(12).backgroundColor('#334F416E').fontColor('#D9CCF5')
        .enabled(this.observed.samples.length>=2&&!this.ioBusy).onClick(()=>{this.press('comparison.capture');})
      if(this.comparisonReference) {
        Column({space:6}) {
          Text('金色 · '+this.referenceCaption()).id('comparison-reference').fontSize(11).fontColor('#EBC08B').lineHeight(16).width('100%')
          Text(this.referenceParameters()).fontSize(10).fontColor('#B8AFA7').width('100%')
          Row({space:6}) {
            ChoiceChip({label:this.comparisonShown?'隐藏参照':'显示参照',active:this.comparisonShown,onPress:()=>{this.press('comparison.toggle');}}).id('comparison-toggle')
            ChoiceChip({label:'移除参照',onPress:()=>{this.press('comparison.clear');}}).id('comparison-clear')
          }.width('100%')
          if(this.comparisonShown&&this.observationView().available) {
            Text(this.comparisonView().deltaReady?'当前 − 参照 '+this.comparisonView().delta.toPrecision(5)+' '+this.observationView().unit+' · 参照按当前时刻线性插值':(this.comparisonView().overlap?'当前时刻不在参照范围内':'两组采样时间不重叠')).id('comparison-delta').fontSize(10).fontColor('#B7C5D5').lineHeight(16).width('100%')
          }
        }.width('100%')
      }
      if(this.comparisonError!=='') {
        Text(this.comparisonError).fontSize(10).fontColor('#F4A993').width('100%')
        Row({space:6}) {
          ChoiceChip({label:'重试读取',onPress:()=>{this.press('comparison.reload');}})
          ChoiceChip({label:'移除参照',onPress:()=>{this.press('comparison.clear');}})
        }
      }
      Text((this.observationMetric==='distance'?'相对恒星中心的距离':'系统质心参考系中的速率')+'；最近 '+this.observed.samples.length+' / 240 帧。选择行星可切换对象，全景观察第一颗行星；采样极值不代表完整轨道近远点。').fontSize(10).fontColor('#ABA6C0').lineHeight(16)
      Divider().color('#33B4A7D6')
    }.width('100%')
  }
  @Builder
  header() {
    Row({space:6}) {
      Image($r('app.media.ic_orbit')).width(28).height(28).margin({right:2})
      if(this.viewportWidth>=600&&!this.layout().compact) {Text('星体实验室').fontSize(15).fontColor('#EFEDFA').fontWeight(FontWeight.Medium)}
      ChoiceChip({label:'视频',active:this.videoOpen,onPress:() => {this.press('video.open');}})
      Blank()
      if(this.info.impact?.canReturn){ChoiceChip({label:this.layout().safe.width<480?'返回':'返回轨道',onPress:()=>{this.press('impact.return');}})}
      FloatingButton({label:'参数',compact:this.layout().safe.width<480,icon:$r('app.media.ic_sliders'),active:this.panelOpen&&this.tab===0,onPress:() => {this.press('panel.parameters');}})
      FloatingButton({label:'观察',compact:this.layout().safe.width<480,icon:$r('app.media.ic_observe'),active:this.panelOpen&&this.tab===1,onPress:() => {this.press('panel.observe');}})
      FloatingButton({label:'实验库',compact:this.layout().safe.width<480,icon:$r('app.media.ic_library'),active:this.panelOpen&&this.tab===2,onPress:() => {this.press('panel.library');}})
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
          PanGesture({fingers:1}).onActionStart(() => {if(this.placing||this.galaxyPlacing)return;if(this.observerMode>0){this.observerDragYaw=this.observerYaw;this.observerDragPitch=this.observerPitch;return;}this.stopCameraMotion();this.dragYaw=this.yaw;this.dragPitch=this.pitch;})
            .onActionUpdate((e:GestureEvent) => {if(this.observerMode>0){this.observerYaw=Math.max(-100,Math.min(100,this.observerDragYaw-e.offsetX*0.004));this.observerPitch=Math.max(-1.5,Math.min(1.5,this.observerDragPitch+e.offsetY*0.004));this.updateGalaxyObserver();return;}if(this.galaxyPlacing){this.dragGalaxyPlacement(e);return;}if(this.placing){this.dragViewportPlacement(e);return;}this.yaw=Math.max(-100,Math.min(100,this.dragYaw+e.offsetX*0.006));this.pitch=Math.max(-1.5,Math.min(1.5,this.dragPitch+e.offsetY*0.006));this.camera();}),
          PinchGesture({fingers:2}).onActionStart(() => {if(this.observerMode>0){this.observerPinchFov=this.observerFov;return;}this.stopCameraMotion();this.pinchZoom=this.zoom;})
            .onActionUpdate((e:GestureEvent) => {if(this.observerMode>0){this.observerFov=Math.max(35,Math.min(120,this.observerPinchFov/e.scale));this.updateGalaxyObserver();return;}this.zoom=Math.max(0.5,Math.min(15,this.pinchZoom/e.scale));this.camera();})
        ))
      if(this.toolsVisible&&this.observerMode>0&&!this.panelOpen){this.galaxyObserverDock()}
      if(this.galaxyPlacing){this.galaxyPlacementDock()}
      if(this.placing&&!this.panelOpen) {this.placementDock()}
      if(this.toolsVisible&&this.observerMode===0&&!this.placing&&!this.galaxyPlacing&&!(this.closeup&&this.panelOpen)&&!(this.preset===6&&this.panelOpen&&!this.layout().sidePanel)) {
        Column({space:5}) {
          Text(this.closeup?this.surfaceName()+' · 近看':this.title).fontColor('#F1EDFC').fontSize(14).fontWeight(FontWeight.Medium).maxLines(1)
          Text(this.stateLabel()+' · '+(this.trace.enabled?this.trace.count+' 个环粒子':this.info.count+(this.preset===6?(this.info.config?.galaxyResponsive?' 个带质量恒星群':' 个恒星示踪点'):this.isOrbit()?' 个天体':' 粒子'))).fontSize(11).fontColor('#A5A0B7')
          if(this.isOrbit()&&this.info.continuous){Text('持续时间 · 目标 '+(this.info.daysPerSecond??1)+' 天/秒'+(this.info.state==='running'?' · 实际 '+(this.info.actualDaysPerSecond??0).toFixed(2)+' 天/秒':' · 已暂停')).fontSize(11).fontColor('#B4BDCC')}
          if(this.contactMode()){Text('理想弹性球体 · 接触 '+(this.info.contact?.count??0)+' 次 · '+(this.info.time*31557600).toFixed(1)+' 秒').id('contact-hud').fontSize(12).fontColor('#CBE8EE')}
          if(this.isOrbit()&&!this.contactMode()&&!this.layout().compact) {Text(this.trace.enabled?'中心引力 · 开普勒轨道 · 不含碰撞':this.closeup?(this.selectedMoon()?'NASA SVS 月面底图 · 非实时月相':(this.autoSpin?'程序表面 · 外观自转演示':'程序表面 · 随轨道时间变化')):'牛顿引力 · AU / 年 · 天体尺寸已放大').fontSize(10).fontColor('#9E97B4')}
          if(this.isOrbit()&&!this.closeup&&!this.layout().compact) {Text(this.focus>=0?'已选中 · '+this.surfaceName():'轻点天体以选中 · 拖动旋转').fontSize(11).fontColor('#C9B8F3')}
          if(this.skyMode===2&&!this.layout().compact) {Text(this.rendering.panoramaReady?'银河摄影 · 非定位星图':(this.skyLoadError?'银河示意 · 摄影全景加载失败':'银河背景 · 载入摄影全景')).fontSize(10).fontColor('#9E97B4')}
          if(this.preset===6&&!this.layout().compact){Text('星系潮汐 · 千秒差距 / 百万年 · '+(this.info.config?.galaxyResponsive?'恒星与中心双向引力':'无质量恒星群')).fontSize(10).fontColor('#9E97B4')}
          if(this.preset<3) {Text((this.info.config?.relaxationSeconds??0)>0?'岩质 SPH · 预松弛 '+this.info.config?.relaxationSeconds+' s':this.info.config?.selfGravity===true?'岩质 SPH · 自引力开启':'岩质 SPH · 未启用自引力').fontSize(10).fontColor('#9E97B4')}
          if(this.rendering.fragmentFollow.active){Text('跟随团块 #'+this.rendering.fragmentFollow.rank+' · '+this.rendering.fragmentFollow.count+' 粒子').id('sph-follow-hud').fontSize(11).fontColor(this.fragmentColor(this.rendering.fragmentFollow.anchor))}
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
    if(this.cameraFlight==='queued'||this.cameraFlight==='running') {ChoiceChip({label:'停在这里',onPress:()=>{this.press('camera.cancel');}})}
    if(this.focus>=0&&this.preset===5) {ChoiceChip({label:'编辑',onPress:() => {this.press('selection.edit');}})}
    if(this.focus>=0&&(this.info.orbitState??[]).length<8) {
      ChoiceChip({label:'添加卫星',onPress:()=>{this.press('selection.satellite');}})
      ChoiceChip({label:'向它发射',onPress:()=>{this.press('selection.launch');}})
      ChoiceChip({label:'附近投放',onPress:()=>{this.press('selection.drop');}})
    }
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
    if(this.isOrbit()) {ChoiceChip({label:'＋ 加入天体',enabledAction:(this.info.orbitState??[]).length>=2&&(this.info.orbitState??[]).length<8,onPress:()=>{this.press('orbit.add');}})
      ForEach([.01,.1,1,10,100],(rate:number)=>{ChoiceChip({label:rate+' 天/秒',active:this.info.continuous===true&&this.orbitDays===rate,onPress:()=>{this.press('time.rate.'+rate);}})})
    }
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
      if(this.trace.enabled) {
        Column({space:4}) {
          Row({space:6}) {
            Text(this.trace.timeHours.toFixed(2)+' h').fontSize(12).fontColor('#C8EAF0').width(58)
            Slider({value:this.trace.timeHours,min:0,max:24,step:.01}).id('ring-time-slider').layoutWeight(1).height(30).selectedColor('#9CDEED').trackColor('#404154').blockColor('#F1E9FF')
              .onChange((v:number,mode:SliderChangeMode)=>{if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End)this.input('trace.hours',v);})
            FloatingButton({label:this.trace.running?'暂停':'运行环',primary:true,compact:true,onPress:()=>{this.press('trace.play');}})
            FloatingButton({label:'调轨',compact:true,onPress:()=>{this.press('trace.controls');}})
            if(this.layout().sidePanel&&!this.layout().compact){FloatingButton({label:'归零',compact:true,onPress:()=>{this.press('trace.reset');}})}
          }.width('100%')
          Text('内圈 '+this.trace.innerPeriodHours.toFixed(2)+' h · 外圈 '+this.trace.outerPeriodHours.toFixed(2)+' h / 周').id('ring-periods').fontSize(10).fontColor('#A7D5DD')
          if(!this.layout().compact){Text('局部环时钟 · 1 秒演示 '+this.trace.rateHours.toFixed(1)+' 小时 · 主系统暂停').fontSize(10).fontColor('#AAA6BC')}
        }.id('ring-transport').width('100%')
      } else if(this.layout().compact) {
        Row({space:6}) {
          Text(this.contactMode()?(this.info.time*31557600).toFixed(0)+' s':this.isOrbit()?(this.info.time*365.25).toFixed(3)+' d':this.info.time.toFixed(2)+(this.timeLabel())).fontSize(11).fontColor('#E9E2F5').width(this.isOrbit()?92:50).maxLines(1).minFontSize(9)
          Slider({value:this.info.selected<0?Math.max(0,this.info.frames-1):this.info.selected,min:0,max:Math.max(1,this.info.frames-1),step:1})
            .id('history-slider-compact').layoutWeight(1).height(30).selectedColor('#BEABF5').trackColor('#404154').blockColor('#F1E9FF')
            .enabled(this.info.frames>1&&!this.ioBusy).onChange((v:number,mode:SliderChangeMode)=>{
              if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End){this.input('time.frame',Math.round(v));}
            })
          FloatingButton({label:this.playing?'停播':'回放',compact:true,enabledAction:this.info.frames>1&&!this.ioBusy,onPress:()=>{this.press('replay.toggle');}})
          FloatingButton({label:this.simulationLabel(true),compact:true,primary:true,enabledAction:this.mainSimulationEnabled(),onPress:()=>{this.press(this.mainSimulationAction());}}).id('simulation-main-compact')
          FloatingButton({label:'最新',compact:true,onPress:()=>{this.press('replay.latest');}})
        }.width('100%').height(50)
      } else {

      Row({space:8}) {
        Text(this.contactMode()?(this.info.time*31557600).toFixed(0)+' s':this.isOrbit()?(this.info.time*365.25).toFixed(3)+' d':this.info.time.toFixed(2)+(this.timeLabel())).fontSize(13).fontColor('#F1EEFC').width(this.isOrbit()?112:65).maxLines(1).minFontSize(10).fontWeight(FontWeight.Medium)
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
        FloatingButton({label:this.simulationLabel(),primary:true,
          icon:this.info.state==='running'?$r('app.media.ic_pause'):$r('app.media.ic_play'),enabledAction:this.mainSimulationEnabled(),
          onPress:() => {this.press(this.mainSimulationAction());}}).id('simulation-main')
        FloatingButton({label:'最新',icon:$r('app.media.ic_latest'),compact:this.viewportWidth<380,onPress:() => {this.press('replay.latest');}})
      }.justifyContent(FlexAlign.Center).width('100%')
      }
      if(!this.trace.enabled||!this.layout().compact) {
      Text(this.rendering.error.length>0?'渲染异常：'+this.rendering.error:this.info.error.length>0?this.info.error:this.info.state==='preparing'?this.preparationHint():(this.isOrbit()&&!this.rendering.texturesReady?'正在准备行星表面…':this.ioBusy?'正在读写回放…':this.notice)).width('100%').textAlign(TextAlign.Center)
        .fontSize(10).fontColor(this.info.error.length>0||this.rendering.error.length>0?'#F8AD95':'#9996AE').maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis})
      }
    }.id('workspace-transport').enabled(!this.placing).position({x:this.layout().dock.x,y:this.layout().dock.y})
      .width(this.dockWidth()).height(this.layout().dock.height)
      .transition(TransitionEffect.OPACITY.combine(TransitionEffect.translate({y:20})).animation({curve:curves.springMotion(0.32,0.90)}))
  }
  @Builder
  drawer() {
    Column({space:0}) {
      Row() {
        Column({space:3}) {
          Text(this.placing?'放置天体':this.tab===0?(this.preset===6?(this.galaxyResponsive?'恒星参与星系引力':'让引力拉出长尾'):this.preset===5?'编辑 · '+this.orbitBodies[this.orbitEdit].name:(this.isOrbit()?'让引力描绘轨道':'构建一次相遇')):(this.tab===1?'换一种方式观察':(this.librarySection==='saved'?'我的实验':'主题实验'))).fontSize(18).fontWeight(FontWeight.Medium).fontColor('#F4F0FF').maxLines(1).textOverflow({overflow:TextOverflow.Ellipsis})
          Text(this.placing?'先预览，再确认加入':this.tab===0?(this.preset===5?'初始条件 · 草稿保留在本次会话':'实验参数'):(this.tab===1?'观察与记录':'实验库')).fontSize(10).fontColor('#ACA4C8')
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Blank()
        ChoiceChip({label:'收起',onPress:() => {this.press('panel.close');}})
      }.width('100%').height(this.layout().compact?54:70).padding({left:20,right:16})
      Divider().color('#25D4CDEF').margin({left:20,right:20})
      Scroll(this.scroller) {
        if(((this.info.impact?.local||this.info.impact?.canReturn)&&this.tab===0)||(this.info.impact?.canReturn&&this.tab===2)) {
          Column({space:12}) {
            Text('初始条件来自这次真实接触，局部实验中保持不变。可在观察页查看破坏与热软化，也可保存回放。').fontSize(13).fontColor('#D9CCF5').lineHeight(22)
            if(this.info.impact?.canReturn){ChoiceChip({label:'返回轨道',onPress:()=>{this.press('impact.return');}})}
            ChoiceChip({label:'查看碰撞结果',onPress:()=>{this.press('panel.observe');}})
          }.padding(20).width('100%')
        } else {this.inspector()}
      }.layoutWeight(1).width('100%').scrollBar(BarState.Off)
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
      Row({space:6}) {
        ChoiceChip({label:'球体接触实验',onPress:()=>{this.press('orbit.contact.demo');}})
        ChoiceChip({label:'小岩体撞击初值',onPress:()=>{this.press('orbit.impact.demo');}})
        if(!this.contactMode()){ChoiceChip({label:'启用接触',onPress:()=>{this.press('orbit.contact');}})}
      }
      if(this.contactMode()){ChoiceChip({label:'查看撞击初值',onPress:()=>{this.press('impact.inspect');}});Text('理想弹性球体 · 半径参与接触，质量与半径独立设置 · 接触后自动暂停，不含破裂或合并').fontSize(11).fontColor('#D1BB9A')}
      Text(this.orbitUndo.length?'可撤销：'+this.editHistory().undoLabel:'天体编辑可撤销 · 本次会话保留 20 步').fontSize(10).fontColor('#ACA5C0').maxLines(2)
      Flex({wrap:FlexWrap.Wrap}) {
        ForEach(this.orbitBodies,(b:OrbitBodyConfig,i:number)=>{
          ChoiceChip({label:b.name.slice(0,10)+(this.hasBodyDraft(i)?' · 草稿':''),active:this.orbitEdit===i,onPress:()=>{this.press('orbit.select.'+i);}}).margin({right:6,bottom:6})
        })
      }.width('100%')
      if(this.orbitEdit>0) {
        Button('复制并放置',{type:ButtonType.Normal}).id('orbit-copy').width('100%').height(38).borderRadius(19).fontSize(12).backgroundColor('#334F416E').fontColor('#D9CCF5')
          .enabled(this.orbitBodies.length<8&&!this.ioBusy).onClick(()=>{this.press('orbit.copy');})
        Text(this.orbitBodies.length>=8?'已达 8 个天体上限':this.orbitDraft?'复制已应用的质量与外观；当前草稿会保留':'沿用质量与外观，为新行星设置轨道').fontSize(10).fontColor('#ACA5C0').lineHeight(16)
      }
      TextInput({text:this.orbitName,placeholder:'天体名称'}).id('orbit-name').maxLength(48).height(40).borderRadius(16).fontColor('#EBE7F8').backgroundColor('#5533334D')
        .onChange((v:string)=>{this.input('orbit.name',v);})
      if(this.orbitEdit>0) {
        Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
          ChoiceChip({label:'海洋',active:this.orbitSurface===1,onPress:()=>{this.press('orbit.surface.1');}})
          ChoiceChip({label:'厚云',active:this.orbitSurface===2,onPress:()=>{this.press('orbit.surface.2');}})
          ChoiceChip({label:'荒漠',active:this.orbitSurface===3,onPress:()=>{this.press('orbit.surface.3');}})
          ChoiceChip({label:'带环',active:this.orbitSurface===4,onPress:()=>{this.press('orbit.surface.4');}})
          ChoiceChip({label:'月面',active:this.orbitSurface===5,onPress:()=>{this.press('orbit.surface.5');}})
        }
      }
      ForEach(this.contactMode()?this.orbitLabels.concat(['半径 · km']):this.orbitLabels,(label:string,i:number)=>{
        Row({space:8}) {
          Text(i===0?(this.orbitSurface===0?'质量 · 太阳':'质量 · 地球'):label).fontSize(12).fontColor('#B6ADC9').width(92)
          TextInput({text:this.orbitFields[i]}).id('orbit-value-'+i).height(38).layoutWeight(1).borderRadius(14).fontColor('#EBE7F8').backgroundColor('#4533334D')
            .onChange((v:string)=>{this.input('orbit.value.'+i,v);})
        }.width('100%')
      })
      Text('位置 ±10 AU · 速度合计 ≤100 km/s。系统自动转为质心参考系；表面风格不改变质量。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      Text('应用和删除仍修改初态，可撤销并清空旧轨迹。加入天体则保留当前时间和轨迹，清除初态编辑撤销记录。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
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
  placementDock() {
    Column({space:8}) {
      Text(this.placementName+' · '+(this.placementParent>0?(this.placementDistanceAU()*AU_KM).toFixed(0)+' km 中心距':this.placementDistanceAU().toFixed(2)+' AU')).maxLines(1).fontSize(14).fontColor('#E5E7FF')
      Text(this.placementPreview().valid?(this.placementPromotesContact?'确认时启用估算实体半径 · 拖动调整位置':'当前时刻预览 · 轻点 / 拖动放置 · 双指缩放'):this.placementPreview().error).fontSize(11).fontColor(this.placementPreview().valid?'#BCBDD8':'#F4A993')
      Row({space:6}) {
        ChoiceChip({label:'取消',onPress:()=>{this.press('placement.cancel');}})
        ChoiceChip({label:'参数',onPress:()=>{this.press('placement.options');}})
        ChoiceChip({label:'确认加入',enabledAction:this.placementPreview().valid,onPress:()=>{this.press('placement.confirm');}})
      }
    }.id('placement-dock').padding(12).borderRadius(22).backgroundColor('#8820283A')
      .position({x:this.layout().scene.x+Math.max(0,(this.layout().scene.width-282)/2),y:this.layout().safe.y+12}).width(282)
  }
  @Builder
  placementControls() {
    Column({space:10}) {
      Text(this.placementSource>0?'来自 '+this.orbitBodies[this.placementSource].name+' · 已应用的质量与外观':'围绕 '+this.placementParentName()+' 放置').fontSize(13).fontColor('#D1C1F0').width('100%')
      if(finiteOrbitBodies(this.placementBodies)) {
        Flex({wrap:FlexWrap.Wrap}) {
          ChoiceChip({label:'公斤 / 公里 / 秒',active:this.placementUnits.mass==='kg',onPress:()=>{this.press('placement.units.physical');}})
          ChoiceChip({label:'天文单位',active:this.placementUnits.mass==='astronomical',onPress:()=>{this.press('placement.units.astro');}})
          ChoiceChip({label:'15 km 岩质小行星',onPress:()=>{this.press('placement.rock');}})
        }
      }
      ForEach(this.placementLabels(),(label:string,i:number)=>{
        Row({space:8}) {
          Text(label).fontSize(11).fontColor('#B6ADC9').width(96)
          TextInput({text:this.placementFields[i]}).fontSize(12).height(38).layoutWeight(1).borderRadius(14).fontColor('#EBE7F8').backgroundColor('#4533334D')
            .onChange((v:string)=>{this.input('placement.value.'+i,v);})
        }.width('100%')
      })
      if(finiteOrbitBodies(this.placementBodies)) {
        Flex({wrap:FlexWrap.Wrap}) {
          ChoiceChip({label:'距母体中心',active:this.placementUnits.distance==='km',onPress:()=>{this.press('placement.units.center');}})
          ChoiceChip({label:'距母体表面',active:this.placementUnits.distance==='altitude',onPress:()=>{this.press('placement.units.altitude');}})
          ChoiceChip({label:'半径',active:this.placementUnits.size==='radius',onPress:()=>{this.press('placement.units.radius');}})
          ChoiceChip({label:'直径',active:this.placementUnits.size==='diameter',onPress:()=>{this.press('placement.units.diameter');}})
        }
        Text('高度以新天体中心计；需大于自身半径。质量与尺寸可独立编辑，15 km 快捷项按均匀岩石密度估算质量。').fontSize(10).fontColor('#B6ADC9')
      }
      Text('当前时刻加入 · 原有位置、速度与时间保留；最多 8 个实体天体').fontSize(11).fontColor('#ACA5C0').lineHeight(16)
      Row({space:8}) {
        ChoiceChip({label:'取消',onPress:()=>{this.press('placement.cancel');}})
        Button('在当前时刻加入').height(38).fontSize(12).backgroundColor('#D9CEFF').fontColor('#241B36').layoutWeight(1)
          .enabled(this.placementPreview().valid&&!this.ioBusy).onClick(()=>{this.press('placement.confirm');})
      }.width('100%')
      ChoiceChip({label:'返回星图放置',onPress:()=>{this.press('placement.options');}})
      ChoiceChip({label:'正对轨道面',onPress:()=>{this.press('placement.align');}})
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
      Text('辅助俯视图 · 主星图同样可以轻点或拖动放置\n紫线为二体估计，灰点为已有天体当前的位置投影').fontSize(10).fontColor('#ACA5C0').textAlign(TextAlign.Center)
      Row({space:6}) {
        ChoiceChip({label:'圆轨道',active:this.placementPreview().valid&&Math.abs(this.placementPreview().speedKmS/this.placementPreview().circularKmS-1)<1e-10,onPress:()=>{this.press('placement.circular');}})
        ChoiceChip({label:'直接投放',active:this.placementPreview().valid&&this.placementPreview().speedKmS===0,onPress:()=>{this.press('placement.still');}})
        ChoiceChip({label:'掠过',active:this.placementPreview().valid&&Math.abs(this.placementPreview().speedKmS/this.placementPreview().circularKmS-1.45)<1e-10,onPress:()=>{this.press('placement.escape');}})
        ChoiceChip({label:'反向',active:this.placementDirection===-1,onPress:()=>{this.press('placement.reverse');}})
      }
      Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(6)}}) {
        ForEach(this.placementBodies,(b:OrbitBodyConfig,i:number)=>{ChoiceChip({label:'瞄准 '+b.name,active:this.placementTarget===i,onPress:()=>{this.press('placement.target.'+i);}})})
      }
      Text(this.placementTarget>=0?(finiteOrbitBodies(this.placementBodies)?'按当前位置瞄准 · 实体接触后弹性响应并暂停':'按目标当前位置定向发射 · 引力会改变路径；实体碰撞尚未接通'):'' ).fontSize(10).fontColor('#D1BB9A')
      Text(this.placementPreview().valid?'相对 '+this.placementParentName()+' '+this.placementPreview().speedKmS.toFixed(2)+' km/s · '+(this.placementPreview().speedKmS===0?'相对母体静止投放':this.placementPreview().bound?'二体束缚轨道':'二体非束缚轨道'):this.placementPreview().error)
        .fontSize(11).fontColor(this.placementPreview().valid?'#AECFD9':'#F4A993').width('100%')
      if(this.placementPromotesContact){Text('确认将按估算半径启用实体接触；保留原位置、速度与时间。接触仍为弹性反弹，尚无熔融。').fontSize(11).fontColor('#D1BB9A')}
      TextInput({text:this.placementName,placeholder:'新行星名称'}).height(38).fontColor('#EBE7F8').backgroundColor('#4533334D').borderRadius(14)
        .onChange((v:string)=>{this.input('placement.name',v);})
      Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
        ChoiceChip({label:'恒星',active:this.placementSurface===0,onPress:()=>{this.press('placement.surface.0');}})
        ChoiceChip({label:'海洋',active:this.placementSurface===1,onPress:()=>{this.press('placement.surface.1');}})
        ChoiceChip({label:'厚云',active:this.placementSurface===2,onPress:()=>{this.press('placement.surface.2');}})
        ChoiceChip({label:'荒漠',active:this.placementSurface===3,onPress:()=>{this.press('placement.surface.3');}})
          ChoiceChip({label:'带环',active:this.placementSurface===4,onPress:()=>{this.press('placement.surface.4');}})
          ChoiceChip({label:'月面',active:this.placementSurface===5,onPress:()=>{this.press('placement.surface.5');}})
      }
      Text('速度相对所选母体；倾角围绕 X 轴。确认保留当前时间与原有天体状态，取消保留原模拟与草稿。接触仍为弹性响应，尚未接入破碎和熔融。').fontSize(10).fontColor('#ACA5C0').lineHeight(16)
    }.width('100%')
  }
  @Builder
  traceControls() {
    Column({space:8}) {
      Text('让整条环一起运动').fontSize(16).fontColor('#E2EEF5').width('100%')
      Row({space:6}) {
        ChoiceChip({label:'圆轨道',active:this.trace.speedScale===1,onPress:()=>{this.press('trace.circular');}})
        ChoiceChip({label:'拉长轨道',active:Math.abs(this.trace.speedScale-1.12)<.00001,onPress:()=>{this.press('trace.ellipse');}})
        ChoiceChip({label:'到远点',enabledAction:this.trace.innerPeriodHours/2<=24,onPress:()=>{this.press('trace.apoapsis');}})
      }.width('100%')
      Row({space:6}) {
        ChoiceChip({label:'局部扰动',active:this.trace.impulse>0,onPress:()=>{this.press('trace.disturb');}})
        ChoiceChip({label:'清除扰动',onPress:()=>{this.press('trace.clear');}})
        ChoiceChip({label:'看颗粒',active:this.trace.points,onPress:()=>{this.press('trace.points');}})
      }.width('100%')
      Text('局部径向速度 +'+(this.trace.impulse*100).toFixed(0)+'% · 改变后从起点观察').fontSize(11).fontColor('#DAC6A4').width('100%')
      Slider({value:this.trace.impulse,min:0,max:.35,step:.01}).id('ring-impulse-slider').width('100%').height(28).selectedColor('#DAC6A4').trackColor('#3C4058')
        .onChange((v:number,mode:SliderChangeMode)=>{if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End)this.input('trace.impulse',v);})
      Text('发射速度 '+this.trace.speedScale.toFixed(2)+' × 圆轨道速度').fontSize(12).fontColor('#BAE2ED').width('100%')
      Slider({value:this.trace.speedScale,min:1,max:1.2,step:.01}).id('ring-speed-slider').width('100%').height(28).selectedColor('#A5DFFF').trackColor('#3C4058')
        .onChange((v:number,mode:SliderChangeMode)=>{if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End)this.input('trace.speed',v);})
      Text('慢放 / 快进 · '+this.trace.rateHours.toFixed(1)+' 小时 / 秒').fontSize(12).fontColor('#C2B6DF').width('100%')
      Slider({value:this.trace.rateHours,min:.1,max:4,step:.1}).id('ring-rate-slider').width('100%').height(28).selectedColor('#C4ACEB').trackColor('#3C4058')
        .onChange((v:number,mode:SliderChangeMode)=>{if(mode===SliderChangeMode.Moving||mode===SliderChangeMode.Click||mode===SliderChangeMode.End)this.input('trace.rate',v);})
      Row({space:8}) {
        Stack({alignContent:Alignment.TopStart}) {
          Path().width(112).height(95).commands(this.tracePlotPath()).stroke('#809EA9').strokeWidth(1.5).fillOpacity(0)
          Circle().width(2*68*(1-this.trace.eccentricity)/1.28*112/180).height(2*68*(1-this.trace.eccentricity)/1.28*112/180).fill('#755F78')
            .position({x:(90+68*this.trace.eccentricity-68*(1-this.trace.eccentricity)/1.28)*112/180,y:(76-68*(1-this.trace.eccentricity)/1.28)*112/180})
          Path().width(112).height(95).commands(this.tracePlotPath(true)).stroke('#A9F0F8').strokeWidth(3).fillOpacity(0)
        }.width(112).height(95).id('ring-orbit-preview')
        Column({space:4}) {
          Text('未扰动内缘参考轨道').fontSize(10).fontColor('#BADCE7').width('100%')
          Text('e = '+this.trace.eccentricity.toFixed(3)).id('ring-orbit-diagnostics').fontSize(11).fontColor('#BADCE7').width('100%')
          Text('近点 76,800 km').fontSize(10).fontColor('#BDB7CC').width('100%')
          Text('远点 '+this.trace.innerApoapsisKm.toFixed(0)+' km').fontSize(10).fontColor('#BDB7CC').width('100%')
          Text('当前 '+this.trace.referenceRadiusKm.toFixed(0)+' km').fontSize(10).fontColor('#BDB7CC').width('100%')
          Text(this.trace.referenceSpeedKmS.toFixed(2)+' km/s').fontSize(10).fontColor('#BDB7CC').width('100%')
        }.layoutWeight(1)
      }.width('100%')
      ChoiceChip({label:'回到起点',onPress:()=>{this.press('trace.reset');}})
      Text('环带和阴影由同一批 8192 个粒子生成。扰动是初始局部速度注入；仅中心引力，无颗粒互撞、自引力或撞击体。半径假定 60,000 km，缝隙预先设置。').fontSize(10).fontColor('#AAA5B9').lineHeight(16)
      Divider().color('#33B4A7D6')
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
  galaxyPlacementDock() {
    Column({space:8}) {
      Text('调整相遇 · '+this.galaxyPlacementOffset.toFixed(1)+' kpc').fontSize(15).fontColor('#E5E7FF')
      Text('上下拖动蓝色星系 · 双指缩放').fontSize(11).fontColor('#C1CCE0')
      Text('前后距离固定 60 kpc；错身距离 0–30 kpc').fontSize(10).fontColor('#A9A9BE')
      Slider({value:this.galaxyPlacementOffset,min:0,max:30,step:.5}).selectedColor('#AADFFF').onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('galaxy.placement.offset',v);})
      Row({space:8}) {
        ChoiceChip({label:'取消',onPress:()=>{this.press('galaxy.place.cancel');}}).id('galaxy-placement-cancel')
        ChoiceChip({label:'确认 · 重建初态',onPress:()=>{this.press('galaxy.place.confirm');}}).id('galaxy-placement-confirm')
      }
    }.id('galaxy-placement-dock').padding(12).borderRadius(22).backgroundColor('#8820283A').width(Math.min(this.layout().safe.width-24,this.layout().safe.width>this.layout().safe.height?232:292))
      .position({x:this.layout().safe.x+(this.layout().safe.width>this.layout().safe.height?12:Math.max(12,(this.layout().safe.width-292)/2)),y:this.layout().safe.y+10})
  }
  @Builder
  galaxyCurveControls() {
    Column({space:7}) {
      Text('随时间变化 · '+GALAXY_METRICS[this.galaxyMetric]).fontSize(13).fontColor('#D9CCF5').width('100%')
      Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(6)}}) {
        ForEach(GALAXY_METRICS,(label:string,i:number)=>{ChoiceChip({label:label,active:this.galaxyMetric===i,onPress:()=>{this.press('galaxy.metric.'+i);}})})
      }
      if(this.galaxyView().available){
        Text(this.galaxyView().current.toPrecision(4)+' '+this.galaxyView().unit+' · '+this.galaxyView().currentTime.toFixed(1)+' Myr').id('galaxy-curve-current').fontSize(12).fontColor('#A9E1EF')
        if(this.galaxyComparisonView().referenceVisible){Text('青色 · 当前　金色 · 参照').id('galaxy-comparison-legend').fontSize(10).fontColor('#EBC08B').width('100%')}
        Text(this.galaxyView().high.toPrecision(4)+' '+this.galaxyView().unit).fontSize(10).fontColor('#ABA6C0')
        Stack({alignContent:Alignment.TopStart}) {
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath('M0 0 L240 0 M0 50 L240 50 M0 100 L240 100')).stroke('#414055').strokeWidth(1).fillOpacity(0)
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.galaxyView().path)).stroke('#A9E1EF').strokeWidth(2).fillOpacity(0)
          if(this.galaxyComparisonView().referenceVisible){Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.galaxyComparisonView().referencePath)).stroke('#EBC08B').strokeWidth(2).fillOpacity(0)}
          Path().width(this.observationWidth()).height(this.observationWidth()*100/240).commands(this.observationPath(this.galaxyView().cursorPath)).stroke('#CDB9F0').strokeWidth(1).fillOpacity(0)
        }.id('galaxy-curve-plot').width(this.observationWidth()).height(this.observationWidth()*100/240).clip(true)
        Text(this.galaxyView().low.toPrecision(4)+' '+this.galaxyView().unit+' · '+this.galaxyView().firstTime.toFixed(1)+'–'+this.galaxyView().lastTime.toFixed(1)+' Myr').fontSize(10).fontColor('#ABA6C0')
        Row({space:8}) {
          ChoiceChip({label:'记录最小',onPress:()=>{this.press('galaxy.minimum');}})
          ChoiceChip({label:'记录最大',onPress:()=>{this.press('galaxy.maximum');}})
        }
        Text('仅定位已记录的采样极值；外延比例不等于逃逸质量。').fontSize(10).fontColor('#ABA6C0')
      }
    }.width('100%')
  }
  @Builder
  galaxyReferenceControls() {
    Column({space:7}) {
      Button(this.galaxyReference?'替换为本次结果':'保存本次作参照',{type:ButtonType.Normal}).id('galaxy-reference-capture').width('100%').height(36).borderRadius(18).fontSize(12).backgroundColor('#334F416E').fontColor('#D9CCF5')
        .enabled(this.galaxyObserved.available&&this.galaxyObserved.samples.length>=2&&!this.ioBusy).onClick(()=>{this.press('galaxy.reference.capture');})
      if(this.galaxyReference){
        Text('参照 · '+this.galaxyReference.title).id('galaxy-reference-title').fontSize(12).fontColor('#EBC08B').width('100%')
        Text(this.galaxyReference.data.samples.length+' 帧 · '+this.galaxyReference.data.samples[0].time.toFixed(1)+'–'+this.galaxyReference.data.samples[this.galaxyReference.data.samples.length-1].time.toFixed(1)+' Myr').fontSize(10).fontColor('#B8AFA7').width('100%')
        Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(6)}}){
          ChoiceChip({label:this.galaxyReferenceShown?'隐藏参照':'显示参照',active:this.galaxyReferenceShown,onPress:()=>{this.press('galaxy.reference.toggle');}}).id('galaxy-reference-toggle')
          ChoiceChip({label:'移除参照',onPress:()=>{this.press('galaxy.reference.clear');}}).id('galaxy-reference-clear')
        }.width('100%')
        if(this.galaxyReferenceShown){Text(this.galaxyComparisonView().deltaReady?'当前 − 参照 '+this.galaxyComparisonView().delta!.toPrecision(4)+(this.galaxyMetric>=3?' 个百分点':' kpc')+' · 参照按当前时刻线性插值':this.galaxyComparisonView().reason).id('galaxy-comparison-delta').fontSize(10).fontColor('#B7C5D5').lineHeight(16).width('100%')}
        Text('参数差异 · 参照 → 当前已应用').fontSize(11).fontColor('#DCCEF3').width('100%')
        if(this.galaxyDifferences().length===0){Text('已记录的初始参数相同').fontSize(10).fontColor('#ABA6C0').width('100%')}
        ForEach(this.galaxyDifferences(),(difference:string)=>{Text(difference).fontSize(10).fontColor('#B8AFA7').lineHeight(16).width('100%')},(difference:string):string=>difference)
        Text('按各自开始后的 Myr 对齐；点数是采样预算，不改变引力质量。多项参数同时变化时，曲线不能单独归因。').fontSize(10).fontColor('#ABA6C0').lineHeight(16).width('100%')
      }
      if(this.galaxyReferenceError!==''){
        Text(this.galaxyReferenceError).fontSize(10).fontColor('#F4A993').width('100%')
        Row({space:6}){
          ChoiceChip({label:'重试读取',onPress:()=>{this.press('galaxy.reference.reload');}})
          ChoiceChip({label:'移除参照',onPress:()=>{this.press('galaxy.reference.clear');}})
        }
      }
    }.width('100%')
  }
  @Builder
  galaxyControls() {
    Column({space:10}) {
      Text('两片恒星盘相遇。改变方向与偏移，看看长尾向哪里延伸。').fontSize(12).fontColor('#CBBDEE').lineHeight(19)
      MetricRow({label:'次星系 / 主星系质量',value:this.galaxyMassRatio.toFixed(2)})
      Slider({value:this.galaxyMassRatio,min:.2,max:1,step:.05}).onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('galaxy.ratio',v);})
      MetricRow({label:'初始横向偏移',value:this.galaxyOffsetKpc.toFixed(0)+' kpc'})
      Slider({value:this.galaxyOffsetKpc,min:0,max:30,step:1}).onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('galaxy.offset',v);})
      MetricRow({label:'次星系盘倾角',value:this.angle.toFixed(0)+'°'})
      Slider({value:this.angle,min:0,max:70,step:5}).onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('scene.angle',v);})
      ChoiceChip({label:'在星图调整相遇',enabledAction:this.info.frames>0&&this.info.state!=='preparing',onPress:()=>{this.press('galaxy.place');}}).id('galaxy-place')
      ChoiceChip({label:'恒星参与引力',active:this.galaxyResponsive,onPress:()=>{this.press('galaxy.responsive');}}).id('galaxy-responsive')
      Text(this.galaxyResponsive?'恒星群占总质量 20%，互相吸引并拉动中心；扩展中心占 80%，无气体或完整暗晕。':'恒星仅受两个中心吸引，不反作用；适合潮汐形态对照。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      ChoiceChip({label:this.galaxyRetrograde?'次星系 · 逆行':'次星系 · 顺行',active:this.galaxyRetrograde,onPress:()=>{this.press('galaxy.retrograde');}}).id('galaxy-spin')
      MetricRow({label:this.galaxyResponsive?'带质量恒星群':'恒星示踪点',value:this.count.toString()})
      Slider({value:this.count,min:200,max:this.galaxyResponsive?800:2400,step:200}).onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('scene.count',Math.round(v));})
      Text('主星系总质量 1000 亿太阳质量。点数改变采样精度，总质量不变；两种模型均未完成真实星系合并验证。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
    }.width('100%')
  }
  @Builder
  galaxyObserverChoices() {
    Row({space:6}) {
      ChoiceChip({label:'太空',active:this.observerMode===1,onPress:()=>{this.press('galaxy.observer.space');}}).id('galaxy-observer-space')
      ChoiceChip({label:'地表',active:this.observerMode===2,onPress:()=>{this.press('galaxy.observer.ground');}}).id('galaxy-observer-ground')
      if(this.observerMode>0){ChoiceChip({label:'回到外部',onPress:()=>{this.press('galaxy.observer.exit');}}).id('galaxy-observer-exit')}
    }.width('100%')
  }
  @Builder
  galaxyObserverDock() {
    Column({space:6}) {
      Text(this.observerMode===1?'太阳位置 · 盘内天空':'地表天空 · 地平线示意').id('galaxy-observer-title').fontColor('#E4E5F0').fontSize(14)
      this.galaxyObserverChoices()
      Row({space:6}) {
        ChoiceChip({label:'看主星系',onPress:()=>{this.press('galaxy.observer.primary');}}).id('galaxy-observer-primary')
        ChoiceChip({label:'看来访星系',onPress:()=>{this.press('galaxy.observer.secondary');}}).id('galaxy-observer-secondary')
      }.width('100%')
      Text('假设相遇 · '+this.info.time.toFixed(0)+' 百万年 · 拖动环顾').id('galaxy-observer-time').fontSize(11).fontColor('#B4B9D0')
    }.alignItems(HorizontalAlign.Start).padding(10).width(Math.min(320,this.layout().safe.width-24))
      .backgroundColor('#55202A40').backgroundBlurStyle(BlurStyle.COMPONENT_ULTRA_THIN,{colorMode:ThemeColorMode.DARK}).borderRadius(20)
      .position({x:this.layout().safe.x+12,y:this.layout().safe.y+(this.toolsVisible?this.layout().headerHeight:0)+16})
  }
  @Builder
  galaxyObserverControls() {
    Column({space:8}) {
      Text('从星系内部看天空').fontSize(15).fontColor('#E2EEF5').width('100%')
      this.galaxyObserverChoices()
      Text('太阳位置类比：跟随初始半径约 8 kpc 的示踪点。地表模式可调纬度与恒星时，使用固定现代坐标朝向；不推演未来地球自转。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      if(this.observerMode>0){
        MetricRow({label:'短边视场',value:this.observerFov.toFixed(0)+'°'})
        Slider({value:this.observerFov,min:35,max:120,step:1}).id('galaxy-observer-fov').onChange((v:number)=>{this.input('galaxy.observer.fov',v);})
      }
      if(this.observerMode===2){
        MetricRow({label:'观测纬度',value:this.observerLatitude.toFixed(0)+'°'})
        Slider({value:this.observerLatitude,min:-90,max:90,step:1}).id('galaxy-observer-latitude').onChange((v:number)=>{this.input('galaxy.observer.latitude',v);})
        MetricRow({label:'当地恒星时 · 独立于回放',value:this.observerSidereal.toFixed(1)+' h'})
        Slider({value:this.observerSidereal,min:0,max:24,step:0.5}).id('galaxy-observer-sidereal').onChange((v:number)=>{this.input('galaxy.observer.sidereal',v);})
      }
      Text('假设相遇情景，并非银河系与仙女座的未来预测；天空亮度为示意。时间轴沿用本次实验。').fontSize(11).fontColor('#CFB990').lineHeight(18)
    }.width('100%')
  }
  @Builder
  galaxyObservation() {
    Column({space:8}) {
      this.galaxyObserverControls()
      this.galaxyCurveControls()
      this.galaxyReferenceControls()
      Text('潮汐正在改变什么').fontSize(15).fontColor('#E2EEF5').width('100%')
      if(this.info.galaxy){
        MetricRow({label:'两个中心相距',value:this.info.galaxy.separationKpc.toFixed(2)+' kpc'})
        MetricRow({label:'主星系分布尺度',value:this.info.galaxy.primaryRmsKpc.toFixed(2)+' kpc'})
        MetricRow({label:'次星系分布尺度',value:this.info.galaxy.secondaryRmsKpc.toFixed(2)+' kpc'})
        MetricRow({label:'主星系外延示踪点',value:(this.info.galaxy.primaryOuterFraction*100).toFixed(1)+'%'})
        MetricRow({label:'次星系外延示踪点',value:(this.info.galaxy.secondaryOuterFraction*100).toFixed(1)+'%'})
        MetricRow({label:this.info.config?.galaxyResponsive?'全系统能量归一化偏差':'两中心能量归一化偏差',value:(this.info.energyError??0).toExponential(2)})
      }
      Text('外延比例：超过初始盘外缘 1.5 倍，不是逃逸质量。'+(this.info.config?.galaxyResponsive?'能量读数包含恒星群和扩展中心。':'能量读数仅对应两中心。')).fontSize(11).fontColor('#ADA8BF').lineHeight(18)
    }.width('100%')
  }
  @Builder
  sphMaterialInputs() {
    Column({space:6}){
      Text('两颗岩体的初始比内能 · '+this.initialEnergyMJkg.toFixed(2)+' MJ/kg').fontSize(12).fontColor('#DBCEEC').width('100%')
      Slider({value:this.initialEnergyMJkg,min:0,max:6.8,step:.1}).enabled(this.relaxationSeconds===0).selectedColor('#F7A669')
        .onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('scene.energy',v);})
      Text('两颗岩体的初始损伤 · '+(this.initialDamage*100).toFixed(0)+' %').fontSize(12).fontColor('#DBCEEC').width('100%')
      Slider({value:this.initialDamage,min:0,max:1,step:.05}).enabled(this.relaxationSeconds===0).selectedColor('#DA8192')
        .onChange((v:number,mode:SliderChangeMode)=>{if(mode!==SliderChangeMode.Begin)this.input('scene.damage',v);})
      Text(this.relaxationSeconds>0?'预松弛实验保留冷态、无初始损伤；切换直接生成后可调整。':'初态实验参数，应用后重新生成。预热会产生压力膨胀，并非平衡熔岩球。').fontSize(10).fontColor('#ABA6C0').width('100%')
      ChoiceChip({label:'应用材料初态',onPress:()=>{this.press('simulation.apply');}}).id('material-initial-apply')
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
          if(this.themeState().compareId!=='') {ChoiceChip({label:'切换对照实验',onPress:()=>{this.press('theme.compare');}}).id('theme-compare')}
        }.width('100%')
        if(this.preset<3){ChoiceChip({label:this.preset===2?'查看岩球曲线':'查看碰撞曲线',onPress:()=>{this.press('theme.observe');}}).id('theme-observe')}
        Text('恢复或切换会从零开始；可先另存当前参数。').fontSize(10).fontColor('#ADA8BF').width('100%')
      }.width('100%').padding({bottom:10})
    }
  }
  private themeCover(id:string):ResourceStr {
    if(id==='galaxy-tails')return $r('app.media.theme_galaxy_tails');
    if(id==='moon-atlas')return $rawfile('lroc_color_2k.jpg');
    if(id==='rock-slow')return $r('app.media.theme_rock_slow');
    if(id==='rock-fast')return $r('app.media.theme_rock_fast');
    if(id==='rock-oblique')return $r('app.media.theme_rock_oblique');
    if(id==='rock-spin')return $r('app.media.theme_rock_spin');
    if(id==='eccentric-ring')return $r('app.media.theme_eccentric_ring');
    if(id==='kepler-ring')return $r('app.media.theme_kepler_ring');
    if(id==='ring-world')return $r('app.media.theme_ring_world');
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
                Image(this.themeCover(t.cover)).width('100%').height(this.layout().compact?64:96).objectFit(ImageFit.Cover)
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
      Button('保存当前实验与视角',{type:ButtonType.Normal}).width('100%').height(40).borderRadius(10)
        .fontSize(13).fontColor('#07282C').backgroundColor('#D2C2FF').enabled(!this.ioBusy).onClick(() => {this.press('project.save');})
      Text('保存初始参数、外观、视角与局部环设置。载入后暂停；主系统重新开始，回放另存。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
      if(this.projects.length===0) {Text('还没有保存的实验').fontColor('#AAA3BF').fontSize(13).padding(16)}
      ForEach(this.projects,(p:SavedProject) => {
        Column({space:6}) {
          Text(p.scene.title).fontColor('#EBE7F8').fontSize(14).maxLines(1).width('100%')
          Text(p.scene.config.preset===6?'星系潮汐 · '+p.scene.config.duration+' Myr':p.scene.config.preset>=3?'多体引力 · '+p.scene.config.duration+' 年':p.scene.bodies.length+' 个岩质天体 · '+p.scene.config.count+' 粒子预算 · '+p.scene.config.duration+' s').fontColor('#ADA8BF').fontSize(11)
          Text(p.recipe?'含外观与观察设置'+(p.recipe.ring.enabled?' · 局部环 '+p.recipe.ring.timeHours.toFixed(2)+' h':''):'旧版 · 初始参数').fontColor('#9DAFBF').fontSize(10)
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
        if(this.preset<3){this.sphMaterialInputs()}
        this.themeGuide()
        if(this.preset!==5||this.selectingPreset){this.presets()}else{
          Row(){Text('自定义系统 · '+this.orbitBodies.length+' 个天体').fontSize(13).fontColor('#DCCEF3');Blank();ChoiceChip({label:'切换实验',onPress:()=>{this.press('presets.show');}})}.width('100%')
        }
        if(this.preset===6){this.galaxyControls()}else if(this.isOrbit()) {
          if(this.preset!==5){Text('牛顿多体引力 · 恒星与行星相互作用。初始位置为教学预设，不代表实时太阳系。').fontSize(12).fontColor('#ADA8BF').lineHeight(19)}
          if(this.preset===5){this.orbitControls()} else {Text('调节初始速度，观察圆轨道如何变成椭圆。1.00 × 为双体圆轨道初速。').fontSize(12).fontColor('#CBBDEE').lineHeight(19)}
        } else {
        Text('岩质模型 · 初始密度可调，尚未做静力平衡。质量由半径与密度计算。')
          .fontSize(12).fontColor('#ADA8BF').lineHeight(19).width('100%')
        ChoiceChip({label:this.selfGravity?'材料自引力 · 已开启':'材料自引力 · 关闭',active:this.selfGravity,onPress:() => {this.press('scene.gravity');}})
        Text(this.count>1200?'开启自引力前，请将粒子预算降至 1200 以内。':'自引力逐对计算材料吸引；应用后生效。尚未建立静力平衡，不代表月球形成。').fontSize(11).fontColor('#ADA8BF').width('100%')
        if(this.selfGravity){
          Text('碰撞前准备').fontSize(12).fontColor('#DCCEF3')
          Flex({wrap:FlexWrap.Wrap}){
            ChoiceChip({label:'直接生成',active:this.relaxationSeconds===0,onPress:()=>{this.press('scene.relax.0');}}).id('sph-relax-0')
            ChoiceChip({label:'预松弛 16 秒',active:this.relaxationSeconds===16,onPress:()=>{this.press('scene.relax.16');}}).id('sph-relax-16')
            ChoiceChip({label:'预松弛 64 秒',active:this.relaxationSeconds===64,onPress:()=>{this.press('scene.relax.64');}}).id('sph-relax-64')
          }.width('100%')
          Text('每个岩体先独立演化并抑制振动，再施加自转和撞击速度。准备耗散不计入碰撞时间；定时结束不代表达到平衡。').fontSize(11).fontColor('#ADA8BF').lineHeight(17).width('100%')
        }
        this.bodyControls()
        MetricRow({label:'粒子预算',value:this.count.toString()})
        Slider({value:this.count,min:200,max:this.selfGravity?1200:2400,step:200}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.count',Math.round(v));})
        }
        if(this.preset!==5) {
        MetricRow({label:this.preset===6?'相对接近速度':this.isOrbit()?'初始轨道速度':this.preset===2?'总初始角速度':'撞击速度',value:this.preset===6?(this.speed*156.446755).toFixed(1)+' km/s':this.isOrbit()?this.speed.toFixed(2)+' × 圆轨道初速':this.preset===2?(this.targetSpin+this.speed*0.003).toFixed(4)+' rad/s':this.speed.toFixed(1)+' km/s'})
        Slider({value:this.speed,min:this.preset>=3?0.75:(this.preset===2?0:0.5),max:this.preset>=3?1.25:10,step:this.preset>=3?0.05:0.5}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.speed',v);})
        }
        if(this.preset===2){ChoiceChip({label:'设为静止初态',active:this.speed===0&&this.targetSpin===0,onPress:()=>{this.press('scene.stationary');}}).id('sph-stationary')}
        if(this.preset<2) {
          MetricRow({label:'横向偏移',value:(Math.sin(this.angle*Math.PI/180)*0.5625*(this.targetRadiusKm+this.impactorRadiusKm)).toFixed(0)+' km'})
          Slider({value:this.angle,min:0,max:70,step:5}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
            .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.angle',v);})
        }
        MetricRow({label:'模拟时长',value:this.duration.toFixed(0)+(this.timeLabel())})
        Slider({value:this.duration,min:this.preset===6?50:1,max:this.preset===6?800:(this.isOrbit()?10:120),step:this.preset===6?50:1}).selectedColor('#BDA5F2').trackColor('#414154').blockColor('#F0E8FF')
          .onChange((v:number,mode:SliderChangeMode) => {if(mode!==SliderChangeMode.Moving&&mode!==SliderChangeMode.Click&&mode!==SliderChangeMode.End)return;this.input('scene.duration',v);})
        Text(this.dirty?'参数已修改，应用后会重新生成实验。':(this.preset===6?(this.galaxyResponsive?'恒星群相互吸引并拉动中心；每 4 Myr 记录一帧，无实体接触。':'每 4 Myr 记录一帧；示踪点不相互吸引，也不发生实体碰撞。'):this.isOrbit()?'轨迹保留最近 2 年；近距离遭遇会停止计算。':'粒子数是预算值，实际数量由采样分布决定。')).fontSize(11).fontColor(this.dirty?'#F0BD82':'#A5A0B6').width('100%')
        Button('应用参数 · 重新生成',{type:ButtonType.Normal}).width('100%').height(38).borderRadius(10).backgroundColor('#6657477D').fontColor('#E2D7FC').fontSize(12)
          .enabled(!this.ioBusy).onClick(() => {this.press('simulation.apply');})
        Row({space:8}) {
          ChoiceChip({label:'另存实验',active:false,onPress:() => {this.press('project.save');}})
          ChoiceChip({label:'打开实验库',active:false,onPress:() => {this.press('project.open');}})
        }.width('100%')
      } else if(this.tab===1) {
        this.impactControls()
        if(this.info.impact?.local){Text('局部撞击 · 源事件 '+this.info.impact!.sourceTimeSeconds.toFixed(3)+' 秒 · 冷态岩质、无自转、自引力 · 外部世界暂停，碎片尚不回注').fontSize(11).fontColor('#D1BB9A').lineHeight(18)}
          if(this.trace.enabled){this.traceControls()}
          if(this.preset===5) {
            Text(this.canGenerateSurface()?'独立外观 · '+this.orbitBodies[this.surfaceTarget()].name:'选择一颗行星可生成新外观').fontSize(12).fontColor('#D9CCF5')
            Row({space:6}) {
              ChoiceChip({label:'新地貌',enabledAction:this.canGenerateSurface(),onPress:()=>{this.press('terrain.new');}})
              ChoiceChip({label:'换云层',enabledAction:this.canGenerateSurface(),onPress:()=>{this.press('terrain.clouds');}})
            }
            Row({space:6}) {
              ChoiceChip({label:'撤销外观',enabledAction:this.surfaceUndo.length>0&&!this.placing,onPress:()=>{this.press('terrain.undo');}})
              ChoiceChip({label:'重做外观',enabledAction:this.surfaceRedo.length>0&&!this.placing,onPress:()=>{this.press('terrain.redo');}})
            }
            Text(this.rendering.surfaceError|| (this.rendering.surfacePending>0?'地貌正在生成…':'外观随实验保存 · 不改变物理参数')).fontSize(11).fontColor('#A5A0B6')
          }
        if(this.preset===6){this.galaxyObservation()}else if(this.isOrbit()){this.observationControls();this.materialControls()}else{this.sphControls()}
        this.themeGuide()
        ChoiceChip({label:'停止实验',onPress:()=>{this.press('simulation.cancel');},enabledAction:['preparing','running','paused'].includes(this.info.state)}).id('simulation-stop')
        this.skyControls()
        if(this.isOrbit()) {
          Text('行星外观').fontSize(13).fontColor('#AEBDCD').width('100%')
          Row({space:6}) {
            ChoiceChip({label:'云层',active:this.clouds,onPress:() => {this.press('appearance.clouds');}})
            ChoiceChip({label:'大气',active:this.atmosphere,onPress:() => {this.press('appearance.atmosphere');}})
            ChoiceChip({label:'轨迹',active:this.trails,onPress:() => {this.press('appearance.trails');}})
          }.width('100%')
          if(this.canTrace()||this.trace.enabled){
            ChoiceChip({label:'启用动态环带',active:this.trace.enabled,onPress:()=>{this.press('trace.toggle');}})
            Text('8192 个无质量环粒子 · 环带随粒子形变 · 半径假定 60000 km；仅中心引力，无互撞。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
          }
          ChoiceChip({label:'显示气态行星环带',active:this.rings,onPress:()=>{this.press('appearance.rings');}})
          ChoiceChip({label:this.autoSpin?'停止外观自转':'演示外观自转',active:this.autoSpin,onPress:() => {this.press('appearance.spin');}})
          Text(this.selectedMoon()?'月面底图来自 NASA SVS；仅改变外观，不设置真实月球质量或月相。':'海陆和云层为程序外观；动态环使用中心引力，尚无环粒子互撞或流体耦合。').fontSize(11).fontColor('#ADA8BF').lineHeight(18)
          Divider().color('#33B4A7D6')
        }
        Text(this.isOrbit()?'天体着色':'粒子着色').fontSize(13).fontColor('#AEBDCD').width('100%')
        Row({space:6}) {
          ChoiceChip({label:'原色',active:this.colorMode===0,onPress:() => {this.press('color.0');}})
          ChoiceChip({label:'速度',active:this.colorMode===1,onPress:() => {this.press('color.1');}})
          if(this.preset<3) {ChoiceChip({label:'密度',active:this.colorMode===2,onPress:() => {this.press('color.2');}})}
        }.width('100%')
        Text(this.preset===6?(this.colorMode===1?'速度 0 → 400 km/s':'金 · 主星系 / 蓝 · 次星系；颜色记录来源'):this.isOrbit()?(this.colorMode===1?'速度 0 → 50 km/s':'金 · 恒星 / 蓝、金、红 · 行星'):this.sphLegend()).fontSize(11).fontColor('#CBBDEE').width('100%')
        Row({space:8}) {
          ChoiceChip({label:'拉远 −',active:false,onPress:() => {this.press('camera.out');}})
          ChoiceChip({label:'拉近 +',active:false,onPress:() => {this.press('camera.in');}})
        }.width('100%')
        Text('镜头跟踪').fontSize(13).fontColor('#AEBDCD').width('100%')
        if(this.isOrbit()) {
          Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
            ChoiceChip({label:'全景',active:this.focus===-1&&!this.rendering.fragmentFollow.active,onPress:() => {this.press('focus.all');}})
            ForEach(this.info.bodies??[],(b:OrbitBodyStatus) => {
              ChoiceChip({label:b.name,active:this.focus===b.id,onPress:() => {this.press('focus.'+b.id);}})
            },(b:OrbitBodyStatus) => b.id.toString())
          }.width('100%')
        } else {
        Row({space:6}) {
          ChoiceChip({label:'全景',active:this.focus===-1&&!this.rendering.fragmentFollow.active,onPress:() => {this.press('focus.all');}})
          ChoiceChip({label:this.preset===6?'主星系':this.isOrbit()?'恒星':'主天体',active:this.focus===0,onPress:() => {this.press('focus.0');}})
          if(this.preset!==2) {ChoiceChip({label:this.preset===6?'次星系':this.isOrbit()?'蓝色行星':'撞击体',active:this.focus===1,onPress:() => {this.press('focus.1');}})}
        }.width('100%')
        }
        ChoiceChip({label:'复位视角',active:false,onPress:() => {this.press('camera.reset');}})
        Divider().color('#33B4A7D6')
        MetricRow({label:'最高速度',value:this.info.maxSpeed.toFixed(2)+' km/s'})
        if(this.isOrbit()) {
          MetricRow({label:this.preset===5?'能量归一化偏差':'能量相对误差',value:(this.info.energyError??0).toExponential(2)})
          MetricRow({label:this.preset===5?'角动量归一化偏差':'角动量相对误差',value:(this.info.angularError??0).toExponential(2)})
          ForEach(this.info.bodies??[],(b:OrbitBodyStatus) => {
            MetricRow({label:b.name,value:b.speedKmS.toFixed(2)+' km/s'})
          },(b:OrbitBodyStatus) => b.id.toString())
        } else if(this.preset<3) {MetricRow({label:'平均密度',value:this.info.meanDensity.toFixed(0)+' kg/m³'})}
        MetricRow({label:this.isOrbit()?'最近 16 步耗时':'最近求解步耗时',value:this.info.stepMs.toFixed(1)+' ms'})
        MetricRow({label:'已记录帧数',value:this.info.steps.toString()})
        Divider().color('#33B4A7D6')
        Row({space:8}) {
          ChoiceChip({label:'保存回放',active:false,onPress:() => {this.press('replay.save');}})
          ChoiceChip({label:'载入回放',active:false,onPress:() => {this.press('replay.load');}})
        }.width('100%')
        Text('本机保留最近 240 帧。新版天体轨道可从所选时刻继续；旧回放、SPH 与星系回放仅用于观察。').fontSize(11).fontColor('#AAA3BF').lineHeight(18)
        Text('OpenSPH · MIT 开源内核\n原生 ArkTS 界面 / OpenGL ES 粒子视口\n科学探索原型 · 低分辨率结果用于演示').fontSize(11).fontColor('#9792AC').lineHeight(18)
      } else { this.library() }
    }.padding(16).width('100%')
  }
  @Builder
  videoDialog() {
    Column({space:12}) {
      Row() {
        Text('记录这片宇宙').fontSize(21).fontColor('#F3EEFF').layoutWeight(1)
        ChoiceChip({label:'返回星图',onPress:() => {this.press('video.close');}})
      }.width('100%')
      Scroll() {
        Column({space:12}) {
          Text('只录星图，不含菜单 · 无声 MP4\n可录制实时演化、回放和镜头移动。每段最多 3 分钟；切到后台自动结束。').fontSize(12).lineHeight(19).fontColor('#BDB6CE').width('100%')
          Flex({wrap:FlexWrap.Wrap,space:{main:LengthMetrics.vp(6),cross:LengthMetrics.vp(8)}}) {
            ChoiceChip({label:'标准 · 长边 1280',active:this.videoQuality===1280,enabledAction:!this.videoBusy(),onPress:() => {this.press('video.quality.1280');}})
            ChoiceChip({label:'高清 · 长边 1920',active:this.videoQuality===1920,enabledAction:!this.videoBusy(),onPress:() => {this.press('video.quality.1920');}})
          }.width('100%')
          Text(this.videoState.state==='recording'?'● '+this.videoTime()+' · '+this.videoState.message:this.videoState.state==='starting'?'正在准备编码器…':this.videoState.state==='stopping'?'正在完成视频…':this.videoState.message||'调整好视角，开始记录').fontSize(13).fontColor('#DEC9FF').width('100%')
          if(this.videoState.error!==''){Text(this.videoState.error).fontSize(12).fontColor('#FFB9C5').width('100%')}
          if(this.videoState.state==='recording') {
            FloatingButton({label:'停止录制',primary:true,onPress:() => {this.press('video.stop');}})
          } else {
            FloatingButton({label:'开始录制',primary:true,enabledAction:!this.videoBusy(),onPress:() => {this.press('video.start');}})
          }
          ChoiceChip({label:'刷新视频',enabledAction:!this.videoBusy(),onPress:() => {this.press('video.reload');}})
          if(this.videoState.clips.length>0){
            Divider().color('#33B4A7D6')
            Text('本机视频 · '+this.videoState.clips.length+' 段').fontSize(14).fontColor('#F3EEFF').width('100%')
            ForEach(this.videoState.clips,(clip:VideoClip) => {
              ChoiceChip({label:new Date(clip.createdAt).toLocaleString()+' · '+(clip.bytes/1048576).toFixed(1)+' MB',active:clip.id===this.videoState.selectedId,enabledAction:!this.videoBusy(),onPress:() => {this.press('video.select.'+clip.id);}})
            },(clip:VideoClip) => clip.id)
            Row({space:8}) {
              ChoiceChip({label:'预览视频',enabledAction:!this.videoBusy(),onPress:() => {this.press('video.preview');}})
              ChoiceChip({label:this.videoState.state==='exporting'?'正在导出…':'导出 MP4',enabledAction:!this.videoBusy(),onPress:() => {this.press('video.export');}})
            }.width('100%')
          }
        }.width('100%')
      }.layoutWeight(1).scrollBar(BarState.Auto).width('100%')
    }.padding(20).width(Math.min(460,this.layout().safe.width-24)).height(Math.min(550,this.layout().safe.height-24))
      .backgroundColor('#F0212235').backgroundBlurStyle(BlurStyle.COMPONENT_THICK,{colorMode:ThemeColorMode.DARK}).borderRadius(28)
      .position({x:this.layout().safe.x+(this.layout().safe.width-Math.min(460,this.layout().safe.width-24))/2,y:this.layout().safe.y+12})
      .id('video-dialog').transition(TransitionEffect.OPACITY.animation({duration:180}))
  }
  build() {
    Stack({alignContent:Alignment.TopStart}) {
      this.viewport()
      if(this.toolsVisible) {
        if(!this.placing&&!this.galaxyPlacing){this.header()}
        if(this.isOrbit()&&!this.panelOpen&&!this.placing) {this.surfaceBar()}
        if(this.panelOpen) {this.drawer()}
        if(!this.placing&&!this.galaxyPlacing){this.transport()}
      } else {
        Button('显示工具',{type:ButtonType.Normal}).id('restore-tools').fontSize(12).fontColor('#E2D7FC')
          .backgroundColor('#A6222438').backgroundBlurStyle(BlurStyle.COMPONENT_ULTRA_THIN,{colorMode:ThemeColorMode.DARK}).height(42).borderRadius(24).padding({left:14,right:14})
          .width(96).position({x:this.layout().safe.x+Math.max(0,this.layout().safe.width-108),y:this.layout().safe.y+12}).onClick(() => {this.press('ui.restore');})
          .transition(TransitionEffect.OPACITY.combine(TransitionEffect.scale({x:0.94,y:0.94})).animation({duration:200,curve:Curve.EaseOut}))
      }
      if(this.observerMode===0&&this.rendering.panoramaReady&&this.rendering.skyGalaxy>0.001) {
        Text('ESO/S. Brunier · CC BY 4.0').id('sky-photo-credit').fontSize(10).fontColor('#C1BDCA')
          .position({x:this.layout().safe.x+16,y:this.placing?this.layout().safe.y+this.layout().safe.height-24:this.layout().safe.y+(this.toolsVisible?this.layout().headerHeight+2:20)}).hitTestBehavior(HitTestMode.None)
      }
      if(this.videoState.state==='recording'&&!this.videoOpen&&!this.videoPreview){
        Button('● '+this.videoTime()+'  停止录制',{type:ButtonType.Normal}).id('video-stop').fontSize(12).fontColor('#FFE1E8')
          .backgroundColor('#CC532D45').height(40).borderRadius(22).padding({left:14,right:14})
          .position({x:this.layout().safe.x+12,y:this.layout().safe.y+this.layout().headerHeight+28}).onClick(() => {this.press('video.stop');})
      }
      if(this.videoOpen){this.videoDialog()}
      if(this.videoPreview){
        Column({space:12}) {
          Video({src:this.videoUri}).autoPlay(true).controls(true).objectFit(ImageFit.Contain).width('100%').layoutWeight(1)
            .onPrepared(() => {this.videoPreviewReady=true;}).onError(() => {this.videoPreviewError='当前设备无法播放此视频，可导出后在其他设备查看';})
          if(this.videoPreviewError!==''){Text(this.videoPreviewError).fontSize(13).fontColor('#FFB9C5')}
          ChoiceChip({label:'关闭预览',onPress:() => {this.press('video.preview.close');}})
        }.padding(16).backgroundColor('#FA080B15').width(this.layout().safe.width).height(this.layout().safe.height)
          .position({x:this.layout().safe.x,y:this.layout().safe.y}).id('video-preview')
      }
    }.width('100%').height('100%').backgroundColor('#080B15')
      .onAreaChange((_:Area,area:Area) => {this.windowWidth=Number(area.width);this.windowHeight=Number(area.height);})
  }
}
