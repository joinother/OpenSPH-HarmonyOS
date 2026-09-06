# 语义 CLI 操作指南

> 类型：当前操作指南；适用版本：0.18.0；更新日期：2026-09-06（Asia/Shanghai）。

在项目根目录执行命令。CLI 通过 HDC、Want 和 HiLog 与真实应用交互，会启动或前置应用；无需 HTTP 服务。UI 与 CLI 共用动作和输入处理。以运行时 `listCommands`、`getUiState` 返回的字段、单位和可用状态为准。

## 开始使用

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --list
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getState
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getUiState
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"panel.observe"}'
```

`--device` 必填，本任务仅使用 `127.0.0.1:5555`。`--payload-json` 与 `--payload-file` 二选一。`--hdc PATH` 可指定 HDC；`--json` 保留兼容，输出本身已为 JSON。退出码为 0（成功）、2（应用返回失败）、1（参数或传输错误）。

## 状态与通用交互

| 命令 | 用途与参数 |
| --- | --- |
| `listCommands` | 查询命令和参数目录；`--list` 是它的快捷方式 |
| `getState` | 读取场景初值、模拟、相机、外观、窗口、编辑与放置状态 |
| `getUiState` / `listUiActions` | 查询动作的 enabled／selected、输入字段和草稿 |
| `uiAction` | `{ "action": "动作名" }`，执行与按钮共用的操作 |
| `setUiValue` | `{ "field": "字段名", "value": "值" }`；值类型遵循目录 |
| `setPanel` | `{ "panel": -1 }` 关闭，0 参数、1 观察、2 实验库 |

常用动作包括 `panel.parameters`、`panel.observe`、`panel.library`、`panel.close`、`ui.back`、`ui.focus`、`ui.restore`、`camera.in`、`camera.out`、`camera.reset`。命令返回表示处理完成，不保证界面动画已结束。

## 主题实验库

实验库的“碰撞／探索／我的实验”分类使用 `library.collision`、`library.explore`、`library.saved`；只切换内容，不重建当前场景。`listExperiments` 返回目录版本、七个主题的完整初始条件、默认镜头、问题和模型说明。

| 动作 | 内容 |
| --- | --- |
| `theme.rock-slow` / `theme.rock-fast` | 相同质量、采样种子和时长，仅速度为 2／8 km/s |
| `theme.rock-oblique` | 非零横向偏移的岩质相撞；angle 不是实际撞击角 |
| `theme.rock-spin` | 单岩质天体自转 |
| `theme.ocean-world` | 海洋行星近看，带恒星的双体轨道 |
| `theme.three-worlds` | 三种表面行星与恒星组成的系统 |
| `theme.ring-world` | “环影之间”：虚构带环气态行星、1 AU 轨道与 1 年探索；不是实际土星系统 |
| `theme.restore` | 恢复当前主题的完整初始条件和默认镜头 |
| `theme.compare` | 慢撞／快撞切换，恢复另一组完整初始条件 |

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command listExperiments
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.rock-slow"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.compare"}' --wait-state paused
```

进入、恢复和对照都会重建暂停的初始帧，清空旧轨迹、天体编辑草稿及撤销记录，并关闭面板；不是在当前模拟时刻改速度。`getState/getUiState.theme` 返回当前主题、观察目标和 `modified`（物理初始条件是否不同于主题）；未应用的天体草稿仍由 `editor.drafts` 单独表示。修改镜头不会标记物理条件已变。

现有另存实验保存物理参数、天体名称／表面与随机种子；当前主题 ID、镜头和说明尚不随存档保存。载入存档或 `setScene` 清除当前主题身份。封面是原创概念 SVG，不是预计算结果。岩质原色为灰岩／赭岩的颗粒外观，颜色与明暗不是温度或损伤；速度／密度着色单位不变。

`node scripts/test-themes-emulator.mjs 127.0.0.1:5555` 会依次运行全部主题并切换折叠与方向，覆盖当前会话；运行前另存初始条件并备份编辑／放置草稿。它不会写入用户实验库；结束暂停并恢复自动方向，不自动恢复原场景。

## 选中、近看与编辑

