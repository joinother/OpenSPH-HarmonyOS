# Universe Sandbox 博客与论坛：功能创意及鸿蒙实施路线

> 类型：调研与实施建议；调研日期：2026-09-07（Asia/Shanghai）；对照源码版本：0.20.0；本轮交付为资料与路线，不代表新功能已实现。

## 调研结论

最值得借鉴的是实验的完整流程：选一个有意思的问题，调整一两个变量，在连续视口中观察，再比较、保存、重做。碰撞、环带和行星皮肤需要配合这条流程；只有主题封面或瞬间爆炸，难以形成持续探索。

建议接下来的首个功能批次完成“保存调好的实验、复制天体进入放置草稿、对照实验保留结果”。随后增加环带扰动和 SPH 诊断，再推进自引力、碎片再聚集。月球形成保留为远期实验目标，不能把现有无自引力的岩石碰撞改名后直接上线。

本报告扩展 [同行更新筛选](PEER-UPDATES-2026-09-06.md)，以当前 [项目概览](../../README.md) 和 [0.20.0 记录](../releases/RELEASE-0.20.0.md) 为能力基线。旧调研保留其日期和版本范围；本报告对后续开发顺序提出新的细化建议。

## 覆盖范围与证据强度

| 范围 | 本轮完成 | 未声称完成 |
| --- | --- | --- |
| 官方博客 | 公开 API 的全部 242 篇文章建立索引，覆盖 2010-01-04 至 2026-08-19；全量标题筛选、正文关键词筛选；选读 36 篇正文 | 不是逐字精读全部 242 篇，未逐一看视频和评论 |
| 旧论坛目录 | Discussion、Support & Bugs、Updates 三个板块共 66 页，去重得到 2585 个主题 | 不覆盖旧版、闲聊等所有板块 |
| 旧论坛正文 | 选取 24 个主题，23 个成功读取，共 141 条帖子正文，包含引用重述；检查关键开发者回复身份 | 不是读完论坛全部帖子，也不把 141 条当成独立建议 |
| 失败与排除 | Lagrange Points 主题 17787 读取失败；采用官方 Update 36 作为相关功能来源 | 不推测失败页面内容；未穷尽 Steam、Discord、Google 文档长更新表 |
| 本地项目 | 对照当前说明、模型边界、CLI 规则与已有版本证据 | 本轮未重跑模拟器、物理测试或游戏实操 |

[检索索引与阅读记录](../evidence/universe-sandbox-research-index-2026-09-07.json) 保存 242 篇博客和 2585 个主题的元数据、目录页覆盖、选读范围与失败记录。第三方全文仅作为工作区临时阅读材料，不进入交付索引或仓库。外部时间保留网站原义，论坛显示时间没有擅自补时区。

官方发布公告用于判断其发布时的功能；开发日志和路线图用于理解取舍；论坛帖子用于发现需求。旧帖中的“尚未支持”不能推断为 2026 年仍未支持。近期官方公告引导用户去 Steam 和 Discord，旧论坛更适合作为历史问题库。[B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/)

## 对照我们已经有的东西

| 领域 | 0.20.0 基线 | 这次调研指向的缺口 |
| --- | --- | --- |
| 实验 | 九个主题，已有慢撞／快撞等对照入口 | 完整配方保存、对照结果并列、观察进度和结论回顾 |
| 环带 | 程序薄环外观；192 个无质量示踪点；可调椭圆速度与独立小时钟 | 局部参数持久化、环编辑、母星轴对齐、卫星摄动 |
| 放置与查看 | 预览确认、连续近看、返回全景；确认放置会重建初始条件 | 复制为草稿、轨道父对象与坐标系选择；运行中插入需要另做状态事务 |
| 编辑 | 自定义天体最近 20 步撤销／重做 | 外观、环、相机书签等操作的明确保存与撤销范围 |
| 回放 | 最近 240 帧可视化快照、回放单槽保存 | 撞前书签、导出演示；从历史帧继续计算需要完整物理检查点 |
| SPH | 岩质碰撞，200–2400 粒子，未开启自引力 | 压力／内能／损伤、能量预算、自引力平衡体与分辨率验证 |
| 引力轨道 | 2–8 个点质量体，近距保护停止 | 局部近距模型、预测与事件处理；不能直接模拟撞入行星 |
| 外观与设备 | 云、大气、海洋、银河摄影、沉浸与折叠／旋转适配 | 外观配方、清晰数据图例、真实设备性能和小屏完整任务验收 |

## 32 项可执行改进

以下“做法”和验收要求是本项目的设计建议。P0 表示优先完成现有体验，P1 表示相邻扩展，P2 表示需要物理与性能验证；不代表现有命令或排期承诺。

### 实验、保存与结果

