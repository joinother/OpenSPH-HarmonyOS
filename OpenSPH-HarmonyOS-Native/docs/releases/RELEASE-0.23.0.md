# 0.23.0 · 光与质感

> 类型：版本记录；版本：0.23.0；验证日期：2026-09-07（Asia/Shanghai）。本版为模拟器未签名交付。

## 行为变化

观察面板新增“光与质感”：−2～+2 EV 曝光滑块、海洋反光、云影和还原光照。可在同一颗行星上比较反光与阴影，调节不会重建场景、改变模拟时间或打断镜头。海洋反光只作用于海陆外观；云影依赖云层开启。

球面、云层、恒星和艺术环带的原色光照先在线性颜色空间计算，再进行指数色调映射和显示编码，替换原来的简单幂次提亮。曝光每增加 1 EV，使色调映射前亮度乘以 2。天空、界面、轨迹、局部示踪点、SPH 颗粒和速度着色保持各自显示方式。

新增 `setMaterial`、`material.ocean`、`material.cloudShadows`、`material.reset` 和输入字段 `material.exposure`。界面与 CLI 共用事务，显式 null、错误类型或越界值整体拒绝。`getState.material` 返回目标配置，`rendering.materialExposure/materialOcean/materialCloudShadows` 返回最近成功提交帧所用值。完整规则见 [CLI 指南](../CLI.md#光照与材质)。

## 实验保存

新存档保持场景和配方 schemaVersion 1，外观版本升级为 `appearanceVersion:2`，要求完整的 `material:{exposure,ocean,cloudShadows}`。读取 v1 外观配方时使用 0 EV、海洋反光和云影开启的默认值，不改写原文件；无配方的早期场景仍采用默认观察配置。v2 外观配方需要本版或更新版应用读取。

相同旧配方的光照像素会因本次渲染改进而变化，程序自转相位也不持久化；存档不是逐像素截图或物理中途续算。主题切换保留当前材质选择，载入实验恢复所存材质。

## 验证

| 验证 | 结果与证据 |
| --- | --- |
| 主机事务与存档 | [54 项通过](../evidence/material-0.23.0-host-tests.txt)，包括错误值原子拒绝、共用控件、材质设置不发起镜头／求解请求、v1 兼容与 v2 往返 |
| 渲染像素 | [固定视角对照](../evidence/material-0.23.0-device-tests.json)：−1／0／+1 EV 的球面平均显示亮度递增；选定背景区域差异为 0；海洋反光和云影产生像素差异；关闭云层后无残留云影，速度着色不受曝光影响 |
| 实际操作与窗口 | [展开、折叠竖屏、横屏](../evidence/material-0.23.0-layout-tests.json)：曝光滑块拖动与海洋按钮命中成功；控件边界、沉浸状态、镜头请求和物理时间核对 |
| 冷启动与兼容 | [配方回归](../evidence/recipe-0.23.0-device-tests.json)：材质设置、初始条件及 192 个示踪点恢复；旧配方不改写；损坏材质先拒绝，已有场景保持 |
| 原有操作 | [UI／CLI 回归](../evidence/material-0.23.0-ui-regression.json) 与 [镜头请求回归](../evidence/material-0.23.0-camera-tests.json) |
| 纹理数据 | [原有程序纹理测试](../evidence/material-0.23.0-texture-tests.txt)：确定性、经度接缝、海洋／云遮罩及内存边界 |
| 构建安装 | [ArkTS／C++ 构建](../evidence/material-0.23.0-build.txt) 与 [模拟器安装](../evidence/material-0.23.0-install.txt)，设备仅为 `127.0.0.1:5555` |

像素比较是固定场景的渲染回归，亮度采用显示像素的加权读数，不是恒星光度或物理辐射测量。当前仍在普通显示缓冲区混合透明层，没有 HDR 输出、全场景线性合成、自动曝光或实测真机性能结论。

## 画面对照

- [−1 EV](../../../OpenSPH-0.23.0-material-minus-one.png)、[0 EV](../../../OpenSPH-0.23.0-material-zero.png)、[+1 EV](../../../OpenSPH-0.23.0-material-plus-one.png)：同一视角、暂停、去云，观察海面高光与昼夜明暗。
- [展开窗口](../../../OpenSPH-0.23.0-material-controls-wide.png)、[折叠竖屏](../../../OpenSPH-0.23.0-material-controls-phone.png)、[横屏](../../../OpenSPH-0.23.0-material-controls-landscape.png)：实际拖动到约 +1.2 EV 后的控件状态，已人工查看。
- [恢复原实验](../../../OpenSPH-0.23.0-final.png)：[恢复记录](../evidence/material-0.23.0-restoration.json) 核对原三天体“环影之间”、1 年终态、镜头、外观、主题、窗口及 10 个已有命名实验。本轮开始时撤销历史为空。

## 来源与下一步

沿用 [Celestia 调研](../research/CELESTIA-SOURCE-ADDONS-2026-09-07.md) 中分层材质的方向，独立扩展现有 shader，没有移入同行代码或素材。曝光控件查阅了华为开发者 MCP 的 [Slider 官方文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-slider)，按 Moving／Click／End 接入共用输入路径，随后通过模拟器实际手势验收。

本轮没有新增真实地理地图、法线地形、夜灯或碰撞物理。下一步引入来源明确的小尺寸地理底图与资源清单，并在更大纹理前建立按需加载和内存预算；真实月球形成仍依赖独立物理路线。
