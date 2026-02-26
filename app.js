// ===== Firebase Setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzHisihZ0LbXpz82yE-OZKrql76bxar9E",
  authDomain: "familyprayerdevotional.firebaseapp.com",
  projectId: "familyprayerdevotional",
  storageBucket: "familyprayerdevotional.firebasestorage.app",
  messagingSenderId: "16786686586",
  appId: "1:16786686586:web:51dba10f100a475fe6b823"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

window.firebaseAuth = auth;
window.firebaseDB = db;
// ===== End Firebase Setup =====
const STORAGE_KEY_BASE = "family_prayer_devotional_v1";
let STORAGE_KEY = STORAGE_KEY_BASE;
let currentUID = null;

const $ = (id) => document.getElementById(id);

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function niceDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}
function uid(){
  return Math.random().toString(36).slice(2,10) + "-" + Date.now().toString(36);
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    return JSON.parse(raw);
  }catch(e){
    return defaultState();
  }
}
async function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();

  if (auth.currentUser) {
    const uid = auth.currentUser.uid;

    try {
      await setDoc(
        doc(db, "users", uid, "app", "state"),
        {
          state: state,
          updatedAt: new Date()
        }
      );
    } catch (err) {
      console.error("Cloud save failed:", err);
    }
  }
}

function defaultState(){
  return {
    members: [],
    prayers: [],
    devotionals: {} // dateISO -> {ref, theme, verse, reflection, completedBy:{memberId:true}}
  };
}

let state = loadState();

function ensureTodayDev(){
  const t = todayISO();
  if(!state.devotionals[t]){
    state.devotionals[t] = {
      ref: "",
      theme: "",
      verse: "",
      reflection: "",
      completedBy: {}
    };
  }
}

function memberById(id){
  return state.members.find(m => m.id === id);
}