轨道场景使用 `focus.N` 选中索引 N 的天体，`focus.all` 返回全景；`surface.N` 近看指定天体，`surface.toggle`、`surface.previous`、`surface.next` 切换近看状态与对象。`selection.edit` 打开所选对象编辑，`orbit.select.N` 切换编辑对象，`orbit.near` 近看编辑对象。

切换对象时，未应用的编辑草稿在会话内按天体保留。查看、选中、近看和打开面板不会重建场景。`orbit.apply` 显式应用并重建，`orbit.remove` 删除天体；这些会改变初始条件。

`orbit.name` 和 `orbit.value.0..6` 接受字符串，允许保留暂时为空的输入。七个值依次为质量、x/y/z、vx/vy/vz；中心恒星质量单位为太阳质量，行星为地球质量，位置 AU，速度 km/s。

`getProjectedBodies` 返回最近呈现画面的归一化投影、半径与物理像素尺寸；需检查 ready，且结果不包含浮层遮挡判断。`pickBody {x,y}` 使用左上为原点、范围 0–1 的视口坐标，共用选择逻辑；未命中不改变选择。`getOrbitPreview` 显示自定义系统初始草稿的 XY/XZ 位置与速度，并非当前回放帧。

## 天体编辑撤销与重做

自定义系统在参数面板顶部提供撤销／重做；界面按钮与以下 CLI 动作调用同一处理函数。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.undo"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.redo"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.discard"}'
```

- `orbit.apply`、`orbit.remove` 和 `placement.confirm` 各记入一次成功的天体初始条件事务，最多保留最近 20 步。无效输入、取消放置不产生历史；成功提交新编辑后清除重做分支。
- `orbit.undo`／`orbit.redo` 恢复天体初始参数、所选编辑对象和各天体草稿；重新创建暂停的初始帧，清空旧轨迹，不恢复历史物理检查点。镜头返回全景，实验时长等全局参数保持当前设置。
- `orbit.discard` 只把当前天体输入还原为已应用值，不改变其他草稿、天体配置、镜头、回放进度或编辑历史。
- `getState` 与 `getUiState` 的 `editor.drafts` 列出所有未应用草稿；`editor.history` 返回 undoCount、redoCount、undoLabel、redoLabel、limit 和 scope。草稿可以含暂时为空的数值，不能据此直接重建场景。
- 应用一个天体只清除它自己的草稿。删除时移除该天体草稿，其他索引随之移动；撤销删除可以找回被删除天体的草稿。天体标签用“草稿”标记未应用输入。
- 历史仅在本次会话内保留，退出应用后不持久化，也不随另存实验或回放保存。切换预设、成功设置新场景、载入实验或成功载入回放会清除旧历史。放置中或回放 I/O 期间禁用撤销／重做；以动作 enabled 为准。

验收脚本 `node scripts/test-edit-history-emulator.mjs 127.0.0.1:5555` 会改写开发模拟器的当前初始条件，切换折叠状态和窗口方向，生成测试截图；它不替代真实手势验收。

## 放置行星

先打开自定义轨道场景，并通过动作目录确认 `orbit.add` 可用。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.add"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setPlacementPoint --payload-json '{"x":0.7,"y":0.35}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getPlacementPreview
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"placement.confirm"}' --wait-state paused
```

`orbit.add` 仅打开草稿。`placement.confirm` 才加入天体并从初始条件重建；`placement.cancel`、返回或关闭面板取消候选，保留原场景、历史与旧编辑草稿。放置期间部分实验操作禁用，应查询 enabled。确认会清空旧轨迹，保留已有天体的编辑草稿，并记入一步天体编辑历史。

- `placement.name` 与 `placement.value.0..4` 为字符串；五个值依次为地球质量倍数、距离 AU、方位角度、倾角角度、圆轨道速度倍数。
- `placement.circular`、`placement.still`、`placement.escape`、`placement.reverse` 设置圆轨道、相对恒星静止、1.45 倍圆轨道速度及反向；`placement.surface.1..4` 设置表面。
- `setPlacementPoint {x,y}` 使用预览图内 0–1 坐标，与轻点／拖动共用转换，不会自动确认。
- `getPlacementPreview` 返回 valid、error、完整候选初值、相对速度、圆轨道／逃逸速度、最近距离和解析引导路径；无效输入不能确认。

