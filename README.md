# CloudClass — Real-Time Cloud Assignment Portal

A responsive Cloud Computing mini-project with a student/faculty dashboard and Firebase integration. Once configured, CloudClass uses **Firebase Authentication**, **Cloud Firestore real-time listeners**, and **Firebase Cloud Storage**.

## What is live in this version?

- Faculty creates an assignment → authenticated student dashboards receive it automatically through Firestore `onSnapshot()` listeners.
- Student uploads a PDF/DOC/DOCX/ZIP → file bytes are uploaded to Firebase Storage and submission metadata is saved in Firestore.
- Faculty submission review list updates automatically as new submissions arrive.
- Each student queries only their own submission documents; faculty can view all submissions according to the security rules.
- New accounts are students by default. Faculty role must be assigned by a trusted administrator.

## 1. Run the site

This project uses JavaScript modules and Firebase's CDN SDK, so run it through a local web server and use an internet connection.

### Python
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

Or open the folder in VS Code and use the **Live Server** extension.

The UI starts in **Demo mode** until a real Firebase web config is added.

## 2. Create Firebase services

1. Open the Firebase Console and create a project.
2. In **Project settings → General → Your apps**, add a Web App and copy its config.
3. Replace the placeholder values in `firebase-config.js` with the Web App configuration.
4. In **Authentication → Sign-in method**, enable **Email/Password**.
5. Create a **Cloud Firestore** database.
6. Enable **Cloud Storage**.
7. Publish the rules in `firebase.rules.example` as your Firestore rules and `storage.rules.example` as your Storage rules. Review and test them before using real student data.

Firebase Web API config values are expected in browser apps; do not put service-account JSON or private server credentials in this project.

## 3. Set up the first faculty account

Registration intentionally creates **student** profiles only. This prevents a visitor from selecting the faculty role in the browser.

1. Open the website and choose **Connect cloud → Create student account** to create an account.
2. In Firebase Console → Authentication → Users, copy that user's UID.
3. In Firestore, open `users/{UID}` and change its `role` field from `student` to `faculty`.
4. Sign out and sign back in. The app reads the role from Firestore and switches to the faculty dashboard.
5. Use **Create assignment** to publish the first real assignment.
6. Create a second account in another browser/incognito window. It remains a student and should see the assignment appear automatically.
7. Upload a test PDF as the student. The faculty dashboard's submission count and review list should update automatically.

Never allow users to promote themselves to faculty. For a larger system, assign faculty through a trusted admin backend or Firebase custom claims.

## 4. Data model

### `users/{uid}`
```json
{
  "displayName": "Student Name",
  "email": "student@example.com",
  "role": "student",
  "createdAt": "Firestore server timestamp"
}
```

### `assignments/{assignmentId}`
Fields include `title`, `subject`, `instructions`, `deadline` (ISO timestamp), `code`, `points`, `createdBy`, `createdByName`, and `createdAt`.

### `submissions/{submissionId}`
Fields include `assignmentId`, `assignmentTitle`, `studentId`, `studentName`, `studentEmail`, `fileName`, `storagePath`, `downloadURL`, `note`, `status`, and `submittedAt`.

File bytes are stored under `submissions/{studentUid}/{assignmentId}/{fileName}` in Cloud Storage. Firestore stores the metadata and file path/URL.

## 5. Deploy online with Firebase Hosting

Install Node.js, then run:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
Select the Firebase project. Choose this folder as the public directory, configure it as a single-page app only if you want that behavior, and deploy. Since this is a static multi-page-free app, the default static hosting setup is sufficient.

## 6. Security notes

- The provided rules are a teaching-project starting point, not a full production security review.
- Firestore rules enforce student-owned submission reads and faculty-only assignment creation.
- Storage rules limit size and allow reads by the owning student or faculty.
- A download URL can act like a bearer link. Avoid sharing it publicly; for stricter control, implement authenticated server-side downloads instead of persisting long-lived download URLs.
- For production, validate assignment IDs, deadlines, content types, file extensions, quotas, and grading workflows; test that Student A cannot access Student B's files.
- Do not expose Firebase Admin SDK credentials in browser code.

## Project files

- `index.html` — dashboard interface
- `styles.css` — responsive UI
- `app.js` — interface logic, authentication UI, and live listeners
- `firebase-service.js` — Firebase Authentication, Firestore, and Storage functions
- `firebase-config.js` — your Firebase Web App config placeholders
- `firebase.rules.example` — Firestore security rules starter
- `storage.rules.example` — Cloud Storage rules starter
