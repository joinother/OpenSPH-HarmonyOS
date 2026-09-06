# 星体实验室 · OpenSPH HarmonyOS Native

> 类型：当前项目概览；源码版本：0.20.0；更新日期：2026-09-07（Asia/Shanghai）。

鸿蒙原生科学探索应用，使用 ArkTS/ArkUI 构建交互界面，以 OpenSPH C++ 计算岩质碰撞，以独立的 C++ 多体引力模型计算行星轨道，通过 XComponent/OpenGL ES 显示。包名为 `com.opensph.lab`。

从 [文档目录](docs/README.md) 查找指南和记录；操作应用见 [CLI 指南](docs/CLI.md)，继续开发前阅读 [开发约定](AGENTS.md) 和 [文档流程](docs/WORKFLOW.md)。

## 当前能力

- 主题实验库提供九张原创概念封面卡片：慢撞、快撞、错位相撞、旋转岩石、蔚蓝世界、三种行星探索、“环影之间”、“环为什么会错位”和“给环一点额外速度”；包含观察目标、速度对照和恢复初始条件。
- 开普勒示踪环：192 个无质量点、12 组开普勒轨道、独立 0–24 小时时间轴；可调 1.00–1.20 倍切向发射速度、0.1–4 小时/秒播放倍率，带内圈俯视预览、近远点和瞬时速度读数。
- 六个基础实验：岩质正面碰撞、掠碰、旋转天体、双体轨道、四体行星系统和自定义系统。
- 自定义系统支持 2–8 个天体，可编辑质量、位置、速度、名称及表面。放置行星先预览，再确认加入；取消保留原实验。
- 同一视口内完成点选、跟踪、近看、编辑与返回全景；查看操作保留时间轴，各天体编辑草稿在会话内保留。
- 自定义天体修改、添加、删除支持会话内最近 20 步撤销／重做；其他天体草稿随编辑保留，可单独还原当前输入。
- 岩质原色使用灰岩／赭岩的稳定颗粒明暗与更连续的颗粒覆盖；速度与密度模式保留粒子显示。
- 带环气态行星提供程序条纹、倾斜薄环、分缝、前后遮挡及行星／环带互投影；可用于自定义编辑与放置，外观开关不重建场景。
- 程序化行星表面、云层、大气、星空与 ESO 银河摄影全景，支持悬浮控件、面板过渡、手势和语义 CLI。
- 暂停、继续、最近 240 帧时间轴与回放；最多 50 个命名初始条件实验，回放单槽保存。
- 宇宙视口铺满整个窗口，默认隐藏状态栏和底部手势条；控件单独避让摄像头和系统临时区域。
- 按实际可用宽高适配折叠、展开与横竖屏；矮窗口使用紧凑控制栏，编辑面板和近看镜头共用布局区域。声明 phone、tablet、2in1；真机和鸿蒙 PC 的完整适配验收仍待进行。

## 模型边界

岩质 SPH 实验使用默认玄武岩材料路径，粒子预算为 200–2400，当前未启用自引力。行星轨道使用双精度牛顿点质量引力与 leapfrog，时长 1–10 儒略年；近距离遭遇触发停止，尚无行星碰撞合并、破碎或 SPH 与轨道模型联动。

放置工具编辑初始条件，确认会从零重建；二体解析预览忽略其他行星扰动。回放是可视化快照，不能从任意历史帧恢复物理演算。带环外观采用相对场景 +Y 轴偏转约 27° 的固定外观轴、1.24–2.26 倍球半径的无厚度环面，环不参与动力学；不同天体之间仍按中心深度排序。程序云层与海洋用于显示，没有气候模型或真实地球地图。银河使用有署名的摄影全景，按模拟方向映射，不是可定位的真实星表；星空模式保留程序星点。上游源码导入情况与已验证调用链见 [覆盖审计](docs/reference/UPSTREAM-AUDIT.md)。

## 构建与操作

开发环境为 DevEco Studio、HarmonyOS SDK 6.1.1 / API 24，兼容 API 20，当前 native ABI 为 arm64-v8a。在项目根目录执行：

```sh
./scripts/build.sh
./scripts/install-emulator.sh 127.0.0.1:5555
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --list
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getUiState
python3 scripts/check-docs.py
```

