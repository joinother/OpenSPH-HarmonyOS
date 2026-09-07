# 语义 CLI 操作指南

> 类型：当前操作指南；适用版本：0.28.0；更新日期：2026-09-07（Asia/Shanghai）。

在项目根目录执行命令。CLI 通过 HDC、Want 和 HiLog 与真实应用交互，会启动或前置应用；无需 HTTP 服务。回复按 UTF-8 字节预算限速（约 24 KB/s，含行元数据预算），大响应会比轻量查询慢；超过 128 分片返回明确错误，代理对请求不会自动重试执行。UI 与 CLI 共用动作和输入处理。以运行时 `listCommands`、`getUiState` 返回的字段、单位和可用状态为准。

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

实验库的“碰撞／探索／我的实验”分类使用 `library.collision`、`library.explore`、`library.saved`；只切换内容，不重建当前场景。`listExperiments` 返回目录版本、十个主题的完整初始条件、默认镜头、问题和模型说明。

| 动作 | 内容 |
| --- | --- |
| `theme.rock-slow` / `theme.rock-fast` | 相同质量、采样种子和时长，仅速度为 2／8 km/s |
| `theme.rock-oblique` | 非零横向偏移的岩质相撞；angle 不是实际撞击角 |
| `theme.rock-spin` | 单岩质天体自转 |
| `theme.ocean-world` | 海洋行星近看，带恒星的双体轨道 |
| `theme.three-worlds` | 三种表面行星与恒星组成的系统 |
| `theme.ring-world` | “环影之间”：虚构带环气态行星、1 AU 轨道与 1 年探索；不是实际土星系统 |
| `theme.kepler-ring` | “环为什么会错位”：暂停主系统，进入独立的 24 小时示踪环 |
| `theme.restore` | 恢复当前主题的完整初始条件和默认镜头 |
| `theme.compare` | 慢撞／快撞切换，恢复另一组完整初始条件 |

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command listExperiments
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.rock-slow"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.compare"}' --wait-state paused
```

进入、恢复和对照都会重建暂停的初始帧，清空旧轨迹、天体编辑草稿及撤销记录，并关闭面板；不是在当前模拟时刻改速度。`getState/getUiState.theme` 返回当前主题、观察目标和 `modified`（物理初始条件是否不同于主题）；未应用的天体草稿仍由 `editor.drafts` 单独表示。修改镜头不会标记物理条件已变。

另存实验保存物理参数、天体名称／表面、随机种子，并包含版本化的外观与观察配方。主题 ID 随配方保存，说明从当前内置主题目录读取；未知 ID 不绑定主题。`setScene` 清除当前主题身份。封面是原创概念 SVG，不是预计算结果。岩质原色为灰岩／赭岩的颗粒外观，颜色与明暗不是温度或损伤；速度／密度着色单位不变。

`node scripts/test-themes-emulator.mjs 127.0.0.1:5555` 会依次运行全部主题并切换折叠与方向，覆盖当前会话；运行前另存初始条件并备份编辑／放置草稿。它不会写入用户实验库；结束暂停并恢复自动方向，不自动恢复原场景。

## 选中、近看与编辑

轨道场景使用 `focus.N` 选中索引 N 的天体，`focus.all` 返回全景；`surface.N` 近看指定天体，`surface.toggle`、`surface.previous`、`surface.next` 切换近看状态与对象。`selection.edit` 打开所选对象编辑并保留当前远近视角；需要近看时显式使用 `surface.N` 或 `orbit.near`。`orbit.select.N` 切换编辑对象，`orbit.near` 近看编辑对象。

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
- `placement.circular`、`placement.still`、`placement.escape`、`placement.reverse` 设置圆轨道、相对恒星静止、1.45 倍圆轨道速度及反向；`placement.surface.1..5` 设置表面。
- `setPlacementPoint {x,y}` 使用预览图内 0–1 坐标，与轻点／拖动共用转换，不会自动确认。
- `getPlacementPreview` 返回 valid、error、完整候选初值、相对速度、圆轨道／逃逸速度、最近距离和解析引导路径；无效输入不能确认。

圆轨道速度包含恒星与候选质量，候选速度叠加恒星原速度。紫线是二体解析引导，灰点是其他天体初始位置的平面投影。工具不在当前时刻注入天体。自定义系统限制为 2–8 天体、坐标 ±10 AU、速度模长不超过 100 km/s、初始间距至少 0.05 AU。

### 复制已有行星

在自定义系统中用 `orbit.select.N` 选择行星，再执行 `orbit.copy`，对应编辑面板的“复制并放置”。仅行星可复制；满 8 个天体、放置中或 I/O 忙碌时禁用。复制读取已应用的质量与表面，保留未应用的编辑输入；不会复制当前模拟帧、原位置／速度、局部环时钟或程序自转相位。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.select.1"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.copy"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setUiValue --payload-json '{"field":"placement.value.4","value":"1.2"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"placement.confirm"}' --wait-state paused
```

