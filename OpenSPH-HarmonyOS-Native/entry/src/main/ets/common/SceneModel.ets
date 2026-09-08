import { SimulationConfig, OrbitBodyConfig } from 'libsimulation.so';

export interface BodyDefinition { id: string; name: string; kind: string; radiusKm: number; density: number; }
export interface SceneDefinition {
  schemaVersion: number; model: string; title: string; config: SimulationConfig; bodies: BodyDefinition[];
}
export interface RecipeCamera { yaw:number; pitch:number; zoom:number; focus:number; color:number; }
export interface RecipeAppearance { clouds:boolean; atmosphere:boolean; trails:boolean; closeup:boolean; autoSpin:boolean; rings:boolean; }
export interface RecipeMaterial { exposure:number; ocean:boolean; cloudShadows:boolean; }
export function defaultMaterial():RecipeMaterial {return {exposure:0,ocean:true,cloudShadows:true};}
export function validateMaterial(m:RecipeMaterial):void {
 if(!m||typeof m.ocean!=='boolean'||typeof m.cloudShadows!=='boolean')throw new Error('无效材质开关');check(m.exposure,-2,2);
}
export interface RecipeSky { mode:number; brightness:number; }
export interface RecipeRing { modelVersion?:number; impulse?:number; points?:boolean; enabled:boolean; target:number; timeHours:number; speedScale:number; rateHours:number; }
export interface SurfaceRecipe { version:number;seed:number;cloudSeed:number; }
export function legacySurfaces(count:number):SurfaceRecipe[] {const values:SurfaceRecipe[]=[];for(let i=0;i<count;i++)values.push({version:1,seed:0,cloudSeed:0});return values;}
export function copySurfaces(values:SurfaceRecipe[]):SurfaceRecipe[] {return values.map((v:SurfaceRecipe):SurfaceRecipe=>({version:v.version,seed:v.seed,cloudSeed:v.cloudSeed}));}
export function validateSurfaces(values:SurfaceRecipe[],bodies:OrbitBodyConfig[]):void {
  if(!Array.isArray(values)||values.length!==bodies.length)throw new Error('外观数量与天体不匹配');
  for(let i=0;i<values.length;i++){const v=values[i];if(!v||v.version!==1)throw new Error('不支持的地貌生成版本');check(v.seed,0,1000000,true);check(v.cloudSeed,0,1000000,true);
    if((i===0||bodies[i].surface===5)&&(v.seed!==0||v.cloudSeed!==0))throw new Error('恒星和真实月面保留原外观');}
}
export interface ExperimentRecipe {
  surfaces?:SurfaceRecipe[]; schemaVersion:number; appearanceVersion:number; themeId:string; camera:RecipeCamera;
  material?:RecipeMaterial; overview?:RecipeCamera; appearance:RecipeAppearance; sky:RecipeSky; ring:RecipeRing;
}
export interface SavedProject { id: string; savedAt: number; scene: SceneDefinition; recipe?:ExperimentRecipe; }

