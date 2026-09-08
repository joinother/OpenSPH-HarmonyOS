# 语义 CLI 操作指南

> 类型：当前操作指南；适用版本：0.56.0；更新日期：2026-09-08（Asia/Shanghai）。

在项目根目录执行命令。CLI 通过 HDC、Want 和 HiLog 与真实应用交互，会启动或前置应用；无需 HTTP 服务。回复按 UTF-8 字节预算限速（约 24 KB/s，含行元数据预算），大响应会比轻量查询慢；超过 256 分片返回明确错误，代理对请求不会自动重试执行。UI 与 CLI 共用动作和输入处理。以运行时 `listCommands`、`getUiState` 返回的字段、单位和可用状态为准。

## 碎片来源与质量表

`fragments.inspect` 打开观察面板并将来源列表置顶，`fragments.material` 恢复热状态优先；两者不重算，`getState.ui.fragmentFirst` 和 `getUiState.fragmentFirst` 可查选择。“按来源看”共用 `color.0`。列表显示每团来自 A／B 的实际质量比例，双方均为玄武岩，不能解释为地核、地幔成分。

`getSphFragments {offset:0,limit:32}` 在 fragments 中返回 originAvailable、originReason、originModel、originMaterial、originNamespace、originIds、originLabels、originTotalsKg、frameIndex，以及每团 originMassKg／originFractions。局部撞击另有 originEventCount 和 originEventTimeSeconds。旧回放没有逐粒子质量时 originAvailable=false。

`getSphFragmentTable {offset:0,limit:32}` 返回同一帧来源元数据、rows、nextOffset 和 17 列 CSV。offset 为 0–10000，limit 为 1–32；nextOffset=-1 表示结束。多页先暂停，并核对 sceneRevision、frameIndex、time 一致；缺失来源质量时拒绝，不用粒子数估算。字段、命名空间和 v20 布局见 [来源质量](reference/FRAGMENT-PROVENANCE.md)。

## 撞击初值与外部潮汐

查询 `getImpactPlan` 读取所选帧最近接触的反弹前三维向量、质量／半径及质心系动能；`withinCurrentBounds` 表示局部岩体尺寸、密度和撞速检查，`contact.tides` 另给冻结潮汐的可用性、原因、来源数量、空间范围与张量。

`orbit.impact.demo` 创建 1 AU 小岩体初态；`orbit.impact.tidesDemo` 创建 0.02 AU 近恒星对照初态。启动后接触处自动暂停，在最新帧选择 `impact.simulate`（隔离）或 `impact.simulateTides`（含外部潮汐）。只有无编辑／撤销历史、无独立环且来源合格时开放。两者均生成真实 SPH 粒子、局部初态暂停在 0 秒，再通过 `simulation.toggle` 运行约 60 秒。

`impact.return` 恢复进入前的原轨道、时间、历史和外观。期间可观察、保存回放，不能修改初值或保存会丢失来源的普通配方。潮汐状态模型为 `sph-orbit-impact-tides-v1`；`simulation.impact` 提供 `tides`、`tidalPotentialJ`、`trackedEnergyJ`、`energyScope`、`sourceTimeSeconds`、`elapsedSeconds` 与 `eventEpochPlusElapsedSeconds`。记录能量不含弹性应变能；时间相加不是父世界推进。

v18 保存轨道事件的同时刻全体来源。新 SPH 写 v20，在基础 v15／v17／v19 上增加实际粒子质量及来源；隔离局部仍不含外部快照。旧 v14／v16／v17／v19 可读；SPH 回放仅供观察，不是求解器续算或父会话存档。模型筛选与布局见 [外部潮汐](reference/IMPACT-TIDES.md)，分支行为见 [局部撞击](reference/LOCAL-IMPACT-SPH.md)。

## 选中天体后操作

先用 `uiAction: focus.N` 选择天体，再使用 `selection.satellite`、`selection.launch` 或 `selection.drop`。共用放置预览、参数输入和 `placement.confirm/cancel`；`getState.placement.parent` 表示母体索引，`promotesContact` 表示确认时将启用估算实体半径。取消保留原模型与时间，确认保留原位置与速度；卫星为二体初始估计，随后参与全部天体的引力。当前没有熔融、破碎或轨道与 SPH 联动。

## 星图视频

`getVideoCapabilities` 查询系统编码能力；`getVideoState` 返回录制状态、本机视频与预览状态。通过 `uiAction` 的 `video.open`、`video.quality.1280`／`video.quality.1920`、`video.start`、`video.stop`、`video.reload`、`video.select.<id>`、`video.preview`、`video.preview.close`、`video.export` 和 `video.close` 共用界面动作。导出会打开系统位置选择器，需用户选择后完成；CLI 可使用 `--timeout 120000`，超时不会取消系统窗口。见 [完整行为与真机验收](reference/VIDEO.md)。不支持 H.264 的设备不启用软件编码。

