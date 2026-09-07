import { OrbitObservation } from 'libsimulation.so';
export interface ObservationPlot {
  available:boolean; path:string; cursorPath:string; unit:string; low:number; high:number;
  firstTime:number; lastTime:number; current:number; currentTime:number;
  minimum:number; maximum:number; minFrame:number; maxFrame:number; minTime:number; maxTime:number;
}
export function observationPlot(data:OrbitObservation,metric:string):ObservationPlot {
  if(metric!=='distance'&&metric!=='speed')throw new Error('未知观测指标');
  const p:ObservationPlot={available:false,path:'',cursorPath:'',unit:metric==='distance'?'AU':'km/s',low:0,high:1,firstTime:0,lastTime:0,current:0,currentTime:0,minimum:0,maximum:0,minFrame:-1,maxFrame:-1,minTime:0,maxTime:0};
  const samples=data.samples;if(samples.length===0||samples.length>240)return p;
  let min=Number.MAX_VALUE,max=-Number.MAX_VALUE,minIndex=0,maxIndex=0;
  for(let i=0;i<samples.length;i++){
    const s=samples[i],v=metric==='distance'?s.distanceAU:s.speedKmS;
    if(!Number.isFinite(v)||v<0||!Number.isFinite(s.time)||s.time<0||s.frame!==i||(i>0&&s.time<=samples[i-1].time))return p;
    if(v<min){min=v;minIndex=i;}if(v>max){max=v;maxIndex=i;}
  }
  p.minimum=min;p.maximum=max;p.minFrame=minIndex;p.maxFrame=maxIndex;
  p.minTime=samples[minIndex].time;p.maxTime=samples[maxIndex].time;
  const padding=Math.max((max-min)*.08,Math.abs(max)*.001,1e-6);
  p.low=Math.max(0,min-padding);p.high=max+padding;
  p.firstTime=samples[0].time;p.lastTime=samples[samples.length-1].time;
  const span=p.lastTime-p.firstTime;
  for(const s of samples){const x=span>0?(s.time-p.firstTime)/span*240:120,y=100-100*((metric==='distance'?s.distanceAU:s.speedKmS)-p.low)/(p.high-p.low);
    p.path+=(s.frame===0?'M':' L')+x+' '+y;
  }
  const selected=data.selected>=0&&data.selected<samples.length?data.selected:samples.length-1,s=samples[selected];
  const x=span>0?(s.time-p.firstTime)/span*240:120;
  p.cursorPath='M'+x+' 0 L'+x+' 100';p.current=metric==='distance'?s.distanceAU:s.speedKmS;p.currentTime=s.time;p.available=true;return p;
}
