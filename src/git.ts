import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export interface RepoContext {
  baseCommitSha: string;
  workingDiffSha256: string;
  changedFiles: string[];
}

export interface RepoContextOptions {
  baseRef?: string;
  ciMode?: boolean;
  targetFile?: string;
}

const EXCLUDED_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /[\\/]node_modules[\\/]/,
  /^[\\/]?node_modules[\\/]/,
  /[\\/]dist[\\/]/,
  /^[\\/]?dist[\\/]/,
  /[\\/]?test[\\/]/,
  /[\\/]?src[\\/](?:cli|git|ast|runner|receipt|config)\.ts$/,
];

export function isInternalOrTestFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return (
    EXCLUDED_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    normalized.startsWith('.gitspar/') ||
    normalized.startsWith('.git/') ||
    normalized.startsWith('.github/')
  );
}

export function safeExec(command: string, cwd: string): string {
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

export function refExists(ref: string, cwd: string = process.cwd()): boolean {
  return Boolean(safeExec(`git rev-parse --verify ${ref}`, cwd));
}

export function resolveBaseRef(cwd: string = process.cwd(), overrideRef?: string): string {
  if (overrideRef && refExists(overrideRef, cwd)) {
    return overrideRef;
  }
  if (process.env.GITSPAR_BASE_REF && refExists(process.env.GITSPAR_BASE_REF, cwd)) {
    return process.env.GITSPAR_BASE_REF;
  }
  if (process.env.GITHUB_BASE_REF) {
    const originRef = `origin/${process.env.GITHUB_BASE_REF}`;
    if (refExists(originRef, cwd)) return originRef;
    if (refExists(process.env.GITHUB_BASE_REF, cwd)) return process.env.GITHUB_BASE_REF;
  }
  const candidates = ['origin/main', 'origin/master', 'main', 'master', 'HEAD~1'];
  for (const candidate of candidates) {
    if (refExists(candidate, cwd)) {
      return candidate;
    }
  }
  return 'HEAD';
}

export function computeDiffHashForTarget(
  cwd: string,
  targetFile: string,
  baseRef: string = 'HEAD'
): string {
  const hasher = createHash('sha256');
  const normalizedTarget = relative(cwd, resolve(cwd, targetFile)).replace(/\\/g, '/');

  let rawDiff = '';
  if (baseRef && baseRef !== 'HEAD' && refExists(baseRef, cwd)) {
    rawDiff = safeExec(`git diff ${baseRef}...HEAD -- "${normalizedTarget}"`, cwd);
    if (!rawDiff) {
      rawDiff = safeExec(`git diff ${baseRef} -- "${normalizedTarget}"`, cwd);
    }
  } else {
    rawDiff = safeExec(`git diff HEAD -- "${normalizedTarget}"`, cwd);
  }

  hasher.update(rawDiff);

  // If file is untracked
  const untrackedRaw = safeExec(`git ls-files --others --exclude-standard -- "${normalizedTarget}"`, cwd);
  if (untrackedRaw) {
    const fullPath = resolve(cwd, normalizedTarget);
    if (existsSync(fullPath)) {
      hasher.update(`\n--- untracked: ${normalizedTarget} ---\n`);
      hasher.update(readFileSync(fullPath));
    }
  }

  return hasher.digest('hex');
}

export function computeDiffHashForRef(cwd: string, diffTarget: string, targetFile?: string): string {
  const hasher = createHash('sha256');
  const pathFilter = targetFile
    ? `-- "${relative(cwd, resolve(cwd, targetFile)).replace(/\\/g, '/')}"`
    : '-- . ":!.gitspar" ":!test" ":!src" ":!package.json" ":!package-lock.json" ":!README.md" ":!.github"';

  const rawDiff = safeExec(`git diff ${diffTarget} ${pathFilter}`, cwd);
  hasher.update(rawDiff);
  return hasher.digest('hex');
}

export function getRepoContext(
  cwd: string = process.cwd(),
  options: RepoContextOptions = {}
): RepoContext {
  let baseCommitSha = safeExec('git rev-parse HEAD', cwd);
  if (!baseCommitSha) {
    baseCommitSha = 'UNCOMMITTED_INIT';
  }

  let trackedDiffFilesRaw = '';
  let diffBase = 'HEAD';

  if (options.ciMode) {
    const baseRef = options.baseRef || resolveBaseRef(cwd);
    diffBase = baseRef !== 'HEAD' ? `${baseRef}...HEAD` : 'HEAD';
    trackedDiffFilesRaw = safeExec(`git diff ${diffBase} --name-only`, cwd);
  } else {
    if (baseCommitSha !== 'UNCOMMITTED_INIT') {
      trackedDiffFilesRaw = safeExec('git diff HEAD --name-only', cwd);
      const stagedFilesRaw = safeExec('git diff --cached --name-only', cwd);
      if (stagedFilesRaw) {
        trackedDiffFilesRaw = `${trackedDiffFilesRaw}\n${stagedFilesRaw}`.trim();
      }
    } else {
      trackedDiffFilesRaw = safeExec('git diff --name-only', cwd);
    }
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

  // Determine pathspec for diff hashing
  let pathFilter = '';
  if (options.targetFile) {
    pathFilter = `-- "${relative(cwd, resolve(cwd, options.targetFile)).replace(/\\/g, '/')}"`;
  } else if (changedFiles.length > 0) {
    const relFiles = changedFiles.map((f) => `"${relative(cwd, f).replace(/\\/g, '/')}"`);
    pathFilter = `-- ${relFiles.join(' ')}`;
  } else {
    pathFilter = '-- . ":!.gitspar" ":!test" ":!src" ":!package.json" ":!package-lock.json" ":!README.md" ":!.github"';
  }

  let rawDiff = '';
  if (baseCommitSha !== 'UNCOMMITTED_INIT') {
    rawDiff = safeExec(`git diff ${diffBase} ${pathFilter}`, cwd);
  } else {
    rawDiff = safeExec(`git diff ${pathFilter}`, cwd);
  }

  const hasher = createHash('sha256');
  hasher.update(rawDiff);

  // Untracked target files content
  if (!options.ciMode) {
    const untrackedFiltered = untrackedFilesRaw
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => !isInternalOrTestFile(file))
      .filter((file) => {
        if (!options.targetFile) return true;
        return resolve(cwd, file) === resolve(cwd, options.targetFile);
      });

    untrackedFiltered.sort().forEach((file) => {
      const fullPath = resolve(cwd, file);
      if (existsSync(fullPath)) {
        hasher.update(`\n--- untracked: ${file} ---\n`);
        hasher.update(readFileSync(fullPath));
      }
    });
  }

  const workingDiffSha256 = hasher.digest('hex');

  return {
    baseCommitSha,
    workingDiffSha256,
    changedFiles,
  };
}
