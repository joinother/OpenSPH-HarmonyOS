import { SimulationConfig } from 'libsimulation.so';
import { defaultOrbitBodies } from './SceneModel';

export interface ThemeExperiment {
  id:string; title:string; category:string; question:string; goal:string; limit:string;
  badge:string; cover:string; compareId:string; config:SimulationConfig;
  yaw:number; pitch:number; zoom:number; focus:number; closeup:boolean;
}
// Every call returns fresh initial conditions; no mutable preset is shared with the editor.
export function themeExperiments():ThemeExperiment[] {
  const result:ThemeExperiment[]=[];
  const ids:string[]=['rock-slow','rock-fast','rock-oblique','rock-spin','ocean-world','three-worlds','ring-world'];
  const titles:string[]=['碎岩风暴 · 慢撞','碎岩风暴 · 快撞','错位相撞','旋转的岩石','蔚蓝世界','三种世界，同一片星空','环影之间'];
  const questions:string[]=['同样两颗岩石，慢一点会怎样？','把速度提高四倍，物质飞向哪里？','偏离中心，喷射方向会改变吗？','转动起来的岩石如何变形？','从海洋与云层走回完整轨道。','在海洋、厚云与荒漠之间连续旅行。','绕到环带另一侧，看看行星的影子落在哪里？'];
  const goals:string[]=['观察接触后的压缩与物质分散；再切换快撞作对照。','与慢撞比较相同时刻的形变、速度色和喷射范围。','观察不对称喷射；偏移参数 60° 不等于实际撞击角。','拖动镜头看形变；速度参数控制本预设的自转。','开关云层和大气，然后返回全景观察绕恒星的轨迹。','点选天体近看，再用上一颗／下一颗连续切换。','旋转镜头看环带遮挡与分缝；关闭环带作对比，返回全景观察轨道。'];
  const badges:string[]=['2 km/s · 90 s','8 km/s · 90 s','横向偏移 · 90 s','自转 · 60 s','云层与海洋 · 3 年','4 个天体 · 3 年','带环气态行星 · 外观探索'];
  for(let i=0;i<ids.length;i++) {
    const orbit:boolean=i>=4;
    const config:SimulationConfig={preset:orbit?5:(i===3?2:(i===2?1:0)),count:600,
      speed:orbit?1:(i===0?2:(i===1?8:(i===2?5:2))),angle:i===2?60:0,duration:orbit?3:(i===3?60:90),
      targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234};
    if(orbit){config.orbitBodies=defaultOrbitBodies();if(i===4||i===6)config.orbitBodies=config.orbitBodies.slice(0,2);if(i===6){const b=config.orbitBodies[1];b.name="环岚";b.surface=4;b.massSolar=0.0002857;b.xAU=-1;b.vyKmS=-29.789;config.duration=1;}}
    result.push({id:ids[i],title:titles[i],category:orbit?'explore':'collision',question:questions[i],goal:goals[i],
      limit:i===6?'土星风格的虚构外观；1 AU 点质量轨道，非真实土星系统，环带不参与动力学。':orbit?'牛顿点质量轨道；外观为程序生成，尺寸已放大。':'百公里岩质 SPH；未启用自引力，不模拟月球形成。',
      badge:badges[i],cover:ids[i],compareId:i===0?ids[1]:(i===1?ids[0]:''),config:config,
      yaw:i===6?-.85:.15,pitch:i===6?.42:.25,zoom:2.7,focus:(i===4||i===6)?1:-1,closeup:i===4||i===6});
  }
  return result;
}
export function themeConfigMatches(a:SimulationConfig,b:SimulationConfig):boolean {
  if(a.preset!==b.preset||a.count!==b.count||a.speed!==b.speed||a.angle!==b.angle||a.duration!==b.duration||
    a.targetRadiusKm!==b.targetRadiusKm||a.impactorRadiusKm!==b.impactorRadiusKm||a.targetDensity!==b.targetDensity||
    a.impactorDensity!==b.impactorDensity||a.targetSpin!==b.targetSpin||a.seed!==b.seed)return false;
  const x=a.orbitBodies??[],y=b.orbitBodies??[];if(x.length!==y.length)return false;
  for(let i=0;i<x.length;i++)if(x[i].name!==y[i].name||x[i].surface!==y[i].surface||x[i].massSolar!==y[i].massSolar||
    x[i].xAU!==y[i].xAU||x[i].yAU!==y[i].yAU||x[i].zAU!==y[i].zAU||x[i].vxKmS!==y[i].vxKmS||x[i].vyKmS!==y[i].vyKmS||x[i].vzKmS!==y[i].vzKmS)return false;
  return true;
}
