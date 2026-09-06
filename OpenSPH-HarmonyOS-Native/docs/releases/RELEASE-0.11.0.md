# 0.11.0 · 连续行星操作

> 类型：版本记录（仅描述该版本）；适用范围：0.11.0。
> 整理日期：2026-09-06（Asia/Shanghai）。

原始发布日期未单独记录；文内明确写出的验证日期保留原义。当前操作以 [CLI 指南](../CLI.md) 为准。

选中天体、近看、切换目标、编辑和返回全景共用同一个 XComponent 与渲染线程。它们不调用 startScene，不清除时间轴。点击天体后出现近看／编辑／全景浮动操作；近看中提供上一颗／下一颗。编辑会连续进入近看并把天体让到浮层之外：宽屏靠左，手机位于面板上方；关闭面板恢复原构图。系统返回键依次收起面板、返回全景。全景恢复首次进入选中流程前的旋转与缩放。

名称、表面和质量等输入移到编辑器前部，向量预览与增删操作放在后部。各天体草稿在本次页面会话中分别保留，包括无效或空输入；切换目标与关闭面板不丢输入。草稿尚不持久化到磁盘。明确应用、添加／删除天体或载入其他初始条件会重建物理场景并清空草稿。

## 连续画面的实现

旧实现虽然没有重建场景，但镜头中心直接跳到目标，单一近看系数会把新的目标立即放大。现在原生层用 420 ms 五次平滑插值混合各目标的跟踪权重与独立近看权重。跟踪中心每帧使用当前回放或求解帧的天体位置；中途改选从已显示权重继续，因此不会把旧球瞬间替换为新球。窗口构图使用独立 360 ms 过渡，画布尺寸与渲染资源保持不变，天体和轨迹共享构图变换，远景不随浮层平移。

可打断保证位置、尺寸与透明度连续；重定向时插值速度会重新起步，尚不是速度连续的电影运镜系统。天体半径仍是便于观察的显示尺寸，不代表真实比例。材质仍为程序生成表面，未增加地理或气候物理模型。

## Huawei MCP 参考

本轮通过已连接的华为开发者知识 MCP 检索并读取了官方文档。[模态转场](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-modal-transition)说明了覆盖式界面与 Builder 根节点的转场方式；[bindSheet](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-sheet-transition)提示退出动效不能被打断。因此本项目继续使用原画布上的自定义浮层，避免为查看天体导航到新页面。原生相机权重和构图算法为本项目实现，并非华为提供的天文镜头 API。

## CLI 与复现

先执行 listCommands、getUiState。所有新增或调整的按钮继续走 uiAction：focus.N、selection.edit、surface.N、surface.previous、surface.next、orbit.select.N、orbit.near、panel.close、focus.all、ui.back。orbit.select.N 同时切换观察与编辑目标。输入仍走 setUiValue；只有 orbit.apply 应用初始条件。

getState.rendering 新增 sceneRevision、surfaceStarts、cameraMoving、centerX/Y/Z、compositionX/Y/Scale。sceneRevision 标识求解场景；surfaceStarts 统计当前进程中画布启动次数；cameraMoving 覆盖原生目标与浮层构图过渡，不能单独用来判断 ArkUI 抽屉动效或旋转按钮动画结束。getProjectedBodies 返回经过所有构图变换、已提交画面的命中几何。

```sh
node --test tests/cli_transport.test.mjs
scripts/test-projection.sh
node scripts/test-continuity-emulator.mjs 127.0.0.1:5555
node scripts/test-ui-cli-emulator.mjs 127.0.0.1:5555
node scripts/test-picking-emulator.mjs 127.0.0.1:5555 --touch
```

## 验证范围

19 项主机 CLI／事务测试；ASAN/UBSAN 投影、命中、快速重定向及构图过渡测试。模拟器在 707.2 vp 和 345.6 vp 下核对场景编号、画布启动次数、时间、回放游标、240 帧历史均不变，采样到原生镜头过渡中间状态，并核对近看天体边界在编辑浮层之外。另有语义 UI、真实轻点与拖动、材质和星空像素回归。证据保存于 continuity-*.json / txt；截图仅证明布局，未进行真机帧率或端到端动画流畅度基准测试。

仅安装指定模拟器 127.0.0.1:5555，未推送远端、未改动其他设备。物理引擎范围与上游审计保持不变。
