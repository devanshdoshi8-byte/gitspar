import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

export interface CanonicalReceiptPayload {
  receiptId: string;
  diffSha256: string;
  functionName: string;
  mode: string;
  score: number;
  verifiedAt: string;
}

export function serializeCanonicalPayload(payload: CanonicalReceiptPayload): string {
  // Deterministic canonical JSON with sorted keys
  return JSON.stringify({
    diffSha256: String(payload.diffSha256 || ''),
    functionName: String(payload.functionName || ''),
    mode: String(payload.mode || ''),
    receiptId: String(payload.receiptId || ''),
    score: Number(payload.score ?? 100),
    verifiedAt: String(payload.verifiedAt || ''),
  });
}

export function signReceiptPayload(
  payload: CanonicalReceiptPayload,
  secret?: string
): { signature: string; signatureMode: 'production-hmac' | 'local-dev'; canonicalPayload: string } {
  const envSecret = secret || process.env.GITSPAR_SIGNING_SECRET;
  const signatureMode: 'production-hmac' | 'local-dev' = process.env.GITSPAR_SIGNING_SECRET ? 'production-hmac' : 'local-dev';
  const activeSecret = envSecret || 'gitspar_local_dev_secret_key_insecure_fallback';

  const canonicalPayload = serializeCanonicalPayload(payload);
  const hmac = crypto.createHmac('sha256', activeSecret);
  hmac.update(canonicalPayload);
  const signature = hmac.digest('hex');

  return {
    signature,
    signatureMode,
    canonicalPayload,
  };
}

export function verifyReceiptSignature(
  receipt: any,
  secret?: string
): { valid: boolean; reason: string } {
  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, reason: 'Receipt is not an object.' };
  }

  const signature = receipt.signature;
  if (!signature || typeof signature !== 'string') {
    return { valid: false, reason: 'Receipt is missing cryptographic signature.' };
  }

  // Extract canonical fields
  const payload: CanonicalReceiptPayload = {
    receiptId: receipt.receiptId || receipt.receipt_id || receipt.id || '',
    diffSha256: receipt.diffSha256 || receipt.working_diff_sha256 || '',
    functionName: receipt.functionName || receipt.function_name || '',
    mode: receipt.mode || '',
    score: typeof receipt.score === 'number' ? receipt.score : 100,
    verifiedAt: receipt.verifiedAt || receipt.timestamp || '',
  };

  const expectedCanonical = serializeCanonicalPayload(payload);

  if (receipt.canonicalPayload && receipt.canonicalPayload !== expectedCanonical) {
    return {
      valid: false,
      reason: 'Payload tampering detected: canonical payload does not match receipt properties.',
    };
  }

  const envSecret = secret || process.env.GITSPAR_SIGNING_SECRET;
  const activeSecret = envSecret || 'gitspar_local_dev_secret_key_insecure_fallback';

  const hmac = crypto.createHmac('sha256', activeSecret);
  hmac.update(expectedCanonical);
  const expectedSig = hmac.digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        reason: 'Cryptographic signature mismatch: receipt payload has been tampered with.',
      };
    }
  } catch (err: unknown) {
    return {
      valid: false,
      reason: `Signature verification error: ${(err as Error).message}`,
    };
  }

  return { valid: true, reason: 'Valid cryptographic HMAC signature.' };
}

export interface AssessmentReceipt {
  id?: string;
  receipt_id?: string;
  timestamp: string;
  base_commit_sha: string;
  working_diff_sha256: string;
  mode: 'mutation_drill' | 'real_defect';
  language: 'typescript';
  target_file: string;
  function_name: string;
  oracle_source: 'user_specified_blind_assertion';
  oracle_input: unknown[];
  oracle_expected_output: unknown;
  mutation_operator: string | null;
  baseline_test: 'passed' | 'failed';
  mutation_test: 'failed' | 'not_applicable';
  repair_test: 'passed';
  diagnosed_line: number;
  explanation: string;
  score?: number;
  // Multi-step agentic verification extensions
  transfer_check_input?: unknown[];
  transfer_check_expected?: unknown;
  transfer_check_user_answer?: string;
  transfer_check_passed?: boolean;
  agent_reasoning_trace?: string[];
  // Cryptographic signature & tamper evidence
  signature?: string;
  signature_mode?: 'production-hmac' | 'local-dev';
  canonical_payload?: string;
}