| 编号／优先级 | 建议与首个可交付范围 | 来源与验收重点 |
| --- | --- | --- |
| 01 P0 | 扩展实验配方：保存主题、天体外观、环参数、随机种子和初始局部时钟 | [F61692](https://universesandbox.com/forum/index.php?topic=61692.0) [B5617](https://universesandbox.com/blog/2023/06/grand-collision-unification-update-32-3/)；保存后重开一致，旧档迁移明确 |
| 02 P0 | 设置明确归属：设备偏好、实验参数、会话草稿分别管理 | [F15419](https://universesandbox.com/forum/index.php?topic=15419.0)；切换实验不会偷偷重置用户偏好 |
| 03 P0 | 一键复制所选天体进入放置草稿，拖动／修改后再确认 | [B6624](https://universesandbox.com/blog/2026/08/crashing-craters-update-36-3/)；取消不改原天体，确认一次产生一个可撤销事务 |
| 04 P0 | A/B 对照保留上一次结果；只改变速度、偏移或自转中的一个变量 | [B6386](https://universesandbox.com/blog/2025/08/another-interstellar-visitor/)；显示两次参数差异，固定种子和数值设置 |
| 05 P0 | 实验卡补“看什么、改哪里、何时看见”，打开时暂停并设置合适镜头 | [B6332](https://universesandbox.com/blog/2025/04/describing-the-universe/) [F16767](https://universesandbox.com/forum/index.php?topic=16767.0)；不用猜测接下来该点什么 |
| 06 P1 | 撞前、接触、峰值、结束作为事件书签；先用于已计算回放 | [F61841](https://universesandbox.com/forum/index.php?topic=61841.0)；书签不伪装成可继续求解的检查点 |
| 07 P1 | 图表固定选定对象并跨选择保留，支持两对象同量纲比较 | [F15645](https://universesandbox.com/forum/index.php?topic=15645.0) [B6624](https://universesandbox.com/blog/2026/08/crashing-craters-update-36-3/)；未来对象销毁后历史仍可追踪 |
| 08 P1 | 导出带单位、模型版本、参数与种子的实验数据和复现配方 | [F18737](https://universesandbox.com/forum/index.php?topic=18737.0) [F15607](https://universesandbox.com/forum/index.php?topic=15607.0)；重新运行可核对，不依赖截图猜参数 |

### 放置、镜头与小屏操作

| 编号／优先级 | 建议与首个可交付范围 | 来源与验收重点 |
| --- | --- | --- |
| 09 P1 | 放置时选择母星或双星质心，显示相对距离和相对速度 | [B6212](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/)；明确预览是二体近似，确认后由全系统积分 |
| 10 P1 | 一键对齐母星赤道／轨道面，提供顺行／逆行方向 | [F17847](https://universesandbox.com/forum/index.php?topic=17847.0)；先建立真实自转轴字段，不能只旋转皮肤 |
| 11 P1 | 环也使用预览—确认；先做内外半径、倾角、颜色与粒子预算 | [F16618](https://universesandbox.com/forum/index.php?topic=16618.0) [F14793](https://universesandbox.com/forum/index.php?topic=14793.0)；几何限制和重叠提示可理解 |
| 12 P1 | 多对象批量改名、外观与同类参数，作为一个撤销事务 | [B6212](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/)；部分输入失败时不留下半套修改 |
| 13 P1 | 数值输入支持单位、科学计数和简单乘除；显示最终值后提交 | [B6212](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/)；使用受限解析器，明确单位，拒绝非有限值 |
| 14 P0 | 小屏一次突出一个主工具，观察曲线收为窄条；镜头随可见区域平移 | [B5402](https://universesandbox.com/blog/2023/08/mobile-devlog-2/) [B3689](https://universesandbox.com/blog/2019/05/surface-grids-status-4/)；展开／折叠不改变模拟时间或选中对象 |
| 15 P1 | 增加双对象跟随与相对参考系；只变相机与轨迹表达 | [B6603](https://universesandbox.com/blog/2026/06/winds-of-change-update-36-2/) [B1644](https://universesandbox.com/blog/2016/03/exploring-features/)；惯性状态不变，切回全景位置连续 |
| 16 P0 | 每次 UI 调整用语义动作目录核对功能仍可达；快捷键避让输入框 | [F15235](https://universesandbox.com/forum/index.php?topic=15235.0) [F13604](https://universesandbox.com/forum/index.php?topic=13604.0)；保留 CLI 共用动作与触摸专项验收 |

### 行星表现与可读性

| 编号／优先级 | 建议与首个可交付范围 | 来源与验收重点 |
| --- | --- | --- |
| 17 P1 | 外观配方拆为表面、云、大气、环与光照，不再只依赖固定皮肤编号 | [B5224](https://universesandbox.com/blog/2022/11/build-a-planet-update-32/)；使用原创程序纹理或明确许可资源 |
| 18 P1 | 未来碰撞表现按接触亮斑、喷射、冷却分层；先让颜色对应可读物理量 | [B4851](https://universesandbox.com/blog/2021/09/codename-fire-ring-update-28/)；没有温度模型时不能给装饰光写 Kelvin |
| 19 P1 | 尘云／环／轨迹各自可隐藏，方便透过效果看撞击位置 | [B5897](https://universesandbox.com/blog/2024/03/eclipsed-improvementse-update-34-1/)；只影响显示，不删除模拟对象 |
| 20 P1 | 表面检查光标同时显示数值与图例，可查看真实网格／粒子分辨率 | [B5224](https://universesandbox.com/blog/2022/11/build-a-planet-update-32/) [B3930](https://universesandbox.com/blog/2019/11/surface-grids-lasers-devlog-12/)；增强视觉细节不冒充计算精度 |
| 21 P1 | 固定曝光与便于观察的曝光预设；相机移动不改变物理照明 | [B6212](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/)；明暗变化来自明确设置或场景关系 |
| 22 P0 | 每个数据色图标单位、范围与高低方向，避免只用红绿表达 | [B6147](https://universesandbox.com/blog/2024/12/but-wait-theres-more-beyond-graphics/)；数据缺失不能当作零，低饱和也能辨认 |
| 23 P1 | 设备画质与求解精度分开；先降云、尘、分辨率，记录物理预算 | [B4834](https://universesandbox.com/blog/2021/09/mobile-devlog-1/) [F17779](https://universesandbox.com/forum/index.php?topic=17779.0)；低画质不默默改变同一实验的物理条件 |
| 24 P1 | 创建／移除淡入淡出、相机过渡可中断；后续加入减少动态效果选项 | [B6624](https://universesandbox.com/blog/2026/08/crashing-craters-update-36-3/)；快速重复操作和旋转屏幕后状态一致 |

### 物理、近距事件与边界

| 编号／优先级 | 建议与首个可交付范围 | 来源与验收重点 |
| --- | --- | --- |
| 25 P0 | 把守恒量、步长和停止原因变成能读懂的诊断；局部／累计误差分开 | [B5702](https://universesandbox.com/blog/2023/08/gravity-simulation-upgrade-update-33/) [F16982](https://universesandbox.com/forum/index.php?topic=16982.0)；守恒好不等于所有物理正确，还要参考解和收敛 |
| 26 P1 | 将环从单中心解析轨道扩展到母星＋一个卫星的受限局部积分 | [F15137](https://universesandbox.com/forum/index.php?topic=15137.0)；先回归零卫星质量的开普勒基线，再验证扰动 |
| 27 P1 | 放置路径上的近距警示，说明预测窗口与近似模型 | [B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/)；当前提示接近保护阈值，不能声称已预测实体碰撞 |
| 28 P1 | 拉格朗日点教学入口：先做圆形受限三体中的 L4/L5 放置与相对视角 | [B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/)；标注模型条件，以积分验证，不照抄简化科普定义 |
| 29 P2 | SPH 输出压力、内能与材料损伤，做碰撞前后统计和曲线 | [B4212](https://universesandbox.com/blog/2020/07/sciencelog-1-energy-and-heating/) [F18000](https://universesandbox.com/forum/index.php?topic=18000.0)；先核对上游字段单位／定义与有限值 |
| 30 P2 | 自引力岩质平衡体 → 单体静置 → 双体碰撞，再做洛希撕裂 | [B3960](https://universesandbox.com/blog/2019/12/sph-devlog-1/) [F14251](https://universesandbox.com/forum/index.php?topic=14251.0)；质量、动量、能量和粒子分辨率逐级验证 |
| 31 P2 | 日后按事件在点质量、局部 SPH、合并残骸之间转换 | [F15508](https://universesandbox.com/forum/index.php?topic=15508.0)；质量、动量、角动量、内能、材料和对象身份都要有映射 |
| 32 P2 | 热量与材料先做小规模、有限通道模型，再评估大气进入和相态 | [B5802](https://universesandbox.com/blog/2023/12/terraforming-update-34/) [B4408](https://universesandbox.com/blog/2021/03/the-end-of-the-world-sciencelog-3/)；显示假设，区分编辑器即时设置与时间演化 |

### 几个必须分清的技术事实

2014 年开发者明确指出当时展示的碰撞回退模型并非 SPH。2019 年 SPH 日志仍把正式整合列为后续工作；2015 年开发者已经指出点质量与粒子之间转换、大小差异和回收残骸很难。它们提供架构思路，不能替代我们的算法实现或验证。[F14251](https://universesandbox.com/forum/index.php?topic=14251.0) [B3960](https://universesandbox.com/blog/2019/12/sph-devlog-1/) [F15508](https://universesandbox.com/forum/index.php?topic=15508.0)

环带同样有多层含义：薄环外观、无质量示踪轨道、受卫星摄动的环、带碰撞或自引力的环。2014 年官方共振文章明确其缺口在创建时预置；固定缺口不能作为模拟自然形成卡西尼缝的证据。[B578](https://universesandbox.com/blog/2014/04/orbital-resonance/)

Update 34 的材料限制需要结合后续版本阅读：34.1 已将大气颜色和不透明度扩展到所有气体；这不等于取消表面流动的全部限制。Update 36 也明确形变后的碰撞和表面仍按球计算。漂亮的形变图像不证明相应接触几何已经参与计算。[B5802](https://universesandbox.com/blog/2023/12/terraforming-update-34/) [B5897](https://universesandbox.com/blog/2024/03/eclipsed-improvementse-update-34-1/) [B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/)

摄影银河用于天空背景；可交互星表、三维星系和自洽星系动力学是另外几项工作。官方历史文章也公开说明过其星系示踪模型的局限；不能把背景变真实误当成全宇宙求解能力。[B3726](https://universesandbox.com/blog/2019/06/dark-matter-galaxies/)

## 14 个值得做的主题实验

下表为原创题目和实现规划。每个实验至少有：原创封面、匹配的程序外观、暂停初始态、一个问题、一个主参数、合适镜头、观察指标、重置与保存。表内“近期”表示可以基于现有模型扩展，仍需实现和测试。

| 实验题目 | 让用户做什么／看到什么 | 状态、依赖与外观 |
| --- | --- | --- |
| 速度加倍，岩石会怎样？ | 对比同一对岩石的两种速度，保留两次结果和参数差异 | 已有慢／快撞入口；近期补曲线与结果对照；冷灰岩与赭岩，不称行星毁灭。[B4851](https://universesandbox.com/blog/2021/09/codename-fire-ring-update-28/) |
| 擦肩而过的一击 | 拖动撞击偏移，比较喷射方向和剩余主体 | 已有掠碰基础；近期补角度和质量诊断；不能按固定脚本喷出同一团火。[B5617](https://universesandbox.com/blog/2023/06/grand-collision-unification-update-32-3/) [F15607](https://universesandbox.com/forum/index.php?topic=15607.0) |
| 两颗旋转岩石的相遇 | 在相同碰撞条件下改变自转方向，比较角动量 | 需新增双体独立自转与统计；岩质模型，无月球形成承诺。[B5062](https://universesandbox.com/blog/2022/04/hit-hard-spin-fast-update-30/) |
| 环里的赛跑 | 同时跟随内外圈粒子，猜哪一圈先回来 | 已有圆轨道基础；近期补内外圈对照与计圈；土星风格气态外观。[B1644](https://universesandbox.com/blog/2016/03/exploring-features/) |
| 给环一点额外速度 | 比较圆与椭圆轨道，在近远点读取速度 | 0.20.0 已有；近期补完整存档与 A/B 叠加，明确参数变化会重置局部实验。[F61692](https://universesandbox.com/forum/index.php?topic=61692.0) |
| 把一颗月亮放进环旁 | 移动卫星，观察附近示踪轨迹逐渐改变 | 新增母星＋卫星局部模型；先做扰动轨迹，不保证短时间形成清晰缺口。[F15137](https://universesandbox.com/forum/index.php?topic=15137.0) |
| 逆行的来客 | 同一位置选择顺行或逆行，比较相对速度与遭遇 | 新增卫星／环局部方向控制；碰撞未实现时只做轨道实验。[F17847](https://universesandbox.com/forum/index.php?topic=17847.0) |
| 躺着转的行星 | 改变母星自转轴，卫星一键对齐赤道，再与轨道面对照 | 新增真实轴参数；青色云层、倾斜环与坐标辅助线。[F17847](https://universesandbox.com/forum/index.php?topic=17847.0) |
| 三颗太阳的舞步 | 两组几乎相同的初始条件，比较一段时间后的路径 | 点质量三体可扩展；接近阈值即停止；结果差异需与积分误差分开。[B5897](https://universesandbox.com/blog/2024/03/eclipsed-improvementse-update-34-1/) |
| 来访恒星的引力弹弓 | 调整掠过距离，观察一个轨道如何改变 | 现有多体模型内新增精选初值；不跨入近距碰撞；双色恒星与距离曲线。[B147](https://universesandbox.com/blog/2010/03/predicting-the-future/) |
| 双星旁的同行者 | 在受限三体 L4/L5 附近放小天体，用旋转视角观察 | 新增局部模型和视角；仅在验证过的质量比与初值范围展示。[B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/) [B6603](https://universesandbox.com/blog/2026/06/winds-of-change-update-36-2/) |
| 月亮被撕开的距离 | 一颗已平衡的小天体逐渐靠近母星，观察形变和解体 | 远期：自引力、材料强度、近距时间步和多分辨率测试；不使用到阈值自动爆炸冒充。[F14251](https://universesandbox.com/forum/index.php?topic=14251.0) |
| 月球从哪里来？ | 比较不同撞击角度的束缚碎片、盘与残骸 | 远期：分层材料、自引力、角动量、残骸识别与再聚集；先交“巨撞与碎片盘”，再研究成月。[B3960](https://universesandbox.com/blog/2019/12/sph-devlog-1/) [F13516](https://universesandbox.com/forum/index.php?topic=13516.0) |
| 坠入云海的流星 | 从远景连续追踪到大气，比较不同入射角和阻力 | 远期：统一长度／时间尺度、大气密度、阻力、消融和热量预算；气态云海与发光轨迹分别验证。[B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/) |

土星环相关主题不必一开始就计算大量有质量粒子：可以保留默认漂亮薄环，以少量可交互示踪展示运动，把高成本模型放进特定实验。历史论坛的默认土星无环问题说明预算选择会直接影响第一印象；我们应让外观完整，同时把粒子类别和功能限制讲清楚。[F13322](https://universesandbox.com/forum/index.php?topic=13322.0) [F17821](https://universesandbox.com/forum/index.php?topic=17821.0)

## 开发顺序与完成门槛

### 第一批：让已有实验可以认真玩

范围锁定 01–05、14、16、22、25 中与现有数据直接有关的部分。先保存环的发射参数、外观和初始时钟，再做复制放置和固定条件的 A/B。两种当前存档语义继续保留：命名初始条件用于重算，可视化回放用于观看；不把它们混成任意时间可恢复的检查点。

建议先定义版本化的 `ExperimentRecipe`，包含模型与参数、主题外观、镜头、种子、诊断配置。`UiPreferences` 放全局偏好，`DraftState` 放未提交编辑。以上是拟议内部结构，不是已经存在的接口。对旧档提供默认值、迁移测试和明确错误；完整求解状态另行设计。

完成门槛：保存—关闭—重开能恢复配方；取消复制不变更实验；确认后可撤销；对照结果不被第二次运行覆盖；展开、折叠、旋转和编辑键盘出现时仍看得到目标与确认按钮。

### 第二批：让环真正受到环境影响

先补真实自转轴和局部坐标，再加一个扰动卫星。保留解析开普勒模式作为参考基线，局部数值模式共享时间单位与状态描述。增加圈数、近远点、相对速度和能量诊断；母星质量有限时，不能不加说明地把母星永远固定却声称完整三体。

完成门槛：无卫星时退化到基线；卫星质量趋零时扰动趋零；减半步长结果收敛；相对视角不改变物理状态；模型类型、参数、预算写入配方。不能为了画出漂亮环缝直接删除粒子而宣称自然共振。

### 第三批：碰撞看得懂，再进入自引力

沿当前 OpenSPH 已验证调用链补压力／内能／损伤与统计，核对材料模型、符号、单位和失效状态。之后独立建立自引力平衡体，测试单体静置，再尝试碰撞与束缚碎片识别。持续连接原有连续镜头，不因查看残骸重载场景。

完成门槛：守恒与收敛测试、分辨率对照、稳定静置、残骸身份和参数留存。200–2400 粒子目前只代表交互预算，不能直接承诺足够重现科学级成月结果。

### 后续：表面、热量与完整检查点

表面外观编辑可先独立推进；物理热量必须有独立数据源。先验证小规模热量模型，再评估局部大气进入。任意时间继续计算需要保存完整求解状态、随机状态、材料变量与版本兼容性，和只保存屏幕位置的回放分开。

全宇宙星表、真实星系动力学、生命、飞船、巨构暂不挤入前三批。同行路线图也把其中多项列为未来目标。[B6494](https://universesandbox.com/blog/2026/03/universe-sandbox-roadmap-2026/)

## CLI 与测试要求

继续遵循 [开发约定](../../AGENTS.md)：UI 与 CLI 共用语义动作，先读取命令目录和状态。下表是待实现的接口能力，不是可直接执行的新命令。

| 能力 | 应公开的状态 | 验证 |
| --- | --- | --- |
| 配方保存／恢复 | 格式版本、模型、外观、环与种子；错误原因 | 旧档迁移、往返一致、坏数据拒绝且不破坏当前场景 |
| 复制／确认／取消 | 来源对象稳定标识、草稿、事务历史 | 一次确认一次修改；失败无部分提交；输入焦点下删除键不删天体 |
| 对照实验 | 两组参数差异、结果标识、运行状态 | 固定种子重复；仅一个指定变量改变；单次失败保留另一结果 |
| 曲线／导出 | 时间单位、量纲、采样率、对象身份、数据缺口 | 切对象历史保留；缺帧不用捏造点填充；导出可复现 |
| 连续镜头／布局 | 跟随对象、参考系、安全区、面板状态 | CLI 验逻辑；截图验遮挡；触摸与手势另测命中和动画 |
| 局部环模型 | 当前求解器、物理步长、示踪类别、母星与卫星参数 | 解析对照、步长收敛、相位与单位检查、设备预算 |
| SPH 诊断 | 材料、分辨率、压力／内能定义、守恒量和停止原因 | 静置、对称碰撞、分辨率变化、有限值与异常路径 |

渲染帧率、物理积分步长和播放倍率分别记录。换低画质不应该悄悄改变实验；如果为了设备预算改变粒子数，必须显示并写入配方。科学数据不以动画插值或曲线平滑结果代替。[B4251](https://universesandbox.com/blog/2020/10/tidal-heating-sciencelog-2/) [F17779](https://universesandbox.com/forum/index.php?topic=17779.0)

## 来源目录

B 编号是官方博客文章 ID；F 编号是论坛主题 ID。正文中的编号直接链接原文。以下摘要只标明筛选价值，具体采用方式见上文。开发日志、普通用户发言和正式发布公告的证据等级不同。

### 官方博客：36 篇选读

| 来源／发布日期 | 主题 | 筛选结论 |
| --- | --- | --- |
| [B6624](https://universesandbox.com/blog/2026/08/crashing-craters-update-36-3/) · 2026-08-19 | Crashing Craters ／ Update 36.3 | 已发布：撞击坑与地形融合、复制天体、创建淡入、天体销毁后保留图表；复制仍有表面数据限制。 |
| [B6603](https://universesandbox.com/blog/2026/06/winds-of-change-update-36-2/) · 2026-06-25 | Winds of Change ／ Update 36.2 | 已发布：大气风、选择轮廓、质量百分比，以及围绕两个对象的旋转视角。 |
| [B6585](https://universesandbox.com/blog/2026/04/back-to-the-moon-update-36-1/) · 2026-04-29 | Back to the Moon! ／ Update 36.1 | 已发布：材料组成影响凝聚强度和碎裂。借鉴材料差异，不移入航天器模型。 |
| [B6551](https://universesandbox.com/blog/2026/03/pale-blue-dots-update-36/) · 2026-03-30 | Pale Blue DOTS ／ Update 36 | 已发布：引力框架重写、流星阻力、潮汐锁定、J2、路径预测和放置辅助；形变后的碰撞仍按球处理。 |
| [B6494](https://universesandbox.com/blog/2026/03/universe-sandbox-roadmap-2026/) · 2026-03-19 | Universe Sandbox Roadmap: 2026 & Beyond | 未来计划：生命、飞船、巨构和更多求解器工作。不能当作已发布能力或本项目承诺。 |
| [B6428](https://universesandbox.com/blog/2025/10/planet-nines-new-nemesis/) · 2025-10-23 | Planet Nine’s New Nemesis ／ Update 35.4 | 已发布：再次点击已选对象可飞近；展示新发现天体。用于减少查看步骤。 |
| [B6386](https://universesandbox.com/blog/2025/08/another-interstellar-visitor/) · 2025-08-20 | Another Interstellar Visitor ／ Update 35.3 | 已发布：星际访客轨迹与同质量／同半径黑洞对照实验。借鉴控制变量的实验组织。 |
| [B6351](https://universesandbox.com/blog/2025/06/blinded-by-the-light/) · 2025-06-17 | Blinded by the Light ／ Update 35.2 | 已发布：超新星亮度变化、恒星细节，以及部分撤销后轨迹恢复。 |
| [B6332](https://universesandbox.com/blog/2025/04/describing-the-universe/) · 2025-04-28 | Describing the Universe ／ Update 35.1 | 已发布：天体／实验描述、启动场景、预览中的数据视图和查看动作。 |
| [B6212](https://universesandbox.com/blog/2025/03/space-in-a-new-light-update-35/) · 2025-03-03 | Space in a New Light ／ Update 35 | 已发布：动态面板、多选编辑、算式输入、质心轨道父对象、曝光与色图改进。 |
| [B6147](https://universesandbox.com/blog/2024/12/but-wait-theres-more-beyond-graphics/) · 2024-12-19 | But Wait, There’s More: Improvements Beyond Graphics | 当时的界面预告，后纳入 Update 35；不重复计为另一批独立功能。 |
| [B5897](https://universesandbox.com/blog/2024/03/eclipsed-improvementse-update-34-1/) · 2024-03-05 | Eclipsed Improvements ／ Update 34.1 | 已发布：碰撞余波、尘云隐藏、材料替换；所有大气气体参与颜色／不透明度，修正只读 Update 34 的过时判断。 |
| [B5802](https://universesandbox.com/blog/2023/12/terraforming-update-34/) · 2023-12-14 | Terraforming ／ Update 34 | 已发布但有边界：多材料与相态；表面流动最多四种材料，另有温度／材料转移限制。 |
| [B5402](https://universesandbox.com/blog/2023/08/mobile-devlog-2/) · 2023-08-23 | Universe Sandbox for Mobile ／ Development Challenges ／ Update 2 | 移动开发日志：小屏多面板、视点避让和放置确认；当时尚无移动端发布日期。 |
| [B5702](https://universesandbox.com/blog/2023/08/gravity-simulation-upgrade-update-33/) · 2023-08-16 | Gravity Simulation Upgrade ／ Update 33 | 已发布：引力精度、高倍率稳定性与拥挤对象选择改进。 |
| [B5617](https://universesandbox.com/blog/2023/06/grand-collision-unification-update-32-3/) · 2023-06-29 | Grand Collision Unification ／ Update 32.3 | 已发布：碰撞方法统一、斜撞喷射与界面状态随实验保存；新增 Quaoar、Haumea 环实验。 |
| [B5224](https://universesandbox.com/blog/2022/11/build-a-planet-update-32/) · 2022-11-17 | Build-A-Planet ／ Update 32 | 已发布：高度图与颜色分离、地形混合；增强视觉细节可以关闭以查看实际表面分辨率。 |
| [B5062](https://universesandbox.com/blog/2022/04/hit-hard-spin-fast-update-30/) · 2022-04-14 | Hit Hard, Spin Fast ／ Update 30 | 已发布：旋转编辑与碎裂、碰撞后的转动和质量处理。 |
| [B4967](https://universesandbox.com/blog/2021/12/planetscaping-update-29/) · 2021-12-22 | Planetscaping ／ Update 29 | 已发布：表面编辑、水／热工具与表面锁定。 |
| [B4851](https://universesandbox.com/blog/2021/09/codename-fire-ring-update-28/) · 2021-09-23 | Codename: Fire Ring ／ Update 28 | 已发布：冲击波、双方受热、掠碰与碎片方向；提供随机种子入口。 |
| [B4834](https://universesandbox.com/blog/2021/09/mobile-devlog-1/) · 2021-09-10 | Universe Sandbox for Mobile ／ DevLog 1 | 移动开发日志：屏幕分辨率相关画质、触控尺寸、可收起工具与内存约束。 |
| [B4408](https://universesandbox.com/blog/2021/03/the-end-of-the-world-sciencelog-3/) · 2021-03-25 | The End of the World: Slower Than You Expected ／ ScienceLog #3 | 科学解释：相变需要时间，给出假设；即时稳定编辑与随时间演化分开。 |
| [B4251](https://universesandbox.com/blog/2020/10/tidal-heating-sciencelog-2/) · 2020-10-15 | Tidal Heating ／ ScienceLog #2 | 科学解释：潮汐加热与曲线诊断，高时间倍率会影响采样；不能用平滑补点冒充数据。 |
| [B4212](https://universesandbox.com/blog/2020/07/sciencelog-1-energy-and-heating/) · 2020-07-23 | Energy and Heating ／ ScienceLog #1 | 科学解释：能量流入／流出、方向性加热与表面温度。 |
| [B3960](https://universesandbox.com/blog/2019/12/sph-devlog-1/) · 2019-12-13 | SPH Fluid Simulation ／ DevLog | 实验性 SPH 开发日志；讨论粒子分辨率、表现衔接和月球形成目标，不证明现版已实现。 |
| [B3954](https://universesandbox.com/blog/2019/11/update-24/) · 2019-11-22 | Surface Grids & Lasers ／ Update 24 | 已发布：表面网格、水冰与局部加热工具。 |
| [B3930](https://universesandbox.com/blog/2019/11/surface-grids-lasers-devlog-12/) · 2019-11-06 | Surface Grids & Lasers ／ DevLog #12 | 发布前开发日志：表面存档、图例、性能测试和教程，后有 Update 24。 |
| [B3726](https://universesandbox.com/blog/2019/06/dark-matter-galaxies/) · 2019-06-20 | Dark Matter & Galaxies in Universe Sandbox | 历史模型说明：当时星系采用简化示踪；移除不能合理展示的暗物质效果。 |
| [B3689](https://universesandbox.com/blog/2019/05/surface-grids-status-4/) · 2019-05-24 | Surface Grids & Lasers ／ Dev Update #4 | 界面原型：自动停靠与数据图联动，指出自由重叠面板的管理成本。 |
| [B3466](https://universesandbox.com/blog/2019/04/update-22-2/) · 2019-04-10 | Revamped Vapor & Engine Experiments ／ Update 22.2 | 历史更新：新引力框架通过独立实验入口试用，正式功能与试验功能分开。 |
| [B2876](https://universesandbox.com/blog/2017/11/dynamic-bottom-bar/) · 2017-11-17 | The New Dynamic Bottom Bar | 历史设计：底栏溢出收纳与窄屏双行布局。 |
| [B1644](https://universesandbox.com/blog/2016/03/exploring-features/) · 2016-03-07 | Exploring Some Lesser-Known Features | 历史技巧：轻量默认场景、重实验分开、轨迹参考系、暂停启动和快捷操作。 |
| [B1704](https://universesandbox.com/blog/2016/02/n-body-problem/) · 2016-02-26 | Working Through the N-Body Problem in Universe Sandbox ² | 历史开发讨论：时间步长与计算量，分层轨道快进是当时设想，不能认定已完成。 |
| [B1474](https://universesandbox.com/blog/2015/08/log-z-us2/) · 2015-08-19 | Logarithmic Z-Buffering in Universe Sandbox ² | 历史渲染经验：跨尺度深度精度；不等于可直接移植 Unity 实现。 |
| [B578](https://universesandbox.com/blog/2014/04/orbital-resonance/) · 2014-04-08 | Orbital Resonance in Universe Sandbox ² | 历史环模型：共振缺口在创建时按比例预置，非运行中自发形成。 |
| [B147](https://universesandbox.com/blog/2010/03/predicting-the-future/) · 2010-03-01 | Predicting the Future | 早期实验呈现：闯入太阳系的恒星与星系交互；仅作为故事题材线索。 |

### 旧论坛：23 个已读主题

论坛日期取首帖显示日期，仅按原日期转写，不作跨时区转换。开发者回复只证明当时陈述，不证明现在仍有同一限制。

| 来源／首帖日期 | 主题 | 筛选结论 |
| --- | --- | --- |
| [F61841](https://universesandbox.com/forum/index.php?topic=61841.0) · 2019-06-09 | [SUPPORT] Is there a rewind back/forward button? | 用户希望像影片一样前后拖动；普通用户的回复不能作为无法实现检查点的技术结论。 |
| [F16982](https://universesandbox.com/forum/index.php?topic=16982.0) · 2016-12-21 | How to judge the accuracy of a simulation? | 用户会调精度却读不懂误差数字：诊断必须解释单位、局部误差与累计漂移。 |
| [F13516](https://universesandbox.com/forum/index.php?topic=13516.0) · 2014-09-13 | Moons formed from collision debris, rings.... | 用户想看撞后碎片形成月球；回复含推测和过时日期，只作为需求证据。 |
| [F18737](https://universesandbox.com/forum/index.php?topic=18737.0) · 2018-02-07 | Graph or any data export | 用户希望导出轨道数据做频谱／声音；提示提供结构化数据出口。 |
| [F16767](https://universesandbox.com/forum/index.php?topic=16767.0) · 2016-08-27 | Saving asteroid collision with Earth for a class | 教师希望保存撞前场景供课堂重复演示；提示实验重播和镜头书签。 |
| [F17779](https://universesandbox.com/forum/index.php?topic=17779.0) · 2017-08-06 | FPS, PHYS rate, accuracy [answered] | 渲染帧率、物理步数、时间倍率被混淆；开发者也无法由报告直接解释当时变化。 |
| [F17821](https://universesandbox.com/forum/index.php?topic=17821.0) · 2017-08-22 | Ring bodies instead of particles question | 环中示踪粒子与完整天体难区分；转换大量对象有性能代价。 |
| [F17847](https://universesandbox.com/forum/index.php?topic=17847.0) · 2017-08-31 | Inclination VS the Obliquity or the Orbital Parent | 用户用临时月球推算赤道对齐参数；开发者确认简化操作在待办中。 |
| [F61692](https://universesandbox.com/forum/index.php?topic=61692.0) · 2018-09-09 | Save function for custom rings | 用户希望保存彩色环参数；开发者当时计划通用预设，无时间表。 |
| [F15419](https://universesandbox.com/forum/index.php?topic=15419.0) · 2015-08-25 | Simulation Settings (eg. Tolerance, Tidal options, etc.) and persistence | 开发者承认没有清楚区分全局、场景和会重置的设置。 |
| [F16618](https://universesandbox.com/forum/index.php?topic=16618.0) · 2016-06-26 | [KNOWN] Problems with rings + UNDO command | 误删、环预览和撤销入口难发现；开发者说明当时已有部分撤销。 |
| [F15645](https://universesandbox.com/forum/index.php?topic=15645.0) · 2015-09-24 | Multiple graphs on the screen. | 用户希望固定多对象曲线、保留历史并使用对数坐标。 |
| [F15235](https://universesandbox.com/forum/index.php?topic=15235.0) · 2015-07-13 | System placement | 开发者确认系统放置功能在界面重设计中遗漏，提示动作目录回归的重要性。 |
| [F14793](https://universesandbox.com/forum/index.php?topic=14793.0) · 2015-03-03 | Can you bring back ring customization. | 用户关心环的内外范围与厚度；不能把不同版本的记忆当作现状。 |
| [F15137](https://universesandbox.com/forum/index.php?topic=15137.0) · 2015-06-22 | Suggestion for rings | 开发者说明当时环用轨道粒子表现，以便引力扰动，而非固定环对象。 |
| [F15508](https://universesandbox.com/forum/index.php?topic=15508.0) · 2015-09-09 | How will SPH work with collisions. | 开发者解释按事件切换点质量与 SPH 的设想，以及分辨率和切回天体的难点。 |
| [F14251](https://universesandbox.com/forum/index.php?topic=14251.0) · 2014-11-30 | Collision System Rewrite: below the surface (expected in Alpha 13) | 开发者明确该碰撞回退模型不是 SPH；讨论渐进合并、碎片预算及每个放置对象的洛希提示。 |
| [F14957](https://universesandbox.com/forum/index.php?topic=14957.0) · 2015-04-25 | New user interface coming in Alpha 15 - New Screenshot | 开发者与用户讨论自适应、图标占比和面板遮挡；美观与可用性均需实际验证。 |
| [F12811](https://universesandbox.com/forum/index.php?topic=12811.0) · 2014-08-03 | Universe Sandbox 2 GUI and Interface | 初学用户担心界面复杂；好看并不自动意味着能理解工具。 |
| [F18000](https://universesandbox.com/forum/index.php?topic=18000.0) · 2017-11-16 | Could someone explain what Collision Fragments settings do? | 用户不理解碎片衰减参数的含义，帖子无解释回复；提示就地帮助。 |
| [F15607](https://universesandbox.com/forum/index.php?topic=15607.0) · 2015-09-19 | Collision fragment ejection discrepancy | 开发者在取得用户存档后复现斜撞喷射缺口；保存可复现条件比单张截图有用。 |
| [F13322](https://universesandbox.com/forum/index.php?topic=13322.0) · 2014-08-29 | [FEATURE] Using the Add function Saturn has no rings! | 开发者解释当时默认不附带土星环出于性能预算；我们的廉价环外观可以默认保留。 |
| [F13604](https://universesandbox.com/forum/index.php?topic=13604.0) · 2014-09-21 | Rewind button :3 ? | 撤销、回放和反向运行被混为一谈；应使用不同入口和明确文案。 |

## 本次交付边界

本次产出是来源索引、32 项改进和 14 个实验方案，供后续功能开发使用。未读取游戏私有源码、提取其纹理或复制模拟存档；未把论坛附件并入项目。拟议功能采用独立实现，公开文章是设计参考。现有应用仍为 0.20.0，历史 HAP、源码 ZIP 和验收记录保持原样。
