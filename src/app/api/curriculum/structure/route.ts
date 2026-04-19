import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, getDoc, collectionGroup, query } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export async function GET(req: NextRequest) {
    try {
        console.log('📡 [Structure API] Starting fetch...');

        // Step 1: Get all regulation documents
        const curriculumRef = collection(db, 'curriculum');
        const snapshot = await getDocs(curriculumRef);

        console.log(`📡 [Structure API] Found ${snapshot.docs.length} top-level documents`);

        if (snapshot.empty) {
            console.log('⚠️ [Structure API] No documents found in curriculum collection');
            return NextResponse.json({
                success: true,
                regulations: [],
                message: 'No curriculum data found'
            });
        }

        const regulationsMap = new Map<string, Set<string>>();

        // Step 2: For each regulation, find branches
        for (const regulationDoc of snapshot.docs) {
            const regulationCode = regulationDoc.id;

            // Skip metadata or system documents
            if (regulationCode.startsWith('_') || regulationCode.startsWith('.')) {
                console.log(`⏭️ [Structure API] Skipping system document: ${regulationCode}`);
                continue;
            }

            console.log(`🔍 [Structure API] Processing regulation: ${regulationCode}`);

            // Try to find branches by checking common branch names
            const commonBranches = ['CSE', 'ECE', 'AIML', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS'];
            const foundBranches = new Set<string>();

            // Check each branch for at least one semester
            for (const branchName of commonBranches) {
                // Just check SEM1 to see if this branch exists
                const sem1Ref = doc(db, 'curriculum', regulationCode, branchName, 'SEM1');
                const sem1Snap = await getDoc(sem1Ref);

                if (sem1Snap.exists()) {
                    console.log(`  ✅ Found branch: ${branchName}`);
                    foundBranches.add(branchName);
                }
            }

            if (foundBranches.size > 0) {
                regulationsMap.set(regulationCode, foundBranches);
                console.log(`  📊 ${regulationCode}: ${foundBranches.size} branches`);
            } else {
                console.log(`  ⚠️ ${regulationCode}: No branches found`);
            }
        }

        // Step 3: Convert to array format
        const regulations = Array.from(regulationsMap.entries()).map(([code, branchesSet]) => ({
            code,
            branches: Array.from(branchesSet).sort()
        }));

        console.log(`✅ [Structure API] Returning ${regulations.length} regulations`);
        console.log('📊 [Structure API] Final data:', JSON.stringify(regulations, null, 2));

        return NextResponse.json({
            success: true,
            regulations
        });

    } catch (error) {
        console.error('❌ [Structure API] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch curriculum structure',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
