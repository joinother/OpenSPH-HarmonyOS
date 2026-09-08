# SPH 材料团块

> 类型：当前方法与格式参考；适用版本：0.56.0；核对与验证日期：2026-09-08（Asia/Shanghai）。

## 当前能力

从每帧 SPH 求解器的双精度质量、位置、速度和光滑长度识别几何连接分量。观察面板与 CLI 能读取逐团质量、粒子数、质心位置／速度和均方根尺度；材料团块着色使用同一份标签，回放时间轴切换时同步更新。没有加入新求解力项、粒子合并或碎片动力学。

0.40.0 增加 [团块连续跟随](FRAGMENT-FOLLOW.md)，按材料点保持镜头目标；几何算法保持不变。0.56.0 新增 [来源质量与 v20 回放](FRAGMENT-PROVENANCE.md)，以下 v10 部分只描述兼容的基础团块布局。

## 连接与统计定义

粒子 i、j 满足 `distance(i,j) <= 1.5 * (h_i + h_j) / 2` 时相连，以无向连接的传递闭包分组。采用对称长度与并查集，避免不等光滑长度导致遍历顺序改变连接结果。当前系数固定为 1.5，方法身份为 `symmetric-smoothing-connectivity-v1`；不是经过分辨率收敛验证的物理碎片定义。

| 字段 | 定义 |
| --- | --- |
| massKg／massFraction | 本团实际粒子质量之和／整帧总质量 |
| centerKm | 质量加权位置，除以 1000 后输出 km |
| velocityKmS | 质量加权速度，除以 1000 后输出 km/s |
| rmsRadiusKm | 相对本团质心的质量加权均方根距离；不是表面半径 |
| rank | 按当前帧质量递减排列，从 1 开始；质量相同按 anchor 排序 |
| anchor | 本团最小粒子序号；只在成员不变时稳定，不是永久天体 ID |
| singletonCount／singletonMassKg | 单粒子团块数量及其总质量；不能解释为已逃逸质量 |

列表每页 8 团；CLI 可取 1–32 团，返回 nextOffset、场景修订、所选帧与时间。跨页读取运行中的实验时需核对这些身份字段。颜色由 anchor 确定，分裂／连接导致 anchor 改变时颜色也可能改变；颜色相近不代表同一团，质量排名才是本帧列表顺序。

低粒子预算的初始碰撞场景在可见球体接触前，光滑长度邻域就可能连通。本轮 200 预算、实际 212 粒子的三种准备／引力配置均测得初始 1 团。保留这一结果，不为得到“两个球”临时改变阈值。几何连接既不检查材料强度，也不检查引力束缚、逃逸速度、稳定性或长期再聚合。

## 上游参考与独立实现

核对本地固定 OpenSPH 提交 `f3033faf4422a056dcb79cc6643c7c6f3d9fee19` 的 [Analysis.cpp](https://github.com/pavelsevecek/OpenSPH/blob/f3033faf4422a056dcb79cc6643c7c6f3d9fee19/core/post/Analysis.cpp) 与 [Analysis.h](https://github.com/pavelsevecek/OpenSPH/blob/f3033faf4422a056dcb79cc6643c7c6f3d9fee19/core/post/Analysis.h)。上游后处理提供邻域连通、质量排序及可选逃逸速度相关分组合并。当前实现独立采用对称平均光滑长度；没有导入整套后处理，也未接入其引力合并选项。现有上游 MIT 许可说明保留。

这一步对应 [预研实施核对](RESEARCH-IMPLEMENTATION.md) 的碰撞材料观察缺口。后续仍需持久成员追踪、力项与能量验证、引力束缚诊断，再讨论再聚合；不能以该分组算法宣称完成月球形成模拟。

## 兼容回放 v10 的团块布局

既有 108 字节配置头之后，依次写自引力 uint32（0/1）和预松弛秒数 double；首帧从偏移 120 开始。每帧保留粒子、原十项材料诊断、逐粒子标量、四项结构诊断，然后追加：

1. uint32 团块数量。
2. 每粒子一个 uint32 anchor 标签。
3. 每团 72 字节：anchor uint32、count uint32、mass double、center 三个 double、velocity 三个 double、rmsRadius double。

内部单位均为 SI。读取检查数量界限、标签与直方图一致、唯一 anchor、质量排序、有限数值、总质量闭合，以及配置身份；失败不替换当前实验。当前新 SPH 结果保存 v20，沿用基础材料／局部格式并附加来源，见上述来源说明。引擎测试可以显式关闭团块写入生成旧版兼容夹具，应用没有该降级入口。

v1–v9 未保存分组所需的完整双精度质量、速度和光滑长度，载入后返回 available=false，不从绘制数据猜测。再次保存旧记录仍使用对应旧版。v10 保存的是逐帧观察结果，不是可继续积分的求解器检查点，也不支持加载后重算其他连接阈值。

## 验证与预算

算法检查质量和动量闭合、质量排序、平移／整体加速不变性、粒子排列与不等光滑长度、阈值敏感性、非法摘要拒绝。主机启用 AddressSanitizer／UndefinedBehaviorSanitizer；独立原生模拟器程序测得 200／600／1200／2400 粒子规则点阵约 0.028／0.230／0.843／3.241 ms。算法为 O(N²)，计时只覆盖分组；不是整帧性能或真机速度承诺。

```sh
./scripts/test-sph-fragments.sh
./scripts/test-projection.sh
./scripts/test-emulator.sh 127.0.0.1:5555
# 以下实际应用检查会替换当前实验及单槽回放；先保存用户数据。
node scripts/test-sph-fragments-emulator.mjs 127.0.0.1:5555
node scripts/test-sph-fragments-layout-emulator.mjs 127.0.0.1:5555
```

本轮结果、界面验收和原会话恢复见 [0.39.0 记录](../releases/RELEASE-0.39.0.md)。0.35.0 已记录的固定条件重复性差异仍未解决，完整能量、静力平衡、空间收敛和真机验证仍是后续工作。
