/* ============================================================
   UPLVL — local-first personal tracker + ranked system
   Data lives in localStorage. No accounts, no servers.
   ============================================================ */

const DB_KEY = "uplvl.v1";
const LEGACY_DB_KEYS = ["lifeMaxxing.v1"]; // migrate data from the old name

/* ---------- defaults seeded on first run ---------- */
const DEFAULT_HABITS = [
  "Wake up at 7 — no phone while getting ready",
  "Hygiene — skin, hair, teeth & body",
  "Mile run",
  "Practice a skill for an hour",
  "Read Bible for an hour",
  "Eat clean — no snacks",
  "No distractions",
  "Stay clean — room, clothes & dishes",
  "Stay organized — put things back after use",
  "End-of-day diagnosis & journal reflection",
];
const DEFAULT_PRINCIPLES = [
  "Prioritize physical and mental health",
  "Don't chase a life of status — stay humble",
];

/* ---------- scoring config (tweak freely) ---------- */
const SCORING = {
  perHabit: 12,      // XP per habit completed
  perfectBonus: 40,  // bonus for completing every habit in a day
  perGoal: 6,        // XP per one-off goal completed
  missPenalty: 6,    // XP lost per habit missed on a past day
  skipPenalty: 30,   // XP lost for a fully skipped past day
  multStep: 0.04,    // +4% points per day of active streak
  multMax: 2.0,      // multiplier cap (≈25-day streak)
  perSet: 2,         // XP per completed workout set
  workoutBonus: 30,  // bonus for finishing every set of the day's workout
  perMinute: 1,      // XP per focused minute logged
  minuteCap: 120,    // max minutes/day that earn XP
  proofBonus: 10,    // bonus XP for before + after photo proof on a habit
};

// Verification gate. When true: timed habits must be completed via the timer and
// checkable habits must capture a photo (tapping the box can only un-complete).
// OFF for now — simple tap-to-complete (no timer/photo required).
// Flip back to true to require: timed habits via the stopwatch, others via a photo.
const REQUIRE_VERIFICATION = false;

/* ---------- daily bonus quest pool ----------
   Add as many as you like — each needs a unique id. The app deterministically
   picks QUESTS_PER_DAY of these per day (same set all day, reshuffles tomorrow).
   Point guide: 10 = quick/easy, 15 = small effort, 20 = moderate, 25-30 = hard. */
const QUEST_POOL = [
  // --- Fitness & movement ---
  { id: "pushups", text: "Do 30 push-ups", points: 15 },
  { id: "squats", text: "Do 50 squats", points: 15 },
  { id: "plank", text: "Hold a 2-minute plank", points: 15 },
  { id: "jumpingjacks", text: "Do 100 jumping jacks", points: 10 },
  { id: "steps", text: "Hit 10,000 steps", points: 25 },
  { id: "walk20", text: "Go for a 20-minute walk", points: 15 },
  { id: "workout", text: "Do a full workout session", points: 30 },
  { id: "stretch", text: "Stretch for 10 minutes", points: 15 },
  { id: "wallsit", text: "Hold a 5-minute wall sit (in sets)", points: 15 },
  { id: "extramile", text: "Run an extra mile", points: 25 },
  { id: "yoga", text: "Do a 20-minute yoga session", points: 20 },
  { id: "stairs", text: "Take the stairs every time today", points: 15 },
  { id: "activecommute", text: "Walk or bike somewhere instead of driving", points: 20 },
  { id: "mobility", text: "Do 10 minutes of mobility work", points: 15 },

  // --- Discipline & self-control ---
  { id: "nosugar", text: "No added sugar today", points: 25 },
  { id: "nosocialnoon", text: "No social media before noon", points: 20 },
  { id: "nosocialday", text: "No social media all day", points: 30 },
  { id: "cold", text: "Take a cold shower", points: 20 },
  { id: "sleep11", text: "In bed by 11pm", points: 20 },
  { id: "nosnooze", text: "Wake up without hitting snooze", points: 15 },
  { id: "nofastfood", text: "No fast food today", points: 20 },
  { id: "nocaffeinepm", text: "No caffeine after noon", points: 15 },
  { id: "noscreens9", text: "No screens after 9pm", points: 20 },
  { id: "fast168", text: "Intermittent fast (16:8)", points: 25 },
  { id: "nocomplaining", text: "No complaining all day", points: 20 },
  { id: "wateronly", text: "Drink only water today", points: 15 },
  { id: "nophone1hr", text: "No phone for the first hour awake", points: 20 },
  { id: "hardestfirst", text: "Do your hardest task first", points: 20 },
  { id: "nojunk", text: "No junk food today", points: 20 },

  // --- Mind & learning ---
  { id: "read10", text: "Read 10 pages of a book", points: 20 },
  { id: "learn", text: "Learn one new thing and write it down", points: 20 },
  { id: "eduvideo", text: "Watch an educational video or lecture", points: 15 },
  { id: "language", text: "Practice a language for 15 minutes", points: 20 },
  { id: "ideas3", text: "Write down 3 new ideas", points: 15 },
  { id: "podcast", text: "Listen to a podcast that teaches you something", points: 15 },
  { id: "deepwork", text: "45 min of phone-free deep work", points: 20 },
  { id: "puzzle", text: "Solve a puzzle or brain teaser", points: 10 },
  { id: "planahead", text: "Plan tomorrow the night before", points: 15 },
  { id: "teach", text: "Teach someone something you know", points: 15 },
  { id: "read30", text: "Read for 30 minutes", points: 20 },
  { id: "handwrite", text: "Write something by hand for 10 minutes", points: 10 },

  // --- Faith & spirit ---
  { id: "pray", text: "15 min of focused prayer", points: 20 },
  { id: "biblextra", text: "Read an extra chapter of the Bible", points: 20 },
  { id: "memverse", text: "Memorize a Bible verse", points: 15 },
  { id: "prayforsomeone", text: "Pray for someone specifically", points: 15 },
  { id: "worship", text: "Listen to worship or a sermon", points: 15 },
  { id: "writeprayer", text: "Write down a prayer", points: 15 },
  { id: "reflectgod", text: "Reflect on one thing God did for you today", points: 15 },
  { id: "silentmed", text: "10 minutes of silent meditation", points: 15 },
  { id: "devotional", text: "Do a daily devotional", points: 15 },

  // --- Connection & kindness ---
  { id: "call", text: "Call a friend or family member", points: 15 },
  { id: "compliment", text: "Give someone a genuine compliment", points: 10 },
  { id: "gratitude3", text: "Write down 3 things you're grateful for", points: 15 },
  { id: "kindness", text: "Do a random act of kindness", points: 15 },
  { id: "reconnect", text: "Text someone you haven't talked to in a while", points: 15 },
  { id: "nophonetalk", text: "Have a real conversation with no phones", points: 15 },
  { id: "help", text: "Help someone with a task", points: 15 },
  { id: "thankyou", text: "Thank someone who helped you", points: 10 },
  { id: "encourage", text: "Encourage someone today", points: 10 },
  { id: "forgive", text: "Forgive someone or let a grudge go", points: 20 },
  { id: "family", text: "Spend quality time with family", points: 15 },
  { id: "listen", text: "Really listen to someone today", points: 10 },

  // --- Health & self-care ---
  { id: "water", text: "Drink a gallon of water", points: 15 },
  { id: "sunlight", text: "Get 15 minutes of sunlight outside", points: 15 },
  { id: "veggies", text: "Eat a vegetable with every meal", points: 15 },
  { id: "homecooked", text: "Make a healthy home-cooked meal", points: 20 },
  { id: "floss", text: "Floss your teeth", points: 10 },
  { id: "vitamins", text: "Take your vitamins", points: 10 },
  { id: "sleep8", text: "Get 8 hours of sleep", points: 20 },
  { id: "breathe", text: "5 minutes of deep breathing", points: 10 },
  { id: "nosnack", text: "No snacking between meals", points: 15 },
  { id: "fruit", text: "Eat a piece of fruit", points: 10 },
  { id: "nature30", text: "Spend 30 minutes in nature", points: 15 },
  { id: "meditate10", text: "Do a 10-minute meditation", points: 15 },
  { id: "hydratewake", text: "Drink a glass of water right after waking", points: 10 },
  { id: "screenbreak", text: "Take a 20-minute break from all screens", points: 10 },

  // --- Environment & order ---
  { id: "tidy", text: "Tidy a space you've been avoiding", points: 15 },
  { id: "makebed", text: "Make your bed", points: 10 },
  { id: "declutter", text: "Clean out one drawer or shelf", points: 15 },
  { id: "dishesnow", text: "Do the dishes right away", points: 10 },
  { id: "donate3", text: "Throw away or donate 3 things", points: 15 },
  { id: "inboxzero", text: "Clear out your email inbox", points: 15 },
  { id: "wipedesk", text: "Wipe down your desk / workspace", points: 10 },
  { id: "trash", text: "Take out the trash", points: 10 },
  { id: "phonecleanup", text: "Clean up your phone (delete apps / photos)", points: 15 },
  { id: "laundry", text: "Do a load of laundry", points: 10 },

  // --- Productivity & growth ---
  { id: "finishtask", text: "Finish a task you've been putting off", points: 25 },
  { id: "project30", text: "Work on a personal project for 30 min", points: 20 },
  { id: "goals3", text: "Set 3 goals for the day", points: 10 },
  { id: "reviewgoals", text: "Review your goals and progress", points: 15 },
  { id: "skill30", text: "Spend 30 minutes practicing a skill", points: 20 },
  { id: "sayno", text: "Say no to something that wastes your time", points: 15 },
  { id: "trackspending", text: "Track your spending today", points: 15 },
  { id: "noimpulse", text: "No impulse purchases today", points: 15 },
  { id: "todolist", text: "Write a to-do list and finish it", points: 20 },
  { id: "singletask", text: "Single-task — one thing at a time all day", points: 15 },

  // --- Adventure & novelty ---
  { id: "trynew", text: "Try something new today", points: 15 },
  { id: "newroute", text: "Take a different route somewhere", points: 10 },
  { id: "newrecipe", text: "Cook a new recipe", points: 20 },
  { id: "explore", text: "Visit somewhere you've never been", points: 20 },
  { id: "photo", text: "Take a photo of something beautiful", points: 10 },
  { id: "noagenda", text: "Spend an hour with no agenda", points: 10 },
  { id: "create", text: "Make something creative (draw, write, build)", points: 15 },
  { id: "comfortzone", text: "Do one thing outside your comfort zone", points: 20 },

  // --- Mindset & reflection ---
  { id: "win", text: "Write down one win from today", points: 10 },
  { id: "improve", text: "Identify one thing you can improve", points: 10 },
  { id: "why", text: "Reflect on your 'why' for 5 minutes", points: 15 },
  { id: "visualize", text: "Visualize your goals for 5 minutes", points: 10 },
  { id: "selftalk", text: "Practice positive self-talk", points: 10 },
  { id: "silence", text: "Spend 10 minutes in complete silence", points: 15 },
  { id: "avoiding", text: "Ask yourself: what am I avoiding?", points: 15 },
  { id: "futureself", text: "Write a note to your future self", points: 20 },
  { id: "affirm", text: "Write down one affirmation and mean it", points: 10 },
  { id: "diagnose", text: "Do an honest end-of-day self-review", points: 15 },
];
const QUESTS_PER_DAY = 3;

/* ---------- rank tiers (Fortnite-style) ---------- */
const TIERS = [
  { name: "Bronze",   color: "#c8814b", divisions: 3, width: 100 },
  { name: "Silver",   color: "#aeb7c2", divisions: 3, width: 140 },
  { name: "Gold",     color: "#e8c468", divisions: 3, width: 180 },
  { name: "Platinum", color: "#3fc7b4", divisions: 3, width: 230 },
  { name: "Diamond",  color: "#73b6ff", divisions: 3, width: 290 },
  { name: "Elite",    color: "#b388ff", divisions: 1, width: 360 },
  { name: "Champion", color: "#ff7a59", divisions: 1, width: 450 },
  { name: "Unreal",   color: "#ffd24a", divisions: 1, width: 0, unreal: true },
];
const ROMAN = ["I", "II", "III"];
const RANKS = (() => {
  const list = [];
  let cursor = 0;
  for (const t of TIERS) {
    for (let d = 0; d < t.divisions; d++) {
      const label = t.divisions > 1 ? `${t.name} ${ROMAN[d]}` : t.name;
      list.push({ label, tier: t.name, color: t.color, unreal: !!t.unreal, division: t.divisions > 1 ? ROMAN[d] : "", min: cursor });
      cursor += t.width;
    }
  }
  return list;
})();

/* ============================================================
   STORAGE
   ============================================================ */
let loadedFromLegacy = false;
const db = loadDB();
safeMigrate();
// Promote legacy data to the new key once, then remove the stale copy.
if (loadedFromLegacy) {
  saveLocal();
  LEGACY_DB_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
}

// Reset to a fresh DB if data is so broken that migrate() throws — but keep a
// copy of the bad blob so nothing is ever silently destroyed.
function safeMigrate() {
  try {
    migrate();
  } catch (e) {
    console.error("migrate failed — resetting to a fresh DB", e);
    try { localStorage.setItem(DB_KEY + ".broken." + Date.now(), JSON.stringify(db)); } catch (_) {}
    Object.keys(db).forEach((k) => delete db[k]);
    Object.assign(db, { tasks: {}, journal: [], bible: [] });
    migrate();
    alert("Your saved data was unreadable and has been reset. A backup copy was kept on this device.");
  }
}

function loadDB() {
  let raw = localStorage.getItem(DB_KEY);
  if (!raw) { // fall back to data saved under the old app name
    for (const k of LEGACY_DB_KEYS) { const r = localStorage.getItem(k); if (r) { raw = r; loadedFromLegacy = true; break; } }
  }
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Don't clobber recoverable data: stash the corrupt value first.
      console.error("Could not parse saved data — backing it up", e);
      try { localStorage.setItem(DB_KEY + ".corrupt." + Date.now(), raw); } catch (_) {}
      alert("Your saved data looked corrupted and could not be read. A backup copy was kept; the app is starting fresh.");
    }
  }
  return { tasks: {}, journal: [], bible: [] };
}

function isPlainObject(v) { return v && typeof v === "object" && !Array.isArray(v); }

function migrate() {
  let changed = false;
  const obj = (k) => { if (!isPlainObject(db[k])) { db[k] = {}; changed = true; } };
  // Type-guard every field (not just truthiness) so a malformed import or
  // corrupt blob can never survive into the renderers and brick the app.
  obj("tasks"); obj("habitLog"); obj("bonusLog"); obj("habitSnap"); obj("meta");
  obj("biblePlan"); obj("booksRead"); obj("workouts"); obj("timeLog"); obj("achievements"); obj("challenge"); obj("photos");
  // Sanitize the challenge's active block so a malformed import can't brick the renderers.
  if (db.challenge.active !== undefined && db.challenge.active !== null) {
    const a = db.challenge.active;
    const ok = isPlainObject(a) && typeof a.startKey === "string" && isPlainObject(a.checks) &&
      typeof a.reward === "number" && typeof a.stake === "number";
    if (!ok) { db.challenge.active = null; changed = true; }
  }
  if (typeof db.challenge.completed !== "number") { db.challenge.completed = 0; changed = true; }
  if (!Array.isArray(db.journal)) { db.journal = []; changed = true; }
  if (!Array.isArray(db.bible)) { db.bible = []; changed = true; }
  if (!Array.isArray(db.prayers)) { db.prayers = []; changed = true; }
  if (!Array.isArray(db.workoutTemplate)) { db.workoutTemplate = []; changed = true; }
  // Workout split: named days (Push/Pull/Legs…) each with exercises, + a weekly schedule.
  if (!isPlainObject(db.split)) { db.split = { days: [], schedule: {} }; changed = true; }
  if (!Array.isArray(db.split.days)) { db.split.days = []; changed = true; }
  if (!isPlainObject(db.split.schedule)) { db.split.schedule = {}; changed = true; }
  // sanitize each split day so a malformed import can't reach the renderers
  {
    const clean = db.split.days.filter((d) => d && typeof d === "object" && typeof d.id === "string");
    if (clean.length !== db.split.days.length) changed = true;
    clean.forEach((d) => {
      if (typeof d.name !== "string") { d.name = ""; changed = true; }
      d.exercises = Array.isArray(d.exercises) ? d.exercises.filter((e) => e && typeof e === "object") : [];
    });
    db.split.days = clean;
  }
  if (Array.isArray(db.workoutTemplate) && db.workoutTemplate.length && !db.split.days.length) {
    db.split.days.push({ id: uid(), name: "My Workout", exercises: db.workoutTemplate.map((e) => ({ id: uid(), name: e.name, sets: e.sets, reps: e.reps })) });
    changed = true;
  }
  if (typeof db.meta.xpAdjust !== "number") { db.meta.xpAdjust = 0; changed = true; }
  if (typeof db.meta.bonusFreezes !== "number") { db.meta.bonusFreezes = 0; changed = true; }
  if (!isPlainObject(db.meta.streakMilestones)) { db.meta.streakMilestones = {}; changed = true; }
  if (typeof db.meta.lastRecapWeek !== "string") { db.meta.lastRecapWeek = ""; changed = true; }
  // Existing users (already have data) skip onboarding; only brand-new ones see it.
  if (db.meta.onboarded === undefined) {
    db.meta.onboarded = db.journal.length > 0 || db.bible.length > 0 || Object.keys(db.habitLog).length > 0;
    changed = true;
  }
  if (!Array.isArray(db.habits)) { db.habits = DEFAULT_HABITS.map((t) => ({ id: uid(), text: t })); changed = true; }
  if (!Array.isArray(db.principles)) { db.principles = DEFAULT_PRINCIPLES.map((t) => ({ id: uid(), text: t })); changed = true; }

  // Drop malformed items so renderers/scoring never hit a non-object.
  const filt = (arr, pred) => { const f = arr.filter(pred); if (f.length !== arr.length) changed = true; return f; };
  const named = (x) => x && typeof x === "object" && typeof x.id === "string" && typeof x.text === "string";
  const ided = (x) => x && typeof x === "object" && typeof x.id === "string";
  db.habits = filt(db.habits, named);
  db.principles = filt(db.principles, named);
  db.journal = filt(db.journal, ided);
  db.bible = filt(db.bible, ided);
  db.prayers = filt(db.prayers, ided);

  // Backfill a habit snapshot for any already-logged day so changing the habit
  // list later never retroactively re-scores history.
  const liveIds = db.habits.map((h) => h.id);
  Object.keys(db.habitLog).forEach((k) => {
    if (!Array.isArray(db.habitSnap[k])) { db.habitSnap[k] = liveIds.slice(); changed = true; }
  });
  if (changed) save();
}

