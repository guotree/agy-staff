#!/usr/bin/env node
/**
 * install-clean-pi.mjs
 * 
 * 跨平台、自适应的 Pi Agent agy-staff 技能安装与解耦重构工具。
 * 零第三方依赖（仅使用 Node.js 原生 API），支持 Windows / macOS / Linux / WSL。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SOURCE_REPO = path.resolve(__dirname, '..');

// 命令行参数解析
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  runTest: args.includes('--test'),
  sourceRepo: getArgValue('--source-repo') || DEFAULT_SOURCE_REPO,
  runtimeDir: getArgValue('--runtime-dir') || path.join(os.homedir(), '.agy-staff'),
  skillsDir: getArgValue('--skills-dir') || path.join(os.homedir(), '.pi', 'agent', 'skills'),
  settingsFile: getArgValue('--settings-file') || path.join(os.homedir(), '.pi', 'agent', 'settings.json'),
  help: args.includes('--help') || args.includes('-h'),
};

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

if (options.help) {
  console.log(`
用法: node scripts/install-clean-pi.mjs [选项]

选项:
  --dryRun, --dry-run      演练模式，仅打印将要执行的操作，不修改任何文件
  --test                  安装完成后执行真实的连网大模型连通性测试 (默认仅做离线完整性自检)
  --source-repo <dir>     agy-staff 源码仓库根目录 (默认: 脚本上级目录)
  --runtime-dir <dir>     全局共享运行时目标目录 (默认: ~/.agy-staff)
  --skills-dir <dir>      Pi 技能目标目录 (默认: ~/.pi/agent/skills)
  --settings-file <file>  Pi 配置文件路径 (默认: ~/.pi/agent/settings.json)
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

console.log('\n\x1b[1;36m=== Pi Agent: agy-staff 标准解耦安装器 ===\x1b[0m\n');
if (options.dryRun) {
  console.log('\x1b[33m[DRY-RUN 模式生效中：不会对系统进行任何实际写入]\x1b[0m\n');
}

// 检查源仓库有效性
const sourceCompanion = path.join(options.sourceRepo, 'companion');
const sourceTemplates = path.join(options.sourceRepo, 'templates');
const sourcePiSkills = path.join(options.sourceRepo, 'pi-skills');

if (!fs.existsSync(sourceCompanion) || !fs.existsSync(sourceTemplates) || !fs.existsSync(sourcePiSkills)) {
  log.error(`源码目录不完整，未找到 companion/templates/pi-skills: ${options.sourceRepo}`);
  process.exit(1);
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

// 1. 清理 Pi settings.json 中的旧版 Git Package
log.info('[1/5] 检查并清理 Pi 旧版 Git Package...');
if (fs.existsSync(options.settingsFile)) {
  try {
    const raw = fs.readFileSync(options.settingsFile, 'utf8');
    const settings = JSON.parse(raw);
    if (Array.isArray(settings.packages)) {
      const originalLen = settings.packages.length;
      settings.packages = settings.packages.filter(
        (pkg) => typeof pkg !== 'string' || !pkg.includes('keli-wen/agy-staff')
      );
      if (settings.packages.length !== originalLen) {
        log.dim(`从 packages 中移除了 agy-staff 复合包定义`);
        if (!options.dryRun) {
          fs.writeFileSync(options.settingsFile, JSON.stringify(settings, null, 2), 'utf8');
        }
      } else {
        log.dim(`未发现需要清理的旧版 Git Package 引用`);
      }
    }
  } catch (err) {
    log.warn(`解析 settings.json 遇到问题 (跳过修改): ${err.message}`);
  }
} else {
  log.dim(`Pi 配置文件不存在，无需清理: ${options.settingsFile}`);
}

// 清理深层 git 缓存目录（若存在）
const legacyGitCache = path.join(
  path.dirname(options.settingsFile),
  'git',
  'github.com',
  'keli-wen',
  'agy-staff'
);
if (fs.existsSync(legacyGitCache)) {
  log.dim(`发现旧版深层 Git 缓存目录，正在清理: ${legacyGitCache}`);
  if (!options.dryRun) {
    fs.rmSync(legacyGitCache, { recursive: true, force: true });
  }
}

// 2. 部署全局共享运行时
log.info(`[2/5] 部署共享运行时至: ${options.runtimeDir}`);
if (!options.dryRun) {
  copyDirRecursive(sourceCompanion, path.join(options.runtimeDir, 'companion'));
  copyDirRecursive(sourceTemplates, path.join(options.runtimeDir, 'templates'));
}
log.dim(`已同步 companion/ 与 templates/ 到运行时中心`);

// 3. WSL 互通支持（仅 Windows 下动态探测）
if (process.platform === 'win32') {
  log.info('[3/5] 检测 WSL 环境互通性...');
  try {
    // 动态探测是否有真实的 WSL 发行版
    const wslCheck = spawnSync('wsl.exe', ['-l', '-q'], { timeout: 3000 });
    const hasDistro = wslCheck.status === 0 && wslCheck.stdout && wslCheck.stdout.length > 0;
    if (hasDistro) {
      // 动态将 Windows 绝对路径转换为 WSL 实际挂载路径
      const wslPathProc = spawnSync('wsl.exe', ['-e', 'wslpath', '-a', '-u', options.runtimeDir], {
        encoding: 'utf8',
        timeout: 3000,
      });
      if (wslPathProc.status === 0 && wslPathProc.stdout.trim()) {
        const wslTarget = wslPathProc.stdout.trim();
        log.dim(`解析到 WSL 挂载路径: ${wslTarget}`);
        if (!options.dryRun) {
          spawnSync('wsl.exe', ['-e', 'bash', '-c', `ln -sfn "${wslTarget}" ~/.agy-staff`], {
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
} else {
  log.dim('当前为非 Windows 平台，无需配置 WSL 软链接');
}

// 4. 转换并部署技能到 Pi 目录
log.info(`[4/5] 部署技能到 Pi 标准用户目录: ${options.skillsDir}`);
if (!options.dryRun) {
  if (!fs.existsSync(options.skillsDir)) {
    fs.mkdirSync(options.skillsDir, { recursive: true });
  }
  copyDirRecursive(sourcePiSkills, options.skillsDir);
}

// 转换所有 SKILL.md 中的寻址路径
let convertedCount = 0;
if (fs.existsSync(options.skillsDir) || options.dryRun) {
  const skillDirs = fs.readdirSync(sourcePiSkills, { withFileTypes: true });
  for (const dir of skillDirs) {
    if (!dir.isDirectory() || !dir.name.startsWith('agy-')) continue;
    const skillMdPath = path.join(options.skillsDir, dir.name, 'SKILL.md');
    let content = '';
    if (fs.existsSync(skillMdPath)) {
      content = fs.readFileSync(skillMdPath, 'utf8');
    } else if (options.dryRun) {
      content = fs.readFileSync(path.join(sourcePiSkills, dir.name, 'SKILL.md'), 'utf8');
    }

    if (content) {
      content = content.replace(
        /node "<skill-dir>\/\.\.\/\.\.\/companion\/agy-companion\.mjs"/g,
        'node "$HOME/.agy-staff/companion/agy-companion.mjs"'
      );
      content = content.replace(
        /This skill file lives at `<plugin-root>\/pi-skills\/[^`]+`; resolve the companion path relative to this skill directory:/g,
        'The agy-staff companion runtime is located at `~/.agy-staff/companion/agy-companion.mjs`:'
      );
      content = content.replace(
        /This skill lives at `<plugin-root>\/pi-skills\/agy-lead\/SKILL\.md`\. Write the brief to a temporary file and call the shared companion:/g,
        'Write the brief to a temporary file and call the shared companion:'
      );

      if (!options.dryRun) {
        fs.writeFileSync(skillMdPath, content, 'utf8');
      }
      convertedCount++;
    }
  }
}
log.success(`成功转换并安装了 ${convertedCount} 个扁平标准技能`);

// 5. Windows 下 Shell 动态智能探测与保护
if (process.platform === 'win32') {
  log.info('[5/5] 检查 Pi Shell 配置...');
  detectAndConfigureShell(options.settingsFile, options.dryRun);
} else {
  log.info('[5/5] 非 Windows 平台，Pi 默认使用系统标准 POSIX Shell');
}

function detectAndConfigureShell(settingsPath, isDryRun) {
  if (!fs.existsSync(settingsPath)) {
    log.dim(`Pi 配置文件尚不存在，跳过 shellPath 配置: ${settingsPath}`);
    return;
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    log.warn('无法解析 settings.json，跳过 shellPath 检查');
    return;
  }

  // 如果已经配置且路径真实存在，绝不擅自覆盖用户既有配置
  if (settings.shellPath && fs.existsSync(settings.shellPath)) {
    log.dim(`当前已配置有效的 shellPath: ${settings.shellPath} (保持不变)`);
    return;
  }

  // 动态智能查找 Git Bash
  const candidates = [];

  // A. 从 PATH 中的 git.exe 向上动态推导
  try {
    const gitWhere = execSync('where.exe git', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const firstGit = gitWhere.trim().split(/\r?\n/)[0];
    if (firstGit && fs.existsSync(firstGit)) {
      const gitDir = path.dirname(path.dirname(firstGit)); // 取两级目录
      candidates.push(path.join(gitDir, 'bin', 'bash.exe'));
      candidates.push(path.join(gitDir, 'usr', 'bin', 'bash.exe'));
    }
  } catch {
    // 忽略未找到 git 的错误
  }

  // B. 常见标准安装路径候选池
  const progFiles = process.env.ProgramFiles;
  const progFilesX86 = process.env['ProgramFiles(x86)'];
  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;

  if (progFiles) candidates.push(path.join(progFiles, 'Git', 'bin', 'bash.exe'));
  if (progFilesX86) candidates.push(path.join(progFilesX86, 'Git', 'bin', 'bash.exe'));
  if (localAppData) candidates.push(path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'));
  if (userProfile) candidates.push(path.join(userProfile, 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'));

  let matchedBash = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      matchedBash = c;
      break;
    }
  }

  if (matchedBash) {
    log.success(`自动匹配到本机原生 Git Bash: ${matchedBash}`);
    settings.shellPath = matchedBash;
    if (!isDryRun) {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      log.dim(`已更新 shellPath 配置到 settings.json`);
    }
  } else {
    log.warn('未能在常见位置自动定位到 Git Bash，保持系统默认设置');
    log.dim('提示：若在 Windows 上遇到 bash 执行问题，可在 settings.json 中手动指定 shellPath');
  }
}

// 6. 验证自检 (离线完整性检测为主，连网测试受参数控制)
console.log('\n\x1b[1;36m=== 验证自检 ===\x1b[0m');
const installedCompanion = path.join(options.runtimeDir, 'companion', 'agy-companion.mjs');
if (fs.existsSync(installedCompanion)) {
  log.success(`运行时伴侣文件就绪: ${installedCompanion}`);
} else if (!options.dryRun) {
  log.error(`运行时文件未在预期位置找到: ${installedCompanion}`);
}

// 离线语法校验
try {
  const nodeCheck = spawnSync(process.execPath, ['--check', installedCompanion], { encoding: 'utf8' });
  if (nodeCheck.status === 0) {
    log.success(`Node.js 运行时语法解析正常 (${process.version})`);
  }
} catch (e) {
  log.warn(`离线语法检查跳过: ${e.message}`);
}

// 仅在明确传入 --test 时执行连网调用
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
      log.dim('提示：如果这是新环境，请先交互式运行一次 `agy` 完成 Google 登录认证');
    }
  } catch (err) {
    log.warn(`API 测试未完成: ${err.message}`);
  }
} else {
  log.dim('已跳过连网测试（可通过 --test 选项按需触发）');
}

console.log('\n\x1b[32m✔ 安装与重构流程已顺利结束！\x1b[0m\n');