## 开始使用

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --list
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getState
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getUiState
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"panel.observe"}'
```

`--device` 必填，本任务仅使用 `127.0.0.1:5555`。`--payload-json` 与 `--payload-file` 二选一。`--hdc PATH` 可指定 HDC；`--json` 保留兼容，输出本身已为 JSON。退出码为 0（成功）、2（应用返回失败）、1（参数或传输错误）。

## 星系双向引力

`uiAction` 的 `theme.galaxy-responsive` 载入 600 群／600 Myr 的“恒星也能拉动星系”，`theme.compare` 在同参数的无质量对照之间切换。参数页 `galaxy.responsive` 切换草稿的恒星引力反馈；开启时若超过 800 群会将草稿预算降至 800，应用后生效。`setScene` 的 `galaxyResponsive:true` 仅允许 preset 6、count 200–800，非法输入直接拒绝；省略或 false 保持旧模型。参见 [双向引力定义](reference/GALAXY-RESPONSE.md)。

新模型标识 `galaxy-responsive-v1`，回放 v13；旧模型仍为 `galaxy-tidal-restricted-v1`、v12。新记录的 `parameters.responsive:true`、命名实验及本地参照均保留身份；旧数据缺省 false。CSV 保持 18 列（双实验 19 列），计数标题改为 `stellar_sample_count`，误差标题为 `model_energy_normalized_error`／`model_angular_normalized_error`，按每行 model 解释。新模型误差涵盖恒星群及中心的封闭系统，旧模型仅含两中心。`getGalaxyDiagnostics` 提供 `energyError`、`angularError`、`energyScope`；旧 `centerEnergyError`／`centerAngularError` 仅在旧模型返回，避免误解。

## 盘内天空与地表观察

星系记录准备好后，`galaxy.observer.space`／`galaxy.observer.ground` 动作进入太阳位置类比的观察视角，`galaxy.observer.primary`／`secondary` 指向两中心，`galaxy.observer.exit` 或返回退出。`getGalaxyObserver` 返回固定示踪点身份、位置、帧时间与角度；`getState` 同时返回观察状态和已提交渲染的模式／时间。进入与回放不重算，载入或重建场景退出观察。

`setUiValue` 字段包括 `galaxy.observer.yaw`（±100 rad）、`pitch`（±1.5 rad）、`fov`（35–120°）、`latitude`（±90°）和 `sidereal`（0–24 h）；后两项仅影响地表天空，恒星时独立于 Myr 时间轴。地表 yaw／pitch 为当地北向东的方位角／地平高度，太空为模型盘面角度。界面按钮、滑条与 CLI 共用处理；新模式禁用外部镜头／着色／背景动作，退出恢复。详情和科学边界见 [盘内天空指南](reference/GALAXY-OBSERVER.md)。

可运行 [盘内天空批处理示例](../examples/galaxy-observer-batch.json)：`node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --batch examples/galaxy-observer-batch.json`。它会替换当前实验，计算后定位 240 Myr 并进入地表视角。

## 星系潮汐

`uiAction {"action":"theme.galaxy-tails"}` 与 `theme.galaxy-retrograde` 打开初始暂停的双星系旋转对照；`preset.6` 打开基础星系实验。`setScene` 的 preset 6 使用 200–2400 个示踪点、50–800 Myr 时长，speed 为 0.75–1.25 的接近速度倍率，angle 为次盘倾角 0–70°；可附加 `galaxyMassRatio:0.2..1`、`galaxyOffsetKpc:0..30`、`galaxyRetrograde:boolean`。完整定义和示例见 [星系潮汐指南](reference/GALACTIC-TIDES.md)。

`setUiValue` 的 `galaxy.ratio`、`galaxy.offset` 与通用 scene 字段修改草稿，`galaxy.retrograde` 动作切换旋转方向；`simulation.apply` 才重算。`getGalaxyDiagnostics` 返回当前帧实际时间、kpc 尺度、外延示踪比例及按模型区分范围的守恒量偏差，非星系场景返回 `available:false`。`focus.0`／`focus.1` 连续跟随两个中心；暂停、取消、命名实验、保存／载入及时间轴通用，星系回放为 v12／v13。表面近看、行星曲线和岩体损伤控件在此模型禁用。

### 相遇预览、曲线与 CSV

`galaxy.place` 动作进入初始条件预览，`galaxy.placement.offset` 字段设置 0–30 kpc 的预览偏移；`setGalaxyPlacementPoint {x,y}` 使用当前显示视口的归一化坐标，与真实触摸共用投影。初始 X 间距固定 60 kpc，超出偏移范围的手势停在端点；这是受约束偏移调整。`getGalaxyPlacement` 返回是否预览、预览值、原时间、约束和已显示的两中心位置。普通模拟／编辑命令在预览期间不可用，窗口方向调整仍可使用。

`galaxy.place.cancel` 或返回取消预览并恢复镜头／面板／运行或回放状态，原历史和未应用草稿保留；`galaxy.place.confirm` 才采用预览偏移与当前参数草稿，从零生成初始暂停场景。坐标指针只用于放置，不代替按钮操作。

`galaxy.metric.0`–`galaxy.metric.4` 对应间距、主盘尺度、次盘尺度、主盘外延、次盘外延；`galaxy.minimum`／`galaxy.maximum` 定位所显示曲线的采样极值。`getGalaxyObservation` 返回原始历史与选定指标曲线，`getGalaxyTable` 返回 18 列 CSV、已应用参数和模型说明；原生一次锁定获取参数与历史，未应用草稿不进入导出。Myr 为百万年，CSV 外延比例是 0–1；两项误差只对应两个软化中心，不能代表全部示踪点守恒。非星系场景返回 `available:false` 与空采样／仅 CSV 标题，不伪造数据。

在项目根目录提取 CSV：

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getGalaxyTable > galaxy-table.json
python3 -c 'import json,pathlib; d=json.loads(pathlib.Path("galaxy-table.json").read_text()); assert d["ok"] and d["available"]; pathlib.Path("galaxy-observation.csv").write_text(d["csv"])'
```

此导出包含记录中的诊断序列，没有逐恒星坐标／速度，也没有系统文件选择器。详细列定义和初态约束见 [星系参考](reference/GALACTIC-TIDES.md)。

### 本地星系参照

观察面板与 CLI 共用 `galaxy.reference.capture`（至少两帧）、`galaxy.reference.toggle`、`galaxy.reference.clear`、`galaxy.reference.reload`。保留一个参照，跨切换／重启加载；写入失败保留旧参照，损坏文件显示错误且不自动删除。参数来源为原生原子快照，未确认的草稿不进入参照。

`getGalaxyReference` 返回参照；`getGalaxyComparison` 返回五指标之一的共享坐标、当前数据、保存数据、已应用参数差异与当前时刻差值。时间按实验开始后的 Myr 对齐，仅在参照范围内插值；超出范围不外推。界面比例差用百分点。`getGalaxyObservation` 保留原单实验含义，极值按钮只定位当前记录。

`getGalaxyComparisonTable` 返回两组原始 CSV，19 列＝series 加原 18 列，每行含所属实验的已应用参数。比例为 0–1；不插值、不因隐藏曲线丢弃参照。只有参照时返回 `currentAvailable:false`；`error` 字段说明参照读取错误，不能当作没有差异。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"galaxy.reference.capture"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.compare"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command start --wait-state completed
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getGalaxyComparisonTable > galaxy-comparison.json
python3 -c 'import json; from pathlib import Path; d=json.loads(Path("galaxy-comparison.json").read_text()); assert d["ok"] and not d["error"]; p=Path("galaxy-comparison.csv"); p.open("x").write(d["csv"])'
```

上例先运行“两条潮汐尾”得到至少两帧再保存，`theme.compare` 需要当前实验属于带对照的主题。JSON 保留参照名称与捕获时间，CSV 中参数列对应每组真实记录。文件名已有时示例拒绝覆盖。当前没有系统文件选择器或多参照管理。

## 状态与通用交互

| 命令 | 用途与参数 |
| --- | --- |
| `listCommands` | 查询命令和参数目录；`--list` 是它的快捷方式 |
| `getPreparation` | 只读准备阶段、单调计时、当前请求 ID、阶段事件和上一轮阻塞阶段 |
| `getState` | 读取场景初值、模拟、相机、外观、窗口、编辑与放置状态 |
| `getUiState` / `listUiActions` | 查询动作的 enabled／selected、输入字段和草稿 |
| `uiAction` | `{ "action": "动作名" }`，执行与按钮共用的操作 |
| `setUiValue` | `{ "field": "字段名", "value": "值" }`；值类型遵循目录 |
| `setPanel` | `{ "panel": -1 }` 关闭，0 参数、1 观察、2 实验库 |

常用动作包括 `panel.parameters`、`panel.observe`、`panel.library`、`panel.close`、`ui.back`、`ui.focus`、`ui.restore`、`camera.in`、`camera.out`、`camera.reset`。命令返回表示处理完成，不保证界面动画已结束。

## 实体半径与球体接触

在自定义系统的参数页选择“启用接触”，或选择“球体接触实验”直接查看演示。所有天体必须同时具备 `radiusKm`（1–10000000 km），全部省略仍为旧点质量模型；混用、零值与初始实体重叠会拒绝。质量与半径独立编辑，表面外观不决定材料。

| 动作／字段 | 当前行为 |
| --- | --- |
| `orbit.contact` | 给当前系统估算初始半径并启用接触，支持撤销；已有草稿保留 |
| `orbit.contact.demo` | 加载三个天体的接近实验，暂停并进入局部实体比例视图 |
| `orbit.value.7` | 当前天体的半径字符串，应用后重算初始条件 |
| `placement.value.5` | 接触模式候选天体的尺寸字符串，半径／直径由 `getState.placement.units.size` 指定，确认／取消遵循放置事务 |
| `getState.simulation.contact` | 累计 count、最近一对索引 a/b、timeSeconds、normalSpeedKmS、restitution=1；无事件时 count=0、a/b=-1 |

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"preset.5"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.contact.demo"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command start --wait-state paused
```