function saveLocal() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error("Save failed", e);
    alert("Couldn't save — device storage may be full or disabled. Export a backup to avoid losing data.");
    return false;
  }
}

// Public save: stamp a change time, persist locally, and (if cloud sync is
// configured + signed in) schedule a debounced push. schedulePush lives in
// cloud.js and is optional — the app works fully without it.
function save() {
  if (db.meta) db.meta.updatedAt = Date.now();
  const ok = saveLocal();
  if (typeof schedulePush === "function") schedulePush();
  return ok;
}

// Re-render every view after data is replaced wholesale (e.g. a cloud pull).
function rerenderAll() {
  renderDaily();
  renderJournalList();
  renderBible();
  renderBibleExtras();
  // Profile now contains the Insights view too — render both when it's open.
  if (document.getElementById("profile").classList.contains("active")) { renderProfile(); renderInsights(); }
}

/* ============================================================
   HELPERS
   ============================================================ */
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function prettyDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function shortDate(str) {
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
/* deterministic per-day randomness (same quests on reload) */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* accessible checkbox + delete builders */
function makeCheck(done, label, onToggle) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "check";
  b.setAttribute("role", "checkbox");
  b.setAttribute("aria-checked", done ? "true" : "false");
  b.setAttribute("aria-label", label);
  b.textContent = done ? "✓" : "";
  b.onclick = onToggle;
  return b;
}
function makeDel(label, onDel) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "del";
  b.setAttribute("aria-label", label);
  b.textContent = "✕";
  b.onclick = onDel;
  return b;
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "bible") renderBibleExtras();
    if (btn.dataset.tab === "profile") { renderProfile(); renderInsights(); }
  });
});

/* helper: workout XP for a given day */
function workoutPoints(key) {
  const w = db.workouts[key];
  if (!w || !Array.isArray(w.exercises) || !w.exercises.length) return { done: 0, total: 0, xp: 0 };
  let totalSets = 0, doneSets = 0;
  w.exercises.forEach((ex) => {
    const sets = Math.max(0, ex.sets | 0);
    totalSets += sets;
    doneSets += Array.isArray(ex.done) ? ex.done.slice(0, sets).filter(Boolean).length : 0; // never count more than `sets`
  });
  let xp = doneSets * SCORING.perSet;
  if (totalSets > 0 && doneSets >= totalSets) xp += SCORING.workoutBonus;
  return { done: doneSets, total: totalSets, xp };
}
function workoutPotential(key) {
  let exs = (db.workouts[key] && Array.isArray(db.workouts[key].exercises) && db.workouts[key].exercises.length)
    ? db.workouts[key].exercises : null;
  // before a workout is started, forecast today's scheduled split day
  if (!exs && key === ymd(new Date())) {
    const id = db.split.schedule[new Date(key + "T00:00:00").getDay()];
    const day = id && db.split.days.find((d) => d.id === id);
    if (day && Array.isArray(day.exercises)) exs = day.exercises;
  }
  if (!exs || !exs.length) return 0;
  let totalSets = 0;
  exs.forEach((e) => { totalSets += Math.max(0, e.sets | 0); });
  return totalSets * SCORING.perSet + (totalSets > 0 ? SCORING.workoutBonus : 0);
}
/* helper: focused minutes XP for a given day (capped) */
function minutesFor(key) {
  const sessions = db.timeLog[key];
  if (!Array.isArray(sessions)) return 0;
  return sessions.reduce((s, x) => s + (x.minutes | 0), 0);
}
function minutePoints(key) {
  return Math.min(minutesFor(key), SCORING.minuteCap) * SCORING.perMinute;
}

/* ============================================================
   RANK + SCORING ENGINE
   ============================================================ */
function questsForDay(key) {
  const rng = mulberry32(hashStr(key));
  const pool = QUEST_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, QUESTS_PER_DAY);
}

function mult(streak) {
  return Math.min(SCORING.multMax, 1 + streak * SCORING.multStep);
}

// Which habit ids count for a given day. Today uses the live list (so newly
// added habits are immediately actionable); past days use the snapshot frozen
// when they were last edited, so changing your habit list never re-scores
// history. Days with no snapshot (e.g. skipped days) fall back to the live list.
function habitIdsForDay(key) {
  if (key === ymd(new Date())) return db.habits.map((h) => h.id);
  const snap = db.habitSnap[key];
  return snap ? snap : db.habits.map((h) => h.id);
}

function dayComplete(key) {
  const ids = habitIdsForDay(key);
  if (ids.length === 0) return false;
  const log = db.habitLog[key] || {};
  return ids.every((id) => log[id]);
}

// Bonus XP for completed habits that have BOTH a before and after photo.
function proofBonusFor(key) {
  const photos = db.photos[key];
  if (!photos) return 0;
  const log = db.habitLog[key] || {};
  let bonus = 0;
  habitIdsForDay(key).forEach((id) => {
    const p = photos[id];
    if (log[id] && p && p.before && p.after) bonus += SCORING.proofBonus;
  });
  return bonus;
}

function dayGross(key) {
  const ids = habitIdsForDay(key);
  const log = db.habitLog[key] || {};
  const done = ids.filter((id) => log[id]).length;
  let g = done * SCORING.perHabit;
  if (ids.length > 0 && done === ids.length) g += SCORING.perfectBonus;
  const tasks = db.tasks[key] || [];
  g += tasks.filter((t) => t.done).length * SCORING.perGoal;
  const blog = db.bonusLog[key] || {};
  g += questsForDay(key).filter((q) => blog[q.id]).reduce((s, q) => s + q.points, 0);
  g += workoutPoints(key).xp;
  g += minutePoints(key);
  g += proofBonusFor(key);
  return g;
}

function dayGrossPotential(key) {
  const ids = habitIdsForDay(key);
  let g = ids.length * SCORING.perHabit;
  if (ids.length > 0) g += SCORING.perfectBonus;
  const tasks = db.tasks[key] || [];
  g += tasks.length * SCORING.perGoal;
  g += questsForDay(key).reduce((s, q) => s + q.points, 0);
  g += workoutPotential(key);
  // potential includes whatever minutes are already logged (timed work is open-ended)
  g += minutePoints(key);
  g += db.habits.filter((h) => h.proof).length * SCORING.proofBonus;
  return g;
}

function dayPenalty(key) {
  const ids = habitIdsForDay(key);
  if (ids.length === 0) return 0;
  const log = db.habitLog[key] || {};
  const done = ids.filter((id) => log[id]).length;
  const tasks = db.tasks[key] || [];
  const blog = db.bonusLog[key] || {};
  const questsDone = questsForDay(key).filter((q) => blog[q.id]).length;
  const anyActivity = done > 0 || tasks.some((t) => t.done) || questsDone > 0 ||
    workoutPoints(key).done > 0 || minutesFor(key) > 0;
  if (!anyActivity) return SCORING.skipPenalty;       // showed up for nothing
  return (ids.length - done) * SCORING.missPenalty;   // missed required habits
}

/* Pure recompute of rank state + a per-day series, from full history. */
function computeHistory() {
  const todayKey = ymd(new Date());
  const keys = new Set();
  Object.keys(db.habitLog).forEach((k) => keys.add(k));
  Object.keys(db.tasks).forEach((k) => { if ((db.tasks[k] || []).length) keys.add(k); });
  Object.keys(db.bonusLog).forEach((k) => keys.add(k));
  Object.keys(db.workouts).forEach((k) => { if (workoutPoints(k).done > 0) keys.add(k); });
  Object.keys(db.timeLog).forEach((k) => { if (minutesFor(k) > 0) keys.add(k); });
  const active = [...keys].filter((k) => k <= todayKey).sort();

  const days = [];
  let rp = 0, runStreak = 0, longest = 0, perfectDays = 0, questsTotal = 0, freezesUsed = 0;
  let todayMult = mult(0), todayEarned = 0, todayAvailable = 0;

  if (active.length) {
    const cur = new Date(active[0] + "T00:00:00");
    const end = new Date(todayKey + "T00:00:00");
    while (cur <= end) {
      const key = ymd(cur);
      const m = mult(runStreak);
      const ids = habitIdsForDay(key);
      const log = db.habitLog[key] || {};
      const habitsDone = ids.filter((id) => log[id]).length;
      const ratio = ids.length ? habitsDone / ids.length : 0;
      const gross = dayGross(key);
      const blog = db.bonusLog[key] || {};
      const questsDone = questsForDay(key).filter((q) => blog[q.id]).length;
      questsTotal += questsDone;
      const complete = dayComplete(key);
      let earned, penalty = 0, frozen = false;

      if (key === todayKey) {
        todayMult = m;
        earned = Math.round(gross * m);
        todayEarned = earned;
        todayAvailable = Math.max(0, Math.round(dayGrossPotential(key) * m) - earned);
        rp += earned;
        if (complete) runStreak += 1;
      } else if (complete) {
        earned = Math.round(gross * m);
        rp += earned;
        runStreak += 1;
      } else {
        earned = Math.round(gross * m);
        // a missed day that would break an active streak: auto-spend a freeze if we have one.
        // Budget is derived ONLY from history (1 per 7 perfect days) so the recompute stays
        // pure & deterministic — milestone grants must NOT feed back into this.
        const freezesAvail = Math.floor(perfectDays / 7) - freezesUsed;
        if (runStreak > 0 && ids.length > 0 && freezesAvail > 0) {
          freezesUsed += 1; frozen = true;
          rp += earned; // protected: keep partial earnings, no penalty, streak carries through
        } else {
          penalty = dayPenalty(key);
          rp += earned - penalty;
          if (rp < 0) rp = 0;
          runStreak = 0;
        }
      }
      if (complete) perfectDays += 1;
      if (runStreak > longest) longest = runStreak;
      days.push({ key, ratio, complete, frozen, habitsDone, habitsTotal: ids.length, earned, penalty, questsDone, cumRP: rp });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    todayMult = mult(0);
    todayAvailable = Math.round(dayGrossPotential(todayKey) * todayMult);
  }
  const adj = db.meta.xpAdjust || 0; // staked/awarded XP (challenges, achievements)
  if (adj) days.forEach((d) => { d.cumRP = Math.max(0, d.cumRP + adj); });
  rp = Math.max(0, rp + adj);
  const freezes = Math.max(0, Math.floor(perfectDays / 7) - freezesUsed);
  return { days, rp, streak: runStreak, longest, perfectDays, questsTotal, daysActive: active.length, freezes, todayMult, todayEarned, todayAvailable };
}

function computeState() {
  const h = computeHistory();
  return { rp: h.rp, streak: h.streak, freezes: h.freezes, todayMult: h.todayMult, todayEarned: h.todayEarned, todayAvailable: h.todayAvailable };
}

/* streak milestones: claim XP + a freeze the first time a streak length is reached */
const STREAK_MILESTONES = [
  { days: 7, xp: 50 }, { days: 30, xp: 200 }, { days: 100, xp: 750 }, { days: 365, xp: 3000 },
];
// Grants XP only (NOT freezes — freezes are history-derived; granting them here would
// let a milestone retroactively un-break a past gap and feed back into the streak).
// Returns true if anything was granted, so the caller can repaint with the new XP.
function checkStreakMilestones(longest) {
  let granted = false;
  STREAK_MILESTONES.forEach((m) => {
    if (longest >= m.days && !db.meta.streakMilestones[m.days]) {
      db.meta.streakMilestones[m.days] = Date.now();
      db.meta.xpAdjust = (db.meta.xpAdjust || 0) + m.xp;
      toast(`🔥 ${m.days}-day streak! +${m.xp} XP`, "up");
      granted = true;
    }
  });
  if (granted) save();
  return granted;
}

function rankForRP(rp) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (rp >= RANKS[i].min) idx = i; else break;
  }
  return { ...RANKS[idx], index: idx, next: RANKS[idx + 1] || null };
}

// Level from XP — accelerating curve: each level costs progressively more XP,
// so climbing gets meaningfully harder the higher your rank.
function levelCost(level) {
  return Math.round(100 + (level - 1) * 45 + Math.pow(level - 1, 2) * 4);
}
function levelInfo(xp) {
  let level = 1, acc = 0, need = levelCost(1);
  while (xp >= acc + need) { acc += need; level++; need = levelCost(level); }
  return { level, into: xp - acc, span: need, toNext: acc + need - xp };
}

function renderRank() {
  // resolve milestone grants BEFORE painting so the reward shows this render, not next
  let h = computeHistory();
  if (checkStreakMilestones(h.longest)) h = computeHistory();
  const state = { rp: h.rp, streak: h.streak, freezes: h.freezes, todayMult: h.todayMult, todayEarned: h.todayEarned, todayAvailable: h.todayAvailable };
  const xp = state.rp;
  const rank = rankForRP(xp);
  const lvl = levelInfo(xp);

  // badge (tier)
  const badge = document.getElementById("rankBadge");
  badge.className = "badge" + (rank.unreal ? " unreal" : "");
  badge.style.setProperty("--tier-color", rank.color);
  document.getElementById("badgeDiv").textContent = rank.division || (rank.unreal ? "★" : "");

  // headline: Level (primary) + tier (title) + XP
  document.getElementById("rankName").textContent = "Level " + lvl.level;
  const tierEl = document.getElementById("rankTier");
  tierEl.textContent = rank.label;
  tierEl.style.color = rank.color;
  document.getElementById("rankRP").textContent = xp.toLocaleString() + " XP";

  // progress bar = progress to next level
  const fill = document.getElementById("rankBarFill");
  fill.style.width = Math.round((lvl.into / lvl.span) * 100) + "%";
  fill.style.background = rank.color;
  document.getElementById("rankToNext").textContent =
    lvl.toNext.toLocaleString() + " XP to Level " + (lvl.level + 1);

  // streak + multiplier + freezes
  const freezeBit = state.freezes > 0 ? ` · 🧊 ${state.freezes}` : "";
  document.getElementById("rankStreak").textContent = state.streak > 0
    ? `🔥 ${state.streak}-day streak · ×${state.todayMult.toFixed(2)}${freezeBit}`
    : `No streak yet · ×${state.todayMult.toFixed(2)}${freezeBit}`;

  // today's XP
  const todayEl = document.getElementById("rankToday");
  if (db.habits.length === 0) {
    todayEl.textContent = "Add daily habits to start earning XP.";
  } else if (state.todayAvailable > 0) {
    todayEl.textContent = `+${state.todayEarned} XP today · up to +${state.todayAvailable} more available`;
  } else {
    todayEl.textContent = `+${state.todayEarned} XP today · all points earned ✓`;
  }

  // header chip
  const chip = document.getElementById("rankChip");
  chip.hidden = false;
  chip.textContent = `Lvl ${lvl.level} · ${rank.label}`;
  chip.style.setProperty("--tier-color", rank.color);

  // level-up toast
  if (db.meta.lastLevel === undefined) {
    db.meta.lastLevel = lvl.level; save();
  } else if (lvl.level > db.meta.lastLevel) {
    toast(`⬆️ Level ${lvl.level}!`, "up");
    db.meta.lastLevel = lvl.level; save();
  } else if (lvl.level < db.meta.lastLevel) {
    db.meta.lastLevel = lvl.level; save();
  }

  // rank-up / derank toast
  if (db.meta.lastRankIndex === undefined) {
    db.meta.lastRankIndex = rank.index; save();
  } else if (rank.index > db.meta.lastRankIndex) {
    const prevTier = RANKS[db.meta.lastRankIndex] && RANKS[db.meta.lastRankIndex].tier;
    if (prevTier && prevTier !== rank.tier) toast(`🎖️ TIER UP — ${rank.tier}! Title unlocked: “${tierTitle(rank.tier)}”`, "up");
    else toast(`Ranked up to ${rank.label}! 🎉`, "up");
    db.meta.lastRankIndex = rank.index; save();
  } else if (rank.index < db.meta.lastRankIndex) {
    toast(`Deranked to ${rank.label}`, "down");
    db.meta.lastRankIndex = rank.index; save();
  }

  checkAchievements();
}

/* ============================================================
   DAILY
   ============================================================ */
let currentDay = new Date();
currentDay.setHours(0, 0, 0, 0);

const taskList = document.getElementById("taskList");
const taskInput = document.getElementById("taskInput");
const taskEmpty = document.getElementById("taskEmpty");
const habitList = document.getElementById("habitList");
const habitInput = document.getElementById("habitInput");
const habitEmpty = document.getElementById("habitEmpty");
const questList = document.getElementById("questList");
const principleList = document.getElementById("principleList");
const principleInput = document.getElementById("principleInput");
const principleEmpty = document.getElementById("principleEmpty");

function dayKey() { return ymd(currentDay); }
function ymdDaysAgo(n) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return ymd(d); }
function isToday() { return dayKey() === ymd(new Date()); }
// Today and yesterday are editable — so you can backfill anything you forgot.
// Older days are view-only; future days are unreachable. Scoring recomputes from the
// full history, so editing yesterday correctly updates XP, streaks and ranks.
function isEditableDay() { const k = dayKey(); return k === ymd(new Date()) || k === ymdDaysAgo(1); }

