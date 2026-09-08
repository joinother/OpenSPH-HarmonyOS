# 星体实验室 GitHub 检查点

记录日期：2026-09-08（Asia/Shanghai）；源码版本：0.49.0。

## 恢复开发

本分支基于原仓库 main 的 `8b4230e607d07710064acd87fb708b566fff4d07`，保留旧 OpenSPH-DevEco、patches 和 tools；新工程在 [OpenSPH-HarmonyOS-Native](OpenSPH-HarmonyOS-Native/README.md)。

```sh
git clone --branch checkpoint/arkui-0.17.0-2026-09-06 https://github.com/joinother/OpenSPH-HarmonyOS.git
cd OpenSPH-HarmonyOS/OpenSPH-HarmonyOS-Native
python3 scripts/check-docs.py
node --test tests/cli_transport.test.mjs tests/project_recipe.test.mjs
./scripts/build.sh
```

构建需要 DevEco Studio 与 HarmonyOS SDK；安装请遵循工程 README，当前任务只操作模拟器 127.0.0.1:5555。签名配置、依赖缓存、构建目录和发布二进制不纳入源码检查点。

## 保存范围与验证

- 0.49.0 增加持续轨道时间、目标／实测速度、当前时刻插入恒星或行星及 v14 续算；97 项主机检查、原生引擎与实际应用 CLI 验收通过。最多 8 个实体，尚无流体行星破裂和 SPH 事件联动；原始初态、保存槽、项目及视频恢复。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.49.0.md)。

- 0.48.0 实现系统星图录制、MP4、本机预览和导出；97 项主机检查与无编码器模拟器提示通过，实际录制和导出按用户要求留待真机验收。没有软件编码依赖。见 [视频记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.48.0.md)。

- 0.47.0 增加 20% 带质量恒星群的逐对引力及中心反作用、全系统守恒、两个主题与 v13 回放；150 项主机检查、数值基线、鸿蒙引擎／UI／实际 600 Myr 对照通过。孤立冷盘仍会变宽，未完成完整暗晕和科学合并验证；恢复较新的 151 帧星系历史及保存槽，初始环实验另有本地备份。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.47.0.md)。

- 0.46.0 增加固定示踪点盘内天空、地表地平线、纬度／恒星时、共享回放和语义 CLI。147 项主机检查、真实时间回退与不变历史、三布局／拖动、v12、专注模式和旧行星 UI 回归通过；恢复后来捕获的行星环状态与原保存槽。真实银河系初值、自洽合并和真实天空测光仍待实现，见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.46.0.md)。

- 0.45.0 补星系本地参照、五指标共轴曲线、已应用初值差异和 19 列双实验导出。144 项主机检查、实际 352 行原生对照、冷启动与坏文件恢复、三布局滚动和原 UI 回归通过；原慢撞暂停初态、保存槽和命名实验恢复。物理求解器保持原定义，见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.45.0.md)。

- 0.44.0 接入星图相遇偏移预览、取消／确认、五条演化曲线、过期定位保护和原始诊断 CSV。134 项主机检查、288 组主机／ARM64／内存投影检查、原生新旧引擎、实际 201 行数据逐项核对、三布局拖动／滚动及项目回归通过；原回放、保存槽和 10 个项目恢复。初始 X 距离固定 60 kpc，仍无任意位置／速度或新的自洽物理模型，见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.44.0.md)。

- 0.43.0 接入两个移动解析势的星系潮汐实验、顺逆行对照、共享参数／CLI、观察诊断和 v12 回放。127 项主机检查、数值步长／可逆性／孤立盘／ARM64／内存检查、实际应用和三布局拖动通过；原 240 帧历史、保存槽和 10 个项目恢复。尚无自洽星系合并或气体星云，见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.43.0.md)。

- 0.42.0 接入自定义天体实体半径、理想弹性接触与自动暂停，近距采样和 v11 回放。125 项主机检查、原生接触／引擎／旧轨道与 UI 回归通过，三布局画面及继续分离验证，原 240 帧历史与 10 个项目恢复。尚无行星流体破裂或局部 SPH 耦合，见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.42.0.md)。

