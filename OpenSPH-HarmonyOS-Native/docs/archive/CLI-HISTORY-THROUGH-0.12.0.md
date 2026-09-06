# CLI 历史说明汇编（截至 0.12.0）

> 类型：历史归档（不作为当前操作指南）；适用范围：0.2.0–0.12.0。
> 整理日期：2026-09-06（Asia/Shanghai）。

本文保留当时的判断、限制和操作记录，可能已被后续版本替代。请先阅读[当前文档目录](../README.md)。

## 0.7.0 外观与渲染诊断

0.8.1 新增完整 ArkUI 动作与草稿接口，见 [统一 CLI 用法](../releases/RELEASE-0.8.1.md)。推荐先调用 `getUiState` 查看动作 ID 和字段，再使用 `uiAction` / `setUiValue`；可直接运行 `--batch examples/ui-edit-batch.json`。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setAppearance --payload-json '{"closeup":true,"autoSpin":false,"clouds":true,"atmosphere":true,"trails":true}'
```

先载入 preset 3、4 或 5。五个字段均可省略，传入字段必须为 boolean；全部验证后才修改状态。`closeup=true` 且尚未跟踪对象时自动选择第一颗行星。`setCamera.focus` 可切换近看对象；focus −1 退出近看并停止演示。SPH 模式拒绝开启近看。

`autoSpin` 仅在近看与前台同时有效；它是独立外观演示，不推进物理时间。`setAppearance` 不重新启动求解器，不改质量／位置／速度。显示参数不写入实验或回放文件。

`getState.appearance` 返回当前显示选项。`getState.rendering` 返回 `ready/texturesReady/active/frames/submitMs/previewSeconds/error`。首次进入轨道后等待 texturesReady=true；绘制故障在 error 中明确报告。submitMs 是 CPU 提交耗时，不是 GPU 计时或 FPS。CLI 通过启动应用发送命令，因此查询 getState 会将应用带到前台。

新增脚本：`node scripts/test-material-emulator.mjs 127.0.0.1:5555`（需 ffmpeg，用真实像素验证材质；只操作指定模拟器和本应用）、`node scripts/test-material-ui-emulator.mjs 127.0.0.1:5555`（实际按钮／手势）。

## 0.6.0 新增轨道用法

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setScene --payload-json '{"preset":4,"count":600,"speed":1,"angle":0,"duration":3}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command start
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getState
```

`setScene` 后轮询 `getState`，等待 `simulation.state` 为 `paused` 再开始。preset 3 为双体，4 为恒星与三个行星；0–2 的 SPH 参数和单位保持不变。

轨道模式的 `speed` 为初始圆轨道速度倍率（0.75–1.25），`duration` 为儒略年（1–10）。为兼容现有配置形状，`count`、`angle`、岩质半径／密度／自转与 seed 字段仍通过原来的范围校验并保存，但不参与轨道求解；UI 隐藏这些字段。暂不接受任意天体列表：`definition.model` 为 `nbody-v1`，`definition.bodies` 为 `[]`，实际对象来自原生预设。

`simulation` 新增 `model`、`timeUnit`、`energyError`、`angularError` 和 `bodies`。轨道的 bodies 含 `id/name/xAU/yAU/zAU/speedKmS/massSolar`；这是当前选中帧的展示快照，不是可恢复求解器的状态。SPH 的 bodies 为空。`timeUnit` 明确为 `year` 或 `s`；不要把轨道 time 当秒。

`setCamera.focus` 在 preset 4 支持 −1/0/1/2/3，分别为全景／恒星／蓝／金／红行星；preset 3 支持 −1/0/1；轨道 `color` 仅支持 0（原色）和 1（速度），拒绝不适用的密度模式。观察面板能跟踪所有预设对象。保存／载入实验及回放命令通用；轨道采用 v3 格式，恢复轨迹和诊断量。近距离停止返回 state=`failed` 与中文 error，最后有效快照仍可回看。

