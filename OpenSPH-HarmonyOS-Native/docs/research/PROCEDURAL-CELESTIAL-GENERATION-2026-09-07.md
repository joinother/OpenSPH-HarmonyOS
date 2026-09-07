# 天体程序化生成：Baopinsui、NPGS 与开源渲染方案

> 类型：调研与后续实施方案；调研日期：2026-09-07（Asia/Shanghai）；应用基线：0.31.0。本轮仅更新研究和路线，以下候选功能尚未接入。

## 结论与取舍

有帮助。沿用户提供的 Shadertoy、Bilibili 线索，找到关联的公开项目 [baopinshui/NPGS](https://github.com/baopinshui/NPGS)。它同时有黑洞渲染和恒星／行星系统生成代码，后者更直接对应“生成许多可互动天体”。作者 GitHub 名为 baopinshui，与 Shadertoy 的 baopinsui 拼写不同；关联依据包括仓库自述及 [Steam 合作作品说明](https://steamcommunity.com/sharedfiles/filedetails/?id=3656135541)，不是仅按用户名猜测。

近期优先让每颗行星拥有独立且可保存的地貌、陨石坑、海洋和云层，再改善大气散射。完整 Kerr 黑洞与可着陆地形作为后续专项。当前 ArkUI／ArkTS 管交互、C++ 管生成与物理、GLSL 管绘制的架构可以继续使用，无需把着色器和 SPH 求解器改写成 ArkTS。

必须区分三种结果：程序化外观生成决定星球看起来怎样；初始条件生成决定质量、半径与轨道怎样组合；时间演化求解决定碰撞、破碎和吸积是否发生。噪声纹理、参数化陨石坑、吸积盘着色器均不能替代 OpenSPH、自引力和守恒验证。

## 实际阅读范围

| 来源 | 本轮取得的内容 | 尚未完成的部分 |
| --- | --- | --- |
| [Shadertoy 作者主页](https://www.shadertoy.com/user/baopinsui) | 确认入口，普通访问返回 403 | 未取得全量作品目录、逐个 Shader 正文和逐作品许可 |
| [Bilibili 空间](https://space.bilibili.com/95332087) | 搜索索引中的 3 个视频条目及可见简介、另有标题线索 | 空间返回验证码，公开目录接口返回 -799；未播放视频、未取得字幕，不能声称逐段学习完 |
| NPGS | 固定提交的 1362 个文件路径清单；下载 10 份源码／说明／许可文件，选读相关段落 | 路径数包含资源等，不能称为 1362 份源码审计；未运行作者程序，未完成全部数值正确性审查 |
| 其他开源项目 | 9 个候选的官方仓库／许可／说明；部分核心文件选读，Solar-System 另选读 3 份文件 | 未把候选编译到鸿蒙，未测真机性能，未完成其全部依赖和素材审计 |
| 华为开发者 MCP | 取得 XComponent、XEngine Kit、Maleoon GPU 最佳实践 3 份官方正文 | 本轮没有 GPU 性能实测或新兼容性验收 |

访问限制出现后使用作者公开仓库和可见索引继续研究。没有绕过验证码、下载竞品程序、反编译或提取视频素材。[证据清单](../evidence/procedural-generation-2026-09-07.json) 保存访问状态、固定提交、所选文件校验值和本地实现基线。其他候选中以 HEAD 地址获取的文件仅由内容哈希固定快照，正式引入前还要固定提交。

### 视频线索及可用价值

下表是索引可见的信息，不是观看记录；日期沿用视频索引展示值，来源时区未单独确认。

| 视频 | 索引日期 | 可确认信息与产品启发 |
| --- | --- | --- |
| [沉浸式坠入 kerr 黑洞](https://www.bilibili.com/video/BV1LS6KByEqz/) | 2026-01-27 | 简介明确写为纯演示，无讲解；包含静态／自由落体观察者、前后视角和网格开关。可设计固定条件下的观察者对照，不能当作完整教程 |
| [富有教学意义的坐标网格（并不](https://www.bilibili.com/video/BV1JuzmBFEcN/) | 2026-01-25 | 简介提到网格模式需关闭视界剔除并降低帧率。启发是把解释性叠层做成可选项，并单独评估成本 |
| [不同角度的极端 kerr 黑洞吸积盘内侧成像](https://www.bilibili.com/video/BV1hg5Z6QEoy/) | 2026-05-18 | 确认题目及作者关联；算法步骤未取得。可作为未来固定相机角度对照的题材线索 |

另检索到中子星／致密星／坍缩星演示、偏振观察、白洞、光子环、双黑洞并合等标题。仅保留为后续检索方向，不据此断言已实现可靠的双黑洞数值相对论、恒星坍缩或可直接移植的中子星模型。作者关于精确性或领先程度的自述不等于本项目验证结果。

## NPGS 源码中可学什么

固定提交为 `91305ca1661f18b60d6d33ed4616e4cd5b977b9f`。本次阅读集中在生成器声明与部分实现、黑洞公共 Shader 的噪声／参数／积分入口，以及预处理和合成通道。

| 模块与源码 | 所见实现 | 对本项目的取舍 |
| --- | --- | --- |
| [StellarGenerator](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/NPGS/Sources/Engine/Core/System/Generators/StellarGenerator.h) | 种子、恒星年龄／质量／金属丰度选项；实现还加载 MIST CSV 数据 | 借鉴输入参数与结果分层，另审数据来源、拟合范围和再分发条件 |
| [OrbitalGenerator 声明](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/NPGS/Sources/Engine/Core/System/Generators/OrbitalGenerator.h) | 行星、双星轨道、卫星、环、温度、质量—半径和自转等生成接口 | 可参考“恒星→行星→卫星／环”的组织；其生成结果不自动满足长期稳定性或形成史 |
| [OrbitalGenerator 实现](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/NPGS/Sources/Engine/Core/System/Generators/OrbitalGenerator.cpp) | 不同类别的参数化半径关系、霜线、卫星候选区域等；还包含文明等游戏参数 | 物理参数与趣味权重分别建模；Hill／Roche 等常数、质量比例与适用前提逐项独立核验，不能直接当权威公式表 |
| [BlackHole_common.glsl](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/NPGS/Sources/Engine/Shaders/BlackHole_common.glsl) | 大型 Kerr-Newman 渲染实现，能看到观察者参数、吸积盘噪声、频移与 RK4 测地线步骤 | 适合研究特殊天体的外观和观察模式；并非普通行星地貌库，也不替代物质流体演化 |
| [预处理通道](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/NPGS/Sources/Engine/Shaders/BlackHole_prepass.frag.glsl) 与 [合成通道](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/NPGS/Sources/Engine/Shaders/BlackHole_composite.frag.glsl) | 分开保存畸变方向／频移、状态和体积颜色；合成时区别连续量与类别标记 | 可启发昂贵效果降分辨率、边缘单独处理；状态标记不能像颜色一样随意插值。实际边界判定仍需测试 |

源码采用 GLSL 450 与 Vulkan 风格的资源绑定，而当前应用使用 GLES 300 ES。接入涉及资源布局、多附件格式、采样和精度、相机坐标、深度遮挡及性能预算，远超替换 Shader 文本。约 5300 行的公共黑洞文件只选读相关部分，不能声称已吃透其全部逻辑。

根目录 [LICENSE](https://github.com/baopinshui/NPGS/blob/91305ca1661f18b60d6d33ed4616e4cd5b977b9f/LICENSE) 是 GPLv3。当前新应用与 OpenSPH 均采用 MIT，不能将 GPL 代码复制后仅按 MIT 发布；需按实际组合与分发方式处理相应许可义务，或取得额外授权。本阶段保留算法与产品层面的研究，候选实现优先评估明确的 MIT／BSD 项目。仓库另有模型素材自己的许可证，Shadertoy 作品及合作作品引用的效果也须逐项核对，不能由根许可证推定所有外来素材均可用。

## 其他开源候选

优先级根据当前架构与缺口判断，不是对项目质量的排名。表内许可指所核对的源码许可；素材、第三方依赖与社区内容须另核对。

| 候选 | 许可与阅读依据 | 有用之处 | 建议接入方式与优先级 |
| --- | --- | --- | --- |
| [FastNoiseLite](https://github.com/Auburn/FastNoiseLite) | MIT；选读 C++ 单头文件的 seed／fractal／domain warp 接口及 GLSL 版本 | 大陆、山脉、云系和带状风暴的可重复噪声基础 | 高：先做 C++ 异步生成；按需要保留少量 GPU 动态细节，不能假设多语言浮点结果逐位相同 |
| [webgl-noise](https://github.com/stegu/webgl-noise) | MIT；选读 noise3D.glsl，文件头有署名和许可 | 无外部纹理的三维 simplex 噪声，适合球面采样 | 中：作为 GPU 细节备选，与烘焙纹理比较算术成本，不同时堆多套噪声库 |
| [Solar-System](https://github.com/SebLague/Solar-System) | MIT 根许可；固定提交选读 CraterSettings、Craters、MoonShape | 陨石坑的分布、坑底、坑缘、尺寸权重和地形组合 | 高：借鉴离线／后台生成管线；Unity C#／ComputeShader 接口需重写，参数化陨坑不代表 SPH 撞击结果 |
| [Precomputed Atmospheric Scattering](https://github.com/ebruneton/precomputed_atmospheric_scattering) | BSD-3-Clause；官方技术文档及 definitions.glsl | 可配置行星大气、散射查找表和参考验证 | 中高：独立大气层模块，先一个大气类别；控制表尺寸、精度、光源和坐标单位 |
| [UnrealEngineSkyAtmosphere](https://github.com/sebh/UnrealEngineSkyAtmosphere) | MIT；README，内部另含 Bruneton 部分的 BSD 许可 | EGSR 2020 天空／大气算法，带参考渲染方式 | 中：借鉴分级大气方案；仓库测试框架是 Windows／DX11／HLSL，需 GLES 改写与验证 |
| [Material Maker](https://github.com/RodZill4/material-maker) | MIT；README 与 LICENSE.md | 节点式程序化材质制作，便于调岩石、冰裂纹和熔岩风格 | 高（制作工具）：在桌面制作自有材质模板、烘焙必要贴图；不移植编辑器，社区材质另查许可 |
| [realtime-planet-shader](https://github.com/jsulpis/realtime-planet-shader) | GPLv3；README 与 LICENSE | 解析球面相交、程序化表面、光照和简化大气的轻量例子 | 中（研究）：与当前球面绘制方式比较；受 GPL 接入条件约束，作者帧率不能当作鸿蒙结果 |
| [black_hole_shader](https://github.com/ebruneton/black_hole_shader) | BSD-3-Clause；官方文档及 functions.glsl | 非旋转黑洞、预计算光束追踪、星光和吸积盘 | 后期：先做 Schwarzschild 专项验证，再决定是否需要 Kerr；其背景星数据另审来源 |
| [Pioneer](https://github.com/pioneerspacesim/pioneer) | GPLv3；选读 Terrain.cpp，文件头明确许可 | 按天体 seed 与类型挑选地形／颜色生成器 | 后期：参考地形组织、稳定身份与细节层级；真正表面飞行需要新几何与镜头精度方案 |

Solar-System 的固定提交是 `0c60882be69b8e96d6660c28405b9d19caee76d5`。其 [陨坑 Shader](https://github.com/SebLague/Solar-System/blob/0c60882be69b8e96d6660c28405b9d19caee76d5/Assets/Scripts/Celestial/Shaders/Includes/Craters.cginc) 按坑中心和半径计算坑底与坑缘，再平滑组合；[参数代码](https://github.com/SebLague/Solar-System/blob/0c60882be69b8e96d6660c28405b9d19caee76d5/Assets/Scripts/Celestial/NoiseSettings/CraterSettings.cs) 生成球面位置和尺寸分布。适合先在后台烘焙高度／法线，避免每个像素每帧遍历数百个坑。我们应使用独立随机流，避免移植其中全局随机状态的使用方式。

Bruneton 大气项目尤其有参考价值的是 [CPU 参考、量纲与函数验证流程](https://ebruneton.github.io/precomputed_atmospheric_scattering/)，不仅是画面。另一套 [非旋转黑洞文档](https://ebruneton.github.io/black_hole_shader/) 采用预计算方案；这是较容易设立范围和参考图的起点，不能据此承诺手机帧率或旋转黑洞支持。

## 当前实现与具体缺口

本轮核对 [planet_texture.cpp](../../entry/src/main/cpp/planet_texture.cpp)、[planet_texture.h](../../entry/src/main/cpp/planet_texture.h)、[planet_material.cpp](../../entry/src/main/cpp/planet_material.cpp)、[planet_material.h](../../entry/src/main/cpp/planet_material.h)。

| 当前已有 | 尚缺能力 | 优先改动 |
| --- | --- | --- |
| 自有球面三维噪声、岩质／海洋／气态等类别 | 生成接口没有逐天体 seed；材质缓存主要按类别共享 | 稳定的天体外观身份、seed 与生成版本；缓存改按配方和画质寻址 |
| 颜色与海洋遮罩、海洋高光、独立旋转的云层及云影 | 同类别地貌重复；云层缺少更丰富的层次和风暴形态 | 大陆尺度、海平面、冰盖、陨坑、云量与风带独立参数 |
| 线性光照与曝光、球面边缘大气效果 | 大气仍是近似光晕；没有经过校准的 Rayleigh／Mie 模型 | 查找表大气与正确的昼夜交界、遮挡、曝光一致性 |
| 倾斜环带、条纹／间隙与阴影 | 外观尚不能表示环粒子碰撞、破碎或形成 | 继续将视觉环与已验证的示踪／后续粒子动力学分开说明 |
| 两三角形的球面绘制、UV 接缝过滤 | 没有可着陆地形网格和改变轮廓的真实山脉 | 近期做法线细节；后期另立 cube-sphere／LOD／近地相机专项 |

NASA 月面与摄影银河已有独立来源和用途。程序化生成优先用于虚构天体；真实月球保留真实底图，不能随机改月面却继续标成观测地图。

## 分批实施路线

### 第一批：每颗星球有自己的外观

1. 配方增加外观生成版本、地表／云层 seed 和参数。旧存档沿用原有外观规则；不能用会因排序变化的数组索引作为身份。复制默认保留外观，提供独立的“生成新外观”操作。
2. 先支持岩质与海洋世界，再扩展气态风暴；大陆尺度、海平面和陨坑密度从少量好理解的控件开始。调色与粗糙度使用连续遮罩，避免只叠彩色噪声。
3. 球面三维坐标采样生成颜色、高度／法线、海洋／粗糙度遮罩与云图；针对接缝和极点专门验证。高度图首版只影响光照，明确不改变物理碰撞半径。
4. 后台生成、可取消、只接收最新请求；纹理准备好后在当前视角更新，并短暂过渡。快速改参数、切换选择、旋转屏幕不能重启实验或把镜头拉回全景。
5. ArkUI 与语义 CLI 共用编辑动作；查询完整外观配方和生成状态。撤销／重做、复制放置、命名保存和重新打开都恢复同一结果，失败保留原有效材质。

建议先评估 FastNoiseLite 与现有噪声的生成质量、耗时和输出稳定性，再固定一个版本；首批无需同时引入多套库。此批完成后即可制作“同类不同脸”的实验卡片。

### 第二批：云层、大气与近看层次

先把普通云图、云影、海洋反光做协调，再验证一套大气查找表。入射光、行星尺度、大气厚度与曝光使用一致单位；无大气天体应完全退出该通道。低档设备使用表面云层，高档设备再试局部低分辨率体积云与遮挡边缘处理，避免全屏体积积分。

按投影大小选择纹理精度，限制缓存总量。作为预算示例，四张 1024×512 RGBA8 贴图约 8 MiB，加完整 mipmap 约 10.7 MiB；数十颗天体不能都常驻这一级别。该数值是格式容量估算，不含驱动、附件、后台缓冲和上传峰值，不是实测内存。可先评估 256／512／1024 宽度分档、选中天体优先、共享噪声资源与有界淘汰。

### 第三批：生成一套可解释的恒星系统

独立建立“系统初值生成器”：恒星参数→轨道候选→天体质量／组成→半径／温度估计→卫星／环候选→重叠与数值检查。输出要带模型版本、参数来源和假设。随机生成不能直接标为真实观测系统，也不能凭一条 Hill 条件宣称长期稳定。

视觉 seed 与物理随机流分离，改变云量不能改变行星质量或轨道。优先输出少量天体、可重复对照的系统，再做生成范围扩大；用当前轨道求解器检查漂移、近距事件及对步长的敏感性。需要平衡行星结构时，衔接既有 WoMa／SPH 初值研究，而非让地表颜色决定材料内部状态。

### 第四批：黑洞与表面飞行专项

黑洞先做一个非旋转模型、固定观察路径、背景星与遮挡的独立实验。对照解析极限／参考实现，建立图像和数值误差、时空坐标与性能记录，再评估旋转、偏振、自由落体及 NPGS 的其他功能。不能把数学延拓区域展示写成可观测天体内部的已确认现实。

真正飞到地表需要球面几何分块、分层细节、相机相对坐标与远近景遮挡的一致设计；不能靠把现有球面贴图无限放大完成。此方向在第一、二批稳定后再展开。

## 原创预设与交互提案

以下是待实现方案；不使用作者视频帧或竞品素材做卡片。初期卡片应由本应用同一份配方渲染，避免封面与实际实验不符。

| 预设 | 用户能操作什么 | 展示边界／依赖 |
| --- | --- | --- |
| 同一星球的不同面貌 | 固定质量与轨道，只换地表 seed；锁定满意的大陆，再换云层 | 第一批；验证视觉编辑不改变物理状态 |
| 海平面升降 | 在同一地形上调海平面，观察大陆变为群岛 | 第一批；属于外观参数实验，暂不计算水质量迁移 |
| 古老陨坑月 | 对比大坑稀疏与小坑密集，切换掠射光看坑缘 | 第一批；程序化表面，不声称计算了撞击史 |
| 冰封与裸岩 | 同一颗虚构岩质星切换冰盖与裸岩参数，保持镜头 | 第一、二批；温度到冰盖的物理反馈需以后单独建模 |
| 风暴巨行星 | 调风带宽度、涡旋位置与云层速度，环绕近看 | 第一、二批；程序化云动画不等于大气流体求解 |
| 带环行星的黄昏 | 调观察角和恒星方向，比较环影、云影与大气边缘 | 第二批；沿用环动力学的现有适用范围 |
| 双世界对照 | 复制同一初值，只改一个视觉或物理变量，保存两套配方 | 第一、三批；明确本次比较哪种变量，衔接已有观测曲线 |
| 静止观察与自由落体 | 同一黑洞参数使用两种预定观察轨迹，开关解释网格 | 第四批；需要独立模型验收，不能只替换相机插值 |

碰撞后熔融、碎片重新聚合、月球形成继续走物理路线。若将 SPH 比内能映射为温度／发光，需材料状态方程、单位和辐射假设；不能直接把比内能着成红色后宣称是真实温度。

## 鸿蒙实现约束与验收门槛

华为 MCP 的 [XComponent 官方指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/napi-xcomponent-guidelines) 支持通过 NativeWindow 进行 EGL／OpenGLES 等自定义渲染，适合延续当前原生视口。生命周期变化时重建必要的图形资源，从已有场景状态恢复，避免把画布重建和实验重启绑在一起。

[XEngine Kit 简介](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/xengine-kit-introduction) 列有 Maleoon GPU、系统能力／扩展查询、模拟器不支持及中国大陆服务范围等约束。因此超分、可变着色率和相关扩展只能作为经过探测的可选增强，不作为手机、平板、电脑和海外版本都必须具备的基础。硬件光追也不会自动完成弯曲时空光线积分。

[Maleoon GPU 最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-maleoon-gpu-best-practices) 提醒关注实际 GPU 瓶颈、过度绘制、带宽和循环成本。这里选择投影分档、减少全屏透明层与可控采样数属于工程推导，效果必须在设备上测量。

| 验收方面 | 完成条件 |
| --- | --- |
| 可重复性 | 相同配方在同一生成器版本可恢复；存档、复制、撤销与 CLI 一致；跨 CPU／GPU 的浮点容差另定义，不虚报逐位一致 |
| 连续操作 | 近看、编辑、退回全景沿用场景与物理时钟；生成期间可取消，快速切换不把旧纹理覆盖到新选择上 |
| 图像质量 | 接缝、极点、昼夜交界、云影方向、无大气天体、远景闪烁和环带遮挡分别有固定相机对照 |
| 资源与设备 | 记录生成耗时、主线程阻塞、帧时间分布、上传峰值与缓存上限；模拟器只能做功能基线，手机／平板／电脑真机分别测 |
| 旋转与折叠 | 连续调整窗口时保持选中对象、编辑草稿和相机；资源重建后恢复同一外观配方与沉浸布局 |
| 科学边界 | 外观、初值生成和动力学结果分别标识；材料、单位、参数范围和收敛记录可追溯 |
| 许可与运营 | 正式引入前固定源码提交与许可，资源独立登记；基础生成离线可用，国内镜像与增强包沿用已有运营预研 |

本轮交付是源码选读、候选取舍、分批路线与证据索引。应用仍为 0.31.0；本轮没有新的构建、模拟器或真机测试，历史 HAP／ZIP 与验收保持原快照。
