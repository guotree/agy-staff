import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../scripts/generate-opencode-skills.mjs';
import { sandbox } from './helpers.mjs';

const EXPECTED_SKILLS = [
  'agy-ask',
  'agy-implementer',
  'agy-jobs',
  'agy-lead',
  'agy-researcher',
  'agy-reviewer',
  'agy-staffer',
];

test('OpenCode: generated skills adhere to OpenCode v2 format and frontmatter', () => {
  const opencodeSkillsDir = path.join(ROOT, 'opencode-skills');
  assert.ok(fs.existsSync(opencodeSkillsDir), 'opencode-skills directory must exist');

  for (const skillName of EXPECTED_SKILLS) {
    const skillMd = path.join(opencodeSkillsDir, skillName, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `${skillName}/SKILL.md must exist`);

    const content = fs.readFileSync(skillMd, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n/.exec(content);
    assert.ok(match, `${skillName} must contain YAML frontmatter`);

    const fmLines = match[1].split('\n');
    assert.ok(fmLines.some(l => l.startsWith(`name: ${skillName}`)), `name must be ${skillName}`);
    assert.ok(fmLines.some(l => l.startsWith('description:')), 'description must be present');
    assert.ok(fmLines.some(l => l.includes('slash: true')), 'slash command must be enabled');
    assert.ok(fmLines.some(l => l.includes('opencode/autoinvoke: true')), 'autoinvoke must be enabled');

    // Check cross-platform path rewriting and configurable AGY_STAFF_HOME
    assert.ok(
      content.includes('${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs'),
      'must use configurable AGY_STAFF_HOME and cross-platform ${USERPROFILE:-$HOME} companion path'
    );

    // Check OpenCode shell tool guidance and PowerShell safety note
    assert.ok(
      content.includes('OpenCode `shell` guidance'),
      'must include OpenCode shell invocation and millisecond timeout guidance'
    );
    assert.ok(
      content.includes('Windows PowerShell'),
      'must include Windows PowerShell direct invocation guidance'
    );

    // Check broken relative reference link was cleaned up
    assert.ok(
      !content.includes('../../docs/REFERENCE.md'),
      'must not contain broken relative ../../docs/REFERENCE.md links'
    );
  }

  // Check specific background vs foreground differentiation in agy-jobs
  const jobsContent = fs.readFileSync(path.join(opencodeSkillsDir, 'agy-jobs', 'SKILL.md'), 'utf8');
  assert.ok(
    jobsContent.includes('background: true'),
    'agy-jobs must explicitly guide wait to use background: true in OpenCode'
  );
});

test('OpenCode: clean installer sandbox test (dry-run, first run deploy, second run skip)', (t) => {
  const sb = sandbox('opencode-harness');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxRuntime = path.join(sb.root, 'runtime');
  const sandboxSkills = path.join(sb.root, 'opencode-home', 'skills');
  const installer = path.join(ROOT, 'scripts', 'install-clean-opencode.mjs');

  // 1. Dry run
  const dryRunRes = spawnSync(
    process.execPath,
    [installer, '--dry-run', '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills],
    { encoding: 'utf8' }
  );
  assert.equal(dryRunRes.status, 0, `dry run must succeed: ${dryRunRes.stderr}`);
  assert.ok(!fs.existsSync(sandboxRuntime), 'dry-run must not create runtime dir');
  assert.ok(!fs.existsSync(sandboxSkills), 'dry-run must not create skills dir');

  // 2. First install (runtime missing -> installs runtime in sandbox)
  const firstInstall = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills],
    { encoding: 'utf8' }
  );
  assert.equal(firstInstall.status, 0, `first install must succeed: ${firstInstall.stderr}`);
  assert.ok(firstInstall.stdout.includes('正在安装至'), 'first install must deploy runtime');
  assert.ok(fs.existsSync(path.join(sandboxRuntime, 'companion', 'agy-companion.mjs')), 'companion must exist');
  assert.ok(fs.existsSync(path.join(sandboxRuntime, 'templates')), 'templates must exist');

  for (const skillName of EXPECTED_SKILLS) {
    const installedMd = path.join(sandboxSkills, skillName, 'SKILL.md');
    assert.ok(fs.existsSync(installedMd), `skill ${skillName} must be installed in sandbox`);
  }

  const installedAsk = fs.readFileSync(path.join(sandboxSkills, 'agy-ask', 'SKILL.md'), 'utf8');
  assert.ok(
    installedAsk.includes(sandboxRuntime.split(path.sep).join('/')),
    'custom runtime path must be dynamically adapted in installed skill'
  );

  // 3. Second install (runtime present -> skips runtime install)
  const secondInstall = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills],
    { encoding: 'utf8' }
  );
  assert.equal(secondInstall.status, 0, `second install must succeed: ${secondInstall.stderr}`);
  assert.ok(
    secondInstall.stdout.includes('跳过安装') || secondInstall.stdout.includes('已就绪且完整'),
    'second install must detect existing runtime and skip installation'
  );
});
