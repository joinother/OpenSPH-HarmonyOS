import { OrbitObservation, ObservationSample, SimulationConfig } from 'libsimulation.so';
import { validateConfig, validName } from './SceneModel';
import { observationPlot, ObservationPlot } from './ObservationModel';
export interface ObservationReference {schemaVersion:number;capturedAt:number;title:string;config:SimulationConfig;data:OrbitObservation;}
export interface ComparisonPlot {plot:ObservationPlot;referencePath:string;referenceVisible:boolean;overlap:boolean;deltaReady:boolean;referenceValue:number;delta:number;}
export interface ReferenceSummary {capturedAt:number;title:string;body:number;name:string;count:number;firstTime:number;lastTime:number;config:SimulationConfig;}
export function validateReference(r:ObservationReference):void {
  if(!r||r.schemaVersion!==1||!Number.isSafeInteger(r.capturedAt)||r.capturedAt<0)throw new Error('不支持或损坏的对照记录');
  validName(r.title);validateConfig(r.config);if(r.config.preset<3)throw new Error('对照记录需要轨道模型');
  const d=r.data,n=r.config.preset===5?r.config.orbitBodies!.length:r.config.preset===4?4:2;
  if(!d||typeof d.name!=='string'||d.name.length<1||d.name.length>48||!Number.isInteger(d.body)||d.body<1||d.body>=n||!Number.isSafeInteger(d.sceneRevision)||d.sceneRevision<0)throw new Error('无效的对照天体');
  if(!Array.isArray(d.samples)||d.samples.length<2||d.samples.length>240||!Number.isInteger(d.selected)||d.selected< -1||d.selected>=d.samples.length)throw new Error('对照需要 2–240 帧');
  if(d.samples.some((s:ObservationSample):boolean=>!s||s.distanceAU>1e6||s.speedKmS>1e6))throw new Error('缺少对照样本');
  if(!observationPlot(d,'distance').available||!observationPlot(d,'speed').available||d.samples[d.samples.length-1].time>r.config.duration+1e-6)throw new Error('无效的对照数据');
  if(r.config.preset===5&&d.name!==r.config.orbitBodies![d.body].name)throw new Error('对照名称与初始条件不匹配');
}
export function referenceSummary(r:ObservationReference):ReferenceSummary {
  return {capturedAt:r.capturedAt,title:r.title,body:r.data.body,name:r.data.name,count:r.data.samples.length,firstTime:r.data.samples[0].time,lastTime:r.data.samples[r.data.samples.length-1].time,config:r.config};
}
export function copyReference(r:ObservationReference):ObservationReference {
  validateReference(r);return JSON.parse(JSON.stringify(r)) as ObservationReference;
}
function valueAt(data:OrbitObservation,time:number,metric:string):number|undefined {
  const s=data.samples;if(!s.length||time<s[0].time||time>s[s.length-1].time)return undefined;
  for(let i=0;i<s.length;i++){
    const b=s[i],bv=metric==='distance'?b.distanceAU:b.speedKmS;
    if(b.time===time)return bv;
    if(b.time>time&&i>0){const a=s[i-1],av=metric==='distance'?a.distanceAU:a.speedKmS;return av+(bv-av)*(time-a.time)/(b.time-a.time);}
  }
  return undefined;
}
function seriesPath(data:OrbitObservation,metric:string,p:ObservationPlot):string {
  const span=p.lastTime-p.firstTime;let path='';
  for(const s of data.samples){const x=span>0?(s.time-p.firstTime)/span*240:120,y=100-100*((metric==='distance'?s.distanceAU:s.speedKmS)-p.low)/(p.high-p.low);path+=(path?' L':'M')+x+' '+y;}
  return path;
}
export function comparisonPlot(current:OrbitObservation,metric:string,reference?:OrbitObservation):ComparisonPlot {
  const p=observationPlot(current,metric),result:ComparisonPlot={plot:p,referencePath:'',referenceVisible:false,overlap:false,deltaReady:false,referenceValue:0,delta:0};
  if(!reference||!p.available)return result;
  const r=observationPlot(reference,metric);if(!r.available)return result;
  result.referenceVisible=true;result.overlap=Math.max(p.firstTime,r.firstTime)<=Math.min(p.lastTime,r.lastTime);
  p.low=Math.min(p.low,r.low);p.high=Math.max(p.high,r.high);p.firstTime=Math.min(p.firstTime,r.firstTime);p.lastTime=Math.max(p.lastTime,r.lastTime);
  p.path=seriesPath(current,metric,p);result.referencePath=seriesPath(reference,metric,p);
  const x=p.lastTime>p.firstTime?(p.currentTime-p.firstTime)/(p.lastTime-p.firstTime)*240:120;p.cursorPath='M'+x+' 0 L'+x+' 100';
  const v=valueAt(reference,p.currentTime,metric);
  if(v!==undefined){result.deltaReady=true;result.referenceValue=v;result.delta=p.current-v;}
  return result;
}
export function observationCsv(current:OrbitObservation,reference?:OrbitObservation):string {
  let text='series,frame,time_year,distance_AU,barycentric_speed_km_s\n';
  for(let i=0;i<2;i++){const data=i===0?current:reference;if(!data)continue;
    if(data.samples.length&&!observationPlot(data,'distance').available)throw new Error('无效距离记录');
    if(data.samples.length&&!observationPlot(data,'speed').available)throw new Error('无效速度记录');
    for(const p of data.samples)text+=(i===0?'current':'reference')+','+p.frame+','+p.time+','+p.distanceAU+','+p.speedKmS+'\n';
  }
  return text;
}
