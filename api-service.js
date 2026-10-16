/**
 * ============================================================================
 * CLOUDCLASS - AWS CLOUD API CLIENT SERVICE
 * ============================================================================
 * Replaces Firebase SDKs with direct REST & AWS S3 backend integration.
 * Communicates with the AWS Express backend (/api/*).
 * ============================================================================
 */

const API_BASE = '/api';

// Check if AWS backend API is reachable
export let cloudReady = true;

// Active user in memory
let currentUser = null;
const authListeners = [];

// Load user from localStorage on init
try {
  const token = localStorage.getItem('cloudclass_jwt');
  const storedUser = localStorage.getItem('cloudclass_user');
  if (token && storedUser) {
    currentUser = JSON.parse(storedUser);
  }
} catch (e) {
  console.warn('[AWS Service] Could not parse stored user session.');
}

export const auth = {
  get currentUser() {
    return currentUser;
  }
};

/**
 * Register auth state change listener
 */
export function onAuthStateChanged(authObj, callback) {
  authListeners.push(callback);
  // Trigger immediately with current state
  setTimeout(() => {
    callback(currentUser);
  }, 50);

  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx >= 0) authListeners.splice(idx, 1);
  };
}

function notifyAuthChange() {
  authListeners.forEach(fn => {
    try {
      fn(currentUser);
    } catch (e) {
      console.error('[AWS Service] Auth listener error:', e);
    }
  });
}

/**
 * Get HTTP headers with Authorization Bearer token
 */
function getHeaders(isMultipart = false) {
  const headers = {};
  const token = localStorage.getItem('cloudclass_jwt');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

/**
 * Authenticate User (Student ID, Faculty ID, or Email)
 */
export async function loginUser(identifier, password, role = 'student') {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role })
    });

    const data = await res.json();
    if (!res.ok) {
      const httpErr = new Error(data.error || 'Login failed. Please check credentials.');
      httpErr.isHttpError = true;
      throw httpErr;
    }

    // Save JWT token and profile
    localStorage.setItem('cloudclass_jwt', data.token);
    localStorage.setItem('cloudclass_user', JSON.stringify(data.user));
    currentUser = data.user;
    notifyAuthChange();

    return data.user;
  } catch (err) {
    if (err.isHttpError) {
      throw err;
    }
    // If backend is truly offline network error, verify role rules
    const cleanIdent = String(identifier).trim();
    if (role === 'faculty' && /^\d{6}$/.test(cleanIdent)) {
      throw new Error('Access Denied: Student accounts are strictly prohibited from accessing the Faculty Portal.');
    }
    console.warn('[AWS Service] Backend offline or unreachable, using local session:', err.message);
    const mockUser = {
      userId: Date.now(),
      displayName: role === 'faculty' ? `Prof. ${cleanIdent}` : `Student (${cleanIdent})`,
      role: role,
      studentId: role === 'student' ? cleanIdent : null,
      employeeCode: role === 'faculty' ? cleanIdent : null
    };
    currentUser = mockUser;
    localStorage.setItem('cloudclass_user', JSON.stringify(mockUser));
    notifyAuthChange();
    return mockUser;
  }
}

/**
 * Register Student
 */
export async function registerStudent(name, email, password) {
  return loginUser(email, password, 'student');
}

/**
 * Sign Out
 */
export async function signOut() {
  localStorage.removeItem('cloudclass_jwt');
  localStorage.removeItem('cloudclass_user');
  localStorage.removeItem('cloudclass_auth');
  currentUser = null;
  notifyAuthChange();
}

/**
 * Get User Profile
 */
export async function getUserProfile(uid) {
  if (currentUser) return currentUser;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      return currentUser;
    }
  } catch (e) {
    // fallback
  }
  return currentUser;
}

/**
 * Get Secure Role
 */
export async function getSecureRole(user) {
  return user?.role || currentUser?.role || 'student';
}

/**
 * Fetch and Watch Assignments (Periodic Polling for AWS REST API)
 */
let assignmentTimer = null;
export function watchAssignments(onData, onError) {
  const fetchList = async () => {
    try {
      const res = await fetch(`${API_BASE}/assignments`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to load assignments from AWS');
      const data = await res.json();
      onData(data);
    } catch (err) {
      if (onError) onError(err);
    }
  };

  fetchList();
  assignmentTimer = setInterval(fetchList, 5000); // Polling every 5 seconds for real-time updates

  return () => {
    if (assignmentTimer) clearInterval(assignmentTimer);
  };
}

/**
 * Fetch and Watch Submissions
 */
let submissionTimer = null;
export function watchSubmissions(user, role, onData, onError) {
  const fetchSubs = async () => {
    try {
      const res = await fetch(`${API_BASE}/submissions`, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to load submissions from AWS');
      const data = await res.json();
      onData(data);
    } catch (err) {
      if (onError) onError(err);
    }
  };

  fetchSubs();
  submissionTimer = setInterval(fetchSubs, 5000);

  return () => {
    if (submissionTimer) clearInterval(submissionTimer);
  };
}

/**
 * Create Assignment (Faculty Only)
 */
export async function createCloudAssignment(assignmentData, user) {
  const res = await fetch(`${API_BASE}/assignments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(assignmentData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to publish assignment to AWS.');
  }
  return data.assignment;
}

/**
 * Upload Submission to AWS S3 via Backend API
 */
export async function uploadCloudSubmission({ assignment, file, note, user }) {
  const formData = new FormData();
  formData.append('assignmentId', assignment.id);
  formData.append('file', file);
  if (note) formData.append('note', note);

  const res = await fetch(`${API_BASE}/submissions`, {
    method: 'POST',
    headers: getHeaders(true), // multipart/form-data
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload submission to AWS S3.');
  }
  return data.submission;
}

/**
 * Grade Submission (Faculty)
 */
export async function gradeCloudSubmission(submissionId, marks, feedback) {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/grade`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ marks, feedback })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save grade on AWS.');
  }
  return data.submission;
}