确认返回 `simulation.contact.count>0` 才表示接触已发生。接触后自动暂停在响应子步末尾，时间字段仍以儒略年为底层单位，事件额外提供秒；UI 的接触 HUD 与时间轴显示秒。继续会从当前积分状态前进，新版 v14 回放加载后可继续；旧 v11 仍只有观察数据。

模型标识为 `nbody-hard-sphere-v1`；新计算的 v14 保存完整轨道状态，兼容旧 v11 配置半径及每帧累计次数／最近接触，旧格式仍按原模型载入。局部近看按实体半径绘制，概览仍放大标记；局部隐藏无碰撞含义的装饰环。理想弹性响应不是流体行星破裂，详见 [球体接触模型](reference/SPHERE-CONTACT.md)。

## 准备、取消与等待

准备期间主按钮显示“取消准备”（紧凑窗口为“取消”）；观察面板提供“停止实验”。共用动作 `simulation.cancel` 在 preparing／running／paused 有效，停止本次求解并保留已产生的画面和初始条件。之后点击开始会从初始条件重新计算，不从取消帧续算。重复取消会按不可用动作拒绝。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getPreparation
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"simulation.cancel"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command start --wait-state completed
```

`getState.simulation.preparation` 与 `getPreparation.preparation` 同源，后者响应较小。显示实际阶段和秒数；当前阶段 15 秒无推进时 `slow=true`，表示耗时较长，不是已经判定失败。取消是阶段间协作退出；未返回的上游构建函数不会被强制终止。字段和阶段定义见 [准备诊断指南](reference/PREPARATION.md)。

`--wait-state` 关联最初响应中的准备请求 ID，检测到另一个请求时立即失败。等待中取消／求解失败会提前返回；显式等待 cancelled 则可成功。超时或后续状态读取失败时返回 `ok:false`、`error`、最近的 `state` 与 `preparation`，保留最后配置、阶段和耗时，退出码为 2。首次请求尚未获得有效响应的传输错误仍为退出码 1。超时不自动取消、不重复执行，也不重启应用；旧版本没有请求 ID 时保留按状态等待的兼容行为。

## 主题实验库

“碰撞放大镜”用于观察离散采样差异，进入后暂停，点击开始计算。实际粒子数量与预算不同；应用仍采用自适应 Courant 步长，两组末帧时刻可能略有差异。界面不自动叠加 SPH 曲线，比较时核对实际秒数，可先通过 `getSphTable` 导出本次结果。材料与固定步长测试见 [基线说明](reference/SPH-BASELINE.md)。

实验库的“碰撞／探索／我的实验”分类使用 `library.collision`、`library.explore`、`library.saved`；只切换内容，不重建当前场景。`listExperiments` 返回目录版本、十二个主题的完整初始条件、默认镜头、问题和模型说明。

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
| `theme.resolution-coarse` / `theme.resolution-fine` | 碰撞放大镜：200／1200 粒子预算，5 km/s、16 s，其余条件相同 |
| `theme.compare` | 慢撞／快撞或速览／细看切换，恢复另一组完整初始条件 |
| `theme.observe` | 当前 SPH 主题打开压力曲线，保留求解结果、时刻、着色与镜头 |

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

- `orbit.apply`、`orbit.remove` 各记入一次成功的天体初始条件事务，最多保留最近 20 步。无效输入、取消放置不产生历史；成功提交新编辑后清除重做分支。
- `orbit.undo`／`orbit.redo` 恢复天体初始参数、所选编辑对象和各天体草稿；重新创建暂停的初始帧，清空旧轨迹，不恢复历史物理检查点。镜头返回全景，实验时长等全局参数保持当前设置。
- `orbit.discard` 只把当前天体输入还原为已应用值，不改变其他草稿、天体配置、镜头、回放进度或编辑历史。
- `getState` 与 `getUiState` 的 `editor.drafts` 列出所有未应用草稿；`editor.history` 返回 undoCount、redoCount、undoLabel、redoLabel、limit 和 scope。草稿可以含暂时为空的数值，不能据此直接重建场景。
- 应用一个天体只清除它自己的草稿。删除时移除该天体草稿，其他索引随之移动；撤销删除可以找回被删除天体的草稿。天体标签用“草稿”标记未应用输入。
- 历史仅在本次会话内保留，退出应用后不持久化，也不随另存实验或回放保存。切换预设、成功设置新场景、载入实验或成功载入回放会清除旧历史。放置中或回放 I/O 期间禁用撤销／重做；以动作 enabled 为准。

验收脚本 `node scripts/test-edit-history-emulator.mjs 127.0.0.1:5555` 会改写开发模拟器的当前初始条件，切换折叠状态和窗口方向，生成测试截图；它不替代真实手势验收。

## 当前时刻加入天体

先打开轨道预设 3、4 或 5，并通过动作目录确认 `orbit.add` 可用。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.add"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setViewportPlacementPoint --payload-json '{"x":0.7,"y":0.55}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getPlacementPreview
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"placement.confirm"}' --wait-state paused
```

`orbit.add` 冻结当前可见帧并打开主星图预览。预设 3、4、5 均支持；旧回放缺少完整速度时禁用。`placement.confirm` 在同一时刻加入天体，保留原有位置、速度和历史；原先运行则恢复。取消恢复视角与草稿。确认清除初态编辑撤销历史，防止旧初态覆盖当前世界；在过去帧确认会建立新历史分支，取消则保留未来历史。详见 [连续沙盒](reference/ORBIT-SANDBOX.md)。

