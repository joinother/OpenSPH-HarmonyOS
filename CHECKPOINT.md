# 星体实验室 GitHub 检查点

> 类型：当前恢复入口；更新日期：2026-09-08（Asia/Shanghai）；源码版本：0.53.0。

本分支基于原仓库 main 的 `8b4230e607d07710064acd87fb708b566fff4d07`，保留旧 OpenSPH-DevEco、patches 和 tools；原生工程在 [OpenSPH-HarmonyOS-Native](OpenSPH-HarmonyOS-Native/README.md)。开发断点不修改 main。

## 恢复开发

```sh
git clone --branch checkpoint/arkui-0.17.0-2026-09-06 https://github.com/joinother/OpenSPH-HarmonyOS.git
cd OpenSPH-HarmonyOS/OpenSPH-HarmonyOS-Native
python3 scripts/check-docs.py
node --test tests/cli_transport.test.mjs tests/project_recipe.test.mjs
./scripts/build.sh
```

构建需要 DevEco Studio 与 HarmonyOS SDK；安装遵循项目 README。本任务仅操作模拟器 127.0.0.1:5555；操作前按项目脚本备份当前实验。签名、依赖缓存、构建目录、私人会话备份和发布二进制不纳入源码检查点。

## 当前行为与证据

0.53.0 在轨道反弹前捕获双方状态，核对 SI／质心初值，并以 v16 保存接触记录；新增 100 km／60 km 岩体用例、观察面板和只读 CLI。112 项主机检查、原生事件／连续轨道回归及模拟器操作验收见 [0.53.0 记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.53.0.md)。

轨道仍为最多 8 体、最小实体半径 1 km，接触为理想弹性反弹。独立 SPH 已能实验材料破坏与热软化，但没有连续液态表面、相变潜热、冷却；轨道已记录入射数据，但未自动进入局部 SPH。录像沿用系统编码，实际录制与导出待真机测试。

此前版本及研究按原日期保存在[文档目录](OpenSPH-HarmonyOS-Native/docs/README.md)。公开创作者的 215 个视频目录与代表内容已归纳为[目标用户样本](OpenSPH-HarmonyOS-Native/docs/research/TARGET-CREATOR-651227816-2026-09-08.md)，研究不代表功能已实现。

## 下一步

执行顺序以[产品实施路线](OpenSPH-HarmonyOS-Native/docs/reference/PRODUCT-ROADMAP.md)为准：在已保留的入射向量基础上，接入受支持小岩体的粒子初始化、外部场处理、事件消费与完整世界回滚，随后推进热状态、残骸回注和分层行星／环。当前捕获的是接触漂移阶段的入射半步速度，不能宣称连续精确解。

新应用源码、OpenSPH 及第三方摄影素材分别保留许可证和署名；本检查点不包含同行私有实现或程序素材。