export function defaultRecipe(scene:SceneDefinition):ExperimentRecipe {
  return {schemaVersion:1,appearanceVersion:2,material:defaultMaterial(),themeId:'',
    camera:{yaw:.15,pitch:.25,zoom:2.7*Math.max(1,scene.config.targetRadiusKm/100),focus:-1,color:0},
    appearance:{clouds:true,atmosphere:true,trails:true,closeup:false,autoSpin:false,rings:true},
    sky:{mode:2,brightness:.65},ring:{enabled:false,target:-1,timeHours:0,speedScale:1,rateHours:1}};
}
export function validateRecipe(r:ExperimentRecipe,scene:SceneDefinition):void {
  if(!r||r.schemaVersion!==1||(r.appearanceVersion!==1&&r.appearanceVersion!==2&&r.appearanceVersion!==3))throw new Error('不支持的实验配方版本');
  if(r.appearanceVersion>=2)validateMaterial(r.material!);
  else if(r.material!==undefined)throw new Error('旧外观版本不支持材质配置');
  if(typeof r.themeId!=='string'||r.themeId.length>64||!/^[a-z0-9-]*$/.test(r.themeId))throw new Error('无效主题编号');
  const preset=scene.config.preset;
  if(r.appearanceVersion===3)validateSurfaces(r.surfaces!,preset===5?scene.config.orbitBodies!:[]);
  else if(r.surfaces!==undefined)throw new Error('旧外观版本不支持地貌配方');
  const maxFocus=preset===5?scene.config.orbitBodies!.length-1:(preset===4?3:1);
  validateRecipeCamera(r.camera,maxFocus,preset);
  if(r.overview!==undefined){validateRecipeCamera(r.overview,maxFocus,preset);if(r.overview.focus!==-1)throw new Error('返回视角必须是全景');}
  const a=r.appearance;
  if(!a||[a.clouds,a.atmosphere,a.trails,a.closeup,a.autoSpin,a.rings].some((v:boolean):boolean=>typeof v!=='boolean'))throw new Error('无效外观开关');
  if(a.closeup&&(preset<3||r.camera.focus<0))throw new Error('近看视角与场景不匹配');
  if(!r.sky)throw new Error('缺少星空配置');check(r.sky.mode,0,2,true);check(r.sky.brightness,0,1);
  const t=r.ring;if(!t||typeof t.enabled!=='boolean')throw new Error('缺少局部环配置');
  if(t.modelVersion!==undefined&&t.modelVersion!==2)throw new Error('不支持的环模型版本');
  if(t.modelVersion===2){check(t.impulse!,0,.35);if(typeof t.points!=='boolean')throw new Error('无效环颗粒开关');}
  else if(t.impulse!==undefined||t.points!==undefined)throw new Error('扰动参数需要环模型版本 2');
  if(!t.enabled&&((t.impulse??0)!==0||(t.points??false)))throw new Error('关闭的环必须清除扰动');
  check(t.timeHours,0,24);check(t.speedScale,1,1.2);check(t.rateHours,.1,4);check(t.target,-1,maxFocus,true);
  if(t.enabled){
    if(preset!==5||t.target<1||t.target!==r.camera.focus||scene.config.orbitBodies![t.target].surface!==4)throw new Error('局部环目标与带环行星不匹配');
  }else if(t.target!==-1||t.timeHours!==0||t.speedScale!==1||t.rateHours!==1)throw new Error('关闭的局部环必须使用默认参数');
}
function validateRecipeCamera(c:RecipeCamera,maxFocus:number,preset:number):void {
  if(!c)throw new Error('缺少观察视角');
  check(c.yaw,-Number.MAX_VALUE,Number.MAX_VALUE);check(c.pitch,-1.5,1.5);check(c.zoom,.5,15);
  check(c.focus,-1,maxFocus,true);check(c.color,0,preset>=3?1:6,true);
}
export function validateConfig(c: SimulationConfig): void {
  if(!c || typeof c !== 'object') throw new Error('缺少场景配置');
  if(c.relaxationSeconds!==undefined&&![0,16,64].includes(c.relaxationSeconds))throw new Error('预松弛时长只支持 0、16、64 秒');
  if((c.relaxationSeconds??0)>0&&(!c.selfGravity||c.preset>=3))throw new Error('预松弛需要岩质模型与材料自引力');
  if(c.selfGravity!==undefined&&typeof c.selfGravity!=='boolean')throw new Error('自引力必须为布尔值');
  if(c.selfGravity&&(c.preset>=3||c.count>1200))throw new Error('SPH 自引力支持岩质实验，粒子预算不超过 1200');
  check(c.preset,0,5,true);check(c.count,200,2400,true);check(c.speed,c.preset>=3?0.75:(c.preset===2?0:0.5),c.preset>=3?1.25:10);check(c.angle,0,70);check(c.duration,1,c.preset>=3?10:120);
  check(c.targetRadiusKm,40,200);check(c.impactorRadiusKm,20,120);check(c.targetDensity,2400,3000);
  check(c.impactorDensity,2400,3000);check(c.targetSpin,-0.01,0.01);check(c.seed,1,1000000,true);
  if(c.preset===5){check(c.speed,1,1);validateOrbitBodies(c.orbitBodies!);}
  else if(c.orbitBodies!==undefined&&(!Array.isArray(c.orbitBodies)||c.orbitBodies.length!==0))throw new Error("只有自定义系统接受天体列表");
}
function check(n: number, low: number, high: number, integer: boolean = false): void {
  if(typeof n !== 'number' || !Number.isFinite(n) || n<low || n>high || (integer&&!Number.isInteger(n))) throw new Error('参数超出范围 '+low+'…'+high);
}
export function validName(name: string): string {
  if(typeof name !== 'string' || name.trim().length<1 || name.length>48) throw new Error('名称需要 1–48 个字符');
  return name.trim();
}
export function validateScene(s: SceneDefinition): void {
  if(!s || s.schemaVersion!==1 || (s.model!=='sph-rock-v1'&&s.model!=='sph-rock-gravity-v1'&&s.model!=='sph-rock-prepared-v1'&&s.model!=='nbody-v1'&&s.model!=='nbody-custom-v1'&&s.model!=='nbody-hard-sphere-v1')) throw new Error('不支持的场景版本或物理模型');
  validName(s.title);validateConfig(s.config);
  if(s.config.preset>=3){
    if(s.model!==(s.config.preset===5?(finiteOrbitBodies(s.config.orbitBodies!)?'nbody-hard-sphere-v1':'nbody-custom-v1'):'nbody-v1')||!Array.isArray(s.bodies)||s.bodies.length!==0)throw new Error('引力预设由原生模型定义，不接受岩质天体配置');
    return;
  }
  if(s.model!==((s.config.relaxationSeconds??0)>0?'sph-rock-prepared-v1':(s.config.selfGravity?'sph-rock-gravity-v1':'sph-rock-v1')))throw new Error('物理模型与预设不匹配');
  if(!Array.isArray(s.bodies)||s.bodies.length!==(s.config.preset===2?1:2)) throw new Error('天体数量不匹配');
  for(let i=0;i<s.bodies.length;i++) {
    const b: BodyDefinition=s.bodies[i];
    if(!b || b.id!==(i===0?'primary':'impactor') || b.kind!=='rock') throw new Error('不支持的天体类型');
    validName(b.name);
    if(b.radiusKm!==(i===0?s.config.targetRadiusKm:s.config.impactorRadiusKm)||b.density!==(i===0?s.config.targetDensity:s.config.impactorDensity)) throw new Error('天体与求解配置不一致');
  }
}
export function sphereMass(radiusKm: number, density: number): number { return 4*Math.PI/3*Math.pow(radiusKm*1000,3)*density; }