- 0.41.0 接入主星图直接点击／拖动放置、候选外观和速度方向、瞄准目标及可取消初始条件事务。124 项主机检查、264 组主机／ARM64 投影检查、三布局真实手势及旧 UI 回归通过，原实验历史和 10 个项目恢复。轨道实体碰撞尚未接通。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.41.0.md)。

- 0.40.0 接入逐团／最大团块的连续质心跟随、停止与返回、共享 CLI，保持材料点选择贯穿倒放和屏幕变化。122 项主机检查、跟随内存检查、相机回归、实际 v10 独立解码及三布局点击通过；原回放和 10 个项目恢复。不是持久碎片谱系或再聚合。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.40.0.md)。

- 0.39.0 接入逐帧几何材料团块、颜色与列表对应、质量／质心／速度／尺度分页以及 v10 回放。121 项主机检查、算法内存检查、原生回归、实际应用及三布局按钮命中通过；原 38.87 秒回放及 10 个用户项目恢复。几何团块不是引力束缚或再聚合判据。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.39.0.md)。

- 0.38.0 核对预研实施状态，补齐 SPH 跨实验参照、九指标共轴曲线、参数差异和原始采样导出。120 项主机检查、实际应用冷启动／文件恢复／432 行采样核对、三布局按钮命中通过；原 38.87 秒保存历史按字节恢复，10 个用户项目保留。本轮未改原生求解器。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.38.0.md)。

- 0.37.0 增加零自转岩球初态、撤去阻尼后的对照实验与记录窗口统计，修复满 240 帧 CSV 的 CLI 回复上限。111 项主机检查、原生回归、十二组跨平台释放实验、实际应用及三布局按钮命中通过；原回放及 10 个用户项目已恢复。32 秒释放观察不证明平衡或长期稳定。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.37.0.md)。

- 0.36.0 增加静止岩体独立预松弛、准备后组装碰撞、取消及 v9 模型保存，配套直接／预松弛主题对照。107 项主机检查、原生引擎、四组跨平台阻尼对照、应用回放和三布局按钮命中通过；原回放及 10 个用户项目恢复。定时准备不等于静力平衡。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.36.0.md)。

- 0.35.0 增加四条 SPH 结构与能量曲线、16 列导出及 v7/v8 回放，兼容旧数据缺失。解析与原生测试、应用数据往返及三布局按钮命中通过；较新实验作为原始回放保留，原保存回放和 10 个用户项目恢复。静力平衡和完整能量预算仍待完成。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.35.0.md)。

- 0.34.0 接入可选 SPH 材料自引力，保留实验与回放模型身份。独立球壳积分、九组短时岩球桌面／鸿蒙对照、应用碰撞／回放和三布局验收通过；恢复原慢撞实验与用户回放。静力平衡、完整能量和再聚合待下一批。见 [本轮记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.34.0.md)。

- 0.33.1 修复近看统一隐藏太阳和其他天体，增加目标相对方向投影，保持遮挡与点选深度一致。原生投影／相机测试、模拟器三布局可见性与点选及相机请求回归通过；原椭圆环时刻和用户实验已恢复。见 [修复记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.33.1.md)。

- 0.33.0 将环面、环影与可见颗粒统一为同一组 8192 个运动粒子，增加受控局部径向扰动和版本化保存，修复跨场景误关闭环模式。97 项主机、1,179,648 个原生轨道状态、模拟器冷恢复／三窗口／配方与 UI 回归通过；原椭圆环时刻、镜头和十个用户实验已恢复。仍无颗粒互撞或自引力，完整行星碰撞待实现。见 [0.33.0 记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.33.0.md) 与 [物理主线](OpenSPH-HarmonyOS-Native/docs/reference/RING-AND-COLLISION.md)。

- 0.32.0 新增逐天体地表／云层种子、单线程后台生成、350 ms 材质过渡、独立外观历史及 v3 配方；复制／删除保留归属，外观编辑保持物理与相机。95 项主机、原生生成器、模拟器新功能／冷恢复／三种布局、配方与 UI 回归通过；恢复本轮起始暂停场景和十个用户实验。见 [0.32.0 记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.32.0.md)。

