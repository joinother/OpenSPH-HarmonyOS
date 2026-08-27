# 鸿蒙版 OpenSPH 命令行（CLI）使用说明

OpenSPH 在鸿蒙电脑上除了交互式 GUI（wxWidgets 窗口）外，还支持 **headless 命令行模式**：
不打开任何窗口，直接从命令行加载并运行 OpenSPH 工程（session 文件），进度与结果输出到
hilog。适合自动化、批量跑模拟、脚本集成等场景。

CLI 内核移植自上游 OpenSPH 自带的 `cli/launcher/Launcher.cpp`（opensph-cli），参数与
桌面版保持一致：`-p <session.sph> -n <nodeName>`。

## 1. 触发方式

CLI 通过 `hdc` 启动应用并携带 `want.parameters` 参数触发：

```bash
# 结构化传参（推荐，避免命令行空格/引号问题）
hdc shell aa start -a QAbility -b com.opensph.app \
  --ps cli 1 \
  --ps project /data/storage/el2/base/haps/entry/files/demo.sph \
  --ps node simulation

# 也可以整条命令字符串传入（需要正确的引号包裹，路径内不能有空格）
hdc shell aa start -a QAbility -b com.opensph.app --ps cli "完整命令"
```

- `cli`：开启 CLI 模式的开关（`1` 表示开启）。
- `project`：session 文件绝对路径（沙箱内路径）。
- `node`：要运行的节点名（工程内某个 job 节点，如 `simulation`）。

带 CLI 参数启动后，应用以 headless 方式运行，跑完自动退出（进程退出码 0 成功，
-1 失败）；不带任何参数启动则正常打开 GUI 窗口，互不影响。

## 2. 查看运行日志

运行日志（含节点树、运行进度、错误）通过 hilog 输出，域 `OpenSPH`：

```bash
hdc shell "hilog -x | grep OpenSPH"
```

典型成功输出：

```
cli: executing headless command:  -p .../demo.sph -n simulation
OpenSPH-CLI (version 0.4.1-ohos)
Running node tree:
 - simulation
    - spin-up
       - object
          - ...
CLI run finished.
cli: finished with exit code 0
```

## 3. 预置演示工程

- 演示工程 `demo.sph`（旋转块体 200 粒子、模拟 1 秒）已打进 HAP 的 rawfile，
  QAbility 启动时自动拷贝到沙箱：
  `/data/storage/el2/base/haps/entry/files/demo.sph`
- 运行它：`--ps node simulation`，产物输出到同一沙箱目录。

## 4. 参数语义（与 opensph-cli 一致）

| 参数 | 短名 | 说明 |
|---|---|---|
| `--project <path>` | `-p` | session（.sph）工程文件路径，必填 |
| `--node <name>` | `-n` | 要评估运行的节点名，必填 |
| `-h/--help` | | 打印帮助 |

全局设置（线程数、核函数等）当前由 CLI 侧默认值提供，后续可扩展从工程 `globals` 节加载。

## 5. 实现要点（开发者）

- `OpenSPH/gui/launcherGui/OhosCli.cpp`：CLI 执行器（从上游 opensph-cli 移植），
  含 `HilogLogger`（日志转发 hilog）、`LoadProc`（Config → VirtualSettings）、
  `runCliCommand(args)` 入口。
- `OpenSPH/gui/launcherGui/LauncherGui.cpp`：`App::OnInit` 检测 CLI 参数（环境变量
  `OSPH_CLI_ARGS` 或沙箱 arg 文件），命中则 headless 运行后 `exit`。
- `OpenSPH-DevEco/.../QAbility.ets`：解析 `want.parameters` 的 `cli/project/node`，
  拼接命令写入沙箱 `opensph_cli.txt`；`opensph_cli.txt` 由 native 读取后删除（一次性）。
- 上游 CLI 源文件：`cli/launcher/Launcher.cpp`（桌面版 opensph-cli，可独立编译）。
