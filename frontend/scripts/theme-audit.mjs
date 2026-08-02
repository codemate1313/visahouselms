import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', 'src');
const strict = process.argv.includes('--strict');
const extensions = new Set(['.tsx', '.ts']);

const legacyThemeValues = [
  '#ffffff',
  '#fff',
  '#f8fafc',
  '#f1f5f9',
  '#f5f5f7',
  '#e2e8f0',
  '#cbd5e1',
  '#0f172a',
  '#111827',
  '#334155',
  '#64748b',
  '#475569',
  '#94a3b8',
  'rgb(255, 255, 255)',
  'rgb(248, 250, 252)',
  'rgb(241, 245, 249)',
  'rgb(226, 232, 240)',
  'rgb(203, 213, 225)',
  'rgb(15, 23, 42)',
  'rgb(17, 24, 39)',
  'rgb(100, 116, 139)',
  'rgb(71, 85, 105)',
  'rgb(148, 163, 184)',
  'var(--white)',
  'var(--slate-50)',
  'var(--slate-100)',
  'var(--slate-200)',
  'var(--slate-300)',
  'var(--slate-400)',
  'var(--slate-500)',
  'var(--slate-700)',
  'var(--slate-900)',
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }
    if (extensions.has(path.extname(entry.name))) {
      return [fullPath];
    }
    return [];
  }));
  return nested.flat();
}

function isInlineStyleLine(line) {
  return line.includes('style={{') || line.includes('style: {');
}

function shouldReport(line) {
  if (!isInlineStyleLine(line)) {
    return false;
  }
  const normalized = line
    .replace(/color:\s*["']var\(--white\)["']/g, '')
    .replace(/var\(--(?:text|text-primary|text-secondary|text-muted|surface|surface-muted|surface-subtle|border|border-color|border-subtle)[^)]*\)/g, '');
  return legacyThemeValues.some((value) => normalized.includes(value));
}

const files = (await listFiles(root))
  .map((file) => path.relative(root, file))
  .sort();

const findings = [];

for (const relativeFile of files) {
  const absoluteFile = path.join(root, relativeFile);
  const source = await readFile(absoluteFile, 'utf8');
  source.split('\n').forEach((line, index) => {
    if (shouldReport(line)) {
      findings.push({
        file: relativeFile,
        line: index + 1,
        text: line.trim().slice(0, 160),
      });
    }
  });
}

if (!findings.length) {
  console.log('No legacy hardcoded inline theme values found.');
  process.exit(0);
}

const byFile = new Map();
for (const finding of findings) {
  byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1);
}

console.log(`Found ${findings.length} legacy inline theme references in ${byFile.size} files.`);
console.log('Top files:');
[...byFile.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 20)
  .forEach(([file, count]) => {
    console.log(`  ${count.toString().padStart(3, ' ')}  ${file}`);
  });

console.log('\nSample references:');
findings.slice(0, 30).forEach((finding) => {
  console.log(`  ${finding.file}:${finding.line}  ${finding.text}`);
});

if (strict) {
  process.exitCode = 1;
}
