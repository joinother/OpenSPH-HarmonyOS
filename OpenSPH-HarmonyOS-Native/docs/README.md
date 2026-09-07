# 文档目录

> 类型：当前文档索引；源码版本：0.39.0；更新日期：2026-09-08（Asia/Shanghai）。

先阅读 [项目概览](../README.md)，操作应用使用 [CLI 指南](CLI.md)，维护资料遵循 [文档流程](WORKFLOW.md) 和 [开发约定](../AGENTS.md)。本目录区分当前说明与历史记录；归档内容不覆盖当前规则。

最新版本：[0.39.0 SPH 材料团块](releases/RELEASE-0.39.0.md)。

## 当前参考

| 文档 | 用途 |
| --- | --- |
| [预研实施核对](reference/RESEARCH-IMPLEMENTATION.md) | 预研建议与已交付能力、部分实现和未完成主线的对应 |
| [SPH 材料团块](reference/SPH-FRAGMENTS.md) | 对称几何连接、质量与质心统计、团块着色及 v10 回放 |
| [SPH 实验对照](reference/SPH-COMPARISON.md) | 本地参照、共用坐标、参数差异与原始数据导出 |
| [环与完整碰撞主线](reference/RING-AND-COLLISION.md) | 同源密度环、受控扰动的边界，以及行星结构／自引力／再聚合优先级 |
| [天体程序化生成专题](research/PROCEDURAL-CELESTIAL-GENERATION-2026-09-07.md) | Baopinsui 视频索引与 NPGS 10 份文件选读、9 个开源候选、逐天体种子／地貌／大气路线与 8 个预设；未播放视频或接入新代码 |
| [行星独立外观](reference/SURFACE-GENERATION.md) | 地表／云层种子、后台生成、独立历史、v3 存档与设备预算 |
| [准备阶段与取消](reference/PREPARATION.md) | 请求身份、真实阶段、耗时提示与等待失败证据 |
| [SPH 自由演化](reference/SPH-RELEASE.md) | 静止单体、释放阶段步长对照、窗口统计与完整导出 |
| [SPH 岩体预松弛](reference/SPH-RELAXATION.md) | 分别准备静止岩体、阻尼对照、取消和 v9 模型保存 |
| [SPH 结构与能量](reference/SPH-STRUCTURE.md) | 引力势能、质心系运动、分布尺度、径向速度与回放 v7/v8 |
| [SPH 自引力](reference/SPH-GRAVITY.md) | 逐对软化引力、独立球壳积分、短时岩球响应、存档与回放 v6 |
| [SPH 材料与敏感性基线](reference/SPH-BASELINE.md) | 解析极限、固定步长与粒子预算研究、跨平台数据和未收敛项 |
| [SPH 诊断与验证](reference/SPH-DIAGNOSTICS.md) | 压力／比内能／损伤、双精度统计、回放 v5、桌面同初值对照与后续接入路线 |
| [资源与服务台账](reference/SERVICE-INVENTORY.md) | 运行时、开发依赖和未接入服务的分类基线 |
| [国产替代与国内运营预研](research/CHINA-LOCALIZATION-OPERATIONS-2026-09-07.md) | Stellarium 经验、国产数据、国内镜像、插件分发、费用与运营分期 |
| [月面素材与加载](reference/MOON-ASSETS.md) | NASA 底图、坐标方向、按需加载、预算与边界 |
| [银河素材来源](reference/SKY-ASSETS.md) | 摄影原图、许可、运行时处理及定位边界 |
| [CLI 操作指南](CLI.md) | 当前命令、放置、编辑、批处理与状态语义 |
| [上游覆盖审计](reference/UPSTREAM-AUDIT.md) | 固定提交的导入范围、已追踪调用链与验证边界 |
| [主题实验与碰撞创意](research/THEMED-EXPERIMENTS-2026-09-06.md) | 土星环、坠入、月球形成等候选与外观／物理实施顺序 |
| [同行调研与路线](research/PEER-RESEARCH-2026-09-06.md) | SpaceSim、Universe Sandbox、Celestia 等来源与实现取舍 |
| [SpaceEngine 调研](research/SPACEENGINE-2026-09-06.md) | 2026-09-07 补充 9 个官方页面与 6 份工坊说明选读；12 项改进、6 个体验提案及许可边界 |
| [Celestia 源码与插件专题](research/CELESTIA-SOURCE-ADDONS-2026-09-07.md) | 803 个源码／着色器文件清单、26 份文件选读；官方插件资料、鸿蒙工程经验、12 项改进与 8 个体验提案；论坛访问受限 |
| [宇宙沙盒操作记录](research/UNIVERSE-SANDBOX-SESSION-2026-09-06.md) | Steam 启动后的实际观察、操作边界与输入问题 |
| [同行更新日志筛选](research/PEER-UPDATES-2026-09-06.md) | Universe Sandbox、SpaceSim 更新和 Celestia 开发提交对当前路线的补充 |
| [宇宙沙盒博客与论坛专题](research/UNIVERSE-SANDBOX-BLOG-FORUM-2026-09-07.md) | 242 篇博客与 2585 个主题索引、36 篇博客和 23 个主题选读；32 项改进与 14 个实验方案 |
| [宇宙沙盒 Wiki 专题](research/UNIVERSE-SANDBOX-WIKI-2026-09-07.md) | 374 页索引、66 页重点正文；18 项补充、8 个实验与 Wiki 错误／过时说明核对 |
| [宇宙沙盒 Steam 社区专题](research/UNIVERSE-SANDBOX-STEAM-2026-09-07.md) | 161 个工坊作品、87 篇指南、146 个讨论索引；选读 8 篇指南、5 份作品说明、19 个主题，形成 16 项补充与 10 个实验方向 |
| [文档维护流程](WORKFLOW.md) | 文件归属、日期、命名、更新和交付检查 |