新增验证：`node scripts/test-orbit-emulator.mjs 127.0.0.1:5555`、`node scripts/test-orbit-ui-emulator.mjs 127.0.0.1:5555`。前者会另存一个命名验证实验并更新单槽回放。

以下保留既有 CLI 协议和历史版本说明；与新增轨道参数冲突时以上述 0.6.0 说明为准。

## 星体实验室 CLI 与鸿蒙界面适配（0.5.0）

CLI 已编入 HAP，宿主端通过 HDC → `aa start` → `Want` → ArkTS 页面动作 → HiLog JSON 响应工作。应用不启动 HTTP 服务，也不申请 INTERNET 权限。必须显式指定设备，避免多设备环境下误操作其他任务正在测试的平板。

### 快速使用

在项目目录运行（Node.js 18+；可使用 DevEco 自带 Node）：

```bash
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --list
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getState --json
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setScene --payload-json '{"preset":0,"count":200,"speed":5,"angle":0,"duration":10}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command start
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command pause
```

`setScene` 返回时粒子可能仍在生成；轮询 `getState` 到 `paused` 后再 `start`。命令返回的 `ok:true` 表示操作已接受/执行，科学计算是否完成以 `simulation.state` 为准。`getState` 通过启动/激活 Ability 查询，会把应用带到前台，不能用于无干扰地观察后台暂停行为。

| 命令 | JSON 参数 | 结果/行为 |
| --- | --- | --- |
| listCommands | `{}` | 设备上的命令目录 |
| getState | `{}` | 实时求解状态、输入参数、相机、界面与窗口数据 |
| setScene | preset/count/speed/angle/duration 必填，另见下方可选字段 | 验证完整配置后重新生成，初始暂停；省略可选字段时保留当前值 |
| start | `{}` | 继续暂停场景；完成/修改参数后重新运行；运行中重复调用不暂停 |
| pause | `{}` | 暂停求解和回放播放 |
| reset | `{}` | 按当前参数重新生成并暂停 |
| seek | `{"frame":0}` | 选择保留帧并暂停求解；`-1` 回到最新帧，不自动恢复求解 |
| setCamera | yaw/pitch/zoom/focus/color，全部必填 | 更新与手势共用的相机状态 |
| setPanel | `{"panel":1}` | 0 参数、1 观察、2 实验库；-1 收起。打开时恢复工具栏；返回 accepted，动画完成后再查询状态 |
| saveReplay | `{}` | 等待本机回放文件保存完成；失败返回错误 |
| loadReplay | `{}` | 等待回放载入；结果为只读历史，不能当求解检查点 |
| listProjects | `{}` | 返回 id、title、savedAt 列表 |
| saveProject | `{"title":"我的碰撞实验"}` | 每次另存新实验并返回 id，最多 50 个 |
| loadProject | `{"id":"返回的项目 ID"}` | 验证后恢复实验初始条件并重新生成暂停场景 |

单位：speed 为 km/s；旋转预设采用 `speed × 0.003 rad/s`，与 targetSpin 叠加。angle 为度，实际偏移为 `0.5625 × (targetRadiusKm + impactorRadiusKm) × sin(angle)` km。duration 为模拟秒。相机 yaw/pitch 为弧度；focus 为 -1 全景、0 主天体、1 撞击体；color 为 0 原色、1 速度、2 密度。旋转预设中不存在撞击体，推荐 focus=-1 或 0。

`setScene` 可选字段：targetRadiusKm 40–200、impactorRadiusKm 20–120；targetDensity、impactorDensity 均为 2400–3000 kg/m³；targetSpin 为 -0.01 至 0.01 rad/s；seed 为 1–1000000 的整数。初始密度仅用于当前岩质模型，尚未做静力平衡。`getState.definition` 包含名称及版本化对象定义，`simulation.config` 是实际原生配置，`simulation.totalMass` 是所选帧粒子的总质量（kg）。旧版回放没有可恢复的配置，不返回 config。

