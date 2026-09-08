export interface OrbitBodyConfig { radiusKm?:number; name:string; massSolar:number; xAU:number; yAU:number; zAU:number; vxKmS:number; vyKmS:number; vzKmS:number; surface:number; }
export interface SimulationConfig {
  galaxyMassRatio?:number;galaxyOffsetKpc?:number;galaxyRetrograde?:boolean;galaxyResponsive?:boolean;
  orbitBodies?: OrbitBodyConfig[];
  preset: number; count: number; speed: number; angle: number; duration: number;
  targetRadiusKm: number; impactorRadiusKm: number; targetDensity: number; impactorDensity: number;
  initialEnergyMJkg?:number; initialDamage?:number;
  targetSpin: number; seed: number; selfGravity?: boolean; relaxationSeconds?: number;
}
export const startScene: (config: SimulationConfig, initiallyPaused?: boolean) => void;
export interface OrbitBodyStatus { radiusKm?:number; id:number; name:string; surface?:number; xAU:number; yAU:number; zAU:number; speedKmS:number; massSolar:number; }
export interface SphMaterialResponse {model:string;meltEnergyMJkg:number;intactYieldGPa:number;softeningMean:number;zeroShearMassFraction:number;damagedMassFraction:number;strengthMean:number;}
export interface SphDiagnostics {response?:SphMaterialResponse;structure?:number[];available:boolean;pressureMinGPa?:number;pressureMaxGPa?:number;pressureMeanGPa?:number;internalMinMJkg?:number;internalMaxMJkg?:number;internalMeanMJkg?:number;damageMean?:number;damageMax?:number;kineticJ?:number;internalJ?:number;}
export interface LocalImpactBody {id:number;massKg:number;radiusKm:number;densityKgM3:number;positionM:number[];velocityMS:number[];}
export interface ImpactPlan {available:boolean;withinCurrentBounds:boolean;reason:string;model:string;velocityConvention:string;timeSeconds?:number;relativeSpeedKmS?:number;contactAngleDegrees?:number;kineticEnergyJ?:number;originAU?:number[];velocityKmS?:number[];angularMomentumKgM2S?:number[];bodies?:LocalImpactBody[];}
export interface OrbitContactStatus {incoming?:ImpactPlan;count:number;a:number;b:number;timeSeconds:number;normalSpeedKmS:number;restitution:number;}
export interface GalaxyParameters {count:number;seed:number;speed:number;inclination:number;duration:number;massRatio:number;offset:number;retrograde:boolean;responsive?:boolean;}
export interface GalaxySample {frame:number;time:number;values:number[];energyError:number;angularError:number;}
export interface GalaxyObservation {available:boolean;sceneRevision:number;selected:number;parameters?:GalaxyParameters;samples:GalaxySample[];}
export const galaxyObservation:()=>GalaxyObservation;
export const seekGalaxyObservation:(frame:number,revision:number,time:number)=>void;
export const setGalaxyPlacement:(enabled:boolean,count:number,seed:number,speed:number,inclination:number,massRatio:number,offset:number,retrograde:boolean,responsive:boolean)=>void;
export const placeGalaxyAt:(x:number,y:number)=>number;
export interface GalaxyDiagnostics {separationKpc:number;primaryRmsKpc:number;secondaryRmsKpc:number;primaryOuterFraction:number;secondaryOuterFraction:number;energyScope:string;outerScope:string;}
export interface SimulationStatus {
  orbitState?:OrbitBodyConfig[];orbitRevision?:number;continuous?:boolean;daysPerSecond?:number;actualDaysPerSecond?:number;
  galaxy?:GalaxyDiagnostics;
  contact?:OrbitContactStatus;
  preparation?:PreparationStatus;
  sph?:SphDiagnostics;
  model?:string; timeUnit?:string; energyError?:number; angularError?:number; bodies?:OrbitBodyStatus[];
  config?: SimulationConfig; totalMass?: number;
  state: string; error: string; count: number; frames: number; selected: number;
  time: number; duration: number; stepMs: number; steps: number; maxSpeed: number; meanDensity: number;
}
export const start: (preset: number, count: number, speed: number, angle: number, duration: number) => void;
export const pause: (paused: boolean) => void;
export const cancel: () => void;
export const seek: (frame: number) => void;
export const setCamera: (yaw: number, pitch: number, zoom: number, focus: number, color: number) => void;
export const status: () => SimulationStatus;
export interface PreparationEvent {stage:string;elapsedMs:number;}
export interface PreparationStatus {requestId:number;stage:string;elapsedMs:number;stageMs:number;slow:boolean;previousRequestId:number;previousStage:string;events:PreparationEvent[];}
export const saveReplay: (directory: string) => Promise<boolean>;
export const loadReplay: (directory: string) => Promise<boolean>;

