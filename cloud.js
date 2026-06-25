/* ============================================================
   UPLVL — optional cloud sync (Supabase)

   The app works fully WITHOUT this. To turn on cross-device sync:
   1. Create a free project at https://supabase.com
   2. In the SQL editor, run the snippet from SETUP-SYNC.md
   3. Project Settings → API: copy the Project URL and the anon public key
   4. Paste them below, then host the app (see SETUP-SYNC.md)
   ============================================================ */

const SUPABASE_URL = "https://qefmkwccljnvrjdipmpp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2Nl3xTRq_9-EUZqLwtUK1A_MPROFBUj";  // publishable key — safe to embed (RLS protects your data)

/* ---------- internals ---------- */
let sb = null;
let cloudUser = null;
let pushTimer = null;

function cloudConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
}

async function initCloud() {
  wireAccountUI();
  if (!cloudConfigured()) { updateSyncUI(); return; }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  try {
    const { data } = await sb.auth.getSession();
    cloudUser = data && data.session ? data.session.user : null;
  } catch (e) { console.error("auth session error", e); }

  sb.auth.onAuthStateChange((_event, session) => {
    cloudUser = session ? session.user : null;
    updateSyncUI();
    if (cloudUser) syncOnLogin();
  });

  updateSyncUI();
  // Deep link: /index.html?signin=1 (or #signin) opens the sign-in dialog straight away.
  try {
    const q = new URLSearchParams(location.search);
    if (!cloudUser && (q.get("signin") === "1" || location.hash === "#signin")) openAcct();
  } catch (e) {}
  if (cloudUser) syncOnLogin();
}

/* Pull remote on login; newest wins (whole-document, by meta.updatedAt). */
async function syncOnLogin() {
  if (!sb || !cloudUser) return;
  setSyncMsg("Syncing…");
  try {
    const { data, error } = await sb
      .from("app_state")
      .select("data")
      .eq("user_id", cloudUser.id)
      .maybeSingle();
    if (error) throw error;

    const localUpdated = (db.meta && db.meta.updatedAt) || 0;
    const remote = data && data.data;
    const remoteUpdated = (remote && remote.meta && remote.meta.updatedAt) || 0;

    // Decide direction safely. Timestamps alone are risky: a brand-new device
    // stamps itself "now" on first load, so an EMPTY phone could look newer than
    // a populated laptop and overwrite it. Rule: a device with no real data never
    // overwrites one that has data; only when both (or neither) have data does
    // newest-save win on the whole document.
    const hasData = (d) => !!d && (
      (d.habitLog && Object.keys(d.habitLog).length) ||
      (Array.isArray(d.journal) && d.journal.length) ||
      (Array.isArray(d.bible) && d.bible.length) ||
      (d.tasks && Object.keys(d.tasks).length) ||
      (d.bonusLog && Object.keys(d.bonusLog).length) ||
      (d.workouts && Object.keys(d.workouts).length) ||
      (Array.isArray(d.prayers) && d.prayers.length) ||
      (d.booksRead && Object.keys(d.booksRead).length)
    );
    const remoteHas = hasData(remote), localHas = hasData(db);
    const pullRemote = remoteHas && !localHas ? true
      : localHas && !remoteHas ? false
      : remoteUpdated >= localUpdated;

    if (remote && pullRemote) {
      Object.keys(db).forEach((k) => delete db[k]);
      Object.assign(db, remote);
      migrate();
      saveLocal();
      rerenderAll();
      setSyncMsg("Synced from cloud ☁️");
      toast("Synced from this account ☁️", "up");
    } else {
      await pushRemote(); // local is newer (or remote empty)
      setSyncMsg("Synced ✓");
    }
  } catch (e) {
    console.error("sync-on-login failed", e);
    setSyncMsg("Sync failed — working locally");
  }
  updateSyncUI();
}

async function pushRemote() {
  if (!sb || !cloudUser) return;
  try {
    const { error } = await sb.from("app_state").upsert({
      user_id: cloudUser.id,
      data: db,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setSyncMsg("Synced ✓ " + new Date().toLocaleTimeString());
  } catch (e) {
    console.error("push failed", e);
    setSyncMsg("Couldn't reach cloud — saved locally");
  }
}

// Called by app.js save(); debounced so rapid edits batch into one upload.
function schedulePush() {
  if (!sb || !cloudUser) return;
  clearTimeout(pushTimer);
  setSyncMsg("Saving…");
  pushTimer = setTimeout(pushRemote, 1200);
}

/* ---------- auth actions ---------- */
async function cloudSignIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error;
}
async function cloudSignUp(email, password) {
  const { error } = await sb.auth.signUp({ email, password });
  return error;
}
async function cloudSignOut() {
  await sb.auth.signOut();
  cloudUser = null;
  updateSyncUI();
}

/* ---------- UI ---------- */
function $(id) { return document.getElementById(id); }

function updateSyncUI() {
  const btn = $("syncBtn");
  if (btn) {
    btn.textContent = cloudUser ? "☁ Synced" : cloudConfigured() ? "☁ Sign in to sync" : "☁ Sync";
  }
  const topBtn = $("acctBtnTop");
  if (topBtn) {
    topBtn.textContent = cloudUser ? ("👤 " + ((cloudUser.email || "Account").split("@")[0])) : "Sign in";
    topBtn.classList.toggle("signed-in", !!cloudUser);
  }
  const signedOut = $("acctSignedOut");
  const signedIn = $("acctSignedIn");
  const config = $("acctConfig");
  if (!signedOut || !signedIn || !config) return;

  config.hidden = cloudConfigured();
  signedOut.hidden = !cloudConfigured() || !!cloudUser;
  signedIn.hidden = !cloudUser;
  if (cloudUser) {
    const who = $("acctWho");
    if (who) who.textContent = cloudUser.email || "your account";
  }
}

function setSyncMsg(msg) {
  const el = $("acctSyncMsg");
  if (el) el.textContent = msg;
}

function openAcct() { const m = $("acctModal"); if (m) m.hidden = false; }
function closeAcct() { const m = $("acctModal"); if (m) m.hidden = true; }

function wireAccountUI() {
  const btn = $("syncBtn");
  if (btn) btn.onclick = openAcct;
  const topBtn = $("acctBtnTop");
  if (topBtn) topBtn.onclick = openAcct;
  const close = $("acctClose");
  if (close) close.onclick = closeAcct;
  const modal = $("acctModal");
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeAcct(); });

  const signin = $("acctSignin");
  const signup = $("acctSignup");
  const signout = $("acctSignout");

  async function attempt(fn) {
    const email = ($("acctEmail").value || "").trim();
    const pass = $("acctPass").value || "";
    const msg = $("acctMsg");
    if (!email || !pass) { if (msg) msg.textContent = "Enter an email and password."; return; }
    if (!cloudConfigured()) { if (msg) msg.textContent = "Cloud sync isn't configured yet."; return; }
    if (msg) msg.textContent = "Working…";
    const err = await fn(email, pass);
    if (err) { if (msg) msg.textContent = err.message || "Something went wrong."; }
    else { if (msg) msg.textContent = ""; }
  }

  if (signin) signin.onclick = () => attempt(cloudSignIn);
  if (signup) signup.onclick = () => attempt(async (e, p) => {
    const err = await cloudSignUp(e, p);
    const msg = $("acctMsg");
    if (!err && msg) msg.textContent = "Account created — if email confirmation is on, check your inbox, then sign in.";
    return err;
  });
  if (signout) signout.onclick = cloudSignOut;
}

/* boot once the page + Supabase script have loaded */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCloud);
} else {
  initCloud();
}
