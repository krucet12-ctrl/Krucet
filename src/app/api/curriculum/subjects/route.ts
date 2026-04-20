import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const regulation = searchParams.get('regulation');
        const branch = searchParams.get('branch');
        const semester = searchParams.get('semester');

        if (!regulation || !branch || !semester) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required parameters: regulation, branch, semester'
                },
                { status: 400 }
            );
        }

        const semesterRef = doc(db, 'curriculum', regulation, branch, semester);
        const semesterSnap = await getDoc(semesterRef);

        if (!semesterSnap.exists()) {
            return NextResponse.json({
                success: true,
                subjects: [],
                exists: false
            });
        }

        const data = semesterSnap.data();
        const subjects = data.Subjects || [];

        return NextResponse.json({
            success: true,
            subjects,
            exists: true
        });

    } catch (error) {
        console.error('Error fetching curriculum subjects:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch curriculum subjects',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
