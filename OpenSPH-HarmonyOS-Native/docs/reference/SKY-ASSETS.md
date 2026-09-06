# 银河背景素材来源

> 类型：当前素材记录；适用版本：0.13.0；核验日期：2026-09-06（Asia/Shanghai）。

银河模式采用 [ESO 的 The Milky Way panorama（eso0932a）](https://www.eso.org/public/images/eso0932a/)，完整署名为 **ESO/S. Brunier**。官网记录的原始发布日期为 2009-09-14。本项目使用公开的 4000×2000 publication JPEG，未使用官网提及的另行申请的 8 亿像素原件。

依据 [ESO 使用说明](https://www.eso.org/public/outreach/copyright/)，这份公开素材按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。界面显示完整署名，许可证与出处随包保存；不表示 ESO 对应用背书。

## 文件与处理

- 原始 JPEG：[eso0932a.jpg](../../entry/src/main/resources/rawfile/eso0932a.jpg)，随应用离线打包，不依赖运行时联网。
- 下载地址：[publication JPEG](https://cdn.eso.org/images/publicationjpg/eso0932a.jpg)。
- SHA-256：`5363732a1629eed9df2f707b31eaae6b117c0ee35d7cc8d6ddd636bc6512302d`。
- 应用内通知：[THIRD_PARTY_NOTICES.txt](../../entry/src/main/resources/rawfile/THIRD_PARTY_NOTICES.txt)。
- 原文件字节未修改。ImageKit 在运行时解码为 2048×1024 RGBA；GLES 进行球面映射、模拟方向旋转、曝光处理与 mipmap 采样。

RGBA 缓冲为 8 MiB，原生保留独立副本供 EGL 重建使用；GPU 含 mipmap 约 10.7 MiB。解码期间另有临时内存，这些大小不是实测应用峰值或真机性能结论。

## 表现与边界

摄影保留银心、暗尘埃带和密集星野结构；银河模式淡出随机星点，避免与照片重复叠加。纯净／星空／银河模式与近看自动变暗继续可用。默认亮度不是科学光度标定，也不宣称等同肉眼夜视。

全景以模拟坐标选定方向，未做 ICRS 或观测时间地点校准；它不能支持点击查星、星座定位或银河动力学。照片是历史多次拍摄的拼接，可能包含拍摄时的太阳系亮点，不应把背景亮点当作当前实验里的天体。局部相机跟踪、平移和近看缩放不改变远景；旋转才改变观看方向。

## 实现参考

图片解码使用本机 HarmonyOS SDK 的 ImageKit 声明：createImageSource、createPixelMap 的 desiredSize／RGBA_8888、readPixelsToBuffer 与 release。华为知识 MCP 本轮查询返回参数错误，未将其计作成功核验；实际接口以 SDK 声明和 ArkTS 编译结果为依据。
