// ---------- FIXED: wireEvents (ONLY ONCE, no nesting) ----------
function wireEvents() {
  $("btnAddMember").onclick = () => {
    const name = $("memberName").value.trim();
    const role = $("memberRole").value.trim();
    if (!name) return alert("Please enter a member name.");

    const exists = state.members.some(m => m.name.toLowerCase() === name.toLowerCase());
    if (exists) return alert("That name already exists.");

    state.members.push({ id: uid(), name, role });
    $("memberName").value = "";
    $("memberRole").value = "";
    saveState();
  };

  $("btnSaveDev").onclick = () => {
    ensureTodayDev();
    const t = todayISO();
    const dev = state.devotionals[t];
    dev.ref = $("devRef").value.trim();
    dev.theme = $("devTheme").value.trim();
    dev.verse = $("devVerse").value.trim();
    dev.reflection = $("devReflection").value.trim();
    saveState();
  };

  $("btnClearDev").onclick = () => {
    if (!confirm("Clear the devotional form (today)?")) return;
    $("devRef").value = "";
    $("devTheme").value = "";
    $("devVerse").value = "";
    $("devReflection").value = "";
  };

  $("btnAddPrayer").onclick = () => {
    const title = $("prTitle").value.trim();
    const details = $("prDetails").value.trim();
    const assignedTo = $("prAssigned").value;

    if (!title) return alert("Please enter a request title.");

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
  };

  $("btnWeeklyReset").onclick = () => {
    ensureTodayDev();
    const t = todayISO();
    const dev = state.devotionals[t];
    if (!dev.theme) dev.theme = "New Week";
    if (!dev.reflection) dev.reflection = "This week, our family will seek God daily in prayer and His Word.";
    saveState();
  };

  $("btnResetAll").onclick = () => {
    if (!confirm("This will delete ALL data on this device. Continue?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
  };

  $("btnExport").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `family-prayer-devotional-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $("fileImport").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      if (!imported || typeof imported !== "object") throw new Error("Invalid file");
      if (!confirm("Import will replace current data on this device. Continue?")) return;
      state = imported;
      saveState();
    } catch (err) {
      alert("Import failed. Please choose a valid backup JSON file.");
    } finally {
      e.target.value = "";
    }
  });
}

// ---------- FIXED: renderAll (NO wireEvents inside) ----------
function renderAll() {
  renderTodayLine();
  ensureTodayDev();
  populateAssignedDropdown();
  renderMembers();
  renderDevotionalForm();
  renderMemberChecks();
  renderPrayers();
  renderHistory();
}

// Call this ONCE after page loads (important)
document.addEventListener("DOMContentLoaded", () => {
  ensureAuthUI();
  wireEvents();
  renderAll();
});

// ---------- FIXED: Auth state listener (removed stray dot) ----------
onAuthStateChanged(window.firebaseAuth, (user) => {
  if (!user) {
    setStorageForUser(null);
    setAppLocked(true);
    return;
  }

  setStorageForUser(user.uid);

  try {
    state = loadState();
    renderAll();
  } catch (e) {
    console.log("Post-login reload issue:", e);
  }

  setAppLocked(false);
});
