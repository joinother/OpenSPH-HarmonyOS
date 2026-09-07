# Celestia 插件生态、源码与鸿蒙工程调研

> 类型：调研快照与实施建议；调研日期：2026-09-07（Asia/Shanghai）；本项目基线：0.21.0。本文不代表新增功能发布、重新构建或设备验收。

## 结论与阅读范围

Celestia 最值得用于本项目的经验是连续镜头、观察参考系、跨尺度坐标、分层材质、渐进资源加载和带时间范围的天体目录。它的轨道接口按时间求位置，不能替代本项目所需的碰撞、破碎、自引力和材料求解。保留 ArkUI 界面、语义 CLI 与 OpenSPH／轨道求解层，先独立实现这些体验与资源机制；暂不把整套 Qt Celestia 并入应用。

本轮找到本地 `~/celestia-src` 与 `~/celestia-ohos`，并参考 `~/stellarium-src/docs/harmonyos/CELESTIA-INTEGRATION-RESEARCH.md`。完成 `celestia-src/src` 和 `shaders` 的 **803 个文件清单、哈希及 189759 个换行统计**，重点阅读下表列出的调用链和本地移植代码。文件清单不是逐行精读证明，也未验证所有算法、第三方依赖、着色器组合或插件兼容性。没有修改这三个参考工程。

| 对象 | 固定基线与实际范围 |
| --- | --- |
| 本地 Celestia | HEAD `405c85679833a046953b9d6821e0a0c2631f1be0`；工作树有本地 CLI、Qt 和构建修改，不能当作纯上游快照；目录下没有根级 `test/` |
| 本地 celestia-ohos | HEAD `bdabdb02596c7cb91a431d0bd24522c36b7364b0`；有未提交 IDE 配置；选读 ArkTS 资源展开、Qt CLI、README 与移植记录 |
| 官方 Celestia master | 查询到 `5f97614a92dcdf63cf59cc65e38f77bcc97c822f`；本轮没有将本地源码更新到该提交 |
| 官方网站与论坛 | 用户给出的两个页面返回 Anubis 访问验证／拒绝页；论坛帖子正文未读，不能声称遍历论坛 |
| 官方网站公开源码 | 从 CelestiaProject/www 读取插件、指南、Lua 工具、配置管理和资源工具页面；这是官方另行公开的站点源码，不等同于已经访问受保护论坛 |
| 移动版与关联作者资料 | 选读更新日志、插件安装指南、3 篇内容文章、2 份插件说明；Selden 的插件教程与目录仅选段；移动插件分类入口只返回客户端页面框架，未取得完整目录 |

详细文件清单、源码选读区间、网页状态、版本和哈希见 [调研证据](../evidence/celestia-source-addons-index-2026-09-07.json)。官网旧教程面向 1.6.x；移动版发行说明、本地开发源码、上游 master 是不同基线，不能混为同一已发布版本。

## 官方插件生态带来的产品思路

