# 星体实验室 GitHub 检查点

> 类型：当前恢复入口；更新日期：2026-09-09（Asia/Shanghai）；源码版本：0.57.0。

本分支基于原仓库 main 的 `8b4230e607d07710064acd87fb708b566fff4d07`，保留旧 OpenSPH-DevEco、patches 和 tools；原生工程在 [OpenSPH-HarmonyOS-Native](OpenSPH-HarmonyOS-Native/README.md)。开发断点不修改 main。

## 恢复开发

```sh
git clone --branch checkpoint/arkui-0.17.0-2026-09-06 https://github.com/joinother/OpenSPH-HarmonyOS.git
cd OpenSPH-HarmonyOS/OpenSPH-HarmonyOS-Native
python3 scripts/check-docs.py
node --test tests/collision_acceptance.test.mjs tests/cli_transport.test.mjs tests/project_recipe.test.mjs tests/cli_wait.test.mjs
./scripts/build.sh
```

构建需要 DevEco Studio 与 HarmonyOS SDK；安装遵循项目 README。本任务仅操作模拟器 127.0.0.1:5555；操作前按项目脚本备份当前实验。签名、依赖缓存、构建目录、私人会话备份和发布二进制不纳入源码检查点。

## 当前行为与证据

0.57.0 修正旧接触误启动、完成态主操作、冷载入提示与 23 个主题标题。主按钮在计算结束后播放结果，返回原轨道独立保留；配方保存明确为“保存设置与视角”。125 项主机检查、原生旧事件拒绝及真实局部撞击设备流程见 [验证与边界](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.57.0.md)。

来源比例只表示双方初始岩体，均为同一种玄武岩，不是地核／地幔成分或引力束缚判定。当前局部模型采用冷态、无自转玄武岩，外部场是受限短时近似、没有反作用，外部轨道保持暂停；返回恢复进入前的世界，碎片尚不回注。尚无相变比例、潜热、连续液态表面和冷却。视频仍使用系统编码并等待真机验收。

此前版本及研究按原日期保存在[文档目录](OpenSPH-HarmonyOS-Native/docs/README.md)。公开创作者的 215 个视频目录与代表内容已归纳为[目标用户样本](OpenSPH-HarmonyOS-Native/docs/research/TARGET-CREATOR-651227816-2026-09-08.md)，研究不代表功能已实现。

## 下一步

[R01–R10 唯一执行路线](OpenSPH-HarmonyOS-Native/docs/reference/PRODUCT-ROADMAP.md)中 R01 已完成，R02 进行中。0.57.0 是 R02 的入口防护与操作语义首片，仍缺反弹前事件世界、积分阶段续接和持久检查点；下一片继续这些前置，不开始 R03。R06 完成才算连续碰撞核心玩法通过。

[交互契约](OpenSPH-HarmonyOS-Native/docs/design/INTERACTION-DESIGN.md)中的首批 23 个名称、完成／回放主操作和保存提示已接入。分类、对象操作条、布局与完整用户任务仍待落实。历史 0.56.0 产物及 R01 证据保持原样。

新应用源码、OpenSPH 及第三方摄影素材分别保留许可证和署名；本检查点不包含同行私有实现或程序素材。