```bash
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setScene --payload-json '{"preset":0,"count":200,"speed":3,"angle":20,"duration":1,"targetRadiusKm":80,"impactorRadiusKm":40,"targetDensity":2600,"impactorDensity":2800,"targetSpin":0.002,"seed":4321}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command saveProject --payload-json '{"title":"小天体碰撞"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command listProjects --json
```

`scene` 是当前界面输入参数；`dirty:true` 时尚未应用到运行中的求解。`simulation` 直接来自原生引擎。`window.widthVp/heightVp` 是根组件测量值，首次布局前为 0；`window.safePx` 是系统返回的物理像素，页面通过当前 UIContext 转换为 vp。它们用于诊断，不能替代截图验收。`window.immersive` 表示窗口全屏布局调用成功，不代表鸿蒙 PC 标题栏已隐藏。

0.4.0 新增 `ui.panelOpen` 和 `ui.toolsVisible`；`ui.panel` 保留最后选中的 0/1/2 标签，不能单独用它判断菜单是否显示。`window.viewportWidthVp/viewportHeightVp` 是常驻渲染视口的测量尺寸，菜单覆盖在其上。专注模式通过界面进入，`setPanel` 打开任意面板可恢复工具栏。相机 zoom 改为相对视口短边的半视野，窗口变窄不会改变 CLI 数值，也不会使默认实验横向裁切；相同参数在窄屏上的画面与 0.3.0 会有所不同。

0.5.0 中 `setCamera` 仍立即应用并取消未完成的 UI 镜头动画。面板逻辑状态会先变更，退出动画仍可短暂显示其残影，结束前已禁用该浮层的操作；截图验收应等待转场稳定，设备脚本使用 600 ms 等待。面板切换保留过期回调隔离。侧栏改为 308 vp，窄屏面板左右各留 12 vp；时间胶囊最大宽度 420 vp，工具层不再有贯穿全宽的背景。

退出码：0 成功；2 应用返回明确错误；1 参数、连接、协议或超时错误。脚本使用 `process.exitCode`，避免大 JSON 在 stdout 写完前退出。每次请求采用 UUID，按索引聚合分块，忽略其他请求日志；不清空设备日志。请求队列最大 16，保留最近 128 个请求 ID 防重复执行。CLI 目前没有批处理、交互 REPL、脚本执行或任意文件读写命令。

### 从 Stellarium 工程采用的经验

参考了本机 `stellarium-src/docs/harmonyos/CLI.md`、`DEVELOPMENT-MCP-WORKFLOW.md`、`APP-UX-AND-CLI-AUDIT-2026-08-30.md`，并阅读其 CLI 和 Ability 入口以理解传输约定。本项目独立实现适合 OpenSPH 的命令与状态结构，没有复制 Stellarium 的应用实现。

- 冷启动请求等待页面注册处理器；已有页面使用 singleton Ability 的 onNewWant，不另建一套场景状态。
- 参数完整验证后提交；错误不会先改一半状态；异步回放完成后才回应。
- 状态栏使用透明背景和浅色内容；系统栏、挖孔和手势避让区域逐边取最大值，不把重叠区域重复相加。监听避让与窗口尺寸变化，销毁时取消监听。
- 面板切换采用 UIContext.animateTo 的 80 ms 淡出和 160 ms 淡入，连续点击使用序号丢弃旧回调。相机手势直接跟随，模拟时间等实时数据不加入装饰动画。
- 0.4.0 首次打开面板使用 160 ms 淡入；收起立即释放视图，常驻 XComponent 不随菜单切换销毁。600 vp 起使用 300 vp 侧栏，较窄窗口使用半高底部面板。
- PC 保留系统窗口装饰；目前还没有完成自由窗口标题栏/三键区专项适配。手机、平板、PC 的最终覆盖仍需对应设备验收。

官方依据：[沉浸式效果](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-develop-apply-immersive-effects)、[窗口接口](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-window-window)、[UIContext](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-uicontext-uicontext)。本轮华为 MCP 搜索可用，全文接口因审批策略拒绝；接口签名和版本支持同时通过本地 API 24 SDK 与 ArkTS 编译核对。

