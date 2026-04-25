import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const { studentName, rollNumber, yearOfFee, amount, duNumber, paymentProofLink } = data;

        if (!studentName || !rollNumber || !yearOfFee || !amount || !duNumber || !paymentProofLink) {
            return NextResponse.json({ success: false, error: 'All fields are required' }, { status: 400 });
        }

        const rollNumberPattern = /^[YL]\d{2}[A-Z]{2,6}\d+$/i;
        if (!rollNumberPattern.test(rollNumber)) {
            return NextResponse.json(
                { success: false, error: 'Invalid roll number format (e.g., Y22CSE279063 or L21ECE180045)' },
                { status: 400 }
            );
        }

        // Check for duplicate DU Number using Admin SDK
        const duSnapshot = await adminDb
            .collection('tuitionFeePayments')
            .where('duNumber', '==', duNumber)
            .get();

        if (!duSnapshot.empty) {
            return NextResponse.json(
                { success: false, error: 'This DU Number has already been used for a payment submission' },
                { status: 400 }
            );
        }

        const paymentData = {
            studentName,
            rollNumber: rollNumber.toUpperCase(),
            yearOfFee: parseInt(yearOfFee),
            amount: parseFloat(amount),
            duNumber,
            paymentProofURL: paymentProofLink,
            paymentProofLink,
            uploadedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            status: 'pending',
        };

        const docRef = await adminDb.collection('tuitionFeePayments').add(paymentData);

        return NextResponse.json({
            success: true,
            message: 'Payment proof submitted successfully',
            documentId: docRef.id,
            fileUrl: paymentProofLink,
        });

    } catch (error) {
        console.error('Tuition fee submission error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to submit payment proof', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