function renderDaily() {
  const key = dayKey();
  const todayKey = ymd(new Date());
  const onToday = key === todayKey;
  const editable = isEditableDay();
  document.getElementById("dayTitle").textContent =
    onToday ? "Today" : key === ymdDaysAgo(1) ? "Yesterday" : shortDate(key);
  document.getElementById("todayLabel").textContent = prettyDate(new Date()); // keep fresh across midnight

  // lock UI only for days you can no longer edit; block navigating into the future
  document.getElementById("dayLock").hidden = editable;
  document.getElementById("daily").classList.toggle("locked", !editable);
  document.getElementById("dayNext").disabled = key >= todayKey;

  renderHabits(key);
  renderQuests(key);
  renderWorkout(key);
  renderTasks(key);
  renderPrinciples();
  renderDailyStats(key);
  evaluateChallenge();   // resolve win/loss BEFORE painting the boss slot
  renderBossSlot();
  renderRank();
}

/* ----- recurring daily habits ----- */
function completeHabit(key, h, makeDone) {
  const l = db.habitLog[key] || (db.habitLog[key] = {});
  if (makeDone) l[h.id] = true; else delete l[h.id];
  db.habitSnap[key] = db.habits.map((x) => x.id); // freeze this day's habit set
  save(); renderDaily();
}

function renderHabits(key) {
  const editable = isEditableDay();
  const log = db.habitLog[key] || {};
  const photos = db.photos[key] || {};
  habitList.innerHTML = "";
  habitEmpty.hidden = db.habits.length > 0;

  db.habits.forEach((h) => {
    const timed = !!h.timed;
    const done = !!log[h.id];
    const li = document.createElement("li");
    li.className = "task habit-row" + (done ? " done" : "");

    // With verification ON: timed tasks complete via the timer, checkable tasks
    // complete via a photo (tapping the box can only UN-complete). With it OFF:
    // tapping the box just completes/un-completes the habit.
    const check = makeCheck(done, h.text, () => {
      if (!editable) return;
      if (done) { completeHabit(key, h, false); return; }
      if (REQUIRE_VERIFICATION) {
        if (timed) { toast("⏱ Start the timer to complete this"); return; }
        capturePhoto(key, h.id, "after", () => completeHabit(key, h, true)); // photo required
      } else {
        completeHabit(key, h, true); // verification off — tap to complete
      }
    });
    if (!editable) check.disabled = true;

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = h.text;
    li.append(check, label);

    if (REQUIRE_VERIFICATION) {
      if (timed) li.appendChild(renderHabitTimer(h, editable));
      else li.appendChild(renderProofControls(key, h, photos[h.id], editable));
    }

    // manage-mode tools: task TYPE toggle (only when verification is on) + delete
    const tools = document.createElement("span");
    tools.className = "habit-tools";
    if (REQUIRE_VERIFICATION) {
      const typeBtn = document.createElement("button");
      typeBtn.type = "button";
      typeBtn.className = "tool" + (timed ? " on" : "");
      typeBtn.textContent = timed ? "⏱" : "📷";
      typeBtn.title = timed ? "Timed task (tap for photo type)" : "Photo task (tap for timed type)";
      typeBtn.onclick = () => { h.timed = !h.timed; save(); renderDaily(); };
      tools.appendChild(typeBtn);
    }
    const del = makeDel("Remove habit: " + h.text, () => {
      if (!confirm(`Remove "${h.text}" from your daily habits?`)) return;
      if (timerHabitId === h.id) stopHabitTimer();          // don't orphan a running timer
      Object.keys(db.photos).forEach((k) => { if (db.photos[k]) delete db.photos[k][h.id]; }); // prune its photos
      db.habits = db.habits.filter((x) => x.id !== h.id);
      save(); renderDaily();
    });
    tools.appendChild(del);
    li.appendChild(tools);

    habitList.appendChild(li);
  });
}

/* per-habit focus timer (lives under the timed task) */
function renderHabitTimer(h, editable) {
  const wrap = document.createElement("span");
  wrap.className = "habit-timer";
  const mins = habitMinutes(ymd(new Date()), h.id);
  if (timerHabitId === h.id && timerRunning) {
    const clk = document.createElement("span");
    clk.className = "ht-clock"; clk.id = "htClock"; clk.textContent = "00:00";
    const stop = document.createElement("button");
    stop.type = "button"; stop.className = "ht-btn running"; stop.textContent = "Stop";
    stop.disabled = !editable;
    stop.onclick = stopHabitTimer;
    wrap.append(clk, stop);
  } else {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ht-btn"; btn.textContent = mins ? `▶ ${mins}m` : "▶ Start";
    btn.disabled = !editable || timerRunning;
    btn.onclick = () => startHabitTimer(h);
    wrap.append(btn);
  }
  return wrap;
}

/* photo proof controls */
function renderProofControls(key, h, photo, editable) {
  photo = photo || {};
  const wrap = document.createElement("span");
  wrap.className = "habit-proof";
  ["before", "after"].forEach((slot) => {
    if (photo[slot]) {
      const im = document.createElement("img");
      im.className = "proof-thumb"; im.src = photo[slot]; im.alt = slot; im.title = slot + " photo";
      im.onclick = () => showPhoto(photo[slot]);
      wrap.appendChild(im);
    }
  });
  if (editable) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "proof-btn";
    b.textContent = photo.before ? "retake before" : "📷 before";
    b.onclick = () => capturePhoto(key, h.id, "before");
    wrap.appendChild(b);
  }
  return wrap;
}

function addHabit() {
  const text = habitInput.value.trim();
  if (!text) return;
  db.habits.push({ id: uid(), text });
  habitInput.value = "";
  save(); renderDaily();
}

document.getElementById("habitAdd").onclick = addHabit;
habitInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addHabit(); });
document.getElementById("habitManage").onclick = (e) => {
  const on = habitList.classList.toggle("managing");
  document.getElementById("habitManager").hidden = !on;
  e.currentTarget.textContent = on ? "Done" : "Manage";
  e.currentTarget.setAttribute("aria-pressed", on ? "true" : "false");
  if (on) habitInput.focus();
};

/* ----- daily bonus quests ----- */
function renderQuests(key) {
  const editable = isEditableDay();
  const blog = db.bonusLog[key] || {};
  questList.innerHTML = "";
  questsForDay(key).forEach((q) => {
    const done = !!blog[q.id];
    const li = document.createElement("li");
    li.className = "task quest" + (done ? " done" : "");

    const check = makeCheck(done, q.text, () => {
      if (!editable) return;
      const l = db.bonusLog[key] || (db.bonusLog[key] = {});
      if (l[q.id]) delete l[q.id]; else l[q.id] = true;
      save(); renderDaily();
    });
    if (!editable) check.disabled = true;

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = q.text;

    const pts = document.createElement("span");
    pts.className = "pts";
    pts.textContent = "+" + q.points;

    li.append(check, label, pts);
    questList.appendChild(li);
  });
}

/* ----- one-off goals for the selected day ----- */
function renderTasks(key) {
  const editable = isEditableDay();
  const tasks = db.tasks[key] || [];
  taskList.innerHTML = "";
  taskEmpty.style.display = tasks.length ? "none" : "block";

  tasks.forEach((t) => {
    const li = document.createElement("li");
    li.className = "task" + (t.done ? " done" : "");

    const check = makeCheck(t.done, t.text, () => { if (!editable) return; t.done = !t.done; save(); renderDaily(); });
    if (!editable) check.disabled = true;

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = t.text;

    li.append(check, label);
    if (editable) {
      li.appendChild(makeDel("Delete goal: " + t.text, () => {
        db.tasks[key] = tasks.filter((x) => x.id !== t.id);
        save(); renderDaily();
      }));
    }
    taskList.appendChild(li);
  });
}

function addTask() {
  if (!isEditableDay()) return;
  const text = taskInput.value.trim();
  if (!text) return;
  const key = dayKey();
  if (!db.tasks[key]) db.tasks[key] = [];
  db.tasks[key].push({ id: uid(), text, done: false });
  taskInput.value = "";
  save(); renderDaily();
}

document.getElementById("taskAdd").onclick = addTask;
taskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });

/* ----- guiding principles ----- */
function renderPrinciples() {
  principleList.innerHTML = "";
  principleEmpty.hidden = db.principles.length > 0;

  db.principles.forEach((p) => {
    const li = document.createElement("li");
    li.className = "principle";

    const star = document.createElement("span");
    star.className = "star";
    star.textContent = "★";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = p.text;

    const del = makeDel("Remove principle: " + p.text, () => {
      if (!confirm(`Remove "${p.text}"?`)) return;
      db.principles = db.principles.filter((x) => x.id !== p.id);
      save(); renderDaily();
    });

    li.append(star, label, del);
    principleList.appendChild(li);
  });
}

function addPrinciple() {
  const text = principleInput.value.trim();
  if (!text) return;
  db.principles.push({ id: uid(), text });
  principleInput.value = "";
  save(); renderDaily();
}

document.getElementById("principleAdd").onclick = addPrinciple;
principleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addPrinciple(); });
document.getElementById("principleManage").onclick = (e) => {
  const on = principleList.classList.toggle("managing");
  document.getElementById("principleManager").hidden = !on;
  e.currentTarget.textContent = on ? "Done" : "Manage";
  e.currentTarget.setAttribute("aria-pressed", on ? "true" : "false");
  if (on) principleInput.focus();
};

/* ----- day navigation ----- */
document.getElementById("dayPrev").onclick = () => {
  currentDay.setDate(currentDay.getDate() - 1); currentDay.setHours(0, 0, 0, 0); renderDaily();
};
document.getElementById("dayNext").onclick = () => {
  currentDay.setDate(currentDay.getDate() + 1); currentDay.setHours(0, 0, 0, 0); renderDaily();
};

/* ----- per-day stats ----- */
function renderDailyStats(key) {
  const log = db.habitLog[key] || {};
  const habitsDone = db.habits.filter((h) => log[h.id]).length;
  const tasks = db.tasks[key] || [];
  const tasksDone = tasks.filter((t) => t.done).length;
  const blog = db.bonusLog[key] || {};
  const questsDone = questsForDay(key).filter((q) => blog[q.id]).length;

  const parts = [];
  if (db.habits.length) parts.push(`${habitsDone}/${db.habits.length} habits`);
  parts.push(`${questsDone}/${QUESTS_PER_DAY} quests`);
  if (tasks.length) parts.push(`${tasksDone}/${tasks.length} goals`);
  document.getElementById("dailyStats").textContent = parts.join(" · ");
}

/* ============================================================
   JOURNAL
   ============================================================ */
let activeEntryId = null;

const jList = document.getElementById("journalList");
const jTitle = document.getElementById("journalTitle");
const jTags = document.getElementById("journalTags");
const jBody = document.getElementById("journalBody");
const jMeta = document.getElementById("journalMeta");
const jSaved = document.getElementById("journalSaved");
const jSearch = document.getElementById("journalSearch");

function entryTags(entry) { return Array.isArray(entry.tags) ? entry.tags : []; }
function parseTags(str) { return (str || "").split(",").map((s) => s.trim()).filter(Boolean); }