// Initial values use AU, km/s and solar mass; the solver shifts the whole system to its barycentre.
export const EARTH_MASS_SOLAR: number = 398600.435507e9/1.32712440041279419e20;
export function finiteOrbitBodies(bodies:OrbitBodyConfig[]):boolean {return bodies.length>0&&bodies[0].radiusKm!==undefined;}
export function estimatedOrbitRadius(massSolar:number,star:boolean):number {return star?695700*Math.cbrt(massSolar):6371*Math.cbrt(massSolar/EARTH_MASS_SOLAR);}
export function contactDemoBodies():OrbitBodyConfig[] {
  return [{name:'恒星',massSolar:1,xAU:0,yAU:0,zAU:0,vxKmS:0,vyKmS:0,vzKmS:0,surface:0,radiusKm:695700},
    {name:'接触球 A',massSolar:EARTH_MASS_SOLAR,xAU:1,yAU:-.00012,zAU:0,vxKmS:0,vyKmS:35,vzKmS:0,surface:1,radiusKm:6371},
    {name:'接触球 B',massSolar:EARTH_MASS_SOLAR*.4,xAU:1,yAU:.00012,zAU:0,vxKmS:0,vyKmS:25,vzKmS:0,surface:3,radiusKm:6371*Math.cbrt(.4)}];
}
export function validateOrbitBodies(bodies: OrbitBodyConfig[]): void {
  if(!Array.isArray(bodies)||bodies.length<2||bodies.length>8)throw new Error('需要 1 颗恒星与 1–7 颗行星');
  for(let i=0;i<bodies.length;i++) {
    const b:OrbitBodyConfig=bodies[i];if(!b||typeof b!=='object')throw new Error('缺少天体参数');
    if(finiteOrbitBodies(bodies)){check(b.radiusKm!,1,1e7);}else if(b.radiusKm!==undefined)throw new Error('全部天体须使用一致的接触模型');
    validName(b.name);if(/[\x00-\x1f\x7f]/.test(b.name))throw new Error('名称不能包含控制字符');
    for(let k=0;k<b.name.length;k++){const u=b.name.charCodeAt(k);if(u>=0xd800&&u<=0xdbff){const next=b.name.charCodeAt(++k);if(!(next>=0xdc00&&next<=0xdfff))throw new Error('名称包含无效字符');}else if(u>=0xdc00&&u<=0xdfff)throw new Error('名称包含无效字符');}
    check(b.massSolar,i===0?0.1:1e-8,i===0?2:0.01);check(b.surface,i===0?0:1,i===0?0:5,true);
    check(b.xAU,-10,10);check(b.yAU,-10,10);check(b.zAU,-10,10);
    check(b.vxKmS,-100,100);check(b.vyKmS,-100,100);check(b.vzKmS,-100,100);
    check(Math.sqrt(b.vxKmS*b.vxKmS+b.vyKmS*b.vyKmS+b.vzKmS*b.vzKmS),0,100);
    for(let j=0;j<i;j++){const a=bodies[j];if(Math.sqrt((b.xAU-a.xAU)**2+(b.yAU-a.yAU)**2+(b.zAU-a.zAU)**2)<(finiteOrbitBodies(bodies)?(b.radiusKm!+a.radiusKm!)/149597870.7:.05))throw new Error(finiteOrbitBodies(bodies)?'天体实体半径重叠，请增大间距':'初始天体间距至少为 0.05 AU');}
  }
}
export function circularBody(name:string,radius:number,phase:number,surface:number,starMass:number=1):OrbitBodyConfig {
  const speed:number=Math.sqrt(1.32712440041279419e20*(starMass+EARTH_MASS_SOLAR)/(radius*149597870700))/1000;
  return {name:name,massSolar:EARTH_MASS_SOLAR,xAU:radius*Math.cos(phase),yAU:radius*Math.sin(phase),zAU:0,
    vxKmS:-speed*Math.sin(phase),vyKmS:speed*Math.cos(phase),vzKmS:0,surface:surface};
}
export function defaultOrbitBodies():OrbitBodyConfig[] {
  const star:OrbitBodyConfig={name:'恒星',massSolar:1,xAU:0,yAU:0,zAU:0,vxKmS:0,vyKmS:0,vzKmS:0,surface:0};
  return [star,circularBody('蔚蓝',1,0,1),circularBody('暮云',0.72,2.1,2),circularBody('赤砂',1.52,4.2,3)];
}
export function copyOrbitBodies(bodies:OrbitBodyConfig[]):OrbitBodyConfig[] {
  return bodies.map((b:OrbitBodyConfig):OrbitBodyConfig=>{const result:OrbitBodyConfig={name:b.name,massSolar:b.massSolar,xAU:b.xAU,yAU:b.yAU,zAU:b.zAU,vxKmS:b.vxKmS,vyKmS:b.vyKmS,vzKmS:b.vzKmS,surface:b.surface};if(b.radiusKm!==undefined)result.radiusKm=b.radiusKm;return result;});
}

