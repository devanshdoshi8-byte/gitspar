import { NextResponse } from 'next/server';
import {
  verifyReceiptSignature,
  serializeCanonicalPayload,
  signReceiptPayload,
  CanonicalReceiptPayload,
  createInTotoStatement,
  signAttestationEnvelope,
  verifyReceipt,
  InTotoEnvelope,
} from '@/lib/receipt-signer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const envelope = body.envelope || body.in_toto_attestation || (body.payloadType === 'application/vnd.in-toto+json' ? body : null);

    // If request contains an in-toto v1 attestation envelope
    if (envelope && envelope.payloadType === 'application/vnd.in-toto+json') {
      const verification = verifyReceipt(envelope, body.publicKey);
      return NextResponse.json({
        valid: verification.valid,
        reason: verification.reason,
        statement: verification.statement,
        signingMode: verification.signingMode,
        keyId: verification.keyId,
        attestationType: 'https://in-toto.io/Statement/v1',
        checkedAt: new Date().toISOString(),
      });
    }

    const receipt = body.receipt || body;
    if (!receipt || typeof receipt !== 'object') {
      return NextResponse.json(
        { valid: false, reason: 'Invalid or missing receipt payload.' },
        { status: 400 }
      );
    }

    const targetFile = receipt.targetFile || receipt.target_file || receipt.filePath || 'src/index.ts';
    const functionName = receipt.functionName || receipt.function_name || receipt.assessedFunction || 'function';
    const diffSha256 = receipt.diffSha256 || receipt.working_diff_sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const receiptId = receipt.receiptId || receipt.receipt_id || receipt.id || 'GS-0000';
    const verifiedAt = receipt.verifiedAt || receipt.timestamp || new Date().toISOString();
    const riskScore = typeof receipt.score === 'number' ? receipt.score : (typeof receipt.riskScore === 'number' ? receipt.riskScore : 50);

    // Action: sign or create in-toto attestation
    if (body.action === 'sign' || (!receipt.signature && !receipt.in_toto_attestation)) {
      const statement = createInTotoStatement({
        receiptId,
        targetFile,
        functionName,
        workingDiffSha256: diffSha256,
        mode: receipt.mode || 'intent_contract',
        riskScore,
        timestamp: verifiedAt,
        verifiedEdgeCases: receipt.verifiedEdgeCases || [],
      });

      const attestation = signAttestationEnvelope(statement);

      const legacySigned = signReceiptPayload({
        receiptId,
        diffSha256,
        functionName,
        mode: receipt.mode || 'mutation_drill',
        score: riskScore,
        verifiedAt,
      });

      return NextResponse.json({
        valid: true,
        signed: true,
        reason: 'Signed in-toto v1 Statement and canonical receipt successfully.',
        envelope: attestation.envelope,
        signature: legacySigned.signature,
        signatureMode: legacySigned.signatureMode,
        signingMode: attestation.signingMode,
        canonicalPayload: legacySigned.canonicalPayload,
        receipt: {
          ...receipt,
          in_toto_attestation: attestation.envelope,
          signature: legacySigned.signature,
          signatureMode: legacySigned.signatureMode,
          canonicalPayload: legacySigned.canonicalPayload,
        },
        checkedAt: new Date().toISOString(),
      });
    }

    // If receipt contains embedded in_toto_attestation, verify it first
    if (receipt.in_toto_attestation) {
      const inTotoCheck = verifyReceipt(receipt.in_toto_attestation, body.publicKey);
      if (!inTotoCheck.valid) {
        return NextResponse.json({
          valid: false,
          reason: inTotoCheck.reason,
          signingMode: inTotoCheck.signingMode,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    // Verify HMAC signature
    const verification = verifyReceiptSignature(receipt);

    return NextResponse.json({
      valid: verification.valid,
      reason: verification.reason,
      signature: receipt.signature || null,
      signatureMode: receipt.signatureMode || receipt.signature_mode || 'local-dev',
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        valid: false,
        reason: `Verification server error: ${(err as Error).message}`,
      },
      { status: 500 }
    );
  }
}
