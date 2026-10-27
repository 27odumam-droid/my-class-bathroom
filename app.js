const STORAGE_KEY = "hallpass-room-206";
const STUDENTS = [
  "Ellis Baldwin",
  "L'Keldrick Copeland",
  "Jhaeleon David",
  "Kyran Dessesaure",
  "Noah Fields",
  "Joselyn Martinez Hernandez",
  "D'Ara Mccowan",
  "Ja'Kobe McCowan",
  "Daquesha Redd",
  "Aiden Odum"
];
const CLASSROOMS = [
  { teacher: "Mr. Thompson", room: "Room 108" },
  { teacher: "Ms. Patel", room: "Room 312" },
  { teacher: "Mr. Brooks", room: "Room 106" }
];
const REQUEST_TYPES = ["restroom", "class_visit"];

const studentView = document.querySelector("#student-view");
const teacherView = document.querySelector("#teacher-view");
const studentSelect = document.querySelector("#student-select");
const requestTypeSelect = document.querySelector("#request-type");
const destinationField = document.querySelector("#destination-field");
const destinationSelect = document.querySelector("#destination-select");
const toast = document.querySelector("#toast");

let passes = loadPasses();
let toastTimeout;

function loadPasses() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(isValidPass) : [];
  } catch (error) {
    console.error("Unable to load saved pass data.", error);
    return [];
  }
}

function isValidPass(pass) {
  return pass && typeof pass.id === "string" &&
    STUDENTS.includes(pass.student) &&
    ["pending", "out", "completed", "denied"].includes(pass.status) &&
    typeof pass.requestedAt === "number" &&
    (pass.type === undefined || REQUEST_TYPES.includes(pass.type)) &&
    (pass.type !== "class_visit" || CLASSROOMS.some((classroom) =>
      pass.destination === `${classroom.teacher}|${classroom.room}`
    ));
}

