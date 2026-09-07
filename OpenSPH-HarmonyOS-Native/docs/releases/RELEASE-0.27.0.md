# 0.27.0 · 保留一次结果，再做一次实验

> 类型：版本记录；版本：0.27.0；实现／验证日期：2026-09-07（Asia/Shanghai）。

## 使用方式

轨道实验运行后，在观察面板点“保存本次作参照”，再改变初速或换一个实验。当前结果以青色显示，保存的结果以金色叠加，两组共用实际年数和纵轴。可以切换距离／速度、隐藏参照、替换为本次结果或移除参照；原来的采样最小／最大按钮始终定位当前实验。

例如保留 0.85 倍初速的偏心轨道，再运行 1.00 倍初速的近圆轨道：两条线直接呈现距恒星的变化区别，当前时刻可显示“当前 − 参照”的差值。参照区间不包含该时刻时明确提示，避免将缺失数据当作零；线性插值仅用于读数，导出仍为原始样本。

参照包含来源标题、天体、已应用初始配置、捕获时间与最多 240 帧，独立离线保存。关闭重开、换实验和重算不清除它。界面显示来源摘要，CLI 可读取完整配置与样本，或导出最多 480 行 CSV 和来源 JSON；已有导出文件拒绝覆盖。

## 实现和来源

- [ObservationComparison](../../entry/src/main/ets/common/ObservationComparison.ets) 验证记录、生成共用坐标和两条曲线、按实际时间插值并输出数值 CSV。
- [ObservationStore](../../entry/src/main/ets/common/ObservationStore.ets) 使用一个 128 KiB 上限的应用私有文件，写临时文件、刷新、完整文本核对后替换；失败保留旧参照，损坏文件提供重读和移除入口。
- [页面](../../entry/src/main/ets/pages/Index.ets) 接入同一组 UI／CLI 动作；捕获从原生状态获取已应用配置，不把未应用输入冒充为计算来源。
- [导出工具](../../scripts/export-observation.mjs) 通过现有 CLI 读取数据，不引入后台服务、账号或网络依赖。接口详见 [当前指南](../CLI.md#跨实验参照与数据导出)。

本批次落实既有 [博客与论坛路线](../research/UNIVERSE-SANDBOX-BLOG-FORUM-2026-09-07.md) 的结果比较方向。文件接口通过华为开发者 MCP 核对 [官方文件管理 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-file-fs)，取舍与验证边界见 [API 记录](../evidence/comparison-0.27.0-huawei-api.json)。没有引入同行私有代码或新第三方素材。

## 验证

| 层次 | 本轮结果与证据 |
| --- | --- |
| 主机 | [77 项通过](../evidence/comparison-0.27.0-host-tests.txt)：原语义动作／输入覆盖、共用坐标、区间内插值、非重叠区间、来源验证、深拷贝、冷读、短写／刷新／重命名失败保留旧文件、损坏文件保留、导出与防覆盖 |
| 构建与安装 | [ArkTS 构建成功](../evidence/comparison-0.27.0-build.txt)，[模拟器替换安装成功](../evidence/comparison-0.27.0-install.txt)；使用当前开发模拟器接受的未签名 HAP |
| 模拟器数据 | [真实数据验收](../evidence/comparison-0.27.0-emulator.json)：0.85／1.00 倍初速对照、240+240 帧、两指标差值、原生极值定位、跨场景保留、冷启动、替换／删除持久化和原实验列表保留 |
| 导出 | [480 行 CSV](../evidence/comparison-0.27.0-export.csv) 与 [来源 JSON](../evidence/comparison-0.27.0-export.metadata.json)；逐行核对原采样值，容忍运行时十进制末位的浮点表示差异；实际导出工具及重复路径拒绝已验收 |
| 布局／触摸 | [三种窗口验收](../evidence/comparison-0.27.0-layout.json)：展开、折叠竖屏、折叠横屏，保存／隐藏／显示／移除的实际点击；曲线完整进入可视滚动区域；保留模拟、镜头、原生表面与沉浸状态 |
| 兼容回归 | [原观察曲线回归](../evidence/comparison-0.27.0-observation-regression.json) 与 [原 UI／CLI 回归](../evidence/comparison-0.27.0-ui-regression.json) |
| 恢复 | [恢复原工作状态](../evidence/comparison-0.27.0-restoration.json)：原岩质碰撞配置、60 秒计算终态、镜头、外观、面板和展开方向；原命名实验保留，移除本轮临时备份和测试参照 |

验收命令需要先保护原场景与参照；这些脚本会切换实验和窗口。只操作 `127.0.0.1:5555`，未操作真机。该批次没有修改 C++ 求解器，不将旧版原生数值测试冒充为本轮重跑。

## 截图

- [展开曲线](../../../OpenSPH-0.27.0-comparison-wide.png) / [参照操作](../../../OpenSPH-0.27.0-comparison-controls-wide.png)
- [折叠竖屏曲线](../../../OpenSPH-0.27.0-comparison-phone.png) / [参照操作](../../../OpenSPH-0.27.0-comparison-controls-phone.png)
- [折叠横屏曲线](../../../OpenSPH-0.27.0-comparison-landscape.png) / [参照操作](../../../OpenSPH-0.27.0-comparison-controls-landscape.png)
- [恢复原实验](../../../OpenSPH-0.27.0-final.png)

面板内容可滚动；矮窗口不能同时显示完整曲线和全部参照控件。布局检查分别验证它们滚动进入可视区域后的实际命中，不据此宣称动画帧率或真机性能已达标。

## 边界与后续

参照是单槽、单天体、有限采样的观察记录。它不保存完整历史，不是求解器检查点；数据仍来自显示／回放用的单精度快照，插值不提高物理精度。共享时间轴按各自模拟起点计年，不做真实历元配准；不同模型或天体的可比性需结合来源判断。`deltaReady:false` 时 API 的占位数值不可作差值使用。

隐藏设置和所选指标不持久化；参照不打包进命名实验／回放，卸载或清除应用数据会丢失。保存已测试普通读写失败和冷启动，没有测试断电、目录刷新或多进程同时写入。CSV 当前通过主机 CLI 导出，尚无应用内分享／文件选择器。

本轮不增加行星碰撞合并、破碎、月球形成或新的 SPH 热力学。下一批继续整组初始条件复用和观测导览，再推进卫星扰动、SPH 诊断、自引力与完整检查点。