export interface OrbitPreview {
  valid:boolean; error:string; plane:string; positionAU:number[]; velocityKmS:number[];
  positionPath:string; velocityPath:string; positionScale:number; velocityScale:number;
}
function vectorArrow(v:number[],axis:number,scale:number):string {
  const dx=v[0]/scale*34,dy=-v[axis]/scale*34,x=50+dx,y=45+dy,length=Math.sqrt(dx*dx+dy*dy);
  if(length<0.01)return 'M47 45 L53 45 M50 42 L50 48';
  const ux=dx/length,uy=dy/length,head=Math.min(6,length*.5);
  return 'M50 45 L'+x+' '+y+' M'+(x-ux*head-uy*head*.6)+' '+(y-uy*head+ux*head*.6)+' L'+x+' '+y+' L'+(x-ux*head+uy*head*.6)+' '+(y-uy*head-ux*head*.6);
}
// Input-coordinate preview only: no integration, recentering or system mutation.
export function previewOrbit(fields:string[],plane:string):OrbitPreview {
  const p:OrbitPreview={valid:false,error:'请填写有效的位置和速度',plane:plane,positionAU:[],velocityKmS:[],positionPath:'',velocityPath:'',positionScale:1,velocityScale:1};
  if(fields.length!==7||!['XY','XZ'].includes(plane))return p;
  const values:number[]=fields.slice(1,7).map((s:string):number=>s.trim()===''?Number.NaN:Number(s));
  if(values.some((v:number):boolean=>!Number.isFinite(v)))return p;
  if(values.slice(0,3).some((v:number):boolean=>Math.abs(v)>10)||Math.hypot(values[3],values[4],values[5])>100)return p;
  p.positionAU=values.slice(0,3);p.velocityKmS=values.slice(3);const axis=plane==='XY'?1:2;
  p.positionScale=Math.max(.1,Math.ceil(Math.max(Math.abs(values[0]),Math.abs(values[axis]))*10)/10);
  p.velocityScale=Math.max(.1,Math.ceil(Math.max(Math.abs(values[3]),Math.abs(values[axis+3]))*10)/10);
  p.positionPath=vectorArrow(p.positionAU,axis,p.positionScale);p.velocityPath=vectorArrow(p.velocityKmS,axis,p.velocityScale);
  p.valid=true;p.error='';return p;
}

