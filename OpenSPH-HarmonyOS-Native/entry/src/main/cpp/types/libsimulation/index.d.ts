export interface OrbitBodyConfig { name:string; massSolar:number; xAU:number; yAU:number; zAU:number; vxKmS:number; vyKmS:number; vzKmS:number; surface:number; }
export interface SimulationConfig {
  orbitBodies?: OrbitBodyConfig[];
  preset: number; count: number; speed: number; angle: number; duration: number;
  targetRadiusKm: number; impactorRadiusKm: number; targetDensity: number; impactorDensity: number;
  targetSpin: number; seed: number; selfGravity?: boolean;
}
export const startScene: (config: SimulationConfig, initiallyPaused?: boolean) => void;
export interface OrbitBodyStatus { id:number; name:string; surface?:number; xAU:number; yAU:number; zAU:number; speedKmS:number; massSolar:number; }
export interface SphDiagnostics {structure?:number[];available:boolean;pressureMinGPa?:number;pressureMaxGPa?:number;pressureMeanGPa?:number;internalMinMJkg?:number;internalMaxMJkg?:number;internalMeanMJkg?:number;damageMean?:number;damageMax?:number;kineticJ?:number;internalJ?:number;}
export interface SimulationStatus {
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
export interface RenderStatus { surfacePending:number;surfaceGenerated:number;surfaceError:string; moonReady:boolean; moonUploads:number; moonBlend:number; moonError:string; materialExposure:number; materialOcean:boolean; materialCloudShadows:boolean; panoramaReady:boolean; panoramaBlend:number; compositionX:number; compositionY:number; compositionScale:number; sceneRevision:number; surfaceStarts:number; cameraMoving:boolean; centerX:number; centerY:number; centerZ:number; skyReady:boolean; skyStars:number; skyGalaxy:number; ready:boolean; texturesReady:boolean; active:boolean; frames:number; submitMs:number; previewSeconds:number; error:string; }
export const setMaterial:(exposure:number,ocean:boolean,cloudShadows:boolean)=>void;
export const setAppearance:(clouds:boolean,atmosphere:boolean,trails:boolean,closeup:boolean,autoSpin:boolean,rings:boolean)=>void;
export const setRenderActive:(active:boolean)=>void;
export const renderStatus:()=>RenderStatus;

export interface ProjectedBody { id:number; x:number; y:number; radius:number; depth:number; opacity:number; }
export interface ProjectedScene { ready:boolean; widthPx:number; heightPx:number; time:number; bodies:ProjectedBody[]; }
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