副本名称在 48 字符内避免重名，不拆开 Unicode 代理对。新轨道从相对恒星的 XY 平面圆轨道开始，优先采用原始相对距离（初始建议限制在 0.1–8 AU）、错开方位；若越界或占位则尝试其他角度／距离，所有候选仍执行原有速度、坐标、质量与间距校验。未找到可用位置时保留无效预览供修改，不能确认。

`getState.placement` 增加 `sourceIndex` 与 `sourceName`，表示当前复制草稿的来源；普通添加或退出放置后为 −1／空字符串。这是会话提示，不是持久化的天体关联。确认后的新天体独立编辑，使用原有撤销／重做和命名实验保存路径。主系统正在运行时预览不暂停主时钟；进入放置仍按既有规则退出局部示踪模式。

## 轨道观察曲线

观察面板顶部提供“距恒星”和“速度”。曲线目标跟随镜头选择的行星；全景或选中恒星时观察第一颗行星。`getOrbitObservation` 为只读命令，返回 `{ok,metric,data,plot}`：`data` 含场景修订号、目标名称／索引、当前帧选择和最多 240 个 `{frame,time,distanceAU,speedKmS}` 样本；`plot` 含采样范围、轴范围、当前读数和采样极值。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"panel.observe"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getOrbitObservation
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"observation.speed"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"observation.maximum"}'
```

- `observation.distance` / `observation.speed`：切换 AU 距离和 km/s 速率，不改变物理参数或镜头。
- `observation.minimum` / `observation.maximum`：在当前指标的保留记录中寻找最小／最大值，暂停演算并选择相应帧；相等时选择最早保留帧。停止回放播放并退出局部示踪，沿用现有回放语义，不能从该帧恢复积分。
- 曲线横轴按实际年数分布，紫线标记当前查看的帧；原时间轴拖动也会更新曲线读数。数据范围随 240 帧保留窗口移动，未必包含初始时刻或完整周期。
- 距离是该行星到第 0 个天体（恒星）中心的三维距离；速度是系统质心参考系中的速率，不是相对恒星速度。数据来自已有单精度显示／回放快照，不是新增双精度科学输出。
- 无历史帧或 SPH 模型返回空曲线；极值动作禁用。放置中或 I/O 忙碌时沿用统一动作限制。新场景不拼接旧记录，载入轨道回放后可从原快照重建曲线。

原生极值跳转在同一锁内核对场景修订号、帧索引与时间；若记录已因重建或滚动过期，则拒绝跳转，刷新后可重试。曲线不是连续轨道解析，采样最小／最大值不能直接称为近星点／远星点。曲线仍不包含完整历史保存或新的 SPH 热力学诊断。指标选择属于当前会话界面状态，不写入实验配方。

## 跨实验参照与数据导出

在轨道实验计算出至少两帧后，观察面板的“保存本次作参照”保留当前天体的距离与速率记录。修改初速、切换实验或重新启动应用后，仍可与新的结果叠加比较。参照为独立的一个本地槽位，已存在时按钮明确显示“替换为本次结果”；不会覆盖命名实验或回放槽。

| 接口 | 行为 |
| --- | --- |
| `comparison.capture` | UI 动作：保存／替换当前天体最多 240 帧及已应用的原生配置，不使用未应用的输入；不暂停、跳帧或重建 |
| `comparison.toggle` | UI 动作：仅切换参照显示，存储数据不变 |
| `comparison.clear` | UI 动作：删除参照，保留当前模拟；损坏文件也可显式移除 |
| `comparison.reload` | UI 动作：发生读取／保存错误时重试读取，磁盘文件仍无效则保留错误提示 |
| `getObservationComparison` | `{ok,visible,reference?,currentName,currentCount,currentConfig?,chart,error}`；来源摘要、共享坐标、是否重叠与当前差值 |
| `getObservationReference` | `{ok,reference,error}`；完整参照记录，无参照时为 null |
| `getObservationTable` | `{ok,csv,rows,timeAlignment,reference?,currentName,currentConfig?}`；当前及已保存参照的原始行，即使参照隐藏也包含它 |

青色为当前，金色为参照；两条曲线使用从各自模拟起点计算的实际年数与共同纵轴，不拉伸各自采样区间。`chart.referenceVisible` 表示实际绘制叠加曲线；`visible` 仅表示用户显示设置。当前没有轨道数据时可能为 `visible:true`、`referenceVisible:false`。`chart.plot` 的最小／最大值和跳帧索引始终属于当前记录，参照曲线不会驱动当前回放。兼容接口 `getOrbitObservation.plot` 仍保留单组坐标语义。

`chart.deltaReady` 为 true 时，`delta` 为当前值减去参照同一时刻的线性插值，`referenceValue` 为该插值；两个标量在 deltaReady 为 false 时不可解释为测量结果。范围不重叠或光标超出参照时间范围时不外推，界面明确提示。不同天体或参数可以叠加，但不自动判断两组实验是否适合科学比较；界面标明来源标题、天体、初速和采样范围，自定义完整初态在返回的 config 中。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"comparison.capture"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getObservationComparison
node scripts/export-observation.mjs --device 127.0.0.1:5555 --output /tmp/my-orbit-comparison.csv
```

