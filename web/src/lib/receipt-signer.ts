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
      const keypair = crypto.generateKeyPairSync('ed25519');
      privateKeyObj = keypair.privateKey;
      publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      signingMode = 'dev-local';
      keyId = 'gitspar-dev-local-fallback';
    }
  } else {
    const keypair = crypto.generateKeyPairSync('ed25519');
    privateKeyObj = keypair.privateKey;
    publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    signingMode = 'dev-local';
    const keyFingerprint = crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 12);
    keyId = `gitspar-dev-${keyFingerprint}`;
  }

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
// Backward Compatibility Layer: HMAC & CanonicalReceiptPayload
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