- `placement.name` 与 `placement.value.0..5` 为字符串；按当前单位依次为质量、距离、方位角、倾角、速度、尺寸，尺寸仅实体模式提供。先读 `getState.placement.units/labels`，不能把局部放置的 kg／km／km/s 误解为倍数／AU。普通 `orbit.add` 默认天文单位；`selection.satellite/launch/drop` 默认公斤、中心距母体表面高度、km/s 和直径。
- `placement.units.physical/astro` 换算整组单位；`placement.units.center/altitude` 切换公里距离基准，`placement.units.radius/diameter` 切换尺寸表达。同一候选的物理值保留；不完整数值拒绝换算，原字符串不丢失。
- 高度为候选中心距母体表面的距离；增大候选半径不会自动移动其中心。`placement.rock` 设置直径 15 km、均匀密度 2700 kg/m³ 对应的质量和荒漠外观；不移动候选、不重置速度。质量与尺寸随后独立可调。最低非恒星质量为 1e-18 太阳质量，实体半径下限仍为 1 km。
- 绝对速度模式更改质量／距离后保持 km/s；倍数模式保持比例。当前输入相对速度上限 100 km/s，另校验相对首颗恒星的完整速度。
- `placement.circular`、`placement.still`、`placement.escape`、`placement.reverse` 设置圆轨道、相对母体静止、1.45 倍圆轨道速度及反向；`placement.surface.0..5` 设置恒星或行星外观。
- `setViewportPlacementPoint {x,y}` 使用整个主视口内 0–1 坐标（左上原点），与主星图轻点／单指拖动共用原生投影逆变换。未呈现放置帧、屏幕尺寸正变化、轨道面接近侧视或距离越界时拒绝，不确认或改写实验。
- `placement.options` 显示／收起数值抽屉，保留候选；`placement.align` 正对当前倾斜轨道面。双指缩放保持候选位置；放置时单指不旋转镜头。
- `placement.target.N` 将相对母体速度指向第 N 个天体的当前位置；目标可以是恒星 0。速度模长由当前速度字段及其单位设置，反向切换指向外侧。不是预测拦截，不保证命中。圆轨道／静止／掠过动作退出瞄准。
- `setPlacementPoint {x,y}` 保留辅助小图内 0–1 坐标，与小图轻点／拖动共用转换，不会自动确认。主视口与辅助小图坐标不能混用。
- `getPlacementPreview` 返回 valid、error、完整候选初值、相对速度、圆轨道／逃逸速度、最近距离和解析引导路径；无效输入不能确认。

`getProjectedBodies.projection` 增加 `placement` 和 `candidate`，表示最近呈现帧是否为放置预览、候选 ID（无有效候选为 −1）；time 为预览初始时刻 0，不能代替 `getState.simulation.time`。放置期间 `pickBody` 拒绝普通天体选择。

圆轨道速度包含恒星与候选质量，候选速度叠加恒星原速度。紫线是二体解析引导，灰点是其他天体当前位置的平面投影。当前最多 8 个实体；绕首颗恒星中心距离 0.05–10 AU；选中其他母体后局部中心距离 0.000001–10 AU，局部速度模长不超过 100 km/s；已有天体可继续演化越出初态编辑范围。

### 复制已有行星

在自定义系统中用 `orbit.select.N` 选择行星，再执行 `orbit.copy`，对应编辑面板的“复制并放置”。仅行星可复制；满 8 个天体、放置中或 I/O 忙碌时禁用。复制读取当前帧的质量与表面，保留未应用的编辑输入；重新生成候选轨道，不复制原速度、局部环时钟或程序自转相位。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.select.1"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"orbit.copy"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setUiValue --payload-json '{"field":"placement.value.4","value":"1.2"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"placement.confirm"}' --wait-state paused
```

副本名称在 48 字符内避免重名，不拆开 Unicode 代理对。新轨道从相对恒星的 XY 平面圆轨道开始，优先采用原始相对距离（初始建议限制在 0.1–8 AU）、错开方位；若越界或占位则尝试其他角度／距离，所有候选仍执行原有速度、坐标、质量与间距校验。未找到可用位置时保留无效预览供修改，不能确认。

`getState.placement` 增加 `sourceIndex` 与 `sourceName`，表示当前复制草稿的来源；普通添加或退出放置后为 −1／空字符串。这是会话提示，不是持久化的天体关联。确认后的新天体独立编辑；后续初态编辑仍使用撤销／重做，插入本身通过历史帧分支回退。主系统正在运行时进入放置会暂停主时钟，回放播放也暂停；取消恢复原有运行／播放状态，确认在当前时刻加入。进入放置仍按既有规则退出局部示踪模式。`getState.placement.target` 为瞄准索引，−1 表示通常的切向模式。

## 轨道观察曲线

观察面板顶部提供“距恒星”和“速度”。曲线目标跟随镜头选择的行星；全景或选中恒星时观察第一颗行星。`getOrbitObservation` 为只读命令，返回 `{ok,metric,data,plot}`：`data` 含场景修订号、目标名称／索引、当前帧选择和最多 240 个 `{frame,time,distanceAU,speedKmS}` 样本；`plot` 含采样范围、轴范围、当前读数和采样极值。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"panel.observe"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getOrbitObservation
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"observation.speed"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"observation.maximum"}'
```

- `observation.distance` / `observation.speed`：切换 AU 距离和 km/s 速率，不改变物理参数或镜头。
- `observation.minimum` / `observation.maximum`：在当前指标的保留记录中寻找最小／最大值，暂停演算并选择相应帧；相等时选择最早保留帧。停止回放播放并退出局部示踪，沿用现有回放语义，新版轨道可通过“时间继续”从该帧建立分支；旧回放不能续算。
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

`theme.kepler-ring` 进入“环为什么会错位”主题；也可选中自定义系统里 `surface:4` 的行星，通过观察面板或 `trace.toggle` 开启。底部切换为独立的 0–24 小时时间轴，主系统保持暂停。退出局部模式不会自动继续主系统。

| 动作／命令 | 行为 |
| --- | --- |
| `trace.toggle` | 开关局部模式，开启时从小时零点开始，并停用外观自转 |
| `trace.play` | 运行／暂停局部小时钟；24 小时结束后再次运行从零开始 |
| `trace.reset` | 小时时间归零并暂停，保留发射速度与倍率 |
| `trace.disturb` / `trace.clear` | 设置 0.25 / 0 局部径向速度注入；强度改变时归零并暂停 |
| `trace.points` | 开关同一批 8192 个可见颗粒，保留环时刻和运行状态；环带仍由它们生成 |
| `setUiValue {field:"trace.impulse",value:0..0.35}` | 局部注入的峰值相对圆轨道速度；不是撞击体或碰撞能量 |
| `trace.controls` | 打开观察面板顶部的调轨区域 |
| `trace.circular` / `trace.ellipse` | 设置 1.00 / 1.12 倍切向发射速度；速度实际改变时归零并暂停 |
| `trace.apoapsis` | 跳到内圈首次远点并暂停；若超过 24 小时，动作禁用 |
| `setUiValue {field:"trace.speed",value:1..1.2}` | 相对每圈圆轨道速度的倍数；改变时重新从近点发射，不重建主星系 |
| `setUiValue {field:"trace.rate",value:0.1..4}` | 每真实秒演示的小时数；保持当前时间和运行／暂停状态 |
| `setUiValue {field:"trace.hours",value:0..24}` | 定位到任意小时并暂停，与滑块共用逻辑 |
| `getRingTrace {particles:true}` | 返回局部状态及前 192 个实际环粒子的位置（km）、速度（km/s）、初始半径与周期（h）；`count=8192`、`returnedCount=192`，不是全量；默认包含点列表 |
| `getRingTrace {particles:false}` | 只返回时钟、质量、假定半径和内外圈周期 |

