import { SphObservation, SphObservationSample, SimulationConfig } from 'libsimulation.so';
import { validateConfig, validName } from './SceneModel';
import { sphPlot, sphMetricIndex, sphMetricValue, validSphObservation, sphWindowSummary, SphWindowSummary } from './SphObservationModel';
import { ObservationPlot } from './ObservationModel';
export interface SphReference {schemaVersion:number;capturedAt:number;title:string;model:string;particleCount:number;config:SimulationConfig;data:SphObservation;}
export interface SphReferenceSummary {capturedAt:number;title:string;model:string;particleCount:number;config:SimulationConfig;count:number;firstTime:number;lastTime:number;window:SphWindowSummary;}
export interface SphComparisonPlot {plot:ObservationPlot;referencePath:string;referenceVisible:boolean;overlap:boolean;deltaReady:boolean;referenceValue?:number;delta?:number;reason:string;}
export function validateSphReference(r:SphReference):void {
  if(!r||r.schemaVersion!==1||!Number.isSafeInteger(r.capturedAt)||r.capturedAt<0)throw new Error('不支持或损坏的 SPH 参照');
  validName(r.title);validateConfig(r.config);
  const expected=(r.config.relaxationSeconds??0)>0?'sph-rock-prepared-v1':(r.config.selfGravity?'sph-rock-gravity-v1':'sph-rock-v1');
  if(r.config.preset>=3||r.model!==expected||!Number.isInteger(r.particleCount)||r.particleCount<1||r.particleCount>20000)throw new Error('参照物理模型或粒子数不匹配');
  const d=r.data;
  if(!d||!Array.isArray(d.samples)||d.samples.length<2||d.samples.length>240||d.samples.some((s:SphObservationSample):boolean=>!s||!Array.isArray(s.values))||!validSphObservation(d))throw new Error('参照需要 2–240 帧有效 SPH 记录');
}
export function copySphReference(r:SphReference):SphReference {validateSphReference(r);return JSON.parse(JSON.stringify(r)) as SphReference;}
export function sphReferenceSummary(r:SphReference):SphReferenceSummary {return {capturedAt:r.capturedAt,title:r.title,model:r.model,particleCount:r.particleCount,config:r.config,count:r.data.samples.length,firstTime:r.data.samples[0].time,lastTime:r.data.samples[r.data.samples.length-1].time,window:sphWindowSummary(r.data)};}
function seriesPath(data:SphObservation,index:number,p:ObservationPlot):string {
  const span=p.lastTime-p.firstTime;let path='';
  for(const s of data.samples){const x=span>0?(s.time-p.firstTime)/span*240:120,y=100-100*(sphMetricValue(s,index)-p.low)/(p.high-p.low);path+=(path?' L':'M')+x+' '+y;}
  return path;
}
export function sphComparisonPlot(current:SphObservation,metric:string,reference?:SphObservation):SphComparisonPlot {
  const p=sphPlot(current,metric),result:SphComparisonPlot={plot:p,referencePath:'',referenceVisible:false,overlap:false,deltaReady:false,reason:''};
  if(!reference)return result;
  const r=sphPlot(reference,metric);if(!p.available||!r.available){result.reason='当前或参照缺少该指标的有效记录';return result;}
  const low=Math.min(p.low,r.low),high=Math.max(p.high,r.high);
  if(!Number.isFinite(high-low)){result.reason='数值跨度过大，不能合并坐标轴';return result;}
  result.referenceVisible=true;result.overlap=Math.max(p.firstTime,r.firstTime)<=Math.min(p.lastTime,r.lastTime);
  p.low=low;p.high=high;p.firstTime=Math.min(p.firstTime,r.firstTime);p.lastTime=Math.max(p.lastTime,r.lastTime);
  const index=sphMetricIndex(metric);p.path=seriesPath(current,index,p);result.referencePath=seriesPath(reference,index,p);
  const x=p.lastTime>p.firstTime?(p.currentTime-p.firstTime)/(p.lastTime-p.firstTime)*240:120;p.cursorPath='M'+x+' 0 L'+x+' 100';
  const samples=reference.samples,time=p.currentTime;
  if(time<samples[0].time||time>samples[samples.length-1].time){result.reason=result.overlap?'当前时刻不在参照范围内':'两组采样时间不重叠';return result;}
  for(let i=0;i<samples.length;i++){
    const b=samples[i];if(b.time<time)continue;
    let value=sphMetricValue(b,index);
    if(b.time>time&&i>0){const a=samples[i-1],fraction=(time-a.time)/(b.time-a.time);value=(1-fraction)*sphMetricValue(a,index)+fraction*value;}
    if(Number.isFinite(value)&&Number.isFinite(p.current-value)){result.deltaReady=true;result.referenceValue=value;result.delta=p.current-value;}
    break;
  }
  return result;
}
export function sphParameterDifferences(current:SimulationConfig|undefined,reference:SimulationConfig):string[] {
  if(!current||current.preset>=3)return ['当前没有岩质 SPH 配置'];
  const labels:string[]=['实验类型','粒子预算','速度系数','偏移角 °','时长 s','主天体半径 km','撞击体半径 km','主天体密度 kg/m³','撞击体密度 kg/m³','附加自转 rad/s','随机种子','材料自引力','预松弛 s','初始比内能 MJ/kg','初始损伤'];
  const values=(c:SimulationConfig):number[]=>[c.preset,c.count,c.speed,c.angle,c.duration,c.targetRadiusKm,c.impactorRadiusKm,c.targetDensity,c.impactorDensity,c.targetSpin,c.seed,c.selfGravity?1:0,c.relaxationSeconds??0,c.initialEnergyMJkg??0,c.initialDamage??0];
  const a=values(reference),b=values(current),differences:string[]=[];
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])differences.push(labels[i]+'：'+a[i]+' → '+b[i]);
  return differences;
}
// Separate raw series, in seconds since each simulation started. No interpolated rows.
export function sphComparisonCsv(current:SphObservation,metric:string,reference?:SphObservation):string {
  const index=sphMetricIndex(metric);let text='series,frame,time_s,value\n';
  for(let i=0;i<2;i++){const data=i===0?current:reference;if(!data||!sphPlot(data,metric).available)continue;
    for(const s of data.samples)text+=(i===0?'current':'reference')+','+s.frame+','+s.time+','+sphMetricValue(s,index)+'\n';
  }
  return text;
}
