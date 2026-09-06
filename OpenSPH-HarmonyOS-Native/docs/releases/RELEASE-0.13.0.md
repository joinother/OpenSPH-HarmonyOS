# 0.13.0 · 摄影银河背景

> 类型：版本记录；适用版本：0.13.0；实现与验收日期：2026-09-06（Asia/Shanghai）。

旧银河由近似等宽的程序噪声带生成，缺少银心和不规则暗尘埃结构。银河模式现采用 ESO/S. Brunier 摄影全景，保留银心、尘埃带与密集星野，控制曝光以适合观察前景行星；照片中的星点不再与整层随机星点重叠。来源、许可与处理见 [素材记录](../reference/SKY-ASSETS.md)。

## 行为

- 图片随 HAP 离线打包；ImageKit 异步解码，主场景继续使用已有视口。GPU 上传后约 0.5 秒淡入。
- 仍可切换纯净、程序星空和摄影银河，调节亮度；近看时自动降低背景强度。
- 旋转改变观看方向；跟踪、局部缩放和编辑不会重新定位银河或重建实验。
- 署名在普通、面板和专注模式下可见；加载失败保留程序背景，CLI 报告错误。
- 原生层验证固定尺寸和 RGBA 长度，复制后由渲染线程上传；保留副本供 EGL 重建，替换和释放 GPU 纹理时回收旧资源。

## CLI 与验收

`getSkyInfo` 增加摄影来源、许可、加载错误、实际纹理尺寸与程序星点使用信息。渲染状态增加 panoramaReady 和 panoramaBlend；原有 skyReady 不等于摄影已显示。用法见 [当前 CLI 指南](../CLI.md)。

- [主机语义 CLI 测试](../evidence/galaxy-photo-host-tests.txt)：21 项通过，含摄影／回退来源和模式规则。
- [原生缓冲验证](../evidence/galaxy-photo-buffer-test.txt)：ASAN／UBSAN 检查复制所有权与非法尺寸、空指针、截断、超长缓冲拒绝。
- [构建日志](../evidence/galaxy-photo-build.txt) 与 [模拟器安装](../evidence/galaxy-photo-install.txt)。
- [手机天空回归](../evidence/galaxy-photo-phone-tests.json) 与 [宽窗口天空回归](../evidence/galaxy-photo-wide-tests.json)：模式差异、零亮度、旋转、整周一致、局部跟踪／缩放稳定、近看变暗和后台恢复。

最终安装包另做手机／宽窗口、专注与近看截图检查：[手机](../../../OpenSPH-0.13.0-galaxy-phone.png)、[宽窗口](../../../OpenSPH-0.13.0-galaxy-wide.png)、[专注](../../../OpenSPH-0.13.0-galaxy-focus.png)、[近看](../../../OpenSPH-0.13.0-galaxy-near.png)。[最终状态](../evidence/galaxy-photo-final-state.json) 保留原五天体初始配置，计算到 3 年，恢复全景。

摄影背景仍是按模拟方向放置的全景，不是已校准的星表或银河物理模型；本版没有新增行星碰撞物理或真机性能结论。