function savePasses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(passes));
  } catch (error) {
    console.error("Unable to save pass data.", error);
    showToast("Couldn't save changes. Check your browser storage settings.");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function initials(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function relativeTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setView(view) {
  const isTeacher = view === "teacher";
  studentView.hidden = isTeacher;
  teacherView.hidden = !isTeacher;
  document.querySelector("#breadcrumb-view").textContent = isTeacher ? "Teacher dashboard" : "Student view";

  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function currentStudentPass() {
  const student = studentSelect.value;
  return passes
    .filter((pass) => pass.student === student && ["pending", "out"].includes(pass.status))
    .sort((a, b) => b.requestedAt - a.requestedAt)[0];
}

function selectedClassroom() {
  return CLASSROOMS.find((classroom) =>
    destinationSelect.value === `${classroom.teacher}|${classroom.room}`
  );
}

function requestType(pass) {
  return pass.type || "restroom";
}

function requestTitle(pass) {
  return requestType(pass) === "class_visit" ? "Class visit" : "Restroom pass";
}

function destinationLabel(pass) {
  if (requestType(pass) !== "class_visit") return "";
  const classroom = CLASSROOMS.find((item) =>
    pass.destination === `${item.teacher}|${item.room}`
  );
  return classroom ? `${classroom.teacher} · ${classroom.room}` : "Classroom not selected";
}

function updateRequestOptions() {
  const visitingClass = requestTypeSelect.value === "class_visit";
  destinationField.classList.toggle("hidden", !visitingClass);
  destinationSelect.disabled = !visitingClass || Boolean(currentStudentPass());
  destinationSelect.required = visitingClass;
  renderStudent();
}

function renderStudent() {
  const pass = currentStudentPass();
  const status = document.querySelector("#student-status");
  const copy = document.querySelector("#student-request-copy");
  const actionArea = document.querySelector("#student-action-area");
  const isBusy = Boolean(pass);
  requestTypeSelect.disabled = isBusy;
  destinationSelect.disabled = isBusy || requestTypeSelect.value !== "class_visit";

  if (!pass) {
    status.className = "status-pill status-ready";
    status.textContent = "READY";
    copy.innerHTML = requestTypeSelect.value === "class_visit"
      ? "<h2>Need to visit another class?</h2><p>Choose a classroom and send your request to Ms. Rodgers for approval.</p>"
      : "<h2>Need to use the restroom?</h2><p>Send a request to Ms. Rodgers. You can head out once it's approved.</p>";
    actionArea.innerHTML = '<button class="button button-primary button-wide" id="request-pass-button" type="button">Request a pass <span aria-hidden="true">→</span></button>';
    document.querySelector("#request-pass-button").addEventListener("click", requestPass);
  } else if (pass.status === "pending") {
    status.className = "status-pill status-pending";
    status.textContent = "AWAITING APPROVAL";
    const destination = requestType(pass) === "class_visit" ? ` to ${escapeHtml(destinationLabel(pass))}` : "";
    copy.innerHTML = `<h2>Your request is with Ms. Rodgers.</h2><p>Hang tight, ${escapeHtml(studentSelect.value)}. Your ${requestTitle(pass).toLowerCase()}${destination} is waiting for approval.</p>`;
    actionArea.innerHTML = '<button class="button button-primary button-wide" type="button" disabled>Waiting for approval <span aria-hidden="true">…</span></button>';
  } else {
    status.className = "status-pill status-out";
    status.textContent = "PASS APPROVED";
    const destination = requestType(pass) === "class_visit" ? ` to ${escapeHtml(destinationLabel(pass))}` : "";
    copy.innerHTML = `<h2>You're all set, ${escapeHtml(studentSelect.value.split(" ")[0])}.</h2><p>Your ${requestTitle(pass).toLowerCase()}${destination} was approved at ${formatTime(pass.approvedAt)}. Check back in when you return.</p>`;
    actionArea.innerHTML = '<button class="button button-primary button-wide" id="check-in-button" type="button">I’m back — check in <span aria-hidden="true">✓</span></button>';
    document.querySelector("#check-in-button").addEventListener("click", () => checkIn(pass.id));
  }

  const recent = passes
    .filter((item) => item.student === studentSelect.value)
    .sort((a, b) => b.requestedAt - a.requestedAt)
    .slice(0, 3);
  const activity = document.querySelector("#student-activity");
  if (!recent.length) {
    activity.innerHTML = '<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">◷</span><span>No passes yet. Your recent activity will show up here.</span></div>';
    return;
  }

  activity.innerHTML = recent.map((item) => `
    <div class="activity-row">
      <span class="activity-avatar" aria-hidden="true">${initials(item.student)}</span>
      <div class="activity-main"><strong>${requestTitle(item)}</strong><span>${statusLabel(item.status)}${destinationLabel(item) ? ` · ${escapeHtml(destinationLabel(item))}` : ""} · ${formatTime(item.requestedAt)}</span></div>
      <span class="status-pill ${statusClass(item.status)}">${statusLabel(item.status).toUpperCase()}</span>
    </div>
  `).join("");
}

function statusClass(status) {
  return {
    pending: "status-pending",
    out: "status-out",
    completed: "status-complete",
    denied: "status-denied"
  }[status];
}

function statusLabel(status) {
  return { pending: "Waiting for approval", out: "Currently out", completed: "Completed", denied: "Not approved" }[status];
}

function requestPass() {
  if (currentStudentPass()) return;
  const type = requestTypeSelect.value;
  const classroom = type === "class_visit" ? selectedClassroom() : null;
  if (type === "class_visit" && !classroom) {
    showToast("Choose a classroom before sending your request.");
    destinationSelect.focus();
    return;
  }
  const pass = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    student: studentSelect.value,
    type,
    ...(classroom ? { destination: `${classroom.teacher}|${classroom.room}` } : {}),
    status: "pending",
    requestedAt: Date.now()
  };
  passes.push(pass);
  savePasses();
  render();
  showToast(type === "class_visit" ? "Your class visit request was sent to Ms. Rodgers." : "Your request was sent to Ms. Rodgers.");
}

function updatePass(id, status) {
  const pass = passes.find((item) => item.id === id);
  if (!pass) return;
  pass.status = status;
  if (status === "out") pass.approvedAt = Date.now();
  if (status === "completed") pass.completedAt = Date.now();
  if (status === "denied") pass.deniedAt = Date.now();
  savePasses();
  render();
}

function checkIn(id) {
  updatePass(id, "completed");
  showToast("You're checked back in. Welcome back!");
}

function renderTeacher() {
  const pending = passes.filter((pass) => pass.status === "pending").sort((a, b) => a.requestedAt - b.requestedAt);
  const out = passes.filter((pass) => pass.status === "out").sort((a, b) => a.approvedAt - b.approvedAt);
  const today = new Date();
  const completed = passes.filter((pass) => {
    if (pass.status !== "completed" || typeof pass.completedAt !== "number") return false;
    const completedAt = new Date(pass.completedAt);
    return completedAt.getFullYear() === today.getFullYear() &&
      completedAt.getMonth() === today.getMonth() &&
      completedAt.getDate() === today.getDate();
  });

  document.querySelector("#pending-stat").textContent = pending.length;
  document.querySelector("#out-stat").textContent = out.length;
  document.querySelector("#completed-stat").textContent = completed.length;
  document.querySelector("#pending-heading-count").textContent = pending.length;
  document.querySelector("#out-heading-count").textContent = out.length;
  document.querySelector("#nav-pending-count").textContent = pending.length;

  const pendingList = document.querySelector("#pending-list");
  pendingList.innerHTML = pending.length ? pending.map((pass) => `
    <article class="request-row">
      <span class="activity-avatar" aria-hidden="true">${initials(pass.student)}</span>
      <div class="request-row-info"><strong>${escapeHtml(pass.student)}</strong><span>${requestTitle(pass)}${destinationLabel(pass) ? ` · ${escapeHtml(destinationLabel(pass))}` : ""} · Requested ${relativeTime(pass.requestedAt)}</span></div>
      <span class="status-pill status-pending">WAITING</span>
      <div class="request-row-actions">
        <button class="button button-small button-deny" type="button" data-action="deny" data-id="${escapeHtml(pass.id)}">Decline</button>
        <button class="button button-small button-approve" type="button" data-action="approve" data-id="${escapeHtml(pass.id)}">Approve</button>
      </div>
    </article>
  `).join("") : emptyDashboard("All caught up", "New student requests will appear here.");

  const outList = document.querySelector("#out-list");
  outList.innerHTML = out.length ? out.map((pass) => `
    <article class="request-row">
      <span class="activity-avatar" aria-hidden="true">${initials(pass.student)}</span>
      <div class="request-row-info"><strong>${escapeHtml(pass.student)}</strong><span>${requestTitle(pass)}${destinationLabel(pass) ? ` · ${escapeHtml(destinationLabel(pass))}` : ""} · Approved at ${formatTime(pass.approvedAt)}</span></div>
      <span class="status-pill status-out">OUT</span>
      <span class="out-timer">Out for ${relativeTime(pass.approvedAt).replace(" ago", "")}</span>
    </article>
  `).join("") : emptyDashboard("Everyone is in class", "Approved passes will show up here until students check back in.");
}

function emptyDashboard(title, description) {
  return `<div class="empty-state empty-dashboard"><strong>${title}</strong><span>${description}</span></div>`;
}

function render() {
  renderStudent();
  renderTeacher();
}

document.querySelectorAll("[data-view]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.history.pushState(null, "", link.href);
    setView(link.dataset.view);
  });
});
window.addEventListener("popstate", () => {
  const view = new URL(window.location.href).searchParams.get("view");
  setView(view === "teacher" ? "teacher" : "student");
});
studentSelect.addEventListener("change", renderStudent);
requestTypeSelect.addEventListener("change", updateRequestOptions);
document.querySelector("#pending-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const approved = button.dataset.action === "approve";
  updatePass(button.dataset.id, approved ? "out" : "denied");
  showToast(approved ? "Pass approved. The student can check in when they return." : "Request declined.");
});
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  passes = loadPasses();
  render();
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric"
}).format(new Date());
const initialView = new URL(window.location.href).searchParams.get("view");
setView(initialView === "teacher" ? "teacher" : "student");
render();
