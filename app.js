import { cloudReady, auth, onAuthStateChanged, signOut, registerStudent, loginUser, getUserProfile, watchAssignments, watchSubmissions, createCloudAssignment, uploadCloudSubmission } from "./firebase-service.js";

let assignments = [
  {id:1,title:"Cloud Service Models & Deployment",subject:"Cloud Computing",code:"CC-204",due:"15 Oct, 11:59 PM",date:"2026-10-15",status:"pending",icon:"☁",tone:"purple",type:"PDF / DOCX",points:"10 marks"},
  {id:2,title:"Normalization & SQL Queries",subject:"Database Systems",code:"DBMS-202",due:"16 Oct, 5:00 PM",date:"2026-10-16",status:"pending",icon:"▤",tone:"orange",type:"PDF",points:"15 marks"},
  {id:3,title:"Graph Traversal: BFS and DFS",subject:"Data Structures",code:"DS-201",due:"17 Oct, 11:59 PM",date:"2026-10-17",status:"submitted",icon:"⌘",tone:"teal",type:"PDF / DOCX",points:"10 marks"},
  {id:4,title:"Search Algorithms Comparison",subject:"Artificial Intelligence",code:"AI-205",due:"19 Oct, 11:59 PM",date:"2026-10-19",status:"submitted",icon:"✳",tone:"blue",type:"PDF",points:"10 marks"},
  {id:5,title:"Data Preprocessing with Python",subject:"Data Science",code:"DSC-203",due:"21 Oct, 4:00 PM",date:"2026-10-21",status:"pending",icon:"⌁",tone:"pink",type:"IPYNB / PDF",points:"20 marks"},
  {id:6,title:"ER Diagram & Relational Schema",subject:"Database Systems",code:"DBMS-202",due:"10 Oct, 11:59 PM",date:"2026-10-10",status:"graded",icon:"▤",tone:"orange",type:"PDF",points:"9/10 marks"},
  {id:7,title:"Stack and Queue Applications",subject:"Data Structures",code:"DS-201",due:"9 Oct, 5:00 PM",date:"2026-10-09",status:"submitted",icon:"⌘",tone:"teal",type:"PDF",points:"10 marks"},
  {id:8,title:"Introduction to Neural Networks",subject:"Artificial Intelligence",code:"AI-205",due:"8 Oct, 11:59 PM",date:"2026-10-08",status:"submitted",icon:"✳",tone:"blue",type:"PDF",points:"10 marks"}
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
const statusLabel = (status) => ({pending:"Pending",submitted:"Submitted",graded:"Graded"})[status] || status;
const formatDate = (iso) => new Date(iso+"T12:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"});
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800);}
function renderAssignments(){
  const list=$("#assignmentList");
  let data=assignments.filter(a=>currentFilter==="all"||a.status===currentFilter);
  if(!showAll) data=data.slice(0,5);
  list.innerHTML=data.map(a=>`
    <article class="assignment-row">
      <div class="subject-icon ${a.tone}">${a.icon}</div>
      <div class="assignment-main"><h3>${escapeHTML(a.title)}</h3><div class="assignment-meta"><span>${escapeHTML(a.subject)}</span><i class="meta-separator"></i><span>${a.code}</span><i class="meta-separator"></i><span>${a.points}</span></div></div>
      <div class="assignment-side"><span class="status-pill status-${a.status}">${statusLabel(a.status)}</span>${role==="faculty"&&a.submissionCount>0?`<button class="row-action" data-action="view" data-id="${a.id}">Review (${a.submissionCount}) →</button>`:role==="student"&&a.status==="pending"?`<button class="row-action" data-action="submit" data-id="${a.id}">Submit →</button>`:`<span class="due-text ${a.status==="pending"?"urgent":""}">${a.status==="pending"?"Due ":""}${formatDate(a.date)}</span>`}</div>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden",data.length>0);
  $("#loadMore").classList.toggle("hidden",data.length===0||data.length<5||currentFilter!=="all");
  $("#loadMore").innerHTML=showAll?'Show fewer <span>↑</span>':'Show all assignments <span>↓</span>';
  $$(".filter-pill").forEach(b=>b.classList.toggle("selected",b.dataset.filter===currentFilter));
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderWeek(){
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const nums=[12,13,14,15,16,17,18];
  $("#weekStrip").innerHTML=days.map((d,i)=>`<button class="day-cell ${i===1?"today":""} ${[3,4,5].includes(i)?"has-deadline":""}" data-day="${d}"><span>${d}</span><strong>${nums[i]}</strong><i class="day-dot"></i></button>`).join("");
}
function setRole(next){
  role=next;
  const faculty=role==="faculty";
  $("#sidebarName").textContent=faculty?"Prof. Meera Shah":"Huzaif Patel";
  $("#sidebarRole").textContent=faculty?"Faculty account":"Student account";
  $("#welcomeTitle").innerHTML=faculty?'Welcome back, Professor <span class="wave">✦</span>':'Good morning, Huzaif <span class="wave">✦</span>';
  $("#welcomeSubtitle").textContent=faculty?"Here’s an overview of your classes and student submissions.":"Here’s what’s happening with your coursework today.";
  $("#primaryAction").innerHTML=faculty?'<span>＋</span> Create assignment':'<span>＋</span> Browse assignments';
  $("#statActive").innerHTML=faculty?'06 <span class="stat-change neutral">published</span>':'08 <span class="stat-change neutral">in progress</span>';
  $("#statSubmitted").innerHTML=faculty?'42 <span class="stat-change positive">student uploads</span>':'12 <span class="stat-change positive">↑ 2 this week</span>';
  $("#statDue").innerHTML=faculty?'18 <span class="stat-change warning">to review</span>':'03 <span class="stat-change warning">needs attention</span>';
  $("#statScore").innerHTML=faculty?'94<span class="value-suffix">%</span> <span class="stat-change positive">graded on time</span>':'86<span class="value-suffix">%</span> <span class="stat-change positive">↑ 4.5%</span>';
  $("#panelTitle").textContent=faculty?"Assignments & submissions":"Upcoming assignments";
  $("#panelSubtitle").textContent=faculty?"Track student work and review submissions.":"Stay ahead of your deadlines.";
  $("#viewAllButton").textContent=faculty?"Manage assignments →":"View all →";
  renderAssignments();
}
function setView(view){
  currentView=view;
  const labels={overview:"Overview",assignments:"Assignments",submissions:"My submissions",calendar:"Calendar",resources:"Resources"};
  $("#breadcrumbCurrent").textContent=labels[view]||"Overview";
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  if(view==="assignments"){currentFilter="all";showAll=true;renderAssignments();$("#panelTitle").textContent=role==="faculty"?"Assignments & submissions":"All assignments";$("#panelSubtitle").textContent="Browse coursework by subject, deadline, and status.";}
  else if(view==="submissions"){currentFilter="submitted";showAll=true;renderAssignments();$("#panelTitle").textContent="My submissions";$("#panelSubtitle").textContent="Files you have already submitted.";}
  else if(view==="calendar"){toast("Calendar view selected — deadlines are shown in the weekly overview.");}
  else if(view==="resources"){openResources();}
  else {currentFilter="all";showAll=false;setRole(role);}
  $("#sidebar").classList.remove("open");
}
function openModal(title,body){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=body;$("#modalBackdrop").classList.remove("hidden");}
function closeModal(){$("#modalBackdrop").classList.add("hidden");}
function openSubmit(id){
  const a=assignments.find(x=>String(x.id)===String(id));
  if(!a)return;
  openModal("Submit assignment",`<div class="assignment-detail"><div class="subject-icon ${a.tone}">${a.icon}</div><div><strong>${escapeHTML(a.title)}</strong><p>${escapeHTML(a.subject)} · Due ${a.due}</p></div></div>
  <form id="submitForm" class="modal-form"><div class="form-field"><label for="studentNote">Comment for faculty (optional)</label><textarea id="studentNote" placeholder="Add a note about your submission..."></textarea></div><div class="upload-drop"><div style="font-size:27px">☁</div><strong>Choose your assignment file</strong><p>PDF, DOCX or ZIP · Maximum 10 MB</p><input id="assignmentFile" type="file" accept=".pdf,.doc,.docx,.zip" required /></div><div class="modal-actions"><button type="button" class="secondary-button" id="cancelModal">Cancel</button><button class="modal-primary" type="submit">Upload submission ↗</button></div></form>`);
  $("#cancelModal").onclick=closeModal;
  $("#submitForm").onsubmit=async(e)=>{e.preventDefault();const f=$("#assignmentFile").files[0];if(!f)return;if(f.size>10*1024*1024){toast("File is larger than 10 MB. Choose a smaller file.");return;}const allowed=["pdf","doc","docx","zip"];const ext=f.name.split(".").pop().toLowerCase();if(!allowed.includes(ext)){toast("Please choose a PDF, DOC, DOCX, or ZIP file.");return;}if(liveMode&&cloudUser){const submitButton=$("#submitForm").querySelector("[type=submit]");submitButton.disabled=true;submitButton.textContent="Uploading to cloud…";try{await uploadCloudSubmission({assignment:a,file:f,note:$("#studentNote").value,user:cloudUser});closeModal();toast("Uploaded to Firebase. Faculty will see the submission live.");}catch(err){console.error(err);toast("Upload failed: "+friendlyError(err));submitButton.disabled=false;submitButton.textContent="Upload submission ↗";}return;}a.status="submitted";a.fileName=f.name;closeModal();renderAssignments();toast("Demo upload complete. Connect Firebase for real cloud uploads.");};
}
function openCreate(){
  openModal("Create new assignment",`<form id="createForm" class="modal-form"><div class="form-field"><label for="assignmentTitle">Assignment title</label><input id="assignmentTitle" required placeholder="e.g. Cloud architecture report"/></div><div class="form-field"><label for="assignmentSubject">Subject</label><select id="assignmentSubject"><option>Cloud Computing</option><option>Database Systems</option><option>Data Structures</option><option>Artificial Intelligence</option><option>Data Science</option></select></div><div class="form-field"><label for="assignmentDue">Deadline</label><input id="assignmentDue" type="datetime-local" required/></div><div class="form-field"><label for="assignmentDesc">Instructions</label><textarea id="assignmentDesc" placeholder="Add submission guidelines and requirements..."></textarea></div><div class="modal-actions"><button type="button" class="secondary-button" id="cancelModal">Cancel</button><button class="modal-primary" type="submit">Publish assignment ↗</button></div></form>`);
  $("#cancelModal").onclick=closeModal;
  $("#createForm").onsubmit=async(e)=>{e.preventDefault();const title=$("#assignmentTitle").value.trim();const subject=$("#assignmentSubject").value;const due=$("#assignmentDue").value;const instructions=$("#assignmentDesc").value.trim();if(!title||!due)return;const date=new Date(due);const iso=date.toISOString();if(liveMode&&cloudUser&&cloudProfile?.role==="faculty"){const submitButton=$("#createForm").querySelector("[type=submit]");submitButton.disabled=true;submitButton.textContent="Publishing…";try{await createCloudAssignment({title,subject,instructions,deadline:iso,code:subject.slice(0,2).toUpperCase()+"-"+Date.now().toString().slice(-4),points:"10 marks"},cloudUser);closeModal();toast("Published to Firebase. Students will see it in real time.");}catch(err){console.error(err);toast("Could not publish: "+friendlyError(err));submitButton.disabled=false;submitButton.textContent="Publish assignment ↗";}return;}assignments.unshift({id:Date.now(),title,subject,code:"NEW-001",due:date.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}),date:iso.slice(0,10),status:"pending",icon:"▤",tone:"purple",type:"PDF / DOCX",points:"10 marks"});closeModal();currentFilter="all";showAll=true;renderAssignments();toast("Assignment created in demo mode. Connect Firebase for shared live data.");};
}
function openResources(){
  openModal("Learning resources",`<div class="resource-list"><button class="resource-row" data-resource="Cloud computing notes"><span class="resource-symbol purple">☁</span><span><strong>Cloud computing notes</strong><small>PDF · Core concepts and service models</small></span><span>↗</span></button><button class="resource-row" data-resource="Submission guidelines"><span class="resource-symbol teal">✓</span><span><strong>Submission guidelines</strong><small>Document · Formatting and file rules</small></span><span>↗</span></button><button class="resource-row" data-resource="Academic calendar"><span class="resource-symbol orange">▦</span><span><strong>Academic calendar</strong><small>Calendar · Important dates and holidays</small></span><span>↗</span></button></div><p class="resource-note">Demo resources are placeholders. Faculty can add real course files after cloud storage is connected.</p>`);
  $$(".resource-row").forEach(b=>b.onclick=()=>toast(`${b.dataset.resource}: demo resource selected.`));
}
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$$(".filter-pill").forEach(b=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter;showAll=false;renderAssignments();}));
$("#loadMore").addEventListener("click",()=>{showAll=!showAll;renderAssignments();});
$("#viewAllButton").addEventListener("click",()=>setView("assignments"));
$("#primaryAction").addEventListener("click",()=>role==="faculty"?openCreate():setView("assignments"));
$("#roleSelect").addEventListener("change",e=>{setRole(e.target.value);toast(`Preview switched to ${e.target.value} role.`);});
$("#assignmentList").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;if(b.dataset.action==="submit")openSubmit(b.dataset.id);else openReview(b.dataset.id);});
$("#modalClose").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeModal();});
$("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#searchOpen").addEventListener("click",()=>{$("#searchOverlay").classList.remove("hidden");$("#searchInput").focus();});
$("#searchClose").addEventListener("click",()=>$("#searchOverlay").classList.add("hidden"));
$("#searchOverlay").addEventListener("click",e=>{if(e.target===$("#searchOverlay"))$("#searchOverlay").classList.add("hidden");});
$("#searchInput").addEventListener("input",e=>{const q=e.target.value.toLowerCase().trim();currentFilter="all";showAll=true;renderAssignments();if(q){const filtered=assignments.filter(a=>(a.title+" "+a.subject+" "+a.code).toLowerCase().includes(q));$("#assignmentList").innerHTML=filtered.map(a=>`<article class="assignment-row"><div class="subject-icon ${a.tone}">${a.icon}</div><div class="assignment-main"><h3>${escapeHTML(a.title)}</h3><div class="assignment-meta"><span>${escapeHTML(a.subject)}</span><i class="meta-separator"></i><span>${a.code}</span></div></div><div class="assignment-side"><span class="status-pill status-${a.status}">${statusLabel(a.status)}</span><span class="due-text">${formatDate(a.date)}</span></div></article>`).join("");$("#emptyState").classList.toggle("hidden",filtered.length>0);}});
$("#notificationButton").addEventListener("click",()=>toast("You’re all caught up — no new notifications."));
$("#profileMenu").addEventListener("click",()=>toast("Signed in as demo user. Configure Firebase Authentication for real accounts."));
$("#helpButton").addEventListener("click",()=>openModal("Help & support",`<p style="color:#777b91;line-height:1.7;font-size:12px">Need help with CloudClass? In this prototype, you can explore assignment lists, switch between student and faculty previews, create demo assignments, and test the file selection flow.</p><div class="deadline-highlight"><div class="deadline-symbol">ⓘ</div><div><strong>Project setup</strong><p>See README.md for Firebase configuration and deployment steps.</p></div></div><div class="modal-actions"><button class="modal-primary" id="cancelModal">Got it</button></div>`));$("#modalBody")?.querySelector("#cancelModal")?.addEventListener("click",closeModal);
$("#tipsButton").addEventListener("click",()=>openModal("Study & submission tips",`<div class="tips-list"><p><b>01</b> Start early. Break large assignments into smaller tasks.</p><p><b>02</b> Name files clearly: Subject_AssignmentName_RollNo.pdf.</p><p><b>03</b> Open your final file once before uploading to check it.</p><p><b>04</b> Keep a backup until your submission is confirmed.</p></div><div class="modal-actions"><button class="modal-primary" id="cancelModal">Sounds good</button></div>`));$("#modalBody")?.querySelector("#cancelModal")?.addEventListener("click",closeModal);
$("#activityViewAll").addEventListener("click",()=>toast("Recent activity view selected."));
$("#sortButton").addEventListener("click",()=>{assignments.reverse();renderAssignments();toast("Assignment order updated.");});
$$(".day-cell").forEach(b=>b.addEventListener("click",()=>toast(`${b.dataset.day}: deadlines are highlighted with amber dots.`)));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();$("#searchOverlay").classList.add("hidden");$("#sidebar").classList.remove("open");}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#searchOverlay").classList.remove("hidden");$("#searchInput").focus();}});
renderWeek();renderAssignments();

function friendlyError(err){const code=err?.code||"";if(code.includes("permission-denied"))return "permission denied. Check Firestore/Storage rules and your user role.";if(code.includes("auth/invalid-credential"))return "email or password is incorrect.";if(code.includes("auth/email-already-in-use"))return "this email is already registered.";if(code.includes("auth/weak-password"))return "password must be at least 6 characters.";if(code.includes("storage/unauthorized"))return "storage rules blocked this upload.";return err?.message||"please check Firebase configuration.";}
function setCloudStatus(isLive,label){const el=$("#cloudStatus");el.classList.toggle("live",isLive);el.classList.toggle("demo",!isLive);el.innerHTML=`<i></i> ${label}`;$("#cloudConnect").textContent=isLive?"Sign out":"Connect cloud";}
function mapCloudAssignment(raw){const deadlineValue=raw.deadline?.toDate?raw.deadline.toDate():new Date(raw.deadline||Date.now());const iso=Number.isNaN(deadlineValue.getTime())?new Date().toISOString():deadlineValue.toISOString();const submissionRows=cloudSubmissionsRaw.filter(s=>String(s.assignmentId)===String(raw.id));let status="pending";if(role==="faculty"){status=submissionRows.length?"submitted":"pending";}else{const mine=submissionRows.filter(s=>s.studentId===cloudUser?.uid).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0))[0];status=mine?.status||"pending";}return {id:raw.id,title:raw.title||"Untitled assignment",subject:raw.subject||"General",code:raw.code||"CLOUD",due:deadlineValue.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}),date:iso.slice(0,10),status,icon:({"Cloud Computing":"☁","Database Systems":"▤","Data Structures":"⌘","Artificial Intelligence":"✳","Data Science":"⌁"})[raw.subject]||"▤",tone:({"Cloud Computing":"purple","Database Systems":"orange","Data Structures":"teal","Artificial Intelligence":"blue","Data Science":"pink"})[raw.subject]||"purple",type:"PDF / DOCX",points:raw.points||"10 marks",instructions:raw.instructions||"",submissionCount:submissionRows.length};}
function refreshLiveAssignments(){if(!liveMode)return;assignments=cloudAssignmentsRaw.map(mapCloudAssignment);$("#statActive").innerHTML=`${String(assignments.filter(a=>a.status==="pending").length).padStart(2,"0")} <span class="stat-change neutral">in progress</span>`;$("#statSubmitted").innerHTML=`${String(cloudSubmissionsRaw.length).padStart(2,"0")} <span class="stat-change positive">live uploads</span>`;$("#statDue").innerHTML=`${String(assignments.filter(a=>a.status==="pending"&&a.date>=new Date().toISOString().slice(0,10)).length).padStart(2,"0")} <span class="stat-change warning">needs attention</span>`;$("#navAssignmentCount").textContent=assignments.length;renderAssignments();}
function startLiveListeners(){stopAssignments?.();stopSubmissions?.();stopAssignments=watchAssignments(data=>{cloudAssignmentsRaw=data;refreshLiveAssignments();},err=>{console.error(err);toast("Live assignments error: "+friendlyError(err));});stopSubmissions=watchSubmissions(cloudUser,cloudProfile.role,data=>{cloudSubmissionsRaw=data;refreshLiveAssignments();},err=>{console.error(err);toast("Live submissions error: "+friendlyError(err));});}
async function activateCloudUser(user){stopAssignments?.();stopSubmissions?.();if(!user){liveMode=false;cloudProfile=null;cloudAssignmentsRaw=[];cloudSubmissionsRaw=[];assignments=JSON.parse(JSON.stringify(demoAssignments));setCloudStatus(false,"Demo mode");$("#roleSelect").disabled=false;setRole($("#roleSelect").value||"student");return;}try{cloudProfile=await getUserProfile(user.uid);if(!cloudProfile){await signOut(auth);toast("No user profile found. Register an account first.");return;}cloudUser=user;liveMode=true;role=cloudProfile.role==="faculty"?"faculty":"student";$("#roleSelect").value=role;$("#roleSelect").disabled=true;setRole(role);setCloudStatus(true,"Live cloud");$("#sidebarName").textContent=cloudProfile.displayName||user.displayName||user.email;$("#sidebarRole").textContent=`${role} account · Firebase`;startLiveListeners();}catch(err){console.error(err);toast("Could not load profile: "+friendlyError(err));}}
function openReview(id){const a=assignments.find(x=>String(x.id)===String(id));if(!a)return;const rows=cloudSubmissionsRaw.filter(s=>String(s.assignmentId)===String(id));if(!liveMode){toast("Sign in to Firebase as faculty to review real student uploads.");return;}openModal("Review submissions",`<div class="assignment-detail"><div class="subject-icon ${a.tone}">${a.icon}</div><div><strong>${escapeHTML(a.title)}</strong><p>${escapeHTML(a.subject)} · ${rows.length} submission(s)</p></div></div>${rows.length?`<div class="submission-review-list">${rows.map(s=>`<div class="submission-review"><div class="activity-icon activity-green">↥</div><div class="review-copy"><strong>${escapeHTML(s.studentName||s.studentEmail||"Student")}</strong><small>${escapeHTML(s.fileName||"Uploaded file")} · ${s.submittedAt?.toDate?s.submittedAt.toDate().toLocaleString():"Recently submitted"}</small>${s.note?`<small>Note: ${escapeHTML(s.note)}</small>`:""}</div><a href="${escapeHTML(s.downloadURL||"#")}" target="_blank" rel="noopener">Download ↗</a></div>`).join("")}</div>`:`<p class="cloud-note">No students have submitted this assignment yet. This list updates automatically when a student uploads a file.</p>`}<div class="modal-actions"><button class="modal-primary" id="cancelModal">Done</button></div>`);$("#modalBody").querySelector("#cancelModal").onclick=closeModal;}
function openCloudConnect(){if(!cloudReady){openModal("Connect your Firebase project",`<p class="cloud-note">This website is still in demo mode because the Firebase configuration contains placeholders. Add your Web App config to <b>firebase-config.js</b>, enable Email/Password Authentication, create Firestore and Storage, then configure the rules from the README.</p><div class="modal-actions"><button class="modal-primary" id="cancelModal">Got it</button></div>`);$("#modalBody").querySelector("#cancelModal").onclick=closeModal;return;}if(cloudUser){signOut(auth).then(()=>toast("Signed out from Firebase.")).catch(err=>toast(friendlyError(err)));return;}openModal("Connect to CloudClass",`<p class="cloud-note">Sign in to sync assignments and uploads across devices. New accounts are created as students. Faculty accounts must be approved by the project administrator.</p><div class="modal-form"><div class="form-field"><label for="cloudEmail">Email address</label><input id="cloudEmail" type="email" required placeholder="you@example.com" autocomplete="email"/></div><div class="form-field"><label for="cloudPassword">Password</label><input id="cloudPassword" type="password" required minlength="6" placeholder="At least 6 characters" autocomplete="current-password"/></div><div class="form-field" id="registerNameWrap" style="display:none"><label for="cloudName">Your name</label><input id="cloudName" placeholder="Full name" autocomplete="name"/></div><div class="modal-actions" style="justify-content:space-between"><button class="secondary-button" id="toggleRegister">Create student account</button><button class="modal-primary" id="cloudLogin">Sign in ↗</button></div><p class="cloud-user-label" id="authHint">Already registered? Sign in with your account.</p></div>`);let register=false;const toggle=$("#toggleRegister");toggle.onclick=()=>{register=!register;$("#registerNameWrap").style.display=register?"grid":"none";$("#cloudLogin").textContent=register?"Create account ↗":"Sign in ↗";toggle.textContent=register?"I already have an account":"Create student account";$("#authHint").textContent=register?"New registrations receive the student role by default.":"Already registered? Sign in with your account.";};$("#cloudLogin").onclick=async()=>{const email=$("#cloudEmail").value.trim(),password=$("#cloudPassword").value,name=$("#cloudName")?.value.trim();if(!email||!password||(register&&!name)){toast("Please complete all required fields.");return;}const btn=$("#cloudLogin");btn.disabled=true;btn.textContent="Connecting…";try{authFlowInProgress=true;if(register)await registerStudent(name,email,password);else await loginUser(email,password);authFlowInProgress=false;await activateCloudUser(auth.currentUser);closeModal();toast("Connected to Firebase. Live data is now enabled.");}catch(err){authFlowInProgress=false;console.error(err);toast(friendlyError(err));btn.disabled=false;btn.textContent=register?"Create account ↗":"Sign in ↗";}};}
$("#cloudConnect").addEventListener("click",openCloudConnect);
if(cloudReady){setCloudStatus(false,"Connecting…");onAuthStateChanged(auth,async user=>{cloudUser=user;stopAssignments?.();stopSubmissions?.();if(authFlowInProgress)return;await activateCloudUser(user);});}else{setCloudStatus(false,"Demo mode");}
