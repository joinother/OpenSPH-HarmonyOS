# 星体实验室 GitHub 检查点

> 类型：当前恢复入口；更新日期：2026-09-08（Asia/Shanghai）；源码版本：0.51.0。

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

0.51.0 增加公里级小岩体质量范围、公斤／公里／公里每秒输入、中心距离／表面高度与半径／直径换算、15 km 岩体快捷项、小母体卫星默认值，并修复命令回复丢段后的安全重取。当前时刻插入与 v14 续算保留原有时间、位置和速度。验收与限制见 [0.51.0 记录](OpenSPH-HarmonyOS-Native/docs/releases/RELEASE-0.51.0.md)。

仍为最多 8 体、最小实体半径 1 km；接触为理想弹性反弹。没有把放置完成算成 SPH 破碎、熔融或月球形成完成。录像沿用系统编码，实际录制与导出待真机测试。

此前版本及研究按原日期保存在[文档目录](OpenSPH-HarmonyOS-Native/docs/README.md)。公开创作者的 215 个视频目录与代表内容已归纳为[目标用户样本](OpenSPH-HarmonyOS-Native/docs/research/TARGET-CREATOR-651227816-2026-09-08.md)，研究不代表功能已实现。

## 下一步

执行顺序以[产品实施路线](OpenSPH-HarmonyOS-Native/docs/reference/PRODUCT-ROADMAP.md)为准：从响应前捕获轨道碰撞双方状态，验证到局部质心系的单位与守恒转换，再接入受支持的小岩体 SPH，随后推进热状态、残骸回注和分层行星／环。现有接触后的半步速度不能直接充当碰撞前初态。

新应用源码、OpenSPH 及第三方摄影素材分别保留许可证和署名；本检查点不包含同行私有实现或程序素材。
