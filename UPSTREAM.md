# 上游基线（Upstream）

本仓库是 **OpenSPH 的鸿蒙适配层 + 壳工程 + 汉化**，**不 fork、不 vendor 上游源码**。
上游改动全部以 `patches/` 里的补丁形式提供，可精确复现。

## 锚点

| 项目 | 值 |
|---|---|
| 上游仓库 | https://github.com/pavelsevecek/OpenSPH |
| 基线版本 | **v0.4.1** |
| 基线提交 | `7415f249663e1a1b91b7f8e8df703ca8b2cd360e` |
| 基线日期 | 2022-11-16 |
| 判定依据 | `patches/opensph-harmonyos.patch` 里 `CMakeLists.txt` 的 blob 前缀 `e57ca46`，与上游 v0.4.0/v0.4.1 完全一致 |

> 上游完整历史**未**推入本仓库：上游包含 `.github/workflows/`，推送需要 GitHub token 的 `workflow` 权限。
> 需要对比时用下面的脚本，或在本地 `git fetch upstream --tags` 后把 v0.4.1 打成自己的标签。

## 怎么查看「移植到底改了什么」

```bash
git remote add upstream https://github.com/pavelsevecek/OpenSPH.git   # 若尚未添加
git fetch upstream --tags
git checkout upstream/base-v0.4.1
git apply ../patches/opensph-harmonyos.patch     # 在另一份工作树里执行更安全
git diff                                          # 逐行差异
git diff --stat                                   # 12 个文件 / +558 −127
```

更省事的方式：

```bash
tools/bootstrap-upstream.sh          # 克隆 v0.4.1、打补丁、切到可 diff 的状态
```

脚本会在 `upstream/opensph/` 建一个**独立**的上游副本（已被 `.gitignore` 忽略），
打完补丁后直接 `git -C upstream/opensph diff` 就能看到完整改动。

## 上游现状（2026-10-28 核查）

- 上游**基本停更**：2026 年只有 4 个提交（2026-10-08/09，HDF5 读写支持 + 暗色主题），此前 2024-07 至 2026-10 有两年多空窗
- **最新 tag 仍是 v0.4.1**（2022-11-16），四年未发版
- `v0.4.1 → master` 差距很小：**10 个提交 / 32 个文件 / +1672 −200**

因此升级基线成本不高。若要跟进，流程是：

1. `git diff v0.4.1 master -- gui core` 看上游改了什么
2. 在新基线上 `git apply patches/opensph-harmonyos.patch`，解冲突
3. 更新本文件的基线提交与标签，重新验证构建

## 补丁清单

| 补丁 | 目标 | 文件数 | 改动 |
|---|---|---|---|
| `patches/opensph-harmonyos.patch` | OpenSPH | 12 | +558 / −127 |
| `patches/wxwidgets-harmonyos.patch` | wxWidgets | 8 | +472 / −8 |
| `patches/sse2neon.h` | 编译期头文件 | 1 | 新增 |

## 升级到上游 master 的可行性（2026-10-28 实测）

在上游 `master`（`c2141cf5`）上干跑 `patches/opensph-harmonyos.patch`：

| 结果 | 文件 |
|---|---|
| ✅ 干净应用 | 10 / 12 个文件 |
| ⚠️ 需手工解冲突 | `gui/launcherGui/LauncherGui.cpp`（整文件头 hunk，209 行拒绝）、`gui/windows/MainWindow.cpp`（54 行拒绝） |

所以升级不是重打全部补丁，**只需处理这 2 个文件**。建议流程：先在 `tools/bootstrap-upstream.sh` 建好的上游副本里切到 `master`，
用 `git apply --reject` 看拒绝片段，手工合并后再跑一次构建验证。
