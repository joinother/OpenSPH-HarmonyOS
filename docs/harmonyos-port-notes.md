# 移植记录（HarmonyOS Port Notes）

本文件记录把 OpenSPH 移植到鸿蒙 PC 的过程、架构决策与踩坑，供复现与后续维护参考。

## 1. 总体策略

- **不重写 UI**：OpenSPH 原生 wxWidgets UI 全量保留，只做编译适配与平台胶水。
- **wxWidgets 用 Qt port**：鸿蒙 Qt-OH 提供 Qt 平台后端，wxWidgets 的 `wxQT` 端口把 wx 事件循环
  接到 Qt 上，从而在鸿蒙 UI 线程跑原生 wx 界面。
- **Qt-OH 插件直载**：OpenSPH 的 `main()` 由 QAbility 内的 Qt-OH 插件
  `openLibraryWithMainFunctionOrFail` **dlopen `libopensph.so` 后直接调用**，而不是走
  ArkTS → NAPI → C++ 的常规桥（`opensoh_bridge` 仅占位）。这一点决定了后续所有沙箱 /
  环境变量 / 资源加载设计。

## 2. 交叉编译环境

- OpenSPH 用 CMake，目标三元组 `aarch64-unknown-linux-ohos`，工具链用 DevEco SDK 自带
  clang（`<SDK>/native/llvm/bin`）。
- wxWidgets 同样交叉编译（Qt port + OHOS 平台），产出 `libwx_qtu_*.so`。
- OpenSPH 的 x86 SSE 内联汇编在 ARM 上不可用，需引入 `sse2neon.h`（见 patches/）并调整
  `Vector.h` 等处的指令路径。

## 3. 运行链路与沙箱

```
aa start QAbility
  └─ Qt-OH 插件 openLibraryWithMainFunctionOrFail → dlopen libopensph.so → main()
       └─ wxApp::OnInit → SetupI18n()（加载 .mo 词库）
       └─ 原生 wx 事件循环
```

- OpenSPH 实际加载路径：`/data/storage/el1/bundle/libs/arm64/libopensph.so`。
- 沙箱可写区（ArkTS `context.filesDir`）：`/data/storage/el2/base/haps/entry/files`。
- **教训**：`opensoh_bridge.cpp` / `EntryAbility` 里做 `setenv`、初始化对实际加载链路**无效**，
  因为 OpenSPH 不经过它们。环境变量 / 文件部署必须放到 QAbility（ArkTS）或 OpenSPH 自身
  C++ 内完成。

## 4. 移植期间修复的 UI 缺陷

| 问题 | 根因 | 修复 |
|---|---|---|
| 属性面板值列空白 | wxPropertyGrid 在鸿蒙 Qt 后端下渲染/布局差异 | `propgrid.cpp` 适配（值列宽度/绘制） |
| 右键菜单弹出即闪退 | 右键事件在 Qt 后端时序/焦点问题 | `window.cpp` 右键事件处理适配 |
| 左侧栏显示偏移、残缺、出现异常数字 | `scrlwing.cpp`（可滚动窗口）坐标与绘制适配 | 滚动窗口绘制 / 布局修正 |
| 顶部状态栏黑底 | 背景绘制在 Qt 后端的默认黑色 | `window.cpp` 背景填充适配 |

## 5. 汉化（方案 B：正规 i18n）

采用 `wxLocale + wxFileTranslationsLoader + gettext(.po/.mo)`，而非硬编码替换。详见
`i18n-guide.md`。

关键调试结论（这些坑导致词库一度不生效）：

1. `wxFileTranslationsLoader` **只搜索** `<prefix>/<lang>/LC_MESSAGES/` 和 `<prefix>/<lang>/`，
   **不搜索 prefix 根目录**——把 `.mo` 放根目录永远加载不到。
2. 纯 Python 写 `.mo` 时，**header 必须 28 字节（7 个 uint32）**，且**字符串必须 NUL 结尾**；
   否则 wxWidgets `wxMsgCatalogFile` 解析出的字符串表错位，AddCatalog 虽成功但翻译不命中。
3. ArkTS 的 `fs.mkdirSync` 在沙箱内创建 `zh_CN/LC_MESSAGES` 子目录不稳定，改由 OpenSPH
   C++ 用 POSIX `mkdir` 在启动时把 `.mo` 复制到 wx 查找路径（同一进程内权限充足）。
4. `wxLocale::Init(wxLANGUAGE_CHINESE_SIMPLIFIED)` 成功后 canonical 为 `zh_CN`，子目录按
   `zh_CN` / `zh_Hans` 双写可兼容。
5. 必须把 `LC_NUMERIC` / `LC_TIME` 强制设回 `"C"`，否则 `%g` 科学计数法输出会被本地化
   （仿真数值如 `2.67e+10` 依赖此格式）。

## 6. 已知边界

- 右侧资源树（rendering / geometry / materials 等）为内部场景节点分类标识，未纳入汉化，
  与数值/内部命名一致保持英文。
- 构建信息标题栏（`OpenSPH - build: ...`）保持英文。