导出工具在指定主机位置生成 CSV 与同名 `.metadata.json`，两个路径都拒绝覆盖；第二份文件失败时撤回本次创建的 CSV。CSV 表头为 `series,frame,time_year,distance_AU,barycentric_speed_km_s`，最多 480 行；series 为 current／reference，数据保留原采样时间和值，没有插值行。JSON 保存来源配置、参照捕获时间和范围；capturedAt 为 Unix 毫秒。没有任何样本时导出拒绝。不同运行时的小数文本末位可能不同，数值比较应遵循浮点精度。

参照文件 `observation-reference.json` 只在应用私有目录离线保存，上限 128 KiB。先完整写入临时文件、刷新并核对内容，再替换正式文件；写入失败保留旧记录。读取时验证版本、配置和单调样本；错误文件不静默删除，不导入网络资源。隐藏状态和指标选择是会话设置，重启默认显示参照和距离；参照不包含在命名实验或回放内。卸载、清除应用数据会失去它。

`test-comparison-emulator.mjs` 和 `test-comparison-layout-emulator.mjs` 需要参照槽为空，并会改变当前场景；先备份原实验／草稿。前者验证保存、替换、冷启动与导出，后者验证展开、折叠竖屏、折叠横屏的实际新按钮命中与曲线可视区域。脚本不自动恢复原会话，验收工作应另行恢复。

## 局部示踪环

`theme.kepler-ring` 进入第九个主题；也可选中自定义系统里 `surface:4` 的行星，通过观察面板或 `trace.toggle` 开启。底部切换为独立的 0–24 小时时间轴，主系统保持暂停。退出局部模式不会自动继续主系统。

| 动作／命令 | 行为 |
| --- | --- |
| `trace.toggle` | 开关局部模式，开启时从小时零点开始，并停用外观自转 |
| `trace.play` | 运行／暂停局部小时钟；24 小时结束后再次运行从零开始 |
| `trace.reset` | 小时时间归零并暂停，保留发射速度与倍率 |
| `trace.controls` | 打开观察面板顶部的调轨区域 |
| `trace.circular` / `trace.ellipse` | 设置 1.00 / 1.12 倍切向发射速度；速度实际改变时归零并暂停 |
| `trace.apoapsis` | 跳到内圈首次远点并暂停；若超过 24 小时，动作禁用 |
| `setUiValue {field:"trace.speed",value:1..1.2}` | 相对每圈圆轨道速度的倍数；改变时重新从近点发射，不重建主星系 |
| `setUiValue {field:"trace.rate",value:0.1..4}` | 每真实秒演示的小时数；保持当前时间和运行／暂停状态 |
| `setUiValue {field:"trace.hours",value:0..24}` | 定位到任意小时并暂停，与滑块共用逻辑 |
| `getRingTrace {particles:true}` | 返回局部状态、192 个示踪点的环平面位置（km）、速度（km/s）、半径与周期（h）；默认包含点列表 |
| `getRingTrace {particles:false}` | 只返回时钟、质量、假定半径和内外圈周期 |