官方插件页将入口分到论坛、历史 Motherlode、移动版资源库和 Selden 的个人目录。这说明“插件”实际包含目录数据、纹理、模型、脚本和教程，不能统一按一张皮肤处理。旧指南可用于理解内容结构，不应直接决定现代鸿蒙 UI。[官方插件页公开源码](https://raw.githubusercontent.com/CelestiaProject/www/master/addons.html)、[指南公开源码](https://raw.githubusercontent.com/CelestiaProject/www/master/guides.html)。

| 已阅读资料 | 有价值的观察 | 本项目的具体取舍 |
| --- | --- | --- |
| Lua Universal Tools | 导航、自动巡游、地理标记和显示选项可以在小控件中组合；原版仍是旧桌面布局 | 做简短连续观测路线与按需出现的悬浮控件；不用旧 Lua 面板替换 ArkUI，也不照搬旧桌面最小窗口尺寸 |
| Lua Edu Tools／Slideshow | 视点可与讲解组成顺序播放的导览；距离标尺可以依附观察平面或轨道平面 | 从 0.21.0 配方扩展“观测站点＋一句提示＋下一站”，允许任意站自由操作；先用声明式步骤，不开放任意执行脚本 |
| Config Manager | 下载内容可禁用而不删除；配置可以恢复与导入导出 | 区分已安装和已启用；恢复视图、恢复实验、卸载素材分别定义，不让换外观重置求解 |
| CmodView／纹理工具 | 模型转换、法线与纹理切片属于离线制作链 | 先建立我们自己的资源清单和导入验证；不为少量球体立刻引入完整 CMOD／3DS 工具链 |
| 移动版插件安装指南 | 用户资源目录与应用数据目录分开，网页可跳转到应用安装 | 鸿蒙用文件选择与应用私有存储；导入完成前展示大小、作者、依赖和兼容范围，不复制 Android 的绝对路径 |
| 移动版近期发行说明 | 大气、环影／食影、曝光以及内存与加载问题持续演进 | 材质、阴影、曝光、画质预算要组合验收；不能用桌面高配截图替代手机性能证据 |

来源：[Universal Tools](https://raw.githubusercontent.com/CelestiaProject/www/master/lua-universal-tools.html)、[Edu Tools 与 Slideshow](https://raw.githubusercontent.com/CelestiaProject/www/master/lua-other.html)、[Config Manager](https://raw.githubusercontent.com/CelestiaProject/www/master/config-manager.html)、[资源工具](https://raw.githubusercontent.com/CelestiaProject/www/master/utilites.html)、[安装指南](https://celestia.mobi/resources/guide/D1A96BFA-00BB-0089-F361-10DD886C8A4F?lang=en)、[移动版发行说明](https://github.com/celestiamobile/MobileCelestia/releases)。

另外三条值得落实的内容管理规则：

1. **显示资料可信类别。** 2023 年插件月报分开了系外行星、未确认对象与虚构内容。我们也应分别标记观测数据、推测外观和原创实验；条目存在不代表其参数已经科学验证。[插件月报](https://celestia.mobi/resources/guide/716CB087-887B-ECFD-30DA-C1EDDAA3FF9E)。
2. **依赖必须可检查。** JUICE 插件说明要求配套伽利略卫星轨道包，避免显示出错误的相遇／穿碰。由此建议记录数据版本、依赖和有效时间；这条提示不证明插件在实时解算碰撞。[JUICE 条目](https://celestia.mobi/resources/item?item=13D974FA-19C2-9460-C628-A292E83A8BA8)。
3. **索引标题不能直接成为内容身份。** 本轮从旧月报中标为 Bennu 的链接进入后，实际页标题是 2023 BU。入库时应核对稳定 ID、当前正文和作者，保存标题不匹配记录；不要自动把旧目录文字当作当前作品说明。[旧月报](https://celestia.mobi/resources/guide/716CB087-887B-ECFD-30DA-C1EDDAA3FF9E)、[实际目标页](https://celestia.mobi/resources/item?item=C0E24ADE-22FD-4D92-9100-6B32ADE79767)。

## 源码调用链与可复用的设计

以下源文件链接固定到本地源码的上游 HEAD；本地新增 CLI 单独列出，不伪装成上游功能。只描述已阅读区段能够支持的结论。

| 模块／入口 | 实际实现观察 | 对本项目的帮助与限制 |
| --- | --- | --- |
| [Observer 更新](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/observer.cpp#L635) | 实时时钟推进镜头旅程，模拟时钟按倍率推进天文日期；位置与朝向插值独立 | 暂停物理后仍能飞近行星；不能用时间倍率控制 UI 动画速度 |
| [观察参考系转换](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/observer.cpp#L985) | 更换参考系前转换当前位置、朝向和旅程起终点，保持世界姿态 | 选中、居中、飞往、惯性跟随、随天体自转是不同语义；从当前画面接续，避免跳回旧起点 |
| [跟随与取消](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/observer.cpp#L1534) | follow、BodyFixed、PhaseLock、Chase 使用不同参考系；cancelMotion 只切换观察模式 | 不要推断“取消”会同时清除所有速度。我们需要明确取消后保持当前画面及用户手势接管规则 |
| [Simulation 导航转发](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/simulation.cpp#L340) | 导航调用转给观察者，选择对象与镜头动作分离 | 同一 ArkUI／CLI 动作入口，不因打开编辑菜单重新创建宇宙 |
| [UniversalCoord](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/univcoord.h#L1) | R128 坐标先做高精度差，再转换为局部公里向量 | 将来星际漫游需要分层坐标与相机相对原点；本地 SPH 单位体系继续独立，不把银河级绝对位置直接转 float |
| [异步缓存](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/asyncresourcecache.h#L115) | 排队、CPU 加载、渲染线程上传分开；generation 防止旧结果回写 | 连续切换对象时丢弃过期资源结果；上传字节预算不等于严格显存上限，单次上传仍可能超预算 |
| [资源调度](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/resourcesystem.cpp#L1) | 每帧轮换优先处理的缓存，后台工作与 GL 上传分工 | 鸿蒙同时跑 SPH 时须限制解码线程；不能直接照搬按硬件线程数展开的默认策略 |
| [虚拟纹理](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/virtualtex.cpp#L187) | 选期望层级，未就绪时使用路径上最深的已加载祖先，并调整 UV 子区域 | 先显示低清完整天体，再补细节；必须预备基础层，否则没有已加载祖先仍会无纹理。渐变混合是我们的后续设计，并非此区段已有保证 |
| [Surface](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/surface.h#L18) 与 [GLSL 材质装配](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/renderglsl.cpp#L220) | 基色、法线、夜面、反射遮罩、覆盖层分开；云影、环影、大气按条件启用 | 海洋高光需与陆地遮罩对齐；夜灯不能照亮白昼。该版本云影明确排除虚拟／分块纹理组合，不能照单全收 |
| [银河渲染](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celrender/galaxyrenderer.cpp#L112) | 星系形状由实例化光团表示，按屏幕尺度减少点数并调整亮度 | 这是可从外部观看的三维近似，和 ESO 摄影全天背景不同；光团不是每颗真实恒星，也不是星系动力学求解 |
| [Orbit 接口](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celephem/orbit.h#L27) | 输入 TDB 儒略日，输出参考系内 km；速度为 km/day，具有有效时间范围 | 天文回放与可编辑动力学实验必须分别标注时间、单位和数据来源；不能将输出直接当 AU/year 使用 |
| [采样轨道](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celephem/samporbit.cpp#L50) 与 [SPICE 轨道](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celephem/spiceorbit.cpp#L240) | 采样数据插值；SPICE 查询已有星历，时间越界可被夹到边界，并转换坐标轴 | 我们应显式报告超出数据有效期；不能把边界静止误解为捕获成功或引力平衡 |
| [SSC 目录装配](https://github.com/CelestiaProject/Celestia/blob/405c85679833a046953b9d6821e0a0c2631f1be0/src/celengine/solarsys.cpp#L1070) | Add／Modify／Replace 以及时间线参与对象构建；修改目标缺失时可能变为新增 | 本项目先采用更严格的版本化清单和引用校验；显示“修改对象不存在”，避免默默生成重复天体 |

对现有代码的核对：我们的 [camera_journey.h](../../entry/src/main/cpp/camera_journey.h) 已有 0.42 秒连续插值、从当前权重改换目标，以及独立窗口构图过渡；[planet_material.cpp](../../entry/src/main/cpp/planet_material.cpp) 目前在初始化时上传五套程序化表面／云纹理。下一步应扩展已有机制，不能把“一镜到底”和“云层”写成从零开始，也不能把五套风格纹理说成真实地理贴图资源系统。

## 本地鸿蒙工程：可借鉴经验与需要修正的做法

`celestia-ohos` 是 Qt for OHOS 界面加 ArkTS 启动壳，并非本项目所需的全原生 ArkUI 前端。本轮只读代码与历史记录，没有重新构建、启动或验证其当前帧率。

| 本地位置 | 核对结果 | 对我们的实施要求 |
| --- | --- | --- |
| `celestia-src/src/celestia/qt/qtcli.cpp:174–280` | 共用命令分发可用于不同入口；goto 启动五秒旅程后即返回；对象查找失败时若干分支仍返回 true | 保留语义命令方案，重新设计结果：接收成功、目标错误、运行中、完成、取消分别返回；命令目录与实际实现一起验证 |
| `app/entry/src/main/ets/qability/CelestiaResourceBootstrap.ets` | 仅凭提取标记与一个关键文件判断资源齐全；直接覆盖目标目录；外层异常记录后仍返回目标路径 | 增加版本／哈希清单，暂存完成后切换；必需文件失败应报告资源未就绪；用户插件与内置资源分开 |
| `README.md` 与 `docs/KNOWN-ISSUES.md` | 记录过 musl 的 gettext 符号冲突、资源路径以及离屏画面尺寸问题 | 保留命名空间封装与绝对资源根；测试非默认工作目录、首次安装和升级恢复；不要把历史“已修复”当成本轮重新验证 |
| `docs/RESOURCE-AUDIT.md` | 2026-08-27 的资源统计与缺失引用修补记录；存在模型替代 | 资源能找到只证明引用完整，不能证明地形正确；替代素材须标注，不能把通用小行星模型称为实测特定天体 |
| Stellarium 的集成调研 | 提议隔离天文引擎会话，明确时间、坐标和选择对象的边界 | 若以后试验 Celestia 核心，以独立会话和小型可测接口开始；不共享可变选择指针、时钟和 GL 上下文 |

此前文档中的其他项目帧率提升不是 OpenSPH 的实测数据。我们已经使用原生 XComponent／GLES 渲染，不因参考工程采用离屏图像而加入每帧 GPU 读回和复制。

## 素材候选：逐项确认来源

CelestiaContent 明确区分程序与数据许可；数据要看 README 和各自 `.license`，不能因为 Celestia 开源就认为所有插件和图片都能直接打包。直接移入 GPL 源文件也不能简单改标为本项目的 MIT。当前决定是参考设计，未拷入第三方代码或素材；若后续采用源文件，应固定版本、保留声明，并按所用许可证安排分发。[内容许可说明](https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/LICENSE.md)、[来源总表](https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/README)。

| 候选 | 本轮核实到的内容 | 采用状态 |
| --- | --- | --- |
| NASA CGI Moon Kit | 官方提供用于三维渲染的月面颜色与高程资料，存在 2019／2025 不同颜色版本；颜色图经过视觉处理，不能代替科学原始数据 | 优先候选；先做小尺寸基色与法线验证，保存版本、投影、单位和署名；本轮未下载纹理 |
| NASA Blue Marble | 官方地球图像集合入口可访问 | 候选入口，尚未选择具体图像文件；不能将整个集合当作同一云层时刻或一份统一许可资产 |
| Celestia 的地球／月球／土星纹理 | 来源总表记录了多人加工、拼接与不同数据来源 | 不整包复制；优先回到原始官方资料逐项确认，特别区分推测填补、科学地图与艺术增强 |
| `chariklo-rings.png` | 本地逐文件声明为 AstroChara、CC0-1.0 | 可作为小天体双环素材候选；还需验证实际图像格式、极性、径向映射与应用效果 |
| `dimorphos.cmod` | 本地逐文件声明为 CC0-1.0，并列出 DART／NASA PDS 派生形状模型引用 | 可作为以后 DART 观察场景候选；本轮未验证模型几何、单位、转换器和 GPU 成本 |
| `exo-class2.jpg` | 本地逐文件声明为 cubicApocalypse、CC-BY-4.0 | 可考虑为虚构气态行星提供外观；应保留作者及修改说明，不宣称实拍 |

其他官网来源：[NASA 月球素材及说明](https://svs.gsfc.nasa.gov/4720/)、[NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/collections/blue-marble/)、[JPL 当前图像使用说明](https://www.jpl.nasa.gov/jpl-image-use-policy/)。逐文件许可正文的哈希和路径列在证据中。网站允许下载、插件免费、README 提到 NASA，都不能替代具体资产身份及来源核对。

## 12 项改进的实施顺序

以下都是建议，除明确提到的 0.21.0 基础外尚未实现。延续 [现有 SpaceEngine 调研路线](SPACEENGINE-2026-09-06.md)，不另起冲突的版本计划。

| 优先级 | 改进 | 最小交付与验收门槛 |
| --- | --- | --- |
| P0 | 1. 镜头状态与 CLI 结果 | 在已有旅程上增加请求 ID、目标、状态和取消原因；暂停物理时仍可到达；不存在的目标必须失败 |
| P0 | 2. 选择／跟随／近看分离 | 选择和编辑不强制飞近；连续 A→B→全景从当前画面接续；返回视点保持原有语义，模拟 generation 不变 |
| P0 | 3. 分层材质与曝光 | 基色、海洋遮罩、云、夜面、法线分别控制并存入版本化配方；固定光照下做昼夜、接缝、极区和饱和度对照 |
| P0 | 4. 首批真实地理外观 | 优先月球、地球；清楚标注来源与处理，原创行星仍保留风格化外观；贴图不得改变质量、半径或轨道初态 |
| P1 | 5. 按需纹理与预算 | 基础纹理常驻，后台解码、渲染线程上传；记录峰值内存、上传耗时与失败回退，连续换目标不串贴图 |
| P1 | 6. 内容包清单与事务 | 定义 ID、版本、作者、许可、大小、哈希、依赖和有效期；路径越界、损坏、空间不足时保留原包可用 |
| P1 | 7. 观测路线 | 在已有实验配方之上保存多个站点及讲解；随时取消、转动和返回；分享视点不等于保存求解器状态 |
| P1 | 8. 稳定对象身份与层级 | 展示恒星→行星→卫星路径，内部使用稳定 ID；改名、删对象、恢复存档后不让旧索引指向另一天体 |
| P1 | 9. 天文时间与实验时间分层 | 星历记录 TDB／UTC 换算、单位、参考系、有效期；实验继续显示相对时间；越界不能静默伪装成有效轨迹 |
| P2 | 10. 跨尺度镜头 | 先做太阳系到邻近恒星的小型精度验证，再评估分层坐标；近处天体不抖动、不因缩放消失 |
| P2 | 11. 三维银河与观测背景分开 | 保留摄影全天背景，再建立有尺度与数据来源的三维星系层；渐进切换应避免亮度跳变和重复星点 |
| 独立物理路线 | 12. 碰撞与自引力 | 继续 OpenSPH 状态诊断、能量／动量／质量守恒、平衡初态与收敛验证；Celestia 外观或轨迹导入不能作为撞击模型完成证据 |

第一实施批次应集中在 **1＋2**，继承现有 0.42 秒旅程与 CLI 框架；第二批次做 **3＋4**，让真实地图和材质层进入同一视口。5 的预算基础应在引入大纹理包之前完成。折叠、旋转、退后台／返回时同步核对镜头状态，不重建物理场景；CLI 验收之后仍需手势和视觉检查，不能凭状态值宣称动画流畅。

## 8 个有趣且边界清楚的体验提案

| 原创提案 | 用户能做什么 | 依赖与边界 |
| --- | --- | --- |
| 地球黄昏到月面晨线 | 从地球云层上方飞到月球，连续观察昼夜分界 | 先做真实地图＋镜头，后加可信天文日期；只做外观时不标成真实当天月相 |
| 土星环下穿行 | 从全景、环面侧视切换到环粒子视角，调速度看椭圆化 | 延用当前示踪实验；真实尺度近距镜头和环影待实现，不能称为完整土星环动力学 |
| 小天体也有双环 | 对照 Chariklo 风格的两条窄环与宽环行星 | 引入可配置环剖面；先视觉演示，卫星约束与环稳定性留给后续模型 |
| 地月接力飞越 | 沿时间站点观察探测器先掠月再掠地 | 可参考 JUICE 的事件组织；需要可靠星历和配套卫星数据，预录轨迹不等于重新计算引力助推 |
| DART：最后一分钟与旁观视角 | 在撞击器、目标和观察者之间切换，查看时刻与距离 | 先做有来源的任务观察；动量传递、喷射物、轨道改变必须另建可验证实验 |
| 同一行星的四种外观 | 在日面、夜面、去云和地形光照间比较 | 同一镜头和物理状态，仅切材质；教学上说明颜色图、法线与真实地形的区别 |
| 真实参数与想象外观 | 选择系外行星的已知参数，为未知表面设置原创风格 | 分别标明测量、不确定量与推测；未知不自动填成地球气候 |
| 我的五站宇宙导览 | 用户把几个视点排成顺序，写短说明并一键重访 | 基于 0.21.0 配方扩展；先在当前实验内实现，再考虑跨目录对象与大尺度旅行 |

其中事件组织参考 [JUICE 飞越文章](https://celestia.mobi/resources/guide/7BC89DB4-893A-45A3-9B27-B24C83BD85FD) 与 [DART 文章](https://celestia.mobi/resources/guide/4B4A6963-C463-CF47-81ED-B25AD3B864C4)。历史文章中的未来计划和精确任务数据未在本轮逐项更新；产品真正采用前要回到任务机构和星历数据核对。本轮只提炼互动结构，没有下载插件包或复制作者的场景。

## 未覆盖范围与交付记录

论坛仍受访问验证限制，未读取帖子；Selden 两个长页面只选读插件结构、目录示例与故障段落，其旧显卡建议不用于鸿蒙。AndroidCelestia 仅查询仓库提交元数据，未做 Android 生命周期代码审计。没有逐行审计 Lua 执行环境、全部目录解析器、模型格式、所有着色器或完整天体数据库；这些留到对应功能实施时按固定版本继续追踪。

本轮交付是本文、文件／网页证据及索引更新。应用仍为 0.21.0，没有运行新的模拟器或科学数值验收，没有覆盖 HAP、源码 ZIP 或旧验收记录。[本轮检查记录](../evidence/celestia-research-check-2026-09-07.json) 包含文档格式与链接检查、参考仓库状态、803 个文件哈希复核和原有 0.21.0 产物完整性；这些检查不代表外部代码运行正确。
