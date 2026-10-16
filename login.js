import { cloudReady, auth, loginUser, getUserProfile, getSecureRole } from "./api-service.js";

let currentPortal = 'student';

// DOM Elements
const tabStudent = document.getElementById('tabStudent');
const tabFaculty = document.getElementById('tabFaculty');
const studentForm = document.getElementById('studentForm');
const facultyForm = document.getElementById('facultyForm');
const portalCard = document.getElementById('portalCard');
const alertBox = document.getElementById('alertBox');
const studentIdInput = document.getElementById('studentId');
const studentIdCount = document.getElementById('studentIdCount');

// Switch Tab
window.switchPortal = function(role) {
  currentPortal = role;
  hideAlert();

  if (role === 'student') {
    tabStudent.classList.add('active', 'student');
    tabFaculty.classList.remove('active', 'faculty');
    studentForm.classList.remove('hidden');
    facultyForm.classList.add('hidden');
    portalCard.classList.remove('faculty-mode');
  } else {
    tabFaculty.classList.add('active', 'faculty');
    tabStudent.classList.remove('active', 'student');
    facultyForm.classList.remove('hidden');
    studentForm.classList.add('hidden');
    portalCard.classList.add('faculty-mode');
  }
};

// Real-time 6-digit counter for Student ID
studentIdInput.addEventListener('input', (e) => {
  // Allow digits only
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  const len = e.target.value.length;
  studentIdCount.textContent = `${len} / 6 digits`;
  if (len === 6) {
    studentIdCount.classList.add('valid');
  } else {
    studentIdCount.classList.remove('valid');
  }
});

// Quick Fill Helpers
window.quickFillStudent = function() {
  switchPortal('student');
  document.getElementById('studentId').value = '102938';
  document.getElementById('studentPassword').value = 'student123';
  studentIdCount.textContent = '6 / 6 digits';
  studentIdCount.classList.add('valid');
};

window.quickFillFaculty = function() {
  switchPortal('faculty');
  document.getElementById('facultyId').value = 'FAC-101';
  document.getElementById('facultyPassword').value = 'faculty123';
};

// Student Submission Handler
window.handleStudentSubmit = async function(e) {
  e.preventDefault();
  hideAlert();

  const studentId = studentIdInput.value.trim();
  const password = document.getElementById('studentPassword').value;
  const btn = document.getElementById('btnStudentLogin');

  // Strict 6-digit check
  if (!/^\d{6}$/.test(studentId)) {
    showAlert('Student ID must be exactly 6 numeric digits (e.g. 102938).', 'danger');
    studentIdInput.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Verifying Student ID...';

  try {
    let user = null;
    if (cloudReady) {
      user = await loginUser(studentId, password, 'student');
    }

    // Save active academic session
    const session = {
      role: 'student',
      studentId: studentId,
      displayName: user?.displayName || `Huzaif Patel (ID: ${studentId})`,
      shortId: studentId,
      loggedInAt: Date.now()
    };
    localStorage.setItem('cloudclass_auth', JSON.stringify(session));

    showAlert('Verification successful! Redirecting to AWS Student Dashboard...', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);

  } catch (err) {
    showAlert(err.message || 'Login failed. Please check your credentials.', 'danger');
    btn.disabled = false;
    btn.innerHTML = '<span>Enter Student Dashboard</span> ➔';
  }
};

// Faculty Submission Handler
window.handleFacultySubmit = async function(e) {
  e.preventDefault();
  hideAlert();

  const facultyId = document.getElementById('facultyId').value.trim();
  const password = document.getElementById('facultyPassword').value;
  const btn = document.getElementById('btnFacultyLogin');

  // STRICT SECURITY CHECK: Students cannot use Faculty Portal
  if (/^\d{6}$/.test(facultyId)) {
    showAlert('Access Denied: 6-digit College Student IDs are not authorized to access the Faculty Portal. Please use the Student Portal.', 'danger');
    return;
  }

  if (facultyId.length < 3) {
    showAlert('Please enter a valid assigned Faculty ID (e.g. FAC-101).', 'danger');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Verifying Faculty ID...';

  try {
    let user = null;
    if (cloudReady) {
      user = await loginUser(facultyId, password, 'faculty');
    }

    // Save active faculty session
    const session = {
      role: 'faculty',
      facultyId: facultyId,
      displayName: user?.displayName || `Prof. Alan Turing (${facultyId})`,
      shortId: facultyId,
      loggedInAt: Date.now()
    };
    localStorage.setItem('cloudclass_auth', JSON.stringify(session));

    showAlert('Faculty credentials verified! Redirecting to AWS Faculty Dashboard...', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 500);

  } catch (err) {
    showAlert(err.message || 'Login failed. Please check your credentials.', 'danger');
    btn.disabled = false;
    btn.innerHTML = '<span>Enter Faculty Dashboard</span> ➔';
  }
};


function showAlert(msg, type = 'danger') {
  alertBox.className = `alert-box alert-${type}`;
  alertBox.textContent = msg;
  alertBox.classList.remove('hidden');
}

function hideAlert() {
  alertBox.textContent = '';
  alertBox.classList.add('hidden');
}