`getState.ringTrace` 是轻量状态；`getUiState` 包含对应动作和 `trace.hours`、`trace.speed`、`trace.rate` 字段。主系统仍由 `simulation` 字段描述，不能把 `simulation.time` 的年数当成局部小时。`start` 会退出局部模式后启动主系统；`pause` 暂停两个时钟；原有 `seek` 使用保留帧索引。主系统重建、回放操作、切换天体、返回全景和进入放置会退出局部模式。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.kepler-ring"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setUiValue --payload-json '{"field":"trace.hours","value":3}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getRingTrace --payload-json '{"particles":true}'
```

默认每秒演示约 1 小时，可在 0.1–4 小时/秒间调整；渲染暂停、后台或长卡顿不补算墙钟时间。示踪点无质量，仅使用所选行星的中心引力，位置通过开普勒方程求得；假定半径 60000 km，初始距离（近点）76800–133200 km。纯切向发射比例 f 对应 e=f²−1、a=r₀/(2−f²)，范围限定 e=0–0.44，未实现向内发射或逃逸。状态返回 `speedScale`、`rateHours`、`eccentricity`、两圈远点、`referenceXKm/YKm`、`referenceRadiusKm`、`referenceSpeedKmS`；参考点为内圈第一个粒子。粒子数组的 `radiusKm` 保持原义，为初始半径，当前距离应由 x/y 求模。青色到金色表示由内圈到外圈，不是温度。环时钟、开关、目标、发射比例与倍率随新版命名实验保存；载入时恢复环时刻并保持暂停，主系统仍从初始条件开始。v4 回放不保存这些局部参数，`theme.restore` 重新开启主题默认环。重新进入局部模式恢复圆轨道和默认倍率；椭圆主题再设为 1.12 倍。主题的 modified 标记仍描述主系统初值。俯视图来自原生参考点，艺术环带保持原外观。

验证入口：`bash scripts/test-ring-trace.sh` 为独立物理与计时基线；`node scripts/test-ring-trace-emulator.mjs 127.0.0.1:5555` 会切换场景、折叠和方向，调用方需事先保存并在结束后恢复会话。椭圆验收使用 `node scripts/test-elliptic-trace-emulator.mjs 127.0.0.1:5555`。详见 [0.20.0 验证记录](releases/RELEASE-0.20.0.md)。

## SPH 碰撞诊断

预设 0–2 的观察面板提供压力、比内能与材料损伤。`uiAction` 的 `color.3`、`color.4`、`color.5` 与三个界面按钮共用处理；无诊断帧时这些动作禁用。0 为原色、1 速度、2 密度。切换着色不重算、不移动时间轴；所选颜色随命名实验配方保存，切入轨道模式时 2–5 恢复为 0。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSphDiagnostics
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"color.3"}'
```

`getSphDiagnostics` 只读取所选帧，返回 `time`、`timeUnit`、`selected`、`frameCount`、`model`、已应用 `config` 和 `diagnostics`；SPH 的时间单位为 `s`，轨道为 `year`。`getState.simulation.sph` 具有同一组诊断字段。`available:false` 时数值字段省略，不能当成零测量。

| 字段 | 单位／含义 |
| --- | --- |
| `pressureMinGPa/MaxGPa/MeanGPa`（完整名如 `pressureMaxGPa`） | 有符号压力，GPa；Mean 为质量加权 |
| `internalMinMJkg/MaxMJkg/MeanMJkg`（完整名如 `internalMaxMJkg`） | 比内能，MJ/kg；Mean 为质量加权 |
| `damageMean`、`damageMax` | 上游标量 DAMAGE 的三次方，0–1；Mean 为质量加权 |
| `kineticJ`、`internalJ` | 所有粒子的动能、内能总量，J；不包含完整弹性／引力能量预算 |

压力色标为蓝 −10／白 0／红 +10 GPa，比内能为深蓝 0 至金色 10 MJ/kg，损伤为青色 0 至红色 1。色标固定且显示饱和；原始读数不裁切。比内能不换算为温度，损伤不代表碎片计数。v5 保存逐帧诊断；v1/v2 缺少此数据时提示重新运行，选择新色号时渲染回退原色。轨道仍使用 v3/v4。详情见 [诊断与复现](reference/SPH-DIAGNOSTICS.md)。