## 版本记录

这些记录仅描述对应版本，不是完整当前指南。未单独记录的原始发布日期不作推算；正文中的验证日期保留原义。

| 版本 | 主题 |
| --- | --- |
| [0.38.0](releases/RELEASE-0.38.0.md) | SPH 跨实验参照、共轴曲线与原始导出 |
| [0.37.0](releases/RELEASE-0.37.0.md) | 静止岩球释放、记录窗口统计与完整导出 |
| [0.36.0](releases/RELEASE-0.36.0.md) | 岩体独立预松弛与准备后组装碰撞 |
| [0.35.0](releases/RELEASE-0.35.0.md) | SPH 结构与能量诊断 |
| [0.34.0](releases/RELEASE-0.34.0.md) | SPH 材料自引力 |
| [0.33.1](releases/RELEASE-0.33.1.md) | 近看保留太阳与其他天体、方向投影、遮挡与点选一致 |
| [0.33.0](releases/RELEASE-0.33.0.md) | 同源密度环、局部速度扰动、版本化保存及跨场景竞态修复 |
| [0.32.0](releases/RELEASE-0.32.0.md) | 独立地貌与云层、后台生成、外观历史及 v3 配方 |
| [0.31.0](releases/RELEASE-0.31.0.md) | 准备阶段跟踪、取消与 CLI 超时诊断 |
| [0.30.0](releases/RELEASE-0.30.0.md) | 碰撞精度对照主题与材料／数值敏感性基线 |
| [0.29.0](releases/RELEASE-0.29.0.md) | SPH 五指标曲线、采样极值定位与原始 CSV 导出 |
| [0.28.0](releases/RELEASE-0.28.0.md) | 真实 SPH 诊断贯通、回放 v5、桌面对照与折叠构图 |
| [0.27.0](releases/RELEASE-0.27.0.md) | 跨实验轨道对照、本地参照恢复、共享坐标与 CSV 导出 |
| [0.26.0](releases/RELEASE-0.26.0.md) | 距离／速度曲线、采样极值定位与历史失效保护 |
| [0.25.0](releases/RELEASE-0.25.0.md) | 复制行星为放置草稿、自动避位、来源说明与撤销／存档 |
| [0.24.0](releases/RELEASE-0.24.0.md) | 真实月面、按需加载、月面主题与保存／编辑 |
| [0.23.0](releases/RELEASE-0.23.0.md) | 线性光照、曝光、海洋反光／云影控件与配方兼容 |
| [0.22.0](releases/RELEASE-0.22.0.md) | 原生镜头请求、完成／取消、手势接管与编辑保留视角 |
| [0.21.0](releases/RELEASE-0.21.0.md) | 实验配方、外观与镜头恢复、局部环参数保存及旧存档兼容 |
| [0.20.0](releases/RELEASE-0.20.0.md) | 可调椭圆轨道、慢放、轨道预览与近远点诊断 |
| [0.19.0](releases/RELEASE-0.19.0.md) | 独立小时钟、开普勒示踪环与数值对照 |
| [0.18.0](releases/RELEASE-0.18.0.md) | 带环气态行星、环带光照与新探索主题 |
| [0.17.0](releases/RELEASE-0.17.0.md) | 主题实验库、撞击速度对照与岩质颗粒外观 |
| [0.16.0](releases/RELEASE-0.16.0.md) | 全屏宇宙、状态栏与手势条隐藏 |
| [0.15.0](releases/RELEASE-0.15.0.md) | 天体编辑撤销／重做与草稿保留 |
| [0.14.0](releases/RELEASE-0.14.0.md) | 折叠与横竖屏适配 |
| [0.13.0](releases/RELEASE-0.13.0.md) | 摄影银河背景 |
| [0.12.0](releases/RELEASE-0.12.0.md) | 放置行星 |
| [0.11.0](releases/RELEASE-0.11.0.md) | 连续行星操作 |
| [0.10.0](releases/RELEASE-0.10.0.md) | 银河远景 |
| [0.9.0](releases/RELEASE-0.9.0.md) | 天体点选与初始向量预览 |
| [0.8.1](releases/RELEASE-0.8.1.md) | ArkUI 与 CLI 共用动作 |
| [0.8.0](releases/RELEASE-0.8.0.md) | 自定义行星系统 |
| [0.7.0](releases/RELEASE-0.7.0.md) | 行星表面与近看 |
| [0.6.0](releases/RELEASE-0.6.0.md) | 从碰撞实验走向轨道实验 |
| [0.5.0](releases/RELEASE-0.5.0.md) | 悬浮界面与过渡动画 |
| [0.4.0](releases/RELEASE-0.4.0.md) | 让宇宙视口成为主画面 |
| [0.3.0](releases/RELEASE-0.3.0.md) | 可编辑天体与实验库 |