`getState.ringTrace` 是轻量状态；`getUiState` 包含对应动作和 `trace.hours`、`trace.speed`、`trace.rate`、`trace.impulse` 字段。主系统仍由 `simulation` 字段描述，不能把 `simulation.time` 的年数当成局部小时。`start` 会退出局部模式后启动主系统；`pause` 暂停两个时钟；原有 `seek` 使用保留帧索引。主系统重建、回放操作、切换天体、返回全景和进入放置会退出局部模式。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.kepler-ring"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setUiValue --payload-json '{"field":"trace.hours","value":3}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getRingTrace --payload-json '{"particles":true}'
```

默认每秒演示约 1 小时，可在 0.1–4 小时/秒间调整；后台或长卡顿不补算墙钟时间。8192 个无质量粒子只受所选行星中心引力，假定半径 60000 km，初始距离 76800–133200 km，预设 114000–120000 km 缝隙。静态环使用同一粒子模型的零时刻密度图；开启局部模式后环带和环影随实际粒子位置更新。颗粒开关只控制点显示；`appearance.rings=false` 同时隐藏环带、环影和点。

纯切向参考轨道仍有 e=f²−1、a=r₀/(2−f²)。`eccentricity`、两圈远点、`referenceXKm/YKm`、`referenceRadiusKm`、`referenceSpeedKmS` 是**未施加局部扰动的内缘参考轨道**，不代表全环偏心率或第一个实际粒子。实际轨道叠加零时刻局部径向速度后由偏心率向量和开普勒方程求出；当前距离用粒子 x/y 求模，`radiusKm` 是初始距离。颗粒暖色表示初始圈层，不是温度；密度图映射到透明度，尚无物理光学厚度单位。

`model=restricted-impulse-ring-v3`；`impulse`、`points` 和时钟一起保存为 `ring.modelVersion=2`。0.32.0 及更早版本不会解释新增扰动字段，带扰动的配方需用本版读取。无环模型版本的旧配方按无扰动／隐藏点恢复；未知版本或缺失 v2 字段拒绝载入。载入恢复相同环时刻并暂停，主系统仍从初始条件开始。重新进入局部模式恢复圆轨道、无扰动、隐藏点及默认倍率；椭圆主题设为 1.12 倍。回放文件仍不携带局部环配方。主题 modified 标记仍描述主系统初值。此模型没有颗粒互撞、卫星摄动、环自引力或行星碰撞，详见 [物理主线](reference/RING-AND-COLLISION.md)。

验证入口：`bash scripts/test-ring-trace.sh` 为独立物理与计时基线；`node scripts/test-ring-trace-emulator.mjs 127.0.0.1:5555` 会切换场景、折叠和方向，调用方需事先保存并在结束后恢复会话。椭圆验收使用 `node scripts/test-elliptic-trace-emulator.mjs 127.0.0.1:5555`。详见 [0.20.0 验证记录](releases/RELEASE-0.20.0.md)。

## SPH 碰撞诊断

预设 0–2 的观察面板提供压力、比内能与材料损伤。`uiAction` 的 `color.3`、`color.4`、`color.5` 与三个界面按钮共用处理；无诊断帧时这些动作禁用。0 为原色、1 速度、2 密度。切换着色不重算、不移动时间轴；所选颜色随命名实验配方保存，切入轨道模式时 2–8 恢复为 0。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSphDiagnostics
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"color.3"}'
```

`getSphDiagnostics` 只读取所选帧，返回 `time`、`timeUnit`、`selected`、`frameCount`、`model`、已应用 `config` 和 `diagnostics`；SPH 的时间单位为 `s`，轨道为 `year`，星系为 `Myr`；星系不提供岩体材料诊断。`getState.simulation.sph` 具有同一组诊断字段。`available:false` 时数值字段省略，不能当成零测量。

| 字段 | 单位／含义 |
| --- | --- |
| `pressureMinGPa/MaxGPa/MeanGPa`（完整名如 `pressureMaxGPa`） | 有符号压力，GPa；Mean 为质量加权 |
| `internalMinMJkg/MaxMJkg/MeanMJkg`（完整名如 `internalMaxMJkg`） | 比内能，MJ/kg；Mean 为质量加权 |
| `damageMean`、`damageMax` | 上游标量 DAMAGE 的三次方，0–1；Mean 为质量加权 |
| `kineticJ`、`internalJ` | 所有粒子的动能、内能总量，J；不包含完整弹性／引力能量预算 |

压力色标为蓝 −10／白 0／红 +10 GPa，比内能为深蓝 0 至金色 10 MJ/kg，损伤为青色 0 至红色 1。色标固定且显示饱和；原始读数不裁切。比内能不换算为温度，损伤不代表碎片计数。旧 v7/v8 保存结构记录（分别关闭／开启自引力）；v5/v6 只有原十项材料诊断；v1/v2 缺少此数据时提示重新运行，选择新色号时渲染回退原色。新轨道保存为可续算的 v14，仍读取旧 v3/v4/v11。详情见 [诊断与复现](reference/SPH-DIAGNOSTICS.md)。

### SPH 曲线与原始数据导出

观察面板显示最近 240 帧的真实秒数、所选指标曲线及当前时间轴游标。五种曲线对应：峰值压力（GPa）、质量加权平均比内能（MJ/kg）、质量加权平均损伤（0–1）、总动能（J）、总内能（J）。图形纵轴按记录范围缩放，不裁切负压力；粒子色标仍保持固定。选择压力／比内能／损伤着色时会同步选择对应曲线，独立切换曲线不改变着色或相机。