### 验证与限制

2026-09-06：0.2.0 ArkTS 严格编译与 HAP 打包通过；6 项宿主端测试通过。测试执行实际 CliBridge 与页面非渲染动作代码，但以桩替代原生设备、HiLog 和动画上下文，覆盖冷启动排队、中文分块、去重/串行、非法输入、参数事务、重复 start、seek 边界和回放错误。它们不能证明设备传输、动画或安全区显示正确。

```bash
node --test tests/cli_transport.test.mjs
```

此前 0.2.0 曾因 HDC 网络限制未完成设备验收。该限制现已解除，0.2.0 CLI 基线和 0.3.0 新功能均已在 `127.0.0.1:5555` 安装并通过设备测试。0.3.0 还通过多实验保存、冷启动载入、非法 ID 拒绝和回放配置恢复测试；真实 UI 点击及截图检查了实验库、编辑器与上下安全区。详细记录见 [0.3.0 版本说明](../releases/RELEASE-0.3.0.md)。

复验命令：

```bash
bash scripts/install-emulator.sh 127.0.0.1:5555
node scripts/test-cli-emulator.mjs 127.0.0.1:5555
node scripts/test-projects-emulator.mjs 127.0.0.1:5555
node scripts/test-workspace-emulator.mjs 127.0.0.1:5555
```

设备验收脚本会停止并重启本应用，替换当前实验，覆盖本应用的单槽回放文件；不会停止其他应用或清空公共日志。脚本覆盖冷启动、命令目录、非法配置、相机、面板、10 秒真实求解、时间轴与回放文件往返。脚本成功后仍需截图检查上下安全区域，并在不同窗口宽度/横竖屏上检查布局；动画流畅性需设备录像或性能工具验证。

新增 workspace 脚本通过 UITest 实际点击和拖动，验证视口面积、面板边界、专注与恢复、返回键，以及菜单切换不重置求解。它会替换当前实验，但不写已保存项目或回放，也不切换设备折叠状态。0.4.0 在展开与折叠尺寸的运行结果见 [版本说明](../releases/RELEASE-0.4.0.md)。

### 0.8.0 自定义天体

`setScene` 新增 preset=5，必须同时提交完整 `orbitBodies` 数组（2–8 个对象），speed 固定为 1，duration 为 1–10 年。列表索引即相机 focus，0 为恒星。增删改可先读 `definition.config`，修改列表后整体提交；校验失败不改变现有场景。其他预设拒绝非空 orbitBodies，不能隐式忽略自定义列表。

```bash
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setScene --payload-json '{"preset":5,"count":600,"speed":1,"angle":0,"duration":3,"orbitBodies":[{"name":"恒星","massSolar":1,"xAU":0,"yAU":0,"zAU":0,"vxKmS":0,"vyKmS":0,"vzKmS":0,"surface":0},{"name":"远洋","massSolar":0.00000300349,"xAU":1,"yAU":0,"zAU":0.1,"vxKmS":0,"vyKmS":29.7,"vzKmS":1,"surface":1}]}'
```

`name` 最多 48 个 UTF-16 单元，不允许空白名称、控制字符、未配对代理项。`massSolar` 单位为太阳质量；UI 行星输入使用地球质量。surface 为 0 恒星、1 海洋、2 厚云、3 荒漠；质量、位置、速度范围见 [0.8.0 说明](../releases/RELEASE-0.8.0.md)。不能只发送变更字段或按当前帧覆盖初始值。

`definition.config.orbitBodies` 与 `simulation.config.orbitBodies` 都是初始条件；`simulation.bodies` 是当前帧在质心参考系中的显示位置、速度模长、质量与 surface。模型名为 `nbody-custom-v1`。名称和 surface 随实验库与 v4 回放保存；`clouds` 等显示开关仍属于会话。`setCamera.focus` 接受 −1 到天体数减一。自定义场景切换清理旧对象跟踪，防止删除后跟到错误对象。