function streakForMember(memberId){
  // Count consecutive days backward with completion
  let streak = 0;
  const d = new Date();
  for(;;){
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const dev = state.devotionals[iso];
    if(dev && dev.completedBy && dev.completedBy[memberId]){
      streak += 1;
      d.setDate(d.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

function renderTodayLine(){
  $("todayLine").textContent = niceDate(todayISO());
}

function populateAssignedDropdown(){
  const sel = $("prAssigned");
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— None —";
  sel.appendChild(opt0);

  for(const m of state.members){
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.role ? `${m.name} (${m.role})` : m.name;
    sel.appendChild(o);
  }
}

function renderMembers(){
  const list = $("memberList");
  list.innerHTML = "";

if(state.members.length === 0){
  list.innerHTML = `<div class="item"><div class="muted">
  Start by adding your first family member.
  </div></div>`;
  wireEvents();   // ;
   
    return;
  }

  for(const m of state.members){
    const st = streakForMember(m.id);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(m.name)}</div>
          <div class="small">${escapeHtml(m.role || "")}</div>
          <div class="kv">
            <div>Streak: <b>${st}</b> day(s)</div>
          </div>
        </div>
        <div class="badges">
          <span class="badge ${st>=5 ? "good":""}">Streak</span>
          <span class="badge">${escapeHtml(m.id.slice(0,6))}</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn secondary" data-act="rename" data-id="${m.id}">Rename</button>
        <button class="btn danger" data-act="del" data-id="${m.id}">Remove</button>
      </div>
    `;
    list.appendChild(div);
  }
  

  list.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      if(act === "del"){
        if(!confirm("Remove this member?")) return;
        state.members = state.members.filter(x=>x.id!==id);
        // remove completion marks for this member
        for(const k of Object.keys(state.devotionals)){
          if(state.devotionals[k]?.completedBy) delete state.devotionals[k].completedBy[id];
        }
        // unassign prayers
        state.prayers.forEach(p=>{ if(p.assignedTo===id) p.assignedTo=""; });
        saveState();
      }
      if(act === "rename"){
        const m = memberById(id);
        if(!m) return;
        const newName = prompt("New name:", m.name);
        if(newName && newName.trim()){
          m.name = newName.trim();
        }
        const newRole = prompt("Role (optional):", m.role || "");
        if(newRole !== null){
          m.role = newRole.trim();
        }
        saveState();
      }
    });
  });
}
wireEvents();   /
function renderDevotionalForm(){
  ensureTodayDev();
  const t = todayISO();
  const dev = state.devotionals[t];

  $("devRef").value = dev.ref || "";
  $("devTheme").value = dev.theme || "";
  $("devVerse").value = dev.verse || "";
  $("devReflection").value = dev.reflection || "";
}

function renderMemberChecks(){
  ensureTodayDev();
  const wrap = $("memberChecks");
  wrap.innerHTML = "";

  if(state.members.length === 0){
    wrap.innerHTML = `<div class="item"><div class="muted">Add family members first to mark completion.</div></div>`;
    return;
  }

  const t = todayISO();
  const dev = state.devotionals[t];

  for(const m of state.members){
    const done = !!dev.completedBy[m.id];
    const st = streakForMember(m.id);
    const row = document.createElement("div");
    row.className = "checkboxRow";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(m.name)}</strong>
        <div class="meta">${escapeHtml(m.role || "")} • Streak: ${st} day(s)</div>
      </div>
      <button class="btn ${done ? "secondary":""}" data-id="${m.id}">
        ${done ? "Completed ✓" : "Mark Done"}
      </button>
    `;
    row.querySelector("button").addEventListener("click", ()=>{
      dev.completedBy[m.id] = !dev.completedBy[m.id];
      saveState();
    });
    wrap.appendChild(row);
  }
}

function renderPrayers(){
  const list = $("prayerList");
  list.innerHTML = "";

  if(state.prayers.length === 0){
    list.innerHTML = `<div class="item"><div class="muted">No prayer requests yet.</div></div>`;
    return;
  }

  // newest first
  const sorted = [...state.prayers].sort((a,b)=> b.createdAt - a.createdAt);

  for(const p of sorted){
    const assigned = p.assignedTo ? memberById(p.assignedTo) : null;
    const statusBadge = p.answered ? `<span class="badge good">Answered</span>` : `<span class="badge warn">Active</span>`;
    const assignedBadge = assigned ? `<span class="badge">${escapeHtml(assigned.name)}</span>` : `<span class="badge">Unassigned</span>`;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(p.title)}</div>
          <div class="small">${escapeHtml(p.details || "")}</div>
          ${p.answered ? `<div class="small"><b>Answer Note:</b> ${escapeHtml(p.answerNote || "")}</div>` : ""}
          <div class="kv">
            <div>Created: <b>${new Date(p.createdAt).toLocaleDateString()}</b></div>
          </div>
        </div>
        <div class="badges">
          ${statusBadge}
          ${assignedBadge}
        </div>
      </div>

      <div class="actions">
        <button class="btn secondary" data-act="toggle" data-id="${p.id}">
          ${p.answered ? "Reopen" : "Mark Answered"}
        </button>
        <button class="btn secondary" data-act="edit" data-id="${p.id}">Edit</button>
        <button class="btn danger" data-act="del" data-id="${p.id}">Delete</button>
      </div>
    `;
    list.appendChild(div);
  }

  list.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      const p = state.prayers.find(x=>x.id===id);
      if(!p) return;

      if(act === "del"){
        if(!confirm("Delete this prayer request?")) return;
        state.prayers = state.prayers.filter(x=>x.id!==id);
        saveState();
        return;
      }

      if(act === "toggle"){
        if(!p.answered){
          const note = prompt("How did God answer? (short note)", p.answerNote || "");
          p.answered = true;
          p.answerNote = (note || "").trim();
          p.answeredAt = Date.now();
        }else{
          p.answered = false;
          p.answerNote = "";
          p.answeredAt = null;
        }
        saveState();
        return;
      }

      if(act === "edit"){
        const newTitle = prompt("Title:", p.title);
        if(newTitle === null) return;
        p.title = newTitle.trim() || p.title;

        const newDetails = prompt("Details:", p.details || "");
        if(newDetails !== null) p.details = newDetails.trim();

        // assigned
        const assigned = prompt("Assigned to (type exact name, or leave blank):", "");
        if(assigned !== null){
          const found = state.members.find(m => m.name.toLowerCase() === assigned.trim().toLowerCase());
          p.assignedTo = found ? found.id : "";
        }
        saveState();
      }
    });
  });
}

function renderHistory(){
  const h = $("history");
  h.innerHTML = "";

  const keys = Object.keys(state.devotionals).sort((a,b)=> b.localeCompare(a));
  if(keys.length === 0){
    h.innerHTML = `<div class="item"><div class="muted">No devotionals saved yet.</div></div>`;
    return;
  }

  for(const k of keys){
    const dev = state.devotionals[k];
    const anyContent = (dev.ref || dev.theme || dev.verse || dev.reflection);
    if(!anyContent) continue;

    const completedCount = Object.keys(dev.completedBy || {}).length;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(niceDate(k))}</div>
          <div class="small"><b>${escapeHtml(dev.ref || "—")}</b> ${dev.theme ? "• " + escapeHtml(dev.theme) : ""}</div>
          ${dev.verse ? `<div class="small">${escapeHtml(dev.verse)}</div>` : ""}
          ${dev.reflection ? `<div class="small"><b>Reflection:</b> ${escapeHtml(dev.reflection)}</div>` : ""}
        </div>
        <div class="badges">
          <span class="badge">${completedCount}/${state.members.length || 0} done</span>
        </div>
      </div>
    `;
    h.appendChild(div);
  }
}

function escapeHtml(s){
  return (s ?? "").toString().replace(/[&<>"]/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  }[ch]));
}

function wireEvents(){
  function wireEvents(){
  $("btnAddMember").onclick = ()=>{
    const name = $("memberName").value.trim();
    const role = $("memberRole").value.trim();
    if(!name) return alert("Please enter a member name.");

    const exists = state.members.some(m => m.name.toLowerCase() === name.toLowerCase());
    if(exists) return alert("That name already exists.");

    state.members.push({ id: uid(), name, role });
    $("memberName").value = "";
    $("memberRole").value = "";
    saveState();
    renderAll()://
  });

  $("btnSaveDev").addEventListener("click", ()=>{
    ensureTodayDev();
    const t = todayISO();
    const dev = state.devotionals[t];
    dev.ref = $("devRef").value.trim();
    dev.theme = $("devTheme").value.trim();
    dev.verse = $("devVerse").value.trim();
    dev.reflection = $("devReflection").value.trim();
    saveState();
  });

  $("btnClearDev").addEventListener("click", ()=>{
    if(!confirm("Clear the devotional form (today)?")) return;
    $("devRef").value = "";
    $("devTheme").value = "";
    $("devVerse").value = "";
    $("devReflection").value = "";
  });

  $("btnAddPrayer").addEventListener("click", ()=>{
    const title = $("prTitle").value.trim();
    const details = $("prDetails").value.trim();
    const assignedTo = $("prAssigned").value;

    if(!title) return alert("Please enter a request title.");

    state.prayers.push({
      id: uid(),
      title,
      details,
      assignedTo: assignedTo || "",
      answered: false,
      answerNote: "",
      createdAt: Date.now(),
      answeredAt: null
    });

    $("prTitle").value = "";
    $("prDetails").value = "";
    $("prAssigned").value = "";
    saveState();
  });

  $("btnWeeklyReset").addEventListener("click", ()=>{
    // Optional helper: just adds a “Week Start” devotional template
    ensureTodayDev();
    const t = todayISO();
    const dev = state.devotionals[t];
    if(!dev.theme) dev.theme = "New Week";
    if(!dev.reflection) dev.reflection = "This week, our family will seek God daily in prayer and His Word.";
    saveState();
  });

  $("btnResetAll").addEventListener("click", ()=>{
    if(!confirm("This will delete ALL data on this device. Continue?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
  });

  // Export / Import
  $("btnExport").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `family-prayer-devotional-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  });

  $("fileImport").addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const text = await file.text();
    try{
      const imported = JSON.parse(text);
      // minimal validation
      if(!imported || typeof imported !== "object") throw new Error("Invalid file");
      if(!confirm("Import will replace current data on this device. Continue?")) return;
      state = imported;
      saveState();
    }catch(err){
      alert("Import failed. Please choose a valid backup JSON file.");
    }finally{
      e.target.value = "";
    }
  });
}

function renderAll(){
  renderTodayLine();
  ensureTodayDev();
  populateAssignedDropdown();
  renderMembers();
  renderDevotionalForm();
  renderMemberChecks();
  renderPrayers();
  renderHistory();
  wireEvents();//
}

// ===== Auth UI (Injected) + User-based storage =====
function ensureAuthUI() {
  if (document.getElementById("authBox")) return;

  const wrap = document.createElement("section");
  wrap.id = "authBox";
  wrap.className = "card";
  wrap.style.marginBottom = "14px";

  wrap.innerHTML = `
    <div class="cardHead">
      <h2>Sign in</h2>
      <div class="muted">Login to save your family data per account (Rey / Merlie / etc.).</div>
    </div>

    <div style="display:grid; gap:10px;">
      <input id="authEmail" type="email" placeholder="Email" autocomplete="email" />
      <input id="authPass" type="password" placeholder="Password" autocomplete="current-password" />
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="btnLogin" class="primary">Login</button>
        <button id="btnCreate">Create Account</button>
        <button id="btnLogout" style="display:none;">Logout</button>
      </div>
      <div id="authMsg" class="muted"></div>
    </div>
  `;

  // Put auth box at the top of the main content
  const main = document.querySelector("main") || document.body;
  main.prepend(wrap);

  const emailEl = document.getElementById("authEmail");
  const passEl = document.getElementById("authPass");
  const msgEl = document.getElementById("authMsg");
  const loginBtn = document.getElementById("btnLogin");
  const createBtn = document.getElementById("btnCreate");
  const logoutBtn = document.getElementById("btnLogout");

  loginBtn.onclick = async () => {
    msgEl.textContent = "Signing in...";
    try {
      await signInWithEmailAndPassword(window.firebaseAuth, emailEl.value.trim(), passEl.value);
      msgEl.textContent = "Signed in ✅";
    } catch (e) {
      msgEl.textContent = "Login failed: " + (e?.message || e);
    }
  };

  createBtn.onclick = async () => {
    msgEl.textContent = "Creating account...";
    try {
      await createUserWithEmailAndPassword(window.firebaseAuth, emailEl.value.trim(), passEl.value);
      msgEl.textContent = "Account created ✅";
    } catch (e) {
      msgEl.textContent = "Create failed: " + (e?.message || e);
    }
  };

  logoutBtn.onclick = async () => {
    msgEl.textContent = "Signing out...";
    try {
      await signOut(window.firebaseAuth);
      msgEl.textContent = "Signed out ✅";
    } catch (e) {
      msgEl.textContent = "Logout failed: " + (e?.message || e);
    }
  };
}

function setStorageForUser(uid) {
  currentUID = uid || null;
  STORAGE_KEY = uid ? `${STORAGE_KEY_BASE}_${uid}` : STORAGE_KEY_BASE;
}

// Hide/show the app content (so you can require login)

function setAppLocked(isLocked) {
  const authBox = document.getElementById("authBox");
  const main = document.querySelector("main") || document.body;

  const loginBtn = document.getElementById("btnLogin");
  const createBtn = document.getElementById("btnCreate");
  const logoutBtn = document.getElementById("btnLogout");
  const emailEl = document.getElementById("authEmail");
  const passEl = document.getElementById("authPass");

  // Hide/show app content
  [...main.children].forEach((child) => {
    if (child === authBox) return;
    child.style.display = isLocked ? "none" : "";
  });

  if (isLocked) {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (createBtn) createBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (emailEl) emailEl.style.display = "block";
    if (passEl) passEl.style.display = "block";
  } else {
    if (loginBtn) loginBtn.style.display = "none";
    if (createBtn) createBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (emailEl) emailEl.style.display = "none";
    if (passEl) passEl.style.display = "none";
  }
}

ensureAuthUI();

onAuthStateChanged(window.firebaseAuth, (user) => {
  if (!user) {
    setStorageForUser(null);
    setAppLocked(true);. 
    return;
  }

  // logged in
  setStorageForUser(user.uid);

  // IMPORTANT:
  // reload the app state under this user's storage key
  try {
    // assumes you already have global `state`, `loadState`, `renderAll`
    // If your app uses a different variable name, tell me and I’ll adjust.
    state = loadState();
    renderAll();
  
  } catch (e) {
    console.log("Post-login reload issue:", e);
  }

  setAppLocked(false);
});




