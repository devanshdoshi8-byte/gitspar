import { NextResponse } from 'next/server';
import {
  verifyReceiptSignature,
  serializeCanonicalPayload,
  signReceiptPayload,
  CanonicalReceiptPayload,
} from '@/lib/receipt-signer';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const receipt = body.receipt || body;

    if (!receipt || typeof receipt !== 'object') {
      return NextResponse.json(
        { valid: false, reason: 'Invalid or missing receipt payload.' },
        { status: 400 }
      );
    }

    const payload: CanonicalReceiptPayload = {
      receiptId: receipt.receiptId || receipt.receipt_id || receipt.id || 'GS-0000',
      diffSha256: receipt.diffSha256 || receipt.working_diff_sha256 || '',
      functionName: receipt.functionName || receipt.function_name || '',
      mode: receipt.mode || 'mutation_drill',
      score: typeof receipt.score === 'number' ? receipt.score : 100,
      verifiedAt: receipt.verifiedAt || receipt.timestamp || new Date().toISOString(),
    };

    if (body.action === 'sign' || !receipt.signature) {
      const signed = signReceiptPayload(payload);
      return NextResponse.json({
        valid: true,
        signed: true,
        reason: 'Signed canonical receipt successfully.',
        signature: signed.signature,
        signatureMode: signed.signatureMode,
        canonicalPayload: signed.canonicalPayload,
        receipt: {
          ...receipt,
          signature: signed.signature,
          signatureMode: signed.signatureMode,
          canonicalPayload: signed.canonicalPayload,
        },
        checkedAt: new Date().toISOString(),
      });
    }

    const verification = verifyReceiptSignature(receipt);

    return NextResponse.json({
      valid: verification.valid,
      reason: verification.reason,
      signature: receipt.signature || null,
      signatureMode: receipt.signatureMode || receipt.signature_mode || 'local-dev',
      canonicalPayload: serializeCanonicalPayload(payload),
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

