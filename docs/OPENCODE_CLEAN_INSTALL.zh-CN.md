# OpenCode v2: agy-staff 干净安装与解耦架构实战指南

> **适用场景**：在 OpenCode v2 (`opencode`) 中优雅、稳定地集成 `agy-staff`（Google Antigravity CLI / Gemini 3.8 Flash 桥接器），实现与 Pi Agent / Hermes Agent / Claude Code / Codex 共享全局运行时，分类清晰，零目录污染。

---

## 目录
1. [架构优势：解耦共享运行时](#一架构优势解耦共享运行时)
2. [智能检测机制：按需复用共享运行时](#二智能检测机制按需复用共享运行时)
3. [OpenCode v2 规范与环境深度适配](#三opencode-v2-规范与环境深度适配)
4. [一键全自动安装（跨平台自适应）](#四一键全自动安装跨平台自适应)
5. [Windows / PowerShell 环境防坑要点](#五windows--powershell-环境防坑要点)
6. [日常使用与验证方式](#六日常使用与验证方式)

---

## 一、架构优势：解耦共享运行时

本方案延续并强化了在 Pi Agent 与 Hermes Agent 上验证成熟的 **“运行时中心化 + 宿主技能解耦”** 架构：

```text
OpenCode v2 标准体系                     全局共享运行时 (~/.agy-staff)
~/.config/opencode/skills/
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
1. **多宿主共用底层运行时**：无论是 OpenCode、Hermes、Pi、Claude Code 还是 Codex，均可共享同一个 `~/.agy-staff` 运行时中心，不重复占用磁盘空间。
2. **规范命名与快速检索**：安装至 OpenCode 的全局技能目录 `~/.config/opencode/skills/agy-*/`，支持 TUI 斜杠命令 `/agy-*` 及模型工具自主调用。
3. **升级零侵入**：后续更新只需同步 `~/.agy-staff` 下的 `companion` 与 `templates`，OpenCode 的 7 个技能定义无需重新安装。
4. **渐进式上下文加载（Progressive Disclosure）**：遵循 Agentskills 标准，一级索引仅注入名称与短描述，按需激活加载完整指令，极大节约系统 Prompt Token。

---

## 二、智能检测机制：按需复用共享运行时

考虑到宿主机器上可能已经有其他 Agent（如 Pi 或 Hermes）安装并初始化了共享运行时，安装器内置了**健康度自适应检测**逻辑：

* **若运行时已就绪且完整**：
  自动校验 `~/.agy-staff/companion/agy-companion.mjs` 语法与 `templates/` 文件完整性。如果已由其他 Agent 部署，**自动跳过运行时的复制**，仅部署 OpenCode 技能定义。
* **若运行时缺失或损坏**：
  自动从当前仓库部署最新的 `companion/` 与 `templates/` 目录至 `~/.agy-staff`。
* **若需强制更新/同步最新代码**：
  支持附加 `--sync-runtime` 或 `--force-runtime` 参数，强制覆盖更新共享运行时。

---

## 三、OpenCode v2 规范与环境深度适配

OpenCode v2 对技能（Skill）有着特定的发现机制与工具执行契约：

1. **元数据标准与发现路径**：
   - 全局路径：`~/.config/opencode/skills/<skill-id>/SKILL.md`（Windows 下为 `%USERPROFILE%\.config\opencode\skills\<skill-id>\SKILL.md`）。
   - 技能 ID 严格由目录名决定（`agy-ask` 等）。
   - Frontmatter 包含 `name`、`description`（供模型自动触发）、`slash: true`（注册 TUI 斜杠命令）。
2. **工具调用契约与超时单位（毫秒）**：
   - OpenCode 使用内置 `shell` 工具执行终端命令。
   - **超时参数单位**：OpenCode `shell` 的 `timeout` 参数单位为**毫秒**（例如 2 分钟应传入 `timeout: 120000`）。这与 Hermes（秒）有着本质区别。
   - **前台执行与后台等待分离**：普通任务（`ask`、`status`、`observe`、`cancel` 等）必须以标准前台命令运行（`background: false`）；长时间等待作业（`agy-jobs wait <id>`）指引模型使用 `background: true`（立即返回并在任务完成后由 OpenCode 会话通知），避免阻塞交互。
3. **子技能模型自主调度**：
   - 当协同技能需要查阅 `agy-jobs` 时，指引模型使用 OpenCode 原生 `skill` 工具（`id: "agy-jobs"`）加载上下文。

---

## 四、一键全自动安装（跨平台自适应）

安装脚本采用**纯原生 Node.js** 编写，零第三方依赖，在 Windows、macOS 和 Linux 上开箱即用：

### 1. 快速安装
```bash
node ./scripts/install-clean-opencode.mjs
```

### 2. 常用参数与灵活配置
* **演练预览（Dry-Run）**：不写入任何磁盘文件，仅打印将要执行的操作：
  ```bash
  node ./scripts/install-clean-opencode.mjs --dry-run
  ```
* **连网冒烟测试（Test）**：安装完成后发起一次真实 Gemini API 调用：
  ```bash
  node ./scripts/install-clean-opencode.mjs --test
  ```
* **强制覆盖更新共享运行时**：
  ```bash
  node ./scripts/install-clean-opencode.mjs --sync-runtime
  ```
* **自定义共享运行时目录**：
  ```bash
  node ./scripts/install-clean-opencode.mjs --runtime-dir /path/to/custom-runtime
  ```
* **自定义 OpenCode 配置目录**：
  ```bash
  node ./scripts/install-clean-opencode.mjs --config-dir ~/.config/opencode
  ```
* **自定义 OpenCode 技能目录**：
  ```bash
  node ./scripts/install-clean-opencode.mjs --skills-dir ~/.config/opencode/skills
  ```
* **跳过 WSL 互通链接**（Windows 下纯原生环境）：
  ```bash
  node ./scripts/install-clean-opencode.mjs --no-wsl
  ```

### 3. 支持的环境变量
脚本原生支持以下环境变量覆盖：
- `AGY_STAFF_HOME`：全局共享运行时位置（覆盖默认的 `~/.agy-staff`）。
- `OPENCODE_CONFIG_DIR`：OpenCode 配置根目录（覆盖默认的 `~/.config/opencode`）。
- `OPENCODE_SKILLS_DIR`：OpenCode 技能目标目录。
- `XDG_CONFIG_HOME`：Linux/macOS 下用户配置目录标准。

---

## 五、Windows / PowerShell 环境防坑要点

在 Windows 操作系统上使用 OpenCode 时，底层默认 Shell 通常为 `powershell.exe` 或 `pwsh.exe`：

### 1. 跨 Shell 语法兼容
Bash 中的 `${VAR:-DEFAULT}` 语法在 PowerShell 中会触发 `ParserError: Missing expression after unary operator '-'`。
因此，生成的技能提示词在通用 Bash 展开式的基础上，特别指明了 Windows PowerShell 专属直接调用格式：
```powershell
node "$env:USERPROFILE\.agy-staff\companion\agy-companion.mjs" <persona> [flags]
```

### 2. NVM 包装脚本拦截规避
在 Windows 环境下，若通过 NVM 安装 Node，全局 `opencode.cmd` 可能会被 NVM 包装器拦截抛出 `NVM4306` 错误。安装器内置了多层自适应探针，优先采用 PowerShell 原生脚本命令探针，保证自检稳定可靠。

---

## 六、日常使用与验证方式

### 1. 验证安装状态
在终端中执行：
```powershell
opencode api get /api/skill
```
在返回的 JSON 列表中即可看到 7 个 `agy-*` 技能：
- `agy-ask`
- `agy-implementer`
- `agy-jobs`
- `agy-lead`
- `agy-researcher`
- `agy-reviewer`
- `agy-staffer`

### 2. 在 OpenCode 会话中使用
在 OpenCode TUI 或对话中：
```text
/agy-ask reply with OK
```
或者直接指派任务：
```text
帮我让 agy-reviewer 审查当前分支的改动
```
OpenCode 会通过 `skill` 工具加载技能并执行 `node .../agy-companion.mjs`。
