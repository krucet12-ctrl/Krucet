import { NextRequest, NextResponse } from 'next/server';
import { addOrUpdateCurriculum } from '@/lib/firebaseService';
import type { CurriculumSubject } from '@/lib/types';
import { safeTrim } from '@/lib/utils';

// Request body interface for type safety
interface UpdateCurriculumRequest {
    regulation: string;
    branch: string;
    semester: string;
    subjects: CurriculumSubject[];
}

// Validation helper functions
function isValidString(value: unknown): value is string {
    return typeof value === 'string' && safeTrim(value).length > 0;
}

function isValidSubject(subject: unknown): subject is CurriculumSubject {
    if (!subject || typeof subject !== 'object') return false;

    const s = subject as Partial<CurriculumSubject>;

    return (
        isValidString(s.subject_code) &&
        typeof s.credits === 'number' &&
        s.credits >= 0 &&
        typeof s.max_marks === 'number' &&
        s.max_marks > 0
    );
}

function validateRequestBody(body: unknown): {
    valid: boolean;
    data?: UpdateCurriculumRequest;
    error?: string
} {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Invalid request body' };
    }

    const { regulation, branch, semester, subjects } = body as Partial<UpdateCurriculumRequest>;

    // Validate required string fields
    if (!isValidString(regulation)) {
        return { valid: false, error: 'Invalid or missing regulation' };
    }
    if (!isValidString(branch)) {
        return { valid: false, error: 'Invalid or missing branch' };
    }
    if (!isValidString(semester)) {
        return { valid: false, error: 'Invalid or missing semester' };
    }

    // Validate subjects array
    if (!Array.isArray(subjects)) {
        return { valid: false, error: 'Subjects must be an array' };
    }
    if (subjects.length === 0) {
        return { valid: false, error: 'At least one subject is required' };
    }

    // Validate each subject
    const invalidSubjectIndex = subjects.findIndex(s => !isValidSubject(s));
    if (invalidSubjectIndex !== -1) {
        return {
            valid: false,
            error: `Invalid subject at index ${invalidSubjectIndex}. Each subject must have subject_code (string), credits (number >= 0), and max_marks (number > 0)`
        };
    }

    // Check for duplicate subject codes
    const subjectCodes = subjects.map(s => s.subject_code);
    const duplicates = subjectCodes.filter((code, index) => subjectCodes.indexOf(code) !== index);
    if (duplicates.length > 0) {
        return {
            valid: false,
            error: `Duplicate subject codes found: ${duplicates.join(', ')}`
        };
    }

    return {
        valid: true,
        data: { regulation, branch, semester, subjects }
    };
}

/**
 * POST /api/curriculum/update
 * Updates or creates curriculum data for a specific regulation, branch, and semester
 * 
 * @param req - NextRequest containing curriculum data
 * @returns NextResponse with success/error status
 */
export async function POST(req: NextRequest) {
    try {
        // Parse request body
        const body = await req.json();

        // Validate request body
        const validation = validateRequestBody(body);
        if (!validation.valid || !validation.data) {
            return NextResponse.json(
                { success: false, error: validation.error },
                { status: 400 }
            );
        }

        const { regulation, branch, semester, subjects } = validation.data;

        // Update Firestore
        await addOrUpdateCurriculum(
            safeTrim(regulation),
            safeTrim(branch),
            safeTrim(semester),
            subjects
        );

        return NextResponse.json(
            {
                success: true,
                message: 'Curriculum updated successfully',
                data: {
                    regulation,
                    branch,
                    semester,
                    subjectCount: subjects.length
                }
            },
            { status: 200 }
        );

    } catch (error) {
        // Log error server-side for debugging
        console.error('[API Error] /api/curriculum/update:', error);

        // Determine error type and response
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON in request body' },
                { status: 400 }
            );
        }

        // Generic error response (don't expose internal details to client)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update curriculum. Please try again later.'
            },
            { status: 500 }
        );
    }
}