function renderJournalList() {
  jList.innerHTML = "";
  const q = (jSearch.value || "").trim().toLowerCase();
  let entries = db.journal.slice().sort((a, b) => b.created - a.created);
  if (q) {
    entries = entries.filter((e) =>
      (e.title || "").toLowerCase().includes(q) ||
      (e.body || "").toLowerCase().includes(q) ||
      entryTags(e).some((t) => t.toLowerCase().includes(q)));
  }
  if (!entries.length) {
    jList.innerHTML = `<p class="empty" style="padding:14px">${db.journal.length ? "No matches." : "No entries yet."}</p>`;
    return;
  }
  entries.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "entry-item" + (entry.id === activeEntryId ? " active" : "");
    const tags = entryTags(entry);
    div.innerHTML = `
      <div class="ei-title">${escapeHtml(entry.title || "Untitled")}</div>
      <div class="ei-date">${new Date(entry.created).toLocaleDateString()}</div>
      ${tags.length ? `<div class="ei-tags">${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}`;
    div.onclick = () => openEntry(entry.id);
    jList.appendChild(div);
  });
}

function openEntry(id) {
  const entry = db.journal.find((e) => e.id === id);
  if (!entry) return;
  activeEntryId = id;
  jTitle.value = entry.title || "";
  jTags.value = entryTags(entry).join(", ");
  jBody.value = entry.body || "";
  jMeta.textContent = "Created " + new Date(entry.created).toLocaleString();
  jSaved.textContent = "";
  renderJournalList();
}

function newEntry() {
  const entry = { id: uid(), title: "", body: "", tags: [], created: Date.now() };
  db.journal.push(entry);
  save();
  openEntry(entry.id);
  jTitle.focus();
}

// Return the active entry, creating one if needed — WITHOUT touching the
// input fields (so whatever the user has typed is never clobbered).
function ensureEntry() {
  if (activeEntryId) {
    const found = db.journal.find((e) => e.id === activeEntryId);
    if (found) return found;
  }
  const entry = { id: uid(), title: "", body: "", tags: [], created: Date.now() };
  db.journal.push(entry);
  activeEntryId = entry.id;
  jMeta.textContent = "Created " + new Date(entry.created).toLocaleString();
  return entry;
}

function writeActiveEntry(entry) {
  entry.title = jTitle.value.trim();
  entry.body = jBody.value;
  entry.tags = parseTags(jTags.value);
}

function saveEntry() {
  const entry = ensureEntry();
  writeActiveEntry(entry);
  if (!save()) return;
  renderJournalList();
  jSaved.textContent = "Saved ✓";
  setTimeout(() => (jSaved.textContent = ""), 1800);
  // Designed card (image / PDF) is opened on demand via the toolbar button, not every Save.
}

// Autosave: anything typed is captured even if the user never clicks Save.
let jSaveTimer = null;
function journalAutosave() {
  // don't spawn an empty entry just from focus/blur — only once there's content
  if (!activeEntryId && !jTitle.value.trim() && !jBody.value.trim() && !jTags.value.trim()) return;
  const entry = ensureEntry();
  writeActiveEntry(entry);
  clearTimeout(jSaveTimer);
  jSaveTimer = setTimeout(() => {
    if (save()) {
      renderJournalList();
      jSaved.textContent = "Saved ✓";
      setTimeout(() => (jSaved.textContent = ""), 1200);
    }
  }, 600);
}
jTitle.addEventListener("input", journalAutosave);
jBody.addEventListener("input", journalAutosave);
jTags.addEventListener("input", journalAutosave);

function deleteEntry() {
  if (!activeEntryId) return;
  if (!confirm("Delete this journal entry?")) return;
  db.journal = db.journal.filter((e) => e.id !== activeEntryId);
  activeEntryId = null;
  jTitle.value = ""; jTags.value = ""; jBody.value = ""; jMeta.textContent = "";
  save();
  renderJournalList();
}

/* ----- reflection prompts ----- */
const PROMPTS = [
  "What are three things you're grateful for today?",
  "Where did you see God at work today?",
  "What challenged you today, and how did you respond?",
  "What's one thing you could have done better?",
  "Who did you impact today, and how?",
  "What are you anxious about — and what does Scripture say about it?",
  "What did you learn today?",
  "Which habit do you want to be more consistent with, and why?",
  "Describe a moment today you felt truly present.",
  "What is God teaching you in this season?",
  "What would make tomorrow great?",
  "What did you avoid today that you know you should face?",
  "How did you care for your body and mind today?",
  "What's one thing you're proud of from today?",
  "Where do you need to show more humility?",
  "What temptation did you face, and how did you handle it?",
  "Who do you need to forgive or reach out to?",
  "What does living with purpose look like for you right now?",
];

function insertPrompt() {
  const ensure = ensureEntry();
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  const cur = jBody.value.trim();
  jBody.value = (cur ? cur + "\n\n" : "") + prompt + "\n";
  jBody.focus();
  jBody.setSelectionRange(jBody.value.length, jBody.value.length);
  writeActiveEntry(ensure);
  save();
  renderJournalList();
}

/* ----- end-of-day review (pre-filled with today's stats) ----- */
function endOfDayReview() {
  const key = ymd(new Date());
  const state = computeState();
  const log = db.habitLog[key] || {};
  const habitsDone = db.habits.filter((h) => log[h.id]).length;
  const blog = db.bonusLog[key] || {};
  const questsDone = questsForDay(key).filter((q) => blog[q.id]).length;
  const tasks = db.tasks[key] || [];
  const tasksDone = tasks.filter((t) => t.done).length;

  const entry = {
    id: uid(),
    title: "End of day — " + shortDate(key),
    tags: ["end-of-day"],
    created: Date.now(),
    body:
`${prettyDate(new Date())}

📊 Today: ${habitsDone}/${db.habits.length} habits · ${questsDone}/${QUESTS_PER_DAY} quests${tasks.length ? ` · ${tasksDone}/${tasks.length} goals` : ""}
🏆 +${state.todayEarned} XP today (×${state.todayMult.toFixed(2)}) · ${state.streak}-day streak

✅ Wins today:
-

🔧 What I could've done better:
-

🙏 What I'm grateful for:
-

🎯 Tomorrow's focus:
- `,
  };
  db.journal.push(entry);
  save();
  // make sure we're on the Journal tab
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.querySelector('.tab[data-tab="journal"]').classList.add("active");
  document.getElementById("journal").classList.add("active");
  openEntry(entry.id);
  jBody.focus();
}

document.getElementById("journalNew").onclick = newEntry;
document.getElementById("journalSave").onclick = saveEntry;
document.getElementById("journalDelete").onclick = deleteEntry;
document.getElementById("journalPrompt").onclick = insertPrompt;
document.getElementById("journalEod").onclick = endOfDayReview;
jSearch.addEventListener("input", renderJournalList);

/* ============================================================
   BIBLE READING
   ============================================================ */
const BOOKS = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
"1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther",
"Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
"Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah",
"Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians",
"2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
"1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John",
"3 John","Jude","Revelation"];

document.getElementById("bookList").innerHTML =
  BOOKS.map((b) => `<option value="${b}">`).join("");

/* chapter counts per book (KJV) */
const CHAPTERS = {
  Genesis:50,Exodus:40,Leviticus:27,Numbers:36,Deuteronomy:34,Joshua:24,Judges:21,Ruth:4,
  "1 Samuel":31,"2 Samuel":24,"1 Kings":22,"2 Kings":25,"1 Chronicles":29,"2 Chronicles":36,
  Ezra:10,Nehemiah:13,Esther:10,Job:42,Psalms:150,Proverbs:31,Ecclesiastes:12,"Song of Solomon":8,
  Isaiah:66,Jeremiah:52,Lamentations:5,Ezekiel:48,Daniel:12,Hosea:14,Joel:3,Amos:9,Obadiah:1,
  Jonah:4,Micah:7,Nahum:3,Habakkuk:3,Zephaniah:3,Haggai:2,Zechariah:14,Malachi:4,Matthew:28,
  Mark:16,Luke:24,John:21,Acts:28,Romans:16,"1 Corinthians":16,"2 Corinthians":13,Galatians:6,
  Ephesians:6,Philippians:4,Colossians:4,"1 Thessalonians":5,"2 Thessalonians":3,"1 Timothy":6,
  "2 Timothy":4,Titus:3,Philemon:1,Hebrews:13,James:5,"1 Peter":5,"2 Peter":3,"1 John":5,
  "2 John":1,"3 John":1,Jude:1,Revelation:22,
};

/* build a reading plan: flatten books to chapters, split into N days, compress each day */
function chaptersForBooks(books) {
  const out = [];
  books.forEach((b) => { for (let c = 1; c <= (CHAPTERS[b] || 1); c++) out.push([b, c]); });
  return out;
}
function chunkEven(arr, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr.slice(Math.round(i * arr.length / n), Math.round((i + 1) * arr.length / n)));
  return out;
}
function compressRefs(refs) {
  if (!refs.length) return "Rest / catch up";
  const parts = [];
  let i = 0;
  while (i < refs.length) {
    const b = refs[i][0];
    let j = i;
    while (j + 1 < refs.length && refs[j + 1][0] === b && refs[j + 1][1] === refs[j][1] + 1) j++;
    parts.push(refs[i][1] === refs[j][1] ? `${b} ${refs[i][1]}` : `${b} ${refs[i][1]}-${refs[j][1]}`);
    i = j + 1;
  }
  return parts.join(", ");
}
function buildPlan(books, numDays) {
  return chunkEven(chaptersForBooks(books), numDays).map(compressRefs);
}
const PLANS = {
  proverbs31: { name: "Proverbs in 31 Days", days: buildPlan(["Proverbs"], 31) },
  psalms30: { name: "Psalms in 30 Days", days: buildPlan(["Psalms"], 30) },
  gospels30: { name: "The Gospels in 30 Days", days: buildPlan(["Matthew", "Mark", "Luke", "John"], 30) },
  nt90: { name: "New Testament in 90 Days", days: buildPlan(BOOKS.slice(39), 90) },
  bibleYear: { name: "Whole Bible in a Year", days: buildPlan(BOOKS, 365) },
};

/* verse of the day (KJV, public domain) — picked deterministically by date */
const VERSES = [
  ["John 3:16", "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."],
  ["Philippians 4:13", "I can do all things through Christ which strengtheneth me."],
  ["Proverbs 3:5-6", "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths."],
  ["Romans 8:28", "And we know that all things work together for good to them that love God, to them who are the called according to his purpose."],
  ["Psalm 23:1", "The LORD is my shepherd; I shall not want."],
  ["Isaiah 40:31", "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."],
  ["Joshua 1:9", "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest."],
  ["Philippians 4:6", "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God."],
  ["Matthew 6:33", "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you."],
  ["Psalm 46:10", "Be still, and know that I am God."],
  ["2 Timothy 1:7", "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind."],
  ["Hebrews 11:1", "Now faith is the substance of things hoped for, the evidence of things not seen."],
  ["Psalm 119:105", "Thy word is a lamp unto my feet, and a light unto my path."],
  ["Matthew 11:28", "Come unto me, all ye that labour and are heavy laden, and I will give you rest."],
  ["Isaiah 41:10", "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee."],
  ["1 Peter 5:7", "Casting all your care upon him; for he careth for you."],
  ["Psalm 37:4", "Delight thyself also in the LORD; and he shall give thee the desires of thine heart."],
  ["Colossians 3:23", "And whatsoever ye do, do it heartily, as to the Lord, and not unto men."],
  ["Lamentations 3:22-23", "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness."],
  ["Micah 6:8", "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?"],
  ["James 1:5", "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him."],
  ["Romans 12:2", "And be not conformed to this world: but be ye transformed by the renewing of your mind."],
  ["Proverbs 16:3", "Commit thy works unto the LORD, and thy thoughts shall be established."],
  ["Galatians 6:9", "And let us not be weary in well doing: for in due season we shall reap, if we faint not."],
];

const bDate = document.getElementById("bDate");
const bBook = document.getElementById("bBook");
const bChapter = document.getElementById("bChapter");
const bNotes = document.getElementById("bNotes");
const bibleList = document.getElementById("bibleList");
const bibleEmpty = document.getElementById("bibleEmpty");

bDate.value = ymd(new Date());

function addReading() {
  const book = bBook.value.trim();
  if (!book) { bBook.focus(); return; }
  db.bible.push({
    id: uid(),
    date: bDate.value || ymd(new Date()),
    book,
    chapter: bChapter.value.trim(),
    notes: bNotes.value.trim(),
  });
  bChapter.value = ""; bNotes.value = "";
  save(); renderBible();
}

function renderBible() {
  bibleList.innerHTML = "";
  const items = db.bible.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  bibleEmpty.style.display = items.length ? "none" : "block";

  items.forEach((r) => {
    const li = document.createElement("li");
    li.className = "reading";
    const ref = r.chapter ? `${escapeHtml(r.book)} ${escapeHtml(r.chapter)}` : escapeHtml(r.book);
    li.innerHTML = `
      <button class="r-del" type="button" aria-label="Delete reading" title="Delete">✕</button>
      <div class="r-head">
        <span class="r-ref">${ref}</span>
        <span class="r-date">${shortDate(r.date)}</span>
      </div>
      ${r.notes ? `<div class="r-notes">${escapeHtml(r.notes)}</div>` : ""}`;
    li.querySelector(".r-del").onclick = () => {
      db.bible = db.bible.filter((x) => x.id !== r.id);
      save(); renderBible();
    };
    bibleList.appendChild(li);
  });

  const books = new Set(db.bible.map((r) => r.book)).size;
  document.getElementById("bibleStats").textContent =
    db.bible.length ? `${db.bible.length} readings · ${books} books` : "";
}

document.getElementById("bAdd").onclick = addReading;

/* ----- verse of the day ----- */
function renderVerse() {
  const idx = hashStr(ymd(new Date())) % VERSES.length;
  const [ref, text] = VERSES[idx];
  document.getElementById("verseCard").innerHTML =
    `<div class="verse-label">Verse of the day</div>
     <div class="verse-text">“${escapeHtml(text)}”</div>
     <div class="verse-ref">— ${escapeHtml(ref)}</div>`;
}

/* ----- reading plan ----- */
const planSelect = document.getElementById("planSelect");
planSelect.innerHTML = `<option value="">No plan</option>` +
  Object.keys(PLANS).map((id) => `<option value="${id}">${escapeHtml(PLANS[id].name)}</option>`).join("");

function renderPlan() {
  const plan = db.biblePlan || {};
  planSelect.value = plan.id && PLANS[plan.id] ? plan.id : "";
  const body = document.getElementById("planBody");

  if (!plan.id || !PLANS[plan.id]) {
    body.innerHTML = `<p class="empty" style="padding:14px 0">Pick a plan above to start a guided reading schedule.</p>`;
    return;
  }
  const def = PLANS[plan.id];
  const total = def.days.length;
  const done = Math.min(plan.done || 0, total);
  const pct = Math.round((done / total) * 100);
  const finished = done >= total;
  const todayReading = finished ? "🎉 Plan complete!" : def.days[done];

  body.innerHTML = `
    <div class="plan-progress">
      <div class="plan-bar"><div class="plan-fill" style="width:${pct}%"></div></div>
      <div class="plan-meta"><span>Day ${Math.min(done + (finished ? 0 : 1), total)} of ${total}</span><span>${pct}%</span></div>
    </div>
    <div class="plan-today">
      <div class="plan-today-label">${finished ? "Done" : "Today's reading"}</div>
      <div class="plan-today-ref">${escapeHtml(todayReading)}</div>
    </div>
    <div class="plan-actions">
      ${done > 0 ? `<button class="ghost small" id="planUndo">Undo</button>` : ""}
      ${finished ? `<button class="ghost small" id="planRestart">Restart</button>`
                 : `<button class="primary" id="planDone">✓ Mark today read</button>`}
    </div>`;

  const doneBtn = document.getElementById("planDone");
  if (doneBtn) doneBtn.onclick = () => { db.biblePlan.done = (db.biblePlan.done || 0) + 1; save(); renderPlan(); };
  const undoBtn = document.getElementById("planUndo");
  if (undoBtn) undoBtn.onclick = () => { db.biblePlan.done = Math.max(0, (db.biblePlan.done || 0) - 1); save(); renderPlan(); };
  const restartBtn = document.getElementById("planRestart");
  if (restartBtn) restartBtn.onclick = () => { db.biblePlan.done = 0; save(); renderPlan(); };
}

planSelect.onchange = () => {
  db.biblePlan = { id: planSelect.value || null, done: (db.biblePlan && db.biblePlan.id === planSelect.value) ? (db.biblePlan.done || 0) : 0 };
  save(); renderPlan();
};

/* ----- 66-book progress grid ----- */
function renderBooks() {
  const grid = document.getElementById("bookGrid");
  const read = db.booksRead || {};
  grid.innerHTML = "";
  BOOKS.forEach((b) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "book-chip" + (read[b] ? " read" : "");
    chip.textContent = b;
    chip.setAttribute("aria-pressed", read[b] ? "true" : "false");
    chip.onclick = () => {
      if (db.booksRead[b]) delete db.booksRead[b]; else db.booksRead[b] = true;
      save(); renderBooks();
    };
    grid.appendChild(chip);
  });
  const count = Object.keys(read).filter((b) => read[b]).length;
  document.getElementById("booksCount").textContent = `${count}/66 read`;
}

/* ----- prayer list ----- */
const prayerInput = document.getElementById("prayerInput");

function renderPrayers() {
  const active = db.prayers.filter((p) => !p.answered).sort((a, b) => b.created - a.created);
  const answered = db.prayers.filter((p) => p.answered).sort((a, b) => (b.answeredAt || 0) - (a.answeredAt || 0));

  const list = document.getElementById("prayerList");
  list.innerHTML = "";
  document.getElementById("prayerEmpty").hidden = active.length > 0;
  active.forEach((p) => {
    const li = document.createElement("li");
    li.className = "prayer";
    li.innerHTML = `
      <span class="prayer-text">${escapeHtml(p.text)}</span>
      <span class="prayer-actions">
        <button class="ghost small p-answer">Answered</button>
        <button class="del" aria-label="Delete">✕</button>
      </span>`;
    li.querySelector(".p-answer").onclick = () => { p.answered = true; p.answeredAt = Date.now(); save(); renderPrayers(); };
    li.querySelector(".del").onclick = () => { db.prayers = db.prayers.filter((x) => x.id !== p.id); save(); renderPrayers(); };
    list.appendChild(li);
  });

  const wrap = document.getElementById("answeredWrap");
  wrap.hidden = answered.length === 0;
  document.getElementById("answeredCount").textContent = answered.length;
  const aList = document.getElementById("answeredList");
  aList.innerHTML = "";
  answered.forEach((p) => {
    const li = document.createElement("li");
    li.className = "prayer";
    li.innerHTML = `
      <div class="prayer-main">
        <span class="prayer-text answered">${escapeHtml(p.text)}</span>
        <span class="prayer-date">answered ${p.answeredAt ? new Date(p.answeredAt).toLocaleDateString() : ""}</span>
      </div>
      <span class="prayer-actions">
        <button class="ghost small p-reopen">Reopen</button>
        <button class="del" aria-label="Delete">✕</button>
      </span>`;
    li.querySelector(".p-reopen").onclick = () => { p.answered = false; p.answeredAt = null; save(); renderPrayers(); };
    li.querySelector(".del").onclick = () => { db.prayers = db.prayers.filter((x) => x.id !== p.id); save(); renderPrayers(); };
    aList.appendChild(li);
  });
}

function addPrayer() {
  const text = prayerInput.value.trim();
  if (!text) return;
  db.prayers.push({ id: uid(), text, created: Date.now(), answered: false, answeredAt: null });
  prayerInput.value = "";
  save(); renderPrayers();
}
document.getElementById("prayerAdd").onclick = addPrayer;
prayerInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addPrayer(); });
document.getElementById("answeredToggle").onclick = (e) => {
  const list = document.getElementById("answeredList");
  const open = list.hidden;
  list.hidden = !open;
  e.currentTarget.setAttribute("aria-expanded", open ? "true" : "false");
};

function renderBibleExtras() {
  renderVerse();
  renderPlan();
  renderBooks();
  renderPrayers();
}

/* ============================================================
   WORKOUT — split days, weekly schedule, checkable sets
   ============================================================ */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function scheduledDayId() {
  const id = db.split.schedule[currentDay.getDay()];
  return id && db.split.days.some((d) => d.id === id) ? id : null;
}

function renderWorkout(key) {
  const editable = isEditableDay();
  const body = document.getElementById("workoutBody");
  const note = document.getElementById("workoutNote");
  const logged = db.workouts[key];
  body.innerHTML = "";

  // a workout is in progress / logged for this day
  if (logged && Array.isArray(logged.exercises) && logged.exercises.length) {
    const head = document.createElement("div");
    head.className = "wk-day-head";
    head.innerHTML = `<span class="wk-day-name">${escapeHtml(logged.name || "Workout")}</span>`;
    if (editable) {
      const change = document.createElement("button");
      change.className = "ghost small"; change.textContent = "Change";
      change.onclick = () => { if (confirm("Clear today's workout and pick again?")) { delete db.workouts[key]; save(); renderDaily(); } };
      head.appendChild(change);
    }
    body.appendChild(head);

    const list = document.createElement("ul");
    list.className = "workout-list";
    logged.exercises.forEach((ex) => {
      const done = Array.isArray(ex.done) ? ex.done : (ex.done = []);
      const li = document.createElement("li");
      li.className = "workout-ex";
      const exhead = document.createElement("div");
      exhead.className = "wx-head";
      exhead.innerHTML = `<span class="wx-name">${escapeHtml(ex.name || "Exercise")}</span><span class="wx-meta">${ex.sets}×${escapeHtml(String(ex.reps))}</span>`;
      const setRow = document.createElement("div");
      setRow.className = "wx-sets";
      for (let s = 0; s < ex.sets; s++) {
        const pip = document.createElement("button");
        pip.type = "button";
        pip.className = "wx-set" + (done[s] ? " done" : "");
        pip.textContent = s + 1;
        pip.disabled = !editable;
        pip.setAttribute("aria-pressed", done[s] ? "true" : "false");
        pip.onclick = () => { if (!editable) return; done[s] = !done[s]; save(); renderDaily(); };
        setRow.appendChild(pip);
      }
      li.append(exhead, setRow);
      list.appendChild(li);
    });
    body.appendChild(list);
    const wp = workoutPoints(key);
    note.textContent = `${wp.done}/${wp.total} sets · +${wp.xp} XP`;
    return;
  }

  // nothing logged yet
  note.textContent = "";
  if (!editable) { body.innerHTML = `<p class="empty">No workout logged for this day.</p>`; return; }

  if (!db.split.days.length) {
    body.innerHTML = `<p class="empty">No split yet — build your workout days, exercises, and weekly schedule.</p>`;
    const b = document.createElement("button");
    b.className = "primary"; b.textContent = "Set up your split"; b.onclick = openSplitEditor;
    body.appendChild(b);
    return;
  }

  const sched = scheduledDayId();
  const wrap = document.createElement("div");
  wrap.className = "wk-start";
  const label = document.createElement("div");
  label.className = "wk-sched";
  label.textContent = sched ? `Today's split: ${db.split.days.find((d) => d.id === sched).name}` : "Pick today's workout";
  const sel = document.createElement("select");
  sel.className = "mini-select";
  db.split.days.forEach((d) => {
    const o = document.createElement("option");
    o.value = d.id; o.textContent = d.name; if (d.id === sched) o.selected = true;
    sel.appendChild(o);
  });
  const start = document.createElement("button");
  start.className = "primary"; start.textContent = "Start workout";
  start.onclick = () => startWorkout(sel.value);
  const edit = document.createElement("button");
  edit.className = "ghost small"; edit.textContent = "Edit split"; edit.onclick = openSplitEditor;
  const row = document.createElement("div");
  row.className = "wk-start-row";
  row.append(sel, start, edit);
  wrap.append(label, row);
  body.appendChild(wrap);
}