- `uiAction sph.metric.pressure/internal/damage/kinetic/energy`：用完整动作名如 `sph.metric.pressure` 切换曲线。
- `uiAction sph.minimum` / `sph.maximum`：定位该指标在保留记录中的最小／最大样本；相同极值选择最早一帧，停止自动回放。
- `getSphObservation {}`：只读返回 `metric`、`label`、`data.sceneRevision/selected/samples` 和 `plot`。样本为 `frame,time,value`，只含所选指标，避免超过 CLI 单次上限；`plot` 包括秒数、单位、范围、游标与极值帧。
- `getSphTable {}`：返回全部十项逐帧原始诊断的 CSV、行数、秒单位、场景修订与已应用配置；不插值，不包含绘图坐标。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"sph.metric.pressure"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSphObservation
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"sph.maximum"}'
node scripts/export-sph.mjs --device 127.0.0.1:5555 --output /tmp/sph-run.csv
```

导出另生成同名 `.metadata.json` 来源说明；已有文件拒绝覆盖，失败移除本次新建文件。原生跳帧核对场景修订、帧索引和实际时间，拒绝重算、模型切换或 240 帧滚动淘汰后的旧定位。曲线指标是会话状态，未加入实验配方；所选着色仍按原规则保存。

这些最小／最大值只属于保留采样，不是完整模拟的连续极值，也不能称为自动识别的接触、破碎或月球形成事件。没有诊断的旧回放不生成曲线或 CSV。动能与内能曲线不等于完整能量守恒监控。

## 场景、求解与回放

| 命令 | 行为 |
| --- | --- |
| `setScene` | 必填 preset、count、speed、angle、duration；preset 5 还需完整 orbitBodies；preset 6 使用星系字段与 Myr；验证后事务式设置并准备为 paused |
| `start` / `pause` | 启动或继续／暂停求解；重复 start 不会切换为暂停 |
| `reset` | 重新初始化并暂停 |
| `seek` | `{ "frame": -1 }` 回最新帧，或指定保留帧索引；暂停求解并停止自动回放 |
| `listProjects` / `saveProject` / `loadProject` | 列表／按 title 保存／按 id 载入命名实验配方，最多 50 个 |
| `saveReplay` / `loadReplay` | 异步保存／载入单槽回放；兼容 v1–v13 |

预设 0–2 为 SPH，3 为双体，4 为四体，5 为自定义。完整配置范围以命令目录和应用校验为准。`getState.definition` 是初始条件，`simulation.bodies` 为当前显示的质心参考系数据；SPH 时间单位为秒，轨道为儒略年。

命名实验保存结构保持 `scene.schemaVersion=1`，新增可选的 `recipe`：`schemaVersion=1`、`appearanceVersion=2`、`material`、`themeId`、`camera`、可选全景返回视角 `overview`、`appearance`、`sky` 和 `ring`。`listProjects` 每条新增 `hasRecipe` 与 `themeId`。界面“保存当前实验与视角”与 `saveProject` 共用写入逻辑。

保存采样当前镜头和局部环时钟，不自动暂停正在运行的实验。载入先校验整份文件，再创建暂停的初始场景；环恢复所存小时数、速度与倍率，并保持暂停。主系统时间不保存，不是中途续算；未提交的天体／放置草稿、撤销历史、回放帧、当前面板和窗口方向不在配方内。程序外观动画相位也不保存，因此恢复视角不等于逐像素复原旧帧。

`appearanceVersion=2` 要求完整 `material:{exposure,ocean,cloudShadows}`；v1 外观配方读取时采用 0 EV、海洋反光／云影开启的默认材质，不重写原文件。新的 v2 外观配方不支持旧版应用读取；需要升级应用后打开。光照改进会改变同一旧外观的像素结果。

旧存档缺少 `recipe` 时仍可打开，采用固定默认外观、银河亮度和全景，不继承上一个实验的设置。显式损坏的配方、未知配方／外观版本或不匹配的局部环目标会被拒绝，已有场景保持；损坏条目不影响其他有效实验。详见 [0.21.0 记录](releases/RELEASE-0.21.0.md)。验收入口为 `node scripts/test-recipe-emulator.mjs 127.0.0.1:5555`；它创建并清理自己的验收实验，不覆盖既有存档，但会替换当前会话，调用者需先备份并事后恢复。

回放最多保留 240 帧。新版轨道 v14 保存完整状态，可从所选时刻继续；旧回放及 SPH／星系历史仍不能续算。轨道 `start` 与 `simulation.toggle` 使用持续时钟，超过配方时长仍继续；`time.rate.0.01/0.1/1/10/100` 设置模拟日／现实秒档位，暂停后不积累补算时间。`simulation` 状态包含 `orbitState`、`continuous`、`daysPerSecond`、`actualDaysPerSecond` 与 `orbitRevision`。语义动作还包括 `simulation.toggle`、`simulation.apply`、`replay.toggle`、`replay.latest`、`replay.save`、`replay.load`；时间轴输入为 `time.frame`。

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

近看不再统一隐藏其他天体：目标保持居中放大，其他天体按相对于目标的视线方向投影。旋转镜头会改变可见天体；视野背面、屏幕外或被目标遮住的天体不可见。投影后的深度同时用于绘制和 `pickBody`，被目标挡住的太阳不会抢占点选。过渡仍由原相机请求驱动，不重新加载场景。当前太阳／行星的标记为可读性放大，近看方向投影不是完整自由飞行相机，也不代表真实角直径。

`setAppearance` 接受可选布尔值 clouds、atmosphere、trails、closeup、autoSpin、rings。也可用 `appearance.clouds`、`appearance.atmosphere`、`appearance.trails`、`appearance.spin`、`appearance.rings`。

带环外观使用行星 `surface:4`；`orbit.surface.4` 修改编辑草稿，`placement.surface.4` 修改放置预览，按原有确认流程应用。它与 1 海洋、2 厚云、3 荒漠、5 月面并存；恒星只能使用 0。`rings` 默认开启，只控制带环材质的环面和环影；开关保留时间、轨迹、镜头和场景版本。初始环尺寸与倾斜固定，动态环会随轨道参数和局部扰动形变，未提供任意倾斜或粒径输入；球面仍是点选区域，环面不单独响应选中。

天体材质编号随命名实验及 v4 回放保存；全局环带开关与其他外观选项现随命名实验配方保存，v4 回放仍不包含外观配方。包含材质 4 的文件需本版或更新版读取，旧版会拒绝；本版仍读取旧文件。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"theme.ring-world"}' --wait-state paused
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command setAppearance --payload-json '{"rings":false,"autoSpin":false}'
```

`node scripts/test-dense-ring-emulator.mjs 127.0.0.1:5555` 验证同源动态环、参数保存、跨场景切换和三种窗口布局，会改变当前场景与折叠／方向状态；运行前保存状态，结束由调用方恢复。

`setSky` 接受 mode（0 干净背景、1 星空、2 银河）与 brightness（0–1）；UI 字段 `sky.brightness` 使用 0–100 百分比，不能混用。`getSkyInfo` 返回当前资源来源：摄影就绪时 reference 为 `photographic-panorama`，否则为 `procedural-fallback`；同时返回 ESO/S. Brunier 署名、素材／许可链接、纹理尺寸、loadError 与 rendering。银河摄影为 2048×1024，星空模式仍使用 6500 个程序星点；`proceduralStarsVisible` 描述稳定模式下是否使用程序星点。切换动画中的混合权重另看渲染状态。这不是可定位的星表。

`setCamera` 需要完整 yaw（-100–100）、pitch（-1.5–1.5）、zoom（0.5–15）、focus（-1 或有效天体索引）、color（0–8，轨道模式为 0/1）。普通导航优先使用语义动作。

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

## 逐天体地貌与云层

自定义系统中的虚构行星支持 `setSurfaceSeed`，例如 `{ "body": 1, "surfaceSeed": 731, "cloudSeed": 919 }`。两个种子分别为 0–1000000 的整数；省略的字段保持原值，0 使用旧生成规则。恒星与真实月面不接受非零种子。该命令与界面的外观操作共享事务，不改变模拟初值、时间、回放选帧或相机。

观察面板提供 `terrain.new`、`terrain.clouds`、`terrain.undo`、`terrain.redo`。按钮作用于已聚焦的行星，未聚焦时作用于编辑器选中的行星；标签显示名称。外观历史最多 20 次，独立于质量／轨道历史；增加、删除或应用天体初值后清空外观历史，天体历史本身保留该次对应的外观配方。

