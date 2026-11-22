import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  createInTotoStatement,
  signAttestationEnvelope,
  verifyReceipt,
  canonicalJsonStringify,
  verifyReceiptSignature,
  signReceiptPayload,
} from '../src/receipt.js';

describe('Cryptographic in-toto v1 Attestation Envelope & Ed25519 Signing', () => {
  it('creates a standard in-toto v1 Statement structure with file digest and intent predicate', () => {
    const statement = createInTotoStatement({
      receiptId: 'GS-TEST-001',
      targetFile: 'src/billing/discount.ts',
      functionName: 'calculateTierDiscount',
      workingDiffSha256: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      riskScore: 75,
      mode: 'intent_contract',
      verifiedEdgeCases: [
        {
          category: 'boundary_threshold',
          inputArgs: [100, true],
          expectedOutput: 90,
          verdict: 'INTENDED',
          explanation: 'Tier discount active at >= 100 boundary',
        },
      ],
    });

    expect(statement._type).toBe('https://in-toto.io/Statement/v1');
    expect(statement.predicateType).toBe('https://gitspar.dev/attestation/intent-contract/v1');
    expect(statement.subject).toHaveLength(1);
    expect(statement.subject[0].name).toBe('src/billing/discount.ts');
    expect(statement.subject[0].digest.sha256).toBe(
      'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
    );
    expect(statement.predicate.receiptId).toBe('GS-TEST-001');
    expect(statement.predicate.riskScore).toBe(75);
    expect(statement.predicate.verifiedEdgeCases).toHaveLength(1);
    expect(statement.predicate.verifiedEdgeCases[0].verdict).toBe('INTENDED');
  });

  it('signs and verifies in-toto envelope with ephemeral Ed25519 keypair in dev-local mode', () => {
    delete process.env.GITSPAR_SIGNING_KEY;

    const statement = createInTotoStatement({
      receiptId: 'GS-DEV-001',
      targetFile: 'examples/checkoutDiscount.ts',
      functionName: 'calculateTierDiscount',
      workingDiffSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      riskScore: 80,
    });

    const { envelope, publicKeyPem, signingMode } = signAttestationEnvelope(statement);

    expect(envelope.payloadType).toBe('application/vnd.in-toto+json');
    expect(signingMode).toBe('dev-local');
    expect(envelope.signatures).toHaveLength(1);
    expect(envelope.signatures[0].mode).toBe('dev-local');
    expect(envelope.signatures[0].publicKey).toBe(publicKeyPem);

    const verification = verifyReceipt(envelope);
    expect(verification.valid).toBe(true);
    expect(verification.signingMode).toBe('dev-local');
    expect(verification.statement?._type).toBe('https://in-toto.io/Statement/v1');
    expect(verification.statement?.predicate.receiptId).toBe('GS-DEV-001');
  });

  it('signs and verifies in-toto envelope with explicit CI Ed25519 keypair in ci-signed mode', () => {
    const ciKeypair = crypto.generateKeyPairSync('ed25519');
    const privateKeyPem = ciKeypair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyPem = ciKeypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

    process.env.GITSPAR_SIGNING_KEY = privateKeyPem;

    const statement = createInTotoStatement({
      receiptId: 'GS-CI-999',
      targetFile: 'src/auth/session.ts',
      functionName: 'isSessionValid',
      workingDiffSha256: 'beefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      riskScore: 65,
    });

    const { envelope, signingMode } = signAttestationEnvelope(statement);

    expect(signingMode).toBe('ci-signed');
    expect(envelope.signatures[0].mode).toBe('ci-signed');

    const verification = verifyReceipt(envelope, publicKeyPem);
    expect(verification.valid).toBe(true);
    expect(verification.signingMode).toBe('ci-signed');
    expect(verification.reason).toContain('Valid Ed25519');

    delete process.env.GITSPAR_SIGNING_KEY;
  });

  it('detects tampering and rejects envelope when 1 byte of payload is modified', () => {
    const statement = createInTotoStatement({
      receiptId: 'GS-TAMPER-TEST',
      targetFile: 'src/vault.ts',
      functionName: 'transferFunds',
      workingDiffSha256: '1111222233334444555566667777888811112222333344445555666677778888',
      riskScore: 90,
    });

    const { envelope } = signAttestationEnvelope(statement);

    // Tamper with base64 payload by changing the decoded statement riskScore
    const decoded = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf-8'));
    decoded.predicate.riskScore = 10; // Modified from 90 to 10
    const tamperedPayload = Buffer.from(JSON.stringify(decoded), 'utf-8').toString('base64');

    const tamperedEnvelope = {
      ...envelope,
      payload: tamperedPayload,
    };

    const result = verifyReceipt(tamperedEnvelope);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Cryptographic Ed25519 signature mismatch');
  });

  it('maintains backward compatibility with HMAC legacy receipt verification', () => {
    const signed = signReceiptPayload({
      receiptId: 'GS-LEGACY-001',
      diffSha256: 'deadbeef',
      functionName: 'foo',
      mode: 'mutation_drill',
      score: 100,
      verifiedAt: '2026-11-23T00:00:00.000Z',
    });

    const legacyReceipt = {
      receiptId: 'GS-LEGACY-001',
      diffSha256: 'deadbeef',
      functionName: 'foo',
      mode: 'mutation_drill',
      score: 100,
      verifiedAt: '2026-11-23T00:00:00.000Z',
      signature: signed.signature,
      signatureMode: signed.signatureMode,
      canonicalPayload: signed.canonicalPayload,
    };

    const validCheck = verifyReceiptSignature(legacyReceipt);
    expect(validCheck.valid).toBe(true);

    // Tampered legacy receipt
    const tamperedCheck = verifyReceiptSignature({
      ...legacyReceipt,
      score: 50,
    });
    expect(tamperedCheck.valid).toBe(false);
  });
});