function startWorkout(dayId) {
  if (!isEditableDay()) return;
  const day = db.split.days.find((d) => d.id === dayId);
  if (!day) return;
  const exs = Array.isArray(day.exercises) ? day.exercises : [];
  if (!exs.length) { alert("Add exercises to this day first (Edit split)."); return; }
  db.workouts[dayKey()] = {
    dayId: day.id, name: day.name,
    exercises: exs.map((e) => ({ id: uid(), name: e.name, sets: Math.max(1, e.sets | 0), reps: e.reps, done: [] })),
  };
  save(); renderDaily();
}

/* ----- split editor ----- */
function openSplitEditor() { renderSplitEditor(); document.getElementById("splitModal").hidden = false; }
function closeSplitEditor() { document.getElementById("splitModal").hidden = true; renderDaily(); }

function renderSplitEditor() {
  const daysEl = document.getElementById("splitDays");
  daysEl.innerHTML = "";
  if (!db.split.days.length) daysEl.innerHTML = `<p class="empty">No days yet. Add one below ↓</p>`;

  db.split.days.forEach((day, di) => {
    const card = document.createElement("div");
    card.className = "split-day";

    const head = document.createElement("div");
    head.className = "sd-head";
    const nameInp = document.createElement("input");
    nameInp.type = "text"; nameInp.className = "sd-name"; nameInp.value = day.name || ""; nameInp.placeholder = "Day name (e.g. Push)";
    nameInp.oninput = () => { day.name = nameInp.value; save(); };
    const delDay = makeDel("Delete day", () => {
      if (!confirm(`Delete "${day.name || "this day"}"?`)) return;
      db.split.days.splice(di, 1);
      Object.keys(db.split.schedule).forEach((k) => { if (db.split.schedule[k] === day.id) db.split.schedule[k] = null; });
      save(); renderSplitEditor();
    });
    head.append(nameInp, delDay);
    card.appendChild(head);

    (day.exercises || (day.exercises = [])).forEach((ex, xi) => {
      const exRow = document.createElement("div");
      exRow.className = "sd-ex";
      const n = document.createElement("input");
      n.type = "text"; n.className = "sd-ex-name"; n.placeholder = "Exercise"; n.value = ex.name || "";
      n.oninput = () => { ex.name = n.value; save(); };
      const sets = document.createElement("input");
      sets.type = "number"; sets.min = "1"; sets.max = "20"; sets.className = "sd-ex-sets"; sets.value = ex.sets || 3; sets.setAttribute("aria-label", "sets");
      sets.oninput = () => { ex.sets = Math.max(1, Math.min(20, parseInt(sets.value, 10) || 1)); save(); };
      const xLabel = document.createElement("span"); xLabel.className = "sd-x"; xLabel.textContent = "×";
      const reps = document.createElement("input");
      reps.type = "text"; reps.className = "sd-ex-reps"; reps.placeholder = "reps"; reps.value = ex.reps || ""; reps.setAttribute("aria-label", "reps");
      reps.oninput = () => { ex.reps = reps.value; save(); };
      const del = makeDel("Remove exercise", () => { day.exercises.splice(xi, 1); save(); renderSplitEditor(); });
      exRow.append(n, sets, xLabel, reps, del);
      card.appendChild(exRow);
    });

    const addEx = document.createElement("button");
    addEx.className = "ghost small"; addEx.textContent = "+ Add exercise";
    addEx.onclick = () => { day.exercises.push({ id: uid(), name: "", sets: 3, reps: "10" }); save(); renderSplitEditor(); };
    card.appendChild(addEx);
    daysEl.appendChild(card);
  });

  const schedEl = document.getElementById("splitSchedule");
  schedEl.innerHTML = "";
  WEEKDAYS.forEach((name, wd) => {
    const r = document.createElement("div");
    r.className = "sched-row";
    const lbl = document.createElement("span");
    lbl.className = "sched-day"; lbl.textContent = name;
    const sel = document.createElement("select");
    sel.className = "mini-select";
    const rest = document.createElement("option"); rest.value = ""; rest.textContent = "Rest"; sel.appendChild(rest);
    db.split.days.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id; o.textContent = d.name || "(unnamed)"; if (db.split.schedule[wd] === d.id) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { db.split.schedule[wd] = sel.value || null; save(); };
    r.append(lbl, sel);
    schedEl.appendChild(r);
  });
}

document.getElementById("splitAddDay").onclick = () => { db.split.days.push({ id: uid(), name: "New Day", exercises: [] }); save(); renderSplitEditor(); };
document.getElementById("splitClose").onclick = closeSplitEditor;
document.getElementById("splitModal").addEventListener("click", (e) => { if (e.target.id === "splitModal") closeSplitEditor(); });

/* ============================================================
   PER-HABIT TIMER + PHOTO PROOF
   ============================================================ */
let timerRunning = false, timerStart = 0, timerElapsed = 0, timerInterval = null, timerHabitId = null;
function fmtClock(ms) {
  const total = Math.floor(ms / 1000);
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}
function tickHabitTimer() {
  const el = document.getElementById("htClock");
  if (el) el.textContent = fmtClock(timerElapsed + (timerRunning ? Date.now() - timerStart : 0));
}
function habitMinutes(key, id) {
  const sessions = db.timeLog[key];
  if (!Array.isArray(sessions)) return 0;
  return sessions.filter((s) => s.habitId === id).reduce((m, s) => m + (s.minutes | 0), 0);
}
function startHabitTimer(h) {
  if (!isEditableDay() || timerRunning) return;
  timerHabitId = h.id; timerRunning = true; timerStart = Date.now(); timerElapsed = 0;
  timerInterval = setInterval(tickHabitTimer, 1000);
  renderDaily();
}
function stopHabitTimer() {
  if (!timerRunning) return;
  timerRunning = false;
  timerElapsed += Date.now() - timerStart;
  clearInterval(timerInterval);
  const mins = Math.round(timerElapsed / 60000);
  const id = timerHabitId;
  const key = ymd(new Date()); // always credit the real today, never a navigated day
  if (mins > 0) {
    if (!Array.isArray(db.timeLog[key])) db.timeLog[key] = [];
    const h = db.habits.find((x) => x.id === id);
    db.timeLog[key].push({ habitId: id, label: h ? h.text : "Focus", minutes: mins });
    // running the timer is what completes a timed task
    if (h) { const l = db.habitLog[key] || (db.habitLog[key] = {}); l[h.id] = true; db.habitSnap[key] = db.habits.map((x) => x.id); }
    save();
    toast(`+${mins} min logged ✓`, "up");
  } else {
    toast("Too short to log (under 1 min)");
  }
  timerHabitId = null; timerElapsed = 0;
  renderDaily();
}

/* photo capture → compressed thumbnail stored in db.photos[key][habitId][slot] */
let photoTarget = null;
function capturePhoto(key, id, slot, cb) {
  if (!isEditableDay()) return;
  photoTarget = { key, id, slot, cb };
  const input = document.getElementById("photoInput");
  input.value = "";
  input.click();
}
document.getElementById("photoInput").onchange = (e) => {
  const file = e.target.files && e.target.files[0];
  const t = photoTarget; photoTarget = null;
  if (!file || !t) return;
  compressImage(file, (dataUrl) => {
    if (!isPlainObject(db.photos[t.key])) db.photos[t.key] = {};
    if (!isPlainObject(db.photos[t.key][t.id])) db.photos[t.key][t.id] = {};
    db.photos[t.key][t.id][t.slot] = dataUrl;
    // If storage is full, roll back the photo and DON'T mark the habit done —
    // keep in-memory state consistent with what actually persisted.
    if (!save()) { delete db.photos[t.key][t.id][t.slot]; renderDaily(); return; }
    if (t.cb) t.cb(); else renderDaily();
  });
};
function compressImage(file, cb) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 360; // keep thumbnails small — they live in localStorage for now
    let w = img.width, h = img.height;
    if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
    else if (h > max) { w = Math.round(w * max / h); h = max; }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    cb(canvas.toDataURL("image/jpeg", 0.5));
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert("Couldn't read that image."); };
  img.src = url;
}
function showPhoto(src) {
  const o = document.createElement("div");
  o.className = "photo-lightbox";
  const im = document.createElement("img");
  im.src = src; im.alt = "proof photo";
  o.appendChild(im);
  o.onclick = () => o.remove();
  document.body.appendChild(o);
}

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
const ACHIEVEMENTS = [
  { id: "first", icon: "👣", name: "First Steps", desc: "Complete your first habit",
    test: () => Object.values(db.habitLog).some((d) => d && Object.keys(d).length > 0) },
  { id: "perfect", icon: "⭐", name: "Perfect Day", desc: "Complete every habit in a day",
    test: (h) => h.perfectDays >= 1 },
  { id: "week", icon: "🔥", name: "Week Warrior", desc: "Reach a 7-day streak",
    test: (h) => h.longest >= 7 },
  { id: "month", icon: "🌙", name: "Unstoppable", desc: "Reach a 30-day streak",
    test: (h) => h.longest >= 30 },
  { id: "century", icon: "💯", name: "Centurion", desc: "Reach a 100-day streak", secret: true,
    test: (h) => h.longest >= 100 },
  { id: "level5", icon: "🎯", name: "Level 5", desc: "Reach Level 5",
    test: (h) => levelInfo(h.rp).level >= 5 },
  { id: "level10", icon: "🚀", name: "Level 10", desc: "Reach Level 10",
    test: (h) => levelInfo(h.rp).level >= 10 },
  { id: "diamond", icon: "💎", name: "Diamond Mind", desc: "Reach Diamond rank", secret: true,
    test: (h) => rankForRP(h.rp).index >= 12 },
  { id: "quests", icon: "🎲", name: "Quest Master", desc: "Complete 25 bonus quests",
    test: (h) => h.questsTotal >= 25 },
  { id: "scribe", icon: "📓", name: "Scribe", desc: "Write 10 journal entries",
    test: () => db.journal.length >= 10 },
  { id: "prayer", icon: "🙏", name: "Answered", desc: "Log an answered prayer",
    test: () => db.prayers.some((p) => p.answered) },
  { id: "scholar", icon: "📖", name: "Scholar", desc: "Read 20 books of the Bible",
    test: () => Object.values(db.booksRead).filter(Boolean).length >= 20 },
  { id: "lifter", icon: "🏋️", name: "Iron", desc: "Finish a full workout",
    test: () => Object.keys(db.workouts).some((k) => { const w = workoutPoints(k); return w.total > 0 && w.done >= w.total; }) },
  { id: "boss", icon: "⚔️", name: "Boss Slayer", desc: "Win a Boss-Fight week", secret: true,
    test: () => (db.challenge.completed || 0) >= 1 },
];

function checkAchievements() {
  const h = computeHistory();
  ACHIEVEMENTS.forEach((a) => {
    if (!db.achievements[a.id]) {
      let unlocked = false;
      try { unlocked = a.test(h); } catch (_) { unlocked = false; }
      if (unlocked) {
        db.achievements[a.id] = Date.now();
        toast(`🏆 Achievement unlocked: ${a.name}`, "up");
        save();
      }
    }
  });
}

function renderAchievements() {
  const grid = document.getElementById("achGrid");
  grid.innerHTML = "";
  let unlocked = 0;
  ACHIEVEMENTS.forEach((a) => {
    const got = !!db.achievements[a.id];
    if (got) unlocked++;
    const hidden = a.secret && !got; // secret achievements stay a mystery until earned
    const div = document.createElement("div");
    div.className = "ach" + (got ? " unlocked" : "") + (hidden ? " secret" : "");
    div.innerHTML =
      `<div class="ach-icon">${got ? a.icon : hidden ? "❓" : "🔒"}</div>
       <div class="ach-name">${hidden ? "???" : escapeHtml(a.name)}</div>
       <div class="ach-desc">${hidden ? "Secret — keep going to discover it" : escapeHtml(a.desc)}</div>`;
    grid.appendChild(div);
  });
  document.getElementById("achCount").textContent = `${unlocked}/${ACHIEVEMENTS.length} unlocked`;
}

/* ============================================================
   BOSS-FIGHT CHALLENGES
   ============================================================ */
const CHALLENGE_PRESETS = [
  { id: "75hard", name: "75 Hard (7-day boss)", desc: "Each day: two workouts, a gallon of water, read 10 pages, follow a diet, no alcohol.", stake: 150, reward: 600 },
  { id: "nosocial7", name: "No Social Media", desc: "Zero social media for 7 straight days.", stake: 120, reward: 450 },
  { id: "earlybird", name: "5 AM Club", desc: "Wake before 5am every day for a week.", stake: 120, reward: 450 },
  { id: "workout7", name: "Workout Streak", desc: "Complete a workout every day for 7 days.", stake: 100, reward: 400 },
  { id: "deepfocus7", name: "Deep Focus", desc: "Log 60+ focused minutes every day for a week.", stake: 100, reward: 400 },
];

function challengeWindow(active) {
  const out = [];
  const d = new Date(active.startKey + "T00:00:00");
  for (let i = 0; i < (active.length || 7); i++) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}

// Resolve win/loss for an active challenge. Safe to call on every render.
function evaluateChallenge() {
  const c = db.challenge;
  const active = c && c.active;
  if (!active) return;
  const win = challengeWindow(active);
  const todayKey = ymd(new Date());
  const doneCount = win.filter((k) => active.checks[k]).length;
  if (doneCount >= (active.length || 7)) {
    db.meta.xpAdjust = (db.meta.xpAdjust || 0) + active.reward;
    c.completed = (c.completed || 0) + 1;
    c.active = null;
    save();
    toast(`🏆 Boss defeated! +${active.reward} XP`, "up");
    return;
  }
  if (win.some((k) => k < todayKey && !active.checks[k])) {
    c.active = null;
    save();
    toast("💀 Boss fight failed — stake forfeited", "down");
  }
}

function startChallenge(id) {
  const p = CHALLENGE_PRESETS.find((x) => x.id === id);
  if (!p) return;
  const xp = computeState().rp;
  if (xp < p.stake) { alert(`You need ${p.stake} XP to enter this boss fight — you have ${xp}.`); return; }
  if (!confirm(`Enter "${p.name}"?\n\nStakes ${p.stake} XP. Finish all 7 days to win ${p.reward} XP. Miss a day and you forfeit your stake.`)) return;
  db.meta.xpAdjust = (db.meta.xpAdjust || 0) - p.stake;
  db.challenge.active = { id: p.id, name: p.name, desc: p.desc, stake: p.stake, reward: p.reward, startKey: ymd(new Date()), length: 7, checks: {} };
  save(); renderDaily();
}

// Boss fights surface RANDOMLY (not a menu): ~18% of days, deterministic per day,
// unless one is active or already dismissed today. Presets live in CHALLENGE_PRESETS
// so we can push new ones to users later.
function bossOfferForToday() {
  const todayKey = ymd(new Date());
  if (db.meta.bossDismissed === todayKey) return null;
  if (hashStr("boss" + todayKey) % 100 >= 18) return null;
  return CHALLENGE_PRESETS[hashStr("bosspick" + todayKey) % CHALLENGE_PRESETS.length];
}

function renderBossSlot() {
  const slot = document.getElementById("bossSlot");
  if (!slot) return;
  const active = db.challenge && db.challenge.active;

  if (active) {
    const win = challengeWindow(active);
    const todayKey = ymd(new Date());
    const doneCount = win.filter((k) => active.checks[k]).length;
    const todayInWindow = win.includes(todayKey);
    const todayChecked = !!active.checks[todayKey];
    const dayNum = win.indexOf(todayKey) + 1;
    slot.innerHTML =
      `<div class="ch-active">
         <div class="ch-name">${escapeHtml(active.name)} <span class="ch-badge">BOSS FIGHT</span></div>
         <div class="ch-desc">${escapeHtml(active.desc)}</div>
         <div class="ch-pips">${win.map((k, i) => `<span class="ch-pip${active.checks[k] ? " done" : ""}${k === todayKey ? " today" : ""}">${i + 1}</span>`).join("")}</div>
         <div class="ch-meta">${doneCount}/${active.length || 7} days · win <strong>+${active.reward} XP</strong></div>
         <div class="modal-actions">
           ${todayInWindow && !todayChecked ? `<button class="primary" id="chCheck">✓ Mark day ${dayNum} done</button>`
             : todayChecked ? `<span class="ch-donenote">Day ${dayNum} done ✓ — back tomorrow</span>`
             : `<span class="ch-donenote">Waiting for the window…</span>`}
           <button class="ghost small" id="chAbandon">Abandon</button>
         </div>
       </div>`;
    const chk = document.getElementById("chCheck");
    if (chk) chk.onclick = () => { if (!isToday()) return; active.checks[todayKey] = true; save(); renderDaily(); };
    const ab = document.getElementById("chAbandon");
    if (ab) ab.onclick = () => { if (confirm("Abandon the boss fight? You forfeit your staked XP.")) { db.challenge.active = null; save(); renderDaily(); } };
    return;
  }

  const offer = isToday() ? bossOfferForToday() : null;
  if (!offer) { slot.innerHTML = ""; return; }
  slot.innerHTML =
    `<div class="boss-offer">
       <div class="boss-head">⚔️ A Boss Fight has appeared!</div>
       <div class="ch-name">${escapeHtml(offer.name)}</div>
       <div class="ch-desc">${escapeHtml(offer.desc)}</div>
       <div class="ch-stakes"><span class="ch-stake">−${offer.stake} XP to enter</span><span class="ch-reward">+${offer.reward} XP win</span></div>
       <div class="modal-actions">
         <button class="ghost small" id="bossDismiss">Not today</button>
         <button class="primary" id="bossEnter">Accept the fight</button>
       </div>
     </div>`;
  document.getElementById("bossEnter").onclick = () => startChallenge(offer.id);
  document.getElementById("bossDismiss").onclick = () => { db.meta.bossDismissed = ymd(new Date()); save(); renderBossSlot(); };
}

