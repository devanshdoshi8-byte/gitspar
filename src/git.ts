import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative, normalize } from 'node:path';

export interface RepoContext {
  baseCommitSha: string;
  workingDiffSha256: string;
  changedFiles: string[];
}

const EXCLUDED_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /[\\/]node_modules[\\/]/,
  /^[\\/]?node_modules[\\/]/,
  /[\\/]dist[\\/]/,
  /^[\\/]?dist[\\/]/,
  /[\\/]?src[\\/](?:cli|git|ast|runner|receipt)\.ts$/,
];

function isInternalOrTestFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return (
    EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    normalized.startsWith('.diffproof/') ||
    normalized.startsWith('.git/')
  );
}

function safeExec(command: string, cwd: string): string {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function getRepoContext(cwd: string = process.cwd()): RepoContext {
  let baseCommitSha = safeExec('git rev-parse HEAD', cwd);
  if (!baseCommitSha) {
    baseCommitSha = 'UNCOMMITTED_INIT';
  }

  // Tracked modifications
  let trackedDiffFilesRaw = '';
  if (baseCommitSha !== 'UNCOMMITTED_INIT') {
    trackedDiffFilesRaw = safeExec('git diff HEAD --name-only', cwd);
    // Also include cached/staged files if any
    const stagedFilesRaw = safeExec('git diff --cached --name-only', cwd);
    if (stagedFilesRaw) {
      trackedDiffFilesRaw = `${trackedDiffFilesRaw}\n${stagedFilesRaw}`.trim();
    }
  } else {
    // If no commits exist yet, get staged or diff relative to empty tree
    trackedDiffFilesRaw = safeExec('git diff --name-only', cwd);
  }

  // Untracked files
  const untrackedFilesRaw = safeExec('git ls-files --others --exclude-standard', cwd);

  const rawFileList = [
    ...trackedDiffFilesRaw.split(/\r?\n/).filter(Boolean),
    ...untrackedFilesRaw.split(/\r?\n/).filter(Boolean),
  ];

  const uniqueFiles = Array.from(new Set(rawFileList));
  const changedFiles = uniqueFiles
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => !isInternalOrTestFile(file))
    .map((file) => resolve(cwd, file));

  // Compute workingDiffSha256:
  // SHA-256 of git diff HEAD + contents of untracked target files
  const hasher = createHash('sha256');

  let rawDiff = '';
  if (baseCommitSha !== 'UNCOMMITTED_INIT') {
    rawDiff = safeExec('git diff HEAD', cwd);
  } else {
    rawDiff = safeExec('git diff', cwd);
  }
  hasher.update(rawDiff);

  // Untracked target files content
  const untrackedFiltered = untrackedFilesRaw
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => file.endsWith('.ts'))
    .filter((file) => !isInternalOrTestFile(file));

  untrackedFiltered.sort().forEach((file) => {
    const fullPath = resolve(cwd, file);
    if (existsSync(fullPath)) {
      hasher.update(`\n--- untracked: ${file} ---\n`);
      hasher.update(readFileSync(fullPath));
    }
  });

  const workingDiffSha256 = hasher.digest('hex');

  return {
    baseCommitSha,
    workingDiffSha256,
    changedFiles,
  };
}
