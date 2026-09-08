# 星系潮汐实验

> 类型：当前模型与操作参考；适用版本：0.43.0；更新日期：2026-09-08（Asia/Shanghai）。

实验库新增“两条潮汐尾”和“反转一片星系”，参数页也可选择“星系潮汐”。它们以两个移动的扩展引力势驱动恒星示踪盘，观察相遇后的拉伸与物质桥。此处的“恒星群”是无质量示踪粒子，没有粒子间引力、实体碰撞、气体、动力摩擦或自洽星系合并。

## 操作

选择主题后在初始时刻暂停。点击开始，计算至设置时长；可以暂停、回看、拖动视角或跟随主／次星系中心。镜头与回放操作不重新计算。参数修改进入草稿，点击“应用参数 · 重新生成”才从零重建；当前还不支持在视口自由放置星系或从历史帧续算。

| 参数 | 范围与含义 |
| --- | --- |
| 恒星示踪点 | 200–2400，两盘各约一半；点数不改变引力质量 |
| 主星系质量 | 固定为 1000 亿太阳质量；不是中央黑洞质量 |
| 次／主质量比 | 0.2–1.0 |
| 接近速度 | `speed` 为 0.75–1.25 倍基准速度；基准约 156.45 km/s |
| 初始横向偏移 | 0–30 kpc，初始两中心沿 X 相距 60 kpc；不是近心距 |
| 次盘倾角 | `angle` 为 0–70°，主盘在 XY 平面 |
| 次盘旋转 | 顺行／逆行；相对于非零偏移时中心轨道角动量定义，零偏移时仅表示自转符号 |
| 模拟时长 | 50–800 Myr；1 Myr 为一百万年 |
| 随机种子 | 配方和 CLI 保留 1–1000000 的确定性种子 |

两组主题使用 1600 点、质量比 0.6、偏移 12 kpc、倾角 25°、600 Myr 和相同种子，只改变次盘旋转方向。新封面由此模型在 400 Myr 的实际示踪点投影生成，金色／蓝色记录所属星系，不代表恒星温度或观测光谱。

## 数值定义

模型身份为 `galaxy-tidal-restricted-v1`。C++ 求解使用 kpc、Myr 和太阳质量，独立于现有 AU／年行星轨道；以太阳引力参数换算本模型引力常数。主势的 Plummer 尺度为 5 kpc，次势尺度乘以质量比的立方根。示踪点的势为 `Phi = -G M / sqrt(r² + a²)`，初始速度取各自孤立球对称势下的圆轨道速度。

初始盘是截断的冷示踪盘，半径为 0.5–12 kpc，次盘按质量比立方根缩放。径向采样使用固定 xorshift32 序列，不是拟合观测的指数盘或自洽平衡星系。两个势中心以质心系初值积分；两中心相互作用采用对称软化势，软化长度平方为两尺度平方之和。这是明确的近似规则，不等于两个 Plummer 密度分布的精确引力卷积。

积分采用 kick–drift–kick，最大步长 0.0625 Myr；每 4 Myr 及最终时刻记录一次，共最多 201 帧。计算每个子步检查取消身份；渲染使用相对实验质心的坐标，1 显示单位为 10 kpc。每个示踪点直接来自积分位置，以柔和光点显示；当前尚无完整宇宙目录、层级参考系或连续空间 LOD。

## 诊断的含义

观察页和 `getGalaxyDiagnostics` 提供中心间距、各来源粒子相对于所属中心的均方根半径，以及超过各自初始盘外缘 1.5 倍的点数比例。外延比例不是逃逸质量或引力束缚判定。

能量与角动量偏差只计算两个软化中心；能量分母为初始能量绝对值加两倍初始动能，避免近抛物线初态下分母过小。中心能量归一化偏差超过 0.001 时停止并报告错误。恒星示踪点受时变外场做功且无反作用，不能以其总能量恒定作为封闭系统守恒条件。

主机、ASAN/UBSAN 检查、ARM64 核心测试以及模型限制见 [0.43.0 记录](../releases/RELEASE-0.43.0.md)。单模型误差检查不等于真实星系科学验证，也没有完成恒星数／初态／分辨率的科学收敛研究。

## 保存与 CLI

命名实验保存模型、质量比、偏移、旋转方向、其他初值以及现有镜头／显示配方。回放使用 v12，保存每帧实际示踪点、中心位置与诊断，仍兼容旧回放；回放只供观察，不能恢复完整求解器继续积分。以下与 ArkUI 使用同一动作：

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.galaxy-tails"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setUiValue --payload-json '{"field":"galaxy.offset","value":18}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"simulation.apply"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command start --wait-state completed
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getGalaxyDiagnostics
```

`setScene` 使用 `preset:6`，接受 `galaxyMassRatio`、`galaxyOffsetKpc`、`galaxyRetrograde`，省略分别取 0.6、12、false。`count/speed/angle/duration/seed` 按本模型含义；为兼容配置结构，岩体字段仍需通过已有范围验证，但不参与此模型。其他预设拒绝星系字段。不能为该模型开启岩体自引力或预松弛，也不接受行星列表。

字段为 `galaxy.ratio`、`galaxy.offset`、`scene.angle`、`scene.count`、`scene.speed`、`scene.duration`；动作 `galaxy.retrograde` 切换次盘方向，`focus.0`／`focus.1` 跟随两个中心。已有保存、载入、暂停、取消和回放动作通用；行星表面、材料损伤和行星曲线动作在星系实验中禁用。

## 下一步

先完成主视口星系放置预览、数据导出及更完整的潮汐形态对照，再评估已导入的 BarnesHut 与带质量的盘／暗晕初态。气体云碰撞需要独立气体数据路径和基准。行星轨道到局部 SPH 的事件转换仍保留为另一条物理主线，详见 [实施顺序](RESEARCH-IMPLEMENTATION.md) 和 [预研](../research/GALAXIES-NEBULAE-UNIVERSE-2026-09-08.md)。
