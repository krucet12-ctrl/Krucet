import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

// Helper to convert Firestore timestamp to date string
const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    // Handle Firestore Timestamp
    if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toISOString();
    }
    // Handle standard Date object or string
    return new Date(timestamp).toISOString();
};

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const type = searchParams.get('type') || 'all';
        const status = searchParams.get('status') || 'all';
        const search = searchParams.get('search') || '';
        const semester = searchParams.get('semester');
        const year = searchParams.get('year');

        // Limits for pagination (simple implementation for now)
        const limitCount = parseInt(searchParams.get('limit') || '50');

        let allPayments: any[] = [];

        // 1. Fetch Tuition Fees
        if (type === 'all' || type === 'tuition') {
            let q = collection(db, 'tuitionFeePayments');
            let constraints: any[] = [];

            if (status !== 'all') {
                constraints.push(where('status', '==', status));
            }

            if (year) {
                constraints.push(where('yearOfFee', '==', parseInt(year)));
            }

            // If search is provided, we can't easily do partial matches in Firestore without external services (like Algolia).
            // We will fetch all and filter in memory if a search term is present, 
            // or if the dataset is small enough. For a production app, use a proper search engine.
            // Here we'll rely on client-side filtering or exact matches if possible.
            // However, usually we can search by exact Roll Number or DU Number.
            if (search) {
                // Tricky to do OR query across fields.
                // We'll fetch more data and filter in memory for this demo.
                // Or strict equality check if it looks like a Roll No or DU No.
            }

            // Remove orderBy and limit to avoid composite index requirements on dynamic filters.
            // Sorting will happen in-memory.

            const querySnapshot = await getDocs(query(q, ...constraints));

            const tuitionPayments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                category: 'Tuition Fee',
                uploadedAt: formatDate(doc.data().uploadedAt),
                collection: 'tuitionFeePayments'
            }));

            allPayments = [...allPayments, ...tuitionPayments];
        }

        // 2. Fetch Exam Fees
        if (type === 'all' || type.startsWith('exam')) {
            let q = collection(db, 'examFees');
            let constraints: any[] = [];

            if (status !== 'all') {
                constraints.push(where('status', '==', status));
            }

            if (semester) {
                constraints.push(where('semester', '==', parseInt(semester)));
            }

            // Filter by specific exam fee type if requested
            if (type !== 'all' && type !== 'exam') {
                const feeTypeMap: { [key: string]: string } = {
                    'exam-regular': 'Regular Fee',
                    'exam-supply': 'Supply Fee',
                    'exam-revaluation': 'Revaluation Fee',
                    'exam-special': 'Special Fee'
                };
                if (feeTypeMap[type]) {
                    constraints.push(where('feeType', '==', feeTypeMap[type]));
                }
            }

            // Remove orderBy and limit to avoid composite index requirements on dynamic filters.

            const querySnapshot = await getDocs(query(q, ...constraints));

            const examPayments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                category: `Exam Fee - ${doc.data().feeType || 'General'}`,
                uploadedAt: formatDate(doc.data().uploadedAt),
                collection: 'examFees'
            }));

            allPayments = [...allPayments, ...examPayments];
        }

        // 3. In-memory Search Filtering
        // Firestore lacks native full-text search, so we filter the fetched results.
        if (search) {
            const searchLower = search.toLowerCase();
            allPayments = allPayments.filter(payment => {
                return (
                    (payment.rollNumber && payment.rollNumber.toLowerCase().includes(searchLower)) ||
                    (payment.duNumber && payment.duNumber.toLowerCase().includes(searchLower)) ||
                    (payment.studentName && payment.studentName.toLowerCase().includes(searchLower))
                );
            });
        }

        // 4. Sort Combined Results
        allPayments.sort((a, b) => {
            return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        });

        // 4.5. Apply Limit In-Memory
        allPayments = allPayments.slice(0, limitCount);

        // 5. Apply Stats Aggregation (Naive implementation based on fetched data - ideally should be separate count queries)
        // For a robust system, we would run separate count queries. Here we'll return counts of the fetched dataset for immediate feedback.
        const stats = {
            total: allPayments.length,
            pending: allPayments.filter(p => p.status === 'pending').length,
            verified: allPayments.filter(p => p.status === 'verified').length,
            rejected: allPayments.filter(p => p.status === 'rejected').length
        };

        return NextResponse.json({
            success: true,
            data: allPayments,
            stats
        });

    } catch (error) {
        console.error('Error fetching payments:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch payments' },
            { status: 500 }
        );
    }
}
