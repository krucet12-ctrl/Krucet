# Krucet ERP

A comprehensive University ERP (Enterprise Resource Planning) system designed to streamline academic and administrative operations. The platform provides a seamless experience for students to access results and manage payments, while offering administrators robust tools for curriculum, faculty, and student management.

## 📄 Project Description

Krucet ERP is a full-stack web application built to centralize university data and automate manual processes. It serves as a unified portal for:
- **Student Results**: Instant access to semester-wise results and automated SGPA/CGPA calculations.
- **Fee Management**: Online submission and verification of Tuition and Exam fees.
- **Curriculum Management**: Dynamic configuration of subjects, credits, and regulations.
- **Faculty & Staff Management**: Maintenance of faculty profiles and university officials.
- **Academic Administration**: Management of classes, batches, and student enrollments.

---

## 🚀 Features

### Student Module
- **Check Results**: Securely view semester-wise academic results using roll numbers.
- **Payment Portal**: Upload payment proofs (DU Numbers) for Tuition and Exam fees.
- **Payment Status**: Track the verification status of submitted payments in real-time.
- **CGPA/SGPA Viewer**: Integrated calculator for semester and cumulative grade points.
- **Digital Memo**: Download or print professional academic memos and result tables.

### Admin Module
- **Result Management**: Bulk upload student results via Excel parsing with automated Firestore synchronization.
- **Payment Verification**: Review, approve, or reject student payment submissions with rejection reasons.
- **Curriculum Control**: Define and edit curriculum structures for various departments and regulations (R20, R23, etc.).
- **Class & Batch Management**: Initialize new batches, departments, and enroll students.
- **Content Management**: Update university info, faculty details, and official listings dynamically.
- **Analytics Dashboard**: Overview of total students, pending payments, and recent result uploads.

---

## 🛠 Tech Stack

**Frontend:**
- **Framework**: Next.js (App Router)
- **Library**: React.ts
- **Styling**: Tailwind CSS / Vanilla CSS
- **Icons**: Lucide React

**Backend & Database:**
- **Database**: Firebase Firestore (NoSQL)
- **Storage**: Firebase Storage (for receipts and documents)
- **Authentication**: Firebase Auth (Admin Session Management)
- **Server Logic**: Next.js API Routes (Serverless)

**Deployment:**
- **Platform**: Vercel

---

## 📂 Folder Structure

```text
krucet_results-main/
├── public/                # Static assets (images, icons)
├── src/
│   ├── app/               # Next.js App Router (Pages & API Routes)
│   │   ├── admin-dashboard/ # Admin portal modules
│   │   ├── api/           # Backend API endpoints
│   │   ├── payment/       # Student payment pages
│   │   └── results/       # Student result viewing
│   ├── components/        # Reusable UI components (Button, Card, Toast, etc.)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Core services (Firebase, CMS, Helpers)
│   │   ├── firebaseService.ts # Result & Student logic
│   │   ├── cmsService.ts      # CMS & Faculty logic
│   │   └── curriculumHelper.ts # Shared curriculum utilities
│   └── workers/           # Background workers (Excel/PDF parsing)
├── firestore.rules        # Security rules for Firestore
└── tailwind.config.js     # Tailwind CSS configuration
```

---

## 🔄 Data Flow

### 1. Result Processing
1. **Admin Upload**: Admin uploads an Excel result file through the Dashboard.
2. **Parsing**: A background worker/API parses the Excel data into a standardized JSON format.
3. **Storage**: Data is processed (calculating SGPA) and stored in `students` and `results` collections.
4. **Retrieval**: Students enter their roll number; the API fetches and buckets the results by semester for display.

### 2. Payment Workflow
1. **Student Submission**: Student fills a form and uploads a receipt/DU number.
2. **Storage**: The record is saved in `tuitionFeePayments` or `examFees` with a `pending` status.
3. **Admin Review**: Admin views the pending list, verifies the DU number, and updates the status to `verified` or `rejected`.
4. **Student Tracking**: Student checks their status via the tracking portal using their roll number.

---

## 👥 User Architecture

- **Student (Public)**:
  - Access to: Results, GPA calculator, Payment submission, and Status tracking.
  - Permissions: Read-only access to their own data; Write access to payment submissions.
- **Admin (Private)**:
  - Access to: Full Dashboard, Data Management, and Verification tools.
  - Permissions: Full CRUD (Create, Read, Update, Delete) access via Firebase Authentication.

---

## 🗄 Firestore Database Structure

- **`students/`**: Documents keyed by roll number containing profile info and result summaries.
- **`curriculum/`**: Hierarchical data (`regulation > department > semester`) for subject maps.
- **`tuitionFeePayments/`**: Records of tuition fee submissions.
- **`examFees/`**: Records of exam fee submissions.
- **`results/`**: History of batch uploads and metadata.
- **`classes/`**: Structure for `courseType > batches > departments > students`.
- **`facultyMembers/`**: Profiles of faculty members.
- **`officials/`**: University leadership and officials.
- **`university/`**: Global configuration and CMS content.

---

## ⚙️ Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/krucet-erp.git
   cd krucet-erp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env.local` file and add your Firebase configuration:
   ```text
   NEXT_PUBLIC_FIREBASE_API_KEY=your_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
   ...
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

---

## 🚢 Deployment Steps

1. **Vercel Deployment**:
   - Connect your GitHub repository to Vercel.
   - Configure the environment variables in the Vercel Dashboard.
   - Deploy the `main` branch.

2. **Firebase Rules**:
   - Deploy the `firestore.rules` and `storage.rules` to your Firebase project to ensure data security.

---

## 🔮 Future Enhancements
- **Push Notifications**: Real-time alerts for result releases and payment approvals.
- **Automated Invoicing**: Generation of PDF receipts for verified payments.
- **Student Dashboard**: Personalized profile page for students to manage their entire academic lifecycle.
- **Advanced Analytics**: Graphical representation of pass percentages and fee collection trends.
