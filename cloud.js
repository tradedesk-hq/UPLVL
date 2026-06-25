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
  friendsOnLogin(); // fire-and-forget: ensure profile/invite code + auto-redeem ?invite=
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

/* ============================================================
   FRIENDS & INVITES (Supabase)
   Requires the friends schema (profiles + friendships tables — see
   the SQL in FRIENDS-SETUP). Every call fails gracefully if the
   tables/policies aren't there yet, so the app never breaks.
   ============================================================ */
function genInviteCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
// Snapshot of public stats stored on the profile so friends can see your rank/level.
function friendSnapshot() {
  let level = 1, rankLabel = "Bronze", streak = 0;
  try { const h = computeHistory(); level = levelInfo(h.rp).level; rankLabel = rankForRP(h.rp).label; streak = h.streak; } catch (e) {}
  const fallback = (cloudUser && cloudUser.email ? cloudUser.email.split("@")[0] : "Player");
  const nm = (typeof db !== "undefined" && db.meta && db.meta.name) ? db.meta.name : fallback;
  return { display_name: nm, level: level, rank: rankLabel, streak: streak };
}
// Read (or create) my profile row; keeps my invite code stable, refreshes my stats.
async function ensureProfile() {
  if (!sb || !cloudUser) return null;
  const snap = friendSnapshot();
  const { data: prof, error } = await sb.from("profiles").select("*").eq("id", cloudUser.id).maybeSingle();
  if (error) { console.warn("profiles read failed — friends tables set up?", error.message); return null; }
  if (prof) {
    sb.from("profiles").update({ ...snap, updated_at: new Date().toISOString() }).eq("id", cloudUser.id).then(() => {}, () => {});
    return prof;
  }
  for (let i = 0; i < 5; i++) {
    const code = genInviteCode();
    const { data, error: ie } = await sb.from("profiles").insert({ id: cloudUser.id, invite_code: code, ...snap }).select().maybeSingle();
    if (!ie) return data;
    if (ie.code === "23505") { // unique violation: our row exists, or a code collision
      const { data: again } = await sb.from("profiles").select("*").eq("id", cloudUser.id).maybeSingle();
      if (again) return again;
    } else { console.warn("profile insert failed", ie.message); return null; }
  }
  return null;
}
async function getMyInvite() {
  const prof = await ensureProfile();
  if (!prof || !prof.invite_code) return null;
  const link = location.origin + location.pathname + "?invite=" + prof.invite_code;
  return { code: "UPLVL-" + prof.invite_code, raw: prof.invite_code, link: link };
}
// Redeem someone's code → create a friendship (you = user_a).
async function redeemInvite(input) {
  if (!sb || !cloudUser) return { ok: false, msg: "Sign in first" };
  const code = (input || "").trim().toUpperCase().replace(/^UPLVL-/, "").replace(/[^A-Z0-9]/g, "");
  if (!code) return { ok: false, msg: "Enter a code" };
  const { data: target, error } = await sb.from("profiles").select("id,display_name").eq("invite_code", code).maybeSingle();
  if (error) return { ok: false, msg: "Couldn't reach the server" };
  if (!target) return { ok: false, msg: "No one has that code" };
  if (target.id === cloudUser.id) return { ok: false, msg: "That's your own code 😄" };
  const { error: fe } = await sb.from("friendships").insert({ user_a: cloudUser.id, user_b: target.id });
  if (fe && fe.code !== "23505") return { ok: false, msg: "Couldn't add friend" };
  const nm = target.display_name || "friend";
  return { ok: true, name: nm, msg: (fe && fe.code === "23505") ? ("Already friends with " + nm + " ✓") : ("Added " + nm + " 🤝") };
}
// All my friends' public profiles (friendship is symmetric — either column can be me).
async function listFriends() {
  if (!sb || !cloudUser) return [];
  const { data, error } = await sb.from("friendships").select("user_a,user_b").or("user_a.eq." + cloudUser.id + ",user_b.eq." + cloudUser.id);
  if (error || !data || !data.length) return [];
  const ids = [...new Set(data.map((r) => (r.user_a === cloudUser.id ? r.user_b : r.user_a)))];
  if (!ids.length) return [];
  const { data: profs } = await sb.from("profiles").select("id,display_name,invite_code,level,rank,streak").in("id", ids);
  return profs || [];
}
async function friendsOnLogin() {
  try {
    await ensureProfile();
    const inv = new URLSearchParams(location.search).get("invite");
    if (inv) {
      const r = await redeemInvite(inv);
      if (typeof toast === "function") toast((r.ok ? "🤝 " : "⚠️ ") + r.msg, r.ok ? "up" : "down");
      try { history.replaceState({}, "", location.pathname); } catch (e) {}
    }
    const p = document.getElementById("profile");
    if (p && p.classList.contains("active") && typeof renderFriends === "function") renderFriends();
  } catch (e) { console.warn("friendsOnLogin", e); }
}
// Public API for app.js
window.UPLVLFriends = {
  ready: () => !!(sb && cloudUser),
  configured: cloudConfigured,
  getMyInvite: getMyInvite,
  redeemInvite: redeemInvite,
  listFriends: listFriends,
  openAcct: openAcct,
};

/* boot once the page + Supabase script have loaded */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCloud);
} else {
  initCloud();
}
