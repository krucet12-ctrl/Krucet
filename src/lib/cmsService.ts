import { db } from './firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    writeBatch,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';

export interface UniversityInfo {
    universityName: string;
    collegeName: string;
    address: string;
    description: string;
    about: string;
    students: string;
    departments: string;
    years: string;
    placement: string;
}

export interface Official {
    id?: string;
    name: string;
    title: string;
    photo: string;
    order?: number;
}


export interface DepartmentDetails {
    id: string; // e.g., 'cse'
    name: string;
    shortName: string;
    icon: string;
    color: string;
    duration: string;
    intake: string;
    programType: 'UG' | 'PG';
    about: string;
    vision: string;
    mission: string;
}

export interface FacultyMember {
    id?: string;
    name: string;
    designation: string;
    departmentId?: string; // Legacy support
    departments?: string[]; // Multiple departments support
    order?: number;
    createdAt?: any;
    updatedAt?: any;
}

// Collections
const UNIV_INFO_COL_NAME = 'university';
const OFFICIALS_COL_NAME = 'officials';
const DEPTS_COL_NAME = 'departments';
const FACULTY_COL_NAME = 'facultyMembers';

// --- Cache System ---
interface CacheData {
    universityInfo: { data: UniversityInfo | null; timestamp: number } | null;
    officials: { data: Official[]; timestamp: number } | null;
    departments: { data: DepartmentDetails[]; timestamp: number } | null;
    facultyMembers: { data: FacultyMember[]; timestamp: number } | null;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const cache: CacheData = {
    universityInfo: null,
    officials: null,
    departments: null,
    facultyMembers: null,
};

export const clearCache = (key?: keyof CacheData) => {
    if (key) {
        cache[key] = null;
    } else {
        cache.universityInfo = null;
        cache.officials = null;
        cache.departments = null;
        cache.facultyMembers = null;
    }
};

const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < CACHE_DURATION;
};

// --- University Info ---
export const getUniversityInfo = async (): Promise<UniversityInfo | null> => {
    if (cache.universityInfo && isCacheValid(cache.universityInfo.timestamp)) {
        return cache.universityInfo.data;
    }

    const docRef = doc(db, UNIV_INFO_COL_NAME, 'info');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? (snap.data() as UniversityInfo) : null;

    cache.universityInfo = { data, timestamp: Date.now() };
    return data;
};

export const updateUniversityInfo = async (data: Partial<UniversityInfo>) => {
    const docRef = doc(db, UNIV_INFO_COL_NAME, 'info');
    await setDoc(docRef, data, { merge: true });
    clearCache('universityInfo');
};

// --- Officials ---
export const getOfficials = async (): Promise<Official[]> => {
    if (cache.officials && isCacheValid(cache.officials.timestamp)) {
        return cache.officials.data;
    }

    const colRef = collection(db, OFFICIALS_COL_NAME);
    const snap = await getDocs(colRef);
    const officials = snap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data
        } as Official;
    });
    const sorted = officials.sort((a, b) => (a.order || 0) - (b.order || 0));

    cache.officials = { data: sorted, timestamp: Date.now() };
    return sorted;
};

export const addOfficial = async (data: Omit<Official, 'id'>): Promise<string> => {
    const colRef = collection(db, OFFICIALS_COL_NAME);
    const docRef = await addDoc(colRef, data);
    clearCache('officials');
    return docRef.id;
};

export const updateOfficial = async (id: string, data: Partial<Official>) => {
    const docRef = doc(db, OFFICIALS_COL_NAME, id);
    await updateDoc(docRef, data);
    clearCache('officials');
};

export const deleteOfficial = async (id: string) => {
    const docRef = doc(db, OFFICIALS_COL_NAME, id);
    await deleteDoc(docRef);
    clearCache('officials');
};

export const updateOfficialsOrder = async (updates: { id: string, order: number }[]) => {
    const batch = writeBatch(db);
    updates.forEach(({ id, order }) => {
        const docRef = doc(db, OFFICIALS_COL_NAME, id);
        batch.update(docRef, { order });
    });
    await batch.commit();
    clearCache('officials');
};

// --- Departments ---
export const getDepartments = async (): Promise<DepartmentDetails[]> => {
    if (cache.departments && isCacheValid(cache.departments.timestamp)) {
        return cache.departments.data;
    }

    const colRef = collection(db, DEPTS_COL_NAME);
    const snap = await getDocs(colRef);
    const deps = snap.docs.map(d => ({ id: d.id, ...d.data() } as DepartmentDetails));

    cache.departments = { data: deps, timestamp: Date.now() };
    return deps;
};

export const getDepartmentById = async (id: string): Promise<DepartmentDetails | null> => {
    // If we have the full list cached, fetch from there to save a query
    if (cache.departments && isCacheValid(cache.departments.timestamp)) {
        const found = cache.departments.data.find(d => d.id === id);
        if (found) return found;
    }

    const docRef = doc(db, DEPTS_COL_NAME, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as DepartmentDetails;
    return null;
};

export const updateDepartment = async (id: string, data: Partial<DepartmentDetails>) => {
    const docRef = doc(db, DEPTS_COL_NAME, id);
    await setDoc(docRef, data, { merge: true }); // allow creating if not exists during migration
    clearCache('departments');
};

export const deleteDepartment = async (id: string) => {
    const docRef = doc(db, DEPTS_COL_NAME, id);
    await deleteDoc(docRef);
    clearCache('departments');
};

// --- Faculty ---
export const getFacultyMembers = async (departmentId?: string): Promise<FacultyMember[]> => {
    let allFaculty: FacultyMember[] = [];

    if (cache.facultyMembers && isCacheValid(cache.facultyMembers.timestamp)) {
        allFaculty = cache.facultyMembers.data;
    } else {
        const colRef = collection(db, FACULTY_COL_NAME);
        const q = query(colRef, orderBy("order", "asc"));
        const snap = await getDocs(q);
        allFaculty = snap.docs.map(d => ({ id: d.id, ...d.data() } as FacultyMember));
        cache.facultyMembers = { data: allFaculty, timestamp: Date.now() };
    }

    if (departmentId) {
        allFaculty = allFaculty.filter(f =>
            f.departmentId === departmentId ||
            (f.departments && f.departments.includes(departmentId))
        );
    }
    return allFaculty;
};

export const addFacultyMember = async (data: Omit<FacultyMember, 'id'>) => {
    const colRef = collection(db, FACULTY_COL_NAME);
    const facultyData = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        order: data.order || 999
    };
    await addDoc(colRef, facultyData);
    clearCache('facultyMembers');
};

export const updateFacultyMember = async (id: string, data: Partial<FacultyMember>) => {
    const docRef = doc(db, FACULTY_COL_NAME, id);
    const updateData = {
        ...data,
        updatedAt: serverTimestamp()
    };
    await updateDoc(docRef, updateData);
    clearCache('facultyMembers');
};

export const deleteFacultyMember = async (id: string) => {
    const docRef = doc(db, FACULTY_COL_NAME, id);
    await deleteDoc(docRef);
    clearCache('facultyMembers');
};

export const updateFacultyOrder = async (updates: { id: string, order: number }[]) => {
    const batch = writeBatch(db);
    updates.forEach(({ id, order }) => {
        const docRef = doc(db, FACULTY_COL_NAME, id);
        batch.update(docRef, { order });
    });
    await batch.commit();
    clearCache('facultyMembers');
};

