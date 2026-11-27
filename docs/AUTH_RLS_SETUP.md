# Auth + RLS setup (for the owner, step by step)

Goal: real logins (Supabase Auth), and every rule enforced inside the database.
The OLD site keeps working until Step 8 (the "switch"). Steps 1-7 are safe.

## What changed (files)
- `supabase/migrations/20261202_auth_rls_v3.sql` : ONE file, two parts (see below)
- `supabase/migrations/20261202_auth_rls_v3_ROLLBACK.sql` : undo
- `supabase/functions/auth-gate/` : login + signup with rate limits, captcha, logging
- `supabase/functions/admin-users/` : full_admin creates / resets / deletes accounts
- `supabase/functions/notify-push/` : now checks the caller's role
- `src/services/authService.ts`, `src/components/Captcha.tsx`, `AuthScreens.tsx`, `ChangePasswordModal.tsx`, `App.tsx`, `supabaseService.ts`, `utils/security.ts`
- `server.ts` : push endpoints now need a signed-in admin
- Seed migration 20261127: placeholder admin removed. No passwords or hashes in the repo.

## Where the rules live (in the database)
- Nobody changes their own role or teams: trigger `guard_profile_update` + only `full_admin` can write `user_teams` (function `admin_set_user_teams` refuses your own id).
- Self-approval: full_admin, and the team_admin of THAT team, may approve their own requests. Enforced by guard triggers on `team_change_requests` / `adjustment_requests`.
- Leaders never see quantities: they cannot read `product_variants` at all. They read the view `leader_product_variants` (no quantity column).
- Default deny: RLS is on for every table; `anon` has no access.
- Role names: `admin` = team_admin, `worker` = staff (no enum change needed).

## Names are NOT changed
The migration only ADDS: tables `teams`, `user_teams`, `security_events`, view `leader_product_variants`, helper functions. It does not rename, drop or retype any existing table or column (checked by comparing the column list before and after on a copy built from the repo schema). Old `profiles.password_hash` stays as a column (emptied at the switch, old values saved in `private.legacy_password_hashes`). `profiles.assigned_teams` stays and is kept in sync from `user_teams`.
New in the database after the switch: `profiles.id` must match a Supabase Auth user (foreign key). Existing rows and data are kept.

## Steps
0. FIRST (read-only, safe): run `supabase/preflight_schema_check.sql`. Empty result = your database has every table/column the repo expects. Anything listed = tell us before going on. Do the whole process on a staging copy first (Supabase branch or a restored backup), not production.
1. Supabase > SQL editor: paste the whole `20261202_auth_rls_v3.sql` and Run. (Part 1 only: adds tables and functions, copies your users into Supabase Auth. The site still works.)
2. Make yourself full_admin: `select private.make_full_admin('your-email-or-username');`
   (If you have no account yet: `select private.create_first_admin('email','a-long-password','Your Name');`)
3. Deploy the 3 Edge Functions (Supabase > Edge Functions, or CLI `supabase functions deploy auth-gate --no-verify-jwt`, `admin-users`, `notify-push`). `auth-gate` must have "Verify JWT" OFF. Set secret `ALLOWED_ORIGIN` = your site URL. Optional: `TURNSTILE_SECRET_KEY`.
4. Auth dashboard: turn OFF "Allow new users to sign up" (signups go through auth-gate), set rate limits, optionally enable captcha (Cloudflare Turnstile) and put the site key in Vercel as `VITE_TURNSTILE_SITE_KEY`.
5. Open the Vercel PREVIEW of this branch and test every role (table below). The preview needs the switch to be done to show full protection; before the switch, logins already work through Supabase Auth with the same passwords.
6. Users whose old password was stored without a bcrypt hash (old SHA-256 / none) cannot sign in. Reset them from the Accounts screen (set password) or use Supabase > Auth > Users.
7. Merge the PR when you are happy (Vercel deploys the new frontend).
8. THE SWITCH (do it right after the merge, a few minutes of short outage possible):
   `insert into private.app_settings(key,value) values ('allow_lockdown','yes') on conflict (key) do update set value='yes';`
   then run `20261202_auth_rls_v3.sql` again. It aborts safely if there is no active full_admin. It moves old hashes to a private table, drops the old "public" policies, turns on RLS everywhere.
9. Later: confirm everything works for a few days, then delete `private.legacy_password_hashes`.

## Rollback
Run `20261202_auth_rls_v3_ROLLBACK.sql` (restores old hashes, reopens tables), re-run `20261128`, and redeploy the previous frontend.

## Test plan (after the switch; look at blocked attempts with `select * from security_events order by created_at desc;`)
| Role | Should work | Must fail |
|---|---|---|
| full_admin | everything, approve accounts, set teams/roles of others | change own role/teams |
| team_admin (right team) | approve that team's requests, also their own | approve another team's request, change own role |
| team_admin (wrong team) | - | approve requests of other teams |
| staff | view + edit allowed fields, create requests | self-approve, edit price/SKU/quantity directly, change role |
| leader | see products + prices | see any quantity (check network tab: no `quantity`), read product_variants |
| pending user | sign up | log in / read anything |
| wrong password x5 | message "too many attempts" | login keeps working during the lockout window |
| not signed in | - | read any table with the public key (should return nothing/401) |

## Known limits
- A multi-row INSERT in one statement bypasses the per-minute throttle count.
- Blocked order attempts are not logged (the error rolls the log row back).
- Per-team roles are supported in the database; the approval screen still assigns one role.
- Approval queues are `team_change_requests` and `adjustment_requests` (no separate approval_requests table).
- Staff-created bookings that deduct stock may fail for non-inventory-admins.
- `/api/budgeting/claim` (first-run passcode) is still unauthenticated: follow-up.
