# Oh My Pi (omp): agy-staff 干净安装与解耦架构实战指南

> **适用场景**：在 Oh My Pi (`omp`，`can1357/oh-my-pi`) 环境中优雅、稳定地集成 `agy-staff`（Google Antigravity CLI / Gemini 3.8 Flash 桥接器），原生支持 Oh My Pi 的多 Profile 机制，实现与 Claude Code / OpenAI Codex / Pi Agent / Hermes Agent / OpenCode v2 共享全局运行时，零目录污染，无感热更新。

---

## 目录
1. [架构优势：解耦共享运行时](#一架构优势解耦共享运行时)
2. [智能检测机制：按需复用共享运行时](#二智能检测机制按需复用共享运行时)
3. [Oh My Pi 多 Profile 机制与技能规范适配](#三oh-my-pi-多-profile-机制与技能规范适配)
4. [一键全自动安装（跨平台自适应与 Profile 支持）](#四一键全自动安装跨平台自适应与-profile-支持)
5. [工具契约与 Bash 执行指引](#五工具契约与-bash-工具调用指引)
6. [日常使用与验证方式](#六日常使用与验证方式)

---

## 一、架构优势：解耦共享运行时

本方案延续并全面统一了 Claude Code、Codex、Pi Agent、Hermes Agent 与 OpenCode v2 上的 **“运行时中心化 + 宿主技能解耦”** 架构：

```text
Oh My Pi 技能体系 (支持多 Profile)          全局共享运行时 (~/.agy-staff)
~/.omp/agent/skills/ (默认)
或 ~/.omp/profiles/<name>/agent/skills/
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
1. **多宿主共用底层运行时**：无论是 Oh My Pi、Claude Code、Codex、OpenCode、Hermes 还是 Pi，均可共享同一个 `~/.agy-staff` 运行时中心，不重复占用磁盘空间。
2. **原生 Profile 隔离支持**：支持安装到 Oh My Pi 的默认 Profile（`~/.omp/agent/skills/`）或指定的独立 Profile（`~/.omp/profiles/<name>/agent/skills/`），与 Oh My Pi 的 `--profile` 运行时完全匹配。
3. **升级零侵入与无感热更新**：后续更新只需同步 `~/.agy-staff` 下的 `companion` 与 `templates`，Oh My Pi 的 7 个技能定义无需重新安装，即时生效。
4. **渐进式上下文加载（Progressive Disclosure）**：遵循 Agentskills 标准，一级索引仅注入名称与短描述，按需激活加载完整指令，极大节约系统 Prompt Token。

---

## 二、智能检测机制：按需复用共享运行时

考虑到宿主机器上可能已经有其他 Agent（如 Claude Code、Codex、OpenCode、Hermes 或 Pi）安装并初始化了共享运行时，安装器内置了**健康度自适应检测**逻辑：

* **若运行时已就绪且完整**：
  自动校验 `~/.agy-staff/companion/agy-companion.mjs` 语法与 `templates/` 文件完整性。如果已由其他 Agent 部署，**自动跳过运行时的复制**，仅部署 Oh My Pi 技能定义。
* **若运行时缺失或损坏**：
  自动从当前仓库部署最新的 `companion/` 与 `templates/` 目录至 `~/.agy-staff`。
* **若需强制更新/同步最新代码**：
  支持附加 `--sync-runtime` 或 `--force-runtime` 参数，强制覆盖更新共享运行时。

---

## 三、Oh My Pi 多 Profile 机制与技能规范适配

Oh My Pi 与原生 Pi 相比，有两大重要机制特性：

1. **多 Profile 重定向隔离**：
   - 默认 Profile 技能目录：`~/.omp/agent/skills/<skill-id>/SKILL.md`。
   - 命名 Profile 技能目录：`~/.omp/profiles/<name>/agent/skills/<skill-id>/SKILL.md`。
   - 技能在不同 Profile 间是物理隔离的。本安装器支持传入 `--profile <name>` 参数，一键部署到指定 Profile。
2. **配置机制演进**：
   - Oh My Pi 采用 `config.yml` 代替了旧版 `settings.json`。解耦安装器直接部署纯净扁平技能，零配置侵入，绝不污染系统全局配置。
3. **命令契约**：
   - 技能以 `/skill:agy-<persona>` 触发（如 `/skill:agy-ask`、`/skill:agy-jobs`），并在终端输入时支持自动补全推荐。
4. **工具集规范适配（移除 Claude 特有的 allowed-tools 限制）**：
   - Claude Code / Codex 中的 `allowed-tools: Read, Glob, Grep, Bash(node:*)` 采用 PascalCase 及独有的权限过滤器语法。
   - 在 Oh My Pi 中，内置工具采用小写命名规范（`read`、`bash` 等）。若直接沿用 Claude 的 `allowed-tools`，会导致 `Read` 无法被识别为内置的 `read` 工具，造成工具被意外过滤，进而引发模型将读文件请求错派给 `bash` 工具（抛出 `Validation failed for tool "bash": command must be a string`）。
   - 因此，Oh My Pi 的技能规范中不施加 Claude 风格的 `allowed-tools` 限制，保留 Oh My Pi 默认的完整工具生态，保障 `read`、`bash` 等原生工具顺畅工作。

---

## 四、一键全自动安装（跨平台自适应与 Profile 支持）

安装脚本采用**纯原生 Node.js** 编写，零第三方依赖，在 Windows、macOS 和 Linux 上开箱即用：

### 1. 快速安装（默认 Profile）
```bash
node ./scripts/install-clean-omp.mjs
```

### 2. 安装至指定 Profile（多 Profile 支持）
如果您日常使用 `omp --profile work` 或环境变量 `OMP_PROFILE=work`：
```bash
node ./scripts/install-clean-omp.mjs --profile work
```
脚本将自动部署至 `~/.omp/profiles/work/agent/skills/`。

### 3. 常用参数与灵活配置
* **演练预览（Dry-Run）**：不写入任何磁盘文件，仅打印将要执行的操作：
  ```bash
  node ./scripts/install-clean-omp.mjs --dry-run
  ```
* **连网冒烟测试（Test）**：安装完成后发起一次真实 Gemini API 调用：
  ```bash
  node ./scripts/install-clean-omp.mjs --test
  ```
* **强制覆盖更新共享运行时**：
  ```bash
  node ./scripts/install-clean-omp.mjs --sync-runtime
  ```
* **自定义共享运行时目录**：
  ```bash
  node ./scripts/install-clean-omp.mjs --runtime-dir /path/to/custom-runtime
  ```
* **自定义 Oh My Pi 根目录**：
  ```bash
  node ./scripts/install-clean-omp.mjs --omp-home ~/.omp
  ```
* **自定义技能目录**：
  ```bash
  node ./scripts/install-clean-omp.mjs --skills-dir ~/.omp/agent/skills
  ```
* **跳过 WSL 互通链接**（Windows 下纯原生环境）：
  ```bash
  node ./scripts/install-clean-omp.mjs --no-wsl
  ```

### 4. 支持的环境变量
脚本原生支持以下环境变量覆盖：
- `OMP_PROFILE`：当前生效的 Profile 名称。
- `OMP_DIR` / `OMP_HOME` / `PI_CONFIG_DIR`：Oh My Pi 数据根目录（覆盖默认的 `~/.omp`）。
- `OMP_SKILLS_DIR`：Oh My Pi 技能目标目录。
- `AGY_STAFF_HOME`：全局共享运行时位置（覆盖默认的 `~/.agy-staff`）。

---

## 五、工具契约与 Bash 工具调用指引

在 Oh My Pi 中运行 `agy-staff` 时的注意事项：

1. **原生工具集保留与零干扰**：技能前端元数据不注入 Claude 特有的 `allowed-tools` 约束，确保 Oh My Pi 内置的 `read`、`bash`、`edit` 等工具均正常可用，杜绝因 `Read` 大小写不匹配而丢失 `read` 工具、甚至误调 `bash` 的现象。
2. **Bash 执行权限与命令契约**：Oh My Pi 内置 `bash` 工具用于执行命令，要求传参为 `{ command: string }`。技能提示词指引模型通过 `bash` 工具调度 `node` 伴侣脚本。
3. **凭据与端口访问**：`agy` 启动时需访问本地端口及 `~/.gemini/antigravity-cli/` 下的身份令牌。
4. **Windows PowerShell 兼容**：若在纯 Windows PowerShell 环境下无法解析 `${VAR:-DEFAULT}` 语法，伴侣指令支持直接以 `node "$env:USERPROFILE\.agy-staff\companion\agy-companion.mjs"` 运行。

---

## 六、日常使用与验证方式

### 1. 验证安装状态
在终端检查目标技能目录中是否包含 7 个标准技能：
```bash
omp skill list
```
或直接查看目录内容：
- `agy-ask`
- `agy-implementer`
- `agy-jobs`
- `agy-lead`
- `agy-researcher`
- `agy-reviewer`
- `agy-staffer`

### 2. 在 Oh My Pi 会话中使用
在 Oh My Pi 中输入：
```text
/skill:agy-ask reply with OK
```
或者指派通用任务：
```text
/skill:agy-reviewer 检查当前分支的代码改动
```
Oh My Pi 会通过 `bash` 工具调用共享伴侣脚本，以 Flash 的速度交付高质量成果！