圆轨道速度包含恒星与候选质量，候选速度叠加恒星原速度。紫线是二体解析引导，灰点是其他天体初始位置的平面投影。工具不在当前时刻注入天体。自定义系统限制为 2–8 天体、坐标 ±10 AU、速度模长不超过 100 km/s、初始间距至少 0.05 AU。

## 场景、求解与回放

| 命令 | 行为 |
| --- | --- |
| `setScene` | 必填 preset、count、speed、angle、duration；preset 5 还需完整 bodies；验证后事务式设置并准备为 paused |
| `start` / `pause` | 启动或继续／暂停求解；重复 start 不会切换为暂停 |
| `reset` | 重新初始化并暂停 |
| `seek` | `{ "frame": -1 }` 回最新帧，或指定保留帧索引；暂停求解并停止自动回放 |
| `listProjects` / `saveProject` / `loadProject` | 列表／按 title 保存／按 id 载入命名初始条件，最多 50 个 |
| `saveReplay` / `loadReplay` | 异步保存／载入单槽回放；兼容 v1–v4 |

预设 0–2 为 SPH，3 为双体，4 为四体，5 为自定义。完整配置范围以命令目录和应用校验为准。`getState.definition` 是初始条件，`simulation.bodies` 为当前显示的质心参考系数据；SPH 时间单位为秒，轨道为儒略年。

回放最多保留 240 帧，不是求解器检查点。完成、载入回放或配置改变后再次开始，会重新计算；不能从任意历史快照续算。语义动作还包括 `simulation.toggle`、`simulation.apply`、`replay.toggle`、`replay.latest`、`replay.save`、`replay.load`；时间轴输入为 `time.frame`。

## 外观与相机

`setAppearance` 接受可选布尔值 clouds、atmosphere、trails、closeup、autoSpin、rings。也可用 `appearance.clouds`、`appearance.atmosphere`、`appearance.trails`、`appearance.spin`、`appearance.rings`。

带环外观使用行星 `surface:4`；`orbit.surface.4` 修改编辑草稿，`placement.surface.4` 修改放置预览，按原有确认流程应用。它与 1 海洋、2 厚云、3 荒漠并存；恒星只能使用 0。`rings` 默认开启，只控制带环材质的环面和环影；开关保留时间、轨迹、镜头和场景版本。环尺寸与倾斜目前固定，未提供任意环参数输入；球面仍是点选区域，环面不单独响应选中。

天体材质编号随命名实验及 v4 回放保存；全局环带开关与其他外观选项仍只保留在本次会话中。包含材质 4 的文件需本版或更新版读取，旧版会拒绝；本版仍读取旧文件。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.ring-world"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setAppearance --payload-json '{"rings":false,"autoSpin":false}'
```

`node scripts/test-rings-emulator.mjs 127.0.0.1:5555` 验证环带像素、侧面投影、布局和新主题积分，会改变当前场景与折叠／方向状态；运行前保存状态，结束由调用方恢复。

`setSky` 接受 mode（0 干净背景、1 星空、2 银河）与 brightness（0–1）；UI 字段 `sky.brightness` 使用 0–100 百分比，不能混用。`getSkyInfo` 返回当前资源来源：摄影就绪时 reference 为 `photographic-panorama`，否则为 `procedural-fallback`；同时返回 ESO/S. Brunier 署名、素材／许可链接、纹理尺寸、loadError 与 rendering。银河摄影为 2048×1024，星空模式仍使用 6500 个程序星点；`proceduralStarsVisible` 描述稳定模式下是否使用程序星点。切换动画中的混合权重另看渲染状态。这不是可定位的星表。

`setCamera` 需要完整 yaw（-100–100）、pitch（-1.5–1.5）、zoom（0.5–15）、focus（-1 或有效天体索引）、color（0–2，轨道模式为 0/1）。普通导航优先使用语义动作。

摄影资源需等待 `rendering.panoramaReady`，载入淡入完成需 `panoramaBlend === 1`；`skyReady` 仅证明背景渲染器可用。摄影加载失败时保留程序背景，检查 loadError；GPU 上传错误见 rendering.error。

诊断时查看 `rendering.sceneRevision`、`surfaceStarts`、`cameraMoving`、ready、texturesReady。cameraMoving 仅表示原生相机插值，submitMs 是 CPU 提交耗时，不是 GPU 耗时或 FPS。`window.widthVp/heightVp` 为 vp，safePx 与视口像素尺寸为物理像素；沉浸状态不证明 PC 标题栏已隐藏。

## 折叠、旋转与窗口诊断

默认方向策略为 auto，跟随传感器并尊重系统旋转锁。可用下面的命令对应用主窗口设置方向；不伪造视口尺寸，也不改变实验配置。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setWindowOrientation --payload-json '{"orientation":"landscape"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setWindowOrientation --payload-json '{"orientation":"auto"}'
```