## 场景、求解与回放

| 命令 | 行为 |
| --- | --- |
| `setScene` | 必填 preset、count、speed、angle、duration；preset 5 还需完整 bodies；验证后事务式设置并准备为 paused |
| `start` / `pause` | 启动或继续／暂停求解；重复 start 不会切换为暂停 |
| `reset` | 重新初始化并暂停 |
| `seek` | `{ "frame": -1 }` 回最新帧，或指定保留帧索引；暂停求解并停止自动回放 |
| `listProjects` / `saveProject` / `loadProject` | 列表／按 title 保存／按 id 载入命名实验配方，最多 50 个 |
| `saveReplay` / `loadReplay` | 异步保存／载入单槽回放；兼容 v1–v5 |

预设 0–2 为 SPH，3 为双体，4 为四体，5 为自定义。完整配置范围以命令目录和应用校验为准。`getState.definition` 是初始条件，`simulation.bodies` 为当前显示的质心参考系数据；SPH 时间单位为秒，轨道为儒略年。

命名实验保存结构保持 `scene.schemaVersion=1`，新增可选的 `recipe`：`schemaVersion=1`、`appearanceVersion=2`、`material`、`themeId`、`camera`、可选全景返回视角 `overview`、`appearance`、`sky` 和 `ring`。`listProjects` 每条新增 `hasRecipe` 与 `themeId`。界面“保存当前实验与视角”与 `saveProject` 共用写入逻辑。

保存采样当前镜头和局部环时钟，不自动暂停正在运行的实验。载入先校验整份文件，再创建暂停的初始场景；环恢复所存小时数、速度与倍率，并保持暂停。主系统时间不保存，不是中途续算；未提交的天体／放置草稿、撤销历史、回放帧、当前面板和窗口方向不在配方内。程序外观动画相位也不保存，因此恢复视角不等于逐像素复原旧帧。

`appearanceVersion=2` 要求完整 `material:{exposure,ocean,cloudShadows}`；v1 外观配方读取时采用 0 EV、海洋反光／云影开启的默认材质，不重写原文件。新的 v2 外观配方不支持旧版应用读取；需要升级应用后打开。光照改进会改变同一旧外观的像素结果。

旧存档缺少 `recipe` 时仍可打开，采用固定默认外观、银河亮度和全景，不继承上一个实验的设置。显式损坏的配方、未知配方／外观版本或不匹配的局部环目标会被拒绝，已有场景保持；损坏条目不影响其他有效实验。详见 [0.21.0 记录](releases/RELEASE-0.21.0.md)。验收入口为 `node scripts/test-recipe-emulator.mjs 127.0.0.1:5555`；它创建并清理自己的验收实验，不覆盖既有存档，但会替换当前会话，调用者需先备份并事后恢复。

回放最多保留 240 帧，不是求解器检查点。完成、载入回放或配置改变后再次开始，会重新计算；不能从任意历史快照续算。语义动作还包括 `simulation.toggle`、`simulation.apply`、`replay.toggle`、`replay.latest`、`replay.save`、`replay.load`；时间轴输入为 `time.frame`。

## 光照与材质

