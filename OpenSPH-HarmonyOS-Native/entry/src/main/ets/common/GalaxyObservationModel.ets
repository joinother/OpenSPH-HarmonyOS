import { GalaxyObservation, GalaxySample, OrbitObservation, ObservationSample } from 'libsimulation.so';
import { observationPlot, ObservationPlot } from './ObservationModel';
export const GALAXY_METRICS:string[]=['间距','主盘尺度','次盘尺度','主盘外延','次盘外延'];
export function validateGalaxyObservation(data:GalaxyObservation):void {
  if(!data||typeof data.available!=='boolean'||!Array.isArray(data.samples)||!Number.isSafeInteger(data.sceneRevision)||data.sceneRevision<0||!Number.isInteger(data.selected)||data.selected< -1||(data.selected>=0&&data.selected>=data.samples.length))throw new Error('星系记录身份或选择损坏');
  if(!data.available){if(data.samples.length!==0)throw new Error('不可用记录包含数据');return;}
  const p=data.parameters;if(!p||data.samples.length<1||data.samples.length>240)throw new Error('星系记录不完整');
  if(!Number.isInteger(p.count)||p.count<200||p.count>2400||!Number.isInteger(p.seed)||p.seed<1||p.seed>1000000||typeof p.retrograde!=='boolean')throw new Error('星系参数不完整');
  const values:number[]=[p.speed,p.inclination,p.duration,p.massRatio,p.offset];const low:number[]=[.75,0,50,.2,0],high:number[]=[1.25,70,800,1,30];
  for(let i=0;i<values.length;i++)if(!Number.isFinite(values[i])||values[i]<low[i]||values[i]>high[i])throw new Error('星系参数越界');
  for(let i=0;i<data.samples.length;i++){const v=data.samples[i];if(!v||!Array.isArray(v.values)||v.frame!==i||!Number.isFinite(v.time)||v.time<0||v.time>p.duration||(i>0&&v.time<=data.samples[i-1].time)||v.values.length!==5||v.values.some((x:number):boolean=>!Number.isFinite(x)||x<0)||v.values[3]>1||v.values[4]>1||!Number.isFinite(v.energyError)||!Number.isFinite(v.angularError))throw new Error('星系采样损坏');}
}
export function galaxyPlot(data:GalaxyObservation,metric:number):ObservationPlot {
  if(!Number.isInteger(metric)||metric<0||metric>4)throw new Error('未知星系指标');validateGalaxyObservation(data);
  const converted:OrbitObservation={sceneRevision:data.sceneRevision,selected:data.selected,body:0,name:'',samples:data.samples.map((s:GalaxySample):ObservationSample=>({frame:s.frame,time:s.time,distanceAU:s.values[metric]*(metric>=3?100:1),speedKmS:0}))};
  const plot=observationPlot(converted,'distance');plot.unit=metric>=3?'%':'kpc';if(!Number.isFinite(plot.high)||!Number.isFinite(plot.high-plot.low)){plot.available=false;plot.path='';plot.cursorPath='';}return plot;
}
export function galaxyCsv(data:GalaxyObservation):string {
  validateGalaxyObservation(data);
  let csv='model,seed,tracer_count,mass_ratio,speed_factor,inclination_deg,initial_offset_kpc,retrograde,duration_myr,frame,time_myr,separation_kpc,primary_rms_kpc,secondary_rms_kpc,primary_outer_fraction,secondary_outer_fraction,centers_energy_normalized_error,centers_angular_normalized_error\n';
  const p=data.parameters;if(!data.available||!p)return csv;
  for(const s of data.samples)csv+=['galaxy-tidal-restricted-v1',p.seed,p.count,p.massRatio,p.speed,p.inclination,p.offset,p.retrograde?1:0,p.duration,s.frame,s.time,...s.values,s.energyError,s.angularError].join(',')+'\n';
  return csv;
}