/* ============================================================
   PROFILE
   ============================================================ */
function renderProfile() {
  const h = computeHistory();
  const rank = rankForRP(h.rp);
  const lvl = levelInfo(h.rp);
  const name = db.meta.name;
  const completed = (db.challenge && db.challenge.completed) || 0;

  document.getElementById("profileTitle").textContent = name ? `${name}'s Profile` : "Profile";
  document.getElementById("profileSub").textContent = `${completed} boss${completed === 1 ? "" : "es"} defeated`;

  document.getElementById("profileHero").innerHTML =
    `<div class="badge" style="--tier-color:${rank.color}"><span class="badge-div">${rank.division || (rank.unreal ? "★" : "")}</span></div>
     <div class="pf-info">
       <div class="pf-name">${escapeHtml(name || "You")}</div>
       <div class="pf-rank" style="color:${rank.color}">Level ${lvl.level} · ${escapeHtml(rank.label)}</div>
       <div class="pf-title" style="color:${rank.color}">🎖️ ${escapeHtml(tierTitle(rank.tier))}</div>
       ${db.meta.vision ? `<div class="pf-vision">Becoming: ${escapeHtml(db.meta.vision)}</div>` : ""}
       ${db.meta.why ? `<div class="pf-vision">Why: ${escapeHtml(db.meta.why)}</div>` : ""}
       <div class="pf-stats">
         <span><strong>${h.rp.toLocaleString()}</strong> XP</span>
         <span><strong>${h.streak}</strong>d streak</span>
         <span><strong>${h.longest}</strong>d best</span>
         <span><strong>${h.perfectDays}</strong> perfect days</span>
       </div>
     </div>`;

  renderRankLadder(h.rp);
  renderFriends();
  renderAchievements();
}

/* The apex tiers stay hidden until you're near them; each tier hides a title reward. */
const APEX_TIERS = new Set(["Elite", "Champion", "Unreal"]);
const TIER_TITLES = {
  Bronze: "Initiate", Silver: "The Consistent", Gold: "Relentless", Platinum: "Disciplined",
  Diamond: "Unbreakable", Elite: "Elite Operator", Champion: "Champion", Unreal: "Unreal",
};
function tierTitle(tier) { return TIER_TITLES[tier] || tier; }

/* Full tier ladder (Bronze I → Unreal) — foggy peak + hidden tier rewards. */
function renderRankLadder(xp) {
  const cur = rankForRP(xp).index;
  const el = document.getElementById("rankLadder");
  el.innerHTML = RANKS.map((r, i) => {
    const achieved = xp >= r.min;
    const isCur = i === cur;
    const firstOfTier = i === 0 || RANKS[i - 1].tier !== r.tier;
    // apex tiers stay "???" until you're within one rank of them
    const revealed = achieved || !APEX_TIERS.has(r.tier) || i <= cur + 1;

    if (!revealed) {
      return `<div class="ladder-row locked mystery">
        <div class="ladder-row-main">
          <span class="lr-badge mystery">?</span>
          <span class="lr-label">??? <span class="lr-secret">a legendary tier</span></span>
          <span class="lr-state">🔒</span>
        </div>${firstOfTier ? `<div class="lr-reward">🎁 ??? — a reward awaits up here</div>` : ""}</div>`;
    }

    const cls = isCur ? "current" : achieved ? "done" : "locked";
    const state = isCur ? "►" : achieved ? "✓" : "🔒";
    let reward = "";
    if (firstOfTier) {
      reward = achieved
        ? `<div class="lr-reward done">🎁 Title: “${escapeHtml(tierTitle(r.tier))}”</div>`
        : `<div class="lr-reward">🎁 Reach ${escapeHtml(r.tier)} to unlock a title</div>`;
    }
    let extra = "";
    if (isCur && RANKS[i + 1]) {
      const span = RANKS[i + 1].min - r.min;
      const pct = span > 0 ? Math.min(100, Math.round(((xp - r.min) / span) * 100)) : 100;
      const nextRevealed = !APEX_TIERS.has(RANKS[i + 1].tier) || (i + 1) <= cur + 1;
      extra = `<div class="lr-prog"><div class="lr-prog-fill" style="width:${pct}%;background:${r.color}"></div></div>
               <div class="lr-next">${(RANKS[i + 1].min - xp).toLocaleString()} XP to ${nextRevealed ? escapeHtml(RANKS[i + 1].label) : "???"}</div>`;
    } else if (isCur) {
      extra = `<div class="lr-next">Peak rank reached 🏆</div>`;
    }
    return `<div class="ladder-row ${cls}" style="--tier-color:${r.color}">
      <div class="ladder-row-main">
        <span class="lr-badge${r.unreal ? " unreal" : ""}">${r.division || (r.unreal ? "★" : "")}</span>
        <span class="lr-label">${escapeHtml(r.label)}</span>
        <span class="lr-xp">${r.min.toLocaleString()} XP</span>
        <span class="lr-state">${state}</span>
      </div>
      ${reward}${extra}
    </div>`;
  }).join("");

  const r = rankForRP(xp);
  const nextRevealed = r.next && (!APEX_TIERS.has(r.next.tier) || r.next.index <= cur + 1);
  document.getElementById("ladderNote").textContent =
    r.next ? `${(r.next.min - xp).toLocaleString()} XP to ${nextRevealed ? r.next.label : "???"}` : "Peak rank";
}

