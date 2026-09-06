# 0.9.0 · 天体点选与初始向量预览

> 类型：版本记录（仅描述该版本）；适用范围：0.9.0。
> 整理日期：2026-09-06（Asia/Shanghai）。

原始发布日期未单独记录；文内明确写出的验证日期保留原义。当前操作以 [CLI 指南](../CLI.md) 为准。

宇宙视口中的行星可直接点选；选中后跟踪镜头，自定义系统同步选中编辑对象。同一对象再次点选保留其草稿，切换对象沿用原有“放弃未应用输入”的规则。空白点击保留选择，拖动仍用于旋转，双指仍用于缩放。

## 实现

- Native 渲染与命中共用 projection.h 的正交投影、显示半径和近看过渡结果。读取最近已提交画面的投影，包含宽高、时间、深度和透明度；场景重建、Surface 重建／尺寸变化、后台不可用期间不返回旧命中。图像帧时间可能落后于求解线程。
- 圆盘重叠时优先最前方天体；可见圆盘优先于附近天体的触摸容差。容差为视口 12 vp（上限视口高度的 5%）。近看中淡出的其他天体不可选。
- ArkUI TapGesture 与 CLI pickBody 调用相同的 pickViewport → focus 动作；投影查询的坐标以视口左上角为原点，归一化至 0–1，不包含系统安全区。
- 自定义天体编辑新增初始位置／速度箭头，支持 XY、XZ 投影、各自单位与独立缩放；零向量或垂直于当前平面的向量以中心十字显示。数据为输入坐标系下的初始草稿，未做质心平移；不是实时速度，也不是未来轨道预测。空值、非有限值、超范围输入清除预览，应用仍由原有完整配置校验负责。
- 岩质 SPH 视口标注“未启用自引力”；详见 UPSTREAM-AUDIT.md，避免误以为已支持引力再聚集。

## CLI

新增 `getProjectedBodies`、`pickBody {x,y}`、`getOrbitPreview`。新增动作 `orbit.plane.xy`、`orbit.plane.xz`；getUiState.editor 增加 vectorPlane。旧命令兼容。

语义操作优先按 body ID 调用 `uiAction {action:"focus.1"}`。getProjectedBodies/pickBody 主要用于视口命中诊断，返回投影不包含 ArkUI 面板遮挡信息；真实触摸由 ArkUI 分发，覆盖在视口上的控件不会因此被穿透点击。

## 验证与边界

- 17 项宿主 CLI／编辑事务测试通过。
- projection_test.cpp 在 AddressSanitizer、UndefinedBehaviorSanitizer 下通过：横竖比例、旋转、深度重叠、可见圆盘优先、容差、非法坐标、近看遮隐。
- test-ui-cli-emulator.mjs 原有回归通过；test-picking-emulator.mjs 在展开、折叠窗口通过 CLI、真实 TapGesture 命中及拖动不误选测试；证据文件见 picking-device-tests.json、picking-phone-tests.json。
- 现有海洋／云层／大气／近看／前后台渲染回归通过，见 picking-material-regression.json。
- 截图用于检查箭头尺寸、布局、单位说明，不等于动画帧率或真机性能结论。

本版本不改物理方程、积分步长或回放格式；尚未支持 SPH 粒子／碎片点选、天体拖拽改变初始条件、实时速度向量与 N-body 碰撞破碎。下一阶段首先增加 SPH 压力／内能／损伤可观察性和参考算例，再验证自引力。

## 官方 API 参考

本轮通过华为开发者知识 MCP 查询 [TapGesture](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-gestures-tapgesture)、[手势事件](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-gesture-common)、[Path 绘图](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-drawing-components-path)。Path 指令使用像素坐标，应用按 vp2px 转换，防止高密度屏幕上的箭头缩小。
