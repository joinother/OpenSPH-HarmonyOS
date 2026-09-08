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
  const ids:string[]=['rock-slow','rock-fast','rock-oblique','rock-spin','ocean-world','three-worlds','ring-world','kepler-ring','eccentric-ring'];
  const titles:string[]=['岩体撞击：低速','岩体撞击：高速','岩体撞击：偏心','岩体自转','海洋行星外观','三种行星外观','行星环与阴影','行星环：内外圈公转','行星环：提高公转初速'];
  const questions:string[]=['同样两颗岩石，慢一点会怎样？','把速度提高四倍，物质飞向哪里？','偏离中心，喷射方向会改变吗？','转动起来的岩石如何变形？','从海洋与云层走回完整轨道。','在海洋、厚云与荒漠之间连续旅行。','绕到环带另一侧，看看行星的影子落在哪里？','内圈和外圈，谁先绕完一周？','发射速度多 12%，会飞得更远吗？'];
  const goals:string[]=['观察接触后的压缩与物质分散；再切换快撞作对照。','与慢撞比较相同时刻的形变、速度色和喷射范围。','观察不对称喷射；偏移参数 60° 不等于实际撞击角。','拖动镜头看形变；速度参数控制本预设的自转。','开关云层和大气，然后返回全景观察绕恒星的轨迹。','点选天体近看，再用上一颗／下一颗连续切换。','旋转镜头看环带遮挡与分缝；关闭环带作对比，返回全景观察轨道。','运行局部环时钟；打开调轨注入局部扰动，看整条环拉伸，再开关颗粒检查同一组运动。','运行后看整条环展开；打开调轨，比较圆轨道与额外速度，也可叠加局部扰动。'];
  const badges:string[]=['2 km/s · 90 s','8 km/s · 90 s','横向偏移 · 90 s','自转 · 60 s','云层与海洋 · 3 年','4 个天体 · 3 年','带环气态行星 · 外观探索','8192 个环粒子 · 24 小时','1.12 倍发射速度 · 椭圆轨道'];
  for(let i=0;i<ids.length;i++) {
    const orbit:boolean=i>=4;
    const config:SimulationConfig={preset:orbit?5:(i===3?2:(i===2?1:0)),count:600,
      speed:orbit?1:(i===0?2:(i===1?8:(i===2?5:2))),angle:i===2?60:0,duration:orbit?3:(i===3?60:90),
      targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234};
    if(orbit){config.orbitBodies=defaultOrbitBodies();if(i===4||i>=6)config.orbitBodies=config.orbitBodies.slice(0,2);if(i>=6){const b=config.orbitBodies[1];b.name="环岚";b.surface=4;b.massSolar=0.0002857;b.xAU=-1;b.vyKmS=-29.789;config.duration=1;}}
    result.push({id:ids[i],title:titles[i],category:orbit?'explore':'collision',question:questions[i],goal:goals[i],
      limit:i>=7?'中心引力的开普勒圆／椭圆轨道；独立小时钟，无粒子碰撞、自引力或太阳摄动。':i===6?'土星风格的虚构外观；1 AU 点质量轨道，非真实土星系统，环带不参与动力学。':orbit?'牛顿点质量轨道；外观为程序生成，尺寸已放大。':'百公里岩质 SPH；未启用自引力，不模拟月球形成。',
      badge:badges[i],cover:ids[i],compareId:i===0?ids[1]:(i===1?ids[0]:''),config:config,
      yaw:i>=6?-.85:.15,pitch:i>=6?.42:.25,zoom:2.7,focus:(i===4||i>=6)?1:-1,closeup:i===4||i>=6});
  }
  const lunarBodies=defaultOrbitBodies().slice(0,2);lunarBodies[1].name='月面观察体';lunarBodies[1].surface=5;lunarBodies[1].xAU=-1;lunarBodies[1].vyKmS=-lunarBodies[1].vyKmS;
  const lunarConfig:SimulationConfig={preset:5,count:600,speed:1,angle:0,duration:1,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,orbitBodies:lunarBodies};
  result.push({id:'moon-atlas',title:'月面地图：月海与高地',category:'explore',question:'绕到另一侧，月面地图：月海与高地有什么不同？',goal:'旋转观察月面底图，用曝光比较明暗，再返回全景。',limit:'NASA 月面颜色图；观察体沿用地球质量和 1 AU 演示轨道，非地月系统或实时月相，不含真实地形起伏。',badge:'NASA SVS · 月面地图',cover:'moon-atlas',compareId:'',config:lunarConfig,yaw:-Math.PI/2,pitch:.15,zoom:2.7,focus:1,closeup:true});
  for(const count of [200,1200]) {
    const fine:boolean=count===1200;
    result.push({id:fine?'resolution-fine':'resolution-coarse',title:fine?'粒子预算对照：1200':'粒子预算对照：200',category:'collision',
      question:'同样的碰撞，换一组粒子会看见什么？',
      goal:'先运行，再看压力与内能曲线。切换对照只改变粒子预算；比较实际秒数相近的帧，留意峰值是否变化。',
      limit:'百公里岩质 SPH，无自引力。粒子预算不等于实际数量；更多粒子不代表已经验证准确度，采样时刻也可能不同。',
      badge:count+' 粒子预算 · 16 s',cover:'rock-oblique',compareId:fine?'resolution-coarse':'resolution-fine',
      config:{preset:0,count:count,speed:5,angle:0,duration:16,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234},
      yaw:.15,pitch:.25,zoom:2.7,focus:-1,closeup:false});
  }
  for(const prepared of [false,true]) {
    const config:SimulationConfig={preset:0,count:200,speed:5,angle:30,duration:16,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,selfGravity:true};
    if(prepared)config.relaxationSeconds=16;
    result.push({id:prepared?'prepared-impact':'direct-impact',title:prepared?'岩体撞击：先减小初始振动':'岩体撞击：直接初态',category:'collision',
      question:'碰撞前的材料准备，会改变后续压缩吗？',goal:'两组保持粒子预算、速度与偏移一致。运行后查看相同时刻的压力、损伤和结构曲线，再切换对照。',
      limit:'16 秒定时预松弛只处理静止单体，并非静力平衡；准备过程耗散能量，不属于正式碰撞。未验证分辨率收敛。',
      badge:prepared?'独立预松弛 16 s · 自引力':'直接初态 · 自引力',cover:'rock-oblique',compareId:prepared?'direct-impact':'prepared-impact',config,
      yaw:.15,pitch:.25,zoom:2.7,focus:-1,closeup:false});
  }
  for(const prepared of [false,true]){
    const config:SimulationConfig={preset:2,count:200,speed:0,angle:0,duration:32,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,selfGravity:true};
    if(prepared)config.relaxationSeconds=64;
    result.push({id:prepared?'sphere-release':'sphere-unprepared',title:prepared?'静止岩球：减振后演化':'静止岩球：直接初态',category:'collision',
      question:'没有撞击、没有自转，岩球会怎样变化？',goal:'运行 32 秒自由演化，观察尺度、径向速度和记录窗口统计，再切换直接初态作对照。',
      limit:'百公里玄武岩单体；撤去阻尼后使用普通材料与自引力求解，不再重置损伤。低分辨率、短时间观察不能证明平衡。',
      badge:prepared?'预松弛 64 s → 自由演化 32 s':'直接初态 → 自由演化 32 s',cover:'rock-spin',compareId:prepared?'sphere-unprepared':'sphere-release',config,
      yaw:.15,pitch:.25,zoom:2.7,focus:-1,closeup:false});
  }
  for(const retrograde of [false,true]) {
    result.push({id:retrograde?'galaxy-retrograde':'galaxy-tails',title:retrograde?'星系相遇：次星系反向旋转':'星系相遇：默认旋转',category:'collision',
      question:'两片恒星盘擦过，旋转方向会改变长尾吗？',goal:'运行到接近与分离阶段，拖动视角观察长尾，再切换旋转方向作对照。观察面板显示中心间距与外延比例。',
      limit:'扩展引力势与无质量恒星群的限制性模型；未包含气体、自洽暗晕、动力摩擦或完整合并。',badge:'1600 示踪点 · 600 Myr',cover:'galaxy-tails',compareId:retrograde?'galaxy-tails':'galaxy-retrograde',
      config:{preset:6,count:1600,speed:1,angle:25,duration:600,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,galaxyMassRatio:.6,galaxyOffsetKpc:12,galaxyRetrograde:retrograde},
      yaw:.15,pitch:.25,zoom:5.2,focus:-1,closeup:false});
  }
  for(const responsive of [true,false]) {
    result.push({id:responsive?'galaxy-responsive':'galaxy-response-control',title:responsive?'星系引力对照：恒星群参与引力':'星系引力对照：恒星群只受引力',category:'collision',
      question:'潮汐尾能反过来拉动星系吗？',goal:'运行慢速相遇，保存曲线作参照，再切换引力模型，比较中心间距和恒星盘的形变。',
      limit:responsive?'恒星群占总质量 20%，相互吸引并反作用于扩展中心；中心形状固定，无气体和完整暗晕，尚非平衡星系。':'相同采样与接近参数，质量全部放在扩展中心，恒星无质量；与反馈模型的质量分配不同。',
      badge:responsive?'600 恒星群 · 双向引力':'600 示踪点 · 单向外场',cover:'galaxy-tails',compareId:responsive?'galaxy-response-control':'galaxy-responsive',
      config:{preset:6,count:600,speed:.75,angle:25,duration:600,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,galaxyMassRatio:.6,galaxyOffsetKpc:12,galaxyRetrograde:false,galaxyResponsive:responsive},
      yaw:.15,pitch:.25,zoom:5.2,focus:-1,closeup:false});
  }
  for(const variant of ['cold','hot','fractured']){
    result.push({id:'material-'+variant,title:variant==='cold'?'岩体撞击：未受损':variant==='hot'?'岩体撞击：预热':'岩体撞击：预先受损',category:'collision',
      question:'同样的撞击，岩石的初始状态会改变破坏过程吗？',goal:'运行后切换热软化、材料损伤和团块；冷岩与预热岩体保持撞速一致。预热会产生初始压力膨胀。',
      limit:'百公里均质岩体，无自引力；热软化降低屈服强度，不代表液相比例或真实温度。初始损伤是材料强度参数，不代表已碎质量比例或可见裂纹。',
      badge:variant==='hot'?'初始内能 1.7 MJ/kg':variant==='fractured'?'初始损伤 90%':'初始内能 0 · 无损伤',cover:variant==='hot'?'rock-fast':'rock-oblique',
      compareId:variant==='cold'?'material-hot':'material-cold',
      config:{preset:1,count:600,speed:8,angle:45,duration:60,targetRadiusKm:100,impactorRadiusKm:60,targetDensity:2700,impactorDensity:2700,targetSpin:0,seed:1234,initialEnergyMJkg:variant==='hot'?1.7:0,initialDamage:variant==='fractured'?.9:0},
      yaw:.15,pitch:.25,zoom:4.6,focus:-1,closeup:false});
  }
  return result;
}
export function themeConfigMatches(a:SimulationConfig,b:SimulationConfig):boolean {
  if((a.initialEnergyMJkg??0)!==(b.initialEnergyMJkg??0)||(a.initialDamage??0)!==(b.initialDamage??0))return false;
  if((a.galaxyResponsive??false)!==(b.galaxyResponsive??false))return false;
  if((a.galaxyMassRatio??.6)!==(b.galaxyMassRatio??.6)||(a.galaxyOffsetKpc??12)!==(b.galaxyOffsetKpc??12)||(a.galaxyRetrograde??false)!==(b.galaxyRetrograde??false))return false;
  if((a.relaxationSeconds??0)!==(b.relaxationSeconds??0)||(a.selfGravity===true)!==(b.selfGravity===true)||a.preset!==b.preset||a.count!==b.count||a.speed!==b.speed||a.angle!==b.angle||a.duration!==b.duration||
    a.targetRadiusKm!==b.targetRadiusKm||a.impactorRadiusKm!==b.impactorRadiusKm||a.targetDensity!==b.targetDensity||
    a.impactorDensity!==b.impactorDensity||a.targetSpin!==b.targetSpin||a.seed!==b.seed)return false;
  const x=a.orbitBodies??[],y=b.orbitBodies??[];if(x.length!==y.length)return false;
  for(let i=0;i<x.length;i++)if(x[i].name!==y[i].name||x[i].surface!==y[i].surface||x[i].massSolar!==y[i].massSolar||
    x[i].xAU!==y[i].xAU||x[i].yAU!==y[i].yAU||x[i].zAU!==y[i].zAU||x[i].vxKmS!==y[i].vxKmS||x[i].vyKmS!==y[i].vyKmS||x[i].vzKmS!==y[i].vzKmS)return false;
  return true;
}
