'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    UniversityInfo, Official, DepartmentDetails, FacultyMember,
    getUniversityInfo, updateUniversityInfo,
    getOfficials, addOfficial, updateOfficial, deleteOfficial, updateOfficialsOrder,
    getDepartments, updateDepartment, deleteDepartment,
    getFacultyMembers, addFacultyMember, updateFacultyMember, deleteFacultyMember, updateFacultyOrder
} from '@/lib/cmsService';
import { auth, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const MIGRATION_DATA = {
    university: {
        name: "Krishna University College of Engineering and Technology",
        description: "The Krishna University College of Engineering and Technology was established during the academic year 2016-17. This college is located at Rudravaram Campus of Machilipatnam. The University Engineering College offers 4-year B.Tech., programmes in Computer Science & Engineering (CSE) with an intake of 120 students, Electronics and Communication Engineering (ECE) with an intake of 60 students and Artificial Intelligence & Machine Learning (AI & ML) with an intake of 60 students.\nThe admissions into these programmes are based on marks/ranks in EAPCET/ECET conducted by the Government of Andhra Pradesh.\nThe Engineering college also offers 2-year M.Tech. programme in Computer Science & Engineering with an intake of 18 students.",
        about: "KRUCET at a Glance: Leading engineering education in Andhra Pradesh.",
        vision: "To be a premier center of excellence for technical education, fostering innovation and leadership in engineering and technology to serve society globally.",
        mission: "To impart quality technical education, promote research culture, and develop competent professionals with strong ethical values, critical thinking, and a lifelong commitment to societal betterment."
    },
    officials: [
        { title: 'Vice-Chancellor', name: 'Prof. Ramji Koona', photo: '/leadership/vicechancellor.jpg' },
        { title: 'Rector', name: 'Prof. M.V. Basaveswara Rao', photo: '/leadership/rector.jpg' },
        { title: 'Registrar', name: 'Prof. N. Usha', photo: '/leadership/registrar.jpg' },
        { title: 'Principal of KRUCET', name: 'Dr.Vijayakumari Rodda', photo: '/leadership/principal.jpg' },
        { title: 'Dean faculty of Engineering', name: 'Prof. YK. Sundara Krishna', photo: '/leadership/dean.jpg' }
    ],
    departments: [
        {
            id: 'cse', name: 'Computer Science and Engineering', shortName: 'CSE', icon: 'cpu', color: 'from-blue-600 to-blue-700', programType: 'UG', duration: '4 Years', intake: '120 Seats',
            about: 'Computer Science and Engineering Department was established in the academic year 2017-18 with an intake of 30 seats and later intake was increased to 60 seats in the academic year 2018-19. Our Department has well qualified and experienced faculty and excellent computing facilities are available in the Department. We are committed to adopt the state of art in Computer Science and Engineering and more instrumental in training the students in the recent emerging areas like Big Data, Cloud Computing, Digital Marketing and Mobile Applications. Our objective is to provide better career opportunities and make them industry ready professionals.',
            vision: 'To ensure academic excellence and advanced research in computer science and engineering discipline.',
            mission: 'To create a transformative educational experience for students focused on deep disciplinary knowledge, problem solving, leadership, communications and interpersonal skills and personal health and well-being.'
        },
        {
            id: 'cse-aiml', name: 'Computer Science and Engineering (AI & ML)', shortName: 'CSE (AI & ML)', icon: 'brain', color: 'from-purple-600 to-purple-700', programType: 'UG', duration: '4 Years', intake: '60 Seats',
            about: 'The CSE (AI & ML) program focuses on artificial intelligence and machine learning technologies, preparing students for the future of computing with cutting-edge curriculum and hands-on experience in AI/ML applications. Our department is equipped with state-of-the-art laboratories and experienced faculty members who are experts in machine learning, deep learning, computer vision, and natural language processing.',
            vision: 'To be a leading center of excellence in Artificial Intelligence and Machine Learning education, fostering innovation and producing industry-ready professionals.',
            mission: 'To provide comprehensive education in AI and ML technologies through practical learning, industry collaboration, and research-oriented curriculum.'
        },
        {
            id: 'ece', name: 'Electronics and Communication Engineering', shortName: 'ECE', icon: 'zap', color: 'from-orange-600 to-orange-700', programType: 'UG', duration: '4 Years', intake: '60 Seats',
            about: 'Electronics and Communication Engineering Department was established in the academic year 2017-18 with an intake of 30 seats and later intake was increased to 60 seats in the academic year 2018-19. Our Department has well qualified and experienced faculty who conducts different activities for the students. We also conduct workshops on new technologies for the benefit of students. We encourage students to participate in different events such as paper presentations, poster presentations, and in cultural activities conducted by other colleges.',
            vision: 'To produce globally competitive and socially sensitized engineering graduates and to bring out quality research in the frontier areas of Electronics & Communication Engineering.',
            mission: 'To provide quality and contemporary education in the domain of Electronics & Communication Engineering through periodically updated curriculum, best of laboratory facilities, collaborative ventures with the industries and effective teaching learning process. To pursue research and new technologies in Electronics & Communication Engineering and related disciplines in order to serve the needs of the society, industry, government and scientific community.'
        },
        {
            id: 'mtech-cse', name: 'Master of Technology in Computer Science and Engineering', shortName: 'M.Tech CSE', icon: 'graduation-cap', color: 'from-green-600 to-green-700', programType: 'PG', duration: '2 Years', intake: '18 Seats',
            about: 'Advanced postgraduate program in Computer Science and Engineering with specialization in emerging technologies. The program is designed to provide in-depth knowledge and research opportunities in cutting-edge areas of computer science.',
            vision: 'To be a premier center for advanced research and education in computer science and engineering.',
            mission: 'To provide advanced education and research opportunities in computer science, fostering innovation and producing research-oriented professionals.'
        },
        {
            id: 'hns', name: 'Humanities and Sciences', shortName: 'H&S', icon: 'book-open', color: 'from-yellow-600 to-yellow-700', programType: 'UG', duration: '4 Years', intake: '60 Seats',
            about: 'The Humanities and Sciences Department provides foundational courses in Mathematics, Physics, Chemistry, English, and Mechanical Engineering, supporting all engineering branches with experienced faculty and modern labs.',
            vision: 'To impart strong foundational knowledge in basic sciences and humanities to nurture competent engineers and responsible citizens.',
            mission: 'To provide quality education in sciences and humanities, fostering analytical, communication, and ethical skills essential for engineering careers.'
        }
    ],
    faculty: {
        'cse': [
            { name: 'Dr.Vijayakumari Rodda', designation: 'Principal & Head of the Department' },
            { name: 'Dr. M. Raghava Naidu', designation: 'Assistant Professor' },
            { name: 'Dr. V Sujay', designation: 'Assistant Professor' },
            { name: 'M. VNSSRK Sai Somayajulu', designation: 'Assistant Professor & Co-ordinator of the Department' },
            { name: 'P. Bhavani Shankar', designation: 'Assistant Professor' },
            { name: 'Dr. Md. Ali Mirza', designation: 'Assistant Professor' },
            { name: 'N. Rangasree', designation: 'Assistant Professor' }
        ],
        'cse-aiml': [
            { name: 'Dr.Vijayakumari Rodda', designation: 'Principal & Head of the Department' },
            { name: 'Dr. M. Raghava Naidu', designation: 'Assistant Professor' },
            { name: 'Dr. V Sujay', designation: 'Assistant Professor' },
            { name: 'M. VNSSRK Sai Somayajulu', designation: 'Assistant Professor & Co-ordinator of the Department' },
            { name: 'P. Bhavani Shankar', designation: 'Assistant Professor' },
            { name: 'Dr. Md. Ali Mirza', designation: 'Assistant Professor' },
            { name: 'N. Rangasree', designation: 'Assistant Professor' }
        ],
        'ece': [
            { name: 'Prof. YK. Sundara Krishna', designation: 'Professor & Head of the Department' },
            { name: 'S Rajeev', designation: 'Assistant Professor & Co-ordinator of the Department' },
            { name: 'Ch.Vijaya Sekhar Babu', designation: 'Assistant Professor' },
            { name: 'K. Roja Mani', designation: 'Assistant Professor' },
            { name: 'M. Balaji Naik', designation: 'Assistant Professor' },
            { name: 'R. Durga Prasad', designation: 'Assistant Professor' },
            { name: 'K.G. Venkata Krishna', designation: 'Assistant Professor' },
            { name: 'K.Kavitha', designation: 'Assistant Professor of EEE' }
        ],
        'mtech-cse': [
            { name: 'Dr.Vijayakumari Rodda', designation: 'Principal & Head of the Department' },
            { name: 'Dr. M. Raghava Naidu', designation: 'Assistant Professor' },
            { name: 'Dr. V Sujay', designation: 'Assistant Professor' },
            { name: 'M. VNSSRK Sai Somayajulu', designation: 'Assistant Professor & Co-ordinator of the Department' },
            { name: 'P. Bhavani Shankar', designation: 'Assistant Professor' },
            { name: 'Dr. Md. Ali Mirza', designation: 'Assistant Professor' },
            { name: 'N. Rangasree', designation: 'Assistant Professor' }
        ],
        'hns': [
            { name: 'K. Subba Rayudu ', designation: 'Assistant Professor of English' },
            { name: 'V V N Sivanjaneyulu Gatte ', designation: 'Assistant Professor of Mechanical Engineering' },
            { name: 'K. Abida Begum ', designation: 'Assistant Professor of Mathematics' },
            { name: 'Edukondala Naik ', designation: 'Assistant Professor of Mathematics' },
            { name: 'Salma Begum ', designation: 'Assistant Professor of Physics' },
            { name: 'SeshaReddy ', designation: 'Assistant Professor of Physics' }
        ]
    }
};

export default function UniversityContentAdmin() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'info' | 'officials' | 'departments' | 'faculty'>('info');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // States
    const [univInfo, setUnivInfo] = useState<UniversityInfo | null>(null);
    const [officials, setOfficials] = useState<Official[]>([]);
    const [departments, setDepartments] = useState<DepartmentDetails[]>([]);
    const [faculty, setFaculty] = useState<FacultyMember[]>([]);

    // Forms
    const [editingOfficial, setEditingOfficial] = useState<Partial<Official> | null>(null);
    const [editingDept, setEditingDept] = useState<DepartmentDetails | null>(null);
    const [editingFaculty, setEditingFaculty] = useState<Partial<FacultyMember> | null>(null);
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

    // Modern UI states
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, message: string, onConfirm: () => void, isWorking?: boolean } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const confirmAction = (message: string, onConfirm: () => void) => {
        setConfirmModal({ isOpen: true, message, onConfirm, isWorking: false });
    };

    // Dnd State
    const [draggedOfficialIndex, setDraggedOfficialIndex] = useState<number | null>(null);
    const [dragOverOfficialIndex, setDragOverOfficialIndex] = useState<number | null>(null);

    const [draggedFacultyId, setDraggedFacultyId] = useState<string | null>(null);
    const [dragOverFacultyId, setDragOverFacultyId] = useState<string | null>(null);

    useEffect(() => {
        if (!auth) {
            router.replace('/admin-login');
            return;
        }
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!u) {
                router.replace('/admin-login');
            } else {
                loadData();
            }
        });
        return () => unsub();
    }, []);

    const loadData = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const [univData, officialsData, deptsData, facultyData] = await Promise.all([
                getUniversityInfo(),
                getOfficials(),
                getDepartments(),
                getFacultyMembers()
            ]);
            setUnivInfo(univData || {
                universityName: "Krishna University",
                collegeName: "College of Engineering and Technology",
                address: "Andhra Pradesh",
                description: "",
                about: "",
                students: '700+',
                departments: '2',
                years: '7+',
                placement: '100%'
            });
            setOfficials(officialsData);
            setDepartments(deptsData);
            setFaculty(facultyData);
        } catch (e) {
            showToast('Failed to load data', 'error');
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleMigrate = async () => {
        try {
            setLoading(true);
            // migrate univ details
            // await updateUniversityInfo(MIGRATION_DATA.university as UniversityInfo); // skip to avoid type errors in legacy schema

            // migrate officials - fetch photos first if we can, else just use the existing paths
            // Note: In real scenarios we should upload the Blobs, but the paths will also work if stored.
            // We will loop and add them properly so we can update them later
            for (const off of MIGRATION_DATA.officials) {
                await addOfficial(off);
            }

            for (const dept of MIGRATION_DATA.departments) {
                await updateDepartment(dept.id, dept as DepartmentDetails);
            }

            let globalOrder = 1;
            for (const [deptId, fList] of Object.entries(MIGRATION_DATA.faculty)) {
                for (const f of fList) {
                    await addFacultyMember({ ...f, departments: [deptId], order: globalOrder++ });
                }
            }

            showToast("Data migrated successfully into Firebase", "success");
            loadData();
        } catch (e) {
            showToast("Error migrating data", "error");
        } finally {
            setLoading(false);
        }
    };

    const saveUnivInfo = async () => {
        if (!univInfo) return;
        setIsSaving(true);
        try {
            await updateUniversityInfo(univInfo);
            showToast('University info updated successfully!', 'success');
            await loadData(false);
        } catch (e) {
            showToast('Failed to update university info', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const saveOfficial = async () => {
        if (!editingOfficial?.name || !editingOfficial?.title) {
            showToast('Please fill in Name and Title fields.', 'error');
            return;
        }

        setIsSaving(true);

        try {
            let photoUrl = editingOfficial.photo || '';

            // Handle synchronous image upload
            if (pendingImageFile) {
                const fileRef = ref(storage, `officials/${Date.now()}_${pendingImageFile.name}`);
                await uploadBytes(fileRef, pendingImageFile);
                photoUrl = await getDownloadURL(fileRef);
            } else if (photoUrl && photoUrl.startsWith('blob:')) {
                photoUrl = '';
            }

            const data = { ...editingOfficial, photo: photoUrl } as Official;
            const oldId = editingOfficial.id;
            let currentId = oldId;

            if (oldId) {
                await updateOfficial(oldId, data);
            } else {
                currentId = await addOfficial(data);
                data.id = currentId;
            }

            // Optimistic UI updates
            setOfficials(prev => {
                const newData = { ...data, id: currentId };
                if (oldId) return prev.map(o => o.id === oldId ? { ...o, ...newData } : o);
                return [...prev, newData];
            });

            setEditingOfficial(null);
            setPendingImageFile(null);
            showToast('Official saved successfully!', 'success');

        } catch (e: unknown) {
            showToast(e instanceof Error ? e.message : 'Failed to save official. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const saveDept = async () => {
        if (!editingDept?.name || !editingDept?.shortName) {
            showToast("Name and Short Name are required.", "error");
            return;
        }
        setIsSaving(true);
        try {
            const isNew = !editingDept.id;
            const finalDept = { ...editingDept };

            if (isNew) {
                finalDept.id = finalDept.shortName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
            }

            await updateDepartment(finalDept.id, finalDept);

            setDepartments(prev =>
                isNew ? [...prev, finalDept] : prev.map(d => d.id === finalDept.id ? finalDept : d)
            );

            setEditingDept(null);
            showToast(isNew ? "Department added successfully!" : "Department saved successfully!", "success");
        } catch (e) {
            showToast("Failed to save department", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDept = async (deptId: string) => {
        const executeDelete = async () => {
            setIsSaving(true);
            try {
                setConfirmModal(prev => prev ? { ...prev, isWorking: true } : null);
                await deleteDepartment(deptId);
                await loadData(false);
                showToast("Department deleted successfully!", "success");
            } catch (e) {
                showToast("Failed to delete department", "error");
            } finally {
                setIsSaving(false);
                setConfirmModal(null);
            }
        };

        const deptFaculty = faculty.filter(f => f.departmentId === deptId);
        if (deptFaculty.length > 0) {
            const confirmMsg = `WARNING: This department has ${deptFaculty.length} faculty member(s) associated with it. Are you sure you want to delete this department? Doing so may break faculty visibility.`;
            confirmAction(confirmMsg, executeDelete);
        } else {
            confirmAction("Are you sure you want to delete this department?", executeDelete);
        }
    };

    const saveFaculty = async () => {
        if (!editingFaculty?.name || !editingFaculty?.designation || !editingFaculty?.departments?.length) {
            showToast("Fill required fields and select at least one department", "info");
            return;
        }
        setIsSaving(true);
        try {
            const { departmentId, ...dataToSave } = editingFaculty as FacultyMember;
            
            if (editingFaculty.id) {
                await updateFacultyMember(editingFaculty.id, dataToSave);
            } else {
                await addFacultyMember(dataToSave as FacultyMember);
            }
            setEditingFaculty(null);
            await loadData(false);
            showToast("Faculty member saved successfully!", "success");
        } catch (e) {
            showToast("Failed to save faculty member", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            showToast("Image must be smaller than 5MB", "error");
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setEditingOfficial(prev => prev ? { ...prev, photo: previewUrl } : null);
        setPendingImageFile(file);
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-lg text-blue-800">Loading CMS...</div>;

    return (
        <div className="min-h-screen bg-slate-50 relative pointer-events-auto pb-12">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute top-40 left-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-3xl pointer-events-none -translate-x-1/3"></div>

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-indigo-100/60 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center py-4 w-full gap-4">
                        <Link href="/admin-dashboard" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            <span>Back to Dashboard</span>
                        </Link>
                        <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>
                        <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">University Content Management</h1>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
                {(!univInfo) && (
                    <div className="mb-8 premium-card p-6 bg-amber-50 border-amber-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-amber-800 font-extrabold text-lg flex items-center gap-2"><span className="text-2xl">⚠️</span> Database Empty</h3>
                                <p className="text-amber-700 font-medium text-sm mt-1">Looks like the database is empty! Migrate the hardcoded content here:</p>
                            </div>
                            <button onClick={handleMigrate} className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-600 text-white shadow-sm font-bold w-full sm:w-auto">Initialize Data to Firebase</button>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 mb-8 p-1.5 bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/60 inline-flex">
                    {[
                        { id: 'info', label: 'University Info', icon: '🏛️' },
                        { id: 'officials', label: 'Higher Officials', icon: '👔' },
                        { id: 'departments', label: 'Departments', icon: '📑' },
                        { id: 'faculty', label: 'Faculty Members', icon: '👨‍🏫' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 flex items-center gap-2 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'}`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="premium-card p-6 sm:p-8 bg-white border-indigo-100 overflow-hidden">

                    {/* UNIVERSITY INFO TAB */}
                    {activeTab === 'info' && univInfo && (
                        <div className="space-y-6 animate-fade-in-up bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center space-x-3 border-b border-slate-200/60 pb-5 mb-2">
                                <div className="bg-indigo-50 p-2 rounded-lg">
                                    <span className="text-xl">🏛️</span>
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">University Basic Info</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="label-premium">University Name</label>
                                    <input className="input-premium font-bold text-slate-800" value={univInfo.universityName || ''} onChange={e => setUnivInfo({ ...univInfo, universityName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-premium">College Name</label>
                                    <input className="input-premium font-bold text-slate-800" value={univInfo.collegeName || ''} onChange={e => setUnivInfo({ ...univInfo, collegeName: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="label-premium">Address</label>
                                <input className="input-premium font-bold text-slate-800" value={univInfo.address || ''} onChange={e => setUnivInfo({ ...univInfo, address: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="label-premium">Description (Optional)</label>
                                <textarea rows={5} className="input-premium py-3 resize-y font-medium text-slate-700" value={univInfo.description || ''} onChange={e => setUnivInfo({ ...univInfo, description: e.target.value })} />
                            </div>

                            <div className="flex items-center space-x-3 border-b border-slate-200/60 pb-5 mb-2 mt-8">
                                <div className="bg-indigo-50 p-2 rounded-lg">
                                    <span className="text-xl">📊</span>
                                </div>
                                <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Homepage Statistics</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="label-premium">Engineering Students</label>
                                    <input className="input-premium font-bold text-slate-800" placeholder="e.g., 700+" value={univInfo.students || ''} onChange={e => setUnivInfo({ ...univInfo, students: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-premium">Engineering Departments</label>
                                    <input className="input-premium font-bold text-slate-800" placeholder="e.g., 2" value={univInfo.departments || ''} onChange={e => setUnivInfo({ ...univInfo, departments: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-premium">Years of Excellence</label>
                                    <input className="input-premium font-bold text-slate-800" placeholder="e.g., 7+" value={univInfo.years || ''} onChange={e => setUnivInfo({ ...univInfo, years: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-premium">Placement Rate</label>
                                    <input className="input-premium font-bold text-slate-800" placeholder="e.g., 100%" value={univInfo.placement || ''} onChange={e => setUnivInfo({ ...univInfo, placement: e.target.value })} />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end">
                                <button onClick={saveUnivInfo} disabled={isSaving} className="btn-primary px-8 py-3 flex items-center">
                                    {isSaving ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Saving Details...
                                        </>
                                    ) : 'Save All Adjustments'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OFFICIALS TAB */}
                    {activeTab === 'officials' && (
                        <div className="animate-fade-in-up relative">

                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200/60 pb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-indigo-50 p-2 rounded-lg">
                                        <span className="text-xl">👔</span>
                                    </div>
                                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Manage Officials</h2>
                                </div>
                                <button onClick={() => setEditingOfficial({})} className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 flex items-center justify-center space-x-2 group">
                                    <span className="text-lg leading-none">+</span>
                                    <span>Add Official</span>
                                </button>
                            </div>

                            {editingOfficial && (
                                <div className="bg-slate-50/50 p-6 rounded-2xl border border-indigo-100 mb-8 shadow-sm">
                                    <h3 className="font-extrabold text-slate-800 mb-5 text-lg">{editingOfficial.id ? 'Edit Official' : 'New Official'}</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div className="space-y-2">
                                            <label className="label-premium">Name *</label>
                                            <input className="input-premium font-bold text-slate-800" value={editingOfficial.name || ''} onChange={e => setEditingOfficial({ ...editingOfficial, name: e.target.value })} placeholder="Enter the Name" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="label-premium">Title *</label>
                                            <input className="input-premium font-bold text-slate-800" value={editingOfficial.title || ''} onChange={e => setEditingOfficial({ ...editingOfficial, title: e.target.value })} placeholder="Enter the Title" />
                                        </div>
                                    </div>

                                    {/* Photo Link Row */}
                                    <div className="mb-6">
                                        <label className="label-premium mb-3 block">Photo Upload
                                            <span className="text-slate-400 font-normal text-xs ml-2">(Drag & drop or click to select)</span>
                                        </label>
                                        <div className="flex flex-col sm:flex-row items-center gap-5">
                                            {/* Preview */}
                                            <div className="shrink-0">
                                                {editingOfficial.photo ? (
                                                    <img
                                                        src={editingOfficial.photo}
                                                        alt="preview"
                                                        className="w-24 h-24 rounded-2xl object-cover shadow border border-slate-200"
                                                        onError={(e) => {
                                                            e.currentTarget.src = "/default-user.png";
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-24 h-24 rounded-2xl bg-indigo-50 border-2 border-dashed border-indigo-200 flex items-center justify-center text-indigo-300">
                                                        <span className="text-3xl">👤</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Drag and Drop Zone */}
                                            <div
                                                className={`flex-1 w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${isSaving ? 'opacity-50 pointer-events-none bg-slate-50' : 'hover:bg-indigo-50 border-indigo-200 bg-white'}`}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const file = e.dataTransfer.files?.[0];
                                                    if (file && file.type.startsWith('image/')) {
                                                        handleFileUpload(file);
                                                    } else {
                                                        showToast("Please drop a valid image file.", "error");
                                                    }
                                                }}
                                                onClick={() => { document.getElementById('official-photo-upload')?.click(); }}
                                            >
                                                <input
                                                    id="official-photo-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleFileUpload(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <span className="text-3xl mb-2 block">📷</span>
                                                <span className="text-sm font-bold text-slate-600 block">
                                                    {pendingImageFile ? pendingImageFile.name : 'Click to select or drag & drop'}
                                                </span>
                                                <span className="text-xs font-medium text-slate-400">JPG, PNG, WEBP (Max 5MB)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={saveOfficial} disabled={isSaving} className="btn-primary px-8 py-2.5 flex items-center gap-2">
                                            {isSaving ? (
                                                <><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving details...</>
                                            ) : 'Save Official'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingOfficial(null);
                                                setPendingImageFile(null);
                                            }}
                                            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-colors shadow-sm bg-white"
                                        >Cancel</button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {officials.map((o, index) => (
                                    <div
                                        key={o.id}
                                        draggable
                                        onDragStart={(e) => {
                                            setDraggedOfficialIndex(index);
                                            e.dataTransfer.effectAllowed = "move";
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = "move";
                                        }}
                                        onDragEnter={() => setDragOverOfficialIndex(index)}
                                        onDragLeave={() => setDragOverOfficialIndex(null)}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            setDragOverOfficialIndex(null);
                                            if (draggedOfficialIndex === null || draggedOfficialIndex === index) return;

                                            const newOfficials = [...officials];
                                            const draggedItem = newOfficials[draggedOfficialIndex];
                                            newOfficials.splice(draggedOfficialIndex, 1);
                                            newOfficials.splice(index, 0, draggedItem);

                                            const updatedWithOrder = newOfficials.map((ofc, idx) => ({ ...ofc, order: idx + 1 }));
                                            setOfficials(updatedWithOrder);
                                            setDraggedOfficialIndex(null);

                                            const updates = updatedWithOrder.map(ofc => ({ id: ofc.id!, order: ofc.order! }));
                                            try {
                                                await updateOfficialsOrder(updates);
                                            } catch (err) {
                                                showToast("Failed to save new order.", "error");
                                            }
                                        }}
                                        className={`premium-card p-6 flex flex-col items-center transition-all cursor-move group hover:border-indigo-200 ${draggedOfficialIndex === index ? 'opacity-50 border-dashed border-indigo-400 bg-indigo-50/30' : 'bg-white'} ${dragOverOfficialIndex === index ? 'border-indigo-500 shadow-lg transform scale-105' : ''}`}
                                    >
                                        <div className="relative mb-5 pointer-events-none">
                                            {o.photo ? (
                                                <img src={o.photo} alt={o.name} className="rounded-2xl w-24 h-24 object-cover shadow-md border border-slate-100" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-user.png"; }} />
                                            ) : (
                                                <div className="w-24 h-24 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-md">
                                                    <span className="text-3xl">👤</span>
                                                </div>
                                            )}
                                            <div className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full border border-slate-200 shadow-sm flex items-center justify-center z-10">
                                                <span className="text-[10px] text-slate-500 font-bold">#{o.order || index + 1}</span>
                                            </div>
                                        </div>
                                        <h3 className="font-extrabold text-slate-800 text-center text-sm pointer-events-none group-hover:text-indigo-600 transition-colors">{o.name}</h3>
                                        <p className="text-xs font-bold text-slate-500 text-center mt-1 mb-6 pointer-events-none">{o.title}</p>
                                        <div className="mt-auto flex gap-2 w-full">
                                            <button onClick={() => setEditingOfficial(o)} className="flex-1 bg-white hover:bg-indigo-50 text-indigo-700 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:border-indigo-200 transition-colors shadow-sm">Edit</button>
                                            <button onClick={() => {
                                                confirmAction('Are you sure you want to delete this official?', async () => {
                                                    try {
                                                        setConfirmModal(prev => prev ? { ...prev, isWorking: true } : null);
                                                        await deleteOfficial(o.id!);
                                                        setOfficials(prev => prev.filter(off => off.id !== o.id));
                                                        showToast('Official deleted successfully', 'success');
                                                    } catch (e) {
                                                        showToast('Failed to delete official', 'error');
                                                    } finally {
                                                        setConfirmModal(null);
                                                    }
                                                });
                                            }} className="flex-1 bg-white hover:bg-red-50 text-red-600 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:border-red-200 transition-colors shadow-sm flex justify-center items-center">Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DEPARTMENTS TAB */}
                    {activeTab === 'departments' && (
                        <div className="animate-fade-in-up">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200/60 pb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-indigo-50 p-2 rounded-lg">
                                        <span className="text-xl">📑</span>
                                    </div>
                                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Manage Departments</h2>
                                </div>
                                <button onClick={() => setEditingDept({ id: '', name: '', shortName: '', programType: 'UG', duration: '4 Years', intake: '60 Seats', color: '', about: '', vision: '', mission: '', icon: 'school' })} className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 flex items-center justify-center space-x-2 group">
                                    <span className="text-lg leading-none">+</span>
                                    <span>Add Department</span>
                                </button>
                            </div>

                            {editingDept ? (
                                <div className="bg-slate-50/50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6 border-b border-slate-200/60 pb-4">
                                        <h3 className="font-extrabold text-slate-800 text-lg">{editingDept.id ? 'Editing:' : 'New Department'} <span className="text-indigo-600">{editingDept.id ? editingDept.name : ''}</span></h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                                        <div className="space-y-2 lg:col-span-2">
                                            <label className="label-premium">Name *</label>
                                            <input className="input-premium font-bold text-slate-800" value={editingDept.name} onChange={e => setEditingDept({ ...editingDept, name: e.target.value })} placeholder="e.g. Computer Science and Engineering" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="label-premium">Short Name *</label>
                                            <input className="input-premium font-bold text-slate-800 uppercase" value={editingDept.shortName} onChange={e => setEditingDept({ ...editingDept, shortName: e.target.value })} placeholder="e.g. CSE" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="label-premium">Program Type</label>
                                            <select className="input-premium py-2 cursor-pointer font-bold text-slate-800" value={editingDept.programType || ''} onChange={e => setEditingDept({ ...editingDept, programType: e.target.value as any })}>
                                                <option value="UG">UG</option>
                                                <option value="PG">PG</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="label-premium">Duration</label>
                                            <input className="input-premium font-bold text-slate-800" value={editingDept.duration} onChange={e => setEditingDept({ ...editingDept, duration: e.target.value })} placeholder="e.g. 4 Years" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="label-premium">Intake</label>
                                            <input className="input-premium font-bold text-slate-800" value={editingDept.intake} onChange={e => setEditingDept({ ...editingDept, intake: e.target.value })} placeholder="e.g. 60 Seats" />
                                        </div>

                                    </div>
                                    <div className="mb-6 space-y-2">
                                        <label className="label-premium">About</label>
                                        <textarea rows={4} className="input-premium py-3 resize-y font-medium text-slate-700" value={editingDept.about} onChange={e => setEditingDept({ ...editingDept, about: e.target.value })} />
                                    </div>
                                    <div className="mb-6 space-y-2">
                                        <label className="label-premium">Vision</label>
                                        <textarea rows={3} className="input-premium py-3 resize-y font-medium text-slate-700" value={editingDept.vision} onChange={e => setEditingDept({ ...editingDept, vision: e.target.value })} />
                                    </div>
                                    <div className="mb-8 space-y-2">
                                        <label className="label-premium">Mission</label>
                                        <textarea rows={3} className="input-premium py-3 resize-y font-medium text-slate-700" value={editingDept.mission} onChange={e => setEditingDept({ ...editingDept, mission: e.target.value })} />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={saveDept} disabled={isSaving} className="btn-primary px-8 py-2.5">{isSaving ? 'Saving...' : 'Save Department'}</button>
                                        <button onClick={() => setEditingDept(null)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-colors shadow-sm bg-white">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {departments.map(d => (
                                        <div key={d.id} className="premium-card p-6 flex flex-col group hover:border-indigo-300 transition-colors h-full">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.color || 'from-slate-600 to-slate-700'} flex items-center justify-center text-white shadow-sm shrink-0`}>
                                                    <span className="font-extrabold text-sm">{d.programType || d.shortName.substring(0, 2)}</span>
                                                </div>
                                                <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{d.shortName}</h3>
                                            </div>
                                            <p className="text-sm font-bold text-slate-500 mb-5 leading-snug line-clamp-2 flex-grow">{d.name}</p>
                                            <div className="flex gap-2 shrink-0 w-full mt-auto">
                                                <button onClick={() => setEditingDept(d)} className="flex-1 bg-white hover:bg-indigo-50 text-indigo-700 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:border-indigo-200 transition-colors shadow-sm">Edit Details</button>
                                                <button onClick={() => handleDeleteDept(d.id)} className="bg-white hover:bg-red-50 text-red-600 py-2 px-4 rounded-xl text-xs font-bold border border-slate-200 hover:border-red-200 transition-colors shadow-sm">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* FACULTY TAB */}
                    {activeTab === 'faculty' && (
                        <div className="animate-fade-in-up">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200/60 pb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="bg-indigo-50 p-2 rounded-lg">
                                        <span className="text-xl">👨‍🏫</span>
                                    </div>
                                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Manage Faculty Members</h2>
                                </div>
                                <button onClick={() => setEditingFaculty({ departments: [] })} className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 flex items-center justify-center space-x-2 group">
                                    <span className="text-lg leading-none">+</span>
                                    <span>Add Faculty</span>
                                </button>
                            </div>



                            <div className="flex flex-col gap-8">
                                {departments.map(d => {
                                    const deptFaculty = faculty.filter(f => 
                                        (Array.isArray(f.departments) && f.departments.includes(d.id)) || 
                                        f.departmentId === d.id
                                    );
                                    if (deptFaculty.length === 0) return null;
                                    return (
                                        <div key={d.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white pt-0">
                                            <div className={`bg-gradient-to-r ${d.color || 'from-slate-600 to-slate-700'} px-5 py-3.5 flex items-center justify-between`}>
                                                <h3 className="text-white font-extrabold tracking-wide">{d.name} <span className="opacity-70 text-sm ml-2 font-medium">({deptFaculty.length})</span></h3>
                                            </div>
                                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50">
                                                {deptFaculty.map((f, index) => (
                                                    <div
                                                        key={f.id}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            setDraggedFacultyId(f.id!);
                                                            e.dataTransfer.effectAllowed = "move";
                                                        }}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.dataTransfer.dropEffect = "move";
                                                        }}
                                                        onDragEnter={() => setDragOverFacultyId(f.id!)}
                                                        onDragLeave={() => setDragOverFacultyId(null)}
                                                        onDrop={async (e) => {
                                                            e.preventDefault();
                                                            setDragOverFacultyId(null);
                                                            if (!draggedFacultyId || draggedFacultyId === f.id) return;

                                                            const itemIndex = deptFaculty.findIndex(fac => fac.id === draggedFacultyId);
                                                            const targetIndex = index;
                                                            if (itemIndex === -1) return;

                                                            const newDeptFaculty = [...deptFaculty];
                                                            const draggedItem = newDeptFaculty[itemIndex];
                                                            newDeptFaculty.splice(itemIndex, 1);
                                                            newDeptFaculty.splice(targetIndex, 0, draggedItem);

                                                            // Fix: Use indices if orders are missing or identical
                                                            const originalOrders = deptFaculty.map(fac => fac.order || 0).sort((a, b) => a - b);
                                                            const hasUniqueOrders = new Set(originalOrders.filter(o => o !== 999)).size === originalOrders.length;
                                                            
                                                            const globallyUpdatedFacultyList = faculty.map(f => ({ ...f }));
                                                            const updates: { id: string, order: number }[] = [];

                                                            newDeptFaculty.forEach((fac, idx) => {
                                                                // If no unique orders exist, generate a sequence based on index
                                                                const newOrder = hasUniqueOrders ? (originalOrders[idx] || (idx + 1)) : (idx + 1);
                                                                fac.order = newOrder;
                                                                updates.push({ id: fac.id!, order: newOrder });

                                                                const globalIdx = globallyUpdatedFacultyList.findIndex(gF => gF.id === fac.id);
                                                                if (globalIdx > -1) globallyUpdatedFacultyList[globalIdx].order = newOrder;
                                                            });

                                                            setFaculty(globallyUpdatedFacultyList.sort((a, b) => (a.order || 0) - (b.order || 0)));
                                                            setDraggedFacultyId(null);

                                                            try {
                                                                await updateFacultyOrder(updates);
                                                            } catch (err) {
                                                                showToast("Failed to save new order.", "error");
                                                            }
                                                        }}
                                                        className={`bg-white border rounded-xl p-4 flex justify-between items-center transition-all ${draggedFacultyId === f.id ? 'opacity-50 border-dashed border-indigo-400 bg-indigo-50/20' : 'border-slate-200 shadow-sm group hover:border-indigo-300 hover:shadow-md'} ${dragOverFacultyId === f.id ? 'border-indigo-500 shadow-lg transform scale-105 z-10' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-4 flex-1">
                                                            {/* Drag Handle */}
                                                            <div className="cursor-move text-slate-300 hover:text-indigo-400 transition-colors shrink-0">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                                            </div>
                                                            
                                                            <div className="pointer-events-none pr-3 flex-1">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <p className="font-extrabold text-sm text-slate-800 leading-snug">{f.name}</p>
                                                                </div>
                                                                <p className="text-xs font-bold text-indigo-600 leading-snug">{f.designation}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className={`flex items-center gap-2 shrink-0 transition-opacity ${draggedFacultyId ? 'opacity-0' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
                                                            <span className="text-[10px] text-slate-400 font-bold font-mono bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 hidden md:block">#{f.order}</span>
                                                            <div className="flex gap-1">
                                                                <button onClick={() => {
                                                                    const depts = Array.isArray(f.departments) 
                                                                        ? f.departments 
                                                                        : (f.departmentId ? [f.departmentId] : []);
                                                                    setEditingFaculty({ ...f, departments: depts });
                                                                }} className="text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 p-1.5 rounded-lg transition-colors border border-indigo-100/40">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                </button>
                                                                <button onClick={() => {
                                                                    confirmAction('Are you sure you want to delete this faculty member?', async () => {
                                                                        try {
                                                                            setConfirmModal(prev => prev ? { ...prev, isWorking: true } : null);
                                                                            await deleteFacultyMember(f.id!);
                                                                            await loadData(false);
                                                                            showToast('Faculty member deleted successfully', 'success');
                                                                        } catch (e) {
                                                                            showToast('Failed to delete faculty member', 'error');
                                                                        } finally {
                                                                            setConfirmModal(null);
                                                                        }
                                                                    });
                                                                }} className="text-red-500 bg-red-50/50 hover:bg-red-100 p-1.5 rounded-lg transition-colors border border-red-100/40"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Global Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 p-4 rounded-xl shadow-xl z-[100] transform transition-all flex items-center gap-3 font-medium text-sm border 
                    ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                        toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'}`}
                >
                    {toast.type === 'success' && <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    {toast.type === 'error' && <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                    {toast.type === 'info' && <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    {toast.message}
                </div>
            )}

            {/* Faculty Edit Modal */}
            {editingFaculty && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in duration-200">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-extrabold text-slate-800 text-lg">{editingFaculty.id ? 'Edit Faculty Member' : 'New Faculty Member'}</h3>
                            <button onClick={() => setEditingFaculty(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="label-premium">Name</label>
                                    <input className="input-premium font-bold text-slate-800" value={editingFaculty.name || ''} onChange={e => setEditingFaculty({ ...editingFaculty, name: e.target.value })} placeholder="e.g. Dr. John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <label className="label-premium">Designation</label>
                                    <input className="input-premium font-bold text-slate-800" value={editingFaculty.designation || ''} onChange={e => setEditingFaculty({ ...editingFaculty, designation: e.target.value })} placeholder="e.g. Assistant Professor" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="label-premium">Associated Departments (Select at least one)</label>
                                <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200 shadow-inner">
                                    {departments.map(d => {
                                        const currentDepts = Array.isArray(editingFaculty.departments) 
                                            ? editingFaculty.departments 
                                            : (editingFaculty.departmentId ? [editingFaculty.departmentId] : []);
                                        
                                        const isChecked = currentDepts.includes(d.id);

                                        return (
                                            <label key={d.id} className={`flex items-center space-x-3 text-xs font-bold p-2.5 rounded-lg transition-all border cursor-pointer ${isChecked ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const exists = currentDepts.includes(d.id);
                                                        const newDepts = exists 
                                                            ? currentDepts.filter(id => id !== d.id)
                                                            : [...currentDepts, d.id];
                                                        setEditingFaculty({ ...editingFaculty, departments: newDepts });
                                                    }}
                                                    className="hidden"
                                                />
                                                <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded border border-current">
                                                    {isChecked && <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>}
                                                </span>
                                                <span>{d.shortName}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end mt-auto">
                            <button onClick={() => setEditingFaculty(null)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm font-bold text-sm transition-all">Cancel</button>
                            <button onClick={saveFaculty} disabled={isSaving} className="btn-primary px-8 py-2.5 flex items-center gap-2">
                                {isSaving ? (
                                    <><svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...</>
                                ) : editingFaculty.id ? 'Save Changes' : 'Add Faculty Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Confirm Modal */}
            {confirmModal?.isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">

                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-100">
                        <div className="mb-6">
                            <h3 className="text-lg font-extrabold text-slate-800 mb-2">Confirm Action</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{confirmModal.message}</p>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => !confirmModal.isWorking && setConfirmModal(null)}
                                disabled={confirmModal.isWorking}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => confirmModal.onConfirm()}
                                disabled={confirmModal.isWorking}
                                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
                            >
                                {confirmModal.isWorking ? (
                                    <><svg className="w-4 h-4 animate-spin text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Deleting...</>
                                ) : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