export interface PlacementPreview {
  valid:boolean; error:string; body:OrbitBodyConfig|undefined; speedKmS:number; circularKmS:number;
  escapeKmS:number; nearestAU:number; bound:boolean; plotScale:number; orbitPath:string;
  candidateX:number; candidateY:number; markerPath:string; velocityPath:string;
}
// Original two-body initial-condition construction. No competitor implementation.
export function planPlanet(bodies:OrbitBodyConfig[],name:string,fields:string[],surface:number,direction:number,plotExtent:number=0,target:number=-1):PlacementPreview {
  const result:PlacementPreview={valid:false,error:'填写有效的放置参数',body:undefined,speedKmS:0,circularKmS:0,escapeKmS:0,nearestAU:0,bound:false,plotScale:1,orbitPath:'',candidateX:120,candidateY:120,markerPath:'',velocityPath:''};
  try {
    if(fields.length!==(finiteOrbitBodies(bodies)?6:5)||fields.some((v:string):boolean=>v.trim()===''))throw new Error('请填写全部放置参数');
    validateOrbitBodies(bodies);if(bodies.length>=8)throw new Error('最多支持 8 个天体');
    const v:number[]=fields.map((s:string):number=>Number(s));
    check(v[0],1e-8/EARTH_MASS_SOLAR,.01/EARTH_MASS_SOLAR);check(v[1],.05,10);check(v[2],0,360);check(v[3],-90,90);check(v[4],0,2);
    check(surface,1,5,true);if(direction!==1&&direction!==-1)throw new Error('方向无效');
    const star=bodies[0],r=v[1],phase=v[2]*Math.PI/180,tilt=v[3]*Math.PI/180,mass=v[0]*EARTH_MASS_SOLAR;
    const cs=Math.cos(phase),sn=Math.sin(phase),ci=Math.cos(tilt),si=Math.sin(tilt);
    const circular=Math.sqrt(1.32712440041279419e20*(star.massSolar+mass)/(r*149597870700))/1000,speed=circular*v[4];
    const b:OrbitBodyConfig={name:validName(name),massSolar:mass,surface:surface,
      xAU:star.xAU+r*cs,yAU:star.yAU+r*sn*ci,zAU:star.zAU+r*sn*si,
      vxKmS:star.vxKmS-speed*sn*direction,vyKmS:star.vyKmS+speed*cs*ci*direction,vzKmS:star.vzKmS+speed*cs*si*direction};
    if(finiteOrbitBodies(bodies)){check(v[5],1,1e7);b.radiusKm=v[5];}
    if(target!==-1){
      check(target,0,bodies.length-1,true);const aim=bodies[target];
      const dx=aim.xAU-b.xAU,dy=aim.yAU-b.yAU,dz=aim.zAU-b.zAU,d=Math.hypot(dx,dy,dz);
      if(d<(b.radiusKm!==undefined?(b.radiusKm+aim.radiusKm!)/149597870.7:.02))throw new Error('瞄准对象距离过近，请移动待放天体');
      b.vxKmS=star.vxKmS+speed*dx/d*direction;b.vyKmS=star.vyKmS+speed*dy/d*direction;b.vzKmS=star.vzKmS+speed*dz/d*direction;
    }
    result.body=b;result.circularKmS=circular;result.speedKmS=speed;result.escapeKmS=circular*Math.SQRT2;result.bound=v[4]<Math.SQRT2;
    result.nearestAU=Math.min(...bodies.map((a:OrbitBodyConfig):number=>Math.hypot(b.xAU-a.xAU,b.yAU-a.yAU,b.zAU-a.zAU)));
    let extent=r*1.3;for(const a of bodies)extent=Math.max(extent,Math.hypot(a.xAU-star.xAU,(a.yAU-star.yAU)*ci+(a.zAU-star.zAU)*si)*1.15);
    if(plotExtent>0)extent=plotExtent;
    result.plotScale=Math.max(.1,extent);const scale=100/result.plotScale;
    result.candidateX=120+r*cs*scale;result.candidateY=120-r*sn*scale;
    for(const a of bodies){const x=120+(a.xAU-star.xAU)*scale,y=120-((a.yAU-star.yAU)*ci+(a.zAU-star.zAU)*si)*scale;
      result.markerPath+='M'+(x-2)+' '+y+' L'+(x+2)+' '+y+' M'+x+' '+(y-2)+' L'+x+' '+(y+2)+' ';}
    if(v[4]===0)result.orbitPath='M120 120 L'+result.candidateX+' '+result.candidateY;
    else {let previous=false;for(let i=0;i<=180;i++){
      const angle=-Math.PI+2*Math.PI*i/180,den=1+(v[4]*v[4]-1)*Math.cos(angle),radius=r*v[4]*v[4]/den;
      if(den<=.0001||radius>extent*1.05){previous=false;continue;}
      const x=120+radius*Math.cos(phase+angle)*scale,y=120-radius*Math.sin(phase+angle)*scale;
      result.orbitPath+=(previous?' L':' M')+x+' '+y;previous=true;
    }}
    const length=Math.min(34,v[4]*24),dx=-sn*direction,dy=-cs*direction,x=result.candidateX,y=result.candidateY;
    if(length>0)result.velocityPath='M'+x+' '+y+' L'+(x+dx*length)+' '+(y+dy*length)+' M'+(x+dx*(length-6)-dy*3)+' '+(y+dy*(length-6)+dx*3)+' L'+(x+dx*length)+' '+(y+dy*length)+' L'+(x+dx*(length-6)+dy*3)+' '+(y+dy*(length-6)-dx*3);
    if(target>=0){
      result.orbitPath='';const vx=b.vxKmS-star.vxKmS,vy=(b.vyKmS-star.vyKmS)*ci+(b.vzKmS-star.vzKmS)*si;
      const n=Math.hypot(vx,vy),length=Math.min(34,v[4]*24);
      result.velocityPath=n>0?'M'+result.candidateX+' '+result.candidateY+' L'+(result.candidateX+vx/n*length)+' '+(result.candidateY-vy/n*length):'';
    }
    validateOrbitBodies(bodies.concat([b]));result.valid=true;result.error='';
  }catch(e){result.error=String(e);}
  return result;
}
// Plot coordinates are normalized to the square above, in the selected orbital plane.
export function placementPoint(x:number,y:number,scale:number):number[] {
  check(x,0,1);check(y,0,1);check(scale,.1,100);
  const dx=(x*240-120)/100*scale,dy=(120-y*240)/100*scale;
  const radius=Math.hypot(dx,dy);check(radius,.05,10);
  return [radius,(Math.atan2(dy,dx)*180/Math.PI+360)%360];
}