## 历史归档

- [截至 0.12.0 的 CLI 历史汇编](archive/CLI-HISTORY-THROUGH-0.12.0.md)：保留历次说明，已失效规则以当前指南为准。
- [0.5.0 设计](archive/DESIGN-0.5.0.md) 与 [早期 UI 验收](archive/UI-VERIFICATION-2026-09-06.md)。
- [最初移植方案](research/archive/PORTING-RESEARCH-2026-09-06.md)、[SpaceSim 网站与论坛调研](research/archive/SPACESIM-RESEARCH-2026-09-06.md)、[全宇宙架构与 Celestia 评估](research/archive/UNIVERSE-ARCHITECTURE-2026-09-06.md)：保留当时的判断与来源，不能直接视为当前完成情况。

## 验收证据

原始数据集中于 [evidence 目录](evidence/)，由版本记录链接。0.17.0 的主题、初始暂停与布局验收见 [主题实验记录](releases/RELEASE-0.17.0.md)。0.15.0 的编辑验收见 [天体编辑记录](releases/RELEASE-0.15.0.md)。0.14.0 的窗口验收见 [窗口适配记录](releases/RELEASE-0.14.0.md)。0.13.0 的摄影验收见 [摄影银河记录](releases/RELEASE-0.13.0.md)。0.12.0 放置功能的主要证据为 [主机测试](evidence/placement-host-tests.txt)、[宽窗口 CLI](evidence/placement-device-tests.json)、[手机 CLI](evidence/placement-phone-tests.json)、[宽窗口触摸](evidence/placement-touch-tests.json)、[手机触摸](evidence/placement-phone-touch-tests.json)、[UI 回归](evidence/placement-ui-regression.json) 和 [连续镜头回归](evidence/placement-continuity-regression.json)。

本次文档整理见 [迁移清单](evidence/documentation-migration-2026-09-06.json)。迁移不代表重新执行其中的验收。格式、链接与文件完整性结果见 [整理检查报告](evidence/documentation-check-2026-09-06.json)。
