import { GalaxyObservation, GalaxySample } from 'libsimulation.so';
import { validName } from './SceneModel';
import { galaxyPlot, galaxyCsv, validateGalaxyObservation } from './GalaxyObservationModel';
import { ObservationPlot } from './ObservationModel';
export interface GalaxyReference {schemaVersion:number;capturedAt:number;title:string;model:string;data:GalaxyObservation;}
export interface GalaxyComparisonPlot {plot:ObservationPlot;referencePath:string;referenceVisible:boolean;overlap:boolean;deltaReady:boolean;referenceValue?:number;delta?:number;reason:string;}
export function validateGalaxyReference(r:GalaxyReference):void {
  if(!r||r.schemaVersion!==1||r.model!=='galaxy-tidal-restricted-v1'||!Number.isSafeInteger(r.capturedAt)||r.capturedAt<0)throw new Error('不支持或损坏的星系参照');
  validName(r.title);validateGalaxyObservation(r.data);
  if(!r.data.available||r.data.samples.length<2)throw new Error('参照需要至少两帧星系记录');
}
export function copyGalaxyReference(r:GalaxyReference):GalaxyReference {validateGalaxyReference(r);return JSON.parse(JSON.stringify(r)) as GalaxyReference;}
function value(s:GalaxySample,metric:number):number {return s.values[metric]*(metric>=3?100:1);}
function path(data:GalaxyObservation,metric:number,p:ObservationPlot):string {
  const span=p.lastTime-p.firstTime;let result='';
  for(const s of data.samples){const x=span>0?(s.time-p.firstTime)/span*240:120,y=100-100*((value(s,metric)-p.low)/(p.high-p.low));result+=(result?' L':'M')+x+' '+y;}
  return result;
}
export function galaxyComparisonPlot(current:GalaxyObservation,metric:number,reference?:GalaxyObservation):GalaxyComparisonPlot {
  const p=galaxyPlot(current,metric),result:GalaxyComparisonPlot={plot:p,referencePath:'',referenceVisible:false,overlap:false,deltaReady:false,reason:''};
  if(!reference)return result;
  const r=galaxyPlot(reference,metric);
  if(!p.available||!r.available){result.reason='当前或参照缺少星系记录';return result;}
  const low=Math.min(p.low,r.low),high=Math.max(p.high,r.high);
  if(!Number.isFinite(high-low)||high<=low){result.reason='数值跨度过大，不能合并坐标轴';return result;}
  result.referenceVisible=true;result.overlap=Math.max(p.firstTime,r.firstTime)<=Math.min(p.lastTime,r.lastTime);
  p.low=low;p.high=high;p.firstTime=Math.min(p.firstTime,r.firstTime);p.lastTime=Math.max(p.lastTime,r.lastTime);
  p.path=path(current,metric,p);result.referencePath=path(reference,metric,p);
  const x=p.lastTime>p.firstTime?(p.currentTime-p.firstTime)/(p.lastTime-p.firstTime)*240:120;p.cursorPath='M'+x+' 0 L'+x+' 100';
  const samples=reference.samples,time=p.currentTime;
  if(time<samples[0].time||time>samples[samples.length-1].time){result.reason=result.overlap?'当前时刻超出参照记录，不外推差值':'两组记录时间不重叠';return result;}
  for(let i=0;i<samples.length;i++){
    const b=samples[i];if(b.time<time)continue;
    let v=value(b,metric);
    if(b.time>time&&i>0){const a=samples[i-1],fraction=(time-a.time)/(b.time-a.time);v=(1-fraction)*value(a,metric)+fraction*v;}
    if(Number.isFinite(v)&&Number.isFinite(p.current-v)){result.referenceValue=v;result.delta=p.current-v;result.deltaReady=true;}break;
  }
  return result;
}
export function galaxyParameterDifferences(current:GalaxyObservation,reference:GalaxyObservation):string[] {
  validateGalaxyObservation(current);validateGalaxyObservation(reference);
  const a=reference.parameters,b=current.parameters;if(!current.available||!a||!b)return ['当前没有星系实验记录'];
  const labels:string[]=['示踪点数','随机种子','接近速度倍率','次盘倾角 °','模拟时长 Myr','次／主质量比','初始横向偏移 kpc'];
  const av:number[]=[a.count,a.seed,a.speed,a.inclination,a.duration,a.massRatio,a.offset],bv:number[]=[b.count,b.seed,b.speed,b.inclination,b.duration,b.massRatio,b.offset];
  const differences:string[]=[];for(let i=0;i<av.length;i++)if(av[i]!==bv[i])differences.push(labels[i]+'：'+av[i]+' → '+bv[i]);
  if(a.retrograde!==b.retrograde)differences.push('次盘自转：'+(a.retrograde?'逆行':'顺行')+' → '+(b.retrograde?'逆行':'顺行'));
  return differences;
}
// Each row retains its own applied parameters and original fractions. No resampling.
export function galaxyComparisonCsv(current:GalaxyObservation,reference?:GalaxyObservation):string {
  const currentCsv=galaxyCsv(current),lines=currentCsv.trimEnd().split('\n');let csv='series,'+lines[0]+'\n';
  for(let i=1;i<lines.length;i++)csv+='current,'+lines[i]+'\n';
  if(reference){const rows=galaxyCsv(reference).trimEnd().split('\n');for(let i=1;i<rows.length;i++)csv+='reference,'+rows[i]+'\n';}
  return csv;
}