请求经 URI 编码后上限提升为 16384 字符，足以容纳八天体及中文名称，仍不开放任意脚本执行。回放 IO 保持串行。`scripts/test-custom-emulator.mjs` 覆盖设备提交、八天体渲染、三维轨道、v4 往返、非法提交与实验库恢复。

### 0.9.0 · 视口命中和初始向量

- `getProjectedBodies {}` → `{ok,projection:{ready,widthPx,heightPx,time,bodies:[{id,x,y,radius,depth,opacity}]}}`。x/y 为视口归一化坐标、左上原点；radius 为视口高度的比例；widthPx/heightPx 是物理像素。ready=false 时等待下一帧。仅行星模型且表面渲染已准备好时可用。
- `pickBody {x,y}` → `{ok,hit}`。要求有限 0–1 坐标，命中后与 focus.<id> 共用动作，自定义系统同步编辑对象；hit=-1 不改变选择。不是屏幕坐标点击；不包含面板遮挡。
- `getOrbitPreview {}` → `{ok,body,draft,reference:"initial-input",preview}`。仅自定义系统。preview.valid/error 给出向量草稿的解析状态，positionAU、velocityKmS 始终是初始输入，不是质心坐标或实时速度。质量、名称等完整合法性仍由 orbit.apply 检查。
- `uiAction {action:"orbit.plane.xy"}` / `orbit.plane.xz` 切换预览投影；editor.vectorPlane 返回选中平面。两张图独立缩放，零投影显示中心十字。

通常直接 `uiAction {action:"focus.1"}` 选中对象；仅验证视口命中时查询投影并调用 pickBody。UI 点选与该命令调用相同 Native 命中逻辑。切换编辑对象会放弃上一个未应用草稿，同一对象再次点选保留草稿。

### 0.10.0 · 远方星空

`setSky {mode?:0|1|2,brightness?:0..1}` 设置纯净／星空／银河和亮度，省略字段保持当前值。全量校验通过后再修改，不影响场景或求解。`getSkyInfo` 返回生成版本、固定种子、6500 星点、1024×512 纹理尺寸与 `reference:"illustrative"`。星点没有真实恒星 ID、星等或赤道坐标，不属于可编辑／可点选的物理天体。

UI 入口为“观察 → 远方星空”：动作 `sky.mode.0` / `.1` / `.2`，字段 `sky.brightness` 为 **0–100 百分比**；直接 setSky.brightness 为 **0–1**。新增字段后 getUiState 输入目录有 19 项，仍以返回目录为准。

getState.sky 是目标设置；rendering.skyReady 是资源状态，skyStars/skyGalaxy 是含过渡及近看调暗后的实际强度。设置返回不等待动画；完整亮度变化最长约 0.5 秒，后台不推进。近看稳定后实际强度为目标的 35%。模式 0 或亮度 0 留下深色底色。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setSky --payload-json '{"mode":2,"brightness":0.65}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSkyInfo
```

天空方向只跟随旋转；当前局部正交缩放是改变实验显示比例，不是天空望远镜视场缩放。相机跟踪平移不产生恒星距离视差。三种背景可用于清爽展示／银河示意；不应称为真实天区查询。

### 0.11.0 连续行星操作

参见 [行为、遥测和验收](../releases/RELEASE-0.11.0.md)。新增 `uiAction {"action":"selection.edit"}`；目标切换均保留各天体草稿。`getState.rendering` 增加 `sceneRevision/surfaceStarts/cameraMoving/centerX/centerY/centerZ/compositionX/compositionY/compositionScale`。使用 `getProjectedBodies` 获取浮层避让后的实际命中位置。查看和打开编辑不会重新启动求解器；`orbit.apply` 仍是显式重建操作。

### 0.12.0 放置草稿

`orbit.add` 现在只打开草稿，旧批次要在其后显式加入 `placement.confirm`。六个新增输入、点选坐标命令和预览返回结构见 [0.12.0](../releases/RELEASE-0.12.0.md)。只有确认会新增天体并重建初始场景；取消不会改变已有配置或草稿。
