# CloudClass — Real-Time Cloud Assignment Portal (Firebase)

A responsive, real-time academic workspace and assignment management portal powered by **Google Firebase**. CloudClass provides instant synchronization between student and faculty dashboards using **Firebase Authentication**, **Cloud Firestore real-time snapshot listeners**, **Firebase Cloud Storage**, and **Firebase Hosting**.

---

## 🏛️ System Architecture on Firebase Cloud

```mermaid
graph TD
    Client["Browser / Client (SPA HTML/CSS/JS)"] -->|Web SDK / Auth| Auth["Firebase Authentication<br/>(Email & Password)"]
    Client -->|onSnapshot() Real-Time Sync| Firestore[("Cloud Firestore<br/>(Users, Assignments, Submissions)")]
    Client -->|Direct Secure Upload & Presigned URLs| Storage[("Firebase Cloud Storage<br/>(PDF / DOCX Submissions)")]
    Hosting["Firebase Hosting (Global CDN)"] -->|Serves Static Web Assets| Client
```

| Component | Firebase Cloud Service | Purpose |
| :--- | :--- | :--- |
| **Authentication** | **Firebase Auth** | Secure student and faculty registration & email/password sign-in. |
| **Database** | **Cloud Firestore** | Real-time NoSQL document database with live `onSnapshot()` listeners. |
| **File Storage** | **Firebase Cloud Storage** | Uploads and serves encrypted assignment files (PDF, DOCX, ZIP). |
| **Hosting & CDN** | **Firebase Hosting** | Global edge network with automatic SSL/HTTPS certificate and cache control. |
| **Security Rules** | **Firestore & Storage Rules** | Fine-grained role-based security policies (`firestore.rules`, `storage.rules`). |

---

## 🚀 Quick Start (Local Development)

This project uses modern JavaScript ES modules and Firebase's official Web CDN SDK. Run it through any local HTTP server:

### Using Python:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Using VS Code:
Right-click `index.html` and click **Open with Live Server**.

*(The app starts in **Demo mode** with sample coursework until real Firebase credentials are provided in `firebase-config.js`).*

---

## ☁️ Deploy to Firebase Cloud (3 Steps)

For complete step-by-step instructions with screenshots, refer to the [Firebase Deployment Guide](file:///d:/cloudclass_realtime/firebase-deployment.md).

```bash
# 1. Install Firebase CLI globally
npm install -g firebase-tools

# 2. Login to your Google account
firebase login

# 3. Deploy Hosting, Firestore Rules, and Storage Rules in one command
firebase deploy
```

---

## 📁 Project Structure

```
├── index.html                  # Main student and faculty workspace dashboard
├── styles.css                  # Modern UI styles, responsive layout, calendar
├── app.js                      # Core frontend logic and real-time snapshot subscribers
├── firebase-config.js          # Active Firebase Web App configuration
├── firebase-config.example.js  # Template for Firebase credentials
├── firebase-service.js         # Firebase Auth, Firestore, and Storage service module
├── firebase.json               # Firebase CLI configuration for Hosting and Rules
├── firestore.rules             # Production security rules for Cloud Firestore
├── storage.rules               # Production security rules for Cloud Storage
├── firebase-deployment.md      # Full step-by-step cloud deployment manual
└── README.md                   # Project documentation
```

---

## 🔒 Security Architecture

* **Role Isolation**: New users are registered strictly as `student`. Faculty permissions can only be granted in the Firebase Console by an administrator.
* **Owner-Only Submissions**: Students can only query and read their own submissions.
* **Faculty Review Access**: Faculty members can query, view, and grade submissions across all enrolled students.
* **Storage Validation**: File uploads are restricted to supported academic file types (`pdf`, `doc`, `docx`, `zip`) with a 10MB file size limit enforced at the storage engine level.