`getState.surfaces` 按当前天体次序返回 `{version:1,seed,cloudSeed}`。排序变化由复制／删除事务同步处理，种子不会按新数组索引重新推算。`surfaceUndoCount`／`surfaceRedoCount` 返回外观历史数量。`rendering.surfacePending` 为后台待完成天体数，`surfaceGenerated` 为已得到当前配方 CPU 纹理的天体数，`surfaceError` 为生成或上传失败；`surfaceGenerated` 不是性能指标或逐天体 GPU 上传回执。命令返回不代表纹理与 350 ms 过渡已完成。

命名实验采用外观配方 v3，保存种子、生成版本和现有观察设置。v1／v2 和无配方存档读取后使用旧地貌，不改写原文件。回放文件仍不包含外观配方。实现、预算与限制见 [行星独立外观](reference/SURFACE-GENERATION.md)。

## SPH 材料自引力

岩质参数面板的“材料自引力”与 `uiAction {"action":"scene.gravity"}` 共用动作；只修改草稿，调用 `simulation.apply` 后重新计算。`getUiState.actions` 返回开关选中状态；`getState.definition.config` 为草稿，`simulation.config` 为当前求解配置。超过 1200 粒子预算时须先降低预算，不能启用。

`setScene` 可传 `selfGravity:true`，仅适用于 preset 0–2、count 200–1200；省略或 false 使用旧模型。字符串、null、轨道预设或过大预算会在改变当前实验前被拒绝。模型标记为 `sph-rock-gravity-v1`，无自引力仍为 `sph-rock-v1`。命名实验校验模型与布尔值一致；旧应用拒绝新模型，避免静默丢失物理设置。回放 v6 使用与 v5 相同的帧布局，以版本号标明自引力；旧版回放按原样读取。

采用上游逐对求和及 SPH 三次样条软化，每一步重新计算。此开关不影响环；未加入静力平衡、分层行星或碎片再聚合。验证方法见 [自引力基线](reference/SPH-GRAVITY.md)。

## SPH 结构与能量

`uiAction` 新增 `sph.metric.gravity`、`sph.metric.relativeKinetic`、`sph.metric.radius`、`sph.metric.radial`，与观察面板四个按钮共用动作；`sph.minimum`／`sph.maximum` 定位保留样本的极值。界面回看不重建物理场景。

`getSphDiagnostics.diagnostics.structure` 及原生 `sphObservation.samples[].structure` 为可选四元素数组，顺序是软化引力势能 J、质心系相对动能 J、距质心均方根距离 km、质量加权平均径向速度 m/s。旧回放省略数组，不伪造零值。结构缺失时新指标动作不可用；已经选中的新指标显示无数据，不输出虚构曲线样本。

`getSphTable` 的新 CSV 在原 12 列之后追加 `gravity_J,relative_kinetic_J,rms_radius_km,radial_velocity_ms`，共 16 列。旧回放仍导出 12 列。`scripts/export-sph.mjs` 校验两种表头和完整有限数值行，保存原样 CSV 及来源元数据；下游应按表头识别列。

旧版结构回放 v7/v8 在每帧原材料记录之后追加四个 double；物理模型配置不变。v1–v6 按原版本读取，重新保存旧回放不会捏造结构数据。全部材料的分布尺度不是单颗行星表面半径，径向速度不是碎片数量或再聚合判据，势能也不能补齐尚缺的弹性应变能。见 [定义与验证](reference/SPH-STRUCTURE.md)。

## SPH 预松弛

`setScene` 可附加 `relaxationSeconds:16` 或 `64`，需要 preset 0–2、`selfGravity:true`、预算不超过 1200；省略或 0 直接生成。其他数值、字符串、null 或未开启自引力会在改变场景前被拒绝。

`scene.relax.0`、`scene.relax.16`、`scene.relax.64` 与参数面板三个按钮共用动作，只修改草稿；调用 `simulation.apply` 才准备新场景。关闭自引力会清除准备草稿。`getUiState.actions` 提供选中／可用状态，`getState.definition.config` 和 `simulation.config` 分别给出草稿和当前物理配置。准备期间可用 `getPreparation` 查看 `relax-target`／`relax-impactor`，通过 `simulation.cancel` 取消；等待时可指定 `--timeout 120000`，超时不自动取消请求。

实验库动作 `theme.direct-impact` 与 `theme.prepared-impact` 提供两组相同基础参数的对照，可用 `theme.compare` 切换并重新准备。模型身份为 `sph-rock-prepared-v1`，命名实验必须与正的准备时长、自引力设置相符。旧 v9 回放在原 108 字节配置头之后增加准备时长 double，再写原 v8 帧内容；旧 v1–v8 仍按原物理身份读取，未保存的准备参数不会补造。旧应用应拒绝新模型／版本。

预松弛期间的耗散不属于碰撞历史，准备完才施加自转／撞击速度，首帧从 0 秒开始。16／64 秒为计算时长而非设备等待时长，也不是平衡或长时稳定保证。详见 [物理流程与对照](reference/SPH-RELAXATION.md)。

## SPH 两次实验对照

在观察面板保存本次结果后，可切换主题或修改参数重新运行。SPH 参照与轨道参照分别保存；替换和移除只影响对应参照，不改当前模拟。参照是最多 240 帧的诊断记录，不能从其中恢复物理求解。

| 动作／命令 | 行为 |
| --- | --- |
| `uiAction` → `sph.reference.capture` | 保存或替换本次 SPH 结果，使用已应用的模型、参数和实际粒子数；至少两帧 |
| `uiAction` → `sph.reference.toggle` | 显示／隐藏金色参照；不改变导出数据 |
| `uiAction` → `sph.reference.clear` | 移除本地 SPH 参照 |
| `uiAction` → `sph.reference.reload` | 重新读取本地参照，损坏时报告错误并保留原文件 |
| `getSphComparison` | 九种指标之一的共用坐标、原始模型参数、差异清单、重叠状态、游标插值差值和参照摘要 |
| `getSphReference` | 完整已保存参照或 null，以及读取错误 |
| `getSphComparisonTable` | 当前指标的两组原始 CSV，最多 480 行，附单位、参数、窗口范围和可用标记 |

