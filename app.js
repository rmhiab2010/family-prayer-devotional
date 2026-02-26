// ===== Firebase Setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const STORAGE_KEY = "family_prayer_devotional_v1";

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
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
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
    list.innerHTML = `<div class="item"><div class="muted">No members yet. Add your 4 family names above.</div></div>`;
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
  $("btnAddMember").addEventListener("click", ()=>{
    const name = $("memberName").value.trim();
    const role = $("memberRole").value.trim();
    if(!name) return alert("Please enter a member name.");

    const exists = state.members.some(m => m.name.toLowerCase() === name.toLowerCase());
    if(exists) return alert("That name already exists.");

    state.members.push({ id: uid(), name, role });
    $("memberName").value = "";
    $("memberRole").value = "";
    saveState();
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
}

// Init
wireEvents();

renderAll();
