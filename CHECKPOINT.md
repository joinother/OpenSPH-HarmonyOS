# 星体实验室 GitHub 检查点

> 类型：当前恢复入口；更新日期：2026-09-08（Asia/Shanghai）；源码版本：0.55.0。

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

0.55.0 新增近恒星岩体撞击初态及“含外部潮汐”入口，真实 SPH 粒子受冻结线性潮汐作用；v18 轨道保存同一接触时刻的全部天体，v19 保存局部潮汐与逐帧势能。114 项主机检查、解析及实际 SPH 对照见 [验证与边界](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.55.0.md)。

当前局部模型采用冷态、无自转玄武岩，外部场是受限短时近似、没有反作用，外部轨道保持暂停；返回恢复进入前的世界，碎片尚不回注。尚无相变比例、潜热、连续液态表面和冷却。视频仍使用系统编码并等待真机验收。

此前版本及研究按原日期保存在[文档目录](OpenSPH-HarmonyOS-Native/docs/README.md)。公开创作者的 215 个视频目录与代表内容已归纳为[目标用户样本](OpenSPH-HarmonyOS-Native/docs/research/TARGET-CREATOR-651227816-2026-09-08.md)，研究不代表功能已实现。

## 下一步

按 [产品实施路线](OpenSPH-HarmonyOS-Native/docs/reference/PRODUCT-ROADMAP.md)继续接时变外部场与反作用、世界时钟、连续局部镜头、持久事件协议和碎片回注。当前仍为受限尺度的岩体实验，不能作为完整行星碰撞预测。

新应用源码、OpenSPH 及第三方摄影素材分别保留许可证和署名；本检查点不包含同行私有实现或程序素材。
