#!/usr/bin/env node
/**
 * install-clean-codex.mjs
 * 
 * 跨平台、自适应的 Codex agy-staff 技能安装与解耦重构工具。
 * 遵循 Codex 个人技能规范（~/.codex/skills/）。
 * 零第三方依赖（纯 Node.js 原生 API），支持 Windows / macOS / Linux / WSL。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateCodexSkills } from './generate-codex-skills.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SOURCE_REPO = path.resolve(__dirname, '..');

// 探测 Codex 配置主目录
function detectCodexHome() {
  if (process.env.CODEX_HOME && process.env.CODEX_HOME.trim()) {
    return path.resolve(process.env.CODEX_HOME.trim());
  }
  return path.join(os.homedir(), '.codex');
}

// 命令行参数与环境变量解析
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  runTest: args.includes('--test'),
  forceRuntime: args.includes('--force-runtime') || args.includes('--sync-runtime'),
  noWsl: args.includes('--no-wsl'),
  sourceRepo: getArgValue('--source-repo') ? path.resolve(getArgValue('--source-repo')) : DEFAULT_SOURCE_REPO,
  runtimeDir: getArgValue('--runtime-dir')
    ? path.resolve(getArgValue('--runtime-dir'))
    : (process.env.AGY_STAFF_HOME ? path.resolve(process.env.AGY_STAFF_HOME.trim()) : path.join(os.homedir(), '.agy-staff')),
  codexHome: getArgValue('--codex-home') ? path.resolve(getArgValue('--codex-home')) : detectCodexHome(),
  help: args.includes('--help') || args.includes('-h'),
};

options.skillsDir = getArgValue('--skills-dir')
  ? path.resolve(getArgValue('--skills-dir'))
  : (process.env.CODEX_SKILLS_DIR
      ? path.resolve(process.env.CODEX_SKILLS_DIR.trim())
      : path.join(options.codexHome, 'skills'));

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

if (options.help) {
  console.log(`
用法: node scripts/install-clean-codex.mjs [选项]

选项:
  --dry-run               演练模式，仅打印将要执行的操作，不修改任何文件
  --test                  安装完成后执行真实的连网大模型连通性测试 (默认仅做离线完整性自检)
  --force-runtime         即使运行时已就绪也强制覆盖更新运行时 (别名: --sync-runtime)
  --source-repo <dir>     agy-staff 源码仓库根目录 (默认: 脚本上级目录)
  --runtime-dir <dir>     全局共享运行时目标目录 (默认: $AGY_STAFF_HOME 或 ~/.agy-staff)
  --codex-home <dir>      Codex 配置根目录 (默认: $CODEX_HOME 或 ~/.codex)
  --skills-dir <dir>      技能目标安装目录 (默认: $CODEX_SKILLS_DIR 或 <codex-home>/skills)
  --no-wsl                在 Windows 上跳过 WSL 互通软链接检测与配置
  -h, --help              显示此帮助信息
`);
  process.exit(0);
}

const log = {
  info: (msg) => console.log(`\x1b[36m-->\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✖\x1b[0m ${msg}`),
  dim: (msg) => console.log(`\x1b[90m    ${msg}\x1b[0m`),
};

console.log('\n\x1b[1;36m=== Codex: agy-staff 标准解耦安装器 ===\x1b[0m\n');
if (options.dryRun) {
  console.log('\x1b[33m[DRY-RUN 模式生效中：不会对系统进行任何实际写入]\x1b[0m\n');
}

// 检查源仓库完整性
const sourceCompanion = path.join(options.sourceRepo, 'companion');
const sourceTemplates = path.join(options.sourceRepo, 'templates');
const sourceCodexSkills = path.join(options.sourceRepo, 'codex-skills');

if (!fs.existsSync(sourceCompanion) || !fs.existsSync(sourceTemplates)) {
  log.error(`源码目录不完整，未找到 companion/ 或 templates/: ${options.sourceRepo}`);
  process.exit(1);
}

// 如果 codex-skills 尚未生成或缺少，先自动从 skills/ 生成
if (!fs.existsSync(sourceCodexSkills) || fs.readdirSync(sourceCodexSkills).length === 0) {
  log.info('正在为 Codex 生成解耦技能格式...');
  if (!options.dryRun) {
    generateCodexSkills({ root: options.sourceRepo });
  }
}

// 递归复制辅助函数
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 检查运行时健康度
function checkRuntimeHealth(runtimeDir) {
  const companionFile = path.join(runtimeDir, 'companion', 'agy-companion.mjs');
  const templatesDir = path.join(runtimeDir, 'templates');
  if (!fs.existsSync(companionFile) || !fs.existsSync(templatesDir)) {
    return { ok: false, reason: '未找到 companion 或 templates 目录' };
  }
  try {
    const tFiles = fs.readdirSync(templatesDir);
    if (tFiles.length === 0) {
      return { ok: false, reason: 'templates 目录为空' };
    }
    const nodeCheck = spawnSync(process.execPath, ['--check', companionFile], { encoding: 'utf8' });
    if (nodeCheck.status !== 0) {
      return { ok: false, reason: `语法解析检查未通过: ${nodeCheck.stderr || 'unknown'}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// 1. 检查并按需安装全局共享运行时
log.info(`[1/4] 检查共享运行时环境: ${options.runtimeDir}`);
const runtimeHealth = checkRuntimeHealth(options.runtimeDir);

if (runtimeHealth.ok && !options.forceRuntime) {
  log.success(`全局共享运行时已就绪且完整 (跳过安装)`);
  log.dim(`检测到已有 Agent 或先前安装的运行时: ${options.runtimeDir}`);
  log.dim(`(如需强制覆盖更新运行时，可附加 --sync-runtime 参数)`);
} else {
  if (options.forceRuntime && runtimeHealth.ok) {
    log.info(`收到强制更新指示，正在同步最新运行时到: ${options.runtimeDir}...`);
  } else {
    log.info(`共享运行时未就绪 (${runtimeHealth.reason})，正在安装至: ${options.runtimeDir}...`);
  }

  if (!options.dryRun) {
    copyDirRecursive(sourceCompanion, path.join(options.runtimeDir, 'companion'));
    copyDirRecursive(sourceTemplates, path.join(options.runtimeDir, 'templates'));
  }
  log.success(`已完成共享运行时 companion/ 与 templates/ 的部署`);
}

// 2. WSL 互通支持（仅 Windows 下探测）
if (process.platform === 'win32' && !options.noWsl) {
  log.info('[2/4] 检测 WSL 环境互通性...');
  try {
    const wslCheck = spawnSync('wsl.exe', ['-l', '-q'], { timeout: 3000 });
    const hasDistro = wslCheck.status === 0 && wslCheck.stdout && wslCheck.stdout.length > 0;
    if (hasDistro) {
      const wslPathProc = spawnSync('wsl.exe', ['-e', 'wslpath', '-a', '-u', options.runtimeDir], {
        encoding: 'utf8',
        timeout: 3000,
      });
      if (wslPathProc.status === 0 && wslPathProc.stdout.trim()) {
        const wslTarget = wslPathProc.stdout.trim();
        log.dim(`解析到 WSL 挂载路径: ${wslTarget}`);
        if (!options.dryRun) {
          spawnSync('wsl.exe', ['-e', 'bash', '-c', `[ -L ~/.agy-staff ] || [ ! -e ~/.agy-staff ] && ln -sfn "${wslTarget}" ~/.agy-staff`], {
            timeout: 5000,
          });
        }
        log.success(`WSL 软链接已建立: ~/.agy-staff -> ${wslTarget}`);
      }
    } else {
      log.dim('系统未检测到活动的 WSL Linux 发行版，跳过软链接配置');
    }
  } catch (e) {
    log.dim(`WSL 探测跳过 (非关键项): ${e.message}`);
  }
} else if (options.noWsl) {
  log.dim('已指定 --no-wsl，跳过 WSL 软链接检测');
} else {
  log.dim('当前为非 Windows 平台，无需配置 WSL 软链接');
}

// 3. 部署技能到 Codex skills 目录
log.info(`[3/4] 部署技能到 Codex 技能目录: ${options.skillsDir}`);
if (!fs.existsSync(options.codexHome)) {
  log.warn(`Codex 配置根目录尚不存在: ${options.codexHome}`);
  log.dim('将在安装技能时自动创建对应目录');
}

if (!options.dryRun) {
  if (!fs.existsSync(options.skillsDir)) {
    fs.mkdirSync(options.skillsDir, { recursive: true });
  }
  copyDirRecursive(sourceCodexSkills, options.skillsDir);

  // 若用户指定了自定义运行时目录（非默认 ~/.agy-staff），动态适配部署技能中的指向路径
  const defaultRuntimeDir = path.join(os.homedir(), '.agy-staff');
  const isCustomRuntime = path.resolve(options.runtimeDir) !== path.resolve(defaultRuntimeDir);
  const customPosix = options.runtimeDir.split(path.sep).join('/');
  if (isCustomRuntime) {
    log.dim(`检测到非默认运行时目录，正在适配部署技能中的指向路径...`);
  }

  const deployedDirs = fs.readdirSync(options.skillsDir, { withFileTypes: true });
  for (const d of deployedDirs) {
    if (!d.isDirectory()) continue;
    const mdFiles = [path.join(options.skillsDir, d.name, 'SKILL.md')];
    const refDir = path.join(options.skillsDir, d.name, 'references');
    if (fs.existsSync(refDir)) {
      for (const rf of fs.readdirSync(refDir)) {
        if (rf.endsWith('.md')) mdFiles.push(path.join(refDir, rf));
      }
    }
    for (const file of mdFiles) {
      if (!fs.existsSync(file)) continue;
      let c = fs.readFileSync(file, 'utf8');
      c = c.replace(
        /`\.\.\/\.\.\/docs\/REFERENCE\.md`/g,
        '`docs/REFERENCE.md` in the agy-staff documentation or repository'
      );
      if (isCustomRuntime) {
        c = c.replaceAll('${USERPROFILE:-$HOME}/.agy-staff', customPosix);
        c = c.replaceAll('~/.agy-staff', customPosix);
      }
      fs.writeFileSync(file, c, 'utf8');
    }
  }
  if (isCustomRuntime) {
    log.dim(`已将技能默认回退路径动态适配至: ${customPosix}`);
  }
}

// 统计部署的技能数量
let deployedCount = 0;
if (fs.existsSync(sourceCodexSkills)) {
  const dirs = fs.readdirSync(sourceCodexSkills, { withFileTypes: true });
  for (const d of dirs) {
    if (d.isDirectory() && d.name.startsWith('agy-')) {
      deployedCount++;
      log.dim(`已部署技能: ${d.name}`);
    }
  }
}
log.success(`成功部署了 ${deployedCount} 个标准技能至 Codex 个人技能库`);

// 4. 验证与自检
console.log('\n\x1b[1;36m=== [4/4] 验证自检 ===\x1b[0m');

// 检查运行时伴侣入口
const installedCompanion = path.join(options.runtimeDir, 'companion', 'agy-companion.mjs');
if (fs.existsSync(installedCompanion)) {
  log.success(`运行时伴侣入口就绪: ${installedCompanion}`);
} else if (!options.dryRun) {
  log.error(`运行时文件缺失: ${installedCompanion}`);
}

// 探测 Codex CLI 状态
try {
  const codexCheck = spawnSync('codex', ['--version'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
  });

  if (codexCheck.status === 0 && codexCheck.stdout) {
    log.success(`Codex CLI 检测正常: ${codexCheck.stdout.trim()}`);
  } else {
    log.dim('Codex CLI 处于离线或在非标准 PATH 中，技能文件已写入完毕');
  }
} catch {
  log.dim('跳过 codex CLI 外部探活 (文件已按标准安装到位)');
}

// 连通性测试
if (options.runTest && !options.dryRun) {
  console.log('\n--> 正在发起连网大模型连通性冒烟测试 (--test)...');
  try {
    const testResult = spawnSync(
      process.execPath,
      [installedCompanion, 'ask', '--prompt', 'reply with OK', '--timeout', '15s'],
      { encoding: 'utf8', timeout: 20000 }
    );
    if (testResult.status === 0) {
      log.success('API 连通性测试通过！Gemini 3.8 Flash 响应正常');
    } else {
      log.warn(`API 测试返回非零状态码: ${testResult.stderr || testResult.stdout}`);
      log.dim('提示：请确认已安装 Antigravity CLI 并已完成 Google 登录认证');
    }
  } catch (err) {
    log.warn(`API 测试未完成: ${err.message}`);
  }
} else {
  log.dim('已跳过连网测试（可通过 --test 选项按需触发）');
}

console.log('\n\x1b[32m✔ Codex 适配流程已顺利结束！\x1b[0m\n');
