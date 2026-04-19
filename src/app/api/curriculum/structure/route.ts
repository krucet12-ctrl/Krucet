import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export async function GET(req: NextRequest) {
    try {
        const curriculumRef = collection(db, 'curriculum');
        const snapshot = await getDocs(curriculumRef);

        if (snapshot.empty) {
            return NextResponse.json({ success: true, regulations: [], message: 'No curriculum data found' });
        }

        const regulationsMap = new Map<string, Set<string>>();

        for (const regulationDoc of snapshot.docs) {
            const regulationCode = regulationDoc.id;

            if (regulationCode.startsWith('_') || regulationCode.startsWith('.')) continue;

            const commonBranches = ['CSE', 'ECE', 'AIML', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS'];
            const foundBranches = new Set<string>();

            for (const branchName of commonBranches) {
                const sem1Ref = doc(db, 'curriculum', regulationCode, branchName, 'SEM1');
                const sem1Snap = await getDoc(sem1Ref);
                if (sem1Snap.exists()) foundBranches.add(branchName);
            }

            if (foundBranches.size > 0) {
                regulationsMap.set(regulationCode, foundBranches);
            }
        }

        const regulations = Array.from(regulationsMap.entries()).map(([code, branchesSet]) => ({
            code,
            branches: Array.from(branchesSet).sort()
        }));

        return NextResponse.json({ success: true, regulations });

    } catch (error) {
        console.error('Curriculum structure API error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch curriculum structure', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