orientation 支持 auto、portrait、landscape、reverse-landscape；方向覆盖仅在当前窗口会话内生效，新建窗口恢复 auto。返回表示窗口 API 已接受，旋转动画与安全区回调可能尚未完成；不要用求解器的 `--wait-state` 等待旋转。

`getState.window.geometry` 返回主窗口物理像素宽高、四边避让值和更新 revision；`window.layout` 返回以实际安全视口 vp 计算的 compact、sidePanel、headerHeight、drawer、dock、scene 区域。geometry 与布局来自不同阶段，旋转中允许短暂不同步；验收应等待尺寸稳定并核对 native 投影尺寸加安全区等于窗口尺寸。

`window.widthVp/heightVp` 是根布局测量，`viewportWidthVp/viewportHeightVp` 是完整宇宙视口测量；不再减去系统安全区。`window.layout.safe` 为控件可用区域，drawer、dock、scene 坐标均相对完整视口。可用高度小于 480 vp 时启用紧凑控制栏；可用宽度至少 600 vp 时使用侧栏。切换时保留场景、回放帧、选择对象、编辑与放置草稿，同一 XComponent 持续承载视口。

默认隐藏状态栏、传统导航栏和手势导航指示条，切回前台时重新应用；系统边缘手势临时唤出的栏仍由系统管理。`window.immersive` 表示应用窗口策略调用成功，不代表临时系统浮层当前一定不可见。宇宙画面铺满窗口，控件继续按动态避让区域布局。`getProjectedBodies` 的像素宽高应匹配完整窗口，不再与安全区相加。

主题实验库布局验收使用 `node scripts/test-themes-emulator.mjs 127.0.0.1:5555`，覆盖主题实验库的展开、折叠竖屏和横屏；输出按当前源码版本命名。0.18.0 带环画面的布局验证使用 `test-rings-emulator.mjs`。完整沉浸矩阵的历史证据见 [0.16.0 记录](releases/RELEASE-0.16.0.md)；旧窗口与编辑验收脚本保留固定版本的输出文件名，复用时应先修改输出路径，避免覆盖历史证据。

验收会替换当前会话并进行系统折叠和主窗口方向切换，结束恢复 auto；不会保存或覆盖用户实验库。脚本通过不代表真机传感器姿态、触摸或全部半折叠形态通过。

## 批处理与等待

支持 `--batch FILE`，文件为 1–100 项 JSON 数组；与单命令参数互斥。例如保存以下内容为本地批次文件，再执行：

```json
[
  { "command": "getUiState" },
  { "command": "pause", "waitForState": "paused" },
  { "command": "getState" }
]
```

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --batch /path/to/batch.json
```

批次先校验命令封装，逐项发送，运行失败立即停止；此前成功操作不会回滚。`completed` 包含已收到失败响应的那一项，不能直接解释为成功数量。

`--wait-state` 或每项 `waitForState` 可等待 paused、running、completed、replay、cancelled、failed；仅等待求解器状态，不等待动画、纹理或保存完成。`--timeout` 单位毫秒，范围 1000–120000，默认 20000。

CLI 验证覆盖状态和共享动作；实际触摸、键盘焦点、动画观感与遮挡须单独验收。旧版描述见 [历史汇编](archive/CLI-HISTORY-THROUGH-0.12.0.md)，不再作为当前命令规则。
