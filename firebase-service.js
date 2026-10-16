import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const validConfig = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_") && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("YOUR_");
export const cloudReady = Boolean(validConfig);
let app, auth, db, storage;
if (cloudReady) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app); storage = getStorage(app);
}
export { auth, db, storage, onAuthStateChanged, signOut };

export async function registerStudent(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    displayName: name, email, role: "student", createdAt: serverTimestamp()
  });
  return cred.user;
}
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Your profile is missing. Ask the project administrator to create your user profile.");
  }
  return { user: cred.user, profile: snap.data() };
}
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
export function watchAssignments(onData, onError) {
  return onSnapshot(query(collection(db, "assignments"), orderBy("createdAt", "desc")), snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}
export function watchSubmissions(user, role, onData, onError) {
  const source = role === "faculty" ? collection(db, "submissions") : query(collection(db, "submissions"), where("studentId", "==", user.uid));
  return onSnapshot(source, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}
export async function createCloudAssignment(data, user) {
  return addDoc(collection(db, "assignments"), {
    ...data, createdBy: user.uid, createdByName: user.displayName || user.email,
    createdAt: serverTimestamp(), allowedTypes: ["pdf", "doc", "docx", "zip"], maxFileSizeMB: 10
  });
}
export async function uploadCloudSubmission({ assignment, file, note, user }) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `submissions/${user.uid}/${assignment.id}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream", customMetadata: { ownerUid: user.uid, assignmentId: String(assignment.id) } });
  const downloadURL = await getDownloadURL(fileRef);
  await addDoc(collection(db, "submissions"), {
    assignmentId: String(assignment.id), assignmentTitle: assignment.title,
    studentId: user.uid, studentName: user.displayName || user.email,
    studentEmail: user.email, fileName: file.name, storagePath, downloadURL,
    note: note || "", status: "submitted", submittedAt: serverTimestamp()
  });
}
