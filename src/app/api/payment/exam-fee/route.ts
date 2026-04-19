import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export async function POST(req: NextRequest) {
    try {
        console.log('📤 [Exam Fee] Received submission request');

        const data = await req.json();
        const { studentName, rollNumber, semester, feeType, duNumber, paymentProofLink } = data;

        // Validation - Required fields
        if (!studentName || !rollNumber || !semester || !feeType || !duNumber || !paymentProofLink) {
            console.log('❌ [Exam Fee] Missing required fields');
            return NextResponse.json(
                { success: false, error: 'All fields are required' },
                { status: 400 }
            );
        }

        // Validation - Roll number format
        const rollNumberPattern = /^[YL]\d{2}[A-Z]{2,6}\d+$/i;
        if (!rollNumberPattern.test(rollNumber)) {
            console.log('❌ [Exam Fee] Invalid roll number format:', rollNumber);
            return NextResponse.json(
                { success: false, error: 'Invalid roll number format (e.g., Y22CSE279063 or L21ECE180045)' },
                { status: 400 }
            );
        }

        // Check DU Number uniqueness in examFees collection
        console.log('🔍 [Exam Fee] Checking DU Number uniqueness:', duNumber);
        const duQuery = query(
            collection(db, 'examFees'),
            where('duNumber', '==', duNumber)
        );
        const duSnapshot = await getDocs(duQuery);

        if (!duSnapshot.empty) {
            console.log('❌ [Exam Fee] DU Number already exists');
            return NextResponse.json(
                { success: false, error: 'This DU Number has already been used for an exam fee submission' },
                { status: 400 }
            );
        }

        console.log('📤 [Exam Fee] Saving submission');

        // Save to Firestore
        const paymentData = {
            studentName,
            rollNumber: rollNumber.toUpperCase(),
            semester: parseInt(semester),
            feeType,
            duNumber,
            paymentProofURL: paymentProofLink,
            uploadedAt: serverTimestamp(),
            status: 'pending', // Can be: pending, verified, rejected
        };

        const docRef = await addDoc(collection(db, 'examFees'), paymentData);
        console.log('✅ [Exam Fee] Data saved to Firestore:', docRef.id);

        return NextResponse.json({
            success: true,
            message: 'Exam fee payment proof submitted successfully',
            documentId: docRef.id,
            fileUrl: paymentProofLink,
        });

    } catch (error) {
        console.error('❌ [Exam Fee] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to submit exam fee payment proof',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
