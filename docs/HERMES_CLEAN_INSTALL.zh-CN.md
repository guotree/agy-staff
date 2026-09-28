# Hermes Agent: agy-staff 干净安装与解耦重构实战指南

> **适用场景**：在 Hermes Agent（Nous Research 出品）中优雅、稳定地集成 `agy-staff`（Google Antigravity CLI / Gemini 3.8 Flash 桥接器），实现与 Pi Agent / Claude Code / Codex 共享全局运行时，按分类清晰组织，零目录污染。

---

## 目录
1. [架构优势：解耦共享运行时](#一架构优势解耦共享运行时)
2. [智能检测机制：按需安装共享运行时](#二智能检测机制按需安装共享运行时)
3. [Hermes 与 agentskills.io 规范适配](#三hermes-与-agentskillsio-规范适配)
4. [一键全自动安装（跨平台自适应）](#四一键全自动安装跨平台自适应)
5. [Windows / MSYS 环境下的路径防坑要点](#五windows--msys-环境下的路径防坑要点)
6. [日常使用与验证方式](#六日常使用与验证方式)

---

## 一、架构优势：解耦共享运行时

本方案延续了在 Pi Agent 上验证成熟的 **“运行时中心化 + 技能分类归属”** 解耦架构：

```text
Hermes Agent 标准体系                     全局共享运行时 (~/.agy-staff)
<hermes-home>/skills/agy-staff/
├── agy-ask/SKILL.md ------------\
├── agy-researcher/SKILL.md ------\
├── agy-staffer/SKILL.md ----------\
├── agy-reviewer/SKILL.md ----------> node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs"
├── agy-implementer/SKILL.md -----/                |
├── agy-lead/SKILL.md ------------/                 v
└── agy-jobs/SKILL.md -----------/      [companion/ & templates/]
                                                   |
                                                   v
                                     Google Antigravity CLI (agy)
                                                   |
                                                   v
                                         Gemini 3.8 Flash
```

### 核心收益
1. **多宿主共用底层运行时**：无论是 Hermes、Pi、Claude Code 还是 Codex，均可共享同一个 `~/.agy-staff` 运行时中心，不重复占用磁盘空间。
2. **分类组织整洁**：安装至 Hermes 的 `skills/agy-staff/` 专属分类子目录中，`hermes skills list` 显示清晰归属为 `agy-staff`，绝不污染全局根目录。
3. **升级零侵入**：后续升级只需更新 `~/.agy-staff` 下的 `companion` 与 `templates`，Hermes 的 7 个技能定义无需重新安装。
4. **渐进式上下文加载（Progressive Disclosure）**：完全遵循 `agentskills.io` 规范，一级索引仅注入名称与短描述，按需激活加载完整指令，极大节约系统 Prompt Token。

---

## 二、智能检测机制：按需安装共享运行时

考虑到宿主机器上可能已经有其他 Agent（如 Pi Agent）安装并初始化了共享运行时，安装器内置了**健康度自适应检测**逻辑：

* **若运行时已就绪且完整**：
  自动校验 `~/.agy-staff/companion/agy-companion.mjs` 语法与 `templates/` 文件完整性。如果已由其他 Agent 安装，**自动跳过运行时的复制**，仅安装 Hermes 技能定义。
* **若运行时缺失或损坏**：
  自动从当前仓库部署最新的 `companion/` 与 `templates/` 目录至 `~/.agy-staff`。
* **若需强制更新/同步最新代码**：
  支持附加 `--sync-runtime` 或 `--force-runtime` 参数，强制覆盖更新共享运行时。

---

## 三、Hermes 与 agentskills.io 规范适配

Hermes 对技能（Skill）有其原生标准与校验要求：

1. **元数据标准**：
   Frontmatter 必须声明 `platforms: [linux, macos, windows]`，否则在 Windows 宿主机上未匹配平台会被 Hermes 扫描器直接静默跳过。
2. **工具调用契约、超时单位与纯净标准命令**：
   在技能说明中明确指导模型使用 Hermes 提供的 `terminal(command=...)` 执行标准 `node "..."` 命令：
   - **前台执行与 PTY 禁用**：必须以标准前台命令运行（`background: false, pty: false`），直接收取返回的标准输出和错误。
   - **超时参数单位陷阱（必须为秒）**：Hermes 的 `terminal` 工具中，`timeout` 参数的单位**是秒而非毫秒**（例如 2 分钟应传入 `timeout: 120`）。**切勿传入毫秒（如 `120000`）**，否则会超过 Hermes 设定的 600 秒前台上限，触发强制降级到后台静默管道（`DEVNULL`），造成命令输出丢失和等待失败。
   - **Windows winpty 别名 100% 隔离**：针对 Windows 环境下 Git Bash 预设的 `alias node="winpty node.exe"` 别名劫持问题（该别名会导致非 TTY 管道调用抛出 `stdin is not a tty` 异常），安装器采用宿主 100% 隔离策略：通过 Hermes 原生终端配置（生成 `<hermes-home>/hermes-terminal-init.sh` 并安全注册到 `config.yaml` 的 `terminal.shell_init_files`）在后台子终端中针对性解除别名，**完全不触碰、不污染宿主操作系统的全局 Shell 配置（如 `~/.bash_profile` / `~/.bashrc`）**。既保证技能提示词保持纯净跨平台的 `node` 标准语法，又实现宿主系统零副作用、零残留。
3. **支持目录解耦**：
   技能附带的 `references/`（如 `code-review.md`、`troubleshooting.md`）遵循 Hermes 的二级渐进式加载支持目录规范，可通过 `skill_view` 按需读取。

---

## 四、一键全自动安装（跨平台自适应）

安装脚本采用**纯原生 Node.js** 编写，零第三方依赖，在 Windows、macOS 和 Linux 上开箱即用：

### 1. 快速安装
```bash
node ./scripts/install-clean-hermes.mjs
```

### 2. 常用参数与灵活配置
* **演练预览（Dry-Run）**：不写入任何磁盘文件，仅打印将要执行的操作：
  ```bash
  node ./scripts/install-clean-hermes.mjs --dry-run
  ```
* **连网冒烟测试（Test）**：安装完成后发起一次真实 Gemini API 调用：
  ```bash
  node ./scripts/install-clean-hermes.mjs --test
  ```
* **强制覆盖更新共享运行时**：
  ```bash
  node ./scripts/install-clean-hermes.mjs --sync-runtime
  ```
* **自定义共享运行时目录**（安装器将自动动态重定向已部署技能）：
  ```bash
  node ./scripts/install-clean-hermes.mjs --runtime-dir /path/to/custom-runtime
  ```
* **自定义 Hermes 根目录、技能目录或分类**：
  ```bash
  node ./scripts/install-clean-hermes.mjs --hermes-home ~/.my-hermes --category custom-agy
  ```
* **跳过 WSL 互通链接**（Windows 下纯原生环境）：
  ```bash
  node ./scripts/install-clean-hermes.mjs --no-wsl
  ```

### 3. 支持的环境变量
脚本与技能原生支持以下环境变量覆盖，无需修改代码：
- `AGY_STAFF_HOME`：全局共享运行时位置（覆盖默认的 `~/.agy-staff`）。
- `HERMES_HOME`：Hermes 数据主目录（覆盖默认路径）。
- `HERMES_SKILLS_DIR`：Hermes 技能安装目标父目录。
- `HERMES_SKILLS_CATEGORY`：技能在 Hermes 中的分类名称（默认 `agy-staff`）。

---

<a id="五windows-msys-环境下的路径防坑要点"></a>
<a id="五windows--msys-环境下的路径防坑要点"></a>
## 五、Windows / MSYS 环境下的路径防坑要点

在 Windows 操作系统上集成时，需注意 Hermes 特有的环境机制：

### 1. MSYS 参数转换限制
Hermes 在 Windows 上执行终端命令时，为了防止 Windows 命令参数（如 `/FO`、`cmd /c`）被 Git Bash 误转换为虚拟路径，强制设置了 `MSYS_NO_PATHCONV=1` 与 `MSYS2_ARG_CONV_EXCL="*"`。

### 2. 跨平台安全与可配置调用语法
若直接写 `$HOME`，Git Bash 展开为 `/c/Users/<user>`，原生的 Windows `node.exe` 收到后无法识别挂载盘符，会解析为 `C:\c\Users\...` 报错。
因此，所有生成的技能命令统一采用跨平台可配置语法：
```bash
node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs" <persona> [flags]
```
* **自定义运行时**：若设置了 `AGY_STAFF_HOME` 环境变量，自动优先使用自定义位置。
* **默认 Windows 下**：自动展开为 `$USERPROFILE`（即 `C:\Users\<user>/.agy-staff`），Windows Node 原生解析，无路径转换错误。
* **默认 Linux / macOS 下**：`$USERPROFILE` 为空，自动回退到 `$HOME`（即 `/home/<user>/.agy-staff`）。
* **安装器动态适配**：若安装时使用了非默认的 `--runtime-dir`，安装器还会自动将部署技能的默认回退路径动态适配至该目录，彻底免去手动配置的繁琐。

---

## 六、日常使用与验证方式

### 1. 验证安装状态
在终端中执行：
```bash
hermes skills list
```
在列表中即可看到分类为 `agy-staff` 的 7 个技能：
```text
┌──────────────────┬──────────────────┬──────────┬──────────┬─────────────────┐
│ Name             │ Category         │ Source   │ Trust    │ Status          │
├──────────────────┼──────────────────┼──────────┼──────────┼─────────────────┤
│ agy-ask          │ agy-staff        │ local    │ local    │ enabled         │
│ agy-implementer  │ agy-staff        │ local    │ local    │ enabled         │
│ agy-jobs         │ agy-staff        │ local    │ local    │ enabled         │
│ agy-lead         │ agy-staff        │ local    │ local    │ enabled         │
│ agy-researcher   │ agy-staff        │ local    │ local    │ enabled         │
│ agy-reviewer     │ agy-staff        │ local    │ local    │ enabled         │
│ agy-staffer      │ agy-staff        │ local    │ local    │ enabled         │
└──────────────────┴──────────────────┴──────────┴──────────┴─────────────────┘
```

### 2. 日常对话使用
* **快速问答 / 连通性冒烟**：
  直接在 Hermes 会话中输入 `/skill agy-ask reply with OK`，或自然语言说：“问一下 agy 这个问题……”。
* **代码评审（第二意见）**：
  “让 agy 帮我 review 当前分支的代码变更和潜在漏洞。”
* **代码实现**：
  “让 agy 实现这个小功能并运行测试。”
* **后台长任务查看**：
  “查看刚才 agy 任务的执行状态。”（调用 `agy-jobs` 技能）
