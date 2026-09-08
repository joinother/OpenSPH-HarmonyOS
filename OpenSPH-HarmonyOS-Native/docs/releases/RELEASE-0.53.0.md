# 0.53.0 · 轨道撞击入射状态与局部初值

> 类型：开发断点记录；实现与验证日期：2026-09-08（Asia/Shanghai）。

## 本批变化

轨道实体球在反弹之前捕获双方状态，转换为保留真实质量、半径和速度的局部质心初值。新增 100 km／60 km 小岩体实验，观察面板优先显示相对撞速、入射角、相对动能、半径、密度及范围检查原因；`getImpactPlan` 与页面共用 native 快照。v16 轨道回放保存入射记录，支持时间轴前后查看、重新加载和续算。没有新事件数据时继续使用 v14，旧回放不补造入射速度。

实现语义与文件布局见 [撞击初值](../reference/IMPACT-INITIAL-CONDITIONS.md)。碰撞主线 P2 从待接入推进到事件捕获与初值核对，尚未完成粒子化、外部引力耦合、事件消费、完整世界回滚及同场景 SPH 演化。当前仍为弹性球体响应，不宣称已经实现行星破碎或液态熔融。

## 验证

- [112 项主机检查](../evidence/impact-plan-0.53.0/ui-tests.txt)：实际页面共享动作、只读初值接口、模板尺寸／质量、CLI 传输、等待和实验配方。
- [初值与接触计算](../evidence/impact-plan-0.53.0/host-native.txt)：入射／反弹方向区分、半步引力速度、SI 转换、质心动量、相对动能、角动量、平移／共同速度不变性、无效数据和大行星范围拒绝；既有球体接触与步长检查。
- [原生会话验证](../evidence/impact-plan-0.53.0/session-native.txt)：真实三体场景约 29.9994 秒接触、8.00043 km/s，相同双精度记录的 v16 回读／时间轴／续算，6 类损坏事务拒绝，带旧接触记录的 v14 兼容。
- [连续轨道专项回归](../evidence/impact-plan-0.53.0/orbit-regression.txt)：超过初始时长继续、暂停、当前时刻插入、旧 v14、历史分支、小质量天体、无效输入拒绝。
- [新功能应用验收](../evidence/impact-plan-0.53.0/device.json)及[页面截图](../evidence/impact-plan-0.53.0/impact-plan.jpeg)：小岩体、大行星不缩放、只读面板、接触前后回放与原始数据保存。
- [既有 UI／CLI 回归](../evidence/impact-plan-0.53.0/cli-device-regression.json)、[最终构建](../evidence/impact-plan-0.53.0/build.txt)、[指定模拟器安装](../evidence/impact-plan-0.53.0/install.txt)。
- [原六天体暂停场景恢复](../evidence/impact-plan-0.53.0/restoration.json)与[持久文件校验](../evidence/impact-plan-0.53.0/files-restored.json)。

测试中的时钟动作更正与首次回归中断见 [运行说明](../evidence/impact-plan-0.53.0/preflight.json)；[首次启动错误](../evidence/impact-plan-0.53.0/cli-first-launch-error.txt)保留原文。一次正常开发覆盖安装后启动成功，随后串行重跑；未修改模拟器保护设置，不据此认定启动中断根因已修复。

此次新增的是碰撞入射数据和界面接入。没有改动 SPH 求解方程，没有重复跑材料收敛研究，也未进行真机、手指命中或动画帧率验收。
