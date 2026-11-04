import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface GitSparConfig {
  baseBranch?: string;
  targetFiles?: string[];
  requiredMode?: 'mutation_drill' | 'real_defect';
  minExplanationLength?: number;
}

export function loadGitSparConfig(cwd: string = process.cwd()): GitSparConfig | null {
  const configPath = resolve(cwd, '.gitspar/config.json');
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as GitSparConfig;
    } catch {
      return null;
    }
  }
  return null;
}
