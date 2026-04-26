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

        const match = rollNumber.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/i);
        if (!match) {
            return NextResponse.json({ success: false, error: 'Invalid roll number format' }, { status: 400 });
        }
        const batch = match[1].toUpperCase();
        const rollUpper = rollNumber.toUpperCase();
        let courseType = 'BTech';
        if (rollUpper.includes('MTH')) {
            courseType = 'MTech';
        } else if (rollUpper.includes('CSE') || rollUpper.includes('ECE') || rollUpper.includes('AIML')) {
            courseType = 'BTech';
        }

        // Fetch tuition fees for the year from class document
        const classDoc = await adminDb.doc(`classes/${courseType}/batches/${batch}`).get();
        if (!classDoc.exists) {
            return NextResponse.json({ success: false, error: 'Class data not found for the student' }, { status: 404 });
        }

        const classData = classDoc.data();
        const tuitionData = classData?.tuitionFees || {};
        const totalFeeForYear = tuitionData[`year${yearOfFee}`];
        if (!totalFeeForYear) {
            return NextResponse.json({ success: false, error: `Tuition fee not set for year ${yearOfFee}` }, { status: 400 });
        }

        // Calculate due amount
        const paymentsSnapshot = await adminDb
            .collection('tuitionFeePayments')
            .where('rollNumber', '==', rollNumber)
            .where('yearOfFee', '==', yearOfFee)
            .get();

        const totalPaid = paymentsSnapshot.docs.reduce((sum: number, doc: any) => sum + doc.data().amount, 0);
        const dueAmount = totalFeeForYear - totalPaid - parseFloat(amount);

        if (dueAmount < 0) {
            return NextResponse.json({ success: false, error: 'Overpayment detected' }, { status: 400 });
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
            dueAmount,
        });

    } catch (error) {
        console.error('Tuition fee submission error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to submit payment proof', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
