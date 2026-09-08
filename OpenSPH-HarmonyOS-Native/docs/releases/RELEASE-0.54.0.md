# 0.54.0 · 真实轨道入射驱动局部 SPH

> 类型：开发断点记录；实现与验证日期：2026-09-08（Asia/Shanghai）。

## 本批实现

接触后的“模拟这次撞击”使用反弹前真实三维状态生成岩质粒子，开启自引力并运行破坏与热软化。初始化核对质量与质心预算，进入前保留整个已显示的轨道会话；准备中取消、计算后返回可以恢复原时间、全部天体、历史及镜头／外观。保存的 v17 局部回放带入射来源，普通配方保存会拒绝，防止丢失初值。

界面与 CLI 共用 `impact.simulate`、`impact.return`。结果完成后主按钮变为返回轨道；加载的局部回放只播放已有结果，仍可切换其他实验。参数／实验库在有父会话时提示先返回，避免出现看似可编辑、实则丢失来源的操作。

当前是外部世界暂停的局部实验分支，冷态、均匀玄武岩、零自转；没有外部引力、残骸回注、持久父会话、连续液态表面或真正相变。操作、状态、数值语义和存档布局见 [局部撞击](../reference/LOCAL-IMPACT-SPH.md)。

## 本轮验证

- [主机共享动作、输入和配方检查](../evidence/impact-sph-0.54.0/host-tests.txt)：113 项，包含分支启动／恢复、禁止丢失来源的操作和返回按钮语义。
- [原生粒子与引擎检查](../evidence/impact-sph-0.54.0/native.txt)：独立汇总实际采样粒子的质量、三维质心、动量、动能、角动量；斜向／垂向入射，641 粒子 8.12 秒演化，内能增长约 1.97e25 J；准备取消、过期／重复拒绝、精确父状态恢复、v17 来源／诊断和损坏拒绝。
- [入射 v16 回归](../evidence/impact-sph-0.54.0/incoming-regression.txt)、[连续轨道回归](../evidence/impact-sph-0.54.0/orbit-regression.txt)、[SPH 专项回归](../evidence/impact-sph-0.54.0/sph-regression.txt)。SPH 专项仍用 `--sph-only`，不把旧全域轨道格式断言计作通过。
- [实际应用 60 秒实验](../evidence/impact-sph-0.54.0/device.json)与[页面截图](../evidence/impact-sph-0.54.0/local-sph.jpeg)：质量／初始动能、热状态变化、受限操作拒绝、v17 保存、原世界时间／向量／历史／外观返回、独立回放退出。
- [既有 UI／CLI 回归](../evidence/impact-sph-0.54.0/cli-regression.json)、[构建](../evidence/impact-sph-0.54.0/build.txt)、[指定模拟器安装](../evidence/impact-sph-0.54.0/install.txt)。
- [用户原场景恢复](../evidence/impact-sph-0.54.0/restoration.json)及[持久文件逐字节核对](../evidence/impact-sph-0.54.0/files-restored.json)。

开发中修正了上游粒子数组的引用访问，以及测试对旧 SPH 回放默认选中首帧的假设；先定位末帧再比较末态。初始化预算和运行检查均重新执行，不把只读换算当作实际 SPH 演化。没有注入真实内存不足来验证异步失败，也未验证进程退出后的父会话恢复、科学分辨率收敛、真机性能、触摸或动画帧率。