/* Friends leaderboard — local scaffold until Supabase sync is wired. */
function renderFriends() {
  const body = document.getElementById("friendsBody");
  if (!body) return;
  const FR = window.UPLVLFriends;

  // Not signed in → friends/invites live on your account.
  if (!FR || !FR.ready()) {
    body.innerHTML =
      `<div class="friend-cta">
         <p>Invites, friends &amp; leaderboards run on your UPLVL account. Sign in to get your invite code and add people.</p>
         <button class="primary" id="friendSignin">Sign in to add friends</button>
       </div>`;
    const b = document.getElementById("friendSignin");
    if (b) b.onclick = () => { if (FR && FR.openAcct) FR.openAcct(); else alert("Cloud sync isn't available."); };
    return;
  }

  body.innerHTML =
    `<div class="invite-card" id="inviteCard"><p class="empty">Loading your invite…</p></div>
     <div class="friend-add">
       <input id="friendCodeInput" type="text" placeholder="Enter a friend's code…" autocomplete="off" autocapitalize="characters" />
       <button class="primary" id="friendAddBtn">Add</button>
     </div>
     <div id="friendListBody"><p class="empty">Loading friends…</p></div>`;

  FR.getMyInvite().then((inv) => {
    const c = document.getElementById("inviteCard");
    if (!c) return;
    if (!inv) { c.innerHTML = `<p class="empty">Couldn't load your invite — make sure the friends tables are set up.</p>`; return; }
    c.innerHTML =
      `<div class="invite-row">
         <div><div class="invite-label">YOUR INVITE CODE</div><div class="invite-code">${escapeHtml(inv.code)}</div></div>
         <div class="invite-actions">
           <button class="ghost small" id="copyCode">Copy</button>
           <button class="ghost small" id="shareLink">Share link</button>
         </div>
       </div>`;
    document.getElementById("copyCode").onclick = () => { try { navigator.clipboard && navigator.clipboard.writeText(inv.code); } catch (e) {} toast("📋 Code copied", "up"); };
    document.getElementById("shareLink").onclick = () => {
      const text = "Add me on UPLVL 👊 " + inv.link;
      if (navigator.share) navigator.share({ text: text }).catch(() => {});
      else { try { navigator.clipboard && navigator.clipboard.writeText(inv.link); } catch (e) {} toast("🔗 Invite link copied", "up"); }
    };
  });

  const addBtn = document.getElementById("friendAddBtn");
  addBtn.onclick = async () => {
    const inp = document.getElementById("friendCodeInput");
    if (!inp.value.trim()) { inp.focus(); return; }
    addBtn.disabled = true; addBtn.textContent = "…";
    const r = await window.UPLVLFriends.redeemInvite(inp.value);
    toast((r.ok ? "🤝 " : "⚠️ ") + r.msg, r.ok ? "up" : "down");
    addBtn.disabled = false; addBtn.textContent = "Add";
    if (r.ok) { inp.value = ""; loadFriendList(); }
  };
  document.getElementById("friendCodeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addBtn.click(); });

  loadFriendList();
}

function loadFriendList() {
  const FR = window.UPLVLFriends;
  const el = document.getElementById("friendListBody");
  if (!el || !FR) return;
  FR.listFriends().then((list) => {
    if (!el) return;
    if (!list.length) { el.innerHTML = `<p class="empty">No friends yet — share your code to add some.</p>`; return; }
    list.sort((a, b) => (b.level || 0) - (a.level || 0));
    el.innerHTML = `<ul class="friend-list">` + list.map((f, i) =>
      `<li class="friend"><span class="fr-rank">${i + 1}</span>
         <span class="fr-name">${escapeHtml(f.display_name || "Friend")}</span>
         <span class="fr-xp">Lvl ${f.level || 1} · ${escapeHtml(f.rank || "Bronze")}${f.streak ? " · 🔥" + f.streak : ""}</span></li>`).join("") + `</ul>`;
  }).catch(() => { if (el) el.innerHTML = `<p class="empty">Friends list unavailable — set up the friends tables.</p>`; });
}

/* ============================================================
   ONBOARDING WIZARD (multi-step, customizes the whole app)
   ============================================================ */
const OB_AREAS = [
  { id: "fitness", emoji: "💪", title: "Fitness", habits: ["Workout", "Mile run", "Hit 10,000 steps", "Stretch 10 minutes", "Eat clean — no snacks", "Hit your protein goal"] },
  { id: "faith", emoji: "✝️", title: "Faith", habits: ["Read Bible for an hour", "15 min of prayer", "Daily devotional", "Memorize a verse"] },
  { id: "discipline", emoji: "🔥", title: "Discipline", habits: ["No phone for the first hour", "No social media before noon", "Cold shower", "No junk food", "Make your bed"] },
  { id: "mind", emoji: "🧠", title: "Mind", habits: ["Practice a skill for an hour", "Read 10 pages of a book", "Learn something new", "45 min of deep work", "No distractions"] },
  { id: "health", emoji: "🧘", title: "Health", habits: ["Hygiene — skin, hair, teeth & body", "Drink a gallon of water", "Get 8 hours of sleep", "10 min meditation", "15 minutes of sunlight"] },
  { id: "relationships", emoji: "❤️", title: "Relationships", habits: ["Call a friend or family member", "Quality time with family", "Encourage someone", "A random act of kindness"] },
  { id: "work", emoji: "💼", title: "Work", habits: ["Do your hardest task first", "90 min of focused work", "Plan tomorrow tonight", "Clear your inbox"] },
  { id: "money", emoji: "💰", title: "Money", habits: ["Track your spending", "No impulse purchases", "Review your budget"] },
  { id: "creativity", emoji: "🎨", title: "Creativity", habits: ["Create something", "Write for 10 minutes", "Practice your craft"] },
  { id: "reflection", emoji: "📓", title: "Reflection", habits: ["End-of-day diagnosis & journal reflection", "Write 3 things you're grateful for"] },
];
const OB_PRINCIPLES = [
  "Don't chase a life of status — stay humble",
  "Prioritize physical and mental health",
  "Discipline over motivation",
  "Progress over perfection",
  "Do hard things on purpose",
  "Become 1% better every day",
  "Your word is your bond",
];
const WORKOUT_TEMPLATES = {
  fullbody: { label: "Full Body", ex: [["Squat", 3, "8"], ["Bench Press", 3, "8"], ["Barbell Row", 3, "8"], ["Overhead Press", 3, "10"], ["Plank", 3, "45s"]] },
  push: { label: "Push Day", ex: [["Bench Press", 4, "8"], ["Overhead Press", 3, "10"], ["Incline Press", 3, "12"], ["Lateral Raise", 3, "15"], ["Tricep Pushdown", 3, "12"]] },
  upper: { label: "Upper Body", ex: [["Bench Press", 4, "8"], ["Pull-up", 3, "8"], ["Overhead Press", 3, "10"], ["Barbell Row", 3, "10"], ["Curl", 3, "12"]] },
  bodyweight: { label: "Bodyweight", ex: [["Push-ups", 4, "15"], ["Pull-ups", 4, "8"], ["Air Squats", 4, "20"], ["Lunges", 3, "12"], ["Plank", 3, "60s"]] },
};

const OB = {
  name: "", vision: "", why: "",
  areas: new Set(), habits: new Map(), custom: [], // habits: text -> "timed"|"checkable"; custom: [{text,type}]
  wake: "07:00", trainDays: 4, split: null, plan: "",
  principles: new Set(), customPrinciples: [], _seededSig: null,
};
let obIndex = 0;
function obDefaultType(text) { return isTimedText(text) ? "timed" : "checkable"; }

function fmt12(t) {
  const parts = (t || "07:00").split(":").map(Number);
  const h = parts[0] || 0, m = parts[1] || 0;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function isTimedText(t) { return /(hour|minute|\bmin\b|\brun\b|medita|deep work|stretch)/i.test(t); }

function obStepList() {
  const s = ["welcome", "areas", "habits", "rhythm"];
  if (OB.areas.has("fitness")) s.push("fitness");
  if (OB.areas.has("faith")) s.push("faith");
  s.push("principles", "commit");
  return s;
}

function obFinalHabits() {
  const out = [], seen = new Set();
  const all = [{ text: `Wake up at ${fmt12(OB.wake)} — no phone while getting ready`, type: "checkable" }];
  OB.habits.forEach((type, text) => all.push({ text, type }));
  OB.custom.forEach((c) => all.push(c));
  all.forEach((o) => { const k = (o.text || "").trim(); if (k && !seen.has(k)) { seen.add(k); out.push({ text: k, type: o.type === "timed" ? "timed" : "checkable" }); } });
  return out;
}

const OB_STEPS = {
  welcome: () => `
    <div class="ob-logo">✦</div>
    <h3 class="ob-title">Welcome to UPLVL</h3>
    <p class="ob-sub">This isn't a to-do list. It's the operating system for becoming who you want to be — leveled up one day at a time.</p>
    <label class="ob-label">What should we call you?</label>
    <input id="obName" type="text" placeholder="Your name" autocomplete="given-name" value="${escapeHtml(OB.name)}" />
    <label class="ob-label">In one line — who are you becoming?</label>
    <input id="obVision" type="text" placeholder="e.g. Disciplined, healthy, and close to God" value="${escapeHtml(OB.vision)}" />`,

  areas: () => `
    <h3 class="ob-title">What do you want to grow in?</h3>
    <p class="ob-sub">Pick the areas that matter most. We'll build your daily habits around them.</p>
    <div class="ob-areas">${OB_AREAS.map((a) =>
      `<button type="button" class="ob-area${OB.areas.has(a.id) ? " on" : ""}" data-id="${a.id}"><span class="oa-emoji">${a.emoji}</span>${a.title}</button>`).join("")}</div>`,

  habits: () => {
    const typeToggle = (text, type, attrTimed, attrCheck) =>
      `<span class="ob-type">
         <button type="button" class="ob-type-btn${type === "timed" ? " on" : ""}" ${attrTimed}="${escapeHtml(text)}" title="Timed — complete by running a timer">⏱</button>
         <button type="button" class="ob-type-btn${type === "checkable" ? " on" : ""}" ${attrCheck}="${escapeHtml(text)}" title="Checkable — complete by taking a photo">📷</button>
       </span>`;
    const groups = OB_AREAS.filter((a) => OB.areas.has(a.id)).map((a) => {
      const rows = a.habits.map((hb) => {
        const inc = OB.habits.has(hb);
        const type = OB.habits.get(hb) || obDefaultType(hb);
        return `<div class="ob-hrow${inc ? " on" : ""}">
          <button type="button" class="ob-hrow-main" data-h="${escapeHtml(hb)}"><span class="ob-hrow-dot">${inc ? "✓" : ""}</span>${escapeHtml(hb)}</button>
          ${typeToggle(hb, type, "data-ht", "data-hc")}
        </div>`;
      }).join("");
      return `<div class="ob-group"><div class="ob-group-title">${a.emoji} ${a.title}</div>${rows}</div>`;
    }).join("");
    const customRows = OB.custom.map((c, i) =>
      `<div class="ob-hrow on">
         <span class="ob-hrow-main"><span class="ob-hrow-dot">✓</span>${escapeHtml(c.text)}</span>
         <span class="ob-type">
           <button type="button" class="ob-type-btn${c.type === "timed" ? " on" : ""}" data-cti="${i}" title="Timed">⏱</button>
           <button type="button" class="ob-type-btn${c.type === "checkable" ? " on" : ""}" data-cci="${i}" title="Photo">📷</button>
           <button type="button" class="ob-hrow-del" data-cdi="${i}" aria-label="Remove">✕</button>
         </span>
       </div>`).join("");
    return `
      <h3 class="ob-title">Build your daily lineup</h3>
      <p class="ob-sub">Tap to include a habit, then choose how you'll prove it: <strong>⏱ Timed</strong> (run a timer) or <strong>📷 Photo</strong> (snap a pic to check it off).</p>
      ${groups || `<p class="ob-none">Go back and pick a focus area to see suggestions.</p>`}
      <div class="ob-group"><div class="ob-group-title">➕ Your own</div>
        ${customRows}
        <div class="add-row"><input id="obCustom" type="text" placeholder="Add a custom habit…" /><button class="ghost small" id="obCustomAdd">Add</button></div>
      </div>`;
  },

  rhythm: () => `
    <h3 class="ob-title">Your daily rhythm</h3>
    <p class="ob-sub">When do you want to start your day? We'll anchor your mornings with a wake-up habit.</p>
    <label class="ob-label">Wake-up time</label>
    <input id="obWake" type="time" value="${OB.wake}" />`,

  fitness: () => `
    <h3 class="ob-title">Your training</h3>
    <p class="ob-sub">We'll set up a starting workout you can load in one tap.</p>
    <label class="ob-label">Days per week</label>
    <div class="ob-chips">${[2, 3, 4, 5, 6].map((d) => `<button type="button" class="ob-chip${OB.trainDays === d ? " on" : ""}" data-days="${d}">${d}</button>`).join("")}</div>
    <label class="ob-label">Starting workout</label>
    <div class="ob-opts">${
      Object.keys(WORKOUT_TEMPLATES).map((k) => `<button type="button" class="ob-opt${OB.split === k ? " on" : ""}" data-split="${k}"><strong>${WORKOUT_TEMPLATES[k].label}</strong><span>${WORKOUT_TEMPLATES[k].ex.length} exercises</span></button>`).join("")
    }<button type="button" class="ob-opt${OB.split === null ? " on" : ""}" data-split=""><strong>I'll set it up later</strong><span>Skip for now</span></button></div>`,

  faith: () => `
    <h3 class="ob-title">Your Bible reading</h3>
    <p class="ob-sub">Follow a plan and we'll track your progress day by day.</p>
    <div class="ob-opts">${
      Object.keys(PLANS).map((id) => `<button type="button" class="ob-opt${OB.plan === id ? " on" : ""}" data-plan="${id}"><strong>${escapeHtml(PLANS[id].name)}</strong><span>${PLANS[id].days.length} days</span></button>`).join("")
    }<button type="button" class="ob-opt${OB.plan === "" ? " on" : ""}" data-plan=""><strong>Not now</strong><span>Maybe later</span></button></div>`,

  principles: () => {
    const customChips = OB.customPrinciples.map((c, i) => `<button type="button" class="ob-chip on" data-pci="${i}">${escapeHtml(c)} ✕</button>`).join("");
    return `
      <h3 class="ob-title">Your guiding principles</h3>
      <p class="ob-sub">Standing reminders of who you are. They live on your Daily tab.</p>
      <div class="ob-chips">${OB_PRINCIPLES.map((p) => `<button type="button" class="ob-chip${OB.principles.has(p) ? " on" : ""}" data-p="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}</div>
      ${customChips ? `<div class="ob-chips" style="margin-top:10px">${customChips}</div>` : ""}
      <div class="add-row" style="margin-top:12px"><input id="obPrinc" type="text" placeholder="Add your own…" /><button class="ghost small" id="obPrincAdd">Add</button></div>`;
  },

  commit: () => {
    const fh = obFinalHabits();
    const timedN = fh.filter((o) => o.type === "timed").length;
    const bits = [`${fh.length} daily habits (${timedN} timed · ${fh.length - timedN} photo)`, `${OB.principles.size + OB.customPrinciples.length} principles`];
    if (OB.split && WORKOUT_TEMPLATES[OB.split]) bits.push(`${WORKOUT_TEMPLATES[OB.split].label} workout`);
    if (OB.plan && PLANS[OB.plan]) bits.push(PLANS[OB.plan].name);
    return `
      <h3 class="ob-title">Lock it in${OB.name.trim() ? `, ${escapeHtml(OB.name.trim())}` : ""}</h3>
      <p class="ob-sub">When it gets hard, what will keep you going?</p>
      <label class="ob-label">Your why (optional)</label>
      <textarea id="obWhy" placeholder="e.g. To be the man my family needs. To honor God with my body and time.">${escapeHtml(OB.why)}</textarea>
      <div class="ob-summary"><div class="ob-summary-title">You're starting with</div><ul>${bits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul></div>`;
  },
};

function obWire(step) {
  const q = (sel) => document.querySelectorAll("#obBody " + sel);
  if (step === "areas") {
    q(".ob-area").forEach((b) => b.onclick = () => { const id = b.dataset.id; OB.areas.has(id) ? OB.areas.delete(id) : OB.areas.add(id); b.classList.toggle("on"); });
  } else if (step === "habits") {
    q(".ob-hrow-main[data-h]").forEach((b) => b.onclick = () => {
      const h = b.dataset.h;
      if (OB.habits.has(h)) OB.habits.delete(h); else OB.habits.set(h, obDefaultType(h));
      obRender();
    });
    q(".ob-type-btn[data-ht]").forEach((b) => b.onclick = () => { OB.habits.set(b.dataset.ht, "timed"); obRender(); });
    q(".ob-type-btn[data-hc]").forEach((b) => b.onclick = () => { OB.habits.set(b.dataset.hc, "checkable"); obRender(); });
    q(".ob-type-btn[data-cti]").forEach((b) => b.onclick = () => { OB.custom[+b.dataset.cti].type = "timed"; obRender(); });
    q(".ob-type-btn[data-cci]").forEach((b) => b.onclick = () => { OB.custom[+b.dataset.cci].type = "checkable"; obRender(); });
    q(".ob-hrow-del[data-cdi]").forEach((b) => b.onclick = () => { OB.custom.splice(+b.dataset.cdi, 1); obRender(); });
    const add = document.getElementById("obCustomAdd"), inp = document.getElementById("obCustom");
    const fn = () => { const v = (inp.value || "").trim(); if (v) { OB.custom.push({ text: v, type: obDefaultType(v) }); obRender(); } };
    if (add) add.onclick = fn;
    if (inp) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") fn(); });
  } else if (step === "fitness") {
    q("[data-days]").forEach((b) => b.onclick = () => { OB.trainDays = +b.dataset.days; obRender(); });
    q("[data-split]").forEach((b) => b.onclick = () => { OB.split = b.dataset.split || null; obRender(); });
  } else if (step === "faith") {
    q("[data-plan]").forEach((b) => b.onclick = () => { OB.plan = b.dataset.plan; obRender(); });
  } else if (step === "principles") {
    q(".ob-chip[data-p]").forEach((b) => b.onclick = () => { const p = b.dataset.p; OB.principles.has(p) ? OB.principles.delete(p) : OB.principles.add(p); b.classList.toggle("on"); });
    q(".ob-chip[data-pci]").forEach((b) => b.onclick = () => { OB.customPrinciples.splice(+b.dataset.pci, 1); obRender(); });
    const add = document.getElementById("obPrincAdd"), inp = document.getElementById("obPrinc");
    const fn = () => { const v = (inp.value || "").trim(); if (v) { OB.customPrinciples.push(v); obRender(); } };
    if (add) add.onclick = fn;
    if (inp) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") fn(); });
  }
}

function obCollect(step) {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  if (step === "welcome") { const n = val("obName"); if (n !== null) OB.name = n; const v = val("obVision"); if (v !== null) OB.vision = v; }
  else if (step === "rhythm") { const w = val("obWake"); if (w) OB.wake = w; }
  else if (step === "commit") { const w = val("obWhy"); if (w !== null) OB.why = w; }
  else if (step === "habits") { const c = (val("obCustom") || "").trim(); if (c) OB.custom.push({ text: c, type: obDefaultType(c) }); }
  else if (step === "principles") { const p = (val("obPrinc") || "").trim(); if (p) OB.customPrinciples.push(p); }
}

function obRender() {
  const steps = obStepList();
  obIndex = Math.max(0, Math.min(obIndex, steps.length - 1));
  const step = steps[obIndex];
  document.getElementById("obBody").innerHTML = OB_STEPS[step]();
  obWire(step);
  document.getElementById("obProgressFill").style.width = Math.round(((obIndex + 1) / steps.length) * 100) + "%";
  document.getElementById("obStepCount").textContent = `${obIndex + 1} / ${steps.length}`;
  document.getElementById("obBack").style.visibility = obIndex === 0 ? "hidden" : "visible";
  document.getElementById("obNext").textContent = obIndex === steps.length - 1 ? "Start leveling up →" : "Next";
}

function obNextStep() {
  const step = obStepList()[obIndex];
  obCollect(step);
  if (step === "welcome" && !OB.name.trim()) {
    const n = document.getElementById("obName");
    if (n) { n.focus(); n.classList.add("ob-invalid"); setTimeout(() => n.classList.remove("ob-invalid"), 700); }
    return;
  }
  if (step === "areas" && OB.areas.size === 0) return;
  if (step === "areas") { // seed suggested habits ONLY when the area selection changed (preserve toggles otherwise)
    const sig = [...OB.areas].sort().join(",");
    if (OB._seededSig !== sig) {
      OB.habits = new Map();
      OB_AREAS.filter((a) => OB.areas.has(a.id)).forEach((a) => a.habits.forEach((h) => OB.habits.set(h, obDefaultType(h))));
      OB._seededSig = sig;
    }
  }
  const steps = obStepList();
  if (obIndex >= steps.length - 1) { obFinish(); return; }
  obIndex++;
  obRender();
}
function obBackStep() { obCollect(obStepList()[obIndex]); if (obIndex > 0) { obIndex--; obRender(); } }

function obFinish() {
  if (OB.name.trim()) db.meta.name = OB.name.trim();
  if (OB.vision.trim()) db.meta.vision = OB.vision.trim();
  if (OB.why.trim()) db.meta.why = OB.why.trim();
  if (OB.habits.size > 0 || OB.custom.length > 0) {
    db.habits = obFinalHabits().map((o) => ({ id: uid(), text: o.text, timed: o.type === "timed" }));
  }
  const princ = [], seen = new Set();
  [...OB.principles, ...OB.customPrinciples].forEach((t) => { const k = (t || "").trim(); if (k && !seen.has(k)) { seen.add(k); princ.push(k); } });
  if (princ.length) db.principles = princ.map((t) => ({ id: uid(), text: t }));
  if (OB.split && WORKOUT_TEMPLATES[OB.split]) {
    const t = WORKOUT_TEMPLATES[OB.split];
    db.split = { days: [{ id: uid(), name: t.label, exercises: t.ex.map((e) => ({ id: uid(), name: e[0], sets: e[1], reps: e[2] })) }], schedule: {} };
  }
  if (OB.plan && PLANS[OB.plan]) db.biblePlan = { id: OB.plan, done: 0 };
  db.meta.onboarded = true;
  save();
  document.getElementById("onboardModal").hidden = true;
  rerenderAll();
}

function initOnboarding() {
  OB.principles.add(OB_PRINCIPLES[0]);
  OB.principles.add(OB_PRINCIPLES[1]);
  document.getElementById("obNext").onclick = obNextStep;
  document.getElementById("obBack").onclick = obBackStep;
  if (!db.meta.onboarded) { obIndex = 0; obRender(); document.getElementById("onboardModal").hidden = false; }
}

/* ============================================================
   INSIGHTS DASHBOARD
   ============================================================ */
function renderInsights() {
  const h = computeHistory();
  const rank = rankForRP(h.rp);

  document.getElementById("insightsSub").textContent =
    h.daysActive ? `${h.daysActive} day${h.daysActive === 1 ? "" : "s"} tracked` : "No data yet — start checking things off!";

  const cards = [
    { label: "Level", value: levelInfo(h.rp).level, sub: h.rp.toLocaleString() + " XP" },
    { label: "Rank", value: rank.label, sub: "tier", color: rank.color },
    { label: "Current streak", value: h.streak + "d", sub: "🔥 going" },
    { label: "Longest streak", value: h.longest + "d", sub: "personal best" },
    { label: "Perfect days", value: h.perfectDays, sub: "all habits done" },
    { label: "Quests done", value: h.questsTotal, sub: "bonus quests" },
  ];
  document.getElementById("statCards").innerHTML = cards.map((c) => `
    <div class="stat-card">
      <div class="sc-label">${escapeHtml(c.label)}</div>
      <div class="sc-value"${c.color ? ` style="color:${c.color}"` : ""}>${escapeHtml(String(c.value))}</div>
      <div class="sc-sub">${escapeHtml(c.sub)}</div>
    </div>`).join("");

  renderHeatmap(h);
  renderRpChart(h);
  renderHabitRates(h);
  renderRecords(h);
  renderTrend(h);
}

/* ----- personal records ----- */
function renderRecords(h) {
  const bestDay = h.days.reduce((mx, d) => Math.max(mx, d.earned || 0), 0);
  const totalMin = Object.keys(db.timeLog).reduce((s, k) => s + minutesFor(k), 0);
  const workoutsDone = Object.keys(db.workouts).filter((k) => { const w = workoutPoints(k); return w.total > 0 && w.done >= w.total; }).length;
  // most consistent habit (highest completion % across days it was scheduled)
  let topHabit = "—", topPct = -1;
  db.habits.forEach((hab) => {
    let tracked = 0, done = 0;
    h.days.forEach((d) => { const snap = db.habitSnap[d.key]; if (snap && snap.includes(hab.id)) { tracked++; if ((db.habitLog[d.key] || {})[hab.id]) done++; } });
    if (tracked >= 3) { const pct = Math.round((done / tracked) * 100); if (pct > topPct) { topPct = pct; topHabit = hab.text; } }
  });
  const recs = [
    { label: "Longest streak", value: h.longest + "d" },
    { label: "Biggest XP day", value: "+" + bestDay.toLocaleString() },
    { label: "Perfect days", value: h.perfectDays },
    { label: "Workouts crushed", value: workoutsDone },
    { label: "Minutes focused", value: totalMin.toLocaleString() },
    { label: "Most consistent", value: topPct >= 0 ? `${topPct}%` : "—", sub: topPct >= 0 ? topHabit : "keep going" },
  ];
  document.getElementById("recordGrid").innerHTML = recs.map((r) => `
    <div class="record">
      <div class="rec-label">${escapeHtml(r.label)}</div>
      <div class="rec-value">${escapeHtml(String(r.value))}</div>
      ${r.sub ? `<div class="rec-sub">${escapeHtml(r.sub)}</div>` : ""}
    </div>`).join("");
}

/* ----- trend: this 30 days vs the prior 30 days ----- */
function renderTrend(h) {
  const block = document.getElementById("trendBlock");
  const recent = h.days.slice(-30);
  const prior = h.days.slice(-60, -30);
  if (recent.length < 5 || prior.length < 5) { block.hidden = true; return; }
  const avg = (arr) => arr.reduce((s, d) => s + d.ratio, 0) / arr.length;
  const now = avg(recent), was = avg(prior);
  if (was === 0 && now === 0) { block.hidden = true; return; }
  const pct = was > 0 ? Math.round(((now - was) / was) * 100) : 100;
  block.hidden = false;
  const up = pct >= 0;
  document.getElementById("trendBody").innerHTML =
    `<div class="trend ${up ? "up" : "down"}">
       <span class="trend-arrow">${up ? "▲" : "▼"}</span>
       <span class="trend-pct">${Math.abs(pct)}%</span>
       <span class="trend-text">${up ? "more" : "less"} consistent than the previous 30 days</span>
     </div>`;
}

/* ============================================================
   WEEKLY RECAP (Wrapped-style)
   ============================================================ */
function weekKey(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x); }

function computeWeeklyRecap() {
  const h = computeHistory();
  const week = h.days.slice(-7);
  const sum = (f) => week.reduce((s, d) => s + f(d), 0);
  const xp = sum((d) => Math.max(0, (d.earned || 0) - (d.penalty || 0)));
  const perfect = week.filter((d) => d.complete).length;
  const quests = sum((d) => d.questsDone || 0);
  const workouts = week.filter((d) => { const p = workoutPoints(d.key); return p.total > 0 && p.done >= p.total; }).length;
  let best = null;
  week.forEach((d) => { if (!best || d.earned > best.earned) best = d; });
  let topHabit = null, topN = 0;
  db.habits.forEach((hab) => { let n = 0; week.forEach((d) => { if ((db.habitLog[d.key] || {})[hab.id]) n++; }); if (n > topN) { topN = n; topHabit = hab.text; } });
  const rank = rankForRP(h.rp), lvl = levelInfo(h.rp);
  return { xp, perfect, quests, workouts, best, topHabit, topN, streak: h.streak, freezes: h.freezes, level: lvl.level, rank: rank.label, color: rank.color, name: db.meta.name || "You" };
}

function renderRecap() {
  const r = computeWeeklyRecap();
  const big = (v, l) => `<div class="rc-stat"><div class="rc-num">${escapeHtml(String(v))}</div><div class="rc-lbl">${escapeHtml(l)}</div></div>`;
  document.getElementById("recapBody").innerHTML = `
    <div class="rc-kicker">YOUR WEEK IN REVIEW</div>
    <div class="rc-title">${escapeHtml(r.name)}, here's your week 🎬</div>
    <div class="rc-grid">
      ${big("+" + r.xp.toLocaleString(), "XP earned")}
      ${big(r.perfect, "perfect days")}
      ${big(r.streak + "d", "current streak")}
      ${big(r.quests, "quests done")}
      ${big(r.workouts, "workouts")}
      ${big("Lvl " + r.level, "you're now")}
    </div>
    ${r.topHabit ? `<div class="rc-line">⭐ Most consistent: <strong>${escapeHtml(r.topHabit)}</strong> · ${r.topN}/7 days</div>` : ""}
    ${r.best && r.best.earned > 0 ? `<div class="rc-line">🔝 Biggest day: <strong>+${r.best.earned.toLocaleString()} XP</strong> on ${shortDate(r.best.key)}</div>` : ""}
    <div class="rc-rank" style="color:${r.color}">${escapeHtml(r.rank)}${r.freezes ? ` · 🧊 ${r.freezes} freeze${r.freezes === 1 ? "" : "s"}` : ""}</div>`;
}

function openRecap() { renderRecap(); document.getElementById("recapModal").hidden = false; }
function closeRecap() { document.getElementById("recapModal").hidden = true; }
function shareRecap() {
  const r = computeWeeklyRecap();
  const text = `My UPLVL week 🎬\n+${r.xp.toLocaleString()} XP · ${r.perfect} perfect days · ${r.streak}-day streak\nLevel ${r.level} · ${r.rank}\nBecoming who I want to be. 💪`;
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard ✓", "up")).catch(() => toast("Couldn't share"));
    else toast("Couldn't share");
  };
  if (navigator.share) navigator.share({ text }).catch((err) => { if (!err || err.name !== "AbortError") copy(); });
  else copy();
}
function maybeShowWeeklyRecap() {
  if (!document.getElementById("briefingModal").hidden) return; // briefing owns the open-of-day slot
  const wk = weekKey(new Date());
  if (!db.meta.lastRecapWeek) { db.meta.lastRecapWeek = wk; saveLocal(); return; } // first run: no surprise recap
  if (db.meta.lastRecapWeek === wk || !db.meta.onboarded) return;
  // only show (and stamp the week) if the recapped window actually has something to celebrate
  const r = computeWeeklyRecap();
  if (r.xp > 0 || r.perfect > 0 || r.quests > 0 || r.workouts > 0) {
    db.meta.lastRecapWeek = wk; saveLocal();
    openRecap();
  }
}
document.getElementById("recapBtn").onclick = openRecap;
document.getElementById("recapClose").onclick = closeRecap;
document.getElementById("recapShare").onclick = shareRecap;
document.getElementById("recapModal").addEventListener("click", (e) => { if (e.target.id === "recapModal") closeRecap(); });

