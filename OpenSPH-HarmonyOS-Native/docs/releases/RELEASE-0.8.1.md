# 0.8.1 · ArkUI 与 CLI 共用动作

> 类型：版本记录（仅描述该版本）；适用范围：0.8.1。
> 整理日期：2026-09-06（Asia/Shanghai）。

原始发布日期未单独记录；文内明确写出的验证日期保留原义。当前操作以 [CLI 指南](../CLI.md) 为准。

参照本地 Stellarium 的 `scripts/stellarium-cli.mjs`、`docs/harmonyos/CLI.md` 与 `MainWindowNativeNode.ets` 中的 ArkUI Want 命令处理，补齐此前仅能通过页面操作的编辑草稿和按钮动作。没有更改物理内核或复制 Stellarium 的业务代码。

## 新增接口

- `getUiState` / `listUiActions`：返回稳定动作 ID、标签、enabled、selected，输入字段及其当前值和可用性，以及完整编辑草稿。
- `uiAction {action}`：调用与真实按钮相同的 `performUiAction`。目录覆盖预设、增删／应用天体、近看与前后切换、面板、专注、回放播放、相机、外观、保存／载入等动作。
- `setUiValue {field,value}`：与 ArkUI TextInput／Slider 共用输入处理。天体名称和七个初始数值以字符串保留草稿，只有 `orbit.apply` 才重建物理系统；非法应用返回错误并保留已有系统。
- `getState.editor`：可以同时比较草稿和 `definition.config` 中已应用的初始条件。
- `--payload-file`：从 JSON 文件读取请求体。
- `--batch`：顺序调用最多 100 条命令；发出第一条前验证所有请求结构。运行时失败即停止，已成功步骤不会回滚。
- `--wait-state` / 批次 `waitForState`：等待求解进入 paused、completed 等状态。等待物理状态不意味着镜头动画或 GPU 纹理已完成，视觉验收仍需查询 rendering 和观察画面。

动作目录表示当前模型下语义上可用的操作，不要求对应控件已经滚动到屏幕内。不存在或 disabled 的动作返回错误；旧的 setScene、setCamera、setPanel 等命令继续兼容。按钮动作可为切换语义，如 replay.toggle；需要幂等设置时使用已有状态设置命令。

### 天体编辑示例

在工程根目录执行：

```bash
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getUiState
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --batch examples/ui-edit-batch.json
```

批次会选择自定义系统、添加行星、命名、将质量设为两倍地球、选择荒漠表面、应用，再进入近看。

字段 `orbit.value.0` 为质量（恒星用太阳质量，行星用地球质量），1–3 是 X/Y/Z（AU），4–6 是 Vx/Vy/Vz（km/s）。其他字段包括 scene.title/count/speed/angle/duration、body.name/radius/density/spin 和 time.frame；可用性随所选模型／天体变化，范围沿用 0.8.0。

## 验证

- 15 项宿主测试全部通过；新增语义动作、草稿与已应用配置分离、错误传播、禁用动作、输入边界和按钮绑定覆盖检查。
- 当前 49 处 ArkUI 按钮回调全部走 `press → performUiAction`，全部输入变更回调走 `input → setUiValue`；动态天体与项目按钮通过稳定前缀和索引／ID 生成动作。
- `scripts/test-ui-cli-emulator.mjs` 在 127.0.0.1:5555 通过，不使用坐标导航或模拟键入。覆盖草稿读写、增删／应用、近看循环、专注、面板返回、云层、回放、批处理失败停止、文件输入和求解状态等待。
- ArkTS 严格编译、HAP 打包和模拟器安装通过。结果见 ui-cli-host-tests.txt、ui-cli-device-tests.json、ui-cli-build-result.txt。

本轮未修改布局、纹理或物理求解，也不把 CLI 验收等同于触摸命中、键盘避让和动画流畅度测试。开发流程已写入项目 AGENTS.md：普通交互先用 CLI；触摸只用于明确的触摸／焦点验收，截图用于视觉检查。
