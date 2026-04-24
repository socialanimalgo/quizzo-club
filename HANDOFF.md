# QUIZZO CLUB — Engineer Handoff (2026-04-24)

> Written by Claude (context limit approaching). Pick up from here.

---

## What was completed this session

| # | Task | Status |
|---|------|--------|
| 1 | Hot topic leaderboard bug — `hotTopic` state not forwarded from QuizPlay → QuizResults | ✅ Done |
| 2 | Profile stats always 0 — `/auth/me` now pulls XP/rank/quizzes from `user_stats` | ✅ Done |
| 3 | Kvizopoli never awarded XP — `awardKvizopoliXp()` added to `server/routes/kvizopoli.js` | ✅ Done |
| 4 | `kvizopoli_matches.xp_awarded` column added to `schema.sql` | ✅ Done |
| 5 | Belieber questions expanded to 501 (was ~150) — seeded via `render psql` | ✅ Done |
| 6 | 25 fake Croatian players seeded across alltime / weekly / daily / Belieber leaderboards | ✅ Done |
| 7 | Avatars assigned to all 25 fake players | ✅ Done (see below) |
| 8 | **Username system** | ⏳ **NOT STARTED — your job** |

---

## Your job: Username system

### What the product owner wants
- Replace full name exposure with a unique **username** for all player identification (leaderboards, friend invites, game lobbies)
- Auto-assign a username to every user on first signup (email/Google/Apple)
- Existing real users must get a username (auto-generated, they can change it)
- UI to let users change their username from the Profile page
- Uniqueness enforced at DB level + API level
- Sanitization: lowercase alphanumeric + underscores only, 3–20 chars, no consecutive underscores, no leading/trailing underscores

### How to check if it's done

**Database:**
```sql
-- Should exist with UNIQUE constraint
SELECT column_name, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'username';

-- No user should be missing a username
SELECT COUNT(*) FROM users WHERE username IS NULL OR username = '';
```

**API:**
```bash
# Should return username field
curl -H "Authorization: Bearer <token>" https://quizzo.club/api/auth/me | jq '.user.username'

# Should succeed with a valid username
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"username":"testuser123"}' https://quizzo.club/api/auth/username

# Should reject duplicate
# Should reject invalid chars
```

**Frontend:**
- [ ] Profile page shows username (e.g. `@marko_h`) with an edit button
- [ ] Clicking edit opens an inline input, validates, saves
- [ ] All leaderboard entries show `@username` instead of `First Last`
- [ ] Friends page shows `@username` in search and list
- [ ] No full name visible to other users anywhere

---

## Implementation plan

### 1 — Schema migration (`server/schema.sql`)
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30) UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username);

-- Backfill existing users with a safe default username
UPDATE users
SET username = LOWER(
  REGEXP_REPLACE(first_name, '[^a-zA-Z0-9]', '', 'g')
  || '_'
  || SUBSTRING(id::text, 1, 5)
)
WHERE username IS NULL;
```

Run this on prod via `render psql dpg-d7kio9i8qa3s73bre2v0-a -c "..."`.

### 2 — `server/routes/auth.js`

**a) `sanitizeUser()`** — add `username` field:
```js
username: user.username || null,
```

**b) Auto-assign on register** (after INSERT):
```js
const base = (first_name || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9]/g, '');
let username = base.slice(0, 20) || 'user';
// ensure unique with suffix loop
let suffix = 0;
while (true) {
  const candidate = suffix === 0 ? username : `${username}${suffix}`;
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [candidate]);
  if (!rows.length) { username = candidate; break; }
  suffix++;
}
await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, user.id]);
```
Do the same in Google callback and Apple callback after user creation.

**c) New endpoint** `PUT /api/auth/username`:
```js
router.put('/username', authMiddleware, async (req, res) => {
  const { username } = req.body;
  // validate: /^[a-z0-9_]{3,20}$/ and no __ or leading/trailing _
  // check uniqueness
  // UPDATE users SET username = $1 WHERE id = $2
});
```

### 3 — Frontend: `src/pages/Profile.tsx`
- Display `@{user.username}` below the name
- Add an edit button that shows an inline text input
- On save: `PUT /api/auth/username` → update local user state
- Show error if taken or invalid

### 4 — Leaderboards: update all leaderboard queries/responses
- Return `username` instead of (or in addition to) `first_name + last_name`
- `src/pages/Leaderboard.tsx` and all leaderboard components: render `@username`

### 5 — Friends / invites
- Search by username (not name)
- Display `@username` in friend list and invite UI

---

## Key files to know about

| File | Role |
|------|------|
| `server/routes/auth.js` | Register, login, Google/Apple OAuth, `/me` endpoint |
| `server/routes/leaderboard.js` | Alltime / weekly / daily / hot-topic leaderboards |
| `server/lib/powerups.js` | Wallet (coins/gems/inventory) helpers |
| `server/lib/avatar-bank.js` | 30 basic + 4 premium avatars, SVG renderer |
| `src/pages/Profile.tsx` | Profile page — reads stats from `user` object |
| `src/pages/Leaderboard.tsx` | Leaderboard display |
| `src/context/WalletContext.tsx` | Coins/gems reactive context |
| `server/schema.sql` | DB schema (apply manually via render psql) |

## Prod DB access
```bash
render psql dpg-d7kio9i8qa3s73bre2v0-a
# or pipe a file:
render psql dpg-d7kio9i8qa3s73bre2v0-a -c "$(cat /tmp/migration.sql)"
```

## Deploy
```bash
git push origin main   # Render auto-deploys on push
```

---

## Pending from earlier sessions (lower priority)

- Notifications: `toneForNotification()` missing `daily`, `level`, `badge`, `system` types in `src/pages/Notifications.tsx`
- Daily quiz notification cron job (push notification when new daily quiz goes live)
- Challenge result notification body uses raw `category_id` instead of human label
- Admin broadcast endpoint + UI for push notifications
