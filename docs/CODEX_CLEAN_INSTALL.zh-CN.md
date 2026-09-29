# Codex: agy-staff 干净安装与解耦架构实战指南

> **适用场景**：在 OpenAI Codex CLI / Codex 环境中优雅、稳定地集成 `agy-staff`（Google Antigravity CLI / Gemini 3.8 Flash 桥接器），实现与 Pi Agent / Hermes Agent / OpenCode v2 共享全局运行时，摆脱官方插件全量克隆与死板版本号绑定的困扰，零目录污染。

---

## 目录
1. [架构优势：解耦共享运行时](#一架构优势解耦共享运行时)
2. [智能检测机制：按需复用共享运行时](#二智能检测机制按需复用共享运行时)
3. [Codex 个人技能规范与适配](#三codex-个人技能规范与适配)
4. [一键全自动安装（跨平台自适应）](#四一键全自动安装跨平台自适应)
5. [沙箱与权限防坑要点](#五沙箱与权限防坑要点)
6. [日常使用与验证方式](#六日常使用与验证方式)

---

## 一、架构优势：解耦共享运行时

本方案延续并在 Codex 上实现了与 Pi Agent、Hermes Agent 和 OpenCode v2 一致的 **“运行时中心化 + 宿主技能解耦”** 架构：

```text
Codex 个人技能体系                         全局共享运行时 (~/.agy-staff)
~/.codex/skills/
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
1. **多宿主共用底层运行时**：无论是 Codex、OpenCode、Hermes 还是 Pi，均可共享同一个 `~/.agy-staff` 运行时中心，不重复占用磁盘空间。
2. **规范命名与快速检索**：安装至 Codex 个人技能库目录 `~/.codex/skills/agy-*/`，支持原生 `$agy-*` 语法及模型工具自主调用。
3. **升级零侵入与无感热更新**：后续更新只需同步 `~/.agy-staff` 下的 `companion` 与 `templates`，Codex 的 7 个技能定义无需重新安装，彻底摆脱官方插件必须 bump 版本号并重启应用的限制。
4. **渐进式上下文加载（Progressive Disclosure）**：遵循 Agentskills 标准，一级索引仅注入名称与短描述，按需激活加载完整指令，极大节约系统 Prompt Token。

---

## 二、智能检测机制：按需复用共享运行时

考虑到宿主机器上可能已经有其他 Agent（如 Pi、Hermes 或 OpenCode）安装并初始化了共享运行时，安装器内置了**健康度自适应检测**逻辑：

* **若运行时已就绪且完整**：
  自动校验 `~/.agy-staff/companion/agy-companion.mjs` 语法与 `templates/` 文件完整性。如果已由其他 Agent 部署，**自动跳过运行时的复制**，仅部署 Codex 技能定义。
* **若运行时缺失或损坏**：
  自动从当前仓库部署最新的 `companion/` 与 `templates/` 目录至 `~/.agy-staff`。
* **若需强制更新/同步最新代码**：
  支持附加 `--sync-runtime` 或 `--force-runtime` 参数，强制覆盖更新共享运行时。

---

## 三、Codex 个人技能规范与适配

Codex 对个人技能（Personal Skills）支持从用户家目录自动发现与加载：

1. **元数据标准与发现路径**：
   - 全局路径：`~/.codex/skills/<skill-id>/SKILL.md`（Windows 下为 `%USERPROFILE%\.codex\skills\<skill-id>\SKILL.md`）。
   - 技能 ID 严格由目录名决定（`agy-ask` 等）。
   - Frontmatter 包含 `name`、`description`（供模型自动触发）、`allowed-tools: Bash(node:*)` 等。
2. **工具调用契约**：
   - Codex 使用内置 `Bash` 工具执行终端命令。
   - 技能提示词明确指引模型以 **Unsandboxed**（非沙箱/提权）模式执行 `node` 命令，以确保顺利访问 `agy` 端口及凭证文件。

---

## 四、一键全自动安装（跨平台自适应）

安装脚本采用**纯原生 Node.js** 编写，零第三方依赖，在 Windows、macOS 和 Linux 上开箱即用：

### 1. 快速安装
```bash
node ./scripts/install-clean-codex.mjs
```

### 2. 常用参数与灵活配置
* **演练预览（Dry-Run）**：不写入任何磁盘文件，仅打印将要执行的操作：
  ```bash
  node ./scripts/install-clean-codex.mjs --dry-run
  ```
* **连网冒烟测试（Test）**：安装完成后发起一次真实 Gemini API 调用：
  ```bash
  node ./scripts/install-clean-codex.mjs --test
  ```
* **强制覆盖更新共享运行时**：
  ```bash
  node ./scripts/install-clean-codex.mjs --sync-runtime
  ```
* **自定义共享运行时目录**：
  ```bash
  node ./scripts/install-clean-codex.mjs --runtime-dir /path/to/custom-runtime
  ```
* **自定义 Codex 配置目录**：
  ```bash
  node ./scripts/install-clean-codex.mjs --codex-home ~/.codex
  ```
* **自定义 Codex 技能目录**：
  ```bash
  node ./scripts/install-clean-codex.mjs --skills-dir ~/.codex/skills
  ```
* **跳过 WSL 互通链接**（Windows 下纯原生环境）：
  ```bash
  node ./scripts/install-clean-codex.mjs --no-wsl
  ```

### 3. 支持的环境变量
脚本原生支持以下环境变量覆盖：
- `AGY_STAFF_HOME`：全局共享运行时位置（覆盖默认的 `~/.agy-staff`）。
- `CODEX_HOME`：Codex 配置根目录（覆盖默认的 `~/.codex`）。
- `CODEX_SKILLS_DIR`：Codex 技能目标目录。

---

## 五、沙箱与权限防坑要点

在 Codex 中运行 `agy-staff` 时，最重要的核心注意事项是**权限模式**：

### 为什么必须以 Unsandboxed 模式运行？
1. **本地端口绑定**：`agy` 二进制启动时会在 `localhost` 绑定端口运行内置语言服务。Codex 的标准工作区沙箱会切断本地网络绑定能力。
2. **OAuth 令牌访问**：`agy` 会读取 `~/.gemini/antigravity-cli/` 下的身份令牌。Codex 沙箱有敏感文件隔离机制，会隐藏该文件，导致报 `operation not permitted` 或误报“未登录”。
3. **解决方案**：在 Codex 会话中执行命令时，需为对应 companion 命令授予提权/非沙箱权限（Unsandboxed），或开启对应工作区的全权限模式。

---

## 六、日常使用与验证方式

### 1. 验证安装状态
在终端检查 `~/.codex/skills/` 目录下是否包含 7 个技能目录：
- `agy-ask`
- `agy-implementer`
- `agy-jobs`
- `agy-lead`
- `agy-researcher`
- `agy-reviewer`
- `agy-staffer`

### 2. 在 Codex 会话中使用
在 Codex 对话中输入：
```text
$agy-ask reply with OK
```
或者指派任务：
```text
$agy-reviewer 检查当前分支的代码改动
```
Codex 会通过 `Bash` 工具加载并调用共享伴侣脚本，以 Flash 速度完成任务！
