import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../scripts/generate-hermes-skills.mjs';
import { cleanLegacyGlobalProfile, injectTerminalShellInitFile } from '../scripts/install-clean-hermes.mjs';
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

test('Hermes: generated skills adhere to agentskills.io format and valid frontmatter', () => {
  const hermesSkillsDir = path.join(ROOT, 'hermes-skills');
  assert.ok(fs.existsSync(hermesSkillsDir), 'hermes-skills directory must exist');

  for (const skillName of EXPECTED_SKILLS) {
    const skillMd = path.join(hermesSkillsDir, skillName, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `${skillName}/SKILL.md must exist`);

    const content = fs.readFileSync(skillMd, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n/.exec(content);
    assert.ok(match, `${skillName} must contain YAML frontmatter`);

    const fmLines = match[1].split('\n');
    assert.ok(fmLines.some(l => l.startsWith(`name: ${skillName}`)), `name must be ${skillName}`);
    assert.ok(fmLines.some(l => l.startsWith('description:')), 'description must be present');
    assert.ok(fmLines.some(l => l.includes('platforms: [linux, macos, windows]')), 'platforms must support linux, macos, windows');
    assert.ok(fmLines.some(l => l.includes('metadata:')), 'metadata must be present');

    // Check cross-platform path rewriting and configurable AGY_STAFF_HOME
    assert.ok(
      content.includes('${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs'),
      'must use configurable AGY_STAFF_HOME and cross-platform ${USERPROFILE:-$HOME} companion path'
    );

    // Check Hermes terminal guidance
    assert.ok(
      content.includes('Hermes `terminal` guidance'),
      'must include Hermes terminal invocation and timeout guidance'
    );
  }
});

test('Hermes: clean installer deploys runtime on first run and skips on second run', (t) => {
  const sb = sandbox('hermes-harness');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxRuntime = path.join(sb.root, 'runtime');
  const sandboxSkills = path.join(sb.root, 'hermes-home', 'skills', 'agy-staff');
  const installer = path.join(ROOT, 'scripts', 'install-clean-hermes.mjs');

  // 1. Dry run
  const dryRunRes = spawnSync(
    process.execPath,
    [installer, '--dry-run', '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills],
    { encoding: 'utf8' }
  );
  assert.equal(dryRunRes.status, 0, `dry run must succeed: ${dryRunRes.stderr}`);
  assert.ok(!fs.existsSync(sandboxRuntime), 'dry-run must not create runtime dir');
  assert.ok(!fs.existsSync(sandboxSkills), 'dry-run must not create skills dir');

  // 2. First install (runtime missing -> installs runtime)
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
    assert.ok(fs.existsSync(installedMd), `skill ${skillName} must be installed`);
  }

  const installedAsk = fs.readFileSync(path.join(sandboxSkills, 'agy-ask', 'SKILL.md'), 'utf8');
  assert.ok(
    installedAsk.includes(sandboxRuntime.split(path.sep).join('/')),
    'custom runtime path must be dynamically adapted in installed skill'
  );

  // 3. Second install (runtime present -> skips runtime install as instructed by user)
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

test('Hermes: cleanLegacyGlobalProfile safely removes legacy unalias without deleting empty files', () => {
  // 1. File only contains legacy injection
  const onlyLegacy = '# agy-staff headless terminal fix\nunalias node ipython php php5 psql python2.7 winget 2>/dev/null || true\n';
  const res1 = cleanLegacyGlobalProfile(onlyLegacy);
  assert.equal(res1.changed, true);
  assert.equal(res1.cleaned, '');
  assert.equal(res1.isEmpty, true);

  // 2. File contains mixed user config and legacy injection
  const mixed = `export PATH=/usr/bin:$PATH
# agy-staff headless fix
unalias node 2>/dev/null || true
alias ll="ls -la"
`;
  const res2 = cleanLegacyGlobalProfile(mixed);
  assert.equal(res2.changed, true);
  assert.equal(res2.isEmpty, false);
  assert.ok(!res2.cleaned.includes('agy-staff'));
  assert.ok(!res2.cleaned.includes('unalias node'));
  assert.ok(res2.cleaned.includes('export PATH=/usr/bin:$PATH'));
  assert.ok(res2.cleaned.includes('alias ll="ls -la"'));

  // 3. File contains both keywords but in unrelated context (no regex match)
  const unrelated = `
# agy-staff is great
export FOO=bar
# my own unalias
unalias node
`;
  const res3 = cleanLegacyGlobalProfile(unrelated);
  assert.equal(res3.changed, false);
  assert.equal(res3.cleaned, unrelated);

  // 4. Windows CRLF line endings
  const crlf = '# agy-staff\r\nunalias node\r\nexport BAR=1\r\n';
  const res4 = cleanLegacyGlobalProfile(crlf);
  assert.equal(res4.changed, true);
  assert.ok(!res4.cleaned.includes('agy-staff'));
  assert.ok(res4.cleaned.includes('export BAR=1'));
});

test('Hermes: injectTerminalShellInitFile safely handles various YAML layouts without duplicate keys', () => {
  const P = '/c/Users/test/hermes-init.sh';

  // 1. Empty content
  assert.equal(
    injectTerminalShellInitFile('', P),
    `terminal:\n  shell_init_files:\n    - ${P}\n`
  );

  // 2. Existing config without terminal key
  assert.equal(
    injectTerminalShellInitFile('model: gpt-4\ntemperature: 0.7\n', P),
    `model: gpt-4\ntemperature: 0.7\n\nterminal:\n  shell_init_files:\n    - ${P}\n`
  );

  // 3. Existing terminal key with other properties (e.g. shell:) - MUST NOT create duplicate terminal:
  const withShell = injectTerminalShellInitFile('model: gpt-4\nterminal:\n  shell: bash\nlast: 1\n', P);
  assert.equal(
    withShell,
    `model: gpt-4\nterminal:\n  shell_init_files:\n    - ${P}\n  shell: bash\nlast: 1\n`
  );
  const terminalMatches = withShell.match(/^terminal:/gm);
  assert.equal(terminalMatches ? terminalMatches.length : 0, 1, 'must have exactly one terminal key');

  // 4. Existing terminal key with trailing comment
  assert.equal(
    injectTerminalShellInitFile('terminal: # custom terminal\n  shell: bash\n', P),
    `terminal: # custom terminal\n  shell_init_files:\n    - ${P}\n  shell: bash\n`
  );

  // 5. Existing terminal: {} flow mapping
  assert.equal(
    injectTerminalShellInitFile('terminal: {}\nother: true\n', P),
    `terminal:\n  shell_init_files:\n    - ${P}\nother: true\n`
  );

  // 6. Existing shell_init_files: [] empty flow array
  assert.equal(
    injectTerminalShellInitFile('terminal:\n  shell_init_files: []\n  shell: bash\n', P),
    `terminal:\n  shell_init_files:\n    - ${P}\n  shell: bash\n`
  );

  // 7. Existing shell_init_files with existing items (block list)
  assert.equal(
    injectTerminalShellInitFile('terminal:\n  shell_init_files:\n    - /old/path.sh\n  shell: bash\n', P),
    `terminal:\n  shell_init_files:\n    - ${P}\n    - /old/path.sh\n  shell: bash\n`
  );

  // 8. Idempotency: when path already present, content is unchanged
  const already = `terminal:\n  shell_init_files:\n    - ${P}\n  shell: bash\n`;
  assert.equal(injectTerminalShellInitFile(already, P), already);
});

test('Hermes: installer cleans legacy global profile with backup and preserves dotfile on Windows', (t) => {
  if (process.platform !== 'win32') return;

  const sb = sandbox('hermes-profile-clean');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxHome = path.join(sb.root, 'home');
  fs.mkdirSync(sandboxHome, { recursive: true });
  const bashProfile = path.join(sandboxHome, '.bash_profile');
  fs.writeFileSync(
    bashProfile,
    '# agy-staff headless terminal fix\nunalias node ipython php 2>/dev/null || true\n',
    'utf8'
  );

  const sandboxRuntime = path.join(sb.root, 'runtime');
  const sandboxHermes = path.join(sb.root, 'hermes-home');
  const sandboxSkills = path.join(sandboxHermes, 'skills', 'agy-staff');
  const installer = path.join(ROOT, 'scripts', 'install-clean-hermes.mjs');

  const res = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--hermes-home', sandboxHermes, '--skills-dir', sandboxSkills],
    {
      encoding: 'utf8',
      env: { ...process.env, AGY_TEST_HOME: sandboxHome },
    }
  );
  assert.equal(res.status, 0, `install must succeed: ${res.stderr}`);

  // Verify file was NOT unlinked (still exists, but empty)
  assert.ok(fs.existsSync(bashProfile), '.bash_profile must not be deleted');
  const cleanedContent = fs.readFileSync(bashProfile, 'utf8');
  assert.equal(cleanedContent.trim(), '', '.bash_profile should be emptied');

  // Verify backup was created
  const backups = fs.readdirSync(sandboxHome).filter(f => f.startsWith('.bash_profile.bak-'));
  assert.equal(backups.length, 1, 'a timestamped backup of .bash_profile must exist');
});

test('Hermes: installer injects terminal config without duplicate keys when config.yaml already exists', (t) => {
  if (process.platform !== 'win32') return;

  const sb = sandbox('hermes-yaml-merge');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxHome = path.join(sb.root, 'home');
  fs.mkdirSync(sandboxHome, { recursive: true });

  const sandboxRuntime = path.join(sb.root, 'runtime');
  const sandboxHermes = path.join(sb.root, 'hermes-home');
  fs.mkdirSync(sandboxHermes, { recursive: true });
  const configYaml = path.join(sandboxHermes, 'config.yaml');
  fs.writeFileSync(
    configYaml,
    'model: custom-model\nterminal:\n  shell: C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\n',
    'utf8'
  );

  const sandboxSkills = path.join(sandboxHermes, 'skills', 'agy-staff');
  const installer = path.join(ROOT, 'scripts', 'install-clean-hermes.mjs');

  const res = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--hermes-home', sandboxHermes, '--skills-dir', sandboxSkills],
    {
      encoding: 'utf8',
      env: { ...process.env, AGY_TEST_HOME: sandboxHome, PATH: '' }, // simulate offline/unavailable hermes CLI
    }
  );
  assert.equal(res.status, 0, `install must succeed: ${res.stderr}`);

  const updatedYaml = fs.readFileSync(configYaml, 'utf8');
  assert.ok(updatedYaml.includes('shell_init_files:'), 'must have injected shell_init_files');
  assert.ok(updatedYaml.includes('hermes-terminal-init.sh'), 'must reference hermes-terminal-init.sh');
  assert.ok(updatedYaml.includes('powershell.exe'), 'must retain existing shell property');

  const termMatches = updatedYaml.match(/^terminal:/gm);
  assert.equal(termMatches ? termMatches.length : 0, 1, 'must have exactly one terminal key in config.yaml (no duplicate keys)');

  // Verify backup was created for existing config.yaml
  const configBackups = fs.readdirSync(sandboxHermes).filter(f => f.startsWith('config.yaml.bak-'));
  assert.equal(configBackups.length, 1, 'a timestamped backup of config.yaml must exist');
});

test('Hermes: installer does not touch non-agy skills in shared skills directory', (t) => {
  const sb = sandbox('hermes-skill-isolation');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxRuntime = path.join(sb.root, 'custom-runtime');
  const sandboxSkills = path.join(sb.root, 'shared-skills');
  const thirdPartySkillDir = path.join(sandboxSkills, 'weather-skill');
  fs.mkdirSync(thirdPartySkillDir, { recursive: true });

  const thirdPartyContent = '# Weather Skill\nDoes not use ~/.agy-staff directly.\n';
  const thirdPartySkillMd = path.join(thirdPartySkillDir, 'SKILL.md');
  fs.writeFileSync(thirdPartySkillMd, thirdPartyContent, 'utf8');

  const installer = path.join(ROOT, 'scripts', 'install-clean-hermes.mjs');
  const res = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--skills-dir', sandboxSkills],
    { encoding: 'utf8' }
  );
  assert.equal(res.status, 0, `install must succeed: ${res.stderr}`);

  // Third party skill must NOT be modified
  const currentThirdParty = fs.readFileSync(thirdPartySkillMd, 'utf8');
  assert.equal(currentThirdParty, thirdPartyContent, 'non-agy skill must remain unmodified');

  // agy skills must be deployed and rewritten
  const installedAsk = fs.readFileSync(path.join(sandboxSkills, 'agy-ask', 'SKILL.md'), 'utf8');
  assert.ok(
    installedAsk.includes(sandboxRuntime.split(path.sep).join('/')),
    'custom runtime path must be adapted in agy skills'
  );
});

