export interface OrbitBodyConfig { name:string; massSolar:number; xAU:number; yAU:number; zAU:number; vxKmS:number; vyKmS:number; vzKmS:number; surface:number; }
export interface SimulationConfig {
  orbitBodies?: OrbitBodyConfig[];
  preset: number; count: number; speed: number; angle: number; duration: number;
  targetRadiusKm: number; impactorRadiusKm: number; targetDensity: number; impactorDensity: number;
  targetSpin: number; seed: number;
}
export const startScene: (config: SimulationConfig, initiallyPaused?: boolean) => void;
export interface OrbitBodyStatus { id:number; name:string; surface?:number; xAU:number; yAU:number; zAU:number; speedKmS:number; massSolar:number; }
export interface SimulationStatus {
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
export const saveReplay: (directory: string) => Promise<boolean>;
export const loadReplay: (directory: string) => Promise<boolean>;

export const setSkyPanorama:(pixels:ArrayBuffer,width:number,height:number)=>void;
export const setSky:(mode:number,brightness:number)=>void;
export const setComposition:(x:number,y:number,scale:number)=>void;
export interface RenderStatus { panoramaReady:boolean; panoramaBlend:number; compositionX:number; compositionY:number; compositionScale:number; sceneRevision:number; surfaceStarts:number; cameraMoving:boolean; centerX:number; centerY:number; centerZ:number; skyReady:boolean; skyStars:number; skyGalaxy:number; ready:boolean; texturesReady:boolean; active:boolean; frames:number; submitMs:number; previewSeconds:number; error:string; }
export const setAppearance:(clouds:boolean,atmosphere:boolean,trails:boolean,closeup:boolean,autoSpin:boolean,rings:boolean)=>void;
export const setRenderActive:(active:boolean)=>void;
export const renderStatus:()=>RenderStatus;

export interface ProjectedBody { id:number; x:number; y:number; radius:number; depth:number; opacity:number; }
export interface ProjectedScene { ready:boolean; widthPx:number; heightPx:number; time:number; bodies:ProjectedBody[]; }
export const projectedScene:()=>ProjectedScene;
export const pickBody:(x:number,y:number,padding:number)=>number;
