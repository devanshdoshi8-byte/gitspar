import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

// ============================================================================
// in-toto v1 Statement & DSSE Envelope Types
// ============================================================================

export interface InTotoSubject {
  name: string;
  digest: {
    sha256: string;
  };
}

export interface InTotoEdgeCaseRecord {
  probeId?: string;
  category: string;
  inputArgs: unknown[];
  expectedOutput: unknown;
  verdict: 'INTENDED' | 'DEFECT';
  explanation?: string;
}

export interface InTotoIntentPredicate {
  receiptId: string;
  functionName: string;
  targetFile: string;
  mode: 'intent_contract' | 'mutation_drill' | 'real_defect';
  riskScore: number;
  verifiedEdgeCases: InTotoEdgeCaseRecord[];
  timestamp: string;
  baseCommitSha?: string;
  workingDiffSha256: string;
  diagnosedLine?: number | null;
  repairedOperator?: string | null;
  explanation?: string;
  [key: string]: unknown;
}

export interface InTotoStatement<T = InTotoIntentPredicate> {
  _type: 'https://in-toto.io/Statement/v1';
  subject: InTotoSubject[];
  predicateType: 'https://gitspar.dev/attestation/intent-contract/v1';
  predicate: T;
}

export interface InTotoSignature {
  keyid: string;
  sig: string;
  mode: 'ci-signed' | 'dev-local';
  publicKey: string;
}

export interface InTotoEnvelope {
  payloadType: 'application/vnd.in-toto+json';
  payload: string; // Base64-encoded canonical JSON of InTotoStatement
  signatures: InTotoSignature[];
}

// Canonical JSON serializer with recursively sorted keys for deterministic hashing
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ':' + canonicalJsonStringify(val);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Creates an in-toto v1 Statement for an evaluated file or function.
 */
export function createInTotoStatement(params: {
  receiptId: string;
  targetFile: string;
  functionName: string;
  workingDiffSha256: string;
  mode?: 'intent_contract' | 'mutation_drill' | 'real_defect';
  riskScore?: number;
  verifiedEdgeCases?: InTotoEdgeCaseRecord[];
  baseCommitSha?: string;
  timestamp?: string;
  diagnosedLine?: number | null;
  repairedOperator?: string | null;
  explanation?: string;
}): InTotoStatement<InTotoIntentPredicate> {
  const timestamp = params.timestamp || new Date().toISOString();
  return {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [
      {
        name: params.targetFile,
        digest: {
          sha256: params.workingDiffSha256,
        },
      },
    ],
    predicateType: 'https://gitspar.dev/attestation/intent-contract/v1',
    predicate: {
      receiptId: params.receiptId,
      functionName: params.functionName,
      targetFile: params.targetFile,
      mode: params.mode || 'intent_contract',
      riskScore: typeof params.riskScore === 'number' ? params.riskScore : 50,
      verifiedEdgeCases: params.verifiedEdgeCases || [],
      timestamp,
      baseCommitSha: params.baseCommitSha || 'HEAD',
      workingDiffSha256: params.workingDiffSha256,
      diagnosedLine: params.diagnosedLine ?? null,
      repairedOperator: params.repairedOperator ?? null,
      explanation: params.explanation || '',
    },
  };
}

/**
 * Signs an in-toto Statement using Node's native Ed25519 keypair.
 * If GITSPAR_SIGNING_KEY env variable is present, uses CI key ("ci-signed").
 * Otherwise, generates an ephemeral local dev keypair ("dev-local").
 */
