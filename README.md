# OpenSPH-HarmonyOS

把开源 [OpenSPH](https://github.com/pavelsevecek/OpenSPH)（光滑粒子流体动力学 / SPH 物理仿真软件）以**保留原生 wxWidgets UI** 的方式移植到鸿蒙 PC（HarmonyOS NEXT）的完整工程。

本项目是**适配层 + 壳工程 + 汉化**，不 fork 上游源码。OpenSPH 与 wxWidgets 的改动以 patch 形式提供，可精确复现。

## 特性

- **原生 UI 完整保留**：OpenSPH 的原生 wxWidgets 界面（菜单栏 / 属性面板 / 节点画布 / 资源树）在鸿蒙 PC 上原样运行，不重写 UI。
- **汉化（方案 B：正规 i18n）**：基于 `wxLocale + gettext (.po/.mo)` 的标准国际化方案，全库 410 个词条、405 条中文翻译，支持菜单、对话框、属性面板、枚举选项。
- **移植期间修复的 UI 缺陷**：属性面板值列空白、右键菜单闪退、左侧栏偏移与残缺、顶部状态栏黑底等。
- **跨平台架构不变**：底层仍为 C++/wxWidgets，Qt-OH 插件负责在鸿蒙侧提供 Qt 平台后端。

## 架构总览

```
OpenSPH（C++ 计算 + wxWidgets UI，交叉编译为 libopensph.so）
   │  由 Qt-OH 插件 openLibraryWithMainFunctionOrFail 直接 dlopen 并调用 main()
   ▼
wxWidgets 3.3（Qt port）＋ Qt6（鸿蒙 Qt-OH 平台插件）
   │  原生 wx UI 事件循环跑在鸿蒙 UI 线程上
   ▼
OpenSPH-DevEco（ArkTS 壳工程，QAbility）
   │  提供 WindowStage / 文件沙箱 / rawfile 资源（.mo 词库）
   ▼
HarmonyOS NEXT PC（模拟器 / 真机）
```

关键点：OpenSPH 实际由 **QAbility 的 Qt-OH 插件直接 dlopen 加载 `libopensph.so` 调 `main()`**，不经 ArkTS 的 NAPI 桥（`opensoh_bridge` 仅作占位）。因此沙箱路径、环境变量、rawfile 拷贝等都要按这条链路设计。

## 仓库结构

```
OpenSPH-DevEco/          DevEco Studio 壳工程（ArkTS + native 桥，含 rawfile 词库）
patches/
  opensph-harmonyos.patch    OpenSPH 鸿蒙适配 + i18n 改动（apply 到上游）
  wxwidgets-harmonyos.patch  wxWidgets 鸿蒙适配改动（apply 到上游）
  sse2neon.h                 OpenSPH 需要的 x86 SSE → ARM NEON 头（上游缺失依赖）
tools/i18n/                 汉化工具链（词条提取 / .mo 编译 / 词库）
docs/
  harmonyos-port-notes.md   移植记录与踩坑
  build-deploy-guide.md     交叉编译 → HAP → 签名 → 部署全流程
  i18n-guide.md             汉化实现与词库维护
```

## 快速开始

前置：DevEco Studio（含 OpenHarmony SDK）、鸿蒙 PC 模拟器或真机（hdc 连接）。

1. 准备上游源码并应用 patch：

   ```bash
   git clone https://github.com/pavelsevecek/OpenSPH
   git clone https://github.com/wxWidgets/wxWidgets
   git apply patches/opensph-harmonyos.patch        # 在 OpenSPH 目录
   git apply patches/wxwidgets-harmonyos.patch      # 在 wxWidgets 目录
   cp patches/sse2neon.h OpenSPH/core/common/
   ```

2. 交叉编译 OpenSPH（见 `docs/build-deploy-guide.md`），产物拷贝为
   `OpenSPH-DevEco/entry/libs/arm64-v8a/libopensph.so`。

3. 用 DevEco Studio 打开 `OpenSPH-DevEco/`，构建签名后安装：

   ```bash
   hvigorw assembleHap --mode module -p product=default --no-daemon
   hdc install -r entry/build/default/outputs/default/entry-default-signed.hap
   hdc shell aa start -a QAbility -b com.opensph.app
   ```

4. 界面默认中文（汉化词库随 HAP 打包，运行时拷入沙箱自动加载）。

## 汉化

- 方案：`wxLocale + wxFileTranslationsLoader + .po/.mo`（GNU gettext 标准格式）。
- 全库提取 410 词条，中文翻译 405 条，覆盖菜单 / 对话框 / 属性面板 / 枚举。
- 词库 `.mo` 随 HAP 的 rawfile 打包，启动时由 ArkTS 拷入沙箱、OpenSPH 内 POSIX 复制到
  `<prefix>/zh_CN/LC_MESSAGES/` 等 wx 查找路径后自动加载。
- 维护方法见 `docs/i18n-guide.md`。

## 许可

- OpenSPH：上游采用 **MIT** 许可。
- wxWidgets：上游采用 **wxWindows Library Licence**。
- sse2neon.h：第三方头文件，遵循其自身许可（MIT）。
- 本仓库的适配改动、壳工程、汉化词库与文档：MIT。
