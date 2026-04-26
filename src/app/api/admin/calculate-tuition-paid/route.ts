import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rollNumber = searchParams.get('rollNumber');
        const yearOfFee = searchParams.get('yearOfFee');

        if (!rollNumber || !yearOfFee) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        const q = adminDb
            .collection('tuitionFeePayments')
            .where('rollNumber', '==', rollNumber.toUpperCase())
            .where('yearOfFee', '==', parseInt(yearOfFee))
            .where('status', '==', 'verified');

        const querySnapshot = await q.get();
        let totalPaid = 0;

        querySnapshot.forEach((doc: any) => {
            const data = doc.data();
            if (data.amount) {
                totalPaid += data.amount;
            }
        });

        let totalFeeAmount = 40500;
        const match = rollNumber.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/i);
        if (match) {
            const batch = match[1].toUpperCase();
            const rollUpper = rollNumber.toUpperCase();
            let courseType = 'BTech';
            if (rollUpper.includes('MTH')) {
                courseType = 'MTech';
            } else if (rollUpper.includes('CSE') || rollUpper.includes('ECE') || rollUpper.includes('AIML')) {
                courseType = 'BTech';
            }

            const classDoc = await adminDb.doc(`classes/${courseType}/batches/${batch}`).get();
            if (classDoc.exists) {
                const tuitionData = classDoc.data()?.tuitionFees || {};
                totalFeeAmount = tuitionData[`year${yearOfFee}`] || 40500;
            }
        }

        return NextResponse.json({
            success: true,
            paidAmount: totalPaid,
            totalFeeAmount,
        });

    } catch (error) {
        console.error('Error calculating tuition paid amount:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to calculate paid amount', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
