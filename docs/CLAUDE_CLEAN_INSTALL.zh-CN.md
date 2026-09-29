# Claude Code: agy-staff 干净安装与解耦架构实战指南

> **适用场景**：在 Anthropic Claude Code (`claude`) 环境中优雅、稳定地集成 `agy-staff`（Google Antigravity CLI / Gemini 3.8 Flash 桥接器），实现与 Pi Agent / Hermes Agent / OpenCode v2 / OpenAI Codex 共享全局运行时，彻底摆脱官方插件必须 bump 版本号并重启应用的限制，零目录污染，支持无感热更新。

---

## 目录
1. [架构优势：解耦共享运行时](#一架构优势解耦共享运行时)
2. [智能检测机制：按需复用共享运行时](#二智能检测机制按需复用共享运行时)
3. [Claude Code 个人技能规范与适配](#三claude-code-个人技能规范与适配)
4. [一键全自动安装（跨平台自适应）](#四一键全自动安装跨平台自适应)
5. [权限与 Bash 工具调用指引](#五权限与-bash-工具调用指引)
6. [日常使用与验证方式](#六日常使用与验证方式)

---

## 一、架构优势：解耦共享运行时

本方案延续并全面统一了 Pi Agent、Hermes Agent、OpenCode v2 与 Codex 上的 **“运行时中心化 + 宿主技能解耦”** 架构：

```text
Claude Code 个人技能体系                    全局共享运行时 (~/.agy-staff)
~/.claude/skills/
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
1. **多宿主共用底层运行时**：无论是 Claude Code、Codex、OpenCode、Hermes 还是 Pi，均可共享同一个 `~/.agy-staff` 运行时中心，不重复占用磁盘空间。
2. **规范命名与快速检索**：安装至 Claude Code 个人技能库目录 `~/.claude/skills/agy-*/`，支持原生 `/agy-*` slash command 语法及模型语义自主触发。
3. **升级零侵入与无感热更新**：后续更新只需同步 `~/.agy-staff` 下的 `companion` 与 `templates`，Claude Code 的 7 个技能定义无需重新安装，彻底摆脱官方插件必须修改版本号并重启应用的限制。
4. **渐进式上下文加载（Progressive Disclosure）**：遵循 Agentskills 标准，一级索引仅注入名称与短描述，按需激活加载完整指令，极大节约系统 Prompt Token。

---

## 二、智能检测机制：按需复用共享运行时

考虑到宿主机器上可能已经有其他 Agent（如 Codex、OpenCode、Hermes 或 Pi）安装并初始化了共享运行时，安装器内置了**健康度自适应检测**逻辑：

* **若运行时已就绪且完整**：
  自动校验 `~/.agy-staff/companion/agy-companion.mjs` 语法与 `templates/` 文件完整性。如果已由其他 Agent 部署，**自动跳过运行时的复制**，仅部署 Claude Code 技能定义。
* **若运行时缺失或损坏**：
  自动从当前仓库部署最新的 `companion/` 与 `templates/` 目录至 `~/.agy-staff`。
* **若需强制更新/同步最新代码**：
  支持附加 `--sync-runtime` 或 `--force-runtime` 参数，强制覆盖更新共享运行时。

---

## 三、Claude Code 个人技能规范与适配

Claude Code 对个人技能（Personal Skills）支持从用户家目录自动发现与加载：

1. **元数据标准与发现路径**：
   - 全局路径：`~/.claude/skills/<skill-id>/SKILL.md`（Windows 下为 `%USERPROFILE%\.claude\skills\<skill-id>\SKILL.md`）。
   - 技能 ID 严格由目录名决定（`agy-ask` 等）。
   - Frontmatter 包含 `name`、`description`（供模型自动触发）、`allowed-tools: Bash(node:*)` 等。
2. **工具调用契约**：
   - Claude Code 使用内置 `Bash` 工具执行终端命令。
   - 技能提示词明确指引模型调用 `node` 执行伴侣脚本，并在 Windows PowerShell 下提供直接路径调用兜底。

---

## 四、一键全自动安装（跨平台自适应）

安装脚本采用**纯原生 Node.js** 编写，零第三方依赖，在 Windows、macOS 和 Linux 上开箱即用：

### 1. 快速安装
```bash
node ./scripts/install-clean-claude.mjs
```

### 2. 常用参数与灵活配置
* **演练预览（Dry-Run）**：不写入任何磁盘文件，仅打印将要执行的操作：
  ```bash
  node ./scripts/install-clean-claude.mjs --dry-run
  ```
* **连网冒烟测试（Test）**：安装完成后发起一次真实 Gemini API 调用：
  ```bash
  node ./scripts/install-clean-claude.mjs --test
  ```
* **强制覆盖更新共享运行时**：
  ```bash
  node ./scripts/install-clean-claude.mjs --sync-runtime
  ```
* **自定义共享运行时目录**：
  ```bash
  node ./scripts/install-clean-claude.mjs --runtime-dir /path/to/custom-runtime
  ```
* **自定义 Claude Code 配置目录**：
  ```bash
  node ./scripts/install-clean-claude.mjs --claude-home ~/.claude
  ```
* **自定义 Claude Code 技能目录**：
  ```bash
  node ./scripts/install-clean-claude.mjs --skills-dir ~/.claude/skills
  ```
* **跳过 WSL 互通链接**（Windows 下纯原生环境）：
  ```bash
  node ./scripts/install-clean-claude.mjs --no-wsl
  ```

### 3. 支持的环境变量
脚本原生支持以下环境变量覆盖：
- `AGY_STAFF_HOME`：全局共享运行时位置（覆盖默认的 `~/.agy-staff`）。
- `CLAUDE_CONFIG_DIR` / `CLAUDE_HOME`：Claude Code 配置根目录（覆盖默认的 `~/.claude`）。
- `CLAUDE_SKILLS_DIR`：Claude Code 技能目标目录。

---

## 五、权限与 Bash 工具调用指引

在 Claude Code 中运行 `agy-staff` 时的注意事项：

1. **Bash 执行权限**：Claude Code 使用其内置的 `Bash` 工具执行命令。当首次调用 `node` 启动伴侣脚本时，Claude Code 会提示用户批准执行。如需更流畅的使用体验，可在项目或全局配置中预先批准 `node` 命令。
2. **凭据与端口访问**：`agy` 启动时需访问本地端口及 `~/.gemini/antigravity-cli/` 下的身份令牌。
3. **Windows PowerShell 兼容**：若在纯 Windows PowerShell 环境下无法解析 `${VAR:-DEFAULT}` 语法，伴侣指令支持直接以 `node "$env:USERPROFILE\.agy-staff\companion\agy-companion.mjs"` 运行。

---

## 六、日常使用与验证方式

### 1. 验证安装状态
在终端检查 `~/.claude/skills/` 目录下是否包含 7 个技能目录：
- `agy-ask`
- `agy-implementer`
- `agy-jobs`
- `agy-lead`
- `agy-researcher`
- `agy-reviewer`
- `agy-staffer`

### 2. 在 Claude Code 会话中使用
在 Claude Code 中输入：
```text
/agy-ask reply with OK
```
或者指派任务：
```text
/agy-reviewer 检查当前分支的代码改动
```
Claude Code 会通过 `Bash` 工具加载并调用共享伴侣脚本，以 Flash 速度完成任务！
