# Pi Agent: agy-staff 干净安装与解耦重构实战指南

> **适用场景**：在 Pi Agent（`@earendil-works/pi-coding-agent`）中优雅、稳定地集成 `agy-staff`（Google Antigravity CLI / Gemini 3.8 Flash 桥接器），彻底摆脱官方安装机制带来的深层嵌套与跨环境调用陷阱。

---

## 目录
1. [官方安装方案的痛点剖析](#一官方安装方案的痛点剖析)
2. [最佳实践架构：解耦共享运行时](#二最佳实践架构解耦共享运行时)
3. [一键全自动安装与复用工具（跨平台自适应）](#三一键全自动安装与复用工具跨平台自适应)
4. [手动分步配置详解](#四手动分步配置详解)
5. [Windows / WSL 混合环境防坑指南](#五windows--wsl-混合环境防坑指南)
6. [日常维护与升级](#六日常维护与升级)

---

## 一、官方安装方案的痛点剖析

官方在 `docs/INSTALL_FOR_AGENTS.md` 中推荐的命令为：
```bash
pi install git:github.com/keli-wen/agy-staff
```

这种机制在实际开发和长期使用中存在三大硬伤：

### 1. 9 层嵌套深渊与目录污染
官方将整个 Git 仓库视作复合 Package 拉取，克隆到：
```text
~/.pi/agent/git/github.com/keli-wen/agy-staff/pi-skills/agy-ask/SKILL.md
```
整整 **9 层目录深度**。把不需要的开发文档、测试用例、发布脚本、各平台插件配置全部拉入用户的 Pi agent 目录中，违背了 Skill 简单扁平的设计初衷。

### 2. 包冲突与静默跳过（Collision / Skipped）
当本地存在同名开发分支、多工作区或重装时，Pi 的包加载器会产生严重的命名冲突：
```text
[Skill conflicts]
  "agy-ask" collision:
    ✓ E:\Desktop\agy-staff (user) E:\Desktop\agy-staff\pi-skills\agy-ask\SKILL.md
    ✗ ~\.pi\agent\git\github.com\keli-wen\agy-staff\pi-skills\agy-ask\SKILL.md (skipped)
```
后安装的包经常被静默跳过，导致用户误以为安装成功，调用时却执行旧版本或报错找不到指令。

### 3. 相对路径调用与跨环境执行陷阱
官方技能使用相对路径向上穿透查找伴侣脚本：
```bash
node "<skill-dir>/../../companion/agy-companion.mjs" ask [flags]
```
在 Windows 与 WSL 混合开发机上，如果 Pi 未显式指定 Shell，会回退到 `C:\Windows\System32\bash.exe`（WSL2），而 WSL 中如果没有单独安装 Linux 版本的 Node.js，就会直接爆出 `/bin/bash: line 1: node: command not found`，或者发生 Windows 路径传给 Linux 进程的解析崩溃。

---

## 二、最佳实践架构：解耦共享运行时

为了彻底解决上述问题，本方案采用 **“运行时中心化 + 技能扁平化”** 的解耦架构：

```text
Pi Agent 标准体系                    全局共享运行时 (~/.agy-staff)
~/.pi/agent/skills/
├── agy-ask/SKILL.md ---------\
├── agy-researcher/SKILL.md ---\
├── agy-staffer/SKILL.md -------\
├── agy-reviewer/SKILL.md -------> node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs"
├── agy-implementer/SKILL.md ---/               |
├── agy-lead/SKILL.md ---------/                v
└── agy-jobs/SKILL.md --------/     [companion/ & templates/]
                                                |
                                                v
                                  Google Antigravity CLI (agy)
                                                |
                                                v
                                      Gemini 3.8 Flash
```

### 核心收益
1. **纯净扁平**：Pi 的 `~/.pi/agent/skills/` 下只有干净的 7 个技能文件夹，符合 Pi 官方规范，零深度嵌套。
2. **多宿主共用**：无论是 Pi、Claude Code 还是 Codex，均可共享 `~/.agy-staff` 运行时，不重复占用磁盘空间。
3. **升级零侵入**：后续升级只需同步更新 `~/.agy-staff` 目录，7 个技能定义完全不用重新安装。
4. **包列表干净**：`pi list` 显示 `No packages installed`，完全规避 package 命名碰撞。

---

## 三、一键全自动安装与复用工具（跨平台自适应）

为了避免因为不同机器盘符不同、用户名不同、NVM 目录不同而报错，安装工具采用**纯原生 Node.js 编写**（无任何第三方依赖），在所有操作系统上原生自适应运行：

### 1. 运行方式

无论是在 Windows（PowerShell / CMD / Git Bash）、macOS（zsh / bash）还是 Linux / WSL 下，直接使用 Node 启动：
```bash
node ./scripts/install-clean-pi.mjs
```

### 2. 常用参数与安全模式
* **演练预览（Dry-Run）**：不写入任何磁盘文件，仅输出将执行的检测与操作：
  ```bash
  node ./scripts/install-clean-pi.mjs --dry-run
  ```
* **连网冒烟测试（Test）**：安装完成后发起一次真实 Gemini API 调用（默认仅进行离线完整性与语法校验，避免未登录/无网报错）：
  ```bash
  node ./scripts/install-clean-pi.mjs --test
  ```
* **强制同步运行时（Sync-Runtime）**：即使检测到 `~/.agy-staff` 运行时已健康完整，也强制覆盖同步最新代码（别名 `--force-runtime`）：
  ```bash
  node ./scripts/install-clean-pi.mjs --sync-runtime
  ```
* **自定义目标路径**（安装器将自动动态重定向已部署技能）：
  ```bash
  node ./scripts/install-clean-pi.mjs --runtime-dir ~/.my-agy --skills-dir ~/.pi/agent/skills
  ```
* **自定义配置文件或源码目录**：
  ```bash
  node ./scripts/install-clean-pi.mjs --settings-file ~/.pi/agent/settings.json --source-repo /path/to/agy-staff
  ```
* **跳过 WSL 互通链接**（Windows 下纯原生环境）：
  ```bash
  node ./scripts/install-clean-pi.mjs --no-wsl
  ```

### 3. 支持的环境变量
脚本与技能原生支持以下环境变量覆盖：
- `AGY_STAFF_HOME`：全局共享运行时位置（覆盖默认的 `~/.agy-staff`）。
- `PI_CODING_AGENT_DIR` 或 `PI_HOME`：Pi Agent 配置根目录（覆盖默认的 `~/.pi/agent`）。

### 4. 工具内部的自适应机制
1. **清理旧包零外部依赖**：直接解析 `settings.json` 剔除 Package 声明并清理深层 Git 缓存，不依赖特定的 `pi` / `npm` / `nvm` 外部命令行路径。
2. **WSL 动态安全检测**：仅当检测到真实活动的 WSL 发行版且不存在实体目录冲突时才配置；通过 `wslpath` 动态计算 Linux 挂载路径，杜绝手工拼接。
3. **Shell 智能动态探测与保护**：自动沿系统 PATH 中的 `git.exe` 倒推 Git Bash，同时扫描常见安装候选池；若用户已有现成的有效配置，坚决保持不变。
4. **共享运行时按需智能检测**：自动校验 `~/.agy-staff/companion/agy-companion.mjs` 语法与 `templates/` 文件完整性。如果已由 Hermes Agent 或先前安装初始化且处于健康状态，**自动跳过运行时复制**，仅部署 Pi 技能；若需更新可传入 `--sync-runtime`。

---

## 四、手动分步配置详解

如果你需要在无脚本环境下手动复刻该流程，分为以下四步：

### 步骤 1：清退旧版 Package
检查确认 `~/.pi/agent/settings.json` 中的 `"packages"` 数组为空，并删除 `~/.pi/agent/git/github.com/keli-wen/agy-staff` 目录。

### 步骤 2：创建并放置运行时中心
在主目录建立 `~/.agy-staff`：
```bash
mkdir -p "$HOME/.agy-staff"
cp -r companion "$HOME/.agy-staff/"
cp -r templates "$HOME/.agy-staff/"
```

### 步骤 3：部署与改造 7 个技能
1. 复制仓库中 `pi-skills/` 下的所有目录至 Pi 用户目录 `~/.pi/agent/skills/`。
2. 将每个技能中 `SKILL.md` 及 `references/` 的调用命令替换为标准引用：
   ```bash
   node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs" <persona> [flags]
   ```
   > [!TIP]
   > 采用 `${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}` 级联展开语法：既允许配置 `AGY_STAFF_HOME` 环境变量自定义运行时，又在 Windows 下优先使用 `$USERPROFILE` 杜绝 MSYS `/c/Users` 路径解析崩溃，在 Linux/macOS 下安全回退到 `$HOME`。

### 步骤 4：验证 Pi 识别状态
在终端中执行测试 Node 代码，确认 Pi 成功识别技能且无任何报错：
```javascript
const { loadSkills } = require(".../@earendil-works/pi-coding-agent/dist/core/skills.js");
console.log(loadSkills({ agentDir: "C:/Users/<user>/.pi/agent", skillPaths: [], includeDefaults: true }));
```

---

<a id="五windows-wsl-混合环境防坑指南"></a>
<a id="五windows--wsl-混合环境防坑指南"></a>
## 五、Windows / WSL 混合环境防坑指南

在 Windows 机器上使用 Pi 时，最容易出现的故障是 **Shell 降级踩坑**：

### 现象
Pi 试图执行命令时报：
```text
/bin/bash: line 1: node: command not found
```
或者后台任务崩溃报：
```text
agy-staff error: unknown subcommand: C:\Users\...
```

### 根因
Pi 内部使用 `where bash` 查找默认 Shell。如果 Git 安装在非标准目录（如 `D:\Develop_Tool\Git`），Pi 找不到默认的 `C:\Program Files\Git\bin\bash.exe`，就会自动回退到 `C:\Windows\System32\bash.exe`（即 WSL2 Linux 子系统）。由于 WSL2 内部没有安装 Linux 版本的 Node.js，且无法直接解析 Windows 的路径语法，导致命令全部崩溃。

### 解决方案
在 `~/.pi/agent/settings.json` 中强行指派 Windows 原生 Git Bash 的绝对路径：
```json
{
  "packages": [],
  "shellPath": "D:\\Develop_Tool\\Git\\bin\\bash.exe",
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-v4-pro"
}
```
这样 Pi 在 Windows 下就会始终使用 Git Bash 执行，能直接共享宿主机的 Node.js 环境与 Windows 盘符路径。

---

## 六、日常维护与升级

采用此解耦架构后，日常更新变得极为简单快捷：

| 操作 | 传统官方方法 | 本方案（解耦共享运行时） |
| :--- | :--- | :--- |
| **升级代码** | `pi update --extension git:...`（常遇 git 锁或无法拉取） | 直接更新 `~/.agy-staff` 下的 `companion` 与 `templates` 即可，**无需动 Pi** |
| **测试连通** | 必须进入 Pi 对话中测试 | 随时在普通命令行运行 `node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs" ask` |
| **清理卸载** | `pi remove` 后留下一堆缓存 | 直接删除 `~/.pi/agent/skills/agy-*` 与 `~/.agy-staff`，干净彻底 |
