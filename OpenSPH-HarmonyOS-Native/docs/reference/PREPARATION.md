# 准备阶段与取消

> 类型：当前接口与排障说明；适用版本：0.31.0；更新日期：2026-09-07（Asia/Shanghai）。

## 用户体验

生成实验时显示实际阶段与总耗时。主按钮可取消准备，观察面板可停止准备／运行／暂停的求解。取消后保留初始条件和已有画面，再次开始从零计算。阶段停留 15 秒时提示耗时较长，不显示估算百分比，不自动重试。

## 状态与阶段

原生求解线程在边界处上报，ArkUI 与 CLI 读取同一份状态。`getPreparation` 返回 `state`、`error`、`config`、`preparation`；`getState.simulation.preparation` 提供完整状态中的相同字段。

| 字段 | 含义 |
| --- | --- |
| requestId | 本次准备的场景代次；仅当前进程有效，0 表示没有准备记录 |
| stage | 当前／最终阶段 |
| elapsedMs / stageMs | 自本次请求／当前阶段开始的单调时钟毫秒数；结束后冻结 |
| slow | 仍在准备且同一阶段持续至少 15000 ms |
| previousRequestId / previousStage | 当前排队请求等待的旧工作线程代次与阶段；没有则为 0／空字符串 |
| events | 最多 16 个阶段及各自进入时的累计 elapsedMs；不包含时间戳或物理模拟秒数 |

SPH 双球路径为 queued → starting → target → impactor → solver → snapshot → ready；单旋转体跳过 impactor。轨道路径为 queued → starting → orbits → snapshot → ready。取消／异常可在 ready 前结束为 cancelled／failed，之前事件仍保留。ready 后发生运行错误仍通过外层 state／error 报告，准备记录保持 ready。

界面对应“准备实验、生成主天体、生成撞击体、设置运动与材料、准备行星轨道、生成初始画面”；存在旧工作线程时显示“等待上一轮结束”。solver 是上游材料与求解器初始化的组合阶段，不细分其内部函数。previousStage 也可能是 simulation 或 cleanup，表示旧轮计算或资源释放，不能仅凭此字段断言死锁位置。

## 取消与代次隔离

取消立即将本次请求标记为 cancelled，递增场景代次、清除待处理请求并唤醒暂停等待。生成天体、进入材料阶段和生成初始快照的边界检查代次；旧请求不能上报到新准备记录或发布新帧。若上游函数尚未返回，必须等其返回才能退出和释放资源；不会杀线程或并行重启第二个求解器。

ready 时停止准备计时，后续只读查询、曲线操作和暂停不改变它。取消一个已经 ready 的计算保留它的准备记录，不能把 requestId 当作取消后的当前场景代次。载入回放清空准备记录；记录不写入实验配方或回放，也不是可恢复的物理检查点。

## 排查与复现

先保存 `getPreparation` 和 `getState` 的返回，核对配置、请求 ID、阶段停留、旧线程归属和 error。CLI 等待超时会附上最后成功读取的状态；它可能落后于设备实际状态，应保留采集顺序。新请求替换原请求会失败返回，不把另一实验的完成当成成功。用户可取消后重新开始；如果上游函数永久不返回，新请求仍会排队，本功能不保证恢复该情况。

```sh
clang++ -std=c++17 -I entry/src/main/cpp tests/preparation_test.cpp -o /tmp/opensph-preparation-test
/tmp/opensph-preparation-test
node --test tests/*.test.mjs
./scripts/test-emulator.sh 127.0.0.1:5555
node scripts/test-preparation-emulator.mjs 127.0.0.1:5555
node scripts/test-preparation-layout-emulator.mjs 127.0.0.1:5555
```

模拟器脚本会替换当前实验和窗口形态，需先保存初始条件／当前会话并在结束后恢复。确定性时钟测试覆盖 15 秒边界、冻结、旧代次与有界事件；未向正式应用注入故意卡顿。实际应用验收范围见 [0.31.0 记录](../releases/RELEASE-0.31.0.md)。0.30 首次 preparing 超时的原因仍未确定，保留 [原始调查](../evidence/sph-0.30.0-transition-investigation.json)，本版不将新增诊断当作根因修复。
