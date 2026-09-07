# 0.35.0：观察碰撞材料的能量与收缩

> 类型：版本记录；验证日期：2026-09-08（Asia/Shanghai）；适用设备：开发模拟器 127.0.0.1:5555。

## 行为变化

SPH 观察面板增加引力势能、质心系相对动能、材料分布尺度和平均径向速度四条曲线。可以定位极值并回看对应帧；UI 与 CLI 共用动作，查询和定位不重建场景或改变相机。势能读取与求解一致的软化引力模型；关闭材料自引力时记为零。

新数据随 v7（无自引力）／v8（有自引力）回放保存，CSV 从 12 列扩展到 16 列。旧回放仍可读取，缺少结构数据时禁用四个新控件，保留原曲线和 12 列导出，不补造零值。原十项诊断的字段顺序保持兼容。

分布尺度测量全部材料到质心的均方根距离，不是行星表面半径；径向速度为负只说明平均向内运动。定义与边界见 [结构诊断](../reference/SPH-STRUCTURE.md)，动作与字段见 [CLI](../CLI.md#sph-结构与能量)。

## 验证

- [104 项主机检查](../evidence/structure-0.35.0-host-tests.txt) 和新增最后一项测试后的 [75 项曲线／CLI 回归](../evidence/structure-0.35.0-final-regression.txt) 通过；两组存在重叠，不相加计数。
- [解析测试](../evidence/structure-0.35.0-structure-tests.txt) 在 ASan/UBSan 下检查质心统计、不同质量、坐标变换及非法输入；[鸿蒙原生引擎测试](../evidence/structure-0.35.0-native-emulator.txt) 验证真实初态、回放精确往返和损坏输入拒绝，既有引擎回归通过。
- [应用测试](../evidence/structure-0.35.0-ui.json) 对照四条曲线与 CSV 的全部样本，覆盖 16 秒碰撞、极值定位、v7/v8 回放和 1200 预算（实际 1276 粒子）的短算例。开关两组使用不同预算，不能用于量化自引力的物理差异。
- [布局测试](../evidence/structure-0.35.0-layout.json) 在展开竖屏、手机竖屏和横屏实际点击四个新选项及极值按钮，检查相机、场景和沉浸状态。截图已目视检查；未测动画帧率。
- [实际旧回放](../evidence/structure-0.35.0-legacy.json) 验证原十项数值不变，缺少结构字段时新控件不可用，原压力曲线继续可用。
- [现场恢复](../evidence/structure-0.35.0-restoration.json) 保留较新的 240 帧实验为暂停回放，核对全部十项诊断与独立解码结果完全一致，恢复先前视角并保留 10 个用户项目；原单槽回放按字节恢复。

实际截图：[展开](../../../OpenSPH-0.35.0-sph-structure-wide.png)、[手机](../../../OpenSPH-0.35.0-sph-structure-phone.png)、[横屏](../../../OpenSPH-0.35.0-sph-structure-landscape.png)。另见 [构建](../evidence/structure-0.35.0-build.txt) 与 [验证中发现的问题](../evidence/structure-0.35.0-validation-notes.json)。

## 后续主线

本轮增加可观察、可导出的诊断，没有完成静力平衡天体、分层行星、弹性应变能预算、束缚碎片辨识或再聚合。下一批按 [环与碰撞主线](../reference/RING-AND-COLLISION.md) 推进松弛初态及完整能量检查，再讨论长时稳定性和碎片团。旧记录缺少新读数，需要重新计算才能产生。
