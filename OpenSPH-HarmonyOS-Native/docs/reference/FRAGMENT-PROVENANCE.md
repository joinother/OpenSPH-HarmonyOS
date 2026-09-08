# 碎片来源质量

> 类型：当前模型与格式参考；适用版本：0.56.0；实现与验证日期：2026-09-08（Asia/Shanghai）。

## 对应的用户需求

[公开创作者样本](../research/TARGET-CREATOR-651227816-2026-09-08.md)提到材料分析与残骸来源。本批让碰撞后的每个几何团块显示来自双方的实际质量比例，方便观察哪些材料留在大团块、哪些进入小团块。它为 P2 的身份追踪及 P4 的质量核对提供基础，没有改变力项或让残骸返回主世界。

来源取自固定上游 OpenSPH 的 `Initial.cpp` 写入的 `QuantityId::FLAG`，质量取自求解器双精度 MASS。双岩体分别为 0、1，单岩体只有 0；不再按绘制数组的前后半段猜测归属。每帧按现有几何团块标签累计逐粒子质量；两个粒子质量为 2 和 8 时，比例为 20% 和 80%。不能用粒子数量或母体总比例替代逐团统计。

双方仍使用同一种玄武岩材料。来源不是地核／地幔、元素成分或熔融比例；几何团块也不是已确认引力束缚的天体。团块排名和 anchor 可随分裂／连接改变，来源指向初始岩体，不是永久碎片编号。几何定义见 [SPH 材料团块](SPH-FRAGMENTS.md)。

## 界面与 CLI

观察面板顶部的“碎片来源”把团块列表移到热状态之前；“热状态”恢复原顺序。`fragments.inspect` 和 `fragments.material` 与按钮共用实现，`getState.ui.fragmentFirst` 和 `getUiState.fragmentFirst` 返回这个临时查看偏好。切换不重算、不改时间，偏好不写入实验配方。“按来源看”使用既有 `color.0` 灰岩／赭岩视图；列表仍可分页、跟随团块或停止跟随。

`getSphFragments {offset,limit}` 的 fragments 对象新增：

| 字段 | 含义 |
| --- | --- |
| originAvailable／originReason | 是否存在实际逐粒子质量和来源；缺失时明确说明 |
| originModel | `initial-rock-body-mass-v1` |
| originMaterial | `basalt-single-material-v1` |
| originNamespace／originIds／originLabels | 普通实验为 `initial-sph-body-index`；局部撞击为 `orbit-contact-body-index`，索引对应源接触中的两个天体 |
| originEventCount／originEventTimeSeconds | 仅局部撞击有值，接触序号及事件绝对秒数；需与来源命名空间一同解释 |
| originTotalsKg | 所有团块来源 A、B 的总质量，分页不改变它 |
| groups[].originMassKg／originFractions | 本团来自 A、B 的质量及占本团质量的比例 |
| sceneRevision／frameIndex／time | 原子快照的场景、保留帧索引和局部秒数；selected 保留 −1 表示最新帧的既有语义 |

单岩体的 originIds 为 `[0,-1]`，第二项质量为 0。轨道索引只在该源事件内有意义，不是跨工程的全局天体编号。导出元数据保留事件身份，不能仅凭数字索引跨不同实验合并来源。

`getSphFragmentTable {offset:0,limit:32}` 返回同一原子快照的元数据和 17 列 CSV：命名空间、事件序号、事件秒数、材料模型、场景修订、帧索引、局部时间、排名、anchor、粒子数、团块质量，以及双方各自的源索引、质量、比例。普通实验的事件两列为空。返回 rows 和 nextOffset；到 −1 结束。连续读多页时先暂停，并核对 sceneRevision、frameIndex、time；若变化则重新读取，不能拼接不同帧。缺少来源质量的旧回放拒绝此表，几何团块查询仍可用。

## v20 回放

当前新 SPH 计算保存 v20。魔数之后依次为 uint32 的 20 和基础版本（15 普通材料、17 隔离局部、19 潮汐局部），再写基础格式其余配置头。每帧保留完整基础格式载荷，随后每个粒子写 double 质量（kg）和 uint32 来源，共 12 字节，无结构体填充。轨道 v18 格式未改。

读取要求基础版本属于 15／17／19、质量正且有限、来源为 0／1 且与绘制归属一致；本模型固定粒子数量、质量与来源，所有帧必须逐粒子一致。逐团质量、总质量及按半径／密度得到的双方初始质量分别核对。损坏、截断、多余字节和嵌套 v20 拒绝且保留当前场景。新的粒子重排／增删模型未来需要重新定义格式契约。

旧 v15／v17／v19 可读，但缺失原始质量时明确无法统计，不从浮点绘制数据补造。再次保存仍沿用旧格式；仅 C++ 测试可显式 `includeOrigins=false` 生成兼容夹具，应用不暴露降级。v20 仍是观察回放，没有完整求解器状态、持续父会话或碎片回注。

## 验证入口

```sh
bash scripts/test-sph-provenance.sh
bash scripts/test-provenance-emulator.sh 127.0.0.1:5555
node --test tests/cli_transport.test.mjs tests/project_recipe.test.mjs tests/cli_wait.test.mjs
# 下项会修改模拟器当前实验和单槽回放，先按项目流程备份。
node scripts/test-provenance-ui-emulator.mjs 127.0.0.1:5555
```

实际结果见 [0.56.0 记录](../releases/RELEASE-0.56.0.md)。本批验证质量来源及数据路径，没有新增物理收敛、束缚判据、液态相变或真机性能结论。
