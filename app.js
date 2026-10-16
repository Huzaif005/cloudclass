/**
 * ============================================================================
 * CLOUDCLASS - FRONTEND APPLICATION SCRIPT
 * ============================================================================
 * Features:
 * - Dynamic actual date calculation (matches today's real date)
 * - Dynamic weekly strip with live deadline indicators
 * - Interactive Monthly Calendar view with assignment indicators
 * - Strict Role-Based Security: Students CANNOT access Faculty Dashboard
 * - AWS S3 submission uploads & REST API integration
 * ============================================================================
 */

import {
  cloudReady,
  auth,
  onAuthStateChanged,
  signOut,
  registerStudent,
  loginUser,
  getUserProfile,
  getSecureRole,
  watchAssignments,
  watchSubmissions,
  createCloudAssignment,
  uploadCloudSubmission
} from "./api-service.js";

// Helper: Calculate dates relative to today for demo data
const now = new Date();
function getIsoDate(offsetDays = 0) {
  const d = new Date(now);
  d.setDate(now.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function getDueLabel(offsetDays = 0, timeStr = "11:59 PM") {
  const d = new Date(now);
  d.setDate(now.getDate() + offsetDays);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${day} ${month}, ${timeStr}`;
}

let assignments = [
  { id: 1, title: "Relational Schema Normalization (3NF & BCNF)", subject: "Database Systems", code: "DBMS-202", due: getDueLabel(0, "5:00 PM"), date: getIsoDate(0), status: "pending", icon: "▤", tone: "orange", type: "PDF", points: "15 marks" },
  { id: 2, title: "Graph Traversal & Cycle Detection (BFS & DFS)", subject: "Data Structures", code: "DS-201", due: getDueLabel(1, "11:59 PM"), date: getIsoDate(1), status: "pending", icon: "⌘", tone: "teal", type: "PDF / DOCX", points: "10 marks" },
  { id: 3, title: "Cloud Service Models & AWS VPC Design", subject: "Cloud Computing", code: "CC-204", due: getDueLabel(3, "11:59 PM"), date: getIsoDate(3), status: "pending", icon: "☁", tone: "purple", type: "PDF / DOCX", points: "10 marks" },
  { id: 4, title: "Heuristic Search Algorithms Comparison", subject: "Artificial Intelligence", code: "AI-205", due: getDueLabel(5, "11:59 PM"), date: getIsoDate(5), status: "pending", icon: "✳", tone: "blue", type: "PDF", points: "10 marks" },
  { id: 5, title: "Data Preprocessing & Cleaning with Pandas", subject: "Data Science", code: "DSC-203", due: getDueLabel(7, "4:00 PM"), date: getIsoDate(7), status: "pending", icon: "⌁", tone: "pink", type: "IPYNB / PDF", points: "20 marks" },
  { id: 6, title: "ER Diagram & Conceptual Data Modeling", subject: "Database Systems", code: "DBMS-202", due: getDueLabel(-4, "11:59 PM"), date: getIsoDate(-4), status: "graded", icon: "▤", tone: "orange", type: "PDF", points: "9/10 marks" },
  { id: 7, title: "Stack and Queue Applications in Syntax Parsing", subject: "Data Structures", code: "DS-201", due: getDueLabel(-6, "5:00 PM"), date: getIsoDate(-6), status: "submitted", icon: "⌘", tone: "teal", type: "PDF", points: "10 marks" }
];

const demoAssignments = JSON.parse(JSON.stringify(assignments));
let currentFilter = "all";
let showAll = false;
let role = "student";
let currentView = "overview";
let toastTimer;
let cloudUser = null;
let cloudProfile = null;
let liveMode = false;
let cloudAssignmentsRaw = [];
let cloudSubmissionsRaw = [];
let stopAssignments = null;
let stopSubmissions = null;
let authFlowInProgress = false;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const statusLabel = (status) => ({ pending: "Pending", submitted: "Submitted", graded: "Graded", late: "Late" })[status] || status;
const formatDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

// =============================================================================
// ROLE AUTHENTICATION & SECURITY ENFORCEMENT
// =============================================================================
function getAuthRole() {
  try {
    const raw = localStorage.getItem('cloudclass_auth');
    if (raw) {
      const sess = JSON.parse(raw);
      return sess.role || 'student';
    }
  } catch (_) {}
  return 'student';
}

function enforceRoleSecurity() {
  const authRole = getAuthRole();
  const switcher = $(".role-switcher");

  if (authRole === 'student') {
    // Hide role switcher completely so students cannot access or preview faculty
    if (switcher) switcher.style.display = "none";
    if ($("#roleSelect")) {
      $("#roleSelect").value = "student";
      $("#roleSelect").disabled = true;
    }
  } else if (authRole === 'faculty') {
    // Allow faculty to preview if needed
    if (switcher) switcher.style.display = "flex";
    if ($("#roleSelect")) $("#roleSelect").disabled = false;
  }
}

function setRole(next) {
  const authRole = getAuthRole();

  // STRICT SECURITY CHECK: Block student from switching to faculty dashboard
  if (authRole === 'student' && next === 'faculty') {
    toast("Access Denied: Students are not authorized to access the Faculty Dashboard.");
    if ($("#roleSelect")) $("#roleSelect").value = 'student';
    return;
  }

  role = next;
  const faculty = role === "faculty";
  let authName = faculty ? "Prof. Alan Turing" : "Huzaif Patel";
  let authRoleDesc = faculty ? "Faculty account · Verified" : "Student account · Verified";
  let authWelcome = faculty ? 'Welcome back, Professor <span class="wave">👋</span>' : 'Good morning, Huzaif <span class="wave">👋</span>';

  try {
    const rawAuth = localStorage.getItem('cloudclass_auth');
    if (rawAuth) {
      const sess = JSON.parse(rawAuth);
      if (sess.role === 'student' && sess.studentId) {
        if (!faculty) {
          authName = `Student (ID: ${sess.studentId})`;
          authRoleDesc = `College ID: ${sess.studentId} · Student`;
          authWelcome = `Good morning, Student #${sess.studentId} <span class="wave">👋</span>`;
        }
      } else if (sess.role === 'faculty' && sess.facultyId) {
        if (faculty) {
          authName = `Prof. Alan Turing (${sess.facultyId})`;
          authRoleDesc = `Faculty ID: ${sess.facultyId} · Verified`;
          authWelcome = `Welcome back, Professor (${sess.facultyId}) <span class="wave">👋</span>`;
        }
      }
    }
  } catch (_) {}

  $("#sidebarName").textContent = authName;
  $("#sidebarRole").textContent = authRoleDesc;
  $("#welcomeTitle").innerHTML = authWelcome;
  $("#welcomeSubtitle").textContent = faculty ? "Here’s an overview of your classes and student submissions." : "Here’s what’s happening with your coursework today.";
  $("#primaryAction").innerHTML = faculty ? '<span>➕</span> Create assignment' : '<span>📥</span> Browse assignments';
  $("#statActive").innerHTML = faculty ? '06 <span class="stat-change neutral">published</span>' : '08 <span class="stat-change neutral">in progress</span>';
  $("#statSubmitted").innerHTML = faculty ? '42 <span class="stat-change positive">student uploads</span>' : '12 <span class="stat-change positive">⬆ 2 this week</span>';
  $("#statDue").innerHTML = faculty ? '18 <span class="stat-change warning">to review</span>' : '03 <span class="stat-change warning">needs attention</span>';
  $("#statScore").innerHTML = faculty ? '94<span class="value-suffix">%</span> <span class="stat-change positive">graded on time</span>' : '86<span class="value-suffix">%</span> <span class="stat-change positive">⬆ 4.5%</span>';
  $("#panelTitle").textContent = faculty ? "Assignments & submissions" : "Upcoming assignments";
  $("#panelSubtitle").textContent = faculty ? "Track student work and review submissions." : "Stay ahead of your deadlines.";
  $("#viewAllButton").textContent = faculty ? "Manage assignments ➔" : "View all ➔";

  enforceRoleSecurity();
  renderAssignments();
}