默认 SDK 位于 `/Applications/DevEco-Studio.app/Contents`，可设置 `DEVECO_STUDIO_HOME` 指向其他 Contents 目录。构建产物为 `entry/build/default/outputs/default/entry-default-unsigned.hap`。当前模拟器允许安装未签名包；真机和市场发布需配置签名。当前未发布应用市场。GitHub 检查点使用原仓库的独立分支，工程位于 `OpenSPH-HarmonyOS-Native/`，继续开发时以该目录为根目录。

## 代码入口

| 位置 | 用途 |
| --- | --- |
| [Index.ets](entry/src/main/ets/pages/Index.ets) | ArkUI、语义动作、编辑和布局 |
| [SceneModel.ets](entry/src/main/ets/common/SceneModel.ets) | 场景验证、放置计算 |
| [engine.cpp](entry/src/main/cpp/engine.cpp) | 求解线程、状态、快照与回放 |
| [orbit.cpp](entry/src/main/cpp/orbit.cpp) | 多体引力与守恒量 |
| [renderer.cpp](entry/src/main/cpp/renderer.cpp) | 渲染与相机 |
| [scripts](scripts/) / [tests](tests/) | 构建、语义 CLI、验收工具和测试 |
| [上游记录](third_party/opensph/UPSTREAM.md) | 固定提交、许可与本地修改 |

## 验证与下一步

椭圆实验见 [0.20.0 记录](docs/releases/RELEASE-0.20.0.md)。示踪环初版见 [0.19.0 记录](docs/releases/RELEASE-0.19.0.md)。带环外观见 [0.18.0 记录](docs/releases/RELEASE-0.18.0.md)。首批主题实验见 [0.17.0 记录](docs/releases/RELEASE-0.17.0.md)。沉浸修复见 [0.16.0 记录](docs/releases/RELEASE-0.16.0.md)，宇宙画面延伸到窗口边缘，隐藏系统栏并保留控件安全区。编辑功能见 [0.15.0 记录](docs/releases/RELEASE-0.15.0.md)，包含天体编辑撤销／重做、草稿保留与删除后的草稿索引恢复。窗口适配见 [0.14.0 记录](docs/releases/RELEASE-0.14.0.md)，涵盖折叠、展开、横竖屏与草稿保留。摄影银河见 [0.13.0 记录](docs/releases/RELEASE-0.13.0.md)，包括摄影银河、署名与资源来源、旋转／缩放／模式切换验收。放置行星的事务和触摸基线见 [0.12.0 记录](docs/releases/RELEASE-0.12.0.md)。原始结果在 [验收证据目录](docs/evidence/)。这些记录不代表真机性能、科学收敛或全部上游功能验证。

内容方向按 [主题实验与碰撞创意](docs/research/THEMED-EXPERIMENTS-2026-09-06.md) 已接入首批主题卡片和速度对照，现已接入土星风格外观；局部环已建立中心引力的圆／椭圆轨道基线与独立积分对照，物理侧继续补近距扰动与环粒子相互作用、SPH 压力／内能／损伤、自引力与完整检查点。示踪环采用假定 60000 km 行星半径，忽略太阳与卫星摄动、扁率、环自引力和碰撞；其时钟和发射参数不写入实验或回放存档。草稿持久化、其他参数撤销、独立数值对照继续推进；月球形成尚未实现。参考来源与取舍见 [同行调研](docs/research/PEER-RESEARCH-2026-09-06.md)。

[SpaceEngine 调研](docs/research/SPACEENGINE-2026-09-06.md) 补充了环带光照、分层外观和可编排连续镜头的实施建议与许可边界；三维薄环外观已落地，其余分层效果与镜头编排继续待办。

[同行更新日志筛选](docs/research/PEER-UPDATES-2026-09-06.md) 补充复制为放置草稿、主题外观持久化、实验曲线和设备画质分档；区分已发布功能、开发分支与未来计划，不替代当前土星环外观和物理验证的优先顺序。

## 许可

新应用代码采用 MIT；OpenSPH 许可见 [第三方许可](third_party/opensph/LICENSE)，sse2neon 保留头文件许可。银河摄影署名 ESO/S. Brunier，使用 CC BY 4.0；见 [素材来源](docs/reference/SKY-ASSETS.md)。第三方许可文本随 HAP 打包。GitHub 检查点保留原有桌面工程；本项目未引入 SpaceSim、Universe Sandbox 或 SpaceEngine 的私有实现与素材。
