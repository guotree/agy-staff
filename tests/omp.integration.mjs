import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../scripts/generate-omp-skills.mjs';
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

test('Oh My Pi: generated skills adhere to Oh My Pi format and frontmatter', () => {
  const ompSkillsDir = path.join(ROOT, 'omp-skills');
  assert.ok(fs.existsSync(ompSkillsDir), 'omp-skills directory must exist');

  for (const skillName of EXPECTED_SKILLS) {
    const skillMd = path.join(ompSkillsDir, skillName, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `${skillName}/SKILL.md must exist`);

    const content = fs.readFileSync(skillMd, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n/.exec(content);
    assert.ok(match, `${skillName} must contain YAML frontmatter`);

    const fmLines = match[1].split('\n');
    assert.ok(fmLines.some(l => l.startsWith(`name: ${skillName}`)), `name must be ${skillName}`);
    assert.ok(fmLines.some(l => l.startsWith('description:')), 'description must be present');
    if (skillName !== 'agy-lead') {
      assert.ok(fmLines.some(l => l.startsWith('allowed-tools:')), `${skillName} must have allowed-tools`);
    }

    // Check cross-platform path rewriting and configurable AGY_STAFF_HOME
    assert.ok(
      content.includes('${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs'),
      'must use configurable AGY_STAFF_HOME and cross-platform ${USERPROFILE:-$HOME} companion path'
    );

    // Check Oh My Pi execution guidance
    assert.ok(
      content.includes('Oh My Pi execution guidance'),
      'must include Oh My Pi execution guidance'
    );
    assert.ok(
      content.includes('bash'),
      'must include bash tool execution note'
    );

    // Check broken relative reference link was cleaned up
    assert.ok(
      !content.includes('../../docs/REFERENCE.md'),
      'must not contain broken relative ../../docs/REFERENCE.md links'
    );
  }
});

test('Oh My Pi: clean installer sandbox test (dry-run, first run deploy, second run skip, profile support)', (t) => {
  const sb = sandbox('omp-harness');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxRuntime = path.join(sb.root, 'runtime');
  const sandboxOmpHome = path.join(sb.root, 'omp-home');
  const sandboxSkills = path.join(sandboxOmpHome, 'agent', 'skills');
  const installer = path.join(ROOT, 'scripts', 'install-clean-omp.mjs');

  // 1. Dry run
  const dryRunRes = spawnSync(
    process.execPath,
    [installer, '--dry-run', '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills, '--omp-home', sandboxOmpHome],
    { encoding: 'utf8' }
  );
  assert.equal(dryRunRes.status, 0, `dry run must succeed: ${dryRunRes.stderr}`);
  assert.ok(!fs.existsSync(sandboxRuntime), 'dry-run must not create runtime dir');
  assert.ok(!fs.existsSync(sandboxSkills), 'dry-run must not create skills dir');
  assert.ok(!fs.existsSync(sandboxOmpHome), 'dry-run must not create omp home dir');

  // 2. First install (runtime missing -> installs runtime in sandbox)
  const firstInstall = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills, '--omp-home', sandboxOmpHome],
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
    [installer, '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills, '--omp-home', sandboxOmpHome],
    { encoding: 'utf8' }
  );
  assert.equal(secondInstall.status, 0, `second install must succeed: ${secondInstall.stderr}`);
  assert.ok(
    secondInstall.stdout.includes('跳过安装') || secondInstall.stdout.includes('已就绪且完整'),
    'second install must detect existing runtime and skip installation'
  );

  // 4. Profile install test
  const profileInstall = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--omp-home', sandboxOmpHome, '--profile', 'dev-work'],
    { encoding: 'utf8' }
  );
  assert.equal(profileInstall.status, 0, `profile install must succeed: ${profileInstall.stderr}`);
  const profileSkillsDir = path.join(sandboxOmpHome, 'profiles', 'dev-work', 'agent', 'skills');
  assert.ok(fs.existsSync(profileSkillsDir), 'profile skills dir must be created');
  for (const skillName of EXPECTED_SKILLS) {
    const profileSkillMd = path.join(profileSkillsDir, skillName, 'SKILL.md');
    assert.ok(fs.existsSync(profileSkillMd), `profile skill ${skillName} must exist`);
  }
});
