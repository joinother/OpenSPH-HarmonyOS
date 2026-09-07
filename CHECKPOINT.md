# 星体实验室 GitHub 检查点

记录日期：2026-09-07（Asia/Shanghai）；源码版本：0.25.0。

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

- 当前 ArkUI / ArkTS、OpenSPH 原生内核、独立轨道模型、渲染、资源及许可证。
- NASA SVS 月面颜色图、按需解码／上传、月面主题及编辑／放置／保存；曝光、线性光照、海洋反光／云影独立控制与 v2 外观配方；原生镜头请求与取消、手势接管、编辑保持视角、CLI 等待；实验配方保存、主题／镜头／外观恢复、旧文件兼容、局部环参数持久化；十种主题实验、可调圆／椭圆示踪、慢放、轨道预览和带环气态行星外观、放置与编辑历史、沉浸式窗口、折叠／旋转布局和语义 CLI。
- 历史发布记录、原始验收证据、文档引用的本项目截图及 Celestia／SpaceEngine／Universe Sandbox 研究。
- 0.25.0 新增复制行星为放置草稿，沿用已应用的质量与表面，自动避位，支持取消、撤销／重做和命名存档。构建安装、62 项主机测试、带环／月面模拟器事务、三种窗口新按钮实际点击和原有 UI／CLI 回归通过；原三天体实验、1 年终态和原存档已恢复。见 [0.25.0 验收](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.25.0.md)。

## 继续工作

2026-09-07 增加 [国产替代与国内运营预研](OpenSPH-HarmonyOS-Native/docs/research/CHINA-LOCALIZATION-OPERATIONS-2026-09-07.md) 和 [资源服务台账](OpenSPH-HarmonyOS-Native/docs/reference/SERVICE-INVENTORY.md)：核对 8 份 Stellarium 本地资料／实现及 20 个外部来源，区分国产数据、国内托管、构建镜像与可执行插件。此次只更新文档，应用仍为 0.24.0，未切换服务或重打包历史 HAP／ZIP。

已接入薄环外观、可调切向发射速度的开普勒轨道、慢放与近远点诊断，局部参数存档现已接入，原生连续镜头已可取消和等待，曝光与海洋／云影控制已接入，首张真实月面底图与按需加载已接入，单行星质量／外观复制放置已接入；下一步补结果对照、观测导览、更多地图与资源分档、时间曲线与卫星摄动的受控积分对照；物理侧按压力、内能、损伤、自引力与完整检查点推进。当前没有土星环动力学、行星破碎或月球形成能力。详见 [当前路线](OpenSPH-HarmonyOS-Native/README.md) 与 [SpaceEngine 调研](OpenSPH-HarmonyOS-Native/docs/research/SPACEENGINE-2026-09-06.md)。

宇宙沙盒已通过 Steam 正常进入太阳系，之前已验证暂停和菜单观察；鼠标输入尚未成功打开添加面板，未完成碰撞预设体验。详见 [操作记录](OpenSPH-HarmonyOS-Native/docs/research/UNIVERSE-SANDBOX-SESSION-2026-09-06.md)。

本检查点不修改 main，不包含竞品程序代码或私有素材。源码许可证与银河摄影等第三方授权分别保留。
