# OpenSPH 上游覆盖审计 · 2026-09-06

> 类型：参考审计；适用范围：固定上游提交，详见正文。
> 整理日期：2026-09-06（Asia/Shanghai）。

结论：没有逐行吃透、移植或验证整个 OpenSPH。当前是接通部分真实 SPH 调用链，加上独立实现的行星 N-body、ArkUI、GLES 和 CLI。不能把整库编译成功、源码存在或画面合理，当作全部功能可用与科学正确性的证据。

## 固定版本与逐文件清点

上游为 [OpenSPH 仓库](https://github.com/pavelsevecek/OpenSPH) ，固定提交 `f3033faf4422a056dcb79cc6643c7c6f3d9fee19`，MIT 许可证保留在 [LICENSE](../../third_party/opensph/LICENSE)。本轮以本地原始仓库的该提交读取 Git tree，逐项对比导入文件的 Git blob SHA-1，未改动原始仓库。

- 上游 760 个跟踪文件；499 个已导入，261 个未导入。
- 已导入的 496 个内容与固定提交一致；3 个有修改：顶层 CMakeLists.txt（纯内核构建）、core/objects/geometry/Vector.h（ARM SSE→NEON 适配）、core/run/IRun.cpp（按实际已积分时间步更新时间）。
- core 的 497 个上游跟踪文件均存在，其中 495 个一致、2 个修改。额外导入的 sse2neon 等文件不属于这 760 个上游文件，不能混入覆盖比例。
- [upstream-file-inventory.csv](../evidence/upstream-file-inventory.csv) 列出每个上游文件、两侧 blob 值和导入状态；[upstream-inventory-summary.json](../evidence/upstream-inventory-summary.json) 汇总。**这是内容与导入审计，不是逐行理解程度或测试覆盖率。**

上游 gui 123 文件、cli 46 文件、examples 18 文件、顶层 test 18 文件、regression 20 文件、bench 9 文件等未按原产品移植。core 目录内含测试源码，但生产 CMake 源列表并不等于运行了这些测试。当前没有完整上游测试套件通过记录。

## 本轮实际追踪的 SPH 调用链

入口 `entry/src/main/cpp/engine.cpp::Experiment` → `core/run/IRun.cpp::run/setNullToDefaults` → `core/system/Factory.cpp` → 积分器／求解器／材料。初始化路径为 `sph/initial/Initial.cpp::addMonolithicBody` → 工厂材料与分布 → Storage 合并。默认值以 `core/system/Settings.cpp` 为准，而非产品介绍。

| 项目 | 当前有效选择与证据 | 验证边界 |
| --- | --- | --- |
| 调度 | Experiment 覆盖为 SequentialScheduler | 当前实验单线程求解；没有 TBB 多核性能结论 |
| SPH 求解器 | 默认 SYMMETRIC_SOLVER；Factory 创建 SymmetricSolver | 三个本地实验运行过；其他求解器未接 ArkUI |
| 作用项 | 默认 PRESSURE \| SOLID_STRESS；StandardSets 再加入连续性、人工黏性和光滑长度演化 | **不含 SELF_GRAVITY**，Factory 不创建 GravitySolver 包装 |
| 核／邻域 | 默认 cubic spline / KD-tree | 已随接入路径运行；尚缺独立 ARM 邻域和核函数对照报告 |
| 积分 | 默认 Predictor-Corrector；应用仅保留 Courant 准则，初始 0.02 s、最大 0.15 s | IRun 时间修正已有回归；不是完整时间步收敛验证 |
| 初始天体 | 球域、默认 hexagonal 分布；目标／撞击体粒子预算约 3:1；密度与自转覆写 | 预算不等于实际生成粒子数；不是静水平衡松弛天体 |
| 状态方程 | 默认 Tillotson，材料默认参数对应上游 BASALT 默认项 | UI 改密度并没有同时切换全部材料参数；不能称多材料行星 |
| 强度与损伤 | SolidMaterial → VonMisesRheology(Factory::getDamage) → ScalarGradyKippModel | 确认创建及调用路径；尚未独立验证损伤分布、碎片谱与材料参数适用范围 |
| 精度 | core Float 默认 double；显示快照为 float | 缺少全面 SSE/NEON 数值一致性证据 |
| 导出快照 | 位置、速度模长、密度、质量统计、两个初始组的质心 | 没有输出压力、内能、损伤、应力张量与速度三分量；颜色分组不是碎片识别 |

因此，当前“岩质碰撞”可展示压力／强度驱动的变形，但不能据此宣称已支持撞击后引力再聚集、分层地球相撞、海洋大气流体耦合或长期碎片轨道。0.9.0 在 SPH 视口补上“未启用自引力”的模型说明。

## 功能覆盖与未完成项

| 上游领域／目录 | 当前覆盖 | 继续工作的具体入口 |
| --- | --- | --- |
| sph/solvers、equations | 部分真实调用链已读并接入 | 标准冲击／弹性算例、分辨率与时间步收敛；逐个新增求解器前先建立参考结果 |
| physics/Eos、Rheology、Damage | 默认岩质路径已追踪；其他模型仅清点源码 | 先输出压力、内能、损伤；再对照桌面同配置测试，再加明确材料选项 |
| gravity/BarnesHut、NBodySolver、AggregateSolver、Handoff | 源码已导入；本应用行星模型没有调用这些模块 | SPH 自引力独立基线、引力势能与误差监控；再评估碎片聚集和 SPH↔N-body 转换 |
| post/Analysis、Mesh、MarchingCubes 等 | 源码存在，未接应用 | 碎片连通性／质量谱的定义与稳定 ID；随后考虑表面网格 |
| run/Job、Node、jobs | 只用 IRun 生命周期；未移植作业图编辑器 | 将可复现实验配置与任务 DAG 区分；按必要任务逐个做 ArkTS 表单 |
| io 与上游输出格式 | 上游输出在 Experiment 中关闭 | 当前场景 JSON 和回放是本项目格式；回放不是恢复积分的检查点 |
| thread、可选依赖 | 当前关闭 TBB、VDB、ChaiScript | 性能剖析后再逐项启用；没有 GPU 物理解算、OpenVDB 或脚本运行承诺 |
| gui、cli、examples、regression、test | 未移植原桌面产品／完整测试入口 | ArkUI 与语义 CLI 自行实现；抽取物理回归算例，不照搬桌面 UI |

## 与宇宙产品路线的关系

当前 `orbit.cpp` 是自行实现的双精度牛顿点质量引力与 leapfrog，不是上游 NBodySolver 的完整移植。支持 2–8 天体、轨道回放和自定义初始条件；接近阈值时停止，没有碰撞合并／破碎；程序化海洋、云层和大气只用于表面显示。SpaceSim、Universe Sandbox 的产品功能可作为目标，不能由此推断它们的私有实现已被移植。Celestia 的目录浏览和导航也不等于碰撞物理。

接下来按以下顺序推进，每步都需要独立证据：

1. **已在 0.9.0 落地：** 视口点选、初始向量投影预览、相应语义 CLI、投影几何和模拟器命中测试。
2. **物理可观察性：** SPH 导出压力／内能／损伤统计与着色；与固定桌面版本同初值对照，避免只能看粒子散开。
3. **自引力基线：** 增加明确的引力开关、软化／树精度设置、球体稳定与双体标准算例，验证后才开放再聚集实验。
4. **碰撞模式连接：** 明确轨道模型的接触条件、质量／动量／能量预算和 SPH 分辨率，做局部碰撞实验切换；不能直接把贴图球重叠当作物理碰撞。
5. **规模与多端：** 真机 CPU／内存／持续温控测试，选择渲染与求解预算；星表浏览和远景尺度另行设计，不能对“全宇宙所有星体实时互相作用”作无依据承诺。

本轮没有更改物理方程、步长、场景或回放格式。科学模型验证仍需继续；UI 与 CLI 测试不能替代这些验证。
