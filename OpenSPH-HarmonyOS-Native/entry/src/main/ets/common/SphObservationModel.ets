import { SphObservation } from 'libsimulation.so';
import { ObservationPlot } from './ObservationModel';
export function sphMetricIndex(metric:string):number {
  const names:string[]=['pressure','internal','damage','kinetic','energy'];
  const index=names.indexOf(metric);if(index<0)throw new Error('未知 SPH 曲线指标');return [1,5,6,8,9][index];
}
export function sphMetricLabel(metric:string):string {
  sphMetricIndex(metric);return metric==='pressure'?'峰值压力':(metric==='internal'?'平均比内能':(metric==='damage'?'平均材料损伤':(metric==='kinetic'?'总动能':'总内能')));
}
export function validSphObservation(data:SphObservation):boolean {
  if(data.samples.length===0||data.samples.length>240||!Number.isSafeInteger(data.sceneRevision)||data.sceneRevision<0||!Number.isInteger(data.selected)||data.selected< -1||data.selected>=data.samples.length)return false;
  for(let i=0;i<data.samples.length;i++){
    const s=data.samples[i],v=s.values;
    if(s.frame!==i||!Number.isFinite(s.time)||s.time<0||(i>0&&s.time<=data.samples[i-1].time)||v.length!==10||!v.every((x:number):boolean=>Number.isFinite(x)))return false;
    if(v[0]>v[2]||v[2]>v[1]||v[3]>v[5]||v[5]>v[4]||v[6]<0||v[6]>v[7]||v[7]>1||v[8]<0)return false;
  }
  return true;
}
export function sphPlot(data:SphObservation,metric:string):ObservationPlot {
  const index=sphMetricIndex(metric),unit=metric==='pressure'?'GPa':(metric==='internal'?'MJ/kg':(metric==='damage'?'0–1':'J'));
  const p:ObservationPlot={available:false,path:'',cursorPath:'',unit,low:0,high:1,firstTime:0,lastTime:0,current:0,currentTime:0,minimum:0,maximum:0,minFrame:-1,maxFrame:-1,minTime:0,maxTime:0};
  if(!validSphObservation(data))return p;
  const samples=data.samples;let low=0,high=0;
  for(let i=1;i<samples.length;i++){if(samples[i].values[index]<samples[low].values[index])low=i;if(samples[i].values[index]>samples[high].values[index])high=i;}
  p.minimum=samples[low].values[index];p.maximum=samples[high].values[index];p.minFrame=low;p.maxFrame=high;p.minTime=samples[low].time;p.maxTime=samples[high].time;
  const pad=Math.max((p.maximum-p.minimum)*.08,Math.max(Math.abs(p.minimum),Math.abs(p.maximum))*.001,1e-9);
  const lower=p.minimum-pad,upper=p.maximum+pad;
  if(!Number.isFinite(lower)||!Number.isFinite(upper)||!Number.isFinite(upper-lower)||upper<=lower)return p;
  p.low=lower;p.high=upper;p.firstTime=samples[0].time;p.lastTime=samples[samples.length-1].time;
  const span=p.lastTime-p.firstTime;
  for(const s of samples){const x=span>0?(s.time-p.firstTime)/span*240:120,y=100-100*(s.values[index]-p.low)/(p.high-p.low);p.path+=(s.frame===0?'M':' L')+x+' '+y;}
  const s=samples[data.selected<0?samples.length-1:data.selected],x=span>0?(s.time-p.firstTime)/span*240:120;
  p.current=s.values[index];p.currentTime=s.time;p.cursorPath='M'+x+' 0 L'+x+' 100';p.available=true;return p;
}
export function sphCsv(data:SphObservation):string {
  if(!validSphObservation(data))throw new Error('没有完整有效的 SPH 诊断记录');
  let csv='frame,time_s,pressure_min_GPa,pressure_max_GPa,pressure_mean_GPa,internal_min_MJkg,internal_max_MJkg,internal_mean_MJkg,damage_mean,damage_max,kinetic_J,internal_J\n';
  for(const s of data.samples)csv+=s.frame+','+s.time+','+s.values.join(',')+'\n';return csv;
}
