---
name: agy-ask
description: "Ask Google's Antigravity CLI (agy staffer, fast Gemini) a cheap one-shot question - the fast zero-tool mode and the post-install smoke test. Use when the user says /agy-ask, \"ask agy\", \"quick second opinion from agy\", or right after installing to verify the plugin works."
slash: true
version: 0.7.3
author: agy-staff
license: MIT
metadata:
  opencode/slash: true
  opencode/autoinvoke: true
  tags: [agy, gemini, q-and-a, smoke-test, delegation]
---

<!-- Generated from skills/ask/SKILL.md; run npm run generate:opencode. Do not edit here. -->

# agy ask

The quick mode: one question in, one answer out, ~3 seconds on the default `gemini-3.8-flash-low`. Zero tools by design (restricted profile, question-only prompt), so it needs no setup and works on a fresh install — run it first as the smoke test: `ask --prompt "reply with OK"`.

ask is the only persona that runs in the foreground: the call blocks and the answer comes back on stdout. staffer, researcher, reviewer, and implementer instead return a background job id (see the jobs skill, `../agy-jobs/SKILL.md (or load via `skill` tool with `id: "agy-jobs"`)`).

## Locating the companion

The agy-staff companion runtime is located at `${AGY_STAFF_HOME:-~/.agy-staff}/companion/agy-companion.mjs`. Run via the `shell` tool:

```bash
node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs" ask [flags] --prompt "question"
```

Pass the user's question verbatim via `--prompt`; use `--prompt-file <path>` or `--stdin` for a long question.

> [!IMPORTANT]
> - Run this command **unsandboxed** — agy needs a localhost port and its OAuth token file, which harness sandboxes hide. Details: `../agy-jobs/references/troubleshooting.md`.
> - **OpenCode `shell` guidance**: Run as a standard foreground command (`background: false`).
> - If passing the `timeout` parameter to OpenCode's `shell` tool, specify it in **milliseconds** (e.g. `timeout: 120000` for 2 minutes). Do not pass seconds.
> - On Windows PowerShell, if `${VAR:-DEFAULT}` syntax is unsupported, use `node "$env:USERPROFILE\.agy-staff\companion\agy-companion.mjs"` directly.

## Flags (all optional)

- `--prompt <text>` / `--prompt-file <path>` / `--stdin` — the question, from exactly one of these three sources. Use file/stdin for a long question.
- `--continue` — reuse the last ask conversation; `--conversation <id>` targets a specific one.
- `--model <id>` or `--effort low|medium|high` — default model is `gemini-3.8-flash-low`.
- `--timeout <dur>` — default 2m.

ask is always restricted (it is tool-free, so there is nothing to unrestrict); `--unrestricted` is ignored with a note on stderr. That is fixed for ask alone — the tool-using personas default to unrestricted, where `--restricted` is an opt-in hardening flag. Execution style is likewise fixed per mode and no flag changes it.

## Rules

- Pass the user's question through verbatim and return the answer verbatim. The `[agy-staff]` telemetry line arrives on stderr and is metadata for you, the calling agent — do not show it to the user; mention the follow-up ability in natural language when relevant, and give model/duration/token numbers only if asked.
- If the answer says "not sure", relay it as-is; do not silently substitute your own answer.
- Exit 5 means a resumable response timeout: explain it and ask whether the user wants to continue with the suggested timeout or stop. Continue only after explicit user confirmation, using the recorded conversation and configuration. For other companion errors, quote the error and add a concise diagnosis. Full failure protocol: `../agy-jobs/SKILL.md (or load via `skill` tool with `id: "agy-jobs"`)`.

## Host compatibility

When this skill or its referenced instructions require a tool that the current environment does not provide, use available capabilities to achieve an equivalent result. Adapt only the tool-specific execution method; preserve the task goal, authorization requirements, explicit confirmation steps, result delivery, and stopping conditions.

If an equivalent result cannot be achieved, or you cannot establish that an alternative is equivalent, explain the missing capability and its impact, and ask the user for help. Do not silently skip requirements or bypass the environment's restrictions.