- 当前 ArkUI / ArkTS、OpenSPH 原生内核、独立轨道模型、渲染、资源及许可证。
- NASA SVS 月面颜色图、按需解码／上传、月面主题及编辑／放置／保存；曝光、线性光照、海洋反光／云影独立控制与 v2 外观配方；原生镜头请求与取消、手势接管、编辑保持视角、CLI 等待；实验配方保存、主题／镜头／外观恢复、旧文件兼容、局部环参数持久化；十二种主题实验、可调圆／椭圆示踪、慢放、轨道预览和带环气态行星外观、放置与编辑历史、沉浸式窗口、折叠／旋转布局和语义 CLI。
- 历史发布记录、原始验收证据、文档引用的本项目截图及 Celestia／SpaceEngine／Universe Sandbox 研究。
- 0.31.0 新增准备阶段与耗时、共享取消操作、请求隔离和 CLI 等待失败状态保留。93 项主机检查、原生完整回归、六组实际 SPH／轨道准备与取消重启、三种窗口停止与开始按钮触摸通过；恢复原实验与十个用户存档。0.30 首次准备卡顿根因未定，未将新增诊断写成根因修复。见 [0.31.0 记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.31.0.md)。

## 继续工作

当前实施状态以 [预研实施顺序](OpenSPH-HarmonyOS-Native/docs/reference/RESEARCH-IMPLEMENTATION.md) 为准。0.45.0 已完成受约束的星系相遇偏移预览、曲线、本地参照和双实验诊断 CSV；接下来补任意位置／速度的初态定义和文件选择器，再评估带质量盘／暗晕、气体云，行星轨道到局部 SPH 仍是另一条物理主线。以下按原日期保留历史调研记录。

2026-09-07 增加 [天体程序化生成调研](OpenSPH-HarmonyOS-Native/docs/research/PROCEDURAL-CELESTIAL-GENERATION-2026-09-07.md)：固定 NPGS 提交并选读 10 份文件，比较 9 个开源候选，另选读 Solar-System 陨坑相关 3 份源码，核对 3 份华为 MCP 文档。形成外观 seed／地貌／大气、系统初值与黑洞的分批路线和 8 个预设；视频仅阅读索引，未播放，作者主页目录访问受限。此次仅更新文档和来源证据，应用仍为 0.31.0。

2026-09-07 增加 [国产替代与国内运营预研](OpenSPH-HarmonyOS-Native/docs/research/CHINA-LOCALIZATION-OPERATIONS-2026-09-07.md) 和 [资源服务台账](OpenSPH-HarmonyOS-Native/docs/reference/SERVICE-INVENTORY.md)：核对 8 份 Stellarium 本地资料／实现及 20 个外部来源，区分国产数据、国内托管、构建镜像与可执行插件。该次预研只更新文档，当时应用为 0.24.0，未切换服务或重打包历史 HAP／ZIP。

已接入薄环外观、可调切向发射速度的开普勒轨道、慢放与近远点诊断，局部参数存档现已接入，原生连续镜头已可取消和等待，曝光与海洋／云影控制已接入，首张真实月面底图与按需加载已接入，单行星质量／外观复制放置已接入；单次实验距离／速率曲线、持久参照、跨实验叠加和 CSV 导出已接入；下一步补整组配方复用、观测导览、更多地图与资源分档、时间曲线与卫星摄动的受控积分对照；压力、比内能、损伤已贯通；五指标曲线与原始 CSV 已接入；已建立材料解析极限及数值敏感性基线，但损伤与分辨率未收敛；物理侧继续按独立标准算例与收敛、自引力基线、局部 SPH 与轨道连接、完整检查点推进。当前没有土星环动力学、行星破碎或月球形成能力。详见 [当前路线](OpenSPH-HarmonyOS-Native/README.md) 与 [SpaceEngine 调研](OpenSPH-HarmonyOS-Native/docs/research/SPACEENGINE-2026-09-06.md)。

宇宙沙盒已通过 Steam 正常进入太阳系，之前已验证暂停和菜单观察；鼠标输入尚未成功打开添加面板，未完成碰撞预设体验。详见 [操作记录](OpenSPH-HarmonyOS-Native/docs/research/UNIVERSE-SANDBOX-SESSION-2026-09-06.md)。

本检查点不修改 main，不包含竞品程序代码或私有素材。源码许可证与银河摄影等第三方授权分别保留。
