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
  // Deep links:
  //  ?invite=CODE → stash the invite (survives signup/email-confirm) and, if not
  //                 signed in, open the account dialog so the new user signs up first.
  //  ?signin=1 / #signin → just open the sign-in dialog.
  try {
    const q = new URLSearchParams(location.search);
    const invite = q.get("invite");
    if (invite) {
      try { localStorage.setItem("uplvl_pending_invite", invite.toUpperCase().replace(/[^A-Z0-9]/g, "")); } catch (e) {}
      try { history.replaceState({}, "", location.pathname); } catch (e) {} // clean the URL; code is saved
      if (!cloudUser) {
        openAcct();
        const m = document.getElementById("acctMsg");
        if (m) m.textContent = "🤝 Create an account or sign in to accept your friend's invite.";
      }
    } else if (!cloudUser && (q.get("signin") === "1" || location.hash === "#signin")) {
      openAcct();
    }
  } catch (e) {}
  if (cloudUser) syncOnLogin();
}

/* ============================================================
   LIVE MERGE SYNC
   Devices never overwrite each other. We deep-MERGE local + remote —
   unioning habit check-offs, quests, journal, time logs, photos, etc —
   so a completion logged on ANY device is never lost and your rank
   matches everywhere. Pull+merge runs on login, on focus, and on a
   timer; every push merges first so a stale tab can't clobber newer data.
   ============================================================ */