指标由已有 `sph.metric.pressure/internal/damage/kinetic/energy/gravity/relativeKinetic/radius/radial` 动作选择。青色当前、金色参照，按各自模拟开始后的秒数对齐；不平移窗口首帧、不在范围外外推。差值仅为当前游标时刻的线性插值显示，CSV 保留实际采样；两组记录长度可不同。旧回放缺少结构指标时不填零，返回不可用状态；导出不包含缺失的系列。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"sph.reference.capture"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSphComparison
node scripts/export-sph-comparison.mjs --device 127.0.0.1:5555 --output /tmp/sph-comparison.csv
```

导出同时写同名 `.metadata.json`，已有文件不会覆盖；仅导出当前选中指标，完整十／十四项诊断仍使用 `getSphTable`，已保存参照的全部诊断在 `getSphReference` 中。详细定义见 [SPH 对照](reference/SPH-COMPARISON.md)。

## 静止岩球与记录窗口

单体 preset 2 的 `speed` 可设为 0；其总初始角速度仍为 `targetSpin + speed*0.003`。`uiAction {"action":"scene.stationary"}` 同时清零两项草稿，不改当前求解；仅适用于单体，之后应用参数才重建。正碰／掠碰不接受零速度。UI 显示总初始角速度，零自转可通过 v10 回放与命名实验保存，兼容旧 v8/v9。

`theme.sphere-unprepared`／`theme.sphere-release` 分别运行直接静止初态与 64 秒预松弛后释放的岩球，正式自由演化 32 秒，可通过 `theme.compare` 切换。此时使用普通材料与自引力求解，不再使用准备阻尼。

`getSphWindowSummary` 返回当前应用配置及 `summary`：`available`、`reason`、`sceneRevision`；可用时另有 `firstTime`／`lastTime`（秒）、`samples`、`includesInitial`、`maxRadiusChangePercent`、`meanKineticJ`、`peakAbsRadialMS`。统计包含全部保留记录，与回放选中帧无关；不是稳定性结论。无数据、单帧、旧回放缺失结构或非法数据时不返回数值字段。

CLI 回复限制为 128000 个 UTF-16 编码单元、256 片，保留原发送节流和输入限制，支持满 240 帧的 16 列 CSV；较旧 CLI 仍可能拒绝超过 128 片的回复，请使用本版本脚本。指标定义、时间加权和初始帧淘汰说明见 [自由演化基线](reference/SPH-RELEASE.md)。

## SPH 材料团块

观察面板的“材料团块”与 `uiAction {"action":"color.6"}` 共用动作；旧回放无分组时禁用。着色按当前材料的几何连接计算，不改求解器、镜头位置或当前时间。列表每页 8 团，`fragments.previous`／`fragments.next` 控制翻页。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSphFragments --payload-json '{"offset":0,"limit":8}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"color.6"}'
```

`getSphFragments` 只读所选帧；offset 为 0–10000，limit 为 1–32，均为整数。响应 `fragments` 中包含 `available`、`reason`、`sceneRevision`、`selected`、`time`（秒）、`method`、`linkScale`、`offset` 和 `groups`。可用时另有 `groupCount`、`particleCount`、`totalMassKg`、`singletonCount`、`singletonMassKg`、`largestMassFraction`、`nextOffset`；末页 nextOffset 为 -1。

每团返回本帧质量排名 `rank`、最小粒子序号 `anchor`、`count`、`massKg`、`massFraction`、`centerKm[3]`、`velocityKmS[3]`、`rmsRadiusKm`。翻页期间应核对场景修订、所选帧与时间，运行中不同查询可能对应不同帧。排名和 anchor 都不是永久碎片身份。

新计算的材料回放为 v20，保留基础 v15 的材料初态／响应及 v10 的分组、自引力／预松弛配置，并增加逐粒子来源质量。v1–v9 没有团块数据，不能仅凭绘制位置重建；再次保存仍保留旧版，不补零或捏造分组。连接规则固定为距离不超过 1.5 倍平均光滑长度，低分辨率下相邻材料可能提前连通。几何定义见 [材料团块](reference/SPH-FRAGMENTS.md)，新字段见 [材料响应](reference/SPH-MATERIAL-RESPONSE.md)。

## 连续跟随材料团块

观察面板提供“跟随最大团块”“跟随”“停止跟随”，分别共用 `fragments.largest`、`fragments.follow.<anchor>` 和 `fragments.stop` 动作。按本帧最大团块选择一次后，继续跟随其中的材料点，不每帧改选质量第一名。列表动作只覆盖当前可见数据页，跨页自动化可用显式命令。

```sh
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"fragments.largest"}'
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command getSphFragmentFollow
node scripts/opensph-cli.mjs --device 127.0.0.1:5555 --command uiAction --payload-json '{"action":"fragments.stop"}'
```

`followSphFragment {particle,sceneRevision}` 接受所选场景中的材料粒子序号 0–9999 和 `getSphFragments` 返回的场景修订（必须为当前修订）。通常使用某团 anchor 作为 particle；支持非 anchor 的有效粒子序号。越界、过期场景或旧回放缺失分组时拒绝，保留当前跟随目标。

`getSphFragmentFollow` 返回 `follow`，与 `getState.rendering.fragmentFollow` 相同：`active`、`moving`、`seed`、当前 `anchor/rank/count`、`sceneRevision`、`time`（秒）和目标 `centerKm[3]`。这是最近渲染帧状态，命令接受不代表过渡已经完成；静止回放应等 active=true、seed 匹配且 moving=false。持续运动时 moving 可以保持 true。`getState.rendering.centerX/Y/Z` 为实际显示中心，单位为 100 km，过渡中与目标质心不同。

改变颜色、旋转、缩放、翻页、折叠与屏幕方向保留跟随。`fragments.stop` 平滑返回选择前的常规观察目标；`focus.all` 返回全景，普通天体选择／视角复位结束团块跟随。返回键先关闭面板，之后结束团块跟随，再按既有逻辑处理。显式 `setCamera`、重新加载回放或更换实验结束跟随，防止粒子序号被用于另一场景。

跟随是当前观察状态，不写入实验配方或回放；跟随本身不增加回放字段；当前新 SPH 回放为 v20。分裂时跟随包含种子材料点的分支，连接时跟随合并团块；这不代表完整碎片谱系、引力束缚或再聚合。见 [定义与验证](reference/FRAGMENT-FOLLOW.md)。

## 命令返回的丢段恢复

回复经过有界日志通道分段传输。客户端收到部分回复但超过 2 秒没有新片段时，会使用同一请求 ID 请求 `retryReply`，最多 3 次；应用只重发最近 8 份缓存结果，不重新执行动作。此命令是传输内部恢复机制，普通操作继续使用语义动作。没有收到任何片段或缓存已过期时仍可能超时；此时先查询当前状态，不能盲目重复加入天体等操作。

## 破坏与热软化实验

`setScene` 新增可选 `initialEnergyMJkg:0..6.8` 与 `initialDamage:0..1`，省略为 0，对两颗岩体生效。它们参与实际材料求解。非零时仅支持 SPH 直接生成初态，拒绝轨道／星系／预松弛组合。

UI／CLI 共用 `scene.energy` 和 `scene.damage` 数值字段；编辑后 `simulation.apply` 重新生成。主题为 `theme.material-cold`、`theme.material-hot`、`theme.material-fractured`；`theme.compare` 切换对照会从初态重新开始。

观察动作 `color.7` 为热软化外观，`color.8` 为剩余屈服强度，均不重算。`getSphDiagnostics` 的 `diagnostics.response` 包含 `model`、`meltEnergyMJkg`、`intactYieldGPa`、质量加权的 `softeningMean`、`zeroShearMassFraction`、`damagedMassFraction` 和 `strengthMean`。旧回放缺少 response 时这两个动作禁用；颜色来自配方或 setCamera 时回退原色。

这不是温度／液相比例，零剪切屈服也不意味着压力消失。新 SPH 回放 v20 保留材料初态与逐帧响应（兼容 v15），仍不能恢复完整求解器。详见 [模型、单位与验证](reference/SPH-MATERIAL-RESPONSE.md)。