// =============================================================================
// DYNAMIC CALENDAR & REAL-TIME DATE CALCULATION
// =============================================================================
function updateTodayDateHeader() {
  const today = new Date();
  const weekday = today.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const day = today.getDate();
  const month = today.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const year = today.getFullYear();
  const dateStr = `${weekday}, ${day} ${month} ${year}`;

  const strEl = $("#todayDateStr");
  if (strEl) {
    strEl.textContent = dateStr;
  }
  const eyebrowEl = $("#todayEyebrow") || $(".eyebrow");
  if (eyebrowEl && !strEl) {
    eyebrowEl.innerHTML = `<span class="eyebrow-dot"></span> ${dateStr}`;
  }
}

function updateNextDeadline() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const pendingUpcoming = assignments
    .filter(a => a.status === 'pending')
    .sort((a, b) => {
      const dateA = a.date || (a.deadline ? a.deadline.slice(0, 10) : '9999-99-99');
      const dateB = b.date || (b.deadline ? b.deadline.slice(0, 10) : '9999-99-99');
      return dateA.localeCompare(dateB);
    });

  const textEl = $("#nextDeadlineText");
  if (!textEl) return;

  if (pendingUpcoming.length > 0) {
    const next = pendingUpcoming[0];
    textEl.textContent = `${next.subject} · Due ${next.due}`;
  } else {
    textEl.textContent = 'All caught up! No pending deadlines.';
  }
}

function renderWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const distToMon = (dayOfWeek + 6) % 7; // Distance to Monday of current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - distToMon);
  monday.setHours(0, 0, 0, 0);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const isToday = d.toDateString() === today.toDateString();
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const dateNum = d.getDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;

    const hasDeadline = assignments.some(a => {
      const aDate = a.date || (a.deadline ? a.deadline.slice(0, 10) : "");
      return aDate === isoDate;
    });

    weekDays.push({
      dayName,
      dateNum,
      isoDate,
      isToday,
      hasDeadline,
      fullDate: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    });
  }

  const strip = $("#weekStrip");
  if (!strip) return;

  strip.innerHTML = weekDays.map(item => `
    <button class="day-cell ${item.isToday ? "today" : ""} ${item.hasDeadline ? "has-deadline" : ""}" 
            data-date="${item.isoDate}" 
            data-day="${item.dayName}"
            data-fulldate="${item.fullDate}"
            title="${item.dayName}, ${item.fullDate} ${item.isToday ? '(Today)' : ''} ${item.hasDeadline ? '• Assignment deadline' : ''}">
      <span>${item.dayName}</span>
      <strong>${item.dateNum}</strong>
      <i class="day-dot"></i>
    </button>
  `).join("");

  // Attach click listener to each cell -> Jumps straight into interactive Calendar Workspace
  $$(".day-cell").forEach(b => {
    b.onclick = () => {
      const targetDate = b.dataset.date;
      selectedCalIso = targetDate;
      const parts = targetDate.split('-');
      activeCalYear = Number(parts[0]);
      activeCalMonth = Number(parts[1]) - 1;
      setView("calendar");
      renderCalendarWorkspace(activeCalYear, activeCalMonth, targetDate);
    };
  });

  updateNextDeadline();
}

