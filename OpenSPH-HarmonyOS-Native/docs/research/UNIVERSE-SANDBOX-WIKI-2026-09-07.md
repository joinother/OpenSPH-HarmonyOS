# Universe Sandbox Wiki：功能补充、资料核对与实验路线

> 类型：调研补充；调研日期：2026-09-07（Asia/Shanghai）；对照源码版本：0.20.0；本轮为文档交付，尚未实现下列新增功能。

## 这次最有价值的发现

Wiki 提供了比博客更细的交互线索：分步引导、暂停到某个事件、单步运行、参数锁定、测量参考系、表面数据检查以及拍照连同实验保存。它还指出一条值得继续验证的科研工具路径：用 WoMa 构建平衡行星和 SPH 初始条件，帮助后续自引力碰撞摆脱随意堆粒子的初始状态。

新增实验以“能观察到什么”为中心：凌星亮度曲线、恒星摆动、平衡双星、静止投放与绕行对照、云层外观编辑，以及未来的材料结构与局部加热实验。它们补充 [博客与论坛的 32 项改进、14 个实验](UNIVERSE-SANDBOX-BLOG-FORUM-2026-09-07.md)，不替代原先“保存与对照 → 环扰动 → SPH 诊断与自引力”的顺序。

## 覆盖范围