export function saveReceipt(
  receipt: AssessmentReceipt,
  outputDir: string = resolve(process.cwd(), '.gitspar')
): { jsonPath: string; markdownPath: string } {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = resolve(outputDir, 'receipt.json');
  const markdownPath = resolve(outputDir, 'PR_RECEIPT.md');

  // Automatically sign if signature is not yet attached
  if (!receipt.signature) {
    const signed = signReceiptPayload({
      receiptId: receipt.receipt_id || receipt.id || 'GS-0001',
      diffSha256: receipt.working_diff_sha256,
      functionName: receipt.function_name,
      mode: receipt.mode,
      score: receipt.score ?? 100,
      verifiedAt: receipt.timestamp,
    });
    receipt.id = receipt.id || receipt.receipt_id || 'GS-0001';
    receipt.signature = signed.signature;
    receipt.signature_mode = signed.signatureMode;
    receipt.canonical_payload = signed.canonicalPayload;
  }

  // 1. Save receipt.json
  writeFileSync(jsonPath, JSON.stringify(receipt, null, 2), 'utf-8');

  // 2. Generate clean PR Markdown table
  const modeBadge =
    receipt.mode === 'mutation_drill'
      ? '`MODE A: mutation_drill` (Controlled Fault Diagnosis)'
      : '`MODE B: real_defect` (Genuine Defect Discovery)';

  const agentTraceSection =
    receipt.agent_reasoning_trace && receipt.agent_reasoning_trace.length > 0
      ? `
---

### 🤖 Autonomous Agent Reasoning Trace

${receipt.agent_reasoning_trace.map((t) => `- \`${t}\``).join('\n')}
`
      : '';

  const transferSection =
    receipt.transfer_check_input !== undefined
      ? `
---

### 🔮 Unseen Transfer Probe Assessment

| Metric | Probe Result |
| :--- | :--- |
| **Synthesized Unseen Input** | \`${JSON.stringify(receipt.transfer_check_input)}\` |
| **Ground-Truth Expected Output** | \`${JSON.stringify(receipt.transfer_check_expected)}\` |
| **Developer Answer** | \`${receipt.transfer_check_user_answer ?? 'N/A'}\` |
| **Transfer Check Status** | ${receipt.transfer_check_passed ? '✅ **PASSED (Comprehension Generalizes)**' : '⚠️ **FAILED**'} |
`
      : '';

  const markdownContent = `# 🛡️ GitSpar Verification Receipt

**Status:** ✅ **VERIFIED CHANGE UNDERSTANDING**  
**Timestamp:** \`${receipt.timestamp}\`  
**Assessment Mode:** ${modeBadge}

---

### Verification Summary

| Metric | Verification Record |
| :--- | :--- |
| **Base Commit SHA** | \`${receipt.base_commit_sha}\` |
| **Working Diff SHA-256** | \`${receipt.working_diff_sha256}\` |
| **Language** | \`${receipt.language}\` |
| **Target Source File** | \`${receipt.target_file}\` |
| **Verified Function** | \`${receipt.function_name}\` |
| **Oracle Source** | \`${receipt.oracle_source}\` |
| **Oracle Input Arguments** | \`${JSON.stringify(receipt.oracle_input)}\` |
| **Oracle Expected Output** | \`${JSON.stringify(receipt.oracle_expected_output)}\` |
| **Mutation Operator** | \`${receipt.mutation_operator ?? 'N/A (Real Defect)'}\` |
| **Baseline Oracle Test** | \`${receipt.baseline_test}\` |
| **Mutant Killing Test** | \`${receipt.mutation_test}\` |
| **Final / Repair Test** | \`${receipt.repair_test}\` |
| **Diagnosed Defect Line** | \`Line ${receipt.diagnosed_line}\` |
| **HMAC Signature** | \`${receipt.signature || 'N/A'}\` (\`${receipt.signature_mode || 'local-dev'}\`) |

---

### 🧠 Developer Diagnostic Explanation

> "${receipt.explanation}"
${transferSection}${agentTraceSection}
---
*Generated by [GitSpar v0.3.0](https://github.com/devanshdoshi8-byte/gitspar) — Local Verified Change Understanding Engine.*
`;

  writeFileSync(markdownPath, markdownContent, 'utf-8');

  return { jsonPath, markdownPath };
}