export function signAttestationEnvelope(
  statement: InTotoStatement,
  signingKeyInput?: string
): {
  envelope: InTotoEnvelope;
  publicKeyPem: string;
  signingMode: 'ci-signed' | 'dev-local';
} {
  const canonicalPayload = canonicalJsonStringify(statement);
  const payloadBase64 = Buffer.from(canonicalPayload, 'utf-8').toString('base64');
  const payloadBuffer = Buffer.from(payloadBase64, 'utf-8');

  let privateKeyObj: crypto.KeyObject;
  let publicKeyPem: string;
  let signingMode: 'ci-signed' | 'dev-local' = 'dev-local';
  let keyId = 'gitspar-dev-local-ephemeral';

  const envKey = signingKeyInput || process.env.GITSPAR_SIGNING_KEY;

  if (envKey && envKey.trim().length > 0) {
    signingMode = 'ci-signed';
    keyId = 'gitspar-ci-ed25519';
    try {
      privateKeyObj = crypto.createPrivateKey(envKey);
      const pubKey = crypto.createPublicKey(privateKeyObj);
      publicKeyPem = pubKey.export({ type: 'spki', format: 'pem' }).toString();
    } catch {
      // If parsing failed as PEM, fallback to ephemeral dev key
      const keypair = crypto.generateKeyPairSync('ed25519');
      privateKeyObj = keypair.privateKey;
      publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      signingMode = 'dev-local';
      keyId = 'gitspar-dev-local-fallback';
    }
  } else {
    // Generate ephemeral Ed25519 keypair for local dev
    const keypair = crypto.generateKeyPairSync('ed25519');
    privateKeyObj = keypair.privateKey;
    publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    signingMode = 'dev-local';
    const keyFingerprint = crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 12);
    keyId = `gitspar-dev-${keyFingerprint}`;
  }

  // Ed25519 signature over base64 payload bytes (standard DSSE format)
  const signatureBytes = crypto.sign(null, payloadBuffer, privateKeyObj);
  const signatureBase64 = signatureBytes.toString('base64');

  const envelope: InTotoEnvelope = {
    payloadType: 'application/vnd.in-toto+json',
    payload: payloadBase64,
    signatures: [
      {
        keyid: keyId,
        sig: signatureBase64,
        mode: signingMode,
        publicKey: publicKeyPem,
      },
    ],
  };

  return { envelope, publicKeyPem, signingMode };
}

/**
 * Cryptographically verifies an in-toto v1 Statement envelope signed with Ed25519.
 */
export function verifyReceipt(
  envelopeInput: unknown,
  publicKeyPemOverride?: string
): {
  valid: boolean;
  reason: string;
  statement?: InTotoStatement;
  signingMode?: 'ci-signed' | 'dev-local';
  keyId?: string;
} {
  if (!envelopeInput || typeof envelopeInput !== 'object') {
    return { valid: false, reason: 'Envelope must be a non-null object.' };
  }

  const envelope = envelopeInput as InTotoEnvelope;

  if (envelope.payloadType !== 'application/vnd.in-toto+json') {
    return { valid: false, reason: `Unsupported payloadType: '${envelope.payloadType}'. Expected 'application/vnd.in-toto+json'.` };
  }

  if (!envelope.payload || typeof envelope.payload !== 'string') {
    return { valid: false, reason: 'Envelope missing base64 payload string.' };
  }

  if (!Array.isArray(envelope.signatures) || envelope.signatures.length === 0) {
    return { valid: false, reason: 'Envelope has no cryptographic signatures.' };
  }

  // Decode statement
  let statement: InTotoStatement;
  try {
    const rawJson = Buffer.from(envelope.payload, 'base64').toString('utf-8');
    statement = JSON.parse(rawJson);
  } catch (err: unknown) {
    return { valid: false, reason: `Failed to decode payload base64: ${(err as Error).message}` };
  }

  if (statement._type !== 'https://in-toto.io/Statement/v1') {
    return { valid: false, reason: `Invalid statement _type: '${statement._type}'. Expected 'https://in-toto.io/Statement/v1'.` };
  }

  const payloadBuffer = Buffer.from(envelope.payload, 'utf-8');
  const sigEntry = envelope.signatures[0];

  const pubKeyPem = publicKeyPemOverride || sigEntry.publicKey;
  if (!pubKeyPem) {
    return { valid: false, reason: 'Missing public key for Ed25519 signature verification.' };
  }

  try {
    const pubKeyObj = crypto.createPublicKey(pubKeyPem);
    const signatureBuffer = Buffer.from(sigEntry.sig, 'base64');
    const isValid = crypto.verify(null, payloadBuffer, pubKeyObj, signatureBuffer);

    if (!isValid) {
      return {
        valid: false,
        reason: 'Cryptographic Ed25519 signature mismatch: envelope payload has been tampered with.',
        statement,
        signingMode: sigEntry.mode,
        keyId: sigEntry.keyid,
      };
    }

    return {
      valid: true,
      reason: `Valid Ed25519 in-toto v1 attestation signature (${sigEntry.mode}).`,
      statement,
      signingMode: sigEntry.mode,
      keyId: sigEntry.keyid,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      reason: `Ed25519 signature verification failed: ${(err as Error).message}`,
      statement,
    };
  }
}

// ============================================================================
// Backward Compatibility Layer: HMAC & Legacy AssessmentReceipt
// ============================================================================

export interface CanonicalReceiptPayload {
  receiptId: string;
  diffSha256: string;
  functionName: string;
  mode: string;
  score: number;
  verifiedAt: string;
}

