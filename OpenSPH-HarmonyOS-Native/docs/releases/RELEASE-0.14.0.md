# 0.14.0 · 折叠与横竖屏适配

> 类型：版本记录；适用版本：0.14.0；实现与验收日期：2026-09-06（Asia/Shanghai）。

原布局只按宽度选择面板，手机横屏时高度不足；根窗口宽度和视口尺寸分别更新，可能以旧尺寸计算镜头避让。应用也没有明确的自动旋转策略。本版以同一份实际安全视口宽高计算工具栏、侧栏、底部控制栏和近看区域。

## 修改

- 默认使用 AUTO_ROTATION_RESTRICTED，跟随传感器且尊重用户的系统旋转锁。单独处理方向策略失败，不阻断后续全屏和安全区配置。
- 四边安全区与窗口像素尺寸合并为一个状态对象；监听避让区和窗口尺寸变化，立即采样并在 80 ms 后补采样，销毁窗口时清除监听和定时器。
- 可用高度不足 480 vp 时使用单行时间轴与紧凑操作；侧栏占右侧，控制栏放在左侧，避免固定高度造成重叠。标题信息压缩，天体快捷操作横向排列，可滚动。
- 近看对象的位置与缩放按面板、顶部工具栏和底部控制栏共同留下的区域计算；布局重排不重建场景、不重载 XComponent，也不清空草稿。
- 新增 `setWindowOrientation` CLI，控制真实主窗口方向；当前窗口尺寸、布局分区和避让区可由 CLI 读取，详见 [指南](../CLI.md)。

## 验收

- [23 项主机测试](../evidence/fold-rotation-host-tests.txt)：共享动作与输入回归，窗口重排不改变实验／草稿／镜头，auto 使用受系统锁控制的策略，非法方向拒绝。
- [构建](../evidence/fold-rotation-build.txt) 与 [模拟器安装](../evidence/fold-rotation-install.txt)。
- [真实窗口切换记录](../evidence/fold-rotation-device-tests.json)：折叠态竖屏、横屏、反向横屏，展开态横竖屏，再次折叠，放置中的横屏／展开，以及另行记录的 [横屏全景](../evidence/fold-rotation-overview-tests.json)。检查 native 视口与安全区一致、真实 UI 边界无越界、侧栏不压住控制栏与近看对象、场景 revision 和回放帧不变、编辑与放置草稿保留。

最终修订将横屏快捷操作对齐左侧，补跑横屏全景验收。

验收后已恢复原来的五天体实验、3 年计算结果与自动旋转策略，见 [最终状态](../evidence/fold-rotation-final-state.json)。

截图：[折叠横屏编辑](../../../OpenSPH-0.14.0-fold-landscape.png)、[展开竖屏编辑](../../../OpenSPH-0.14.0-unfold-portrait.png)、[横屏全景](../../../OpenSPH-0.14.0-overview-landscape.png)。

模拟器 DMS 传感器注入在本轮被后续姿态事件覆盖，因此旋转矩阵使用窗口公开 API 选择方向，折叠／展开使用模拟器 DMS；不把此结果写成完整传感器或真机测试。半折叠桌面形态、折痕避让、真实设备软键盘旋转、PC 标题栏及跨屏仍需单独验收。

## 官方依据

本轮通过华为开发者知识 MCP 读取 [旋转屏动画](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-rotation-transition-animation) 和 [开发应用沉浸式效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-develop-apply-immersive-effects)，参考系统旋转过渡、窗口尺寸回调及动态避让区处理。旋转锁策略同时按本机 SDK 的 window.Orientation 声明核对。
