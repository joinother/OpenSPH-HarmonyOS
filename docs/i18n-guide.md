# 汉化实现与词库维护（i18n Guide）

本项目汉化采用**方案 B：正规 i18n**——`wxLocale + wxFileTranslationsLoader + gettext(.po/.mo)`，
对 OpenSPH 源码做 `_()` 字符串包裹，提取词条、翻译、编译为 GNU `.mo` 词库，随 HAP 打包并在
运行时加载。不采用硬编码中文替换。

## 1. 实现分层

```
OpenSPH 源码
  ├─ LauncherGui.cpp   App::OnInit → SetupI18n()：wxLocale 初始化、加载词库
  ├─ MainWindow.cpp    菜单 / 对话框 / 消息框字符串用 _() 包裹
  └─ NodePage.cpp      wxPropertyGrid 属性标签 / 枚举选项统一走 wxGetTranslation
          │
          ▼
tools/i18n/gen_po.py   正则提取全库 _("...") 词条 → OpenSPH.zh_CN.po（410 词条 / 405 翻译）
          │
          ▼
tools/i18n/msgfmt.py   纯 Python .mo 编译器（GNU 二进制格式）→ OpenSPH.mo
          │
          ▼
OpenSPH-DevEco rawfile → 启动时拷入沙箱 → OpenSPH SetupI18n 复制到 wx 查找路径 → AddCatalog
```

## 2. SetupI18n 要点（LauncherGui.cpp）

- 语言默认 `wxLANGUAGE_CHINESE_SIMPLIFIED`，可用 `OSPH_LANG` 环境变量覆盖；
  词库目录默认 `filesDir`，可用 `OSPH_LANG_DIR` 覆盖。
- 轮询等待 ArkTS 把 `.mo` 拷入沙箱（最多 ~3s）。
- **把 `.mo` 复制到 wxFileTranslationsLoader 实际查找的子目录**
  （`<prefix>/zh_CN/LC_MESSAGES`、`<prefix>/zh_CN`、`zh_Hans` 双写），用 POSIX `mkdir`。
- `AddCatalog("OpenSPH")` 后加载完成。
- `setlocale(LC_NUMERIC/LC_TIME, "C")` 强制数值格式不被本地化。

## 3. 词库维护流程

新增/修改 UI 字符串后：

```bash
cd OpenSPH/tools/i18n
# 1) 重新提取词条（扫描 OpenSPH 源码 _("...")，排除 build-ohos 与 test）
python3 gen_po.py
# 2) 在 OpenSPH.zh_CN.po 里补/改翻译
# 3) 编译 .mo
python3 msgfmt.py OpenSPH.zh_CN.po OpenSPH.mo
# 4) 覆盖 DevEco rawfile 并重新打包 HAP
cp OpenSPH.mo OpenSPH-DevEco/entry/src/main/resources/rawfile/OpenSPH.mo
```

## 4. 重要坑（务必遵守，否则词库不生效）

1. **路径**：wxFileTranslationsLoader 只查 `<prefix>/<lang>/LC_MESSAGES/` 与
   `<prefix>/<lang>/`，不查 prefix 根目录。`.mo` 必须进入语言子目录。
2. **.mo 二进制**：header 必须 **28 字节（7 个 uint32：magic, version, N, ofsOrig,
   ofsTrans, ofsHash, hashSize）**；每个字符串 **NUL 结尾**；无 hash 表可（ofsHash/hashSize=0）。
   否则 `AddCatalog` 虽返回成功但翻译不命中。
3. **编码**：`.mo` 内字符串为 UTF-8，header 词条含
   `Content-Type: text/plain; charset=UTF-8` 与 `Plural-Forms:`。
4. **加载时机**：ArkTS 异步拷入沙箱，OpenSPH 需轮询等待文件出现再 AddCatalog。

## 5. 覆盖范围

- 菜单栏 / 对话框 / 消息框：`MainWindow.cpp` 等，`_()` 包裹。
- 属性面板：`NodePage.cpp` 的 PropertyGrid wrapper 对属性标签与枚举选项翻译。
- **不翻译**：数值、内部场景节点分类标识（右侧树 rendering/geometry/materials 等）、
  专有名词（Tillotson、ANEOS、Von Mises、Rock 等物理术语）、构建信息标题栏。