观察面板顶部的“光与质感”对应 `setMaterial`，参数均可选：`exposure` 为 −2～+2 EV（默认 0），`ocean` 与 `cloudShadows` 为布尔值（默认 true）。显式 null、错误类型或越界值会整体拒绝，之前的设置保持。EV 每增加 1，使色调映射前的线性亮度乘以 2，显示像素不会简单翻倍。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setMaterial --payload-json '{"exposure":0.7,"ocean":true,"cloudShadows":false}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setUiValue --payload-json '{"field":"material.exposure","value":-0.5}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"material.reset"}'
```

`material.ocean`、`material.cloudShadows` 和 `material.reset` 与界面共用；曝光滑块使用 `material.exposure` 字段。重置恢复三个材质值，不改变云层、大气或银河开关。UI 在轨道场景中显示这些控制，CLI 也可预设下一次轨道显示的材质值。主题切换保留当前材质选择，载入命名实验使用所存配置。

`getState.material` 是当前目标配置；`rendering.materialExposure/materialOcean/materialCloudShadows` 是最近成功提交帧使用的值，尚未提交时可与目标不同。材质命令不会发起镜头请求，也不重建渲染表面或物理场景；通常下一帧生效。曝光针对原色模式下的恒星、球面、云层、大气和艺术环带；不改变天空、界面、轨迹、示踪点、SPH 颗粒或速度诊断着色。海洋反光仅对海陆外观（surface 1）有效；云影依赖云层开启，关闭云层时不投影。没有真实地球地图、地形法线、夜灯、气候或光度测量含义。

验收：`node scripts/test-material-lighting-emulator.mjs 127.0.0.1:5555` 比较真实渲染像素；`node scripts/test-material-controls-emulator.mjs 127.0.0.1:5555` 检查三个窗口中的触摸与滑块。两者替换会话，须先备份并恢复；测试截图不表示真机性能。见 [0.23.0 记录](releases/RELEASE-0.23.0.md)。

## 外观与相机

`setAppearance` 接受可选布尔值 clouds、atmosphere、trails、closeup、autoSpin、rings。也可用 `appearance.clouds`、`appearance.atmosphere`、`appearance.trails`、`appearance.spin`、`appearance.rings`。

带环外观使用行星 `surface:4`；`orbit.surface.4` 修改编辑草稿，`placement.surface.4` 修改放置预览，按原有确认流程应用。它与 1 海洋、2 厚云、3 荒漠、5 月面并存；恒星只能使用 0。`rings` 默认开启，只控制带环材质的环面和环影；开关保留时间、轨迹、镜头和场景版本。环尺寸与倾斜目前固定，未提供任意环参数输入；球面仍是点选区域，环面不单独响应选中。

天体材质编号随命名实验及 v4 回放保存；全局环带开关与其他外观选项现随命名实验配方保存，v4 回放仍不包含外观配方。包含材质 4 的文件需本版或更新版读取，旧版会拒绝；本版仍读取旧文件。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.ring-world"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setAppearance --payload-json '{"rings":false,"autoSpin":false}'
```

`node scripts/test-rings-emulator.mjs 127.0.0.1:5555` 验证环带像素、侧面投影、布局和新主题积分，会改变当前场景与折叠／方向状态；运行前保存状态，结束由调用方恢复。

`setSky` 接受 mode（0 干净背景、1 星空、2 银河）与 brightness（0–1）；UI 字段 `sky.brightness` 使用 0–100 百分比，不能混用。`getSkyInfo` 返回当前资源来源：摄影就绪时 reference 为 `photographic-panorama`，否则为 `procedural-fallback`；同时返回 ESO/S. Brunier 署名、素材／许可链接、纹理尺寸、loadError 与 rendering。银河摄影为 2048×1024，星空模式仍使用 6500 个程序星点；`proceduralStarsVisible` 描述稳定模式下是否使用程序星点。切换动画中的混合权重另看渲染状态。这不是可定位的星表。

`setCamera` 需要完整 yaw（-100–100）、pitch（-1.5–1.5）、zoom（0.5–15）、focus（-1 或有效天体索引）、color（0–5，轨道模式为 0/1）。普通导航优先使用语义动作。

摄影资源需等待 `rendering.panoramaReady`，载入淡入完成需 `panoramaBlend === 1`；`skyReady` 仅证明背景渲染器可用。摄影加载失败时保留程序背景，检查 loadError；GPU 上传错误见 rendering.error。

诊断时查看 `rendering.sceneRevision`、`surfaceStarts`、`cameraMoving`、ready、texturesReady。cameraMoving 包含镜头过渡与面板构图过渡，不能用于判断某条镜头请求是否完成；应查询 cameraMotion.requestId 与 state。submitMs 是 CPU 提交耗时，不是 GPU 耗时或 FPS。`window.widthVp/heightVp` 为 vp，safePx 与视口像素尺寸为物理像素；沉浸状态不证明 PC 标题栏已隐藏。

## 镜头请求、取消与等待