function renderHeatmap(h) {
  const map = new Map(h.days.map((d) => [d.key, d]));
  const weeks = 26;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const cells = [];
  const cur = new Date(start);
  while (cur <= today) { cells.push(ymd(cur)); cur.setDate(cur.getDate() + 1); }

  document.getElementById("heatmap").innerHTML = cells.map((key) => {
    const d = map.get(key);
    if (!d) return `<div class="hm-cell b-none" title="${shortDate(key)}: no data"></div>`;
    if (d.frozen) return `<div class="hm-cell frozen" title="${shortDate(key)}: 🧊 streak freeze used"></div>`;
    const r = d.ratio;
    const b = d.complete ? 4 : r === 0 ? 0 : r < 0.34 ? 1 : r < 0.67 ? 2 : 3;
    const perfect = d.complete ? " perfect" : "";
    const t = `${shortDate(key)}: ${d.habitsDone}/${d.habitsTotal} habits${d.complete ? " ✓ perfect" : ""}`;
    return `<div class="hm-cell b${b}${perfect}" title="${t}"></div>`;
  }).join("");

  document.getElementById("heatmapNote").textContent = `Last ${weeks} weeks`;
  document.getElementById("heatLegend").innerHTML =
    `<span class="hm-leg-label">Less</span>` +
    [0, 1, 2, 3, 4].map((b) => `<div class="hm-cell b${b}"></div>`).join("") +
    `<span class="hm-leg-label">More</span>`;
}

function renderRpChart(h) {
  const el = document.getElementById("rpChart");
  if (h.days.length < 2) { el.innerHTML = `<p class="empty">Not enough history yet — come back in a couple of days.</p>`; return; }
  const pts = h.days.map((d) => d.cumRP);
  const max = Math.max(...pts, 1);
  const W = 600, H = 140, pad = 6;
  const stepX = (W - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => [pad + i * stepX, H - pad - (v / max) * (H - pad * 2)]);
  const line = coords.map((c, i) => (i ? "L" : "M") + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ");
  const area = `M${pad} ${H - pad} ` + coords.map((c) => "L" + c[0].toFixed(1) + " " + c[1].toFixed(1)).join(" ") + ` L${W - pad} ${H - pad} Z`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="rp-svg" preserveAspectRatio="none" aria-label="RP over time">
      <defs><linearGradient id="rpg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent)" stop-opacity="0.45"/>
        <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#rpg)"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
    </svg>
    <div class="chart-axis"><span>0 XP</span><span>${max.toLocaleString()} XP</span></div>`;
}

function renderHabitRates(h) {
  const el = document.getElementById("habitRates");
  const empty = document.getElementById("ratesEmpty");
  const recent = h.days.slice(-30);
  if (!db.habits.length || !recent.length) { el.innerHTML = ""; empty.hidden = false; return; }
  empty.hidden = true;

  const rows = db.habits.map((hab) => {
    let tracked = 0, done = 0;
    recent.forEach((d) => {
      const snap = db.habitSnap[d.key]; // only count days this habit was actually on the list
      if (snap && snap.includes(hab.id)) {
        tracked++;
        if ((db.habitLog[d.key] || {})[hab.id]) done++;
      }
    });
    return { text: hab.text, rate: tracked ? Math.round((done / tracked) * 100) : 0 };
  }).sort((a, b) => b.rate - a.rate);

  el.innerHTML = rows.map((r) => `
    <div class="rate-row">
      <div class="rate-label">${escapeHtml(r.text)}</div>
      <div class="rate-bar"><div class="rate-fill" style="width:${r.rate}%"></div></div>
      <div class="rate-pct">${r.rate}%</div>
    </div>`).join("");
}

/* ============================================================
   EXPORT / IMPORT BACKUP
   ============================================================ */
document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").onchange = (e) => {
  const input = e.target;
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => { alert("Couldn't read that file — please try again."); input.value = ""; };
  reader.onload = () => {
    input.value = ""; // always reset so the same file can be re-selected later
    let data;
    try { data = JSON.parse(reader.result); } catch (_) { data = null; }
    const looksValid = isPlainObject(data) &&
      (Array.isArray(data.journal) || Array.isArray(data.habits) ||
       Array.isArray(data.bible) || isPlainObject(data.tasks));
    if (!looksValid) { alert("That file doesn't look like a UPLVL backup."); return; }
    if (!confirm("Import this backup? It will REPLACE the data currently on this device.")) return;

    // Transactional: snapshot current data, attempt the swap, roll back on any failure.
    const backup = JSON.stringify(db);
    const restore = () => { Object.keys(db).forEach((k) => delete db[k]); Object.assign(db, JSON.parse(backup)); rerenderAll(); };
    try {
      Object.keys(db).forEach((k) => delete db[k]);
      Object.assign(db, data);
      migrate();
    } catch (err) {
      console.error("import failed", err);
      restore();
      alert("That backup couldn't be imported — your data was not changed.");
      return;
    }
    if (save()) location.reload();
    else { restore(); } // save() already alerted; just keep current data intact
  };
  reader.readAsText(file);
};

document.getElementById("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `uplvl-backup-${ymd(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/* ============================================================
   TOAST
   ============================================================ */
let activeToast = null;
function toast(msg, kind) {
  if (activeToast) { // only one toast alive at a time
    clearTimeout(activeToast._t1);
    clearTimeout(activeToast._t2);
    activeToast.remove();
  }
  const t = document.createElement("div");
  t.className = "toast " + (kind || "");
  t.setAttribute("role", "status");
  t.setAttribute("aria-live", "polite");
  t.textContent = msg;
  document.body.appendChild(t);
  activeToast = t;
  requestAnimationFrame(() => t.classList.add("show"));
  t._t1 = setTimeout(() => {
    t.classList.remove("show");
    t._t2 = setTimeout(() => { t.remove(); if (activeToast === t) activeToast = null; }, 300);
  }, 2800);
}

/* ============================================================
   MORNING BRIEFING — once a day: a greeting, motivation, + yesterday's growth
   ============================================================ */
const MORNING_QUOTES = [
  "Discipline is just remembering what you actually want.",
  "You don't rise to your goals. You fall to your systems. Stack one today.",
  "Motivation is an emotion. Consistency is who you are.",
  "Boring, repeated, on purpose. That's how it gets built.",
  "A missed day is data, not a verdict. Run the experiment again.",
  "Win the morning and the day has to chase you.",
  "You're not behind. You're early. Keep planting.",
  "Confidence isn't a feeling — it's evidence you've been showing up.",
  "Do today what others won't, so tomorrow you can do what others can't.",
  "Small reps, stupid amounts of times. That's the whole secret.",
  "The version of you that you want is built on ordinary days like this one.",
  "Choose the pain that takes you somewhere.",
  "You can't talk yourself into change. Go collect the proof.",
  "Show up especially when you don't feel like it — that's the rep that counts.",
  "Protect the streak. Future you is watching.",
  "One decision today beats a perfect plan tomorrow.",
  "Become someone who does hard things. Then just be him.",
  "The work is the reward. The results are the receipt.",
  "Don't negotiate with yourself this morning. You already decided.",
  "Every box you check is a vote for who you're becoming.",
  "Growth is quiet. Trust the roots before you see the fruit.",
  "Make it impossible to recognize you in a year.",
];

function dailyIndex(n) {                 // deterministic pick that changes each calendar day
  const k = ymd(new Date());
  let s = 0; for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) >>> 0;
  return s % n;
}

function buildBriefing() {
  const h = computeHistory();
  const lvl = levelInfo(h.rp);
  const rank = rankForRP(h.rp);
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const sun = hr < 12 ? "☀️" : hr < 18 ? "🌤️" : "🌙";
  const name = (db.meta.name || "").trim();
  const quote = MORNING_QUOTES[dailyIndex(MORNING_QUOTES.length)];

  const yKey = ymd(new Date(Date.now() - 86400000));
  const yday = h.days.find((d) => d.key === yKey);
  let recapHtml = "";
  if (yday) {
    const verdict = yday.complete
      ? "Perfect day. That's who you are now."
      : yday.habitsDone > 0 ? "You moved the needle. Build on it."
      : "Yesterday slipped — today's a clean slate.";
    recapHtml = `
      <div class="brief-recap">
        <div class="brief-recap-h">YESTERDAY'S GROWTH</div>
        <div class="brief-line"><span>Habits</span><span>${yday.habitsDone}/${yday.habitsTotal}</span></div>
        <div class="brief-line"><span>XP earned</span><span>+${(yday.earned || 0).toLocaleString()}</span></div>
        ${yday.questsDone ? `<div class="brief-line"><span>Bonus quests</span><span>${yday.questsDone}</span></div>` : ""}
        <div class="brief-verdict">${verdict}</div>
      </div>`;
  }
  const standing = `<div class="brief-standing">${h.streak > 0 ? `<span class="brief-streak">🔥 ${h.streak}-day streak</span> · ` : ""}Level ${lvl.level} · ${escapeHtml(rank.label)}</div>`;

  return `
    <span class="brief-sun">${sun}</span>
    <div class="brief-greet">${greet}${name ? ", " + escapeHtml(name) : ""}</div>
    <div class="brief-quote">${escapeHtml(quote)}</div>
    ${recapHtml}
    ${standing}`;
}

function openBriefing() {
  document.getElementById("briefingBody").innerHTML = buildBriefing();
  document.getElementById("briefingModal").hidden = false;
}
function closeBriefing() { document.getElementById("briefingModal").hidden = true; }
function maybeShowMorningBriefing() {
  if (!db.meta.onboarded) return;
  const today = ymd(new Date());
  if (db.meta.lastBriefing === today) return;            // already greeted today
  db.meta.lastBriefing = today; saveLocal();
  openBriefing();
}
document.getElementById("briefingClose").onclick = closeBriefing;
document.getElementById("briefingStart").onclick = closeBriefing;
document.getElementById("briefingModal").addEventListener("click", (e) => { if (e.target.id === "briefingModal") closeBriefing(); });

/* ============================================================
   JOURNAL SHARE CARD — render an entry as a designed image / PDF
   ============================================================ */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapLines(ctx, text, maxWidth) {
  const out = [];
  (text || "").split("\n").forEach((para) => {
    if (!para.trim()) { out.push(""); return; }
    let line = "";
    para.split(/\s+/).forEach((word) => {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; }
      else line = test;
    });
    if (line) out.push(line);
  });
  return out;
}

function openJournalCard(entry) {
  if (!entry) return;
  document.getElementById("cardModal").hidden = false;
  renderJournalCanvas(entry);
}
function closeJournalCard() { document.getElementById("cardModal").hidden = true; }

async function renderJournalCanvas(entry) {
  const canvas = document.getElementById("journalCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  try { await document.fonts.ready; } catch (_) {}

  // background + glows
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0C1016"); g.addColorStop(1, "#08090C");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color); rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  };
  glow(170, 130, 540, "rgba(25,195,125,0.15)");
  glow(W - 130, H - 200, 580, "rgba(77,141,255,0.15)");
  ctx.strokeStyle = "rgba(230,180,80,0.30)"; ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  const M = 96;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  // header
  ctx.fillStyle = "#E6B450"; ctx.font = '900 italic 40px Archivo, sans-serif';
  ctx.fillText("✦", M, 150);
  ctx.fillStyle = "#F2F5FA"; ctx.font = '900 italic 34px Archivo, sans-serif';
  ctx.fillText("UPLVL", M + 52, 150);
  ctx.fillStyle = "#8A93A2"; ctx.font = '500 26px "JetBrains Mono", monospace'; ctx.textAlign = "right";
  ctx.fillText(new Date(entry.created).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), W - M, 150);
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, 184); ctx.lineTo(W - M, 184); ctx.stroke();

  // decorative quote mark
  ctx.fillStyle = "rgba(230,180,80,0.15)"; ctx.font = '900 230px Archivo, sans-serif';
  ctx.fillText("“", M - 16, 388);

  const maxW = W - M * 2;
  let y = 304;
  // title
  ctx.fillStyle = "#FFFFFF"; ctx.font = '800 italic 58px Archivo, sans-serif';
  wrapLines(ctx, (entry.title || "Untitled").trim(), maxW).slice(0, 3).forEach((ln) => { ctx.fillText(ln, M, y); y += 70; });
  y += 26;
  // body (fit to height, ellipsis if it overflows)
  ctx.fillStyle = "#D5DAE2"; ctx.font = '400 34px Manrope, sans-serif';
  const lineH = 50, bottomLimit = H - 220;
  let lines = wrapLines(ctx, (entry.body || "").trim(), maxW);
  const maxLines = Math.max(1, Math.floor((bottomLimit - y) / lineH));
  let truncated = false;
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); truncated = true; }
  lines.forEach((ln, i) => {
    const text = (truncated && i === lines.length - 1) ? ln.replace(/\s+\S*$/, "") + " …" : ln;
    ctx.fillText(text, M, y); y += lineH;
  });

  // tags
  const tags = entryTags(entry);
  if (tags.length) {
    let tx = M; const ty = H - 168;
    ctx.font = '600 24px Manrope, sans-serif';
    tags.slice(0, 4).forEach((t) => {
      const label = "#" + t;
      const w = ctx.measureText(label).width + 36;
      ctx.fillStyle = "rgba(25,195,125,0.12)"; roundRect(ctx, tx, ty - 31, w, 44, 22); ctx.fill();
      ctx.strokeStyle = "rgba(25,195,125,0.5)"; ctx.lineWidth = 1.5; roundRect(ctx, tx, ty - 31, w, 44, 22); ctx.stroke();
      ctx.fillStyle = "#19C37D"; ctx.fillText(label, tx + 18, ty);
      tx += w + 14;
    });
  }

  // footer
  ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, H - 112); ctx.lineTo(W - M, H - 112); ctx.stroke();
  const hist = computeHistory(); const lvl = levelInfo(hist.rp); const rank = rankForRP(hist.rp);
  ctx.fillStyle = "#8A93A2"; ctx.font = '500 26px "JetBrains Mono", monospace';
  ctx.fillText(`LV ${lvl.level} · ${rank.label.toUpperCase()}`, M, H - 68);
  ctx.fillStyle = "#E6B450"; ctx.textAlign = "right"; ctx.font = '700 italic 28px Archivo, sans-serif';
  ctx.fillText("Leveling up, one day at a time.", W - M, H - 68);
  ctx.textAlign = "left";
}

function downloadCardImage() {
  document.getElementById("journalCanvas").toBlob((blob) => {
    if (!blob) { toast("Couldn't make the image"); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "uplvl-journal-" + ymd(new Date()) + ".png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("Image saved ✓", "up");
  }, "image/png");
}
function cardToPdf() {
  const data = document.getElementById("journalCanvas").toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) { toast("Allow pop-ups to save as PDF"); return; }
  w.document.write(`<!doctype html><html><head><title>UPLVL Journal</title><style>@page{margin:0}html,body{margin:0;background:#08090C}img{width:100%;display:block}</style></head><body><img src="${data}" onload="setTimeout(function(){window.focus();window.print();},150)"></body></html>`);
  w.document.close();
}

document.getElementById("cardClose").onclick = closeJournalCard;
document.getElementById("cardImg").onclick = downloadCardImage;
document.getElementById("cardPdf").onclick = cardToPdf;
document.getElementById("cardModal").addEventListener("click", (e) => { if (e.target.id === "cardModal") closeJournalCard(); });
document.getElementById("journalCard").onclick = () => {
  const entry = ensureEntry(); writeActiveEntry(entry);
  if (!entry.title.trim() && !entry.body.trim()) { toast("Write something first ✍️"); return; }
  save(); renderJournalList();
  openJournalCard(entry);
};

/* ============================================================
   INIT
   ============================================================ */
document.getElementById("todayLabel").textContent = prettyDate(new Date());
try {
  renderDaily();
  renderJournalList();
  renderBible();
  renderBibleExtras();
} catch (e) {
  // Last-resort guard: if something in the data still breaks a renderer,
  // reset (preserving a backup) rather than leaving a blank, dead page.
  console.error("initial render failed — resetting", e);
  try { localStorage.setItem(DB_KEY + ".broken." + Date.now(), JSON.stringify(db)); } catch (_) {}
  Object.keys(db).forEach((k) => delete db[k]);
  Object.assign(db, { tasks: {}, journal: [], bible: [] });
  migrate();
  renderDaily();
  renderJournalList();
  renderBible();
  renderBibleExtras();
  alert("Some saved data was invalid and has been reset. A backup copy was kept on this device.");
}
initOnboarding();
maybeShowMorningBriefing();
maybeShowWeeklyRecap();