这不是 Wikipedia 的维基百科，而是 Fandom 上由玩家维护的 Universe Sandbox Wiki。虽然站名带 Official，站内仍明确说明文章不保证经开发团队审核。[站内说明](https://universesandbox.fandom.com/wiki/Universe_Sandbox_Wiki%3AGeneral_disclaimer)

普通网页请求出现 402／403，但公开 MediaWiki API 可以正常读取。本轮使用公开接口获取正文命名空间的完整目录及每页最新修订，无需登录；没有绕过账户或付费访问。

| 项目 | 完成范围 |
| --- | --- |
| 正文命名空间目录 | 374 页，API 没有返回后续分页标记；每个 page ID 均已取得修订内容 |
| 页面结构 | 33 个重定向、23 个只有 stub 模板的占位页、1 个空页、317 个其他文本页；最后一类不代表都有效 |
| 筛选 | 全部标题、导语与结构筛选；重点阅读 66 页正文，涵盖工具、界面、外观、物理、数据和实验 |
| 时效 | 337 页最新修订不晚于 2022 年；最近修订日期也不能证明所有正文已经更新 |
| 交叉核对 | 官方 Update 34、35、36，NASA 系外行星说明，WoMa／ExoPlex 项目与许可 |
| 未穷尽 | 用户页、讨论页、模板、分类、文件命名空间；嵌入图像／视频、附件、历史修订和渲染后的实际操作 |

[完整页面索引与核对记录](../evidence/universe-sandbox-wiki-index-2026-09-07.json) 保留每页 URL、page ID、revision ID、UTC 修订时间、重定向目标、阅读范围及内容摘要校验值。374 页是索引与筛查覆盖，不是声称逐字精读整站。正文、贴图、视频与页面代码不打包进入本项目。

## 需要纠正或搁置的说明

| 页面与所取修订 | 问题 | 本项目处理 |
| --- | --- | --- |
| [Materials](https://universesandbox.fandom.com/wiki/Materials?oldid=2429) | 2025 年修订仍写只有四种材料，列项本身也不一致 | 以官方 2023 年 Update 34 的 12 种材料公告核对，不能拿页面修订年份判断内容新旧 |
| [Orbital Parent](https://universesandbox.fandom.com/wiki/Orbital_Parent?oldid=1221) | 2019 年正文说轨道父对象不可由用户直接更改 | 结合 Update 35 的父对象／质心编辑；不把旧界面限制带到鸿蒙设计 |
| [Non-Spherical Gravity](https://universesandbox.fandom.com/wiki/Non-Spherical_Gravity?oldid=2186) | 2021 年说明仍将非球形引力作为实验入口 | Update 36 已公布 J2 更新；其碰撞仍按球形的边界另行保留 |
| [Keyboard Controls](https://universesandbox.fandom.com/wiki/Keyboard_Controls?oldid=2267)、[Photo Tool](https://universesandbox.fandom.com/wiki/Photo_Tool?oldid=1966)、[Video Tool](https://universesandbox.fandom.com/wiki/Video_Tool?oldid=1969) | F10／F12 对应拍照或录像的说明互相矛盾 | 不照抄快捷键；由我们的语义动作目录生成帮助，再实际验收 |
| [Clouds Appearance](https://universesandbox.fandom.com/wiki/Clouds_Appearance?oldid=2346) | 云图周期公式写成 `R/(2πv)` | 周期应由圆周距离除切向速度得到 `2πR/v`；这是独立代数核对，不是验证 Wiki 的整套风场模型 |
| [Velocity Vector](https://universesandbox.fandom.com/wiki/Velocity_Vector?oldid=1251) | 开头将速度向量描述成三维位置 | 为本项目字段标注准确含义与单位，不能复制错误定义 |
| [Momentum Conservation](https://universesandbox.fandom.com/wiki/Momentum_Conservation?oldid=2388) | 等式中出现异常下标 `V_1000` | 物理公式回到推导、论文和独立测试，不从该公式直接生成代码 |
| [Stellar Evolution](https://universesandbox.fandom.com/wiki/Stellar_Evolution?oldid=2352)、[Argon](https://universesandbox.fandom.com/wiki/Argon?oldid=2437) | 所取正文紊乱或不完整 | 排除为功能证据，也不推断是谁造成了这些问题 |
| [N-Body Simulation](https://universesandbox.fandom.com/wiki/N-Body_Simulation?oldid=2209)、[Tools Menu](https://universesandbox.fandom.com/wiki/Tools_Menu?oldid=1909) | 前者含无关尾句，后者大量动作只有标题 | 可用来发现检索词，不能据此断言算法性能或动作细节 |
| [Life Likelihood](https://universesandbox.fandom.com/wiki/Life_Likelihood?oldid=2385)、[Life Simulation](https://universesandbox.fandom.com/wiki/Life_Simulation?oldid=2351) | 名称容易使人误以为计算了生命存在概率或演化 | 暂不引入“生命概率”；若以后做相似性比较，需说明指标定义与模型假设 |

版本核对见官方 [Update 34](https://universesandbox.com/blog/2023/12/terraforming-update-34/)、[Update 35](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/) 和 [Update 36](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/)。Wiki 的碰撞篇还描述了较早的球体交叠与碎片模型；不能将其中常数或流程直接视为当前版本的私有实现。[Collision](https://universesandbox.fandom.com/wiki/Collision?oldid=2266)

另外，Wiki 的 Sim Settings 中 Self-Gravity 指的是若干依赖引力的功能开关；它不能证明已经存在 SPH 粒子间自引力求解。我们报告里的“启用自引力”仍指实际物理模型及其数值验证。[Sim Settings Menu](https://universesandbox.fandom.com/wiki/Sim_Settings_Menu?oldid=2280)

## 18 项补充设计

W 编号是本次建议；B 编号对应上一份调研的 01–32 项。这里的功能均是本项目方案，Wiki 只提供设计线索。P0 为已有流程的补全，P1 为相邻扩展，P2 为物理模型研究。

| 编号／优先级 | 补充方案 | 与已有路线的关系、最小范围与验收 |
| --- | --- | --- |
| W01 P0 | 可退出、可重启的分步实验引导 | 扩展 B05。每一步绑定可检查的应用状态，完成操作才前进；折叠与重开面板不丢进度。[Guides](https://universesandbox.fandom.com/wiki/Guides?oldid=2402) |
| W02 P1 | 单步运行与到时暂停 | 扩展 B06。区分推进一个物理步和查看下一回放帧；先做指定时刻，实体碰撞事件需等相应模型。[Advance One Time Step](https://universesandbox.fandom.com/wiki/Advance_One_Time_Step?oldid=1821) [Interface](https://universesandbox.fandom.com/wiki/Interface?oldid=2333) |
| W03 P0 | 告诉用户为什么不能继续加速 | 扩展 B25。显示目标／实际倍率、限制原因和相关对象；没有误差归因时写“未测得”，不编造拖慢者。[Sim Settings Menu](https://universesandbox.fandom.com/wiki/Sim_Settings_Menu?oldid=2280) |
| W04 P1 | 静止、环绕、双星、发射各有明确速度语义 | 扩展 B09。先在初始条件草稿提供模式与预览；双星平衡会改两个对象，必须作为同一事务。[Add Tool](https://universesandbox.fandom.com/wiki/Add_Tool?oldid=1941) |
| W05 P1 | 替换天体时选择保留哪些条件 | 新增对照方式。可以保留位置／速度，质量变化必须显示；不能把保留速度说成保留原轨道或能量。[Replace Object](https://universesandbox.fandom.com/wiki/Replace_Object?oldid=1995) |
| W06 P1 | 分清四种“锁定” | 扩展 B13。参数联动锁、固定位置、停止显示自转、相机跟随表面分别命名，避免用户误以为冻结了物理过程。[Locked Properties](https://universesandbox.fandom.com/wiki/Locked_Properties?oldid=2432) [Position Lock](https://universesandbox.fandom.com/wiki/Position_Lock?oldid=749) [Rotation Lock](https://universesandbox.fandom.com/wiki/Rotation_Lock?oldid=1818) [Surface Lock](https://universesandbox.fandom.com/wiki/Surface_Lock?oldid=2327) |
| W07 P1 | 显式选择测量参考系 | 扩展 B09／15。相机跟随、轨迹中心、数值参考对象独立；统一显示距离和速度相对谁计算。[Relative to](https://universesandbox.fandom.com/wiki/Relative_to?oldid=982) [Displayed Trail](https://universesandbox.fandom.com/wiki/Displayed_Trail?oldid=2306) |
| W08 P1 | “物理位置、轨道推算、历史轨迹、未来预测”分开 | 扩展 B27。图例给出线型和时间范围，未来预测标模型与有效窗口；仅历史位置可以称已发生路径。[Displayed Orbit](https://universesandbox.fandom.com/wiki/Displayed_Orbit?oldid=2305) [Displayed Trail](https://universesandbox.fandom.com/wiki/Displayed_Trail?oldid=2306) |
| W09 P1 | 属性搜索与按需打开曲线／剖面 | 扩展 B07／20。先把已有质量、距离、速度、内能入口联通；手机保留一个主视图，二维／三维选点同步。[Graph](https://universesandbox.fandom.com/wiki/Graph?oldid=2073) [View Panel](https://universesandbox.fandom.com/wiki/View_Panel?oldid=2052) [Surface Map](https://universesandbox.fandom.com/wiki/Surface_Map?oldid=2313) |
| W10 P1 | 密集目标选择和焦点失效处理 | 扩展 B14／15。重叠天体提供候选列表；目标被删时先保持镜头，再让用户选择残骸或全景，不突然跳到任意近邻。[Game Settings Menu](https://universesandbox.fandom.com/wiki/Game_Settings_Menu?oldid=2221) |
| W11 P1 | 双层云与气态条纹的原创外观配方 | 扩展 B17。两层云分别设种子、覆盖率、透明度与动画速度；条纹可增删换序。参数只影响外观时明确标识。[Clouds Appearance](https://universesandbox.fandom.com/wiki/Clouds_Appearance?oldid=2346) [Band Colors](https://universesandbox.fandom.com/wiki/Band_Colors?oldid=2310) |
| W12 P1 | 物理半径与便于观察的显示大小分离 | 扩展 B20／21。小目标可有最小像素标记，但距离、接触判断和凌星遮挡仍使用真实模型半径。[View Settings Menu](https://universesandbox.fandom.com/wiki/View_Settings_Menu?oldid=2278) |
| W13 P1 | 凌星亮度与视向速度两类测量 | 新增轻量实验方向。固定虚拟观测者、采样时间和对象，拖动浏览镜头不篡改已经记录的曲线。[Normalized Light Curve](https://universesandbox.fandom.com/wiki/Normalized_Light_Curve?oldid=1248) [Radial Velocity](https://universesandbox.fandom.com/wiki/Radial_Velocity?oldid=1246) |
| W14 P1 | 拍照附带可复现实验配方 | 扩展 B08。干净画面／带数据画面可选；先本地保存图片、配方和版本，不默认上传。录制作为后续独立能力。[Game Settings Menu](https://universesandbox.fandom.com/wiki/Game_Settings_Menu?oldid=2221) [Photo Tool](https://universesandbox.fandom.com/wiki/Photo_Tool?oldid=1966) [Video Tool](https://universesandbox.fandom.com/wiki/Video_Tool?oldid=1969) |
| W15 P1 | 一键添加已知伴星／卫星组时避免重复 | 扩展 B03／09。首次展示待加入列表，再次操作只补缺失项；有意复制另设入口，预算超限前提示。[Add Moons to Planet](https://universesandbox.fandom.com/wiki/Add_Moons_to_Planet?oldid=1243) [Add Planets to Star](https://universesandbox.fandom.com/wiki/Add_Planets_to_Star?oldid=1245) |
| W16 P2 | 热量、流动和轨道分别报告稳定步长 | 扩展 B23／32。未来多物理模型不可只靠轨道限速；数据降级、暂停或简化方式进入配方。[Temperature Stable Simulation Speed](https://universesandbox.fandom.com/wiki/Temperature_Stable_Simulation_Speed?oldid=2102) [Water Stable Simulation Speed](https://universesandbox.fandom.com/wiki/Water_Stable_Simulation_Speed?oldid=2103) |
| W17 P1 | 记录对象预算造成的损失 | 扩展 B25。分开记录用户删除、边界外流、数值失败与预算裁减；不把数量下降全部显示成自然蒸发。[Stats Menu](https://universesandbox.fandom.com/wiki/Stats_Menu?oldid=1796) [Mass Conservation](https://universesandbox.fandom.com/wiki/Mass_Conservation?oldid=1183) |
| W18 P2 | 建立平衡行星／粒子初值的独立参考流程 | 扩展 B30／31。先研究 WoMa 输出、材料与单位映射，再测试当前 OpenSPH 能否稳定保持单体。[Radius from Composition](https://universesandbox.fandom.com/wiki/Radius_from_Composition?oldid=2408) |

关于 W13，凌星会降低观测到的恒星亮度，行星的引力也会使恒星产生可测的视向运动；这两个基本原理由 [NASA 的系外行星说明](https://science.nasa.gov/exoplanets/facts/) 核对。我们的首版应标明理想化观测模型，而不是模拟真实望远镜的全部噪声、大气或光谱系统。

## 八个新增实验方向

以下是本项目原创题目和拟议操作，不是复制 Wiki 或游戏内存档。除明确标注的已有基础之外，均待实现。

| 题目 | 互动和观察结果 | 当前依赖与完成门槛 |
| --- | --- | --- |
| 关掉行星标签，你还能找到它吗？ | 固定观测者，改变行星半径／倾角，观察亮度下降 | 新增凌星测量；需要独立物理半径，不能按夸张绘制尺寸算遮挡。基础原理已由 NASA 核对。[Normalized Light Curve](https://universesandbox.fandom.com/wiki/Normalized_Light_Curve?oldid=1248) |
| 恒星也会被拉着走 | 改变行星质量，看恒星视向速度曲线和质心位置 | 现有多体积分可作为起点；采样使用固定观测者，镜头缩放不改曲线。[Radial Velocity](https://universesandbox.fandom.com/wiki/Radial_Velocity?oldid=1246) |
| 两颗太阳一起绕 | 选择两个质量接近的天体，对比是否平衡系统动量 | 新增双星草稿模式；确认同时更新两体；重心漂移与相对轨道分别验证。[Add Tool](https://universesandbox.fandom.com/wiki/Add_Tool?oldid=1941) |
| 放在这里，为什么会掉下去？ | 对照静止投放与圆轨道速度，显示速度箭头 | 局部中心引力扩展；靠近模型边界就停止，不冒充已模拟落地或撞击。[Auto Orbit](https://universesandbox.fandom.com/wiki/Auto_Orbit?oldid=1999) |
| 同样的能量，集中还是摊开？ | 固定总功率与作用时间，改变受热斑点大小 | 远期局部热模型；首版不带“冷激光”物理宣传；核对能量输入、面积和热容量。[Laser Tool](https://universesandbox.fandom.com/wiki/Laser_Tool?oldid=1954) |
| 为同一颗星球换三种天空 | 调两层云、气层透明度、条纹配色，比较相同光照下外观 | 可在原创程序渲染基础上扩展；保存种子与参数，不宣称是天气预报。[Clouds Appearance](https://universesandbox.fandom.com/wiki/Clouds_Appearance?oldid=2346) [Atmosphere Appearance](https://universesandbox.fandom.com/wiki/Atmosphere_Appearance?oldid=2329) |
| 一笔山脉，一片海 | 先编辑地形，再观察不同液面或材料覆盖 | 先做高度／颜色的外观编辑；实际液体流动要等表面数据和求解器，不把贴图变化称为海水模拟。[Planetscaping Tool](https://universesandbox.fandom.com/wiki/Planetscaping_Tool?oldid=2231) [Elevation Map](https://universesandbox.fandom.com/wiki/Elevation_Map?oldid=2339) |
| 同样的质量，为什么大小不同？ | 比较不同内部材料的半径与分层结构 | 远期行星结构模型；先在桌面生成参考曲线，再评估鸿蒙展示与计算。[Radius from Composition](https://universesandbox.fandom.com/wiki/Radius_from_Composition?oldid=2408) |

实验库可以按“创造、观察、碰撞、进阶”组织，附设备预算与模型说明；不必照搬 Wiki 列出的全部类别。编舞轨道和混沌实验应把初值敏感性、积分误差与高倍率引起的不稳定分别解释。[Included Simulations](https://universesandbox.fandom.com/wiki/Included_Simulations?oldid=2370)

## WoMa 与 ExoPlex 的具体用途

Wiki 的内部结构页提供了两个公开项目线索。已查看项目介绍与许可文件；本轮没有安装、运行或导入二者代码，也没有完成其公式与实现审计。

| 项目 | 已核实的用途与许可说明 | 本项目建议 |
| --- | --- | --- |
| [WoMa](https://github.com/srbonilla/WoMa) | 生成旋转／非旋转行星的平衡结构和 SPH 初始粒子；README 声明 GPLv3+，含 Python、Numba、h5py 等依赖。[许可](https://github.com/srbonilla/WoMa/blob/main/LICENSE.txt) | 优先作为桌面参考工具，核对剖面、材料和粒子初态，再决定是否需要移植具体能力 |
| [ExoPlex](https://github.com/CaymanUnterborn/ExoPlex) | 质量—半径—组成计算及内部剖面；Python 项目，仓库标注 GPL-3.0。[许可](https://github.com/CaymanUnterborn/ExoPlex/blob/master/LICENSE) | 作为材料结构与半径关系的候选对照，优先级低于 SPH 初态需求 |

WoMa 的结构模型和粒子布置适合放在碰撞之前，但它不是完整的碰撞演化求解器。导入预生成初值也不等于马上能在 OpenSPH 中稳定运行：材料状态方程、密度／内能、压力、单位、软化和粒子分辨率均须匹配并验证。[WoMa 项目说明](https://github.com/srbonilla/WoMa)

这不意味着要把 Python 工程整体改写成 ArkTS。现有 ArkTS／ArkUI 继续负责交互，C++ 负责计算与绘制；外部科研工具可先用于离线验证。是否引入其源码、依赖或数据表，应在确定具体文件后记录许可和来源；当前项目没有新增第三方代码。

GitHub API 本轮返回限流，未取得这两个项目的 HEAD 提交标识。已经读取的公开 README 和许可只按访问日期记录，后续正式运行前还需固定版本；不以未核实的提交哈希做兼容性承诺。

## 如何进入现有开发路线

第一批仍先完成实验配方保存、复制放置和 A/B 结果留存；把 W01 的简短引导、W03 的停止原因和 W14 的图片配方设计纳入同一数据模型。界面只呈现已有可用参数，未支持的热量或材料不显示成可编辑假功能。

第二批环带局部模型补 W04 的速度语义、W07 的参考系和 W08 的轨迹图例。W13 的观测实验可在统一物理半径与固定观测者后独立推进；它不依赖先做完月球形成。

第三批 SPH 诊断、自引力平衡与残骸工作采用 W18 的参考验证路径。先证明单体稳定，再比较碰撞；WoMa 只帮助初态和对照，不替代求解器验收。热扩散、海水流动和材料相变进入后续多物理阶段。

## 验收要求

| 领域 | 必须可检查的行为 |
| --- | --- |
| 引导 | 步骤前提、完成条件、退出与重启都可由 CLI 查看；不依靠屏幕坐标判定完成 |
| 时间 | 物理单步、回放帧、指定时刻和事件暂停各有独立语义；同一时刻不会重复提交事件 |
| 参数与替换 | 参考系、锁定规则、保留字段显示明确；取消无修改；失败不部分提交 |
| 曲线 | 记录观测者、单位、采样时间、对象身份；镜头运动和显示尺寸不影响原始测量 |
| 外观 | 云层种子与动画参数可保存；开关不改物理状态；固定时刻重开可复现 |
| 预算 | 区分渲染质量和物理分辨率；损失原因可追踪，不把优化造成的变化说成自然过程 |
| 设备 | CLI 验证状态；模拟器截图验证布局；触摸、键盘与动画需单独验收，不能互相代替 |
| 科研初态 | 固定工具版本和材料来源；单位、质量、剖面、静置与粒子分辨率对照通过后才能接入实验 |

本轮已验证页面索引完整性和阅读数量；交付时运行项目文档检查。应用代码、0.20.0 HAP 与源码 ZIP 不重建、不覆盖；不把之前的模拟器测试算作本轮新验证。

## 重点阅读页面目录

日期是所取修订的 UTC 日期，不是文章创建日期或功能发布日期。链接固定到所取修订，完整 374 页元数据见证据索引。下面 66 页为重点正文阅读范围；其他页面只做标题／导语与结构筛选。

| 页面 | 所取修订日期（UTC） | revision ID |
| --- | --- | --- |
| [Add Moons to Planet](https://universesandbox.fandom.com/wiki/Add_Moons_to_Planet?oldid=1243) | 2019-09-08 | 1243 |
| [Add Planets to Star](https://universesandbox.fandom.com/wiki/Add_Planets_to_Star?oldid=1245) | 2019-09-08 | 1245 |
| [Add Tool](https://universesandbox.fandom.com/wiki/Add_Tool?oldid=1941) | 2021-06-21 | 1941 |
| [Advance One Time Step](https://universesandbox.fandom.com/wiki/Advance_One_Time_Step?oldid=1821) | 2020-10-30 | 1821 |
| [Atmosphere Appearance](https://universesandbox.fandom.com/wiki/Atmosphere_Appearance?oldid=2329) | 2022-11-23 | 2329 |
| [Attracted](https://universesandbox.fandom.com/wiki/Attracted?oldid=793) | 2019-08-14 | 793 |
| [Attracting](https://universesandbox.fandom.com/wiki/Attracting?oldid=794) | 2019-08-14 | 794 |
| [Auto Orbit](https://universesandbox.fandom.com/wiki/Auto_Orbit?oldid=1999) | 2021-06-22 | 1999 |
| [Band Colors](https://universesandbox.fandom.com/wiki/Band_Colors?oldid=2310) | 2022-11-23 | 2310 |
| [Barycenter](https://universesandbox.fandom.com/wiki/Barycenter?oldid=1229) | 2019-09-05 | 1229 |
| [Base Color](https://universesandbox.fandom.com/wiki/Base_Color?oldid=2332) | 2022-11-23 | 2332 |
| [City Lights Appearance](https://universesandbox.fandom.com/wiki/City_Lights_Appearance?oldid=2314) | 2022-11-23 | 2314 |
| [Clouds Appearance](https://universesandbox.fandom.com/wiki/Clouds_Appearance?oldid=2346) | 2023-01-31 | 2346 |
| [Collision](https://universesandbox.fandom.com/wiki/Collision?oldid=2266) | 2022-04-25 | 2266 |
| [Displayed Orbit](https://universesandbox.fandom.com/wiki/Displayed_Orbit?oldid=2305) | 2022-11-23 | 2305 |
| [Displayed Trail](https://universesandbox.fandom.com/wiki/Displayed_Trail?oldid=2306) | 2022-11-23 | 2306 |
| [Earth Similarity](https://universesandbox.fandom.com/wiki/Earth_Similarity?oldid=2273) | 2022-05-23 | 2273 |
| [Elevation Map](https://universesandbox.fandom.com/wiki/Elevation_Map?oldid=2339) | 2022-11-23 | 2339 |
| [Enhance Surface Detail](https://universesandbox.fandom.com/wiki/Enhance_Surface_Detail?oldid=2342) | 2022-11-23 | 2342 |
| [Force Tool](https://universesandbox.fandom.com/wiki/Force_Tool?oldid=2237) | 2022-04-14 | 2237 |
| [Fragmentation](https://universesandbox.fandom.com/wiki/Fragmentation?oldid=1350) | 2019-09-11 | 1350 |
| [Game Settings Menu](https://universesandbox.fandom.com/wiki/Game_Settings_Menu?oldid=2221) | 2022-03-21 | 2221 |
| [Graph](https://universesandbox.fandom.com/wiki/Graph?oldid=2073) | 2021-06-22 | 2073 |
| [Guides](https://universesandbox.fandom.com/wiki/Guides?oldid=2402) | 2024-10-10 | 2402 |
| [Included Simulations](https://universesandbox.fandom.com/wiki/Included_Simulations?oldid=2370) | 2023-11-27 | 2370 |
| [Interface](https://universesandbox.fandom.com/wiki/Interface?oldid=2333) | 2022-11-23 | 2333 |
| [Keyboard Controls](https://universesandbox.fandom.com/wiki/Keyboard_Controls?oldid=2267) | 2022-04-25 | 2267 |
| [Laser Tool](https://universesandbox.fandom.com/wiki/Laser_Tool?oldid=1954) | 2021-06-21 | 1954 |
| [Life Likelihood](https://universesandbox.fandom.com/wiki/Life_Likelihood?oldid=2385) | 2024-01-29 | 2385 |
| [Life Simulation](https://universesandbox.fandom.com/wiki/Life_Simulation?oldid=2351) | 2023-04-12 | 2351 |
| [Locked Properties](https://universesandbox.fandom.com/wiki/Locked_Properties?oldid=2432) | 2025-10-30 | 2432 |
| [Mass Conservation](https://universesandbox.fandom.com/wiki/Mass_Conservation?oldid=1183) | 2019-09-05 | 1183 |
| [Material Tool](https://universesandbox.fandom.com/wiki/Material_Tool?oldid=1944) | 2021-06-21 | 1944 |
| [Materials](https://universesandbox.fandom.com/wiki/Materials?oldid=2429) | 2025-08-25 | 2429 |
| [Momentum Conservation](https://universesandbox.fandom.com/wiki/Momentum_Conservation?oldid=2388) | 2024-06-06 | 2388 |
| [N-Body Simulation](https://universesandbox.fandom.com/wiki/N-Body_Simulation?oldid=2209) | 2022-01-17 | 2209 |
| [Non-Spherical Gravity](https://universesandbox.fandom.com/wiki/Non-Spherical_Gravity?oldid=2186) | 2021-06-23 | 2186 |
| [Normalized Light Curve](https://universesandbox.fandom.com/wiki/Normalized_Light_Curve?oldid=1248) | 2019-09-08 | 1248 |
| [Orbital Parent](https://universesandbox.fandom.com/wiki/Orbital_Parent?oldid=1221) | 2019-09-05 | 1221 |
| [Photo Tool](https://universesandbox.fandom.com/wiki/Photo_Tool?oldid=1966) | 2021-06-21 | 1966 |
| [Planetscaping Tool](https://universesandbox.fandom.com/wiki/Planetscaping_Tool?oldid=2231) | 2022-03-26 | 2231 |
| [Position Lock](https://universesandbox.fandom.com/wiki/Position_Lock?oldid=749) | 2019-08-13 | 749 |
| [Pulse Tool](https://universesandbox.fandom.com/wiki/Pulse_Tool?oldid=1946) | 2021-06-21 | 1946 |
| [Radial Velocity](https://universesandbox.fandom.com/wiki/Radial_Velocity?oldid=1246) | 2019-09-08 | 1246 |
| [Radius from Composition](https://universesandbox.fandom.com/wiki/Radius_from_Composition?oldid=2408) | 2025-01-27 | 2408 |
| [Relative to](https://universesandbox.fandom.com/wiki/Relative_to?oldid=982) | 2019-08-23 | 982 |
| [Replace Object](https://universesandbox.fandom.com/wiki/Replace_Object?oldid=1995) | 2021-06-22 | 1995 |
| [Roche Fragmentation](https://universesandbox.fandom.com/wiki/Roche_Fragmentation?oldid=1467) | 2019-10-02 | 1467 |
| [Rotation Lock](https://universesandbox.fandom.com/wiki/Rotation_Lock?oldid=1818) | 2020-10-30 | 1818 |
| [Sim Settings Menu](https://universesandbox.fandom.com/wiki/Sim_Settings_Menu?oldid=2280) | 2022-06-23 | 2280 |
| [Spin Fragmentation](https://universesandbox.fandom.com/wiki/Spin_Fragmentation?oldid=2249) | 2022-04-14 | 2249 |
| [Stabilize Phases](https://universesandbox.fandom.com/wiki/Stabilize_Phases?oldid=2066) | 2021-06-22 | 2066 |
| [Stabilize Temperature](https://universesandbox.fandom.com/wiki/Stabilize_Temperature?oldid=2068) | 2021-06-22 | 2068 |
| [Stats Menu](https://universesandbox.fandom.com/wiki/Stats_Menu?oldid=1796) | 2020-10-30 | 1796 |
| [Strongest Attractor](https://universesandbox.fandom.com/wiki/Strongest_Attractor?oldid=1222) | 2019-09-05 | 1222 |
| [Surface Lock](https://universesandbox.fandom.com/wiki/Surface_Lock?oldid=2327) | 2022-11-23 | 2327 |
| [Surface Map](https://universesandbox.fandom.com/wiki/Surface_Map?oldid=2313) | 2022-11-23 | 2313 |
| [Surface Simulation](https://universesandbox.fandom.com/wiki/Surface_Simulation?oldid=2242) | 2022-04-14 | 2242 |
| [Temperature Calculation](https://universesandbox.fandom.com/wiki/Temperature_Calculation?oldid=2026) | 2021-06-22 | 2026 |
| [Temperature Stable Simulation Speed](https://universesandbox.fandom.com/wiki/Temperature_Stable_Simulation_Speed?oldid=2102) | 2021-06-22 | 2102 |
| [Tools Menu](https://universesandbox.fandom.com/wiki/Tools_Menu?oldid=1909) | 2020-10-31 | 1909 |
| [Transform Tool](https://universesandbox.fandom.com/wiki/Transform_Tool?oldid=2097) | 2021-06-22 | 2097 |
| [Video Tool](https://universesandbox.fandom.com/wiki/Video_Tool?oldid=1969) | 2021-06-21 | 1969 |
| [View Panel](https://universesandbox.fandom.com/wiki/View_Panel?oldid=2052) | 2021-06-22 | 2052 |
| [View Settings Menu](https://universesandbox.fandom.com/wiki/View_Settings_Menu?oldid=2278) | 2022-06-22 | 2278 |
| [Water Stable Simulation Speed](https://universesandbox.fandom.com/wiki/Water_Stable_Simulation_Speed?oldid=2103) | 2021-06-22 | 2103 |

本报告仅提炼公开 Wiki 的功能线索与本项目方案，未复制其完整文章、图片、公式体系或页面代码。Wiki 的描述不等于项目源码开放，所提科研工具的许可独立于 Wiki 与 Universe Sandbox。