普通 `getState` 包含 `cameraMotion`；轻量查询使用 `getCameraMotion`，避免大快照传输错过短过渡。镜头时钟来自原生渲染线程，与求解速度分开；物理暂停仍能飞近。退后台期间不推进镜头，窗口尺寸变化不主动取消镜头。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command navigateCamera --payload-json '{"focus":1,"closeup":true,"durationMs":900}' --wait-camera
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getCameraMotion --payload-json '{"requestId":1}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command cancelCameraMotion --payload-json '{"requestId":1}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"focus.all"}' --wait-camera
```

上例查询／取消的 `requestId` 应替换为实际返回值。省略 requestId 或传 0 表示当前请求。

| 接口／字段 | 语义 |
| --- | --- |
| `navigateCamera` | 必填 focus（-1 全景或当前场景有效天体索引）；可选 closeup（默认 false）、yaw／pitch／zoom（默认当前 UI 目标值）、durationMs（默认 420，范围 0–3000）；参数整体校验通过后才改变视图 |
| `cameraMotion.requestId` | 本进程内递增；连续手势姿态更新不产生导航请求；重启进程后不得复用旧 ID |
| `cameraMotion.state` | idle、queued、running、completed、cancelled；无效参数和未知／过期 ID 返回 ok:false，不伪造成功记录 |
| `progress` | 0–1 的镜头过渡进度；completed 在对应帧成功提交后记录，与面板动画完成无关 |
| `targetFocus`／`targetCloseup` | 此次请求的目标；yaw／pitch／zoom 为渲染侧当前姿态，getState.camera 仍是 UI 目标值 |
| `reason` | user（取消／手势接管）、superseded（被新请求取代）、scene_changed（原生检测场景替换）；已完成请求为空 |
| `getCameraMotion` | 当前请求及最近 32 条终结记录可查；旧 ID 取消只返回其记录，不取消新请求 |
| `camera.cancel` | 与界面“停在这里”共用；仅当前请求 queued／running 时可用 |
| `--wait-camera` | 主机端轮询本次返回的 ID；完成退出 0，取消退出 2，超时明确失败；等待时应用仍能处理取消命令 |

批次项可增加 `"waitForCamera":true`，例如 `{"command":"navigateCamera","payload":{"focus":1,"closeup":true},"waitForCamera":true}`。不要用固定 sleep 推断动画结束。`setCamera` 保留直接设姿态的兼容语义；需要明确的新请求和等待，应使用 `navigateCamera` 或飞近／返回类 `uiAction`。

取消冻结当前镜头的插值参数和构图权重；正在运行的天体仍按物理位置移动，外观自转仍受原开关控制。重新发出同目标的显式导航可继续飞往该目标，单纯开关云层等外观不会偷偷恢复已取消的旅程。手势从当前姿态接管，连续切换从当前构图接续。

现有实验配方保存目标视点，不保存旅程 ID、进度和中途取消的混合权重；载入后恢复目标视图，不能承诺重现半途构图。CLI 完成状态只证明请求完成，不证明触摸命中、动画帧率或真机流畅度。

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

## 月面素材

`theme.moon-atlas` 进入“月海与高地”。`orbit.surface.5` 和 `placement.surface.5` 选择月面草稿，确认按原有规则重建初始条件；相同场景内近看、绕行与全景切换不重载。主题天体保留地球质量与 1 AU 轨道，地图仅用于外观观察，不代表真实地月系统或当前月相。

`getSurfaceInfo` 返回 `moon` 的来源、署名、尺寸、requested、ready、uploads、blend、error、decodedBudgetBytes 和 gpuBudgetBytes。requested 表示当前页面已发出加载请求；ready 表示当前 EGL 上下文已上传，blend 达到 1 才完成淡入，uploads 是当前表面上下文的成功上传次数，不能视为跨进程计数。`getState.rendering` 同时提供 moonReady、moonUploads、moonBlend、moonError；解码错误看 `getSurfaceInfo.moon.error`。原有 texturesReady 不代表月面已就绪。

首次当前场景包含月面时按需解码三维纹理，同进程复用 CPU 数据；失败显示灰色球体，使用 `moon.retry` 显式重试。仅有错误时该动作可用。单图 RGBA 为 8 MiB，含 mip 的 GPU 容量估算约 10.67 MiB，不是进程总内存或峰值实测。来源和边界见 [月面说明](reference/MOON-ASSETS.md)。

月面不使用云、大气、海洋反光与环带，曝光仍有效；这些全局开关仍可为其他行星设置。含 surface 5 的命名实验或 v4 回放需要 0.24.0 及更新版读取，旧版拒绝，不自动替换外观。

验收：`node scripts/test-moon-emulator.mjs 127.0.0.1:5555`；窗口和新按钮命中：`node scripts/test-moon-layout-emulator.mjs 127.0.0.1:5555`。脚本替换当前会话，须先备份并在结束后恢复，不能用于其他设备。
