# Setting up cross-device sync

This makes your UPLVL data sync automatically between your laptop and phone,
using a free **Supabase** project. It takes about 10 minutes, one time.

The app keeps working locally the whole time — sync only turns on once you finish step 4.

---

## 1. Create a free Supabase project
1. Go to **https://supabase.com** and sign up (free).
2. Click **New project**. Give it any name (e.g. "uplvl"), set a database
   password (save it somewhere), pick a region near you, and create it.
3. Wait ~2 minutes for it to finish setting up.

## 2. Create the data table
1. In your project, open the **SQL Editor** (left sidebar) → **New query**.
2. Paste this in and click **Run**:

```sql
create table if not exists app_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb,
  updated_at timestamptz default now()
);

alter table app_state enable row level security;

create policy "own rows only" on app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

This creates one private row per user, and the security policy means **only you can ever
read or write your own data**.

## 3. (Recommended) Turn off email confirmation for instant sign-in
1. Go to **Authentication → Sign In / Providers → Email**  (or **Authentication → Settings**).
2. Turn **OFF** "Confirm email."
   - If you leave it on, that's fine — you'll just get a confirmation email to click
     the first time you create your account.

## 4. Add your keys to the app
1. In Supabase, go to **Project Settings → API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string — this one is safe to put in the app)
3. Open **`cloud.js`** in this folder and paste them at the top:

```js
const SUPABASE_URL = "https://abcd1234.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...your-anon-key...";
```

> The anon key is meant to be public — your data is still protected by the
> row-level-security policy from step 2.

## 5. Use it
- Open the app, click **☁ Sync** in the footer, **Create account** (email + password),
  then **Sign in**. Your data uploads automatically.
- On your other device, open the app and **Sign in** with the same email/password —
  it pulls your data down. From then on, every change syncs automatically.

---

## Putting it on your phone (hosting)
To open the app on your phone you need it on the web (the code, not your data). Easiest options:

- **Netlify Drop** (no account needed to try): go to **https://app.netlify.com/drop**
  and drag this whole project folder onto the page. You get a public URL instantly.
- **GitHub Pages** or **Vercel** also work if you prefer.

Then open that URL on your phone and **Add to Home Screen** for an app-like icon.

---

## Notes
- **Privacy:** with sync on, your habits/journal/Bible notes are stored in your Supabase
  database (only readable by your account). Without sync, everything stays only on your device.
- **Conflicts:** sync uses "most recently saved wins" on the whole dataset. If you edit the
  same day on two devices while offline, the one you save last wins. For normal use (one
  device at a time) this is seamless. Ask and I can add finer-grained merging later.
- Stuck on any step? Tell me where you are (or paste your Project URL + anon key) and I'll
  finish the wiring and we'll test it together.