test('Hermes: installer backs up hermes-terminal-init.sh if existing and modified on Windows', (t) => {
  if (process.platform !== 'win32') return;

  const sb = sandbox('hermes-init-bak');
  t.after(() => fs.rmSync(sb.root, { recursive: true, force: true }));

  const sandboxHermes = path.join(sb.root, 'hermes-home');
  fs.mkdirSync(sandboxHermes, { recursive: true });
  const initScript = path.join(sandboxHermes, 'hermes-terminal-init.sh');
  fs.writeFileSync(initScript, '# User customized terminal init\nexport MY_VAR=1\n', 'utf8');

  const sandboxRuntime = path.join(sb.root, 'runtime');
  const sandboxSkills = path.join(sandboxHermes, 'skills', 'agy-staff');
  const installer = path.join(ROOT, 'scripts', 'install-clean-hermes.mjs');

  const res = spawnSync(
    process.execPath,
    [installer, '--runtime-dir', sandboxRuntime, '--hermes-home', sandboxHermes, '--skills-dir', sandboxSkills],
    { encoding: 'utf8' }
  );
  assert.equal(res.status, 0, `install must succeed: ${res.stderr}`);

  // Backup must exist
  const backups = fs.readdirSync(sandboxHermes).filter(f => f.startsWith('hermes-terminal-init.sh.bak-'));
  assert.equal(backups.length, 1, 'backup of customized hermes-terminal-init.sh must exist');
  const backupContent = fs.readFileSync(path.join(sandboxHermes, backups[0]), 'utf8');
  assert.ok(backupContent.includes('export MY_VAR=1'), 'backup must contain previous user content');
});


