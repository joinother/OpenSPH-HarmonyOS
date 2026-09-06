# 文档目录

> 类型：当前文档索引；源码版本：0.19.0；更新日期：2026-09-06（Asia/Shanghai）。

先阅读 [项目概览](../README.md)，操作应用使用 [CLI 指南](CLI.md)，维护资料遵循 [文档流程](WORKFLOW.md) 和 [开发约定](../AGENTS.md)。本目录区分当前说明与历史记录；归档内容不覆盖当前规则。

## 当前参考

| 文档 | 用途 |
| --- | --- |
| [银河素材来源](reference/SKY-ASSETS.md) | 摄影原图、许可、运行时处理及定位边界 |
| [CLI 操作指南](CLI.md) | 当前命令、放置、编辑、批处理与状态语义 |
| [上游覆盖审计](reference/UPSTREAM-AUDIT.md) | 固定提交的导入范围、已追踪调用链与验证边界 |
| [主题实验与碰撞创意](research/THEMED-EXPERIMENTS-2026-09-06.md) | 土星环、坠入、月球形成等候选与外观／物理实施顺序 |
| [同行调研与路线](research/PEER-RESEARCH-2026-09-06.md) | SpaceSim、Universe Sandbox、Celestia 等来源与实现取舍 |
| [SpaceEngine 调研](research/SPACEENGINE-2026-09-06.md) | 许可、连续漫游、分层行星、场景脚本与下载安装取舍 |
| [宇宙沙盒操作记录](research/UNIVERSE-SANDBOX-SESSION-2026-09-06.md) | Steam 启动后的实际观察、操作边界与输入问题 |
| [同行更新日志筛选](research/PEER-UPDATES-2026-09-06.md) | Universe Sandbox、SpaceSim 更新和 Celestia 开发提交对当前路线的补充 |
| [文档维护流程](WORKFLOW.md) | 文件归属、日期、命名、更新和交付检查 |

## 版本记录

这些记录仅描述对应版本，不是完整当前指南。未单独记录的原始发布日期不作推算；正文中的验证日期保留原义。

| 版本 | 主题 |
| --- | --- |
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