export function serializeCanonicalPayload(payload: CanonicalReceiptPayload): string {
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
  transfer_check_input?: unknown[];
  transfer_check_expected?: unknown;
  transfer_check_user_answer?: string;
  transfer_check_passed?: boolean;
  agent_reasoning_trace?: string[];
  signature?: string;
  signature_mode?: 'production-hmac' | 'local-dev';
  canonical_payload?: string;
  in_toto_attestation?: InTotoEnvelope;
}

export function saveReceipt(
  receipt: AssessmentReceipt,
  outputDir: string = resolve(process.cwd(), '.gitspar')
): { jsonPath: string; markdownPath: string; attestationPath: string } {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = resolve(outputDir, 'receipt.json');
  const markdownPath = resolve(outputDir, 'PR_RECEIPT.md');
  const attestationPath = resolve(outputDir, 'attestation.json');

  // 1. Generate Ed25519 in-toto v1 Statement & Envelope
  const inTotoStatement = createInTotoStatement({
    receiptId: receipt.receipt_id || receipt.id || 'GS-0001',
    targetFile: receipt.target_file,
    functionName: receipt.function_name,
    workingDiffSha256: receipt.working_diff_sha256,
    mode: receipt.mode,
    riskScore: receipt.score ?? 100,
    baseCommitSha: receipt.base_commit_sha,
    timestamp: receipt.timestamp,
    diagnosedLine: receipt.diagnosed_line,
    repairedOperator: receipt.mutation_operator,
    explanation: receipt.explanation,
    verifiedEdgeCases: receipt.oracle_input
      ? [
          {
            category: 'boundary_threshold',
            inputArgs: receipt.oracle_input,
            expectedOutput: receipt.oracle_expected_output,
            verdict: 'INTENDED',
            explanation: receipt.explanation,
          },
        ]
      : [],
  });

  const signedAttestation = signAttestationEnvelope(inTotoStatement);
  receipt.in_toto_attestation = signedAttestation.envelope;

  // 2. Automatically sign HMAC for legacy compatibility
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

  // 3. Save receipt.json and attestation.json
  writeFileSync(jsonPath, JSON.stringify(receipt, null, 2), 'utf-8');
  writeFileSync(attestationPath, JSON.stringify(signedAttestation.envelope, null, 2), 'utf-8');

  // 4. Generate clean PR Markdown table
  const modeBadge =
    receipt.mode === 'mutation_drill'
      ? '`MODE A: mutation_drill` (Controlled Fault Diagnosis)'
      : '`MODE B: real_defect` (Genuine Defect Discovery)';

  const agentTraceSection =
    receipt.agent_reasoning_trace && receipt.agent_reasoning_trace.length > 0
      ? `
---

### Autonomous Agent Reasoning Trace

${receipt.agent_reasoning_trace.map((t) => `- \`${t}\``).join('\n')}
`
      : '';

  const transferSection =
    receipt.transfer_check_input !== undefined
      ? `
---

### Unseen Transfer Probe Assessment

| Metric | Probe Result |
| :--- | :--- |
| **Synthesized Unseen Input** | \`${JSON.stringify(receipt.transfer_check_input)}\` |
| **Ground-Truth Expected Output** | \`${JSON.stringify(receipt.transfer_check_expected)}\` |
| **Developer Answer** | \`${receipt.transfer_check_user_answer ?? 'N/A'}\` |
| **Transfer Check Status** | ${receipt.transfer_check_passed ? 'PASSED (Comprehension Generalizes)' : 'FAILED'} |
`
      : '';

  const markdownContent = `# GitSpar Verification Receipt

**Status:** VERIFIED CHANGE UNDERSTANDING
**Timestamp:** \`${receipt.timestamp}\`
**Assessment Mode:** ${modeBadge}
**In-Toto v1 Attestation:** \`${signedAttestation.envelope.signatures[0].keyid}\` (\`${signedAttestation.signingMode}\`)

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
| **In-Toto v1 Signature** | \`${signedAttestation.envelope.signatures[0].sig.slice(0, 32)}...\` (\`${signedAttestation.signingMode}\`) |

---

### Developer Diagnostic Explanation

> "${receipt.explanation}"
${transferSection}${agentTraceSection}
---
*Generated by [GitSpar v0.3.0](https://github.com/devanshdoshi8-byte/gitspar) — Local Verified Change Understanding Engine.*
`;

  writeFileSync(markdownPath, markdownContent, 'utf-8');

  return { jsonPath, markdownPath, attestationPath };
}
