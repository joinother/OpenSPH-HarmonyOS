# 构建与部署指南（Build & Deploy Guide）

本文档给出在 macOS 上交叉编译 OpenSPH、打包 HAP、签名、部署到鸿蒙模拟器/真机的完整流程。

## 0. 前置

- DevEco Studio（含 OpenHarmony SDK，记为 `$SDK`，通常位于
  `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony`）。
- hdc 工具：`$SDK/toolchains/hdc`。
- 已启动鸿蒙模拟器（hdc 目标 `127.0.0.1:5555`）或已连接真机。
- 已按 README 应用 OpenSPH / wxWidgets 两个 patch。

## 1. 交叉编译 OpenSPH

```bash
cd OpenSPH
export PATH="$SDK/native/llvm/bin:$PATH"
# 首次：cmake -B build-ohos -DCMAKE_TOOLCHAIN_FILE=... （交叉工具链指向 aarch64-unknown-linux-ohos）
cmake --build build-ohos -j4 --target opensph
cp build-ohos/gui/launcherGui/opensph OpenSPH-DevEco/entry/libs/arm64-v8a/libopensph.so
```

> 说明：产物 `opensph`（ELF）重命名为 `libopensph.so` 后由 Qt-OH 插件 dlopen。

## 2. 交叉编译 wxWidgets（如已提供预编译 .so 可跳过）

wxWidgets 使用 Qt port + OHOS 平台配置交叉编译，产出 `libwx_qtu_*.so` 系列，放入
`OpenSPH-DevEco/entry/libs/arm64-v8a/`（或 `entry/src/main/cpp/libs/arm64-v8a/`）。
本仓库未包含预编译库，请在本地按 wxWidgets 官方 OHOS/Qt port 指引构建。

## 3. 打包 HAP

```bash
cd OpenSPH-DevEco
export NODE_HOME="/Applications/DevEco-Studio.app/Contents/tools/node"
export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"
export PATH="/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin:$PATH"
hvigorw assembleHap --mode module -p product=default --no-daemon
# 产物：entry/build/default/outputs/default/entry-default-unsigned.hap
```

## 4. 签名

需要先在 DevEco Studio 里生成/配置签名材料（keystore、profile、证书链）。命令行签名示例：

```bash
java -jar "$SDK/toolchains/lib/hap-sign-tool.jar" sign-app \
  -keyAlias "<alias>" -signAlg SHA256withECDSA -mode localSign \
  -appCertFile <chain.cer> -profileFile <app-profile.p7b> \
  -inFile entry-default-unsigned.hap \
  -keystoreFile <OpenHarmony.p12> \
  -outFile entry-default-signed.hap \
  -keyPwd <pwd> -keystorePwd <pwd>
```

> 本仓库不包含任何签名私钥/证书，请在本地自行生成。

## 5. 安装与启动

```bash
hdc -t 127.0.0.1:5555 install -r entry-default-signed.hap
hdc -t 127.0.0.1:5555 shell aa force-stop com.opensph.app
hdc -t 127.0.0.1:5555 shell aa start -a QAbility -b com.opensph.app
```

## 6. 日志与截图

```bash
# 日志（OpenSPH native：tag=OpenSPH；QAbility：tag=opensphQt）
hdc -t 127.0.0.1:5555 shell "hilog -x | grep -iE 'OpenSPH|i18n:|opensphQt'"
# 清空日志
hdc -t 127.0.0.1:5555 shell "hilog -r"
# 截图
hdc -t 127.0.0.1:5555 shell "snapshot_display -f /data/local/tmp/shot.jpeg"
hdc -t 127.0.0.1:5555 file recv /data/local/tmp/shot.jpeg ./shot.png
```

## 7. 常见问题

- **菜单/界面仍英文**：确认 `.mo` 是否随 HAP 打入 rawfile，并已拷入沙箱
  `filesDir/OpenSPH.mo`；OpenSPH 启动日志应出现 `i18n: AddCatalog=1` 且
  `probe '&Project' -> '项目(&P)'`。
- **数字显示异常（如 `2,67e+10`）**：检查 `LC_NUMERIC` 是否被本地化；OpenSPH 内已强制
  `setlocale(LC_NUMERIC, "C")`，勿再改动。
- **签名报 “verify certificate chain failed”**：换用正确的证书链文件（本机有效的为
  `OpenHarmonyTemplateChain.cer` 一条链），勿用 AppChain/FullChain。
