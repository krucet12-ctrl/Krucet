import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { id, collection: collectionName, status, rejectionReason, rejectionComment } = await req.json();

        console.log('Payment ID:', id, '| Collection:', collectionName, '| Status:', status);

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

        if (!adminDb) {
            return NextResponse.json(
                { success: false, error: 'Firebase Admin SDK not initialized. Check server environment variables.' },
                { status: 500 }
            );
        }

        const docRef = adminDb.collection(collectionName).doc(id);

        const updateData: Record<string, any> = {
            status: status,
            updatedAt: FieldValue.serverTimestamp(),
            reviewedAt: new Date().toISOString(),
        };

        if (status === 'rejected') {
            if (!rejectionReason) {
                return NextResponse.json(
                    { success: false, error: 'Rejection reason is required' },
                    { status: 400 }
                );
            }
            updateData.rejectionReason = rejectionReason;
            updateData.rejectionComment = rejectionComment || '';
        }

        await docRef.update(updateData);

        return NextResponse.json({
            success: true,
            message: 'Payment status updated successfully',
        });

    } catch (error: any) {
        console.error('Error updating payment status:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to update payment status' },
            { status: 500 }
        );
    }
}
