# 0.12.0 · 放置行星

> 类型：版本记录（仅描述该版本）；适用范围：0.12.0。
> 整理日期：2026-09-06（Asia/Shanghai）。

原始发布日期未单独记录；文内明确写出的验证日期保留原义。当前操作以 [CLI 指南](../CLI.md) 为准。

“添加行星”现在打开独立的放置草稿。原场景、模拟时间、轨迹和已有天体草稿保持原样，确认后才把候选天体加入初始条件并从零重建。新增浮动“＋ 放置行星”入口，保留参数面板内入口。

## 操作

- 在轨道平面俯视图上轻点或拖动，设置距离和方位；也可输入精确数值。
- 圆轨道、相对恒星静止、掠过、反向四个快捷操作。蓝色箭头指示初速度方向，紫线显示二体解析引导，灰点为已有天体初始位置在所选平面上的投影。
- 输入名称、表面、地球质量倍数、AU 距离、方位、倾角和圆轨道速度倍数。倾角是围绕全局 X 轴旋转的轨道平面，反向只改变切向速度符号。
- 无效／空输入、初始间距不足、坐标或速度越界会禁用确认并说明原因。
- 取消、收起面板与系统返回都取消本次放置，保留原实验和旧编辑草稿；确认后清空旧轨迹与旧草稿。放置过程中实验控制暂不可操作。

## 模型边界

只在初始条件下围绕第 0 颗恒星构造候选天体，不在当前回放时刻插入。候选速度包含恒星原有速度；圆轨道速度用恒星与候选天体质量之和计算。静止表示相对恒星静止。掠过快捷值为圆轨道速度的 1.45 倍。

紫线由二体解析关系生成，忽略其他行星扰动，不是多体积分的未来轨迹。其他天体位置为所选轨道平面的投影；当前运行画面仍是原来的模拟。近距离点质量运动会触发现有停止条件，不能将其描述为已实现 SPH 行星撞击。新增工具仍受 2–8 天体、±10 AU、100 km/s 和初始间距 0.05 AU 的限制。

本轮没有引入第三方运行库或素材。[同行参考和分阶段路线](../research/PEER-RESEARCH-2026-09-06.md)记录了来源、许可证和各项目适用范围。ArkUI 手势参考华为 MCP 的 [互斥手势组](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-gesture-events-multi-level-gesture)，使用 Exclusive 让平面轻点与拖动各自识别；它们共用语义操作的坐标转换。

## CLI 变化

先调用 listCommands / getUiState。

- `uiAction orbit.add` 现在只开始草稿，**不再立即新增天体**。旧脚本需在其后增加 `uiAction placement.confirm`；现有批次示例已更新。
- `placement.cancel / placement.confirm / placement.circular / placement.still / placement.escape / placement.reverse / placement.surface.1..3`。
- `setUiValue` 新增 `placement.name` 与 `placement.value.0..4`，值均为字符串，以便保留空输入。字段依次为质量、距离、方位、倾角、速度倍率。
- `setPlacementPoint {x,y}` 使用图内归一化坐标，和实际触摸相同；不会提交候选。
- `getPlacementPreview` 返回有效性、错误、候选完整初始条件、相对速度、圆轨道／逃逸速度、最近距离、解析引导路径及图坐标。`getState.placement` 返回全部草稿状态。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.add"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setPlacementPoint --payload-json '{"x":0.7,"y":0.35}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getPlacementPreview
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"placement.confirm"}' --wait-state paused
```

## 验证

21 项主机 CLI 与数学测试：候选事务、取消、重复确认、无效输入、参考系平移、倾斜轨道、正反向速度、相对静止与逃逸分类。模拟器测试核对确认前的场景／时间／历史／画布不变，确认后恰好加入候选初始状态；实际平面轻点／拖动核对坐标和底层相机未转动。另做现有 UI CLI 与连续镜头回归。证据见 [主机测试](../evidence/placement-host-tests.txt)、[宽窗口 CLI](../evidence/placement-device-tests.json)、[手机 CLI](../evidence/placement-phone-tests.json)、[宽窗口触摸](../evidence/placement-touch-tests.json)、[手机触摸](../evidence/placement-phone-touch-tests.json)、[UI 回归](../evidence/placement-ui-regression.json) 与 [连续镜头回归](../evidence/placement-continuity-regression.json)。

手机和宽屏均检查预览图完整可见，截图只代表布局，不代表真机性能基准。仅安装模拟器 127.0.0.1:5555；未推送远端。
