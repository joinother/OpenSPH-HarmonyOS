# 星体实验室 GitHub 检查点

记录日期：2026-09-07（Asia/Shanghai）；源码版本：0.21.0。

## 恢复开发

本分支基于原仓库 main 的 `8b4230e607d07710064acd87fb708b566fff4d07`，保留旧 OpenSPH-DevEco、patches 和 tools；新工程在 [OpenSPH-HarmonyOS-Native](OpenSPH-HarmonyOS-Native/README.md)。

```sh
git clone --branch checkpoint/arkui-0.17.0-2026-09-06 https://github.com/joinother/OpenSPH-HarmonyOS.git
cd OpenSPH-HarmonyOS/OpenSPH-HarmonyOS-Native
python3 scripts/check-docs.py
node --test tests/cli_transport.test.mjs tests/project_recipe.test.mjs tests/project_recipe.test.mjs
./scripts/build.sh
```

构建需要 DevEco Studio 与 HarmonyOS SDK；安装请遵循工程 README，当前任务只操作模拟器 127.0.0.1:5555。签名配置、依赖缓存、构建目录和发布二进制不纳入源码检查点。

## 保存范围与验证

- 当前 ArkUI / ArkTS、OpenSPH 原生内核、独立轨道模型、渲染、资源及许可证。
- 实验配方保存、主题／镜头／外观恢复、旧文件兼容、局部环参数持久化；九种主题实验、可调圆／椭圆示踪、慢放、轨道预览和带环气态行星外观、放置与编辑历史、沉浸式窗口、折叠／旋转布局和语义 CLI。
- 历史发布记录、原始验收证据、文档引用的本项目截图及 SpaceEngine／Universe Sandbox 研究。
- 本轮完成构建安装、48 项主机测试、模拟器冷启动配方恢复、192 个示踪点位置对照、旧格式与坏文件隔离、展开／折叠／横屏实验库，以及既有 UI／CLI 回归。测试后恢复此前的蔚蓝世界双体主题、3 年终态与观察设置，既有存档保留。见 [0.21.0 验收](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.21.0.md)。

## 继续工作

已接入薄环外观、可调切向发射速度的开普勒轨道、慢放与近远点诊断，局部参数存档现已接入，下一步补可编排连续镜头、时间曲线与卫星摄动的受控积分对照；物理侧按压力、内能、损伤、自引力与完整检查点推进。当前没有土星环动力学、行星破碎或月球形成能力。详见 [当前路线](OpenSPH-HarmonyOS-Native/README.md) 与 [SpaceEngine 调研](OpenSPH-HarmonyOS-Native/docs/research/SPACEENGINE-2026-09-06.md)。

宇宙沙盒已通过 Steam 正常进入太阳系，之前已验证暂停和菜单观察；鼠标输入尚未成功打开添加面板，未完成碰撞预设体验。详见 [操作记录](OpenSPH-HarmonyOS-Native/docs/research/UNIVERSE-SANDBOX-SESSION-2026-09-06.md)。

本检查点不修改 main，不包含竞品程序代码或私有素材。源码许可证与银河摄影等第三方授权分别保留。
