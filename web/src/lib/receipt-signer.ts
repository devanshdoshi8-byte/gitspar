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
  // Deterministic canonical JSON serialization with sorted keys
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