export const setSkyPanorama:(pixels:ArrayBuffer,width:number,height:number)=>void;
export const setSky:(mode:number,brightness:number)=>void;
export const setComposition:(x:number,y:number,scale:number)=>void;
export const setMoonTexture:(pixels:ArrayBuffer,width:number,height:number)=>void;
export const setSurfaceSeeds:(pairs:number[])=>void;
export interface FragmentFollowStatus {active:boolean;moving:boolean;seed:number;anchor:number;rank:number;count:number;sceneRevision:number;time:number;centerKm:number[];}
export interface RenderStatus { galaxyObserverMode?:number; galaxyObserverTime?:number; fragmentFollow:FragmentFollowStatus; surfacePending:number;surfaceGenerated:number;surfaceError:string; moonReady:boolean; moonUploads:number; moonBlend:number; moonError:string; materialExposure:number; materialOcean:boolean; materialCloudShadows:boolean; panoramaReady:boolean; panoramaBlend:number; compositionX:number; compositionY:number; compositionScale:number; sceneRevision:number; surfaceStarts:number; cameraMoving:boolean; centerX:number; centerY:number; centerZ:number; skyReady:boolean; skyStars:number; skyGalaxy:number; ready:boolean; texturesReady:boolean; active:boolean; frames:number; submitMs:number; previewSeconds:number; error:string; }
export const setMaterial:(exposure:number,ocean:boolean,cloudShadows:boolean)=>void;
export const setAppearance:(clouds:boolean,atmosphere:boolean,trails:boolean,closeup:boolean,autoSpin:boolean,rings:boolean)=>void;
export const setRenderActive:(active:boolean)=>void;
export const renderStatus:()=>RenderStatus;
export const followSphFragment:(particle:number,sceneRevision:number)=>void;
export const clearSphFragmentFollow:()=>void;

export interface ProjectedBody { id:number; x:number; y:number; radius:number; depth:number; opacity:number; }
export const setOrbitPlacement:(bodies:OrbitBodyConfig[],candidate:number,parent?:number,extent?:number)=>void;
export const placeOrbitAt:(x:number,y:number,tilt:number)=>number[];
export interface ProjectedScene { placement:boolean; candidate:number; ready:boolean; widthPx:number; heightPx:number; time:number; bodies:ProjectedBody[]; }
export const projectedScene:()=>ProjectedScene;
export const pickBody:(x:number,y:number,padding:number)=>number;

export interface RingTraceParticle {xKm:number;yKm:number;vxKmS:number;vyKmS:number;radiusKm:number;periodHours:number;}
export interface RingTraceStatus {impulse:number;points:boolean;returnedCount?:number;sampling?:string;speedScale:number;rateHours:number;eccentricity:number;innerApoapsisKm:number;outerApoapsisKm:number;referenceXKm:number;referenceYKm:number;referenceRadiusKm:number;referenceSpeedKmS:number;particles?:RingTraceParticle[];enabled:boolean;running:boolean;target:number;timeHours:number;massSolar:number;radiusKm:number;count:number;innerPeriodHours:number;outerPeriodHours:number;model:string;}
export const configureRingTrace:(enabled:boolean,running:boolean,target:number,massSolar:number)=>void;
export const setRingDisturbance:(impulse:number,points:boolean)=>void;
export const setRingParameters:(speedScale:number,rateHours:number)=>void;
export const seekRingTrace:(seconds:number)=>void;
export const ringTraceStatus:(particles:boolean)=>RingTraceStatus;

export interface CameraMotionStatus {requestId:number;sceneRevision:number;targetFocus:number;targetCloseup:boolean;progress:number;state:string;reason:string;yaw:number;pitch:number;zoom:number;}
export const navigateCamera:(yaw:number,pitch:number,zoom:number,focus:number,color:number,closeup:boolean,duration:number,animatePose:boolean,force:boolean)=>CameraMotionStatus;
export const getCameraMotion:(requestId:number)=>CameraMotionStatus;
export const cancelCameraMotion:(requestId:number)=>CameraMotionStatus;

export interface ObservationSample {frame:number;time:number;distanceAU:number;speedKmS:number;}
export interface OrbitObservation {sceneRevision:number;body:number;name:string;selected:number;samples:ObservationSample[];}
export const orbitObservation:(body:number)=>OrbitObservation;
export const seekObservation:(frame:number,sceneRevision:number,time:number)=>void;

export interface SphObservationSample {frame:number;time:number;values:number[];structure?:number[];}
export interface SphObservation {sceneRevision:number;selected:number;samples:SphObservationSample[];}
export const sphObservation:()=>SphObservation;
export const seekSphObservation:(frame:number,sceneRevision:number,time:number)=>void;

export interface SphMaterialGroup {rank:number;anchor:number;count:number;massKg:number;massFraction:number;centerKm:number[];velocityKmS:number[];rmsRadiusKm:number;}
export interface SphFragmentSnapshot {available:boolean;reason:string;sceneRevision:number;selected:number;time:number;linkScale:number;offset:number;method:string;groups:SphMaterialGroup[];groupCount?:number;particleCount?:number;totalMassKg?:number;singletonCount?:number;singletonMassKg?:number;largestMassFraction?:number;nextOffset?:number;}
export const sphFragments:(offset:number,limit:number)=>SphFragmentSnapshot;

export interface GalaxyObserverStatus {
  available:boolean; mode:number; sceneRevision:number; selected:number; time:number; anchor:number;
  initialRadiusKpc:number; positionKpc:number[]; primaryDirection:number[]; secondaryDirection:number[];
  yaw:number; pitch:number; fov:number; latitude:number; siderealHours:number; primaryYaw:number; primaryPitch:number; secondaryYaw:number; secondaryPitch:number; scope:string;
}
export const setGalaxyObserver:(mode:number,yaw:number,pitch:number,fov:number,latitude:number,siderealHours:number)=>void;
export const galaxyObserverStatus:()=>GalaxyObserverStatus;

export interface VideoOutputStatus {attached:boolean;pending:boolean;frames:number;width:number;height:number;error:string;}
export const setVideoOutput:(id:string,width:number,height:number)=>void;
export const videoOutputStatus:()=>VideoOutputStatus;

export const orbitClock:(daysPerSecond:number)=>void;
export const freezeOrbit:()=>void;
export const insertOrbit:(body:OrbitBodyConfig,revision:number,resume:boolean,physicalRadii?:boolean)=>void;
