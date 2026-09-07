# 月面素材与加载

> 类型：资源参考；适用版本：0.24.0；调研与验证日期：2026-09-07（Asia/Shanghai）。

## 来源

采用 [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) 的 2025 版颜色图，署名 **NASA's Scientific Visualization Studio**。这是一幅用于视觉表现的月面颜色地图，不作为科学测量数据。SVS 的[使用说明](https://svs.gsfc.nasa.gov/help/)允许使用和再分发未另行注明限制的内容；本资源页未注明额外限制。另见 [NASA 媒体使用说明](https://www.nasa.gov/nasa-brand-center/images-and-media/)。应用不使用 NASA 标识，也不表示 NASA 认可本应用。

| 项目 | 值 |
| --- | --- |
| 原始下载 | [lroc_color_2k.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg) |
| 尺寸／字节 | 2048×1024；457942 字节 |
| SHA-256 | `f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170` |
| 投影 | 等距经纬度，中央经度 0，北在上 |
| 资源清单 | [moon-assets.json](../../entry/src/main/resources/rawfile/moon-assets.json) |
| 随包署名 | [NASA-MOON-NOTICE.txt](../../entry/src/main/resources/rawfile/NASA-MOON-NOTICE.txt) |

JPEG 原字节随 HAP 打包，不重新编码。运行时通过 ImageKit 解码为 RGBA8888；shader 将北向纬度和东向经度转换到现有球面坐标约定，避免上下颠倒或镜像；颜色按 sRGB 输入现有线性光照路径。颜色图没有提供球面凹凸，照片中的坑纹不能当作本应用算出的几何地形。

## 按需加载与预算

首次场景中出现 `surface:5` 时才请求三维月面纹理，异步解码期间使用灰色球体；成功上传后约 250 ms 淡入。多个请求共用同一个 Promise，ImageKit 临时对象在交接后释放；原生层先严格验证尺寸和字节数，再复制并发布不可变数据。地图从包内读取，运行时无需联网。实验库封面也使用这张 JPEG，由 ArkUI 自行管理其图片缓存。

原生 RGBA 常驻数据为 8388608 字节（8 MiB），完整 RGBA mip 链估算为 11184812 字节（约 10.67 MiB）。这些是单张地图的容量预算，不是进程内存或峰值实测，未包含解码器、传输缓冲、封面、现有程序纹理和驱动开销。

当前是一个有尺寸上限的按需资源：进程内保留 CPU 数据与当前 EGL 上下文的纹理，近看／全景切换不会重复上传。上下文重建时可从保留数据再上传，进程重启后重新解码。尚无瓦片、多级细节选择、缓存淘汰或设备画质档位。

解码或上传失败保留灰色月面，错误通过 `getSurfaceInfo` 和观察面板显示，可显式重试，不逐帧重复尝试。失败重试与解码清理经主机测试；本轮未注入真实设备 GPU 内存耗尽。

## 使用边界

月面不使用云、空气光晕、海洋反光或环带；曝光仍可调。`月海与高地` 是贴图观察主题，保留一颗地球质量、1 AU 轨道的教学天体，绝非真实地月系统。程序自转、模拟日照和相位不对应真实观测日期；没有高度图、真实月球半径、潮汐锁定、撞击新坑或月球形成模型。

没有引入 Celestia、Universe Sandbox、SpaceSim 或 SpaceEngine 的代码与素材。本次按[既有调研方向](../research/CELESTIA-SOURCE-ADDONS-2026-09-07.md)独立扩展材质。完整验收见 [0.24.0 记录](../releases/RELEASE-0.24.0.md)。
