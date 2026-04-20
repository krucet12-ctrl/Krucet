import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { id, collection: collectionName, status, rejectionReason, rejectionComment } = await req.json();

        if (!id || !collectionName || !status) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (!['tuitionFeePayments', 'examFees'].includes(collectionName)) {
            return NextResponse.json(
                { success: false, error: 'Invalid collection name' },
                { status: 400 }
            );
        }

        if (!['pending', 'verified', 'rejected'].includes(status)) {
            return NextResponse.json(
                { success: false, error: 'Invalid status' },
                { status: 400 }
            );
        }

        const docRef = doc(db, collectionName, id);

        const updateData: any = {
            status: status,
            reviewedAt: new Date().toISOString()
        };

        if (status === 'rejected') {
            updateData.rejectionReason = rejectionReason || '';
            updateData.rejectionComment = rejectionComment || '';
        }

        await updateDoc(docRef, updateData);

        return NextResponse.json({
            success: true,
            message: 'Payment status updated successfully'
        });

    } catch (error) {
        console.error('Error updating payment status:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update payment status' },
            { status: 500 }
        );
    }
}