export interface CopiedPlanetDraft { name:string; fields:string[]; surface:number; }
// Reuse applied mass and appearance only. Build a fresh circular XY orbit, not a live-state clone.
export function copiedPlanetDraft(bodies:OrbitBodyConfig[],index:number):CopiedPlanetDraft {
  validateOrbitBodies(bodies);check(index,1,bodies.length-1,true);
  if(bodies.length>=8)throw new Error('最多支持 8 个天体');
  const source=bodies[index],star=bodies[0];
  let name='';
  for(let n=1;n<=9;n++){
    const suffix=' · 副本'+(n===1?'':' '+n);
    let prefix=source.name.slice(0,48-suffix.length);
    const last=prefix.charCodeAt(prefix.length-1);
    if(last>=0xd800&&last<=0xdbff)prefix=prefix.slice(0,-1);
    name=prefix+suffix;
    if(!bodies.some((b:OrbitBodyConfig):boolean=>b.name===name))break;
  }
  const radius=Math.max(.1,Math.min(8,Math.hypot(source.xAU-star.xAU,source.yAU-star.yAU,source.zAU-star.zAU)));
  const phase=(Math.atan2(source.yAU-star.yAU,source.xAU-star.xAU)*180/Math.PI+405)%360;
  const draft:CopiedPlanetDraft={name:name,fields:[String(source.massSolar/EARTH_MASS_SOLAR),String(radius),String(phase),'0','1'],surface:source.surface};
  if(finiteOrbitBodies(bodies))draft.fields.push(String(source.radiusKm));
  // Prefer a displaced position at the same distance; use validated alternatives near boundaries.
  for(const r of [radius,.5,1,2,4,6,8])for(let step=0;step<16;step++){
    const fields=[draft.fields[0],String(r),String((phase+step*22.5)%360),'0','1'];
    if(finiteOrbitBodies(bodies))fields.push(String(source.radiusKm));
    if(planPlanet(bodies,name,fields,source.surface,1).valid){draft.fields=fields;return draft;}
  }
  // An editable invalid preview is preferable to silently changing mass or relaxing limits.
  return draft;
}
