# 0.50.0 选中天体后的卫星、投放与发射

> 类型：开发断点记录；实现与验证日期：2026-09-08（Asia/Shanghai）。

## 新行为

选中天体后，浮动操作区提供“添加卫星”“向它发射”“附近投放”。三者均使用当前帧中的母体位置与完整速度：卫星叠加二体圆轨道切向速度，发射叠加朝向母体的速度，投放保持相对母体静止；确认后进入同一多体引力系统。

局部预览围绕母体放大，主星图点放与参数图共用倾斜平面。距离输入为 AU，浮动提示显示 km；可切换方向、速度、外观、质量与半径。点质量场景在确认时按现有质量／半径估算补全所有实体半径，不改变原有质量、时间、位置或速度；取消不改变模型。完整历史继续使用 v14，原生检查覆盖模型切换后的保存及续算。

UI 与 CLI 共用 `selection.satellite/launch/drop`，保留 `placement.confirm/cancel`。本次也将多份预研收敛为 [产品实施路线](../reference/PRODUCT-ROADMAP.md)，明确目标操作、局部 SPH、热状态、碎片回注与分层行星的依赖和验收条件。

## 本轮验证

- [99 项主机事务及配方检查](../evidence/local-placement-ui-tests.txt)：实际页面语义实现，含移动母体速度继承、三种模式、重叠拒绝、失败取消及原状态保留；不是触摸验收。
- [引力数值检查](../evidence/local-placement-gravity.txt)：卫星运行十圈，最大相对半径偏差约 4.79e-7；母体有反作用，动量和能量在测试预算内；定向发射被引力加速至实体表面。测试入口为 `tests/planet_satellite_test.cpp`。
- [原生引擎检查](../evidence/local-placement-engine.txt)：模拟器独立进程，当前时刻原子补半径、保留既有向量、v14 保存／恢复及继续；同时保留 0.49.0 连续时钟回归。
- [放置投影](../evidence/local-placement-projection.txt)、[轨道回归](../evidence/local-placement-orbit.txt) 与 [接触回归](../evidence/local-placement-contact.txt)：局部尺度投影、不同屏幕比例、守恒、接触与步长对照。
- [实际应用 CLI 检查](../evidence/local-placement-device.json)：三种模式、局部视口语义点放、取消、加入与运行；发射体在约 59315.77 秒接触母体，相对法向速度约 10.17 km/s，系统自动暂停。
- [放置画面](../evidence/local-placement-preview.jpeg)、[接触画面](../evidence/local-placement-contact.jpeg)：展开窗口静态观察；未声称验收真实触摸、过渡流畅度或全部折叠姿态。
- [恢复记录](../evidence/local-placement-restoration.json)：恢复原初始场景、精确向量、相机和外观，移除本次临时项目；未改写用户保存回放。
- [构建](../evidence/local-placement-build.txt) 与 [安装](../evidence/local-placement-install.txt) 通过：0.50.0 / 1000051，仅操作模拟器 127.0.0.1:5555。

设备复测入口为 `scripts/test-local-placement-emulator.mjs 127.0.0.1:5555 <证据目录>`，要求当前为四体点质量自定义初始暂停场景；脚本会保存临时配方并在结束时恢复。原生入口为 `bash scripts/test-orbit-sandbox-emulator.sh 127.0.0.1:5555`。

## 边界

最多 8 体，最小非恒星质量仍为 1e-8 太阳质量（约 0.00333 地球质量），尚不支持米级小陨石。二体圆轨道构造不保证多体长期稳定。估算半径并非真实行星内部结构；预览图标可读尺寸不等同于实体比例。

碰撞仍为理想弹性球接触和自动暂停。没有实现熔融、合并、破碎、潮汐耗散、轨道到 SPH 的转换或碎片回注；外观环仍没有参与此卫星引力模型。真实行星撞击与月球形成不能记为完成。