function _isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
// Order-independent stringify, so re-ordered-but-identical data isn't seen as "changed".
function _stable(v) {
  if (Array.isArray(v)) return "[" + v.map(_stable).join(",") + "]";
  if (_isObj(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + _stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function _weight(v) { // DEEP content measure, so real data always outweighs an empty/default shell
  if (v == null) return 0;
  if (Array.isArray(v)) return v.reduce((s, x) => s + 1 + _weight(x), 0);
  if (_isObj(v)) return Object.keys(v).reduce((s, k) => s + _weight(v[k]), 0);
  return v ? 1 : 0;
}
// For "current state" config (challenge, split, …): the richer value wins; newer breaks ties.
function _pickRicher(a, b, aNewer) { const wa = _weight(a), wb = _weight(b); return wa !== wb ? (wa > wb ? a : b) : (aNewer ? a : b); }
// Union arrays of objects by `id`; on conflict keep the newer doc's version.
function _mergeById(a, b, aNewer) {
  a = Array.isArray(a) ? a : []; b = Array.isArray(b) ? b : [];
  const by = {}, order = [];
  const add = (arr, win) => arr.forEach((it) => {
    const id = it && it.id != null ? it.id : _stable(it);
    if (!(id in by)) order.push(id);
    if (!(id in by) || win) by[id] = it;
  });
  if (aNewer) { add(b, false); add(a, true); } else { add(a, false); add(b, true); }
  return order.map((id) => by[id]);
}
function _mergeDayBool(a, b) { // {date:{id:true}} → union keys (a completion on either device wins)
  const out = {}, dates = Object.assign({}, a, b);
  Object.keys(dates).forEach((d) => { out[d] = Object.assign({}, _isObj(a[d]) ? a[d] : {}, _isObj(b[d]) ? b[d] : {}); });
  return out;
}
function _mergeDayDeep(a, b) { // photos {date:{habitId:{slot:url}}} → deep union
  const out = {}, dates = Object.assign({}, a, b);
  Object.keys(dates).forEach((d) => {
    const ad = _isObj(a[d]) ? a[d] : {}, bd = _isObj(b[d]) ? b[d] : {}, o = {}, ids = Object.assign({}, ad, bd);
    Object.keys(ids).forEach((id) => { o[id] = Object.assign({}, _isObj(ad[id]) ? ad[id] : {}, _isObj(bd[id]) ? bd[id] : {}); });
    out[d] = o;
  });
  return out;
}
function _mergeDayById(a, b, aNewer) { // tasks {date:[{id,…}]} → union per day
  const out = {}, dates = Object.assign({}, a, b);
  Object.keys(dates).forEach((d) => { out[d] = _mergeById(a[d], b[d], aNewer); });
  return out;
}
function _mergeDayDedup(a, b) { // timeLog {date:[{habitId,minutes,…}]} → concat + dedupe by value
  const out = {}, dates = Object.assign({}, a, b);
  Object.keys(dates).forEach((d) => {
    const seen = {}, list = [];
    [].concat(Array.isArray(a[d]) ? a[d] : [], Array.isArray(b[d]) ? b[d] : []).forEach((it) => { const k = _stable(it); if (!seen[k]) { seen[k] = 1; list.push(it); } });
    out[d] = list;
  });
  return out;
}
function _mergeDayNewer(a, b, aNewer) { // habitSnap/workouts → per-day from the newer doc (keeps scoring stable)
  const out = {}, dates = Object.assign({}, a, b);
  Object.keys(dates).forEach((d) => { out[d] = (d in a && d in b) ? (aNewer ? a[d] : b[d]) : (d in a ? a[d] : b[d]); });
  return out;
}
function _mergeMeta(a, b) {
  a = _isObj(a) ? a : {}; b = _isObj(b) ? b : {};
  const aNewer = (a.updatedAt || 0) >= (b.updatedAt || 0);
  const out = Object.assign({}, aNewer ? b : a, aNewer ? a : b); // newer wins field-by-field
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  out.onboarded = !!(a.onboarded || b.onboarded);
  out.lastLevel = Math.max(a.lastLevel || 0, b.lastLevel || 0);
  out.lastRankIndex = Math.max(a.lastRankIndex || 0, b.lastRankIndex || 0);
  out.streakMilestones = Object.assign({}, a.streakMilestones, b.streakMilestones);
  if (!out.name) out.name = a.name || b.name; // keep a display name if either has one
  return out;
}
function mergeDB(a, b) {
  a = _isObj(a) ? a : {}; b = _isObj(b) ? b : {};
  const aNewer = ((a.meta && a.meta.updatedAt) || 0) >= ((b.meta && b.meta.updatedAt) || 0);
  const out = {}, keys = Object.assign({}, a, b);
  Object.keys(keys).forEach((k) => {
    const av = a[k], bv = b[k];
    if (av === undefined) { out[k] = bv; return; }
    if (bv === undefined) { out[k] = av; return; }
    switch (k) {
      case "habitLog": case "bonusLog": out[k] = _mergeDayBool(av, bv); break;
      case "photos": out[k] = _mergeDayDeep(av, bv); break;
      case "tasks": out[k] = _mergeDayById(av, bv, aNewer); break;
      case "timeLog": out[k] = _mergeDayDedup(av, bv); break;
      case "habitSnap": case "workouts": out[k] = _mergeDayNewer(av, bv, aNewer); break;
      case "journal": case "bible": case "prayers":
      case "habits": case "principles": case "workoutTemplate":
        out[k] = _mergeById(av, bv, aNewer); break;
      case "achievements": { // key→first-earned timestamp: union, earliest wins
        const o = Object.assign({}, av, bv);
        Object.keys(o).forEach((x) => { o[x] = Math.min((av && av[x]) || Infinity, (bv && bv[x]) || Infinity); });
        out[k] = o; break;
      }
      case "booksRead": out[k] = Object.assign({}, bv, av); break; // union
      case "meta": out[k] = _mergeMeta(av, bv); break;
      default: out[k] = _pickRicher(av, bv, aNewer); // challenge, split, biblePlan, future keys
    }
  });
  return out;
}

/* ---------- pull / push (merge-aware) ---------- */
async function _pullMerge() { // merge cloud into local db; returns true if local changed
  const { data, error } = await sb.from("app_state").select("data").eq("user_id", cloudUser.id).maybeSingle();
  if (error) throw error;
  const remote = data && data.data;
  if (!remote) return false;
  const before = _stable(db);
  const merged = mergeDB(db, remote);
  Object.keys(db).forEach((k) => delete db[k]);
  Object.assign(db, merged);
  migrate();
  const changed = _stable(db) !== before;
  if (changed) { saveLocal(); rerenderAll(); }
  return changed;
}
async function _writeRemote() {
  if (db.meta) db.meta.updatedAt = Date.now();
  const { error } = await sb.from("app_state").upsert({ user_id: cloudUser.id, data: db, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function syncOnLogin() {
  if (!sb || !cloudUser) return;
  friendsOnLogin(); // fire-and-forget: ensure profile/invite code + auto-redeem ?invite=
  setSyncMsg("Syncing…");
  try {
    await _pullMerge();   // fold the cloud into this device
    await _writeRemote(); // push the union back so the cloud has everything too
    setSyncMsg("Synced ✓");
    if (typeof toast === "function") toast("Synced across your devices ☁️", "up");
  } catch (e) {
    console.error("sync-on-login failed", e);
    setSyncMsg("Sync failed — working locally");
  }
  startLiveSync();
  updateSyncUI();
}

// Merge-before-write: a stale tab can never overwrite newer data on another device.
async function pushRemote() {
  if (!sb || !cloudUser) return;
  try {
    await _pullMerge();
    await _writeRemote();
    setSyncMsg("Synced ✓ " + new Date().toLocaleTimeString());
  } catch (e) {
    console.error("push failed", e);
    setSyncMsg("Couldn't reach cloud — saved locally");
  }
}

// Live pull — runs when the app regains focus and on a timer, so devices converge on their own.
async function pullMerge() {
  if (!sb || !cloudUser) return;
  try {
    const changed = await _pullMerge();
    if (changed) { setSyncMsg("Synced ☁️ " + new Date().toLocaleTimeString()); await _writeRemote(); }
  } catch (e) { /* offline — next tick will retry */ }
}

let liveStarted = false;
function startLiveSync() {
  if (liveStarted || !sb || !cloudUser) return;
  liveStarted = true;
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pullMerge(); });
  window.addEventListener("focus", () => pullMerge());
  setInterval(() => { if (!document.hidden && cloudUser) pullMerge(); }, 45000);
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
    await ensureProfile(); // make sure my profile/code exists before I join anyone
    // Pending invite: from localStorage (set on the deep link, survives signup) or the URL.
    let code = null;
    try { code = localStorage.getItem("uplvl_pending_invite"); } catch (e) {}
    if (!code) { try { code = new URLSearchParams(location.search).get("invite"); } catch (e) {} }
    if (code) {
      const r = await redeemInvite(code);
      try { localStorage.removeItem("uplvl_pending_invite"); } catch (e) {}
      try { history.replaceState({}, "", location.pathname); } catch (e) {}
      if (typeof toast === "function") toast((r.ok ? "🤝 " : "⚠️ ") + r.msg, r.ok ? "up" : "down");
      if (r.ok) {
        closeAcct(); // dismiss the sign-in dialog if it's still open
        const ft = document.querySelector('.tab[data-tab="friends"]'); // enroll them on the Friends tab
        if (ft) ft.click(); else if (typeof renderFriends === "function") renderFriends();
      }
    }
    const p = document.getElementById("friends");
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