// =============================================================================
// INTERACTIVE MONTHLY CALENDAR MODAL
// =============================================================================
let activeCalYear = new Date().getFullYear();
let activeCalMonth = new Date().getMonth();
let selectedCalIso = new Date().toISOString().slice(0, 10);

function renderCalendarWorkspace(year = activeCalYear, month = activeCalMonth, selectedDate = selectedCalIso) {
  activeCalYear = year;
  activeCalMonth = month;
  selectedCalIso = selectedDate;

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Update calendar header text
  if ($("#calMonthYearTitle")) {
    $("#calMonthYearTitle").textContent = `${monthNames[month]} ${year}`;
  }
  if ($("#calTodaySubtitle")) {
    const todayStr = today.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const pendingCount = assignments.filter(a => a.status === 'pending').length;
    $("#calTodaySubtitle").textContent = `Today is ${todayStr} • ${pendingCount} active assignment(s)`;
  }

  // Calculate day cells
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const numDays = lastDay.getDate();

  let startDay = firstDay.getDay();
  startDay = (startDay + 6) % 7; // Monday = 0

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  let daysHtml = '';

  // Leading days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const dNum = prevMonthLastDay - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    const prevIso = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    daysHtml += `
      <div class="cal-cell other-month" data-date="${prevIso}">
        <div class="cal-cell-top"><span class="cal-day-num">${dNum}</span></div>
      </div>
    `;
  }

  // Days of current month
  for (let day = 1; day <= numDays; day++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const isoDate = `${year}-${mm}-${dd}`;
    const isToday = isoDate === todayIso;
    const isSelected = isoDate === selectedCalIso;

    const matching = assignments.filter(a => {
      const aDate = a.date || (a.deadline ? a.deadline.slice(0, 10) : "");
      return aDate === isoDate;
    });

    const chipsHtml = matching.map(a => `
      <div class="cal-chip chip-${a.status}" title="${escapeHTML(a.subject)}: ${escapeHTML(a.title)} (${a.due})">
        <strong>${a.code}</strong> ${escapeHTML(a.title).slice(0, 16)}...
      </div>
    `).join("");

    daysHtml += `
      <div class="cal-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${isoDate}" data-day="${day}">
        <div class="cal-cell-top">
          <span class="cal-day-num">${day}</span>
          ${isToday ? `<span class="today-pill">TODAY</span>` : ''}
        </div>
        <div class="cal-chip-list">
          ${chipsHtml}
        </div>
      </div>
    `;
  }

  // Trailing days for grid completion
  const totalCells = startDay + numDays;
  const trailingDays = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailingDays; i++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const nextIso = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    daysHtml += `
      <div class="cal-cell other-month" data-date="${nextIso}">
        <div class="cal-cell-top"><span class="cal-day-num">${i}</span></div>
      </div>
    `;
  }

  const gridEl = $("#calDaysGrid");
  if (gridEl) gridEl.innerHTML = daysHtml;

  // Render detail card for selected date
  renderDayDetailCard(selectedCalIso);

  // Attach click listeners to cells
  $$(".cal-cell[data-date]").forEach(cell => {
    cell.onclick = () => {
      const targetDate = cell.dataset.date;
      $$(".cal-cell").forEach(c => c.classList.remove("is-selected"));
      cell.classList.add("is-selected");
      selectedCalIso = targetDate;
      renderDayDetailCard(targetDate);
    };
  });
}

function renderDayDetailCard(isoDate) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = isoDate === todayIso;

  const parts = isoDate.split("-");
  const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const fullDateLabel = dObj.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if ($("#dayDetailDateLabel")) $("#dayDetailDateLabel").textContent = fullDateLabel;
  if ($("#dayDetailTodayTag")) $("#dayDetailTodayTag").classList.toggle("hidden", !isToday);

  const matching = assignments.filter(a => {
    const aDate = a.date || (a.deadline ? a.deadline.slice(0, 10) : "");
    return aDate === isoDate;
  });

  const bodyEl = $("#dayDetailBody");
  if (!bodyEl) return;

  if (matching.length === 0) {
    bodyEl.innerHTML = `
      <div class="day-empty-state">
        <div class="day-empty-icon">▦</div>
        <strong>No deadlines scheduled</strong>
        <p>${isToday ? "You have no assignments due today! Enjoy your day or work ahead." : "No course deadlines scheduled on this date."}</p>
      </div>
    `;
    return;
  }

  const authRole = getAuthRole();
  bodyEl.innerHTML = matching.map(a => `
    <article class="day-assignment-card">
      <div class="day-assignment-top">
        <div>
          <h4 class="day-assignment-title">${escapeHTML(a.title)}</h4>
          <span class="day-assignment-subject">${escapeHTML(a.subject)} • ${a.code}</span>
        </div>
        <span class="status-pill status-${a.status}">${statusLabel(a.status)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="day-assignment-due">⏰ ${a.due}</span>
        <span class="day-assignment-points">${a.points}</span>
      </div>
      ${a.instructions ? `<p class="day-assignment-desc">${escapeHTML(a.instructions)}</p>` : ''}
      ${
        authRole === 'faculty'
          ? `<button class="day-assignment-submit-btn" data-action="review" data-id="${a.id}">Review submissions ↗</button>`
          : a.status === 'pending'
          ? `<button class="day-assignment-submit-btn" data-action="submit" data-id="${a.id}">Submit assignment ↗</button>`
          : `<span style="font-size:11px;color:#28a979;font-weight:700">✓ Submitted</span>`
      }
    </article>
  `).join("");

  // Attach button actions in inspector card
  bodyEl.querySelectorAll("[data-action]").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'submit') {
        openSubmit(id);
      } else if (action === 'review') {
        if (getAuthRole() !== 'faculty') {
          toast("Access Denied: Only faculty can review submissions.");
          return;
        }
        openReview(id);
      }
    };
  });
}

// Calendar Month Navigation Buttons
$("#calWorkspacePrev")?.addEventListener("click", () => {
  activeCalMonth--;
  if (activeCalMonth < 0) { activeCalMonth = 11; activeCalYear--; }
  renderCalendarWorkspace(activeCalYear, activeCalMonth);
});

$("#calWorkspaceNext")?.addEventListener("click", () => {
  activeCalMonth++;
  if (activeCalMonth > 11) { activeCalMonth = 0; activeCalYear++; }
  renderCalendarWorkspace(activeCalYear, activeCalMonth);
});

$("#calWorkspaceToday")?.addEventListener("click", () => {
  const today = new Date();
  activeCalYear = today.getFullYear();
  activeCalMonth = today.getMonth();
  selectedCalIso = today.toISOString().slice(0, 10);
  renderCalendarWorkspace(activeCalYear, activeCalMonth, selectedCalIso);
  toast("Jumped to today's date.");
});

// =============================================================================
// ASSIGNMENT RENDERING & VIEWS
// =============================================================================
function renderAssignments() {
  const list = $("#assignmentList");
  if (!list) return;

  let data = assignments.filter(a => currentFilter === "all" || a.status === currentFilter);
  if (!showAll) data = data.slice(0, 5);

  const authRole = getAuthRole();

  list.innerHTML = data.map(a => `
    <article class="assignment-row">
      <div class="subject-icon ${a.tone}">${a.icon}</div>
      <div class="assignment-main">
        <h3>${escapeHTML(a.title)}</h3>
        <div class="assignment-meta">
          <span>${escapeHTML(a.subject)}</span>
          <i class="meta-separator"></i>
          <span>${a.code}</span>
          <i class="meta-separator"></i>
          <span>${a.points}</span>
        </div>
      </div>
      <div class="assignment-side">
        <span class="status-pill status-${a.status}">${statusLabel(a.status)}</span>
        ${
          authRole === "faculty" && a.submissionCount > 0
            ? `<button class="row-action" data-action="view" data-id="${a.id}">Review (${a.submissionCount}) →</button>`
            : a.status === "pending"
            ? `<button class="row-action" data-action="submit" data-id="${a.id}">Submit →</button>`
            : `<span class="due-text ${a.status === "pending" ? "urgent" : ""}">${a.status === "pending" ? "Due " : ""}${formatDate(a.date)}</span>`
        }
      </div>
    </article>
  `).join("");

  $("#emptyState")?.classList.toggle("hidden", data.length > 0);
  $("#loadMore")?.classList.toggle("hidden", data.length === 0 || data.length < 5 || currentFilter !== "all");
  if ($("#loadMore")) {
    $("#loadMore").innerHTML = showAll ? 'Show fewer <span>↑</span>' : 'Show all assignments <span>↓</span>';
  }
  $$(".filter-pill").forEach(b => b.classList.toggle("selected", b.dataset.filter === currentFilter));
}

function setView(view) {
  currentView = view;
  const labels = {
    overview: "Overview",
    assignments: "Assignments",
    submissions: "My submissions",
    calendar: "Calendar",
    resources: "Resources"
  };

  if ($("#breadcrumbCurrent")) $("#breadcrumbCurrent").textContent = labels[view] || "Overview";
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));

  const overviewEl = $("#overviewSection");
  const calendarEl = $("#calendarSection");

  if (view === "calendar") {
    if (overviewEl) overviewEl.classList.add("hidden");
    if (calendarEl) calendarEl.classList.remove("hidden");
    renderCalendarWorkspace();
  } else {
    if (calendarEl) calendarEl.classList.add("hidden");
    if (overviewEl) overviewEl.classList.remove("hidden");

    if (view === "assignments") {
      currentFilter = "all";
      showAll = true;
      renderAssignments();
      if ($("#panelTitle")) $("#panelTitle").textContent = role === "faculty" ? "Assignments & submissions" : "All assignments";
      if ($("#panelSubtitle")) $("#panelSubtitle").textContent = "Browse coursework by subject, deadline, and status.";
    } else if (view === "submissions") {
      currentFilter = "submitted";
      showAll = true;
      renderAssignments();
      if ($("#panelTitle")) $("#panelTitle").textContent = "My submissions";
      if ($("#panelSubtitle")) $("#panelSubtitle").textContent = "Files you have already submitted.";
    } else if (view === "resources") {
      openResources();
    } else {
      currentFilter = "all";
      showAll = false;
      renderAssignments();
      renderWeek();
    }
  }
  $("#sidebar")?.classList.remove("open");
}

function openModal(title, body) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  $("#modalBackdrop").classList.remove("hidden");
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
}

// =============================================================================
// MODAL ACTIONS: SUBMIT & CREATE
// =============================================================================
function openSubmit(id) {
  const a = assignments.find(x => String(x.id) === String(id));
  if (!a) return;

  openModal("Submit assignment", `
    <div class="assignment-detail">
      <div class="subject-icon ${a.tone}">${a.icon}</div>
      <div>
        <strong>${escapeHTML(a.title)}</strong>
        <p>${escapeHTML(a.subject)} · Due ${a.due}</p>
      </div>
    </div>
    <form id="submitForm" class="modal-form">
      <div class="form-field">
        <label for="studentNote">Comment for faculty (optional)</label>
        <textarea id="studentNote" placeholder="Add a note about your submission..."></textarea>
      </div>
      <div class="upload-drop">
        <div style="font-size:27px">☁</div>
        <strong>Choose your assignment file</strong>
        <p>PDF, DOCX or ZIP · Maximum 25 MB</p>
        <input id="assignmentFile" type="file" accept=".pdf,.doc,.docx,.zip" required />
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-button" id="cancelModal">Cancel</button>
        <button class="modal-primary" type="submit">Upload submission ↗</button>
      </div>
    </form>
  `);

  $("#cancelModal").onclick = closeModal;

  $("#submitForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = $("#assignmentFile").files[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast("File is larger than 25 MB. Choose a smaller file.");
      return;
    }
    const allowed = ["pdf", "doc", "docx", "zip"];
    const ext = f.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      toast("Please choose a PDF, DOC, DOCX, or ZIP file.");
      return;
    }

    if (liveMode && cloudUser) {
      const submitButton = $("#submitForm").querySelector("[type=submit]");
      submitButton.disabled = true;
      submitButton.textContent = "Uploading to AWS S3…";
      try {
        await uploadCloudSubmission({ assignment: a, file: f, note: $("#studentNote").value, user: cloudUser });
        closeModal();
        toast("Uploaded to AWS S3. Faculty will see the submission live.");
      } catch (err) {
        console.error(err);
        toast("Upload failed: " + friendlyError(err));
        submitButton.disabled = false;
        submitButton.textContent = "Upload submission ↗";
      }
      return;
    }

    a.status = "submitted";
    a.fileName = f.name;
    closeModal();
    renderAssignments();
    renderWeek();
    toast("Submission recorded successfully.");
  };
}

function openCreate() {
  // STRICT GUARD: Block students
  if (getAuthRole() !== "faculty") {
    toast("Access Denied: Only faculty members can create assignments.");
    return;
  }

  openModal("Create new assignment", `
    <form id="createForm" class="modal-form">
      <div class="form-field">
        <label for="assignmentTitle">Assignment title</label>
        <input id="assignmentTitle" required placeholder="e.g. Cloud architecture report"/>
      </div>
      <div class="form-field">
        <label for="assignmentSubject">Subject</label>
        <select id="assignmentSubject">
          <option>Cloud Computing</option>
          <option>Database Systems</option>
          <option>Data Structures</option>
          <option>Artificial Intelligence</option>
          <option>Data Science</option>
        </select>
      </div>
      <div class="form-field">
        <label for="assignmentDue">Deadline</label>
        <input id="assignmentDue" type="datetime-local" required/>
      </div>
      <div class="form-field">
        <label for="assignmentDesc">Instructions</label>
        <textarea id="assignmentDesc" placeholder="Add submission guidelines and requirements..."></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-button" id="cancelModal">Cancel</button>
        <button class="modal-primary" type="submit">Publish assignment ↗</button>
      </div>
    </form>
  `);

  $("#cancelModal").onclick = closeModal;

  $("#createForm").onsubmit = async (e) => {
    e.preventDefault();
    const title = $("#assignmentTitle").value.trim();
    const subject = $("#assignmentSubject").value;
    const due = $("#assignmentDue").value;
    const instructions = $("#assignmentDesc").value.trim();
    if (!title || !due) return;
    const date = new Date(due);
    const iso = date.toISOString();

    if (liveMode && cloudUser && cloudProfile?.role === "faculty") {
      const submitButton = $("#createForm").querySelector("[type=submit]");
      submitButton.disabled = true;
      submitButton.textContent = "Publishing…";
      try {
        await createCloudAssignment({
          title,
          subject,
          instructions,
          deadline: iso,
          code: subject.slice(0, 2).toUpperCase() + "-" + Date.now().toString().slice(-4),
          points: "10 marks"
        }, cloudUser);
        closeModal();
        toast("Published to AWS. Students will see it in real time.");
      } catch (err) {
        console.error(err);
        toast("Could not publish: " + friendlyError(err));
        submitButton.disabled = false;
        submitButton.textContent = "Publish assignment ↗";
      }
      return;
    }

    assignments.unshift({
      id: Date.now(),
      title,
      subject,
      code: "NEW-001",
      due: date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
      date: iso.slice(0, 10),
      status: "pending",
      icon: "▤",
      tone: "purple",
      type: "PDF / DOCX",
      points: "10 marks"
    });

    closeModal();
    currentFilter = "all";
    showAll = true;
    renderAssignments();
    renderWeek();
    toast("Assignment published successfully.");
  };
}

function openReview(id) {
  // STRICT GUARD: Block students
  if (getAuthRole() !== "faculty") {
    toast("Access Denied: Only faculty members can review student submissions.");
    return;
  }

  const a = assignments.find(x => String(x.id) === String(id));
  if (!a) return;

  const rows = cloudSubmissionsRaw.filter(s => String(s.assignmentId) === String(id));

  openModal("Review submissions", `
    <div class="assignment-detail">
      <div class="subject-icon ${a.tone}">${a.icon}</div>
      <div>
        <strong>${escapeHTML(a.title)}</strong>
        <p>${escapeHTML(a.subject)} · ${rows.length} submission(s)</p>
      </div>
    </div>
    ${
      rows.length
        ? `<div class="submission-review-list">
            ${rows.map(s => `
              <div class="submission-review">
                <div class="activity-icon ${s.status === "rejected" ? "activity-amber" : "activity-green"}">
                  ${s.status === "rejected" ? "⚠" : "↥"}
                </div>
                <div class="review-copy">
                  <strong>${escapeHTML(s.studentName || s.studentEmail || "Student")}</strong>
                  <small>${escapeHTML(s.fileName || "Uploaded file")} · ${new Date(s.submittedAt).toLocaleString()}</small>
                  ${s.note ? `<small>Note: ${escapeHTML(s.note)}</small>` : ""}
                  ${s.status === "rejected" ? `<small style="color:#ef4444;font-weight:600">Blocked: ${escapeHTML(s.rejectionReason || "Unsafe file")}</small>` : s.verified ? `<small style="color:#10b981;font-weight:600">✓ Security Verified</small>` : ""}
                </div>
                ${s.status === "rejected" ? `<span class="due-text urgent">Rejected</span>` : `<a href="${escapeHTML(s.downloadURL || "#")}" target="_blank" rel="noopener">Download ↗</a>`}
              </div>
            `).join("")}
          </div>`
        : `<p class="cloud-note">No students have submitted this assignment yet. This list updates automatically when a student uploads a file.</p>`
    }
    <div class="modal-actions">
      <button class="modal-primary" id="cancelModal">Done</button>
    </div>
  `);

  $("#cancelModal").onclick = closeModal;
}

function openResources() {
  openModal("Learning resources", `
    <div class="resource-list">
      <button class="resource-row" data-resource="Cloud computing notes">
        <span class="resource-symbol purple">☁</span>
        <span><strong>Cloud computing notes</strong><small>PDF · Core concepts and service models</small></span>
        <span>↗</span>
      </button>
      <button class="resource-row" data-resource="Submission guidelines">
        <span class="resource-symbol teal">✓</span>
        <span><strong>Submission guidelines</strong><small>Document · Formatting and file rules</small></span>
        <span>↗</span>
      </button>
      <button class="resource-row" data-resource="Academic calendar">
        <span class="resource-symbol orange">▦</span>
        <span><strong>Academic calendar</strong><small>Calendar · Important dates and holidays</small></span>
        <span>↗</span>
      </button>
    </div>
    <p class="resource-note">Course resources are synchronized with AWS Cloud Storage.</p>
  `);
  $$(".resource-row").forEach(b => b.onclick = () => toast(`${b.dataset.resource}: resource selected.`));
}

// Event Listeners
$$(".nav-item").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
$$(".filter-pill").forEach(b => b.addEventListener("click", () => { currentFilter = b.dataset.filter; showAll = false; renderAssignments(); }));
$("#loadMore")?.addEventListener("click", () => { showAll = !showAll; renderAssignments(); });
$("#viewAllButton")?.addEventListener("click", () => setView("assignments"));

$("#primaryAction")?.addEventListener("click", () => {
  if (role === "faculty" && getAuthRole() === "faculty") {
    openCreate();
  } else {
    setView("assignments");
  }
});

$("#roleSelect")?.addEventListener("change", e => {
  const chosen = e.target.value;
  if (getAuthRole() === "student" && chosen === "faculty") {
    toast("Access Denied: Students are not authorized to access the Faculty Dashboard.");
    e.target.value = "student";
    return;
  }
  setRole(chosen);
  toast(`Switched to ${chosen} view.`);
});

$("#assignmentList")?.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "submit") {
    openSubmit(b.dataset.id);
  } else {
    if (getAuthRole() !== "faculty") {
      toast("Access Denied: Only faculty can review submissions.");
      return;
    }
    openReview(b.dataset.id);
  }
});

$("#modalClose")?.addEventListener("click", closeModal);
$("#modalBackdrop")?.addEventListener("click", e => { if (e.target === $("#modalBackdrop")) closeModal(); });
$("#mobileMenu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
$("#searchOpen")?.addEventListener("click", () => { $("#searchOverlay")?.classList.remove("hidden"); $("#searchInput")?.focus(); });
$("#searchClose")?.addEventListener("click", () => $("#searchOverlay")?.classList.add("hidden"));
$("#searchOverlay")?.addEventListener("click", e => { if (e.target === $("#searchOverlay")) $("#searchOverlay")?.classList.add("hidden"); });

$("#searchInput")?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  currentFilter = "all";
  showAll = true;
  renderAssignments();
  if (q) {
    const filtered = assignments.filter(a => (a.title + " " + a.subject + " " + a.code).toLowerCase().includes(q));
    $("#assignmentList").innerHTML = filtered.map(a => `
      <article class="assignment-row">
        <div class="subject-icon ${a.tone}">${a.icon}</div>
        <div class="assignment-main">
          <h3>${escapeHTML(a.title)}</h3>
          <div class="assignment-meta">
            <span>${escapeHTML(a.subject)}</span>
            <i class="meta-separator"></i>
            <span>${a.code}</span>
          </div>
        </div>
        <div class="assignment-side">
          <span class="status-pill status-${a.status}">${statusLabel(a.status)}</span>
          <span class="due-text">${formatDate(a.date)}</span>
        </div>
      </article>
    `).join("");
    $("#emptyState")?.classList.toggle("hidden", filtered.length > 0);
  }
});

$("#notificationButton")?.addEventListener("click", () => toast("You’re all caught up — no new notifications."));
$("#profileMenu")?.addEventListener("click", () => { window.location.href = 'login.html'; });

$("#helpButton")?.addEventListener("click", () => openModal("Help & support", `
  <p style="color:#777b91;line-height:1.7;font-size:12px">
    Need help with CloudClass? In this workspace, you can explore assignment lists, view your personal gradebook, submit assignments to AWS S3, and track deadlines with the live calendar.
  </p>
  <div class="deadline-highlight">
    <div class="deadline-symbol">ⓘ</div>
    <div><strong>Project setup</strong><p>See README.md for AWS configuration and deployment steps.</p></div>
  </div>
  <div class="modal-actions"><button class="modal-primary" id="cancelModal">Got it</button></div>
`));
$("#modalBody")?.querySelector("#cancelModal")?.addEventListener("click", closeModal);

$("#tipsButton")?.addEventListener("click", () => openModal("Study & submission tips", `
  <div class="tips-list">
    <p><b>01</b> Start early. Break large assignments into smaller tasks.</p>
    <p><b>02</b> Name files clearly: Subject_AssignmentName_RollNo.pdf.</p>
    <p><b>03</b> Open your final file once before uploading to check it.</p>
    <p><b>04</b> Keep a backup until your submission is confirmed.</p>
  </div>
  <div class="modal-actions"><button class="modal-primary" id="cancelModal">Sounds good</button></div>
`));
$("#modalBody")?.querySelector("#cancelModal")?.addEventListener("click", closeModal);

$("#activityViewAll")?.addEventListener("click", () => toast("Recent activity view selected."));
$("#sortButton")?.addEventListener("click", () => { assignments.reverse(); renderAssignments(); toast("Assignment order updated."); });

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); $("#searchOverlay")?.classList.add("hidden"); $("#sidebar")?.classList.remove("open"); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    $("#searchOverlay")?.classList.remove("hidden");
    $("#searchInput")?.focus();
  }
});

function friendlyError(err) { return err?.message || "please check AWS configuration."; }

function setCloudStatus(isLive, label) {
  const el = $("#cloudStatus");
  if (!el) return;
  el.classList.toggle("live", isLive);
  el.classList.toggle("demo", !isLive);
  el.innerHTML = `<i></i> ${label}`;
  if ($("#cloudConnect")) $("#cloudConnect").textContent = isLive ? "Sign out" : "Connect cloud";
}

function mapCloudAssignment(raw) {
  const deadlineValue = raw.deadline ? new Date(raw.deadline) : new Date(Date.now());
  const iso = Number.isNaN(deadlineValue.getTime()) ? new Date().toISOString() : deadlineValue.toISOString();
  const submissionRows = cloudSubmissionsRaw.filter(s => String(s.assignmentId) === String(raw.id));
  let status = "pending";

  if (role === "faculty") {
    status = submissionRows.length ? "submitted" : "pending";
  } else {
    const mine = submissionRows.filter(s => s.studentId === cloudUser?.studentId || s.userId === cloudUser?.userId).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
    status = mine?.status || "pending";
  }

  return {
    id: raw.id,
    title: raw.title || "Untitled assignment",
    subject: raw.subject || "General",
    code: raw.code || "CLOUD",
    due: deadlineValue.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    date: iso.slice(0, 10),
    status,
    icon: ({ "Cloud Computing": "☁", "Database Systems": "▤", "Data Structures": "⌘", "Artificial Intelligence": "✳", "Data Science": "⌁" })[raw.subject] || "▤",
    tone: ({ "Cloud Computing": "purple", "Database Systems": "orange", "Data Structures": "teal", "Artificial Intelligence": "blue", "Data Science": "pink" })[raw.subject] || "purple",
    type: "PDF / DOCX",
    points: raw.points || "10 marks",
    instructions: raw.instructions || "",
    submissionCount: submissionRows.length
  };
}

function refreshLiveAssignments() {
  if (!liveMode) return;
  assignments = cloudAssignmentsRaw.map(mapCloudAssignment);
  if ($("#statActive")) $("#statActive").innerHTML = `${String(assignments.filter(a => a.status === "pending").length).padStart(2, "0")} <span class="stat-change neutral">in progress</span>`;
  if ($("#statSubmitted")) $("#statSubmitted").innerHTML = `${String(cloudSubmissionsRaw.length).padStart(2, "0")} <span class="stat-change positive">live uploads</span>`;
  if ($("#statDue")) $("#statDue").innerHTML = `${String(assignments.filter(a => a.status === "pending" && a.date >= new Date().toISOString().slice(0, 10)).length).padStart(2, "0")} <span class="stat-change warning">needs attention</span>`;
  if ($("#navAssignmentCount")) $("#navAssignmentCount").textContent = assignments.length;
  renderAssignments();
  renderWeek();
}

function startLiveListeners() {
  stopAssignments?.();
  stopSubmissions?.();
  stopAssignments = watchAssignments(data => { cloudAssignmentsRaw = data; refreshLiveAssignments(); }, err => console.error(err));
  stopSubmissions = watchSubmissions(cloudUser, cloudProfile?.role, data => { cloudSubmissionsRaw = data; refreshLiveAssignments(); }, err => console.error(err));
}

async function activateCloudUser(user) {
  stopAssignments?.();
  stopSubmissions?.();
  if (!user) {
    liveMode = false;
    cloudProfile = null;
    cloudAssignmentsRaw = [];
    cloudSubmissionsRaw = [];
    assignments = JSON.parse(JSON.stringify(demoAssignments));
    setCloudStatus(false, "Demo mode");
    setRole(getAuthRole());
    return;
  }
  try {
    cloudProfile = await getUserProfile(user.userId || user.uid);
    cloudUser = user;
    liveMode = true;
    const secureRole = await getSecureRole(user);
    role = secureRole || cloudProfile?.role || "student";
    if (cloudProfile) cloudProfile.role = role;
    setRole(role);
    setCloudStatus(true, "AWS Cloud (Live)");
    startLiveListeners();
  } catch (err) {
    console.error(err);
    toast("Could not load profile: " + friendlyError(err));
  }
}

function openCloudConnect() {
  if (cloudUser) {
    signOut().then(() => toast("Signed out from AWS Cloud.")).catch(err => toast(friendlyError(err)));
    return;
  }
  openModal("Connect to AWS CloudClass", `
    <p class="cloud-note">Sign in to sync assignments and uploads across devices via AWS S3 and REST API.</p>
    <div class="modal-form">
      <div class="form-field">
        <label for="cloudEmail">Identifier / College ID / Email</label>
        <input id="cloudEmail" type="text" required placeholder="e.g. 102938 or FAC-101" autocomplete="username"/>
      </div>
      <div class="form-field">
        <label for="cloudPassword">Password</label>
        <input id="cloudPassword" type="password" required minlength="4" placeholder="Enter password" autocomplete="current-password"/>
      </div>
      <div class="modal-actions" style="justify-content:space-between">
        <a href="login.html" class="secondary-button">Go to Portal Sign In</a>
        <button class="modal-primary" id="cloudLogin">Sign in ↗</button>
      </div>
    </div>
  `);

  $("#cloudLogin").onclick = async () => {
    const email = $("#cloudEmail").value.trim(), password = $("#cloudPassword").value;
    if (!email || !password) {
      toast("Please complete all required fields.");
      return;
    }
    const btn = $("#cloudLogin");
    btn.disabled = true;
    btn.textContent = "Connecting to AWS…";
    try {
      authFlowInProgress = true;
      const user = await loginUser(email, password);
      authFlowInProgress = false;
      await activateCloudUser(user);
      closeModal();
      toast("Connected to AWS Cloud. Live data enabled.");
    } catch (err) {
      authFlowInProgress = false;
      console.error(err);
      toast(friendlyError(err));
      btn.disabled = false;
      btn.textContent = "Sign in ↗";
    }
  };
}

$("#cloudConnect")?.addEventListener("click", openCloudConnect);

if (cloudReady) {
  setCloudStatus(false, "AWS Cloud Ready");
  onAuthStateChanged(auth, async user => {
    cloudUser = user;
    stopAssignments?.();
    stopSubmissions?.();
    if (authFlowInProgress) return;
    await activateCloudUser(user);
  });
} else {
  setCloudStatus(false, "Demo mode");
}

// =============================================================================
// ACADEMIC ID AUTH INITIALIZATION & SECURITY LOCKING
// =============================================================================
function initAcademicAuth() {
  try {
    const raw = localStorage.getItem('cloudclass_auth');
    if (raw) {
      const session = JSON.parse(raw);
      if (session.role === 'student' && session.studentId) {
        setRole('student');
        enforceRoleSecurity();

        const connectBtn = $("#cloudConnect");
        if (connectBtn) {
          connectBtn.textContent = `ID: ${session.studentId} (Sign out)`;
          connectBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            localStorage.removeItem('cloudclass_auth');
            localStorage.removeItem('cloudclass_jwt');
            localStorage.removeItem('cloudclass_user');
            window.location.href = 'login.html';
          };
        }
      } else if (session.role === 'faculty' && session.facultyId) {
        setRole('faculty');
        enforceRoleSecurity();

        const connectBtn = $("#cloudConnect");
        if (connectBtn) {
          connectBtn.textContent = `${session.facultyId} (Sign out)`;
          connectBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            localStorage.removeItem('cloudclass_auth');
            localStorage.removeItem('cloudclass_jwt');
            localStorage.removeItem('cloudclass_user');
            window.location.href = 'login.html';
          };
        }
      }
    } else {
      // Default guest: student mode, role-switcher hidden
      setRole('student');
      enforceRoleSecurity();

      const connectBtn = $("#cloudConnect");
      if (connectBtn && !cloudUser) {
        connectBtn.textContent = "Portal Sign In";
        connectBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = 'login.html';
        };
      }
    }
  } catch (err) {
    console.error("[AcademicAuth] Error reading session:", err);
  }

  const profileMenu = $("#profileMenu");
  if (profileMenu) {
    profileMenu.title = "Switch account or sign in";
    profileMenu.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'login.html';
    };
  }
}

// Initial boot: Establish identity & role security before rendering views
initAcademicAuth();
updateTodayDateHeader();
renderWeek();
renderAssignments();
