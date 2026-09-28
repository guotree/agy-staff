#!/usr/bin/env node
/**
 * scripts/generate-hermes-skills.mjs
 *
 * Generates Hermes Agent skills (agentskills.io standard) from canonical skills/.
 * Supports category-based namespacing, agentskills.io YAML frontmatter,
 * and cross-platform companion invocation paths.
 *
 * No external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
export const COMPATIBILITY_CONTEXT = fs.readFileSync(
  new URL('../templates/harness-compatibility.md', import.meta.url),
  'utf8'
);

const SKILL_METADATA = {
  ask: {
    tags: ['agy', 'gemini', 'q-and-a', 'smoke-test', 'delegation'],
    shortDesc: "Ask Google's Antigravity CLI (agy, fast Gemini) a cheap one-shot question.",
  },
  implementer: {
    tags: ['agy', 'gemini', 'coding', 'implementation', 'bug-fix', 'git'],
    shortDesc: 'Delegate coding tasks to Antigravity CLI (agy, fast Gemini) with direct edits.',
  },
  jobs: {
    tags: ['agy', 'gemini', 'jobs', 'background-tasks', 'process-management'],
    shortDesc: 'Manage agy background jobs: collect results, status, wait, cancel, and follow-up.',
  },
  lead: {
    tags: ['agy', 'gemini', 'orchestration', 'task-lead', 'coordination'],
    shortDesc: 'Orchestrate ongoing tasks with AGY while the host agent owns decisions.',
  },
  researcher: {
    tags: ['agy', 'gemini', 'research', 'survey', 'deep-dive', 'codebase-analysis'],
    shortDesc: 'Deep research or codebase survey via Antigravity CLI (agy, fast Gemini).',
  },
  reviewer: {
    tags: ['agy', 'gemini', 'code-review', 'design-review', 'second-opinion'],
    shortDesc: 'Second-opinion review (diff, PR, plan, design) via Antigravity CLI (agy).',
  },
  staffer: {
    tags: ['agy', 'gemini', 'general-purpose', 'delegation', 'image-generation'],
    shortDesc: 'General-purpose task delegation to Antigravity CLI (agy, fast Gemini).',
  },
};

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  if (fs.lstatSync(dir).isSymbolicLink()) throw new Error(`Do not generate through symlinks: ${dir}`);
  return fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const target = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Do not generate through symlinks: ${target}`);
      return entry.isDirectory() ? filesUnder(target) : [target];
    });
}

export function hermesFiles(root = ROOT) {
  const source = path.join(root, 'skills');
  const names = fs.readdirSync(source)
    .filter(name => fs.existsSync(path.join(source, name, 'SKILL.md')))
    .sort();
  const outputs = new Map();

  for (const name of names) {
    const prefixedName = `agy-${name}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || prefixedName.length > 64) {
      throw new Error(`Invalid skill name: ${prefixedName}`);
    }

    const meta = SKILL_METADATA[name] || {
      tags: ['agy', 'gemini', 'delegation'],
      shortDesc: `Antigravity CLI ${name} skill`,
    };

    for (const file of filesUnder(path.join(source, name))) {
      let content = fs.readFileSync(file);
      if (file.endsWith('.md')) {
        content = content.toString('utf8');

        // 1. Standardize companion invocation with configurable runtime ($AGY_STAFF_HOME) and cross-platform safe fallback
        content = content.replace(
          /node "<skill-dir>\/\.\.\/\.\.\/companion\/agy-companion\.mjs"/g,
          'node "${AGY_STAFF_HOME:-${USERPROFILE:-$HOME}/.agy-staff}/companion/agy-companion.mjs"'
        );

        // 2. Standardize locating instructions across all skills (before <plugin-root>/skills path rewrites)
        content = content.replace(
          /This skill file lives at `<plugin-root>\/skills\/[^`]+`; resolve the companion path relative to this skill directory:/g,
          'The agy-staff companion runtime is located at `${AGY_STAFF_HOME:-~/.agy-staff}/companion/agy-companion.mjs`. Run via the `terminal` tool:'
        );
        content = content.replace(
          /This file lives at `<plugin-root>\/skills\/jobs\/SKILL\.md`:/g,
          'The agy-staff companion runtime is located at `${AGY_STAFF_HOME:-~/.agy-staff}/companion/agy-companion.mjs`. Run via the `terminal` tool:'
        );
        content = content.replace(
          /This skill lives at `<plugin-root>\/skills\/lead\/SKILL\.md`\. Write the brief to a temporary file and call the shared companion:/g,
          'Write the brief to a temporary file and call the shared companion via the `terminal` tool:'
        );

        // 2b. Add Hermes terminal invocation and timeout guidance
        const hermesGuidance = [
          '> - **Hermes `terminal` guidance**: Run as a standard foreground command (`background: false`, `pty: false`).',
          '> - If passing the `timeout` parameter to Hermes\'s `terminal` tool, specify it in **seconds** (e.g. `timeout: 120` for 2 minutes). **Never use milliseconds** (such as `120000`), which exceeds Hermes\'s 600s foreground limit and causes forced background demotion.',
        ].join('\n');

        content = content.replace(
          /> Run this command \*\*unsandboxed\*\* — agy needs a localhost port and its OAuth token file, which harness sandboxes hide\.(?: In Codex, request escalated permissions for the command\.)?(?: Details: `\.\.\/jobs\/references\/troubleshooting\.md`\.)?(.*)/g,
          `> - Run this command **unsandboxed** — agy needs a localhost port and its OAuth token file, which harness sandboxes hide. Details: \`../agy-jobs/references/troubleshooting.md\`.$1\n${hermesGuidance}`
        );

        content = content.replace(
          /(```bash\r?\nnode "[^"]+" <command> \[args\]\r?\n```)/g,
          `$1\n\n> [!IMPORTANT]\n${hermesGuidance}`
        );

        content = content.replace(
          /(```bash\r?\nnode "[^"]+" staffer --prompt-file "<brief-path>"\r?\n```)/g,
          `$1\n\n> [!IMPORTANT]\n${hermesGuidance}`
        );

        // 3. Rewrites for cross-skill links and paths
        for (const peer of names) {
          content = content
            .replace(new RegExp(`(?:/agy:|\\$agy:)${peer}(?![a-z0-9-])`, 'g'), `/skill agy-${peer}`)
            .replaceAll(`../${peer}/`, `../agy-${peer}/`)
            .replaceAll(`<plugin-root>/skills/${peer}/`, `<plugin-root>/hermes-skills/agy-${peer}/`);
        }

        const canonicalRel = path.relative(root, file).split(path.sep).join('/');
        const notice = `<!-- Generated from ${canonicalRel}; run npm run generate:hermes. Do not edit here. -->`;
        const match = /^---\n([\s\S]*?)\n---\n/.exec(content);

        if (path.basename(file) === 'SKILL.md') {
          if (!match || !match[1].split('\n').includes(`name: ${name}`)) {
            throw new Error(`Expected name: ${name} in ${file}`);
          }

          // Extract original description if available, preserving detailed explanations
          const descMatch = /^description:\s*([^\n]+)/m.exec(match[1]);
          const fullDesc = descMatch ? descMatch[1].trim() : meta.shortDesc;

          const frontmatterLines = [
            `name: ${prefixedName}`,
            `description: ${JSON.stringify(fullDesc)}`,
            `version: 0.7.3`,
            `author: agy-staff`,
            `license: MIT`,
            `platforms: [linux, macos, windows]`,
            `metadata:`,
            `  hermes:`,
            `    tags: [${meta.tags.join(', ')}]`,
          ];

          content = `---\n${frontmatterLines.join('\n')}\n---\n\n${notice}\n`
            + content.slice(match[0].length) + '\n' + COMPATIBILITY_CONTEXT;
        } else if (match) {
          content = `---\n${match[1]}\n---\n\n${notice}\n` + content.slice(match[0].length);
        } else {
          content = `${notice}\n\n${content}`;
        }
        content = Buffer.from(content);
      }
      outputs.set(path.join('hermes-skills', prefixedName, path.relative(path.join(source, name), file)), content);
    }
  }
  return outputs;
}

export function generateHermesSkills({ root = ROOT, check = false } = {}) {
  const expected = hermesFiles(root);
  const targetDir = path.join(root, 'hermes-skills');
  const actual = filesUnder(targetDir);
  const unexpected = actual.filter(file => !expected.has(path.relative(root, file)));
  if (unexpected.length) {
    throw new Error(`Unexpected generated files; inspect and remove explicitly:\n${unexpected.join('\n')}`);
  }
  const changed = [];
  for (const [relative, content] of expected) {
    const target = path.join(root, relative);
    if (fs.existsSync(target) && fs.readFileSync(target).equals(content)) continue;
    changed.push(relative);
    if (!check) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
  if (check && changed.length) {
    throw new Error(
      `Stale Hermes skills; edit canonical sources in skills/ and run npm run generate:hermes:\n${changed.join('\n')}`
    );
  }
  return { count: expected.size, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check')) {
      throw new Error('Usage: generate-hermes-skills.mjs [--check]');
    }
    const check = process.argv.includes('--check');
    const result = generateHermesSkills({ check });
    console.log(
      `Hermes skills ${check ? 'verified' : 'generated'}: ${result.count} files (${result.changed.length} changed).`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
