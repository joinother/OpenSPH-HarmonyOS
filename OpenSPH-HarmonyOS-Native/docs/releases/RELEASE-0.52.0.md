# 0.52.0：SPH 破坏与热软化首批

> 类型：开发断点记录；实现与验证日期：2026-09-08（Asia/Shanghai）；版本：0.52.0 / 1000053。

本批把破坏与热软化从“下一阶段”推进到可操作的 SPH 材料实验。新增初始比内能和有效损伤，两项都写入 OpenSPH 材料并影响实际压力／屈服响应；新增完整冷岩、预热和预裂隙三组同速碰撞。材料输入放在参数面板顶部，可通过同一套 CLI 修改。

观察面板新增热软化外观、剩余屈服强度以及严重损伤质量、热致零屈服强度质量等统计。比内能驱动示意发光，损伤驱动暗化；着色切换保持物理时间与视角。新 v15 回放保留两项初态与逐帧响应，旧记录不会被补造液相状态。

## 验证

- [117 项主机检查](../evidence/material-response-0.52.0/ui-tests.txt)：实际页面动作、材料输入、无效事务、实验配方、CLI 传输与对照模型。
- [18 组上游应力检查及四组引擎演化](../evidence/material-response-0.52.0/native-tests.txt)：直接调用导入的 von Mises 模型，检验剪切与负压力削弱；冷／热／预损伤／阈值初态、质量、内能与损伤演化、v15 完整回读和坏文件拒绝。
- [SPH 专项回归](../evidence/material-response-0.52.0/sph-smoke.txt)：自引力、独立预松弛、取消替换、不同粒子预算、确定性、旧 v1/v2/v5–v9 读取与 60 秒运行。运行参数为 `--sph-only`，不把旧轨道用例算作通过。
- [实际应用语义验收](../evidence/material-response-0.52.0/device.json)：三组 600 预算、实际 641 粒子的 60 秒碰撞，热外观／强度切换不重算，v15 回放与命名实验保留状态，无效输入不替换场景。
- [构建](../evidence/material-response-0.52.0/build.txt)与[指定模拟器安装](../evidence/material-response-0.52.0/install.txt)。未做真机性能、手指命中或录像验证。
- 补测 [null 材料输入](../evidence/material-response-0.52.0/null-inputs.json)，确保显式 null 不会被当作省略参数。恢复工具同时补齐暂停会话的恢复：保持原时刻、六个天体、240 帧与暂停状态，见 [恢复记录](../evidence/material-response-0.52.0/restoration.json)及[持久文件校验](../evidence/material-response-0.52.0/files-restored.json)。

旧全域引擎测试仍按 v11 写出格式断言，遇到现有 v14 轨道写出时报错；本批为 SPH 增加显式专项入口，保留旧轨道测试待后续适配。本次不宣称全域测试通过。首次 UI 脚本使用超出 CLI 上限的等待参数，校正到 120 秒后重跑；该次请求尚未进入应用，见 [预检记录](../evidence/material-response-0.52.0/preflight-timeout-option.json)。

## 完成范围

实际材料响应与视觉映射的公式、单位、存档结构及来源见 [模型参考](../reference/SPH-MATERIAL-RESPONSE.md)。旧损伤／分辨率基线尚未收敛，本批没有增加“准确预测碎片数量”的结论。

当前仍使用粒子显示，未完成连续液态表面、热容／潜热一致的相变、温度和液相比例、辐射冷却结壳。轨道弹性接触也尚未自动进入局部 SPH，残骸回注和月球形成未实现。后续主线仍是 P2 事件转换与 P3 相变能量账，见 [当前路线](../reference/PRODUCT-ROADMAP.md)。
