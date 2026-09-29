<p align="center"><img src="assets/logo/gemini-agy.svg" width="440" alt="AGY-STAFF"></p>

<p align="center"><a href="README.md">English</a> | <a href="README.zh-CN.md">Simplified Chinese</a></p>

<p align="center"><a href="https://antigravity.google/product/antigravity-cli"><img src="assets/badges/powered-by-antigravity.svg" height="20" alt="powered by: Antigravity"></a> <img src="assets/badges/model-gemini-3-8-flash.svg" height="20" alt="model: Gemini 3.8 Flash"></p>

<p align="center"><a href="https://claude.com/claude-code"><img src="assets/badges/claude-code-plugin.svg" height="20" alt="Claude Code plugin"></a> <a href="https://developers.openai.com/codex/"><img src="assets/badges/codex-plugin.svg" height="20" alt="Codex plugin"></a> <a href="LICENSE"><img src="assets/badges/license-mit.svg" height="20" alt="license: MIT"></a></p>

Hire Google's Antigravity CLI (`agy`) as a staffer for **Claude Code**, **OpenAI Codex**, **Pi**, **Hermes Agent**, **OpenCode v2**, and **Oh My Pi**.

![agy-staff design](assets/design.png)

**[Install](#install) · [Examples](#cujs) · [Core design](#core-design) · [Upgrade](#upgrade)**

## What & Why

agy-staff lets your senior agents delegate to `agy`, which ships fast Gemini 3.8 Flash. Seven skills in total: five core execution personas (`staffer`, `researcher`, `reviewer`, `implementer`, `ask`), task orchestration guidance (`lead`), and job lifecycle management (`jobs`). Claude Code uses `/agy:<persona>`, Codex uses `$agy:<persona>` (or `$agy-<persona>` for decoupled installs), Pi uses `/skill:agy-<persona>`, Hermes Agent uses `/skill agy-<persona>` (or `/skill agy-staff/agy-<persona>`), OpenCode v2 uses `/agy-<persona>` (or the `skill` tool), and Oh My Pi uses `/skill:agy-<persona>`.

If you use Codex you know the feeling: GPT-5.6-Sol is slow even with fast mode on. Claude Code is quicker but still not fast, and Fable quota is scarce enough that you want it orchestrating subagents, not grinding through every survey and review itself. An agy worker gives you a fast lane — second opinions in seconds, research and reviews at Flash speed, scoped implementation handled off to the side while you keep moving. And where speed isn't the point, a second model family looking at the same code buys coverage and robustness your main agent can't give itself.

![two overloaded senior agents hand the baton to one fast agy worker](assets/why.png)

## How

### Invoke a persona

Type `/agy:` in Claude Code and the five personas are right there:

![the /agy: command menu in Claude Code](assets/claude-code-screenshot.png)

Same plugin in Codex, invoked with `$agy`:

![the $agy skill picker in Codex](assets/codex-desktop-screenshot.png)

### Install

#### For humans

Step 1 — install the Antigravity CLI ([official docs](https://antigravity.google/docs/cli/install)), then verify with `agy --version`. Node.js is also required:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Step 2 — install the plugin into your harness:

For **Claude Code**, two installation options are available:

- **Option A: Official Plugin Marketplace Install (Native CLI Integration)**
  ```bash
  claude plugin marketplace add keli-wen/agy-staff
  claude plugin install agy@agy-staff
  ```
  Skills are prefixed as `/agy:<persona>` (e.g. `/agy:ask reply with OK`). Update by running `claude plugin update agy@agy-staff` and restarting Claude Code.

- **Option B: Clean Decoupled Install (Recommended for multi-agent setups: shared `~/.agy-staff` runtime, instant updates)**
  ```bash
  node ./scripts/install-clean-claude.mjs
  ```
  Skills are installed to personal skills `~/.claude/skills/` and prefixed as `/agy-<persona>` (e.g. `/agy-ask reply with OK`).
  > **Options**:
  > - Dry run (preview without writing files): `node ./scripts/install-clean-claude.mjs --dry-run`
  > - Connectivity test with live Gemini API: `node ./scripts/install-clean-claude.mjs --test`
  > - Force sync/update runtime: `node ./scripts/install-clean-claude.mjs --sync-runtime`
  > - Custom runtime directory (also respects `AGY_STAFF_HOME`): `--runtime-dir <path>`
  > - Custom skills directory (also respects `CLAUDE_SKILLS_DIR`): `--skills-dir <path>`
  > - Skip WSL link: `--no-wsl`
  > 
  > For full architecture details and manual setup steps, see [Claude Code Clean Install Guide (zh-CN)](docs/CLAUDE_CLEAN_INSTALL.zh-CN.md).

For **Codex (OpenAI Codex CLI)**, two installation options are available:

- **Option A: Official Plugin Marketplace Install (Native CLI & UI Integration)**
  ```bash
  codex plugin marketplace add https://github.com/keli-wen/agy-staff
  codex plugin add agy@agy-staff
  ```
  Skills are prefixed as `$agy:<persona>` (e.g. `$agy:ask reply with OK`). Update by running `codex plugin marketplace upgrade` and restarting the application.

- **Option B: Clean Decoupled Install (Recommended for multi-agent setups: shared `~/.agy-staff` runtime, instant updates)**
  ```bash
  node ./scripts/install-clean-codex.mjs
  ```
  Skills are installed to personal skills `~/.codex/skills/` and prefixed as `$agy-<persona>` (e.g. `$agy-ask reply with OK`).
  > **Options**:
  > - Dry run (preview without writing files): `node ./scripts/install-clean-codex.mjs --dry-run`
  > - Connectivity test with live Gemini API: `node ./scripts/install-clean-codex.mjs --test`
  > - Force sync/update runtime: `node ./scripts/install-clean-codex.mjs --sync-runtime`
  > - Custom runtime directory (also respects `AGY_STAFF_HOME`): `--runtime-dir <path>`
  > - Custom skills directory (also respects `CODEX_SKILLS_DIR`): `--skills-dir <path>`
  > - Skip WSL link: `--no-wsl`
  > 
  > For full architecture details and manual setup steps, see [Codex Clean Install Guide (zh-CN)](docs/CODEX_CLEAN_INSTALL.zh-CN.md).

For **Pi (Pi Agent)**, two installation options are available:

- **Option A: Clean Decoupled Install (Recommended: cross-platform, eliminates 9-level nesting & collisions)**
  ```bash
  node ./scripts/install-clean-pi.mjs
  ```
  Skills are installed to `~/.pi/agent/skills/` and prefixed as `/skill:agy-<persona>`. Updates only require syncing `~/.agy-staff`.
  > **Options**:
  > - Dry run (preview without writing files): `node ./scripts/install-clean-pi.mjs --dry-run`
  > - Connectivity test with live Gemini API: `node ./scripts/install-clean-pi.mjs --test`
  > - Force sync/update runtime: `node ./scripts/install-clean-pi.mjs --sync-runtime`
  > - Custom runtime directory (also respects `AGY_STAFF_HOME`): `--runtime-dir <path>`
  > - Skip WSL link: `--no-wsl`
  > 
  > For full architecture details and manual setup steps, see [Pi Clean Install Guide (zh-CN)](docs/PI_CLEAN_INSTALL.zh-CN.md).

- **Option B: Official Git Package Install**
  ```bash
  pi install git:github.com/keli-wen/agy-staff
  ```
  Skills are prefixed as `/skill:agy-<persona>` (e.g. `/skill:agy-ask reply with OK`, with `/skill:agy-jobs` for job management).
  Update with `pi update --extension git:github.com/keli-wen/agy-staff`, then run `/reload`.

For **Hermes Agent** (by Nous Research), a clean decoupled installer adhering to the `agentskills.io` standard is provided (shares the `~/.agy-staff` runtime, cleanly categorized under `agy-staff`, auto-detects existing runtimes):

```bash
node ./scripts/install-clean-hermes.mjs
```

> **Options**:
> - Dry run (preview without writing files): `node ./scripts/install-clean-hermes.mjs --dry-run`
> - Connectivity test with live Gemini API: `node ./scripts/install-clean-hermes.mjs --test`
> - Force sync/update runtime: `node ./scripts/install-clean-hermes.mjs --sync-runtime`
> - Custom runtime directory (also respects `AGY_STAFF_HOME`): `--runtime-dir <path>`
> - Skip WSL link: `--no-wsl`
> 
> For full architecture details and manual setup steps, see [Hermes Clean Install Guide (zh-CN)](docs/HERMES_CLEAN_INSTALL.zh-CN.md).

For **OpenCode v2** (`opencode`), a clean decoupled installer is provided (shares the `~/.agy-staff` runtime, deploys to OpenCode's global `~/.config/opencode/skills/` directory, and auto-detects existing runtimes):

```bash
node ./scripts/install-clean-opencode.mjs
```

> **Options**:
> - Dry run (preview without writing files): `node ./scripts/install-clean-opencode.mjs --dry-run`
> - Connectivity test with live Gemini API: `node ./scripts/install-clean-opencode.mjs --test`
> - Force sync/update runtime: `node ./scripts/install-clean-opencode.mjs --sync-runtime`
> - Custom runtime directory (also respects `AGY_STAFF_HOME`): `--runtime-dir <path>`
> - Skip WSL link: `--no-wsl`
> 
> For full architecture details and manual setup steps, see [OpenCode Clean Install Guide (zh-CN)](docs/OPENCODE_CLEAN_INSTALL.zh-CN.md).

For **Oh My Pi** (`can1357/oh-my-pi`, CLI: `omp`), a clean decoupled installer with multi-profile support is provided (shares the `~/.agy-staff` runtime, deploys to `~/.omp/agent/skills/` or a named profile, and auto-detects existing runtimes):

```bash
# Default profile:
node ./scripts/install-clean-omp.mjs

# Named profile (e.g. work):
node ./scripts/install-clean-omp.mjs --profile work
```

> **Options**:
> - Dry run (preview without writing files): `node ./scripts/install-clean-omp.mjs --dry-run`
> - Connectivity test with live Gemini API: `node ./scripts/install-clean-omp.mjs --test`
> - Force sync/update runtime: `node ./scripts/install-clean-omp.mjs --sync-runtime`
> - Target profile: `--profile <name>`
> - Custom runtime directory (also respects `AGY_STAFF_HOME`): `--runtime-dir <path>`
> - Custom home directory (also respects `OMP_DIR`/`OMP_HOME`/`PI_CONFIG_DIR`): `--omp-home <path>`
> - Custom skills directory (also respects `OMP_SKILLS_DIR`): `--skills-dir <path>`
> - Skip WSL link: `--no-wsl`
> 
> For full architecture details and manual setup steps, see [Oh My Pi Clean Install Guide (zh-CN)](docs/OMP_CLEAN_INSTALL.zh-CN.md).

Restart the harness afterwards (or run `/reload` in Pi / Oh My Pi). First run: `/agy:ask reply with OK` (Claude Code, or `/agy-ask reply with OK` for decoupled installs), `$agy:ask reply with OK` (Codex, or `$agy-ask reply with OK` for decoupled installs), `/skill:agy-ask reply with OK` (Pi), `/skill agy-ask reply with OK` (Hermes), `/agy-ask reply with OK` (OpenCode), or `/skill:agy-ask reply with OK` (Oh My Pi). Ask is tool-free and needs no setup.

> [!IMPORTANT]
> **There is no mandatory setup step.** `staffer`, `researcher`, `reviewer` and `implementer` run **unrestricted** by default: agy can inspect the repo, run commands, and edit files. agy-staff keeps that practical with prompts that adapt to the current repo state. For example, when `implementer` starts in a dirty workspace, the companion tells agy which files already had changes and reminds it not to overwrite or deliver unrelated user work. If the task asks for a commit, push, or PR, agy can do that delivery; otherwise it leaves a working-tree diff for review. These prompt instructions do not provide permission isolation.
> `setup` + `--restricted` is **optional hardening** for untrusted input — per run (`--restricted`) or as a per-repo default (`setup --restrict review,research`). `setup` dry-runs and asks before writing anything ("set up agy" triggers it); read the [permission notes](docs/REFERENCE.md#optional-hardening-setup) first — the allowlist is prefix-matched, applies machine-wide, and a restricted run can return less than an unrestricted one.

#### For agents

Paste this into any coding agent:

```
Read the raw text of https://raw.githubusercontent.com/keli-wen/agy-staff/master/docs/INSTALL_FOR_AGENTS.md (curl it — do not
work from a summary) and follow it to install and verify the agy-staff plugin for the harness you are running in.
Respond in the user's language.
```

#### Upgrade

Claude Code and Codex install a *copy*, so a new version only reaches you when you pull it in yourself:

```bash
claude plugin marketplace update agy-staff && claude plugin update agy@agy-staff
```

```bash
codex plugin marketplace upgrade && codex plugin add agy@agy-staff  # then restart Codex
```

Claude Code and Codex cache per version directory, so an upgrade lands only if the plugin version changed; restart the harness afterwards. If a fix does not show up, see [upgrading](docs/REFERENCE.md#upgrading) — it has the force-refresh command.

For Pi, Hermes, OpenCode, Codex, Claude Code, and Oh My Pi: if using clean decoupled installs, update `~/.agy-staff` (the flat skills in Pi, personal skills in Codex and Claude Code, category skills in Hermes, OpenCode skills, and Oh My Pi skills need no reinstall); for Pi with Git package, run `pi update --extension git:github.com/keli-wen/agy-staff` and `/reload`.

### CUJs

Examples below use Claude Code's `/agy:…` (or `/agy-…` for decoupled installs); in Codex use `$agy:…` (or `$agy-…`), in Pi use `/skill:agy-…`, in Hermes use `/skill agy-…` (or `/skill agy-staff/agy-…`), in OpenCode use `/agy-…` (or `skill` tool), and in Oh My Pi use `/skill:agy-…`.

| Use case | Invocation |
|---|---|
| Lead an ongoing task | `/agy:lead investigate the options, draft a proposal, and revise it with my feedback` |
| Quick second opinion | `/agy:ask what's your backend model` |
| A general task | `/agy:staffer summarize the open TODOs in this repo` |
| Generate an image | `/agy:staffer generate a pixel-art robot mascot, save it as assets/mascot.png` |
| Review the working tree | `/agy:reviewer Review the current working tree` |
| Review a PR | `/agy:reviewer Review PR #730` |
| Review a plan or decision | `/agy:reviewer Challenge the migration plan in docs/plan.md` |
| Survey a topic | `/agy:researcher how does auth work in this repo` |
| Implement a scoped fix | `/agy:implementer fix the flaky retry test` |
| Job ops (wait/status/cancel/continue) | natural language: "is the agy job done?", "continue: also check the error path" |

`reviewer` is fully prompt-based: you describe the subject and agy gathers the evidence itself (`gh pr view`, `git diff`, reading the file) — there is no flag for handing it a diff. It has two flavors, routed by subject: code review (severity-ranked findings) and general review (a multi-angle challenge of a plan, design, or decision).

`staffer` also covers agy's native tools without a dedicated specialist persona, including **image generation** (`generate_image`). A trial on agy v1.1.15 produced a 1024×1024 PNG in about 30 seconds; actual time depends on the task and environment.

## Core design

`lead` adds task orchestration guidance for your current agent. Within lead, orient enough to frame the assignment, delegate substantive work to `staffer` by default, wait for the result, then assess it and integrate or follow up. Specialists provide dedicated guidance when useful, while `ask` is reserved for testing. The host owns cross-task decisions, acceptance, integration, and delivery, using the existing jobs workflow. Invoke `/agy:lead` in Claude Code, `$agy:lead` in Codex, `/skill:agy-lead` in Pi, `/skill agy-lead` in Hermes, `/agy-lead` in OpenCode, or `/skill:agy-lead` in Oh My Pi.

`ask` answers in the same call. The other personas return a job id and a collection command, such as `wait <id> --timeout 10m`. Your agent waits using the host's available capabilities, with one independent background wait per job where supported.

The main agent waits for the final result by default. If you explicitly ask about progress, it can use `observe` to read a snapshot of recent tool activity and response text; it does not query progress for routine updates. Once the task finishes, `wait` or `result` delivers the full report. Expiring a wait leaves the worker running.

The timeline below follows a background task from delegation to completion. The host agent waits for the final result by default (or advances already-identified independent work), checks progress when asked, and collects the report.

[![A background task over time: the host delegates, waits or observes, while the worker continuously saves AGY output and eventually delivers the full report](assets/integration.png)](assets/integration.svg)

Jobs have a separate execution deadline: default 60 minutes, configurable at launch with `--timeout` up to 120 minutes. Use `cancel` to stop execution, or explicitly request `continue` or `restart` after inspecting the existing work. The host harness controls when your agent receives a background result.

**Full reference →** [docs/REFERENCE.md](docs/REFERENCE.md) (flags, permission model, jobs/state, troubleshooting, upgrading). **Release notes →** [docs/releases/](docs/releases/).

## Community

- [LINUX DO](https://linux.do/) — A next-generation Linux community.

## Contributing

Contributions are welcome — issues, bug reports and pull requests all help.

A few things worth knowing before you open a PR:

- **Run the tests**: `npm test`. The standard suite uses temporary repos and HOME directories with fake `agy`, plus focused module tests. Keep regression tests offline and independent of personal settings. Real AGY validation is a separate opt-in suite described in [tests/README.md](tests/README.md).
- **Docs come in pairs**: `README.md` / `README.zh-CN.md` and `docs/REFERENCE.md` / `docs/REFERENCE.zh-CN.md` are kept in sync. Change one, change its counterpart.
- **Runtime code lives in `companion/`**: the entrypoint handles modes and job commands; separate modules handle streaming execution, observations and state locking. Skills call the companion, and `templates/` holds the shared prompts.
- **Canonical skills are the source of truth**: edit personas in `skills/`, never in `pi-skills/`, `hermes-skills/`, `opencode-skills/`, `codex-skills/`, `claude-skills/`, or `omp-skills/`. Run `npm run generate:pi`, `npm run generate:hermes`, `npm run generate:opencode`, `npm run generate:codex`, `npm run generate:claude`, and `npm run generate:omp` to generate entrypoints, and `npm run check:pi`, `npm run check:hermes`, `npm run check:opencode`, `npm run check:codex`, `npm run check:claude`, and `npm run check:omp` to verify consistency.

Adding a mode or a flag changes the public surface, so please open an issue first and we can agree on the shape.

## License

MIT — see [LICENSE](LICENSE).
