# CloudClass — Firebase Cloud Deployment Guide

This guide walks you through deploying **CloudClass** completely on **Google Firebase Cloud Services**:
- **Hosting**: Firebase Hosting (Global CDN, automated SSL/HTTPS certificate)
- **Authentication**: Firebase Auth (Email & Password authentication)
- **Database**: Cloud Firestore (Real-time NoSQL database with snapshot listeners)
- **File Storage**: Firebase Cloud Storage (PDF/DOCX assignment file uploads)
- **Security**: Firestore & Storage security rules

---

## 1. Prerequisites

1. A Google Account to access the [Firebase Console](https://console.firebase.google.com/).
2. [Node.js](https://nodejs.org/) installed on your machine.
3. Install the Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   ```

---

## 2. Firebase Console Setup

### Step 1: Create a Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, name it (e.g., `cloudclass-portal`), and proceed.

### Step 2: Register a Web App
1. In your project overview, click the **Web icon (`</>`)** to add an app.
2. Enter an app nickname (e.g., `CloudClass Web`).
3. Check the box **"Also set up Firebase Hosting for this app"**.
4. Click **Register app** and copy the `firebaseConfig` object values.

### Step 3: Populate `firebase-config.js`
Open [`firebase-config.js`](file:///d:/cloudclass_realtime/firebase-config.js) in your project directory and replace the placeholders with your project details:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "cloudclass-portal.firebaseapp.com",
  projectId: "cloudclass-portal",
  storageBucket: "cloudclass-portal.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef"
};
```

### Step 4: Enable Authentication
1. Go to **Build > Authentication** > **Get started**.
2. Under the **Sign-in method** tab, click **Email/Password**.
3. Enable **Email/Password** and click **Save**.

### Step 5: Enable Cloud Firestore
1. Go to **Build > Firestore Database** > **Create database**.
2. Select a location close to your users (e.g., `us-central` or `asia-south1`).
3. Start in **Production mode** (our security rules will protect it).

### Step 6: Enable Cloud Storage
1. Go to **Build > Storage** > **Get started**.
2. Choose your security rules and storage bucket location.

---

## 3. Deploying via Firebase CLI

Run the following commands in the project root:

### 1. Log in to Firebase
```bash
firebase login
```

### 2. Connect Your Project
```bash
firebase use --add
```
Select your Firebase project from the list and give it an alias (like `default`).

### 3. Deploy Firestore Rules, Storage Rules, and Hosting
Deploy everything in a single command:
```bash
firebase deploy
```

Or deploy specific components:
```bash
# Deploy only security rules
firebase deploy --only firestore:rules,storage:rules

# Deploy only static web files
firebase deploy --only hosting
```

Once deployment completes, the CLI outputs your live production URL:
```
✔ Deploy complete!
Hosting URL: https://cloudclass-portal.web.app
```

---

## 4. Setting up the First Faculty Account

By default, self-registration via the web portal only grants the **Student** role to maintain security.

To promote an account to **Faculty**:
1. Open your live app URL and register an account (`Connect cloud` > `Create student account`).
2. Go to the [Firebase Console](https://console.firebase.google.com/) > **Authentication** > **Users** and copy the user's `User UID`.
3. Go to **Firestore Database** > `users` collection > document with that `UID`.
4. Change the `role` field from `"student"` to `"faculty"`.
5. On the web app, sign out and sign back in. The portal switches to the **Faculty Dashboard**!
