# 同行参考与实现路线 · 2026-09-06

> 类型：调研快照；适用范围：0.12.0。
> 调研日期：2026-09-06；整理日期：2026-09-06（Asia/Shanghai）。

本轮查阅产品公开页面、作者文档、公开论坛以及开源仓库。未下载或分析闭源二进制，未提取产品贴图、界面资源或私有数据。本轮放置工具的公式、绘图和 ArkUI 代码由本项目独立实现；下表区分已核实功能、我们的判断和后续候选。

## 参考什么，怎样落地

| 项目 | 核实的公开能力 | 本项目采用或计划 |
| --- | --- | --- |
| SpaceSim | 作者说明它使用 OpenSPH；公开 Lua API 支持自定义对象、系统和场景生成，并明确位置、速度等数据的单位 | 借鉴对象模板、参数化场景和可复现实验；保留我们现有 JSON/CLI。不要把作者描述 OpenSPH 的节点编辑器误记成 SpaceSim 已公开的 UI 细节。 |
| Universe Sandbox | 官方更新页展示添加工具可同时显示轨道、网格与预测路径；公开论坛也反映放置平面与轨道父体容易造成困惑 | 先让人看懂放在哪里、相对谁运动，再确认。0.12.0 已加入圆轨道／相对静止／掠过／反向以及速度箭头、初始位置图。 |
| Celestia | GPL-2.0-or-later 的三维天文浏览器；代码有观察者参考系、旅程插值和按目标大小选取观察距离 | 后续研究恒星—行星—卫星导航、距离层级与镜头；本轮只阅读 observer.cpp 的局部实现，没有复制代码。它不作为 SPH 碰撞求解器。 |
| REBOUND | GPL-3.0，C99 多体积分器，包含 IAS15、自适应积分和处理近距离遭遇的积分器 | 优先作为离线数值对照；验证后再评估鸿蒙 Native 后端。目前未引入运行依赖。 |
| Cosmonium | GPL-3.0-or-later，Python/C++ 与 Panda3D，部分支持程序星球及 Celestia 插件；对象信息记录素材来源 | 借鉴素材来源随对象可查、不同质量贴图按需使用的组织方式。整套移植会引入额外运行栈，暂不采用。 |
| Pioneer | 开放的星际探索项目，有系统编辑器和 JSON 自定义星系文档 | 参考星系结构与编辑工作流；飞船战斗、贸易等不属于当前目标，不引入整个游戏。 |

SpaceSim 的[作者网站](https://pavelsevecek.github.io/)与 [公开脚本 API](https://pavelsevecek.github.io/lua.html)。[Steam 产品页](https://store.steampowered.com/app/4055380/SpaceSim/)将其定位为粒子模拟与渲染工具，并说明非实时计算特征。其公开 API 是功能参考，不在本项目内实现对私有格式的猜测性兼容。

Universe Sandbox 的 [官方更新记录](https://universesandbox.com/blog/category/update/)与[官方开发日志](https://universesandbox.com/blog/category/devlog/)支持网格／轨道预览和面板让出模拟区域的方向。[2011 年论坛的平面放置讨论](https://www.universesandbox.com/forum/index.php?topic=3147.0)和[轨道父体讨论](https://universesandbox.com/forum/index.php?topic=15422.0)仅用于了解使用困难，不能据此断言当前版本仍有同样限制。

Celestia：[仓库及许可证说明](https://github.com/CelestiaProject/Celestia)、[本轮局部阅读的 observer.cpp](https://github.com/CelestiaProject/Celestia/blob/master/src/celengine/observer.cpp)。开源程序不代表所有附带素材具有同一许可证：[CelestiaContent 的素材授权追踪问题](https://github.com/CelestiaProject/CelestiaContent/issues/138)仍提示逐项来源记录的重要性。未来如采用代码，应记录文件、版本与许可证；纹理和星表另建清单。本轮继续使用原有自制程序纹理。

其他候选：[REBOUND](https://github.com/hannorein/rebound)、[Cosmonium](https://github.com/cosmonium/cosmonium)、[Pioneer](https://github.com/pioneerspacesim/pioneer)、[Pioneer 系统编辑文档](https://wiki.pioneerspacesim.net/wiki/Custom_Systems)。优先级是本项目的技术判断，不是这些项目对鸿蒙适配的承诺。

## 分阶段路线

1. **已实现 0.12.0：初始条件放置工具。** 放置前预览、圆轨道等速度选择、触摸／CLI 同源、确认事务和取消。当前只围绕第 0 颗恒星构造候选天体。紫线是牛顿二体解析引导，不是完整多体积分预测；灰点是其他天体在所选平面上的初始位置投影。确认会从零重建当前实验，不能冒充在历史帧里实时插入天体。
2. **下一阶段：实验编辑与结果更容易回退。** 为参数和增删事务建立可撤销的配置版本，保存每颗天体的草稿；把数值输入、单位和对象模板做成可复用组件。先设计“重算初始条件”和“修改当前物理状态”的明确边界。
3. **物理可信度：离线验证与完整状态。** 用独立积分器比对轨道和守恒量；补充带三维速度的状态检查点及分支回放，之后才做真正的当前时刻插入／发射。扩展卫星前先处理小尺度步长与近距离遭遇，不能只放宽现在 0.05 AU 的初始间距限制。
4. **SPH 可观察性：压力、内能、损伤与碎片。** 接出已有内核量，逐项做基准验证；自引力与再聚集继续依上游审计推进。不要用装饰爆炸替代碰撞物理结果。
5. **浏览与表现：借鉴 Celestia 的层级。** 天体目录、参考系、真实星表、按视距切换的细节、恒星—行星—卫星镜头；每项素材保留来源，按手机／平板／电脑的资源预算分档。

这是阶段路线，尚不具备全宇宙实时高精度碰撞能力。本轮交付集中在可以立即使用的放置体验。
